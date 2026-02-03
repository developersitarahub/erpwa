"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Mail, Lock, Shield } from "lucide-react"
import { useAuth } from "@/context/authContext"
import { Logo } from "@/components/logo"

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setLoading(true)

    try {
      await login(email, password)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl bg-card text-foreground shadow-xl p-8 border border-border">

        {/* Header */}
        <div className="mb-8 w-full">
          <div className="flex flex-col items-center w-full">
            <div className="flex justify-end w-full pr-4 mb-4">
              <Logo className="w-64 h-auto max-h-32" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Sign in to continue
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                disabled={loading}
                className="w-full rounded-md border border-border
                           bg-input px-10 py-2 text-foreground
                           focus:outline-none focus:ring-2 focus:ring-ring
                           disabled:opacity-60"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="***********"
                required
                disabled={loading}
                className="w-full rounded-md border border-border
                           bg-input px-10 py-2 text-foreground
                           focus:outline-none focus:ring-2 focus:ring-ring
                           disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                disabled={loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div className="flex justify-end">
            <button
              type="button"
              disabled={loading}
              onClick={() => router.push("/forgot-password")}
              className="text-sm text-primary hover:underline disabled:opacity-60"
            >
              Forgot password?
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary hover:bg-primary/90
                       text-primary-foreground py-2 font-medium
                       transition disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} GPS erp
        </p>
        <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground/80">
          <a href="/privacy-policy" className="flex items-center gap-1.5 hover:text-primary transition-colors">
            <Lock className="w-3 h-3" />
            Privacy Policy
          </a>
          <div className="h-3 w-px bg-border/60" />
          <a href="/terms-n-condition" className="flex items-center gap-1.5 hover:text-primary transition-colors">
            <Shield className="w-3 h-3" />
            Terms & Conditions
          </a>
        </div>
      </div>
    </div>
  )
}
