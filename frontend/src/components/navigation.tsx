"use client";

import React, { useState } from "react";
import Link from "next/navigation";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { IdentityAvatar } from "./identity-avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Shield,
  Layers,
  FileCheck,
  KeyRound,
  ShieldCheck,
  UserCheck,
  LogOut,
  Menu,
  X,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Shield },
  { href: "/assets", label: "Resources", icon: Layers },
  { href: "/requests", label: "Access Requests", icon: FileCheck },
  { href: "/provisioning", label: "Assignments", icon: KeyRound },
  { href: "/audit", label: "Audit", icon: ShieldCheck },
  { href: "/profile", label: "Identity & Security", icon: UserCheck },
];

export function Navigation() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Do not render nav on login page
  if (pathname === "/login") return null;

  const isAuditorOrAdmin = user?.roles.some((r) => r === "AUDITOR" || r === "ADMIN");
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.href === "/audit") {
      return isAuditorOrAdmin;
    }
    return true;
  });

  return (
    <header className="sticky top-0 z-40 w-full border-b border-surface-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <a href="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-cyan-500 flex items-center justify-center p-0.5 shadow-lg shadow-cyan-500/10">
                <div className="w-full h-full bg-surface rounded-[6px] flex items-center justify-center">
                  <Shield className="w-4 h-4 text-cyan-400 group-hover:text-red-400 transition-colors" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-wider text-white font-mono">
                  REDmesh
                </span>
                <span className="text-[10px] text-slate-400 tracking-wider uppercase font-mono">
                  Resource Access
                </span>
              </div>
            </a>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-surface-border">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 font-sans",
                      isActive
                        ? "bg-surface-elevated text-cyan-400 border border-surface-border shadow-inner"
                        : "text-slate-400 hover:text-slate-200 hover:bg-surface-elevated/50"
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", isActive ? "text-cyan-400" : "text-slate-400")} />
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>

          {/* User Profile & Actions */}
          <div className="hidden sm:flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3 pl-4 border-l border-surface-border">
                <IdentityAvatar user={user} size="sm" />
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white tracking-tight font-sans">
                      {user.displayName}
                    </span>
                    <Badge clearance={user.clearance} className="scale-90 origin-left py-0 px-1.5" />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <span>{user.roles[0] || "USER"}</span>
                    <span>•</span>
                    <span className="text-cyan-400">{user.unitCode}</span>
                  </div>
                </div>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              title="Sign out"
              className="text-slate-400 hover:text-red-400 hover:bg-red-950/30"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="flex sm:hidden">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="sm:hidden border-b border-surface-border bg-surface px-4 py-4 space-y-3">
          {user && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-elevated border border-surface-border mb-3">
              <IdentityAvatar user={user} size="md" />
              <div>
                <div className="font-semibold text-white text-sm">{user.displayName}</div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge clearance={user.clearance} />
                  <span className="text-xs font-mono text-cyan-400">{user.unitCode}</span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-surface-elevated text-cyan-400 border border-surface-border"
                      : "text-slate-300 hover:bg-surface-elevated/50"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </a>
              );
            })}
          </div>

          <div className="pt-2 border-t border-surface-border">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setMobileOpen(false);
                logout();
              }}
              className="w-full justify-center"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
