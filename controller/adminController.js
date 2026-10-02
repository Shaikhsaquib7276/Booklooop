const Book = require("../models/Book");
const User = require("../models/user");
const Order = require("../models/Order");
const BookRequest = require("../models/BookRequest");
const { notifyUsers } = require("../utils/notificationService");

module.exports.dashboard = async (req, res) => {
    const [bookCount, userCount, orderCount, soldCount, paidOrders] = await Promise.all([
        Book.countDocuments(),
        User.countDocuments(),
        Order.countDocuments(),
        Book.countDocuments({ status: "Sold" }),
        Order.find({ status: "paid" }).select("amount")
    ]);
    const revenue = paidOrders.reduce(
    (sum, order) => sum + Number(order.amount || 0),
    0
) / 100;
    res.render("admin/index", { title: "Admin Dashboard", stats: { bookCount, userCount, orderCount, soldCount, revenue } });
};

module.exports.books = async (req, res) => {
    const books = await Book.find({}).populate("owner", "username email").sort({ createdAt: -1 });
    res.render("admin/books", { title: "Manage Books", books });
};

module.exports.deleteBook = async (req, res) => {
    const book = await Book.findById(req.params.id);
    if (!book) {
        req.flash("error", "Book not found.");
        return res.redirect("/admin/books");
    }

    // A marketplace listing is one physical copy; the academic catalog is
    // independent. Re-open any student requests that were matched to this copy.
    const matchedRequests = await BookRequest.find({
        matchedBook: book._id,
        status: "Matched"
    }).select("_id student").lean();

    await BookRequest.updateMany(
        { matchedBook: book._id, status: "Matched" },
        { $set: { status: "Open", matchedBook: null, matchedAt: null } }
    );

    await Book.findByIdAndDelete(book._id);

    await notifyUsers({
        type: "listing_update",
        title: "A matched book listing was removed",
        message: book.title + " was removed by an administrator. Your book request is open again.",
        link: "/book-requests"
    }, matchedRequests.map(request => request.student));

    req.flash("success", matchedRequests.length
        ? "Book deleted and affected requests were reopened."
        : "Book deleted successfully.");
    res.redirect("/admin/books");
};

module.exports.users = async (req, res) => {
    const users = await User.find({}).select("-hash -salt").sort({ createdAt: -1 });
    res.render("admin/users", { title: "Manage Users", users });
};

module.exports.toggleUser = async (req, res) => {
    if (String(req.user._id) === String(req.params.id)) {
        req.flash("error", "You cannot suspend your own admin account.");
        return res.redirect("/admin/users");
    }
    const user = await User.findById(req.params.id);
    if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/admin/users");
    }
    user.isActive = !user.isActive;
    await user.save();
    req.flash("success", "User " + (user.isActive ? "activated" : "suspended") + " successfully.");
    res.redirect("/admin/users");
};

module.exports.orders = async (req, res) => {
    const orders = await Order.find({}).populate("buyer", "username email").sort({ createdAt: -1 });
    res.render("admin/orders", { title: "Manage Orders", orders });
};
