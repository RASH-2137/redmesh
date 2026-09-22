"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { IdentityAvatar } from "@/components/identity-avatar";
import { Shield, Lock, UserCheck, Key, ShieldAlert, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Evaluation personas for portfolio demonstration
const DEMO_ACCOUNTS = [
  { username: "alex", label: "Alex", role: "Commander", clearance: "TOP_SECRET" },
  { username: "rahul", label: "Rahul", role: "Mechanic", clearance: "SECRET" },
  { username: "john", label: "John", role: "Contractor", clearance: "CONFIDENTIAL" },
  { username: "admin", label: "Admin", role: "Administrator", clearance: "TOP_SECRET" },
];

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showDemoSelector, setShowDemoSelector] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch {
      // Error handled by AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectDemo = async (u: string) => {
    setUsername(u);
    clearError();
    try {
      const res = await fetch("/api/backend/auth/demo-credentials");
      if (res.ok) {
        const data = await res.json();
        if (data?.password) {
          setPassword(data.password);
          return;
        }
      }
    } catch {
      // Fallback if backend demo-credentials endpoint is unreachable
    }
    setPassword(process.env.NEXT_PUBLIC_DEMO_PASSWORD || "password123");
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-500/20 to-cyan-500/20 border border-cyan-500/30 p-1 shadow-2xl shadow-cyan-500/10">
            <div className="w-full h-full bg-surface rounded-xl flex items-center justify-center">
              <Shield className="w-7 h-7 text-cyan-400" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-mono">
              REDmesh
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Resource Access & Provisioning Platform
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-surface-border shadow-2xl bg-surface/90">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-base text-slate-200 flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              Sign In
            </CardTitle>
            <CardDescription>
              Enter your credentials to access the platform.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {error && (
              <Alert variant="danger" title="Authentication Error">
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Username"
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  clearError();
                }}
                placeholder="Enter username"
                required
              />

              <Input
                label="Password"
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                placeholder="••••••••••••"
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full font-sans tracking-wide"
                isLoading={submitting || isLoading}
              >
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Collapsible Evaluation Personas Selector */}
        <div className="rounded-2xl border border-surface-border bg-surface/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowDemoSelector(!showDemoSelector)}
            className="w-full flex items-center justify-between p-3 text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            <span className="flex items-center gap-2">
              <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Evaluation Personas (Demo Mode)</span>
            </span>
            <ChevronDown
              className={cn("w-4 h-4 text-slate-500 transition-transform duration-200", showDemoSelector && "rotate-180")}
            />
          </button>

          {showDemoSelector && (
            <div className="p-3.5 pt-0 space-y-3 border-t border-surface-border/50">
              <p className="text-[11px] text-slate-500 font-sans pt-2">
                Select an evaluation role to populate credentials for testing access workflows:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((account) => {
                  const isSelected = username === account.username;
                  return (
                    <button
                      key={account.username}
                      type="button"
                      onClick={() => handleSelectDemo(account.username)}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-surface-elevated border-cyan-500/50 shadow-sm"
                          : "bg-surface/60 border-surface-border hover:border-slate-600"
                      }`}
                    >
                      <IdentityAvatar seed={account.username} size="xs" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-200 font-sans">
                          {account.label}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {account.role} · {account.clearance}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
