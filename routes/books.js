const express = require("express");
const router = express.Router();
const bookController = require("../controller/bookController");
const dashboardController = require("../controller/dashboardController")
const isLoggedIn = require("../middleware/isLoggedIn");
const validateBook = require("../middleware/validateBook");
const wrapAsync = require("../utils/wrapAsync");
const isOwned = require("../middleware/isOwner");
const multer = require("multer");
const { storage } = require("../cloudConfig/cloudinary");

const upload = multer({
    storage
});
// const multer = require("multer");
// const upload = multer({
//     dest: "uploads/"
// });

router.route("/").get(wrapAsync(bookController.latestBooks))

router.route("/books")
    .get(wrapAsync(bookController.index))
    .post(
        isLoggedIn,
         upload.single("image"),
        validateBook,
       
        wrapAsync(bookController.createBook)
    );

router.get(
    "/books/new",
    
    bookController.renderNewForm
);



router.get(
    "/books/:id/edit",
    isLoggedIn,
    bookController.renderEditForm
);

router.get("/books/:id", bookController.showBook);

router.put(
    "/books/:id",
    isLoggedIn,
    isOwned,
    upload.single("image"),
    validateBook,
    bookController.updateBook
);

router.delete(
    "/books/:id",
    isLoggedIn,
    isOwned,
    bookController.deleteBook
);

module.exports = router;