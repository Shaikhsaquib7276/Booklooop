const express = require("express");
const multer = require("multer");
const wrapAsync = require("../utils/wrapAsync");
const isLoggedIn = require("../middleware/isLoggedIn");
const profileController = require("../controller/profileController");
const { storage } = require("../cloudConfig/cloudinary");

const router = express.Router();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (allowedTypes.includes(file.mimetype)) return callback(null, true);
        callback(new Error("Only JPG, PNG, and WebP image files are allowed."));
    }
});

router.get(
    "/profile/edit",
    isLoggedIn,
    profileController.renderEditProfile
);

router.put(
    "/profile",
    isLoggedIn,
    upload.single("profileImage"),
    wrapAsync(profileController.updateProfile)
);

router.get(
    "/users/:id",
    wrapAsync(profileController.showProfile)
);

module.exports = router;
