import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.cbee.online',
  appName: 'cbee',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
    scheme: 'cbee',
    backgroundColor: '#ffffffff',
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    App: {
      // Custom URL scheme used for OAuth deep links: app.cbee.online://callback
    },
    CapacitorHttp: {
      // Route fetch()/XMLHttpRequest through the native HTTP stack on
      // iOS/Android. Fixes the "TypeError: Failed to fetch" we see on
      // Android when setSession runs immediately after the OAuth deep link
      // wakes the WebView — the WebView's network context is still
      // settling and Chromium's fetch fails before retry.
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#ffffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: 'native',
      style: 'default',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DEFAULT',
      backgroundColor: '#ffffffff',
    },
  },
};

export default config;
