import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Upgrades, Weather, GameControls } from '../types';
import { LighthouseView } from './LighthouseView';
import { ControlPanel } from './ControlPanel';
import { LighthouseEngine } from '../engine/LighthouseEngine';
import { EngineState } from '../engine/EngineTypes';
import { isMobileDevice } from '../../../../utils/fullscreen';
import { audio } from '../audio';

interface GameScreenProps {
  upgrades: Upgrades;
  onDayEnd: (earnings: number, shiftDocked: number) => void;
  globalScore: number;
  totalDockedShips: number;
  t?: any;
  isAdmin?: boolean;
}

export function GameScreen({ upgrades, onDayEnd, globalScore, totalDockedShips, t, isAdmin }: GameScreenProps) {
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LighthouseEngine | null>(null);

  const [timeRemaining, setTimeRemaining] = useState(260_000);
  const [scoreEarned, setScoreEarned] = useState(0);
  const [battery, setBattery] = useState(100);
  const [heat, setHeat] = useState(0);
  const [weather, setWeather] = useState<Weather>('clear');
  const [lightOn, setLightOn] = useState(false);
  const [fuseBlown, setFuseBlown] = useState(false);
  const [fuseHealth, setFuseHealth] = useState(10);
  const [isCooledDown, setIsCooledDown] = useState(false);
  const [lightningAlpha, setLightningAlpha] = useState(0);

  const controlsRef = useRef<GameControls>({
    isLightPressed: false,
    tunedFreq: 88,
    pumpQueue: 0,
    dockTaps: 0,
    fuseFixTaps: 0,
  });

  const handleStateUpdate = useCallback((state: EngineState) => {
    setTimeRemaining(state.timeRemaining);
    setScoreEarned(state.score);
    setBattery(Math.round(state.battery));
    setHeat(Math.round(state.heat));
    setWeather(state.weather);
    setLightOn(state.lightOn);
    setFuseBlown(state.fuseBlown);
    setFuseHealth(state.fuseHealth);
    setIsCooledDown(state.isCooledDown);
    setLightningAlpha(state.lightningAlpha);
  }, []);

  useEffect(() => {
    audio.init();
    const container = pixiContainerRef.current;
    if (!container) return;

    const engine = new LighthouseEngine(container, controlsRef);
    engineRef.current = engine;

    let cancelled = false;

    (async () => {
      await engine.init(
        {
          onStateUpdate: handleStateUpdate,
          onDayEnd: (earnings, shiftDocked) => {
            engine.stop();
            onDayEnd(earnings, shiftDocked);
          },
        },
        { upgrades, globalScore, totalDockedShips, isMobile: isMobileDevice() }
      );
      if (!cancelled) {
        engine.start();
      }
    })();

    return () => {
      cancelled = true;
      audio.stop();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleCycleWeather = useCallback(() => {
    engineRef.current?.cycleWeather();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full">
      <LighthouseView
        weather={weather}
        lightOn={lightOn}
        lightningAlpha={lightningAlpha}
        onCycleWeather={handleCycleWeather}
        containerRef={pixiContainerRef}
        isAdmin={isAdmin}
      />

      <ControlPanel
        controlsRef={controlsRef}
        heat={heat}
        battery={battery}
        fuseBlown={fuseBlown}
        fuseHealth={fuseHealth}
        isCooledDown={isCooledDown}
        score={scoreEarned}
        upgrades={upgrades}
        shipsApproaching={true}
        timeRemaining={timeRemaining}
        t={t}
      />
    </div>
  );
}
