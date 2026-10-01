import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const phoneInput = document.getElementById("phone");
const sendOtpButton = document.getElementById("sendOTP");
const verifyOtpButton = document.getElementById("verifyOTP");
const recaptchaContainer = document.getElementById("recaptcha-container");
const otpInput = document.getElementById("otp");
const otpStatus = document.getElementById("otpStatus");
const signupSection = document.getElementById("signupSection");
const createAccountButton = document.getElementById("createAccount");

if (
    phoneInput &&
    sendOtpButton &&
    verifyOtpButton &&
    recaptchaContainer &&
    otpInput &&
    otpStatus &&
    signupSection &&
    createAccountButton
) {
    const firebaseConfig = window.firebaseConfig || {};
    const requiredKeys = [
        "apiKey",
        "authDomain",
        "projectId",
        "storageBucket",
        "messagingSenderId",
        "appId"
    ];

    function showStatus(message, type = "info") {
        otpStatus.innerHTML = `<div class="alert alert-${type} mt-3">${message}</div>`;
    }

    if (requiredKeys.some(key => !firebaseConfig[key])) {
        otpStatus.innerHTML = `
            <div class="alert alert-danger mt-3">
                Firebase phone authentication is not configured. Check your .env Firebase settings.
            </div>
        `;
    } else {
        try {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);

            let recaptchaVerifier = null;
            let confirmationResult = null;
            let verifiedPhone = null;

            function normalizePhone(value) {
                const cleaned = String(value || "").trim().replace(/[\s()-]/g, "");
                if (/^\d{10}$/.test(cleaned)) return "+91" + cleaned;
                return cleaned;
            }

            async function createRecaptcha() {
                if (recaptchaVerifier) {
                    try {
                        recaptchaVerifier.clear();
                    } catch (_) {}
                }

                recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
                    size: "normal"
                });

                await recaptchaVerifier.render();
            }

            async function sendOTP() {
                const phone = normalizePhone(phoneInput.value);

                if (!/^\\+?[1-9]\d{7,14}$/.test(phone)) {
                    showStatus("Enter a valid phone number, for example +919876543210.", "danger");
                    return;
                }

                sendOtpButton.disabled = true;
                showStatus("Sending OTP…", "info");

                try {
                    if (!recaptchaVerifier) {
                        await createRecaptcha();
                    }

                    confirmationResult = await signInWithPhoneNumber(auth, phone, recaptchaVerifier);
                    window.confirmationResult = confirmationResult;
                    window.pendingPhone = phone;

                    otpInput.disabled = false;
                    verifyOtpButton.disabled = false;
                    phoneInput.value = phone;

                    showStatus("OTP sent successfully. Check your phone.", "success");
                    otpInput.focus();
                } catch (err) {
                    console.error("Firebase OTP error:", err.code, err.message);

                    if (
                        err.code === "auth/invalid-phone-number"
                    ) {
                        showStatus("Firebase rejected this phone number. Use international format such as +919876543210.", "danger");
                    } else if (
                        err.code === "auth/operation-not-allowed"
                    ) {
                        showStatus("Phone sign-in is disabled in your Firebase project. Enable Phone authentication in Firebase Console.", "danger");
                    } else if (
                        err.code === "auth/unauthorized-domain"
                    ) {
                        showStatus("This website domain is not authorized in Firebase. Add localhost to Firebase Authentication → Settings → Authorized domains.", "danger");
                    } else if (
                        err.code === "auth/too-many-requests"
                    ) {
                        showStatus("Too many OTP attempts. Wait and try again, or use a Firebase test phone number.", "danger");
                    } else {
                        showStatus(`${err.code || "OTP_ERROR"}: ${err.message || "Could not send OTP."}`, "danger");
                    }

                    await createRecaptcha().catch(() => {});
                    sendOtpButton.disabled = false;
                }
            }

            async function verifyOTP() {
                const otp = otpInput.value.trim();

                if (!confirmationResult) {
                    showStatus("Send the OTP first.", "warning");
                    return;
                }

                if (!/^\d{6}$/.test(otp)) {
                    showStatus("Enter the 6-digit OTP.", "danger");
                    return;
                }

                verifyOtpButton.disabled = true;
                showStatus("Verifying OTP…", "info");

                try {
                    const credential = await confirmationResult.confirm(otp);
                    const idToken = await credential.user.getIdToken();

                    const response = await fetch("/auth/verify-phone", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "same-origin",
                        body: JSON.stringify({
                            idToken,
                            phone: window.pendingPhone
                        })
                    });

                    const data = await response.json();

                    if (!response.ok || !data.success) {
                        throw new Error(data.message || "Server phone verification failed.");
                    }

                    verifiedPhone = data.phone;
                    window.phoneVerified = true;
                    window.verifiedPhone = verifiedPhone;

                    phoneInput.value = verifiedPhone;
                    phoneInput.readOnly = true;
                    otpInput.disabled = true;
                    verifyOtpButton.disabled = true;
                    sendOtpButton.disabled = true;

                    signupSection.classList.remove("d-none");

                    const passwordInput = document.getElementById("password");
                    if (passwordInput) passwordInput.disabled = false;
                    createAccountButton.disabled = false;

                    showStatus("Phone verified successfully. Complete your account details.", "success");

                    if (recaptchaVerifier) {
                        try { recaptchaVerifier.clear(); } catch (_) {}
                    }
                } catch (err) {
                    console.error("OTP verification error:", err);
                    showStatus(err.message || "Invalid OTP. Please try again.", "danger");
                    verifyOtpButton.disabled = false;
                }
            }

            sendOtpButton.addEventListener("click", sendOTP);
            verifyOtpButton.addEventListener("click", verifyOTP);

            createRecaptcha().catch(err => {
                console.error("reCAPTCHA initialization error:", err);
                showStatus("Could not load reCAPTCHA. Check your Firebase configuration and browser connection.", "danger");
            });
        } catch (err) {
            console.error("Firebase initialization error:", err);
            showStatus("Firebase could not initialize. Check the Firebase configuration.", "danger");
        }
    }
}
