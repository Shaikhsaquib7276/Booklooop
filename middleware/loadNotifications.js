const Notification = require("../models/Notification");

module.exports = async (req, res, next) => {
  res.locals.unreadNotificationCount = 0;

  if (!req.user) return next();

  try {
    res.locals.unreadNotificationCount = await Notification.countDocuments({
      recipient: req.user._id,
      readAt: null
    });
  } catch (error) {
    console.error("Notification count error:", error.message);
  }

  next();
};
