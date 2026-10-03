require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/user");
const Book = require("../models/Book");
const AcademicBook = require("../models/AcademicBook");

const MONGO_URL = process.env.MONGO_URL;
const PASSWORD = process.env.SEED_PASSWORD || "BookLoopTest@123";
const COLLEGE = "BookLoop Demo College";
const ACADEMIC_YEAR = "2026-2027";

const studentNames = ["Aarav Patil","Aditi Sharma","Rohan Jadhav","Sneha Kulkarni","Aditya More","Priya Shah","Rahul Deshmukh","Neha Joshi","Omkar Pawar","Ananya Singh"];
const shopNames = ["Campus Book Corner","Knowledge Hub Books","Student Book Depot","Readers Point","Academic Book House","PageTurner Book Shop","Smart Study Store","College Book World","BookNest Store","The Study Shelf"];

const academicBooks = [
  { subject:"Database Management Systems", subjectCode:"BCS501", title:"Database System Concepts", author:"Abraham Silberschatz, Henry F. Korth, S. Sudarshan", isbn:"9780078022159", edition:"7th Edition", type:"Prescribed" },
  { subject:"Computer Networks", subjectCode:"BCS502", title:"Computer Networking: A Top-Down Approach", author:"James F. Kurose, Keith W. Ross", isbn:"9780136681557", edition:"8th Edition", type:"Prescribed" },
  { subject:"Software Engineering", subjectCode:"BCS503", title:"Software Engineering", author:"Ian Sommerville", isbn:"9780133943030", edition:"10th Edition", type:"Reference" }
];


const BOISAR_CENTER = { lat:19.803621, lng:72.75598 };

// Current seed creates 120 listings. To keep the existing seller/book logic unchanged,
// the 120 listings are distributed into these non-overlapping distance bands from Boisar:
// 15 <=10 km, 10 in 10-20 km, 20 in 20-30 km, 40 in 30-40 km, 35 in 40-50 km.
// This also guarantees every seeded book has valid GeoJSON coordinates.
const BOISAR_LOCATION_BUCKETS = [
  { count:15, minKm:2,  maxKm:10 },
  { count:10, minKm:11, maxKm:20 },
  { count:20, minKm:21, maxKm:30 },
  { count:40, minKm:31, maxKm:40 },
  { count:35, minKm:41, maxKm:50 }
];

function getBoisarBookLocation(index) {
  let remaining = index;
  let bucket = BOISAR_LOCATION_BUCKETS[BOISAR_LOCATION_BUCKETS.length - 1];

  for (const current of BOISAR_LOCATION_BUCKETS) {
    if (remaining < current.count) {
      bucket = current;
      break;
    }
    remaining -= current.count;
  }

  const distanceKm =
    bucket.minKm +
    (((index + 17) * 7919) % 1000) / 1000 * (bucket.maxKm - bucket.minKm);

  // Spread points around the Boisar center with deterministic bearings.
  const bearingDeg = ((index + 1) * 137.508) % 360;
  const earthRadiusKm = 6371;
  const angularDistance = distanceKm / earthRadiusKm;
  const bearingRad = bearingDeg * Math.PI / 180;
  const lat1 = BOISAR_CENTER.lat * Math.PI / 180;
  const lng1 = BOISAR_CENTER.lng * Math.PI / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  const lng2 = lng1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
    Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    type:"Point",
    coordinates:[
      Number((lng2 * 180 / Math.PI).toFixed(6)),
      Number((lat2 * 180 / Math.PI).toFixed(6))
    ]
  };
}

const regularBooks = [
  { title:"Let Us C", author:"Yashavant Kanetkar", description:"A practical introduction to C programming, including operators, control statements, arrays, pointers, and functions. Demo listing for BookLoop testing.", category:"Programming", price:180, condition:"Good" },
  { title:"Java: The Complete Reference", author:"Herbert Schildt", description:"A comprehensive reference covering Java fundamentals, object-oriented programming, collections, and core APIs. Demo listing for BookLoop testing.", category:"Programming", price:350, condition:"Like New" },
  { title:"Eloquent JavaScript", author:"Marijn Haverbeke", description:"A hands-on guide to JavaScript, functions, objects, asynchronous programming, and browser development. Demo listing for BookLoop testing.", category:"Web Development", price:250, condition:"Fair" }
];

