module.exports = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash("error", "Please Login First");
        return res.redirect("/login");
    }

    if (req.user.accountType !== "student") {
        req.flash("error", "Smart Semester Finder is available for student accounts.");
        return res.redirect("/nearby-books");
    }

    next();
};
