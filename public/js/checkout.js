(() => {
  const button = document.getElementById("pay-button");
  const errorBox = document.getElementById("payment-error");
  if (!button || !window.bookLoopCheckout) return;

  const showError = (message) => {
    errorBox.textContent = message || "Payment could not be completed. Please try again.";
    errorBox.classList.remove("d-none");
  };

  button.addEventListener("click", async () => {
    button.disabled = true;
    errorBox.classList.add("d-none");
    try {
      const response = await fetch("/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookIds: window.bookLoopCheckout.bookIds })
      });
      const order = await response.json();
      if (!response.ok) throw new Error(order.error || "Unable to start checkout.");

      const checkout = new Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "BookLoop",
        description: "Second-hand book purchase",
        order_id: order.orderId,
        handler: async (result) => {
          try {
            const verifyResponse = await fetch("/payments/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result)
            });
            const verification = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(verification.error || "Payment verification failed.");
            window.location.assign(verification.redirect);
          } catch (error) {
            showError(error.message + " If money was deducted, contact support with your Razorpay payment ID: " + result.razorpay_payment_id);
            button.disabled = false;
          }
        },
        modal: { ondismiss: () => { button.disabled = false; } },
        theme: { color: "#2563eb" }
      });
      checkout.on("payment.failed", (event) => {
        showError(event.error?.description || "Payment failed. Please try again.");
        button.disabled = false;
      });
      checkout.open();
    } catch (error) {
      showError(error.message);
      button.disabled = false;
    }
  });
})();
