const path = require("path");
const Book = require("../models/Book");
const Reservation = require("../models/Reservation");



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

    if (!Number.isFinite(page) || page < 1) {
        page = 1;
    }

const limit = 8;
const skip = (page - 1) * limit;

    let filter = {};

    // Search
    if (q) {
        filter.$or = [
            { title: { $regex: q, $options: "i" } },
            { author: { $regex: q, $options: "i" } }
        ];
    }

    // Category
    if (category && category !== "All") {
        filter.category = category;
    }

    // Condition
    if (condition) {
        filter.condition = condition;
    }

    // Price
    if (minPrice || maxPrice) {

        filter.price = {};

        if (minPrice) {
            filter.price.$gte = Number(minPrice);
        }

        if (maxPrice) {
            filter.price.$lte = Number(maxPrice);
        }
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

module.exports.showBook = async (req,res)=>{

    const {id}=req.params;

    const book=await Book.findById(id)

    .populate("owner");

    if(!book){

        req.flash("error","Book not found");

        return res.redirect("/books");

    }

    const relatedBooks=await Book.find({

        category:book.category,

        _id:{$ne:book._id}

    }).limit(4);

    let reservation = null;

    if (req.user && book.owner && !book.owner._id.equals(req.user._id)) {
        reservation = await Reservation.findOne({
            book: book._id,
            buyer: req.user._id
        });
    }

    res.render("books/show",{

        book,

        relatedBooks,

        reservation,

        title:book.title

    });

}

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

    if (req.file) {
        book.image = {
            url: req.file.path,
            filename: req.file.filename
        };
    }

    await book.save();   // <-- This line is required

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

    // if (req.file) {
    //     book.image = buildImageData(req.file);
    // }
    if (req.file) {
    book.image = {
        url: req.file.path,
        filename: req.file.filename
    };
}

    await book.save();

    req.flash("success", "Book Added Successfully");

    res.redirect("/books");
//     res.json({
//     success: true,
//     redirect: `/books/${book._id}`
// });
};



