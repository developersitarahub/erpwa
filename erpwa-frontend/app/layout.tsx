import type React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/context/theme-provider";
import { AuthProvider } from "@/context/authContext";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WhatsApp Sales Dashboard",
  description:
    "Professional sales and support management dashboard for WhatsApp Business",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>

          {/* ✅ Global Toast Container (theme-aware) */}
          <ToastContainer
            position="top-center"
            autoClose={6000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            pauseOnHover
            draggable
            toastClassName="toast-base"
            progressClassName="toast-progress"
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
