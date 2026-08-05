
const path = require("path");
const Book = require("../models/Book");


module.exports.dashboard = async (req, res) => {

    const books = await Book.find({
        owner: req.user._id
    }).sort({ createdAt: -1 });

    const totalBooks = books.length;

    const totalValue = books.reduce((sum, book) => sum + book.price, 0);

    res.render("dashboard/index", {
        books,
        totalBooks,
        totalValue,
        title: "Dashboard"
    });

};