const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
    {
        book: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Book",
            required: true
        },
        buyer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        status: {
            type: String,
            enum: ["Pending", "Accepted", "Rejected", "Cancelled"],
            default: "Pending"
        }
    },
    {
        timestamps: true
    }
);

// A buyer can make only one reservation request for a particular book.
reservationSchema.index({ book: 1, buyer: 1 }, { unique: true });

module.exports = mongoose.model("Reservation", reservationSchema);
