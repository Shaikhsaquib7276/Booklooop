const User = require("../models/user");

module.exports = async (req, res, next) => {

    res.locals.wishlist = [];
    res.locals.wishlistCount = 0;

    if (!req.user) {
        return next();
    }

    const user = await User.findById(req.user._id);

    if (user) {

        res.locals.wishlist =
            user.wishlist.map(id => id.toString());

        res.locals.wishlistCount =
            user.wishlist.length;
    }

    next();

};