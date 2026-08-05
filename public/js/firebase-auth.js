import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyClNC3iHCi2pGbgI4AbZOaX_IZzZs-iPck",
    authDomain: "bookloop-3.firebaseapp.com",
    projectId: "bookloop-3",
    storageBucket: "bookloop-3.firebasestorage.app",
    messagingSenderId: "488785421566",
    appId: "1:488785421566:web:e6bea7118992ace1d971af",
    measurementId: "G-4V1WBF9SM4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ===========================
// Setup Recaptcha
// ===========================

window.recaptchaVerifier = new RecaptchaVerifier(
    auth,
    "recaptcha-container",
    {
        size: "normal"
    }
);

await window.recaptchaVerifier.render();

// ===========================
// Send OTP
// ===========================

document
.getElementById("sendOTP")
.addEventListener("click", sendOTP);

async function sendOTP() {

    const phone = document
        .getElementById("phone")
        .value
        .trim();

    if (!phone) {

        alert("Enter phone number");

        return;

    }

    try {

        const confirmationResult =
            await signInWithPhoneNumber(

                auth,

                phone,

                window.recaptchaVerifier

            );

        window.confirmationResult =
            confirmationResult;

        document
            .getElementById("otp")
            .disabled = false;

        document
            .getElementById("verifyOTP")
            .disabled = false;

        document
            .getElementById("sendOTP")
            .disabled = true;

        document
            .getElementById("otpStatus")
            .innerHTML = `
                <div class="alert alert-success mt-3">
                    OTP Sent Successfully
                </div>
            `;

    }

    catch(err){

    console.error("Firebase Error:", err);

    console.log("Code:", err.code);

    console.log("Message:", err.message);

    document.getElementById("otpStatus").innerHTML = `
        <div class="alert alert-danger mt-3">
            ${err.code}<br>
            ${err.message}
        </div>
    `;

}

}

// ===========================
// Verify OTP
// ===========================

document
.getElementById("verifyOTP")
.addEventListener("click", verifyOTP);

async function verifyOTP(){

    const otp =
    document
    .getElementById("otp")
    .value
    .trim();

    if(!otp){

        alert("Enter OTP");

        return;

    }

    try{

        const result =
        await window
        .confirmationResult
        .confirm(otp);

        console.log(result.user);

        // document
        // .getElementById("phoneVerified")
        // .value="true";

        document
        .getElementById("otpStatus")
        .innerHTML=`
        <div class="alert alert-success mt-3">
            ✅ Phone Verified Successfully
        </div>
        `;

        document
        .getElementById("phone")
        .disabled=true;

        document
        .getElementById("otp")
        .disabled=true;

        document
        .getElementById("verifyOTP")
        .disabled=true;

        document
        .getElementById("signupSection")
        .classList.remove("d-none");

        document
        .getElementById("password")
        .disabled=false;

        document
        .getElementById("createAccount")
        .disabled=false;

    }

    catch(err){

        console.log(err);

        document
        .getElementById("otpStatus")
        .innerHTML=`
        <div class="alert alert-danger mt-3">
            Invalid OTP
        </div>
        `;

    }

}
