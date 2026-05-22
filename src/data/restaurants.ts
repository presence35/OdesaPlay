import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, ensureAnonymousAuth } from '../firebase';

const APP_ID = 'odesa-gra-prod';
const BASE = `artifacts/${APP_ID}/public/data`;

export interface Restaurant {
  id: string;
  name: { en: string; uk: string };
  short: { en: string; uk: string };
  lat: number;
  lng: number;
  address: { en: string; uk: string };
  disabled?: boolean;
}

export function useVenues(includeDisabled = false) {
  const [venues, setVenues] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    
    // Ensure we are authenticated before querying
    ensureAnonymousAuth().then(() => {
      unsub = onSnapshot(
        collection(db, BASE, 'venues'),
        snapshot => {
          const list: Restaurant[] = [];
          snapshot.forEach(d => {
            const data = d.data() as Omit<Restaurant, 'id'>;
            if (!includeDisabled && data.disabled) return;
            list.push({ id: d.id, ...data });
          });
          setVenues(list);
          setLoading(false);
        },
        err => {
          console.error('Failed to load venues from Firestore', err);
          setLoading(false);
        }
      );
    }).catch(err => {
      console.error('Failed to authenticate before loading venues', err);
      setLoading(false);
    });

    return () => unsub();
  }, [includeDisabled]);

  return { venues, loading };
}


