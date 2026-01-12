export function requireRoles(allowedRoles = []) {
  return (req, res, next) => {
    // Must be authenticated
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Role check
    console.log(`🔐 Role Check - User Role: "${req.user.role}" | Allowed Roles:`, allowedRoles);

    if (!allowedRoles.includes(req.user.role)) {
      console.log(`❌ Permission Denied - Role "${req.user.role}" not in allowed roles:`, allowedRoles);
      return res.status(403).json({
        message: "You do not have permission to perform this action",
      });
    }

    console.log(`✅ Permission Granted - Role "${req.user.role}" is allowed`);

    // Vendor context check (for vendor-scoped actions)
    if (!req.user.vendorId) {
      return res.status(400).json({
        message: "Vendor not initialized for this account",
      });
    }

    next();
  };
}
