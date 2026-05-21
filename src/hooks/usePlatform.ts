import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

export const usePlatform = () => {
  const [isNative, setIsNative] = useState(false);
  const [platform, setPlatform] = useState<'web' | 'ios' | 'android'>('web');

  useEffect(() => {
    const native = Capacitor.isNativePlatform();
    const currentPlatform = Capacitor.getPlatform();
    
    setIsNative(native);
    setPlatform(currentPlatform as 'web' | 'ios' | 'android');
  }, []);

  return {
    isNative,
    platform,
    isIOS: platform === 'ios',
    isAndroid: platform === 'android',
    isWeb: platform === 'web'
  };
};