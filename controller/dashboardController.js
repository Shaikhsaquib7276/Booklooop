
const path = require("path");
const Book = require("../models/Book");
const User = require("../models/user");
const Reservation = require("../models/Reservation");


module.exports.dashboard = async (req, res) => {

    const [books, user, pendingReservations] = await Promise.all([
        Book.find({ owner: req.user._id }).sort({ createdAt: -1 }),
        User.findById(req.user._id).select("wishlist"),
        Reservation.find({ seller: req.user._id, status: "Pending" })
            .populate("book")
            .populate("buyer")
            .sort({ createdAt: -1 })
    ]);

    const totalBooks = books.length;

    const totalValue = books.reduce((sum, book) => sum + book.price, 0);
    const availableBooks = books.filter((book) => book.status === "Available").length;
    const wishlistCount = user ? user.wishlist.length : 0;

    res.render("dashboard/index", {
        books,
        totalBooks,
        totalValue,
        availableBooks,
        wishlistCount,
        pendingReservations,
        title: "Dashboard"
    });

};
