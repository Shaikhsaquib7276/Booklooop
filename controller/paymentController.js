const crypto = require("crypto");
const https = require("https");
const Book = require("../models/Book");
const Order = require("../models/Order");

function razorpayRequest(path, payload) {
  return new Promise((resolve, reject) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return reject(new Error("Razorpay keys are not configured."));
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: "api.razorpay.com",
      path,
      method: "POST",
      auth: `${keyId}:${keySecret}`,
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    }, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { return reject(new Error("Invalid response from Razorpay.")); }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(parsed.error?.description || "Razorpay could not create the order."));
        }
        resolve(parsed);
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

exports.checkout = async (req, res) => {
  const ids = Array.isArray(req.session.cart) ? req.session.cart : [];
  const books = ids.length ? await Book.find({ _id: { $in: ids }, status: "Available" }) : [];
  res.render("payments/checkout", {
    title: "Checkout",
    books,
    keyId: process.env.RAZORPAY_KEY_ID || ""
  });
};

exports.addToCart = async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book || book.status !== "Available") {
    req.flash("error", "This book is not available.");
    return res.redirect("/books");
  }
  if (book.owner && book.owner.equals(req.user._id)) {
    req.flash("error", "You cannot purchase your own book.");
    return res.redirect(`/books/${book._id}`);
  }
  req.session.cart = Array.isArray(req.session.cart) ? req.session.cart : [];
  if (!req.session.cart.includes(String(book._id))) req.session.cart.push(String(book._id));
  req.flash("success", "Book added to your cart.");
  res.redirect("/cart");
};

exports.removeFromCart = (req, res) => {
  req.session.cart = (req.session.cart || []).filter(id => id !== req.params.id);
  req.flash("success", "Book removed from your cart.");
  res.redirect("/cart");
};

exports.createOrder = async (req, res) => {
  const ids = Array.isArray(req.body.bookIds) ? [...new Set(req.body.bookIds.map(String))] : [];
  if (!ids.length || ids.length > 20) return res.status(400).json({ error: "Select between 1 and 20 books." });

  const books = await Book.find({ _id: { $in: ids }, status: "Available" });
  if (books.length !== ids.length) return res.status(409).json({ error: "One or more books are no longer available. Refresh checkout." });
  if (books.some(book => book.owner && book.owner.equals(req.user._id))) {
    return res.status(403).json({ error: "You cannot purchase your own book." });
  }

  const amount = books.reduce((sum, book) => sum + Math.round(Number(book.price) * 100), 0);
  if (!Number.isSafeInteger(amount) || amount < 100) return res.status(400).json({ error: "Invalid order amount." });

  const order = await Order.create({
    buyer: req.user._id,
    items: books.map(book => ({ book: book._id, title: book.title, price: book.price, seller: book.owner })),
    amount
  });

  try {
    const razorpayOrder = await razorpayRequest("/v1/orders", {
      amount, currency: "INR", receipt: String(order._id),
      notes: { bookloopOrderId: String(order._id), buyerId: String(req.user._id) }
    });
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();
    res.json({ orderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency, keyId: process.env.RAZORPAY_KEY_ID, localOrderId: String(order._id) });
  } catch (err) {
    await Order.findByIdAndDelete(order._id);
    res.status(502).json({ error: err.message || "Unable to start payment." });
  }
};

exports.verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every(v => typeof v === "string" && v.length)) {
    return res.status(400).json({ error: "Missing payment verification fields." });
  }

  const order = await Order.findOne({ razorpayOrderId: razorpay_order_id, buyer: req.user._id });
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.status === "paid") return res.json({ success: true, redirect: `/payments/success/${order._id}` });

  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(razorpay_signature);
  if (!process.env.RAZORPAY_KEY_SECRET || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(400).json({ error: "Payment signature verification failed." });
  }

  // Confirm the payment with Razorpay before marking books as sold.
  try {
    const payment = await new Promise((resolve, reject) => {
      const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
      https.get({ hostname: "api.razorpay.com", path: `/v1/payments/${encodeURIComponent(razorpay_payment_id)}`, headers: { Authorization: `Basic ${auth}` } }, response => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", chunk => data += chunk);
        response.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error("Could not verify payment with Razorpay."));
            resolve(parsed);
          } catch (error) { reject(error); }
        });
      }).on("error", reject);
    });
    if (payment.order_id !== razorpay_order_id || payment.status !== "captured" || payment.amount !== order.amount || payment.currency !== "INR") {
      return res.status(400).json({ error: "Payment is not captured or does not match this order." });
    }
  } catch (error) {
    return res.status(502).json({ error: error.message || "Payment verification service unavailable." });
  }

  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: "created" },
    { $set: { status: "paid", razorpayPaymentId: razorpay_payment_id, paidAt: new Date() } },
    { new: true }
  );
  if (!updated && order.status !== "paid") return res.status(409).json({ error: "Order state changed. Contact support if you were charged." });

  await Book.updateMany({ _id: { $in: order.items.map(item => item.book) }, status: "Available" }, { $set: { status: "Sold" } });
  req.session.cart = (req.session.cart || []).filter(id => !order.items.some(item => String(item.book) === id));
  res.json({ success: true, redirect: `/payments/success/${order._id}` });
};

exports.success = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id }).populate("items.book");
  if (!order || order.status !== "paid") return res.redirect("/cart");
  res.render("payments/success", { title: "Payment successful", order });
};
