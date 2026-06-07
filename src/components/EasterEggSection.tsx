import { translations, Language } from '../language';
import { EASTER_EGG_DEFINITIONS, type EasterEgg } from '../routes/gamehub/easterEggs';

export default function EasterEggSection({ findings, lang }: { findings: Set<string>; lang: Language }) {
  const t = translations[lang];
  const total = EASTER_EGG_DEFINITIONS.length;
  const found = EASTER_EGG_DEFINITIONS.filter(e => findings.has(e.id)).length;

  if (total === 0) {
    return (
      <div className="mt-8 text-left space-y-4">
        <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">🥚 {t.eggs}</h3>
        <div className="text-center text-xs text-[var(--text-subtle)] uppercase font-bold tracking-widest py-4 bg-[var(--bg-secondary)]/30 rounded-2xl border border-dashed border-[var(--border-strong)]">{t.eggsNone}</div>
      </div>
    );
  }

  return (
    <div className="mt-8 text-left space-y-4">
      <h3 className="text-sm font-black uppercase text-[var(--text-muted)] tracking-widest flex items-center gap-2">
        🥚 {t.eggs} <span className="text-[10px] text-[var(--text-accent)]">({found}/{total})</span>
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {EASTER_EGG_DEFINITIONS.sort((a, b) => a.order - b.order).map(egg => {
          const isFound = findings.has(egg.id);
          return (
            <div
              key={egg.id}
              className={`p-3 rounded-2xl border text-center transition-all ${
                isFound
                  ? 'bg-[var(--accent-bg)]/10 border-[var(--accent-border)]'
                  : 'bg-[var(--bg-secondary)]/30 border-[var(--border-default)] opacity-50'
              }`}
            >
              <div className="text-2xl mb-1">{isFound ? egg.icon : '❓'}</div>
              <div className="text-[9px] font-black uppercase tracking-wider text-[var(--text-primary)] leading-tight">
                {isFound ? egg.name[lang] : '???'}
              </div>
              <div className="text-[7px] text-[var(--text-subtle)] font-medium mt-1 leading-tight">
                {isFound ? '' : egg.hint[lang]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
