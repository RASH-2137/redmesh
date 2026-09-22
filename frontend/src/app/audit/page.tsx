"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { AuditVerification, AuditEvent } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatTimestamp, truncateHash } from "@/lib/utils";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  RefreshCw,
  Link,
  Activity,
  CheckCircle,
  XCircle,
  Hash,
  Clock,
  ShieldOff,
} from "lucide-react";

export default function AuditPage() {
  const { user } = useAuth();
  const [verification, setVerification] = useState<AuditVerification | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuditorOrAdmin = user?.roles.some((r) => r === "AUDITOR" || r === "ADMIN");

  const runVerification = async () => {
    setVerifying(true);
    setError(null);
    try {
      const res = await api.getAuditIntegrity();
      setVerification(res.verification);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(err?.message || "Failed to verify audit chain.");
      }
    } finally {
      setVerifying(false);
    }
  };

  const loadAuditData = async () => {
    setLoading(true);
    setForbidden(false);
    setError(null);

    try {
      const [verRes, eventsRes] = await Promise.all([
        api.getAuditIntegrity(),
        api.getAuditEvents().catch(() => ({ events: [] })),
      ]);
      setVerification(verRes.verification);
      setEvents(eventsRes.events);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(err?.message || "Failed to load audit ledger.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuditorOrAdmin) {
      loadAuditData();
    } else {
      setLoading(false);
      setForbidden(true);
    }
  }, [isAuditorOrAdmin]);

  if (!isAuditorOrAdmin || forbidden) {
    return (
      <div className="space-y-6">
        <div className="pb-4 border-b border-surface-border">
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5 font-sans">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
            Audit Log
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Review security and access activity across the platform.
          </p>
        </div>

        <Card className="border-surface-border bg-surface/90 text-center py-12">
          <CardContent className="space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-surface-elevated border border-surface-border flex items-center justify-center mx-auto text-slate-400">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white font-sans">Audit Access Restricted</h3>
              <p className="text-xs text-slate-400 font-sans leading-relaxed">
                Your current role does not have permission to view audit records. Access to the audit log requires the{" "}
                <span className="text-cyan-400 font-mono">AUDITOR</span> or{" "}
                <span className="text-cyan-400 font-mono">ADMIN</span> role.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-surface-elevated border border-surface-border text-center text-xs text-slate-400">
              Access to platform audit activity is strictly limited to authorized compliance personnel.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5 font-sans">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            Audit Log
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Review security and access activity. Tamper-evident cryptographic audit chain.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={runVerification}
          isLoading={verifying}
          className="bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1" />
          Verify Audit Chain
        </Button>
      </div>

      {error && (
        <Alert variant="danger" title="Audit System Error">
          {error}
        </Alert>
      )}

      {/* Verification Status Card */}
      {verification && (
        <Card
          className={`border-2 transition-all ${
            verification.valid
              ? "border-emerald-500/40 bg-emerald-950/10 shadow-lg shadow-emerald-500/5"
              : "border-red-500/50 bg-red-950/20 shadow-lg shadow-red-500/10"
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center p-2 shrink-0 border ${
                  verification.valid
                    ? "bg-emerald-950/80 border-emerald-500/40 text-emerald-400"
                    : "bg-red-950/80 border-red-500/40 text-red-400"
                }`}
              >
                {verification.valid ? <CheckCircle className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white font-sans">
                    {verification.valid
                      ? "Audit Integrity"
                      : "Integrity Verification Failed"}
                  </h3>
                  <Badge variant={verification.valid ? "success" : "danger"}>
                    {verification.valid ? "Audit integrity: Verified" : "Tampered"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-sans">
                  {verification.valid
                    ? "All sequential SHA-256 hash links and previous-hash pointers successfully verified."
                    : `Hash mismatch detected at chain position ${verification.firstInvalidPosition}: ${verification.reason}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-surface-border pt-3 md:pt-0 md:pl-6 text-xs font-mono">
              <div>
                <div className="text-slate-500">Verified Events</div>
                <div className="text-lg font-bold text-white">{verification.eventCount}</div>
              </div>
              <div>
                <div className="text-slate-500">Audit Mechanism</div>
                <div className="text-lg font-bold text-cyan-400">Sequential Chain</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Audit Event Stream */}
      <Card className="border-surface-border bg-surface/90 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Audit Activity
          </CardTitle>
          <CardDescription>
            Chronological access and authorization events recorded in the audit chain.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-slate-400 animate-pulse">
              Loading audit events...
            </div>
          ) : events.length === 0 ? (
            <div className="p-12 text-center text-xs font-mono text-slate-500">
              No audit events found in database ledger.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-surface-elevated text-slate-400 uppercase tracking-wider font-mono text-[10px] border-y border-surface-border">
                  <tr>
                    <th className="py-3 px-4">Pos</th>
                    <th className="py-3 px-4">Timestamp (UTC)</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Result</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Trace ID</th>
                    <th className="py-3 px-4 font-mono">Previous $\rightarrow$ Current Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border font-mono text-[11px]">
                  {events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-surface-elevated/40 transition-colors">
                      <td className="py-3 px-4 text-cyan-400 font-bold">#{ev.chainPosition}</td>
                      <td className="py-3 px-4 text-slate-400 font-sans text-xs">
                        {formatTimestamp(ev.occurredAt)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-surface-elevated border border-surface-border text-slate-200">
                          {ev.action}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={ev.result === "SUCCESS" ? "success" : "danger"}
                          className="py-0 px-1 text-[9px]"
                        >
                          {ev.result}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {ev.actorUserId ? `${ev.actorUserId.slice(0, 8)}...` : "SYSTEM"}
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[10px]">
                        {ev.traceId ? `${ev.traceId.slice(0, 8)}...` : "—"}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        <span className="text-slate-500">{truncateHash(ev.previousHash, 8)}</span>
                        <span className="text-cyan-500 mx-1.5">$\rightarrow$</span>
                        <span className="text-emerald-400">{truncateHash(ev.currentHash, 8)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
