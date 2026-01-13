import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";

import { generateOtp, hashOtp } from "../utils/otp.js";
import { sendMail } from "../utils/mailer.js";
import { passwordResetOtpTemplate } from "../emails/passwordResetOtp.template.js";

/**
 * FORGOT PASSWORD
 */
export async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  
  const user = await prisma.user.findFirst({
    where: {
      email,
      role: {
        in: ["vendor_owner", "vendor_admin", "sales"],
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!user) {
    return res.status(404).json({
      message: "No account exists with this email",
    });
  }

  const otp = generateOtp();

  // Invalidate previous OTPs
  await prisma.passwordResetOtp.updateMany({
    where: {
      userId: user.id,
      used: false,
    },
    data: {
      used: true,
    },
  });

  // Create new OTP
  await prisma.passwordResetOtp.create({
    data: {
      userId: user.id,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  await sendMail({
    to: email,
    ...passwordResetOtpTemplate({
      name: user.name,
      otp,
    }),
  });

  res.json({ message: "OTP sent to your email" });
}

/**
 * VERIFY OTP
 */
export async function verifyForgotOtp(req, res) {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      message: "Email and OTP are required",
    });
  }

  const otpRecord = await prisma.passwordResetOtp.findFirst({
    where: {
      otpHash: hashOtp(otp),
      used: false,
      expiresAt: {
        gt: new Date(),
      },
      user: {
        email,
      },
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!otpRecord) {
    return res.status(400).json({
      message: "Invalid or expired OTP",
    });
  }

  // Mark OTP as used
  await prisma.passwordResetOtp.update({
    where: { id: otpRecord.id },
    data: { used: true },
  });

  // Issue reset token (10 minutes)
  const resetToken = jwt.sign(
    {
      sub: otpRecord.userId,
      type: "password_reset",
    },
    process.env.PASSWORD_RESET_TOKEN_SECRET,
    { expiresIn: "10m" }
  );

  res.json({ resetToken });
}

/**
 * RESET PASSWORD
 */
export async function resetForgotPassword(req, res) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Missing reset token",
    });
  }

  const token = authHeader.split(" ")[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.PASSWORD_RESET_TOKEN_SECRET);
  } catch {
    return res.status(401).json({
      message: "Invalid or expired reset token",
    });
  }

  if (payload.type !== "password_reset") {
    return res.status(401).json({
      message: "Invalid token type",
    });
  }

  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({
      message: "Password must be at least 8 characters",
    });
  }

  await prisma.user.update({
    where: { id: payload.sub },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 10),
    },
  });

  res.json({ message: "Password reset successful" });
}
