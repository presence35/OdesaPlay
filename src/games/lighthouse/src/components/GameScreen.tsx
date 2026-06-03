import React, { useEffect, useRef, useState } from 'react';
import { Upgrades, Weather, Ship, GameControls } from '../types';
import { LighthouseView } from './LighthouseView';
import { ControlPanel } from './ControlPanel';

interface GameScreenProps {
  upgrades: Upgrades;
  onDayEnd: (earnings: number) => void;
}

const TICK_RATE = 50; // ms per tick
const DAY_DURATION = 120_000; // 2 minutes

export function GameScreen({ upgrades, onDayEnd }: GameScreenProps) {
  // --- Game State (updated heavily during loop) ---
  const [timeRemaining, setTimeRemaining] = useState(DAY_DURATION);
  const [ships, setShips] = useState<Ship[]>([{
    id: 'initial',
    distance: 90,
    frequency: 88.0 + (Math.floor(Math.random() * 41) * 0.5),
    status: 'approaching'
  }]);
  const [moneyEarned, setMoneyEarned] = useState(0);
  const [weather, setWeather] = useState<Weather>('clear');
  
  const [battery, setBattery] = useState(100);
  const [heat, setHeat] = useState(0);
  const [isCooledDown, setIsCooledDown] = useState(false);
  const [lightOn, setLightOn] = useState(false);
  
  const [fuseBlown, setFuseBlown] = useState(false);
  const [fuseHealth, setFuseHealth] = useState(10);

  // --- Mutable refs for performant loop reading ---
  const controlsRef = useRef<GameControls>({
    isLightPressed: false,
    tunedFreq: 98.0,
    pumpQueue: 0,
    dockTaps: 0,
    fuseFixTaps: 0,
  });

  // Track state in refs to use inside the setInterval without recreating it
  const stateRef = useRef({
    ships: [] as Ship[],
    money: 0,
    time: DAY_DURATION,
    battery: 100,
    heat: 0,
    weather: 'clear' as Weather,
    isCooledDown: false,
    lightOn: false,
    fuseBlown: false,
    fuseHealth: 10,
    weatherTimer: 0 // internal logic clock for weather
  });

  // Keep ref synced
  useEffect(() => {
    stateRef.current.ships = ships;
    stateRef.current.money = moneyEarned;
    stateRef.current.time = timeRemaining;
    stateRef.current.battery = battery;
    stateRef.current.heat = heat;
    stateRef.current.isCooledDown = isCooledDown;
    stateRef.current.lightOn = lightOn;
    stateRef.current.fuseBlown = fuseBlown;
    stateRef.current.fuseHealth = fuseHealth;
    stateRef.current.weather = weather;
  }, [ships, moneyEarned, timeRemaining, battery, heat, isCooledDown, lightOn, fuseBlown, fuseHealth, weather]);

  useEffect(() => {
    const timerId = setInterval(() => {
      const s = stateRef.current;
      const c = controlsRef.current;

      let newShips = [...s.ships];
      let newBattery = s.battery;
      let newHeat = s.heat;
      let newCooledDown = s.isCooledDown;
      let newLightOn = s.lightOn;
      let newFuseBlown = s.fuseBlown;
      let newFuseHealth = s.fuseHealth;
      let newMoney = s.money;
      let newWeather = s.weather;

      // 1. Time / Weather Tick
      const nextTime = Math.max(0, s.time - TICK_RATE);
      if (nextTime === 0) {
        clearInterval(timerId);
        onDayEnd(newMoney);
        return;
      }
      s.weatherTimer += TICK_RATE;
      
      // Preset weather phases for dramatic pacing
      if (s.weatherTimer > 40000 && s.weatherTimer <= 80000) newWeather = 'fog';
      if (s.weatherTimer > 80000) newWeather = 'storm';

      // 2. Control Processing (Fuse / Generator)
      if (newFuseBlown) {
        newLightOn = false;
        if (c.fuseFixTaps > 0) {
          newFuseHealth -= c.fuseFixTaps;
          if (newFuseHealth <= 0) {
            newFuseBlown = false;
          }
        }
      } else {
        // Random System Failure Event
        if (Math.random() < 0.0005) { // very rare
          newFuseBlown = true;
          newFuseHealth = 10;
        }

        // Pump battery
        if (c.pumpQueue > 0) {
          newBattery = Math.min(100, newBattery + c.pumpQueue);
        }

        // Light processing
        // Can only turn on if user presses, no fuse blown, has battery, and not in cooldown
        if (c.isLightPressed && newBattery > 0 && !newCooledDown) {
          newLightOn = true;
          
          // Battery drain calculation
          const drainRate = (upgrades.solarBackup && newWeather === 'storm') ? 0.2 : 0.5;
          newBattery = Math.max(0, newBattery - drainRate);
          
          // Heat increase calculation
          const heatRate = upgrades.tungstenFilament ? 0.3 : 0.6;
          newHeat += heatRate;
          
          if (newHeat >= 100) {
            newCooledDown = true;
            newLightOn = false; // Forces off
          }
        } else {
          newLightOn = false;
          newHeat = Math.max(0, newHeat - 0.9); // decay heat
          if (newHeat <= 0) {
            newCooledDown = false;
          }
        }
      }

      // 3. Ships Logic
      // Clean up dead ships (delay removing crashed ships slightly for animation)
      newShips = newShips.filter(ship => !(ship.status === 'crashed' && ship.distance < -10) && !(ship.status === 'cleared' && ship.distance < -10));

      let processedDockTaps = false; // only consume 1 tap functionally per tick if valid

      newShips.forEach(ship => {
        if (ship.status === 'approaching') {
          // Speed calculations
          let speed = 0.2; // base
          if (newWeather === 'fog') speed = upgrades.autoFoghorn ? 0.15 : 0.4;
          if (newWeather === 'storm') speed = 0.5; // frantic
          if (newLightOn) speed *= 0.3; // Light slows ships down significantly for safety

          ship.distance -= speed;

          // Collision Check
          if (ship.distance <= 0) {
            ship.status = 'crashed';
            // Optional: dock points logic if wanted, or just lose the ship
          }

          // Docking Check
          if (c.dockTaps > 0 && !processedDockTaps && ship.distance < 40 && ship.distance > 0) {
            // Is frequency close?
            if (Math.abs(ship.frequency - c.tunedFreq) <= 0.5) {
              ship.status = 'cleared';
              newMoney += 150; // Earn Hryvnia
              processedDockTaps = true;
            }
          }
        } else {
          // Keep floating away rapidly after resolving
          ship.distance -= 1.0;
        }
      });

      // Spawning
      const activeApproachShips = newShips.filter(s => s.status === 'approaching');
      
      // Ensure min distance between ships (e.g. at least 15 distance units)
      const isSpacingClear = activeApproachShips.every(s => s.distance < 85);

      if (activeApproachShips.length < 3 && isSpacingClear) {
        // High chance to spawn if empty, natural chance otherwise
        const spawnChance = activeApproachShips.length === 0 ? 0.05 : 0.015;
        
        if (Math.random() < spawnChance) {
          newShips.push({
            id: Math.random().toString(36).substring(7),
            distance: 100, // start offscreen right
            frequency: 88.0 + (Math.floor(Math.random() * 41) * 0.5), // 88.0 to 108.0 in 0.5 steps
            status: 'approaching'
          });
        }
      }

      // Reset action queues for next tick
      c.pumpQueue = 0;
      c.dockTaps = 0;
      c.fuseFixTaps = 0;

      // Update React State batch
      setTimeRemaining(nextTime);
      setShips(newShips);
      setBattery(newBattery);
      setHeat(newHeat);
      setIsCooledDown(newCooledDown);
      setLightOn(newLightOn);
      setFuseBlown(newFuseBlown);
      setFuseHealth(newFuseHealth);
      setMoneyEarned(newMoney);
      setWeather(newWeather);

    }, TICK_RATE);

    return () => clearInterval(timerId);
  }, [upgrades, onDayEnd]);

  return (
    <div className="flex-1 flex flex-col h-full bg-black">
      <LighthouseView 
        weather={weather}
        ships={ships}
        lightOn={lightOn}
        timeRemaining={timeRemaining}
      />
      
      <ControlPanel 
        controlsRef={controlsRef}
        heat={heat}
        battery={battery}
        fuseBlown={fuseBlown}
        fuseHealth={fuseHealth}
        isCooledDown={isCooledDown}
        money={moneyEarned}
      />
    </div>
  );
}
