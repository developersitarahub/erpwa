import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  // 🚨 REQUIRED ON RAILWAY
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});


export async function sendMail({ to, subject, text, html }) {
  await transporter.sendMail({
    from: `"WhatsApp ERP" <${process.env.SMTP_FROM}>`,
    to,
    subject,
    text,
    html,
  });
}
