import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { App } from '@capacitor/app';
import { usePlatform } from './usePlatform';

export const useAndroidBackHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAndroid } = usePlatform();

  useEffect(() => {
    if (!isAndroid) return;

    const handleBackButton = () => {
      // If already on home page, exit the app
      if (location.pathname === '/') {
        App.exitApp();
        return;
      }
      
      // Otherwise, navigate to home page
      navigate('/');
    };

    const setupListener = async () => {
      const backButtonListener = await App.addListener('backButton', handleBackButton);
      return backButtonListener;
    };

    let listenerHandle: any;
    setupListener().then(handle => {
      listenerHandle = handle;
    });

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [isAndroid, location.pathname, navigate]);
};
