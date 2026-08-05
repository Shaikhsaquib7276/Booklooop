const express = require("express");

const router = express.Router();

const passport = require("passport");
const validateUser = require("../middleware/validateUser");
const authController = require("../controller/authController");
const wrapAsync = require("../utils/wrapAsync");

// Signup
router
    .route("/signup")
    .get(authController.renderSignup)
    .post(validateUser, wrapAsync(authController.signup));

// Login

router
    .route("/login")
    .get(authController.renderLogin)
    .post(
        passport.authenticate("local", {
            failureRedirect: "/login",
            failureFlash: true
        }),
        authController.login
    );

// Logout

router.get("/logout", authController.logout);

module.exports = router;