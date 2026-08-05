const Book = require("../models/Book");

module.exports = async (req, res, next) => {

    const { id } = req.params;

    const book = await Book.findById(id);

    if (!book) {
        req.flash("error", "Book not found.");
        return res.redirect("/books");
    }

    if (!book.owner.equals(req.user._id)) {

        req.flash("error", "You are not authorized to perform this action.");

        return res.redirect(`/books/${id}`);
    }

    next();
};