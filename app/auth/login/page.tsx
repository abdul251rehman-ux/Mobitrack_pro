"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Smartphone, Eye, EyeOff, LogIn, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Tab = "signin" | "signup"

export default function LoginPage() {
  const router = useRouter()
  const { login, signUp } = useAuth()

  const [activeTab, setActiveTab] = useState<Tab>("signin")

  // Sign-in state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Sign-up state
  const [suShopName, setSuShopName] = useState("")
  const [suOwnerName, setSuOwnerName] = useState("")
  const [suEmail, setSuEmail] = useState("")
  const [suPhone, setSuPhone] = useState("")
  const [suPassword, setSuPassword] = useState("")
  const [suConfirmPassword, setSuConfirmPassword] = useState("")
  const [showSuPassword, setShowSuPassword] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()

    if (!email || !password) {
      toast.error("Please enter both email and password")
      return
    }

    setIsLoading(true)

    try {
      const success = await login(email, password)

      if (success) {
        toast.success("Welcome back!", { description: "You have been logged in successfully." })
        router.push("/")
      } else {
        toast.error("Login failed", { description: "Invalid email or password, or account is inactive." })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred"
      toast.error("Login failed", { description: msg })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()

    if (!suShopName || !suOwnerName || !suEmail || !suPassword || !suConfirmPassword) {
      toast.error("Please fill in all required fields")
      return
    }

    if (suPassword !== suConfirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (suPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setIsSigningUp(true)

    try {
      const result = await signUp(suEmail, suPassword, {
        name: suOwnerName,
        phone: suPhone,
        shopName: suShopName,
      })

      if (result.success) {
        toast.success("Account created!", {
          description: "Check your email to verify your account, then sign in.",
          duration: 6000,
        })
        // Reset sign-up form and switch to sign-in tab
        setSuShopName("")
        setSuOwnerName("")
        setSuEmail("")
        setSuPhone("")
        setSuPassword("")
        setSuConfirmPassword("")
        setActiveTab("signin")
      } else {
        toast.error("Sign up failed", { description: result.error || "Please try again." })
      }
    } catch {
      toast.error("Sign up failed", { description: "An unexpected error occurred. Please try again." })
    } finally {
      setIsSigningUp(false)
    }
  }

  function handleForgotPassword() {
    toast.info("Password reset", {
      description: "Password reset functionality coming soon. Contact support for help.",
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 px-4 sm:px-6 py-4">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDJ2LTJoMzR6bTAtMzBWMkgydjJoMzR6TTIgMjBoMzR2Mkgydi0yeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

      <Card className="relative z-10 w-full max-w-md mx-auto shadow-2xl border-slate-700/50 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4 pb-2">
          {/* Logo */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 shadow-lg shadow-blue-600/30">
            <Smartphone className="h-8 w-8 text-white" />
          </div>

          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
              MobiTrack Pro
            </CardTitle>
            <CardDescription className="text-slate-500 mt-1">
              {activeTab === "signin"
                ? "Sign in to your account to continue"
                : "Create a new account for your shop"}
            </CardDescription>
          </div>

          {/* Tabs */}
          <div className="flex w-full rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("signin")}
              className={cn(
                "flex-1 rounded-md py-2 text-sm font-medium transition-all",
                activeTab === "signin"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("signup")}
              className={cn(
                "flex-1 rounded-md py-2 text-sm font-medium transition-all",
                activeTab === "signup"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Create Account
            </button>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {/* ── Sign In Form ── */}
          {activeTab === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="h-10"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-700">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md",
                      "text-slate-400 hover:text-slate-600 transition-colors"
                    )}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Login button */}
              <Button type="submit" className="w-full h-10" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    Sign In
                  </span>
                )}
              </Button>

              <p className="text-center text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => setActiveTab("signup")}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Create one
                </button>
              </p>
            </form>
          )}

          {/* ── Sign Up Form ── */}
          {activeTab === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-4">
              {/* Shop Name */}
              <div className="space-y-2">
                <Label htmlFor="su-shop" className="text-slate-700">
                  Shop Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="su-shop"
                  type="text"
                  placeholder="e.g. Ali Mobile Zone"
                  value={suShopName}
                  onChange={(e) => setSuShopName(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Owner Name */}
              <div className="space-y-2">
                <Label htmlFor="su-name" className="text-slate-700">
                  Owner Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="su-name"
                  type="text"
                  placeholder="Your full name"
                  value={suOwnerName}
                  onChange={(e) => setSuOwnerName(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="su-email" className="text-slate-700">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="su-email"
                  type="email"
                  placeholder="you@example.com"
                  value={suEmail}
                  onChange={(e) => setSuEmail(e.target.value)}
                  autoComplete="email"
                  className="h-10"
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="su-phone" className="text-slate-700">
                  Phone
                </Label>
                <Input
                  id="su-phone"
                  type="tel"
                  placeholder="03XX-XXXXXXX"
                  value={suPhone}
                  onChange={(e) => setSuPhone(e.target.value)}
                  className="h-10"
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="su-password" className="text-slate-700">
                  Password <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="su-password"
                    type={showSuPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={suPassword}
                    onChange={(e) => setSuPassword(e.target.value)}
                    autoComplete="new-password"
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSuPassword(!showSuPassword)}
                    className={cn(
                      "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md",
                      "text-slate-400 hover:text-slate-600 transition-colors"
                    )}
                    tabIndex={-1}
                    aria-label={showSuPassword ? "Hide password" : "Show password"}
                  >
                    {showSuPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="su-confirm" className="text-slate-700">
                  Confirm Password <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="su-confirm"
                  type="password"
                  placeholder="Re-enter your password"
                  value={suConfirmPassword}
                  onChange={(e) => setSuConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-10"
                />
              </div>

              {/* Sign Up button */}
              <Button type="submit" className="w-full h-10" disabled={isSigningUp}>
                {isSigningUp ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Creating account...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Create Account
                  </span>
                )}
              </Button>

              <p className="text-center text-sm text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setActiveTab("signin")}
                  className="text-blue-600 hover:underline font-medium"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
