"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { useTheme } from "@/context/theme-provider";
import { Moon, Sun, Lock } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/authContext";

export default function AdminSettings() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your admin preferences
        </p>
      </motion.div>

      <div className="grid gap-6 max-w-2xl">
        {/* Theme Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Appearance
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Theme</p>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred color scheme
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleTheme}
                  className="gap-2 bg-transparent"
                >
                  {theme === "dark" ? (
                    <>
                      <Sun className="w-4 h-4" />
                      Light
                    </>
                  ) : (
                    <>
                      <Moon className="w-4 h-4" />
                      Dark
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Account Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Account
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <p className="font-medium text-foreground">Name</p>
                  <p className="text-sm text-muted-foreground">{user?.name}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <p className="font-medium text-foreground">Email</p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Role</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {user?.role}
                  </p>
                </div>
              </div>

              <Link href="/change-password">
                <Button
                  variant="outline"
                  className="w-full gap-2 mt-4 bg-transparent"
                >
                  <Lock className="w-4 h-4" />
                  Change Password
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
