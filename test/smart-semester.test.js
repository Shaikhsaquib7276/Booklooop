const test = require("node:test");
const assert = require("node:assert/strict");
const { userSchema } = require("../schemas");
const { isCompleteAcademicSubmission } = require("../utils/academicMatcher");

test("student signup requires a complete academic profile", () => {
    const result = userSchema.validate({
        username: "student01",
        email: "student@example.com",
        password: "secret123",
        phone: "+911234567890",
        city: "Boisar",
        college: "ABC College",
        accountType: "student",
        degree: "BSc",
        course: "Computer Science",
        academicYear: "2026-27",
        year: 3,
        semester: 5
    });

    assert.equal(result.error, undefined);
});

test("student signup rejects missing semester details", () => {
    const result = userSchema.validate({
        username: "student01",
        email: "student@example.com",
        password: "secret123",
        college: "ABC College",
        accountType: "student",
        degree: "BSc",
        course: "Computer Science"
    });

    assert.ok(result.error);
});

test("academic matcher recognizes a complete seller mapping", () => {
    assert.equal(isCompleteAcademicSubmission({
        college: "ABC College",
        degree: "BSc",
        course: "Computer Science",
        academicYear: "2026-27",
        year: 3,
        semester: 5,
        subject: "Database Management Systems",
        title: "Database System Concepts"
    }), true);
});

test("academic matcher rejects an incomplete seller mapping", () => {
    assert.equal(isCompleteAcademicSubmission({
        college: "ABC College",
        degree: "BSc",
        course: "Computer Science",
        academicYear: "2026-27",
        year: 3,
        semester: 5,
        subject: "",
        title: "Database System Concepts"
    }), false);
});
