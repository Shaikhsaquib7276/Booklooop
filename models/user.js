const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose").default;
const Book = require("./Book")
const userSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
        },

        phone: {
            type: String,
        },

        city: {
            type: String,
        },

        college: {
            type: String,
        },

        profileImage: {
            url: {
                type: String,
                default: "https://thf.bing.com/th/id/R.5d632160074b718629cb6e34208d9f83?rik=JAyF9a2mW858Pg&riu=http%3a%2f%2fclipartmag.com%2fimages%2fbook-clipart-free-4.png&ehk=RJ0Eyhebu%2fysWZs3HDAUOJdpp3nszLXQfprllSgL25w%3d&risl=&pid=ImgRaw&r=0"
            },
            filename: String
        },
        wishlist: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Book"
            }
        ],
    },
    {
        timestamps: true,
    }
);

// Adds username, hash, salt, register(), authenticate(), etc.
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);