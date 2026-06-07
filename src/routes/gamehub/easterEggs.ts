import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, getUserId, ensureAnonymousAuth } from '../../firebase';
import { APP_ID } from './constants';

export interface EasterEgg {
  id: string;
  gameId: string;
  icon: string;
  name: { en: string; uk: string };
  hint: { en: string; uk: string };
  order: number;
}

export const EASTER_EGG_DEFINITIONS: EasterEgg[] = [
  // Populated post-launch:
  // { id: 'shooter_secret', gameId: 'shooter', icon: '🎯', name: { en: 'Secret Target', uk: 'Таємна ціль' }, hint: { en: 'Shoot the unusual...', uk: 'Стріляй у незвичайне...' }, order: 1 },
];

export function useEggFindings() {
  const [findings, setFindings] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    ensureAnonymousAuth().then(uid => {
      unsub = onSnapshot(
        query(collection(db, 'artifacts', APP_ID, 'public', 'data', 'easterEggFindings'), where('uid', '==', uid)),
        snap => {
          setFindings(new Set(snap.docs.map(d => d.data().eggId)));
          setLoading(false);
        },
        () => setLoading(false)
      );
    }).catch(() => setLoading(false));
    return () => unsub();
  }, []);

  return { findings, loading };
}
