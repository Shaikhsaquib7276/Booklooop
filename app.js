require("dotenv").config({ path: ".env" });
const express = require("express");
const path = require("path");
const ejsMate = require("ejs-mate");
const connectDB = require("./config/db");

const ExpressError = require("./utils/ExpressError");
const app = express();
const multer = require("multer");
const upload = multer({
    dest: "uploads/"
});
// const multer = require("multer");
// const { storage } = require("./cloudConfig/cloudinary");
const methodOverride = require("method-override");
// app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
// Connect Database
connectDB();

// View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
const passport = require("./config/passpost");
const session = require("express-session");
const flash = require("connect-flash");
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.engine("ejs", ejsMate);

// Static Files
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const sessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true
    }
};

const authRoutes = require("./routes/auth");
const bookRoutes = require("./routes/books");
const dashboardRoute = require("./routes/dashboard");
const profileRoute=require("./routes/profile");
const wishlistRoute=require("./routes/wishlist");



const loadWishlist = require("./middleware/loadWishlist");

app.use(session(sessionOptions));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());
app.use(loadWishlist);


app.use((req, res, next) => {
    res.locals.success = req.flash("success") || [];
    res.locals.error = req.flash("error") || [];
    res.locals.currentUser = req.user || null;
    next();
});

// Routes 
app.use(authRoutes);
app.use(bookRoutes);
app.use("/", dashboardRoute);
app.use("/",profileRoute);
app.use("/",wishlistRoute);


// Home Route
app.get("/", (req, res) => {
    res.render("home", {
        title: "Home",
        currentUser: req.user || null
    });
});



// app.get("/books", (req, res) => {
//     res.render("books/index", {
//         title: "Browse Books",
//         currentUser: req.user || null
//     });
// });

app.use((req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
});

app.use((err, req, res, next) => {
    const statusCode = err.statusCode || err.status || 500;
    const message = err.message || "Something Went Wrong";

    res.status(statusCode);
    res.render("error", {
        title: "Error",
        message,
        statusCode
    });
});

// Start Server
const PORT = process.env.PORT || 3000;



app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});