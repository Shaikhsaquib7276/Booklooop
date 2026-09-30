const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 student:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
 book:{type:mongoose.Schema.Types.ObjectId,ref:"Book",required:true},
 academicBook:{type:mongoose.Schema.Types.ObjectId,ref:"AcademicBook",required:true,index:true},
 order:{type:mongoose.Schema.Types.ObjectId,ref:"Order",required:true},
 titleSnapshot:{type:String,required:true},authorSnapshot:{type:String,default:""},pricePaid:{type:Number,required:true,min:0},
 purchasedAt:{type:Date,default:Date.now},status:{type:String,enum:["Owned","Relisted"],default:"Owned",index:true},
 relistedBook:{type:mongoose.Schema.Types.ObjectId,ref:"Book",default:null},relistedAt:{type:Date,default:null}
},{timestamps:true});
schema.index({student:1,status:1});
module.exports=mongoose.model("StudentBook",schema);