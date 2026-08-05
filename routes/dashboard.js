

const express = require("express");
const router = express.Router();
const dashboardController = require("../controller/dashboardController")
const isLoggedIn = require("../middleware/isLoggedIn");
const validateBook = require("../middleware/validateBook");
const wrapAsync = require("../utils/wrapAsync");
const isOwned = require("../middleware/isOwner");
const multer = require("multer");
const { storage } = require("../cloudConfig/cloudinary");


router.get(
    "/dashboard",
    isLoggedIn,
    dashboardController.dashboard
);

module.exports = router;