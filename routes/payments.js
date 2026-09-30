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
router.get("/payments/success/:id", isLoggedIn, wrapAsync(paymentController.success));

module.exports = router;
