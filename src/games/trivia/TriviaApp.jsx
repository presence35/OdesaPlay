import React, { useState, useEffect, useCallback, useRef } from 'react';
import questionsData from './questions.json';
import translationsData from './translations.json';
import GameEndScreen from '../GameEndScreen';

const CATEGORIES = ["Odesa", "Ukraine", "History", "Geography", "Culture", "Science", "Current Events", "Sports"];
const DIFFICULTIES = ["easy", "medium", "hard"];

const DIFF_COLORS = {
  easy: "#4ade80",
  medium: "#fbbf24",
  hard: "#f87171"
};

const CAT_ICONS = {
  Odesa: "⚓",
  Ukraine: "🌻",
  History: "📜",
  Geography: "🗺️",
  Culture: "🎭",
  Science: "🔬",
  "Current Events": "📰",
  Sports: "🏆",
};

// SFX Utility using shared AudioContext to handle browser autoplay policies
import { getAudioContext, resumeAudioContext } from '../../utils/audioContext';
let audioCtx = null;
const playSound = (type, enabled) => {
  if (!enabled) return;
  try {
    if (!audioCtx) audioCtx = getAudioContext();
    resumeAudioContext();
    
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'wrong') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.02, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch (e) { console.warn("Audio Context blocked or failed", e); }
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TriviaGame() {
  const [screen, setScreen] = useState("menu");
  const [allQuestions, setAllQuestions] = useState([]);
  const [translations, setTranslations] = useState(null);
  const [lang, setLang] = useState('en');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Filter States (Multi-select)
  const [selectedCats, setSelectedCats] = useState(CATEGORIES);
  const [selectedDiffs, setSelectedDiffs] = useState(DIFFICULTIES);
  const [score, setScore] = useState(0);
  const scoreRef = useRef(0);
  const [answers, setAnswers] = useState([]);
  const [animating, setAnimating] = useState(false);

  const [paused, setPaused] = useState(false);
  const pausedAtRef = useRef(null);
  const [cheatNotice, setCheatNotice] = useState(null);
  const screenRef = useRef(screen);
  const questionsRef = useRef(questions);
  const currentIdxRef = useRef(currentIdx);

  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  useEffect(() => {
    if (window.Odesa) {
      window.Odesa.onConfig((cfg) => {
        if (cfg.lang) setLang(cfg.lang);
        if (cfg.sfxEnabled !== undefined) setSoundEnabled(cfg.sfxEnabled);
      });
      window.Odesa.onStop(() => {
        if (window.Odesa) window.Odesa.gameOver(scoreRef.current);
        setScreen("results");
      });
      if (window.Odesa.onPause) {
        window.Odesa.onPause(() => {
          if (screenRef.current === 'quiz') {
            pausedAtRef.current = Date.now();
            setPaused(true);
          }
        });
      }
      if (window.Odesa.onResume) {
        window.Odesa.onResume(() => {
          if (pausedAtRef.current) {
            const elapsed = Date.now() - pausedAtRef.current;
            pausedAtRef.current = null;
            setPaused(false);
            if (elapsed >= 10000 && screenRef.current === 'quiz') {
              const nextIdx = currentIdxRef.current + 1;
              const qs = questionsRef.current;
              if (nextIdx < qs.length) {
                setCurrentIdx(nextIdx);
                setSelected(null);
                setRevealed(false);
                setCheatNotice('Looks like you went searching — here\'s a fresh question!');
                setTimeout(() => setCheatNotice(null), 4000);
              }
            }
          }
        });
      }
      if (window.Odesa.ready) window.Odesa.ready();
    }
  }, []);

  useEffect(() => {
    setAllQuestions(questionsData);
    setTranslations(translationsData);
  }, []);

  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);

  const t = (translations && translations[lang]) || (translations && translations.en) || {};

  const filtered = allQuestions.filter(q =>
    selectedCats.includes(q.category) &&
    selectedDiffs.includes(q.difficulty)
  );

  const toggleCat = (cat) => {
    playSound('click', soundEnabled);
    setSelectedCats(prev => prev.includes(cat) ? (prev.length > 1 ? prev.filter(c => c !== cat) : prev) : [...prev, cat]);
  };

  const toggleDiff = (diff) => {
    playSound('click', soundEnabled);
    setSelectedDiffs(prev => prev.includes(diff) ? (prev.length > 1 ? prev.filter(d => d !== diff) : prev) : [...prev, diff]);
  };

  const startQuiz = useCallback(() => {
    playSound('click', soundEnabled);
    const pool = shuffle(filtered).slice(0, 30);
    setQuestions(pool);
    setCurrentIdx(0);
    setSelected(null);
    setRevealed(false);
    setScore(0);
    setAnswers([]);
    setScreen("quiz");
    if (window.parent) {
      window.parent.postMessage({ type: 'ODESAPLAY_GAME_STARTED' }, window.location.origin);
    }
  }, [filtered, soundEnabled]);

  const handleSelect = (idx) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    const q = questions[currentIdx];
    const points = q.difficulty === 'hard' ? 3 : q.difficulty === 'medium' ? 2 : 1;
    const correct = idx === q.answer;
    if (correct) {
      setScore(s => s + points);
      playSound('correct', soundEnabled);
    } else {
      playSound('wrong', soundEnabled);
    }
    setAnswers(a => [...a, { question: q, chosen: idx, correct, points: correct ? points : 0 }]);
  };

  const handleNext = () => {
    if (animating) return;
    playSound('click', soundEnabled);
    setAnimating(true);
    setTimeout(() => {
      if (currentIdx + 1 >= questions.length) {
        if (window.Odesa) window.Odesa.gameOver(scoreRef.current);
        setScreen("results");
      } else {
        setCurrentIdx(i => i + 1);
        setSelected(null);
        setRevealed(false);
      }
      setAnimating(false);
    }, 300);
  };

  const q = questions[currentIdx];
  const progress = questions.length ? ((currentIdx + (revealed ? 1 : 0)) / questions.length) * 100 : 0;

  if (!translations) return <div style={{ color: '#e8dcc8', textAlign: 'center', paddingTop: 100 }}>Loading...</div>;

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      background: "linear-gradient(135deg, #0a0a1a 0%, #0f1a2e 50%, #0a1220 100%)",
      fontFamily: "'Crimson Text', 'Georgia', serif",
      color: "#e8dcc8",
      overflowY: "auto",
      overscrollBehavior: "contain"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=Cinzel:wght@400;600;700&family=Roboto:wght@400;500&display=swap');
        .btn-primary {
          background: linear-gradient(135deg, #c8960a, #e8b420);
          color: #1a0a00;
          border: none;
          padding: 14px 32px;
          border-radius: 4px;
          font-family: 'Cinzel', serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 1px;
          transition: all 0.2s;
          text-transform: uppercase;
        }
        .btn-primary:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(200,150,10,0.4); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .btn-next-small {
          background: #0057b7;
          color: #ffd700;
          border: none;
          padding: 6px 16px;
          border-radius: 4px;
          font-family: 'Cinzel', serif;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 1px;
          transition: all 0.2s;
          text-transform: uppercase;
          margin-left: auto;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .btn-next-small:disabled { background: #555; color: #aaa; cursor: default; pointer-events: none; }
        .btn-next-small:not(:disabled):hover { background: #0066d6; transform: translateY(-1px); }

        .btn-ghost {
          background: transparent;
          color: #c8b878;
          border: 1px solid #4a3a1a;
          padding: 10px 24px;
          border-radius: 4px;
          font-family: 'Cinzel', serif;
          font-size: 13px;
          cursor: pointer;
          letter-spacing: 1px;
          transition: all 0.2s;
          text-transform: uppercase;
        }
        .btn-ghost:hover { border-color: #c8960a; color: #e8b420; }
        .option-btn {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1.5px solid rgba(200,180,100,0.15);
          color: #e8dcc8;
          padding: 16px 20px;
          border-radius: 6px;
          font-family: 'Crimson Text', serif;
          font-size: 17px;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
          margin-bottom: 10px;
          line-height: 1.4;
        }
        .option-btn:hover:not(:disabled) { background: rgba(200,150,10,0.1); border-color: rgba(200,150,10,0.4); }
        .option-btn:disabled { cursor: default; }
        .option-correct { background: rgba(74,222,128,0.15) !important; border-color: #4ade80 !important; color: #4ade80 !important; }
        .option-wrong { background: rgba(248,113,113,0.15) !important; border-color: #f87171 !important; color: #f87171 !important; }
        
        .chip {
          display: inline-block;
          padding: 6px 18px;
          border-radius: 20px;
          font-family: 'Cinzel', serif;
          font-size: 13px;
          letter-spacing: 1px;
          cursor: pointer;
          border: 1.5px solid rgba(200,180,100,0.15);
          transition: all 0.2s;
          text-transform: uppercase;
          background: rgba(255,255,255,0.04);
        }
        .chip-off {
          filter: grayscale(100%);
          opacity: 0.4;
          color: #9a8068;
        }
        .chip-on-cat { border-color: #c8960a; color: #e8b420; background: rgba(200,150,10,0.12); }
        
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a0a1a; }
        ::-webkit-scrollbar-thumb { background: #4a3a1a; border-radius: 3px; }
        .fade-in { animation: fadeIn 0.4s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .ornament { color: #c8960a; font-size: 22px; }
        
        .btn-start-quiz {
          background: #0057b7;
          color: #ffd700;
          border: none;
          padding: 14px 32px;
          border-radius: 4px;
          font-family: 'Cinzel', serif;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 1px;
          transition: all 0.2s;
          text-transform: uppercase;
        }
        .btn-start-quiz:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0,87,183,0.4); }
        .btn-start-quiz:disabled { opacity: 0.5; cursor: not-allowed; }

        .title-ukr {
          background: linear-gradient(90deg, #0057b7 45%, #ffd700 55%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          display: inline-block;
        }

        .score-splash {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.9);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          animation: splashIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes splashIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "10%", right: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(200,150,10,0.06) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", bottom: "5%", left: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(30,80,160,0.08) 0%, transparent 70%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 760, margin: "0 auto", padding: "0 16px" }}>

        {/* ===== MENU ===== */}
        {screen === "menu" && (
          <div className="fade-in">
            <div style={{ textAlign: "center", paddingTop: 30, paddingBottom: 20 }}>
              <h1 className="title-ukr" style={{ fontFamily: "'Cinzel', serif", fontSize: "clamp(28px, 6vw, 52px)", fontWeight: 700, letterSpacing: 3, lineHeight: 1.2 }}>
                {t.title}
              </h1>
              <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: "clamp(13px, 2.5vw, 18px)", fontWeight: 400, color: "#c8a860", letterSpacing: 5, marginTop: 4, textTransform: "uppercase" }}>
                {t.subtitle}
              </h2>
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(200,180,100,0.1)", borderRadius: 10, padding: 24, marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: 16, gap: 8 }}>
                <p style={{ fontFamily: "'Roboto', sans-serif", fontSize: 14, color: "#c8a860", letterSpacing: 0.5 }}>
                  {t.filterNote}
                </p>
                <p style={{ fontFamily: "'Roboto', sans-serif", fontSize: 14, color: "#c8a860", letterSpacing: 0.5 }}>
                  ({t.questionsCount?.replace('{n}', filtered.length)})
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 13, letterSpacing: 2, color: "#9a8a68", textTransform: "uppercase" }}>{t.category}</p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 24 }}>
                {CATEGORIES.map(c => {
                  const active = selectedCats.includes(c);
                  return (
                    <button key={c} className={`chip ${active ? "chip-on-cat" : "chip-off"}`}
                      onClick={() => toggleCat(c)}>
                      {CAT_ICONS[c] || "🌍"} {t[`cat${c.replace(/\s+/g, '')}`] || c}
                    </button>
                  );
                })}
              </div>

              <p style={{ fontFamily: "'Cinzel', serif", fontSize: 12, letterSpacing: 2, color: "#9a8a68", marginBottom: 14, textTransform: "uppercase" }}>{t.difficulty}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {DIFFICULTIES.map(d => {
                  const active = selectedDiffs.includes(d);
                  return (
                    <button key={d} className={`chip ${active ? "" : "chip-off"}`}
                      style={{ color: active ? DIFF_COLORS[d] : "#9a8068", borderColor: active ? DIFF_COLORS[d] + "88" : "rgba(200,180,100,0.15)", background: active ? DIFF_COLORS[d] + "11" : "rgba(255,255,255,0.04)" }}
                      onClick={() => toggleDiff(d)}>
                      {d === "easy" ? t.diffEasy : d === "medium" ? t.diffMedium : t.diffHard}
                    </button>
                  );
                })}
              </div>

            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="btn-start-quiz" onClick={startQuiz} disabled={filtered.length === 0}>
                ▶ {t.start}
              </button>
            </div>
          </div>
        )}

        {/* ===== QUIZ ===== */}
        {screen === "quiz" && q && (
          <div className="fade-in" style={{ paddingTop: 10, position: 'relative' }}>
            {paused && (
              <div className="fade-in" style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(10,10,26,0.92)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 32, fontWeight: 700, color: '#c8a860', letterSpacing: 4 }}>PAUSED</p>
                <p style={{ fontFamily: "'Roboto', sans-serif", fontSize: 14, color: '#9a8a68', marginTop: 12 }}>Tab back to continue</p>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontFamily: "'Cinzel', serif", color: DIFF_COLORS[q.difficulty], letterSpacing: 1, background: `${DIFF_COLORS[q.difficulty]}11`, padding: "4px 10px", borderRadius: 20, border: `1px solid ${DIFF_COLORS[q.difficulty]}`, whiteSpace: "nowrap" }}>
                  {CAT_ICONS[q.category] || ""} {t[`cat${q.category.replace(/\s+/g, '')}`] || q.category}
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Cinzel', serif", fontSize: 15, color: "#e8b420", fontWeight: 600 }}>
                  {score} <span style={{ fontSize: 12, fontWeight: 400, color: "#9a8a68", marginLeft: 4 }}>{score === 1 ? t.pt : t.pts}</span>
                </div>
                <button className="btn-next-small fade-in" onClick={handleNext} disabled={!revealed}>
                  {currentIdx + 1 >= questions.length ? t.seeResults : t.next}
                </button>
              </div>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #c8960a, #e8b420)", transition: "width 0.5s ease", borderRadius: 3 }} />
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(200,180,100,0.12)", borderRadius: 10, padding: "24px 22px", marginBottom: 20 }}>
              <p style={{ fontSize: "clamp(17px, 2.5vw, 20px)", lineHeight: 1.55, color: "#f0e8d0" }}>
                {typeof q.question === 'object' ? q.question[lang] : q.question}
              </p>
            </div>

            <div>
              {(Array.isArray(q.options) ? q.options : (q.options[lang] || q.options.en || [])).map((opt, i) => {
                let cls = "option-btn";
                if (revealed) {
                  if (i === q.answer) cls += " option-correct";
                  else if (i === selected && i !== q.answer) cls += " option-wrong";
                }
                return (
                  <button key={i} className={cls} onClick={() => handleSelect(i)} disabled={revealed}>
                    <span style={{ fontFamily: "'Cinzel', serif", fontSize: 13, color: revealed && i === q.answer ? "#4ade80" : revealed && i === selected ? "#f87171" : "#9a8068", marginRight: 12 }}>
                      {String.fromCharCode(65 + i)}.
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>

            {revealed && (
              <div className="fade-in" style={{ background: selected === q.answer ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)", border: `1px solid ${selected === q.answer ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`, borderRadius: 8, padding: 18, marginTop: 4, marginBottom: 16 }}>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: "#c8b898", fontFamily: "'Roboto', sans-serif" }}>
                  {typeof q.fact === 'object' ? q.fact[lang] : q.fact}
                </p>
              </div>
            )}

            {cheatNotice && (
              <div className="fade-in" style={{ background: 'rgba(200,150,10,0.1)', border: '1px solid rgba(200,150,10,0.3)', borderRadius: 8, padding: '14px 18px', marginTop: 8, marginBottom: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 14, color: '#e8b420', fontFamily: "'Roboto', sans-serif", fontWeight: 500 }}>
                  {cheatNotice}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ===== RESULTS ===== */}
        {screen === "results" && (
          <GameEndScreen
            score={score}
            won
            title={{ win: t.complete, lose: t.complete }}
            subtitle={score / (questions.length * 1) >= 0.9 ? t.scholar : score / (questions.length * 1) >= 0.7 ? t.wellDone : score / (questions.length * 1) >= 0.5 ? t.goodEffort : t.keepLearning}
            onPlayAgain={startQuiz}
            onQuit={() => window.parent.postMessage({ type: 'ODESAPLAY_RESTART' }, window.location.origin)}
            t={{ playAgain: t.playAgain, tryAgain: t.playAgain, quit: t.quit }}
            secondaryLabel={`← ${t.menu}`}
            onSecondary={() => { playSound('click', soundEnabled); setScreen("menu"); }}
          />
        )}

      </div>
    </div>
  );
}



