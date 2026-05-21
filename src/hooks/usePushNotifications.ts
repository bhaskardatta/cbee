import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/sonner';

const VAPID_PUBLIC_KEY = 'BFkoiTnUBleEldQ4DcEjtwnkstQtzBq4LKJMdLBWu-lPFhQiWUTAmew-IvH3AnVWEH9ubb1VK5jVjffDvn1M8-M';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    // Check if push notifications are supported
    const checkSupport = () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        setIsSupported(true);
        initializeServiceWorker();
      } else {
        console.log('Push notifications not supported');
        setIsSupported(false);
      }
    };

    checkSupport();
  }, []);

  const initializeServiceWorker = async () => {
    try {
      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered:', registration);

      // Check for existing subscription
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        setSubscription(existingSubscription);
        setIsSubscribed(true);
        console.log('Existing subscription found');
      }

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  };

  const subscribeToPush = async () => {
    if (!isSupported || !user) {
      console.log('Push notifications not supported or user not authenticated');
      return false;
    }

    try {
      // Check current permission status first
      const currentPermission = Notification.permission;
      
      if (currentPermission === 'denied') {
        toast('Push notifications are blocked. Please enable them in your browser settings.');
        return false;
      }
      
      // Only request permission if it's not already granted
      let permission: NotificationPermission = currentPermission;
      if (currentPermission === 'default') {
        permission = await Notification.requestPermission();
      }
      
      if (permission !== 'granted') {
        toast('Push notifications permission denied. You can enable them later in settings.');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
      });

      // Send subscription to backend
      const { error } = await supabase.functions.invoke('register-push', {
        body: {
          subscription: pushSubscription.toJSON(),
          deviceInfo: {
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) {
        console.error('Failed to register push subscription:', error);
        toast('Failed to enable push notifications');
        return false;
      }

      setSubscription(pushSubscription);
      setIsSubscribed(true);
      return true;

    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      toast('Failed to enable push notifications');
      return false;
    }
  };

  const unsubscribeFromPush = async () => {
    if (!subscription) return false;

    try {
      await subscription.unsubscribe();
      setSubscription(null);
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      toast('Failed to disable push notifications');
      return false;
    }
  };

  const sendNotification = async (userId: string, title: string, body: string, data?: any) => {
    if (!user) return;

    try {
      const { error } = await supabase.functions.invoke('send-push', {
        body: {
          userId,
          title,
          body,
          icon: '/favicon.ico',
          data
        }
      });

      if (error) {
        console.error('Failed to send push notification:', error);
      }
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  };

  return {
    isSupported,
    isSubscribed,
    subscribeToPush,
    unsubscribeFromPush,
    sendNotification
  };
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}