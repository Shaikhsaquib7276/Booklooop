const AcademicBook = require("../models/AcademicBook");

const clean = value => String(value ?? "").trim();
const normalize = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function getAcademicSubmission(req) {
    const user = req.user || {};
    const accountType = user.accountType === "shop" ? "shop" : "student";

    let subject = clean(req.body.academicSubject);
    let subjectCode = clean(req.body.academicSubjectCode);

    // Students must choose a subject/code pair saved in their own academic profile.
    // Shops can continue to provide the academic fields manually.
    if (accountType === "student" && (subject || subjectCode)) {
        const normalizeProfileValue = value => clean(value).toLowerCase().replace(/\\s+/g, " ");
        const match = Array.isArray(user.academicSubjects)
            ? user.academicSubjects.find(item =>
                normalizeProfileValue(item.subject) === normalizeProfileValue(subject) &&
                normalizeProfileValue(item.subjectCode) === normalizeProfileValue(subjectCode)
            )
            : null;

        if (!match) {
            subject = "";
            subjectCode = "";
        } else {
            subject = clean(match.subject);
            subjectCode = clean(match.subjectCode);
        }
    }

    return {
        college: clean(req.body.academicCollege || user.college),
        degree: clean(req.body.academicDegree || user.degree),
        course: clean(req.body.academicCourse || user.course),
        academicYear: clean(req.body.academicYear || user.academicYear),
        year: Number(req.body.academicYearNumber || user.year),
        semester: Number(req.body.academicSemester || user.semester),
        subject,
        subjectCode,
        title: clean(req.body.title),
        author: clean(req.body.author),
        isbn: clean(req.body.isbn),
        edition: clean(req.body.edition),
        type: req.body.academicType === "Reference" ? "Reference" : "Prescribed",
        accountType
    };
}

function isCompleteAcademicSubmission(data) {
    return Boolean(
        data.college &&
        data.degree &&
        data.course &&
        data.academicYear &&
        Number.isInteger(data.year) && data.year > 0 &&
        Number.isInteger(data.semester) && data.semester > 0 &&
        data.subject &&
        data.subjectCode &&
        data.title
    );
}

async function findExistingAcademicBook(data) {
    const candidates = await AcademicBook.find({
        college: data.college,
        degree: data.degree,
        course: data.course,
        academicYear: data.academicYear,
        year: data.year,
        semester: data.semester,
        active: true,
        verificationStatus: { $in: ["verified", "pending"] }
    }).lean();

    const wantedTitle = normalize(data.title);
    const wantedIsbn = normalize(data.isbn);
    const wantedAuthor = normalize(data.author);
    const wantedSubject = normalize(data.subject);
    const wantedSubjectCode = normalize(data.subjectCode);

    return candidates.find(candidate => {
        if (wantedIsbn && normalize(candidate.isbn) && wantedIsbn === normalize(candidate.isbn)) {
            return true;
        }

        const titleMatches = normalize(candidate.title) === wantedTitle;
        const authorMatches = !wantedAuthor || !normalize(candidate.author) || normalize(candidate.author) === wantedAuthor;
        const subjectMatches = !wantedSubject || !normalize(candidate.subject) || normalize(candidate.subject) === wantedSubject;
        const subjectCodeMatches = !wantedSubjectCode || !normalize(candidate.subjectCode) || normalize(candidate.subjectCode) === wantedSubjectCode;

        return titleMatches && authorMatches && subjectMatches && subjectCodeMatches;
    }) || null;
}

async function attachAcademicBook(book, req) {
    const data = getAcademicSubmission(req);
    const wantsAcademicMapping = req.body.academicListing === "yes" || Boolean(book.academicBook);

    // Generic/non-academic listings remain supported. Keep an existing academic
    // link when editing a mapped book; otherwise leave it unmapped.
    if (!wantsAcademicMapping || !isCompleteAcademicSubmission(data)) {
        return null;
    }

    const existing = await findExistingAcademicBook(data);

    if (existing) {
        book.academicBook = existing._id;
        return existing;
    }

    const academicBook = await AcademicBook.create({
        college: data.college,
        degree: data.degree,
        course: data.course,
        academicYear: data.academicYear,
        year: data.year,
        semester: data.semester,
        subject: data.subject,
        subjectCode: data.subjectCode,
        title: data.title,
        author: data.author,
        isbn: data.isbn,
        edition: data.edition,
        type: data.type,
        active: true,
        verificationStatus: "pending",
        submittedBy: req.user?._id || null,
        sourceBook: book._id
    });

    book.academicBook = academicBook._id;
    return academicBook;
}

module.exports = {
    clean,
    getAcademicSubmission,
    isCompleteAcademicSubmission,
    attachAcademicBook
};
