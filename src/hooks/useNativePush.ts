import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Registers the device for native APNs (iOS) / FCM (Android) push notifications
 * and persists the token to the `device_tokens` table. On web it is a no-op
 * (web push is handled by usePushNotifications via VAPID).
 */
export const useNativePush = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (!Capacitor.isNativePlatform()) return;

    let removeRegistered: (() => void) | undefined;
    let removeError: (() => void) | undefined;
    let removeReceived: (() => void) | undefined;
    let removeAction: (() => void) | undefined;

    (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const platform = Capacitor.getPlatform() as 'ios' | 'android';

        // Android FCM requires `google-services.json` bundled into android/app/.
        // Until the client adds a real Firebase project, calling
        // PushNotifications.register() throws IllegalStateException from
        // FirebaseMessaging.getInstance() and crashes the app post-login.
        // Skip registration on Android entirely; iOS APNs has no analogous
        // hard requirement and Apple sandbox tokens work in the simulator.
        // To re-enable: drop a valid `google-services.json` into
        // android/app/ and remove this guard.
        if (platform === 'android') {
          console.log('[push] Android FCM disabled until google-services.json is added');
          return;
        }

        const perm = await PushNotifications.checkPermissions();
        let granted = perm.receive === 'granted';
        if (!granted) {
          const req = await PushNotifications.requestPermissions();
          granted = req.receive === 'granted';
        }
        if (!granted) return;

        const reg = await PushNotifications.addListener('registration', async ({ value: token }) => {
          try {
            await supabase.from('device_tokens').upsert(
              {
                user_id: user.id,
                token,
                platform,
                device_info: { ua: navigator.userAgent.slice(0, 500) },
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'token' }
            );
          } catch (e) {
            console.error('[push] save token failed', e);
          }
        });
        removeRegistered = () => reg.remove();

        const err = await PushNotifications.addListener('registrationError', (e) => {
          console.error('[push] registration error', e);
        });
        removeError = () => err.remove();

        const recv = await PushNotifications.addListener('pushNotificationReceived', (n) => {
          console.log('[push] received', n);
        });
        removeReceived = () => recv.remove();

        const act = await PushNotifications.addListener('pushNotificationActionPerformed', (a) => {
          const url = (a.notification.data as any)?.url;
          if (typeof url === 'string') window.location.href = url;
        });
        removeAction = () => act.remove();

        await PushNotifications.register();
      } catch (e) {
        console.error('[push] init failed', e);
      }
    })();

    return () => {
      removeRegistered?.();
      removeError?.();
      removeReceived?.();
      removeAction?.();
    };
  }, [user]);
};