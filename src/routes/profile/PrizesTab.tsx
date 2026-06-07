import { Ticket } from 'lucide-react';
import { Game } from '../gamehub/types';
import { getTimeAgo } from '../gamehub/utils';
import { Language } from '../../language';

interface PrizesTabProps {
  t: any;
  lang: Language;
  gamesList: Game[];
  playerPrizes: any[];
  hasMorePrizes: boolean;
  loadingMorePrizes: boolean;
  onLoadMorePrizes: () => Promise<void>;
  RESTAURANTS: any[];
}

export default function PrizesTab({
  t, lang, gamesList, playerPrizes, hasMorePrizes,
  loadingMorePrizes, onLoadMorePrizes, RESTAURANTS,
}: PrizesTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
        <Ticket className="w-4 h-4 text-[var(--text-accent)]" /> {t.myPrizes}{playerPrizes.length > 0 && <span className="text-[var(--text-muted)] ml-1">({playerPrizes.filter((p: any) => !p.redeemed && p.expiresAt > Date.now()).length}/{playerPrizes.length})</span>}
      </h3>
      {playerPrizes.length === 0 ? (
        <div className="text-center text-xs text-[var(--text-subtle)] uppercase font-bold tracking-widest py-4 bg-[var(--bg-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-strong)]">{t.noPrizes}</div>
      ) : (
        <>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {[...playerPrizes].sort((a: any, b: any) => {
              const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp || 0);
              const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp || 0);
              return tb - ta;
            }).map((p: any) => {
              const expired = p.expiresAt < Date.now();
              const redeemed = p.redeemed;
              const venue = RESTAURANTS.find((v: any) => v.id === p.venueId);
              const venueName = venue ? venue.name[lang] : (typeof p.venueId === 'string' ? p.venueId.toUpperCase().replace('_', ' ') : '');
              const prizeGame = gamesList.find(g => g.id === p.gameTitle || g.title[lang] === p.gameTitle);
              return (
                <div key={p.id} className="bg-[var(--bg-secondary)]/50 p-4 rounded-2xl border border-[var(--border-default)] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black text-[var(--text-accent)]">{p.rewardType}</div>
                    <div className="text-[10px] text-[var(--text-subtle)] font-bold mt-0.5 flex items-center gap-1.5">{prizeGame?.icon && <img src={prizeGame.icon} alt="" className="w-4 h-4 object-contain" />}{prizeGame?.title[lang] || p.gameTitle} • {p.score} {p.score === 1 ? 'pt' : 'pts'}</div>
                    <div className="text-[9px] text-[var(--text-muted)] uppercase font-bold tracking-widest mt-0.5">{venueName}</div>
                  </div>
                  <div className="text-right">
                    {p.code && !redeemed && (
                      <div className="text-lg font-black text-[var(--text-success)] font-mono tracking-widest">{p.code}</div>
                    )}
                    <div className={`text-[9px] font-black uppercase tracking-widest ${
                      redeemed ? 'text-[var(--text-muted)]' : expired ? 'text-[var(--text-error)]' : 'text-[var(--text-success)]'
                    }`}>
                      {redeemed ? t.claimRedeemed : expired ? `${t.claimExpired} ${getTimeAgo(p.timestamp, lang)}` : p.tournamentId ? t.expiresInHours.replace('{h}', `${Math.max(1, Math.ceil((p.expiresAt - Date.now()) / 3600000))}`) : t.claimCode.replace('{code}', p.code || '')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {hasMorePrizes && (
            <button
              onClick={onLoadMorePrizes}
              disabled={loadingMorePrizes}
              className="w-full py-2 text-[10px] font-black uppercase tracking-widest text-[var(--text-subtle)] hover:text-[var(--text-primary)] transition-colors bg-[var(--bg-secondary)]/30 rounded-xl border border-[var(--border-default)] disabled:opacity-50"
            >
              {loadingMorePrizes ? 'Loading...' : t.loadAll}
            </button>
          )}
        </>
      )}
    </div>
  );
}
