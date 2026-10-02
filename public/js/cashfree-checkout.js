(() => {
  const button = document.getElementById("cashfree-pay-button");
  const errorBox = document.getElementById("payment-error");
  if (!button || !window.bookLoopCheckout?.cashfreeEnabled) return;

  const showError = (message) => {
    errorBox.textContent = message || "Cashfree payment could not be completed. Please try again.";
    errorBox.classList.remove("d-none");
  };

  button.addEventListener("click", async () => {
    button.disabled = true;
    errorBox.classList.add("d-none");

    try {
      if (typeof Cashfree !== "function") {
        throw new Error("Cashfree checkout could not be loaded. Refresh the page and try again.");
      }

      const response = await fetch("/payments/cashfree/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookIds: window.bookLoopCheckout.bookIds })
      });

      const order = await response.json();
      if (!response.ok) throw new Error(order.error || "Unable to start Cashfree checkout.");
      if (!order.paymentSessionId) throw new Error("Cashfree payment session was not created.");

      const cashfree = Cashfree({
        mode: order.mode || "sandbox"
      });

      await cashfree.checkout({
        paymentSessionId: order.paymentSessionId,
        redirectTarget: "_self"
      });
    } catch (error) {
      showError(error.message);
      button.disabled = false;
    }
  });
})();
