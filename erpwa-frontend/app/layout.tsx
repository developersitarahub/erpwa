import type React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/context/theme-provider";
import { AuthProvider } from "@/context/authContext";
import { ToastContainer } from "react-toastify";
import { UploadProvider } from "@/context/GlobalUploadContext";
import { Toaster } from "sonner";
import "react-toastify/dist/ReactToastify.css";

import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "GPS erp",
  description:
    "Professional sales and support management dashboard",
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
          <AuthProvider>
            <UploadProvider>{children}</UploadProvider>
          </AuthProvider>

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

          {/* Sonner Toast for Flows */}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
