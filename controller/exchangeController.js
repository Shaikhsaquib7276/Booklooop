const mongoose = require("mongoose");
const Book = require("../models/Book");
const BookExchange = require("../models/BookExchange");
const { notifyUser } = require("../utils/notificationService");

const userId = user => String(user._id);

const availableFilter = {
  owner: { $exists: true },
  $or: [
    { sellerType: "student" },
    { sellerType: { $exists: false } }
  ],
  $and: [
    { $or: [{ status: "Available" }, { status: { $exists: false } }] },
    { $or: [{ stock: { $gt: 0 } }, { stock: { $exists: false } }] }
  ]
};

const validId = value => mongoose.isValidObjectId(value);

module.exports.browse = async (req, res) => {
  const [books, myBooks] = await Promise.all([
    Book.find({
      ...availableFilter,
      owner: { $exists: true, $ne: req.user._id }
    })
      .populate("owner", "username college city")
      .sort({ createdAt: -1 })
      .limit(60),
    Book.find({
      ...availableFilter,
      owner: req.user._id
    })
      .sort({ createdAt: -1 })
  ]);

  const requestedBookId = String(req.query.requestedBook || "");
  const requestedBookExists = books.some(book => String(book._id) === requestedBookId);

  res.render("exchange/browse", {
    title: "Exchange Books",
    books,
    myBooks,
    requestedBookId: requestedBookExists ? requestedBookId : ""
  });
};

module.exports.create = async (req, res) => {
  const { requestedBookId, offeredBookId } = req.body;

  if (!validId(requestedBookId) || !validId(offeredBookId) || requestedBookId === offeredBookId) {
    req.flash("error", "Choose two different valid books to exchange.");
    return res.redirect("/exchange");
  }

  const [requested, offered] = await Promise.all([
    Book.findById(requestedBookId),
    Book.findById(offeredBookId)
  ]);

  if (!requested || !offered) {
    req.flash("error", "One or both books could not be found.");
    return res.redirect("/exchange");
  }

  const requestedAvailable = (!requested.status || requested.status === "Available") &&
    (requested.stock === undefined || requested.stock > 0);
  const offeredAvailable = (!offered.status || offered.status === "Available") &&
    (offered.stock === undefined || offered.stock > 0);

  if (!requestedAvailable || !offeredAvailable) {
    req.flash("error", "Both books must be available for exchange.");
    return res.redirect("/exchange");
  }

  if (!offered.owner || !offered.owner.equals(req.user._id) || offered.sellerType === "shop") {
    req.flash("error", "You can only offer a book you own as a student.");
    return res.redirect("/exchange");
  }

  if (!requested.owner || requested.owner.equals(req.user._id) || requested.sellerType === "shop") {
    req.flash("error", "You can only exchange with another student.");
    return res.redirect("/exchange");
  }

  const activeExchange = await BookExchange.findOne({
    status: { $in: ["Pending", "Accepted"] },
    $or: [
      { offeredBook: offered._id },
      { requestedBook: offered._id },
      { offeredBook: requested._id },
      { requestedBook: requested._id }
    ]
  });

  if (activeExchange) {
    req.flash("error", "One of these books is already involved in an active exchange.");
    return res.redirect("/exchange/mine");
  }

  await BookExchange.create({
    offeredBook: offered._id,
    requestedBook: requested._id,
    proposer: req.user._id,
    recipient: requested.owner
  });

  await notifyUser({
    recipient: requested.owner,
    type: "listing_update",
    title: "New book exchange offer",
    message: req.user.username + " offered " + offered.title + " in exchange for your " + requested.title + ".",
    link: "/exchange/mine"
  });

  req.flash("success", "Exchange offer sent.");
  res.redirect("/exchange/mine");
};

module.exports.mine = async (req, res) => {
  const exchanges = await BookExchange.find({
    $or: [{ proposer: req.user._id }, { recipient: req.user._id }]
  })
    .populate("offeredBook requestedBook", "title author image status stock")
    .populate("proposer recipient", "username college")
    .sort({ updatedAt: -1 });

  res.render("exchange/mine", {
    title: "My Exchanges",
    exchanges,
    currentId: userId(req.user)
  });
};

