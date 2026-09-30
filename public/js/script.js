console.log("Website Loaded");

// Reusable loading state for regular form submissions.
(() => {
  "use strict";
  const overlay = document.getElementById("loaderOverlay");
  if (!overlay) return;

  const icon = document.getElementById("loaderIcon");
  const title = document.getElementById("loaderTitle");
  const message = document.getElementById("loaderMessage");
  let activeForm = null;

  const showLoader = (form) => {
    if (activeForm) return;
    activeForm = form;
    if (icon) icon.textContent = form.dataset.loaderIcon || "📚";
    if (title) title.textContent = form.dataset.loaderTitle || "Please Wait";
    if (message) message.textContent = form.dataset.loaderMessage || "Saving your changes...";
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-loading");

    const submitter = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitter) {
      submitter.dataset.originalDisabled = String(submitter.disabled);
      submitter.disabled = true;
      submitter.classList.add("is-loading");
    }
  };

  const hideLoader = () => {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-loading");
    if (activeForm) {
      const submitter = activeForm.querySelector('button[type="submit"], input[type="submit"]');
      if (submitter) {
        submitter.disabled = submitter.dataset.originalDisabled === "true";
        submitter.classList.remove("is-loading");
        delete submitter.dataset.originalDisabled;
      }
    }
    activeForm = null;
  };

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.dataset.noLoader === "true") return;
    if (event.defaultPrevented || !form.checkValidity()) return;
    showLoader(form);
  }, true);

  // Clear stale loading UI when a page is restored from browser history.
  window.addEventListener("pageshow", hideLoader);
})();
