const User = require("../models/user");
const Book = require("../models/Book");

// ===============================
// Show Wishlist
// ===============================


module.exports.showWishlist = async (req, res) => {

    const user = await User.findById(req.user._id)
        .populate({
            path: "wishlist",
            populate: {
                path: "owner"
            }
        });

    res.render("wishlist/index", {
        books: user.wishlist,
        title: "My Wishlist"
    });

};

module.exports.toggleWishlist = async (req, res) => {

    const { id } = req.params;

    const user = await User.findById(req.user._id);

    const exists = user.wishlist.some(
        bookId => bookId.toString() === id
    );

    if (exists) {

        await User.findByIdAndUpdate(
            req.user._id,
            {
                $pull: {
                    wishlist: id
                }
            }
        );

    } else {

        await User.findByIdAndUpdate(
            req.user._id,
            {
                $addToSet: {
                    wishlist: id
                }
            }
        );

    }

    res.redirect("/books");

};
