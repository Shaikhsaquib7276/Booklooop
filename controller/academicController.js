const AcademicBook=require("../models/AcademicBook");
const Book=require("../models/Book");
const BookRequest=require("../models/BookRequest");
const StudentBook=require("../models/StudentBook");
const Notification=require("../models/Notification");
const clean=v=>String(v||"").trim();

module.exports.options=async(req,res)=>{
 const f={active:true};
 ["college","course","academicYear"].forEach(k=>{if(clean(req.query[k]))f[k]=clean(req.query[k]);});
 const [colleges,courses,academicYears,semesters]=await Promise.all([
  AcademicBook.distinct("college",{active:true}),
  AcademicBook.distinct("course",f),
  AcademicBook.distinct("academicYear",f),
  AcademicBook.distinct("semester",f)
 ]);
 res.json({colleges:colleges.sort(),courses:courses.sort(),academicYears:academicYears.sort(),semesters:semesters.sort((a,b)=>a-b)});
};

module.exports.findBooks=async(req,res)=>{
 const f={college:clean(req.query.college),course:clean(req.query.course),academicYear:clean(req.query.academicYear),semester:Number(req.query.semester)};
 const complete=!!(f.college&&f.course&&f.academicYear&&Number.isInteger(f.semester)&&f.semester>0);
 const [colleges,courses,academicYears,semesters]=await Promise.all([
  AcademicBook.distinct("college",{active:true}),
  AcademicBook.distinct("course",{active:true,...(f.college?{college:f.college}:{})}),
  AcademicBook.distinct("academicYear",{active:true,...(f.college?{college:f.college}:{}),...(f.course?{course:f.course}:{})}),
  AcademicBook.distinct("semester",{active:true,...(f.college?{college:f.college}:{}),...(f.course?{course:f.course}:{}),...(f.academicYear?{academicYear:f.academicYear}:{})})
 ]);
 let subjects=[];
 if(complete){
  const rows=await AcademicBook.find({...f,active:true}).sort({subject:1,title:1}).lean();
  const ids=rows.map(x=>x._id);
  const listings=ids.length?await Book.find({academicBook:{$in:ids},status:"Available"}).populate("owner","username college").sort({price:1}).lean():[];
  const byId=new Map(); listings.forEach(b=>{const k=String(b.academicBook);if(!byId.has(k))byId.set(k,[]);byId.get(k).push(b);});
  const groups=new Map();
  rows.forEach(b=>{if(!groups.has(b.subject))groups.set(b.subject,{name:b.subject,code:b.subjectCode,books:[]});groups.get(b.subject).books.push({...b,listings:byId.get(String(b._id))||[]});});
  subjects=[...groups.values()];
 }
 res.render("academic/find",{title:"Find My Semester Books",options:{colleges:colleges.sort(),courses:courses.sort(),academicYears:academicYears.sort(),semesters:semesters.sort((a,b)=>a-b)},filters:f,complete,subjects});
};

module.exports.requestBook=async(req,res)=>{
 const academicBook=await AcademicBook.findOne({_id:req.params.id,active:true});
 if(!academicBook){req.flash("error","Academic book not found.");return res.redirect("/find-books");}
 const exists=await BookRequest.findOne({student:req.user._id,academicBook:academicBook._id,status:{$in:["Open","Matched"]}});
 if(exists){req.flash("success","You already have an active request for this book.");return res.redirect("/book-requests");}
 const listing=await Book.findOne({academicBook:academicBook._id,status:"Available"});
 if(listing){await Notification.create({recipient:req.user._id,type:"book_match",title:"A requested book is available",message:academicBook.title+" is listed on BookLoop.",link:"/books/"+listing._id});req.flash("success","A matching book is already available.");return res.redirect("/books/"+listing._id);}
 await BookRequest.create({student:req.user._id,academicBook:academicBook._id,college:academicBook.college,course:academicBook.course,academicYear:academicBook.academicYear,semester:academicBook.semester});
 req.flash("success","Request created. We will notify you when a matching book is listed.");res.redirect("/book-requests");
};
module.exports.myRequests=async(req,res)=>{
 const requests=await BookRequest.find({student:req.user._id}).populate("academicBook").populate("matchedBook").sort({createdAt:-1});
 res.render("academic/requests",{title:"My Book Requests",requests});
};
module.exports.myBooks=async(req,res)=>{
 const books=await StudentBook.find({student:req.user._id}).populate("book").populate("academicBook").sort({purchasedAt:-1});
 res.render("academic/my-books",{title:"My Academic Books",books});
};
module.exports.relist=async(req,res)=>{
 const owned=await StudentBook.findOne({_id:req.params.id,student:req.user._id,status:"Owned"}).populate("book").populate("academicBook");
 if(!owned||!owned.book){req.flash("error","This purchased book is not available to relist.");return res.redirect("/my-academic-books");}
 const old=owned.book;
 if(old.status==="Available"||old.status==="Reserved"){req.flash("error","This book already has an active listing.");return res.redirect("/my-academic-books");}
 const book=new Book({title:old.title,author:old.author,description:old.description,price:old.price,condition:old.condition,category:old.category,image:old.image,images:old.images,owner:req.user._id,status:"Available",academicBook:owned.academicBook._id});
 await book.save();
 owned.status="Relisted";owned.relistedBook=book._id;owned.relistedAt=new Date();await owned.save();
 req.flash("success","Your book has been relisted. Check the price and photos before sharing the listing.");
 res.redirect("/books/"+book._id);
};
module.exports.adminIndex=async(req,res)=>{
 const academicBooks=await AcademicBook.find({}).sort({college:1,course:1,academicYear:1,semester:1,subject:1,title:1});
 res.render("admin/academic",{title:"Academic Catalog",academicBooks});
};
module.exports.adminCreate=async(req,res)=>{
 const b=req.body,semester=Number(b.semester);
 if(!clean(b.college)||!clean(b.course)||!clean(b.academicYear)||!Number.isInteger(semester)||semester<1||!clean(b.subject)||!clean(b.title)){
  req.flash("error","College, course, year, semester, subject and title are required.");return res.redirect("/admin/academic");
 }
 await AcademicBook.create({college:clean(b.college),course:clean(b.course),academicYear:clean(b.academicYear),semester,subject:clean(b.subject),subjectCode:clean(b.subjectCode),title:clean(b.title),author:clean(b.author),isbn:clean(b.isbn),edition:clean(b.edition),type:b.type==="Reference"?"Reference":"Prescribed"});
 req.flash("success","Academic book added.");res.redirect("/admin/academic");
};
module.exports.adminDelete=async(req,res)=>{
 await AcademicBook.findByIdAndUpdate(req.params.id,{active:false});
 req.flash("success","Academic book archived from the student finder.");res.redirect("/admin/academic");
};