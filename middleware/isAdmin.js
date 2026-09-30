const isAdmin = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash("error", "Please log in to access the admin panel.");
        return res.redirect("/login");
    }
    if (req.user.role !== "admin") {
        req.flash("error", "You do not have permission to access the admin panel.");
        return res.redirect("/books");
    }
    next();
};
module.exports = isAdmin;
