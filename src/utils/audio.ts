import { useState, useEffect, useRef } from 'react';

const TRACKS = {
  anthem: '/music/UkraineAnthem.mp3',
  hava: '/music/HavaNagilah.mp3',
  seven: '/music/740.mp3',
  odessa: '/music/OdesaMama.mp3',
  stefania: '/music/KalushStefania.mp3',
  verka: '/music/DancingLashaTumbai.mp3',
  nich: '/music/NichYakaMisyachn.mp3',
  nichStrings: '/music/NichYakaMisyachn_strings.mp3',
};

export const TRACK_ORDER: TrackKey[] = ['anthem', 'hava', 'seven', 'odessa', 'stefania', 'verka', 'nich', 'nichStrings'];

export type TrackKey = keyof typeof TRACKS;

export function useAudio() {
  const [musicEnabled, setMusicEnabled] = useState(() => false);
  const [activeTracks, setActiveTracks] = useState<TrackKey[]>(() => {
    try {
      const saved = localStorage.getItem('odesa_active_tracks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const validKeys = parsed.filter(k => TRACKS.hasOwnProperty(k)) as TrackKey[];
          if (validKeys.length > 0) return validKeys;
        }
      }
    } catch (e) {
      console.warn('[Audio] Failed to parse active tracks from localStorage', e);
    }
    return [...TRACK_ORDER];
  });

  const [currentTrack, setCurrentTrack] = useState<TrackKey | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [volume, setVolume] = useState(() => 
    parseFloat(localStorage.getItem('odesa_music_volume') || '0.5')
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wasPlayingRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;

  const scheduleSave = () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      localStorage.setItem('odesa_music', String(musicEnabled));
      localStorage.setItem('odesa_active_tracks', JSON.stringify(activeTracks));
      localStorage.setItem('odesa_music_volume', String(volume));
    }, 300);
  };

  useEffect(() => {
    scheduleSave();
  }, [musicEnabled, activeTracks, volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const playTrackSrcRef = useRef<(src: string, track: TrackKey, retries?: number) => void>(null!);

  const playTrackSrc = (src: string, track: TrackKey, retries = 0) => {
    if (!audioRef.current) return;
    audioRef.current.src = src;
    audioRef.current.play().catch(() => {
      if (retries < TRACK_ORDER.length) {
        const idx = (TRACK_ORDER.indexOf(track) + 1) % TRACK_ORDER.length;
        const nextTrack = TRACK_ORDER[idx];
        playTrackSrc(TRACKS[nextTrack], nextTrack, retries + 1);
        setCurrentTrack(nextTrack);
        setCurrentIndex(idx);
      }
    });
  };

  playTrackSrcRef.current = playTrackSrc;

  const playNextTrack = () => {
    if (activeTracks.length === 0) {
      setMusicEnabled(false);
      return;
    }
    const randomIndex = Math.floor(Math.random() * activeTracks.length);
    const nextTrack = activeTracks[randomIndex];
    if (audioRef.current) {
      const src = TRACKS[nextTrack];
      if (src) {
        playTrackSrc(src, nextTrack);
        setCurrentTrack(nextTrack);
        setCurrentIndex(TRACK_ORDER.indexOf(nextTrack));
      }
    }
  };

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = playNextTrack;
      audioRef.current.onerror = () => {
        const track = currentTrackRef.current;
        if (track) {
          const idx = (TRACK_ORDER.indexOf(track) + 1) % TRACK_ORDER.length;
          const nextTrack = TRACK_ORDER[idx];
          playTrackSrcRef.current(TRACKS[nextTrack], nextTrack);
          setCurrentTrack(nextTrack);
          setCurrentIndex(idx);
        }
      };
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      }
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
      }
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (audioRef.current && !audioRef.current.paused) {
          wasPlayingRef.current = true;
          audioRef.current.pause();
        }
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = null;
          navigator.mediaSession.playbackState = 'none';
        }
      } else {
        const lastTrack = currentTrackRef.current;
        if (wasPlayingRef.current && musicEnabled && activeTracks.length > 0 && audioRef.current && lastTrack) {
          playTrackSrc(audioRef.current.src || TRACKS[lastTrack], lastTrack);
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = null;
            navigator.mediaSession.playbackState = 'none';
          }
        }
        wasPlayingRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [musicEnabled, activeTracks]);

  const playMusic = (forcePlay = false) => {
    if (!audioRef.current) return;

    const shouldPlay = (musicEnabled && activeTracks.length > 0) || forcePlay;
    if (!shouldPlay) return;

    const currentSrc = audioRef.current.src;
    if (!currentSrc || currentSrc === "" || currentSrc.endsWith("undefined") || currentSrc === window.location.href) {
      if (activeTracks.length > 0) {
        const randomIndex = Math.floor(Math.random() * activeTracks.length);
        const track = activeTracks[randomIndex];
        const src = TRACKS[track];
        if (src) {
          console.log(`[Audio] Setting initial src: ${src}`);
          audioRef.current.src = src;
          setCurrentTrack(track);
          setCurrentIndex(TRACK_ORDER.indexOf(track));
        }
      }
    }

    if (audioRef.current.src && !audioRef.current.src.endsWith("undefined") && audioRef.current.src !== window.location.href) {
      audioRef.current.play().catch(e => {
        console.warn(`[Audio] Play failed: ${e.message}`, { src: audioRef.current?.src, state: audioRef.current?.readyState });
      });
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      }
    }
  };

  const stopMusic = () => {
    audioRef.current?.pause();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  };

  const skipTrack = () => {
    let nextIndex = (currentIndex + 1) % TRACK_ORDER.length;
    
    if (activeTracks.length > 0) {
      for (let i = 1; i <= TRACK_ORDER.length; i++) {
        const idx = (currentIndex + i) % TRACK_ORDER.length;
        if (activeTracks.includes(TRACK_ORDER[idx])) {
          nextIndex = idx;
          break;
        }
      }
    }
    
    const track = TRACK_ORDER[nextIndex];
    setCurrentIndex(nextIndex);
    
    if (audioRef.current) {
      const src = TRACKS[track];
      if (musicEnabled) {
        playTrackSrc(src, track);
      } else {
        audioRef.current.src = src;
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      }
      setCurrentTrack(track);
    }
  };

  const prevTrack = () => {
    let prevIndex = (currentIndex - 1 + TRACK_ORDER.length) % TRACK_ORDER.length;
    
    if (activeTracks.length > 0) {
      for (let i = 1; i <= TRACK_ORDER.length; i++) {
        const idx = (currentIndex - i + TRACK_ORDER.length) % TRACK_ORDER.length;
        if (activeTracks.includes(TRACK_ORDER[idx])) {
          prevIndex = idx;
          break;
        }
      }
    }
    
    const track = TRACK_ORDER[prevIndex];
    setCurrentIndex(prevIndex);
    
    if (audioRef.current) {
      const src = TRACKS[track];
      if (musicEnabled) {
        playTrackSrc(src, track);
      } else {
        audioRef.current.src = src;
      }
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      }
      setCurrentTrack(track);
    }
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.onended = null;
        audioRef.current = null;
      }
    };
  }, []);

  return { musicEnabled, setMusicEnabled, activeTracks, setActiveTracks, tracks: TRACKS, trackOrder: TRACK_ORDER, playMusic, stopMusic, skipTrack, prevTrack, currentTrack, volume, setVolume };
}
