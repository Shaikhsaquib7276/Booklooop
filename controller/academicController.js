const AcademicBook=require("../models/AcademicBook");
const Book=require("../models/Book");
const BookRequest=require("../models/BookRequest");
const StudentBook=require("../models/StudentBook");
const Notification=require("../models/Notification");
const clean=v=>String(v||"").trim();
const academicRegex=value=>{
 const parts=clean(value).split(/[^a-z0-9]+/i).filter(Boolean);
 if(!parts.length)return null;
 return new RegExp(parts.map(part=>part.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&")).join("[^a-z0-9]+"),"i");
};
const haversineKm=(lat1,lon1,lat2,lon2)=>{
 const toRad=value=>value*Math.PI/180;
 const R=6371;
 const dLat=toRad(lat2-lat1);
 const dLon=toRad(lon2-lon1);
 const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
 return 2*R*Math.asin(Math.sqrt(a));
};
async function options(filters={}) {
 const f={active:true, verificationStatus:"verified"};
 ["college","degree","course","academicYear"].forEach(k=>{if(clean(filters[k]))f[k]=clean(filters[k]);});
 const [colleges,degrees,courses,academicYears,years,semesters]=await Promise.all([
  AcademicBook.distinct("college",f),
  AcademicBook.distinct("degree",f),
  AcademicBook.distinct("course",f),
  AcademicBook.distinct("academicYear",f),
  AcademicBook.distinct("year",f),
  AcademicBook.distinct("semester",f)
 ]);
 return {
  colleges:colleges.filter(Boolean).sort(),
  degrees:degrees.filter(Boolean).sort(),
  courses:courses.filter(Boolean).sort(),
  academicYears:academicYears.filter(Boolean).sort(),
  years:years.filter(Number.isFinite).sort((a,b)=>a-b),
  semesters:semesters.filter(Number.isFinite).sort((a,b)=>a-b)
 };
}
exports.options=async(req,res)=>res.json(await options(req.query));
exports.findBooks=async(req,res)=>{
 const user=req.user;
 const profile={
  college:clean(user.college),
  degree:clean(user.degree),
  course:clean(user.course),
  academicYear:clean(user.academicYear),
  year:Number(user.year),
  semester:Number(user.semester)
 };
 const radiusValue=Number.parseInt(req.query.radius,10);
 const radius=[1,5,10,20,50].includes(radiusValue)?radiusValue:10;
 const lat=Number(req.query.lat);
 const lng=Number(req.query.lng);
 const hasLocation=Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;

 const complete=Boolean(
  profile.college &&
  profile.degree &&
  profile.course &&
  profile.academicYear &&
  Number.isInteger(profile.year) && profile.year>0 &&
  Number.isInteger(profile.semester) && profile.semester>0
 );

 let subjects=[];
 let summary={required:0,available:0,requested:0};

 if(complete){
  const academicFilter={
   college:academicRegex(profile.college),
   course:academicRegex(profile.course),
   year:profile.year,
   semester:profile.semester,
   active:true,
   verificationStatus:"verified"
  };
  if(profile.degree) academicFilter.degree=academicRegex(profile.degree);

  const rows=await AcademicBook.find(academicFilter)
   .sort({subject:1,title:1,academicYear:-1})
   .lean();

  summary.required=rows.length;
  const ids=rows.map(x=>x._id);

  const listingFilter={
   academicBook:{$in:ids},
   $and:[
    {$or:[{status:"Available"},{status:{$exists:false}}]},
    {$or:[{stock:{$gt:0}},{stock:{$exists:false}}]}
   ],
   owner:{$ne:req.user._id}
  };

  if(hasLocation){
   listingFilter.location={
    $near:{
     $geometry:{type:"Point",coordinates:[lng,lat]},
     $maxDistance:radius*1000
    }
   };
  }

  let listings=ids.length?await Book.find(listingFilter)
   .sort(hasLocation?{}:{price:1})
   .populate("owner","username college")
   .lean():[];

  listings=listings.map(book=>{
   const coords=book.location?.coordinates;
   const distanceKm=hasLocation&&Array.isArray(coords)&&coords.length===2
    ? haversineKm(lat,lng,coords[1],coords[0])
    : null;
   return {...book,distanceKm};
  });

  const requestMap=new Map();
  if(ids.length){
   const requests=await BookRequest.find({
    student:req.user._id,
    academicBook:{$in:ids},
    status:{$in:["Open","Matched"]}
   }).select("academicBook status").lean();
   requests.forEach(r=>requestMap.set(String(r.academicBook),r.status));
  }

  const listingMap=new Map();
  listings.forEach(book=>{
   const key=String(book.academicBook);
   if(!listingMap.has(key))listingMap.set(key,[]);
   listingMap.get(key).push(book);
  });

  const groups=new Map();
  rows.forEach(book=>{
   const list=listingMap.get(String(book._id))||[];
   if(list.length)summary.available++;
   else if(requestMap.has(String(book._id)))summary.requested++;

   if(!groups.has(book.subject)){
    groups.set(book.subject,{name:book.subject,code:book.subjectCode,books:[]});
   }

   groups.get(book.subject).books.push({
    ...book,
    listings:list,
    requestStatus:requestMap.get(String(book._id))||null
   });
  });

  subjects=[...groups.values()];
 }

 res.render("academic/find",{
  title:"Smart Semester Finder",
  profile,
  complete,
  subjects,
  radius,
  hasLocation,
  searchLat:hasLocation?lat:"",
  searchLng:hasLocation?lng:"",
  summary
 });
};

exports.requestBook=async(req,res)=>{
 const academicBook=await AcademicBook.findOne({_id:req.params.id,active:true,verificationStatus:"verified"});
 if(!academicBook){req.flash("error","Academic book not found.");return res.redirect("/find-books");}
 const existing=await BookRequest.findOne({student:req.user._id,academicBook:academicBook._id,status:{$in:["Open","Matched"]}});
 if(existing){req.flash("success","You already have an active request for this book.");return res.redirect("/book-requests");}
 const listing=await Book.findOne({academicBook:academicBook._id,status:"Available",owner:{$ne:req.user._id}});
 if(listing){await Notification.create({recipient:req.user._id,type:"book_match",title:"A requested book is available",message:academicBook.title+" is listed on BookLoop.",link:"/books/"+listing._id});return res.redirect("/books/"+listing._id);}
 await BookRequest.create({
  student:req.user._id,
  academicBook:academicBook._id,
  college:academicBook.college,
  degree:academicBook.degree,
  course:academicBook.course,
  academicYear:academicBook.academicYear,
  year:academicBook.year,
  semester:academicBook.semester
 });
 req.flash("success","Request created. We'll notify you when a matching book is listed.");res.redirect("/book-requests");
};
exports.myRequests=async(req,res)=>res.render("academic/requests",{title:"My Book Requests",requests:await BookRequest.find({student:req.user._id}).populate("academicBook").populate("matchedBook").sort({createdAt:-1})});
exports.myBooks=async(req,res)=>res.render("academic/my-books",{title:"My Academic Books",books:await StudentBook.find({student:req.user._id}).populate("book").populate("academicBook").sort({purchasedAt:-1})});
exports.relist=async(req,res)=>{
 const owned=await StudentBook.findOne({_id:req.params.id,student:req.user._id,status:"Owned"}).populate("book").populate("academicBook");
 if(!owned||!owned.book||!owned.academicBook){req.flash("error","This purchased book cannot be relisted.");return res.redirect("/my-academic-books");}
 if(["Available","Reserved"].includes(owned.book.status)){req.flash("error","This book already has an active listing.");return res.redirect("/my-academic-books");}
 const old=owned.book;
 const book=await Book.create({title:old.title,author:old.author,description:old.description,price:old.price,condition:old.condition,category:old.category,image:old.image,images:old.images,academicBook:owned.academicBook._id,owner:req.user._id,status:"Available"});
 owned.status="Relisted";owned.relistedBook=book._id;owned.relistedAt=new Date();await owned.save();
 req.flash("success","Book relisted. Review the listing before sharing it.");res.redirect("/books/"+book._id+"/edit");
};
exports.adminIndex=async(req,res)=>{
 const [pending,verified,rejected]=await Promise.all([
  AcademicBook.find({verificationStatus:"pending",active:true}).populate("submittedBy","username email college course degree").populate("sourceBook","title price").sort({createdAt:-1}),
  AcademicBook.find({verificationStatus:"verified",active:true}).populate("verifiedBy","username").sort({college:1,course:1,academicYear:1,year:1,semester:1,subject:1,title:1}),
  AcademicBook.find({verificationStatus:"rejected"}).populate("submittedBy","username").sort({createdAt:-1}).limit(50)
 ]);
 res.render("admin/academic",{title:"Academic Catalog Review",pending,verified,rejected});
};
exports.verifyAcademicBook=async(req,res)=>{
 const record=await AcademicBook.findById(req.params.id);
 if(!record){req.flash("error","Academic submission not found.");return res.redirect("/admin/academic");}
 record.verificationStatus="verified";
 record.active=true;
 record.verifiedBy=req.user._id;
 record.verifiedAt=new Date();
 await record.save();
 req.flash("success","Academic book verified and added to Smart Semester Finder.");
 res.redirect("/admin/academic");
};

exports.rejectAcademicBook=async(req,res)=>{
 const record=await AcademicBook.findById(req.params.id);
 if(!record){req.flash("error","Academic submission not found.");return res.redirect("/admin/academic");}
 record.verificationStatus="rejected";
 record.active=false;
 record.verifiedBy=req.user._id;
 record.verifiedAt=new Date();
 await record.save();
 req.flash("success","Academic submission rejected.");
 res.redirect("/admin/academic");
};

// Retained only for backward compatibility with older deployments; the admin UI and route no longer expose manual catalog creation.
exports.adminCreate=async(req,res)=>{
 const b=req.body,semester=Number(b.semester);
 if(!clean(b.college)||!clean(b.course)||!clean(b.academicYear)||!Number.isInteger(semester)||semester<1||!clean(b.subject)||!clean(b.title)){req.flash("error","College, course, year, semester, subject and title are required.");return res.redirect("/admin/academic");}
 await AcademicBook.create({college:clean(b.college),course:clean(b.course),academicYear:clean(b.academicYear),semester,subject:clean(b.subject),subjectCode:clean(b.subjectCode),title:clean(b.title),author:clean(b.author),isbn:clean(b.isbn),edition:clean(b.edition),type:b.type==="Reference"?"Reference":"Prescribed"});
 req.flash("success","Academic book added.");res.redirect("/admin/academic");
};
exports.adminDelete=async(req,res)=>{await AcademicBook.findByIdAndUpdate(req.params.id,{active:false});req.flash("success","Academic book archived.");res.redirect("/admin/academic");};
