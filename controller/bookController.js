const path = require("path");
const Book = require("../models/Book");
const Reservation = require("../models/Reservation");
const AcademicBook = require("../models/AcademicBook");
const BookRequest = require("../models/BookRequest");
const { attachAcademicBook } = require("../utils/academicMatcher");
const { notifyUsers } = require("../utils/notificationService");

const escapeRegex = (value = "") => String(value).split("").map(ch => "\\.^$*+?()[]{}|".includes(ch) ? "\\" + ch : ch).join("");

const levenshtein = (a, b) => {
    const left = String(a || "").toLowerCase();
    const right = String(b || "").toLowerCase();
    if (!left) return right.length;
    if (!right) return left.length;
    let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
    for (let i = 0; i < left.length; i += 1) {
        const current = [i + 1];
        for (let j = 0; j < right.length; j += 1) {
            const insert = current[j] + 1;
            const remove = previous[j + 1] + 1;
            const replace = previous[j] + (left[i] === right[j] ? 0 : 1);
            current.push(Math.min(insert, remove, replace));
        }
        previous = current;
    }
    return previous[right.length];
};

const fuzzySimilarity = (query, value) => {
    const queryTokens = String(query || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const valueTokens = String(value || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (!queryTokens.length || !valueTokens.length) return 0;
    let best = 0;
    queryTokens.forEach(queryToken => {
        valueTokens.forEach(valueToken => {
            const distance = levenshtein(queryToken, valueToken);
            const score = 1 - distance / Math.max(queryToken.length, valueToken.length);
            if (score > best) best = score;
        });
    });
    return best;
};

module.exports.searchSuggestions = async (req, res) => {
    const query = String(req.query.q || "").trim().slice(0, 80);
    if (query.length < 2) return res.json({ suggestions: [] });

    const safeQuery = escapeRegex(query);
    const startsWith = new RegExp("^" + safeQuery, "i");
    const contains = new RegExp(safeQuery, "i");
    const normalizedQuery = query.toLowerCase();

    const books = await Book.find({
        $or: [{ title: contains }, { author: contains }, { category: contains }]
    }).select("title author category").limit(60).lean();

    const seen = new Set();
    const suggestions = [];
    const addSuggestion = (value, type) => {
        const text = String(value || "").trim();
        const key = text.toLowerCase();
        if (!text || seen.has(key) || suggestions.length >= 8) return;
        seen.add(key);
        suggestions.push({ text, type });
    };
    const score = book => [
        [book.title, 30], [book.author, 20], [book.category, 10]
    ].reduce((total, [value, weight]) => {
        const field = String(value || "").toLowerCase();
        if (field.startsWith(normalizedQuery)) return total + weight + 10;
        if (field.includes(normalizedQuery)) return total + weight;
        return total;
    }, 0);

    books.sort((a, b) => score(b) - score(a)).forEach(book => {
        if (startsWith.test(book.title || "")) addSuggestion(book.title, "Book");
        if (startsWith.test(book.author || "")) addSuggestion(book.author, "Author");
        if (startsWith.test(book.category || "")) addSuggestion(book.category, "Category");
    });

    if (suggestions.length < 8) {
        books.forEach(book => {
            if (suggestions.length < 8) addSuggestion(book.title, "Book");
        });
    }

    if (suggestions.length === 0) {
        const firstCharacter = new RegExp(escapeRegex(query.charAt(0)), "i");
        const fuzzyBooks = await Book.find({
            $or: [{ title: firstCharacter }, { author: firstCharacter }, { category: firstCharacter }]
        }).select("title author category").limit(200).lean();
        fuzzyBooks.map(book => ({
            book,
            score: Math.max(fuzzySimilarity(query, book.title), fuzzySimilarity(query, book.author), fuzzySimilarity(query, book.category))
        })).filter(item => item.score >= 0.55).sort((a, b) => b.score - a.score).forEach(item => {
            if (suggestions.length < 8) addSuggestion(item.book.title, "Book");
        });
    }
    res.json({ suggestions });
};

const escapeRegex = (value = "") => String(value).split("").map(ch => "\\.^$*+?()[]{}|".includes(ch) ? "\\" + ch : ch).join("");

const levenshtein = (a, b) => {
    const left = String(a || "").toLowerCase();
    const right = String(b || "").toLowerCase();
    if (!left) return right.length;
    if (!right) return left.length;
    let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
    for (let i = 0; i < left.length; i += 1) {
        const current = [i + 1];
        for (let j = 0; j < right.length; j += 1) {
            const insert = current[j] + 1;
            const remove = previous[j + 1] + 1;
            const replace = previous[j] + (left[i] === right[j] ? 0 : 1);
            current.push(Math.min(insert, remove, replace));
        }
        previous = current;
    }
    return previous[right.length];
};

const fuzzySimilarity = (query, value) => {
    const queryTokens = String(query || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const valueTokens = String(value || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    if (!queryTokens.length || !valueTokens.length) return 0;
    let best = 0;
    queryTokens.forEach(queryToken => {
        valueTokens.forEach(valueToken => {
            const distance = levenshtein(queryToken, valueToken);
            const score = 1 - distance / Math.max(queryToken.length, valueToken.length);
            if (score > best) best = score;
        });
    });
    return best;
};

module.exports.searchSuggestions = async (req, res) => {
    const query = String(req.query.q || "").trim().slice(0, 80);
    if (query.length < 2) return res.json({ suggestions: [] });

    const safeQuery = escapeRegex(query);
    const startsWith = new RegExp("^" + safeQuery, "i");
    const contains = new RegExp(safeQuery, "i");
    const normalizedQuery = query.toLowerCase();

    const books = await Book.find({
        $or: [{ title: contains }, { author: contains }, { category: contains }]
    }).select("title author category").limit(60).lean();

    const seen = new Set();
    const suggestions = [];
    const addSuggestion = (value, type) => {
        const text = String(value || "").trim();
        const key = text.toLowerCase();
        if (!text || seen.has(key) || suggestions.length >= 8) return;
        seen.add(key);
        suggestions.push({ text, type });
    };
    const score = book => [
        [book.title, 30], [book.author, 20], [book.category, 10]
    ].reduce((total, [value, weight]) => {
        const field = String(value || "").toLowerCase();
        if (field.startsWith(normalizedQuery)) return total + weight + 10;
        if (field.includes(normalizedQuery)) return total + weight;
        return total;
    }, 0);

    books.sort((a, b) => score(b) - score(a)).forEach(book => {
        if (startsWith.test(book.title || "")) addSuggestion(book.title, "Book");
        if (startsWith.test(book.author || "")) addSuggestion(book.author, "Author");
        if (startsWith.test(book.category || "")) addSuggestion(book.category, "Category");
    });

    if (suggestions.length < 8) {
        books.forEach(book => {
            if (suggestions.length < 8) addSuggestion(book.title, "Book");
        });
    }

    if (suggestions.length === 0) {
        const firstCharacter = new RegExp(escapeRegex(query.charAt(0)), "i");
        const fuzzyBooks = await Book.find({
            $or: [{ title: firstCharacter }, { author: firstCharacter }, { category: firstCharacter }]
        }).select("title author category").limit(200).lean();
        fuzzyBooks.map(book => ({
            book,
            score: Math.max(fuzzySimilarity(query, book.title), fuzzySimilarity(query, book.author), fuzzySimilarity(query, book.category))
        })).filter(item => item.score >= 0.55).sort((a, b) => b.score - a.score).forEach(item => {
            if (suggestions.length < 8) addSuggestion(item.book.title, "Book");
        });
    }
    res.json({ suggestions });
};

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
    await notifyUsers({
        type: "book_match",
        title: "A book you requested is now available",
        message: book.title + " has been listed on BookLoop.",
        link: "/books/" + book._id
    }, requests.map(r => r.student));
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

    q = String(q || "").trim().slice(0, 80);

    if (q) {
        // Keep MongoDB text search separate from regex clauses.
        // Mixing $text and unindexed regex branches inside $or causes
        // MongoDB's "Failed to produce a solution for TEXT under OR" error.
        filter.$text = { $search: q };
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
            sortOption = q
                ? { score: { $meta: "textScore" }, createdAt: -1 }
                : { createdAt: -1 };
    }

    let totalBooks = await Book.countDocuments(filter);
    let books;

    if (q && totalBooks === 0) {
        const fuzzyFilter = { ...filter };
        delete fuzzyFilter.$text;

        const firstCharacter = new RegExp(escapeRegex(q.charAt(0)), "i");
        const candidates = await Book.find({
            ...fuzzyFilter,
            $or: [{ title: firstCharacter }, { author: firstCharacter }, { category: firstCharacter }]
        }).limit(250).populate("owner").lean();

        const ranked = candidates.map(book => ({
            book,
            score: Math.max(fuzzySimilarity(q, book.title), fuzzySimilarity(q, book.author), fuzzySimilarity(q, book.category))
        })).filter(item => item.score >= 0.55).sort((a, b) => b.score - a.score);

        totalBooks = ranked.length;
        books = ranked.slice(skip, skip + limit).map(item => item.book);
    } else {
        books = await Book.find(filter).sort(sortOption).skip(skip).limit(limit).populate("owner");
    }

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
    const book = await Book.findById(id).populate("academicBook");
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
    await attachAcademicBook(book, req);
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
    const book = await Book.findById(id);
    if (!book) {
        req.flash("error", "Book not found.");
        return res.redirect("/books");
    }

    const matchedRequests = await BookRequest.find({
        matchedBook: book._id,
        status: "Matched"
    }).select("_id student academicBook").lean();

    await BookRequest.updateMany(
        { matchedBook: book._id, status: "Matched" },
        { $set: { status: "Open", matchedBook: null, matchedAt: null } }
    );

    await Book.findByIdAndDelete(book._id);
    await Reservation.deleteMany({ book: book._id });

    await notifyUsers({
        type: "listing_update",
        title: "A book listing was removed",
        message: book.title + " was removed before your request could be fulfilled. Your request is open again.",
        link: "/book-requests"
    }, matchedRequests.map(request => request.student));

    req.flash("success", matchedRequests.length
        ? "Book deleted and affected requests were reopened."
        : "Book deleted successfully.");
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
