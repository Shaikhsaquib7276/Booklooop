const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const isLoggedIn = require("../middleware/isLoggedIn");
const notificationController = require("../controller/notificationController");

router.get("/notifications", isLoggedIn, wrapAsync(notificationController.index));

module.exports = router;
