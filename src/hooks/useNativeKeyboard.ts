import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Cross-platform keyboard detection. Uses native Capacitor Keyboard plugin
 * when running on iOS/Android, and falls back to visualViewport on web.
 */
export const useNativeKeyboard = () => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    let cleanups: Array<() => void> = [];

    if (Capacitor.isNativePlatform()) {
      (async () => {
        try {
          const { Keyboard } = await import('@capacitor/keyboard');
          const willShow = await Keyboard.addListener('keyboardWillShow', (info) => {
            setKeyboardHeight(info.keyboardHeight);
            setIsKeyboardOpen(true);
            document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
          });
          const willHide = await Keyboard.addListener('keyboardWillHide', () => {
            setKeyboardHeight(0);
            setIsKeyboardOpen(false);
            document.documentElement.style.setProperty('--keyboard-height', `0px`);
          });
          cleanups.push(() => willShow.remove(), () => willHide.remove());
        } catch (e) {
          console.warn('[keyboard] native listener failed', e);
        }
      })();
    } else {
      const handler = () => {
        const vv = window.visualViewport;
        if (!vv) return;
        const diff = window.innerHeight - vv.height;
        const open = diff > 150;
        setKeyboardHeight(open ? diff : 0);
        setIsKeyboardOpen(open);
        document.documentElement.style.setProperty('--keyboard-height', `${open ? diff : 0}px`);
      };
      window.visualViewport?.addEventListener('resize', handler);
      cleanups.push(() => window.visualViewport?.removeEventListener('resize', handler));
    }

    return () => cleanups.forEach((c) => c());
  }, []);

  return { keyboardHeight, isKeyboardOpen };
};