async function getOrCreateUser(username, name, accountType, shopName) {
  let user = await User.findOne({ username });
  if (user) return user;

  user = new User({
    username,
    email: username + "@bookloop.test",
    phone: "9000000000",
    city: "Nashik",
    college: COLLEGE,
    degree: "BSc",
    course: "Computer Science",
    academicYear: ACADEMIC_YEAR,
    year: 3,
    semester: 5,
    accountType,
    ...(accountType === "shop" ? {
      shopName,
      shopAddress: shopName + ", College Road, Nashik",
      shopLocation: { type:"Point", coordinates:[73.7898,19.9975] }
    } : {}),
    role:"user",
    isActive:true
  });
  return User.register(user, PASSWORD);
}

async function seed() {
  if (!MONGO_URL) throw new Error("MONGO_URL is missing from .env");
  await mongoose.connect(MONGO_URL);
  console.log("Connected to MongoDB");

  const users = [];
  for (let i=0; i<10; i++) {
    users.push(await getOrCreateUser("seedstudent"+String(i+1).padStart(2,"0"), studentNames[i], "student"));
  }
  for (let i=0; i<10; i++) {
    users.push(await getOrCreateUser("seedshop"+String(i+1).padStart(2,"0"), shopNames[i], "shop", shopNames[i]));
  }

  const catalog = [];
  for (const item of academicBooks) {
    const record = await AcademicBook.findOneAndUpdate(
      { college:COLLEGE, degree:"BSc", course:"Computer Science", academicYear:ACADEMIC_YEAR, year:3, semester:5, title:item.title },
      { $set:{ ...item, verificationStatus:"verified", active:true } },
      { new:true, upsert:true, runValidators:true, setDefaultsOnInsert:true }
    );
    catalog.push(record);
  }

  let inserted = 0;
  let listingIndex = 0;
  for (const user of users) {
    for (let i=0; i<catalog.length; i++) {
      const academic = catalog[i];
      await Book.findOneAndUpdate(
        { owner:user._id, academicBook:academic._id, title:academic.title },
        { $set:{
          title:academic.title,
          author:academic.author || "Unknown",
          description:"Second-hand academic copy for "+academic.subject+". Suitable for BSc Computer Science Semester 5. Demo listing for BookLoop testing.",
          price:[320,400,280][i],
          condition:["Good","Like New","Fair"][i],
          category:"Academic",
          image:{url:"/book.jpg"},
          images:[],
          academicBook:academic._id,
          owner:user._id,
          sellerType:user.accountType,
          stock:user.accountType==="shop"?4:1,
          addressLine:user.accountType==="shop"?user.shopAddress:"Nashik, Maharashtra",
          location:getBoisarBookLocation(listingIndex++),
          status:"Available"
        }},
        { upsert:true, new:true, runValidators:true, setDefaultsOnInsert:true }
      );
      inserted++;
    }
    for (const book of regularBooks) {
      await Book.findOneAndUpdate(
        { owner:user._id, academicBook:null, title:book.title },
        { $set:{
          ...book,
          image:{url:"/book.jpg"},
          images:[],
          academicBook:null,
          owner:user._id,
          sellerType:user.accountType,
          stock:user.accountType==="shop"?4:1,
          addressLine:user.accountType==="shop"?user.shopAddress:"Nashik, Maharashtra",
          location:getBoisarBookLocation(listingIndex++),
          status:"Available"
        }},
        { upsert:true, new:true, runValidators:true, setDefaultsOnInsert:true }
      );
      inserted++;
    }
  }

  console.log("Seed completed.");
  console.log("Student accounts: 10");
  console.log("Shop accounts: 10");
  console.log("Academic catalog records: "+catalog.length);
  console.log("Academic listings: 60");
  console.log("Regular listings: 60");
  console.log("Total expected listings: 120");
  console.log("Boisar distance bands: 15 <=10 km, 10 in 10-20 km, 20 in 20-30 km, 40 in 30-40 km, 35 in 40-50 km");
  console.log("Test password for newly created accounts: "+PASSWORD);
  console.log("Usernames: seedstudent01–seedstudent10, seedshop01–seedshop10");
}
seed().catch(err=>{ console.error("Seed failed:",err); process.exitCode=1; }).finally(async()=>{ await mongoose.disconnect(); });
