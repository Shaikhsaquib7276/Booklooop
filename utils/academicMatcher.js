const AcademicBook = require("../models/AcademicBook");

const clean = value => String(value ?? "").trim();

function normalizeText(value) {
    return clean(value)
        .normalize("NFKC")
        .toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeCode(value) {
    return clean(value)
        .normalize("NFKC")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
}

function levenshtein(a, b) {
    a = String(a ?? "");
    b = String(b ?? "");

    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    if (a.length > b.length) [a, b] = [b, a];

    let previous = Array.from({ length: a.length + 1 }, (_, i) => i);

    for (let j = 1; j <= b.length; j += 1) {
        const current = [j];

        for (let i = 1; i <= a.length; i += 1) {
            const insert = current[i - 1] + 1;
            const remove = previous[i] + 1;
            const replace = previous[i - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
            current[i] = Math.min(insert, remove, replace);
        }

        previous = current;
    }

    return previous[a.length];
}

function similarity(a, b) {
    const left = String(a ?? "");
    const right = String(b ?? "");

    if (left === right) return 1;
    if (!left.length || !right.length) return 0;

    return 1 - levenshtein(left, right) / Math.max(left.length, right.length);
}

function tokenSimilarity(a, b) {
    const left = new Set(normalizeText(a).split(" ").filter(Boolean));
    const right = new Set(normalizeText(b).split(" ").filter(Boolean));

    if (!left.size || !right.size) return 0;

    let intersection = 0;
    left.forEach(token => {
        if (right.has(token)) intersection += 1;
    });

    return intersection / Math.max(left.size, right.size);
}

function subjectSimilarity(a, b) {
    const left = normalizeText(a);
    const right = normalizeText(b);

    if (!left || !right) return 0;
    if (left === right) return 1;

    const compactLeft = left.replace(/\s+/g, "");
    const compactRight = right.replace(/\s+/g, "");

    if (compactLeft === compactRight) return 0.99;

    const charScore = similarity(left, right);
    const compactScore = similarity(compactLeft, compactRight);
    const tokenScore = tokenSimilarity(left, right);

    return Math.min(1, Math.max(
        0,
        charScore * 0.45 + compactScore * 0.25 + tokenScore * 0.30
    ));
}

function subjectCodeSimilarity(a, b) {
    const left = normalizeCode(a);
    const right = normalizeCode(b);

    if (!left || !right) return 0;
    if (left === right) return 1;

    return similarity(left, right);
}

function matchAcademicSubjectPair(input, candidate) {
    const subjectScore = subjectSimilarity(input?.subject, candidate?.subject);
    const codeScore = subjectCodeSimilarity(input?.subjectCode, candidate?.subjectCode);
    const exactCode = Boolean(
        normalizeCode(input?.subjectCode) &&
        normalizeCode(input?.subjectCode) === normalizeCode(candidate?.subjectCode)
    );

    let score = subjectScore * 0.65 + codeScore * 0.35;

    if (exactCode) {
        score = Math.max(score, subjectScore * 0.65 + 0.35);
    }

    const strongSubject = subjectScore >= 0.88;
    const acceptableCode = exactCode || codeScore >= 0.70;

    return {
        score,
        subjectScore,
        codeScore,
        exactCode,
        strongSubject,
        acceptableCode,
        matched: strongSubject && acceptableCode && score >= 0.86
    };
}

function findBestAcademicSubjectMatch(input, candidates = []) {
    const ranked = candidates
        .map(candidate => ({
            candidate,
            ...matchAcademicSubjectPair(input, candidate)
        }))
        .filter(item => item.matched)
        .sort((a, b) => b.score - a.score);

    if (!ranked.length) return null;

    const best = ranked[0];
    const second = ranked[1];

    if (second && !best.exactCode && best.score - second.score < 0.05) {
        return null;
    }

    return {
        ...best.candidate,
        matchScore: best.score,
        subjectScore: best.subjectScore,
        codeScore: best.codeScore,
        exactCode: best.exactCode
    };
}

function escapeRegex(value) {
    return String(value ?? "").replace(/[.*+?^$()|[\\]\\]/g, "\\$&");
}

function academicRegex(value) {
    const parts = clean(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter(Boolean);

    if (!parts.length) return null;

    return new RegExp(
        parts.map(part => escapeRegex(part)).join("[^a-z0-9]+"),
        "i"
    );
}

function buildAcademicContextFilter(data, verifiedOnly = false) {
    const filter = {
        active: true,
        college: academicRegex(data.college),
        degree: academicRegex(data.degree),
        course: academicRegex(data.course),
        academicYear: academicRegex(data.academicYear),
        year: data.year,
        semester: data.semester
    };

    if (verifiedOnly) filter.verificationStatus = "verified";

    Object.keys(filter).forEach(key => {
        if (filter[key] === null || filter[key] === undefined || filter[key] === "") {
            delete filter[key];
        }
    });

    return filter;
}

function getAcademicSubmission(req) {
    const user = req.user || {};
    const accountType = user.accountType === "shop" ? "shop" : "student";

    let subject = clean(req.body.academicSubject);
    let subjectCode = clean(req.body.academicSubjectCode);

    if (accountType === "student" && (subject || subjectCode)) {
        const profileSubjects = Array.isArray(user.academicSubjects)
            ? user.academicSubjects
            : [];

        const match = findBestAcademicSubjectMatch(
            { subject, subjectCode },
            profileSubjects
        );

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
    const candidates = await AcademicBook.find(
        buildAcademicContextFilter(data, false)
    ).lean();

    const wantedIsbn = normalizeCode(data.isbn);
    const wantedAuthor = normalizeText(data.author);

    const ranked = candidates.map(candidate => {
        const candidateIsbn = normalizeCode(candidate.isbn);

        if (wantedIsbn && candidateIsbn && wantedIsbn === candidateIsbn) {
            return { candidate, score: 1, isbnMatch: true };
        }

        const titleScore = subjectSimilarity(data.title, candidate.title);
        const authorScore = wantedAuthor && normalizeText(candidate.author)
            ? subjectSimilarity(data.author, candidate.author)
            : 1;
        const academicMatch = matchAcademicSubjectPair(data, candidate);

        return {
            candidate,
            score: titleScore * 0.55 + authorScore * 0.20 + academicMatch.score * 0.25,
            isbnMatch: false
        };
    })
        .filter(item => item.isbnMatch || item.score >= 0.86)
        .sort((a, b) => b.score - a.score);

    return ranked[0]?.candidate || null;
}

async function attachAcademicBook(book, req) {
    const data = getAcademicSubmission(req);
    const wantsAcademicMapping = req.body.academicListing === "yes" || Boolean(book.academicBook);

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
    normalizeText,
    normalizeCode,
    subjectSimilarity,
    subjectCodeSimilarity,
    matchAcademicSubjectPair,
    findBestAcademicSubjectMatch,
    academicRegex,
    buildAcademicContextFilter,
    getAcademicSubmission,
    isCompleteAcademicSubmission,
    attachAcademicBook
};
