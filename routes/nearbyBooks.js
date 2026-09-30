const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const nearbyController = require("../controller/nearbyBookController");

// Public search; coordinates are supplied by the browser only after user consent.
router.get("/nearby-books", wrapAsync(nearbyController.index));

module.exports = router;
