const User = require("../models/user");
const Book = require("../models/Book");

module.exports.showProfile = async (req, res) => {
    const { id } = req.params;
    const seller = await User.findById(id);

    if (!seller) {
        req.flash("error", "Seller not found");
        return res.redirect("/books");
    }

    const books = await Book.find({ owner: id }).sort({ createdAt: -1 });
    res.render("profile/show", { seller, books, title: seller.username });
};

module.exports.renderEditProfile = (req, res) => {
    res.render("users/profile", {
        title: "Edit Profile",
        user: req.user
    });
};

module.exports.updateProfile = async (req, res) => {
    const { username, email, phone, city, college } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
        req.flash("error", "User not found");
        return res.redirect("/");
    }

    const normalizedUsername = String(username || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedUsername || !normalizedEmail) {
        req.flash("error", "Username and email are required");
        return res.redirect("/profile/edit");
    }

    const duplicateUser = await User.findOne({
        $or: [
            { username: normalizedUsername },
            { email: normalizedEmail }
        ],
        _id: { $ne: user._id }
    });

    if (duplicateUser) {
        req.flash("error", "Username or email is already in use");
        return res.redirect("/profile/edit");
    }

    user.username = normalizedUsername;
    user.email = normalizedEmail;
    user.phone = String(phone || "").trim();
    user.city = String(city || "").trim();
    user.college = String(college || "").trim();

    if (req.file) {
        user.profileImage = {
            url: req.file.path,
            filename: req.file.filename
        };
    }

    await user.save();

    req.flash("success", "Profile updated successfully");
    res.redirect(`/users/${user._id}`);
};
