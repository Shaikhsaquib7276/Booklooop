const crypto = require("crypto");
const https = require("https");
const Book = require("../models/Book");
const Order = require("../models/Order");
const StudentBook = require("../models/StudentBook");
const BookRequest = require("../models/BookRequest");
const { notifyUser } = require("../utils/notificationService");
function cashfreeRequest(pathname, method, payload) {
  return new Promise((resolve, reject) => {
    const appId = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;
    if (!appId || !secretKey) return reject(new Error("Cashfree keys are not configured."));

    const body = payload ? JSON.stringify(payload) : null;
    const hostname = process.env.CASHFREE_ENV === "production"
      ? "api.cashfree.com"
      : "sandbox.cashfree.com";

    const request = https.request({
      hostname,
      path: pathname,
      method,
      headers: {
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "x-api-version": "2025-01-01",
        "Content-Type": "application/json",
        "Content-Length": body ? Buffer.byteLength(body) : 0
      }
    }, response => {
      let data = "";
      response.setEncoding("utf8");
      response.on("data", chunk => data += chunk);
      response.on("end", () => {
        let parsed = {};
        try { parsed = data ? JSON.parse(data) : {}; } catch {
          return reject(new Error("Invalid response from Cashfree."));
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          return reject(new Error(parsed.message || parsed.error || "Cashfree request failed."));
        }
        resolve(parsed);
      });
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

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
    keyId: process.env.RAZORPAY_KEY_ID || "",
    cashfreeConfigured: Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY)
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

  // Expire abandoned checkout attempts after 30 minutes. Keep them in the
  // database for the admin order history instead of deleting them.
  const checkoutExpiry = new Date(Date.now() - 30 * 60 * 1000);
  await Order.updateMany(
    { buyer: req.user._id, status: "created", createdAt: { $lt: checkoutExpiry } },
    { $set: { status: "failed" } }
  );

  // Reuse an active Razorpay order for the exact same cart to avoid creating
  // duplicate payment attempts when the checkout button is clicked again.
  const activeOrders = await Order.find({
    buyer: req.user._id,
    status: "created",
    createdAt: { $gte: checkoutExpiry }
  }).sort({ createdAt: -1 });

  const requestedIds = [...ids].sort();
  const existingOrder = activeOrders.find(order => {
    const existingIds = order.items.map(item => String(item.book)).sort();
    return existingIds.length === requestedIds.length &&
      existingIds.every((id, index) => id === requestedIds[index]) &&
      order.amount === amount;
  });

  if (existingOrder) {
    if (!existingOrder.razorpayOrderId) {
      return res.status(409).json({ error: "Your checkout is already being prepared. Please wait a moment and try again." });
    }
    return res.json({
      orderId: existingOrder.razorpayOrderId,
      amount: existingOrder.amount,
      currency: existingOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      localOrderId: String(existingOrder._id)
    });
  }

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

  // A checkout may have been marked failed as abandoned while the buyer
  // still had Razorpay open. A verified captured payment must still be honored.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: { $in: ["created", "failed"] } },
    { $set: { status: "paid", razorpayPaymentId: razorpay_payment_id, paidAt: new Date() } },
    { new: true }
  );
  if (!updated && order.status !== "paid") return res.status(409).json({ error: "Order state changed. Contact support if you were charged." });

  const purchasedIds = order.items.map(item => item.book);
  const purchasedBooks = await Book.find({ _id: { $in: purchasedIds } }).select("_id academicBook author");
  await Book.updateMany({ _id: { $in: purchasedIds }, status: "Available" }, { $set: { status: "Sold" } });
  for (const item of order.items) {
    const purchased = purchasedBooks.find(book => String(book._id) === String(item.book));
    if (!purchased || !purchased.academicBook) continue;
    await StudentBook.updateOne({ student: req.user._id, order: order._id, book: item.book }, { $setOnInsert: { student: req.user._id, book: item.book, academicBook: purchased.academicBook, order: order._id, titleSnapshot: item.title, authorSnapshot: purchased.author || "", pricePaid: Number(item.price) || 0, purchasedAt: new Date(), status: "Owned" } }, { upsert: true });
    await BookRequest.updateOne({ student: req.user._id, matchedBook: item.book, status: "Matched" }, { $set: { status: "Fulfilled" } });
    await BookRequest.updateMany({ matchedBook: item.book, status: "Matched", student: { $ne: req.user._id } }, { $set: { status: "Open", matchedBook: null, matchedAt: null } });
  }
  req.session.cart = (req.session.cart || []).filter(id => !order.items.some(item => String(item.book) === id));
  await notifyUser({recipient:req.user._id,type:"payment_update",title:"Payment successful",message:"Your BookLoop order has been paid successfully.",link:"/payments/success/"+order._id});
  res.json({ success: true, redirect: `/payments/success/${order._id}` });
};

exports.success = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id }).populate("items.book");
  if (!order || order.status !== "paid") return res.redirect("/cart");
  res.render("payments/success", { title: "Payment successful", order });
};

