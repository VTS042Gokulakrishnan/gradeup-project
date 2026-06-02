import React, { useState, useEffect } from "react";
import { useTheme } from "../../hooks/use-theme";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket,
  BrainCircuit,
  Bomb,
  Book,
  Sparkles,
  Trophy,
  ArrowLeft,
  ChevronRight,
  Bookmark,
  Sun,
  Moon,
  Clock,
  Star,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  GraduationCap,
  Zap,
  Target,
  Award,
  ChevronLeft,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { ScrollArea } from "../../components/ui/scroll-area";
import { useAuth } from "../../hooks/use-auth";
import Navigation from "../../components/navigation";
import {
  generateQuiz,
  getCandidateContext,
  getLibrarySubjects,
  submitQuiz,
  type LibrarySubject,
} from "../../lib/gradeupApi";

/* ═══════════════════════════════════════════════════════
   DASHBOARD DESIGN TOKENS — exact match
   Font  : Plus Jakarta Sans 400–800
   Hero  : linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%)
   Card  : #fff · radius 20px · border rgba(0,0,0,.06) · shadow 0 2px 12px rgba(0,0,0,.05)
   Body  : #f8fafc
   Text  : #0f172a  Muted #64748b  Subtle #94a3b8  Border #f1f5f9
   Accent: #6366f1  Purple #8b5cf6  Success #10b981  Amber #f59e0b  Pink #ec4899
═══════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

.qp *, .qp *::before, .qp *::after { box-sizing:border-box; margin:0; padding:0; }
.qp { font-family:'Plus Jakarta Sans',system-ui,sans-serif; background:#f8fafc; min-height:100vh; }
.qp ::-webkit-scrollbar { width:4px; }
.qp ::-webkit-scrollbar-thumb { background:rgba(99,102,241,.2); border-radius:99px; }

/* ── HERO — exact dashboard gradient ── */
.qp-hero {
  background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%);
  border-radius:24px; padding:36px 40px; position:relative; overflow:hidden;
  color:#fff; animation:heroIn .5s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes heroIn { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
.qp-hero::before { content:''; position:absolute; top:-60px; right:-60px; width:260px; height:260px; border-radius:50%; background:rgba(255,255,255,.1); }
.qp-hero::after  { content:''; position:absolute; bottom:-80px; left:30%; width:200px; height:200px; border-radius:50%; background:rgba(255,255,255,.07); }
.qp-hero-inner { position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:20px; }
.qp-hero-title { font-size:clamp(22px,3.5vw,32px); font-weight:800; letter-spacing:-.4px; margin-bottom:6px; }
.qp-hero-sub   { font-size:14px; opacity:.75; max-width:400px; line-height:1.5; }
.qp-hero-stats { display:flex; align-items:center; gap:20px; }
.qp-hero-stat  { text-align:center; }
.qp-hero-sv    { font-size:28px; font-weight:800; line-height:1; }
.qp-hero-sl    { font-size:11px; opacity:.65; margin-top:2px; }
.qp-hero-div   { width:1px; height:44px; background:rgba(255,255,255,.2); }

