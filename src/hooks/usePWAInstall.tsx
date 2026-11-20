import React, { useEffect, useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 border border-[#B08D57] bg-[#3B281E] px-3.5 py-2 text-xs font-medium text-[#F9F6F0] transition-colors hover:bg-[#2A1C15] whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="h-3.5 w-3.5 text-[#B08D57]" />
        {compact ? 'Install App' : 'Download Mobile App'}
      </button>
    );
  }

  // Always offer an accessible Mobile App install guide for iOS Safari / browsers without native prompt yet
  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex items-center gap-2 border border-[#D8CEBA] bg-[#EFE9DD] px-3 py-1.5 text-xs font-medium text-[#3B281E] transition-colors hover:border-[#B08D57] whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="h-3.5 w-3.5 text-[#6D2932]" />
        {compact ? 'Get App' : 'Install on Mobile'}
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#3B281E]/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm border border-[#D8CEBA] bg-[#F9F6F0] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-[#B08D57]">
                  JAZMINE Mobile Atelier
                </p>
                <h3 className="mt-1 font-serif-editorial text-2xl font-semibold text-[#3B281E]">
                  Install &amp; Open as App
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="flex h-10 w-10 items-center justify-center text-[#6E5B4F] hover:text-[#3B281E] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-[#3B281E]">
                <li>1. Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.</li>
                <li>2. Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>3. Tap <strong>Add</strong> — JAZMINE opens full-screen from your Home Screen.</li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-[#3B281E]">
                <li>1. Open your browser menu (three dots in Chrome or Edge).</li>
                <li>2. Select <strong>Install JAZMINE</strong> or <strong>Add to Home screen</strong>.</li>
                <li>3. Launch directly from your app drawer anytime, even offline.</li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full bg-[#3B281E] py-2.5 text-xs font-medium uppercase tracking-wider text-[#F9F6F0] transition-colors hover:bg-[#6D2932] cursor-pointer"
            >
              Understood
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
    <div className="fixed bottom-20 left-4 z-50 flex items-center gap-2 border border-[#B08D57] bg-[#3B281E] px-3.5 py-2 text-xs font-medium text-[#F9F6F0] shadow-lg md:bottom-4">
      <WifiOff className="h-3.5 w-3.5 text-[#B08D57]" />
      <span>Offline Mode — Viewing cached atelier catalog</span>
    </div>
  );
};
