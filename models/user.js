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
            trim: true
        },

        // Academic profile used by Smart Semester Finder.
        degree: { type: String, trim: true },
        course: { type: String, trim: true },
        academicYear: { type: String, trim: true },
        year: { type: Number, min: 1, max: 10 },
        semester: { type: Number, min: 1, max: 20 },

        // Current subjects selected by the student for the Smart Semester Finder.
        // Each entry keeps the subject/code pair together.
        academicSubjects: [{
            subject: { type: String, trim: true, required: true, maxlength: 150 },
            subjectCode: { type: String, trim: true, required: true, maxlength: 50 }
        }],

        profileImage: {
            url: {
                type: String,
                default: "https://thf.bing.com/th/id/R.5d632160074b718629cb6e34208d9f83?rik=JAyF9a2mW858Pg&riu=http%3a%2f%2fclipartmag.com%2fimages%2fbook-clipart-free-4.png&ehk=RJ0Eyhebu%2fysWZs3HDAUOJdpp3nszLXQfprllSgL25w%3d&risl=&pid=ImgRaw&r=0"
            },
            filename: String
        },
        accountType: { type: String, enum: ["student", "shop"], default: "student" },
        shopName: { type: String, trim: true, maxlength: 120 },
        shopAddress: { type: String, trim: true, maxlength: 300 },
        shopLocation: {
            type: { type: String, enum: ["Point"], default: "Point" },
            coordinates: { type: [Number], default: undefined }
        },
        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user"
        },

        isActive: {
            type: Boolean,
            default: true
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