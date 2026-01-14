"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card } from "@/components/card"
import { Button } from "@/components/button"
import { Badge } from "@/components/badge"
import { Input } from "@/components/input"
import { Select } from "@/components/select"
import { Plus, Edit2, Trash2, CheckCircle2, Circle, X, Loader2, Ban } from "lucide-react"
import { useAuth } from "@/context/authContext"
import { usersAPI, User } from "@/lib/usersApi"
import { toast } from "react-toastify"

import { getSocket } from "@/lib/socket"

export default function ManageTeam() {
  const { user } = useAuth()
  const [team, setTeam] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "sales"
  })

  useEffect(() => {
    fetchUsers()
  }, [])



  const fetchUsers = async () => {
    try {
      const res = await usersAPI.list()
      if (res.data) {
        setTeam(res.data)
      }
    } catch (error) {
      console.error("Failed to fetch users", error)
      toast.error("Failed to load team members")
    } finally {
      setLoading(false)
    }
  }

  // 🔌 Real-time Presence Listener
  useEffect(() => {
    const socket = getSocket()

    const handlePresence = (data: { userId: string; isOnline: boolean }) => {
      // 🛡️ Self-Immunity: If the event says I am offline, but I am here, ignore it.
      // This prevents the "reload race condition" where the old socket disconnects
      // after the new one connects, briefly marking us offline.
      if (data.userId === user?.id && !data.isOnline) return

      setTeam(prevTeam =>
        prevTeam.map(user =>
          user.id === data.userId ? { ...user, isOnline: data.isOnline } : user
        )
      )
    }

    socket.on("user:presence", handlePresence)

    return () => {
      socket.off("user:presence", handlePresence)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleEditClick = (member: User) => {
    // Only allow owner to edit anyone's name
    if (user?.role !== "vendor_owner") {
      toast.error("Only the owner can edit user names")
      return
    }
    setFormData({
      name: member.name,
      email: member.email,
      role: member.role
    })
    setEditingId(member.id)
    setIsEditMode(true)
    setIsModalOpen(true)
  }

  const openAddModal = () => {
    setFormData({ name: "", email: "", role: "sales" })
    setEditingId(null)
    setIsEditMode(false)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // When editing, only allow name changes for owner
    if (isEditMode) {
      if (user?.role !== "vendor_owner") {
        toast.error("Only the owner can edit users")
        return
      }
      // Only update the name field
    } else {
      // simple email validation for new user
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(formData.email)) {
        toast.error("Please enter a valid email address")
        return
      }
    }

    setIsSubmitting(true)

    try {
      if (isEditMode && editingId) {
        // Only send name for update
        await usersAPI.update(editingId, { name: formData.name })
        toast.success("Name updated successfully")
      } else {
        // Create user without password - backend will send invite
        await usersAPI.create(formData)
        toast.success("Invite sent to team member")
      }
      setIsModalOpen(false)
      fetchUsers()
    } catch (error: any) {
      console.error("Save user error", error)
      toast.error(error.response?.data?.message || "Failed to save user")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this team member?")) return

    try {
      await usersAPI.delete(id)
      toast.success("User removed")
      fetchUsers()
    } catch (error) {
      toast.error("Failed to delete user")
    }
  }



  const userRole = user?.role

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-8 space-y-6 md:space-y-8 bg-background">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Manage Team</h1>
          <p className="text-sm text-muted-foreground mt-2">View and manage sales team members</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-card border-border">
            <div className="p-4 md:p-6 border-b border-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-base md:text-lg font-semibold text-foreground">Team Members ({team.length})</h3>
                <Button size="sm" className="w-full sm:w-auto" onClick={openAddModal}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Member
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left py-3 px-4 md:px-6 font-semibold text-foreground text-sm">Name</th>
                    <th className="text-left py-3 px-4 md:px-6 font-semibold text-foreground text-sm">Email</th>
                    <th className="text-left py-3 px-4 md:px-6 font-semibold text-foreground text-sm">Role</th>
                    <th className="text-left py-3 px-4 md:px-6 font-semibold text-foreground text-sm">Created At</th>
                    <th className="text-left py-3 px-4 md:px-6 font-semibold text-foreground text-sm">Status</th>
                    <th className="text-left py-3 px-4 md:px-6 font-semibold text-foreground text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">Loading team...</td>
                    </tr>
                  ) : team.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">No team members found. Add one to get started.</td>
                    </tr>
                  ) : (
                    team.map((member, index) => (
                      <motion.tr
                        key={member.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-border hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-4 px-4 md:px-6 text-foreground font-medium">{member.name}</td>
                        <td className="py-4 px-4 md:px-6 text-muted-foreground text-sm">{member.email}</td>
                        <td className="py-4 px-4 md:px-6">
                          <Badge variant="outline" className="capitalize">{member.role.replace('_', ' ')}</Badge>
                        </td>
                        <td className="py-4 px-4 md:px-6 text-muted-foreground text-sm">
                          {new Date(member.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-4 md:px-6">
                          {/* Status Indicator - Not Clickable */}
                          <div className="flex items-center gap-2">
                            {member.status === "inactive" ? (
                              <>
                                <Ban className="w-4 h-4 text-destructive" />
                                <span className="text-destructive text-sm font-medium">Banned</span>
                              </>
                            ) : (member.isOnline || (user && member.id === user.id)) ? (
                              <>
                                <span className="relative flex h-3 w-3 mr-1">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                </span>
                                <span className="text-green-600 font-medium text-sm">Online</span>
                              </>
                            ) : (
                              <>
                                <Circle className="w-3 h-3 text-muted-foreground" />
                                <span className="text-muted-foreground text-sm">Offline</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 md:px-6 flex gap-2">
                          {/* Owner can edit anyone's name */}
                          {userRole === "vendor_owner" && (
                            <button
                              onClick={() => handleEditClick(member)}
                              className="p-2 hover:bg-muted rounded-lg transition-colors text-primary"
                              title="Edit Name"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}

                          {/* Delete button - only for non-owners */}
                          {member.role !== "vendor_owner" && !(userRole === "vendor_admin" && member.role === "vendor_admin") && (
                            <button
                              onClick={() => handleDelete(member.id)}
                              className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-destructive"
                              title="Remove User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card w-full max-w-md rounded-xl shadow-lg border border-border mt-16 md:mt-0"
          >
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">{isEditMode ? "Edit Name" : "Add Team Member"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Full Name</label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. John Doe"
                  required
                />
              </div>

              {!isEditMode && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Email Address</label>
                    <Input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="john@company.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Role</label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      disabled={userRole === "vendor_admin"}
                      className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-100"
                    >
                      <option value="sales">Sales Executive</option>
                      {/* Only Owners can create Admins */}
                      {userRole === "vendor_owner" && (
                        <option value="vendor_admin">Admin</option>
                      )}
                    </select>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      📧 An invitation email will be sent with instructions to set up their password.
                    </p>
                  </div>
                </>
              )}

              <div className="pt-4 flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isEditMode ? "Updating..." : "Sending Invite..."}
                    </>
                  ) : (
                    isEditMode ? "Update Name" : "Send Invite"
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  )
}
