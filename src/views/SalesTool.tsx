import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Users, TrendingUp, Repeat, DollarSign, MapPin, Activity, Share2, Gamepad2,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { translations, type Language } from '../language';

const COLORS = { qr: '#3b82f6', hunt: '#10b981', cross: '#f59e0b' };

const GAME_NAMES: Record<string, { en: string; uk: string }> = {
  drone: { en: 'Drone Spotter', uk: 'Дрони' },
  football: { en: 'Football Frenzy', uk: 'Футбол' },
  marshrutka: { en: 'Marshrutka Rider', uk: 'Маршрутка' },
  trivia: { en: 'Trivia Master', uk: 'Вікторина' },
  shooter: { en: 'Shooter', uk: 'Стрілялка' },
};

const MOCK_SOURCES = [
  { name: 'qr', value: 442 },
  { name: 'hunt', value: 238 },
  { name: 'cross', value: 170 },
];

const MOCK_FUNNEL = [
  { stage: 'entered', value: 1200, prev: 0 },
  { stage: 'scanned', value: 847, prev: 1200 },
  { stage: 'playedGame', value: 524, prev: 847 },
  { stage: 'joinedHunt', value: 312, prev: 524 },
  { stage: 'claimedPrize', value: 110, prev: 312 },
];

const MOCK_GAMES_PLAYED = [
  { key: 'drone', plays: 205 }, { key: 'football', plays: 178 },
  { key: 'trivia', plays: 142 }, { key: 'marshrutka', plays: 98 },
  { key: 'shooter', plays: 67 },
];

const MOCK_CROSS = [
  { restaurant: 'Pizza Napoli', guests: 23 }, { restaurant: 'Bistro 7', guests: 18 },
  { restaurant: 'Sushi House', guests: 15 }, { restaurant: 'Burger Lab', guests: 12 },
  { restaurant: 'Pasta Roma', guests: 8 },
];

const MOCK_WEEKLY = [
  { week: 1, entered: 200, scanned: 140, played: 100 },
  { week: 2, entered: 450, scanned: 320, played: 240 },
  { week: 3, entered: 800, scanned: 580, played: 420 },
  { week: 4, entered: 1200, scanned: 847, played: 635 },
];

const PIE_COLORS = [COLORS.qr, COLORS.hunt, COLORS.cross];
const TIME_SCALE: Record<string, number> = { today: 1 / 30, week: 7 / 30, month: 1, all: 1 };

type TimePeriod = 'today' | 'week' | 'month' | 'all';

const KPI_BASE = [
  { icon: <Users className="w-5 h-5" />, labelKey: 'totalCustomers' as const, target: 1247, color: 'from-blue-600 to-blue-800' },
  { icon: <TrendingUp className="w-5 h-5" />, labelKey: 'weeklyGrowthRate' as const, target: 23, suffix: '%' as const, color: 'from-emerald-600 to-emerald-800' },
  { icon: <Repeat className="w-5 h-5" />, labelKey: 'repeatRate' as const, target: 41, suffix: '%' as const, color: 'from-purple-600 to-purple-800' },
  { icon: <DollarSign className="w-5 h-5" />, labelKey: 'revenueImpact' as const, target: 12400, prefix: '$' as const, color: 'from-amber-600 to-amber-800' },
];

const tooltipStyle = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px', color: '#e2e8f0' },
  labelStyle: { color: '#94a3b8' },
};

