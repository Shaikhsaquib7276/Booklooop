const mongoose = require("mongoose");

const academicBookSchema = new mongoose.Schema({
  college: { type: String, required: true, trim: true, index: true },
  degree: { type: String, required: true, trim: true, index: true },
  course: { type: String, required: true, trim: true, index: true },
  academicYear: { type: String, required: true, trim: true, index: true },
  year: { type: Number, required: true, min: 1, max: 10, index: true },
  semester: { type: Number, required: true, min: 1, max: 20, index: true },
  subject: { type: String, required: true, trim: true },
  subjectCode: { type: String, trim: true, default: "" },
  title: { type: String, required: true, trim: true },
  author: { type: String, trim: true, default: "" },
  isbn: { type: String, trim: true, default: "", index: true },
  edition: { type: String, trim: true, default: "" },
  type: { type: String, enum: ["Prescribed", "Reference"], default: "Prescribed" },

  // Academic books created from seller listings wait for admin verification.
  verificationStatus: {
    type: String,
    enum: ["pending", "verified", "rejected"],
    default: "verified",
    index: true
  },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  verifiedAt: { type: Date, default: null },
  sourceBook: { type: mongoose.Schema.Types.ObjectId, ref: "Book", default: null },

  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

academicBookSchema.index({
  college: 1,
  degree: 1,
  course: 1,
  academicYear: 1,
  year: 1,
  semester: 1,
  subject: 1
});

module.exports = mongoose.model("AcademicBook", academicBookSchema);
