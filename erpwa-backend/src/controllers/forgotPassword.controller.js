import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import prisma from "../prisma.js";
import { getIO } from "../socket.js";

import { generateOtp, hashOtp } from "../utils/otp.js";
import { sendMail } from "../utils/mailer.js";
import { passwordResetOtpTemplate } from "../emails/passwordResetOtp.template.js";
import { logActivity } from "../services/activityLog.service.js";

/**
 * FORGOT PASSWORD
 */
export async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  // Check if this request includes an invite token (from create-password page)
  const authHeader = req.headers.authorization;
  let isInviteFlow = false;

  if (authHeader) {
    const token = authHeader.split(" ")[1];

    try {
      const payload = jwt.verify(token, process.env.PASSWORD_RESET_TOKEN_SECRET);

      // Check if token is an invite token
      if (payload.type === "invite") {
        isInviteFlow = true;
        console.log("✅ Valid invite token for user:", payload.sub);
      }
    } catch (error) {
      // Only return error if it's supposed to be an invite flow
      // (if token exists, we assume it's an invite attempt)
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "Invite link has expired. Please contact the administrator for a new invitation.",
          code: "INVITE_EXPIRED"
        });
      }
      return res.status(401).json({
        message: "Invalid invite link. Please contact the administrator.",
        code: "INVITE_INVALID"
      });
    }
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
      activatedAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({
      message: "No account exists with this email",
    });
  }

  // Check if this is an invite link and account is already activated
  if (isInviteFlow && user.activatedAt) {
    return res.status(400).json({
      message: "Account already activated. Invite link has been used. Please use 'Forgot Password' if you need to reset your password.",
      code: "ALREADY_ACTIVATED"
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

  // Create new OTP (15 minutes)
  await prisma.passwordResetOtp.create({
    data: {
      userId: user.id,
      otpHash: hashOtp(otp),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  });

  sendMail({
    to: email,
    ...passwordResetOtpTemplate({
      name: user.name,
      otp,
    }),
  })
    .then(() => console.log("✅ OTP email sent"))
    .catch((err) => console.error("❌ OTP email failed:", err));

  return res.json({ message: "OTP sent to your email" });
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

  // Issue reset token (15 minutes)
  const resetToken = jwt.sign(
    {
      sub: otpRecord.userId,
      type: "password_reset",
    },
    process.env.PASSWORD_RESET_TOKEN_SECRET,
    { expiresIn: "15m" }
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
  } catch (err) {
    return res.status(401).json({
      message: "Invalid or expired reset token",
    });
  }

  if (payload.type !== "password_reset" && payload.type !== "invite") {
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

  // Fetch user to check current activation status
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { activatedAt: true, vendorId: true, id: true }
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Update password
  const updateData = {
    passwordHash: await bcrypt.hash(newPassword, 10),
  };

  // If user hasn't activated yet, mark as activated now
  if (!user.activatedAt) {
    updateData.activatedAt = new Date();
  }

  await prisma.user.update({
    where: { id: payload.sub },
    data: updateData,
  });

  // If activated for the first time, broadcast to vendor room
  if (!user.activatedAt) {
    try {
      const io = getIO();
      if (user.vendorId) {
        io.to(`vendor:${user.vendorId}`).emit("user:activated", {
          userId: user.id,
          activatedAt: updateData.activatedAt
        });
        console.log("📡 Emitted user:activated event for user", user.id);
      }

      // 📝 Log user activation
      const userDetails = await prisma.user.findUnique({ where: { id: payload.sub } });
      await logActivity({
        vendorId: user.vendorId,
        status: "success",
        event: "User Activated",
        type: "User",
        payload: {
          userId: user.id,
          userName: userDetails?.name,
          userEmail: userDetails?.email,
          activatedAt: updateData.activatedAt
        }
      });

    } catch (error) {
      console.warn("⚠️ Failed to emit user:activated event or log activity:", error.message);
    }
  }

  // Invalidate all refresh tokens for this user (force re-login everywhere)
  await prisma.refreshToken.deleteMany({
    where: { userId: payload.sub },
  });

  res.json({
    message: "Password reset successful",
    requiresRelogin: true // Signal to frontend to logout
  });
}
