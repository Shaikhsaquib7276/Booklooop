const Joi = require("joi");

module.exports.userSchema = Joi.object({

    username: Joi.string()
        .min(3)
        .max(20)
        .required(),

    email: Joi.string()
        .email()
        .required(),

    password: Joi.string()
        .min(6)
        .required(),

    phone: Joi.string()
        .allow("", null),

    city: Joi.string()
        .allow("", null),

    college: Joi.string()
        .allow("", null)

}).unknown(true)



module.exports.bookSchema = Joi.object({

    title: Joi.string().required(),
    author: Joi.string().required(),
    description: Joi.string().required(),
    price: Joi.number().min(0).required(),
    condition: Joi.string().required(),
    category: Joi.string().required()

}).unknown(true)