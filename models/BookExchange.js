const mongoose = require("mongoose");

const bookExchangeSchema = new mongoose.Schema({
  offeredBook: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true, index: true },
  requestedBook: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true, index: true },
  proposer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  status: { type: String, enum: ["Pending", "Accepted", "Rejected", "Cancelled", "Completed"], default: "Pending", index: true },
  proposerConfirmed: { type: Boolean, default: false },
  recipientConfirmed: { type: Boolean, default: false },
  completedAt: { type: Date, default: null }
}, { timestamps: true });

bookExchangeSchema.index({ offeredBook:  1, requestedBook: 1, proposer: 1, status: 1 });
module.exports = mongoose.model("BookExchange", bookExchangeSchema);
