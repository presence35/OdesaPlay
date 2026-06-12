import { useState } from 'react';
import { Info, RotateCcw } from 'lucide-react';
import { SHOP_ITEMS, ShopItem } from '../gamehub/constants';
import { InventoryItem } from '../gamehub/types';
import { calculateSellValue } from '../gamehub/utils';
import { Language } from '../../language';

interface ShopTabProps {
  t: any;
  lang: Language;
  stars: number;
  inventory: Record<string, Record<string, InventoryItem>>;
  onBuy: (item: ShopItem) => void;
  onSell: (item: ShopItem) => void;
}

export default function ShopTab({ t, lang, stars, inventory, onBuy, onSell }: ShopTabProps) {
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [showSellInfo, setShowSellInfo] = useState(false);

  const owned = (item: ShopItem) => item.gameIds.some(gid => inventory[gid]?.[item.id]);

  const getSellValue = (item: ShopItem) => {
    for (const gid of item.gameIds) {
      const entry = inventory[gid]?.[item.id];
      if (entry) return calculateSellValue(entry.paidCost, entry.purchasedAt);
    }
    return null;
  };

  const byGame: Record<string, ShopItem[]> = {};
  for (const item of SHOP_ITEMS) {
    for (const gid of item.gameIds) {
      if (!byGame[gid]) byGame[gid] = [];
      if (!byGame[gid].find(i => i.id === item.id)) byGame[gid].push(item);
    }
  }

  const gameNames: Record<string, string> = {
    marshrutka: 'Marshrutka',
    lighthouse: 'Lighthouse',
    drones: 'Drones',
    trivia: 'Trivia',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
        <span className="text-sm font-black uppercase tracking-widest text-amber-400">{t.stars}</span>
        <span className="text-2xl font-black text-amber-400">{stars} ⭐</span>
      </div>

      <div className="bg-[var(--bg-secondary)]/30 p-3 rounded-2xl border border-[var(--border-default)]">
        <button
          onClick={() => setShowSellInfo(!showSellInfo)}
          className="flex items-center gap-2 w-full text-left"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
          <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex-1">
            {t.sellInfo}
          </span>
          <Info className="w-3.5 h-3.5 text-[var(--text-subtle)] shrink-0" />
        </button>
        {showSellInfo && (
          <p className="text-[9px] text-[var(--text-subtle)] mt-2 leading-relaxed border-t border-[var(--border-default)] pt-2">
            {lang === 'uk'
              ? 'Кожен предмет можна віддати назад на ринок. Вартість зменшується на 2% за кожен тиждень володіння. Мінімальне повернення — 25% від початкової ціни.'
              : 'Each item can be given back to the market. Its value drops 2% per week owned, down to a minimum of 25% of the original price.'}
          </p>
        )}
      </div>

      {Object.entries(byGame).map(([gameId, items]) => (
        <div key={gameId} className="space-y-3">
          <h3 className="text-xs font-black uppercase text-[var(--text-muted)] tracking-widest">
            {gameNames[gameId] || gameId}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {items.map(item => {
              const isOwned = owned(item);
              const canAfford = stars >= item.cost;
              const sv = isOwned ? getSellValue(item) : null;
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border flex items-center gap-4 ${
                    isOwned
                      ? 'bg-[var(--accent-bg)]/10 border-[var(--accent-bg)]/30'
                      : 'bg-[var(--bg-secondary)]/50 border-[var(--border-default)]'
                  }`}
                >
                  <div className="text-3xl">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[var(--text-primary)]">
                      {item.name[lang as 'en' | 'uk'] || item.name.en}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
                      {item.desc[lang as 'en' | 'uk'] || item.desc.en}
                    </div>
                    {isOwned && sv && (
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] text-[var(--text-subtle)] font-bold uppercase tracking-wider">
                        <span>{sv.weeksOwned > 0 ? (
                          <span className="line-through opacity-50">{item.cost}⭐</span>
                        ) : (
                          <span>{item.cost}⭐</span>
                        )}</span>
                        <span className="text-[var(--text-accent)]">→ {t.recoup}: {sv.refund}⭐</span>
                        {sv.weeksOwned > 0 && (
                          <span className="text-[var(--text-muted)]">
                            ({sv.lossPercent}% {lang === 'uk' ? 'втрати' : 'loss'})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {isOwned ? (
                      <button
                        onClick={() => onSell(item)}
                        className="px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all bg-red-900/40 text-red-400 border border-red-800/30 hover:bg-red-800/40 active:scale-95"
                      >
                        {t.sell}
                      </button>
                    ) : item.cost === 0 ? (
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">{t.buy}</span>
                    ) : (
                      <button
                        disabled={!canAfford}
                        onClick={() => onBuy(item)}
                        className={`px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                          canAfford
                            ? 'bg-amber-500 text-slate-900 active:scale-95'
                            : 'bg-slate-800 text-slate-600'
                        }`}
                      >
                        {item.cost} ⭐
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
