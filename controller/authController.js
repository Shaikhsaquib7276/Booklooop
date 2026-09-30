const User = require("../models/user");

module.exports.renderSignup = (req, res) => {
    res.render("users/signup", { title: "Signup" });
};

module.exports.signup = async (req, res, next) => {
    try {
        const { username, email, phone, city, college, password, accountType, shopName, shopAddress, shopLatitude, shopLongitude } = req.body;
        const user = new User({
            username,
            email,
            phone,
            city,
            college,
            accountType: accountType === "shop" ? "shop" : "student",
            shopName: accountType === "shop" ? String(shopName || "").trim() : undefined,
            shopAddress: accountType === "shop" ? String(shopAddress || "").trim() : undefined
        });
        if (accountType === "shop") {
            const lat = Number(shopLatitude), lng = Number(shopLongitude);
            if (!user.shopName || !user.shopAddress || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
                req.flash("error", "Bookshops must provide a name, address, and valid location coordinates.");
                return res.redirect("/signup");
            }
            user.shopLocation = { type: "Point", coordinates: [lng, lat] };
        }
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