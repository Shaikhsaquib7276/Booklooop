const overlay = document.getElementById("loaderOverlay");

function showLoader(icon, title, message) {

    document.getElementById("loaderIcon").textContent = icon;

    document.getElementById("loaderTitle").textContent = title;

    document.getElementById("loaderMessage").textContent = message;

    overlay.classList.add("active");

}

function hideLoader() {

    overlay.classList.remove("active");

}

// ======================================
// Automatic Form Loader
// ======================================

document.querySelectorAll("form").forEach((form) => {

    form.addEventListener("submit", () => {

        showLoader(

            form.dataset.loaderIcon || "⏳",

            form.dataset.loaderTitle || "Please Wait",

            form.dataset.loaderMessage || "Processing your request..."

        );

    });

});