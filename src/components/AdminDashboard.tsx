import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileText,
  Filter,
  Flag,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  AccountStatus,
  ReportReason,
  ReportRecord,
  ReportStatus,
  UserProfile,
} from '../types/messaging';
import {
  adminFetchAllReports,
  adminFetchAllUsers,
  adminUpdateReportStatus,
  adminUpdateUserStatus,
  subscribeToAdminReports,
} from '../services/messagingService';
import { formatMessagingIdDisplay } from '../utils/messagingId';
import { UserAvatar } from './UserAvatar';

interface AdminDashboardProps {
  onBack: () => void;
  onNotifyToast: (msg: string) => void;
}

const REPORT_STATUS_META: Record<
  ReportStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  pending: {
    label: 'Pending',
    badgeClass: 'bg-[#F59E0B]/15 border-[#F59E0B]/40 text-[#F59E0B]',
    dotClass: 'bg-[#F59E0B]',
  },
  reviewed: {
    label: 'Reviewed',
    badgeClass: 'bg-[#06B6D4]/15 border-[#06B6D4]/40 text-[#06B6D4]',
    dotClass: 'bg-[#06B6D4]',
  },
  resolved: {
    label: 'Resolved',
    badgeClass: 'bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981]',
    dotClass: 'bg-[#10B981]',
  },
  dismissed: {
    label: 'Dismissed',
    badgeClass: 'bg-white/10 border-white/20 text-[#94A3B8]',
    dotClass: 'bg-[#94A3B8]',
  },
};

