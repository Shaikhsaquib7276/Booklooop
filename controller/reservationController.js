const Book = require("../models/Book");
const Reservation = require("../models/Reservation");

module.exports.createReservation = async (req, res) => {
    const { bookId } = req.body;
    const book = await Book.findById(bookId);

    if (!book) {
        req.flash("error", "Book not found.");
        return res.redirect("/books");
    }

    if (book.owner.equals(req.user._id)) {
        req.flash("error", "You cannot reserve your own book.");
        return res.redirect(`/books/${book._id}`);
    }

    if (book.status !== "Available") {
        req.flash("error", "This book is no longer available for reservation.");
        return res.redirect(`/books/${book._id}`);
    }

    const existingReservation = await Reservation.findOne({
        book: book._id,
        buyer: req.user._id
    });

    if (existingReservation) {
        req.flash("error", "You have already made a request for this book.");
        return res.redirect(`/books/${book._id}`);
    }

    await Reservation.create({
        book: book._id,
        buyer: req.user._id,
        seller: book.owner
    });

    req.flash("success", "Reservation request sent to the seller.");
    res.redirect(`/books/${book._id}`);
};

module.exports.showMyReservations = async (req, res) => {
    const reservations = await Reservation.find({ buyer: req.user._id })
        .populate("book")
        .populate("seller")
        .sort({ createdAt: -1 });

    res.render("reservations/index", {
        reservations,
        title: "My Requests"
    });
};

module.exports.acceptReservation = async (req, res) => {
    const reservation = await Reservation.findById(req.params.id).populate("book");

    if (!reservation || !reservation.book) {
        req.flash("error", "Reservation request not found.");
        return res.redirect("/dashboard");
    }

    if (!reservation.seller.equals(req.user._id)) {
        req.flash("error", "You are not authorized to manage this request.");
        return res.redirect("/dashboard");
    }

    if (reservation.status !== "Pending") {
        req.flash("error", "This request has already been processed.");
        return res.redirect("/dashboard");
    }

    if (reservation.book.status !== "Available") {
        req.flash("error", "This book is no longer available.");
        return res.redirect("/dashboard");
    }

    reservation.book.status = "Reserved";
    reservation.status = "Accepted";

    await reservation.book.save();
    await reservation.save();

    await Reservation.updateMany(
        {
            book: reservation.book._id,
            status: "Pending",
            _id: { $ne: reservation._id }
        },
        { status: "Rejected" }
    );

    req.flash("success", "Request accepted and the book is now reserved.");
    res.redirect("/dashboard");
};

module.exports.rejectReservation = async (req, res) => {
    const reservation = await Reservation.findById(req.params.id);

    if (!reservation) {
        req.flash("error", "Reservation request not found.");
        return res.redirect("/dashboard");
    }

    if (!reservation.seller.equals(req.user._id)) {
        req.flash("error", "You are not authorized to manage this request.");
        return res.redirect("/dashboard");
    }

    if (reservation.status !== "Pending") {
        req.flash("error", "This request has already been processed.");
        return res.redirect("/dashboard");
    }

    reservation.status = "Rejected";
    await reservation.save();

    req.flash("success", "Reservation request rejected.");
    res.redirect("/dashboard");
};
