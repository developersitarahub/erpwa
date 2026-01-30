import prisma from "../prisma.js";
import { hashPassword } from "../utils/password.js";
import { sendMail } from "../utils/mailer.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { logActivity } from "../services/activityLog.service.js";

// Force restart for prisma client update

// List all users for the current vendor
export const listUsers = async (req, res) => {
    try {
        const whereClause = {
            vendorId: req.user.vendorId,
        };

        if (req.query.role) {
            whereClause.role = req.query.role;
        }

        const users = await prisma.user.findMany({
            where: whereClause,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                isOnline: true,
                lastLoginAt: true,
                activatedAt: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        });

        res.json(users);
    } catch (error) {
        console.error("List users error:", error);
        res.status(500).json({ message: "Failed to list users" });
    }
};

// Create a new user (sales person) - sends invite WITHOUT OTP
export const createUser = async (req, res) => {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
        return res.status(400).json({ message: "Name, email, and role are required" });
    }

    try {
        // Check if email exists
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ message: "Email already in use" });
        }

        // Generate a random temporary password (user won't use this directly)
        const tempPassword = crypto.randomBytes(32).toString("hex");
        const passwordHash = await hashPassword(tempPassword);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                role,
                passwordHash,
                vendorId: req.user.vendorId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                isOnline: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        // Generate invite token for the link (1 hour validity)
        const inviteToken = jwt.sign(
            { sub: user.id, type: "invite", email: email },
            process.env.PASSWORD_RESET_TOKEN_SECRET,
            { expiresIn: "1h" }
        );

        const inviteLink = `${process.env.FRONTEND_URL}/create-password?token=${inviteToken}`;

        // Send invite email WITHOUT OTP (user will request OTP from the page)
        try {
            const emailResult = await sendMail({
                to: email,
                subject: "Welcome to WhatsApp ERP - Set Up Your Account",
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #2563EB;">Welcome to the Team, ${name}!</h2>
                        <p>Your account has been created successfully.</p>
                        <p>To activate your account and set your password, click the button below:</p>

                        <div style="margin: 30px 0; text-align: center;">
                            <a href="${inviteLink}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Set Up Your Password</a>
                        </div>

                        <p style="font-size: 14px; color: #666;">Or copy this link to your browser:</p>
                        <p style="font-size: 14px; color: #666; word-break: break-all;">${inviteLink}</p>
                        
                        <p style="margin-top: 30px; padding-top: 20px; font-size: 13px; color: #666;">
                            <strong>Next steps:</strong><br>
                            1. Click the link above<br>
                            2. Request a verification code<br>
                            3. Enter the code from your email<br>
                            4. Set your password
                        </p>
                        
                        <p style="border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #999;">
                            <strong style="color: #dc2626;">⚠️ This link is valid for 1 hour and can be used only once.</strong>
                        </p>
                    </div>
                `
            });
            console.log("✅ Invite email sent successfully");
        } catch (mailError) {
            console.error("❌ FAILED to send invite email");
            console.error("❌ Error:", mailError.message);

            // Roll back user creation if email fails
            await prisma.user.delete({ where: { id: user.id } });
            return res.status(500).json({
                message: "Failed to send invite email. Please try again.",
                errorDetails: mailError.message
            });
        }


        // 📝 Log user creation activity
        await logActivity({
            vendorId: req.user.vendorId,
            status: "success",
            event: "User Created (Pending)",
            type: "User",
            payload: {
                userId: user.id,
                userName: user.name,
                userEmail: user.email,
                userRole: user.role,
                createdBy: req.user.name
            }
        });

        res.status(201).json(user);
    } catch (error) {
        console.error("Create user error:", error);
        res.status(500).json({ message: "Failed to create user" });
    }
};

// Update user details
export const updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, role, password, status } = req.body;

    try {
        const userToUpdate = await prisma.user.findUnique({
            where: { id, vendorId: req.user.vendorId },
        });

        if (!userToUpdate) {
            return res.status(404).json({ message: "User not found" });
        }

        // Prevent unauthorized editing of Vendor Owner
        if (userToUpdate.role === "vendor_owner") {
            if (req.user.id !== userToUpdate.id) {
                return res.status(403).json({ message: "Only the Vendor Owner can edit their own account" });
            }
            // Also prevent owner from changing their own role/status accidentally via this API if needed, 
            // though UI restricts it. Let's force role to stay vendor_owner for safety.
            if (role && role !== "vendor_owner") {
                return res.status(400).json({ message: "Vendor Owner cannot change their role" });
            }
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (role) updateData.role = role;
        if (status) {
            // updateData.status = status;
        }
        if (password) {
            updateData.passwordHash = await hashPassword(password);
        }

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                isOnline: true,
                lastLoginAt: true,
            },
        });

        res.json(user);

        // 📝 Log user update
        await logActivity({
            vendorId: req.user.vendorId,
            status: "success",
            event: "User Updated",
            type: "System",
            payload: {
                userId: user.id,
                userName: user.name,
                userEmail: user.email,
                updatedFields: Object.keys(updateData)
            }
        });
    } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ message: "Failed to update user" });
    }
};

// Delete user
export const deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        if (id === req.user.id) {
            return res.status(400).json({ message: "Cannot delete yourself" });
        }

        const userToDelete = await prisma.user.findUnique({
            where: { id, vendorId: req.user.vendorId },
        });

        if (!userToDelete) {
            return res.status(404).json({ message: "User not found" });
        }

        if (userToDelete.role === "vendor_owner") {
            return res.status(403).json({ message: "Cannot delete the Vendor Owner" });
        }

        // Restrict vendor_admin from deleting other admins
        if (req.user.role === "vendor_admin" && userToDelete.role === "vendor_admin") {
            return res.status(403).json({ message: "Admins cannot delete other Admins" });
        }

        await prisma.user.delete({
            where: { id },
        });

        res.json({ message: "User deleted successfully" });

        // 📝 Log user deletion
        await logActivity({
            vendorId: req.user.vendorId,
            status: "success",
            event: "User Deleted",
            type: "System",
            payload: {
                userId: id,
                userName: userToDelete.name,
                userEmail: userToDelete.email,
                deletedBy: req.user.name
            }
        });
    } catch (error) {
        // ...
        console.error("Delete user error:", error);
        res.status(500).json({ message: "Failed to delete user" });
    }
};
