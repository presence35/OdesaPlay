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
    adminDb = getFirestore();
    console.log('[FCM] Firebase Admin initialized');
  } catch (e) {
    console.warn('[FCM] Failed to init Firebase Admin:', e.message);
  }
} else {
  console.warn('[FCM] service-account.json not found — push notifications disabled');
}

const app = express();
const PORT = process.env.PORT || 3000;

// ── Odesa air raid alert poller ────────────────────────────────────────────
let odesaAlertActive = false;
let odesaAlertData = { activeAlerts: [], regionEngName: 'Odeska region', lastUpdate: null };
const ODESA_REGION_ID = 18;
const SIREN_API = `https://siren.pp.ua/api/v3/alerts/${ODESA_REGION_ID}`;

async function sendPushToAll(title, body, url = '/?game=drones&alert=1') {
  if (!admin) return;
  try {
    const profilesSnap = await adminDb.collectionGroup('profiles').get();
    const tokens = [];
    profilesSnap.forEach(doc => {
      const n = doc.data().notifications;
      if (n?.droneAlerts && n?.fcmToken) tokens.push(n.fcmToken);
    });
    if (tokens.length === 0) return;
    const message = { notification: { title, body }, data: { url }, tokens };
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM] Sent to ${response.successCount} devices (${response.failureCount} failed)`);
    if (response.failureCount > 0) {
      response.responses.forEach((r, i) => {
        if (!r.success) console.warn(`[FCM] Token ${i} failed:`, r.error?.message);
      });
    }
  } catch (e) {
    console.error('[FCM] send error:', e.message);
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
      console.log('[ALERT] 🚨 Odesa air raid ACTIVE — pushing to players');
      sendPushToAll(
        '🚨 Air Raid — Odesa',
        'Sirens active! Defend the sky in Russian Drones.',
        '/?game=drones&alert=1'
      );
    } else if (!hasAirAlert && odesaAlertActive) {
      odesaAlertActive = false;
      console.log('[ALERT] ✅ Odesa all clear');
      sendPushToAll(
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
  if (!admin) return;
  try {
    const profilesSnap = await adminDb.collectionGroup('profiles').get();
    const tokens = [];
    profilesSnap.forEach(doc => {
      const n = doc.data().notifications;
      if (n?.gameReminders && n?.fcmToken) {
        tokens.push(n.fcmToken);
      }
    });
    if (tokens.length === 0) return;
    const message = {
      notification: { title: '🕹️ Miss you at OdesaPlay!', body: 'Play a quick game and earn rewards.' },
      data: { url: '/' },
      tokens,
    };
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM] Idle reminders sent to ${response.successCount} devices`);
  } catch (e) {
    console.error('[FCM] Idle reminder error:', e.message);
  }
}

checkOdesaAlerts();
setInterval(checkOdesaAlerts, 300_000); // 5 min

// Start idle re-engagement every 72 hours after initial 72h delay
setTimeout(() => {
  sendIdleReminders();
  idleCheckInterval = setInterval(sendIdleReminders, 259_200_000); // 72h
}, 259_200_000); // 72h

// ── Express server ──────────────────────────────────────────────────────────
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('/api/alert-status', (_req, res) => {
  res.json({ active: odesaAlertActive, ...odesaAlertData });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
