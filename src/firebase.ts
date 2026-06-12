import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const VAPID_KEY = 'BPijC0ZRLR51O0MA1TKswPAmdjQDuhLM_XP5LmJQQuJQY2eK4M9arkXOwq6DpyHoWsQytX04r0x-qMI82m_dcLE';

export const requestFcmToken = async (): Promise<string | null> => {
  try {
    if (typeof Notification === 'undefined') return null;
    if (Notification.permission === 'denied') {
      console.warn('[FCM] Notification permission previously denied');
      return null;
    }
    const messaging = getMessaging(app);
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    return token;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[FCM] requestFcmToken failed:', msg);
    if (msg.includes('messaging/unsupported-browser') || msg.includes('registration-token')) {
      console.warn('[FCM] Push not supported on this device/browser');
      return null;
    }
    throw new Error(msg);
  }
};

export async function syncNotificationSubscriptions(token: string, userId: string, subscribe: string[], unsubscribe: string[]) {
  try {
    const res = await fetch('/api/update-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, userId, subscribe, unsubscribe }),
    });
    if (!res.ok) console.error('[FCM] subscription sync failed:', await res.text());
  } catch (e) {
    console.error('[FCM] subscription sync error:', e);
  }
}

export const onForegroundMessage = (cb: (payload: any) => void) => {
  const messaging = getMessaging(app);
  return onMessage(messaging, cb);
};

export const getUserId = (): string => {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  let id = localStorage.getItem('odesa_user_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('odesa_user_id', id);
  }
  return id;
};

export const requireUserId = (): string => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('User not authenticated');
  return uid;
};

let authPromise: Promise<string> | null = null;

export const ensureAnonymousAuth = async (): Promise<string> => {
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  if (!authPromise) {
    authPromise = signInAnonymously(auth).then(result => result.user.uid);
  }
  return authPromise;
};
