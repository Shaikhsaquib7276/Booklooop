const path = require("path");
const Book = require("../models/Book");



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

page = parseInt(page);

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
const totalBooks = await Book.countDocuments(filter);
let query = Book.find(filter);

const books = await query
    .skip(skip)
    .limit(limit)
    .populate("owner");
    switch (sort) {

        case "priceLow":
            query = query.sort({ price: 1 });
            break;

        case "priceHigh":
            query = query.sort({ price: -1 });
            break;

        case "az":
            query = query.sort({ title: 1 });
            break;

        default:
            query = query.sort({ createdAt: -1 });
    }


   res.render("books/index", {

    books,

    currentPage: page,

    totalPages: Math.ceil(totalBooks / limit),

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

    res.render("books/show",{

        book,

        relatedBooks,

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



