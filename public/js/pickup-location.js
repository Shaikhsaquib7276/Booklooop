(() => {
  const searchInput = document.getElementById("pickupLocationSearch");
  const searchButton = document.getElementById("pickupLocationSearchButton");
  const suggestions = document.getElementById("pickupLocationSuggestions");
  const addressInput = document.getElementById("pickupAddress");
  const latitudeInput = document.getElementById("bookLatitude");
  const longitudeInput = document.getElementById("bookLongitude");
  const useCurrentButton = document.getElementById("useCurrentPickupLocation");
  const status = document.getElementById("pickupLocationStatus");
  const coordinates = document.getElementById("pickupLocationCoordinates");
  const mapElement = document.getElementById("pickupLocationMap");
  const form = document.getElementById("bookForm") || document.querySelector("form[data-pickup-location-form]");

  if (!mapElement || !window.L || !latitudeInput || !longitudeInput) return;

  const DEFAULT_CENTER = [20.5937, 78.9629];
  const INITIAL_LAT = Number(latitudeInput.value);
  const INITIAL_LNG = Number(longitudeInput.value);
  const hasInitialLocation =
    Number.isFinite(INITIAL_LAT) &&
    Number.isFinite(INITIAL_LNG) &&
    Math.abs(INITIAL_LAT) <= 90 &&
    Math.abs(INITIAL_LNG) <= 180;

  const map = L.map(mapElement).setView(
    hasInitialLocation ? [INITIAL_LAT, INITIAL_LNG] : DEFAULT_CENTER,
    hasInitialLocation ? 15 : 5
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  let marker = hasInitialLocation
    ? L.marker([INITIAL_LAT, INITIAL_LNG], { draggable: true }).addTo(map)
    : null;

  let lastGeocoderRequest = 0;
  let requestInFlight = false;
  let suggestionTimer = null;

  const validCoordinates = (lat, lng) =>
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  const setStatus = (message, isError = false) => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("text-danger", isError);
    status.classList.toggle("text-success", !isError && Boolean(message));
  };

  const updateCoordinateText = () => {
    if (!coordinates) return;
    const lat = Number(latitudeInput.value);
    const lng = Number(longitudeInput.value);
    coordinates.textContent = validCoordinates(lat, lng)
      ? \`Selected: \${lat.toFixed(6)}, \${lng.toFixed(6)}\`
      : "No precise pickup location selected yet.";
  };

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

  const ensureMarker = (lat, lng) => {
    if (!marker) {
      marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      marker.on("dragend", handleMarkerDragEnd);
    } else {
      marker.setLatLng([lat, lng]);
      if (!marker._map) marker.addTo(map);
    }
    map.setView([lat, lng], Math.max(map.getZoom(), 15));
  };

  const saveCoordinates = (lat, lng, centerMap = true) => {
    latitudeInput.value = Number(lat).toFixed(6);
    longitudeInput.value = Number(lng).toFixed(6);
    ensureMarker(Number(lat), Number(lng));
    if (centerMap) map.setView([Number(lat), Number(lng)], Math.max(map.getZoom(), 15));
    updateCoordinateText();
  };

  const waitForRateLimit = async () => {
    const elapsed = Date.now() - lastGeocoderRequest;
    if (elapsed < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
    }
    lastGeocoderRequest = Date.now();
  };

  const nominatimRequest = async (url) => {
    if (requestInFlight) return null;
    requestInFlight = true;
    try {
      await waitForRateLimit();
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(\`Geocoder returned \${response.status}\`);
      return await response.json();
    } finally {
      requestInFlight = false;
    }
  };

  const clearSuggestions = () => {
    if (!suggestions) return;
    suggestions.innerHTML = "";
    suggestions.classList.remove("is-open");
  };

  const renderSuggestions = (results) => {
    if (!suggestions) return;
    suggestions.innerHTML = "";

    if (!results.length) {
      suggestions.innerHTML = '<div class="pickup-location-no-results">No locations found. Try a more specific address.</div>';
      suggestions.classList.add("is-open");
      return;
    }

    results.forEach((result) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pickup-location-suggestion";
      const parts = String(result.display_name || "").split(",");
      button.innerHTML = \`<strong>\${escapeHtml(parts.slice(0, 2).join(", "))}</strong><span>\${escapeHtml(result.display_name || "")}</span>\`;
      button.addEventListener("click", () => {
        const lat = Number(result.lat);
        const lng = Number(result.lon);
        if (!validCoordinates(lat, lng)) return;
        saveCoordinates(lat, lng);
        if (addressInput) addressInput.value = result.display_name || "";
        if (searchInput) searchInput.value = result.display_name || "";
        clearSuggestions();
        setStatus("Pickup location selected.");
      });
      suggestions.appendChild(button);
    });

    suggestions.classList.add("is-open");
  };

  const searchLocation = async () => {
    const query = String(searchInput?.value || "").trim();
    if (query.length < 3) {
      setStatus("Type at least 3 characters to search.", true);
      clearSuggestions();
      return;
    }

    setStatus("Searching address…");

    try {
      const results = await nominatimRequest(
        "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=in&q=" +
        encodeURIComponent(query)
      );

      const safeResults = Array.isArray(results) ? results : [];
      renderSuggestions(safeResults);
      setStatus(
        safeResults.length ? "Select a location from the results." : "No matching location found.",
        !safeResults.length
      );
    } catch (error) {
      console.error("Pickup geocoding error:", error);
      clearSuggestions();
      setStatus("Address search is temporarily unavailable. You can place the pin directly on the map.", true);
    }
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      setStatus("Updating address…");
      const result = await nominatimRequest(
        "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=" +
        encodeURIComponent(lat) + "&lon=" + encodeURIComponent(lng)
      );

      if (result?.display_name && addressInput) {
        addressInput.value = result.display_name;
        if (searchInput) searchInput.value = result.display_name;
      }
      setStatus("Pickup location selected.");
    } catch (error) {
      console.error("Pickup reverse geocoding error:", error);
      setStatus("Pin updated. Add or edit the address line manually.", true);
    }
  };

  async function handleMarkerDragEnd() {
    const point = marker.getLatLng();
    saveCoordinates(point.lat, point.lng, false);
    await reverseGeocode(point.lat, point.lng);
  }

  map.on("click", async (event) => {
    saveCoordinates(event.latlng.lat, event.latlng.lng);
    await reverseGeocode(event.latlng.lat, event.latlng.lng);
  });

  if (marker) marker.on("dragend", handleMarkerDragEnd);

  searchButton?.addEventListener("click", searchLocation);

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchLocation();
    }
  });

  searchInput?.addEventListener("input", () => {
    clearTimeout(suggestionTimer);
    const query = searchInput.value.trim();
    if (query.length < 3) {
      clearSuggestions();
      return;
    }
    suggestionTimer = setTimeout(() => searchLocation(), 650);
  });

  document.addEventListener("click", (event) => {
    if (suggestions && !suggestions.parentElement.contains(event.target)) {
      clearSuggestions();
    }
  });

  useCurrentButton?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      setStatus("Your browser does not support location access.", true);
      return;
    }

    setStatus("Getting your current location…");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (!validCoordinates(lat, lng)) {
          setStatus("Browser returned an invalid location.", true);
          return;
        }

        saveCoordinates(lat, lng);
        await reverseGeocode(lat, lng);
      },
      (error) => {
        console.error("Pickup geolocation error:", error);
        if (error.code === 1) {
          setStatus("Location permission is blocked. Allow it in the browser and try again.", true);
        } else if (error.code === 2) {
          setStatus("Current location could not be determined. Search the address or click the map.", true);
        } else if (error.code === 3) {
          setStatus("Location request timed out. Search the address or click the map.", true);
        } else {
          setStatus("Could not get your current location. Search the address or click the map.", true);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      }
    );
  });

  form?.addEventListener("submit", (event) => {
    const lat = Number(latitudeInput.value);
    const lng = Number(longitudeInput.value);

    if (!validCoordinates(lat, lng)) {
      event.preventDefault();
      setStatus("Select the precise pickup location on the map before saving the book.", true);
      mapElement.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (addressInput && !addressInput.value.trim()) {
      event.preventDefault();
      addressInput.focus();
      setStatus("Add the pickup address line before saving the book.", true);
    }
  });

  updateCoordinateText();

  if (hasInitialLocation) {
    setStatus("Pickup location loaded. Drag the pin or click the map to change it.");
    if (searchInput && addressInput?.value) searchInput.value = addressInput.value;
  } else {
    setStatus("Search an address, click the map, or use your current location.");
  }

  setTimeout(() => map.invalidateSize(), 100);
})();
