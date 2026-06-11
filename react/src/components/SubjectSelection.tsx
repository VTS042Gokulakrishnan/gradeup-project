import React, { useState, useEffect } from "react";

/* ─── Types ─── */
interface Subject {
  value: string;
  label: string;
  icon: React.ElementType;
  color: string;
  id: number;
  progress?: number;
  totalLessons?: number;
}

interface SubjectSelectionProps {
  subjects: Subject[];
  onSelectSubject: (id: number) => void;
}

/* ─── CSS matching dashboard design system ─── */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

.ss-root {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  background: #f8fafc;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto; 
}
.dark .ss-root { background: #0b1120; }
.dark .ss-hero { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #c026d3 100%); }
.dark .ss-search { background: rgba(0,0,0,.18); border-color: rgba(255,255,255,.15); }
.dark .ss-search:focus { background: rgba(0,0,0,.25); border-color: rgba(255,255,255,.3); }
.dark .ss-section-label { color: #64748b; }
.dark .ss-recent-card {
  background: #1e293b;
  border-color: rgba(255,255,255,.08);
  box-shadow: 0 2px 12px rgba(0,0,0,.3);
}
.dark .ss-recent-card:hover { border-color: rgba(99,102,241,.4); }
.dark .ss-recent-name { color: #f1f5f9; }
.dark .ss-recent-bar-bg { background: #334155; }
.dark .ss-recent-pct { color: #a5b4fc; }
.dark .ss-empty { background: #1e293b; border-color: #334155; }
.dark .ss-empty-title { color: #f1f5f9; }
.dark .ss-empty-sub { color: #94a3b8; }

/* ── HERO BANNER — matches dashboard hero ── */
.ss-hero {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  padding: 28px 32px 36px;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}
.ss-hero::before {
  content: '';
  position: absolute; top: -60px; right: -60px;
  width: 260px; height: 260px; border-radius: 50%;
  background: rgba(255,255,255,.09);
}
.ss-hero::after {
  content: '';
  position: absolute; bottom: -80px; left: 25%;
  width: 200px; height: 200px; border-radius: 50%;
  background: rgba(255,255,255,.06);
}
.ss-hero-inner {
  position: relative; z-index: 1;
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 16px;
}
.ss-hero-left { display: flex; align-items: center; gap: 14px; }
.ss-hero-icon {
  width: 52px; height: 52px; border-radius: 16px;
  background: rgba(255,255,255,.18);
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid rgba(255,255,255,.25);
  flex-shrink: 0;
}
.ss-hero-icon svg { width: 26px; height: 26px; color: #fff; }
.ss-hero-title {
  font-size: clamp(20px, 3vw, 28px); font-weight: 800;
  color: #fff; letter-spacing: -.5px; margin-bottom: 3px;
}
.ss-hero-sub { font-size: 14px; color: rgba(255,255,255,.72); }

/* Search bar */
.ss-search-wrap {
  position: relative;
  width: 100%; max-width: 400px;
}
.ss-search-icon {
  position: absolute; left: 16px; top: 50%; transform: translateY(-50%);
  width: 18px; height: 18px; color: rgba(255,255,255,.6);
  pointer-events: none;
}
.ss-search {
  width: 100%; height: 48px;
  background: rgba(255,255,255,.16);
  border: 1.5px solid rgba(255,255,255,.25);
  border-radius: 14px;
  padding: 0 44px 0 46px;
  font-size: 14px; font-weight: 500;
  color: #fff; font-family: inherit;
  outline: none;
  transition: all .2s;
}
.ss-search::placeholder { color: rgba(255,255,255,.5); }
.ss-search:focus {
  background: rgba(255,255,255,.22);
  border-color: rgba(255,255,255,.5);
  box-shadow: 0 0 0 3px rgba(255,255,255,.12);
}
.ss-search-clear {
  position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(255,255,255,.2); border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: #fff;
  transition: background .15s;
}
.ss-search-clear:hover { background: rgba(255,255,255,.35); }
.ss-search-clear svg { width: 12px; height: 12px; }

/* ── BODY ── */
.ss-body {

  padding: 28px 32px 40px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

/* Section label — matches dashboard style */
.ss-section-label {
  display: flex; align-items: center; gap: 7px;
  font-size: 10.5px; font-weight: 700; letter-spacing: .1em;
  text-transform: uppercase; color: #64748b;
  margin-bottom: 16px;
}
.ss-section-label svg { width: 13px; height: 13px; }

/* ── RECENT CARDS ── */
.ss-recent-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 32px;
}
.ss-recent-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
  background: #fff; border-radius: 16px;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 2px 10px rgba(0,0,0,.05);
  cursor: pointer; transition: all .22s cubic-bezier(.4,0,.2,1);
  animation: cardIn .45s cubic-bezier(.34,1.56,.64,1) both;
}
.ss-recent-card:hover {
  border-color: #c7d2fe;
  box-shadow: 0 6px 24px rgba(99,102,241,.12);
  transform: translateY(-3px);
}
.ss-recent-card-left { display: flex; align-items: center; gap: 12px; overflow: hidden; }
.ss-recent-icon {
  width: 40px; height: 40px; border-radius: 11px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.ss-recent-icon svg { width: 20px; height: 20px; }
.ss-recent-name { font-size: 13.5px; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ss-recent-progress { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
.ss-recent-bar-bg { width: 48px; height: 4px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
.ss-recent-bar-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg,#6366f1,#8b5cf6); }
.ss-recent-pct { font-size: 10px; font-weight: 700; color: #6366f1; }
.ss-recent-spark { flex-shrink: 0; opacity: 0; transition: opacity .2s; }
.ss-recent-card:hover .ss-recent-spark { opacity: 1; }
.ss-recent-spark svg { width: 15px; height: 15px; color: #8b5cf6; }

/* ── SUBJECT CARDS ── */
.ss-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 18px;
}
.ss-card {
  position: relative;
  border-radius: 22px;
  aspect-ratio: 4/3.6;
  padding: 22px;
  color: #fff;
  cursor: pointer;
  border: none;
  overflow: hidden;
  display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between;
  transition: all .35s cubic-bezier(.4,0,.2,1);
  animation: cardIn .5s cubic-bezier(.34,1.56,.64,1) both;
  text-align: left;
}
.ss-card:hover {
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 24px 60px rgba(0,0,0,.22);
}
.ss-card:active { transform: scale(.97); }

/* Animated delays */
.ss-card:nth-child(1){animation-delay:.04s}
.ss-card:nth-child(2){animation-delay:.08s}
.ss-card:nth-child(3){animation-delay:.12s}
.ss-card:nth-child(4){animation-delay:.16s}
.ss-card:nth-child(5){animation-delay:.20s}
.ss-card:nth-child(6){animation-delay:.24s}
.ss-card:nth-child(7){animation-delay:.28s}
.ss-card:nth-child(8){animation-delay:.32s}

/* Glow orb inside card */
.ss-card-orb {
  position: absolute; top: -24px; right: -24px;
  width: 100px; height: 100px; border-radius: 50%;
  background: rgba(255,255,255,.12);
  transition: all .4s;
}
.ss-card:hover .ss-card-orb { transform: scale(1.6); background: rgba(255,255,255,.18); }

/* Card top row */
.ss-card-top { display: flex; align-items: flex-start; justify-content: space-between; width: 100%; z-index: 1; }
.ss-card-emoji { font-size: 40px; line-height: 1; transition: transform .35s cubic-bezier(.34,1.56,.64,1); }
.ss-card:hover .ss-card-emoji { transform: rotate(10deg) scale(1.15); }
.ss-card-done {
  width: 28px; height: 28px; border-radius: 50%;
  background: rgba(255,255,255,.22); border: 1px solid rgba(255,255,255,.35);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.ss-card-done svg { width: 15px; height: 15px; }

/* Card bottom */
.ss-card-bottom { width: 100%; z-index: 1; }
.ss-card-name { font-size: 18px; font-weight: 800; letter-spacing: -.3px; margin-bottom: 10px; line-height: 1.2; }
.ss-card-bar-bg { width: 100%; height: 6px; background: rgba(0,0,0,.15); border-radius: 6px; overflow: hidden; margin-bottom: 6px; }
.ss-card-bar-fill { height: 100%; border-radius: 6px; background: rgba(255,255,255,.9); box-shadow: 0 0 8px rgba(255,255,255,.5); transition: width .8s cubic-bezier(.4,0,.2,1); }
.ss-card-meta { display: flex; justify-content: space-between; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; opacity: .85; }

/* ── EMPTY STATE ── */
.ss-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 64px 32px;
  background: #fff; border-radius: 24px;
  border: 2px dashed #e0e7ff;
  animation: cardIn .3s ease both;
}
.ss-empty-icon { font-size: 64px; margin-bottom: 16px; }
.ss-empty-title { font-size: 20px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
.ss-empty-sub   { font-size: 14px; color: #94a3b8; text-align: center; max-width: 320px; margin-bottom: 20px; }
.ss-empty-btn {
  padding: 10px 24px; background: linear-gradient(135deg,#6366f1,#8b5cf6);
  color: #fff; border: none; border-radius: 12px; font-size: 14px; font-weight: 700;
  cursor: pointer; font-family: inherit; transition: all .2s;
  box-shadow: 0 4px 14px rgba(99,102,241,.35);
}
.ss-empty-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(99,102,241,.45); }

@keyframes cardIn {
  from { opacity:0; transform:translateY(14px); }
  to   { opacity:1; transform:translateY(0); }
}

/* ── RESPONSIVE ── */
@media (max-width: 1100px) {
  .ss-recent-grid { grid-template-columns: repeat(2, 1fr); }
  .ss-grid { grid-template-columns: repeat(auto-fill, minmax(185px, 1fr)); }
}
@media (max-width: 768px) {
  .ss-hero { padding: 22px 20px 28px; }
  .ss-hero-inner { flex-direction: column; align-items: flex-start; }
  .ss-search-wrap { max-width: 100%; }
  .ss-body { padding: 20px 16px 32px; }
  .ss-recent-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
  .ss-grid { grid-template-columns: repeat(auto-fill, minmax(155px, 1fr)); gap: 12px; }
  .ss-card { padding: 16px; aspect-ratio: 4/3.8; border-radius: 18px; }
  .ss-card-name { font-size: 15px; }
  .ss-card-emoji { font-size: 32px; }
}
@media (max-width: 480px) {
  .ss-recent-grid { grid-template-columns: 1fr; }
  .ss-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
  .ss-card { aspect-ratio: 3/2.6; padding: 14px; border-radius: 16px; }
  .ss-card-name { font-size: 13.5px; margin-bottom: 7px; }
  .ss-card-emoji { font-size: 28px; }
}
`;

/* ─── Icon helpers ─── */
const Svg = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const PATHS = {
  bot:     "M12 2a2 2 0 012 2v2h3a1 1 0 011 1v5a7 7 0 01-14 0V7a1 1 0 011-1h3V4a2 2 0 012-2zM8 11h.01M16 11h.01",
  search:  "M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z",
  x:       "M18 6L6 18M6 6l12 12",
  clock:   "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2",
  check:   "M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3",
  spark:   "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3M6.343 6.343l-.707-.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
};

/* Gradient map for subject icons */
const ICON_GRAD: Record<string, { bg: string; color: string }> = {
  "bg-gradient-to-r from-blue-500 to-cyan-500":      { bg: "rgba(99,102,241,.12)",   color: "#6366f1" },
  "bg-gradient-to-r from-green-500 to-teal-500":     { bg: "rgba(16,185,129,.12)",   color: "#10b981" },
  "bg-gradient-to-r from-red-500 to-orange-500":     { bg: "rgba(239,68,68,.12)",    color: "#ef4444" },
  "bg-gradient-to-r from-emerald-500 to-green-500":  { bg: "rgba(16,185,129,.12)",   color: "#059669" },
  "bg-gradient-to-r from-indigo-500 to-purple-500":  { bg: "rgba(139,92,246,.12)",   color: "#8b5cf6" },
  "bg-gradient-to-r from-amber-500 to-yellow-500":   { bg: "rgba(245,158,11,.12)",   color: "#f59e0b" },
  "bg-gradient-to-r from-slate-500 to-gray-500":     { bg: "rgba(100,116,139,.12)",  color: "#64748b" },
  "bg-gradient-to-r from-purple-500 to-pink-500":    { bg: "rgba(168,85,247,.12)",   color: "#a855f7" },
};

export const SubjectSelection: React.FC<SubjectSelectionProps> = ({
  subjects: initialSubjects,
  onSelectSubject,
}) => {
  const [searchQuery, setSearchQuery]   = useState("");
  const [recentIds,   setRecentIds]     = useState<number[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("recent_subjects");
      if (saved) setRecentIds(JSON.parse(saved));
    } catch {}
  }, []);

  const handleSelect = (subject: Subject) => {
    const updated = [subject.id, ...recentIds.filter(id => id !== subject.id)].slice(0, 4);
    setRecentIds(updated);
    try { localStorage.setItem("recent_subjects", JSON.stringify(updated)); } catch {}
    onSelectSubject(subject.id);
  };

  const filtered = initialSubjects.filter(s =>
    s.label.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const recents = initialSubjects.filter(s => recentIds.includes(s.id));

  return (
    <>
      <style>{css}</style>
      <div className="ss-root">

        {/* ── HERO ── */}
        <div className="ss-hero">
          <div className="ss-hero-inner">
            <div className="ss-hero-left">
              <div className="ss-hero-icon"><Svg d={PATHS.bot} size={26} /></div>
              <div>
                <div className="ss-hero-title">AI Tutor</div>
                <div className="ss-hero-sub">Select a subject to start your learning session</div>
              </div>
            </div>

            {/* Search */}
            <div className="ss-search-wrap">
              <span className="ss-search-icon"><Svg d={PATHS.search} size={18} /></span>
              <input
                className="ss-search"
                placeholder="Search subjects…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="ss-search-clear" onClick={() => setSearchQuery("")}>
                  <Svg d={PATHS.x} size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="ss-body">

          {/* Recent subjects */}
          {!searchQuery && recents.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <div className="ss-section-label">
                <Svg d={PATHS.clock} size={13} />
                Jump Back In
              </div>
              <div className="ss-recent-grid">
                {recents.map(sub => {
                  const g = ICON_GRAD[sub.color] ?? { bg: "rgba(99,102,241,.1)", color: "#6366f1" };
                  return (
                    <button key={`r-${sub.id}`} className="ss-recent-card" onClick={() => handleSelect(sub)}>
                      <div className="ss-recent-card-left">
                        <div className="ss-recent-icon" style={{ background: g.bg }}>
                          <sub.icon style={{ width: 20, height: 20, color: g.color }} />
                        </div>
                        <div style={{ overflow: "hidden" }}>
                          <div className="ss-recent-name">{sub.label}</div>
                          <div className="ss-recent-progress">
                            <div className="ss-recent-bar-bg">
                              <div className="ss-recent-bar-fill" style={{ width: `${sub.progress ?? 0}%` }} />
                            </div>
                            <span className="ss-recent-pct">{sub.progress ?? 0}%</span>
                          </div>
                        </div>
                      </div>
                      <span className="ss-recent-spark"><Svg d={PATHS.spark} size={15} /></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section header */}
          <div className="ss-section-label" style={{ marginBottom: 16 }}>
            {searchQuery
              ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""} found`
              : "Available Subjects"}
          </div>

          {/* Cards grid */}
          {filtered.length > 0 ? (
            <div className="ss-grid">
              {filtered.map(sub => (
                <button key={sub.id} className={`ss-card ${sub.color}`} onClick={() => handleSelect(sub)}>
                  <div className="ss-card-orb" />

                  <div className="ss-card-top">
                    {/* Use icon component as emoji-style large icon */}
                    <div className="ss-card-emoji">
                      <sub.icon style={{ width: 40, height: 40, color: "rgba(255,255,255,.95)" }} />
                    </div>
                    {(sub.progress ?? 0) >= 100 && (
                      <div className="ss-card-done"><Svg d={PATHS.check} size={15} /></div>
                    )}
                  </div>

                  <div className="ss-card-bottom">
                    <div className="ss-card-name">{sub.label}</div>
                    <div className="ss-card-bar-bg">
                      <div className="ss-card-bar-fill" style={{ width: `${sub.progress ?? 0}%` }} />
                    </div>
                    <div className="ss-card-meta">
                      <span>{sub.progress ?? 0}% Mastery</span>
                      <span>{sub.totalLessons ?? 0} Topics</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="ss-empty">
              <div className="ss-empty-icon">🔍</div>
              <div className="ss-empty-title">No subjects found</div>
              <p className="ss-empty-sub">
                We couldn't find anything for "<strong>{searchQuery}</strong>". Try a different keyword.
              </p>
              <button className="ss-empty-btn" onClick={() => setSearchQuery("")}>Clear Search</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SubjectSelection;
