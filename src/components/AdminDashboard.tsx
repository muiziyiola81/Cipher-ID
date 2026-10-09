import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import {
  AccountStatus,
  ReportRecord,
  ReportStatus,
  UserProfile,
} from '../types/messaging';
import {
  adminFetchAllReports,
  adminFetchAllUsers,
  adminUpdateReportStatus,
  adminUpdateUserStatus,
} from '../services/messagingService';
import { formatMessagingIdDisplay } from '../utils/messagingId';
import { UserAvatar } from './UserAvatar';

interface AdminDashboardProps {
  onBack: () => void;
  onNotifyToast: (msg: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBack,
  onNotifyToast,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'reports'>('reports');
  const [searchIdQuery, setSearchIdQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [uList, rList] = await Promise.all([
        adminFetchAllUsers(),
        adminFetchAllReports(),
      ]);
      setUsers(uList);
      setReports(rList);
    } catch {
      onNotifyToast('Unable to load administrator records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = searchIdQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.messagingId.includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  }, [users, searchIdQuery]);

  const pendingReportsCount = useMemo(
    () => reports.filter((r) => r.status === 'pending').length,
    [reports]
  );

  const suspendedUsersCount = useMemo(
    () => users.filter((u) => u.status !== 'active').length,
    [users]
  );

  const handleUserStatusChange = async (user: UserProfile, status: AccountStatus) => {
    setBusyId(user.uid);
    try {
      await adminUpdateUserStatus(user, status);
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, status } : u))
      );
      onNotifyToast(`Updated ${user.displayName} status to ${status}`);
    } catch {
      onNotifyToast('Failed to update user account status');
    } finally {
      setBusyId(null);
    }
  };

  const handleReportStatusChange = async (reportId: string, status: ReportStatus) => {
    setBusyId(reportId);
    try {
      await adminUpdateReportStatus(reportId, status);
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status } : r))
      );
      onNotifyToast(`Report marked as ${status}`);
    } catch {
      onNotifyToast('Failed to update report status');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#090A0F] p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back from Admin Console"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#11131C] border border-white/10 text-[#94A3B8] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="text-xs font-mono text-[#06B6D4] tabular-nums">
                SERVER-VERIFIED ADMINISTRATOR ROLE
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-white">
                Moderation &amp; Directory Governance
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={loadAdminData}
            disabled={loading}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#11131C] border border-white/10 text-xs font-semibold text-white hover:border-[#06B6D4]/50 transition-colors flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>

        {/* Statistics Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-[#11131C] border border-white/[0.07] p-5 space-y-1">
            <div className="text-xs text-[#94A3B8]">Registered 10-Digit IDs</div>
            <div className="font-mono text-2xl font-bold text-white tabular-nums">
              {users.length}
            </div>
          </div>

          <div className="rounded-2xl bg-[#11131C] border border-white/[0.07] p-5 space-y-1">
            <div className="text-xs text-[#94A3B8]">Pending Reports</div>
            <div className="font-mono text-2xl font-bold text-[#F59E0B] tabular-nums">
              {pendingReportsCount}
            </div>
          </div>

          <div className="rounded-2xl bg-[#11131C] border border-white/[0.07] p-5 space-y-1">
            <div className="text-xs text-[#94A3B8]">Restricted / Suspended Accounts</div>
            <div className="font-mono text-2xl font-bold text-[#EF4444] tabular-nums">
              {suspendedUsersCount}
            </div>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('reports')}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
                activeTab === 'reports'
                  ? 'bg-[#06B6D4] text-[#090A0F]'
                  : 'bg-[#11131C] border border-white/10 text-[#94A3B8] hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Moderation Reports ({reports.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
                activeTab === 'users'
                  ? 'bg-[#06B6D4] text-[#090A0F]'
                  : 'bg-[#11131C] border border-white/10 text-[#94A3B8] hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>User Directory ({users.length})</span>
            </button>
          </div>

          {activeTab === 'users' && (
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchIdQuery}
                onChange={(e) => setSearchIdQuery(e.target.value)}
                placeholder="Search by 10-digit ID or name..."
                className="w-full min-h-[40px] pl-9 pr-4 py-2 rounded-xl bg-[#11131C] border border-white/10 text-xs text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
              />
            </div>
          )}
        </div>

        {/* Reports View */}
        {activeTab === 'reports' && (
          <div className="rounded-3xl bg-[#11131C] border border-white/10 p-6 space-y-4">
            {reports.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto" />
                <div className="text-sm font-semibold text-white">No Moderation Reports</div>
                <p className="text-xs text-[#94A3B8]">
                  All user and message reports will appear here for review.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-2xl bg-[#161926] border border-white/[0.07] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-white">{rep.reason}</span>
                        <span aria-hidden="true" className="text-[#64748B]">·</span>
                        <span className="font-mono text-[#06B6D4] tabular-nums">
                          Reported ID: {formatMessagingIdDisplay(rep.reportedMessagingId)}
                        </span>
                        <span aria-hidden="true" className="text-[#64748B]">·</span>
                        <span className="text-[#94A3B8]">Status: {rep.status}</span>
                      </div>
                      <p className="text-xs text-[#F8FAFC]">{rep.description}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {(
                        ['reviewed', 'resolved', 'dismissed'] as ReportStatus[]
                      ).map((st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={busyId === rep.id || rep.status === st}
                          onClick={() => handleReportStatusChange(rep.id, st)}
                          className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-medium capitalize border transition-colors ${
                            rep.status === st
                              ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-white'
                              : 'bg-[#11131C] border-white/10 text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users View */}
        {activeTab === 'users' && (
          <div className="rounded-3xl bg-[#11131C] border border-white/10 p-6 space-y-4">
            {filteredUsers.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#94A3B8]">
                No user accounts match your search filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((u) => (
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
                          ID {formatMessagingIdDisplay(u.messagingId)} · Standing: {u.status}
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
                            onClick={() => handleUserStatusChange(u, st)}
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
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