exports.cashfreeCreateOrder = async (req, res) => {
  const ids = Array.isArray(req.body.bookIds) ? [...new Set(req.body.bookIds.map(String))] : [];
  if (!ids.length || ids.length > 20) return res.status(400).json({ error: "Select between 1 and 20 books." });

  const books = await Book.find({ _id: { $in: ids }, status: "Available" });
  if (books.length !== ids.length) return res.status(409).json({ error: "One or more books are no longer available. Refresh checkout." });
  if (books.some(book => book.owner && book.owner.equals(req.user._id))) {
    return res.status(403).json({ error: "You cannot purchase your own book." });
  }

  const amount = books.reduce((sum, book) => sum + Math.round(Number(book.price) * 100), 0);
  if (!Number.isSafeInteger(amount) || amount < 100) return res.status(400).json({ error: "Invalid order amount." });

  const checkoutExpiry = new Date(Date.now() - 30 * 60 * 1000);
  await Order.updateMany(
    { buyer: req.user._id, status: "created", paymentProvider: "cashfree", createdAt: { $lt: checkoutExpiry } },
    { $set: { status: "failed" } }
  );

  const requestedIds = [...ids].sort();
  const activeOrders = await Order.find({
    buyer: req.user._id,
    status: "created",
    paymentProvider: "cashfree",
    createdAt: { $gte: checkoutExpiry }
  }).sort({ createdAt: -1 });
  const existingOrder = activeOrders.find(order => {
    const existingIds = order.items.map(item => String(item.book)).sort();
    return existingIds.length === requestedIds.length &&
      existingIds.every((id, index) => id === requestedIds[index]) &&
      order.amount === amount;
  });

  if (existingOrder?.cashfreeOrderId && existingOrder.cashfreePaymentSessionId) {
    return res.json({
      orderId: existingOrder.cashfreeOrderId,
      paymentSessionId: existingOrder.cashfreePaymentSessionId,
      amount: existingOrder.amount,
      currency: existingOrder.currency,
      localOrderId: String(existingOrder._id),
      mode: process.env.CASHFREE_ENV === "production" ? "production" : "sandbox"
    });
  }

  const order = existingOrder || await Order.create({
    buyer: req.user._id,
    items: books.map(book => ({ book: book._id, title: book.title, price: book.price, seller: book.owner })),
    amount,
    paymentProvider: "cashfree"
  });

  try {
    const baseUrl = process.env.BOOKLOOP_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const cashfreeOrderId = `bl_${String(order._id)}_${Date.now()}`;
    const response = await cashfreeRequest("/pg/orders", "POST", {
      order_id: cashfreeOrderId,
      order_amount: amount / 100,
      order_currency: "INR",
      customer_details: {
        customer_id: String(req.user._id),
        customer_name: req.user.username || "BookLoop Customer",
        customer_email: req.user.email,
        customer_phone: req.user.phone || "9999999999"
      },
      order_meta: {
        return_url: `${baseUrl}/payments/cashfree/success?order_id=${encodeURIComponent(cashfreeOrderId)}`
      },
      order_note: `BookLoop order ${order._id}`
    });

    order.cashfreeOrderId = response.order_id || cashfreeOrderId;
    order.cashfreePaymentSessionId = response.payment_session_id;
    await order.save();

    return res.json({
      orderId: order.cashfreeOrderId,
      paymentSessionId: order.cashfreePaymentSessionId,
      amount: order.amount,
      currency: order.currency,
      localOrderId: String(order._id),
      mode: process.env.CASHFREE_ENV === "production" ? "production" : "sandbox"
    });
  } catch (error) {
    if (!existingOrder) await Order.findByIdAndDelete(order._id);
    return res.status(502).json({ error: error.message || "Unable to start Cashfree payment." });
  }
};

