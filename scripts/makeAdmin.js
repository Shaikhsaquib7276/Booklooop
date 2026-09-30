require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/user");

async function main() {
    const email = process.argv[2] || process.env.ADMIN_EMAIL;
    if (!email) throw new Error("Provide an email: node scripts/makeAdmin.js user@example.com");
    await mongoose.connect(process.env.MONGO_URL);
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) throw new Error("No user found with email " + email);
    user.role = "admin";
    user.isActive = true;
    await user.save();
    console.log("Admin role granted to " + user.username + " (" + user.email + ")");
    await mongoose.disconnect();
}
main().catch(async err => { console.error(err.message); try { await mongoose.disconnect(); } catch {} process.exit(1); });
