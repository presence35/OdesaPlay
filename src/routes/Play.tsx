import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVenues } from '../data/restaurants';
import { translations } from '../language';
import { isValidDailyToken } from '../utils/qr';
import { db, auth, getUserId, ensureAnonymousAuth } from '../firebase';
import { doc, setDoc, addDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore';

const APP_ID = 'odesa-gra-prod';
const BASE = `artifacts/${APP_ID}/public/data`;

export default function Play() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { venues } = useVenues();
  const lang = (localStorage.getItem('odesa_lang') as 'en' | 'uk') || 'uk';
  const t = translations[lang];

  useEffect(() => {
    ensureAnonymousAuth().catch(console.error);

    const handleScan = async () => {
      const restId = params.get('r');
      const token = params.get('t');
      const checkinCode = params.get('c');

      let resolvedRestId = restId;

      // Resolve check-in code (?c=CODE) to venue
      if (!resolvedRestId && checkinCode) {
        try {
          const codeSnap = await getDoc(doc(db, BASE, 'venueCheckinCodes', checkinCode));
          if (codeSnap.exists()) {
            const codeData = codeSnap.data();
            if (codeData.venueId) {
              resolvedRestId = codeData.venueId;
            }
          }
        } catch (e) {
          console.error('Failed to resolve check-in code', e);
        }
      }

      if (!resolvedRestId) {
        navigate('/');
        return;
      }

      const restaurant = venues.find(r => r.id === resolvedRestId);
      if (!restaurant) {
        navigate('/');
        return;
      }

      // Check-in codes from physical QRs always count as full
      const isFull = checkinCode ? true : isValidDailyToken(resolvedRestId, token);
      const mode = isFull ? 'full' : 'casual';

      // Save to local storage
      const stored = JSON.parse(localStorage.getItem('odesa_checkins') || '{}');
      stored[resolvedRestId] = { ts: new Date().toISOString(), mode };
      localStorage.setItem('odesa_checkins', JSON.stringify(stored));

      // Save to Firebase
      const userId = getUserId();
      const date = new Date().toISOString().slice(0, 10);
      const docId = `${userId}_${resolvedRestId}_${date}`;
      await setDoc(doc(db, BASE, 'checkins', docId), {
        userId,
        restaurantId: resolvedRestId,
        mode,
        timestamp: serverTimestamp(),
        gameScores: []
      }).catch(console.error);

      // Record referral click if this scan came from a referral link
      const referrer = params.get('ref');
      if (referrer && referrer !== userId) {
        addDoc(collection(db, BASE, 'referralEvents'), {
          referrerId: referrer,
          visitorId: userId,
          venueId: resolvedRestId,
          type: 'click',
          source: 'qr_scan',
          timestamp: serverTimestamp(),
          userAgent: navigator.userAgent.slice(0, 200)
        }).catch(console.error);
      }

      setToastMessage(`${t.checkedIn} ${restaurant.name[lang] || restaurant.name['uk'] || restaurant.name['en']}! 🎯`);
      setTimeout(() => {
        setToastMessage(null);
        navigate('/hunt', { state: { pendingCheckIn: resolvedRestId } });
      }, 2000);
    };

    if (venues.length > 0 || params.get('c')) {
      handleScan();
    }
  }, [params, venues, navigate, lang, t.checkedIn]);

  if (!toastMessage) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--bg-overlay)]">
      <div className="bg-[var(--accent-bg)] text-[var(--text-on-accent)] px-8 py-4 rounded-full font-black text-xl italic uppercase shadow-2xl">
        {toastMessage}
      </div>
    </div>
  );
}