function AnimatedCounter({ target }: { target: number }) {
  const [count, setCount] = useState(target);
  const raf = useRef<number | undefined>(undefined);
  const startTime = useRef<number | undefined>(undefined);
  useEffect(() => {
    setCount(0);
    startTime.current = undefined;
    if (target <= 0) { setCount(target); return; }
    const duration = 1500;
    const animate = (now: number) => {
      if (!startTime.current) startTime.current = now;
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target]);
  return <span>{count.toLocaleString()}</span>;
}

export default function SalesTool({ lang }: { lang: Language }) {
  const t = translations[lang];
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const scale = TIME_SCALE[timePeriod];

  const KPI = KPI_BASE.map(k => ({
    ...k,
    label: t[k.labelKey],
    target: Math.round(k.target * (k.labelKey === 'weeklyGrowthRate' || k.labelKey === 'repeatRate' ? 1 : scale)),
  }));

  const scaledSources = MOCK_SOURCES.map(s => ({ ...s, value: Math.round(s.value * scale) }));
  const scaledFunnel = MOCK_FUNNEL.map(s => ({ ...s, value: Math.round(s.value * scale), prev: Math.round(s.prev * scale) }));
  const scaledGamesPlayed = MOCK_GAMES_PLAYED.map(g => ({ ...g, plays: Math.round(g.plays * scale) }));
  const scaledCross = MOCK_CROSS.map(c => ({ ...c, guests: Math.round(c.guests * scale) }));
  const scaledWeekly = MOCK_WEEKLY.map(w => ({
    ...w, entered: Math.round(w.entered * scale), scanned: Math.round(w.scanned * scale), played: Math.round(w.played * scale),
  }));

  const sourceTotal = scaledSources.reduce((a, b) => a + b.value, 0);
  const sourceLabel = (key: string) => {
    if (key === 'qr') return t.qrCheckin;
    if (key === 'hunt') return t.treasureHuntComplete;
    if (key === 'cross') return t.crossReferral;
    return key;
  };

  const funnelLabel = (key: string) => {
    const map: Record<string, string> = {
      entered: t.enteredRestaurant, scanned: t.scannedQR, playedGame: t.playedGame,
      joinedHunt: t.joinedHunt, claimedPrize: t.claimedPrize,
    };
    return map[key] || key;
  };

  const funnelPct = (val: number, prev: number) => prev === 0 ? '100%' : ((val / prev) * 100).toFixed(0) + '%';

  const timePills: { key: TimePeriod; label: string }[] = [
    { key: 'today', label: t.today },
    { key: 'week', label: t.thisWeek },
    { key: 'month', label: t.thisMonth },
    { key: 'all', label: t.allTime },
  ];

  return (
    <div className="text-slate-200 font-sans max-w-6xl mx-auto space-y-8">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center pt-4 pb-2">
        <h1 className="text-3xl sm:text-4xl font-black italic uppercase tracking-tight text-white">
          {t.restaurantName}
        </h1>
      </motion.div>

      {/* Time Period Pills */}
      <div className="flex justify-center gap-2">
        {timePills.map(p => (
          <button
            key={p.key}
            onClick={() => setTimePeriod(p.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors ${timePeriod === p.key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
        <div className="grid grid-cols-2 gap-4">
          {KPI.map((kpi, i) => (
            <motion.div
              key={kpi.labelKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
              className="bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 rounded-3xl p-6 text-center relative overflow-hidden group hover:border-slate-700 transition-colors"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${kpi.color} opacity-0 group-hover:opacity-5 transition-opacity rounded-3xl`} />
              <div className="flex items-center justify-center mb-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${kpi.color}`}>{kpi.icon}</div>
              </div>
              <div className="text-4xl font-black text-white mb-1">
                {kpi.prefix || ''}<AnimatedCounter target={kpi.target} />{kpi.suffix || ''}
              </div>
              <div className="text-xs uppercase font-bold text-slate-500 tracking-widest">{kpi.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Customer Sources */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <MapPin className="text-blue-400 w-5 h-5" />
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">{t.customerSources}</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">{t.sourcesSubtitle}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={scaledSources} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value"
                  animationBegin={400} animationDuration={1000}>
                  {scaledSources.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx]} stroke="transparent" />)}
                </Pie>
                <Tooltip {...tooltipStyle} formatter={(value: number, name: string) => [value, sourceLabel(name)]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {scaledSources.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i] }} />
                <span className="flex-1 text-sm text-slate-300">{sourceLabel(s.name)}</span>
                <span className="text-sm font-bold text-white">{s.value}</span>
                <span className="text-xs text-slate-500 w-10 text-right">{sourceTotal > 0 ? ((s.value / sourceTotal) * 100).toFixed(0) : 0}%</span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Conversion Funnel */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <Activity className="text-emerald-400 w-5 h-5" />
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">{t.conversionFunnel}</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">{t.funnelSubtitle}</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scaledFunnel} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis type="category" dataKey="stage" tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v: string) => funnelLabel(v)} />
                <Tooltip {...tooltipStyle} formatter={(value: number, _: string, props: any) => {
                  const pct = funnelPct(props.payload.value, props.payload.prev);
                  return [`${value.toLocaleString()} (${pct} of prev step)`, funnelLabel(props.payload.stage)];
                }} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} animationBegin={600} animationDuration={1000}>
                  {scaledFunnel.map((_, idx) => <Cell key={idx} fill={`hsl(${210 + idx * 20}, ${70 - idx * 8}%, ${60 - idx * 8}%)`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            {scaledFunnel.map((s, i) => (
              <motion.div key={s.stage} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.4 + i * 0.08 }}
                className="flex items-center gap-4">
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${scaledFunnel[0].value > 0 ? (s.value / scaledFunnel[0].value) * 100 : 0}%`,
                      background: `linear-gradient(90deg, hsl(${210 + i * 20}, 80%, 50%), hsl(${210 + i * 20}, 80%, 35%))` }} />
                </div>
                <div className="text-right shrink-0 w-24">
                  <div className="text-sm font-bold text-white">{s.value.toLocaleString()}</div>
                  <div className="text-xs text-slate-500">{funnelLabel(s.stage)}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Top Games + Cross Traffic */}
      <div className="grid grid-cols-1 gap-8">
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-2">
            <Gamepad2 className="text-purple-400 w-5 h-5" />
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">{t.mostPlayedGames}</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">{t.gamesSubtitle}</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scaledGamesPlayed} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis type="category" dataKey="key" tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(v: string) => { const gn = GAME_NAMES[v]; return gn ? (lang === 'en' ? gn.en : gn.uk) : v; }} />
                <Tooltip {...tooltipStyle} formatter={(value: number, _: string, props: any) => {
                  const gn = GAME_NAMES[props.payload.key];
                  return [`${value} ${t.playsCount}`, gn ? (lang === 'en' ? gn.en : gn.uk) : props.payload.key];
                }} />
                <Bar dataKey="plays" radius={[0, 8, 8, 0]} animationBegin={800} animationDuration={1000}>
                  {scaledGamesPlayed.map((_, idx) => <Cell key={idx} fill={['#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'][idx]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-2">
            <Share2 className="text-cyan-400 w-5 h-5" />
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">{t.crossRestaurantTraffic}</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">{t.crossSubtitle}</p>
          <div className="space-y-3">
            {scaledCross.map((item, i) => (
              <motion.div key={item.restaurant} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.6 + i * 0.08 }}
                className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition-colors group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-lg">
                  {['🍕', '🥗', '🍣', '🍔', '🍝'][i]}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{item.restaurant}</p>
                  <p className="text-xs text-slate-400">{t.sentXGuests.replace('{n}', String(item.guests)).replace('{restaurant}', item.restaurant)}</p>
                </div>
                <div className="text-2xl font-black text-cyan-400">{item.guests}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </div>

      {/* Weekly Growth */}
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.6 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="text-amber-400 w-5 h-5" />
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">{t.weeklyGrowth}</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">{t.growthSubtitle}</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scaledWeekly} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v: number) => t.weekLabel.replace('{n}', String(v))} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip {...tooltipStyle} labelFormatter={(v: number) => t.weekLabel.replace('{n}', String(v))} />
              <Legend formatter={(v: string) => ({ entered: t.enteredRestaurant, scanned: t.scannedQR, played: t.playedGame })[v] || v} />
              <Line type="monotone" dataKey="entered" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} animationDuration={1200} />
              <Line type="monotone" dataKey="scanned" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }} animationDuration={1200} />
              <Line type="monotone" dataKey="played" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#8b5cf6', r: 5 }} animationDuration={1200} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.section>
    </div>
  );
}
