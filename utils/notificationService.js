const Notification = require("../models/Notification");
const User = require("../models/user");

const escapeHtml = value => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

async function sendEmail({ to, name, subject, message, link }) {
  if (
    process.env.NOTIFICATION_EMAIL_ENABLED !== "true" ||
    !process.env.BREVO_API_KEY ||
    !process.env.NOTIFICATION_EMAIL_FROM
  ) {
    return;
  }

  const htmlLink = link
    ? `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">Open BookLoop</a></p>`
    : "";

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:auto;">
      <h2 style="margin-bottom:8px;">${escapeHtml(subject)}</h2>
      <p>Hello ${escapeHtml(name || "BookLoop user")},</p>
      <p>${escapeHtml(message)}</p>
      ${htmlLink}
      <p style="color:#6b7280;font-size:12px;">You received this email because email notifications are enabled for your BookLoop account.</p>
    </div>
  `;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        sender: {
          name: process.env.NOTIFICATION_EMAIL_FROM_NAME || "BookLoop",
          email: process.env.NOTIFICATION_EMAIL_FROM
        },
        to: [{ email: to, name: name || "BookLoop user" }],
        subject,
        htmlContent
      })
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("Brevo notification email failed:", response.status, details);
    }
  } catch (error) {
    console.error("Notification email error:", error.message);
  }
}

async function notifyUser({
  recipient,
  type = "system",
  title,
  message,
  link = "/notifications",
  email = true
}) {
  if (!recipient || !title || !message) return null;

  const user = await User.findById(recipient).select("username email").lean();
  if (!user) return null;

  const notification = await Notification.create({
    recipient: user._id,
    type,
    title,
    message,
    link
  });

  if (email && user.email) {
    void sendEmail({
      to: user.email,
      name: user.username,
      subject: title,
      message,
      link: process.env.BOOKLOOP_BASE_URL
        ? new URL(link, process.env.BOOKLOOP_BASE_URL).toString()
        : undefined
    });
  }

  return notification;
}

async function notifyUsers(options, recipients) {
  const ids = [...new Set((recipients || []).map(String).filter(Boolean))];
  if (!ids.length) return [];

  return Promise.all(
    ids.map(recipient => notifyUser({ ...options, recipient }))
  );
}

module.exports = {
  sendEmail,
  notifyUser,
  notifyUsers
};
