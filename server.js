const express = require('express');
const path = require('path');
const { readFileSync, existsSync } = require('fs');

// ── Firebase Admin (optional — only loads if service-account.json exists) ────
let admin, adminDb;
const SA_PATH = path.join(__dirname, 'service-account.json');
if (existsSync(SA_PATH)) {
  try {
    const fbAdmin = require('firebase-admin');
    admin = fbAdmin;
    const sa = JSON.parse(readFileSync(SA_PATH, 'utf-8'));
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    const { getFirestore } = require('firebase-admin/firestore');
    adminDb = getFirestore('ai-studio-2a6d6b8a-4e14-4fbf-a82e-397e0cd65800');
    console.log('[FCM] Firebase Admin initialized');
  } catch (e) {
    console.warn('[FCM] Failed to init Firebase Admin:', e.message);
  }
} else {
  console.warn('[FCM] service-account.json not found — push notifications disabled');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── Odesa air raid alert poller ────────────────────────────────────────────
let odesaAlertActive = false;
let odesaAlertData = { activeAlerts: [], regionEngName: 'Odeska region', lastUpdate: null };
const ODESA_REGION_ID = 18;
const SIREN_API = `https://siren.pp.ua/api/v3/alerts/${ODESA_REGION_ID}`;

async function sendToTopic(topic, title, body, url = '/') {
  if (!admin) return;
  try {
    await admin.messaging().send({ topic, notification: { title, body }, data: { url } });
    console.log(`[FCM] Sent to topic "${topic}"`);
  } catch (e) {
    console.error(`[FCM] Topic "${topic}" error:`, e.message);
  }
}

let idleCheckInterval = null;

async function checkOdesaAlerts() {
  try {
    const res = await fetch(SIREN_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const region = data[0] ?? {};
    odesaAlertData = {
      activeAlerts: region.activeAlerts ?? [],
      regionEngName: region.regionEngName ?? 'Odeska region',
      lastUpdate: region.lastUpdate ?? null,
    };
    const hasAirAlert = odesaAlertData.activeAlerts.some(a => a.type === 'AIR');

    if (hasAirAlert && !odesaAlertActive) {
      odesaAlertActive = true;
      console.log('[ALERT] 🚨 Odesa air raid ACTIVE — pushing to topic');
      sendToTopic(
        'odesa_alerts',
        '🚨 Air Raid — Odesa',
        'Sirens active! Defend the sky in Russian Drones.',
        '/drones?alert=1'
      );
    } else if (!hasAirAlert && odesaAlertActive) {
      odesaAlertActive = false;
      console.log('[ALERT] ✅ Odesa all clear');
      sendToTopic(
        'odesa_alerts',
        '✅ All Clear — Odesa',
        'The danger has passed. Check the leaderboard!',
        '/'
      );
    }
  } catch (err) {
    console.error('[ALERT] Poll error:', err.message);
  }
}

// ── Idle re-engagement loop ─────────────────────────────────────────────────
async function sendIdleReminders() {
  await sendToTopic(
    'game_reminders',
    '🕹️ Miss you at OdesaPlay!',
    'Play a quick game and earn rewards.',
    '/'
  );
}

checkOdesaAlerts();
setInterval(checkOdesaAlerts, 300_000); // 5 min

// Start idle re-engagement every 72 hours after initial 72h delay
setTimeout(() => {
  sendIdleReminders();
  idleCheckInterval = setInterval(sendIdleReminders, 259_200_000); // 72h
}, 259_200_000); // 72h

// ── Tournament launch notifier ───────────────────────────────────────────────
const notifiedTournaments = new Set();

async function checkNewTournaments() {
  if (!admin) return;
  try {
    const snap = await adminDb.collectionGroup('venueTournaments')
      .where('status', '==', 'active')
      .get();
    snap.forEach(doc => {
      const id = doc.id;
      if (notifiedTournaments.has(id)) return;
      notifiedTournaments.add(id);
      const data = doc.data();
      sendToTopic(
        'tournament_launches',
        `🏆 New Tournament at ${data.venueName}!`,
        `Prize: ${data.prize} — Play now!`,
        `/${data.gameId || 'drones'}`
      );
    });
  } catch (e) {
    console.error('[TOURNAMENT] Poll error:', e.message);
  }
}

setInterval(checkNewTournaments, 30_000); // 30s

// ── Express server ──────────────────────────────────────────────────────────
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('/api/alert-status', (_req, res) => {
  res.json({ active: odesaAlertActive, ...odesaAlertData });
});

app.post('/api/update-subscriptions', async (req, res) => {
  if (!admin) return res.status(503).json({ error: 'FCM not configured' });
  const { token, userId, subscribe = [], unsubscribe = [] } = req.body;
  if (!token || !userId) return res.status(400).json({ error: 'token and userId required' });
  try {
    if (subscribe.length) {
      await admin.messaging().subscribeToTopic(token, subscribe);
    }
    if (unsubscribe.length) {
      await admin.messaging().unsubscribeFromTopic(token, unsubscribe);
    }
    res.json({ success: true });
  } catch (e) {
    console.error('[FCM] subscription error:', e.message);
    if (e.code === 'messaging/registration-token-not-registered') {
      try {
        const profileRef = adminDb
          .collection('artifacts').doc('odesa-gra-prod')
          .collection('public').doc('data')
          .collection('profiles').doc(userId);
        await profileRef.update({
          'notifications.fcmToken': admin.firestore.FieldValue.delete(),
          'notifications.fcmTokenUpdatedAt': admin.firestore.FieldValue.delete(),
        });
        console.log('[FCM] Removed invalid token for user', userId);
      } catch (cleanupErr) {
        console.error('[FCM] cleanup error:', cleanupErr);
      }
    }
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
