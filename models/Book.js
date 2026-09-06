const mongoose = require("mongoose");

const DEFAULT_BOOK_IMAGE = "/book.jpg";
const LEGACY_DEFAULT_BOOK_IMAGE = "https://thf.bing.com/th/id/R.5d632160074b718629cb6e34208d9f83?rik=JAyF9a2mW858Pg&riu=http%3a%2f%2fclipartmag.com%2fimages%2fbook-clipart-free-4.png&ehk=RJ0Eyhebu%2fysWZs3HDAUOJdpp3nszLXQfprllSgL25w%3d&risl=&pid=ImgRaw&r=0";

const bookSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        author: {
            type: String,
            required: true
        },

        description: {
            type: String,
            required: true
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        condition: {
            type: String,
            enum: ["New", "Like New", "Good", "Fair", "Poor"],
            required: true
        },

        category: {
            type: String,
            required: true
        },

        image: {
            url: {
                type: String,
                default: DEFAULT_BOOK_IMAGE,
                get: (value) => {
                    if (!value || value === LEGACY_DEFAULT_BOOK_IMAGE) {
                        return DEFAULT_BOOK_IMAGE;
                    }
                    return value;
                }
            },
            filename: String
        },

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        status: {
            type: String,
            enum: [
                "Available",
                "Reserved",
                "Sold"
            ],
            default: "Available"
        },
    },
    {
        timestamps: true,
        toJSON: { getters: true },
        toObject: { getters: true }
    });

module.exports = mongoose.model("Book", bookSchema);
