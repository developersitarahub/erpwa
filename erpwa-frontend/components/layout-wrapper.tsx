"use client"

import type React from "react"

import { Sidebar } from "./sidebar"

interface LayoutWrapperProps {
  children: React.ReactNode
  userRole?: "vendor_owner" | "vendor_admin" | "sales"
}

export function LayoutWrapper({ children, userRole = "sales" }: LayoutWrapperProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar userRole={userRole} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
