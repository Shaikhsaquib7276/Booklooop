const Book = require("../models/Book");
const BookExchange = require("../models/BookExchange");

const userId = (user) => String(user._id);

module.exports.browse = async (req, res) => {
  const availableBookFilter = {
    sellerType: "student",
    owner: { $exists: true, $ne: req.user._id },
    $or: [{ status: "Available" }, { status: { $exists: false } }]
  };

  const myBookFilter = {
    sellerType: "student",
    owner: req.user._id,
    $or: [{ status: "Available" }, { status: { $exists: false } }]
  };

  const [books, myBooks] = await Promise.all([
    Book.find(availableBookFilter)
      .populate("owner", "username college city")
      .sort({ createdAt: -1 })
      .limit(60),
    Book.find(myBookFilter).sort({ createdAt: -1 })
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
  if (!requestedBookId || !offeredBookId || requestedBookId === offeredBookId) {
    req.flash("error", "Choose two different books to exchange.");
    return res.redirect("/exchange");
  }
  const [requested, offered] = await Promise.all([
    Book.findById(requestedBookId), Book.findById(offeredBookId)
  ]);
  const requestedAvailable = requested && (!requested.status || requested.status === "Available");
  const offeredAvailable = offered && (!offered.status || offered.status === "Available");

  if (!requested || !offered || !requestedAvailable || !offeredAvailable) {
    req.flash("error", "Both books must exist and be available.");
    return res.redirect("/exchange");
  }
  if (!offered.owner || !offered.owner.equals(req.user._id) || offered.sellerType === "shop") {
    req.flash("error", "You can only offer a book you own.");
    return res.redirect("/exchange");
  }
  if (!requested.owner || requested.owner.equals(req.user._id) || requested.sellerType === "shop") {
    req.flash("error", "You cannot exchange with yourself.");
    return res.redirect("/exchange");
  }
  const duplicate = await BookExchange.findOne({
    offeredBook: offered._id, requestedBook: requested._id, proposer: req.user._id,
    status: { $in: ["Pending", "Accepted"] }
  });
  if (duplicate) {
    req.flash("error", "You already have an active offer for these books.");
    return res.redirect("/exchange/mine");
  }
  await BookExchange.create({
    offeredBook: offered._id, requestedBook: requested._id,
    proposer: req.user._id, recipient: requested.owner
  });
  req.flash("success", "Exchange offer sent.");
  res.redirect("/exchange/mine");
};

module.exports.mine = async (req, res) => {
  const exchanges = await BookExchange.find({
    $or: [{ proposer: req.user._id }, { recipient: req.user._id }]
  }).populate("offeredBook requestedBook proposer recipient", "title author image username")
    .sort({ updatedAt: -1 });
  res.render("exchange/mine", { title: "My Exchanges", exchanges, currentId: userId(req.user) });
};

module.exports.respond = async (req, res) => {
  const exchange = await BookExchange.findById(req.params.id).populate("offeredBook requestedBook");
  if (!exchange) { req.flash("error", "Exchange offer not found."); return res.redirect("/exchange/mine"); }
  if (!exchange.recipient.equals(req.user._id)) { req.flash("error", "Only the book owner can respond."); return res.redirect("/exchange/mine"); }
  if (exchange.status !== "Pending") { req.flash("error", "This offer is no longer pending."); return res.redirect("/exchange/mine"); }
  if (req.body.action === "reject") {
    exchange.status = "Rejected";
    await exchange.save();
    req.flash("success", "Exchange offer rejected.");
    return res.redirect("/exchange/mine");
  }
  if (req.body.action !== "accept") { req.flash("error", "Invalid action."); return res.redirect("/exchange/mine"); }
  const [offered, requested] = await Promise.all([
    Book.findById(exchange.offeredBook._id), Book.findById(exchange.requestedBook._id)
  ]);
  if (!offered || !requested ||
      (offered.status && offered.status !== "Available") ||
      (requested.status && requested.status !== "Available") ||
      !offered.owner.equals(exchange.proposer) || !requested.owner.equals(exchange.recipient)) {
    req.flash("error", "One of these books is no longer available.");
    return res.redirect("/exchange/mine");
  }
  offered.status = "Reserved"; requested.status = "Reserved";
  await Promise.all([offered.save(), requested.save()]);
  exchange.status = "Accepted";
  await exchange.save();
  req.flash("success", "Offer accepted. Both students must confirm the exchange after swapping books.");
  res.redirect("/exchange/mine");
};

module.exports.cancel = async (req, res) => {
  const exchange = await BookExchange.findById(req.params.id);
  if (!exchange) { req.flash("error", "Exchange offer not found."); return res.redirect("/exchange/mine"); }
  if (!exchange.proposer.equals(req.user._id) || exchange.status !== "Pending") {
    req.flash("error", "Only your pending offers can be cancelled.");
    return res.redirect("/exchange/mine");
  }
  exchange.status = "Cancelled";
  await exchange.save();
  req.flash("success", "Offer cancelled.");
  res.redirect("/exchange/mine");
};

module.exports.confirm = async (req, res) => {
  const exchange = await BookExchange.findById(req.params.id);
  if (!exchange) { req.flash("error", "Exchange not found."); return res.redirect("/exchange/mine"); }
  if (exchange.status !== "Accepted" ||
      (!exchange.proposer.equals(req.user._id) && !exchange.recipient.equals(req.user._id))) {
    req.flash("error", "You cannot confirm this exchange.");
    return res.redirect("/exchange/mine");
  }
  if (exchange.proposer.equals(req.user._id)) exchange.proposerConfirmed = true;
  else exchange.recipientConfirmed = true;
  if (exchange.proposerConfirmed && exchange.recipientConfirmed) {
    const [offered, requested] = await Promise.all([
      Book.findById(exchange.offeredBook), Book.findById(exchange.requestedBook)
    ]);
    if (!offered || !requested || offered.status !== "Reserved" || requested.status !== "Reserved" ||
        !offered.owner.equals(exchange.proposer) || !requested.owner.equals(exchange.recipient)) {
      req.flash("error", "Book ownership or availability changed; contact support.");
      return res.redirect("/exchange/mine");
    }
    offered.owner = exchange.recipient;
    requested.owner = exchange.proposer;
    offered.status = "Available";
    requested.status = "Available";
    await Promise.all([offered.save(), requested.save()]);
    exchange.status = "Completed";
    exchange.completedAt = new Date();
  }
  await exchange.save();
  req.flash("success", exchange.status === "Completed" ? "Exchange completed and book ownership updated." : "Your confirmation was recorded.");
  res.redirect("/exchange/mine");
};
