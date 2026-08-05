const express=require("express");
const wrapAsync = require("../utils/wrapAsync")
const router=express.Router();

const profileController=require("../controller/profileController");

router.get(
    "/users/:id",
    wrapAsync(profileController.showProfile)
);

module.exports=router;