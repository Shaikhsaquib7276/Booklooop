const User = require("../models/user");

const Book = require("../models/Book");

module.exports.showProfile = async (req, res) => {

    const { id } = req.params;
    const seller = await User.findById(id);

    if (!seller) {
        req.flash("error", "Seller not found");
        return res.redirect("/books");
    }

    const books = await Book.find({
        owner: id
    }).sort({
        createdAt: -1
    });

    res.render("profile/show", {
        seller,
        books,
        title: seller.username
    });

};