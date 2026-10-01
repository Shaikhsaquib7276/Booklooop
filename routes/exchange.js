const express = require("express");
const router = express.Router();
const controller = require("../controller/exchangeController");
const isLoggedIn = require("../middleware/isLoggedIn");
const wrapAsync = require("../utils/wrapAsync");

router.get("/exchange", isLoggedIn, wrapAsync(controller.browse));
router.get("/exchange/mine", isLoggedIn, wrapAsync(controller.mine));
router.post("/exchange", isLoggedIn, wrapAsync(controller.create));
router.post("/exchange/:id/respond", isLoggedIn, wrapAsync(controller.respond));
router.post("/exchange/:id/cancel", isLoggedIn, wrapAsync(controller.cancel));
router.post("/exchange/:id/confirm", isLoggedIn, wrapAsync(controller.confirm));
module.exports = router;
