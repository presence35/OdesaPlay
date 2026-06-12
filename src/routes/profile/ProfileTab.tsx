import { motion } from 'motion/react';
import { User as FirebaseUser } from 'firebase/auth';
import { X, Flame, Trophy, Share2, Award, Package } from 'lucide-react';
import EasterEggSection from '../../components/EasterEggSection';
import { BADGE_DEFINITIONS, SHOP_ITEMS, ShopItem } from '../gamehub/constants';
import { Game, InventoryItem } from '../gamehub/types';
import { getLevel, getStarsProgress, getStarsForNextLevel, getTimeAgo, shareScore, calculateSellValue } from '../gamehub/utils';
import { getUserId } from '../../firebase';
import { Language } from '../../language';

const AVATARS = ["⚓", "🛸", "⚔️", "🥟", "🥨", "🐈", "🍉", "🎖️"];

function Media({ src, imgClass, textClass }: { src: string; imgClass?: string; textClass?: string }) {
  const resolved = src || '⚓';
  if (resolved.startsWith('/') || resolved.startsWith('.')) {
    return <img src={resolved} alt="" className={`object-contain ${imgClass || ''}`} />;
  }
  return <span className={textClass}>{resolved}</span>;
}

interface ProfileTabProps {
  user: FirebaseUser | null;
  profile: { nickname: string; avatar: string };
  t: any;
  lang: Language;
  isEditing: boolean;
  editName: string;
  editAvatar: string;
  nameError: string;
  setIsEditing: (v: boolean) => void;
  setEditName: (v: string) => void;
  setEditAvatar: (v: string) => void;
  setNameError: (v: string) => void;
  saveProfile: () => Promise<void>;
  getUserId: () => string;
  userLeaderboards: any[];
  leaderboards: any[];
  gamesList: Game[];
  achievements: Record<string, { unlockedAt: any }>;
  streak: number;
  xp: number;
  inventory: Record<string, Record<string, InventoryItem>>;
  recruitCount: number;
  eggFindings: Set<string>;
  selectedBadge: string | null;
  newlyUnlockedBadges: string[];
  onSelectBadge: (id: string | null) => void;
  onSell: (item: ShopItem) => void;
}