module.exports.respond = async (req, res) => {
  if (!validId(req.params.id)) {
    req.flash("error", "Invalid exchange offer.");
    return res.redirect("/exchange/mine");
  }

  const exchange = await BookExchange.findById(req.params.id);
  if (!exchange) {
    req.flash("error", "Exchange offer not found.");
    return res.redirect("/exchange/mine");
  }

  if (!exchange.recipient.equals(req.user._id)) {
    req.flash("error", "Only the requested book owner can respond.");
    return res.redirect("/exchange/mine");
  }

  if (exchange.status !== "Pending") {
    req.flash("error", "This offer is no longer pending.");
    return res.redirect("/exchange/mine");
  }

  if (req.body.action === "reject") {
    exchange.status = "Rejected";
    await exchange.save();

    await notifyUser({
      recipient: exchange.proposer,
      type: "listing_update",
      title: "Exchange offer rejected",
      message: "Your exchange offer was rejected.",
      link: "/exchange/mine"
    });

    req.flash("success", "Exchange offer rejected.");
    return res.redirect("/exchange/mine");
  }

  if (req.body.action !== "accept") {
    req.flash("error", "Invalid action.");
    return res.redirect("/exchange/mine");
  }

  const [offered, requested] = await Promise.all([
    Book.findById(exchange.offeredBook),
    Book.findById(exchange.requestedBook)
  ]);

  const offeredAvailable = offered &&
    (!offered.status || offered.status === "Available") &&
    (offered.stock === undefined || offered.stock > 0);
  const requestedAvailable = requested &&
    (!requested.status || requested.status === "Available") &&
    (requested.stock === undefined || requested.stock > 0);

  if (!offered || !requested ||
      !offeredAvailable || !requestedAvailable ||
      !offered.owner || !requested.owner ||
      !offered.owner.equals(exchange.proposer) ||
      !requested.owner.equals(exchange.recipient)) {
    req.flash("error", "One of these books is no longer available or ownership changed.");
    return res.redirect("/exchange/mine");
  }

  offered.status = "Reserved";
  requested.status = "Reserved";
  await Promise.all([offered.save(), requested.save()]);

  exchange.status = "Accepted";
  exchange.proposerConfirmed = false;
  exchange.recipientConfirmed = false;
  await exchange.save();

  await notifyUser({
    recipient: exchange.proposer,
    type: "listing_update",
    title: "Exchange offer accepted",
    message: "Your exchange offer was accepted. Meet the other student and confirm the swap after receiving both books.",
    link: "/exchange/mine"
  });

  req.flash("success", "Offer accepted. Both students must confirm the exchange after swapping books.");
  res.redirect("/exchange/mine");
};

module.exports.cancel = async (req, res) => {
  if (!validId(req.params.id)) {
    req.flash("error", "Invalid exchange offer.");
    return res.redirect("/exchange/mine");
  }

  const exchange = await BookExchange.findById(req.params.id);
  if (!exchange) {
    req.flash("error", "Exchange offer not found.");
    return res.redirect("/exchange/mine");
  }

  if (!exchange.proposer.equals(req.user._id) || exchange.status !== "Pending") {
    req.flash("error", "Only your pending offers can be cancelled.");
    return res.redirect("/exchange/mine");
  }

  exchange.status = "Cancelled";
  await exchange.save();

  await notifyUser({
    recipient: exchange.recipient,
    type: "listing_update",
    title: "Exchange offer cancelled",
    message: "The student cancelled the exchange offer.",
    link: "/exchange/mine"
  });

  req.flash("success", "Offer cancelled.");
  res.redirect("/exchange/mine");
};

module.exports.confirm = async (req, res) => {
  if (!validId(req.params.id)) {
    req.flash("error", "Invalid exchange offer.");
    return res.redirect("/exchange/mine");
  }

  const exchange = await BookExchange.findById(req.params.id);
  if (!exchange) {
    req.flash("error", "Exchange not found.");
    return res.redirect("/exchange/mine");
  }

  if (exchange.status !== "Accepted" ||
      (!exchange.proposer.equals(req.user._id) && !exchange.recipient.equals(req.user._id))) {
    req.flash("error", "You cannot confirm this exchange.");
    return res.redirect("/exchange/mine");
  }

  const isProposer = exchange.proposer.equals(req.user._id);

  if (isProposer) exchange.proposerConfirmed = true;
  else exchange.recipientConfirmed = true;

  if (exchange.proposerConfirmed && exchange.recipientConfirmed) {
    const [offered, requested] = await Promise.all([
      Book.findById(exchange.offeredBook),
      Book.findById(exchange.requestedBook)
    ]);

    if (!offered || !requested ||
        offered.status !== "Reserved" ||
        requested.status !== "Reserved" ||
        !offered.owner || !requested.owner ||
        !offered.owner.equals(exchange.proposer) ||
        !requested.owner.equals(exchange.recipient)) {
      req.flash("error", "The books changed before the exchange could be completed.");
      return res.redirect("/exchange/mine");
    }

    offered.owner = exchange.recipient;
    requested.owner = exchange.proposer;
    offered.status = "Available";
    requested.status = "Available";

    await Promise.all([offered.save(), requested.save()]);

    exchange.status = "Completed";
    exchange.completedAt = new Date();

    await notifyUser({
      recipient: exchange.proposer,
      type: "listing_update",
      title: "Exchange completed",
      message: "The book exchange is complete. Ownership has been updated.",
      link: "/exchange/mine"
    });

    await notifyUser({
      recipient: exchange.recipient,
      type: "listing_update",
      title: "Exchange completed",
      message: "The book exchange is complete. Ownership has been updated.",
      link: "/exchange/mine"
    });
  } else {
    const otherUser = isProposer ? exchange.recipient : exchange.proposer;
    await notifyUser({
      recipient: otherUser,
      type: "listing_update",
      title: "Exchange confirmation received",
      message: "The other student has confirmed the book swap. Please confirm it from My Exchanges.",
      link: "/exchange/mine"
    });
  }

  await exchange.save();

  req.flash(
    "success",
    exchange.status === "Completed"
      ? "Exchange completed and book ownership updated."
      : "Your confirmation was recorded."
  );
  res.redirect("/exchange/mine");
};
