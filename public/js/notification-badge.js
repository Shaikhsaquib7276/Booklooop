(() => {
  const badge = document.getElementById("notificationBadge");
  if (!badge) return;

  const refresh = async () => {
    try {
      const response = await fetch("/notifications/unread-count", {
        headers: { "Accept": "application/json" },
        credentials: "same-origin"
      });
      if (!response.ok) return;

      const data = await response.json();
      const count = Number(data.count) || 0;
      badge.textContent = count > 99 ? "99+" : String(count);
      badge.classList.toggle("d-none", count === 0);
    } catch {
      // Notification UI should never break the rest of the navbar.
    }
  };

  refresh();
  window.setInterval(refresh, 30000);
})();
