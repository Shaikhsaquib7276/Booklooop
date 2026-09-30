const path = require("path");
const Book = require("../models/Book");
const Reservation = require("../models/Reservation");

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
    const book = await Book.findById(id).populate("owner");

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
    res.render("books/edit", { book, title: "Edit page" });
};

module.exports.updateBook = async (req, res) => {
    const { id } = req.params;
    const book = await Book.findById(id);

    if (!book) {
        req.flash("error", "Book not found.");
        return res.redirect("/books");
    }

    Object.assign(book, req.body);

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
    req.flash("success", "Book updated successfully.");
    res.redirect(`/books/${id}`);
};

module.exports.renderNewForm = (req, res) => {
    res.render("books/new", { title: "Render new form" });
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
    req.flash("success", "Book Added Successfully");
    res.redirect("/books");
};
