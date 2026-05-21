import { useState, useEffect } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { Capacitor } from '@capacitor/core';

const OfflineDetector = ({ children }: { children: React.ReactNode }) => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const reloadSoon = () => setTimeout(() => window.location.reload(), 800);

    if (Capacitor.isNativePlatform()) {
      (async () => {
        try {
          const { Network } = await import('@capacitor/network');
          const status = await Network.getStatus();
          setIsOnline(status.connected);
          const handle = await Network.addListener('networkStatusChange', (s) => {
            setIsOnline(s.connected);
            if (s.connected) reloadSoon();
          });
          cleanup = () => handle.remove();
        } catch (e) {
          console.warn('[network] native listener failed', e);
        }
      })();
    } else {
      const handleOnline = () => {
        setIsOnline(true);
        reloadSoon();
      };
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      cleanup = () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    return () => cleanup?.();
  }, []);

  if (!isOnline) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="text-center space-y-6">
          <DotLottieReact
            src="https://lottie.host/4c7a6c45-4c5a-4b12-a2c7-8c2c5e8c7c8c/rGQzQzQzQz.json"
            loop
            autoplay
            className="w-48 h-48 mx-auto"
          />
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">No Internet Connection</h2>
            <p className="text-muted-foreground">Please check your internet connection and try again.</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default OfflineDetector;