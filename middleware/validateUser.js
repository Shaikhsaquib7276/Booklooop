const { userSchema } = require("../schemas");

module.exports = (req, res, next) => {
    const { error } = userSchema.validate(req.body);
    if (error) {
        req.flash("error", error.details[0].message);
        return res.redirect("/signup");
    }
    next();
};