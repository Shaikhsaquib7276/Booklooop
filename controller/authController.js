const User = require("../models/user");

function normalizePhone(value) {
    const phone = String(value || "").trim().replace(/[\s()-]/g, "");
    if (/^\d{10}$/.test(phone)) return "+91" + phone;
    return phone;
}

async function verifyFirebasePhoneToken(idToken, expectedPhone) {
    const apiKey = process.env.FIREBASE_API_KEY;
    if (!apiKey) throw new Error("FIREBASE_API_KEY is not configured.");

    const response = await fetch(
        "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey),
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken })
        }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const code = data.error?.message || "FIREBASE_TOKEN_INVALID";
        throw new Error(code);
    }

    const firebaseUser = data.users?.[0];
    if (!firebaseUser?.phoneNumber) throw new Error("PHONE_NUMBER_NOT_FOUND");

    const verifiedPhone = normalizePhone(firebaseUser.phoneNumber);
    const submittedPhone = normalizePhone(expectedPhone);

    if (!submittedPhone || verifiedPhone !== submittedPhone) {
        throw new Error("PHONE_NUMBER_MISMATCH");
    }

    if (firebaseUser.disabled) throw new Error("FIREBASE_USER_DISABLED");

    return verifiedPhone;
}

module.exports.renderSignup = (req, res) => {
    res.render("users/signup", {
        title: "Signup",
        firebaseConfig: {
            apiKey: process.env.FIREBASE_API_KEY || "",
            authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
            projectId: process.env.FIREBASE_PROJECT_ID || "",
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
            appId: process.env.FIREBASE_APP_ID || "",
            measurementId: process.env.FIREBASE_MEASUREMENT_ID || ""
        }
    });
};

module.exports.verifyPhone = async (req, res) => {
    try {
        const { idToken, phone } = req.body;

        if (!idToken || typeof idToken !== "string" || !phone) {
            return res.status(400).json({
                success: false,
                message: "Missing Firebase verification data."
            });
        }

        const verifiedPhone = await verifyFirebasePhoneToken(idToken, phone);

        req.session.phoneVerification = {
            verified: true,
            phone: verifiedPhone,
            verifiedAt: Date.now()
        };

        return res.json({ success: true, phone: verifiedPhone });
    } catch (err) {
        console.error("Phone verification error:", err.message);
        return res.status(400).json({
            success: false,
            message: err.message || "Phone verification failed."
        });
    }
};

module.exports.signup = async (req, res, next) => {
    try {
        const {
            username,
            email,
            city,
            college,
            password,
            accountType,
            shopName,
            shopAddress,
            shopLatitude,
            shopLongitude
        } = req.body;

        const verification = req.session.phoneVerification;
        if (!verification?.verified || !verification.phone) {
            req.flash("error", "Please verify your phone number with OTP before creating an account.");
            return res.redirect("/signup");
        }

        const user = new User({
            username,
            email,
            phone: verification.phone,
            city,
            college,
            accountType: accountType === "shop" ? "shop" : "student",
            degree: accountType === "shop" ? undefined : String(req.body.degree || "").trim(),
            course: accountType === "shop" ? undefined : String(req.body.course || "").trim(),
            academicYear: accountType === "shop" ? undefined : String(req.body.academicYear || "").trim(),
            year: accountType === "shop" ? undefined : Number(req.body.year),
            semester: accountType === "shop" ? undefined : Number(req.body.semester),
            shopName: accountType === "shop" ? String(shopName || "").trim() : undefined,
            shopAddress: accountType === "shop" ? String(shopAddress || "").trim() : undefined
        });

        if (accountType === "shop") {
            const lat = Number(shopLatitude), lng = Number(shopLongitude);
            if (!user.shopName || !user.shopAddress || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
                req.flash("error", "Bookshops must provide a name, address, and valid location coordinates.");
                return res.redirect("/signup");
            }
            user.shopLocation = { type: "Point", coordinates: [lng, lat] };
        }

        const registeredUser = await User.register(user, password);
        delete req.session.phoneVerification;

        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash("success", "Welcome to BookLoop!");
            return res.redirect("/");
        });
    }
    catch (err) {
        req.flash("error", err.message || "Signup failed");
        return res.redirect("/signup");
    }
};

module.exports.renderLogin = (req, res) => {
    res.render("users/login", { title: "Login" });
};

module.exports.login = (req, res) => {
    req.flash("success", "Welcome Back!");
    res.redirect("/");
};

module.exports.logout = (req, res, next) => {
    req.logout(function (err) {
        if (err) return next(err);
        req.flash("success", "Logged Out Successfully");
        res.redirect("/");
    });
};
