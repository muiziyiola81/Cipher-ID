import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Database,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type AuthScreenMode = 'login' | 'signup' | 'forgot';

interface AuthScreensProps {
  mode: AuthScreenMode;
  onChangeMode: (mode: AuthScreenMode) => void;
  onBackToLanding: () => void;
}

export const AuthScreens: React.FC<AuthScreensProps> = ({
  mode,
  onChangeMode,
  onBackToLanding,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!isSupabaseConfigured) {
      setErrorMsg(
        'Supabase is not yet configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.'
      );
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (mode === 'forgot') {
      setLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setInfoMsg('Password reset instructions have been sent to your email address.');
      } catch (err: unknown) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Could not send reset email. Verify the email address and try again.'
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              display_name: displayName.trim().slice(0, 60) || cleanEmail.split('@')[0],
              username: username.trim().toLowerCase().slice(0, 30) || undefined,
            },
          },
        });
        if (error) throw error;
        if (data.user && !data.session) {
          setInfoMsg(
            'Account created! Please check your email inbox to confirm your address before signing in.'
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#F8FAFC] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md space-y-6">
        <button
          type="button"
          onClick={onBackToLanding}
          className="min-h-[40px] inline-flex items-center gap-2 text-xs font-medium text-[#94A3B8] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to CipherID Home</span>
        </button>

        {!isSupabaseConfigured && (
          <div className="rounded-2xl bg-[#11131C] border border-[#06B6D4]/40 p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-[#06B6D4]">
              <Database className="w-4 h-4 shrink-0" />
              <span>Supabase Connection Required</span>
            </div>
            <p className="text-[#94A3B8] leading-relaxed">
              Add <code className="text-white font-mono">VITE_SUPABASE_URL</code> and{' '}
              <code className="text-white font-mono">VITE_SUPABASE_ANON_KEY</code> in your environment secrets and run <code className="text-white font-mono">supabase/schema.sql</code> in your Supabase SQL Editor.
            </p>
          </div>
        )}

        <div className="rounded-3xl bg-[#11131C] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="space-y-2">
            <div className="text-xs font-mono text-[#06B6D4] tabular-nums">
              {mode === 'signup' && 'NEW 10-DIGIT MESSAGING ID'}
              {mode === 'login' && 'SUPABASE AUTH ACCESS'}
              {mode === 'forgot' && 'PASSWORD RECOVERY'}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
              {mode === 'signup' && 'Create Your CipherID'}
              {mode === 'login' && 'Welcome Back'}
              {mode === 'forgot' && 'Reset Your Password'}
            </h1>
            <p className="text-sm text-[#94A3B8]">
              {mode === 'signup' &&
                'A unique random 10-digit Messaging ID will be generated automatically for your profile.'}
              {mode === 'login' &&
                'Sign in with your email and password to access your 10-digit Messaging ID and real-time chats.'}
              {mode === 'forgot' &&
                'Enter your account email and we will send a password reset link.'}
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 p-3.5 text-xs text-[#F8FAFC] flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-[#EF4444] shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {infoMsg && (
            <div
              role="status"
              className="rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 p-3.5 text-xs text-[#F8FAFC] flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
              <span>{infoMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="auth-display-name" className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="auth-display-name"
                      type="text"
                      required
                      maxLength={60}
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Alex Mercer"
                      className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-[#161926] border border-white/10 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-username" className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                    Username (optional)
                  </label>
                  <input
                    id="auth-username"
                    type="text"
                    maxLength={30}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="alex_mercer"
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#161926] border border-white/10 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-medium text-[#94A3B8] mb-1.5">
                Email Address (Never shown to other users)
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-[#161926] border border-white/10 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="auth-password" className="block text-xs font-medium text-[#94A3B8]">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg(null);
                        setInfoMsg(null);
                        onChangeMode('forgot');
                      }}
                      className="text-xs text-[#06B6D4] hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-[#161926] border border-white/10 text-sm text-white placeholder-[#64748B] focus:outline-none focus:border-[#06B6D4]"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-sm hover:bg-[#22D3EE] transition-colors disabled:opacity-50"
            >
              {loading
                ? 'Processing...'
                : mode === 'signup'
                ? 'Create Account & Generate 10-Digit ID'
                : mode === 'login'
                ? 'Sign In'
                : 'Send Reset Link'}
            </button>
          </form>

          <div className="pt-2 border-t border-white/[0.07] text-center text-xs text-[#94A3B8]">
            {mode === 'signup' && (
              <p>
                Already have a 10-digit ID?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setInfoMsg(null);
                    onChangeMode('login');
                  }}
                  className="text-[#06B6D4] font-semibold hover:underline"
                >
                  Sign In
                </button>
              </p>
            )}
            {mode === 'login' && (
              <p>
                Need a new 10-digit Messaging ID?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setInfoMsg(null);
                    onChangeMode('signup');
                  }}
                  className="text-[#06B6D4] font-semibold hover:underline"
                >
                  Create Account
                </button>
              </p>
            )}
            {mode === 'forgot' && (
              <p>
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setInfoMsg(null);
                    onChangeMode('login');
                  }}
                  className="text-[#06B6D4] font-semibold hover:underline"
                >
                  Back to Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
