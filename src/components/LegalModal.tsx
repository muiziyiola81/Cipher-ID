import React from 'react';
import { X } from 'lucide-react';

interface LegalModalProps {
  tab: 'terms' | 'privacy' | 'about' | null;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ tab, onClose }) => {
  if (!tab) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl bg-[#11131C] border border-white/10 flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <h3 id="legal-modal-title" className="text-base font-semibold text-white">
            {tab === 'terms' && 'Terms of Service'}
            {tab === 'privacy' && 'Privacy Policy'}
            {tab === 'about' && 'About CipherID Messaging'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close legal dialog"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-sm text-[#94A3B8] leading-relaxed">
          {tab === 'about' && (
            <>
              <p className="text-[#F8FAFC] font-medium">
                CipherID is a modern private messaging application built around unique 10-digit Messaging IDs.
              </p>
              <p>
                Every account receives a randomly generated 10-digit identifier upon creation. This identifier is strictly for finding and messaging other users inside CipherID—it is never a telephone number and is never derived from personal information.
              </p>
              <p>
                Designed mobile-first and installable as a standalone Progressive Web App (PWA) on Android, iOS, and desktop browsers.
              </p>
            </>
          )}

          {tab === 'terms' && (
            <>
              <p className="text-[#F8FAFC] font-medium">1. Identifier Usage</p>
              <p>
                Your 10-digit Messaging ID is an internal application identifier assigned randomly at registration. You may not impersonate other individuals or attempt to claim another user&apos;s Messaging ID.
              </p>
              <p className="text-[#F8FAFC] font-medium">2. Acceptable Conduct</p>
              <p>
                Users must not use CipherID to transmit spam, harassment, scams, or unlawful content. Accounts reported and verified for abuse may be restricted or suspended by system administrators.
              </p>
              <p className="text-[#F8FAFC] font-medium">3. Service Availability</p>
              <p>
                CipherID provides real-time cloud-synced messaging with participant-restricted database access rules.
              </p>
            </>
          )}

          {tab === 'privacy' && (
            <>
              <p className="text-[#F8FAFC] font-medium">1. Minimal Data Collection &amp; PII Isolation</p>
              <p>
                CipherID collects only your authentication email, display name, username, and profile preferences. Your email address is isolated in a private subcollection and is never exposed to other users when they look up your 10-digit Messaging ID.
              </p>
              <p className="text-[#F8FAFC] font-medium">2. Message Storage &amp; Access Control</p>
              <p>
                Messages are stored in Supabase PostgreSQL protected by strict Row Level Security (RLS) policies ensuring only conversation participants can read or send messages. CipherID does not access your device&apos;s address book or unnecessary hardware permissions.
              </p>
              <p className="text-[#F8FAFC] font-medium">3. Blocking &amp; Discovery Controls</p>
              <p>
                You can disable 10-digit Messaging ID lookup in your Privacy Settings at any time, or block specific users to prevent them from initiating conversations with you.
              </p>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.07] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-sm hover:bg-[#22D3EE] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
