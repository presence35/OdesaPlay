import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, doc } from 'firebase/firestore';
import { db, ensureAnonymousAuth } from '../firebase';
import { VenueTournament } from '../routes/gamehub/types';

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

export function useActiveTournaments() {
  const [tournaments, setTournaments] = useState<VenueTournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    ensureAnonymousAuth().then(() => {
      unsub = onSnapshot(
        query(
          collection(db, BASE, 'venueTournaments'),
          where('status', '==', 'active'),
          orderBy('expiresAt')
        ),
        snapshot => {
          setTournaments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VenueTournament)));
          setLoading(false);
        },
        err => {
          console.error('Failed to load tournaments', err);
          setLoading(false);
        }
      );
    }).catch(() => setLoading(false));
    return () => unsub();
  }, []);

  return { tournaments, loading };
}

export function useTournament(id: string | null) {
  const [tournament, setTournament] = useState<VenueTournament | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    let unsub = () => {};
    ensureAnonymousAuth().then(() => {
      unsub = onSnapshot(
        doc(db, BASE, 'venueTournaments', id),
        docSnap => {
          if (docSnap.exists()) {
            setTournament({ id: docSnap.id, ...docSnap.data() } as VenueTournament);
          } else {
            setTournament(null);
          }
          setLoading(false);
        },
        err => {
          console.error('Failed to load tournament', err);
          setLoading(false);
        }
      );
    }).catch(() => setLoading(false));
    return () => unsub();
  }, [id]);

  return { tournament, loading };
}

export function useTournamentLeaderboard(tournamentId: string | null) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) { setLoading(false); return; }
    let unsub = () => {};
    ensureAnonymousAuth().then(() => {
      unsub = onSnapshot(
        query(
          collection(db, BASE, 'leaderboards'),
          where('tournamentId', '==', tournamentId),
          orderBy('score', 'desc'),
          limit(50)
        ),
        snapshot => {
          setEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        err => {
          console.error('Failed to load tournament leaderboard', err);
          setLoading(false);
        }
      );
    }).catch(() => setLoading(false));
    return () => unsub();
  }, [tournamentId]);

  return { entries, loading };
}


