const mongoose = require("mongoose");

const academicBookSchema = new mongoose.Schema({
  college: { type: String, required: true, trim: true, index: true },
  course: { type: String, required: true, trim: true, index: true },
  academicYear: { type: String, required: true, trim: true, index: true },
  semester: { type: Number, required: true, min: 1, max: 20, index: true },
  subject: { type: String, required: true, trim: true },
  subjectCode: { type: String, trim: true, default: "" },
  title: { type: String, required: true, trim: true },
  author: { type: String, trim: true, default: "" },
  isbn: { type: String, trim: true, default: "", index: true },
  edition: { type: String, trim: true, default: "" },
  type: { type: String, enum: ["Prescribed", "Reference"], default: "Prescribed" },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

academicBookSchema.index({
  college: 1, course: 1, academicYear: 1, semester: 1, subject: 1
});

module.exports = mongoose.model("AcademicBook", academicBookSchema);
