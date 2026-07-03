"use client"
import { } from "react"
import { Bell, Plus, Settings, LogOut, User, Smartphone, Package, ShoppingCart, TrendingUp, Menu } from "lucide-react"
import { useRouter } from "next/navigation"
import { Breadcrumbs } from "./breadcrumbs"
import { useApp } from "@/context/app-context"
import { useAuth } from "@/context/auth-context"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

export function Header() {
  const { notifications, unreadCount, markAllRead, toggleMobileSidebar } = useApp()
  const { user, logout } = useAuth()
  const initials = user?.name ? user.name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() : "?"
  const router = useRouter()

  return (
    <>
      {/* Sticky header - stays at top of flex column */}
      <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center px-3 md:px-6 gap-2 md:gap-4 shrink-0 shadow-sm">
        {/* Hamburger — mobile only */}
        <button
          onClick={toggleMobileSidebar}
          className="md:hidden w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors shrink-0"
        >
          <Menu className="w-4 h-4 text-slate-600" />
        </button>

        {/* Breadcrumbs */}
        <div className="flex-1 min-w-0 truncate max-w-[60vw] sm:max-w-none">
          <Breadcrumbs />
        </div>

        {/* Quick Add */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" className="rounded-xl w-9 h-9 shadow-sm">
              <Plus className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs text-slate-500 font-semibold">Quick Add</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/sales/new")} className="gap-2.5 cursor-pointer py-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <ShoppingCart className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="font-medium text-sm">New Sale</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/purchases/new")} className="gap-2.5 cursor-pointer py-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="font-medium text-sm">New Purchase</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/products/mobiles")} className="gap-2.5 cursor-pointer py-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="font-medium text-sm">Add Mobile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/products/accessories")} className="gap-2.5 cursor-pointer py-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Package className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="font-medium text-sm">Add Accessory</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications Bell */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-all">
              <Bell className="w-4 h-4 text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold px-1 border-2 border-white">
                  {unreadCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-80">
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm font-semibold text-slate-900">Notifications</span>
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                Mark all read
              </button>
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-72 overflow-y-auto">
              {notifications.map(n => (
                <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 py-3 px-3 cursor-default">
                  <div className="flex items-center gap-2 w-full">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${n.read ? "bg-transparent" : "bg-blue-500"}`} />
                    <span className="font-semibold text-xs text-slate-900">{n.title}</span>
                    <span className="ml-auto text-[10px] text-slate-400 shrink-0">{n.time}</span>
                  </div>
                  <p className="text-xs text-slate-500 pl-4 leading-relaxed">{n.message}</p>
                </DropdownMenuItem>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar + menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-slate-50 transition-colors">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-left hidden lg:block">
                <p className="text-xs font-semibold text-slate-800 leading-tight">{user?.name || "User"}</p>
                <p className="text-[10px] text-slate-400 leading-tight capitalize">{user?.role || "Staff"}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="text-sm font-semibold">{user?.name || "User"}</p>
              <p className="text-xs text-slate-400 font-normal">{user?.email || ""}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer"><User className="w-4 h-4" /> Profile</DropdownMenuItem>
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push("/settings")}><Settings className="w-4 h-4" /> Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-red-600 cursor-pointer" onClick={() => logout()}><LogOut className="w-4 h-4" /> Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

    </>
  )
}
