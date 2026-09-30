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
  let isVisible = false;

  const showLoader = (form = null) => {
    if (isVisible) return;
    isVisible = true;
    activeForm = form;
    if (icon) icon.textContent = (form && form.dataset.loaderIcon) || "📚";
    if (title) title.textContent = (form && form.dataset.loaderTitle) || "Loading";
    if (message) message.textContent = (form && form.dataset.loaderMessage) || "Please wait while the page loads...";
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
    isVisible = false;
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target && link.target !== "_self") return;
    if (link.hasAttribute("download")) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.href === window.location.href || url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return;
    showLoader();
  });

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.dataset.noLoader === "true") return;
    if (event.defaultPrevented || !form.checkValidity()) return;
    showLoader(form);
  }, true);

  // Clear stale loading UI when a page is restored from browser history.
  window.addEventListener("pageshow", hideLoader);
})();