const REPORT_REASONS: ('ALL' | ReportReason)[] = [
  'ALL',
  'Spam',
  'Harassment',
  'Scam',
  'Impersonation',
  'Other',
];

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBack,
  onNotifyToast,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Primary navigation inside Admin Dashboard: 'reports' or 'users'
  const [activeTab, setActiveTab] = useState<'reports' | 'users'>('reports');

  // Reports filtering & inspection state
  const [reportStatusFilter, setReportStatusFilter] = useState<'ALL' | ReportStatus>('ALL');
  const [reportReasonFilter, setReportReasonFilter] = useState<'ALL' | ReportReason>('ALL');
  const [reportSearchQuery, setReportSearchQuery] = useState('');
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // Users filtering state
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState<'ALL' | AccountStatus>('ALL');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedIdText, setCopiedIdText] = useState<string | null>(null);

  const loadAdminData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [uList, rList] = await Promise.all([
        adminFetchAllUsers(),
        adminFetchAllReports(),
      ]);
      setUsers(uList);
      setReports(rList);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to load administrator moderation records.';
      setErrorMsg(msg);
      onNotifyToast(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
    const unsubReports = subscribeToAdminReports((liveReports) => {
      setReports(liveReports);
    });
    return () => {
      unsubReports();
    };
  }, []);

  // Enrich reports with any loaded user profiles if profile join was partial
  const userByIdMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    users.forEach((u) => map.set(u.uid, u));
    return map;
  }, [users]);

  const enrichedReports = useMemo(() => {
    return reports.map((r) => {
      const reporterProf = userByIdMap.get(r.reporterId);
      const reportedProf = userByIdMap.get(r.reportedUserId);
      return {
        ...r,
        reporterMessagingId:
          r.reporterMessagingId !== '0000000000'
            ? r.reporterMessagingId
            : reporterProf?.messagingId || '0000000000',
        reporterDisplayName:
          r.reporterDisplayName !== 'Unknown Reporter'
            ? r.reporterDisplayName
            : reporterProf?.displayName || 'Unknown Reporter',
        reporterUsername:
          r.reporterUsername !== 'unknown'
            ? r.reporterUsername
            : reporterProf?.username || 'unknown',
        reporterAvatarUrl: reporterProf?.avatarUrl || r.reporterAvatarUrl,
        reportedMessagingId:
          r.reportedMessagingId !== '0000000000'
            ? r.reportedMessagingId
            : reportedProf?.messagingId || '0000000000',
        reportedDisplayName:
          r.reportedDisplayName !== 'Unknown User'
            ? r.reportedDisplayName
            : reportedProf?.displayName || 'Unknown User',
        reportedUsername:
          r.reportedUsername !== 'unknown'
            ? r.reportedUsername
            : reportedProf?.username || 'unknown',
        reportedAvatarUrl: reportedProf?.avatarUrl || r.reportedAvatarUrl,
        reportedAccountStatus: reportedProf?.status || r.reportedAccountStatus || 'active',
      };
    });
  }, [reports, userByIdMap]);

  // Report counts for the 5 summary cards
  const reportCounts = useMemo(() => {
    const counts = {
      total: enrichedReports.length,
      pending: 0,
      reviewed: 0,
      resolved: 0,
      dismissed: 0,
    };
    enrichedReports.forEach((r) => {
      if (r.status === 'pending') counts.pending++;
      else if (r.status === 'reviewed') counts.reviewed++;
      else if (r.status === 'resolved') counts.resolved++;
      else if (r.status === 'dismissed') counts.dismissed++;
    });
    return counts;
  }, [enrichedReports]);

  const filteredReports = useMemo(() => {
    const q = reportSearchQuery.trim().toLowerCase();
    return enrichedReports.filter((r) => {
      if (reportStatusFilter !== 'ALL' && r.status !== reportStatusFilter) {
        return false;
      }
      if (reportReasonFilter !== 'ALL' && r.reason !== reportReasonFilter) {
        return false;
      }
      if (!q) return true;
      return (
        String(r.id || '').toLowerCase().includes(q) ||
        String(r.reason || '').toLowerCase().includes(q) ||
        String(r.description || '').toLowerCase().includes(q) ||
        String(r.reportedMessagingId || '').includes(q) ||
        String(r.reportedDisplayName || '').toLowerCase().includes(q) ||
        String(r.reportedUsername || '').toLowerCase().includes(q) ||
        String(r.reporterMessagingId || '').includes(q) ||
        String(r.reporterDisplayName || '').toLowerCase().includes(q) ||
        String(r.reporterUsername || '').toLowerCase().includes(q) ||
        String(r.messageId || '').toLowerCase().includes(q)
      );
    });
  }, [enrichedReports, reportStatusFilter, reportReasonFilter, reportSearchQuery]);

  const selectedReport = useMemo(
    () => enrichedReports.find((r) => r.id === selectedReportId) || null,
    [enrichedReports, selectedReportId]
  );

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (userStatusFilter !== 'ALL' && u.status !== userStatusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        String(u.messagingId || '').includes(q) ||
        String(u.displayName || '').toLowerCase().includes(q) ||
        String(u.username || '').toLowerCase().includes(q)
      );
    });
  }, [users, userSearchQuery, userStatusFilter]);

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedIdText(text);
    onNotifyToast(`Copied ${label}`);
    setTimeout(() => {
      setCopiedIdText((prev) => (prev === text ? null : prev));
    }, 2000);
  };

  const handleReportStatusChange = async (reportId: string, status: ReportStatus) => {
    setBusyId(reportId);
    const nowIso = new Date().toISOString();
    try {
      await adminUpdateReportStatus(reportId, status);
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId ? { ...r, status, updatedAt: nowIso } : r
        )
      );
      onNotifyToast(`Report status updated to ${status}`);
    } catch (err: unknown) {
      onNotifyToast(
        err instanceof Error ? err.message : 'Failed to update report status'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleUserStatusChange = async (
    targetUid: string,
    targetDisplayName: string,
    status: AccountStatus
  ) => {
    setBusyId(targetUid);
    try {
      const existingUser = userByIdMap.get(targetUid) || {
        uid: targetUid,
        displayName: targetDisplayName,
        username: 'user',
        messagingId: '0000000000',
        avatarUrl: 'obsidian-cyan',
        bio: '',
        status: 'active',
        privacyAllowIdLookup: true,
        privacyShowReadReceipts: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await adminUpdateUserStatus(existingUser, status);
      setUsers((prev) =>
        prev.map((u) => (u.uid === targetUid ? { ...u, status } : u))
      );
      setReports((prev) =>
        prev.map((r) =>
          r.reportedUserId === targetUid
            ? { ...r, reportedAccountStatus: status }
            : r
        )
      );
      onNotifyToast(`Updated ${targetDisplayName} account standing to ${status}`);
    } catch (err: unknown) {
      onNotifyToast(
        err instanceof Error ? err.message : 'Failed to update user account status'
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#090A0F] p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6 pb-24">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back from Admin Dashboard"
              className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-[#11131C] border border-white/10 text-[#94A3B8] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#06B6D4] tabular-nums">
                <Shield className="w-3.5 h-3.5" />
                <span>SUPABASE RLS-VERIFIED ADMINISTRATOR DASHBOARD</span>
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
                Reports Management &amp; User Governance
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={loadAdminData}
            disabled={loading}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#11131C] border border-white/10 text-xs font-semibold text-white hover:border-[#06B6D4]/50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#06B6D4]' : ''}`} />
            <span>{loading ? 'Syncing...' : 'Refresh Records'}</span>
          </button>
        </div>

        {/* Navigation Switcher: Reports vs User Directory */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors ${
                activeTab === 'reports'
                  ? 'bg-[#06B6D4] text-[#090A0F]'
                  : 'bg-[#11131C] border border-white/10 text-[#94A3B8] hover:text-white'
              }`}
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Reports</span>
              {reportCounts.pending > 0 ? (
                <span
                  className={`font-mono text-[11px] px-2 py-0.5 rounded-md font-bold tabular-nums ${
                    activeTab === 'reports'
                      ? 'bg-[#090A0F] text-[#F59E0B]'
                      : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                  }`}
                >
                  {reportCounts.pending} pending
                </span>
              ) : (
                <span className="font-mono text-[11px] opacity-80 tabular-nums">
                  ({reportCounts.total})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
                activeTab === 'users'
                  ? 'bg-[#06B6D4] text-[#090A0F]'
                  : 'bg-[#11131C] border border-white/10 text-[#94A3B8] hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>User Directory ({users.length})</span>
            </button>
          </div>

          <div className="text-xs text-[#94A3B8]">
            Connected to <span className="font-mono text-white">public.reports</span> &amp;{' '}
            <span className="font-mono text-white">public.profiles</span>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/30 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-[#EF4444]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={loadAdminData}
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#EF4444] text-white text-xs font-semibold shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* ================================================================= */}
        {/* REPORTS MANAGEMENT SECTION                                        */}
        {/* ================================================================= */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* 5 Required Report Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <button
                type="button"
                onClick={() => setReportStatusFilter('ALL')}
                className={`text-left rounded-2xl p-4 border transition-all space-y-1 ${
                  reportStatusFilter === 'ALL'
                    ? 'bg-[#161926] border-[#06B6D4]'
                    : 'bg-[#11131C] border-white/[0.07] hover:border-white/20'
                }`}
              >
                <div className="text-xs text-[#94A3B8] flex items-center justify-between">
                  <span>Total Reports</span>
                  <FileText className="w-3.5 h-3.5 text-[#06B6D4]" />
                </div>
                <div className="font-mono text-2xl font-bold text-white tabular-nums">
                  {reportCounts.total}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReportStatusFilter('pending')}
                className={`text-left rounded-2xl p-4 border transition-all space-y-1 ${
                  reportStatusFilter === 'pending'
                    ? 'bg-[#161926] border-[#F59E0B]'
                    : 'bg-[#11131C] border-white/[0.07] hover:border-white/20'
                }`}
              >
                <div className="text-xs text-[#94A3B8] flex items-center justify-between">
                  <span>Pending Reports</span>
                  <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
                </div>
                <div className="font-mono text-2xl font-bold text-[#F59E0B] tabular-nums">
                  {reportCounts.pending}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReportStatusFilter('reviewed')}
                className={`text-left rounded-2xl p-4 border transition-all space-y-1 ${
                  reportStatusFilter === 'reviewed'
                    ? 'bg-[#161926] border-[#06B6D4]'
                    : 'bg-[#11131C] border-white/[0.07] hover:border-white/20'
                }`}
              >
                <div className="text-xs text-[#94A3B8] flex items-center justify-between">
                  <span>Reviewed Reports</span>
                  <Eye className="w-3.5 h-3.5 text-[#06B6D4]" />
                </div>
                <div className="font-mono text-2xl font-bold text-[#06B6D4] tabular-nums">
                  {reportCounts.reviewed}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReportStatusFilter('resolved')}
                className={`text-left rounded-2xl p-4 border transition-all space-y-1 ${
                  reportStatusFilter === 'resolved'
                    ? 'bg-[#161926] border-[#10B981]'
                    : 'bg-[#11131C] border-white/[0.07] hover:border-white/20'
                }`}
              >
                <div className="text-xs text-[#94A3B8] flex items-center justify-between">
                  <span>Resolved Reports</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                </div>
                <div className="font-mono text-2xl font-bold text-[#10B981] tabular-nums">
                  {reportCounts.resolved}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReportStatusFilter('dismissed')}
                className={`col-span-2 sm:col-span-1 text-left rounded-2xl p-4 border transition-all space-y-1 ${
                  reportStatusFilter === 'dismissed'
                    ? 'bg-[#161926] border-white/40'
                    : 'bg-[#11131C] border-white/[0.07] hover:border-white/20'
                }`}
              >
                <div className="text-xs text-[#94A3B8] flex items-center justify-between">
                  <span>Dismissed Reports</span>
                  <XCircle className="w-3.5 h-3.5 text-[#94A3B8]" />
                </div>
                <div className="font-mono text-2xl font-bold text-[#94A3B8] tabular-nums">
                  {reportCounts.dismissed}
                </div>
              </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="rounded-2xl bg-[#11131C] border border-white/10 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] mr-1">
                  <Filter className="w-3.5 h-3.5 text-[#06B6D4]" />
                  <span>Status:</span>
                </div>
                {(['ALL', 'pending', 'reviewed', 'resolved', 'dismissed'] as const).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setReportStatusFilter(st)}
                      className={`min-h-[34px] px-3 py-1 rounded-xl text-xs font-medium capitalize transition-colors ${
                        reportStatusFilter === st
                          ? 'bg-[#06B6D4] text-[#090A0F] font-semibold'
                          : 'bg-[#161926] text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {st === 'ALL' ? 'All Statuses' : st}
                    </button>
                  )
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <select
                  aria-label="Filter reports by reason"
                  value={reportReasonFilter}
                  onChange={(e) =>
                    setReportReasonFilter(e.target.value as 'ALL' | ReportReason)
                  }
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#161926] border border-white/10 text-xs text-white focus:outline-none focus:border-[#06B6D4]"
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r === 'ALL' ? 'All Reasons' : `Reason: ${r}`}
                    </option>
                  ))}
                </select>

                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={reportSearchQuery}
                    onChange={(e) => setReportSearchQuery(e.target.value)}
                    placeholder="Search ID, reporter, reported, reason..."
                    className="w-full min-h-[40px] pl-9 pr-4 py-2 rounded-xl bg-[#161926] border border-white/10 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
              </div>
            </div>

            {/* Reports List / Table */}
            <div className="rounded-3xl bg-[#11131C] border border-white/10 overflow-hidden">
              {loading && enrichedReports.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 text-[#06B6D4] animate-spin mx-auto" />
                  <div className="text-sm font-medium text-white">
                    Loading moderation reports from Supabase...
                  </div>
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <CheckCircle2 className="w-9 h-9 text-[#10B981] mx-auto" />
                  <div className="text-base font-semibold text-white">
                    {enrichedReports.length === 0
                      ? 'No Reports Submitted Yet'
                      : 'No Reports Match Current Filter'}
                  </div>
                  <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                    {enrichedReports.length === 0
                      ? 'When users submit a report against a profile or message, it will appear here in real time.'
                      : 'Try clearing your search query or switching the status/reason filters above.'}
                  </p>
                  {enrichedReports.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setReportStatusFilter('ALL');
                        setReportReasonFilter('ALL');
                        setReportSearchQuery('');
                      }}
                      className="min-h-[38px] px-4 py-2 rounded-xl bg-[#161926] border border-white/10 text-xs font-semibold text-white hover:border-[#06B6D4]"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {filteredReports.map((rep) => {
                    const statusMeta =
                      REPORT_STATUS_META[rep.status] || REPORT_STATUS_META.pending;

                    return (
                      <div
                        key={rep.id}
                        className="p-4 sm:p-5 hover:bg-[#161926]/60 transition-colors flex flex-col gap-4"
                      >
                        {/* Top row: Report ID, Reason, Timestamp, Status Badge */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${statusMeta.badgeClass}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`}
                              />
                              {statusMeta.label}
                            </span>

                            <span className="px-2.5 py-1 rounded-lg bg-[#161926] border border-white/10 text-white font-semibold">
                              {rep.reason}
                            </span>

                            <button
                              type="button"
                              onClick={() => handleCopyText(rep.id, 'Report ID')}
                              className="font-mono text-[11px] text-[#94A3B8] hover:text-white flex items-center gap-1 tabular-nums"
                              title="Copy full Report UUID"
                            >
                              <span>Report #{rep.id.slice(0, 8)}</span>
                              <Copy className="w-3 h-3" />
                            </button>

                            {rep.messageId && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[11px] font-mono text-[#06B6D4]">
                                <MessageSquare className="w-3 h-3" />
                                Msg #{rep.messageId.slice(0, 8)}
                              </span>
                            )}
                          </div>

                          <div className="font-mono text-[11px] text-[#64748B] tabular-nums">
                            Submitted: {formatDateTime(rep.createdAt)}
                          </div>
                        </div>

                        {/* Middle row: Reporter vs Reported User Cards + Description */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                          {/* Reported User (Target) */}
                          <div className="lg:col-span-4 rounded-2xl bg-[#161926] border border-white/[0.07] p-3.5 space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                              <span className="font-semibold text-[#F59E0B] uppercase tracking-wider">
                                Reported User
                              </span>
                              <span
                                className={`capitalize font-mono px-2 py-0.5 rounded text-[10px] ${
                                  rep.reportedAccountStatus === 'active'
                                    ? 'bg-[#10B981]/15 text-[#10B981]'
                                    : 'bg-[#EF4444]/20 text-[#EF4444]'
                                }`}
                              >
                                {rep.reportedAccountStatus}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 min-w-0">
                              <UserAvatar
                                avatarUrl={rep.reportedAvatarUrl}
                                displayName={rep.reportedDisplayName}
                                size="sm"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-white truncate">
                                  {rep.reportedDisplayName}{' '}
                                  <span className="text-[#94A3B8] font-normal">
                                    @{rep.reportedUsername}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 font-mono text-xs text-[#06B6D4] tabular-nums">
                                  <span>
                                    ID {formatMessagingIdDisplay(rep.reportedMessagingId)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyText(
                                        rep.reportedMessagingId,
                                        'Reported 10-Digit ID'
                                      )
                                    }
                                    className="text-[#94A3B8] hover:text-white"
                                    aria-label="Copy reported user 10-digit ID"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Reporter User */}
                          <div className="lg:col-span-4 rounded-2xl bg-[#161926]/60 border border-white/[0.05] p-3.5 space-y-2">
                            <div className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                              Submitted By (Reporter)
                            </div>
                            <div className="flex items-center gap-3 min-w-0">
                              <UserAvatar
                                avatarUrl={rep.reporterAvatarUrl}
                                displayName={rep.reporterDisplayName}
                                size="sm"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold text-white truncate">
                                  {rep.reporterDisplayName}{' '}
                                  <span className="text-[#94A3B8] font-normal">
                                    @{rep.reporterUsername}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 font-mono text-xs text-[#94A3B8] tabular-nums">
                                  <span>
                                    ID {formatMessagingIdDisplay(rep.reporterMessagingId)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyText(
                                        rep.reporterMessagingId,
                                        'Reporter 10-Digit ID'
                                      )
                                    }
                                    className="text-[#64748B] hover:text-white"
                                    aria-label="Copy reporter 10-digit ID"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Description & Message Context */}
                          <div className="lg:col-span-4 rounded-2xl bg-[#161926]/40 border border-white/[0.05] p-3.5 space-y-1.5">
                            <div className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                              Reporter Description
                            </div>
                            <p className="text-xs text-[#F8FAFC] leading-relaxed break-words">
                              {rep.description}
                            </p>
                            {rep.messageContent && (
                              <div className="mt-2 pt-2 border-t border-white/[0.06] text-[11px] text-[#94A3B8] italic">
                                Reported Message: &ldquo;{rep.messageContent}&rdquo;
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Bottom Actions Bar: Status Transitions + Inspect Details */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedReportId(rep.id)}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#161926] border border-white/10 text-xs font-semibold text-[#06B6D4] hover:border-[#06B6D4] transition-colors flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Full Report Details</span>
                          </button>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-[#64748B] mr-1">
                              Set Status:
                            </span>
                            {(
                              [
                                'pending',
                                'reviewed',
                                'resolved',
                                'dismissed',
                              ] as ReportStatus[]
                            ).map((st) => (
                              <button
                                key={st}
                                type="button"
                                disabled={busyId === rep.id || rep.status === st}
                                onClick={() => handleReportStatusChange(rep.id, st)}
                                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-colors ${
                                  rep.status === st
                                    ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-white'
                                    : 'bg-[#161926] border-white/10 text-[#94A3B8] hover:text-white hover:border-white/30'
                                } disabled:opacity-50`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* USER DIRECTORY GOVERNANCE SECTION                                 */}
        {/* ================================================================= */}
        {activeTab === 'users' && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-[#11131C] border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(['ALL', 'active', 'restricted', 'suspended'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setUserStatusFilter(st)}
                    className={`min-h-[36px] px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                      userStatusFilter === st
                        ? 'bg-[#06B6D4] text-[#090A0F]'
                        : 'bg-[#161926] text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {st === 'ALL' ? `All Accounts (${users.length})` : st}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search by 10-digit ID or name..."
                  className="w-full min-h-[40px] pl-9 pr-4 py-2 rounded-xl bg-[#161926] border border-white/10 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>
            </div>

            <div className="rounded-3xl bg-[#11131C] border border-white/10 p-5 space-y-3">
              {filteredUsers.length === 0 ? (
                <div className="py-10 text-center text-xs text-[#94A3B8]">
                  No user accounts match your search filter.
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.uid}
                    className="rounded-2xl bg-[#161926] border border-white/[0.07] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        avatarUrl={u.avatarUrl}
                        displayName={u.displayName}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {u.displayName}{' '}
                          <span className="text-xs font-normal text-[#94A3B8]">
                            @{u.username}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-[#06B6D4] tabular-nums">
                          ID {formatMessagingIdDisplay(u.messagingId)} · Standing:{' '}
                          <span className="capitalize">{u.status}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(['active', 'restricted', 'suspended'] as AccountStatus[]).map(
                        (st) => (
                          <button
                            key={st}
                            type="button"
                            disabled={busyId === u.uid || u.status === st}
                            onClick={() =>
                              handleUserStatusChange(u.uid, u.displayName, st)
                            }
                            className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium capitalize border transition-colors ${
                              u.status === st
                                ? st === 'active'
                                  ? 'bg-[#10B981]/20 border-[#10B981] text-white'
                                  : 'bg-[#EF4444]/20 border-[#EF4444] text-white'
                                : 'bg-[#11131C] border-white/10 text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            {st}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* REPORT DETAIL DRAWER / MODAL                                        */}
      {/* =================================================================== */}
      {selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-report-detail-title"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#11131C] border border-white/10 p-6 shadow-2xl space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-[#F59E0B]" />
                  <h2
                    id="admin-report-detail-title"
                    className="text-base font-bold text-white"
                  >
                    Moderation Report Details
                  </h2>
                  <span
                    className={`px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${
                      (
                        REPORT_STATUS_META[selectedReport.status] ||
                        REPORT_STATUS_META.pending
                      ).badgeClass
                    }`}
                  >
                    {
                      (
                        REPORT_STATUS_META[selectedReport.status] ||
                        REPORT_STATUS_META.pending
                      ).label
                    }
                  </span>
                </div>
                <div className="mt-1 font-mono text-xs text-[#94A3B8] flex items-center gap-2">
                  <span>Report ID: {selectedReport.id}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(selectedReport.id, 'Report ID')}
                    className="text-[#06B6D4] hover:underline inline-flex items-center gap-1"
                  >
                    {copiedIdText === selectedReport.id ? (
                      <Check className="w-3 h-3 text-[#10B981]" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedReportId(null)}
                aria-label="Close report details"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-[#161926] text-[#94A3B8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Reported User Details */}
              <div className="rounded-2xl bg-[#161926] border border-white/[0.08] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#F59E0B]">
                    Reported User
                  </span>
                  <span className="font-mono text-[11px] text-[#94A3B8] capitalize">
                    Standing: {selectedReport.reportedAccountStatus}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <UserAvatar
                    avatarUrl={selectedReport.reportedAvatarUrl}
                    displayName={selectedReport.reportedDisplayName}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {selectedReport.reportedDisplayName}
                    </div>
                    <div className="text-xs text-[#94A3B8] truncate">
                      @{selectedReport.reportedUsername}
                    </div>
                    <div className="font-mono text-xs text-[#06B6D4] tabular-nums mt-0.5">
                      ID {formatMessagingIdDisplay(selectedReport.reportedMessagingId)}
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                  <div className="text-[11px] text-[#94A3B8]">
                    Account Standing Action:
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(['active', 'restricted', 'suspended'] as AccountStatus[]).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={
                            busyId === selectedReport.reportedUserId ||
                            selectedReport.reportedAccountStatus === st
                          }
                          onClick={() =>
                            handleUserStatusChange(
                              selectedReport.reportedUserId,
                              selectedReport.reportedDisplayName,
                              st
                            )
                          }
                          className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize border transition-colors ${
                            selectedReport.reportedAccountStatus === st
                              ? st === 'active'
                                ? 'bg-[#10B981]/20 border-[#10B981] text-white'
                                : 'bg-[#EF4444]/20 border-[#EF4444] text-white'
                              : 'bg-[#11131C] border-white/10 text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Reporter Details */}
              <div className="rounded-2xl bg-[#161926] border border-white/[0.08] p-4 space-y-3">
                <div className="text-xs font-semibold text-[#06B6D4]">
                  Reporter Details
                </div>
                <div className="flex items-center gap-3">
                  <UserAvatar
                    avatarUrl={selectedReport.reporterAvatarUrl}
                    displayName={selectedReport.reporterDisplayName}
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {selectedReport.reporterDisplayName}
                    </div>
                    <div className="text-xs text-[#94A3B8] truncate">
                      @{selectedReport.reporterUsername}
                    </div>
                    <div className="font-mono text-xs text-[#06B6D4] tabular-nums mt-0.5">
                      ID {formatMessagingIdDisplay(selectedReport.reporterMessagingId)}
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/[0.06] text-[11px] text-[#94A3B8] space-y-1 font-mono">
                  <div>Submitted: {formatDateTime(selectedReport.createdAt)}</div>
                  <div>Last Updated: {formatDateTime(selectedReport.updatedAt)}</div>
                </div>
              </div>
            </div>

            {/* Report Content & Related Message */}
            <div className="rounded-2xl bg-[#161926] border border-white/[0.08] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white">
                  Reason: <span className="text-[#06B6D4]">{selectedReport.reason}</span>
                </span>
                {selectedReport.messageId ? (
                  <span className="font-mono text-xs text-[#94A3B8]">
                    Related Message ID: {selectedReport.messageId}
                  </span>
                ) : (
                  <span className="text-xs text-[#64748B]">
                    Profile-level report (No specific message ID)
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-[#94A3B8]">
                  Description Supplied by Reporter:
                </div>
                <div className="rounded-xl bg-[#11131C] border border-white/[0.06] p-3 text-xs text-white leading-relaxed whitespace-pre-wrap">
                  {selectedReport.description}
                </div>
              </div>

              {selectedReport.messageContent && (
                <div className="space-y-1">
                  <div className="text-[11px] text-[#94A3B8]">
                    Reported Message Content Snapshot:
                  </div>
                  <div className="rounded-xl bg-[#11131C] border border-[#F59E0B]/30 p-3 text-xs text-[#F8FAFC] italic">
                    &ldquo;{selectedReport.messageContent}&rdquo;
                  </div>
                </div>
              )}
            </div>

            {/* Report Status Management Controls */}
            <div className="rounded-2xl bg-[#161926] border border-white/[0.08] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-white">
                  Update Moderation Status
                </div>
                <div className="text-[11px] text-[#94A3B8]">
                  Changes are persisted immediately to <span className="font-mono">public.reports</span>.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(['pending', 'reviewed', 'resolved', 'dismissed'] as ReportStatus[]).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={
                        busyId === selectedReport.id || selectedReport.status === st
                      }
                      onClick={() => handleReportStatusChange(selectedReport.id, st)}
                      className={`min-h-[38px] px-3.5 py-2 rounded-xl text-xs font-semibold capitalize border transition-colors ${
                        selectedReport.status === st
                          ? 'bg-[#06B6D4] border-[#06B6D4] text-[#090A0F]'
                          : 'bg-[#11131C] border-white/10 text-[#94A3B8] hover:text-white'
                      } disabled:opacity-50`}
                    >
                      {st}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
