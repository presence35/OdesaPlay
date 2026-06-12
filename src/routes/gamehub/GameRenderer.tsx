import { lazy, Suspense } from 'react';
import { Game } from './types';
import { Language } from '../../language';
import LoadingTrident from '../../components/LoadingTrident';

const ShooterApp = lazy(() => import('../../games/shooter/App'));
const DronesApp = lazy(() => import('../../games/drones/App'));
const MarshrutkaApp = lazy(() => import('../../games/marshrutka/App'));
const TriviaApp = lazy(() => import('../../games/trivia/TriviaApp'));
const LighthouseApp = lazy(() => import('../../games/lighthouse/src/App'));

export function renderGameComponent(
  activeGame: Game | null,
  lang: Language,
  sfxEnabled: boolean,
  musicEnabled: boolean,
  setGamePlaying: (v: boolean) => void,
  isAdmin?: boolean,
) {
  if (!activeGame) return null;

  const w = window as any;
  w._odesaConfigListeners = w._odesaConfigListeners || [];
  w._odesaStopListeners = w._odesaStopListeners || [];
  w._odesaPauseListeners = w._odesaPauseListeners || [];
  w._odesaResumeListeners = w._odesaResumeListeners || [];

  if (!w.Odesa) {
    w.Odesa = {
      init: function(opts: any) {},
      ready: function() { setTimeout(() => setGamePlaying(true), 100); },
      eggFound: function(eggId: string) {
        window.postMessage({ type: 'ODESAPLAY_EGG_FOUND', eggId }, window.location.origin);
      },
      toggleSplashItem: function(itemId: string) {
        window.postMessage({ type: 'ODESAPLAY_TOGGLE_SPLASH_ITEM', itemId }, window.location.origin);
      },
      gameOver: function(score: number) {
        window.postMessage({ type: 'ODESAPLAY_SCORE', score: score, gameId: w.Odesa.gameId }, window.location.origin);
      },
      onConfig: function(cb: any) {
        if (!w._odesaConfigListeners.includes(cb)) {
          w._odesaConfigListeners.push(cb);
        }
        cb({ lang: w.Odesa._latestConfig?.lang || 'uk', sfxEnabled: w.Odesa._latestConfig?.sfxEnabled ?? true, musicEnabled: w.Odesa._latestConfig?.musicEnabled ?? true, peace: w.Odesa._latestConfig?.peace ?? false, stars: w.Odesa._latestConfig?.stars ?? 0, inventory: w.Odesa._latestConfig?.inventory ?? {}, splashItems: w.Odesa._latestConfig?.splashItems ?? [], isAdmin: w.Odesa._latestConfig?.isAdmin ?? false });
      },
      onStop: function(cb: any) {
        if (!w._odesaStopListeners.includes(cb)) {
          w._odesaStopListeners.push(cb);
        }
      },
      _removeStopListener: function(cb: any) {
        const idx = w._odesaStopListeners.indexOf(cb);
        if (idx !== -1) w._odesaStopListeners.splice(idx, 1);
      },
      onPause: function(cb: any) {
        if (!w._odesaPauseListeners.includes(cb)) {
          w._odesaPauseListeners.push(cb);
        }
      },
      onResume: function(cb: any) {
        if (!w._odesaResumeListeners.includes(cb)) {
          w._odesaResumeListeners.push(cb);
        }
      },
      getConfig: function() {
        return { lang: w.Odesa._latestConfig?.lang || 'uk', sfxEnabled: w.Odesa._latestConfig?.sfxEnabled ?? true, musicEnabled: w.Odesa._latestConfig?.musicEnabled ?? true, peace: w.Odesa._latestConfig?.peace ?? false, stars: w.Odesa._latestConfig?.stars ?? 0, inventory: w.Odesa._latestConfig?.inventory ?? {}, splashItems: w.Odesa._latestConfig?.splashItems ?? [], isAdmin: w.Odesa._latestConfig?.isAdmin ?? false };
      },
      win: function(score: number) {
        this.gameOver(score);
      },
      _triggerConfig: function(c: any) {
        w.Odesa._latestConfig = c;
        w._odesaConfigListeners.forEach((cb: any) => cb(c));
      },
      _triggerStop: function() {
        w._odesaStopListeners.forEach((cb: any) => cb());
      },
      _triggerPause: function() {
        w._odesaPauseListeners.forEach((cb: any) => cb());
      },
      _triggerResume: function() {
        w._odesaResumeListeners.forEach((cb: any) => cb());
      }
    };
  }
  w.Odesa.gameId = activeGame.id;
  w.Odesa._latestConfig = { lang, sfxEnabled, musicEnabled, peace: !((window as any).__alertStatus?.active ?? false), stars: 0, inventory: {}, splashItems: [], isAdmin: isAdmin ?? false };

  return (
    <div className="flex-1 w-full relative overflow-hidden flex flex-col bg-black select-none">
      <Suspense fallback={
  <div className="flex-1 flex items-center justify-center bg-black">
    <LoadingTrident text={activeGame?.title?.[lang as 'en' | 'uk'] || 'Loading...'} />
  </div>
}>
        {activeGame.id === 'shooter' && <ShooterApp />}
        {activeGame.id === 'drones' && <DronesApp />}
        {activeGame.id === 'marshrutka' && <MarshrutkaApp />}
        {activeGame.id === 'trivia' && <TriviaApp />}
        {activeGame.id === 'lighthouse' && <LighthouseApp />}
      </Suspense>
    </div>
  );
}
