const { bookSchema } = require("../schemas");

module.exports = (req,res,next)=>{

    const { error } = bookSchema.validate(req.body);
    if(error){
        req.flash("error",error.details[0].message);
        return res.redirect("/books/new");
    }
    next();
}