export default function ProfileTab({
  user,
  profile,
  t,
  lang,
  isEditing,
  editName,
  editAvatar,
  nameError,
  setIsEditing,
  setEditName,
  setEditAvatar,
  setNameError,
  saveProfile,
  getUserId,
  userLeaderboards,
  leaderboards,
  gamesList,
  achievements,
  streak,
  xp,
  inventory,
  recruitCount,
  eggFindings,
  selectedBadge,
  newlyUnlockedBadges,
  onSelectBadge,
  onSell,
}: ProfileTabProps) {

  const getSellValue = (item: ShopItem) => {
    for (const gid of item.gameIds) {
      const entry = inventory[gid]?.[item.id];
      if (entry) return calculateSellValue(entry.paidCost, entry.purchasedAt);
    }
    return null;
  };

  return (
    <>
      {!isEditing ? (
        <div className="space-y-6">
          {/* Profile Section */}
          <div className="text-center py-6 space-y-6">
            <div
              className="w-24 h-24 bg-gradient-to-tr from-[var(--btn-primary-bg)] to-[var(--accent-bg)] rounded-full mx-auto p-1 shadow-2xl cursor-pointer hover:scale-105 transition-transform"
              onClick={() => setIsEditing(true)}
            >
              <div className="w-full h-full bg-[var(--bg-primary)] rounded-full flex items-center justify-center">
                <Media src={profile.avatar || '⚓'} imgClass="w-10 h-10" textClass="text-4xl" />
              </div>
            </div>
            <div
              className="cursor-pointer hover:opacity-80 transition-opacity inline-block"
              onClick={() => setIsEditing(true)}
            >
              <h3 className="text-2xl font-black uppercase italic tracking-tighter text-[var(--text-accent)]">{profile.nickname || `HERO_${getUserId().substring(0,8)}`}</h3>
              <p className="text-[var(--text-muted)] font-bold text-[10px] uppercase tracking-widest mt-1">{t.rank}</p>
            </div>

          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[var(--bg-secondary)]/50 p-3 rounded-3xl border border-[var(--border-default)] shadow-xl">
              <div className="text-lg font-black text-[var(--text-accent)] italic">
                {userLeaderboards.reduce((acc: number, curr: any) => acc + (curr.playCount || 1), 0)}
              </div>
              <div className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-tighter leading-none mt-1.5">{t.gamesPlayed}</div>
            </div>
            <div className="bg-[var(--bg-secondary)]/50 p-3 rounded-3xl border border-[var(--border-default)] shadow-xl">
              <div className="text-lg font-black text-[var(--text-accent)] italic">
                {(() => { try { return Object.keys(JSON.parse(localStorage.getItem('odesa_checkins') || '{}')).length; } catch { return 0; }})()}
              </div>
              <div className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-tighter leading-none mt-1.5">{t.cityHunt}</div>
            </div>
            <div className="bg-[var(--bg-secondary)]/50 p-3 rounded-3xl border border-[var(--border-default)] shadow-xl">
              <div className="text-lg font-black text-[var(--text-success)] italic">{recruitCount}</div>
              <div className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-tighter leading-none mt-1.5">{t.recruits}</div>
            </div>
          </div>

          {/* Streak & XP Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[var(--bg-secondary)]/50 p-3 rounded-3xl border border-[var(--border-default)] shadow-xl flex items-center gap-3">
              <Flame className={`w-6 h-6 ${streak > 0 ? 'text-[var(--text-accent)]' : 'text-[var(--text-subtle)]'}`} />
              <div>
                <div className="text-lg font-black text-[var(--text-accent)] italic">{streak} {streak === 1 ? t.day : t.days}</div>
                <div className="text-[8px] font-black uppercase text-[var(--text-muted)] tracking-tighter leading-none">{t.streak}</div>
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)]/50 p-3 rounded-3xl border border-[var(--border-default)] shadow-xl">
              <div className="flex items-center justify-between mb-1">
                <div className="text-lg font-black text-[var(--text-accent)] italic">{t.playerLevel} {getLevel(xp)}</div>
                <div className="text-[8px] font-black text-[var(--text-muted)] uppercase">{xp} XP</div>
              </div>
              <div className="w-full h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--accent-bg)] to-[var(--accent-bg)] rounded-full transition-all duration-500"
                  style={{ width: `${getStarsProgress(xp)}%` }}
                />
              </div>
              <div className="text-[8px] font-black text-[var(--text-muted)] tracking-tighter leading-none mt-1">{getStarsForNextLevel(xp) - xp} {t.starsToNext}</div>
            </div>
          </div>

          {/* High Scores */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[var(--text-accent)]" /> {t.highScores}</h3>
            {userLeaderboards.map((r: any) => {
              const game = gamesList.find(g => g.id === r.gameId);
              if (!game) return null;
              const allGameRecords = leaderboards.filter((l: any) => l.gameId === game.id).sort((a: any, b: any) => b.score - a.score);
              const rank = allGameRecords.findIndex((l: any) => l.uid === getUserId()) + 1;
              const totalPlayers = allGameRecords.length;

              return (
                <div key={r.id} className="bg-[var(--bg-secondary)]/50 p-4 rounded-2xl border border-[var(--border-default)] flex justify-between items-center shadow-xl">
                  <div className="flex flex-col">
                    <span className="font-bold uppercase text-xs tracking-widest flex items-center gap-1.5 text-[var(--text-primary)]">{game.icon && <img src={game.icon} alt="" className="w-4 h-4 object-contain" />}{game.title[lang]}</span>
                    <span className="text-[9px] text-[var(--text-muted)] uppercase font-black tracking-widest mt-1">
                      {getTimeAgo(r.timestamp, lang)} • {r.playCount || 1} {t.playsCount} • {t.rankLabel}: {rank}/{totalPlayers}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-[var(--text-accent)] italic font-mono">{r.score}</span>
                    <button onClick={() => shareScore(game, r.score, lang, profile)} className="text-[var(--text-subtle)] hover:text-[var(--text-accent)] transition-colors p-1" title={t.share}>
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            {userLeaderboards.length === 0 && (
              <div className="text-center text-xs text-[var(--text-subtle)] uppercase font-bold tracking-widest py-4 bg-[var(--bg-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-strong)]">{t.noEntries}</div>
            )}
          </div>

          {/* Badges */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
              <Award className="w-4 h-4 text-[var(--text-accent)]" /> {t.badges} ({Object.keys(achievements).length} OF {BADGE_DEFINITIONS.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {BADGE_DEFINITIONS.map(badge => {
                const unlocked = !!achievements[badge.id];
                const justUnlocked = newlyUnlockedBadges.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    onClick={() => onSelectBadge(badge.id)}
                    className={`rounded-lg flex items-center justify-center p-1 transition-all cursor-pointer ${
                      unlocked
                        ? justUnlocked
                          ? 'bg-[var(--accent-bg)]/20 border-2 border-[var(--accent-bg)] animate-pulse'
                          : selectedBadge === badge.id ? 'bg-[var(--bg-elevated)]/80 border-2 border-[var(--border-strong)]' : 'bg-[var(--bg-elevated)]/80 border-2 border-[var(--border-strong)]'
                        : 'bg-[var(--bg-secondary)]/30 border-2 border-[var(--border-default)] opacity-40'
                    }`}
                  >
                    <Media src={badge.icon} imgClass={`w-4 h-4 ${unlocked ? '' : 'grayscale'}`} textClass={`text-base ${unlocked ? '' : 'grayscale'}`} />
                    {justUnlocked && (
                      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-[var(--accent-bg)] rounded-full animate-ping" />
                    )}
                    {unlocked && !justUnlocked && (
                      <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[var(--text-success)] rounded-full" />
                    )}
                  </div>
                );
              })}
            </div>
            {Object.keys(achievements).length === 0 && (
              <div className="text-center text-xs text-[var(--text-subtle)] uppercase font-bold tracking-widest py-4 bg-[var(--bg-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-strong)]">{t.noBadges}</div>
            )}
            {(() => {
              if (!selectedBadge) {
                return (
                  <div className="w-full bg-[var(--bg-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-strong)] p-5 text-center">
                    <span className="text-xs text-[var(--text-muted)] uppercase font-bold tracking-widest">{t.tapBadge}</span>
                  </div>
                );
              }
              const badgeDef = BADGE_DEFINITIONS.find(b => b.id === selectedBadge);
              if (!badgeDef) return null;
              const unlocked = !!achievements[selectedBadge];
              const badgeLabel = (t as any).badge[selectedBadge];
              return (
                <div className="w-full bg-[var(--bg-elevated)]/80 rounded-2xl border border-[var(--border-strong)] p-4 text-left space-y-2">
                  <div className="flex items-center gap-2">
                    <Media src={badgeDef.icon} imgClass="w-4 h-4" textClass="text-base" />
                    <span className="text-sm font-black uppercase text-[var(--text-primary)] tracking-wider">{badgeLabel?.name || selectedBadge}</span>
                  </div>
                  <p className="text-xs text-[var(--text-subtle)] leading-relaxed">{badgeLabel?.desc || ''}</p>
                  {unlocked ? (
                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-bold">
                      {(() => { const d = Math.floor((Date.now() - new Date(achievements[selectedBadge].unlockedAt).getTime()) / 86400000); return d === 1 ? t.badgeUnlockedAgo.replace('{d}', String(d)) : t.badgeUnlockedAgoPlural.replace('{d}', String(d)); })()}
                    </p>
                  ) : (
                    <p className="text-[10px] text-[var(--text-subtle)] uppercase tracking-wider font-bold">{t.badgeNotUnlocked}</p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Items */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
              <Package className="w-4 h-4 text-[var(--text-accent)]" /> {t.items}
            </h3>
            {(() => {
              const ownedItems = SHOP_ITEMS.filter(item => item.gameIds.some(gid => inventory[gid]?.[item.id]));
              if (ownedItems.length === 0) {
                return <div className="text-center text-xs text-[var(--text-subtle)] uppercase font-bold tracking-widest py-4 bg-[var(--bg-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-strong)]">{t.itemsPlaceholder}</div>;
              }
              return (
                <div className="grid grid-cols-2 gap-2">
                  {ownedItems.map(item => {
                    const sv = getSellValue(item);
                    return (
                      <div key={item.id} className="flex items-center gap-2 p-3 bg-[var(--bg-secondary)]/30 rounded-xl border border-[var(--border-default)]">
                        <span className="text-xl">{item.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] font-bold text-[var(--text-primary)] truncate">{item.name[lang as 'en' | 'uk'] || item.name.en}</div>
                          <div className="text-[9px] text-[var(--text-muted)] truncate">{item.desc[lang as 'en' | 'uk'] || item.desc.en}</div>
                          {sv && (
                            <div className="text-[8px] text-[var(--text-subtle)] font-bold uppercase tracking-wider mt-0.5">
                              {item.cost}⭐ → {t.recoup}: {sv.refund}⭐
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Easter Eggs */}
          <EasterEggSection findings={eggFindings} lang={lang} />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--bg-secondary)]/50 p-6 rounded-3xl border border-[var(--border-default)] space-y-6">
          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-3 tracking-widest">{t.chooseHero}</label>
            <div className="grid grid-cols-4 gap-4">
              {AVATARS.map(a => (
                <div key={a} onClick={() => setEditAvatar(a)} className={`h-12 flex items-center justify-center rounded-2xl cursor-pointer transition-transform hover:scale-110 ${editAvatar === a ? 'border-2 border-[var(--accent-bg)] bg-[var(--accent-bg)]/10' : 'bg-[var(--bg-elevated)]/40'}`}>
                  <Media src={a} imgClass="w-7 h-7" textClass="text-2xl" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase block mb-2 tracking-widest">{t.cityNickname}</label>
            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-xl p-4 text-[var(--text-primary)] font-black italic outline-none focus:border-[var(--accent-bg)]" placeholder={t.nicknamePlaceholder} maxLength={15} />
            {nameError && <p className="text-[var(--text-error)] text-[10px] mt-2 font-bold uppercase">{nameError}</p>}
          </div>
          <button onClick={saveProfile} className="w-full bg-[var(--btn-primary-bg)] text-[var(--text-primary)] py-4 rounded-xl font-black uppercase tracking-widest active:scale-95 transition-all shadow-xl shadow-[var(--accent-bg)]/30">{t.saveProfile}</button>
        </motion.div>
      )}
    </>
  );
}
