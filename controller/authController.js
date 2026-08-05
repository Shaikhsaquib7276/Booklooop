const User = require("../models/user");

module.exports.renderSignup = (req, res) => {
    res.render("users/signup", { title: "Signup" });
};

module.exports.signup = async (req, res, next) => {
    try {
        const { username, email, phone, city, college, password } = req.body;
        const user = new User({
            username,
            email,
            phone,
            city,
            college
        });
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to BookBazaar!");
            return res.redirect("/");
        });
    }
    catch (err) {
        req.flash("error", err.message || "Signup failed");
        return res.redirect("/signup");
    }
};

module.exports.renderLogin = (req, res) => {
    res.render("users/login", { title: "Login" });
};

module.exports.login = (req, res) => {
    req.flash("success", "Welcome Back!");
    res.redirect("/");
};

module.exports.logout = (req, res, next) => {
    req.logout(function (err) {
        if (err) return next(err);
        req.flash("success", "Logged Out Successfully");
        res.redirect("/");
    });
};