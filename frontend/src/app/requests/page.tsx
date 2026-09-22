"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { AccessRequest } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatTimestamp, formatRequesterIdentity, getErrorDetails } from "@/lib/utils";
import {
  FileCheck,
  CheckCircle,
  XCircle,
  KeyRound,
  ShieldAlert,
  Clock,
  User,
  Layers,
} from "lucide-react";

export default function AccessRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [feedback, setFeedback] = useState<{ title: string; message: string; type: "success" | "error" } | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAccessRequests();
      setRequests(res.requests);
    } catch (err: any) {
      const details = getErrorDetails(err, "Failed to load access requests.");
      setError({ title: details.title, message: details.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    setFeedback(null);
    try {
      await api.approveAccessRequest(id);
      setFeedback({
        title: "Request Approved",
        message: "Access request approved successfully.",
        type: "success",
      });
      await loadRequests();
    } catch (err: any) {
      const details = getErrorDetails(err, "Approval action failed.");
      setFeedback({
        title: details.title,
        message: details.message,
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    setFeedback(null);
    try {
      await api.rejectAccessRequest(id);
      setFeedback({
        title: "Request Rejected",
        message: "Access request rejected.",
        type: "success",
      });
      await loadRequests();
    } catch (err: any) {
      const details = getErrorDetails(err, "Rejection action failed.");
      setFeedback({
        title: details.title,
        message: details.message,
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleProvision = async (id: string) => {
    setActionLoading(id);
    setFeedback(null);
    try {
      await api.provisionAccessRequest(id);
      setFeedback({
        title: "Resource Provisioned",
        message: "Resource provisioned successfully to requester.",
        type: "success",
      });
      await loadRequests();
    } catch (err: any) {
      const details = getErrorDetails(err, "Provisioning failed.");
      setFeedback({
        title: details.title,
        message: details.message,
        type: "error",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const isCommander = user?.roles.includes("COMMANDER") || user?.roles.includes("ADMIN");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5 font-sans">
            <FileCheck className="w-6 h-6 text-cyan-400" />
            Access Requests
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Review and manage resource access requests. Approvals require authorized review.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadRequests} isLoading={loading}>
          Refresh
        </Button>
      </div>

      {feedback && (
        <Alert
          variant={feedback.type === "success" ? "success" : "danger"}
          title={feedback.title}
        >
          {feedback.message}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" title={error.title}>
          {error.message}
        </Alert>
      )}

      {/* Requests List */}
      <Card className="border-surface-border bg-surface/90 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white">Access Requests</CardTitle>
          <CardDescription>
            {isCommander
              ? "Reviewer View: Showing access requests for resources within your unit."
              : "Requester View: Showing access requests submitted by your account."}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-slate-400 animate-pulse">
              Loading requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <FileCheck className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm text-slate-300 font-medium">No access requests found</div>
              <p className="text-xs text-slate-500">
                Navigate to Resources to request access to a resource.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-surface-elevated text-slate-400 uppercase tracking-wider font-mono text-[10px] border-y border-surface-border">
                  <tr>
                    <th className="py-3 px-4">Resource</th>
                    <th className="py-3 px-4">Requester</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {requests.map((req) => {
                    const isPending = req.status === "PENDING";
                    const isApproved = req.status === "APPROVED";

                    return (
                      <tr key={req.id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-cyan-400" />
                            {req.assetName || req.assetId.slice(0, 8)}
                          </div>
                          {req.assetClassification && (
                            <Badge clearance={req.assetClassification} className="mt-1 py-0 px-1 text-[9px]" />
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-300 font-sans">
                          {formatRequesterIdentity(
                            req.requesterName,
                            req.requesterRole,
                            req.requesterUnit,
                            req.requesterId
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-400 max-w-xs truncate">
                          {req.reason || "—"}
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge status={req.status} />
                        </td>

                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                          {formatTimestamp(req.createdAt)}
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-2">
                          {isCommander ? (
                            <>
                              {isPending && (
                                <>
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/30"
                                    isLoading={actionLoading === req.id}
                                    onClick={() => handleApprove(req.id)}
                                    title="Approve Request (Commander Required)"
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    variant="danger"
                                    size="sm"
                                    className="text-xs px-2.5 py-1"
                                    isLoading={actionLoading === req.id}
                                    onClick={() => handleReject(req.id)}
                                    title="Reject Request (Commander Required)"
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}

                              {isApproved && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="text-xs px-2.5 py-1"
                                  isLoading={actionLoading === req.id}
                                  onClick={() => handleProvision(req.id)}
                                  title="Provision Resource to Requester"
                                >
                                  <KeyRound className="w-3 h-3 mr-1" />
                                  Provision
                                </Button>
                              )}

                              {!isPending && !isApproved && (
                                <span className="text-[11px] font-mono text-slate-500">
                                  Decided
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] font-mono text-slate-400">
                              {isPending
                                ? "Pending Review"
                                : isApproved
                                ? "Approved"
                                : "Decided"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
