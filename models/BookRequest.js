const mongoose = require("mongoose");

const bookRequestSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  academicBook: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicBook", required: true, index: true },
  college: { type: String, required: true, trim: true },
  degree: { type: String, required: true, trim: true },
  course: { type: String, required: true, trim: true },
  academicYear: { type: String, required: true, trim: true },
  year: { type: Number, required: true, min: 1, max: 10 },
  semester: { type: Number, required: true, min: 1, max: 20 },
  status: { type: String, enum: ["Open", "Matched", "Fulfilled", "Cancelled"], default: "Open", index: true },
  matchedBook: { type: mongoose.Schema.Types.ObjectId, ref: "Book", default: null },
  matchedAt: { type: Date, default: null }
}, { timestamps: true });

bookRequestSchema.index({ student: 1, academicBook: 1, status: 1 });

module.exports = mongoose.model("BookRequest", bookRequestSchema);
