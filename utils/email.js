// إرسال كود استعادة الباسورد بالإيميل (Nodemailer). لو مش متظبط بيطبع الكود في التيرمنال (في التطوير بس).
let transporter = null;

const isEmailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);

const getTransporter = () => {
  if (!transporter) {
    const nodemailer = require('nodemailer');
    const port = Number(process.env.EMAIL_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port,
      secure: port === 465,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
  }
  return transporter;
};

// مبيرميش exception أبدًا. بيرجّع true لو الإيميل اتبعت.
exports.sendOtpEmail = async (to, otp) => {
  try {
    if (!isEmailConfigured()) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[OTP] كود استعادة الباسورد لـ ${to}: ${otp}  (Nodemailer مش متظبط، فبيتطبع هنا في وضع التطوير بس)`);
      } else {
        console.warn('[email] Nodemailer مش متظبط: كود الاستعادة متبعتش.');
      }
      return false;
    }

    await getTransporter().sendMail({
      from: process.env.EMAIL_FROM || `سوا <${process.env.EMAIL_USER}>`,
      to,
      subject: 'كود استعادة الباسورد - سوا',
      text: `كود التحقق بتاعك: ${otp}\nالكود صالح 10 دقايق. لو إنت مطلبتش الكود ده تجاهل الرسالة.`,
      html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>سوا</h2><p>كود التحقق بتاعك:</p><h1 style="letter-spacing:6px">${otp}</h1><p>الكود صالح 10 دقايق. لو إنت مطلبتش الكود ده تجاهل الرسالة.</p></div>`,
    });
    return true;
  } catch (err) {
    console.error(`[email] فشل إرسال الإيميل: ${err.message}`);
    return false;
  }
};
