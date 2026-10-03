const AcademicBook=require("../models/AcademicBook");
const Book=require("../models/Book");
const BookRequest=require("../models/BookRequest");
const StudentBook=require("../models/StudentBook");
const { notifyUser } = require("../utils/notificationService");
const {
  matchAcademicSubjectPair
} = require("../utils/academicMatcher");
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
async function searchAcademicSuggestions(req, res) {
 const query = clean(req.query.q).slice(0, 100);
 if (query.length < 2) return res.json({ suggestions: [] });

 const normalizedQuery = clean(query).toLowerCase();
 const normalizedCode = normalizedQuery.replace(/[^a-z0-9]/gi, "");
 const first = normalizedQuery.charAt(0);
 const firstRegex = new RegExp(first.replace(/[.*+?^$()|[\\]\\]/g, "\\exports.options=async(req,res)=>res.json(await options(req.query));"), "i");

 const candidates = await AcademicBook.find({
  active: true,
  verificationStatus: "verified",
  $or: [
   { subject: firstRegex },
   { subjectCode: firstRegex },
   { title: firstRegex }
  ]
 }).select("subject subjectCode title college degree course academicYear year semester").limit(250).lean();

 const ranked = candidates.map(candidate => {
  const subjectScore = subjectSimilarity(query, candidate.subject);
  const codeScore = normalizedCode && normalizeCode(candidate.subjectCode)
   ? subjectCodeSimilarity(query, candidate.subjectCode)
   : 0;
  const titleScore = subjectSimilarity(query, candidate.title);
  const codeExact = normalizedCode && normalizedCode === normalizeCode(candidate.subjectCode);
  const score = Math.max(
   subjectScore * 0.72 + titleScore * 0.28,
   codeScore * 0.92 + subjectScore * 0.08
  );
  return { candidate, score, subjectScore, codeScore, codeExact };
 })
 .filter(item => item.codeExact || item.subjectScore >= 0.45 || item.score >= 0.55)
 .sort((a,b) => {
  if (b.codeExact !== a.codeExact) return b.codeExact ? 1 : -1;
  return b.score - a.score;
 });

 const seen = new Set();
 const suggestions = [];
 for (const item of ranked) {
  const c = item.candidate;
  const key = String(c._id);
  if (seen.has(key)) continue;
  seen.add(key);
  suggestions.push({
   id: c._id,
   subject: c.subject,
   subjectCode: c.subjectCode,
   title: c.title,
   college: c.college,
   degree: c.degree,
   course: c.course,
   academicYear: c.academicYear,
   year: c.year,
   semester: c.semester,
   score: Number(item.score.toFixed(3))
  });
  if (suggestions.length >= 8) break;
 }

 res.json({ suggestions });
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
  semester:Number(user.semester),
  academicSubjects:Array.isArray(user.academicSubjects)
   ? user.academicSubjects
    .map(item=>({subject:clean(item.subject),subjectCode:clean(item.subjectCode)}))
    .filter(item=>item.subject && item.subjectCode)
   : []
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
  Number.isInteger(profile.semester) && profile.semester>0 &&
  profile.academicSubjects.length>0
 );

 let subjects=[];
 let summary={required:0,available:0,requested:0};

 if(complete){
  const academicFilter={
   college:academicRegex(profile.college),
   course:academicRegex(profile.course),
   academicYear:academicRegex(profile.academicYear),
   year:profile.year,
   semester:profile.semester,
   active:true,
   verificationStatus:"verified"
  };
  if(profile.degree) academicFilter.degree=academicRegex(profile.degree);
  // Query only the student's academic context first. Then match each
  // subject/code pair in JavaScript so case, spacing, punctuation and small
  // spelling mistakes are tolerated without mixing different subject codes.
  const catalogRows=await AcademicBook.find(academicFilter)
   .sort({subject:1,title:1,academicYear:-1})
   .lean();

  const rows=catalogRows.filter(row =>
   profile.academicSubjects.some(item =>
    matchAcademicSubjectPair(item,row).matched
   )
  );

  summary.required=rows.length;

  const ids=rows.map(row=>row._id);
  const sourceBookIds=rows
   .map(row=>row.sourceBook)
   .filter(Boolean);

  const availabilityFilter={
   $and:[
    {$or:[{status:"Available"},{status:{$exists:false}}]},
    {$or:[{stock:{$gt:0}},{stock:{$exists:false}}]}
   ]
  };

  if(hasLocation){
   availabilityFilter.location={
    $near:{
     $geometry:{type:"Point",coordinates:[lng,lat]},
     $maxDistance:radius*1000
    }
   };
  }

  const listingOr=[];
  if(ids.length) listingOr.push({academicBook:{$in:ids}});
  if(sourceBookIds.length) listingOr.push({_id:{$in:sourceBookIds}});

  let listings=[];
  if(listingOr.length){
   listings=await Book.find({
    ...availabilityFilter,
    $or:listingOr
   })
    .sort(hasLocation?{}:{price:1})
    .populate("owner","username college")
    .lean();
  }

  listings=listings.map(book=>{
   const coords=book.location?.coordinates;
   const distanceKm=hasLocation&&Array.isArray(coords)&&coords.length===2
    ? haversineKm(lat,lng,coords[1],coords[0])
    : null;
   return {...book,distanceKm};
  });

  const rowById=new Map(rows.map(row=>[String(row._id),row]));
  const rowBySourceBook=new Map(
   rows.filter(row=>row.sourceBook).map(row=>[String(row.sourceBook),row])
  );
  const listingMap=new Map();

  listings.forEach(book=>{
   let academicId=book.academicBook && rowById.has(String(book.academicBook))
    ? String(book.academicBook)
    : null;

   if(!academicId && rowBySourceBook.has(String(book._id))){
    academicId=String(rowBySourceBook.get(String(book._id))._id);
   }

   if(!academicId) return;

   const current=listingMap.get(academicId)||[];
   if(!current.some(item=>String(item._id)===String(book._id))){
    book.isOwnListing=String(book.owner?._id||book.owner)===String(req.user._id);
    current.push(book);
   }
   listingMap.set(academicId,current);
  });

  const requestMap=new Map();
  if(ids.length){
   const requests=await BookRequest.find({
    student:req.user._id,
    academicBook:{$in:ids},
    status:{$in:["Open","Matched"]}
   }).select("academicBook status matchedBook").lean();
   requests.forEach(r=>requestMap.set(String(r.academicBook),r));
  }

  const groups=new Map();
  rows.forEach(book=>{
   const key=String(book._id);
   const list=listingMap.get(key)||[];
   const request=requestMap.get(key);

   if(list.length){
    summary.available++;
   }else if(request){
    summary.requested++;
   }

   if(!groups.has(book.subject)){
    groups.set(book.subject,{name:book.subject,code:book.subjectCode,books:[]});
   }

   groups.get(book.subject).books.push({
    ...book,
    listings:list,
    requestStatus:request?.status||null,
    matchedBookId:request?.matchedBook ? String(request.matchedBook) : null
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

 const existing=await BookRequest.findOne({
  student:req.user._id,
  academicBook:academicBook._id,
  status:{$in:["Open","Matched"]}
 });
 if(existing){req.flash("success","You already have an active request for this book.");return res.redirect("/book-requests");}

 const listingQuery={
  $and:[
   {$or:[{status:"Available"},{status:{$exists:false}}]},
   {$or:[{stock:{$gt:0}},{stock:{$exists:false}}]}
  ],
  owner:{$ne:req.user._id},
  $or:[
   {academicBook:academicBook._id},
   {_id:academicBook.sourceBook}
  ]
 };

 const listing=await Book.findOne(listingQuery);
 if(listing){
  await BookRequest.create({
   student:req.user._id,
   academicBook:academicBook._id,
   college:academicBook.college,
   degree:academicBook.degree,
   course:academicBook.course,
   academicYear:academicBook.academicYear,
   year:academicBook.year,
   semester:academicBook.semester,
   status:"Matched",
   matchedBook:listing._id,
   matchedAt:new Date()
  });
  await notifyUser({
   recipient:req.user._id,
   type:"book_match",
   title:"A requested book is available",
   message:academicBook.title+" is available on BookLoop.",
   link:"/books/"+listing._id
  });
  return res.redirect("/books/"+listing._id);
 }

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
 req.flash("success","Request created. We'll notify you when a matching listing is available.");
 res.redirect("/book-requests");
};
exports.myRequests=async(req,res)=>{
 const openRequests=await BookRequest.find({
  student:req.user._id,
  status:"Open"
 }).select("_id academicBook").lean();

 if(openRequests.length){
  const academicIds=openRequests.map(request=>request.academicBook);
  const academicRows=await AcademicBook.find({_id:{$in:academicIds}})
   .select("_id sourceBook")
   .lean();

  const sourceMap=new Map(academicRows.filter(row=>row.sourceBook).map(row=>[
   String(row._id),String(row.sourceBook)
  ]));

  const matchOr=[];
  academicIds.forEach(id=>{
   matchOr.push({academicBook:id});
   const sourceBook=sourceMap.get(String(id));
   if(sourceBook) matchOr.push({_id:sourceBook});
  });

  const matches=matchOr.length?await Book.find({
   $and:[
    {$or:[{status:"Available"},{status:{$exists:false}}]},
    {$or:[{stock:{$gt:0}},{stock:{$exists:false}}]}
   ],
   owner:{$ne:req.user._id},
   $or:matchOr
  }).select("_id title academicBook owner").sort({createdAt:-1}).lean():[];

  const matchedUpdates=[];
  for(const request of openRequests){
   const sourceBook=sourceMap.get(String(request.academicBook));
   const match=matches.find(book =>
    String(book.academicBook||"")===String(request.academicBook) ||
    String(book._id)===String(sourceBook||"")
   );
   if(match) matchedUpdates.push({request,match});
  }

  if(matchedUpdates.length){
   await Promise.all(matchedUpdates.map(({request,match})=>
    BookRequest.updateOne(
     {_id:request._id,status:"Open"},
     {$set:{status:"Matched",matchedBook:match._id,matchedAt:new Date()}}
    )
   ));

   await Promise.all(matchedUpdates.map(({match})=>
    notifyUser({
     recipient:req.user._id,
     type:"book_match",
     title:"A book you requested is now available",
     message:match.title+" is available on BookLoop.",
     link:"/books/"+match._id
    })
   ));
  }
 }

 const requests=await BookRequest.find({student:req.user._id})
  .populate("academicBook")
  .populate({path:"matchedBook",populate:{path:"owner",select:"username college"}})
  .sort({createdAt:-1});

 const ownAcademicIds=requests
  .filter(request=>request.status==="Open" && request.academicBook)
  .map(request=>String(request.academicBook._id));

 if(ownAcademicIds.length){
  const ownAcademicRows=await AcademicBook.find({_id:{$in:ownAcademicIds}})
   .select("_id sourceBook")
   .lean();

  const ownOr=[];
  ownAcademicRows.forEach(row=>{
   ownOr.push({academicBook:row._id,owner:req.user._id});
   if(row.sourceBook) ownOr.push({_id:row.sourceBook,owner:req.user._id});
  });

  const ownListings=ownOr.length
   ? await Book.find({
      $and:[
       {$or:[{status:"Available"},{status:{$exists:false}}]},
       {$or:[{stock:{$gt:0}},{stock:{$exists:false}}]}
      ],
      $or:ownOr
     }).select("_id title academicBook owner").lean()
   : [];

  requests.forEach(request=>{
   if(request.status!=="Open" || !request.academicBook) return;
   const row=ownAcademicRows.find(item=>String(item._id)===String(request.academicBook._id));
   const sourceBook=String(row?.sourceBook||"");
   const ownListing=ownListings.find(book=>
    String(book.academicBook||"")===String(request.academicBook._id) ||
    String(book._id)===sourceBook
   );
   if(ownListing) request.ownMatchingBook=ownListing;
  });
 }

 res.render("academic/requests",{title:"My Book Requests",requests});
};
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

 // A request may have been created before this academic mapping was verified.
 // Match already-listed available books immediately after verification.
 const listings=await Book.find({
  academicBook:record._id,
  status:"Available",
  $or:[{stock:{$gt:0}},{stock:{$exists:false}}]
 }).select("_id title owner").lean();

 if(listings.length){
  const listing=listings[0];
  const requests=await BookRequest.find({
   academicBook:record._id,
   status:"Open",
   student:{$ne:listing.owner}
  }).select("_id student").lean();

  if(requests.length){
   await BookRequest.updateMany(
    {_id:{$in:requests.map(request=>request._id)}},
    {$set:{status:"Matched",matchedBook:listing._id,matchedAt:new Date()}}
   );

   await Promise.all(requests.map(request=>notifyUser({
    recipient:request.student,
    type:"book_match",
    title:"A book you requested is now available",
    message:record.title+" is now available on BookLoop.",
    link:"/books/"+listing._id
   })));
  }
 }

 if(record.submittedBy){
  await notifyUser({
   recipient:record.submittedBy,
   type:"listing_update",
   title:"Academic mapping verified",
   message:record.title+" is now verified and available in Smart Semester Finder.",
   link:"/find-books"
  });
 }
 req.flash("success", listings.length
  ?"Academic book verified and matching requests updated."
  :"Academic book verified and added to Smart Semester Finder.");
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
 if(record.submittedBy){
  await notifyUser({recipient:record.submittedBy,type:"listing_update",title:"Academic mapping rejected",message:record.title+" was not approved for Smart Semester Finder.",link:"/books"});
 }
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
exports.adminDelete=async(req,res)=>{
 const record=await AcademicBook.findById(req.params.id);
 if(!record){
  req.flash("error","Academic book not found.");
  return res.redirect("/admin/academic");
 }
 const affectedRequests=await BookRequest.find({
  academicBook:record._id,
  status:{$in:["Open","Matched"]}
 }).select("student").lean();

 await BookRequest.updateMany(
  {academicBook:record._id,status:{$in:["Open","Matched"]}},
  {$set:{status:"Cancelled",matchedBook:null,matchedAt:null}}
 );
 record.active=false;
 await record.save();

 await Promise.all(affectedRequests.map(request=>notifyUser({
  recipient:request.student,
  type:"request_update",
  title:"Academic book request closed",
  message:record.title+" is no longer part of the verified academic catalog, so your request was closed.",
  link:"/book-requests"
 })));

 req.flash("success",affectedRequests.length
  ?"Academic book archived and affected requests were closed."
  :"Academic book archived.");
 res.redirect("/admin/academic");
};
