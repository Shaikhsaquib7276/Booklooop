const express = require("express");
const router = express.Router();
const paymentController = require("../controller/paymentController");
const isLoggedIn = require("../middleware/isLoggedIn");
const wrapAsync = require("../utils/wrapAsync");

router.get("/cart", isLoggedIn, wrapAsync(paymentController.checkout));
router.post("/cart/add/:id", isLoggedIn, wrapAsync(paymentController.addToCart));
router.post("/cart/remove/:id", isLoggedIn, paymentController.removeFromCart);
router.get("/checkout/buy/:id", isLoggedIn, (req, res) => {
  req.session.cart = [req.params.id];
  res.redirect("/cart");
});
router.post("/payments/create-order", isLoggedIn, wrapAsync(paymentController.createOrder));
router.post("/payments/verify", isLoggedIn, wrapAsync(paymentController.verifyPayment));
router.post("/payments/cashfree/create-order", isLoggedIn, wrapAsync(paymentController.cashfreeCreateOrder));
router.get("/payments/cashfree/success", isLoggedIn, wrapAsync(paymentController.cashfreeSuccess));
router.get("/payments/success/:id", isLoggedIn, wrapAsync(paymentController.success));

module.exports = router;
