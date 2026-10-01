const AcademicBook=require("../models/AcademicBook");
const Book=require("../models/Book");
const BookRequest=require("../models/BookRequest");
const StudentBook=require("../models/StudentBook");
const Notification=require("../models/Notification");
const clean=v=>String(v||"").trim();
async function options(filters={}) {
 const f={active:true, verificationStatus:"verified"};
 ["college","degree","course","academicYear"].forEach(k=>{if(clean(filters[k]))f[k]=clean(filters[k]);});
 const [colleges,courses,academicYears,semesters]=await Promise.all([
  AcademicBook.distinct("college",{active:true}),AcademicBook.distinct("course",f),
  AcademicBook.distinct("academicYear",f),AcademicBook.distinct("semester",f)]);
 return {colleges:colleges.sort(),courses:courses.sort(),academicYears:academicYears.sort(),semesters:semesters.sort((a,b)=>a-b)};
}
exports.options=async(req,res)=>res.json(await options(req.query));
exports.findBooks=async(req,res)=>{
 const filters={
  college:clean(req.query.college),
  degree:clean(req.query.degree),
  course:clean(req.query.course),
  academicYear:clean(req.query.academicYear),
  year:Number(req.query.year),
  semester:Number(req.query.semester)
 };
 const radiusValue=Number.parseInt(req.query.radius,10);
 const radius=[1,5,10,20,50].includes(radiusValue)?radiusValue:10;
 const lat=Number(req.query.lat);
 const lng=Number(req.query.lng);
 const hasLocation=Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180;
 const complete=!!(
  filters.college &&
  filters.degree &&
  filters.course &&
  filters.academicYear &&
  Number.isInteger(filters.year) && filters.year>0 &&
  Number.isInteger(filters.semester) && filters.semester>0
 );

 let subjects=[];
 let summary={required:0,available:0,requested:0};
 if(complete){
  const rows=await AcademicBook.find({...filters,active:true,verificationStatus:"verified"}).sort({subject:1,title:1}).lean();
  summary.required=rows.length;
  const ids=rows.map(x=>x._id);

  const listingFilter={
   academicBook:{$in:ids},
   $and:[
    {$or:[{status:"Available"},{status:{$exists:false}}]},
    {$or:[{stock:{$gt:0}},{stock:{$exists:false}}]}
   ]
  };

  if(req.user?._id) listingFilter.owner={$ne:req.user._id};
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
  if(req.user?._id&&ids.length){
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
  title:"Find My Semester Books",
  options:await options(filters),
  filters,
  complete,
  subjects,
  radius,
  hasLocation,
  searchLat:hasLocation?lat:"",
  searchLng:hasLocation?lng:"",
  summary
 });
};

function haversineKm(lat1,lng1,lat2,lng2){
 const toRad=value=>value*Math.PI/180;
 const dLat=toRad(lat2-lat1);
 const dLng=toRad(lng2-lng1);
 const a=Math.sin(dLat/2)**2+
  Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

exports.requestBook=async(req,res)=>{
 const academicBook=await AcademicBook.findOne({_id:req.params.id,active:true});
 if(!academicBook){req.flash("error","Academic book not found.");return res.redirect("/find-books");}
 const existing=await BookRequest.findOne({student:req.user._id,academicBook:academicBook._id,status:{$in:["Open","Matched"]}});
 if(existing){req.flash("success","You already have an active request for this book.");return res.redirect("/book-requests");}
 const listing=await Book.findOne({academicBook:academicBook._id,status:"Available",owner:{$ne:req.user._id}});
 if(listing){await Notification.create({recipient:req.user._id,type:"book_match",title:"A requested book is available",message:academicBook.title+" is listed on BookLoop.",link:"/books/"+listing._id});return res.redirect("/books/"+listing._id);}
 await BookRequest.create({student:req.user._id,academicBook:academicBook._id,college:academicBook.college,course:academicBook.course,academicYear:academicBook.academicYear,semester:academicBook.semester});
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
exports.adminIndex=async(req,res)=>res.render("admin/academic",{title:"Academic Catalog",academicBooks:await AcademicBook.find({active:true}).sort({college:1,course:1,academicYear:1,semester:1,subject:1,title:1})});
exports.adminCreate=async(req,res)=>{
 const b=req.body,semester=Number(b.semester);
 if(!clean(b.college)||!clean(b.course)||!clean(b.academicYear)||!Number.isInteger(semester)||semester<1||!clean(b.subject)||!clean(b.title)){req.flash("error","College, course, year, semester, subject and title are required.");return res.redirect("/admin/academic");}
 await AcademicBook.create({college:clean(b.college),course:clean(b.course),academicYear:clean(b.academicYear),semester,subject:clean(b.subject),subjectCode:clean(b.subjectCode),title:clean(b.title),author:clean(b.author),isbn:clean(b.isbn),edition:clean(b.edition),type:b.type==="Reference"?"Reference":"Prescribed"});
 req.flash("success","Academic book added.");res.redirect("/admin/academic");
};
exports.adminDelete=async(req,res)=>{await AcademicBook.findByIdAndUpdate(req.params.id,{active:false});req.flash("success","Academic book archived.");res.redirect("/admin/academic");};
