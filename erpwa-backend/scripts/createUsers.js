import "dotenv/config";
import prisma from "../src/prisma.js";
import { hashPassword } from "../src/utils/password.js";

async function main() {
  const passwordHash = await hashPassword("Password@123");

  // 1️⃣ Create Vendor FIRST
  const vendor = await prisma.vendor.create({
    data: {
      name: "Sitarahub",
    },
  });

  console.log("✅ Vendor created:", vendor.id);

  // 2️⃣ Create users linked to vendor
  const users = [
    {
      email: "sohamsawalakhe@gmail.com",
      name: "Soham Sawalakhe",
      role: "vendor_admin",
    },
    {
      email: "gauravrai3133@gmail.com",
      name: "Gaurav Rai",
      role: "vendor_admin",
    },
    {
      email: "pradhanpratik219@gmail.com",
      name: "Pratik Pradhan",
      role: "vendor_admin",
    },
    {
      email: "developers@sitarahub.com",
      name: "Sitarahub Developers",
      role: "vendor_owner",
    },
    {
      email: "developer.sitarahub@gmail.com",
      name: "Developers",
      role: "sales",
    },
  ];

  for (const user of users) {
    await prisma.user.create({
      data: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
        vendorId: vendor.id, // 🔑 THIS IS THE FIX
      },
    });

    console.log(`✅ Created ${user.role}: ${user.email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