exports.cashfreeSuccess = async (req, res) => {
  const cashfreeOrderId = String(req.query.order_id || "");
  if (!cashfreeOrderId) {
    req.flash("error", "Cashfree order ID is missing.");
    return res.redirect("/cart");
  }

  const order = await Order.findOne({ cashfreeOrderId, buyer: req.user._id });
  if (!order) {
    req.flash("error", "Cashfree order not found.");
    return res.redirect("/cart");
  }
  if (order.status === "paid") return res.redirect(`/payments/success/${order._id}`);

  try {
    const payments = await cashfreeRequest(`/pg/orders/${encodeURIComponent(cashfreeOrderId)}/payments`, "GET");
    const transactions = Array.isArray(payments) ? payments : [];
    const successful = transactions.find(payment =>
      payment.payment_status === "SUCCESS" &&
      Number(payment.payment_amount) === Number(order.amount) / 100 &&
      payment.payment_currency === "INR"
    );

    if (!successful) {
      const pending = transactions.some(payment => payment.payment_status === "PENDING");
      req.flash("error", pending
        ? "Cashfree payment is still pending. Please check your payment status again shortly."
        : "Cashfree payment was not successful.");
      return res.redirect("/cart");
    }

    order.status = "paid";
    order.cashfreePaymentId = successful.cf_payment_id ? String(successful.cf_payment_id) : undefined;
    order.paidAt = new Date();
    await order.save();

    const purchasedIds = order.items.map(item => item.book);
    const purchasedBooks = await Book.find({ _id: { $in: purchasedIds } }).select("_id academicBook author");
    await Book.updateMany({ _id: { $in: purchasedIds }, status: "Available" }, { $set: { status: "Sold" } });
    for (const item of order.items) {
      const purchased = purchasedBooks.find(book => String(book._id) === String(item.book));
      if (!purchased || !purchased.academicBook) continue;
      await StudentBook.updateOne(
        { student: req.user._id, order: order._id, book: item.book },
        { $setOnInsert: { student: req.user._id, book: item.book, academicBook: purchased.academicBook, order: order._id, titleSnapshot: item.title, authorSnapshot: purchased.author || "", pricePaid: Number(item.price) || 0, purchasedAt: new Date(), status: "Owned" } },
        { upsert: true }
      );
      await BookRequest.updateOne({ student: req.user._id, matchedBook: item.book, status: "Matched" }, { $set: { status: "Fulfilled" } });
      await BookRequest.updateMany({ matchedBook: item.book, status: "Matched", student: { $ne: req.user._id } }, { $set: { status: "Open", matchedBook: null, matchedAt: null } });
    }
    req.session.cart = (req.session.cart || []).filter(id => !order.items.some(item => String(item.book) === id));
    await notifyUser({recipient:req.user._id,type:"payment_update",title:"Payment successful",message:"Your Cashfree payment for the BookLoop order was successful.",link:"/payments/success/"+order._id});
    return res.redirect(`/payments/success/${order._id}`);
  } catch (error) {
    req.flash("error", error.message || "Unable to verify Cashfree payment.");
    return res.redirect("/cart");
  }
};