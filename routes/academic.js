const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync");
const isLoggedIn = require("../middleware/isLoggedIn");
const isAdmin = require("../middleware/isAdmin");
const academicController = require("../controller/academicController");

router.get("/find-books", require("../middleware/isStudent"), wrapAsync(academicController.findBooks));
router.get("/academic/options", wrapAsync(academicController.options));
router.get("/academic/suggestions", isLoggedIn, wrapAsync(academicController.searchAcademicSuggestions));
router.post("/book-requests/:id", require("../middleware/isStudent"), wrapAsync(academicController.requestBook));
router.post("/admin/academic/:id/verify", isAdmin, wrapAsync(academicController.verifyAcademicBook));
router.post("/admin/academic/:id/reject", isAdmin, wrapAsync(academicController.rejectAcademicBook));
router.get("/book-requests", require("../middleware/isStudent"), wrapAsync(academicController.myRequests));
router.get("/my-academic-books", require("../middleware/isStudent"), wrapAsync(academicController.myBooks));
router.post("/my-academic-books/:id/relist", require("../middleware/isStudent"), wrapAsync(academicController.relist));

router.get("/admin/academic", isAdmin, wrapAsync(academicController.adminIndex));
router.delete("/admin/academic/:id", isAdmin, wrapAsync(academicController.adminDelete));

module.exports = router;
