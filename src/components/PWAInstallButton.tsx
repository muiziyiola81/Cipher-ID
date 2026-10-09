import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'full' }> = ({
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        aria-label="Install CipherID App"
        className={
          variant === 'full'
            ? 'w-full min-h-[44px] flex items-center justify-between px-4 py-3 rounded-xl bg-[#11131C] border border-white/10 text-sm font-medium text-[#F8FAFC] hover:border-[#06B6D4]/50 transition-colors'
            : 'min-h-[40px] px-3.5 py-2 rounded-lg bg-[#11131C] border border-white/10 text-xs font-medium text-[#F8FAFC] hover:border-[#06B6D4]/60 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0'
        }
      >
        <span className="flex items-center gap-2">
          <Download className="w-4 h-4 text-[#06B6D4]" />
          <span>{isIOS ? 'Install on iOS' : 'Install App'}</span>
        </span>
        {variant === 'full' && (
          <span className="text-xs text-[#94A3B8]">Standalone PWA</span>
        )}
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#11131C] border border-white/10 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-[#06B6D4]" />
                <h3 id="pwa-install-title" className="text-base font-semibold text-white">
                  Install CipherID as an App
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close installation guide"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-[#94A3B8] leading-relaxed">
              {isIOS ? (
                <>
                  <p>To install CipherID on your iPhone or iPad home screen:</p>
                  <ol className="list-decimal list-inside space-y-2 text-[#F8FAFC]">
                    <li>Tap the <strong>Share</strong> icon in your Safari navigation bar.</li>
                    <li>Scroll down and select <strong>Add to Home Screen</strong>.</li>
                    <li>Tap <strong>Add</strong> in the top-right corner to launch in standalone mode.</li>
                  </ol>
                </>
              ) : (
                <>
                  <p>Install CipherID directly from your browser for a fast, full-screen standalone messaging experience:</p>
                  <ol className="list-decimal list-inside space-y-2 text-[#F8FAFC]">
                    <li>Click the <strong>Install</strong> icon in your browser&apos;s address bar (or open the browser menu).</li>
                    <li>Select <strong>Install CipherID Private Messaging</strong>.</li>
                  </ol>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-[#06B6D4] text-[#090A0F] font-semibold text-sm hover:bg-[#22D3EE] transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-[#EF4444]/95 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Network disconnected — Reconnecting automatically when online</span>
    </div>
  );
};
