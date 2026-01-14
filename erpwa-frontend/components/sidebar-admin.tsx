"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/authContext";
import {
  LayoutDashboard,
  MessageSquare,
  FileText,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Database,
  Folder,
  Image,
  Megaphone,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/context/sidebar-provider";
import { useEffect, useState } from "react";

/* ✅ Menu config outside component */
const menuItems = [
  { href: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/inbox", icon: MessageSquare, label: "Inbox" },
  { href: "/admin/templates", icon: FileText, label: "Templates" },
  { href: "/admin/campaigns", icon: Megaphone, label: "Campaigns" },
  { href: "/admin/leads", icon: Database, label: "Leads" },
  { href: "/admin/categories", icon: Folder, label: "Categories" },
  { href: "/admin/gallery", icon: Image, label: "Gallery" },
  { href: "/admin/manage-team", icon: Users, label: "Manage Team" },
  { href: "/admin/setup", icon: Plug, label: "Setup" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export function SidebarAdmin() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { logout } = useAuth();

  const [isMobile, setIsMobile] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  /* ✅ Detect mobile safely */
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const renderMenuItems = (collapsed = false) =>
    menuItems.map((item) => {
      const Icon = item.icon;
      const isActive = pathname.startsWith(item.href);

      return (
        <div key={item.href} className="group relative">
          <Link
            href={item.href}
            onClick={() => {
              if (isMobile) setIsMobileOpen(false); // ✅ close only on user action
            }}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? item.label : undefined}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>

          {/* Tooltip when collapsed */}
          {collapsed && (
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              <div className="bg-sidebar-foreground text-sidebar px-2 py-1 rounded text-xs shadow-lg whitespace-nowrap">
                {item.label}
              </div>
            </div>
          )}
        </div>
      );
    });

  /* ================= MOBILE ================= */
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setIsMobileOpen((v) => !v)}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-sidebar text-sidebar-foreground md:hidden"
        >
          {isMobileOpen ? <X /> : <Menu />}
        </button>

        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        <aside
          className={cn(
            "fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar border-r border-sidebar-border transition-transform duration-300",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center gap-2 px-4 h-16 border-b border-sidebar-border">
            <MessageSquare className="w-6 h-6 text-primary" />
            <span className="font-bold text-sidebar-foreground">WhatsApp</span>
          </div>

          <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
            {renderMenuItems(false)}
          </nav>

          <div className="border-t border-sidebar-border p-3">
            <button
              onClick={logout}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-sidebar-accent/50 w-full"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </aside>
      </>
    );
  }

  /* ================= DESKTOP ================= */
  return (
    <aside
      className={cn(
        "hidden md:flex fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border flex-col transition-all duration-300",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-primary" />
          {!isCollapsed && (
            <span className="font-bold text-sidebar-foreground">WhatsApp</span>
          )}
        </div>

        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-sidebar-accent"
        >
          <ChevronRight
            className={cn(
              "w-4 h-4 transition-transform",
              isCollapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
        {renderMenuItems(isCollapsed)}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={logout}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-sidebar-accent/50 w-full",
            isCollapsed && "justify-center px-0"
          )}
        >
          <LogOut className="w-5 h-5" />
          {!isCollapsed && "Logout"}
        </button>
      </div>
    </aside>
  );
}

export default SidebarAdmin;
