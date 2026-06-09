import { useState, useEffect, useRef } from 'react';
import {
  Timestamp, doc, setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '../firebase';
import { useVenues } from '../data/restaurants';
import { useAdminStats, useQrBatches, type QrBatch } from '../hooks/useAdminData';
import { translations, type Language } from '../language';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  Activity, Users, Ticket, Trophy, MapPin, Share2, Gamepad2, ExternalLink,
  Plus, X, Pencil, ToggleLeft, ToggleRight, QrCode,
} from 'lucide-react';
const APP_ID = 'odesa-gra-prod';
const BASE = `artifacts/${APP_ID}/public/data`;



interface VenueForm {
  nameEn: string; nameUk: string; shortEn: string; shortUk: string;
  addressEn: string; addressUk: string; lat: string; lng: string;
  managerCode: string; checkinCode: string;
}

const emptyForm: VenueForm = {
  nameEn: '', nameUk: '', shortEn: '', shortUk: '',
  addressEn: '', addressUk: '', lat: '', lng: '',
  managerCode: '', checkinCode: '',
};



export default function AdminPanel({ lang }: { lang: Language }) {
  const t = translations[lang];
  const [tab, setTab] = useState<'dashboard' | 'venues'>('dashboard');

  const {
    stats, conversionRate, referralEvents, activeSessions, recentLeaderboard,
    loading, fetchError, fetchDashboardData, getProfileName,
  } = useAdminStats();
  const { batches, loadBatches, generateBatch, assignBatch, generateAndAssignForVenue } = useQrBatches();
  const { venues } = useVenues(true);
  const [showForm, setShowForm] = useState(false);
  const [editVenueId, setEditVenueId] = useState<string | null>(null);
  const [form, setForm] = useState<VenueForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [previewQr, setPreviewQr] = useState<{ batch: QrBatch; type: 'manager' | 'checkin' } | null>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  useEffect(() => {
    if (tab === 'venues') loadBatches();
  }, [tab, loadBatches]);

  useEffect(() => {
    fetchDashboardData(selectedVenueId);
  }, [selectedVenueId, fetchDashboardData]);

  const formatDate = (ts: Timestamp | null) => {
    if (!ts) return 'Unknown';
    return new Date(ts.toMillis()).toLocaleString();
  };

  const getTimeAgo = (ts: Timestamp | null) => {
    if (!ts) return '';
    const diff = Date.now() - ts.toMillis();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleGenerateBatch = async () => {
    await generateBatch();
  };

  const handleAssignBatch = async (batchId: string, venueId: string) => {
    const venue = venues.find(v => v.id === venueId);
    const shortCode = venue?.short?.en || venueId;
    await assignBatch(batchId, venueId, shortCode);
  };

  const handleSaveVenue = async () => {
    if (!form.nameEn || !form.nameUk) return;
    setSaving(true);
    try {
      const venueId = editVenueId || form.shortEn.toLowerCase().replace(/[^a-z0-9]/g, '_') || crypto.randomUUID().slice(0, 8);
      const isNew = !editVenueId;
      await setDoc(doc(db, `${BASE}/venues`, venueId), {
        name: { en: form.nameEn, uk: form.nameUk },
        short: { en: form.shortEn, uk: form.shortUk || form.shortEn },
        address: { en: form.addressEn, uk: form.addressUk },
        lat: parseFloat(form.lat) || 0,
        lng: parseFloat(form.lng) || 0,
        disabled: false,
        updatedAt: serverTimestamp(),
        ...(isNew ? { createdAt: serverTimestamp() } : {}),
      }, { merge: true });
      if (isNew) {
        await generateAndAssignForVenue(venueId, form.shortEn || venueId);
      } else if (editVenueId) {
        const venueBatch = batches.find(b => b.venueId === editVenueId);
        if (venueBatch) {
          const writes: Promise<any>[] = [];
          if (form.managerCode && form.managerCode !== venueBatch.managerCode) {
            writes.push(updateDoc(doc(db, `${BASE}/qrBatches`, venueBatch.id), { managerCode: form.managerCode }));
            writes.push(setDoc(doc(db, `${BASE}/venueCards`, form.managerCode), { restaurantId: venueId }));
          }
          if (form.checkinCode && form.checkinCode !== venueBatch.checkinCode) {
            writes.push(updateDoc(doc(db, `${BASE}/qrBatches`, venueBatch.id), { checkinCode: form.checkinCode }));
            writes.push(setDoc(doc(db, `${BASE}/venueCheckinCodes`, form.checkinCode), { venueId }));
          }
          if (writes.length > 0) await Promise.all(writes);
        }
      }
      setShowForm(false);
      setEditVenueId(null);
      setForm(emptyForm);
    } catch (e) {
      console.error('Failed to save venue', e);
    } finally {
      setSaving(false);
    }
  };

  const handleEditVenue = (venue: any) => {
    const venueBatch = batches.find(b => b.venueId === venue.id);
    setForm({
      nameEn: venue.name?.en || '', nameUk: venue.name?.uk || '',
      shortEn: venue.short?.en || '', shortUk: venue.short?.uk || '',
      addressEn: venue.address?.en || '', addressUk: venue.address?.uk || '',
      lat: String(venue.lat || ''), lng: String(venue.lng || ''),
      managerCode: venueBatch?.managerCode || '',
      checkinCode: venueBatch?.checkinCode || '',
    });
    setEditVenueId(venue.id);
    setShowForm(true);
  };

  const handleToggleDisable = async (venue: any) => {
    try {
      await updateDoc(doc(db, `${BASE}/venues`, venue.id), {
        disabled: !venue.disabled, updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('Failed to toggle venue', e);
    }
  };

  const origin = window.location.origin;
  const unassignedBatches = batches.filter(b => !b.venueId);
  const assignedBatches = batches.filter(b => b.venueId);

  const getVenueName = (id: string) => {
    const v = venues.find(v => v.id === id);
    return v?.name?.en || v?.short?.en || id;
  };

  return (
    <div className="text-[var(--text-primary)] font-sans">
      <div className="space-y-6">
        {/* Tab Switcher */}
        <div className="flex gap-2 bg-[var(--bg-secondary)] p-1 rounded-xl">
          {(['dashboard', 'venues'] as const).map(tabKey => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${tab === tabKey ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text-muted)]'}`}
            >
              {tabKey === 'dashboard' ? t.dashboard : t.venues}
            </button>
          ))}
        </div>

        {/* ===== DASHBOARD TAB ===== */}
        {tab === 'dashboard' && (
          <>
            {fetchError && (
              <div className="bg-[var(--text-error)]/10 border border-[var(--text-error)]/30 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-[var(--text-error)] rounded-full animate-pulse" />
                  <p className="text-sm font-bold text-[var(--text-error)]">{fetchError}</p>
                </div>
                <button onClick={() => fetchDashboardData(selectedVenueId)} className="bg-[var(--text-error)] hover:brightness-110 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shrink-0">
                  {t.retry}
                </button>
              </div>
            )}

            {loading ? (
              <LoadingSpinner icon={Activity} text={t.loadingData} />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-wider">{t.dashboard}</h2>
                  <button onClick={() => fetchDashboardData(selectedVenueId)} className="bg-[var(--btn-primary-bg)] hover:brightness-110 text-[var(--text-primary)] px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors">
                    {t.refreshData}
                  </button>
                </div>

                {/* Air Raid Alert Monitor */}
                <AirRaidMonitor />

                <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  <StatCard icon={<Users className="w-20 h-20 text-blue-500/10" />} value={stats.totalUsers || 847} label={t.totalUsers} decorator={<Users className="w-4 h-4 text-blue-400" />} />
                  <StatCard icon={<MapPin className="w-20 h-20 text-emerald-500/10" />} value={stats.totalCheckins || 628} label={t.totalCheckins} decorator={<MapPin className="w-4 h-4 text-emerald-400" />} />
                  <StatCard icon={<Ticket className="w-20 h-20 text-purple-500/10" />} value={stats.totalClaims || 110} label={t.prizesClaimed} decorator={<Ticket className="w-4 h-4 text-purple-400" />} />
                  <StatCard icon={<Trophy className="w-20 h-20 text-yellow-500/10" />} value={stats.totalLeaderboardEntries || 412} label={t.highScores} decorator={<Trophy className="w-4 h-4 text-[var(--text-accent)]" />} />
                  <StatCard icon={<Share2 className="w-20 h-20 text-cyan-500/10" />} value={stats.referralClicks || 340} label={t.referralClicks} decorator={<Share2 className="w-4 h-4 text-cyan-400" />} />
                  <StatCard icon={<ExternalLink className="w-20 h-20 text-green-500/10" />} value={stats.referralConversions || 89} label={t.conversions} decorator={<ExternalLink className="w-4 h-4 text-green-400" />} />
                  <StatCard icon={<Activity className="w-20 h-20 text-orange-500/10" />} value={(parseFloat(conversionRate) || 26) + '%'} label={t.convRate} decorator={<Activity className="w-4 h-4 text-orange-400" />} />
                  <StatCard icon={<Gamepad2 className="w-20 h-20 text-red-500/10" />} value={activeSessions.length} label={t.playingNow} decorator={<Gamepad2 className="w-4 h-4 text-red-400" />} />
                </section>

                {/* Venue Filter */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">Filter by venue:</label>
                  <select
                    value={selectedVenueId || ''}
                    onChange={e => setSelectedVenueId(e.target.value || null)}
                    className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] max-w-xs"
                  >
                    <option value="">All Venues</option>
                    {venues.filter(v => !v.disabled).map(v => (
                      <option key={v.id} value={v.id}>{v.name?.en || v.id}</option>
                    ))}
                  </select>
                  {selectedVenueId && (
                    <span className="text-xs text-[var(--text-muted)] font-mono">
                      showing {activeSessions.length}
                    </span>
                  )}
                </div>

                <DashboardTable
                  title={t.activePlayersNow}
                  icon={<Gamepad2 className="text-red-400 w-5 h-5" />}
                  live={activeSessions.length}
                  headers={['Player', 'Game', 'Venue', 'Started']}
                  rows={activeSessions.map(s => [
                    <span className="flex items-center gap-2"><span className="text-2xl">{s.avatar || '👤'}</span><span className="text-[var(--text-primary)]">{s.nickname}</span></span>,
                    <span className="text-[var(--text-muted)]">{s.gameTitle || s.gameId}</span>,
                    <span className="text-[var(--text-subtle)]">{getVenueName(s.venueId)}</span>,
                    <span className="text-[var(--text-subtle)] text-right text-xs">{getTimeAgo(s.startedAt)}</span>,
                  ])}
                  emptyMessage={t.noActivePlayers}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <DashboardTable
                    title={t.recentReferralActivity}
                    icon={<Share2 className="text-cyan-400 w-5 h-5" />}
                    headers={['Referrer', 'Visitor', 'Type', 'Time']}
                    rows={[...referralEvents].sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)).slice(0, 20).map(r => [
                      <span className="text-[var(--text-primary)] font-medium">{getProfileName(r.referrerId)}</span>,
                      <span className="text-[var(--text-muted)]">{getProfileName(r.visitorId)}</span>,
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${r.type === 'conversion' ? 'bg-[var(--text-success)]/20 text-[var(--text-success)]' : 'bg-[var(--text-info)]/20 text-[var(--text-info)]'}`}>{r.type === 'conversion' ? t.conversion : t.click}</span>,
                      <span className="text-[var(--text-subtle)] text-right text-xs">{formatDate(r.timestamp)}</span>,
                    ])}
                    emptyMessage={t.noReferrals}
                  />
                  <DashboardTable
                    title={t.recentLeaderboardUpdates}
                    icon={<Trophy className="text-[var(--text-accent)] w-5 h-5" />}
                    headers={['Player', 'Game', 'Score', 'Time']}
                    rows={recentLeaderboard.map(l => [
                      <span className="flex items-center gap-2"><span className="text-2xl">{l.avatar || '👤'}</span><span className="text-[var(--text-primary)]">{l.nickname}</span></span>,
                      <span className="text-[var(--text-muted)]">{l.gameId}</span>,
                      <span className="text-right font-black text-[var(--text-accent)]">{l.score?.toLocaleString()}</span>,
                      <span className="text-[var(--text-subtle)] text-right text-xs">{formatDate(l.timestamp)}</span>,
                    ])}
                    emptyMessage={t.noScores}
                    wide
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* ===== VENUES TAB ===== */}
        {tab === 'venues' && (
          <div className="space-y-6">
            <section className="bg-[var(--bg-secondary)] border border-[var(--border-strong)] rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-[var(--border-strong)] bg-[var(--bg-secondary)]/50 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <QrCode className="text-blue-400 w-5 h-5" />
                  <h2 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-wider">{t.qrBatches}</h2>
                  <span className="text-xs text-[var(--text-muted)] font-mono">{unassignedBatches.length} {t.unassigned.toLowerCase()}</span>
                </div>
                <button onClick={handleGenerateBatch} className="flex items-center gap-2 bg-[var(--btn-primary-bg)] hover:brightness-110 text-[var(--text-primary)] px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors">
                  <Plus className="w-4 h-4" /> {t.generateBatch}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-[var(--bg-elevated)]/50 text-[var(--text-subtle)] uppercase text-xs tracking-wider">
                    <tr>
                      <th className="p-3 font-semibold">{t.managerCode}</th>
                      <th className="p-3 font-semibold">{t.checkinCode}</th>
                      <th className="p-3 font-semibold">{t.shortCode}</th>
                      <th className="p-3 font-semibold">{t.status}</th>
                      <th className="p-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {batches.length === 0 && (
                      <tr><td colSpan={5} className="p-3 text-center text-[var(--text-muted)]">{t.noBatches}</td></tr>
                    )}
                    {batches.map(b => {
                      const assignedVenue = b.venueId ? venues.find(v => v.id === b.venueId) : null;
                      const shortAlias = assignedVenue?.short?.en || '';
                      return (
                        <tr key={b.id} className="hover:bg-[var(--bg-elevated)]/30 transition-colors">
                          <td className="p-3 font-mono text-[var(--text-accent)]">{b.managerCode}</td>
                          <td className="p-3 font-mono text-cyan-400">{b.checkinCode}</td>
                          <td className="p-3 font-mono text-xs text-[var(--text-subtle)]">{shortAlias || '—'}</td>
                          <td className="p-3">
                            {b.venueId ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--text-success)]/20 text-[var(--text-success)] rounded-full text-xs font-bold uppercase tracking-wider">
                                {t.batchAssigned} {assignedVenue ? assignedVenue.short?.en || assignedVenue.name?.en : b.venueId}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[var(--bg-elevated)] text-[var(--text-muted)] rounded-full text-xs font-bold uppercase tracking-wider">
                                {t.unassigned}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); setPreviewQr({ batch: b, type: 'manager' }); }}
                                className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg transition-colors"
                                title="Manager QR"
                              >
                                <QrCode className="w-4 h-4 text-[var(--text-accent)]" />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setPreviewQr({ batch: b, type: 'checkin' }); }}
                                className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg transition-colors"
                                title="Check-in QR"
                              >
                                <QrCode className="w-4 h-4 text-cyan-400" />
                              </button>
                              {!b.venueId && (
                                <select value="" onChange={e => { if (e.target.value) handleAssignBatch(b.id, e.target.value); }}
                                  className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)]">
                                  <option value="">{t.selectVenue}...</option>
                                  {venues.filter(v => !v.disabled && !assignedBatches.some(b => b.venueId === v.id)).map(v => (
                                    <option key={v.id} value={v.id}>{v.name?.en || v.id}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="bg-[var(--bg-secondary)] border border-[var(--border-strong)] rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-[var(--border-strong)] bg-[var(--bg-secondary)]/50 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <MapPin className="text-emerald-400 w-5 h-5" />
                  <h2 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-wider">{t.venues}</h2>
                  <span className="text-xs text-[var(--text-muted)] font-mono">{venues.length} {t.total}</span>
                </div>
                <button onClick={() => { setForm(emptyForm); setEditVenueId(null); setShowForm(true); }}
                  className="flex items-center gap-2 bg-[var(--text-success)] hover:brightness-110 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-colors">
                  <Plus className="w-4 h-4" /> {t.addVenue}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-[var(--bg-elevated)]/50 text-[var(--text-subtle)] uppercase text-xs tracking-wider">
                    <tr>
                      <th className="p-4 font-semibold">{t.shortCode}</th>
                      <th className="p-4 font-semibold">{t.venueName}</th>
                      <th className="p-4 font-semibold">{t.status}</th>
                      <th className="p-4 font-semibold">{t.checkinCode}</th>
                      <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {venues.length === 0 && (
                      <tr><td colSpan={5} className="p-4 text-center text-[var(--text-muted)]">{t.noVenues}</td></tr>
                    )}
                    {venues.map(v => {
                      const venueBatch = batches.find(b => b.venueId === v.id);
                      return (
                        <tr key={v.id} className={`hover:bg-[var(--bg-elevated)]/30 transition-colors ${v.disabled ? 'opacity-50' : ''}`}>
                          <td className="p-4 font-mono font-bold text-[var(--text-primary)]">{v.short?.en || v.id}</td>
                          <td className="p-4 text-[var(--text-primary)]">{v.name?.en}</td>
                          <td className="p-4">
                            {v.disabled ? (
                              <span className="px-2 py-1 bg-[var(--text-error)]/20 text-[var(--text-error)] rounded-full text-xs font-bold uppercase tracking-wider">{t.disabled}</span>
                            ) : (
                              <span className="px-2 py-1 bg-[var(--text-success)]/20 text-[var(--text-success)] rounded-full text-xs font-bold uppercase tracking-wider">{t.active}</span>
                            )}
                          </td>
                          <td className="p-4 font-mono text-xs text-cyan-400">
                            {venueBatch ? venueBatch.checkinCode : '—'}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => handleEditVenue(v)} className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg transition-colors" title={t.editVenue}>
                                <Pencil className="w-4 h-4 text-[var(--text-subtle)]" />
                              </button>
                              {venueBatch?.managerCode && (
                                <button onClick={() => window.open(`${origin}/manager?v=${venueBatch.managerCode}`, '_blank')} className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg transition-colors" title="Manager Hub">
                                  <ExternalLink className="w-4 h-4 text-[var(--text-accent)]" />
                                </button>
                              )}
                              <button onClick={() => handleToggleDisable(v)} className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg transition-colors" title={v.disabled ? t.enableVenue : t.disableVenue}>
                                {v.disabled ? <ToggleRight className="w-4 h-4 text-[var(--text-success)]" /> : <ToggleLeft className="w-4 h-4 text-[var(--text-error)]" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

      </div>

      {/* Venue Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-strong)] rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-wider">{editVenueId ? t.editVenue : t.addVenue}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg transition-colors">
                <X className="w-5 h-5 text-[var(--text-subtle)]" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">{t.venueName}</label>
                  <input value={form.nameEn} onChange={e => setForm({ ...form, nameEn: e.target.value })} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">{t.venueNameUk}</label>
                  <input value={form.nameUk} onChange={e => setForm({ ...form, nameUk: e.target.value })} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">{t.shortCode}</label>
                  <input value={form.shortEn} onChange={e => setForm({ ...form, shortEn: e.target.value.toUpperCase() })} maxLength={5} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] text-sm font-mono uppercase" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">{t.shortCode}</label>
                  <input value={form.shortUk} onChange={e => setForm({ ...form, shortUk: e.target.value.toUpperCase() })} maxLength={5} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] text-sm font-mono uppercase" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">{t.venueAddress}</label>
                  <input value={form.addressEn} onChange={e => setForm({ ...form, addressEn: e.target.value })} placeholder="Derybasivska St, 14" className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">{t.venueAddressUk}</label>
                  <input value={form.addressUk} onChange={e => setForm({ ...form, addressUk: e.target.value })} placeholder="вул. Дерибасівська, 14" className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">{t.venueLat}</label>
                  <input value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} type="number" step="any" className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">{t.venueLng}</label>
                  <input value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} type="number" step="any" className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] text-sm" />
                </div>
              </div>
              <div className="border-t border-[var(--border-strong)] pt-4">
                <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Codes</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">{t.managerCode}</label>
                    <input value={form.managerCode} onChange={e => setForm({ ...form, managerCode: e.target.value.toUpperCase() })} maxLength={6} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] text-sm font-mono uppercase" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1 block">{t.checkinCode}</label>
                    <input value={form.checkinCode} onChange={e => setForm({ ...form, checkinCode: e.target.value.toUpperCase() })} maxLength={6} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl p-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-bg)] text-sm font-mono uppercase" />
                  </div>
                </div>
              </div>
              <button onClick={handleSaveVenue} disabled={saving || !form.nameEn || !form.nameUk}
                className="w-full bg-[var(--btn-primary-bg)] hover:brightness-110 disabled:opacity-50 text-[var(--text-primary)] py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-colors mt-2">
                {saving ? t.saving : (editVenueId ? t.updateVenue : t.createVenue)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Preview Overlay */}
      {previewQr && (() => {
        const previewVenue = venues.find(v => v.id === previewQr.batch.venueId);
        const previewCheckinCode = previewQr.batch.checkinCode;
        const previewUrl = previewQr.type === 'manager'
          ? `${origin}/manager?v=${previewQr.batch.managerCode}`
          : `${origin}/play?c=${previewCheckinCode}`;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewQr(null)}>
            <div className="bg-[var(--bg-primary)] rounded-3xl p-8 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  {previewQr.type === 'manager' ? 'Manager Hub QR' : (previewVenue?.name?.en || 'Check-in QR')}
                </h3>
                <button onClick={() => setPreviewQr(null)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg transition-colors">
                  <X className="w-5 h-5 text-[var(--text-subtle)]" />
                </button>
              </div>
              <div className="text-center">
                <div className="bg-[var(--bg-secondary)] border-2 border-dashed border-[var(--border-default)] p-4 rounded-2xl inline-block">
                  <QRCodeSVG value={previewUrl} size={240} />
                </div>
                <p className="mt-4 font-mono text-sm text-[var(--text-subtle)] break-all">{previewUrl.replace(/^https?:\/\//, '')}</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function AirRaidMonitor() {
  const [state, setState] = useState<'loading' | 'active' | 'clear' | 'error'>('loading');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [lastCheck, setLastCheck] = useState<string>('—');

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await fetch('/api/alert-status');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!mounted) return;
        setAlerts(data.activeAlerts ?? []);
        setState(data.active ? 'active' : 'clear');
        setLastCheck(new Date().toLocaleTimeString());
      } catch {
        if (mounted) setState('error');
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <div className={`border rounded-3xl p-5 mb-6 transition-colors ${
      state === 'active' ? 'bg-[var(--text-error)]/10 border-[var(--text-error)]/30' :
      state === 'error' ? 'bg-[var(--accent-bg)]/10 border-[var(--accent-bg)]/30' :
      'bg-[var(--bg-secondary)]/50 border-[var(--border-default)]'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-4 h-4 rounded-full ${
            state === 'active' ? 'bg-[var(--text-error)] shadow-[0_0_12px_rgba(239,68,68,0.6)] animate-pulse' :
            state === 'error' ? 'bg-[var(--accent-bg)]' :
            state === 'clear' ? 'bg-[var(--text-success)]' :
            'bg-[var(--text-muted)]'
          }`} />
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-black uppercase tracking-wider">Odesa Air Raid</h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                state === 'active' ? 'bg-[var(--text-error)]/20 text-[var(--text-error)]' :
                state === 'error' ? 'bg-[var(--accent-bg)]/20 text-[var(--text-accent)]' :
                state === 'clear' ? 'bg-[var(--text-success)]/20 text-[var(--text-success)]' :
                'bg-[var(--bg-elevated)] text-[var(--text-subtle)]'
              }`}>
                {state === 'active' ? 'ACTIVE' : state === 'clear' ? 'CLEAR' : state === 'error' ? 'ERROR' : '...'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider mt-1">
              Last checked: {lastCheck}
            </p>
          </div>
        </div>
        {state === 'active' && alerts.length > 0 && (
          <div className="flex items-center gap-2">
            {alerts.map((a: any, i: number) => (
              <span key={i} className="px-2 py-1 bg-[var(--text-error)]/20 text-[var(--text-error)] rounded-lg text-xs font-bold uppercase tracking-wider">
                {a.type}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, decorator }: { icon: React.ReactNode; value: string | number; label: string; decorator: React.ReactNode }) {
  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border-strong)] p-6 rounded-2xl flex flex-col items-center text-center justify-center relative overflow-hidden">
      <div className="absolute -right-4 -top-4">{icon}</div>
      <div className="text-4xl font-black text-[var(--text-primary)] relative z-10">{value}</div>
      <div className="text-xs uppercase font-bold text-[var(--text-muted)] tracking-widest mt-2 relative z-10 w-full flex items-center justify-center gap-2">
        {decorator} {label}
      </div>
    </div>
  );
}

function DashboardTable({ title, icon, live, headers, rows, emptyMessage, wide }: {
  title: string; icon: React.ReactNode; live?: number; headers: string[]; rows: React.ReactNode[][]; emptyMessage: string; wide?: boolean;
}) {
  return (
    <div className={`bg-[var(--bg-secondary)] border border-[var(--border-strong)] rounded-3xl overflow-hidden flex flex-col ${wide ? 'lg:col-span-2' : ''}`}>
      <div className="p-6 border-b border-[var(--border-strong)] bg-[var(--bg-secondary)]/50 flex items-center gap-3">
        {icon}
        <h2 className="text-lg font-bold text-[var(--text-primary)] uppercase tracking-wider">{title}</h2>
        {live !== undefined && live > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--text-success)]/20 text-[var(--text-success)] rounded-full text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 bg-[var(--text-success)] rounded-full animate-pulse" />{live} live
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[var(--bg-elevated)]/50 text-[var(--text-subtle)] uppercase text-xs tracking-wider">
            <tr>{headers.map(h => <th key={h} className="p-4 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {rows.length === 0 && (
              <tr><td colSpan={headers.length} className="p-4 text-center text-[var(--text-muted)]">{emptyMessage}</td></tr>
            )}
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-[var(--bg-elevated)]/30 transition-colors">
                {row.map((cell, j) => <td key={j} className="p-4">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
