import React from 'react';
import { ArrowRight, Check, Copy, Lock, MessageSquare, Search, Shield, Sparkles } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'signup') => void;
  onOpenLegal: (tab: 'terms' | 'privacy') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth, onOpenLegal }) => {
  const [copiedSample, setCopiedSample] = React.useState(false);

  const handleCopySample = () => {
    navigator.clipboard.writeText('4829103847').catch(() => {});
    setCopiedSample(true);
    setTimeout(() => setCopiedSample(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F8FAFC] flex flex-col">
      {/* Top Bar Contract: Zone 1 Brand | Zone 2 Nav Links | Zone 3 Actions */}
      <header className="sticky top-0 z-30 bg-[#090A0F]/85 backdrop-blur-md border-b border-white/[0.07]">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            CipherID
          </a>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#94A3B8]">
            <a href="#features" className="hover:text-white transition-colors whitespace-nowrap">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors whitespace-nowrap">
              How It Works
            </a>
            <a href="#privacy" className="hover:text-white transition-colors whitespace-nowrap">
              Privacy
            </a>
            <a href="#preview" className="hover:text-white transition-colors whitespace-nowrap">
              Interface
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton variant="compact" />
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold text-[#F8FAFC] hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('signup')}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-[#06B6D4] text-[#090A0F] text-xs font-semibold hover:bg-[#22D3EE] transition-colors whitespace-nowrap"
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-12 pb-20 lg:pt-20 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="text-xs text-[#06B6D4] font-medium tracking-wide">
                Private 10-Digit Identifier Protocol · Real-Time Cloud Sync · Zero Phone Number Required
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.08]">
                Message Anyone. Just Share Your ID.
              </h1>

              <p className="text-base sm:text-lg text-[#94A3B8] max-w-2xl leading-relaxed">
                Every account receives a unique, randomly generated 10-digit Messaging ID. Connect and chat one-to-one in real time without ever exposing your email address or personal telephone number.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-sm hover:bg-[#22D3EE] transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <span>Claim Your 10-Digit ID</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-[#11131C] border border-white/10 text-[#F8FAFC] font-semibold text-sm hover:border-white/25 transition-colors whitespace-nowrap"
                >
                  Sign In to Existing ID
                </button>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#64748B]">
                <span>10-Digit Numeric Addressing</span>
                <span aria-hidden="true">·</span>
                <span>Email Isolated by Default</span>
                <span aria-hidden="true">·</span>
                <span>Instant Block &amp; Report Controls</span>
              </div>
            </div>

            {/* Interactive Live UI Preview Card */}
            <div id="preview" className="lg:col-span-5">
              <div className="rounded-3xl bg-[#11131C] border border-white/10 p-5 sm:p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
                  <div>
                    <div className="text-xs text-[#94A3B8]">Your Assigned Messaging ID</div>
                    <div className="font-mono text-xl sm:text-2xl font-semibold text-[#06B6D4] tracking-wider mt-0.5 tabular-nums">
                      4829 · 103 · 847
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySample}
                    aria-label="Copy example Messaging ID"
                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-[#161926] border border-white/10 text-xs font-medium text-[#F8FAFC] hover:border-[#06B6D4]/50 transition-colors flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {copiedSample ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#10B981]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#06B6D4]" />
                        <span>Copy ID</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Live Conversation Preview Stream */}
                <div className="space-y-3 py-1">
                  <div className="flex items-center justify-between text-xs text-[#64748B]">
                    <span>Direct Session · Elena Vance</span>
                    <span className="font-mono tabular-nums">ID 7391 · 048 · 219</span>
                  </div>

                  <div className="rounded-2xl bg-[#161926] p-3.5 text-sm text-[#F8FAFC] max-w-[88%]">
                    <p>Got your 10-digit CipherID from the project brief. Much cleaner than sharing personal phone numbers.</p>
                    <div className="text-[11px] text-[#64748B] mt-1.5 font-mono tabular-nums">
                      09:41 · Delivered
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#083344] border border-[#06B6D4]/30 p-3.5 text-sm text-[#F8FAFC] max-w-[88%] ml-auto">
                    <p>Agreed. My email stays private and I can revoke or block any ID in one tap.</p>
                    <div className="text-[11px] text-[#22D3EE] mt-1.5 font-mono tabular-nums text-right">
                      09:42 · Read
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.07] flex items-center justify-between text-xs text-[#94A3B8]">
                  <span>Not a telephone number · App-only routing</span>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('signup')}
                    className="text-[#06B6D4] hover:underline font-medium whitespace-nowrap"
                  >
                    Try Live Messenger →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities Bento Grid */}
        <section id="features" className="border-t border-white/[0.07] py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-12">
            <div className="max-w-2xl space-y-3">
              <div className="text-xs text-[#06B6D4] font-medium">Core Architecture</div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                Designed for Direct, Identifier-Based Communication
              </h2>
              <p className="text-sm sm:text-base text-[#94A3B8]">
                CipherID separates your login credentials from your public address. Other users only ever see your display profile and your 10-digit Messaging ID.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 rounded-2xl bg-[#11131C] border border-white/[0.07] p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="text-xs text-[#06B6D4] font-mono tabular-nums">01. Unique 10-Digit Addressing</div>
                  <h3 className="text-xl font-semibold text-white">
                    Collision-Free Random Messaging IDs
                  </h3>
                  <p className="text-sm text-[#94A3B8] leading-relaxed max-w-xl">
                    Upon registration, a cryptographically random 10-digit numeric identifier is generated and verified against the global directory. It is never derived from your personal details, cannot be hijacked by other users, and is never used as a phone number.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B] font-mono tabular-nums pt-2 border-t border-white/[0.06]">
                  <span>Format: 10 Numeric Digits</span>
                  <span aria-hidden="true">·</span>
                  <span>Uniqueness: Database Enforced</span>
                  <span aria-hidden="true">·</span>
                  <span>Lookup: Exact Match Only</span>
                </div>
              </div>

              <div className="rounded-2xl bg-[#11131C] border border-white/[0.07] p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="text-xs text-[#06B6D4] font-mono tabular-nums">02. Zero Email Exposure</div>
                  <h3 className="text-xl font-semibold text-white">
                    Strict PII Isolation
                  </h3>
                  <p className="text-sm text-[#94A3B8] leading-relaxed">
                    Your email address is used strictly for authentication and password recovery inside an isolated private vault. Searches only return public profile fields.
                  </p>
                </div>
                <div className="text-xs text-[#64748B]">
                  Split-collection database security rules
                </div>
              </div>

              <div className="rounded-2xl bg-[#11131C] border border-white/[0.07] p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="text-xs text-[#06B6D4] font-mono tabular-nums">03. Real-Time Messaging</div>
                  <h3 className="text-xl font-semibold text-white">
                    Instant One-to-One Sync
                  </h3>
                  <p className="text-sm text-[#94A3B8] leading-relaxed">
                    Send text messages, quote-reply to specific messages, track delivery and read status, search conversation history, and delete your own messages at any time.
                  </p>
                </div>
                <div className="text-xs text-[#64748B]">
                  Supabase Realtime PostgreSQL streams
                </div>
              </div>

              <div className="md:col-span-2 rounded-2xl bg-[#11131C] border border-white/[0.07] p-6 sm:p-8 flex flex-col justify-between space-y-6">
                <div className="space-y-3">
                  <div className="text-xs text-[#06B6D4] font-mono tabular-nums">04. User Safety &amp; Moderation</div>
                  <h3 className="text-xl font-semibold text-white">
                    Database-Enforced Blocking &amp; Reporting
                  </h3>
                  <p className="text-sm text-[#94A3B8] leading-relaxed max-w-xl">
                    Block any Messaging ID to immediately prevent new conversations or incoming messages at the database security rule layer. Submit structured reports for Spam, Harassment, Scam, or Impersonation directly to administrators.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B] pt-2 border-t border-white/[0.06]">
                  <span>Instant Block / Unblock</span>
                  <span aria-hidden="true">·</span>
                  <span>5 Moderation Report Categories</span>
                  <span aria-hidden="true">·</span>
                  <span>Optional Discovery Toggle</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="border-t border-white/[0.07] py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 space-y-12">
            <div className="max-w-2xl space-y-3">
              <div className="text-xs text-[#06B6D4] font-medium">Workflow</div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                How CipherID Works in Three Steps
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-2xl bg-[#11131C] border border-white/[0.07] p-6 space-y-3">
                <div className="font-mono text-sm font-semibold text-[#06B6D4] tabular-nums">
                  01. Create Your Account
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Receive Your 10-Digit ID
                </h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed">
                  Sign up with your email and password or Google account. CipherID automatically assigns a unique 10-digit Messaging ID to your profile.
                </p>
              </div>

              <div className="rounded-2xl bg-[#11131C] border border-white/[0.07] p-6 space-y-3">
                <div className="font-mono text-sm font-semibold text-[#06B6D4] tabular-nums">
                  02. Enter Another User&apos;s ID
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Search by 10 Digits
                </h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed">
                  Open Find User and type the exact 10-digit Messaging ID shared with you. View their public display name and avatar without exposing private contact details.
                </p>
              </div>

              <div className="rounded-2xl bg-[#11131C] border border-white/[0.07] p-6 space-y-3">
                <div className="font-mono text-sm font-semibold text-[#06B6D4] tabular-nums">
                  03. Message in Real Time
                </div>
                <h3 className="text-lg font-semibold text-white">
                  Private One-to-One Chat
                </h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed">
                  Start an instant conversation with read status, message replies, search, and full control over who can reach you.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Transparent Privacy & Security Section */}
        <section id="privacy" className="border-t border-white/[0.07] py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-8">
            <div className="rounded-3xl bg-[#11131C] border border-white/10 p-6 sm:p-10 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center gap-2 text-xs text-[#06B6D4] font-medium">
                  <Shield className="w-4 h-4" />
                  <span>Transparent Security Model</span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  Practical Access Control &amp; Database Security
                </h2>
                <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed">
                  CipherID enforces strict authentication and document-level security rules so only conversation participants can read or send messages in a chat, and only you can view your private account email. Messages are stored in cloud infrastructure to power real-time sync across your devices—we never make exaggerated claims of military-grade or end-to-end encryption.
                </p>
              </div>
              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3">
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-sm hover:bg-[#22D3EE] transition-colors text-center"
                >
                  Create Free Account
                </button>
                <button
                  type="button"
                  onClick={() => onOpenLegal('privacy')}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-[#161926] border border-white/10 text-[#F8FAFC] font-medium text-sm hover:border-white/25 transition-colors text-center"
                >
                  Read Privacy Policy
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-white/[0.07] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B]">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-[#F8FAFC]">CipherID</span>
            <span aria-hidden="true">·</span>
            <span>10-Digit Private Messaging Application</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onOpenLegal('terms')}
              className="hover:text-[#F8FAFC] transition-colors"
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-[#F8FAFC] transition-colors"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-[#F8FAFC] transition-colors"
            >
              Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
