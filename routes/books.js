const express = require("express");
const router = express.Router();
const bookController = require("../controller/bookController");
const isLoggedIn = require("../middleware/isLoggedIn");
const validateBook = require("../middleware/validateBook");
const wrapAsync = require("../utils/wrapAsync");
const isOwned = require("../middleware/isOwner");
const multer = require("multer");
const { storage } = require("../cloudConfig/cloudinary");

const upload = multer({
    storage,
    limits: {
        files: 8
    },
    fileFilter: (req, file, callback) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

        if (allowedTypes.includes(file.mimetype)) {
            return callback(null, true);
        }

        callback(new Error("Only JPG, PNG, and WebP image files are allowed."));
    }
});

// Accept the legacy single image field and the new multiple-image gallery field.
const bookImageUpload = upload.fields([
    { name: "image", maxCount: 1 },
    { name: "images", maxCount: 8 }
]);

router.route("/").get(wrapAsync(bookController.latestBooks));

router.route("/books")
    .get(wrapAsync(bookController.index))
    .post(
        isLoggedIn,
        bookImageUpload,
        validateBook,
        wrapAsync(bookController.createBook)
    );

router.get(
    "/books/new",
    isLoggedIn,
    bookController.renderNewForm
);

router.get(
    "/books/:id/edit",
    isLoggedIn,
    isOwned,
    bookController.renderEditForm
);

router.get("/books/:id", wrapAsync(bookController.showBook));

router.put(
    "/books/:id",
    isLoggedIn,
    isOwned,
    bookImageUpload,
    validateBook,
    wrapAsync(bookController.updateBook)
);

router.delete(
    "/books/:id",
    isLoggedIn,
    isOwned,
    wrapAsync(bookController.deleteBook)
);

module.exports = router;
