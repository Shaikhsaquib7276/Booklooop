const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 recipient:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
 type:{type:String,enum:["book_match","relist_reminder","system"],default:"system"},
 title:{type:String,required:true},message:{type:String,required:true},link:{type:String,default:"/"},readAt:{type:Date,default:null}
},{timestamps:true});
schema.index({recipient:1,createdAt:-1});
module.exports=mongoose.model("Notification",schema);