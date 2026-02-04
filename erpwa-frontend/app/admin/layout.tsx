"use client"

import type React from "react"
import { SidebarAdmin } from "@/components/sidebar-admin"
import { HeaderAdmin } from "@/components/header-admin"
import { SidebarProvider } from "@/context/sidebar-provider"
import { useSidebar } from "@/context/sidebar-provider"
import { useAuth } from "@/context/authContext"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar()
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen bg-background">
      <SidebarAdmin />
      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 md:ml-20 ${!isCollapsed ? "md:ml-64" : ""
          }`}
      >
        <HeaderAdmin />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
    </div>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  )
}
