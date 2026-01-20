import prisma from "./src/prisma.js";

async function main() {
    try {
        console.log("Checking for pending users...");

        // Find users who are pending setup
        const pendingUsers = await prisma.user.findMany({
            where: {
                activatedAt: null
            },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true
            }
        });

        console.log(`Found ${pendingUsers.length} pending users.`);
        pendingUsers.forEach(u => console.log(`- ${u.name} (${u.email})`));

        if (pendingUsers.length > 0) {
            console.log("\nUpdating users to activated status...");

            // Update them to be activated
            // We set activatedAt to their creation date so it looks like they were always active,
            // or we can set to now. Setting to NOW is safer for "activation".
            // Let's use NOW to be consistent with "activation happened just now".

            const result = await prisma.user.updateMany({
                where: {
                    activatedAt: null
                },
                data: {
                    activatedAt: new Date()
                }
            });

            console.log(`✅ Successfully updated ${result.count} users.`);
            console.log("They should now appear as 'Activated' / 'Online' (if logged in) on the dashboard.");
        } else {
            console.log("No pending users found to update.");
        }

    } catch (error) {
        console.error("❌ Error updating users:", error);
    } finally {
        // We don't need to explicitly disconnect as the script will exit, 
        // but it's good practice or we can let the pool drain.
        // The pool in src/prisma.js might keep it open.
        // We can just exit the process.
        process.exit(0);
    }
}

main();
