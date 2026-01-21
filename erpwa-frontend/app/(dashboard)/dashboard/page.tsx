"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/card"
import { Users, MessageSquare, TrendingUp, UserCheck, FileText, Activity, AlertCircle, CheckCircle2, Phone, Target } from "lucide-react"
import { dashboardAPI } from "@/lib/dashboardApi"
import { toast } from "react-toastify"

interface KPICardProps {
  title: string
  value: string | number
  change?: string
  trend?: "up" | "down"
  icon: React.ReactNode
  description: string
  index: number
  color?: string
}

function KPICard({ title, value, change, trend, icon, description, index, color = "primary" }: KPICardProps) {
  // Map colors to actual Tailwind classes
  const borderColorClass = {
    "blue-500": "border-l-blue-500",
    "purple-500": "border-l-purple-500",
    "green-500": "border-l-green-500",
    "amber-500": "border-l-amber-500",
    "pink-500": "border-l-pink-500",
    "cyan-500": "border-l-cyan-500",
  }[color] || "border-l-primary"

  const iconColorClass = {
    "blue-500": "text-blue-500",
    "purple-500": "text-purple-500",
    "green-500": "text-green-500",
    "amber-500": "text-amber-500",
    "pink-500": "text-pink-500",
    "cyan-500": "text-cyan-500",
  }[color] || "text-primary"

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -5, boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}
    >
      <Card className={`relative overflow-hidden border-l-4 ${borderColorClass}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <motion.div whileHover={{ scale: 1.1 }} className={iconColorClass}>
            {icon}
          </motion.div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold text-foreground">{value}</div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{description}</p>
            {change && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`text-xs font-medium ${trend === "up" ? "text-green-600" : "text-red-600"}`}
              >
                {trend === "up" ? "↑" : "↓"} {change}
              </motion.span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function TeamActivity({
  member,
  action,
  time,
  index,
}: {
  member: string
  action: string
  time: string
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ backgroundColor: "var(--muted)" }}
      className="px-6 py-4 border-b border-border last:border-b-0 cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{member}</p>
          <p className="text-xs text-muted-foreground truncate mt-1">{action}</p>
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0">{time}</span>
      </div>
    </motion.div>
  )
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [activities, setActivities] = useState<any[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      const response = await dashboardAPI.getStats()
      setStats(response.data.stats)
      setActivities(response.data.recentActivities || [])
    } catch (error: any) {
      console.error("Failed to fetch dashboard data:", error)
      toast.error("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground mt-4 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  const kpis = [
    {
      title: "Team Members",
      value: stats?.teamMembers || 0,
      icon: <Users className="w-5 h-5" />,
      description: "Active team members",
      color: "blue-500",
    },
    {
      title: "Total Leads",
      value: stats?.totalLeads?.toLocaleString() || "0",
      icon: <UserCheck className="w-5 h-5" />,
      description: "All leads in system",
      color: "purple-500",
    },
    {
      title: "Conversion Rate",
      value: stats?.conversionRate || "0%",
      icon: <TrendingUp className="w-5 h-5" />,
      description: "Lead to customer",
      color: "green-500",
    },
    {
      title: "Templates",
      value: stats?.templates || 0,
      icon: <FileText className="w-5 h-5" />,
      description: "Message templates",
      color: "amber-500",
    },
    {
      title: "Campaigns",
      value: stats?.campaigns || 0,
      icon: <MessageSquare className="w-5 h-5" />,
      description: "Marketing campaigns",
      color: "pink-500",
    },
    {
      title: "Active Leads",
      value: (stats?.statusBreakdown?.new || 0) + (stats?.statusBreakdown?.contacted || 0),
      icon: <Activity className="w-5 h-5" />,
      description: "New + Contacted",
      color: "cyan-500",
    },
  ]

  // Status config with icons and colors
  const statusConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
    new: {
      icon: <AlertCircle className="w-8 h-8" />,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10 border-blue-500/30",
      label: "New"
    },
    contacted: {
      icon: <Phone className="w-8 h-8" />,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/10 border-amber-500/30",
      label: "Contacted"
    },
    qualified: {
      icon: <Target className="w-8 h-8" />,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-500/10 border-purple-500/30",
      label: "Qualified"
    },
    converted: {
      icon: <CheckCircle2 className="w-8 h-8" />,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-500/10 border-green-500/30",
      label: "Converted"
    },
    lost: {
      icon: <AlertCircle className="w-8 h-8" />,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-500/10 border-red-500/30",
      label: "Lost"
    },
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back! Here's an overview of your business
          </p>
        </motion.div>

        {/* KPI Cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {kpis.map((kpi, i) => (
            <KPICard key={i} {...kpi} index={i} />
          ))}
        </motion.div>

        {/* Lead Status Breakdown */}
        {stats?.statusBreakdown && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base md:text-lg font-semibold">Leads by Status</CardTitle>
                <CardDescription className="text-sm">Current distribution of your leads pipeline</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {Object.entries(stats.statusBreakdown).map(([status, count]: [string, any], index) => {
                    const config = statusConfig[status] || statusConfig.new
                    return (
                      <motion.div
                        key={status}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.6 + index * 0.1 }}
                        className={`relative p-6 rounded-xl border-2 ${config.bgColor} transition-all hover:shadow-lg hover:scale-105`}
                      >
                        <div className="flex flex-col items-center text-center space-y-3">
                          <div className={config.color}>
                            {config.icon}
                          </div>
                          <div>
                            <p className="text-3xl font-bold text-foreground">{count}</p>
                            <p className="text-sm font-medium text-muted-foreground mt-1">{config.label}</p>
                          </div>
                        </div>
                        {/* Percentage if total > 0 */}
                        {stats.totalLeads > 0 && (
                          <div className="absolute top-2 right-2">
                            <span className="text-xs font-semibold text-muted-foreground">
                              {Math.round((count / stats.totalLeads) * 100)}%
                            </span>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>

                {/* Empty state if no leads */}
                {Object.keys(stats.statusBreakdown).length === 0 && (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No leads yet. Start by adding your first lead!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Recent Activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg font-semibold">Recent Activity</CardTitle>
              <CardDescription className="text-sm">Latest updates from your leads</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {activities.length > 0 ? (
                <div className="max-h-96 overflow-y-auto">
                  {activities.map((activity, i) => (
                    <TeamActivity key={i} {...activity} index={i} />
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No recent activity</p>
                  <p className="text-sm text-muted-foreground mt-2">Activity will appear here as you work with leads</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
