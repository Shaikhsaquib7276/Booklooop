const express = require("express");

const router = express.Router();

const isLoggedIn = require("../middleware/isLoggedIn");

const wishlistController = require("../controller/wishlistController");

router.post(
    "/wishlist/toggle/:id",
    isLoggedIn,
    wishlistController.toggleWishlist
);

router.get(
    "/wishlist",
    isLoggedIn,
    wishlistController.showWishlist
);

module.exports = router;