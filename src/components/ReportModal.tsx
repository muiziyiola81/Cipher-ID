import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Flag, X } from 'lucide-react';
import { ReportReason } from '../types/messaging';
import { submitModerationReport } from '../services/messagingService';

interface ReportModalProps {
  reporterId: string;
  reportedUserId: string;
  reportedMessagingId: string;
  reportedDisplayName: string;
  messageId?: string;
  messageSnippet?: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const REPORT_REASONS: ReportReason[] = [
  'Spam',
  'Harassment',
  'Scam',
  'Impersonation',
  'Other',
];

export const ReportModal: React.FC<ReportModalProps> = ({
  reporterId,
  reportedUserId,
  reportedMessagingId,
  reportedDisplayName,
  messageId,
  messageSnippet,
  onClose,
  onSubmitted,
}) => {
  const [reason, setReason] = useState<ReportReason>('Spam');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      await submitModerationReport({
        reporterId,
        reportedUserId,
        reportedMessagingId,
        messageId,
        reason,
        description: description.trim() || `Reported ${reportedDisplayName} for ${reason}`,
      });
      setDone(true);
      setTimeout(() => {
        onSubmitted();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-[#11131C] border border-white/10 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Flag className="w-5 h-5 text-[#F59E0B]" />
            <h2 id="report-modal-title" className="text-base font-semibold text-white">
              Report {messageId ? 'Message' : 'User'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report dialog"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-[#10B981] mx-auto" />
            <div className="text-base font-semibold text-white">Report Submitted</div>
            <p className="text-xs text-[#94A3B8]">
              Thank you. Our administrators will review this report shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-xl bg-[#161926] border border-white/[0.07] p-3 text-xs space-y-1">
              <div className="text-[#94A3B8]">
                Target: <span className="text-white font-medium">{reportedDisplayName}</span> ·{' '}
                <span className="font-mono text-[#06B6D4] tabular-nums">ID {reportedMessagingId}</span>
              </div>
              {messageSnippet && (
                <div className="text-[#64748B] truncate italic">
                  &ldquo;{messageSnippet}&rdquo;
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#94A3B8] mb-2">
                Select Report Category
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${
                      reason === r
                        ? 'bg-[#06B6D4]/15 border-[#06B6D4] text-white'
                        : 'bg-[#161926] border-white/10 text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="report-description" className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Additional Context (optional)
              </label>
              <textarea
                id="report-description"
                rows={3}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide details to assist administrator review..."
                className="w-full p-3 rounded-xl bg-[#161926] border border-white/10 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4] resize-none"
              />
            </div>

            {errorMsg && (
              <div className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 p-3 text-xs text-[#EF4444] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[44px] rounded-xl bg-[#161926] border border-white/10 text-xs font-semibold text-[#F8FAFC] hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 min-h-[44px] rounded-xl bg-[#F59E0B] text-[#090A0F] text-xs font-semibold hover:bg-[#FBBF24] transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
