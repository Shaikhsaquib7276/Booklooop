const mongoose = require("mongoose");
const schema = new mongoose.Schema({
 student:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
 academicBook:{type:mongoose.Schema.Types.ObjectId,ref:"AcademicBook",required:true,index:true},
 college:{type:String,required:true},course:{type:String,required:true},academicYear:{type:String,required:true},semester:{type:Number,required:true},
 status:{type:String,enum:["Open","Matched","Fulfilled","Cancelled"],default:"Open",index:true},
 matchedBook:{type:mongoose.Schema.Types.ObjectId,ref:"Book",default:null},matchedAt:{type:Date,default:null}
},{timestamps:true});
schema.index({student:1,academicBook:1,status:1});
module.exports=mongoose.model("BookRequest",schema);