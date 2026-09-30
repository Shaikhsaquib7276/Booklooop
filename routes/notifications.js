const express=require("express");
const router=express.Router();
const c=require("../controller/notificationController");
const wrapAsync=require("../utils/wrapAsync");
const isLoggedIn=require("../middleware/isLoggedIn");
router.get("/notifications",isLoggedIn,wrapAsync(c.index));
module.exports=router;