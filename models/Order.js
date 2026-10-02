const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  items: [{
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
    title: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, default: "INR", enum: ["INR"] },
  status: { type: String, enum: ["created", "paid", "failed"], default: "created", index: true },
  paymentProvider: { type: String, enum: ["razorpay", "cashfree"], default: "razorpay", index: true },
  razorpayOrderId: { type: String, unique: true, sparse: true, index: true },
  razorpayPaymentId: String,
  cashfreeOrderId: { type: String, unique: true, sparse: true, index: true },
  cashfreePaymentSessionId: String,
  cashfreePaymentId: String,
  paidAt: Date
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
