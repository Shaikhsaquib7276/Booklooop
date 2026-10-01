(() => {
    "use strict";

    const root = document.querySelector("[data-search-autocomplete]");
    if (!root) return;

    const form = root.closest("form");
    const input = root.querySelector("#bookSearchInput");
    const list = root.querySelector("#bookSearchSuggestions");

    if (!form || !input || !list) return;

    let debounceTimer = null;
    let requestController = null;
    let suggestions = [];
    let activeIndex = -1;

    const hide = () => {
        list.hidden = true;
        list.innerHTML = "";
        suggestions = [];
        activeIndex = -1;
    };

    const render = (items) => {
        suggestions = items;
        activeIndex = -1;

        if (!items.length) {
            hide();
            return;
        }

        list.innerHTML = "";

        items.forEach((item, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "search-suggestion";
            button.setAttribute("role", "option");
            button.dataset.index = String(index);

            const icon = item.type === "Author"
                ? "person"
                : item.type === "Category"
                    ? "tag"
                    : "book";

            button.innerHTML =
                '<span class="search-suggestion-icon"><i class="bi bi-' + icon + '"></i></span>' +
                '<span class="search-suggestion-text">' + escapeHtml(item.text) + '</span>' +
                '<span class="search-suggestion-type">' + escapeHtml(item.type) + '</span>';

            button.addEventListener("mousedown", (event) => {
                event.preventDefault();
            });

            button.addEventListener("click", () => {
                input.value = item.text;
                hide();
                form.submit();
            });

            list.appendChild(button);
        });

        list.hidden = false;
    };

    const escapeHtml = (value) => {
        const div = document.createElement("div");
        div.textContent = String(value || "");
        return div.innerHTML;
    };

    const updateActive = () => {
        const buttons = list.querySelectorAll(".search-suggestion");
        buttons.forEach((button, index) => {
            const active = index === activeIndex;
            button.classList.toggle("active", active);
            button.setAttribute("aria-selected", String(active));
        });
    };

    const fetchSuggestions = async () => {
        const query = input.value.trim();

        if (query.length < 2) {
            hide();
            return;
        }

        if (requestController) requestController.abort();
        requestController = new AbortController();

        try {
            const response = await fetch("/books/search-suggestions?q=" + encodeURIComponent(query), {
                headers: { "Accept": "application/json" },
                signal: requestController.signal
            });

            if (!response.ok) throw new Error("Suggestion request failed");

            const data = await response.json();
            render(Array.isArray(data.suggestions) ? data.suggestions : []);
        } catch (error) {
            if (error.name !== "AbortError") hide();
        }
    };

    input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchSuggestions, 220);
    });

    input.addEventListener("keydown", (event) => {
        if (list.hidden || !suggestions.length) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            activeIndex = (activeIndex + 1) % suggestions.length;
            updateActive();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            activeIndex = activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1;
            updateActive();
        } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            input.value = suggestions[activeIndex].text;
            hide();
            form.submit();
        } else if (event.key === "Escape") {
            hide();
        }
    });

    document.addEventListener("click", (event) => {
        if (!root.contains(event.target)) hide();
    });
})();
