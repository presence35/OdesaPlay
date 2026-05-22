import { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, Timestamp, doc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, ensureAnonymousAuth } from '../firebase';
import { generateRandomCode } from '../utils/codes';

const APP_ID = 'odesa-gra-prod';
const BASE = `artifacts/${APP_ID}/public/data`;

export interface QrBatch {
  id: string;
  batchLabel: string;
  managerCode: string;
  checkinCode: string;
  venueId: string | null;
  createdAt: Timestamp | null;
}

export interface AdminStats {
  totalUsers: number;
  totalCheckins: number;
  totalClaims: number;
  totalLeaderboardEntries: number;
  referralClicks: number;
  referralConversions: number;
  activePlayers: number;
}

export function useAdminStats() {
  const [authReady, setAuthReady] = useState(false);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0, totalCheckins: 0, totalClaims: 0, totalLeaderboardEntries: 0,
    referralClicks: 0, referralConversions: 0, activePlayers: 0,
  });
  const [referralEvents, setReferralEvents] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [recentLeaderboard, setRecentLeaderboard] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    ensureAnonymousAuth()
      .then(() => setAuthReady(true))
      .catch(console.error);
  }, []);

  const fetchDashboardData = useCallback(async (venueFilter?: string | null) => {
    try {
      setLoading(true);
      setFetchError(null);

      const [profilesSnap, checkinsSnap, claimsSnap, leaderboardsSnap, referralSnap, sessionsSnap] =
        await Promise.all([
          getDocs(collection(db, `${BASE}/profiles`)),
          getDocs(collection(db, `${BASE}/checkins`)),
          getDocs(collection(db, `${BASE}/claims`)),
          getDocs(collection(db, `${BASE}/leaderboards`)),
          getDocs(collection(db, `${BASE}/referralEvents`)),
          getDocs(collection(db, `${BASE}/activeSessions`)),
        ]);

      const pmap: Record<string, any> = {};
      profilesSnap.forEach(d => { pmap[d.id] = d.data(); });
      setProfilesMap(pmap);

      let referralData = referralSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // Filter stale sessions by heartbeat
      const STALE_HEARTBEAT_MS = 2 * 60 * 1000;
      const STALE_STARTED_MS = 5 * 60 * 1000;
      const now = Date.now();
      let sessionsData = sessionsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(s => {
          if (s.active === false) return false;
          if (s.lastHeartbeat) {
            return now - s.lastHeartbeat.toMillis() < STALE_HEARTBEAT_MS;
          }
          if (s.startedAt) {
            return now - s.startedAt.toMillis() < STALE_STARTED_MS;
          }
          return false;
        });

      // Apply venue filter
      let checkinsCount = checkinsSnap.size;
      let claimsCount = claimsSnap.size;
      if (venueFilter) {
        checkinsCount = checkinsSnap.docs.filter(d => d.data().restaurantId === venueFilter).length;
        claimsCount = claimsSnap.docs.filter(d => d.data().venueId === venueFilter).length;
        sessionsData = sessionsData.filter(s => s.venueId === venueFilter);
        referralData = referralData.filter(r => r.venueId === venueFilter);
      }

      setActiveSessions(sessionsData);
      setReferralEvents(referralData);

      let lbData = leaderboardsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      if (venueFilter) {
        lbData = lbData.filter(l => l.venueId === venueFilter);
      }

      setStats({
        totalUsers: profilesSnap.size,
        totalCheckins: checkinsCount,
        totalClaims: claimsCount,
        totalLeaderboardEntries: lbData.length,
        referralClicks: referralData.filter(r => r.type === 'click').length,
        referralConversions: referralData.filter(r => r.type === 'conversion').length,
        activePlayers: sessionsData.length,
      });

      lbData.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setRecentLeaderboard(lbData.slice(0, 20));
    } catch (e) {
      console.error('Failed to fetch admin data', e);
      setFetchError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authReady) fetchDashboardData();
  }, [authReady, fetchDashboardData]);

  const conversionRate = stats.referralClicks > 0
    ? ((stats.referralConversions / stats.referralClicks) * 100).toFixed(1) : '0.0';

  return {
    stats, conversionRate, referralEvents, activeSessions, recentLeaderboard,
    profilesMap, loading, fetchError, fetchDashboardData,
    getProfileName: (uid: string) => profilesMap[uid]?.nickname || uid.substring(0, 8),
  };
}

