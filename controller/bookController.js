const path = require("path");
const Book = require("../models/Book");
const Reservation = require("../models/Reservation");
const AcademicBook = require("../models/AcademicBook");
const BookRequest = require("../models/BookRequest");
const Notification = require("../models/Notification");
const { attachAcademicBook } = require("../utils/academicMatcher");

async function notifyAcademicMatches(book, sellerId) {
    if (!book.academicBook) return;
    const academicBook = await AcademicBook.findOne({
        _id: book.academicBook,
        active: true,
        verificationStatus: "verified"
    }).select("_id title").lean();
    if (!academicBook) return;
    const requests = await BookRequest.find({ academicBook: book.academicBook, status: "Open", student: { $ne: sellerId } }).select("_id student").lean();
    if (!requests.length) return;
    await BookRequest.updateMany({ _id: { $in: requests.map(r => r._id) } }, { $set: { status: "Matched", matchedBook: book._id, matchedAt: new Date() } });
    await Notification.insertMany(requests.map(r => ({ recipient: r.student, type: "book_match", title: "A book you requested is now available", message: book.title + " has been listed on BookLoop.", link: "/books/" + book._id })));
}

const uploadedImages = (files = {}) => (files.images || []).map((file) => ({
    url: file.path,
    filename: file.filename
}));

module.exports.latestBooks = async (req, res) => {
    const latestBooks = await Book.find({}).sort({ createdAt: -1 }).limit(6);

    res.render("home", {
        latestBooks,
        title: "BookLoop",
    });
};

module.exports.index = async (req, res) => {
    let {
        q = "",
        category = "",
        condition = "",
        minPrice = "",
        maxPrice = "",
        sort = "",
        page = 1
    } = req.query;

    page = Number.parseInt(page, 10);
    if (!Number.isFinite(page) || page < 1) page = 1;

    const limit = 8;
    const skip = (page - 1) * limit;
    const filter = {};

    if (q) {
        filter.$or = [
            { title: { $regex: q, $options: "i" } },
            { author: { $regex: q, $options: "i" } }
        ];
    }

    if (category && category !== "All") filter.category = category;
    if (condition) filter.condition = condition;

    if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) filter.price.$gte = Number(minPrice);
        if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    let sortOption;
    switch (sort) {
        case "priceLow":
            sortOption = { price: 1 };
            break;
        case "priceHigh":
            sortOption = { price: -1 };
            break;
        case "az":
            sortOption = { title: 1 };
            break;
        default:
            sortOption = { createdAt: -1 };
    }

    const [totalBooks, books] = await Promise.all([
        Book.countDocuments(filter),
        Book.find(filter)
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .populate("owner")
    ]);

    res.render("books/index", {
        books,
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(totalBooks / limit)),
        totalBooks,
        q,
        category,
        condition,
        minPrice,
        maxPrice,
        sort,
        title: "Browse Books"
    });
};

module.exports.showBook = async (req, res) => {
    const { id } = req.params;
    const book = await Book.findById(id).populate("owner").populate("academicBook");

    if (!book) {
        req.flash("error", "Book not found");
        return res.redirect("/books");
    }

    const relatedBooks = await Book.find({
        category: book.category,
        _id: { $ne: book._id }
    }).limit(4);

    let reservation = null;
    if (req.user && book.owner && !book.owner._id.equals(req.user._id)) {
        reservation = await Reservation.findOne({
            book: book._id,
            buyer: req.user._id
        });
    }

    res.render("books/show", {
        book,
        relatedBooks,
        reservation,
        title: book.title
    });
};

module.exports.renderEditForm = async (req, res) => {
    const { id } = req.params;
    const book = await Book.findById(id);
    if (!book) {
        req.flash("error", "Book not found.");
        return res.redirect("/books");
    }
    const academicBooks = await AcademicBook.find({ active: true }).sort({ college: 1, course: 1, academicYear: 1, semester: 1, subject: 1, title: 1 });
    res.render("books/edit", { book, academicBooks, title: "Edit page" });
};

module.exports.updateBook = async (req, res) => {
    const { id } = req.params;
    const book = await Book.findById(id);

    if (!book) {
        req.flash("error", "Book not found.");
        return res.redirect("/books");
    }

    Object.assign(book, req.body);
    book.academicBook = req.body.academicBook || null;
    book.sellerType = req.user.accountType === "shop" ? "shop" : "student";
    book.stock = book.sellerType === "shop" ? Math.max(0, Number.parseInt(req.body.stock, 10) || 0) : (book.status === "Sold" ? 0 : 1);
    const latitude = Number(req.body.latitude);
    const longitude = Number(req.body.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
        book.location = { type: "Point", coordinates: [longitude, latitude] };
    } else if (req.user.accountType === "shop" && req.user.shopLocation && req.user.shopLocation.coordinates.length === 2) {
        book.location = req.user.shopLocation;
    }

    const newImages = uploadedImages(req.files);
    const legacyImage = req.files?.image?.[0];

    if (newImages.length) {
        // When adding a gallery to an older listing, preserve its current cover.
        if (!book.images || !book.images.length) {
            const currentUrl = book.image?.url;
            if (currentUrl && currentUrl !== "/book.jpg") {
                book.images = [{ url: currentUrl, filename: book.image.filename }];
            }
        }
        book.images.push(...newImages);
    }

    if (legacyImage) {
        book.image = { url: legacyImage.path, filename: legacyImage.filename };
        if (!book.images.length) book.images = [{ url: legacyImage.path, filename: legacyImage.filename }];
    }

    await book.save();
    await notifyAcademicMatches(book, req.user._id);
    req.flash("success", "Book updated successfully.");
    res.redirect(`/books/${id}`);
};

module.exports.renderNewForm = async (req, res) => {
    const academicBooks = await AcademicBook.find({ active: true }).sort({ college: 1, course: 1, academicYear: 1, semester: 1, subject: 1, title: 1 });
    res.render("books/new", { title: "Add a Book", academicBooks });
};

module.exports.deleteBook = async (req, res) => {
    const { id } = req.params;
    await Book.findByIdAndDelete(id);
    await Reservation.deleteMany({ book: id });
    req.flash("success", "Book deleted successfully.");
    res.redirect("/books");
};

module.exports.createBook = async (req, res) => {
    const book = new Book(req.body);
    book.owner = req.user._id;
    book.sellerType = req.user.accountType === "shop" ? "shop" : "student";
    book.stock = book.sellerType === "shop" ? Math.max(1, Number.parseInt(req.body.stock, 10) || 1) : 1;
    const latitude = Number(req.body.latitude), longitude = Number(req.body.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
        book.location = { type: "Point", coordinates: [longitude, latitude] };
    } else if (req.user.accountType === "shop" && req.user.shopLocation?.coordinates?.length === 2) {
        book.location = req.user.shopLocation;
    }
    await attachAcademicBook(book, req);

    const newImages = uploadedImages(req.files);
    const legacyImage = req.files?.image?.[0];

    if (newImages.length) {
        book.images = newImages;
        book.image = newImages[0];
    } else if (legacyImage) {
        book.image = { url: legacyImage.path, filename: legacyImage.filename };
        book.images = [{ url: legacyImage.path, filename: legacyImage.filename }];
    }

    await book.save();
    await notifyAcademicMatches(book, req.user._id);
    req.flash("success", "Book Added Successfully");
    res.redirect("/books");
};
