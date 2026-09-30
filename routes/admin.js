const express = require("express");
const router = express.Router();
const adminController = require("../controller/adminController");
const isAdmin = require("../middleware/isAdmin");
const wrapAsync = require("../utils/wrapAsync");

router.use(isAdmin);
router.get("/", wrapAsync(adminController.dashboard));
router.get("/books", wrapAsync(adminController.books));
router.delete("/books/:id", wrapAsync(adminController.deleteBook));
router.get("/users", wrapAsync(adminController.users));
router.post("/users/:id/toggle", wrapAsync(adminController.toggleUser));
router.get("/orders", wrapAsync(adminController.orders));

module.exports = router;
