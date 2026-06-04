import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Upgrades, Weather, Ship, GameControls, ScorePopup } from '../types';
import { LighthouseView } from './LighthouseView';
import { ControlPanel } from './ControlPanel';
import { audio } from '../audio';

interface GameScreenProps {
  upgrades: Upgrades;
  onDayEnd: (earnings: number, shiftDocked: number) => void;
  globalScore: number;
  totalDockedShips: number;
  t?: any;
}

const TICK_RATE = 50; // ms per tick
const DAY_DURATION = 120_000; // 2 minutes

export function GameScreen({ upgrades, onDayEnd, globalScore, totalDockedShips, t }: GameScreenProps) {
  // --- Game State (updated heavily during loop) ---
  const [timeRemaining, setTimeRemaining] = useState(DAY_DURATION);
  const [ships, setShips] = useState<Ship[]>([{
    id: 'initial',
    distance: 90,
    frequency: 80.0 + (Math.floor(Math.random() * 41) * 0.5),
    speed: 0.2,
    lane: 0,
    status: 'approaching'
  }]);
  const [popups, setPopups] = useState<ScorePopup[]>([]);
  const [scoreEarned, setScoreEarned] = useState(0);
  const [weather, setWeather] = useState<Weather>('clear');
  
  const [battery, setBattery] = useState(100);
  const [heat, setHeat] = useState(0);
  const [isCooledDown, setIsCooledDown] = useState(false);
  const [lightOn, setLightOn] = useState(false);
  
  const [fuseBlown, setFuseBlown] = useState(false);
  const [fuseHealth, setFuseHealth] = useState(10);
  
  const [lightningAlpha, setLightningAlpha] = useState(0);
  const [drones, setDrones] = useState<import('../types').Drone[]>([]);

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
    popups: [] as ScorePopup[],
    score: 0,
    time: DAY_DURATION,
    battery: 100,
    heat: 0,
    weather: 'clear' as Weather,
    isCooledDown: false,
    lightOn: false,
    fuseBlown: false,
    fuseHealth: 10,
    weatherTimer: 0, // internal logic clock for weather
    weatherManuallyCycled: false,
    timeSinceLastFailure: 0,
    nextFailureTarget: 30000 + Math.random() * 12000,
    shiftDocked: 0,
    lightningAlpha: 0,
    drones: [] as import('../types').Drone[],
  });

  // Keep ref synced
  useEffect(() => {
    stateRef.current.ships = ships;
    stateRef.current.popups = popups;
    stateRef.current.score = scoreEarned;
    stateRef.current.time = timeRemaining;
    stateRef.current.battery = battery;
    stateRef.current.heat = heat;
    stateRef.current.isCooledDown = isCooledDown;
    stateRef.current.lightOn = lightOn;
    stateRef.current.fuseBlown = fuseBlown;
    stateRef.current.fuseHealth = fuseHealth;
    stateRef.current.weather = weather;
    stateRef.current.lightningAlpha = lightningAlpha;
    stateRef.current.drones = drones;
  }, [ships, popups, scoreEarned, timeRemaining, battery, heat, isCooledDown, lightOn, fuseBlown, fuseHealth, weather, lightningAlpha, drones]);

  useEffect(() => {
    // Generate drones for the level
    const droneCount = Math.random() < 0.25 ? 1 : 0;
    const initialDrones = Array.from({length: droneCount}).map((_, i) => {
      const dir = Math.random() > 0.5 ? 1 : -1;
      return {
        id: `drone-${i}`,
        progress: dir === 1 ? -20 : 120, // starts offscreen
        altitude: 10 + Math.random() * 30,
        direction: dir,
        startTime: 10000 + Math.random() * 90000 // spawn sometime between 10s and 100s
      };
    }) as import('../types').Drone[] & {startTime: number, direction: number}[];

    stateRef.current.drones = initialDrones as any;

    const timerId = setInterval(() => {
      const s = stateRef.current;
      const c = controlsRef.current;

      let newShips = [...s.ships];
      let newPopups = [...s.popups];
      let newBattery = s.battery;
      let newHeat = s.heat;
      let newCooledDown = s.isCooledDown;
      let newLightOn = s.lightOn;
      let newFuseBlown = s.fuseBlown;
      let newFuseHealth = s.fuseHealth;
      let newScore = s.score;
      let newWeather = s.weather;
      let currentShiftDocked = s.shiftDocked;
      let newLightningAlpha = s.lightningAlpha;
      let newDrones = [...s.drones] as any; // Cast for internal startTime usage

      // 1. Time / Weather / Lightning Tick
      const nextTime = Math.max(0, s.time - TICK_RATE);
      if (nextTime === 0) {
        clearInterval(timerId);
        onDayEnd(newScore, currentShiftDocked);
        return;
      }
      s.weatherTimer += TICK_RATE;
      
      // Preset weather phases for dramatic pacing, mixed with chance
      if (!s.weatherManuallyCycled) {
        if (s.weatherTimer > 30000 && s.weatherTimer <= 65000 && newWeather !== 'fog' && newWeather !== 'storm') {
          newWeather = Math.random() < 0.4 ? 'storm' : 'fog';
          audio.playFoghorn();
          audio.setWeather(newWeather);
        }
        if (s.weatherTimer > 65000 && newWeather !== 'storm') {
           newWeather = 'storm';
           audio.playFoghorn();
           audio.setWeather('storm');
        }
      }

      if (newWeather === 'storm') {
         if (newLightningAlpha > 0) {
            newLightningAlpha = Math.max(0, newLightningAlpha - 0.05);
         } else if (Math.random() < 0.005) {
            newLightningAlpha = 0.8;
            setTimeout(() => {
               audio.playThunder();
            }, 100 + Math.random() * 320);
         }
      }

      // Process Drones
      const timeElapsed = DAY_DURATION - nextTime;
      newDrones.forEach((d: any) => {
         if (timeElapsed > d.startTime) {
            const timeSinceSpawn = timeElapsed - d.startTime;
            // Drone crosses the screen fully in 10 seconds (10000ms)
            if (d.direction === 1) {
              d.progress = -20 + (timeSinceSpawn / 10000) * 140;
            } else {
              d.progress = 120 - (timeSinceSpawn / 10000) * 140;
            }
         }
      });

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
        // System Failure Event
        s.timeSinceLastFailure += TICK_RATE;
        if (s.timeSinceLastFailure >= s.nextFailureTarget) {
          newFuseBlown = true;
          newFuseHealth = 3 + Math.floor(Math.random() * 8); // 3 to 10 taps
          s.timeSinceLastFailure = 0;
          s.nextFailureTarget = 30000 + Math.random() * 12000;
          audio.playSpark();
        }

        // Pump battery
        if (c.pumpQueue > 0) {
          newBattery = Math.min(100, newBattery + c.pumpQueue);
        }

        // Light processing
        // Can only turn on if user presses, no fuse blown, has battery, and not in cooldown
        if (c.isLightPressed && newBattery > 0 && !newCooledDown) {
          if (!newLightOn) {
            audio.playLightToggle(true);
          }
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
            audio.playLightToggle(false);
          }
        } else {
          if (newLightOn) {
            audio.playLightToggle(false);
          }
          newLightOn = false;
          newHeat = Math.max(0, newHeat - 0.9); // decay heat
          if (newHeat <= 0) {
            newCooledDown = false;
          }
        }
      }

      // 3. Ships Logic
      // Clean up dead ships (delay removing crashed ships slightly for animation)
      newShips = newShips.filter(ship => !(ship.status === 'crashed' && ship.distance < -15) && !(ship.status === 'cleared' && ship.distance < -15));

      // PRE-EVALUATE DOCK TAP
      if (c.dockTaps > 0) {
        const dockable = newShips.filter(s => s.status === 'approaching' && s.distance < 85 && s.distance > 0);
        if (dockable.length > 0) {
          const match = dockable.find(s => Math.abs(s.frequency - c.tunedFreq) <= 0.6);
          if (match) {
             const diff = Math.abs(match.frequency - c.tunedFreq);
             match.status = 'cleared';
             currentShiftDocked += 1;
             
             let perfectPoints = 150;
             let okPoints = 75;
             if (match.shipClass === 'cargoship') { perfectPoints = 250; okPoints = 125; }
             if (match.shipClass === 'speedboat') { perfectPoints = 100; okPoints = 50; }

             const earned = diff < 0.1 ? perfectPoints : okPoints;
             newScore += earned;
             
             audio.playDock(diff >= 0.1);
             newPopups.push({ id: Date.now() + Math.random(), text: `+${earned}`, distance: match.distance, color: diff < 0.1 ? 'text-green-400' : 'text-yellow-400' });
          } else {
             audio.playError();
          }
        }
      }

      newShips.forEach(ship => {
        if (ship.status === 'approaching') {
          // Speed calculations
          let speed = 0.2; // base
          if (ship.shipClass === 'cargoship') speed = 0.12;
          if (ship.shipClass === 'speedboat') speed = 0.35;

          if (newWeather === 'fog') speed *= (upgrades.autoFoghorn ? 0.75 : 2.0); // fog makes things scarier/faster or slowed if auto
          if (newWeather === 'storm') speed *= 2.5; // frantic
          if (newLightOn) speed *= 0.3; // Light slows ships down significantly for safety

          ship.distance -= speed;

          // Collision Check
          if (ship.distance <= 0) {
            ship.status = 'crashed';
            audio.playError();
            
            let penalty = 100;
            
            // Prevent going below 0 points if hasn't reached 3 ships yet
            if (totalDockedShips + currentShiftDocked < 3) {
                const potentialTotal = globalScore + newScore - penalty;
                if (potentialTotal < 0) {
                    penalty = Math.max(0, globalScore + newScore);
                }
            }
            
            newScore -= penalty;
            if (penalty > 0) {
                newPopups.push({ id: Date.now() + Math.random(), text: `-${penalty}`, distance: 15, color: 'text-red-600' });
            }
            
            // Check immediate gameover
            if (globalScore + newScore < 0 && (totalDockedShips + currentShiftDocked) >= 3) {
                clearInterval(timerId);
                onDayEnd(newScore, currentShiftDocked);
                return;
            }
          }
        } else {
          // Keep floating away rapidly after resolving
          ship.distance -= 1.0;
        }
      });

      // Spawning
      const activeApproachShips = newShips.filter(s => s.status === 'approaching');
      
      // Ensure min distance between ships in the same lane
      const lanes = [0, 1, 2];
      const availableLanes = lanes.filter(lane => {
        const shipsInLane = activeApproachShips.filter(s => s.lane === lane);
        return shipsInLane.every(s => s.distance < 80);
      });

      if (activeApproachShips.length < 4 && availableLanes.length > 0) {
        // High chance to spawn if empty, natural chance otherwise
        const spawnChance = activeApproachShips.length === 0 ? 0.05 : 0.015;
        
        if (Math.random() < spawnChance) {
          const pickedLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
          const randClass = Math.random();
          const shipClass = randClass < 0.2 ? 'cargoship' : (randClass < 0.4 ? 'speedboat' : 'standard');
          
          newShips.push({
            id: Math.random().toString(36).substring(7),
            distance: 100, // start offscreen right
            frequency: 80.0 + (Math.floor(Math.random() * 41) * 0.5), // 80.0 to 100.0 in 0.5 steps
            speed: 0.2,
            lane: pickedLane,
            status: 'approaching',
            shipClass: shipClass
          });
        }
      }

      newPopups = newPopups.filter(p => Date.now() - Math.floor(p.id) < 1500);

      // Reset action queues for next tick
      c.pumpQueue = 0;
      c.dockTaps = 0;
      c.fuseFixTaps = 0;

      s.shiftDocked = currentShiftDocked;

      // Update React State batch
      setTimeRemaining(nextTime);
      setShips(newShips);
      setPopups(newPopups);
      setBattery(newBattery);
      setHeat(newHeat);
      setIsCooledDown(newCooledDown);
      setLightOn(newLightOn);
      setFuseBlown(newFuseBlown);
      setFuseHealth(newFuseHealth);
      setScoreEarned(newScore);
      setWeather(newWeather);
      setLightningAlpha(newLightningAlpha);
      setDrones(newDrones);

    }, TICK_RATE);

    return () => {
      clearInterval(timerId);
      audio.setWeather('clear');
    };
  }, [upgrades, onDayEnd]);

  const handleCycleWeather = useCallback(() => {
    stateRef.current.weatherManuallyCycled = true;
    const current = stateRef.current.weather;
    const next = current === 'clear' ? 'fog' : (current === 'fog' ? 'storm' : 'clear');
    setWeather(next);
    audio.setWeather(next);
    if (next === 'fog' || next === 'storm') {
      audio.playFoghorn();
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-black">
      <LighthouseView 
        weather={weather}
        ships={ships}
        lightOn={lightOn}
        popups={popups}
        lightningAlpha={lightningAlpha}
        drones={drones}
        onCycleWeather={handleCycleWeather}
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
        shipsApproaching={ships.some(s => s.status === 'approaching' && s.distance < 85)}
        timeRemaining={timeRemaining}
        t={t}
      />
    </div>
  );
}
