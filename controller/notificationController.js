const Notification=require("../models/Notification");
module.exports.index=async(req,res)=>{
 const notifications=await Notification.find({recipient:req.user._id}).sort({createdAt:-1});
 await Notification.updateMany({recipient:req.user._id,readAt:null},{$set:{readAt:new Date()}});
 res.render("notifications/index",{title:"Notifications",notifications});
};