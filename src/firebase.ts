import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

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
