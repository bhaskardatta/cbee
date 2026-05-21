import { useEffect } from 'react';
import { usePlatform } from '@/hooks/usePlatform';
import { useTheme } from '@/components/ThemeProvider';

const StatusBarConfig = () => {
  const { isNative, isAndroid } = usePlatform();
  const { theme } = useTheme();

  useEffect(() => {
    if (!isNative) return;
    let cancelled = false;

    (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        if (cancelled) return;
        // Don't overlay the WebView; let safe-area insets do their job.
        try { await StatusBar.setOverlaysWebView({ overlay: false }); } catch {}

        if (theme === 'dark') {
          await StatusBar.setStyle({ style: Style.Dark });
          if (isAndroid) await StatusBar.setBackgroundColor({ color: '#121212' });
        } else {
          await StatusBar.setStyle({ style: Style.Light });
          if (isAndroid) await StatusBar.setBackgroundColor({ color: '#FFFFFF' });
        }
      } catch (error) {
        console.log('StatusBar not available:', error);
      }

      // Hide splash once UI is mounted
      try {
        const { SplashScreen } = await import('@capacitor/splash-screen');
        await SplashScreen.hide({ fadeOutDuration: 300 });
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [isNative, isAndroid, theme]);

  return null;
};

export default StatusBarConfig;