/* ── CARD — exact dashboard card ── */
.qp-card {
  background:#fff; border-radius:20px;
  border:1px solid rgba(0,0,0,.06); box-shadow:0 2px 12px rgba(0,0,0,.05);
  transition:all .25s cubic-bezier(.4,0,.2,1);
  animation:cardIn .45s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes cardIn { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
.qp-card:hover { transform:translateY(-6px) scale(1.01); box-shadow:0 16px 40px rgba(0,0,0,.1); border-color:#e0e7ff; }

/* ── LANDING ── */
.qp-landing { padding:40px; max-width:1200px; margin:0 auto; display:flex; flex-direction:column; gap:32px; }
.qp-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:#94a3b8; margin-bottom:16px; }

/* Quiz bank cards */
.qp-bank-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:18px; }
.qp-bank-card { padding:24px; cursor:pointer; position:relative; overflow:hidden; }
.qp-bank-card-accent { position:absolute; top:0; left:0; right:0; height:4px; border-radius:20px 20px 0 0; }
.qp-bank-card-icon { width:44px; height:44px; border-radius:13px; display:flex; align-items:center; justify-content:center; margin-bottom:14px; }
.qp-bank-card-title { font-size:15px; font-weight:700; color:#0f172a; margin-bottom:4px; }
.qp-bank-card-sub   { font-size:12px; color:#94a3b8; font-weight:500; margin-bottom:14px; }
.qp-bank-card-footer { display:flex; align-items:center; justify-content:space-between; }
.qp-bank-tag { font-size:10.5px; font-weight:700; padding:3px 9px; border-radius:20px; text-transform:uppercase; letter-spacing:.04em; }
.qp-bank-meta { font-size:11px; color:#94a3b8; font-weight:500; display:flex; align-items:center; gap:4px; }

/* Start quiz CTA */
.qp-cta { padding:32px 40px; text-align:center; }
.qp-cta-title { font-size:clamp(18px,3vw,26px); font-weight:800; color:#0f172a; margin-bottom:8px; }
.qp-cta-sub   { font-size:14px; color:#64748b; margin-bottom:28px; }
.qp-btn-primary {
  display:inline-flex; align-items:center; gap:8px; padding:14px 32px;
  border-radius:16px; border:none; cursor:pointer;
  background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif; font-size:15px; font-weight:700;
  box-shadow:0 6px 20px rgba(99,102,241,.35); transition:all .2s;
}
.qp-btn-primary:hover { transform:translateY(-2px); box-shadow:0 10px 28px rgba(99,102,241,.45); }
.qp-btn-outline {
  display:inline-flex; align-items:center; gap:8px; padding:12px 24px;
  border-radius:14px; border:1.5px solid #e2e8f0; cursor:pointer;
  background:#fff; color:#64748b;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif; font-size:14px; font-weight:600;
  transition:all .2s;
}
.qp-btn-outline:hover { border-color:#6366f1; color:#6366f1; background:rgba(99,102,241,.04); }

/* ── WIZARD ── */
.qp-wizard { position:fixed; inset:0; background:#f8fafc; z-index:50; display:flex; flex-direction:column; overflow:hidden; }
.qp-wizard-nav { background:#fff; border-bottom:1px solid #f1f5f9; flex-shrink:0; }
.qp-wizard-body { flex:1; overflow-y:auto; padding:16px 24px; }
.qp-wizard-inner { max-width:900px; margin:0 auto; }
.qp-wizard-footer { background:#fff; border-top:1px solid #f1f5f9; padding:12px 24px; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; }

.qp-step-header { text-align:center; margin-bottom:16px; }
.qp-step-num { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:#6366f1; margin-bottom:6px; }
.qp-step-title { font-size:clamp(18px,3vw,24px); font-weight:800; color:#0f172a; margin-bottom:4px; }
.qp-step-sub   { font-size:12px; color:#64748b; }

/* Steps dots */
.qp-stepper { display:flex; align-items:center; justify-content:center; gap:6px; margin-bottom:16px; }
.qp-step-dot { width:8px; height:8px; border-radius:50%; background:#e2e8f0; transition:all .3s; }
.qp-step-dot.done { background:#6366f1; }
.qp-step-dot.active { background:linear-gradient(135deg,#6366f1,#8b5cf6); transform:scale(1.3); box-shadow:0 0 8px rgba(99,102,241,.5); }

/* Unit picker grid */
.qp-unit-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:14px; }
.qp-unit-card {
  padding:16px 12px; border-radius:16px; border:2px solid #f1f5f9; background:#fff;
  cursor:pointer; text-align:center; transition:all .2s;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif;
}
.qp-unit-card:hover { border-color:#c7d2fe; transform:translateY(-3px); box-shadow:0 8px 24px rgba(99,102,241,.1); }
.qp-unit-card.sel  { border-color:#6366f1; background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.06)); box-shadow:0 0 0 3px rgba(99,102,241,.15); }
.qp-unit-name { font-size:13px; font-weight:700; color:#0f172a; margin-bottom:4px; }
.qp-unit-sub  { font-size:11px; color:#94a3b8; font-weight:500; }
.qp-unit-card.sel .qp-unit-name { color:#4f46e5; }

/* Difficulty cards */
.qp-diff-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.qp-diff-card {
  padding:24px 16px; border-radius:18px; border:2px solid #f1f5f9; background:#fff;
  cursor:pointer; text-align:center; transition:all .22s;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif;
}
.qp-diff-card:hover { transform:translateY(-4px); box-shadow:0 12px 30px rgba(0,0,0,.1); }
.qp-diff-card.sel-easy   { border-color:#10b981; background:rgba(16,185,129,.06); box-shadow:0 0 0 3px rgba(16,185,129,.15); }
.qp-diff-card.sel-medium { border-color:#f59e0b; background:rgba(245,158,11,.06); box-shadow:0 0 0 3px rgba(245,158,11,.15); }
.qp-diff-card.sel-hard   { border-color:#ef4444; background:rgba(239,68,68,.06);  box-shadow:0 0 0 3px rgba(239,68,68,.15); }
.qp-diff-icon { width:48px; height:48px; border-radius:16px; margin:0 auto 12px; display:flex; align-items:center; justify-content:center; }
.qp-diff-name { font-size:15px; font-weight:800; color:#0f172a; margin-bottom:4px; }
.qp-diff-desc { font-size:11.5px; color:#64748b; }

/* Count/time picker */
.qp-picker-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
.qp-pick-btn {
  padding:8px 6px; border-radius:12px; border:2px solid #f1f5f9; background:#fff;
  cursor:pointer; text-align:center; font-family:'Plus Jakarta Sans',system-ui,sans-serif;
  font-size:15px; font-weight:800; color:#0f172a; transition:all .18s;
}
.qp-pick-btn:hover { border-color:#c7d2fe; transform:scale(1.04); }
.qp-pick-btn.sel  { border-color:#6366f1; background:linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.06)); color:#4f46e5; box-shadow:0 0 0 3px rgba(99,102,241,.15); }

/* ── QUIZ ACTIVE ── */
.qp-active { padding:0; max-width:1440px; margin:0 auto; display:flex; flex-direction:column; height:calc(100vh - 64px); overflow:hidden; }

/* Quiz header strip */
.qp-quiz-head {
  background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 55%,#ec4899 100%);
  padding:14px 28px; display:flex; align-items:center; justify-content:space-between;
  flex-shrink:0; position:relative; overflow:hidden;
}
.qp-quiz-head::before { content:''; position:absolute; top:-40px; right:-40px; width:140px; height:140px; border-radius:50%; background:rgba(255,255,255,.08); }
.qp-quiz-head-left  { display:flex; align-items:center; gap:14px; position:relative; z-index:1; }
.qp-quiz-head-title { font-size:15px; font-weight:800; color:#fff; }
.qp-quiz-head-sub   { font-size:11px; color:rgba(255,255,255,.7); margin-top:1px; }
.qp-quiz-head-right { display:flex; align-items:center; gap:12px; position:relative; z-index:1; }

.qp-timer {
  display:flex; align-items:center; gap:7px; padding:8px 18px;
  border-radius:14px; background:rgba(255,255,255,.18); border:1.5px solid rgba(255,255,255,.25);
}
.qp-timer.warn { background:rgba(239,68,68,.25); border-color:rgba(239,68,68,.4); animation:tpulse 1s ease-in-out infinite; }
@keyframes tpulse { 0%,100%{opacity:1} 50%{opacity:.65} }
.qp-timer-val { font-size:20px; font-weight:800; color:#fff; letter-spacing:-1px; }
.qp-timer.warn .qp-timer-val { color:#fca5a5; }

.qp-icon-btn {
  width:36px; height:36px; border-radius:11px;
  background:rgba(255,255,255,.18); border:1.5px solid rgba(255,255,255,.22);
  display:flex; align-items:center; justify-content:center; cursor:pointer; color:#fff; transition:all .2s;
}
.qp-icon-btn:hover { background:rgba(255,255,255,.28); }

.qp-submit-btn-head {
  padding:9px 20px; border-radius:12px; border:none; cursor:pointer;
  background:rgba(239,68,68,.2); border:1.5px solid rgba(239,68,68,.4);
  color:#fff; font-family:'Plus Jakarta Sans',system-ui,sans-serif;
  font-size:13px; font-weight:700; transition:all .2s; display:flex; align-items:center; gap:6px;
}
.qp-submit-btn-head:hover { background:rgba(239,68,68,.35); }

/* Quiz body */
.qp-quiz-body { flex:1; display:grid; grid-template-columns:1fr 300px; gap:16px; padding:16px 24px; min-height:0; overflow:hidden; }

/* Question card */
.qp-q-card { display:flex; flex-direction:column; background:#fff; border-radius:20px; border:1px solid rgba(0,0,0,.06); box-shadow:0 2px 12px rgba(0,0,0,.05); overflow:hidden; min-height:0; }
.qp-q-head { flex-shrink:0; padding:14px 20px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:8px; }
.qp-q-badge-num  { font-size:10.5px; font-weight:700; padding:3px 10px; border-radius:20px; background:rgba(99,102,241,.1); color:#6366f1; text-transform:uppercase; letter-spacing:.06em; }
.qp-q-badge-type { font-size:10.5px; font-weight:700; padding:3px 10px; border-radius:20px; text-transform:uppercase; letter-spacing:.06em; }
.qp-q-marks { font-size:11px; font-weight:600; color:#94a3b8; margin-left:auto; }
.qp-q-body { flex:1; overflow-y:auto; padding:24px 20px; }
.qp-q-text { font-size:clamp(15px,2vw,18px); font-weight:700; color:#0f172a; line-height:1.55; margin-bottom:24px; }

/* Options — dashboard card style */
.qp-opt {
  display:flex; align-items:center; gap:12px; padding:14px 16px;
  border-radius:14px; border:2px solid #f1f5f9; background:#fafafa;
  cursor:pointer; margin-bottom:10px; transition:all .18s cubic-bezier(.4,0,.2,1);
  font-family:'Plus Jakarta Sans',system-ui,sans-serif;
}
.qp-opt:hover { border-color:#c7d2fe; background:#f5f3ff; }
.qp-opt.sel   { border-color:#6366f1; background:rgba(99,102,241,.06); box-shadow:0 0 0 3px rgba(99,102,241,.1); }
.qp-opt.correct { border-color:#10b981; background:rgba(16,185,129,.06); box-shadow:0 0 0 3px rgba(16,185,129,.1); }
.qp-opt.wrong   { border-color:#ef4444; background:rgba(239,68,68,.06); box-shadow:0 0 0 3px rgba(239,68,68,.1); }
.qp-opt-letter {
  width:30px; height:30px; border-radius:9px; flex-shrink:0;
  display:flex; align-items:center; justify-content:center;
  font-size:12px; font-weight:800; background:#f1f5f9; color:#64748b; transition:all .18s;
}
.qp-opt.sel .qp-opt-letter     { background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; }
.qp-opt.correct .qp-opt-letter { background:linear-gradient(135deg,#10b981,#059669); color:#fff; }
.qp-opt.wrong .qp-opt-letter   { background:linear-gradient(135deg,#ef4444,#dc2626); color:#fff; }
.qp-opt-text { font-size:13.5px; font-weight:500; color:#374151; flex:1; line-height:1.4; }
.qp-opt.sel .qp-opt-text     { color:#4338ca; font-weight:600; }
.qp-opt.correct .qp-opt-text { color:#065f46; font-weight:600; }
.qp-opt.wrong .qp-opt-text   { color:#991b1b; font-weight:600; }

.qp-q-foot { flex-shrink:0; padding:12px 20px; border-top:1px solid #f1f5f9; display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; }
.qp-nav-btn {
  display:flex; align-items:center; gap:5px; padding:9px 16px; border-radius:12px;
  border:1.5px solid #e2e8f0; background:#fff; cursor:pointer;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif; font-size:12.5px; font-weight:600; color:#64748b; transition:all .18s;
}
.qp-nav-btn:hover:not(:disabled) { border-color:#6366f1; color:#6366f1; }
.qp-nav-btn:disabled { opacity:.35; cursor:not-allowed; }
.qp-mark-btn {
  display:flex; align-items:center; gap:5px; padding:9px 14px; border-radius:12px;
  border:1.5px solid #f59e0b; background:rgba(245,158,11,.06); cursor:pointer;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif; font-size:12px; font-weight:600; color:#d97706; transition:all .18s;
}
.qp-mark-btn:hover { background:rgba(245,158,11,.12); }
.qp-next-btn {
  display:flex; align-items:center; gap:5px; padding:9px 18px; border-radius:12px;
  border:none; background:linear-gradient(135deg,#6366f1,#8b5cf6);
  font-family:'Plus Jakarta Sans',system-ui,sans-serif; font-size:12.5px; font-weight:700; color:#fff; cursor:pointer;
  box-shadow:0 3px 10px rgba(99,102,241,.28); transition:all .18s;
}
.qp-next-btn:hover { transform:translateY(-1px); box-shadow:0 5px 14px rgba(99,102,241,.38); }

/* Right panel */
.qp-right { display:flex; flex-direction:column; gap:12px; min-height:0; overflow:hidden; }

/* Palette card */
.qp-pal-card { flex:1; display:flex; flex-direction:column; background:#fff; border-radius:18px; border:1px solid rgba(0,0,0,.06); box-shadow:0 2px 10px rgba(0,0,0,.05); overflow:hidden; min-height:0; }
.qp-pal-head { flex-shrink:0; padding:12px 16px; border-bottom:1px solid #f1f5f9; font-size:12.5px; font-weight:700; color:#0f172a; }
.qp-pal-prog { flex-shrink:0; padding:8px 16px; }
.qp-pal-pr   { display:flex; justify-content:space-between; font-size:10.5px; color:#64748b; font-weight:500; margin-bottom:4px; }
.qp-pal-pb   { height:5px; background:#f1f5f9; border-radius:5px; overflow:hidden; }
.qp-pal-pf   { height:100%; border-radius:5px; background:linear-gradient(90deg,#6366f1,#8b5cf6); transition:width .5s; }
.qp-pal-grid-wrap { flex:1; overflow-y:auto; padding:8px 16px; }
.qp-pal-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; }
.qp-pb { width:100%; aspect-ratio:1; border-radius:8px; border:none; font-family:'Plus Jakarta Sans',system-ui,sans-serif; font-size:11px; font-weight:700; cursor:pointer; transition:all .15s; }
.qp-pb-un  { background:#f1f5f9; color:#64748b; }
.qp-pb-un:hover { background:#e2e8f0; }
.qp-pb-ans { background:linear-gradient(135deg,#10b981,#059669); color:#fff; box-shadow:0 2px 6px rgba(16,185,129,.28); }
.qp-pb-mk  { background:linear-gradient(135deg,#f59e0b,#d97706); color:#fff; box-shadow:0 2px 6px rgba(245,158,11,.28); }
.qp-pb-cur { background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; box-shadow:0 2px 8px rgba(99,102,241,.34); transform:scale(1.08); }
.qp-pal-leg { flex-shrink:0; padding:6px 16px 10px; display:flex; flex-wrap:wrap; gap:6px; border-top:1px solid #f1f5f9; }
.qp-leg     { display:flex; align-items:center; gap:4px; font-size:9.5px; color:#64748b; font-weight:500; }
.qp-legdot  { width:9px; height:9px; border-radius:3px; flex-shrink:0; }

/* Stats + mark card */
.qp-stats-card { flex-shrink:0; background:#fff; border-radius:18px; border:1px solid rgba(0,0,0,.06); box-shadow:0 2px 10px rgba(0,0,0,.05); padding:14px 16px; }
.qp-stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:12px; }
.qp-stat { padding:8px; border-radius:11px; background:#f8fafc; border:1px solid #f1f5f9; text-align:center; }
.qp-statv { font-size:18px; font-weight:800; color:#0f172a; line-height:1; }
.qp-statl { font-size:9.5px; color:#94a3b8; margin-top:2px; font-weight:500; }
.qp-stat.g .qp-statv { color:#059669; }
.qp-stat.a .qp-statv { color:#d97706; }
.qp-stat.i .qp-statv { color:#6366f1; }
.qp-mark-full-btn {
  width:100%; padding:10px; border-radius:12px; border:1.5px solid #f59e0b;
  background:rgba(245,158,11,.06); color:#d97706; cursor:pointer;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif; font-size:12.5px; font-weight:700;
  display:flex; align-items:center; justify-content:center; gap:6px; transition:all .18s;
}
.qp-mark-full-btn:hover { background:rgba(245,158,11,.12); }

/* ── RESULT ── */
.qp-result { padding:40px; max-width:600px; margin:0 auto; display:flex; flex-direction:column; gap:24px; }
.qp-result-hero { border-radius:24px; padding:40px; text-align:center; position:relative; overflow:hidden; }
.qp-result-score { font-size:72px; font-weight:800; color:#fff; line-height:1; margin-bottom:8px; }
.qp-result-label { font-size:16px; color:rgba(255,255,255,.8); font-weight:500; }
.qp-result-breakdown { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.qp-result-item { background:#fff; border-radius:16px; padding:16px; text-align:center; border:1px solid rgba(0,0,0,.06); box-shadow:0 2px 10px rgba(0,0,0,.05); }
.qp-result-iv { font-size:26px; font-weight:800; color:#0f172a; line-height:1; }
.qp-result-il { font-size:11px; color:#94a3b8; margin-top:4px; font-weight:500; }
.qp-result-actions { display:flex; gap:12px; flex-wrap:wrap; }
.qp-result-actions button { flex:1; }

/* ── LOADER ── */
.qp-loader { position:fixed; inset:0; background:#fff; z-index:999; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; font-family:'Plus Jakarta Sans',system-ui,sans-serif; }
.qp-loader-ring { width:64px; height:64px; border-radius:20px; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg,#6366f1,#8b5cf6); box-shadow:0 12px 32px rgba(99,102,241,.35); }
.qp-loader-msg   { font-size:15px; font-weight:600; color:#64748b; text-align:center; max-width:280px; }
.qp-loader-dots  { display:flex; gap:6px; }
.qp-loader-dot   { width:7px; height:7px; border-radius:50%; background:#818cf8; }

/* Responsive */
@media (max-width:1024px) { .qp-quiz-body { grid-template-columns:1fr; } .qp-right { display:none; } }
@media (max-width:768px) {
  .qp-landing { padding:20px 16px; }
  .qp-hero { padding:24px 20px; }
  .qp-hero-stats { display:none; }
  .qp-diff-grid { grid-template-columns:1fr; gap:12px; }
  .qp-picker-grid { grid-template-columns:repeat(4,1fr); gap:8px; }
  .qp-quiz-body { padding:10px 12px; }
  .qp-q-body { padding:16px 14px; }
  .qp-q-text { font-size:15px; }
  .qp-quiz-head { padding:12px 16px; }
  .qp-result { padding:20px 16px; }
  .qp-result-score { font-size:56px; }
}
@media (max-width:480px) {
  .qp-unit-grid { grid-template-columns:1fr 1fr; }
  .qp-picker-grid { grid-template-columns:repeat(2,1fr); }
  .qp-q-foot { flex-wrap:wrap; }
}
`;

// ── Types ──────────────────────────────────────────────────────────────
type QuestionStatus = "unanswered" | "answered" | "marked";
interface QuizConfig {
  difficulty: string;
  subjectId: string;
  unitId: string;
  numQuestions: string;
  timeLimit: string;
}
interface EnrichedUnit {
  id: string;
  name: string;
  subjectName: string;
  subjectId: string;
  subjectGroupKey: string;
  unitNumber?: number | null;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface QuizBankCard {
  id: string;
  title: string;
  subject: string;
  questions: number;
  difficulty: string;
  color: string;
  accentBg: string;
  time: number;
}

// ── Mock Data ──────────────────────────────────────────────────────────
const BANK_PALETTE = [
  { color: "#10b981", accentBg: "rgba(16,185,129,.1)" },
  { color: "#6366f1", accentBg: "rgba(99,102,241,.1)" },
  { color: "#f59e0b", accentBg: "rgba(245,158,11,.1)" },
  { color: "#8b5cf6", accentBg: "rgba(139,92,246,.1)" },
  { color: "#ef4444", accentBg: "rgba(239,68,68,.1)" },
];
const DIFFICULTIES = [
  {
    name: "Easy",
    icon: <Rocket size={28} />,
    desc: "A gentle start",
    cls: "easy",
    color: "#10b981",
    iconBg: "rgba(16,185,129,.12)",
  },
  {
    name: "Medium",
    icon: <BrainCircuit size={28} />,
    desc: "A balanced challenge",
    cls: "medium",
    color: "#f59e0b",
    iconBg: "rgba(245,158,11,.12)",
  },
  {
    name: "Hard",
    icon: <Bomb size={28} />,
    desc: "A true test of knowledge",
    cls: "hard",
    color: "#ef4444",
    iconBg: "rgba(239,68,68,.12)",
  },
];
const COUNTS = ["5", "10", "15", "20"];
const TIMES = ["5", "10", "15", "30"];

function mapLibraryUnits(subjects: LibrarySubject[]): EnrichedUnit[] {
  return subjects.flatMap((subjectGroup) =>
    (subjectGroup.units || []).map((unit) => ({
      id: unit.id,
      name: unit.unitTitle || unit.unitLabel || `Unit ${unit.unitNumber || ""}`.trim(),
      subjectName: subjectGroup.title || subjectGroup.subject,
      subjectId: subjectGroup.subjectGroupKey,
      subjectGroupKey: subjectGroup.subjectGroupKey,
      unitNumber: unit.unitNumber,
    })),
  );
}

function mapQuizBanks(subjects: LibrarySubject[]): QuizBankCard[] {
  return subjects
    .filter((subjectGroup) => (subjectGroup.units || []).length > 0)
    .map((subjectGroup, index) => {
      const palette = BANK_PALETTE[index % BANK_PALETTE.length];
      return {
        id: subjectGroup.subjectGroupKey,
        title: subjectGroup.title || subjectGroup.subject,
        subject: `${subjectGroup.board || "Uploaded"} · ${subjectGroup.standard || "Library"}`,
        questions: Math.max(5, (subjectGroup.unitCount || subjectGroup.units?.length || 1) * 5),
        difficulty: "AI",
        color: palette.color,
        accentBg: palette.accentBg,
        time: 10,
      };
    });
}

function toOptionList(question: any): string[] {
  const source =
    question?.options ||
    question?.choices ||
    question?.answers ||
    question?.possible_answers ||
    [];
  if (Array.isArray(source)) {
    return source.map((item) => String(item?.text || item?.label || item || "").trim()).filter(Boolean);
  }
  if (source && typeof source === "object") {
    return Object.values(source).map((item) => String(item || "").trim()).filter(Boolean);
  }
  return [];
}

function normalizeCorrectAnswer(question: any, options: string[]): number {
  const raw =
    question?.correctAnswer ??
    question?.correct_answer ??
    question?.correctOption ??
    question?.correct_option ??
    question?.correctIndex ??
    question?.correct_index ??
    question?.answer ??
    question?.correct ??
    question?.solution;
  if (typeof raw === "number") {
    const normalized = raw === 0 ? 0 : raw - 1;
    return Math.max(0, Math.min(options.length - 1, normalized));
  }
  const text = String(raw || "").trim();
  const letterIndex = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(text.toUpperCase());
  if (letterIndex >= 0 && letterIndex < options.length) return letterIndex;
  const exactIndex = options.findIndex((option) => option.toLowerCase() === text.toLowerCase());
  return exactIndex >= 0 ? exactIndex : 0;
}

function normalizeQuizQuestions(payload: any): QuizQuestion[] {
  const rawQuestions =
    payload?.questions ||
    payload?.quiz?.questions ||
    payload?.data?.questions ||
    payload?.items ||
    [];
  if (!Array.isArray(rawQuestions)) return [];
  return rawQuestions
    .map((question, index) => {
      const options = toOptionList(question);
      if (options.length < 2) return null;
      const prompt = String(
        question?.question ||
          question?.prompt ||
          question?.text ||
          question?.title ||
          "",
      ).trim();
      if (!prompt) return null;
      return {
        id: String(question?.id || question?.question_id || index + 1),
        question: prompt,
        options,
        correctAnswer: normalizeCorrectAnswer(question, options),
        explanation: question?.explanation || question?.reason || question?.solution || "",
      };
    })
    .filter(Boolean) as QuizQuestion[];
}

// ── Loader ─────────────────────────────────────────────────────────────
const LOADER_MSGS = [
  "Summoning the Quiz Master…",
  "Dusting off ancient scrolls…",
  "Waking up the trivia hamsters…",
  "Assembling questions from space…",
  "Not rocket science… unless it is!",
];
const Loader = ({ mini = false }: { mini?: boolean }) => {
  const [msg, setMsg] = useState(LOADER_MSGS[0]);
  useEffect(() => {
    const t = setInterval(
      () => setMsg(LOADER_MSGS[Math.floor(Math.random() * LOADER_MSGS.length)]),
      2000,
    );
    return () => clearInterval(t);
  }, []);
  return (
    <div className="qp-loader">
      <style>{CSS}</style>
      <motion.div
        className="qp-loader-ring"
        animate={{ rotate: [0, 180, 360], borderRadius: ["20%", "50%", "20%"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <GraduationCap
          size={28}
          color="#fff"
          style={{ position: "relative", zIndex: 1 }}
        />
      </motion.div>
      <p className="qp-loader-msg">{msg}</p>
      <div className="qp-loader-dots">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="qp-loader-dot"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
};

// ── Setup Wizard ────────────────────────────────────────────────────────
const Wizard = ({
  onStart,
  units,
  onClose,
}: {
  onStart: (c: QuizConfig) => Promise<void>;
  units: EnrichedUnit[];
  onClose: () => void;
}) => {
  const [step, setStep] = useState(0);
  const [loading, setLoad] = useState(false);
  const [error, setError] = useState("");
  const { userHeader } = useAuth();
  const [cfg, setCfg] = useState<QuizConfig>({
    difficulty: "Medium",
    subjectId: "",
    unitId: "",
    numQuestions: "10",
    timeLimit: "10",
  });

  const handleStart = async () => {
    if (!cfg.unitId) {
      setError("Please select a unit before launching the quiz.");
      setStep(0);
      return;
    }
    setLoad(true);
    setError("");
    try {
      await onStart(cfg);
    } catch (error: any) {
      setError(error?.message || "Unable to generate quiz right now.");
    } finally {
      setLoad(false);
    }
  };

  if (loading) return <Loader />;

  const diffSel = DIFFICULTIES.find((d) => d.name === cfg.difficulty);

  return (
    <div className="qp-wizard">
      <style>{CSS}</style>
      <div className="qp-wizard-nav">
        <Navigation
          currentRole={userHeader?.role || "student"}
          onRoleChange={() => {}}
        />
      </div>
      <div className="qp-wizard-body">
        <div className="qp-wizard-inner">
          {/* Stepper */}
          <div className="qp-stepper">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`qp-step-dot${i < step ? " done" : i === step ? " active" : ""}`}
              />
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{
                duration: 0.35,
                type: "spring",
                stiffness: 280,
                damping: 28,
              }}
            >
              {/* Step 0 — Unit */}
              {step === 0 && (
                <>
                  <div className="qp-step-header">
                    <div className="qp-step-num">Step 1 of 3</div>
                    <h2 className="qp-step-title">
                      What do you want to practise?
                    </h2>
                    <p className="qp-step-sub">
                      Choose a specific unit to focus your quiz on.
                    </p>
                  </div>
                  <ScrollArea style={{ height: 320 }}>
                    <div className="qp-unit-grid" style={{ padding: 4 }}>
                      {units.map((u) => (
                        <motion.div
                          key={u.id}
                          whileHover={{ y: -3 }}
                          onClick={() => {
                            setCfg({
                              ...cfg,
                              unitId: u.id,
                              subjectId: u.subjectId,
                            });
                            setStep(1);
                          }}
                        >
                          <div
                            className={`qp-unit-card${cfg.unitId === u.id ? " sel" : ""}`}
                          >
                            <div className="qp-unit-name">{u.name}</div>
                            <div className="qp-unit-sub">{u.subjectName}</div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </>
              )}
              {/* Step 1 — Difficulty */}
              {step === 1 && (
                <>
                  <div className="qp-step-header">
                    <div className="qp-step-num">Step 2 of 3</div>
                    <h2 className="qp-step-title">Choose Your Challenge</h2>
                    <p className="qp-step-sub">
                      How brave are you feeling today?
                    </p>
                  </div>
                  <div className="qp-diff-grid">
                    {DIFFICULTIES.map((d) => (
                      <motion.div
                        key={d.name}
                        whileHover={{ y: -6 }}
                        onClick={() => {
                          setCfg({ ...cfg, difficulty: d.name });
                          setStep(2);
                        }}
                      >
                        <div
                          className={`qp-diff-card${cfg.difficulty === d.name ? ` sel-${d.cls}` : ""}`}
                        >
                          <div
                            className="qp-diff-icon"
                            style={{ background: d.iconBg, color: d.color }}
                          >
                            {d.icon}
                          </div>
                          <div
                            className="qp-diff-name"
                            style={
                              cfg.difficulty === d.name
                                ? { color: d.color }
                                : {}
                            }
                          >
                            {d.name}
                          </div>
                          <div className="qp-diff-desc">{d.desc}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
              {/* Step 2 — Config */}
              {step === 2 && (
                <>
                  <div className="qp-step-header">
                    <div className="qp-step-num">Step 3 of 3</div>
                    <h2 className="qp-step-title">Final Touches</h2>
                    <p className="qp-step-sub">
                      Set the number of questions and your time limit.
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div
                        className="qp-section-title"
                        style={{ textAlign: "center", marginBottom: 4 }}
                      >
                        Number of Questions
                      </div>
                      <div className="qp-picker-grid">
                        {COUNTS.map((c) => (
                          <button
                            key={c}
                            className={`qp-pick-btn${cfg.numQuestions === c ? " sel" : ""}`}
                            onClick={() => setCfg({ ...cfg, numQuestions: c })}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div
                        className="qp-section-title"
                        style={{ textAlign: "center", marginBottom: 4 }}
                      >
                        Time Limit (minutes)
                      </div>
                      <div className="qp-picker-grid">
                        {TIMES.map((t) => (
                          <button
                            key={t}
                            className={`qp-pick-btn${cfg.timeLimit === t ? " sel" : ""}`}
                            onClick={() => setCfg({ ...cfg, timeLimit: t })}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Summary card */}
                  <div
                    className="qp-card"
                    style={{
                      padding: "8px 12px",
                      marginTop: 10,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {[
                      {
                        label: "Subject",
                        val:
                          units.find((u) => u.id === cfg.unitId)?.subjectName ||
                          "Any",
                      },
                      {
                        label: "Unit",
                        val:
                          units.find((u) => u.id === cfg.unitId)?.name || "Any",
                      },
                      { label: "Difficulty", val: cfg.difficulty },
                      { label: "Questions", val: cfg.numQuestions },
                      { label: "Time", val: `${cfg.timeLimit} min` },
                    ].map((s) => (
                      <div
                        key={s.label}
                        style={{ flex: 1, minWidth: 50, textAlign: "center" }}
                      >
                        <div
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: ".05em",
                            color: "#94a3b8",
                            marginBottom: 1,
                          }}
                        >
                          {s.label}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: "#0f172a",
                          }}
                        >
                          {s.val}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: "center", marginTop: 10 }}>
                    {error && (
                      <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                        {error}
                      </div>
                    )}
                    <motion.button
                      className="qp-btn-primary"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleStart}
                    >
                      <Trophy size={18} /> Launch Quiz!
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="qp-wizard-footer">
        <button
          className="qp-btn-outline"
          onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
        >
          <ArrowLeft size={15} />
          {step > 0 ? "Back" : "Cancel"}
        </button>
        <button className="qp-btn-outline" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
};

// ── Main QuizPage ──────────────────────────────────────────────────────
const QuizPage = ({ params }: { params?: { id?: string } }) => {
  const { theme, setTheme } = useTheme();
  const [, setLocation] = useLocation();
  const { userHeader } = useAuth();
  const candidateContext = getCandidateContext(userHeader);

  const [isLoading, setIsLoading] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [quizConfig, setQuizConfig] = useState<QuizConfig | null>(null);
  const [librarySubjects, setLibrarySubjects] = useState<LibrarySubject[]>([]);
  const [quizBanks, setQuizBanks] = useState<QuizBankCard[]>([]);
  const [unitsForWizard, setUnitsForWizard] = useState<EnrichedUnit[]>([]);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [statuses, setStatuses] = useState<QuestionStatus[]>([]);
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  useEffect(() => {
    let ignore = false;

    async function loadQuizLibrary() {
      setIsLoading(true);
      setPageError("");
      try {
        const subjects = await getLibrarySubjects();
        if (ignore) return;

        const allLibraryUnits = mapLibraryUnits(subjects);
        const p = new URLSearchParams(window.location.search);
        const subjectParam = p.get("subjectGroupKey") || p.get("subject") || "";
        const unitIdParam = p.get("unitId") || "";
        const unitParam = p.get("unit") || "";
        let scopedUnits = allLibraryUnits;

        if (subjectParam && subjectParam !== "all") {
          scopedUnits = scopedUnits.filter(
            (unit) =>
              unit.subjectGroupKey === subjectParam ||
              unit.subjectId === subjectParam ||
              unit.subjectName.toLowerCase().replace(/\s/g, "_") === subjectParam,
          );
        }
        if (unitIdParam) {
          scopedUnits = scopedUnits.filter((unit) => String(unit.id) === String(unitIdParam));
        } else if (unitParam) {
          scopedUnits = scopedUnits.filter((unit) => unit.name === unitParam);
        }

        setLibrarySubjects(subjects);
        setQuizBanks(mapQuizBanks(subjects));
        setUnitsForWizard(scopedUnits.length ? scopedUnits : allLibraryUnits);
        if (subjectParam || unitIdParam || unitParam) {
          setSetupOpen(true);
        }
      } catch (error: any) {
        if (!ignore) {
          setLibrarySubjects([]);
          setQuizBanks([]);
          setUnitsForWizard([]);
          setPageError(error?.message || "Unable to load uploaded subjects.");
        }
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    loadQuizLibrary();

    return () => {
      ignore = true;
    };
  }, []);

  const handleStart = async (cfg: QuizConfig) => {
    const selectedUnit = unitsForWizard.find((unit) => unit.id === cfg.unitId);
    if (!selectedUnit) {
      throw new Error("Please select an uploaded unit before launching the quiz.");
    }
    const generated = await generateQuiz({
      unitId: selectedUnit.id,
      candidateId: candidateContext.candidateId,
      candidateName: candidateContext.candidateName,
      difficulty: cfg.difficulty.toLowerCase(),
      numQuestions: Number(cfg.numQuestions || 10),
    });
    const generatedQuestions = normalizeQuizQuestions(generated);
    if (!generatedQuestions.length) {
      throw new Error("The quiz API did not return usable questions for this unit.");
    }
    setQuizConfig(cfg);
    setQuizId(String(generated?.quiz_id || generated?.quizId || generated?.id || ""));
    const requested = Number(cfg.numQuestions || generatedQuestions.length || 10);
    const qs = generatedQuestions.slice(0, requested);
    setQuestions(qs);
    setTimeLeft(parseInt(cfg.timeLimit || "15", 10) * 60);
    setAnswers(Array(qs.length).fill(null));
    setStatuses(Array(qs.length).fill("unanswered"));
    setQIdx(0);
    setQuizStarted(true);
    setShowResult(false);
    setSetupOpen(false);
  };

  const handleAnswer = (i: number) => {
    const a = [...answers];
    a[qIdx] = i;
    setAnswers(a);
    const s = [...statuses];
    s[qIdx] = "answered";
    setStatuses(s);
  };

  const markForLater = () => {
    const s = [...statuses];
    if (statuses[qIdx] !== "answered") s[qIdx] = "marked";
    setStatuses(s);
  };

  const handleSubmit = async () => {
    setShowResult(true);
    // Guard: only count indices where both question and answer exist
    const score = answers.reduce((acc, a, i) => {
      const q = questions[i];
      return q && a !== null && a === q.correctAnswer ? acc + 1 : acc;
    }, 0);
    if (quizId) {
      submitQuiz({
        quizId,
        candidateId: candidateContext.candidateId,
        answers: answers.map((answer, index) => ({
          question_id: questions[index]?.id || String(index + 1),
          answer:
            answer === null
              ? ""
              : questions[index]?.options?.[answer] || String(answer),
        })),
      }).catch(() => null);
    }
    try {
      const rec = JSON.parse(localStorage.getItem("recentExams") || "[]");
      rec.unshift({
        subject: quizConfig?.subjectId || "",
        score,
        percentage: questions.length > 0 ? (score / questions.length) * 100 : 0,
        date: new Date().toISOString(),
        questionCount: questions.length,
      });
      localStorage.setItem("recentExams", JSON.stringify(rec.slice(0, 5)));
    } catch {}
  };

  useEffect(() => {
    if (!quizStarted || showResult || timeLeft <= 0) {
      if (quizStarted && timeLeft === 0) handleSubmit();
      return;
    }
    const t = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(t);
  }, [quizStarted, showResult, timeLeft]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const answered = statuses.filter((s) => s === "answered").length;
  const marked = statuses.filter((s) => s === "marked").length;
  const timeWarn = timeLeft < 120;

  if (isLoading) return <Loader />;

  // ── Result screen ──
  if (showResult) {
    const score = answers.reduce((acc, a, i) => {
      const q = questions[i];
      return q && a !== null && a === q.correctAnswer ? acc + 1 : acc;
    }, 0);
    const pct = (score / questions.length) * 100;
    const grade =
      pct >= 80
        ? "Excellent!"
        : pct >= 60
          ? "Good job!"
          : pct >= 40
            ? "Keep practising!"
            : "Don't give up!";
    const gradeBg =
      pct >= 80
        ? "linear-gradient(135deg,#10b981,#059669)"
        : pct >= 60
          ? "linear-gradient(135deg,#6366f1,#8b5cf6)"
          : pct >= 40
            ? "linear-gradient(135deg,#f59e0b,#d97706)"
            : "linear-gradient(135deg,#ef4444,#dc2626)";
    return (
      <div className="qp">
        <style>{CSS}</style>
        <div className="qp-result">
          <motion.div
            className="qp-result-hero"
            style={{ background: gradeBg }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, type: "spring" }}
          >
            <div className="qp-result-score">{pct.toFixed(0)}%</div>
            <div className="qp-result-label">
              {grade} You scored {score} out of {questions.length}
            </div>
            {/* floating orbs */}
            <div
              style={{
                position: "absolute",
                top: -40,
                right: -40,
                width: 160,
                height: 160,
                borderRadius: "50%",
                background: "rgba(255,255,255,.1)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -60,
                left: "20%",
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: "rgba(255,255,255,.07)",
              }}
            />
          </motion.div>
          <div className="qp-result-breakdown">
            {[
              { v: score, l: "Correct", cls: "g" },
              { v: questions.length - score, l: "Wrong", cls: "" },
              { v: marked, l: "Reviewed", cls: "a" },
            ].map((s) => (
              <div key={s.l} className={`qp-result-item`}>
                <div
                  className={`qp-result-iv`}
                  style={{
                    color:
                      s.cls === "g"
                        ? "#059669"
                        : s.cls === "a"
                          ? "#d97706"
                          : "#ef4444",
                  }}
                >
                  {s.v}
                </div>
                <div className="qp-result-il">{s.l}</div>
              </div>
            ))}
          </div>
          {/* Review answers */}
          <div className="qp-card" style={{ padding: 20 }}>
            <div className="qp-section-title" style={{ marginBottom: 12 }}>
              Answer Review
            </div>
            {questions.map((q, i) => (
              <div
                key={i}
                style={{
                  padding: "12px 0",
                  borderBottom:
                    i < questions.length - 1 ? "1px solid #f1f5f9" : "none",
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: 8,
                  }}
                >
                  {i + 1}. {q.question}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {q.options.map((opt, oi) => {
                    const isCorrect = oi === q.correctAnswer,
                      isUser = oi === answers[i];
                    let bg = "#f8fafc",
                      border = "#f1f5f9",
                      color = "#64748b";
                    if (isCorrect) {
                      bg = "rgba(16,185,129,.08)";
                      border = "#10b981";
                      color = "#059669";
                    } else if (isUser && !isCorrect) {
                      bg = "rgba(239,68,68,.07)";
                      border = "#ef4444";
                      color = "#dc2626";
                    }
                    return (
                      <span
                        key={oi}
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: 20,
                          background: bg,
                          border: `1.5px solid ${border}`,
                          color,
                        }}
                      >
                        {String.fromCharCode(65 + oi)}. {opt}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="qp-result-actions">
            <button
              className="qp-btn-outline"
              onClick={() => setLocation("/ai-tutor")}
            >
              <ArrowLeft size={15} />
              Back to Chat
            </button>
            <button
              className="qp-btn-primary"
              onClick={() => {
                setShowResult(false);
                setQuizStarted(false);
                setSetupOpen(true);
              }}
            >
              <RotateCcw size={15} />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Landing ──
  if (!quizStarted) {
    return (
      <div className="qp">
        <style>{CSS}</style>
        <AnimatePresence>
          {setupOpen && (
            <Wizard
              units={unitsForWizard}
              onStart={handleStart}
              onClose={() => setSetupOpen(false)}
            />
          )}
        </AnimatePresence>
        <div className="qp-landing">
          {/* Hero */}
          <div className="qp-hero">
            <div className="qp-hero-inner">
              <div>
                <div className="qp-hero-title">Ready for a Challenge? 🎯</div>
                <div className="qp-hero-sub">
                  Focus on what you need to learn. Customise your subject,
                  difficulty, and time limit.
                </div>
              </div>
              <div className="qp-card qp-cta">
                <div className="qp-cta-title">Start a Custom Quiz</div>
                <div className="qp-cta-sub">
                  Pick your subject, difficulty, and time. We'll generate the
                  perfect quiz for you.
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    justifyContent: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    className="qp-btn-outline"
                    onClick={() => setLocation("/ai-tutor")}
                  >
                    <ArrowLeft size={15} />
                    Back to Chat
                  </button>
                  <motion.button
                    className="qp-btn-primary"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setSetupOpen(true)}
                  >
                    <Zap size={16} />
                    Start New Quiz
                  </motion.button>
                </div>
              </div>
              <div className="qp-hero-stats">
                <div className="qp-hero-stat">
                  <div className="qp-hero-sv">{quizBanks.length}</div>
                  <div className="qp-hero-sl">Quiz Banks</div>
                </div>
                <div className="qp-hero-div" />
                <div className="qp-hero-stat">
                  <div className="qp-hero-sv">{mapLibraryUnits(librarySubjects).length}</div>
                  <div className="qp-hero-sl">Topics</div>
                </div>
                <div className="qp-hero-div" />
                <div className="qp-hero-stat">
                  <div className="qp-hero-sv">3</div>
                  <div className="qp-hero-sl">Difficulty Levels</div>
                </div>
              </div>
            </div>
          </div>

          {/* Quiz Bank */}
          <div>
            <div className="qp-section-title">Available Quiz Banks</div>
            {pageError && (
              <div className="qp-card" style={{ padding: 16, marginBottom: 14, color: "#ef4444", fontSize: 13, fontWeight: 700 }}>
                {pageError}
              </div>
            )}
            <div className="qp-bank-grid">
              {quizBanks.map((qb, i) => (
                <motion.div
                  key={qb.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07 }}
                  whileHover={{ y: -4 }}
                >
                  <div
                    className="qp-card qp-bank-card"
                    onClick={() => {
                      const units = mapLibraryUnits(librarySubjects).filter(
                        (unit) => unit.subjectGroupKey === qb.id,
                      );
                      setUnitsForWizard(units);
                      setSetupOpen(true);
                    }}
                  >
                    <div
                      className="qp-bank-card-accent"
                      style={{ background: qb.color }}
                    />
                    <div
                      className="qp-bank-card-icon"
                      style={{ background: qb.accentBg, color: qb.color }}
                    >
                      <Target size={22} />
                    </div>
                    <div className="qp-bank-card-title">{qb.title}</div>
                    <div className="qp-bank-card-sub">{qb.subject}</div>
                    <div className="qp-bank-card-footer">
                      <span
                        className="qp-bank-tag"
                        style={{ background: qb.accentBg, color: qb.color }}
                      >
                        {qb.difficulty}
                      </span>
                      <span className="qp-bank-meta">
                        <Clock size={11} />
                        {qb.time} min · {qb.questions}Q
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
              {!quizBanks.length && (
                <div className="qp-card qp-bank-card">
                  <div className="qp-bank-card-title">No uploaded subjects found</div>
                  <div className="qp-bank-card-sub">
                    Upload subject units first, then return here to generate quizzes.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CTA */}
        </div>
      </div>
    );
  }

  // ── Active Quiz ──
  const q = questions[qIdx];
  const Palette = () => (
    <>
      <div className="qp-pal-head">Question Navigator</div>
      <div className="qp-pal-prog">
        <div className="qp-pal-pr">
          <span>Progress</span>
          <span style={{ color: "#6366f1", fontWeight: 700 }}>
            {answered}/{questions.length}
          </span>
        </div>
        <div className="qp-pal-pb">
          <div
            className="qp-pal-pf"
            style={{ width: `${(answered / questions.length) * 100}%` }}
          />
        </div>
      </div>
      <div className="qp-pal-grid-wrap">
        <div className="qp-pal-grid">
          {questions.map((_, i) => {
            const st = statuses[i];
            const cur = i === qIdx;
            const cls = cur
              ? "qp-pb-cur"
              : st === "answered"
                ? "qp-pb-ans"
                : st === "marked"
                  ? "qp-pb-mk"
                  : "qp-pb-un";
            return (
              <motion.button
                key={i}
                className={`qp-pb ${cls}`}
                whileHover={{ scale: cur ? 1.07 : 1.05 }}
                onClick={() => setQIdx(i)}
              >
                {i + 1}
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="qp-pal-leg">
        {[
          { bg: "linear-gradient(135deg,#6366f1,#8b5cf6)", l: "Current" },
          { bg: "linear-gradient(135deg,#10b981,#059669)", l: "Answered" },
          { bg: "linear-gradient(135deg,#f59e0b,#d97706)", l: "Review" },
          { bg: "#f1f5f9", l: "Not done" },
        ].map((x) => (
          <div key={x.l} className="qp-leg">
            <div className="qp-legdot" style={{ background: x.bg }} />
            {x.l}
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div className="qp" style={{ background: "#f8fafc", minHeight: "100vh" }}>
      <style>{CSS}</style>
      {/* Quiz header — dashboard hero gradient */}
      <div className="qp-quiz-head">
        <div className="qp-quiz-head-left">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: "rgba(255,255,255,.2)",
              border: "1.5px solid rgba(255,255,255,.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GraduationCap size={18} color="#fff" />
          </div>
          <div>
            <div className="qp-quiz-head-title">Quiz Session</div>
            <div className="qp-quiz-head-sub">
              Q{qIdx + 1}/{questions.length} ·{" "}
              {quizConfig?.difficulty || "Medium"}
            </div>
          </div>
        </div>
        <div className="qp-quiz-head-right">
          <div className={`qp-timer${timeWarn ? " warn" : ""}`}>
            <Clock
              size={14}
              color={timeWarn ? "#fca5a5" : "rgba(255,255,255,.8)"}
            />
            <span className="qp-timer-val">{fmt(timeLeft)}</span>
          </div>
          <button
            className="qp-icon-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button className="qp-submit-btn-head" onClick={handleSubmit}>
            <CheckCircle2 size={14} />
            Submit
          </button>
        </div>
      </div>

      <div className="qp-quiz-body">
        {/* Question card */}
        <div className="qp-q-card">
          <div className="qp-q-head">
            <span className="qp-q-badge-num">Q {qIdx + 1}</span>
            <span
              className="qp-q-badge-type"
              style={{ background: "rgba(99,102,241,.1)", color: "#6366f1" }}
            >
              MCQ
            </span>
            <span className="qp-q-marks">1 mark</span>
          </div>
          <div className="qp-q-body">
            <AnimatePresence mode="wait">
              <motion.div
                key={qIdx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                <p className="qp-q-text">{q.question}</p>
                {q.options.map((opt, i) => {
                  const isSel = answers[qIdx] === i;
                  return (
                    <div
                      key={i}
                      className={`qp-opt${isSel ? " sel" : ""}`}
                      onClick={() => handleAnswer(i)}
                    >
                      <div className="qp-opt-letter">
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span className="qp-opt-text">{opt}</span>
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="qp-q-foot">
            <button
              className="qp-nav-btn"
              onClick={() => setQIdx((p) => Math.max(0, p - 1))}
              disabled={qIdx === 0}
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="qp-mark-btn" onClick={markForLater}>
                <Bookmark size={12} />
                Mark for Review
              </button>
              <button
                className="qp-next-btn"
                onClick={() =>
                  qIdx < questions.length - 1
                    ? setQIdx((p) => p + 1)
                    : handleSubmit()
                }
              >
                {qIdx < questions.length - 1 ? "Save & Next" : "Finish"}
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Right panel — desktop */}
        <div className="qp-right">
          <div className="qp-pal-card">
            <Palette />
          </div>
          <div className="qp-stats-card">
            <div className="qp-stats-grid">
              <div className="qp-stat g">
                <div className="qp-statv">{answered}</div>
                <div className="qp-statl">Answered</div>
              </div>
              <div className="qp-stat a">
                <div className="qp-statv">{marked}</div>
                <div className="qp-statl">Review</div>
              </div>
              <div className="qp-stat i">
                <div className="qp-statv">
                  {questions.length - answered - marked}
                </div>
                <div className="qp-statl">Left</div>
              </div>
            </div>
            <button className="qp-mark-full-btn" onClick={markForLater}>
              <Bookmark size={13} />
              Mark for Review
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div
        style={{ display: "none" }}
        className="md:hidden" /* handled via responsive above */
      />
    </div>
  );
};

export default QuizPage;