export function useQrBatches() {
  const [batches, setBatches] = useState<QrBatch[]>([]);

  const loadBatches = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, `${BASE}/qrBatches`));
      const list = snap.docs.filter(d => !d.data()._deleted).map(d => {
        const data = d.data();
        return {
          id: d.id,
          batchLabel: data.batchLabel ?? '',
          managerCode: data.managerCode ?? '',
          checkinCode: data.checkinCode ?? '',
          venueId: data.venueId ?? null,
          createdAt: data.createdAt ?? null,
        } as QrBatch;
      });
      list.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setBatches(list);
    } catch (e) {
      console.error('Failed to load batches', e);
    }
  }, []);

  const generateBatch = useCallback(async () => {
    try {
      const managerCode = generateRandomCode(6);
      const checkinCode = generateRandomCode(6);
      const batchRef = doc(collection(db, `${BASE}/qrBatches`));
      const batchNum = batches.length + 1;

      await setDoc(batchRef, {
        batchLabel: `Batch #${batchNum}`,
        managerCode,
        checkinCode,
        venueId: null,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, `${BASE}/venueCards`, managerCode), {
        restaurantId: null,
      });

      await setDoc(doc(db, `${BASE}/venueCheckinCodes`, checkinCode), {
        venueId: null,
      });

      const newBatch: QrBatch = {
        id: batchRef.id,
        batchLabel: `Batch #${batchNum}`,
        managerCode,
        checkinCode,
        venueId: null,
        createdAt: null,
      };
      setBatches(prev => [newBatch, ...prev]);
      return newBatch;
    } catch (e) {
      console.error('Failed to generate batch', e);
      return null;
    }
  }, [batches.length]);

  const assignBatch = useCallback(async (batchId: string, venueId: string, venueShortCode: string) => {
    try {
      const batch = batches.find(b => b.id === batchId);
      if (!batch) return;

      await updateDoc(doc(db, `${BASE}/qrBatches`, batchId), { venueId });
      if (batch.managerCode) {
        await updateDoc(doc(db, `${BASE}/venueCards`, batch.managerCode), { restaurantId: venueId });
      } else {
        console.warn('assignBatch: batch has no managerCode, skipping venueCards update', batchId);
      }
      if (batch.checkinCode) {
        await updateDoc(doc(db, `${BASE}/venueCheckinCodes`, batch.checkinCode), { venueId });
      } else {
        console.warn('assignBatch: batch has no checkinCode, skipping venueCheckinCodes update', batchId);
      }
      await setDoc(doc(db, `${BASE}/venueCheckinCodes`, venueShortCode), { venueId });

      setBatches(prev => prev.map(b => b.id === batchId ? { ...b, venueId } : b));
    } catch (e) {
      console.error('Failed to assign batch', e);
    }
  }, [batches]);

  const generateAndAssignForVenue = useCallback(async (venueId: string, venueShortCode: string) => {
    try {
      const managerCode = generateRandomCode(6);
      const checkinCode = generateRandomCode(6);
      const batchRef = doc(collection(db, `${BASE}/qrBatches`));
      const batchNum = batches.length + 1;

      await Promise.all([
        setDoc(batchRef, {
          batchLabel: `Batch #${batchNum}`,
          managerCode,
          checkinCode,
          venueId,
          createdAt: serverTimestamp(),
        }),
        setDoc(doc(db, `${BASE}/venueCards`, managerCode), { restaurantId: venueId }),
        setDoc(doc(db, `${BASE}/venueCheckinCodes`, checkinCode), { venueId }),
        setDoc(doc(db, `${BASE}/venueCheckinCodes`, venueShortCode), { venueId }),
      ]);

      const newBatch: QrBatch = {
        id: batchRef.id,
        batchLabel: `Batch #${batchNum}`,
        managerCode,
        checkinCode,
        venueId,
        createdAt: null,
      };
      setBatches(prev => [newBatch, ...prev]);
      return newBatch;
    } catch (e) {
      console.error('Failed to generate and assign for venue', e);
      return null;
    }
  }, [batches.length]);

  return { batches, loadBatches, generateBatch, assignBatch, generateAndAssignForVenue };
}

