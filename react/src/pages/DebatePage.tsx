import { useState, useEffect, useRef, useCallback, useReducer } from "react";
import { useLocation } from "wouter";
import Navigation from "../components/navigation";
import FormattedAIContent from "../components/ai/FormattedAIContent";
import { useAuth } from "../hooks/use-auth";
import { useSessionState } from "../hooks/useSessionState";
import {
  createDebateRoom,
  endDebate,
  endDebateRoom,
  getCandidateContext,
  getDebateRoom,
  getDebateTopics,
  getLibrarySubjects,
  joinDebateRoom,
  respondDebate,
  retryEndDebateRoom,
  startDebate,
  startDebateRoom,
  submitDebateRoomTurn,
  synthesizeDebateSpeech,
  transcribeDebateAudio,
  type LibrarySubject,
} from "../lib/gradeupApi";
import { debateDebug, ttsDebug } from "../lib/ttsDebug";

const POST_AUTH_REDIRECT_KEY = "gradeup_post_auth_redirect";
const DEBATE_GUEST_NAME_KEY = "gradeup_debate_guest_name";
const DEBATE_GUEST_ID_KEY = "gradeup_debate_guest_id";

type GreetingFlight = {
  promise: Promise<{ dataUrl: string | null }>;
  ownerId: number;
  played: boolean;
};

const debateGreetingFlights = new Map<string, GreetingFlight>();
let debateGreetingOwnerSeq = 0;

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
:root{
  --bg:#f8fafc;--surf:#fff;--surf2:#f8fafc;--surf3:#f1f5f9;
  --bdr:rgba(0,0,0,.06);--bdr2:rgba(0,0,0,.1);
  --ind:#6366f1;--ind2:#818cf8;--ind3:#a5b4fc;
  --vio:#8b5cf6;--pnk:#ec4899;--em:#10b981;--amb:#f59e0b;
  --sky:#38bdf8;--red:#ef4444;
  --t1:#0f172a;--t2:#475569;--t3:#94a3b8;--t4:#e2e8f0;
  --font:'Plus Jakarta Sans',system-ui,sans-serif;
  --sh:0 2px 12px rgba(0,0,0,.05);--sh2:0 8px 32px rgba(0,0,0,.12);--sh3:0 24px 64px rgba(0,0,0,.18);
  --grad:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%);
  --r:20px;
}
.dark{
  --bg:#0b1120;--surf:#1e293b;--surf2:#0f172a;--surf3:#334155;
  --bdr:rgba(255,255,255,.07);--bdr2:rgba(255,255,255,.1);
  --t1:#f1f5f9;--t2:#94a3b8;--t3:#64748b;--t4:#334155;
}
body{font-family:var(--font);background:var(--bg);color:var(--t1);-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:rgba(99,102,241,.2);border-radius:4px}
button,input,select,textarea{font-family:var(--font)}
.dp-app{height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
@keyframes orbFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-16px) scale(1.02)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes modalUp{from{opacity:0;transform:translateY(22px) scale(.96)}to{opacity:1;transform:none}}
@keyframes recBlink{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes tileIn{from{opacity:0;transform:scale(.93)}to{opacity:1;transform:scale(1)}}
@keyframes waveBar{0%,100%{height:3px;opacity:.5}50%{height:20px;opacity:1}}
@keyframes rPop{0%{opacity:0;transform:translate(-50%,-70%) scale(.3)}20%{opacity:1;transform:translate(-50%,-50%) scale(1.3)}65%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-120%) scale(.7)}}
@keyframes dotPulse{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}
@keyframes turnBlink{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes tIn{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes voicePulse{0%,100%{box-shadow:0 0 0 0 rgba(139,92,246,.4)}50%{box-shadow:0 0 0 8px rgba(139,92,246,.0)}}
@keyframes micGlow{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.5)}50%{box-shadow:0 0 0 10px rgba(16,185,129,.0)}}
@keyframes countdownPulse{0%{transform:scale(1)}50%{transform:scale(1.08)}100%{transform:scale(1)}}

.dp-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--surf);border:1.5px solid var(--bdr);border-radius:13px;padding:10px 17px;font-size:12.5px;font-weight:700;color:var(--t1);box-shadow:var(--sh2);z-index:9999;display:flex;align-items:center;gap:7px;animation:tIn .32s cubic-bezier(.34,1.2,.64,1);white-space:nowrap;max-width:calc(100vw - 28px)}
.dp-toast.success{border-color:rgba(16,185,129,.4)}.dp-toast.error{border-color:rgba(239,68,68,.4)}.dp-toast.warn{border-color:rgba(245,158,11,.4)}.dp-toast.info{border-color:rgba(99,102,241,.36)}

.voice-active{animation:voicePulse 1.2s ease-in-out infinite}
.mic-live{animation:micGlow 1s ease-in-out infinite}
.voice-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:10.5px;font-weight:800;background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.3);color:#c4b5fd}
.mic-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:10.5px;font-weight:800;background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);color:#6ee7b7}
.voice-bars{display:flex;align-items:center;gap:2px;height:14px}
.voice-bar{width:2px;border-radius:2px;background:#c4b5fd;animation:waveBar .55s ease-in-out infinite}
.mic-bar{width:2px;border-radius:2px;background:#6ee7b7;animation:waveBar .55s ease-in-out infinite}

.fi{margin-bottom:10px}
.fl{display:block;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--t3);margin-bottom:5px}
.finput{width:100%;padding:10px 12px;border-radius:11px;border:1.5px solid var(--bdr);background:var(--surf2);color:var(--t1);font-size:13px;outline:none;transition:all .18s}
.finput:focus{border-color:var(--ind);background:var(--surf);box-shadow:0 0 0 3px rgba(99,102,241,.1)}
.finput::placeholder{color:var(--t3)}
.finput:disabled{opacity:.45;cursor:not-allowed}
select.finput{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 11px center;padding-right:30px}
.fi-row{display:grid;grid-template-columns:1fr 1fr;gap:9px}

.btn-p{padding:11px 20px;border-radius:13px;border:none;cursor:pointer;background:var(--grad);color:#fff;font-size:13px;font-weight:700;transition:all .22s;box-shadow:0 5px 18px rgba(99,102,241,.28);display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:var(--font);width:100%}
.btn-p:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 9px 26px rgba(99,102,241,.38)}
.btn-p:disabled{opacity:.38;cursor:not-allowed;transform:none;box-shadow:none}
.btn-s{padding:9px 16px;border-radius:11px;border:1.5px solid var(--bdr);background:var(--surf2);cursor:pointer;color:var(--t2);font-size:12.5px;font-weight:700;transition:.2s;font-family:var(--font);display:inline-flex;align-items:center;justify-content:center;gap:6px}
.btn-s:hover{border-color:rgba(99,102,241,.32);color:var(--t1);background:rgba(99,102,241,.04)}
.btn-d{padding:9px 16px;border-radius:11px;border:1.5px solid rgba(239,68,68,.25);background:rgba(239,68,68,.06);cursor:pointer;color:var(--red);font-size:12.5px;font-weight:700;transition:.2s;font-family:var(--font);display:inline-flex;align-items:center;justify-content:center;gap:6px}
.btn-d:hover{background:rgba(239,68,68,.12)}

.link-box{border-radius:14px;background:rgba(99,102,241,.04);border:1.5px solid rgba(99,102,241,.16);padding:12px 14px;margin-bottom:10px}
.link-box-title{font-size:10px;font-weight:800;color:var(--ind);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.link-row{display:flex;align-items:center;gap:8px;padding:9px 11px;border-radius:10px;background:var(--surf);border:1.5px solid var(--bdr)}
.link-val{flex:1;font-family:monospace;font-size:10.5px;color:var(--ind);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.copy-btn{padding:5px 11px;border-radius:7px;border:none;cursor:pointer;background:var(--grad);color:#fff;font-size:11.5px;font-weight:800;transition:.18s;flex-shrink:0}
.copy-btn:hover{transform:scale(1.05)}
.share-actions{display:flex;gap:6px;margin-top:7px}
.share-btn{flex:1;padding:7px 10px;border-radius:9px;border:1.5px solid var(--bdr);background:var(--surf);cursor:pointer;font-size:11.5px;font-weight:700;color:var(--t2);transition:.2s;display:flex;align-items:center;justify-content:center;gap:5px}
.share-btn:hover{border-color:rgba(99,102,241,.3);color:var(--ind);background:rgba(99,102,241,.04)}

.steps{display:flex;flex-direction:column;gap:5px;margin-bottom:13px}
.step-row{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:11px;border:1.5px solid var(--bdr);background:var(--surf2);transition:.22s}
.step-row.done{border-color:rgba(16,185,129,.32);background:rgba(16,185,129,.05)}
.step-row.act{border-color:rgba(99,102,241,.32);background:rgba(99,102,241,.05)}
.step-row.pend{opacity:.45}
.step-num{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:800;flex-shrink:0}
.step-row.done .step-num{background:var(--em);color:#fff}
.step-row.act  .step-num{background:var(--ind);color:#fff}
.step-row.pend .step-num{background:var(--surf3);color:var(--t3)}
.step-lbl{font-size:12px;font-weight:700}
.step-row.done .step-lbl{color:var(--em)}.step-row.act .step-lbl{color:var(--t1)}.step-row.pend .step-lbl{color:var(--t3)}

.sec-div{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--t3);margin-bottom:8px;margin-top:4px;display:flex;align-items:center;gap:7px}
.sec-div::after{content:'';flex:1;height:1px;background:var(--bdr)}

.mic-preview{display:flex;align-items:center;gap:12px;padding:13px 14px;border-radius:14px;background:rgba(99,102,241,.05);border:1.5px solid rgba(99,102,241,.14);margin-bottom:11px}
.mic-av{width:46px;height:46px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:19px;font-weight:800;color:#fff;box-shadow:0 6px 18px rgba(99,102,241,.32);flex-shrink:0}
.mic-info{flex:1}
.mic-name{font-size:14px;font-weight:800;color:var(--t1);margin-bottom:1px}
.mic-sub{font-size:11px;color:var(--t2)}
.perm-row{display:flex;gap:6px;margin-top:7px;flex-wrap:wrap}
.perm-btn{display:flex;align-items:center;gap:5px;padding:6px 11px;border-radius:8px;border:1.5px solid var(--bdr);background:var(--surf);cursor:pointer;font-size:11.5px;font-weight:700;transition:.18s}
.perm-btn.granted{background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.32);color:var(--em)}
.perm-btn.denied{background:rgba(239,68,68,.07);border-color:rgba(239,68,68,.28);color:var(--red)}
.perm-btn.req{background:rgba(99,102,241,.07);border-color:rgba(99,102,241,.28);color:var(--ind)}
.perm-btn:disabled{opacity:.42;cursor:not-allowed}
.perm-warn{font-size:11.5px;color:#fca5a5;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.18);border-radius:9px;padding:8px 11px;margin-top:7px;line-height:1.6}

/* ── MIC PERMISSION MODAL CARD ─────────────────────────────────────────── */
.mic-perm-card{border-radius:16px;background:rgba(99,102,241,.06);border:1.5px solid rgba(99,102,241,.2);padding:16px;margin-bottom:14px}
.mic-perm-header{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.mic-perm-icon{width:42px;height:42px;border-radius:12px;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.mic-perm-title{font-size:14px;font-weight:800;color:#fff}
.mic-perm-sub{font-size:11px;color:rgba(255,255,255,.5);margin-top:2px}
.mic-perm-status{display:flex;align-items:center;gap:9px;padding:11px 13px;border-radius:12px;border:1.5px solid}
.mic-perm-status.idle{background:rgba(99,102,241,.08);border-color:rgba(99,102,241,.28)}
.mic-perm-status.requesting{background:rgba(245,158,11,.08);border-color:rgba(245,158,11,.28)}
.mic-perm-status.granted{background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.32)}
.mic-perm-status.denied{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.28)}
.mic-perm-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.mic-perm-status.idle .mic-perm-dot{background:var(--ind);animation:pulse 2s infinite}
.mic-perm-status.requesting .mic-perm-dot{background:var(--amb);animation:pulse 1s infinite}
.mic-perm-status.granted .mic-perm-dot{background:var(--em);animation:pulse 2.5s infinite}
.mic-perm-status.denied .mic-perm-dot{background:var(--red)}
.mic-perm-label{flex:1;font-size:12.5px;font-weight:700;color:#fff}
.mic-perm-hint{font-size:10.5px;color:rgba(255,255,255,.45);margin-top:2px}
.mic-perm-action{padding:7px 14px;border-radius:9px;border:none;cursor:pointer;font-size:12px;font-weight:800;transition:.18s;font-family:var(--font);flex-shrink:0}
.mic-perm-action.allow{background:var(--grad);color:#fff;box-shadow:0 4px 14px rgba(99,102,241,.28)}
.mic-perm-action.allow:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(99,102,241,.38)}
.mic-perm-action.retry{background:rgba(239,68,68,.14);color:var(--red);border:1.5px solid rgba(239,68,68,.3)}
.mic-perm-action.retry:hover{background:rgba(239,68,68,.22)}
.mic-perm-action:disabled{opacity:.4;cursor:not-allowed}
.mic-perm-warn{margin-top:8px;padding:8px 11px;border-radius:9px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.18);font-size:11px;color:#fca5a5;line-height:1.6}
.mic-level-row{display:flex;align-items:center;gap:8px;margin-top:10px}
.mic-level-label{font-size:10.5px;font-weight:700;color:rgba(255,255,255,.45);flex-shrink:0}
.mic-level-track{flex:1;height:5px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden}
.mic-level-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#10b981,#6ee7b7);transition:width .1s}
.mic-toggle-row{display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
.mic-toggle-label{font-size:12px;font-weight:700;color:#fff}
.mic-toggle-btn{padding:5px 12px;border-radius:7px;border:none;cursor:pointer;font-size:11.5px;font-weight:800;font-family:var(--font);transition:.18s}
.mic-toggle-btn.on{background:rgba(16,185,129,.15);color:#6ee7b7;border:1.5px solid rgba(16,185,129,.35)}
.mic-toggle-btn.off{background:rgba(239,68,68,.12);color:var(--red);border:1.5px solid rgba(239,68,68,.3)}

/* ── TEAM BADGES ─────────────────────────────────────────────────────────── */
.team-a-badge{background:rgba(99,102,241,.85);color:#fff;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:800;flex-shrink:0}
.team-b-badge{background:rgba(236,72,153,.85);color:#fff;padding:2px 7px;border-radius:20px;font-size:9px;font-weight:800;flex-shrink:0}
.team-a-tile{box-shadow:0 0 0 2px #6366f1,0 0 22px rgba(99,102,241,.22)!important}
.team-b-tile{box-shadow:0 0 0 2px #ec4899,0 0 22px rgba(236,72,153,.22)!important}

/* ── COUNTDOWN OVERLAY ───────────────────────────────────────────────────── */
.countdown-overlay{position:absolute;top:8px;left:50%;transform:translateX(-50%);background:rgba(245,158,11,.92);border-radius:100px;padding:5px 13px;font-size:11px;font-weight:800;color:#000;white-space:nowrap;animation:countdownPulse 1s ease-in-out infinite;z-index:10}

/* ── TURN STATUS BAR ─────────────────────────────────────────────────────── */
.team-turn-bar{display:flex;align-items:center;gap:8px;padding:7px 14px;border-radius:10px;border:1.5px solid;font-size:12px;font-weight:700;margin-bottom:8px}
.team-turn-bar.a{background:rgba(99,102,241,.1);border-color:rgba(99,102,241,.3);color:#a5b4fc}
.team-turn-bar.b{background:rgba(236,72,153,.1);border-color:rgba(236,72,153,.3);color:#f9a8d4}
.team-turn-dot{width:8px;height:8px;border-radius:50%;animation:pulse 1.5s infinite}
.team-turn-bar.a .team-turn-dot{background:#6366f1}
.team-turn-bar.b .team-turn-dot{background:#ec4899}

.overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);backdrop-filter:blur(10px);z-index:700;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .2s ease}
.modal{background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);width:100%;box-shadow:var(--sh3);overflow:hidden;animation:modalUp .28s cubic-bezier(.34,1.2,.64,1);max-height:calc(100dvh - 30px);display:flex;flex-direction:column}
.modal.dark{background:#0c1220;border-color:rgba(255,255,255,.1)}
.mh{padding:16px 20px 13px;border-bottom:1px solid var(--surf3);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:10px}
.modal.dark .mh{border-color:rgba(255,255,255,.08)}
.mh-title{font-size:15.5px;font-weight:800;color:var(--t1)}
.modal.dark .mh-title{color:#fff}
.mh-close{width:27px;height:27px;border-radius:8px;border:1.5px solid var(--bdr);background:var(--surf2);cursor:pointer;color:var(--t2);display:flex;align-items:center;justify-content:center;transition:.15s;font-size:12.5px;flex-shrink:0}
.mh-close:hover{color:var(--t1);transform:rotate(90deg)}
.mb{padding:18px 20px;overflow-y:auto;flex:1}
.mf{padding:13px 20px;border-top:1px solid var(--surf3);display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;flex-wrap:wrap}
.modal.dark .mf{border-color:rgba(255,255,255,.08)}
.lo-progress{width:100%;height:4px;background:rgba(0,0,0,.07);border-radius:4px;overflow:hidden;margin-top:7px}
.lo-progress-fill{height:100%;background:var(--grad);border-radius:4px;transition:width .4s ease}
.loader-spin{width:22px;height:22px;border-radius:50%;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;animation:spin .7s linear infinite;flex-shrink:0}
.loader-spin.dark{border-color:rgba(99,102,241,.2);border-top-color:var(--ind)}
.debate-loader-screen{position:fixed;inset:0;z-index:950;background:rgba(6,12,26,.94);backdrop-filter:blur(18px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .2s ease}
.debate-loader-card{width:min(360px,100%);border-radius:18px;border:1px solid rgba(99,102,241,.26);background:rgba(15,23,42,.92);box-shadow:var(--sh3);padding:26px 24px;text-align:center;color:#fff}
.debate-loader-ring{width:62px;height:62px;border-radius:50%;border:4px solid rgba(99,102,241,.18);border-top-color:#a5b4fc;margin:0 auto 16px;animation:spin .8s linear infinite}
.debate-loader-title{font-size:16px;font-weight:900;margin-bottom:5px}
.debate-loader-sub{font-size:12px;line-height:1.6;color:rgba(255,255,255,.52);margin-bottom:14px}
.debate-loader-bar{height:5px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}
.debate-loader-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899);transition:width .35s ease}

.dp-setup{height:100dvh;display:grid;grid-template-columns:32% 1fr;overflow:hidden}
.dp-setup-left{background:#060c1a;overflow:hidden;position:relative;display:flex;flex-direction:column}
.dp-setup-left-inner{overflow-y:auto;flex:1;padding:clamp(20px,3vw,44px);display:flex;flex-direction:column;justify-content:center;position:relative;z-index:2}
.dp-orbs{position:absolute;inset:0;pointer-events:none}
.dp-orb{position:absolute;border-radius:50%}
.dp-orb1{width:320px;height:320px;background:radial-gradient(circle,rgba(99,102,241,.18) 0%,transparent 70%);top:-80px;left:-60px;animation:orbFloat 9s ease-in-out infinite}
.dp-orb2{width:220px;height:220px;background:radial-gradient(circle,rgba(139,92,246,.13) 0%,transparent 70%);bottom:-40px;right:-30px;animation:orbFloat 11s ease-in-out infinite reverse}
.dp-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(99,102,241,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.06) 1px,transparent 1px);background-size:38px 38px;pointer-events:none}
.dp-logo{display:flex;align-items:center;gap:8px;margin-bottom:20px;animation:fadeUp .5s ease both}
.dp-logo-ico{width:32px;height:32px;background:var(--grad);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 6px 18px rgba(99,102,241,.38)}
.dp-logo-name{font-size:14px;font-weight:800;background:linear-gradient(90deg,#fff,var(--ind3));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.dp-tag{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:100px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);font-size:10px;font-weight:800;color:var(--ind3);letter-spacing:.1em;text-transform:uppercase;margin-bottom:16px;animation:fadeUp .5s ease .1s both;width:fit-content}
.dp-tag-dot{width:5px;height:5px;border-radius:50%;background:var(--em);animation:pulse 2s infinite}
.dp-h1{font-size:clamp(18px,2.2vw,32px);font-weight:900;line-height:1.06;letter-spacing:-1px;color:#fff;margin-bottom:10px;animation:fadeUp .5s ease .16s both}
.dp-h1 .gt{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.dp-p{font-size:12px;color:rgba(255,255,255,.42);line-height:1.85;margin-bottom:20px;animation:fadeUp .5s ease .22s both}
.dp-feats-left{display:flex;flex-direction:column;gap:6px;animation:fadeUp .5s ease .28s both}
.dp-feat-left{display:flex;align-items:center;gap:10px;padding:9px 12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;transition:.3s}
.dp-feat-left:hover{background:rgba(99,102,241,.1);border-color:rgba(99,102,241,.28)}
.dp-feat-ico{width:34px;height:34px;border-radius:9px;background:rgba(99,102,241,.2);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.dp-feat-txt strong{display:block;font-size:12px;font-weight:700;color:#fff;margin-bottom:1px}
.dp-feat-txt span{font-size:10px;color:rgba(255,255,255,.38)}
.ctx-card{margin-top:16px;padding:12px 14px;border-radius:12px;background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);animation:fadeUp .5s ease .32s both}
.ctx-card-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--em);margin-bottom:5px}
.ctx-card-val{font-size:13px;font-weight:700;color:#fff;margin-bottom:2px}
.ctx-card-sub{font-size:11px;color:rgba(255,255,255,.4)}
.dp-setup-right{background:var(--surf);overflow:hidden;display:flex;flex-direction:column}
.dp-setup-scroll{overflow-y:auto;flex:1;padding:clamp(20px,3vw,44px)}
.dp-setup-inner{max-width:620px;width:100%;margin:0 auto}
.setup-back{display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:11px;border:2px solid rgba(99,102,241,.28);background:rgba(99,102,241,.07);cursor:pointer;font-size:13px;font-weight:800;color:var(--ind);transition:all .22s;margin-bottom:20px;font-family:var(--font)}
.setup-back:hover{background:rgba(99,102,241,.14);border-color:rgba(99,102,241,.5);color:var(--t1);transform:translateX(-3px);box-shadow:0 4px 16px rgba(99,102,241,.15)}
.setup-title{font-size:clamp(17px,2vw,24px);font-weight:900;letter-spacing:-.4px;margin-bottom:3px;color:var(--t1)}
.setup-sub{font-size:12px;color:var(--t2);margin-bottom:18px;line-height:1.6}

.submode-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:14px}
.submode-card{padding:14px 13px;border-radius:14px;border:2px solid var(--bdr);background:var(--surf2);cursor:pointer;transition:all .22s;display:flex;align-items:flex-start;gap:9px}
.submode-card:hover{border-color:rgba(99,102,241,.32);background:rgba(99,102,241,.03);transform:translateY(-2px)}
.submode-card.sel{border-color:var(--ind);background:rgba(99,102,241,.06)}
.submode-ico{font-size:22px;flex-shrink:0;margin-top:2px}
.submode-title{font-size:12.5px;font-weight:800;color:var(--t1);margin-bottom:3px}
.submode-desc{font-size:10.5px;color:var(--t2);line-height:1.5}

.dtype-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px}
.dtype-card{padding:12px 13px;border-radius:13px;border:2px solid var(--bdr);background:var(--surf2);cursor:pointer;transition:all .22s;display:flex;align-items:flex-start;gap:9px}
.dtype-card:hover{border-color:rgba(99,102,241,.32);background:rgba(99,102,241,.03);transform:translateY(-1px)}
.dtype-card.sel{border-color:var(--ind);background:rgba(99,102,241,.06)}
.dtype-ico{font-size:19px;flex-shrink:0}
.dtype-title{font-size:12px;font-weight:800;color:var(--t1);margin-bottom:2px}
.dtype-desc{font-size:10px;color:var(--t2);line-height:1.45}

.dp-room{height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:#060c1a}
.room-bar{height:50px;background:rgba(6,12,26,.97);backdrop-filter:blur(18px);border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;padding:0 12px;gap:7px;flex-shrink:0;z-index:100;overflow:hidden}
.room-logo{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:#fff;flex-shrink:0;border:none;background:none;cursor:pointer;font-family:var(--font)}
.room-logo-ico{width:25px;height:25px;background:var(--grad);border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:12px}
.rbar-div{width:1px;height:15px;background:rgba(255,255,255,.08);flex-shrink:0}
.rbar-topic{flex:1;font-size:11.5px;color:rgba(255,255,255,.38);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.rbar-topic strong{color:#fff}
.rbar-pill{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;font-size:10.5px;font-weight:700;flex-shrink:0}
.pill-timer{background:rgba(99,102,241,.14);border:1px solid rgba(99,102,241,.22);color:var(--ind3);font-family:monospace}
.pill-rec{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.22);color:var(--red);animation:recBlink 1.5s infinite}
.pill-rec-dot{width:5px;height:5px;border-radius:50%;background:var(--red)}
.pill-turn-you{background:rgba(16,185,129,.14);border:1px solid rgba(16,185,129,.28);color:#6ee7b7}
.pill-turn-ai{background:rgba(139,92,246,.14);border:1px solid rgba(139,92,246,.28);color:#c4b5fd;animation:turnBlink 1.2s infinite}
.pill-team-a{background:rgba(99,102,241,.2);border:1px solid rgba(99,102,241,.4);color:#a5b4fc}
.pill-team-b{background:rgba(236,72,153,.2);border:1px solid rgba(236,72,153,.4);color:#f9a8d4}
.rbar-end{padding:4px 10px;border-radius:7px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);cursor:pointer;font-size:11px;font-weight:700;transition:.15s;flex-shrink:0;font-family:var(--font)}
.rbar-end:hover{background:rgba(239,68,68,.18);border-color:rgba(239,68,68,.35);color:var(--red)}
.room-body{flex:1;display:flex;min-height:0;overflow:hidden}
.grid-area{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden}
.room-info-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:10px;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,.06)}
.room-info-card{border-radius:14px;padding:10px 11px;min-height:auto}
.room-info-card.live{background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.18)}
.room-info-card.host{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.18)}
.room-info-card.game{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.18)}
.room-info-label{font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px}
.room-info-card.live .room-info-label{color:rgba(255,255,255,.45)}
.room-info-card.host .room-info-label{color:#fcd34d}
.room-info-card.game .room-info-label{color:#86efac}
.room-info-title{font-size:12.5px;font-weight:800;color:#fff;margin-bottom:4px}
.room-info-sub{font-size:10.5px;line-height:1.45;color:rgba(255,255,255,.52)}
.room-chip-row{display:flex;gap:6px;flex-wrap:wrap}
.room-chip{padding:4px 8px;border-radius:20px;background:rgba(255,255,255,.06);font-size:10px;font-weight:700;color:#fff}
.room-info-card.host{grid-column:1/-1}
.host-popup-wrap{position:relative}
.host-popup-btn{display:flex;align-items:center;gap:7px;width:100%;justify-content:center;padding:10px 12px;border:none;border-radius:14px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.2);color:#fde68a;cursor:pointer;font-size:11px;font-weight:800;font-family:var(--font);transition:.18s;white-space:nowrap}
.host-popup-btn:hover{transform:translateY(-1px);background:rgba(245,158,11,.18)}
.host-popup-dot{width:8px;height:8px;border-radius:50%;background:#f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.14)}
.host-popup-panel{position:absolute;top:calc(100% + 8px);right:0;width:min(320px,78vw);padding:12px;border-radius:16px;background:#10192f;border:1px solid rgba(245,158,11,.24);box-shadow:var(--sh2);z-index:30;animation:scaleIn .18s ease}
.host-popup-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}
.host-popup-title{font-size:12.5px;font-weight:800;color:#fff}
.host-popup-sub{font-size:10.5px;line-height:1.45;color:rgba(255,255,255,.5)}
.host-popup-close{width:24px;height:24px;border:none;border-radius:50%;background:rgba(255,255,255,.06);color:rgba(255,255,255,.66);cursor:pointer}
.host-popup-list{display:flex;flex-direction:column;gap:7px;max-height:220px;overflow:auto}
.host-popup-item{display:flex;align-items:center;gap:8px;padding:8px 9px;border-radius:11px;background:rgba(255,255,255,.05)}
.host-popup-meta{flex:1;min-width:0}
.host-popup-name{font-size:11.5px;font-weight:700;color:#fff}
.host-popup-note{font-size:10px;color:rgba(255,255,255,.45)}
.vid-grid{flex:1;display:grid;gap:8px;padding:10px;min-height:0;overflow:auto;align-content:start}
.vg-1{grid-template-columns:1fr}.vg-2{grid-template-columns:1fr 1fr}.vg-3{grid-template-columns:1fr 1fr 1fr}.vg-4{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}
.team-stage{flex:1;min-height:0;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:10px}
.moderator-row{display:grid;grid-template-columns:minmax(220px,360px);gap:8px;flex-shrink:0}
.moderator-row .tile{min-height:130px}
.team-vs-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:start;min-height:0}
.team-box{min-width:0;border-radius:16px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);padding:10px;display:flex;flex-direction:column;gap:10px}
.team-box-a{border-color:rgba(99,102,241,.28);background:rgba(99,102,241,.055)}
.team-box-b{border-color:rgba(236,72,153,.28);background:rgba(236,72,153,.055)}
.team-box.active{box-shadow:0 0 0 2px rgba(16,185,129,.38),0 0 26px rgba(16,185,129,.14)}
.team-box-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-shrink:0}
.team-box-title{font-size:13px;font-weight:900;color:#fff}
.team-box-sub{font-size:10.5px;font-weight:700;color:rgba(255,255,255,.45);margin-top:2px}
.team-member-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));grid-auto-rows:minmax(180px,auto);gap:8px;align-items:stretch}
.team-member-grid .tile{min-height:180px;height:100%}
.tile{border-radius:16px;background:#0d1428;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;transition:box-shadow .28s;min-height:220px;animation:tileIn .32s ease}
.tile.spk{box-shadow:0 0 0 2.5px var(--em),0 0 24px rgba(16,185,129,.2)}
.tile video{width:100%;height:100%;object-fit:cover;display:block}
.tile-av{border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;width:clamp(44px,6vw,78px);height:clamp(44px,6vw,78px);font-size:clamp(17px,2.4vw,30px)}
.tile-ov{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.83));padding:24px 12px 10px;display:flex;align-items:flex-end;justify-content:space-between;gap:6px}
.tile-name{font-size:clamp(11px,1.1vw,13px);font-weight:700;color:#fff;display:flex;align-items:center;gap:4px;flex-wrap:wrap}
.t-badge{font-size:9px;font-weight:800;padding:2px 6px;border-radius:20px;color:#fff;white-space:nowrap}
.t-host{background:var(--amb);color:#000}.t-ai{background:var(--grad)}.t-you{background:rgba(255,255,255,.17)}.t-med{background:rgba(56,189,248,.82);color:#000}
.tile-muted{width:20px;height:20px;border-radius:50%;background:rgba(239,68,68,.85);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9.5px}
.tile-react{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:42px;animation:rPop 2.2s forwards;pointer-events:none;z-index:5}
.tile-wave{position:absolute;top:9px;right:9px;display:flex;align-items:center;gap:2px;height:22px}
.tile-wave-bar{width:2.5px;border-radius:2px;animation:waveBar .65s ease-in-out infinite}
.tile-turn{position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(16,185,129,.88);border-radius:100px;padding:5px 12px;font-size:10px;font-weight:800;color:#fff;white-space:nowrap;animation:turnBlink 1.2s infinite}
.ai-typing-wrap{position:absolute;top:9px;right:9px;display:flex;gap:3px;align-items:center}
.ai-dot{width:5px;height:5px;border-radius:50%;background:var(--vio);animation:dotPulse .9s ease-in-out infinite}
.tile-nudge{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(245,158,11,.92);border-radius:12px;padding:9px 15px;font-size:12.5px;font-weight:700;color:#000;animation:scaleIn .3s ease;white-space:nowrap;border:1px solid rgba(245,158,11,.4);max-width:80%;text-align:center}
.ctrl-bar{min-height:68px;padding:10px 12px;background:rgba(6,12,26,.98);border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:8px;flex-wrap:wrap}
.cg{display:flex;align-items:center;gap:3px;flex-wrap:wrap}
.cbtn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 7px;border-radius:9px;border:1px solid rgba(255,255,255,.09);cursor:pointer;background:rgba(255,255,255,.04);color:rgba(255,255,255,.5);font-size:9px;font-weight:700;transition:all .18s;min-width:42px;font-family:var(--font)}
.cbtn-ico{font-size:14px;transition:transform .2s}
.cbtn:hover{background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.2);transform:translateY(-2px)}
.cbtn.on{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.36);color:var(--em)}
.cbtn.off{background:rgba(239,68,68,.09);border-color:rgba(239,68,68,.3);color:var(--red)}
.cbtn.hi{background:rgba(99,102,241,.12);border-color:rgba(99,102,241,.36);color:var(--ind3)}
.cbtn.amb{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.3);color:var(--amb)}
.cbtn.em{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.28);color:var(--em)}
.cbtn.rec{background:rgba(239,68,68,.14);border-color:rgba(239,68,68,.46);color:var(--red);animation:recBlink 1.5s infinite}
.cbtn.speaking{background:rgba(139,92,246,.14);border-color:rgba(139,92,246,.46);color:#c4b5fd;animation:voicePulse 1.2s ease-in-out infinite}
.cbtn.mic-live{background:rgba(16,185,129,.18);border-color:rgba(16,185,129,.6);color:#6ee7b7;animation:micGlow 1s ease-in-out infinite}
.cbtn.locked{background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.3);color:var(--amb)}
.cbtn:disabled{opacity:.38;cursor:not-allowed;transform:none}
.end-btn{padding:8px 16px;border-radius:9px;border:none;cursor:pointer;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-size:12px;font-weight:800;font-family:var(--font);box-shadow:0 3px 12px rgba(239,68,68,.28);transition:.2s;white-space:nowrap}
.end-btn:hover{transform:translateY(-2px);box-shadow:0 7px 20px rgba(239,68,68,.42)}
.react-pop{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#141e36;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px 10px;display:flex;gap:6px;box-shadow:var(--sh2);z-index:200;animation:scaleIn .2s ease}
.react-emoji{font-size:20px;cursor:pointer;padding:4px;border-radius:7px;border:none;background:none;transition:.15s}
.react-emoji:hover{transform:scale(1.45)}
.rec-overlay{position:fixed;top:63px;right:12px;background:rgba(239,68,68,.92);border-radius:8px;padding:4px 11px;font-size:11px;font-weight:800;color:#fff;z-index:200;animation:recBlink 1.5s infinite}
.side-panel{width:300px;min-width:300px;background:rgba(6,12,26,.98);border-left:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;overflow:hidden}
.panel-tabs-dark{display:flex;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0}
.ptab{flex:1;padding:10px 4px;background:none;border:none;border-bottom:2px solid transparent;color:rgba(255,255,255,.3);font-size:9px;font-weight:700;cursor:pointer;transition:.18s;display:flex;flex-direction:column;align-items:center;gap:3px;font-family:var(--font)}
.ptab:hover{color:rgba(255,255,255,.65)}
.ptab.active{color:var(--ind3);border-bottom-color:var(--ind)}
.ptab-cls{flex:0;padding:10px 8px;color:rgba(255,255,255,.22)}
.pscroll{flex:1;overflow-y:auto;min-height:0}
.p-list{padding:8px;display:flex;flex-direction:column;gap:5px}
.p-row{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);transition:.18s}
.p-row:hover{border-color:rgba(99,102,241,.28);background:rgba(99,102,241,.07)}
.p-row.spk{border-color:rgba(16,185,129,.4);background:rgba(16,185,129,.06)}
.p-av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800;flex-shrink:0}
.p-info{flex:1;min-width:0}
.p-name{font-size:12px;font-weight:700;color:#fff}
.p-role{font-size:10px;color:rgba(255,255,255,.28)}
.chat-msgs{padding:9px;display:flex;flex-direction:column;gap:7px}
.chat-side-head{padding:12px 14px;border:none;border-bottom:1px solid rgba(255,255,255,.07);background:rgba(99,102,241,.06);display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;text-align:left;color:#fff}
.chat-side-title{font-size:12.5px;font-weight:800;color:#fff}
.chat-side-sub{font-size:10.5px;color:rgba(255,255,255,.48);margin-top:2px}
.chat-msg{display:flex;gap:6px;animation:fadeUp .2s ease}
.chat-msg.own{flex-direction:row-reverse}
.chat-av-sm{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0;align-self:flex-end}
.chat-bwrap{display:flex;flex-direction:column;gap:2px;max-width:84%}
.chat-msg.own .chat-bwrap{align-items:flex-end}
.chat-sender{font-size:9.5px;font-weight:700;color:rgba(255,255,255,.28)}
.chat-bubble{padding:7px 10px;border-radius:10px;font-size:12px;line-height:1.55;word-break:break-word}
.bubble-o{background:rgba(255,255,255,.07);color:#fff;border-radius:3px 10px 10px 10px;border:1px solid rgba(255,255,255,.08)}
.bubble-own{background:var(--grad);color:#fff;border-radius:10px 3px 10px 10px}
.chat-time{font-size:9px;color:rgba(255,255,255,.2)}
.chat-empty{text-align:center;color:rgba(255,255,255,.2);font-size:12px;padding:22px 10px;line-height:1.7}
.chat-ia{padding:8px;border-top:1px solid rgba(255,255,255,.07);flex-shrink:0;display:flex;gap:6px;align-items:flex-end}
.chat-inp{flex:1;padding:7px 10px;border-radius:9px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:12px;outline:none;resize:none;min-height:34px;max-height:78px;transition:border .15s;font-family:var(--font)}
.chat-inp:focus{border-color:var(--ind)}
.chat-inp::placeholder{color:rgba(255,255,255,.2)}
.chat-inp:disabled{opacity:.4;cursor:not-allowed}
.chat-send{width:32px;height:32px;border-radius:8px;background:var(--grad);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.18s;font-size:13px}
.chat-send:hover{transform:scale(1.12)}
.chat-send:disabled{opacity:.4;cursor:not-allowed}
.dp-wrap{padding:9px;display:flex;flex-direction:column;gap:7px}
.score-card{background:linear-gradient(135deg,rgba(99,102,241,.18),rgba(139,92,246,.1));border:1px solid rgba(99,102,241,.26);border-radius:12px;padding:12px}
.sc-title{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:rgba(255,255,255,.35);margin-bottom:8px}
.sc-row{display:flex;align-items:center;gap:8px}
.sc-item{flex:1;text-align:center}
.sc-val{font-size:25px;font-weight:900}
.sc-u{color:var(--sky)}.sc-a{color:var(--vio)}
.sc-lbl{font-size:10px;color:rgba(255,255,255,.35);margin-top:2px}
.sc-vs{font-size:13px;font-weight:900;color:rgba(255,255,255,.22)}
.sc-bar{height:4px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:7px}
.sc-fill{height:100%;border-radius:3px;background:linear-gradient(90deg,var(--sky),var(--ind),var(--vio));transition:width .8s ease}
.phase-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:11px;padding:10px 12px}
.ph-step{display:flex;align-items:center;gap:7px;padding:6px;border-radius:7px;font-size:11.5px;transition:.18s;margin-bottom:1px}
.ph-step.act{background:rgba(99,102,241,.12)}
.ph-num{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0}
.ph-done{background:var(--em);color:#fff}.ph-act{background:var(--ind);color:#fff}.ph-pend{background:rgba(255,255,255,.08);color:rgba(255,255,255,.25)}
.ph-lbl{font-weight:700;color:rgba(255,255,255,.4);font-size:11px}
.ph-step.act .ph-lbl{color:#fff}
.turn-box{background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:11px;padding:11px 13px}
.turn-label{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:rgba(255,255,255,.35);margin-bottom:7px}
.turn-ind{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;border:1px solid}
.turn-ind.your{background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.3)}
.turn-ind.ai{background:rgba(139,92,246,.12);border-color:rgba(139,92,246,.3);animation:turnBlink 1.5s infinite}
.turn-dot{width:9px;height:9px;border-radius:50%;animation:pulse 1.5s infinite}
.turn-name{font-size:12.5px;font-weight:700;color:#fff}
.turn-hint{font-size:10.5px;color:rgba(255,255,255,.42);margin-top:1px}
.analysis-bg{position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(14px);z-index:800;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .22s ease}
.analysis-box{background:#0c1220;border:1px solid rgba(99,102,241,.24);border-radius:var(--r);width:100%;max-width:650px;max-height:88dvh;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--sh3);animation:modalUp .3s ease}
.analysis-head{padding:16px 20px 13px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;display:flex;align-items:center;justify-content:space-between}
.analysis-title{font-size:15.5px;font-weight:800;color:#fff}
.analysis-body{overflow-y:auto;flex:1;padding:18px 20px}
.a-sec{margin-bottom:16px;animation:fadeUp .4s ease both}
.a-sec-title{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.32);margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid rgba(255,255,255,.07)}
.score-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:7px}
.score-box{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:11px;padding:11px;text-align:center}
.score-box-val{font-size:23px;font-weight:900;margin-bottom:3px}
.score-box-lbl{font-size:10px;color:rgba(255,255,255,.38);font-weight:600}
.prog-wrap{margin-bottom:5px}
.prog-label{display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,.45);font-weight:600;margin-bottom:3px}
.prog-track{height:5px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden}
.prog-fill{height:100%;border-radius:4px;transition:width 1.1s ease}
.verdict-box{padding:13px 15px;border-radius:12px;border:1.5px solid;text-align:center}
.verdict-win{font-size:21px;font-weight:900;margin-bottom:3px}
.verdict-lbl{font-size:11.5px;font-weight:700;opacity:.6}
.analysis-foot{padding:12px 20px;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0;display:flex;justify-content:flex-end;gap:8px}
.results-page{height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(20px,4vw,52px);text-align:center;overflow-y:auto;background:radial-gradient(ellipse at 50% 25%,rgba(99,102,241,.07) 0%,transparent 65%)}
.res-trophy{font-size:62px;margin-bottom:12px;animation:scaleIn .6s cubic-bezier(.34,1.56,.64,1) .2s both}
.res-title{font-size:clamp(20px,3.2vw,34px);font-weight:900;letter-spacing:-.6px;margin-bottom:6px;color:var(--t1)}
.res-sub{font-size:13px;color:var(--t2);max-width:340px;line-height:1.75;margin-bottom:18px}
.res-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;max-width:340px;margin-bottom:16px}
.res-stat{background:var(--surf);border:1px solid var(--bdr);border-radius:14px;padding:12px 10px;box-shadow:var(--sh);animation:fadeUp .4s ease both;text-align:center;transition:all .25s}
.res-stat:hover{transform:translateY(-4px);box-shadow:0 10px 28px rgba(99,102,241,.12)}
.res-stat-ico{font-size:19px;margin-bottom:4px}
.res-stat-val{font-size:clamp(16px,2.2vw,24px);font-weight:900;color:var(--ind)}
.res-stat-lbl{font-size:10px;color:var(--t3);margin-top:2px}
.res-verdict{width:100%;max-width:760px;display:grid;grid-template-columns:1.2fr .8fr;gap:12px;margin-bottom:18px;text-align:left}
.res-panel{background:var(--surf);border:1px solid var(--bdr);border-radius:18px;padding:18px;box-shadow:var(--sh)}
.res-panel-title{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--t3);margin-bottom:10px}
.res-winner-name{font-size:24px;font-weight:900;color:var(--t1);margin-bottom:4px}
.res-winner-sub{font-size:13px;line-height:1.6;color:var(--t2)}
.res-rank{display:flex;flex-direction:column;gap:10px}
.res-rank-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 13px;border-radius:14px;background:var(--surf2);border:1px solid var(--bdr)}
.res-rank-name{font-size:13px;font-weight:800;color:var(--t1)}
.res-rank-role{font-size:11px;color:var(--t3);margin-top:2px}
.res-rank-score{font-size:18px;font-weight:900;color:var(--ind)}
.res-insights{width:100%;max-width:760px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px}
.res-insight{background:var(--surf);border:1px solid var(--bdr);border-radius:16px;padding:14px;text-align:left;box-shadow:var(--sh)}
.res-insight-title{font-size:11px;font-weight:800;color:var(--ind);margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em}
.res-insight-text{font-size:12.5px;line-height:1.65;color:var(--t2)}
.res-actions{display:flex;gap:9px;flex-wrap:wrap;justify-content:center}

@media(max-width:1100px){.dp-setup{grid-template-columns:35% 1fr}}
@media(max-width:900px){
  .dp-setup{grid-template-columns:1fr;overflow-y:auto;height:auto;min-height:100dvh}
  .dp-setup-left{min-height:200px;max-height:260px}
  .dp-setup-left-inner{justify-content:flex-start}
  .dp-feats-left{display:none}
  .ctx-card{display:none}
}
@media(max-width:768px){
  .submode-grid,.dtype-grid{grid-template-columns:1fr}
  .room-body{flex-direction:column}
  .room-info-grid{grid-template-columns:1fr;gap:8px;padding:8px}
  .room-info-card{min-height:auto;padding:10px 12px}
  .host-popup-btn{width:100%;justify-content:center}
  .host-popup-panel{left:0;right:0;width:auto}
  .vid-grid{padding:8px;gap:8px}
  .team-stage{padding:8px}
  .team-vs-grid{grid-template-columns:1fr}
  .team-member-grid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr));grid-auto-rows:minmax(160px,auto)}
  .team-member-grid .tile{min-height:160px}
  .moderator-row{grid-template-columns:1fr}
  .tile{min-height:180px}
  .ctrl-bar{padding:8px}.cg{gap:2px;justify-content:center}
  .cbtn{padding:5px 6px;min-width:38px;font-size:8.5px}
  .side-panel{width:100%;min-width:100%;max-height:42dvh;border-left:none;border-top:1px solid rgba(255,255,255,.07)}.rbar-topic{display:none}
  .fi-row{grid-template-columns:1fr}
  .analysis-bg{align-items:flex-end;padding:0}.analysis-box{border-radius:16px 16px 0 0;max-height:92dvh}
  .overlay{align-items:flex-end;padding:0}.modal{border-radius:16px 16px 0 0;max-height:90dvh}
  .vg-3,.vg-4{grid-template-columns:1fr 1fr}
  .res-verdict,.res-insights{grid-template-columns:1fr}
}
@media(max-width:560px){.cbtn span:last-child{display:none}.cbtn{min-width:32px}.tile{min-height:160px}.team-member-grid{grid-template-columns:1fr}.res-actions{flex-direction:column;align-items:stretch}}
`;

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#38bdf8",
  "#ec4899",
  "#8b5cf6",
  "#f97316",
  "#06b6d4",
];
const PHASES = [
  "Opening Statements",
  "Cross-Examination",
  "Rebuttal Round",
  "Closing Arguments",
];
const REACTIONS = ["👍", "👏", "❤️", "😂", "🔥", "🤔", "🎓", "✨"];
const MANDATORY_SPEAK_SECONDS = 10; // must speak for at least 10s before mute is allowed

const SUBJECT_UNITS: Record<string, string[]> = {
  "Computer Science": [
    "Data Structures",
    "Algorithms",
    "Operating Systems",
    "Networks",
    "Databases",
    "AI & ML",
    "Web Development",
    "Cybersecurity",
    "Other",
  ],
  Mathematics: [
    "Calculus",
    "Linear Algebra",
    "Statistics",
    "Number Theory",
    "Discrete Math",
    "Probability",
    "Geometry",
    "Other",
  ],
  Biology: [
    "Cell Biology",
    "Genetics",
    "Ecology",
    "Evolution",
    "Physiology",
    "Microbiology",
    "Biochemistry",
    "Other",
  ],
  Physics: [
    "Mechanics",
    "Thermodynamics",
    "Electromagnetism",
    "Quantum Physics",
    "Optics",
    "Relativity",
    "Other",
  ],
  Chemistry: [
    "Organic Chemistry",
    "Inorganic Chemistry",
    "Physical Chemistry",
    "Analytical Chemistry",
    "Biochemistry",
    "Other",
  ],
  History: [
    "Ancient History",
    "Medieval History",
    "Modern History",
    "World Wars",
    "Cold War",
    "Economic History",
    "Other",
  ],
  Literature: [
    "Poetry",
    "Fiction",
    "Drama",
    "Non-Fiction",
    "Literary Theory",
    "Comparative Lit",
    "Other",
  ],
  Economics: [
    "Microeconomics",
    "Macroeconomics",
    "Development Economics",
    "International Trade",
    "Behavioral Econ",
    "Other",
  ],
  Philosophy: [
    "Ethics",
    "Logic",
    "Metaphysics",
    "Epistemology",
    "Political Philosophy",
    "Philosophy of Mind",
    "Other",
  ],
  Psychology: [
    "Cognitive Psychology",
    "Social Psychology",
    "Developmental Psych",
    "Clinical Psychology",
    "Neuroscience",
    "Other",
  ],
  Law: [
    "Constitutional Law",
    "Criminal Law",
    "Contract Law",
    "International Law",
    "Tort Law",
    "Other",
  ],
  Business: [
    "Marketing",
    "Finance",
    "Strategy",
    "Operations",
    "Entrepreneurship",
    "HR Management",
    "Other",
  ],
  Medicine: [
    "Anatomy",
    "Pharmacology",
    "Pathology",
    "Clinical Skills",
    "Public Health",
    "Other",
  ],
  Engineering: [
    "Mechanical Eng",
    "Electrical Eng",
    "Civil Eng",
    "Chemical Eng",
    "Aerospace Eng",
    "Other",
  ],
  Arts: [
    "Fine Arts",
    "Design",
    "Music Theory",
    "Film Studies",
    "Architecture",
    "Other",
  ],
};
const SUBJECTS = Object.keys(SUBJECT_UNITS);

const TOPICS = [
  "AI will replace most human jobs within 20 years",
  "Social media does more harm than good",
  "Nuclear energy is essential for climate change",
  "Universal basic income should be implemented",
  "Space exploration is worth the investment",
  "Animal testing should be banned",
  "Coding should be mandatory in all schools",
  "Democracy is the best form of government",
];

const AI_LINES = [
  "That claim lacks empirical support. The data says otherwise.",
  "You are conflating correlation with causation here.",
  "Strong framing, but the systemic implications are being ignored.",
  "Can you substantiate that with concrete evidence?",
  "That premise is false. Here is precisely why it breaks down.",
  "I concede that point, but your core conclusion still fails.",
  "History provides direct counter-examples to that assertion.",
  "Even granting your premise, the conclusion does not follow.",
  "That view has been thoroughly challenged in recent literature.",
  "You are presenting a false dilemma. There is a third option.",
];

const AI_MULTI_LINES = [
  "Excellent point. Let us hear another perspective.",
  "Building on that — consider the ethical angle here.",
  "Fascinating. Can someone offer a counter argument?",
  "That touches a key tension. Who wants to unpack it?",
  "Would anyone like to challenge or extend this?",
];

const avColor = (n: string) => COLORS[(n || "U").charCodeAt(0) % COLORS.length];
const avInit = (n: string) =>
  (n || "U")
    .split(/[_\s]/)
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const genRoomId = () => Math.random().toString(36).slice(2, 12);
const genRoomLink = (id: string) =>
  `${window.location.origin}/debatePage/join?room=${encodeURIComponent(id)}`;
const COMMUNITY_SESSIONS_KEY = "gradeup_community_sessions_v1";

function publishCommunitySession(session: any) {
  try {
    const prev = JSON.parse(
      localStorage.getItem(COMMUNITY_SESSIONS_KEY) || "[]",
    );
    const next = [
      session,
      ...prev.filter((s: any) => s.id !== session.id),
    ].slice(0, 20);
    localStorage.setItem(COMMUNITY_SESSIONS_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new StorageEvent("storage", { key: COMMUNITY_SESSIONS_KEY }),
    );
  } catch {}
}
const MULTI_REACTIONS = [
  "👏",
  "🔥",
  "💡",
  "🙌",
  "🎯",
  "⚡",
  "🚀",
  "🏆",
  "🧠",
  "💯",
  "📣",
  "🌟",
];
const DUMMY_STUDENTS = [
  "Aarav Shah",
  "Diya Kapoor",
  "Rohan Iyer",
  "Meera Nair",
  "Kabir Singh",
  "Anaya Das",
  "Vivaan Patel",
  "Ishita Rao",
  "Arjun Menon",
  "Sara Khan",
  "Neel Joshi",
  "Tara Mehta",
];
const randomPick = <T,>(arr: T[]) =>
  arr[Math.floor(Math.random() * arr.length)];
const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmtClock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function useTimer(running: boolean) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    console.log("[TURN] timer started", { running, elapsedSeconds });
    const id = setInterval(() => {
      setElapsedSeconds((x) => {
        const next = x + 1;
        console.log("[TURN] timer tick", { elapsedSeconds: next });
        return next;
      });
    }, 1000);
    return () => {
      console.log("[CLEANUP] timer stopped", { running, elapsedSeconds });
      clearInterval(id);
    };
  }, [running]);
  return { elapsedSeconds, label: fmtClock(elapsedSeconds) };
}

function useMicPerm() {
  const [state, setState] = useState<
    "idle" | "requesting" | "granted" | "denied"
  >("idle");
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [, bumpStreamVersion] = useReducer((value: number) => value + 1, 0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const lastMicLevelLogRef = useRef(0);

  const logEarlyReturn = useCallback(
    (functionName: string, reason: string, values: Record<string, unknown> = {}) => {
      debateDebug("[EARLY_RETURN]", {
        functionName,
        reason,
        values,
      });
    },
    [],
  );

  useEffect(() => {
    streamRef.current = localStream;
    debateDebug("[STREAM] mic stream ref updated", {
      hasStream: Boolean(localStream),
      trackCount: localStream?.getTracks?.().length || 0,
    });
  }, [localStream]);

  useEffect(() => {
    const now = Date.now();
    if (now - lastMicLevelLogRef.current < 2500) return;
    lastMicLevelLogRef.current = now;
    debateDebug("[MIC_LEVEL]", {
      level: micLevel,
      speakingDetected: micLevel > 5,
    });
  }, [micLevel]);

const cleanupAnalysis = useCallback(() => {
    debateDebug("[CLEANUP] mic analysis cleanup", {});
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    analyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => null);
      audioContextRef.current = null;
    }
}, []);
const stop = useCallback((silent = false) => {
    debateDebug("[MIC] stop requested", {
      hasStream: Boolean(streamRef.current),
      silent,
    });
    if (streamRef.current) {
      debateDebug("[STREAM] stream stopped", {
        streamId: streamRef.current.id || null,
        tracks: streamRef.current.getTracks().length,
        audioTracks: streamRef.current.getAudioTracks().length,
      });
    }
    cleanupAnalysis();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (!silent) {
      setLocalStream(null);
      setState("idle");
      setError(null);
      bumpStreamVersion();
    }
 }, [cleanupAnalysis]);

  const audioTrack = localStream?.getAudioTracks?.()[0] || null;
  const micGranted = Boolean(localStream);
  const micLive = audioTrack?.readyState === "live";
  const micEnabled = Boolean(audioTrack?.enabled);
  const canProceed = micGranted && micLive && micEnabled;

  useEffect(() => {
    debateDebug("[MIC_PERMISSION] state", { state });
    debateDebug("[MIC] canProceed", { canProceed });
    if (audioTrack) {
      debateDebug("[MIC] Track state", {
        readyState: audioTrack.readyState,
        enabled: audioTrack.enabled,
      });
    }
  }, [state, canProceed, audioTrack]);

  const request = useCallback(async () => {
    setError(null);
    try {
      const permissionState = null;
      debateDebug("[MIC_PERMISSION] navigator.permissions state", {
        permissionState,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
      });
      debateDebug("[MIC_PERMISSION] request started", {
        permissionState,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
      });
      debateDebug("[MIC] request started", {
        permissionState,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
      });
      if (!navigator.mediaDevices?.getUserMedia) {
        logEarlyReturn("request", "no_get_userMedia", {
          permissionState,
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
        });
        debateDebug("[MIC_PERMISSION] request failed", {
          permissionState,
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
          reason: "no_get_userMedia",
        });
        throw new Error("Microphone access is not supported in this browser.");
      }

      // Check permission state first — but ONLY on https (not localhost http).
      // On localhost, permissions.query can return wrong state; getUserMedia itself
      // triggers the native prompt correctly, so we skip the check there.
      const isLocalhost = /^localhost$|^127\./.test(window.location.hostname);
      if (!isLocalhost && navigator.permissions) {
        try {
          const permStatus = await navigator.permissions.query({ name: "microphone" as PermissionName });
          debateDebug("[MIC_PERMISSION] navigator.permissions state", {
            permissionState: permStatus.state,
            hasMediaDevices: !!navigator.mediaDevices,
            hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
          });
          if (permStatus.state === "denied") {
            setState("denied");
            setError("PERMISSION_DENIED");
            debateDebug("[MIC_PERMISSION] request failed", {
              permissionState: permStatus.state,
              hasMediaDevices: !!navigator.mediaDevices,
              hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
              reason: "permission_denied",
            });
            return null;
          }
        } catch {
          // permissions.query not supported — fall through to getUserMedia
        }
      }

      stop();
      setState("requesting");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      debateDebug("[MIC] request success", {
        permissionState,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
      });
      debateDebug("[STREAM] stream created", {
        streamId: stream.id,
        tracks: stream.getTracks().length,
        audioTracks: stream.getAudioTracks().length,
      });
      const audioTrack = stream.getAudioTracks?.()[0] || null;
      if (!audioTrack) {
        logEarlyReturn("request", "no_audio_track", {
          permissionState,
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
        });
        debateDebug("[MIC_PERMISSION] request failed", {
          permissionState,
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
          reason: "no_audio_track",
        });
        throw new Error("No audio track was returned from the browser.");
      }
      debateDebug("[STREAM] audio track", {
        trackId: audioTrack.id,
        enabled: audioTrack.enabled,
        muted: audioTrack.muted,
        readyState: audioTrack.readyState,
        label: audioTrack.label,
      });
      if (audioTrack.readyState !== "live") {
        logEarlyReturn("request", "track_not_live", {
          readyState: audioTrack.readyState,
        });
        debateDebug("[MIC_PERMISSION] request failed", {
          permissionState,
          hasMediaDevices: !!navigator.mediaDevices,
          hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
          reason: "track_not_live",
        });
        throw new Error("Microphone track is not live.");
      }
      if (!audioTrack.enabled) {
        audioTrack.enabled = true;
      }
      audioTrack.addEventListener("mute", () => {
        debateDebug("[STREAM] track muted", {
          readyState: audioTrack.readyState,
          enabled: audioTrack.enabled,
        });
      });
      audioTrack.addEventListener("unmute", () => {
        debateDebug("[STREAM] track unmuted", {
          readyState: audioTrack.readyState,
          enabled: audioTrack.enabled,
        });
      });
      audioTrack.addEventListener("ended", () => {
        debateDebug("[STREAM] track ended", {
          readyState: audioTrack.readyState,
          enabled: audioTrack.enabled,
        });
      });

      try {
        const ctx = new AudioContext();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyserRef.current = analyser;
        audioContextRef.current = ctx;
        const tick = () => {
          const currentAnalyser = analyserRef.current;
          if (!currentAnalyser) return;
          const arr = new Uint8Array(currentAnalyser.frequencyBinCount);
          currentAnalyser.getByteFrequencyData(arr);
          const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
          setMicLevel(Math.min(100, (avg / 128) * 100));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {}

      setLocalStream(stream);
      setState("granted");
      bumpStreamVersion();
      debateDebug("[MIC] canProceed", {
        canProceed: Boolean(stream && audioTrack.readyState === "live" && audioTrack.enabled),
      });
      debateDebug("[MIC_PERMISSION] request success", {
        permissionState,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
      });
      return stream;
    } catch (err: any) {
      debateDebug("[MIC] request failed", {
        permissionState: null,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
        name: err?.name || null,
        message: err?.message || String(err),
      });
      debateDebug("[MIC_PERMISSION] request failed", {
        permissionState: null,
        hasMediaDevices: !!navigator.mediaDevices,
        hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
        name: err?.name || null,
        message: err?.message || String(err),
      });
      stop();
      setState("denied");
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        // Blocked mid-flow (e.g. user dismissed the native popup)
        setError("PERMISSION_DENIED");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("No microphone found. Please connect a microphone and click Retry.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setError("Microphone is in use by another app. Close other apps using the mic and click Retry.");
      } else {
        setError(err?.message || "Microphone access was denied.");
      }
      return null;
    }
 }, [stop]);

 const setMicEnabled = useCallback((next: boolean) => {
    const track = streamRef.current?.getAudioTracks?.()[0] || null;
    if (track) {
      track.enabled = next;
    }
    debateDebug("[MIC] track enabled toggled", {
      next,
      readyState: track?.readyState || null,
    });
    bumpStreamVersion();
 }, []);

  useEffect(() => {
    const track = localStream?.getAudioTracks?.()[0] || null;
    if (!track) {
      return;
    }

    const syncTrackState = (refresh = true) => {
      if (refresh) {
        bumpStreamVersion();
      }
      setState(track.readyState === "live" ? "granted" : "denied");
    };

    syncTrackState(false);
    debateDebug("[STREAM] mic track listeners attached", {
      readyState: track.readyState,
      enabled: track.enabled,
    });
    track.addEventListener("ended", syncTrackState);
    track.addEventListener("mute", syncTrackState);
    track.addEventListener("unmute", syncTrackState);
    return () => {
      debateDebug("[STREAM] mic track listeners cleanup", {
        readyState: track.readyState,
        enabled: track.enabled,
      });
      track.removeEventListener("ended", syncTrackState);
      track.removeEventListener("mute", syncTrackState);
      track.removeEventListener("unmute", syncTrackState);
    };
  }, [localStream]);

  useEffect(() => {
    return () => {
      debateDebug("[CLEANUP] mic hook unmount", {});
      cleanupAnalysis();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return {
    state,
    stream: localStream,
    localStream,
    micGranted,
    micEnabled,
    canProceed,
    micLevel,
    error,
    request,
    stop,
    setMicEnabled,
  };
}

function useRecorder() {
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  async function start(audio?: MediaStream | null) {
    try {
      console.log("[STREAM] recorder start requested", {
        hasAudioStream: Boolean(audio),
      });
      const ds = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
      });
      console.log("[STREAM] display stream created", {
        videoTracks: ds.getVideoTracks().length,
        audioTracks: ds.getAudioTracks().length,
      });
      const tracks = [...ds.getTracks()];
      if (audio instanceof MediaStream)
        audio.getAudioTracks().forEach((t: MediaStreamTrack) => tracks.push(t));
      const combined = new MediaStream(tracks);
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const mr = new MediaRecorder(combined, { mimeType: mime });
      console.log("[TRANSCRIBE] recorder created", {
        mime,
        trackCount: combined.getTracks().length,
      });
      chunks.current = [];
      mr.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      mr.onstop = () => {
        console.log("[TRANSCRIBE] recorder stopped", {
          chunkCount: chunks.current.length,
        });
        setBlob(new Blob(chunks.current, { type: mime }));
        combined.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      };
      ds.getVideoTracks()[0].addEventListener("ended", () => {
        console.log("[STREAM] display stream ended");
        stop();
      });
      mr.start(1000);
      console.log("[TRANSCRIBE] recorder started");
      mrRef.current = mr;
      setIsRecording(true);
      return true;
    } catch {
      console.log("[TRANSCRIBE] recorder start failed");
      return false;
    }
  }
  function stop() {
    console.log("[TRANSCRIBE] recorder stop requested", {
      state: mrRef.current?.state || null,
    });
    if (mrRef.current?.state !== "inactive") mrRef.current?.stop();
    setIsRecording(false);
  }
  function download(fname = "debate.webm") {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = fname;
    a.click();
    URL.revokeObjectURL(u);
  }
  return { isRecording, blob, start, stop, download };
}

// ─── SINGLETON VOICE ENGINE ───────────────────────────────────────────────────
const voiceEngine = (() => {
  let currentId = "";
  let speaking = false;
  let cancelled = false;
  let voiceRef: SpeechSynthesisVoice | null = null;
  let runToken = 0;
  let lastTextKey = "";
  let lastTextAt = 0;

  function pickVoice() {
    const voices = window.speechSynthesis?.getVoices() || [];
    const preferred = [
      "Microsoft Aria Online (Natural)",
      "Microsoft Jenny Online (Natural)",
      "Microsoft Guy Online (Natural)",
      "Google US English",
      "Google UK English Female",
      "Google UK English Male",
      "Samantha",
      "Karen",
      "Moira",
      "Daniel",
      "Alex",
    ];
    voiceRef =
      preferred
        .map((name) => voices.find((v) => v.name.includes(name)))
        .find(Boolean) ||
      voices.find((v) => /en[-_](us)/i.test(v.lang)) ||
      voices.find((v) => /en[-_](gb|au|in)/i.test(v.lang)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      voices[0] ||
      null;
    console.log("[DebatePage][VoiceEngine] voice picked", {
      voice: voiceRef?.name || null,
      lang: voiceRef?.lang || null,
      totalVoices: voices.length,
    });
  }

  if (typeof window !== "undefined") {
    window.speechSynthesis?.addEventListener("voiceschanged", pickVoice);
    pickVoice();
  }

  function speak(
    text: string,
    id: string,
    opts: { pitch?: number; rate?: number },
    onStart?: () => void,
    onDone?: () => void,
  ) {
    if (!("speechSynthesis" in window)) {
      onDone?.();
      return;
    }
    console.log("[SPEECH] speak API trigger", {
      id,
      textLength: text.length,
    });
    const textKey = text.replace(/\s+/g, " ").trim().toLowerCase();
    const now = Date.now();
    if (
      (currentId === id && speaking) ||
      (textKey && textKey === lastTextKey && now - lastTextAt < 2500)
    )
      return;
    lastTextKey = textKey;
    lastTextAt = now;
    const token = ++runToken;
    cancelled = false;
    currentId = id;
    console.log("[DebatePage][VoiceEngine] speak requested", {
      id,
      textLength: text.length,
      voice: voiceRef?.name || null,
      lang: voiceRef?.lang || null,
    });
    window.speechSynthesis.cancel();
    function finish() {
      if (token !== runToken) return;
      speaking = false;
      console.log("[SPEECH] speech stop", {
        id,
        cancelled,
        token,
      });
      console.log("[DebatePage][VoiceEngine] speak finished", {
        id,
        cancelled,
        token,
      });
      if (!cancelled) onDone?.();
    }
    function start() {
      if (cancelled || token !== runToken) return;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts.rate ?? 0.92;
      u.pitch = opts.pitch ?? 1.0;
      u.volume = 1;
      u.lang = voiceRef?.lang || "en-US";
      if (voiceRef) u.voice = voiceRef;
      u.onstart = () => {
        if (!cancelled) {
          speaking = true;
          console.log("[SPEECH] speech start", {
            id,
            voice: u.voice?.name || null,
            lang: u.lang,
          });
          console.log("[DebatePage][VoiceEngine] speak started", {
            id,
            voice: u.voice?.name || null,
            lang: u.lang,
          });
          onStart?.();
        }
      };
      u.onend = finish;
      u.onerror = (e: SpeechSynthesisErrorEvent) => {
        console.warn("[DebatePage][VoiceEngine] speak error", {
          id,
          error: e.error,
          message: (e as any)?.message || null,
        });
        if (e.error === "interrupted" || e.error === "canceled") {
          speaking = false;
          return;
        }
        finish();
      };
      try {
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(u);
      } catch {
        console.warn("[DebatePage][VoiceEngine] speak threw synchronously", {
          id,
        });
        console.log("[SPEECH] speech error", {
          id,
          message: "speechSynthesis.speak threw synchronously",
        });
        finish();
      }
    }
    setTimeout(start, 180);
  }

  function cancel() {
    cancelled = true;
    speaking = false;
    currentId = "";
    runToken++;
    window.speechSynthesis?.cancel();
  }

  if (typeof window !== "undefined") {
    setInterval(() => {
      if (window.speechSynthesis && !window.speechSynthesis.speaking)
        window.speechSynthesis.resume();
    }, 10000);
  }

  return { speak, cancel };
})();

// ─── TOAST ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(
    null,
  );
  const show = (msg: string, type = "success") => setToast({ msg, type });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);
  const node = toast ? (
    <div className={`dp-toast ${toast.type}`} onClick={() => setToast(null)}>
      {toast.type === "success"
        ? "✅"
        : toast.type === "error"
          ? "❌"
          : toast.type === "warn"
            ? "⚠️"
            : "ℹ️"}{" "}
      {toast.msg}
    </div>
  ) : null;
  return { show, node };
}

// ─── MIC PERMISSION CARD (used in setup confirm modal) ───────────────────────
function MicPermCard({
  perm,
  stream,
  micLevel,
  micOn,
  onRequest,
  onToggle,
  error,
}: {
  perm: "idle" | "requesting" | "granted" | "denied";
  stream: MediaStream | null;
  micLevel: number;
  micOn: boolean;
  onRequest: () => void;
  onToggle: () => void;
  error?: string | null;
}) {
  const statusLabels = {
    idle: {
      label: "Microphone permission required",
      hint: "Click Allow Mic to grant access before joining",
    },
    requesting: {
      label: "Requesting microphone access…",
      hint: "Please allow access in your browser prompt",
    },
    granted: {
      label: "Microphone ready",
      hint: "Your mic is connected and ready for the debate",
    },
    denied: {
      label: "Microphone access blocked",
      hint: "Click the 🔒 lock in your address bar (desktop) or go to browser Settings → Site permissions → Microphone (mobile) to allow, then Retry",
    },
  };
  const { label, hint } = statusLabels[perm];

  return (
    <div className="mic-perm-card">
      <div className="mic-perm-header">
        <div className="mic-perm-icon">🎤</div>
        <div>
          <div className="mic-perm-title">Microphone Setup</div>
          <div className="mic-perm-sub">
            Required before entering the debate room
          </div>
        </div>
      </div>

      <div className={`mic-perm-status ${perm}`}>
        <div className="mic-perm-dot" />
        <div style={{ flex: 1 }}>
          <div className="mic-perm-label">{label}</div>
          <div className="mic-perm-hint">{hint}</div>
        </div>
        {perm === "idle" && (
          <button className="mic-perm-action allow" onClick={onRequest}>
            Allow Mic
          </button>
        )}
        {perm === "requesting" && (
          <button className="mic-perm-action allow" disabled>
            <span
              className="loader-spin"
              style={{ width: 14, height: 14, borderWidth: 2, marginRight: 4 }}
            />
            Waiting…
          </button>
        )}
        {perm === "denied" && (
          <button className="mic-perm-action retry" onClick={onRequest}>
            Retry
          </button>
        )}
      </div>

      {perm === "denied" && error === "PERMISSION_DENIED" && (
        <div className="mic-perm-warn">
          Your browser has blocked microphone access for this site.<br/><br/>
          🔒 <strong>Desktop:</strong> Click the lock icon in the address bar → Microphone → Allow → then click Retry.<br/>
          📱 <strong>Mobile (Chrome):</strong> Tap the lock icon in address bar → Permissions → Microphone → Allow → Retry.<br/>
          📱 <strong>Mobile (Safari):</strong> Go to Settings app → Safari → Camera & Microphone → Allow → Retry.
        </div>
      )}
      {perm === "denied" && error !== "PERMISSION_DENIED" && error && (
        <div className="mic-perm-warn">⚠️ {error}</div>
      )}

      {perm === "granted" && stream && (
        <>
          <div className="mic-level-row">
            <span className="mic-level-label">Mic level</span>
            <div className="mic-level-track">
              <div
                className="mic-level-fill"
                style={{ width: `${micLevel}%` }}
              />
            </div>
            <span
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,.4)",
                minWidth: 26,
                textAlign: "right" as const,
              }}
            >
              {Math.round(micLevel)}%
            </span>
          </div>
          <div className="mic-toggle-row">
            <span className="mic-toggle-label">
              {micOn
                ? "🎤 Mic is on — will be active in room"
                : "🔇 Mic is off — you'll join muted"}
            </span>
            <button
              className={`mic-toggle-btn ${micOn ? "on" : "off"}`}
              onClick={onToggle}
            >
              {micOn ? "On" : "Off"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MicPreview({ perm, name, onReq, micOn, onToggle }: any) {
  return (
    <div className="mic-preview">
      <div className="mic-av">{name ? name[0].toUpperCase() : "?"}</div>
      <div className="mic-info">
        <div className="mic-name">{name || "Your Name"}</div>
        <div className="mic-sub">🎙 Audio-only mode</div>
        <div className="perm-row">
          {perm === "idle" && (
            <button className="perm-btn req" onClick={onReq}>
              🎤 Allow Mic
            </button>
          )}
          {perm === "requesting" && (
            <button className="perm-btn req" disabled>
              <span
                className="loader-spin dark"
                style={{ width: 14, height: 14, borderWidth: 2 }}
              />
              Requesting…
            </button>
          )}
          {perm === "denied" && (
            <button className="perm-btn denied" onClick={onReq}>
              🔄 Retry
            </button>
          )}
          {perm === "granted" && (
            <>
              <button
                className={`perm-btn ${micOn ? "granted" : "denied"}`}
                onClick={onToggle}
              >
                {micOn ? "🎤 Mic On" : "🔇 Off"}
              </button>
              <span
                style={{
                  padding: "5px 10px",
                  borderRadius: 7,
                  background: "rgba(16,185,129,.08)",
                  border: "1px solid rgba(16,185,129,.2)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--em)",
                }}
              >
                ✓ Ready
              </span>
            </>
          )}
        </div>
        {perm === "denied" && (
          <div className="perm-warn">
            🔒 Desktop: click lock icon in address bar → allow Mic → Retry.<br/>
            📱 Mobile: browser Settings → Site permissions → Microphone → allow → Retry.
          </div>
        )}
      </div>
    </div>
  );
}

function StepsComp({ steps }: { steps: { label: string; done: boolean }[] }) {
  const st = (i: number) =>
    steps[i].done
      ? "done"
      : steps.slice(0, i).every((s) => s.done)
        ? "act"
        : "pend";
  return (
    <div className="steps">
      {steps.map((s, i) => (
        <div key={i} className={`step-row ${st(i)}`}>
          <div className="step-num">{s.done ? "✓" : i + 1}</div>
          <div className="step-lbl">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function DebateLoadingScreen({
  title,
  subtitle,
  progress,
}: {
  title: string;
  subtitle: string;
  progress?: number;
}) {
  return (
    <div className="debate-loader-screen">
      <div className="debate-loader-card">
        <div className="debate-loader-ring" />
        <div className="debate-loader-title">{title}</div>
        <div className="debate-loader-sub">{subtitle}</div>
        <div className="debate-loader-bar">
          <div
            className="debate-loader-fill"
            style={{ width: `${Math.max(8, Math.min(100, progress ?? 65))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

type Team = "A" | "B";

interface Participant {
  id: number;
  name: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  isHost?: boolean;
  isAI?: boolean;
  isMed?: boolean;
  isStudent?: boolean;
  micMuted: boolean;
  camOn: boolean;
  isSpeaking: boolean;
  handRaised: boolean;
  isMyTurn?: boolean;
  isAITyping?: boolean;
  avatarColor?: string;
  energy?: number;
  reactionsReceived?: number;
  turnsTaken?: number;
  // ── Team debate fields ──
  team?: Team;
  teamOrder?: number;
  hasSpoken?: boolean; // true after first completed speaking turn
}

function WaveBars({ color = "#10b981" }: { color?: string }) {
  return (
    <div className="tile-wave">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="tile-wave-bar"
          style={{ background: color, animationDelay: `${i * 0.11}s` }}
        />
      ))}
    </div>
  );
}

function Tile({
  p,
  reaction,
  nudge,
  countdown,
}: {
  p: Participant;
  reaction?: any;
  nudge?: string;
  countdown?: number | null;
}) {
  const vRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (vRef.current && p.stream instanceof MediaStream)
      vRef.current.srcObject = p.stream;
  }, [p.stream]);
  const color = p.avatarColor || avColor(p.name);

  // tile border class based on team
  const teamClass =
    p.team === "A" ? "team-a-tile" : p.team === "B" ? "team-b-tile" : "";
  const tileClass = `tile${p.isSpeaking ? " spk" : ""}${p.team ? " " + teamClass : ""}`;

  return (
    <div className={tileClass}>
      {p.stream instanceof MediaStream && p.camOn ? (
        <video ref={vRef} autoPlay playsInline muted={p.isLocal} />
      ) : (
        <div className="tile-av" style={{ background: color + "28", color }}>
          {p.isAI && !p.isMed ? "🤖" : p.isMed ? "🎙️" : avInit(p.name)}
        </div>
      )}
      {p.isSpeaking && (p.isAI || p.isMed) && (
        <div className="tile-wave">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="tile-wave-bar"
              style={{
                background: p.isMed ? "#38bdf8" : "#8b5cf6",
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}
      {p.isSpeaking && !p.isAI && !p.isMed && <WaveBars color="#10b981" />}

      {/* Countdown overlay — shown while mandatory window is active */}
      {countdown != null && countdown > 0 && (
        <div className="countdown-overlay">🔒 Mute unlocks in {countdown}s</div>
      )}

      {p.isMyTurn && !p.micMuted && countdown == null && (
        <div className="tile-turn">🎤 Speaking</div>
      )}
      {p.isMyTurn && p.micMuted && !p.isAI && !p.isMed && countdown == null && (
        <div
          className="tile-turn"
          style={{ background: "rgba(99,102,241,.88)" }}
        >
          🎙 Your Turn Soon
        </div>
      )}
      {p.isAITyping && (
        <div className="ai-typing-wrap">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="ai-dot"
              style={{ animationDelay: `${i * 0.22}s` }}
            />
          ))}
        </div>
      )}
      {nudge && <div className="tile-nudge">{nudge}</div>}
      {p.handRaised && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "rgba(245,166,35,.92)",
            borderRadius: 7,
            padding: "3px 8px",
            fontSize: 11,
            fontWeight: 800,
            color: "#000",
          }}
        >
          ✋
        </div>
      )}
      {reaction && (
        <div key={reaction.key} className="tile-react">
          {reaction.emoji}
        </div>
      )}
      <div className="tile-ov">
        <div className="tile-name">
          {p.name}
          {p.team === "A" && <span className="team-a-badge">Team A</span>}
          {p.team === "B" && <span className="team-b-badge">Team B</span>}
          {p.isHost && <span className="t-badge t-host">HOST</span>}
          {p.isAI && !p.isMed && <span className="t-badge t-ai">AI</span>}
          {p.isMed && <span className="t-badge t-med">MED</span>}
          {p.isLocal && !p.isHost && <span className="t-badge t-you">You</span>}
          {p.hasSpoken && !p.isMyTurn && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                padding: "2px 6px",
                borderRadius: 20,
                background: "rgba(255,255,255,.1)",
                color: "rgba(255,255,255,.5)",
              }}
            >
              Done
            </span>
          )}
          {p.isSpeaking && (p.isAI || p.isMed) && (
            <span className="voice-badge">
              <span className="voice-bars">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="voice-bar"
                    style={{
                      height: `${8 + i * 3}px`,
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </span>
              Speaking
            </span>
          )}
          {p.isSpeaking && !p.isAI && !p.isMed && !p.micMuted && (
            <span className="mic-badge">
              <span className="voice-bars">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="mic-bar"
                    style={{
                      height: `${8 + i * 3}px`,
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </span>
              Live
            </span>
          )}
        </div>
        {p.micMuted && <div className="tile-muted">🔇</div>}
      </div>
    </div>
  );
}

function createDummyStudents(startId = 10, count = 10): Participant[] {
  return shuffle(DUMMY_STUDENTS)
    .slice(0, count)
    .map((name, idx) => ({
      id: startId + idx,
      name,
      stream: null,
      isStudent: true,
      micMuted: true,
      camOn: false,
      isSpeaking: false,
      handRaised: Math.random() > 0.75,
      avatarColor: COLORS[(idx + 1) % COLORS.length],
      energy: 55 + Math.floor(Math.random() * 40),
      reactionsReceived: 0,
      turnsTaken: 0,
      hasSpoken: false,
      team: undefined,
    }));
}

// Assign teams: shuffle non-AI/non-med participants, split evenly into A and B
function assignTeams(participants: Participant[]): Participant[] {
  const humans = participants.filter((p) => !p.isAI && !p.isMed);
  const shuffled = shuffle(humans);
  const half = Math.ceil(shuffled.length / 2);
  const teamA = shuffled.slice(0, half);
  const teamB = shuffled.slice(half);
  const teamAOrder = new Map(teamA.map((p, idx) => [p.id, idx]));
  const teamBOrder = new Map(teamB.map((p, idx) => [p.id, idx]));
  return participants.map((p) => ({
    ...p,
    team: p.isAI || p.isMed ? undefined : teamAOrder.has(p.id) ? "A" : "B",
    teamOrder:
      p.isAI || p.isMed
        ? undefined
        : (teamAOrder.get(p.id) ?? teamBOrder.get(p.id) ?? 0),
  }));
}

function buildMultiVerdict(list: Participant[]) {
  const ranked = [...list]
    .filter((p) => !p.isAI && !p.isMed)
    .map((p) => ({
      ...p,
      debateScore:
        (p.turnsTaken || 0) * 6 +
        (p.reactionsReceived || 0) * 4 +
        Math.round((p.energy || 0) / 8),
    }))
    .sort((a, b) => (b.debateScore || 0) - (a.debateScore || 0));
  const winner = ranked[0] || null;
  const runnerUp = ranked[1] || null;

  // Team scores
  const teamAScore = ranked
    .filter((p) => p.team === "A")
    .reduce((s, p) => s + (p.debateScore || 0), 0);
  const teamBScore = ranked
    .filter((p) => p.team === "B")
    .reduce((s, p) => s + (p.debateScore || 0), 0);
  const winnerTeam: Team | null =
    teamAScore > teamBScore ? "A" : teamBScore > teamAScore ? "B" : null;

  const insights = winner
    ? [
        `${winner.name} (Team ${winner.team}) held the strongest audience response with ${winner.reactionsReceived || 0} reactions.`,
        `Team ${winnerTeam ?? "—"} scored ${winnerTeam === "A" ? teamAScore : teamBScore} pts vs Team ${winnerTeam === "A" ? "B" : "A"}'s ${winnerTeam === "A" ? teamBScore : teamAScore} pts.`,
        runnerUp
          ? `${runnerUp.name} (Team ${runnerUp.team}) was runner-up with ${runnerUp.debateScore} pts.`
          : "No runner-up available in this session.",
      ]
    : [];
  return {
    ranked,
    winner,
    runnerUp,
    insights,
    teamAScore,
    teamBScore,
    winnerTeam,
  };
}

// ─── SCHEDULE MODAL ──────────────────────────────────────────────────────────
function ScheduleDebateModal({ config, onSchedule, onClose }: any) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [saving, setSaving] = useState(false);
  async function handleSave() {
    if (!date) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 700));
    try {
      const ev = {
        id: `db-${Date.now()}`,
        title: config?.topic || "Debate",
        type: "debate",
        date,
        startTime: time,
        subject: config?.subject || "",
        unit: config?.unit || "",
        link: config?.roomLink || "",
      };
      const ex = JSON.parse(
        localStorage.getItem("gradeup_cal_events_v3") || "[]",
      );
      localStorage.setItem(
        "gradeup_cal_events_v3",
        JSON.stringify([...ex, ev]),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: "gradeup_cal_events_v3" }),
      );
      publishCommunitySession({
        id: ev.id,
        type: "debate",
        title: ev.title,
        subject: ev.subject,
        unit: ev.unit,
        date,
        time,
        link: ev.link,
        roles: ["Observer", "Participant"],
        createdAt: new Date().toISOString(),
      });
    } catch {}
    setSaving(false);
    onSchedule({ date, time });
  }
  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="mh">
          <span className="mh-title">📅 Schedule Debate</span>
          <button className="mh-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="mb">
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 11,
              background: "rgba(16,185,129,.06)",
              border: "1px solid rgba(16,185,129,.18)",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>📅</span>
            <div>
              <div
                style={{ fontSize: 11.5, fontWeight: 800, color: "var(--em)" }}
              >
                Auto-synced to Calendar
              </div>
              <div style={{ fontSize: 10.5, color: "var(--t2)" }}>
                Event saved automatically after scheduling
              </div>
            </div>
          </div>
          {config?.topic && (
            <div
              style={{
                padding: "9px 12px",
                borderRadius: 10,
                background: "rgba(99,102,241,.06)",
                border: "1px solid rgba(99,102,241,.18)",
                marginBottom: 14,
                fontSize: 12.5,
                fontWeight: 700,
                color: "var(--t1)",
              }}
            >
              ⚔️ "{config.topic}"
            </div>
          )}
          <div className="fi-row fi">
            <div>
              <label className="fl">Date *</label>
              <input
                className="finput"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="fl">Time</label>
              <input
                className="finput"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="mf">
          <button className="btn-s" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn-p"
            style={{ width: "auto", padding: "9px 22px" }}
            onClick={handleSave}
            disabled={!date || saving}
          >
            {saving ? (
              <>
                <span className="loader-spin" />
                Scheduling…
              </>
            ) : (
              "📅 Schedule & Save"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

const TEAM_COLORS: Record<Team, string> = {
  A: "#3b82f6",  // Blue — matches AI greeting "🔵 Blue Team"
  B: "#ef4444",  // Red  — matches AI greeting "🔴 Red Team"
};

function getTeamColor(team: Team | undefined) {
  return team === "B" ? TEAM_COLORS.B : TEAM_COLORS.A;
}

// Parse AI opening text to find who gets first turn.
// Looks for patterns like "Gokul, the floor is yours", "Blue Team, your turn",
// "I invite [Name]", etc. Returns { speakerId, team } or null if not found.
function extractFirstSpeakerFromGreeting(
  greetingText: string,
  participants: any[],
): { speakerId: string | null; team: "A" | "B" | null } {
  if (!greetingText || !participants.length) return { speakerId: null, team: null };
  const text = greetingText.toLowerCase();

  // Check for blue/red team mention first
  const mentionsBlue = text.includes("blue team") || text.includes("🔵");
  const mentionsRed = text.includes("red team") || text.includes("🔴");
  let firstTeam: "A" | "B" | null = null;

  // Detect who is invited to speak — common AI patterns
  const invitePatterns = [
    /i invite\s+([\w\s]+?)[,.]?\s*(the floor|your turn|to begin|to present|to start)/i,
    /([\w\s]+?),?\s+the floor is yours/i,
    /([\w\s]+?),?\s+you(?:'re| are) up first/i,
    /([\w\s]+?),?\s+please (?:begin|start|proceed)/i,
    /let(?:'s| us) begin with\s+([\w\s]+?)[\.,!]/i,
    /start(?:ing)? with\s+([\w\s]+?)[\.,!]/i,
  ];

  let mentionedName: string | null = null;
  for (const pattern of invitePatterns) {
    const match = greetingText.match(pattern);
    if (match) {
      mentionedName = (match[1] || match[2] || "").trim();
      break;
    }
  }

  // Try to match mentioned name to a participant
  if (mentionedName) {
    const nameLower = mentionedName.toLowerCase();
    const matched = participants.find(
      (p: any) => !p.isAi && p.name && p.name.toLowerCase().includes(nameLower),
    );
    if (matched) {
      return { speakerId: String(matched.id), team: matched.team || null };
    }
  }

  // Fall back to team colour mention
  if (mentionsBlue && !mentionsRed) firstTeam = "A";
  else if (mentionsRed && !mentionsBlue) firstTeam = "B";

  if (firstTeam) {
    const teamFirst = participants.find((p: any) => !p.isAi && p.team === firstTeam);
    return { speakerId: teamFirst ? String(teamFirst.id) : null, team: firstTeam };
  }

  return { speakerId: null, team: null };
}

function extractDebateScores(payload: any) {
  // API response shape: payload = full end API response (data field)
  // payload.liveSession.scores = { overall, student, ai }
  // payload.liveSession.feedback.scores = { reasoning, textbook_knowledge, argumentation, communication, total_score }
  // payload.liveSession.recommendations = { current_score, attempt_number, needs_retry, ... }

  const liveSession = payload?.liveSession || payload;
  const scoresObj = liveSession?.scores || payload?.scores || {};
  const feedbackObj = liveSession?.feedback || payload?.feedback || {};
  const feedbackScores = feedbackObj?.scores || {};
  const recommendations = liveSession?.recommendations || payload?.recommendations || {};

  const readNumeric = (value: any) => {
    const parsed = Number(
      value?.total_score ??
        value?.overallScore ??
        value?.overall_score ??
        value?.score ??
        value?.total ??
        value,
    );
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  // Overall score: liveSession.scores.overall OR feedback.scores.total_score
  const overall =
    readNumeric(scoresObj?.overall) ??
    readNumeric(feedbackScores?.total_score) ??
    readNumeric(recommendations?.current_score) ??
    null;

  // Student score: liveSession.scores.student OR feedback.scores.total_score
  const you =
    readNumeric(scoresObj?.student) ??
    readNumeric(feedbackScores?.total_score) ??
    overall;

  // AI score: liveSession.scores.ai
  const ai = readNumeric(scoresObj?.ai) ?? null;

  // Breakdown scores from feedback
  const breakdown = feedbackScores?.reasoning != null ? {
    reasoning: feedbackScores.reasoning,
    textbook_knowledge: feedbackScores.textbook_knowledge,
    argumentation: feedbackScores.argumentation,
    communication: feedbackScores.communication,
    total: feedbackScores.total_score,
  } : null;

  return {
    you,
    ai,
    overall,
    breakdown,
    recommendations,
    hasRealScores: you !== null || ai !== null || overall !== null,
  };
}

function playAudioDataUrl(
  dataUrl: string,
  onStart?: () => void,
  onDone?: () => void,
) {
  ttsDebug("[TTS] playAudioDataUrl called", {
    srcLength: dataUrl?.length || 0,
  });
  const audio = new Audio(dataUrl);
  ttsDebug("[TTS] audio created", {
    readyState: audio.readyState,
    paused: audio.paused,
    muted: audio.muted,
    currentTime: audio.currentTime,
  });
  audio.muted = false;
  audio.volume = 1;
  audio.preload = "auto";
  audio.playsInline = true;
  audio.addEventListener(
    "play",
    () => {
      ttsDebug("[TTS] play started");
      onStart?.();
    },
    { once: true },
  );
  audio.addEventListener(
    "ended",
    () => {
      ttsDebug("[TTS] play ended");
      onDone?.();
    },
    { once: true },
  );
  audio.addEventListener("error", (event) => {
    ttsDebug("[TTS] play error", {
      srcLength: dataUrl?.length || 0,
      error: event,
    });
    onDone?.();
  }, { once: true });
  const playResult = audio.play();
  ttsDebug("[TTS] audio.play() invoked", {
    paused: audio.paused,
    muted: audio.muted,
    currentTime: audio.currentTime,
  });
  if (playResult && typeof playResult.catch === "function") {
    playResult.catch((error) => {
      ttsDebug("[TTS] play error", {
        srcLength: dataUrl?.length || 0,
        name: error?.name,
        message: error?.message,
      });
      onDone?.();
    });
  }
  return audio;
}

function preloadAudioDataUrl(dataUrl: string) {
  return new Promise<HTMLAudioElement>((resolve, reject) => {
    const audio = new Audio(dataUrl);
    audio.preload = "auto";
    audio.playsInline = true;
    const timeoutMs = 1800;
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      cleanup();
      fn();
    };
    const cleanup = () => {
      audio.removeEventListener("loadeddata", handleReady);
      audio.removeEventListener("canplaythrough", handleReady);
      audio.removeEventListener("error", handleError);
    };
    const handleReady = () => {
      ttsDebug("[TTS] audio returned", {
        readyState: audio.readyState,
      });
      finish(() => resolve(audio));
    };
    const handleError = (event: Event) => {
      finish(() => reject(event));
    };
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      ttsDebug("[TTS] audio preload timeout", {
        readyState: audio.readyState,
      });
      finish(() => resolve(audio));
    }, timeoutMs);
    if (audio.readyState >= 3) {
      handleReady();
      return;
    }
    audio.addEventListener("loadeddata", handleReady, { once: true });
    audio.addEventListener("canplaythrough", handleReady, { once: true });
    audio.addEventListener("error", handleError, { once: true });
    try {
      audio.load();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function buildTeamDebateResult(
  apiResult: any,
  liveSession: any,
  config: any,
  elapsedTimer: string,
  debateLimit: string,
) {
  const scoreEntries = Object.entries(apiResult?.scores || {}).map(
    ([participantId, scoreData]: any) => ({
      participantId,
      score: Number(
        scoreData?.total_score ??
          scoreData?.score ??
          scoreData?.overall_score ??
          scoreData?.overallScore ??
          0,
      ),
      raw: scoreData,
    }),
  );
  const participants = liveSession?.participants || [];
  const participantScores = scoreEntries
    .map((entry) => {
      const participant = participants.find(
        (item: any) => String(item.id) === String(entry.participantId),
      );
      if (!participant || participant.isAi) return null;
      return {
        participantId: entry.participantId,
        name: participant.name || "Participant",
        team: participant.team || null,
        score: entry.score,
        isHost: Boolean(participant.isHost),
        isViewer: String(entry.participantId) === String(config.candidateId),
        breakdown: {
          reasoning: entry.raw?.reasoning ?? null,
          textbook_knowledge: entry.raw?.textbook_knowledge ?? null,
          argumentation: entry.raw?.argumentation ?? null,
          communication: entry.raw?.communication ?? null,
        },
        strengths: entry.raw?.strengths || [],
        improvements: entry.raw?.improvements || [],
        overall_feedback: entry.raw?.overall_feedback || entry.raw?.feedback || null,
        raw: entry.raw,
      };





    })
    .filter(Boolean)
    .sort(
      (left: any, right: any) =>
        Number(right.score || 0) - Number(left.score || 0),
    );
  const teamAScore = scoreEntries
    .filter(
      (entry) =>
        participants.find(
          (participant: any) =>
            String(participant.id) === String(entry.participantId),
        )?.team === "A",
    )
    .reduce((sum, entry) => sum + entry.score, 0);
  const teamBScore = scoreEntries
    .filter(
      (entry) =>
        participants.find(
          (participant: any) =>
            String(participant.id) === String(entry.participantId),
        )?.team === "B",
    )
    .reduce((sum, entry) => sum + entry.score, 0);
  const viewerScore =
    participantScores.find((entry: any) => entry.isViewer) || null;
  const winnerTeam =
    teamAScore === teamBScore ? null : teamAScore > teamBScore ? "A" : "B";
  const winner = participantScores[0] || null;
  const runnerUp = participantScores[1] || null;

  return {
    timer: elapsedTimer,
    debateLimit,
    mode: "debate",
    subMode: "multi",
    topic: config.topic,
    subject: config.subject,
    unit: config.unit,
    participants: participants.filter((participant: any) => !participant.isAi)
      .length,
    participantsList: participants,
    transcript: liveSession?.turns || [],
    feedback: apiResult || null,
    scores: {
      teamA: teamAScore,
      teamB: teamBScore,
      overall:
        Number(apiResult?.total_score ?? apiResult?.overallScore ?? apiResult?.overall_score ?? 0) ||
        null,
      participantScores,
      viewer: viewerScore,
      session_feedback: apiResult?.session_feedback || null,
      team_scores: apiResult?.team_scores || null,
    },
    meetingEnded: true,
    viewerCandidateId: config.candidateId || null,
    viewerCandidateName: config.name || null,
    verdict: {
      winnerTeam,
      winner: winner
        ? { name: winner.name, team: winner.team, debateScore: winner.score }
        : null,
      runnerUp: runnerUp
        ? {
            name: runnerUp.name,
            team: runnerUp.team,
            debateScore: runnerUp.score,
          }
        : null,
      teamAScore,
      teamBScore,
      insights: apiResult?.session_feedback ? [apiResult.session_feedback] : [],
    },
  };
}

function IntegratedDebateSetup({
  onBack,
  onLaunch,
}: {
  onBack?: () => void;
  onLaunch: (cfg: any) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(
    user ? `${user.firstName} ${user.lastName}` : "",
  );
  const [subMode, setSubMode] = useState<"ai" | "multi" | "">("");
  const [debateType, setDebateType] = useState<"instant" | "schedule" | "">("");
  const [participantCount, setParticipantCount] = useState("8");
  const [subjectCatalog, setSubjectCatalog] = useState<LibrarySubject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [unit, setUnit] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [topicOptions, setTopicOptions] = useState<any[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topic, setTopic] = useState("");
  const [custom, setCustom] = useState("");
  const [debateMinutes, setDebateMinutes] = useState("5");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledInfo, setScheduledInfo] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinProgress, setJoinProgress] = useState(0);
  const [joinLinkSessionId, setJoinLinkSessionId] = useState("");
  const joinRoomFromLinkRef = useRef<string>("");
  const roomId = useRef(genRoomId());
  const roomLink = genRoomLink(roomId.current);
  const setupRoomLink = joinRoomFromLinkRef.current
    ? genRoomLink(joinRoomFromLinkRef.current)
    : subMode === "multi"
      ? "Room link will be created when you launch the debate room."
      : "Room link is available for multi-user debates.";
  const {
    state: perm,
    stream,
    micLevel,
    request,
    stop,
    canProceed,
    micEnabled,
    setMicEnabled,
    error,
  } = useMicPerm();

  useEffect(() => {
    console.log("[ROOM] integrated debate setup mounted", {
      userId: user?.id || null,
      subMode,
      debateType,
      participantCount,
      joinLinkSessionId: joinLinkSessionId || null,
      hasJoinLink: Boolean(joinLinkSessionId),
    });
  }, [user?.id, subMode, debateType, participantCount, joinLinkSessionId]);
  const { show: toast$, node: toastNode } = useToast();
  const toastRef = useRef(toast$);
  const isJoinLinkMode = Boolean(joinLinkSessionId);
  const selectedTopicOption = topicOptions.find((item) => item.id === topic);
  const finalTopic =
    topic === "__custom__" ? custom : selectedTopicOption?.label || "";
  const selectedSubjectLabel =
    subjectCatalog.find((item) => item.subjectGroupKey === subject)?.title ||
    subject;
  const availableUnits = subject
    ? subjectCatalog.find((item) => item.subjectGroupKey === subject)?.units ||
      []
    : [];

  useEffect(() => {
    toastRef.current = toast$;
  }, [toast$]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedSessionId =
      params.get("sessionId") ||
      params.get("session") ||
      params.get("room") ||
      "";
    const linkedTopic = params.get("topic") || "";
    if (!linkedSessionId) return;
    joinRoomFromLinkRef.current = linkedSessionId;
    setJoinLinkSessionId(linkedSessionId);
    setSubMode("multi");
    setDebateType("instant");
    if (linkedTopic && !custom) {
      setCustom(linkedTopic);
      setTopic("__custom__");
    }
  }, [custom]);

  useEffect(() => {
    let ignore = false;
    async function loadSubjects() {
      setSubjectsLoading(true);
      try {
        const data = await getLibrarySubjects();
        if (!ignore) {
          setSubjectCatalog(data);
        }
      } catch {
        if (!ignore) {
          setSubjectCatalog([]);
          toastRef.current("Unable to load subjects for debate.", "warn");
        }
      } finally {
        if (!ignore) {
          setSubjectsLoading(false);
        }
      }
    }
    loadSubjects();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadTopics() {
      if (!subject) {
        setTopicOptions([]);
        setTopicsLoading(false);
        return;
      }
      setTopicsLoading(true);
      try {
        const topics = await getDebateTopics(subject);
        if (!ignore) {
          const liveTopics = (topics || [])
            .filter(
              (item: any) => !selectedUnitId || item.unitId === selectedUnitId,
            )
            .map((item: any, index: number) => ({
              id: String(item.id || `${item.unitId || "topic"}-${index}`),
              label: item.label || item.topic || item.title || item.name,
              unitId: item.unitId || "",
            }))
            .filter((item: any) => item.label);
          setTopicOptions(liveTopics);
        }
      } catch {
        if (!ignore) {
          setTopicOptions([]);
          toastRef.current(
            "Unable to load debate topics from the server.",
            "warn",
          );
        }
      } finally {
        if (!ignore) {
          setTopicsLoading(false);
        }
      }
    }
    loadTopics();
    return () => {
      ignore = true;
    };
  }, [selectedUnitId, subject]);

  const maxParticipants = Math.min(
    12,
    Math.max(2, Number(participantCount) || 8),
  );
  const participantCountValid =
    Number.isFinite(Number(participantCount)) &&
    maxParticipants >= 2 &&
    maxParticipants <= 12;
  const steps = [
    { label: "Enter your name", done: name.trim().length > 0 },
    { label: "Select subject", done: isJoinLinkMode || !!subject },
    { label: "Select unit", done: isJoinLinkMode || !!unit },
    { label: "Select topic", done: isJoinLinkMode || !!finalTopic },
    { label: "Choose debate type", done: !!subMode },
    ...(subMode === "multi"
      ? [{ label: "Set participant limit", done: participantCountValid }]
      : []),
    ...(subMode === "multi"
      ? [{ label: "Instant or schedule", done: !!debateType }]
      : []),
    ...(subMode === "multi"
      ? []
      : [{ label: "Set debate timer", done: !!debateMinutes }]),
  ];
  const canLaunch = steps.every((step) => step.done);
  const copyLink = () => {
    if (!joinRoomFromLinkRef.current) {
      toast$("Room link will be available after the room is created.", "info");
      return;
    }
    navigator.clipboard.writeText(genRoomLink(joinRoomFromLinkRef.current));
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const features = [
    {
      ico: "🤖",
      t: "AI Voice Opponent",
      d: "Real-time voice rebuttals & live scoring",
    },
    {
      ico: "📊",
      t: "Analysis Reports",
      d: "Full AI-generated feedback after each debate",
    },
    {
      ico: "📋",
      t: "Structured Turns",
      d: "Backend-controlled debate flow and room state",
    },
    {
      ico: "⏺",
      t: "Speech Support",
      d: "Node-backed TTS and transcription for debate turns",
    },
  ];

  async function handleJoin() {
    if (!canProceed) {
      toast$("Enable your microphone before launching the debate.", "warn");
      return;
    }
    setJoining(true);
    for (let progress = 0; progress <= 100; progress += 20) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      setJoinProgress(progress);
    }

    let liveSession: any = null;
    try {
      const candidate = getCandidateContext(
        user || { firstName: name, lastName: "" },
      );
      const candidateName = name.trim() || candidate.candidateName;

      if (subMode === "ai" && selectedUnitId) {
        liveSession = await startDebate({
          unitId: selectedUnitId,
          candidateId: candidate.candidateId,
          candidateName,
          topic: finalTopic,
          debateType: "1_vs_ai",
        });
      } else if (
        subMode === "multi" &&
        (selectedUnitId || joinRoomFromLinkRef.current)
      ) {
        if (joinRoomFromLinkRef.current) {
          liveSession = await joinDebateRoom({
            sessionId: joinRoomFromLinkRef.current,
            candidateId: candidate.candidateId,
            candidateName,
          });
        } else {
          liveSession = await createDebateRoom({
            unitId: selectedUnitId,
            candidateId: candidate.candidateId,
            candidateName,
            topic: finalTopic,
            roomLink,
            maxParticipants,
          });
        }
      }
    } catch (error: any) {
      toast$(
        error?.message || "Unable to launch the debate right now.",
        "error",
      );
    }

    if (!liveSession) {
      setJoining(false);
      setShowConfirm(false);
      setJoinProgress(0);
      return;
    }

    const launchedSessionId =
      liveSession?.session_id ||
      liveSession?.sessionId ||
      joinRoomFromLinkRef.current ||
      "";
    if (launchedSessionId) {
      roomId.current = launchedSessionId;
      joinRoomFromLinkRef.current = launchedSessionId;
    }
    const launchedRoomLink = launchedSessionId
      ? genRoomLink(launchedSessionId)
      : roomLink;

    setJoining(false);
    setShowConfirm(false);
    setJoinProgress(0);

    onLaunch({
      name,
      mode: "debate",
      subMode,
      subject: selectedSubjectLabel,
      unit,
      topic: finalTopic,
      stream,
      micOn: micEnabled,
      camOn: false,
      invitees: [],
      roomId: launchedSessionId || roomId.current,
      roomLink: launchedRoomLink,
      debateMinutes: Number(debateMinutes),
      unitId: selectedUnitId,
      sessionId: launchedSessionId,
      liveSession: liveSession?.liveSession || null,
      initialAiMessage:
        liveSession?.ai_greeting ||
        liveSession?.opening_statement ||
        liveSession?.message ||
        "",
      isHost: !joinRoomFromLinkRef.current,
    });
  }

  return (
    <div className="dp-setup">
      <div className="dp-setup-left">
        <div className="dp-orbs">
          <div className="dp-orb dp-orb1" />
          <div className="dp-orb dp-orb2" />
        </div>
        <div className="dp-grid" />
        <div className="dp-setup-left-inner">
          <div className="dp-logo">
            <div className="dp-logo-ico">⚔️</div>
            <span className="dp-logo-name">DebateArena</span>
          </div>
          <div className="dp-tag">
            <div className="dp-tag-dot" />
            Debate Setup
          </div>
          <h2 className="dp-h1">
            Launch your
            <br />
            <span className="gt">Debate Room.</span>
          </h2>
          <p className="dp-p">
            {subMode === "ai"
              ? "1-on-1 with a live AI opponent powered by the debate APIs."
              : subMode === "multi"
                ? "Live room flow with waiting room, host controls, and backend team balancing."
                : "Use the new debate design with the existing Node-backed debate integrations."}
          </p>
          <div className="dp-feats-left">
            {features.map((feature) => (
              <div key={feature.t} className="dp-feat-left">
                <div className="dp-feat-ico">{feature.ico}</div>
                <div className="dp-feat-txt">
                  <strong>{feature.t}</strong>
                  <span>{feature.d}</span>
                </div>
              </div>
            ))}
          </div>
          {(selectedSubjectLabel || finalTopic) && (
            <div className="ctx-card">
              <div className="ctx-card-label">Session Context</div>
              {selectedSubjectLabel && (
                <div className="ctx-card-val">
                  📚 {selectedSubjectLabel}
                  {unit ? ` · ${unit}` : ""}
                </div>
              )}
              {finalTopic && <div className="ctx-card-sub">{finalTopic}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="dp-setup-right">
        <div className="dp-setup-scroll">
          <div className="dp-setup-inner">
            {onBack && (
              <button
                className="setup-back"
                onClick={() => {
                  stop();
                  onBack();
                }}
              >
                ← Back
              </button>
            )}
            <h2 className="setup-title">⚔️ Debate Setup</h2>
            <p className="setup-sub">
              Complete the live debate setup using the integrated APIs.
            </p>

            <div className="sec-div">Identity</div>
            <div className="fi">
              <label className="fl">Your Name</label>
              <input
                className="finput"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Alex Chen"
                maxLength={40}
              />
            </div>

            <div className="sec-div">Academic Context</div>
            <div className="fi-row fi">
              <div>
                <label className="fl">Subject</label>
                <select
                  className="finput"
                  value={subject}
                  onChange={(event) => {
                    const nextSubject = event.target.value;
                    setSubject(nextSubject);
                    setUnit("");
                    setSelectedUnitId("");
                    setTopic("");
                    setCustom("");
                  }}
                  disabled={subjectsLoading || isJoinLinkMode}
                >
                  <option value="">
                    {subjectsLoading
                      ? "Loading subjects..."
                      : isJoinLinkMode
                        ? "Subject locked by room link"
                        : "Select subject..."}
                  </option>
                  {subjectCatalog.map((item) => (
                    <option
                      key={item.subjectGroupKey}
                      value={item.subjectGroupKey}
                    >
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="fl">Unit / Module</label>
                <select
                  className="finput"
                  value={selectedUnitId}
                  onChange={(event) => {
                    const nextUnitId = event.target.value;
                    setSelectedUnitId(nextUnitId);
                    const selectedUnit = availableUnits.find(
                      (item) => item.id === nextUnitId,
                    );
                    setUnit(
                      selectedUnit?.unitTitle || selectedUnit?.unitLabel || "",
                    );
                    setTopic("");
                    setCustom("");
                  }}
                  disabled={!subject || isJoinLinkMode}
                >
                  <option value="">
                    {isJoinLinkMode
                      ? "Unit locked by room link"
                      : subject
                        ? "Select unit..."
                        : "Select subject first"}
                  </option>
                  {availableUnits.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.unitTitle || item.unitLabel}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sec-div">Topic</div>
            <div className="fi">
              <label className="fl">Debate Topic</label>
              <select
                className="finput"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                disabled={topicsLoading && !isJoinLinkMode}
              >
                <option value="">
                  {topicsLoading ? "Loading topics..." : "Select a topic..."}
                </option>
                {topicOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
                <option value="__custom__">✏️ Custom topic...</option>
              </select>
            </div>
            {topic === "__custom__" && (
              <div className="fi">
                <label className="fl">Custom Topic</label>
                <input
                  className="finput"
                  value={custom}
                  onChange={(event) => setCustom(event.target.value)}
                  placeholder="Your debate topic..."
                />
              </div>
            )}

            <div className="sec-div">Debate Mode</div>
            <div className="submode-grid fi">
              {[
                {
                  id: "ai",
                  ico: "🤖",
                  t: "1v1 vs AI",
                  d: "Start a live AI debate session and get real AI responses.",
                },
                {
                  id: "multi",
                  ico: "👥",
                  t: "Team Debate",
                  d: "Create or join a live debate room with host controls.",
                },
              ].map((item) => (
                <div
                  key={item.id}
                  className={`submode-card${subMode === item.id ? " sel" : ""}`}
                  onClick={() => setSubMode(item.id as any)}
                >
                  <div className="submode-ico">{item.ico}</div>
                  <div>
                    <div className="submode-title">{item.t}</div>
                    <div className="submode-desc">{item.d}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="sec-div">Timing</div>
            {subMode === "multi" ? (
              <div className="dtype-grid fi">
                {[
                  {
                    id: "instant",
                    ico: "⚡",
                    t: "Start Now",
                    d: "Create or join the room immediately",
                  },
                  {
                    id: "schedule",
                    ico: "📅",
                    t: "Schedule",
                    d: "Keep the schedule flow in the new design",
                  },
                ].map((item) => (
                  <div
                    key={item.id}
                    className={`dtype-card${debateType === item.id ? " sel" : ""}`}
                    onClick={() => setDebateType(item.id as any)}
                  >
                    <div className="dtype-ico">{item.ico}</div>
                    <div>
                      <div className="dtype-title">{item.t}</div>
                      <div className="dtype-desc">{item.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="fi">
                <label className="fl">Debate Duration</label>
                <select
                  className="finput"
                  value={debateMinutes}
                  onChange={(event) => setDebateMinutes(event.target.value)}
                >
                  {[2, 5, 10, 15, 20].map((minutes) => (
                    <option key={minutes} value={String(minutes)}>
                      {minutes} minutes
                    </option>
                  ))}
                </select>
              </div>
            )}

            {debateType === "schedule" && (
              <div
                style={{
                  padding: 13,
                  borderRadius: 13,
                  background: "rgba(99,102,241,.05)",
                  border: "1.5px solid rgba(99,102,241,.18)",
                  marginBottom: 10,
                }}
              >
                {!scheduled ? (
                  <>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--t1)",
                        marginBottom: 6,
                      }}
                    >
                      📅 Set date & time for your debate
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--t2)",
                        marginBottom: 10,
                      }}
                    >
                      Event will be auto-saved to your calendar.
                    </div>
                    <button
                      className="btn-s"
                      style={{
                        width: "100%",
                        justifyContent: "center" as const,
                      }}
                      onClick={() => setShowSchedule(true)}
                    >
                      📅 Open Schedule Form
                    </button>
                  </>
                ) : (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 9 }}
                  >
                    <span style={{ fontSize: 22 }}>✅</span>
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: "var(--em)",
                        }}
                      >
                        Debate Scheduled
                      </div>
                      <div style={{ fontSize: 11, color: "var(--t2)" }}>
                        📅 {scheduledInfo?.date} at {scheduledInfo?.time}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="link-box">
              <div className="link-box-title">🔗 Room Link</div>
              <div className="link-row">
                <span className="link-val">{setupRoomLink}</span>
                <button className="copy-btn" onClick={copyLink}>
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <StepsComp steps={steps} />
            {debateType !== "schedule" && (
              <button
                className="btn-p"
                onClick={() => setShowConfirm(true)}
                disabled={!canLaunch}
              >
                🚀 Launch Debate Room
              </button>
            )}
            <div style={{ height: 24 }} />
          </div>
        </div>
      </div>

      {showSchedule && (
        <ScheduleDebateModal
          config={{
            topic: finalTopic,
            subject: selectedSubjectLabel,
            unit,
            roomLink: joinRoomFromLinkRef.current
              ? genRoomLink(joinRoomFromLinkRef.current)
              : "",
          }}
          onSchedule={(info: any) => {
            setScheduledInfo(info);
            setScheduled(true);
            setShowSchedule(false);
            toast$("Debate scheduled!", "success");
          }}
          onClose={() => setShowSchedule(false)}
        />
      )}

      {showConfirm && (
        <div className="overlay">
          <div className="modal dark" style={{ maxWidth: 440 }}>
            <div className="mh">
              <span className="mh-title" style={{ color: "#fff" }}>
                ⚔️ Ready to Enter?
              </span>
              <button
                className="mh-close"
                style={{
                  borderColor: "rgba(255,255,255,.1)",
                  background: "rgba(255,255,255,.06)",
                  color: "rgba(255,255,255,.6)",
                }}
                onClick={() => {
                  stop();
                  setShowConfirm(false);
                }}
              >
                ✕
              </button>
            </div>
            <div className="mb" style={{ padding: "16px 20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 13,
                  background: "rgba(99,102,241,.08)",
                  border: "1px solid rgba(99,102,241,.18)",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: "50%",
                    background: "var(--grad)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  ⚔️
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                    {name}
                  </div>
                  <div
                    style={{ fontSize: 11.5, color: "rgba(255,255,255,.5)" }}
                  >
                    {subMode === "ai" ? "1v1 vs AI Debate" : "Team Debate"}
                    {selectedSubjectLabel ? ` · ${selectedSubjectLabel}` : ""}
                    {unit ? ` · ${unit}` : ""}
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.07)",
                  marginBottom: 14,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "rgba(255,255,255,.8)",
                }}
              >
                💬 "{finalTopic}"
              </div>
              <MicPermCard
                perm={perm}
                stream={stream}
                micLevel={micLevel}
                micOn={micEnabled}
                onRequest={request}
                onToggle={() => {
                  setMicEnabled(!micEnabled);
                }}
                error={error}
              />
            </div>
            <div
              className="mf"
              style={{
                flexDirection: "column" as const,
                gap: 8,
                borderColor: "rgba(255,255,255,.08)",
              }}
            >
              <button
                className="btn-p"
                onClick={handleJoin}
                disabled={joining || !canProceed}
                style={{ fontSize: 14 }}
              >
                {joining ? (
                  <>
                    <span className="loader-spin" />
                    Launching {joinProgress > 0 ? `${joinProgress}%` : "..."}
                  </>
                ) : canProceed ? (
                  "⚔️ Launch Debate"
                ) : perm === "requesting" ? (
                  "Waiting for Mic..."
                ) : (
                  "Enable Mic to Launch"
                )}
              </button>
              {joinProgress > 0 && (
                <div className="lo-progress">
                  <div
                    className="lo-progress-fill"
                    style={{ width: `${joinProgress}%` }}
                  />
                </div>
              )}
              <button
                className="btn-s"
                onClick={() => {
                  stop();
                  setShowConfirm(false);
                }}
                disabled={joining}
                style={{
                  width: "100%",
                  justifyContent: "center" as const,
                  background: "rgba(255,255,255,.04)",
                  borderColor: "rgba(255,255,255,.1)",
                  color: "rgba(255,255,255,.5)",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {joining && (
        <DebateLoadingScreen
          title="Entering debate room"
          subtitle="Preparing teams, voice controls, and room state..."
          progress={joinProgress || 12}
        />
      )}
      {toastNode}
    </div>
  );
}

function TeamDebateRoom({
  config,
  onEnd,
}: {
  config: any;
  onEnd: (r: any) => void;
}) {
  const { user } = useAuth();
  const candidate = getCandidateContext(
    user || { firstName: config.name, lastName: "" },
  );
  const candidateId = config.candidateId || candidate.candidateId;
  const candidateName = config.name || candidate.candidateName;
  const { elapsedSeconds, label: elapsedTimer } = useTimer(true);
  const debateDurationSeconds = Math.max(
    60,
    Number(config.debateMinutes || 5) * 60,
  );
  const remainingSeconds = Math.max(0, debateDurationSeconds - elapsedSeconds);
  const debateTimer = fmtClock(remainingSeconds);
  const { show: toast$, node: toastNode } = useToast();
  const [roomSnapshot, setRoomSnapshot] = useState<any>(
    config.liveSession ? { liveSession: config.liveSession } : null,
  );
  const [loadingRoom, setLoadingRoom] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [roomWarning, setRoomWarning] = useState<string | null>(null);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [endingRoom, setEndingRoom] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [submittingTurn, setSubmittingTurn] = useState(false);
  const [speechRecording, setSpeechRecording] = useState(false);
  const [speechProcessing, setSpeechProcessing] = useState(false);
  const [aiIsSpeaking, setAiIsSpeaking] = useState(false);
  const [userIsSpeaking, setUserIsSpeaking] = useState(false);
  const [meetingReady, setMeetingReady] = useState(false);
  const [, setRoomMicRefresh] = useState(0);
  const roomSyncInFlightRef = useRef(false);
  const autoEndedRef = useRef(false);
  const latestLiveSessionRef = useRef<any>(null);
  const latestElapsedTimerRef = useRef("");
  const playedModeratorTurnsRef = useRef<Set<string>>(new Set());
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioContextRef = useRef<AudioContext | null>(null);
  const speechAnalyserRef = useRef<AnalyserNode | null>(null);
  const speechSilenceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechDetectedRef = useRef(false);
  const speechActiveStreakRef = useRef(0);
  const speechSilentStreakRef = useRef(0);
  const lastSpeechAtRef = useRef<number | null>(null);
  const firstSpeechAtRef = useRef<number | null>(null);
  const autoTurnStartRef = useRef("");
  const initialAiPlayedRef = useRef(false);
  const speechCaptureLockRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const moderatorSpeechTokenRef = useRef(0);
  const greetingPlaybackTokenRef = useRef(0);
  const onEndRef = useRef(onEnd);
  const currentSpeakerIdRef = useRef<string>("");
  // Auto start/stop refs — same pattern as LiveAIDebateRoom
  const startSpeechCaptureRef = useRef<(() => void) | null>(null);
  const autoSilenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSilenceSpeechDetectedRef = useRef(false);
  const autoSilenceCounterRef = useRef(0);
  const {
    state: roomMicState,
    stream: roomMicStream,
    error: roomMicError,
    request: requestRoomMic,
    stop: stopRoomMic,
  } = useMicPerm();

  const liveSession = roomSnapshot?.liveSession || config.liveSession || null;
  const participants = liveSession?.participants || [];
  const currentParticipant = participants.find(
    (participant: any) => String(participant.id) === String(candidateId),
  );
  const isHost = roomSnapshot
    ? Boolean(currentParticipant?.isHost)
    : Boolean(config.isHost);
  const teams = liveSession?.teams || { A: [], B: [] };
  const currentRound = liveSession?.currentRound || {};
  const currentPhase = currentRound.phase || null;
  const currentSpeakerId = String(currentRound.currentSpeakerId || "");
  const activeSpeakerId = currentSpeakerId || null;
  const currentSpeaker =
    participants.find(
      (participant: any) => String(participant.id) === currentSpeakerId,
    ) || null;
  const activeTeam =
    currentRound.activeTeam === "A" || currentRound.activeTeam === "B"
      ? currentRound.activeTeam
      : currentSpeaker?.team === "A" || currentSpeaker?.team === "B"
        ? currentSpeaker.team
        : null;
  const roomAudioStream =
    roomMicStream instanceof MediaStream
      ? roomMicStream
      : config.stream instanceof MediaStream
        ? config.stream
        : null;
  const localAudioTrack = roomAudioStream
    ? roomAudioStream.getAudioTracks?.()[0] || null
    : null;
  const micAvailable = Boolean(localAudioTrack);
  const micEnabled = Boolean(localAudioTrack?.enabled);
  const micBlocked = !micAvailable || !micEnabled;
  const isCurrentUserSpeaker = activeSpeakerId === String(candidateId);
  const isCurrentUserTurn =
    isCurrentUserSpeaker &&
    (!activeTeam || currentParticipant?.team === activeTeam);
  const canSpeak =
    liveSession?.status === "active" &&
    !aiIsSpeaking &&
    isCurrentUserTurn &&
    !submittingTurn &&
    !speechProcessing &&
    !speechRecording &&
    !endingRoom;
  const roomHasSnapshot = Boolean(roomSnapshot?.liveSession || config.liveSession);
  const roomReady = meetingReady && (!loadingRoom || roomHasSnapshot);

  useEffect(() => {
    if (!canSpeak || !localAudioTrack || localAudioTrack.readyState !== "live") {
      return;
    }
    if (!localAudioTrack.enabled) {
      localAudioTrack.enabled = true;
      debateDebug("[MIC] track re-enabled for turn", {
        sessionId: config.sessionId,
        activeSpeakerId,
        currentSpeakerId,
        trackReadyState: localAudioTrack.readyState,
      });
    }
  }, [
    activeSpeakerId,
    canSpeak,
    config.sessionId,
    currentSpeakerId,
    localAudioTrack?.enabled,
    localAudioTrack?.readyState,
  ]);

  useEffect(() => {
    if (!meetingReady || !loadingRoom || !roomHasSnapshot) return;
    console.log("[LOADER] Clearing room loading gate", {
      sessionId: config.sessionId,
      hasSnapshot: roomHasSnapshot,
    });
    setLoadingRoom(false);
  }, [config.sessionId, loadingRoom, meetingReady, roomHasSnapshot]);

  useEffect(() => {
    debateDebug("[STREAM] room audio route", {
      sessionId: config.sessionId,
      source: roomMicStream instanceof MediaStream ? "mic" : config.stream instanceof MediaStream ? "config" : "none",
      hasMicStream: Boolean(roomMicStream),
      hasConfigStream: Boolean(config.stream instanceof MediaStream),
      trackReadyState: localAudioTrack?.readyState || null,
      trackEnabled: localAudioTrack?.enabled ?? null,
      micAvailable,
      micEnabled,
      micBlocked,
    });
  }, [config.sessionId, config.stream, localAudioTrack?.enabled, localAudioTrack?.readyState, micAvailable, micBlocked, micEnabled, roomMicStream]);

  useEffect(() => {
    debateDebug("[TURN] speaker state", {
      sessionId: config.sessionId,
      currentSpeakerId,
      currentPhase,
      activeTeam,
      isCurrentUserSpeaker,
      isCurrentUserTurn,
      canSpeak,
      aiIsSpeaking,
      speechRecording,
      speechProcessing,
    });
    debateDebug("[TURN] current speaker", { activeSpeakerId });
  }, [
    activeTeam,
    aiIsSpeaking,
    canSpeak,
    currentPhase,
    currentSpeakerId,
    isCurrentUserSpeaker,
    isCurrentUserTurn,
    speechProcessing,
    speechRecording,
    config.sessionId,
  ]);

  useEffect(() => {
    latestLiveSessionRef.current = liveSession;
  }, [liveSession]);

  useEffect(() => {
    console.log("[PARTICIPANT] room participants updated", {
      sessionId: config.sessionId,
      participantCount: participants.length,
      currentSpeakerId,
      teamA: teams.A?.length || 0,
      teamB: teams.B?.length || 0,
    });
  }, [config.sessionId, currentSpeakerId, participants.length, teams.A?.length, teams.B?.length]);

  useEffect(() => {
    latestElapsedTimerRef.current = elapsedTimer;
  }, [elapsedTimer]);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    currentSpeakerIdRef.current = currentSpeakerId;
  }, [currentSpeakerId]);

  useEffect(() => {
    console.log("[CLEANUP] team room cleanup registered", {
      sessionId: config.sessionId,
    });
    return () => {
      ttsDebug("[CLEANUP] component unmount", {
        sessionId: config.sessionId,
        currentSpeakerId: currentSpeakerIdRef.current,
      });
      activeAudioRef.current?.pause();
      activeAudioRef.current = null;
      ttsDebug("[TTS] activeAudioRef cleanup", {
        sessionId: config.sessionId,
        mode: "team",
        reason: "component-unmount",
      });
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
      speechCaptureLockRef.current = false;
      if (speechSilenceRef.current) {
        clearInterval(speechSilenceRef.current);
        speechSilenceRef.current = null;
      }
      if (speechAudioContextRef.current) {
        speechAudioContextRef.current.close().catch(() => null);
        speechAudioContextRef.current = null;
      }
      moderatorSpeechTokenRef.current += 1;
      stopRoomMic(true);
      ttsDebug("[CLEANUP] speech cancellation", {
        sessionId: config.sessionId,
        mode: "team",
        reason: "component-unmount",
      });
    };
  }, [config.sessionId, stopRoomMic]);

  // Stable string key derived from turns — only changes when a NEW moderator turn
  // arrives. Prevents the greeting useEffect from re-firing on every poll interval
  // (which creates new array references and cancels TTS mid-flight).
  const latestModeratorTurnId = (() => {
    const turns = liveSession?.turns || [];
    return (
      [...turns]
        .reverse()
        .find((t: any) => t.role === "moderator" && (t.message || t.transcript))
        ?.id ?? null
    );
  })();

  useEffect(() => {
    const turns = liveSession?.turns || [];
    const latestModeratorTurn = [...turns]
      .reverse()
      .find(
        (turn: any) =>
          turn.role === "moderator" && (turn.message || turn.transcript),
      );
    if (
      !latestModeratorTurn?.id ||
      playedModeratorTurnsRef.current.has(String(latestModeratorTurn.id))
    ) {
      return;
    }

    playedModeratorTurnsRef.current.add(String(latestModeratorTurn.id));
    const text = String(
      latestModeratorTurn.message || latestModeratorTurn.transcript || "",
    ).trim();
    if (!text) {
      setMeetingReady(true);
      console.log("[LOADER] Meeting ready", {
        sessionId: config.sessionId,
        mode: "team",
        reason: "no-greeting-text",
      });
      return;
    }

    ttsDebug("[GREETING] triggered", {
      sessionId: config.sessionId,
      turnId: latestModeratorTurn.id,
      textLength: text.length,
    });
    const playbackToken = ++greetingPlaybackTokenRef.current;
    let cancelled = false;

    (async () => {
      try {
        activeAudioRef.current?.pause();
        activeAudioRef.current = null;
        ttsDebug("[TTS] activeAudioRef cleanup", {
          sessionId: config.sessionId,
          mode: "team",
          reason: "pre-greeting",
        });
        setAiIsSpeaking(false);
        ttsDebug("[TTS] synthesizeDebateSpeech started", {
          sessionId: config.sessionId,
          turnId: latestModeratorTurn.id,
        });
        // Use pre-loaded audio from handleStart if available (host path).
        // Participants synthesize fresh here. Either way: land page → speak immediately.
        let greetingDataUrl: string | null = config.preloadedGreetingDataUrl || null;
        if (!greetingDataUrl) {
          const audio = await synthesizeDebateSpeech({ text, voice: "alloy" });
          ttsDebug("[TTS] audio returned", {
            sessionId: config.sessionId,
            hasAudio: Boolean(audio?.dataUrl),
            dataUrlLength: audio?.dataUrl?.length || 0,
          });
          if (cancelled || playbackToken !== greetingPlaybackTokenRef.current) {
            setMeetingReady(true);
            return;
          }
          if (audio?.dataUrl) {
            await preloadAudioDataUrl(audio.dataUrl);
            if (cancelled || playbackToken !== greetingPlaybackTokenRef.current) {
              setMeetingReady(true);
              return;
            }
            greetingDataUrl = audio.dataUrl;
          }
        }
        if (!greetingDataUrl) {
          setMeetingReady(true);
          ttsDebug("[LOADER] Meeting ready — no audio dataUrl", {
            sessionId: config.sessionId,
            mode: "team",
          });
          return;
        }
        setMeetingReady(true);
        ttsDebug("[LOADER] Meeting ready", {
          sessionId: config.sessionId,
          mode: "team",
        });
        ttsDebug("[TTS] activeAudioRef assignment", {
          sessionId: config.sessionId,
          mode: "team",
        });
        activeAudioRef.current = playAudioDataUrl(
          greetingDataUrl,
          () => {
            ttsDebug("[TTS] play started", {
              sessionId: config.sessionId,
              mode: "team",
            });
            setAiIsSpeaking(true);
          },
          () => {
            if (cancelled || playbackToken !== greetingPlaybackTokenRef.current) return;
            setAiIsSpeaking(false);
            activeAudioRef.current = null;
            ttsDebug("[TTS] activeAudioRef cleanup", {
              sessionId: config.sessionId,
              mode: "team",
              reason: "playback-ended",
            });
            // Parse greeting to find first speaker mentioned by AI.
            // If server already set currentSpeakerId that's authoritative;
            // this is a client-side fallback in case it's null.
            const serverSpeakerId = liveSession?.currentRound?.currentSpeakerId;
            if (!serverSpeakerId) {
              const allParticipants = liveSession?.participants || [];
              const { speakerId, team } = extractFirstSpeakerFromGreeting(text, allParticipants);
              ttsDebug("[TURN] first speaker extracted from greeting", { speakerId, team });
              if (speakerId) {
                // Trigger auto-start for the first mentioned speaker
                setTimeout(() => { startSpeechCaptureRef.current?.(); }, 300);
              }
            } else {
              // Server has set the first speaker — auto-start will fire via canSpeak useEffect.
              // Ensure the local track is enabled so startSpeechCapture can proceed.
              const localTrack = config.stream?.getAudioTracks?.()[0];
              if (localTrack && !localTrack.enabled) {
                localTrack.enabled = true;
                ttsDebug("[MIC] track pre-enabled for server-assigned speaker", { serverSpeakerId });
              }
              ttsDebug("[TURN] first speaker from server", { serverSpeakerId });
            }
          },
        );
      } catch (error) {
        setMeetingReady(true);
        ttsDebug("[TTS] play error", {
          sessionId: config.sessionId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    return () => {
      cancelled = true;
      ttsDebug("[CLEANUP] speech cancellation", {
        sessionId: config.sessionId,
        mode: "team",
        reason: "effect-cleanup",
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.sessionId, latestModeratorTurnId]); // stable string key, not array ref

  const syncRoom = useCallback(
    async (firstLoad = false) => {
      if (!config.sessionId || roomSyncInFlightRef.current) return;
      // Skip the very first fetch if caller already provided full liveSession
      // (avoids blink caused by double-loading on room entry)
      if (firstLoad && config.skipInitialFetch && config.liveSession) {
        console.log("[ROOM] team sync skipped initial fetch", {
          sessionId: config.sessionId,
        });
        // Use the already-initialised roomSnapshot (set in useState) — do NOT
        // call setRoomSnapshot here with a new object, as that triggers a re-render
        // which creates a new liveSession.turns array reference and re-fires the
        // greeting useEffect, cancelling TTS mid-flight.
        setLoadingRoom(false);
        return;
      }
      roomSyncInFlightRef.current = true;
      if (firstLoad) setLoadingRoom(true);
      console.log("[ROOM] team sync start", {
        sessionId: config.sessionId,
        firstLoad,
      });
      try {
        const snapshot = await getDebateRoom(config.sessionId);
        setRoomSnapshot(snapshot);
        setRoomError(null);
        if (snapshot?.pythonWarning) {
          setRoomWarning(snapshot.pythonWarning);
        }
        const status = snapshot?.liveSession?.status;
        console.log("[ROOM] team sync snapshot", {
          sessionId: config.sessionId,
          status: status || null,
          currentSpeakerId: snapshot?.liveSession?.currentRound?.currentSpeakerId || null,
          activeTeam: snapshot?.liveSession?.currentRound?.activeTeam || null,
        });
        if (status === "completed" && !autoEndedRef.current) {
          autoEndedRef.current = true;
          onEndRef.current(
            buildTeamDebateResult(
              snapshot,
              snapshot?.liveSession || latestLiveSessionRef.current,
              config,
              latestElapsedTimerRef.current,
              fmtClock(debateDurationSeconds),
            ),
          );
        }
      } catch (error: any) {
        console.log("[ROOM] team sync failed", {
          sessionId: config.sessionId,
          message: error?.message || String(error),
        });
        setRoomError(error?.message || "Unable to load the debate room.");
      } finally {
        roomSyncInFlightRef.current = false;
        if (firstLoad) setLoadingRoom(false);
      }
    },
    [config.sessionId, config.skipInitialFetch, config.liveSession],
  );

  useEffect(() => {
    let pollId: ReturnType<typeof setInterval> | null = null;
    console.log("[ROOM] team polling started", {
      sessionId: config.sessionId,
    });
    syncRoom(true).catch(() => null);
    pollId = setInterval(() => {
      syncRoom(false).catch(() => null);
    }, 2000);
    return () => {
      if (pollId) clearInterval(pollId);
      console.log("[CLEANUP] team polling stopped", {
        sessionId: config.sessionId,
      });
    };
  }, [config.sessionId]);

  useEffect(() => {
    const onPopState = () => {
      setShowBackConfirm(true);
      window.history.pushState(
        { teamDebateRoom: true },
        "",
        window.location.href,
      );
    };
    window.history.pushState(
      { teamDebateRoom: true },
      "",
      window.location.href,
    );
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  async function submitTurn(message: string) {
    if (!message.trim()) return;
    console.log("[TURN] submit turn", {
      sessionId: config.sessionId,
      candidateId,
      team: currentParticipant?.team || null,
      textLength: message.trim().length,
    });
    setSubmittingTurn(true);
    try {
      const data = await submitDebateRoomTurn({
        sessionId: config.sessionId,
        candidateId,
        candidateName,
        team: currentParticipant?.team,
        message: message.trim(),
      });
      setMessageInput("");
      setRoomSnapshot({
        liveSession: data?.liveSession || liveSession,
        ...data,
      });
    } catch (error: any) {
      console.log("[TURN] submit failed", {
        sessionId: config.sessionId,
        message: error?.message || String(error),
      });
      toast$(error?.message || "Unable to submit your team response.", "error");
    } finally {
      setSubmittingTurn(false);
    }
  }

  function cleanupSpeechDetection() {
    console.log("[CLEANUP] speech detection cleanup", {
      sessionId: config.sessionId,
      speechRecording,
      speechProcessing,
    });
    if (speechSilenceRef.current) {
      clearInterval(speechSilenceRef.current);
      speechSilenceRef.current = null;
    }
    if (speechAudioContextRef.current) {
      speechAudioContextRef.current.close().catch(() => null);
      speechAudioContextRef.current = null;
    }
    speechAnalyserRef.current = null;
    speechDetectedRef.current = false;
    speechActiveStreakRef.current = 0;
    speechSilentStreakRef.current = 0;
    lastSpeechAtRef.current = null;
    firstSpeechAtRef.current = null;
    speechCaptureLockRef.current = false;
  }

  async function startSpeechCapture() {
    debateDebug("[SPEAK] button clicked", {
      sessionId: config.sessionId,
      candidateId,
      currentSpeakerId,
      activeTeam,
      canSpeak,
      micAvailable,
      micEnabled,
      micBlocked,
      hasStream: Boolean(roomAudioStream),
    });
    debateDebug("[TURN] validation", {
      activeSpeakerId,
      currentUserId: candidateId,
      participantId: candidateId,
      canSpeak,
    });
    if (
      !canSpeak ||
      speechCaptureLockRef.current ||
      mediaRecorderRef.current?.state === "recording"
    ) {
      debateDebug("[SPEAK] blocked", {
        reason: "precondition_failed",
        activeSpeakerId,
        currentUserId: candidateId,
        participantId: candidateId,
        hasStream: Boolean(roomAudioStream),
        canSpeak,
        speechCaptureLockRef: speechCaptureLockRef.current,
        recorderState: mediaRecorderRef.current?.state || null,
      });
      debateDebug("[EARLY_RETURN]", {
        functionName: "startSpeechCapture",
        reason: "precondition_failed",
        values: {
          activeSpeakerId,
          currentUserId: candidateId,
          participantId: candidateId,
          hasStream: Boolean(roomAudioStream),
          canSpeak,
          speechCaptureLockRef: speechCaptureLockRef.current,
          recorderState: mediaRecorderRef.current?.state || null,
        },
      });
      return;
    }
    debateDebug("[SPEAK] validation passed", {
      sessionId: config.sessionId,
      candidateId,
      currentSpeakerId,
      activeTeam,
      canSpeak,
      micAvailable,
      micEnabled,
      micBlocked,
    });
    debateDebug("[SPEAK] button clicked", {
      sessionId: config.sessionId,
      candidateId,
      currentSpeakerId,
      activeTeam,
      canSpeak,
      micAvailable,
      micEnabled,
      micBlocked,
    });
    const sourceStream =
      roomAudioStream instanceof MediaStream ? roomAudioStream : null;
    const audioTrack = sourceStream?.getAudioTracks?.()[0];
    if (!audioTrack) {
      debateDebug("[ERROR] speak blocked no track", {
        sessionId: config.sessionId,
      });
      debateDebug("[SPEAK] blocked", {
        reason: "no_audio_track",
        activeSpeakerId,
        currentUserId: candidateId,
        participantId: candidateId,
        hasStream: Boolean(roomAudioStream),
      });
      debateDebug("[EARLY_RETURN]", {
        functionName: "startSpeechCapture",
        reason: "no_audio_track",
        values: {
          activeSpeakerId,
          currentUserId: candidateId,
          participantId: candidateId,
          hasStream: Boolean(roomAudioStream),
        },
      });
      toast$("Microphone is not available.", "error");
      return;
    }
    debateDebug("[STREAM] audio track state", {
      readyState: audioTrack.readyState,
      enabled: audioTrack.enabled,
    });
    // Track ended — need fresh stream (same fix as LiveAIDebateRoom)
    if (audioTrack.readyState === "ended") {
      debateDebug("[MIC] track ended — requesting fresh stream", {});
      try {
        const freshStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const freshTrack = freshStream.getAudioTracks()[0];
        if (!freshTrack) { toast$("Microphone is not available.", "error"); speechCaptureLockRef.current = false; return; }
        if (roomAudioStream) {
          roomAudioStream.removeTrack(audioTrack);
          roomAudioStream.addTrack(freshTrack);
        }
      } catch (err: any) {
        toast$(err?.message || "Microphone access failed.", "error");
        speechCaptureLockRef.current = false;
        return;
      }
    }
    // Re-read track after possible refresh
    const liveTrack = roomAudioStream?.getAudioTracks?.()[0];
    if (!liveTrack || liveTrack.readyState === "ended") {
      toast$("Microphone unavailable. Please refresh and allow mic access.", "error");
      speechCaptureLockRef.current = false;
      return;
    }
    // Re-enable if muted (was disabled while AI was speaking)
    if (!liveTrack.enabled) {
      debateDebug("[MIC] re-enabling track for team speech capture", { readyState: liveTrack.readyState });
      liveTrack.enabled = true;
    }
    speechCaptureLockRef.current = true;
    const recordingStream = new MediaStream([liveTrack]);
    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
    if (!mimeType) { toast$("Your browser does not support audio recording.", "error"); speechCaptureLockRef.current = false; return; }
    debateDebug("[RECORDER] creating", {
      mimeType,
      trackCount: recordingStream.getTracks().length,
    });
    const recorder = new MediaRecorder(recordingStream, { mimeType });
    debateDebug("[RECORDER] created", {
      mimeType,
      trackCount: recordingStream.getTracks().length,
      state: recorder.state,
    });
    mediaChunksRef.current = [];
    mediaRecorderRef.current = recorder;
    const recordingStartedAt = Date.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) mediaChunksRef.current.push(event.data);
      debateDebug("[RECORDER] dataavailable", {
        state: recorder.state,
        blobSize: event.data.size,
      });
    };
    recorder.onerror = (event: any) => {
      debateDebug("[RECORDER] error", {
        state: recorder.state,
        message: event?.error?.message || event?.message || String(event),
      });
    };
    recorder.onstop = async () => {
      debateDebug("[RECORDER] stop", {
        sessionId: config.sessionId,
        state: recorder.state,
        chunkCount: mediaChunksRef.current.length,
      });
      setSpeechRecording(false);
      setUserIsSpeaking(false);
      const blob = new Blob(mediaChunksRef.current, { type: mimeType });
      debateDebug("[TRANSCRIBE] starting", {
        blobSize: blob.size,
        durationMs: Date.now() - recordingStartedAt,
      });
      mediaChunksRef.current = [];
      mediaRecorderRef.current = null;
      if (!blob.size) {
        speechCaptureLockRef.current = false;
        toast$("No speech was recorded.", "warn");
        return;
      }
      setSpeechProcessing(true);
      try {
        const transcription = await transcribeDebateAudio(blob);
        const text = transcription?.text?.trim();
        debateDebug("[TRANSCRIBE] result", {
          sessionId: config.sessionId,
          textLength: text?.length || 0,
        });
        if (!text) {
          toast$("No speech detected. Passing to the next turn.", "info");
          await submitTurn("Pass");
          return;
        }
        await submitTurn(text);
      } catch (error: any) {
        debateDebug("[ERROR] transcribe failed", {
          sessionId: config.sessionId,
          message: error?.message || String(error),
        });
        toast$(error?.message || "Unable to transcribe your speech.", "error");
      } finally {
        setSpeechProcessing(false);
        speechCaptureLockRef.current = false;
      }
    };
    debateDebug("[RECORDER] start requested", {
      state: recorder.state,
      mimeType,
    });
    recorder.start();
    debateDebug("[RECORDER] started", {
      sessionId: config.sessionId,
      state: recorder.state,
      mimeType,
    });
    setSpeechRecording(true);
    speechDetectedRef.current = false;
    speechActiveStreakRef.current = 0;
    speechSilentStreakRef.current = 0;
    lastSpeechAtRef.current = null;
    firstSpeechAtRef.current = null;

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      const source = audioContext.createMediaStreamSource(recordingStream);
      source.connect(analyser);
      speechAudioContextRef.current = audioContext;
      speechAnalyserRef.current = analyser;
      const samples = new Uint8Array(analyser.fftSize);
      speechSilenceRef.current = setInterval(() => {
        if (
          !speechAnalyserRef.current ||
          !mediaRecorderRef.current ||
          mediaRecorderRef.current.state === "inactive"
        )
          return;
        speechAnalyserRef.current.getByteTimeDomainData(samples);
        let peak = 0;
        let sumSquares = 0;
        for (let index = 0; index < samples.length; index += 1) {
          const centered = samples[index] - 128;
          const amplitude = Math.abs(centered);
          if (amplitude > peak) peak = amplitude;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        const detectedSpeech = peak > 10 || rms > 5.5;
        if (detectedSpeech) {
          const now = Date.now();
          speechDetectedRef.current = true;
          firstSpeechAtRef.current = firstSpeechAtRef.current || now;
          lastSpeechAtRef.current = now;
          setUserIsSpeaking(true);
          return;
        }
        if (!speechDetectedRef.current || !lastSpeechAtRef.current) {
          return;
        }
        setUserIsSpeaking(false);
        const armedForSilence =
          firstSpeechAtRef.current &&
          Date.now() - firstSpeechAtRef.current >= 600;
        // 8 seconds silence (matching LiveAIDebateRoom behaviour)
        if (armedForSilence && Date.now() - lastSpeechAtRef.current >= 8000) {
          debateDebug("[SILENCE] 8s silence detected — auto-stopping", {
            sessionId: config.sessionId,
            activeSpeakerId: currentSpeakerId,
          });
          stopSpeechCapture();
        }
      }, 120);
    } catch {
      cleanupSpeechDetection();
    }
  }

  function stopSpeechCapture() {
    // Clear auto-silence interval
    if (autoSilenceIntervalRef.current) {
      clearInterval(autoSilenceIntervalRef.current);
      autoSilenceIntervalRef.current = null;
    }
    autoSilenceSpeechDetectedRef.current = false;
    autoSilenceCounterRef.current = 0;
    cleanupSpeechDetection();
    const activeRecorder = mediaRecorderRef.current;
    if (activeRecorder && activeRecorder.state !== "inactive") {
      activeRecorder.stop();
    }
    // Mute mic after stop — re-enabled when auto-start or user clicks Start
    const liveTrack = roomAudioStream?.getAudioTracks?.()[0];
    if (liveTrack) liveTrack.enabled = false;
  }

  async function handleMicGrant() {
    debateDebug("[MIC] grant requested", {
      sessionId: config.sessionId,
      roomMicState,
      hasRoomMicStream: Boolean(roomMicStream),
      micAvailable,
      micEnabled,
    });
    if (speechRecording || speechProcessing || endingRoom) return;
    if (roomMicState !== "granted" || !roomMicStream) {
      const stream = await requestRoomMic();
      if (!stream) {
        debateDebug("[ERROR] mic grant failed", {
          sessionId: config.sessionId,
          roomMicState,
          roomMicError,
        });
        toast$(
          roomMicError ||
            "Microphone permission was denied. Please allow browser access and try again.",
          "error",
        );
        return;
      }
      setRoomMicRefresh((value) => value + 1);
      debateDebug("[MIC] grant success", {
        sessionId: config.sessionId,
        trackState: stream.getAudioTracks?.()[0]?.readyState || null,
        trackEnabled: stream.getAudioTracks?.()[0]?.enabled ?? null,
      });
      toast$("Microphone granted.", "success");
      return;
    }
    if (localAudioTrack && !localAudioTrack.enabled) {
      localAudioTrack.enabled = true;
      debateDebug("[MIC] track enabled", {
        sessionId: config.sessionId,
        readyState: localAudioTrack.readyState,
      });
      setRoomMicRefresh((value) => value + 1);
      toast$("Microphone enabled.", "success");
      return;
    }
    toast$("Microphone is already enabled.", "info");
  }

  // Sync ref so greeting callback can call startSpeechCapture without stale closure
  useEffect(() => {
    startSpeechCaptureRef.current = startSpeechCapture;
  });

  // Stop recording if AI takes over — otherwise leave manual/auto-silence in control
  useEffect(() => {
    if (aiIsSpeaking && speechRecording) {
      stopSpeechCapture();
    }
  }, [aiIsSpeaking, speechRecording]);

  // Auto-start when it's this user's turn (after AI finishes speaking)
  useEffect(() => {
    if (!canSpeak || micBlocked || speechRecording || speechProcessing || submittingTurn) {
      return;
    }
    const turnKey = `${liveSession?.currentRound?.roundNumber || 0}:${currentSpeakerId || ""}`;
    if (autoTurnStartRef.current === turnKey) return;
    autoTurnStartRef.current = turnKey;
    console.log("[TURN] auto-starting speech capture for team member", {
      sessionId: config.sessionId,
      turnKey,
      currentSpeakerId,
      activeTeam,
    });
    setTimeout(() => {
      startSpeechCaptureRef.current?.();
    }, 300);
  }, [
    canSpeak,
    currentSpeakerId,
    liveSession?.currentRound?.roundNumber,
    micBlocked,
    speechProcessing,
    speechRecording,
    submittingTurn,
  ]);

  async function handleEndDebate(retry = false) {
    if (endingRoom || !config.sessionId) return;
    console.log("[ROOM] end requested", {
      sessionId: config.sessionId,
      retry,
      isHost,
    });
    setEndingRoom(true);
    setEndError(null);
    stopSpeechCapture();
    activeAudioRef.current?.pause();
    activeAudioRef.current = null;
    moderatorSpeechTokenRef.current += 1;
    setAiIsSpeaking(false);
    setUserIsSpeaking(false);
    try {
      autoEndedRef.current = true;
      const result = retry
        ? await retryEndDebateRoom(config.sessionId)
        : await endDebateRoom(config.sessionId);
      console.log("[ROOM] end success", {
        sessionId: config.sessionId,
        status: result?.liveSession?.status || null,
      });
      onEnd(
        buildTeamDebateResult(
          result,
          result?.liveSession || liveSession,
          config,
          elapsedTimer,
          fmtClock(debateDurationSeconds),
        ),
      );
    } catch (error: any) {
      console.log("[ROOM] end failed", {
        sessionId: config.sessionId,
        message: error?.message || String(error),
      });
      autoEndedRef.current = false;
      const message = error?.message || "Unable to end the debate right now.";
      setEndError(message);
      toast$(message, "error");
    } finally {
      setEndingRoom(false);
    }
  }

  function handleBackAction() {
    if (isHost) {
      handleEndDebate(false);
      return;
    }
    onEnd({ aborted: true });
  }

  const moderatorTile: Participant = {
    id: 99,
    name: "AI Moderator",
    stream: null,
    isAI: true,
    isMed: true,
    isLocal: false,
    isHost: false,
    isStudent: false,
    micMuted: false,
    camOn: false,
    isSpeaking: aiIsSpeaking,
    handRaised: false,
    avatarColor: "#38bdf8",
    energy: 100,
    reactionsReceived: 0,
    turnsTaken: 0,
  };
  const buildTeamTiles = (teamKey: "A" | "B") =>
    (teams?.[teamKey] || []).map(
      (participant: any, index: number) =>
        ({
          id: participant.id != null ? String(participant.id) : String(index + 1),
          name: participant.name,
          stream:
            String(participant.id) === String(candidateId) &&
            config.stream instanceof MediaStream
              ? config.stream
              : null,
          isAI: Boolean(participant.isAi),
          isMed: false,
          isLocal: String(participant.id) === String(candidateId),
          isHost: Boolean(participant.isHost),
          isStudent: !participant.isAi,
          micMuted:
            aiIsSpeaking ||
            String(participant.id) !== currentSpeakerId ||
            (activeTeam && participant.team !== activeTeam),
          camOn: false,
          isSpeaking:
            !aiIsSpeaking &&
            String(participant.id) === String(candidateId) &&
            userIsSpeaking,
          handRaised: false,
          isMyTurn: String(participant.id) === String(candidateId) && canSpeak,
          avatarColor: participant.team
            ? getTeamColor(participant.team)
            : participant.isAi
              ? "#8b5cf6"
              : getTeamColor(teamKey),
          energy: 84,
          reactionsReceived: 0,
          turnsTaken: Number(participant.turnsTaken || 0),
          team: teamKey,
          teamOrder: participant.teamOrder,
          hasSpoken: Boolean(participant.hasSpoken),
        }) as Participant,
    );
  const teamATiles = buildTeamTiles("A");
  const teamBTiles = buildTeamTiles("B");

  return (
    <div className="dp-room">
      <div className="room-bar">
        <button className="room-logo" type="button">
          <span className="room-logo-ico">⚔️</span>
          <span>DebateArena</span>
        </button>
        <button
          className="btn-s"
          style={{ width: "auto", padding: "6px 10px" }}
          onClick={() => setShowBackConfirm(true)}
        >
          Back
        </button>
        <div className="rbar-div" />
        <div className="rbar-topic">
          <strong>{config.topic}</strong> · {config.subject} · {config.unit}
        </div>
        <div
          className="rbar-pill"
          style={{ background: "rgba(99,102,241,.14)", color: "#c7d2fe" }}
        >
          {liveSession?.status === "waiting_for_ai"
            ? "Waiting for AI"
            : liveSession?.status === "active"
              ? "Live debate"
              : liveSession?.status || "Connecting"}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 20,
          background: "linear-gradient(180deg,#081223 0%,#0f172a 100%)",
        }}
      >
        {roomError ? (
          <div
            style={{
              maxWidth: 560,
              margin: "40px auto",
              background: "rgba(239,68,68,.08)",
              border: "1px solid rgba(239,68,68,.24)",
              borderRadius: 20,
              padding: 24,
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
              Unable to load debate room
            </div>
            <div
              style={{
                color: "rgba(255,255,255,.7)",
                lineHeight: 1.7,
                marginBottom: 16,
              }}
            >
              {roomError}
            </div>
            <button
              className="btn-p"
              style={{ width: "auto" }}
              onClick={() => syncRoom(true).catch(() => null)}
            >
              Retry
            </button>
          </div>
        ) : !roomReady ? (
          <div
            style={{
              color: "#fff",
              display: "grid",
              placeItems: "center",
              minHeight: "60vh",
              gap: 12,
            }}
          >
            <div className="loader-spin" />
            <div style={{ fontWeight: 800 }}>Loading debate room...</div>
          </div>
        ) : (
          <>
            {roomWarning && (
              <div
                style={{
                  background: "rgba(245,158,11,.12)",
                  border: "1px solid rgba(245,158,11,.24)",
                  borderRadius: 16,
                  padding: 14,
                  color: "#fde68a",
                  fontSize: 13,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                {roomWarning}
              </div>
            )}
            <div className="room-body">
              <div className="grid-area">
                <div className="team-stage">
                  <div className="moderator-row">
                    <Tile p={moderatorTile} />
                  </div>
                  <div className="team-vs-grid">
                    <section
                      className={`team-box team-box-a${activeTeam === "A" ? " active" : ""}`}
                    >
                      <div className="team-box-head">
                        <div>
                          <div className="team-box-title">🔵 Blue Team</div>
                          <div className="team-box-sub">
                            {
                              teamATiles.filter(
                                (participant) => participant.hasSpoken,
                              ).length
                            }
                            /{teamATiles.length} spoke
                          </div>
                        </div>
                        <span className="team-a-badge">Blue</span>
                      </div>
                      <div className="team-member-grid">
                        {teamATiles.map((participant) => (
                          <Tile key={participant.id} p={participant} />
                        ))}
                      </div>
                    </section>

                    <section
                      className={`team-box team-box-b${activeTeam === "B" ? " active" : ""}`}
                    >
                      <div className="team-box-head">
                        <div>
                          <div className="team-box-title">🔴 Red Team</div>
                          <div className="team-box-sub">
                            {
                              teamBTiles.filter(
                                (participant) => participant.hasSpoken,
                              ).length
                            }
                            /{teamBTiles.length} spoke
                          </div>
                        </div>
                        <span className="team-b-badge">Red</span>
                      </div>
                      <div className="team-member-grid">
                        {teamBTiles.map((participant) => (
                          <Tile key={participant.id} p={participant} />
                        ))}
                      </div>
                    </section>
                  </div>
                </div>

                <div className="ctrl-bar">
                  <div className="cg">
                    <button
                      className={`cbtn ${micBlocked ? "locked" : micEnabled ? "on" : "off"}`}
                      onClick={handleMicGrant}
                      disabled={
                        speechRecording ||
                        speechProcessing ||
                        endingRoom ||
                        roomMicState === "requesting"
                      }
                    >
                      <span className="cbtn-ico">
                        {micBlocked ? "🔴" : "🎤"}
                      </span>
                      <span>
                        {roomMicState === "requesting"
                          ? "Requesting Mic..."
                          : micBlocked
                            ? roomMicState === "denied"
                              ? "Grant Mic"
                              : "Mic Off"
                            : "Mic Ready"}
                      </span>
                    </button>
                    <button
                      className={`cbtn ${speechRecording ? "mic-live" : canSpeak && !micBlocked ? "on" : "off"}`}
                      onClick={
                        speechRecording ? stopSpeechCapture : startSpeechCapture
                      }
                      disabled={
                        speechRecording
                          ? false
                          : micBlocked ||
                            !canSpeak ||
                            speechProcessing ||
                            submittingTurn ||
                            endingRoom
                      }
                    >
                      <span className="cbtn-ico">
                        {speechRecording ? "🎙" : "🎤"}
                      </span>
                      <span>
                        {speechProcessing
                          ? "Transcribing..."
                          : speechRecording || (canSpeak && micEnabled)
                            ? "Stop Speak"
                            : micBlocked
                              ? "Enable Mic"
                              : "Start Speak"}
                      </span>
                    </button>
                  </div>
                  <div className="cg">
                    <button
                      className={`cbtn${aiIsSpeaking || liveSession?.status === "waiting_for_ai" ? " speaking" : ""}`}
                      disabled
                    >
                      <span className="cbtn-ico">🔊</span>
                      <span>
                        {aiIsSpeaking
                          ? "AI Moderator speaking..."
                          : liveSession?.status === "waiting_for_ai"
                            ? "Waiting for AI"
                            : currentSpeaker
                              ? `${currentSpeaker.name}`
                              : "Live Room"}
                      </span>
                    </button>
                    {isHost && (
                      <button
                        className="end-btn"
                        onClick={() => handleEndDebate(Boolean(endError))}
                        disabled={endingRoom}
                      >
                        {endingRoom ? "Ending..." : "End"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="side-panel">
                <div className="panel-tabs-dark">
                  <button className="ptab active">
                    💬
                    <span style={{ fontSize: 8.5, display: "block" }}>
                      Feed
                    </span>
                  </button>
                </div>
                <div
                  className="pscroll"
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div className="room-info-grid">
                    <div className="room-info-card live">
                      <div className="room-info-label">Current Turn</div>
                      <div className="room-info-title">
                        {aiIsSpeaking
                          ? "AI Moderator"
                          : currentSpeaker
                            ? `${currentSpeaker.name} · Team ${currentSpeaker.team || "-"}`
                            : "Preparing next speaker"}
                      </div>
                      <div className="room-info-sub">
                        {aiIsSpeaking
                          ? "Moderator response in progress. Everyone is muted."
                          : canSpeak
                            ? micBlocked
                              ? roomMicState === "denied"
                                ? "Microphone access was denied. Grant access in your browser to speak."
                                : "It is your turn, but your microphone is off."
                              : "It is your turn now."
                            : currentPhase === "ai_opening"
                              ? "Opening moderation is in progress."
                              : liveSession?.status === "waiting_for_ai"
                                ? "Waiting for the AI moderator response."
                                : activeTeam
                                  ? `Team ${activeTeam} is active.`
                                  : "Room is syncing."}
                      </div>
                      {roomMicError && micBlocked && (
                        <div
                          style={{
                            marginTop: 10,
                            fontSize: 12,
                            color: "#fecaca",
                            lineHeight: 1.6,
                          }}
                        >
                          {roomMicError}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="chat-msgs" style={{ maxHeight: 320 }}>
                    {(liveSession?.turns || []).length ? (
                      (liveSession?.turns || []).map((turn: any) => (
                        <div key={turn.id} className="chat-msg">
                          <div className="chat-bwrap" style={{ width: "100%" }}>
                            <span className="chat-sender">
                              {turn.speakerName || "Unknown"}
                              {turn.team ? ` · Team ${turn.team}` : ""}
                            </span>
                            <div className="chat-bubble bubble-o">
                              {turn.message ||
                                turn.transcript ||
                                "No message recorded."}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : aiIsSpeaking ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "12px 14px",
                          borderRadius: 13,
                          background: "rgba(139,92,246,.08)",
                          border: "1px solid rgba(139,92,246,.18)",
                        }}
                      >
                        <div className="loader-spin" style={{ width: 16, height: 16, borderWidth: 2, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "#c4b5fd" }}>
                            AI Moderator is speaking…
                          </div>
                          <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginTop: 2 }}>
                            Preparing the opening greeting
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="chat-empty">
                        No debate turns recorded yet.
                      </div>
                    )}
                  </div>
                  {endError && (
                    <div
                      style={{
                        background: "rgba(239,68,68,.08)",
                        border: "1px solid rgba(239,68,68,.24)",
                        borderRadius: 14,
                        padding: 12,
                        color: "#fecaca",
                        fontSize: 12.5,
                        lineHeight: 1.6,
                      }}
                    >
                      {endError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showBackConfirm && (
        <div className="overlay" onClick={() => setShowBackConfirm(false)}>
          <div
            className="modal"
            style={{ maxWidth: 360 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mh">
              <div className="mh-title">Go Back?</div>
              <button
                className="mh-close"
                onClick={() => setShowBackConfirm(false)}
              >
                X
              </button>
            </div>
            <div className="mb" style={{ textAlign: "center" as const }}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>←</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>
                Are you sure you want to go back?
              </div>
              <div
                style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.75 }}
              >
                {isHost
                  ? "Your debate room will end for everyone."
                  : "Your current room view will be closed."}
              </div>
            </div>
            <div className="mf">
              <button
                className="btn-s"
                onClick={() => setShowBackConfirm(false)}
              >
                Cancel
              </button>
              <button className="btn-d" onClick={handleBackAction}>
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </div>
  );
}

function LiveAIDebateRoom({
  config,
  onEnd,
}: {
  config: any;
  onEnd: (r: any) => void;
}) {
  const { user } = useAuth();
  const candidateContext = getCandidateContext(
    user || { firstName: config.name, lastName: "" },
  );
  const { elapsedSeconds, label: elapsedTimer } = useTimer(true);
  const debateDurationSeconds = Math.max(
    60,
    Number(config.debateMinutes || 5) * 60,
  );
  const remainingSeconds = Math.max(0, debateDurationSeconds - elapsedSeconds);
  const debateTimer = fmtClock(remainingSeconds);
  const recorder = useRecorder();
  const { show: toast$, node: toastNode } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [whoTurn, setWhoTurn] = useState<"you" | "ai">(
    config.initialAiMessage ? "ai" : "you",
  );
  const [aiLocked, setAiLocked] = useState(Boolean(config.initialAiMessage));
  const [aiIsSpeaking, setAiIsSpeaking] = useState(false);
  const [speechRecording, setSpeechRecording] = useState(false);
  const [speechProcessing, setSpeechProcessing] = useState(false);
  const [userIsSpeaking, setUserIsSpeaking] = useState(false);
  const [meetingReady, setMeetingReady] = useState(() => !config.initialAiMessage);
  const [showEnd, setShowEnd] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [endingDebate, setEndingDebate] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [scores, setScores] = useState<{
    you: number | null;
    ai: number | null;
  }>({ you: null, ai: null });
  const [sessionFeedback, setSessionFeedback] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const speechRecorderRef = useRef<MediaRecorder | null>(null);
  const speechChunksRef = useRef<Blob[]>([]);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioContextRef = useRef<AudioContext | null>(null);
  const speechAnalyserRef = useRef<AnalyserNode | null>(null);
  const speechSilenceRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speechDetectedRef = useRef(false);
  const speechActiveStreakRef = useRef(0);
  const speechSilentStreakRef = useRef(0);
  const lastSpeechAtRef = useRef<number | null>(null);
  const firstSpeechAtRef = useRef<number | null>(null);
  const autoTurnStartRef = useRef("");
  const initialAiPlayedRef = useRef(false);
  const speechCaptureLockRef = useRef(false);
  const speechPlaybackTokenRef = useRef(0);
  const greetingPlaybackTokenRef = useRef(0);
  // Auto start/stop refs — startSpeechCaptureRef lets AI callbacks call the function
  // without circular deps; autoSilenceIntervalRef tracks the 8s silence timer
  const startSpeechCaptureRef = useRef<(() => void) | null>(null);
  const autoSilenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSilenceSpeechDetectedRef = useRef(false);
  const autoSilenceCounterRef = useRef(0);
  const activeSpeakerId = whoTurn === "you" ? 0 : 1;
  const hardCleanupRef = useRef(false);

  const addMsg = useCallback(
    (sender: string, senderId: number, text: string) => {
      const safeText = String(text ?? "").trim();
      debateDebug("[CHAT] Moderator message created", {
        sender,
        senderId,
        textLength: safeText.length,
        payload: safeText,
      });
      if (!safeText) return;
      const message = { sender, senderId, text: safeText, time: Date.now() };
      setMessages((current) => [...current, message]);
      debateDebug("[CHAT] Moderator message added", {
        sender,
        senderId,
        textLength: safeText.length,
        payload: safeText,
      });
    },
    [],
  );

  const playAiText = useCallback((text: string, onDone?: () => void) => {
    const playbackToken = ++speechPlaybackTokenRef.current;
    activeAudioRef.current?.pause();
    activeAudioRef.current = null;
    ttsDebug("[TTS] activeAudioRef cleanup", {
      mode: "ai-response",
      reason: "pre-playback",
    });
    setAiIsSpeaking(false);
    ttsDebug("[TTS] synthesizeDebateSpeech started", {
      mode: "ai-response",
      textLength: text.length,
      token: playbackToken,
    });
    synthesizeDebateSpeech({ text, voice: "alloy" })
      .then((audio) => {
        ttsDebug("[TTS] audio returned", {
          mode: "ai-response",
          token: playbackToken,
          hasAudio: Boolean(audio?.dataUrl),
          dataUrlLength: audio?.dataUrl?.length || 0,
        });
        if (playbackToken !== speechPlaybackTokenRef.current) return;
        if (audio?.dataUrl) {
          preloadAudioDataUrl(audio.dataUrl)
            .then(() => {
              if (playbackToken !== speechPlaybackTokenRef.current) return;
              activeAudioRef.current?.pause();
              ttsDebug("[TTS] activeAudioRef cleanup", {
                mode: "ai-response",
                reason: "pre-playAudioDataUrl",
              });
              ttsDebug("[TTS] activeAudioRef assignment", {
                mode: "ai-response",
                token: playbackToken,
              });
              activeAudioRef.current = playAudioDataUrl(
                audio.dataUrl,
                () => {
                  ttsDebug("[TTS] play started", {
                    mode: "ai-response",
                    token: playbackToken,
                  });
                  setAiIsSpeaking(true);
                },
                () => {
                  if (playbackToken !== speechPlaybackTokenRef.current) return;
                  setAiIsSpeaking(false);
                  ttsDebug("[TTS] activeAudioRef cleanup", {
                    mode: "ai-response",
                    reason: "playback-ended",
                    token: playbackToken,
                  });
                  onDone?.();
                },
              );
            })
            .catch(() => {
              if (playbackToken !== speechPlaybackTokenRef.current) return;
              ttsDebug("[TTS] activeAudioRef assignment", {
                mode: "ai-response",
                token: playbackToken,
                fallback: true,
              });
              activeAudioRef.current = playAudioDataUrl(
                audio.dataUrl,
                () => {
                  ttsDebug("[TTS] play started", {
                    mode: "ai-response",
                    token: playbackToken,
                  });
                  setAiIsSpeaking(true);
                },
                () => {
                  if (playbackToken !== speechPlaybackTokenRef.current) return;
                  setAiIsSpeaking(false);
                  ttsDebug("[TTS] activeAudioRef cleanup", {
                    mode: "ai-response",
                    reason: "playback-ended",
                    token: playbackToken,
                  });
                  onDone?.();
                },
              );
            });
          return;
        }
        setAiIsSpeaking(false);
        onDone?.();
      })
      .catch(() => {
        if (playbackToken !== speechPlaybackTokenRef.current) return;
        setAiIsSpeaking(false);
        onDone?.();
      });
  }, []);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;
    debateDebug("[CHAT] Moderator message rendered", {
      sender: lastMessage.sender,
      senderId: lastMessage.senderId,
      textLength: String(lastMessage.text ?? "").length,
      payload: lastMessage.text,
    });
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) return;
    debateDebug("[CHAT] Moderator message rendered", {
      sender: lastMessage.sender,
      senderId: lastMessage.senderId,
      textLength: String(lastMessage.text ?? "").length,
      payload: lastMessage.text,
    });
  }, [messages]);

  useEffect(() => {
    console.log("[TURN] ai turn state", {
      whoTurn,
      activeSpeakerId,
      aiLocked,
      aiIsSpeaking,
      speechRecording,
      speechProcessing,
      endingDebate,
    });
  }, [activeSpeakerId, whoTurn, aiLocked, aiIsSpeaking, speechRecording, speechProcessing, endingDebate]);

  useEffect(() => {
    const onPopState = () => {
      if (!endingDebate) {
        setShowBackConfirm(true);
        window.history.pushState(
          { liveDebateRoom: true },
          "",
          window.location.href,
        );
      }
    };
    window.history.pushState(
      { liveDebateRoom: true },
      "",
      window.location.href,
    );
    window.addEventListener("popstate", onPopState);
    return () => {
      ttsDebug("[CLEANUP] route changes", {
        endingDebate,
      });
      window.removeEventListener("popstate", onPopState);
      if (hardCleanupRef.current) {
        activeAudioRef.current?.pause();
        activeAudioRef.current = null;
        ttsDebug("[TTS] activeAudioRef cleanup", {
          mode: "ai",
          reason: "route-change-cleanup",
        });
        if (
          speechRecorderRef.current &&
          speechRecorderRef.current.state !== "inactive"
        ) {
          speechRecorderRef.current.stop();
        }
        speechRecorderRef.current = null;
        speechCaptureLockRef.current = false;
        if (speechSilenceRef.current) {
          clearInterval(speechSilenceRef.current);
          speechSilenceRef.current = null;
        }
        if (speechAudioContextRef.current) {
          speechAudioContextRef.current.close().catch(() => null);
          speechAudioContextRef.current = null;
        }
        speechPlaybackTokenRef.current += 1;
        ttsDebug("[CLEANUP] speech cancellation", {
          mode: "ai",
          reason: "route-change-cleanup",
        });
      }
    };
  }, [endingDebate]);

  useEffect(() => {
    if (!config.initialAiMessage) return;
    const text = config.initialAiMessage.trim();
    if (!text) {
      setMeetingReady(true);
      ttsDebug("[LOADER] Meeting ready", {
        mode: "ai",
        reason: "no-greeting-text",
      });
      return;
    }

    const sessionKey = String(config.sessionId || config.roomId || "ai-greeting");
    const ownerId = ++debateGreetingOwnerSeq;
    let flight = debateGreetingFlights.get(sessionKey);
    if (!flight) {
      flight = {
        ownerId,
        played: false,
        promise: (async () => {
          try {
            ttsDebug("[GREETING] triggered", {
              mode: "ai",
              sessionId: config.sessionId,
              textLength: text.length,
              ownerId,
            });
            activeAudioRef.current?.pause();
            activeAudioRef.current = null;
            ttsDebug("[TTS] activeAudioRef cleanup", {
              mode: "ai",
              reason: "pre-greeting",
              ownerId,
            });
            setAiLocked(true);
            ttsDebug("[TTS] synthesizeDebateSpeech started", {
              mode: "ai",
              textLength: text.length,
              ownerId,
            });
            const audio = await synthesizeDebateSpeech({ text, voice: "alloy" });
            ttsDebug("[TTS] audio returned", {
              mode: "ai",
              ownerId,
              hasAudio: Boolean(audio?.dataUrl),
              dataUrlLength: audio?.dataUrl?.length || 0,
            });
            if (!audio?.dataUrl) {
              return { dataUrl: null };
            }
            await preloadAudioDataUrl(audio.dataUrl);
            return { dataUrl: audio.dataUrl };
          } catch (error) {
            ttsDebug("[TTS] play error", {
              mode: "ai",
              ownerId,
              message: error instanceof Error ? error.message : String(error),
            });
            return { dataUrl: null };
          }
        })(),
      };
      debateGreetingFlights.set(sessionKey, flight);
    } else {
      flight.ownerId = ownerId;
    }

    let mounted = true;
    (async () => {
      try {
        const audio = await flight.promise;
        if (!mounted) return;
        if (flight.ownerId !== ownerId || flight.played) return;
        flight.played = true;
        setMeetingReady(true);
        ttsDebug("[LOADER] Meeting ready", {
          mode: "ai",
          sessionId: config.sessionId,
        });
        addMsg("AI Debater", 1, text);
        if (!audio?.dataUrl) {
          setAiLocked(false);
          setWhoTurn("you");
          ttsDebug("[LOADER] Meeting ready", {
            mode: "ai",
            reason: "no-audio-dataurl",
          });
          return;
        }
        ttsDebug("[TTS] activeAudioRef assignment", {
          mode: "ai",
          sessionId: config.sessionId,
        });
        activeAudioRef.current = playAudioDataUrl(
          audio.dataUrl,
          () => {
            ttsDebug("[TTS] play started", {
              mode: "ai",
              sessionId: config.sessionId,
            });
            setAiIsSpeaking(true);
          },
          () => {
            setAiIsSpeaking(false);
            activeAudioRef.current = null;
            ttsDebug("[TTS] activeAudioRef cleanup", {
              mode: "ai",
              reason: "playback-ended",
              sessionId: config.sessionId,
            });
            setAiLocked(false);
            setWhoTurn("you");
            ttsDebug("[TURN] auto-starting speech capture after AI greeting", {
              activeSpeakerId: 0,
            });
            // Auto-trigger startSpeechCapture — same as user clicking Start Speaking.
            // Re-enables mic track and starts 8s silence monitor automatically.
            setTimeout(() => {
              startSpeechCaptureRef.current?.();
            }, 300);
          },
        );
      } catch (error) {
        if (!mounted) return;
        ttsDebug("[TTS] play error", {
          mode: "ai",
          message: error instanceof Error ? error.message : String(error),
        });
        setMeetingReady(true);
        setAiLocked(false);
        setWhoTurn("you");
        ttsDebug("[LOADER] Meeting ready", {
          mode: "ai",
          reason: "greeting-failed",
        });
      }
    })();

    return () => {
      mounted = false;
      ttsDebug("[CLEANUP] speech cancellation", {
        mode: "ai",
        reason: "effect-cleanup",
        sessionId: config.sessionId,
      });
    };
  }, [config.initialAiMessage, config.sessionId]);

  function cleanupSpeechDetection() {
    debateDebug("[CLEANUP] speech detection cleanup", {
      endingDebate,
      speechRecording,
      speechProcessing,
    });
    if (speechSilenceRef.current) {
      clearInterval(speechSilenceRef.current);
      speechSilenceRef.current = null;
    }
    if (speechAudioContextRef.current) {
      speechAudioContextRef.current.close().catch(() => null);
      speechAudioContextRef.current = null;
    }
    speechAnalyserRef.current = null;
    speechDetectedRef.current = false;
    speechActiveStreakRef.current = 0;
    speechSilentStreakRef.current = 0;
    lastSpeechAtRef.current = null;
    firstSpeechAtRef.current = null;
    speechCaptureLockRef.current = false;
  }

  function stopSpeechCapture() {
    // Clear auto-silence timer — works for both manual click and auto-trigger
    if (autoSilenceIntervalRef.current) {
      clearInterval(autoSilenceIntervalRef.current);
      autoSilenceIntervalRef.current = null;
    }
    autoSilenceSpeechDetectedRef.current = false;
    autoSilenceCounterRef.current = 0;
    cleanupSpeechDetection();
    const activeRecorder = speechRecorderRef.current;
    if (activeRecorder && activeRecorder.state !== "inactive") {
      activeRecorder.stop();
    }
    // Mute mic immediately after stopping — re-enabled when user clicks Start Speaking
    const _localStream = config.stream instanceof MediaStream ? config.stream : null;
    const _audioTrack = _localStream?.getAudioTracks?.()[0];
    if (_audioTrack) _audioTrack.enabled = false;
  }

  async function startSpeechCapture() {
    // Derive candidateId safely — config shape differs between 1v1 and multi-user
    const currentUserId = String(
      config.candidateId ||
      config.userId ||
      config.participantId ||
      candidateContext?.candidateId ||
      "",
    );
    debateDebug("[SPEAK] button clicked", {
      whoTurn,
      aiLocked,
      speechRecording,
      speechProcessing,
      endingDebate,
    });
    debateDebug("[TURN] validation", {
      activeSpeakerId,
      currentUserId,
      participantId: currentUserId,
      canSpeak: whoTurn === "you" && !aiLocked && !endingDebate,
    });
    if (
      speechCaptureLockRef.current ||
      speechRecording ||
      speechProcessing ||
      aiLocked ||
      whoTurn !== "you" ||
      endingDebate
    ) {
      debateDebug("[SPEAK] blocked", {
        reason: "precondition_failed",
        activeSpeakerId,
        currentUserId,
        participantId: currentUserId,
        hasStream: Boolean(config.stream instanceof MediaStream ? config.stream : null),
        canSpeak: whoTurn === "you" && !aiLocked && !endingDebate,
        speechCaptureLockRef: speechCaptureLockRef.current,
      });
      debateDebug("[EARLY_RETURN]", {
        functionName: "startSpeechCapture",
        reason: "precondition_failed",
        values: {
          speechCaptureLockRef: speechCaptureLockRef.current,
          speechRecording,
          speechProcessing,
          aiLocked,
          whoTurn,
          endingDebate,
        },
      });
      return;
    }
    debateDebug("[SPEAK] validation passed", {
      whoTurn,
      aiLocked,
      speechRecording,
      speechProcessing,
      endingDebate,
    });
    const localStream =
      config.stream instanceof MediaStream ? config.stream : null;
    const audioTrack = localStream?.getAudioTracks?.()[0];
    if (!audioTrack) {
      debateDebug("[ERROR] speak blocked no track", {
        whoTurn,
        aiLocked,
      });
      debateDebug("[SPEAK] blocked", {
        reason: "no_audio_track",
        activeSpeakerId,
        currentUserId,
        participantId: currentUserId,
        hasStream: Boolean(localStream),
      });
      debateDebug("[EARLY_RETURN]", {
        functionName: "startSpeechCapture",
        reason: "no_audio_track",
        values: {
          hasStream: Boolean(localStream),
          whoTurn,
          aiLocked,
        },
      });
      toast$("Microphone is not available.", "error");
      return;
    }
    debateDebug("[STREAM] audio track state", {
      readyState: audioTrack.readyState,
      enabled: audioTrack.enabled,
    });
    // If mic track is disabled (muted while AI was speaking), re-enable it now
    // that user has clicked Start Speaking. Do NOT block — just enable and proceed.
    if (!audioTrack.enabled) {
      debateDebug("[MIC] re-enabling track on user click", {
        readyState: audioTrack.readyState,
      });
      audioTrack.enabled = true;
    }
    // Ensure track is live before recording — ended track causes NotSupportedError
    if (audioTrack.readyState === "ended") {
      debateDebug("[ERROR] audio track ended — requesting fresh stream", {});
      try {
        const freshStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const freshTrack = freshStream.getAudioTracks()[0];
        if (!freshTrack) {
          toast$("Microphone is not available.", "error");
          speechCaptureLockRef.current = false;
          return;
        }
        // Replace dead track with fresh one in config.stream
        if (localStream) {
          localStream.removeTrack(audioTrack);
          localStream.addTrack(freshTrack);
        }
        // Re-assign so the recorder uses the fresh track
        Object.defineProperty(freshTrack, "_fromFresh", { value: true });
        // Fall through with freshTrack
        debateDebug("[MIC] fresh stream obtained", { readyState: freshTrack.readyState });
      } catch (err: any) {
        toast$(err?.message || "Microphone access failed.", "error");
        speechCaptureLockRef.current = false;
        return;
      }
    }

    // Re-read audioTrack after possible refresh
    const liveTrack = localStream?.getAudioTracks?.()[0];
    if (!liveTrack || liveTrack.readyState === "ended") {
      toast$("Microphone track is not available. Please refresh and allow mic access.", "error");
      speechCaptureLockRef.current = false;
      return;
    }
    liveTrack.enabled = true;

    debateDebug("[RECORDER] creating", {
      mimeType: MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4",
      trackCount: 1,
      trackReadyState: liveTrack.readyState,
    });
    speechCaptureLockRef.current = true;
    const recordingStream = new MediaStream([liveTrack]);
    const mimeType = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/mp4")
      ? "audio/mp4"
      : "";
    if (!mimeType) {
      toast$("Your browser does not support audio recording.", "error");
      speechCaptureLockRef.current = false;
      return;
    }
    const recorderInstance = new MediaRecorder(recordingStream, { mimeType });
    debateDebug("[RECORDER] created", {
      mimeType,
      trackCount: recordingStream.getTracks().length,
      state: recorderInstance.state,
    });
    speechChunksRef.current = [];
    recorderInstance.ondataavailable = (event) => {
      if (event.data.size > 0) {
        speechChunksRef.current.push(event.data);
      }
      debateDebug("[RECORDER] dataavailable", {
        state: recorderInstance.state,
        blobSize: event.data.size,
      });
    };
    recorderInstance.onerror = (event: any) => {
      debateDebug("[RECORDER] error", {
        state: recorderInstance.state,
        message: event?.error?.message || event?.message || String(event),
      });
    };
    recorderInstance.onstop = async () => {
      debateDebug("[RECORDER] stop", {
        chunkCount: speechChunksRef.current.length,
      });
      setSpeechRecording(false);
      setUserIsSpeaking(false);
      const audioBlob = new Blob(speechChunksRef.current, { type: mimeType });
      debateDebug("[TRANSCRIBE] blob size", { blobSize: audioBlob.size });
      speechChunksRef.current = [];
      speechRecorderRef.current = null;
      if (!audioBlob.size) {
        speechCaptureLockRef.current = false;
        toast$("No speech was recorded.", "warn");
        return;
      }
      setSpeechProcessing(true);
      try {
        debateDebug("[TRANSCRIBE] starting", {
          blobSize: audioBlob.size,
          durationMs: 0,
        });
        const result = await transcribeDebateAudio(audioBlob);
        const transcriptText = result?.text?.trim();
        debateDebug("[TRANSCRIBE] result", {
          textLength: transcriptText?.length || 0,
        });
        if (!transcriptText) {
          toast$("No speech detected. Passing to AI.", "info");
          await sendMsg("Pass");
          return;
        }
        await sendMsg(transcriptText);
      } catch (error: any) {
        debateDebug("[ERROR] transcribe failed", {
          message: error?.message || String(error),
        });
        toast$(error?.message || "Unable to transcribe speech.", "error");
      } finally {
        setSpeechProcessing(false);
        speechCaptureLockRef.current = false;
      }
    };
    speechRecorderRef.current = recorderInstance;
    debateDebug("[RECORDER] start requested", {
      state: recorderInstance.state,
      mimeType,
    });
    recorderInstance.start();
    debateDebug("[RECORDER] started", {
      state: recorderInstance.state,
      mimeType,
    });
    setSpeechRecording(true);
    speechDetectedRef.current = false;
    speechActiveStreakRef.current = 0;
    speechSilentStreakRef.current = 0;
    lastSpeechAtRef.current = null;
    firstSpeechAtRef.current = null;

    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      const source = audioContext.createMediaStreamSource(recordingStream);
      source.connect(analyser);
      speechAudioContextRef.current = audioContext;
      speechAnalyserRef.current = analyser;
      const samples = new Uint8Array(analyser.fftSize);
      speechSilenceRef.current = setInterval(() => {
        if (
          !speechAnalyserRef.current ||
          !speechRecorderRef.current ||
          speechRecorderRef.current.state === "inactive"
        )
          return;
        speechAnalyserRef.current.getByteTimeDomainData(samples);
        let peak = 0;
        let sumSquares = 0;
        for (let index = 0; index < samples.length; index += 1) {
          const centered = samples[index] - 128;
          const amplitude = Math.abs(centered);
          if (amplitude > peak) peak = amplitude;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        const detectedSpeech = peak > 10 || rms > 5.5;
        if (detectedSpeech) {
          const now = Date.now();
          speechDetectedRef.current = true;
          speechActiveStreakRef.current += 1;
          speechSilentStreakRef.current = 0;
          firstSpeechAtRef.current = firstSpeechAtRef.current || now;
          lastSpeechAtRef.current = now;
          if (speechActiveStreakRef.current >= 3) {
            setUserIsSpeaking(true);
          }
          return;
        }
        speechActiveStreakRef.current = 0;
        if (!speechDetectedRef.current || !lastSpeechAtRef.current) {
          return;
        }
        speechSilentStreakRef.current += 1;
        if (speechSilentStreakRef.current >= 2) {
          setUserIsSpeaking(false);
        }
        const armedForSilence =
          firstSpeechAtRef.current &&
          Date.now() - firstSpeechAtRef.current >= 600;
      if (armedForSilence && Date.now() - lastSpeechAtRef.current >= 2400) {
        debateDebug("[SILENCE] silence detected", {
          activeSpeakerId,
          whoTurn,
        });
          stopSpeechCapture();
        }
      }, 120);
    } catch {
      cleanupSpeechDetection();
    }

    toast$(
      "Listening... Speak now. Recording stops after 8 seconds of silence.",
      "info",
    );

    // ── 8-second auto-stop silence monitor ─────────────────────────────────
    // Polls every 200ms. After speech is detected, counts consecutive silent
    // intervals. 8s silence (40 × 200ms) → auto-calls stopSpeechCapture().
    // Cleared immediately by stopSpeechCapture() so no double-fire on manual stop.
    if (autoSilenceIntervalRef.current) {
      clearInterval(autoSilenceIntervalRef.current);
    }
    autoSilenceSpeechDetectedRef.current = false;
    autoSilenceCounterRef.current = 0;

    const SILENCE_THRESHOLD = 8;        // RMS below this = silent
    const SILENCE_INTERVALS = 40;       // 40 × 200ms = 8 seconds
    const CHECK_INTERVAL_MS = 200;

    autoSilenceIntervalRef.current = setInterval(() => {
      // Stop monitoring if recorder is no longer active
      if (
        !speechRecorderRef.current ||
        speechRecorderRef.current.state === "inactive"
      ) {
        if (autoSilenceIntervalRef.current) {
          clearInterval(autoSilenceIntervalRef.current);
          autoSilenceIntervalRef.current = null;
        }
        return;
      }

      // Sample audio level from the existing analyser if available
      let rms = 0;
      if (speechAnalyserRef.current) {
        const buf = new Uint8Array(speechAnalyserRef.current.frequencyBinCount);
        speechAnalyserRef.current.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const val = (buf[i] - 128) / 128;
          sum += val * val;
        }
        rms = Math.sqrt(sum / buf.length) * 100;
      }

      if (rms > SILENCE_THRESHOLD) {
        // Voice detected — mark speech and reset silence counter
        autoSilenceSpeechDetectedRef.current = true;
        autoSilenceCounterRef.current = 0;
      } else if (autoSilenceSpeechDetectedRef.current) {
        // Silence after speech — count up
        autoSilenceCounterRef.current += 1;
        if (autoSilenceCounterRef.current >= SILENCE_INTERVALS) {
          debateDebug("[AUTO-SILENCE] 8s silence detected — auto-stopping", {});
          stopSpeechCapture();
        }
      }
    }, CHECK_INTERVAL_MS);
  }

  // Auto-start mic removed — user must click "Start Speaking" manually.
  // Only stop recording if AI takes over while user is mid-recording.
  // Keep ref in sync with latest startSpeechCapture so AI callbacks can call it
  useEffect(() => {
    startSpeechCaptureRef.current = startSpeechCapture;
  });

  useEffect(() => {
    if (whoTurn !== "you" && speechRecording) {
      stopSpeechCapture();
    }
  }, [whoTurn, speechRecording]);

  async function sendMsg(text: string) {
    if (!text.trim() || aiLocked || endingDebate) return;
    debateDebug("[TURN] AI response generation", {
      textLength: text.trim().length,
    });
    debateDebug("[AI] generating response", {
      textLength: text.trim().length,
    });
    addMsg(config.name, 0, text.trim());
    setChatInput("");
    setAiLocked(true);
    setWhoTurn("ai");
    try {
      const response = await respondDebate({
        sessionId: config.sessionId,
        message: text.trim(),
      });
      const replyText =
        response?.ai_response ||
        response?.response ||
        response?.reply ||
        response?.message;
      if (!replyText) throw new Error("AI response was empty.");
      debateDebug("[TURN] AI response received", {
        textLength: replyText.length,
      });
      debateDebug("[AI] response end", {
        textLength: replyText.length,
      });
      addMsg("AI Debater", 1, replyText);
      playAiText(replyText, () => {
        setAiLocked(false);
        setWhoTurn("you");
        debateDebug("[TURN] auto-starting speech capture after AI response", {
          activeSpeakerId: 0,
        });
        // Auto-trigger startSpeechCapture — same as user clicking Start Speaking.
        // Re-enables mic track and starts 8s silence monitor automatically.
        setTimeout(() => {
          startSpeechCaptureRef.current?.();
        }, 300);
      });
    } catch (error: any) {
      debateDebug("[ERROR] AI response failed", {
        message: error?.message || String(error),
      });
      setAiLocked(false);
      setWhoTurn("you");
      toast$(
        error?.message || "Unable to fetch the AI response right now.",
        "error",
      );
    }
  }

  async function handleEnd() {
    if (endingDebate || !config.sessionId) return;
    console.log("[ROOM] end requested", {
      sessionId: config.sessionId,
    });
    hardCleanupRef.current = true;
    setEndingDebate(true);
    setEndError(null);
    stopSpeechCapture();
    activeAudioRef.current?.pause();
    activeAudioRef.current = null;
    voiceEngine.cancel();
    speechPlaybackTokenRef.current += 1;
    setAiIsSpeaking(false);
    setUserIsSpeaking(false);
    if (recorder.isRecording) recorder.stop();
    try {
      const response = await endDebate(config.sessionId);
      console.log("[ROOM] end success", {
        sessionId: config.sessionId,
      });
      const mappedScores = extractDebateScores(response);
      setScores({ you: mappedScores.you, ai: mappedScores.ai });
      setSessionFeedback(response || null);
      // Use server turns if available (more complete than local messages)
      const serverTurns = response?.liveSession?.turns || response?.data?.liveSession?.turns || [];
      const transcriptData = serverTurns.length > 0 ? serverTurns : messages;
      onEnd({
        timer: elapsedTimer,
        debateLimit: fmtClock(debateDurationSeconds),
        mode: "debate",
        subMode: "ai",
        topic: config.topic,
        subject: config.subject,
        unit: config.unit,
        participants: 1,
        scores: {
          you: mappedScores.you,
          ai: mappedScores.ai,
          overall: mappedScores.overall,
          breakdown: mappedScores.breakdown,
        },
        recommendations: mappedScores.recommendations,
        hasRealScores: mappedScores.hasRealScores,
        feedback: response?.liveSession?.feedback || response?.feedback || response || null,
        transcript: transcriptData,
        meetingEnded: true,
      });
    } catch (error: any) {
      console.log("[ROOM] end failed", {
        sessionId: config.sessionId,
        message: error?.message || String(error),
      });
      setEndError(error?.message || "Unable to end the debate right now.");
      setEndingDebate(false);
      toast$(error?.message || "Unable to end the debate right now.", "error");
    }
  }

  function abortDebateSession() {
    console.log("[ROOM] leave", {
      sessionId: config.sessionId,
    });
    hardCleanupRef.current = true;
    activeAudioRef.current?.pause();
    voiceEngine.cancel();
    onEnd({
      aborted: true,
      mode: "debate",
      subMode: "ai",
      topic: config.topic,
      subject: config.subject,
      unit: config.unit,
      transcript: messages,
    });
  }

  if (!meetingReady) {
    return (
      <div className="debate-loader-screen">
        <div className="debate-loader-card">
          <div className="debate-loader-ring" />
          <div className="debate-loader-title">Preparing debate</div>
          <div className="debate-loader-sub">
            Waiting for the greeting audio to preload...
          </div>
          <div className="debate-loader-bar">
            <div className="debate-loader-fill" style={{ width: "72%" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dp-room">
      <div className="room-bar">
        <div className="room-logo">
          <div className="room-logo-ico">⚔️</div>DebateArena
        </div>
        <button
          className="btn-s"
          style={{ width: "auto", padding: "6px 10px" }}
          onClick={() => setShowBackConfirm(true)}
        >
          Back
        </button>
        <div className="rbar-div" />
        <div className="rbar-topic">
          <strong>
            {config.subject &&
              `${config.subject}${config.unit ? ` · ${config.unit}` : ""} · `}
          </strong>
          {config.topic}
        </div>
        <div className="rbar-pill pill-timer">{debateTimer}</div>
        <div
          className={`rbar-pill ${whoTurn === "you" ? "pill-turn-you" : "pill-turn-ai"}`}
        >
          {whoTurn === "you"
            ? "🎤 Your Turn"
            : speechProcessing
              ? "📝 Transcribing..."
              : aiIsSpeaking
                ? "🤖 AI Speaking..."
                : "⏳ Waiting for AI..."}
        </div>
        <button className="rbar-end" onClick={() => setShowEnd(true)}>
          ✕ End
        </button>
      </div>

      <div className="room-body">
        <div className="grid-area">
          <div className="vid-grid vg-2">
            <Tile
              p={{
                id: 0,
                name: config.name,
                stream:
                  config.stream instanceof MediaStream ? config.stream : null,
                isLocal: true,
                isHost: true,
                isStudent: true,
                micMuted: !speechRecording,
                camOn: false,
                isSpeaking: userIsSpeaking && speechRecording,
                handRaised: false,
                isMyTurn: whoTurn === "you" && !aiLocked,
                avatarColor: COLORS[0],
                energy: 88,
                reactionsReceived: 0,
                turnsTaken: 0,
              }}
            />
            <Tile
              p={{
                id: 1,
                name: "AI Debater",
                stream: null,
                isAI: true,
                isLocal: false,
                isHost: false,
                isStudent: false,
                micMuted: false,
                camOn: false,
                isSpeaking: aiIsSpeaking,
                handRaised: false,
                avatarColor: "#8b5cf6",
                energy: 92,
                reactionsReceived: 0,
                turnsTaken: 0,
              }}
            />
          </div>

          <div className="ctrl-bar">
            <div className="cg">
              <button
                className={`cbtn ${speechRecording ? "mic-live" : whoTurn === "you" && !aiLocked ? "on" : "off"}`}
                onClick={
                  speechRecording ? stopSpeechCapture : startSpeechCapture
                }
                disabled={
                  whoTurn !== "you" ||
                  aiLocked ||
                  speechProcessing ||
                  endingDebate
                }
              >
                <span className="cbtn-ico">
                  {speechRecording ? "🎙" : "🎤"}
                </span>
                <span>
                  {speechProcessing
                    ? "Transcribing..."
                    : speechRecording
                      ? "Stop Speaking"
                      : "Start Speaking"}
                </span>
              </button>
            </div>
            <div className="cg">
              <button
                className={`cbtn${aiIsSpeaking ? " speaking" : ""}`}
                disabled
              >
                <span className="cbtn-ico">🔊</span>
                <span>
                  {aiIsSpeaking
                    ? "AI Speaking"
                    : whoTurn === "you"
                      ? "Your Turn"
                      : "AI Turn"}
                </span>
              </button>
              <button
                className="end-btn"
                onClick={() => setShowEnd(true)}
                disabled={endingDebate}
              >
                {endingDebate ? "Ending..." : "End"}
              </button>
            </div>
          </div>
        </div>

        <div className="side-panel">
          <div className="panel-tabs-dark">
            <button className="ptab active">
              💬<span style={{ fontSize: 8.5, display: "block" }}>Chat</span>
            </button>
          </div>
          <div
            className="pscroll"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div className="room-info-grid">
              <div className="room-info-card live">
                <div className="room-info-label">Debate Status</div>
                <div className="room-info-title">
                  {aiIsSpeaking
                    ? "AI is speaking"
                    : whoTurn === "you"
                      ? "Your response window is open"
                      : "Waiting for AI"}
                </div>
                <div className="room-info-sub">
                  {whoTurn === "you"
                    ? "You can type or speak your argument now."
                    : "Your mic stays blocked until the AI finishes."}
                </div>
              </div>
            </div>
            <div className="chat-msgs" style={{ maxHeight: 340 }}>
              {messages.length ? (
                messages.map((message, index) => (
                  <div
                    key={`${message.sender}-${index}-${message.time}`}
                    className={`chat-msg${message.senderId === 0 ? " own" : ""}`}
                  >
                    <div className="chat-bwrap" style={{ width: "100%" }}>
                      <span className="chat-sender">{message.sender}</span>
                      <div
                        className={`chat-bubble ${message.senderId === 0 ? "bubble-own" : "bubble-o"}`}
                      >
                        {message.text}
                        {/* <FormattedAIContent content={message.text} /> */}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="chat-empty">
                  The debate will appear here as messages are exchanged.
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {scores.you !== null || scores.ai !== null ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    background: "rgba(16,185,129,.08)",
                    border: "1px solid rgba(16,185,129,.2)",
                    borderRadius: 16,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#6ee7b7",
                      fontWeight: 800,
                      marginBottom: 4,
                    }}
                  >
                    You
                  </div>
                  <div style={{ fontSize: 24, color: "#fff", fontWeight: 900 }}>
                    {scores.you ?? "-"}
                  </div>
                </div>
                <div
                  style={{
                    background: "rgba(139,92,246,.08)",
                    border: "1px solid rgba(139,92,246,.2)",
                    borderRadius: 16,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: "#c4b5fd",
                      fontWeight: 800,
                      marginBottom: 4,
                    }}
                  >
                    AI
                  </div>
                  <div style={{ fontSize: 24, color: "#fff", fontWeight: 900 }}>
                    {scores.ai ?? "-"}
                  </div>
                </div>
              </div>
            ) : null}
            {sessionFeedback && (
              <div
                style={{
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.08)",
                  borderRadius: 16,
                  padding: 14,
                  color: "#fff",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
                  Latest Feedback Snapshot
                </div>
                <FormattedAIContent
                  content={
                    sessionFeedback?.feedback ||
                    sessionFeedback?.summary ||
                    sessionFeedback
                  }
                />
              </div>
            )}
            {endError && (
              <div
                style={{
                  background: "rgba(239,68,68,.08)",
                  border: "1px solid rgba(239,68,68,.24)",
                  borderRadius: 14,
                  padding: 12,
                  color: "#fecaca",
                  fontSize: 12.5,
                  lineHeight: 1.6,
                }}
              >
                {endError}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEnd && (
        <div className="overlay" onClick={() => setShowEnd(false)}>
          <div
            className="modal"
            style={{ maxWidth: 360 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mh">
              <div className="mh-title">End Debate?</div>
              <button className="mh-close" onClick={() => setShowEnd(false)}>
                ✕
              </button>
            </div>
            <div className="mb" style={{ textAlign: "center" as const }}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>🛑</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>
                Finish this AI debate session?
              </div>
              <div
                style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.75 }}
              >
                We’ll end the live session and show the real feedback from the
                backend.
              </div>
            </div>
            <div className="mf">
              <button className="btn-s" onClick={() => setShowEnd(false)}>
                Cancel
              </button>
              <button className="btn-d" onClick={handleEnd}>
                End Debate
              </button>
            </div>
          </div>
        </div>
      )}
      {showBackConfirm && (
        <div className="overlay" onClick={() => setShowBackConfirm(false)}>
          <div
            className="modal"
            style={{ maxWidth: 360 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mh">
              <div className="mh-title">Go Back?</div>
              <button
                className="mh-close"
                onClick={() => setShowBackConfirm(false)}
              >
                ✕
              </button>
            </div>
            <div className="mb" style={{ textAlign: "center" as const }}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>←</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>
                Are you sure you want to go back?
              </div>
              <div
                style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.75 }}
              >
                Your active AI debate session will be lost.
              </div>
            </div>
            <div className="mf">
              <button
                className="btn-s"
                onClick={() => setShowBackConfirm(false)}
              >
                Cancel
              </button>
              <button className="btn-d" onClick={abortDebateSession}>
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </div>
  );
}

function DebateWaitingRoom({
  config,
  onEnterRoom,
  onClose,
}: {
  config: any;
  onEnterRoom: (cfg: any) => void;
  onClose: (result?: any) => void;
}) {
  const { user } = useAuth();
  const candidate = getCandidateContext(
    user || { id: config.candidateId, firstName: config.name, lastName: "" },
  );
  const candidateId = config.candidateId || candidate.candidateId;
  const candidateName = config.name || candidate.candidateName;
  const { show: toast$, node: toastNode } = useToast();
  const [snapshot, setSnapshot] = useState<any>(
    config.liveSession ? { liveSession: config.liveSession } : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [hostApproved, setHostApproved] = useState(
    Boolean(config.hostApproved || config.isHost),
  );
  const joinedRef = useRef(Boolean(config.isHost || config.joinedFromLink));
  const syncRef = useRef(false);
  const enteredRef = useRef(false);
  const onEnterRoomRef = useRef(onEnterRoom);

  useEffect(() => {
    onEnterRoomRef.current = onEnterRoom;
  }, [onEnterRoom]);

  const roomLink =
    config.roomLink || (config.sessionId ? genRoomLink(config.sessionId) : "");
  const liveSession = snapshot?.liveSession || config.liveSession || null;
  const participants =
    liveSession?.participants ||
    snapshot?.participants ||
    snapshot?.liveSession?.participants ||
    config.liveSession?.participants ||
    [];
  const participantCount = participants.filter(
    (participant: any) => !participant.isAi,
  ).length;
  const currentParticipant = participants.find(
    (participant: any) => String(participant.id) === String(candidateId),
  );
  const isHost = snapshot
  ? Boolean(currentParticipant?.isHost)
  : Boolean(config.isHost);
  const previousParticipantIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const currentIds = participants.map((participant: any) => String(participant.id));
    const previousIds = previousParticipantIdsRef.current;
    console.log("[PARTICIPANT] waiting-room view", {
      sessionId: config.sessionId,
      participantCount: currentIds.length,
      participantIds: currentIds,
    });
    if (currentIds.length !== previousIds.length) {
      console.log("[WAITING] participant list updated", {
        sessionId: config.sessionId,
        participantCount: currentIds.length,
        participantIds: currentIds,
      });
    }
    if (currentIds.some((id) => !previousIds.includes(id))) {
      console.log("[WAITING] participant joined", {
        sessionId: config.sessionId,
        participantIds: currentIds.filter((id) => !previousIds.includes(id)),
      });
    }
    previousParticipantIdsRef.current = currentIds;
  }, [config.sessionId, participants]);

  const syncRoom = useCallback(
    async (firstLoad = false) => {
      if (!config.sessionId || syncRef.current) return;
      syncRef.current = true;
      console.log("[ROOM] waiting-room sync start", {
        sessionId: config.sessionId,
        firstLoad,
        joined: joinedRef.current,
        isHost: config.isHost,
      });
      if (firstLoad) {
        setLoading(true);
      }
      try {
        if (!joinedRef.current && !config.isHost) {
          const joinResult = await joinDebateRoom({
            sessionId: config.sessionId,
            candidateId,
            candidateName,
          });
          if (joinResult?.liveSession) {
            console.log("[SYNC] socket participant sync", {
              sessionId: config.sessionId,
              source: "joinDebateRoom",
            });
            setSnapshot(joinResult);
          }
          joinedRef.current = true;
        }
        const room = await getDebateRoom(config.sessionId);
        setSnapshot(room);
        setError(null);
        const roomParticipants =
          room?.liveSession?.participants ||
          room?.participants ||
          [];
        console.log("[ROOM] waiting-room snapshot", {
          sessionId: config.sessionId,
          status: room?.liveSession?.status || null,
          participantCount: roomParticipants.length,
          participantNames: roomParticipants.map((participant: any) => participant?.name),
          hasLiveSession: Boolean(room?.liveSession),
          hasRoomSnapshot: Boolean(room),
        });
        const status = room?.liveSession?.status;
        if (status === "completed") {
          setMeetingEnded(true);
          return;
        }
        if (
          (status === "active" || status === "waiting_for_ai") &&
          !enteredRef.current
        ) {
          enteredRef.current = true;
          setHostApproved(true);
          const participantLiveSession = room?.liveSession || config.liveSession || null;
          const participantAiOpening =
            participantLiveSession?.currentRound?.latestAiMessage ||
            participantLiveSession?.metadata?.ai_opening ||
            "";
          onEnterRoomRef.current({
            ...config,
            candidateId,
            name: candidateName,
            liveSession: participantLiveSession,
            isHost: Boolean(
              room?.liveSession?.participants?.find(
                (participant: any) =>
                  String(participant.id) === String(candidateId),
              )?.isHost,
            ),
            hostApproved: true,
            initialAiMessage: participantAiOpening,
            teamsFromServer: participantLiveSession?.teams || null,
            turnsFromServer: participantLiveSession?.turns || [],
            skipInitialFetch: true,
          });
        }
      } catch (err: any) {
        console.log("[ROOM] waiting-room sync failed", {
          sessionId: config.sessionId,
          message: err?.message || String(err),
        });
        setError(err?.message || "Unable to load the waiting room.");
      } finally {
        syncRef.current = false;
        if (firstLoad) {
          setLoading(false);
        }
      }
    },
    [config.sessionId, candidateId, candidateName, config.isHost],
  );

  useEffect(() => {
    let closed = false;
    let pollId: ReturnType<typeof setInterval> | null = null;
    console.log("[ROOM] waiting-room polling started", {
      sessionId: config.sessionId,
    });
    syncRoom(true).catch(() => null);
    pollId = setInterval(() => {
      if (!closed) {
        syncRoom(false).catch(() => null);
      }
    }, 2500);
    return () => {
      closed = true;
      if (pollId) clearInterval(pollId);
      console.log("[CLEANUP] waiting-room polling stopped", {
        sessionId: config.sessionId,
      });
    };
  }, [config.sessionId, candidateId, candidateName, config.isHost]);

  useEffect(() => {
    const onPopState = () => {
      setShowBackConfirm(true);
      window.history.pushState(
        { debateWaitingRoom: true },
        "",
        window.location.href,
      );
    };
    window.history.pushState(
      { debateWaitingRoom: true },
      "",
      window.location.href,
    );
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  async function handleStart() {
    if (!config.sessionId) return;
    console.log("[ROOM] waiting-room start pressed", {
      sessionId: config.sessionId,
      candidateId,
      isHost,
    });
    setStarting(true);
    try {
      const result = await startDebateRoom({
        sessionId: config.sessionId,
        candidateId,
        candidateName,
      });
      console.log("[ROOM] waiting-room start success", {
        sessionId: config.sessionId,
        status: result?.liveSession?.status || null,
      });
      setHostApproved(true);
      const resultLiveSession = result?.liveSession || liveSession;
      const aiOpening =
        result?.data?.ai_opening ||
        result?.ai_opening ||
        resultLiveSession?.currentRound?.latestAiMessage ||
        "";

      // ── Pre-synthesise the AI greeting before landing on meeting page ──────
      // Same pattern as 1v1: speak API completes → land on meeting → AI speaks
      // immediately with zero delay.
      let preloadedAudioDataUrl: string | null = null;
      if (aiOpening) {
        try {
          console.log("[TTS] pre-synthesizing team greeting", { textLength: aiOpening.length });
          const audio = await synthesizeDebateSpeech({ text: aiOpening, voice: "alloy" });
          if (audio?.dataUrl) {
            await preloadAudioDataUrl(audio.dataUrl);
            preloadedAudioDataUrl = audio.dataUrl;
            console.log("[TTS] team greeting pre-loaded", { dataUrlLength: audio.dataUrl.length });
          }
        } catch (ttsErr) {
          console.warn("[TTS] pre-synthesis failed, will retry in room", ttsErr);
          // Non-fatal — room will re-attempt TTS on mount
        }
      }

      onEnterRoom({
        ...config,
        candidateId,
        name: candidateName,
        liveSession: resultLiveSession,
        isHost: true,
        hostApproved: true,
        initialAiMessage: aiOpening,
        preloadedGreetingDataUrl: preloadedAudioDataUrl,
        teamsFromServer: resultLiveSession?.teams || null,
        turnsFromServer: resultLiveSession?.turns || [],
        skipInitialFetch: true,
      });
    } catch (err: any) {
      console.log("[ROOM] waiting-room start failed", {
        sessionId: config.sessionId,
        message: err?.message || String(err),
      });
      toast$(err?.message || "Unable to start the debate.", "error");
    } finally {
      setStarting(false);
    }
  }

  async function handleLeave() {
    console.log("[ROOM] waiting-room leave", {
      sessionId: config.sessionId,
      isHost,
    });
    if (isHost && config.sessionId) {
      setEnding(true);
      try {
        await endDebateRoom(config.sessionId);
      } catch {
        // keep local close even if room-end call fails
      } finally {
        setEnding(false);
      }
    }
    onClose({ aborted: true });
  }

  function copyLink() {
    if (!roomLink) return;
    navigator.clipboard.writeText(roomLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="dp-room">
      <div className="room-bar">
        <div className="room-logo">
          <div className="room-logo-ico">⚔️</div>DebateArena
        </div>
        <button
          className="btn-s"
          style={{ width: "auto", padding: "6px 10px" }}
          onClick={() => setShowBackConfirm(true)}
        >
          Back
        </button>
        <div className="rbar-div" />
        <div className="rbar-topic">
          <strong>{config.topic}</strong> · {config.subject} · {config.unit}
        </div>
        <div
          className="rbar-pill"
          style={{
            background: "rgba(99,102,241,.14)",
            border: "1px solid rgba(99,102,241,.22)",
            color: "#c7d2fe",
          }}
        >
          Waiting Room
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: 20,
          background: "linear-gradient(180deg,#081223 0%,#0f172a 100%)",
        }}
      >
        {loading ? (
          <div
            style={{
              color: "#fff",
              display: "grid",
              placeItems: "center",
              minHeight: "60vh",
              gap: 12,
            }}
          >
            <div className="loader-spin" />
            <div style={{ fontWeight: 800 }}>Loading waiting room...</div>
          </div>
        ) : error ? (
          <div
            style={{
              maxWidth: 560,
              margin: "40px auto",
              background: "rgba(239,68,68,.08)",
              border: "1px solid rgba(239,68,68,.24)",
              borderRadius: 20,
              padding: 24,
              color: "#fff",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>
              Unable to load waiting room
            </div>
            <div
              style={{
                color: "rgba(255,255,255,.7)",
                lineHeight: 1.7,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
            <button
              className="btn-p"
              style={{ width: "auto" }}
              onClick={() => syncRoom(true).catch(() => null)}
            >
              Retry
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.15fr .85fr",
              gap: 16,
            }}
          >
            <div
              style={{
                background: "#0d1428",
                borderRadius: 22,
                border: "1px solid rgba(255,255,255,.08)",
                padding: 20,
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: "#fff",
                  marginBottom: 8,
                }}
              >
                Waiting Room
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,.62)",
                  lineHeight: 1.7,
                  marginBottom: 16,
                }}
              >
                {isHost
                  ? `Share the link and start when everyone is ready. ${participantCount} participant${participantCount === 1 ? "" : "s"} joined so far.`
                  : "You’ve joined successfully. Please wait until the host starts the debate."}
              </div>
              {roomLink && (
                <div
                  className="link-box"
                  style={{
                    background: "rgba(99,102,241,.08)",
                    borderColor: "rgba(99,102,241,.2)",
                  }}
                >
                  <div className="link-box-title">Invite Link</div>
                  <div
                    className="link-row"
                    style={{
                      background: "rgba(255,255,255,.06)",
                      borderColor: "rgba(255,255,255,.08)",
                    }}
                  >
                    <span className="link-val" style={{ color: "#c7d2fe" }}>
                      {roomLink}
                    </span>
                    <button className="copy-btn" onClick={copyLink}>
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
              <div className="host-popup-list" style={{ maxHeight: "none" }}>
                {participants.length ? (
                  participants.map((participant: any) => (
                    <div key={participant.id} className="host-popup-item">
                      <div
                        className="tile-av"
                        style={{
                          width: 38,
                          height: 38,
                          fontSize: 14,
                          background: participant.isAi
                            ? "rgba(139,92,246,.18)"
                            : "rgba(99,102,241,.18)",
                          color: "#fff",
                        }}
                      >
                        {participant.isAi
                          ? "AI"
                          : String(participant.name || "?")
                              .slice(0, 1)
                              .toUpperCase()}
                      </div>
                      <div className="host-popup-meta">
                        <div className="host-popup-name">
                          {participant.name}
                        </div>
                        <div className="host-popup-note">
                          {participant.isHost
                            ? "Host"
                            : participant.isAi
                              ? "AI Participant"
                              : "Waiting participant"}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="host-popup-note">
                    No participants joined yet.
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                background: "#0d1428",
                borderRadius: 22,
                border: "1px solid rgba(255,255,255,.08)",
                padding: 20,
                display: "grid",
                gap: 14,
                alignContent: "start",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>
                {isHost ? "Host Controls" : "Participant Status"}
              </div>
              <div style={{ color: "rgba(255,255,255,.62)", lineHeight: 1.7 }}>
                {meetingEnded
                  ? "This debate was ended before the live meeting started."
                  : isHost
                    ? "When you start, everyone will move to the debate meeting window and be shown in Team A / Team B."
                    : "Once the host starts the debate, this page will automatically move you into the meeting window."}
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  background: hostApproved
                    ? "rgba(16,185,129,.08)"
                    : "rgba(99,102,241,.08)",
                  border: hostApproved
                    ? "1px solid rgba(16,185,129,.18)"
                    : "1px solid rgba(99,102,241,.18)",
                  color: hostApproved ? "#6ee7b7" : "#c7d2fe",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {hostApproved
                  ? "Host approval granted"
                  : "Awaiting host approval"}
              </div>
              {meetingEnded ? (
                <button
                  className="btn-s"
                  onClick={() => onClose({ meetingEnded: true })}
                >
                  Back
                </button>
              ) : isHost ? (
                <button
                  className="btn-p"
                  onClick={handleStart}
                  disabled={starting || participantCount < 2}
                >
                  {starting
                    ? "Starting debate..."
                    : `Start Debate (${participantCount})`}
                </button>
              ) : (
                <button className="btn-s" disabled>
                  Waiting for host to start
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showBackConfirm && (
        <div className="overlay" onClick={() => setShowBackConfirm(false)}>
          <div
            className="modal"
            style={{ maxWidth: 360 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mh">
              <div className="mh-title">Leave Waiting Room?</div>
              <button
                className="mh-close"
                onClick={() => setShowBackConfirm(false)}
              >
                ✕
              </button>
            </div>
            <div className="mb" style={{ textAlign: "center" as const }}>
              <div style={{ fontSize: 42, marginBottom: 10 }}>←</div>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>
                Are you sure you want to go back?
              </div>
              <div
                style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.75 }}
              >
                {isHost
                  ? "Your waiting room will be closed for everyone."
                  : "You will leave this waiting room."}
              </div>
            </div>
            <div className="mf">
              <button
                className="btn-s"
                onClick={() => setShowBackConfirm(false)}
              >
                Cancel
              </button>
              <button className="btn-d" onClick={handleLeave} disabled={ending}>
                {ending ? "Leaving..." : "Proceed"}
              </button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </div>
  );
}

function IntegratedDebateRoom({
  config,
  onEnd,
}: {
  config: any;
  onEnd: (r: any) => void;
}) {
  if (config?.subMode === "multi" && config?.sessionId) {
    return <TeamDebateRoom config={config} onEnd={onEnd} />;
  }
  return <LiveAIDebateRoom config={config} onEnd={onEnd} />;
}

// ─── SETUP ───────────────────────────────────────────────────────────────────
function DebateSetup({
  onBack,
  onLaunch,
}: {
  onBack?: () => void;
  onLaunch: (cfg: any) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(
    user ? `${user.firstName} ${user.lastName}` : "",
  );
  const [subMode, setSubMode] = useState<"ai" | "multi" | "">("");
  const [debateType, setDebateType] = useState<"instant" | "schedule" | "">("");
  const [subject, setSubject] = useState("");
  const [unit, setUnit] = useState("");
  const [topic, setTopic] = useState("");
  const [custom, setCustom] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [debateMinutes, setDebateMinutes] = useState("5");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledInfo, setScheduledInfo] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinProgress, setJoinProgress] = useState(0);
  const roomId = useRef(genRoomId());
  const roomLink = genRoomLink(roomId.current);
  const { state: perm, stream, micLevel, request, stop, error } = useMicPerm();
  const { show: toast$, node: toastNode } = useToast();
  const finalTopic = topic === "__custom__" ? custom : topic;
  const availableUnits = subject ? SUBJECT_UNITS[subject] || [] : [];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) {
      roomId.current = room;
      setSubMode("multi");
      setTopic("Joined Debate");
      setSubject("General");
      setShowConfirm(true);
    }
  }, []);

  const steps = [
    { label: "Enter your name", done: name.trim().length > 0 },
    { label: "Select subject", done: !!subject },
    { label: "Select unit", done: !!unit },
    { label: "Select topic", done: !!finalTopic },
    { label: "Choose debate type", done: !!subMode },
    { label: "Instant or schedule", done: !!debateType },
    ...(subMode === "multi"
      ? []
      : [{ label: "Set debate timer", done: !!debateMinutes }]),
  ];
  const canLaunch = steps.every((s) => s.done);
  const copyLink = () => {
    navigator.clipboard.writeText(roomLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const features = [
    {
      ico: "🤖",
      t: "AI Voice Opponent",
      d: "Real-time voice rebuttals & live scoring",
    },
    {
      ico: "📊",
      t: "Analysis Reports",
      d: "Full AI-generated feedback after each debate",
    },
    {
      ico: "📋",
      t: "4-Phase Structure",
      d: "Opening → Cross-exam → Rebuttal → Closing",
    },
    { ico: "⏺", t: "Session Recording", d: "Download your debate as video" },
  ];

  async function handleJoin() {
    setJoining(true);
    try {
      const ev = {
        id: `db-${Date.now()}`,
        title: finalTopic,
        type: "debate",
        date: new Date().toISOString().slice(0, 10),
        startTime: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        subject,
        unit,
      };
      const ex = JSON.parse(
        localStorage.getItem("gradeup_cal_events_v3") || "[]",
      );
      localStorage.setItem(
        "gradeup_cal_events_v3",
        JSON.stringify([...ex, ev]),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: "gradeup_cal_events_v3" }),
      );
    } catch {}
    for (let p = 0; p <= 100; p += 20) {
      await new Promise((r) => setTimeout(r, 180));
      setJoinProgress(p);
    }
    setJoining(false);
    setShowConfirm(false);
    setJoinProgress(0);
    onLaunch({
      name,
      mode: "debate",
      subMode,
      subject,
      unit,
      topic: finalTopic,
      stream,
      micOn,
      camOn: false,
      invitees: [],
      roomId: roomId.current,
      roomLink,
      debateMinutes: Number(debateMinutes),
      maxParticipants,
    });
  }

  return (
    <div className="dp-setup">
      {/* LEFT */}
      <div className="dp-setup-left">
        <div className="dp-orbs">
          <div className="dp-orb dp-orb1" />
          <div className="dp-orb dp-orb2" />
        </div>
        <div className="dp-grid" />
        <div className="dp-setup-left-inner">
          <div className="dp-logo">
            <div className="dp-logo-ico">⚔️</div>
            <span className="dp-logo-name">DebateArena</span>
          </div>
          <div className="dp-tag">
            <div className="dp-tag-dot" />
            Debate Setup
          </div>
          <h2 className="dp-h1">
            Launch your
            <br />
            <span className="gt">Debate Room.</span>
          </h2>
          <p className="dp-p">
            {subMode === "ai"
              ? "1-on-1 · AI voice opponent · Auto turn-based scoring"
              : subMode === "multi"
                ? "Team A vs Team B · AI mediates · Group analysis report"
                : "AI-powered debate rooms with voice opponents, live scoring, and analysis."}
          </p>
          <div className="dp-feats-left">
            {features.map((f, i) => (
              <div
                key={f.t}
                className="dp-feat-left"
                style={{ animationDelay: `${0.12 + i * 0.07}s` }}
              >
                <div className="dp-feat-ico">{f.ico}</div>
                <div className="dp-feat-txt">
                  <strong>{f.t}</strong>
                  <span>{f.d}</span>
                </div>
              </div>
            ))}
          </div>
          {(subject || finalTopic) && (
            <div className="ctx-card">
              <div className="ctx-card-label">Session Context</div>
              {subject && (
                <div className="ctx-card-val">
                  📚 {subject}
                  {unit ? ` · ${unit}` : ""}
                </div>
              )}
              {finalTopic && (
                <div className="ctx-card-sub">
                  {finalTopic.length > 45
                    ? finalTopic.slice(0, 45) + "…"
                    : finalTopic}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT */}
      <div className="dp-setup-right">
        <div className="dp-setup-scroll">
          <div className="dp-setup-inner">
            {onBack && (
              <button
                className="setup-back"
                onClick={() => {
                  stop();
                  onBack();
                }}
              >
                ← Back
              </button>
            )}
            <h2 className="setup-title">⚔️ Debate Setup</h2>
            <p className="setup-sub">
              Complete all steps to launch your debate room.
            </p>

            <div className="sec-div">Identity</div>
            <div className="fi">
              <label className="fl">Your Name</label>
              <input
                className="finput"
                placeholder="e.g. Alex Chen"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
              />
            </div>

            <div className="sec-div">Academic Context</div>
            <div className="fi-row fi">
              <div>
                <label className="fl">Subject</label>
                <select
                  className="finput"
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setUnit("");
                  }}
                >
                  <option value="">Select subject…</option>
                  {SUBJECTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="fl">Unit / Module</label>
                <select
                  className="finput"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  disabled={!subject}
                >
                  <option value="">
                    {subject ? "Select unit…" : "Select subject first"}
                  </option>
                  {availableUnits.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="sec-div">Topic</div>
            <div className="fi">
              <label className="fl">Debate Topic</label>
              <select
                className="finput"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              >
                <option value="">Select a topic…</option>
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="__custom__">✏️ Custom topic…</option>
              </select>
            </div>
            {topic === "__custom__" && (
              <div className="fi">
                <label className="fl">Custom Topic</label>
                <input
                  className="finput"
                  placeholder="Your debate topic…"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                />
              </div>
            )}

            <div className="sec-div">Debate Mode</div>
            <div className="submode-grid fi">
              {[
                {
                  id: "ai",
                  ico: "🤖",
                  t: "1v1 vs AI",
                  d: "Face an AI voice opponent. Turn-based argumentation with live scoring.",
                  badge: "Popular",
                },
                {
                  id: "multi",
                  ico: "👥",
                  t: "Team A vs B",
                  d: "AI assigns teams automatically. Strict alternating turns with one-time participation.",
                  badge: "",
                },
              ].map((o) => (
                <div
                  key={o.id}
                  className={`submode-card${subMode === o.id ? " sel" : ""}`}
                  onClick={() => setSubMode(o.id as any)}
                >
                  <div className="submode-ico">{o.ico}</div>
                  <div>
                    <div className="submode-title">
                      {o.t}{" "}
                      {o.badge && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 800,
                            padding: "1px 6px",
                            borderRadius: 20,
                            background: "rgba(99,102,241,.15)",
                            color: "var(--ind)",
                            marginLeft: 4,
                          }}
                        >
                          {o.badge}
                        </span>
                      )}
                    </div>
                    <div className="submode-desc">{o.d}</div>
                  </div>
                </div>
              ))}
            </div>

            {subMode === "multi" && (
              <>
                <div className="sec-div">Timing</div>
                <div className="dtype-grid fi">
                  {[
                    {
                      id: "instant",
                      ico: "⚡",
                      t: "Start Now",
                      d: "Jump right in",
                    },
                    {
                      id: "schedule",
                      ico: "📅",
                      t: "Schedule",
                      d: "Plan for later",
                    },
                  ].map((o) => (
                    <div
                      key={o.id}
                      className={`dtype-card${debateType === o.id ? " sel" : ""}`}
                      onClick={() => setDebateType(o.id as any)}
                    >
                      <div className="dtype-ico">{o.ico}</div>
                      <div>
                        <div className="dtype-title">{o.t}</div>
                        <div className="dtype-desc">{o.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="fi">
                  <label className="fl">Number of Participants</label>
                  <input
                    className="finput"
                    type="number"
                    min={2}
                    max={12}
                    step={1}
                    value={participantCount}
                    onChange={(event) => {
                      const next = event.target.value.replace(/[^\d]/g, "");
                      setParticipantCount(next);
                    }}
                    placeholder="2 to 12"
                  />
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "var(--t2)",
                      lineHeight: 1.5,
                    }}
                  >
                    Team debates support 2 to 12 participants.
                  </div>
                </div>
              </>
            )}
            {subMode !== "multi" && (
              <div className="fi">
                <label className="fl">Debate Duration</label>
                <select
                  className="finput"
                  value={debateMinutes}
                  onChange={(e) => setDebateMinutes(e.target.value)}
                >
                  {[2, 5, 10, 15, 20].map((min) => (
                    <option key={min} value={String(min)}>
                      {min} minutes
                    </option>
                  ))}
                </select>
              </div>
            )}
            {debateType === "schedule" && (
              <div
                style={{
                  padding: 13,
                  borderRadius: 13,
                  background: "rgba(99,102,241,.05)",
                  border: "1.5px solid rgba(99,102,241,.18)",
                  marginBottom: 10,
                }}
              >
                {!scheduled ? (
                  <>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--t1)",
                        marginBottom: 6,
                      }}
                    >
                      📅 Set date & time for your debate
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--t2)",
                        marginBottom: 10,
                      }}
                    >
                      Event will be auto-saved to your calendar.
                    </div>
                    <button
                      className="btn-s"
                      style={{
                        width: "100%",
                        justifyContent: "center" as const,
                      }}
                      onClick={() => setShowSchedule(true)}
                    >
                      📅 Open Schedule Form
                    </button>
                  </>
                ) : (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 9 }}
                  >
                    <span style={{ fontSize: 22 }}>✅</span>
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: "var(--em)",
                        }}
                      >
                        Debate Scheduled
                      </div>
                      <div style={{ fontSize: 11, color: "var(--t2)" }}>
                        📅 {scheduledInfo?.date} at {scheduledInfo?.time} ·
                        Saved to Calendar
                      </div>
                    </div>
                    <button
                      className="btn-s"
                      style={{
                        marginLeft: "auto",
                        fontSize: 11,
                        padding: "5px 10px",
                      }}
                      onClick={() => {
                        setScheduled(false);
                        setShowSchedule(true);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="link-box">
              <div className="link-box-title">🔗 Room Link</div>
              <div className="link-row">
                <span className="link-val">{roomLink}</span>
                <button className="copy-btn" onClick={copyLink}>
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
              <div className="share-actions">
                <button
                  className="share-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(roomLink);
                    toast$("Link copied!", "info");
                  }}
                >
                  📧 Email
                </button>
                <button
                  className="share-btn"
                  onClick={() => {
                    if (navigator.share)
                      navigator.share({
                        title: "Join my debate",
                        url: roomLink,
                      });
                  }}
                >
                  ↗ Share
                </button>
              </div>
            </div>

            <StepsComp steps={steps} />
            {debateType !== "schedule" && (
              <button
                className="btn-p"
                onClick={() => setShowConfirm(true)}
                disabled={!canLaunch}
              >
                🚀 Launch Debate Room
              </button>
            )}
            <div style={{ height: 24 }} />
          </div>
        </div>
      </div>

      {showSchedule && (
        <ScheduleDebateModal
          config={{ topic: finalTopic, subject, unit, roomLink }}
          onSchedule={(info: any) => {
            setScheduledInfo(info);
            setScheduled(true);
            setShowSchedule(false);
            toast$("📅 Debate scheduled!", "success");
          }}
          onClose={() => setShowSchedule(false)}
        />
      )}

      {/* ── CONFIRM MODAL — includes MicPermCard ── */}
      {showConfirm && (
        <div className="overlay">
          <div className="modal dark" style={{ maxWidth: 440 }}>
            <div className="mh">
              <span className="mh-title" style={{ color: "#fff" }}>
                ⚔️ Ready to Enter?
              </span>
              <button
                className="mh-close"
                style={{
                  borderColor: "rgba(255,255,255,.1)",
                  background: "rgba(255,255,255,.06)",
                  color: "rgba(255,255,255,.6)",
                }}
                onClick={() => setShowConfirm(false)}
              >
                ✕
              </button>
            </div>
            <div className="mb" style={{ padding: "16px 20px" }}>
              {/* Session summary */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 13,
                  background: "rgba(99,102,241,.08)",
                  border: "1px solid rgba(99,102,241,.18)",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: "50%",
                    background: "var(--grad)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  ⚔️
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>
                    {name}
                  </div>
                  <div
                    style={{ fontSize: 11.5, color: "rgba(255,255,255,.5)" }}
                  >
                    {subMode === "ai"
                      ? "1v1 vs AI Debate"
                      : "Team A vs B Debate"}
                    {subject ? ` · ${subject}` : ""}
                    {unit ? ` · ${unit}` : ""}
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.07)",
                  marginBottom: 14,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "rgba(255,255,255,.8)",
                }}
              >
                💬 "{finalTopic}"
              </div>

              {/* ── MIC PERMISSION CARD ── */}
              <MicPermCard
                perm={perm}
                stream={stream}
                micLevel={micLevel}
                micOn={micOn}
                onRequest={request}
                onToggle={() => {
                  const n = !micOn;
                  setMicOn(n);
                  stream?.getAudioTracks().forEach((t) => {
                    t.enabled = n;
                  });
                }}
                error={error}
              />

              {subMode === "multi" && (
                <div
                  style={{
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: "rgba(99,102,241,.08)",
                    border: "1px solid rgba(99,102,241,.2)",
                    fontSize: 11.5,
                    color: "rgba(255,255,255,.65)",
                    lineHeight: 1.6,
                  }}
                >
                  🎯 You'll be auto-assigned to{" "}
                  <strong style={{ color: "#a5b4fc" }}>Team A</strong> or{" "}
                  <strong style={{ color: "#f9a8d4" }}>Team B</strong> by the AI
                  Moderator. Each speaker must speak for{" "}
                  <strong style={{ color: "var(--em)" }}>10 seconds</strong>{" "}
                  before they can mute and pass the turn.
                </div>
              )}
            </div>
            <div
              className="mf"
              style={{
                flexDirection: "column" as const,
                gap: 8,
                borderColor: "rgba(255,255,255,.08)",
              }}
            >
              <button
                className="btn-p"
                onClick={handleJoin}
                disabled={joining || perm !== "granted"}
                style={{ fontSize: 14 }}
              >
                {joining ? (
                  <>
                    <span className="loader-spin" />
                    Joining {joinProgress > 0 ? `${joinProgress}%` : "…"}
                  </>
                ) : perm !== "granted" ? (
                  "🎤 Allow Mic to Continue"
                ) : (
                  "⚔️ Enter Debate Room"
                )}
              </button>
              {joinProgress > 0 && (
                <div className="lo-progress">
                  <div
                    className="lo-progress-fill"
                    style={{ width: `${joinProgress}%` }}
                  />
                </div>
              )}
              <button
                className="btn-s"
                onClick={() => setShowConfirm(false)}
                disabled={joining}
                style={{
                  width: "100%",
                  justifyContent: "center" as const,
                  background: "rgba(255,255,255,.04)",
                  borderColor: "rgba(255,255,255,.1)",
                  color: "rgba(255,255,255,.5)",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {joining && (
        <DebateLoadingScreen
          title="Entering debate room"
          subtitle="Preparing teams, voice controls, and room state..."
          progress={joinProgress || 12}
        />
      )}
      {toastNode}
    </div>
  );
}

// ─── ROOM ────────────────────────────────────────────────────────────────────
function DebateRoom({
  config,
  onEnd,
}: {
  config: any;
  onEnd: (r: any) => void;
}) {
  const { subMode } = config;
  const isAI1v1 = subMode === "ai";
  const isMulti = subMode === "multi";

  // ── PARTICIPANTS ─────────────────────────────────────────────────────────
  const [participants, setParticipants] = useState<Participant[]>(() => {
    const list: Participant[] = [];
    const localStream =
      config.stream instanceof MediaStream ? config.stream : null;
    list.push({
      id: 0,
      name: config.name,
      stream: localStream,
      isLocal: true,
      isHost: true,
      isStudent: true,
      micMuted: isMulti ? true : !config.micOn,
      camOn: false,
      isSpeaking: false,
      handRaised: false,
      isMyTurn: isAI1v1,
      avatarColor: COLORS[0],
      energy: 88,
      reactionsReceived: 0,
      turnsTaken: 0,
      hasSpoken: false,
      team: undefined,
    });
    if (isAI1v1) {
      list.push({
        id: 1,
        name: "AI Debater",
        stream: null,
        isAI: true,
        micMuted: false,
        camOn: false,
        isSpeaking: false,
        handRaised: false,
        avatarColor: "#8b5cf6",
      });
    }
    if (isMulti) {
      list.push({
        id: 99,
        name: "AI Moderator",
        stream: null,
        isAI: true,
        isMed: true,
        micMuted: false,
        camOn: false,
        isSpeaking: false,
        handRaised: false,
        avatarColor: "#38bdf8",
        energy: 100,
        reactionsReceived: 0,
        turnsTaken: 0,
      });
      list.push(...createDummyStudents(10, 11));
    }
    return list;
  });

  // ── STATE ────────────────────────────────────────────────────────────────
  const [micOn, setMicOn] = useState(config.micOn !== false);
  const [panelTab, setPanelTab] = useState<string | null>(
    isMulti ? "people" : null,
  );
  const [messages, setMessages] = useState<any[]>([]);
  const [showEnd, setShowEnd] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [scores, setScores] = useState({ you: 40, ai: 38 });
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [whoTurn, setWhoTurn] = useState<"you" | "ai">("you");
  const [aiLocked, setAiLocked] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const [tileReacts, setTileReacts] = useState<Record<number, any>>({});
  const [chatInput, setChatInput] = useState("");
  const [transcript, setTranscript] = useState<any[]>([]);
  const [waitingRoom, setWaitingRoom] = useState<Participant[]>(() =>
    isMulti ? createDummyStudents(110, 4) : [],
  );
  const [showHostPopup, setShowHostPopup] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<number | null>(null);
  const [turnHistory, setTurnHistory] = useState<string[]>([]);
  const [completedRound, setCompletedRound] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const [aiIsSpeaking, setAiIsSpeaking] = useState(false);
  const [teamsAssigned, setTeamsAssigned] = useState(false);

  // ── TEAM TURN TRACKING ───────────────────────────────────────────────────
  // Which team's turn is it right now (multi only)
  const [currentTeamTurn, setCurrentTeamTurn] = useState<Team>("A");
  // Countdown seconds remaining in mandatory speaking window (null = no countdown)
  const [speakCountdown, setSpeakCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  const chatEndRef = useRef<HTMLDivElement>(null);
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionTickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initDoneRef = useRef(false);

  const { elapsedSeconds, label: elapsedTimer } = useTimer(true);
  const debateDurationSeconds = Math.max(
    60,
    Number(config.debateMinutes || 5) * 60,
  );
  const remainingSeconds = Math.max(0, debateDurationSeconds - elapsedSeconds);
  const debateTimer = fmtClock(remainingSeconds);
  const recorder = useRecorder();
  const { show: toast$, node: toastNode } = useToast();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── HELPERS ──────────────────────────────────────────────────────────────
  const updateP = useCallback(
    (id: number, patch: Partial<Participant>) =>
      setParticipants((ps) =>
        ps.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      ),
    [],
  );

  const syncLocalMic = useCallback(
    (enabled: boolean) => {
      const localStream = config.stream;
      if (localStream instanceof MediaStream) {
        localStream.getAudioTracks().forEach((t) => {
          t.enabled = enabled;
        });
      }
      setMicOn(enabled);
      updateP(0, { micMuted: !enabled, isSpeaking: enabled });
    },
    [config.stream, updateP],
  );

  function addMsg(sender: string, senderId: number, text: string) {
    const safeText = String(text ?? "").trim();
    debateDebug("[CHAT] Moderator message created", {
      sender,
      senderId,
      textLength: safeText.length,
      payload: safeText,
    });
    if (!safeText) return;
    const e = { sender, senderId, text: safeText, time: Date.now() };
    setMessages((ms) => [...ms, e]);
    setTranscript((t) => [...t, e]);
    debateDebug("[CHAT] Moderator message added", {
      sender,
      senderId,
      textLength: safeText.length,
      payload: safeText,
    });
  }

  const emitTileReaction = useCallback((targetId: number, emoji: string) => {
    const k = Date.now() + Math.random();
    setTileReacts((tr) => ({ ...tr, [targetId]: { emoji, key: k } }));
    setParticipants((ps) =>
      ps.map((p) =>
        p.id === targetId
          ? { ...p, reactionsReceived: (p.reactionsReceived || 0) + 1 }
          : p,
      ),
    );
    setTimeout(
      () =>
        setTileReacts((tr) => {
          const next = { ...tr };
          delete next[targetId];
          return next;
        }),
      1900,
    );
  }, []);

  // ── SPEAK HELPERS ────────────────────────────────────────────────────────
  const speakModerator = useCallback(
    (text: string, onDone?: () => void) => {
      const id = `mod-${Date.now()}`;
      ttsDebug("[GREETING] speakModRef called", {
        textLength: text.length,
        id,
      });
      ttsDebug("[TTS] synthesizeDebateSpeech started", {
        path: "moderator",
        textLength: text.length,
      });
      updateP(99, { isSpeaking: false });
      setAiIsSpeaking(false);
      voiceEngine.speak(
        text,
        id,
        { pitch: 1.1, rate: 0.88 },
        () => {
          updateP(99, { isSpeaking: true });
          setAiIsSpeaking(true);
        },
        () => {
          updateP(99, { isSpeaking: false });
          setAiIsSpeaking(false);
          onDone?.();
        },
      );
    },
    [updateP],
  );

  const speakDebater = useCallback(
    (text: string, onDone?: () => void) => {
      const id = `deb-${Date.now()}`;
      ttsDebug("[GREETING] speakDebaterRef called", {
        textLength: text.length,
        id,
      });
      ttsDebug("[TTS] synthesizeDebateSpeech started", {
        path: "debater",
        textLength: text.length,
      });
      updateP(1, { isSpeaking: false, isAITyping: false });
      setAiIsSpeaking(false);
      voiceEngine.speak(
        text,
        id,
        { pitch: 0.95, rate: 0.94 },
        () => {
          updateP(1, { isSpeaking: true });
          setAiIsSpeaking(true);
        },
        () => {
          updateP(1, { isSpeaking: false });
          setAiIsSpeaking(false);
          onDone?.();
        },
      );
    },
    [updateP],
  );

  const speakModRef = useRef(speakModerator);
  const speakDebaterRef = useRef(speakDebater);
  const syncMicRef = useRef(syncLocalMic);
  useEffect(() => {
    speakModRef.current = speakModerator;
  }, [speakModerator]);
  useEffect(() => {
    speakDebaterRef.current = speakDebater;
  }, [speakDebater]);
  useEffect(() => {
    syncMicRef.current = syncLocalMic;
  }, [syncLocalMic]);

  // ── MANDATORY COUNTDOWN ──────────────────────────────────────────────────
  // Starts a 10s countdown; mute button is locked until it hits 0
  const startMandatoryWindow = useCallback(() => {
    if (countdownIntervalRef.current)
      clearInterval(countdownIntervalRef.current);
    setSpeakCountdown(MANDATORY_SPEAK_SECONDS);
    let remaining = MANDATORY_SPEAK_SECONDS;
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setSpeakCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(countdownIntervalRef.current!);
        countdownIntervalRef.current = null;
        setSpeakCountdown(null);
      }
    }, 1000);
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current)
      clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = null;
    setSpeakCountdown(null);
  }, []);

  // ── TIME EXPIRED ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (remainingSeconds > 0 || timeExpired) return;
    setTimeExpired(true);
    clearCountdown();
    if (reactionTickerRef.current) clearInterval(reactionTickerRef.current);
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    setActiveSpeakerId(null);
    syncMicRef.current(false);
    setShowEnd(true);
    speakModRef.current(
      "Debate time is over. Please review and end the session.",
    );
  }, [remainingSeconds, timeExpired, clearCountdown]);

  // ── NEXT SPEAKER (multi-user, team-alternating) ───────────────────────────
  // teamOverride: force pick from a specific team (used after pass/auto)
  const pickNextSpeaker = useCallback(
    (reason = "random", teamOverride?: Team) => {
      if (!isMulti || timeExpired) return;

      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
      if (reactionTickerRef.current) clearInterval(reactionTickerRef.current);
      clearCountdown();

      setParticipants((current) => {
        // Determine which team to pick from
        const targetTeam: Team =
          teamOverride ??
          (current.find((p) => p.id === activeSpeakerId)?.team === "A"
            ? "B"
            : "A");

        // Pool: same team, not yet spoken, not AI/MED, not current speaker
        const eligible = current.filter(
          (p) =>
            !p.isAI &&
            !p.isMed &&
            p.team === targetTeam &&
            !p.hasSpoken &&
            p.id !== activeSpeakerId,
        );

        // If no one left in target team, check if all participants have spoken
        const allSpoken = current
          .filter((p) => !p.isAI && !p.isMed)
          .every((p) => p.hasSpoken);
        if (allSpoken) {
          setCompletedRound(true);
          setShowEnd(true);
          addMsg(
            "AI Moderator",
            99,
            "All participants have spoken. Great debate everyone! The round is now complete.",
          );
          return current;
        }

        // If this team is exhausted, switch to other team
        const otherTeam: Team = targetTeam === "A" ? "B" : "A";
        const fallback = current.filter(
          (p) =>
            !p.isAI &&
            !p.isMed &&
            p.team === otherTeam &&
            !p.hasSpoken &&
            p.id !== activeSpeakerId,
        );
        const pool = (eligible.length ? eligible : fallback).sort(
          (a, b) => (a.teamOrder ?? 0) - (b.teamOrder ?? 0),
        );

        if (!pool.length) {
          setCompletedRound(true);
          setShowEnd(true);
          addMsg(
            "AI Moderator",
            99,
            "All participants have spoken. Great debate everyone!",
          );
          return current;
        }

        const chosen = pool[0];
        const pickedTeam: Team = chosen.team!;
        const isLocalSpeaker = chosen.id === 0;

        setActiveSpeakerId(chosen.id);
        setCurrentTeamTurn(pickedTeam);
        setTurnHistory((h) =>
          [`Team ${pickedTeam} · ${chosen.name} · ${reason}`, ...h].slice(0, 8),
        );

        // Mute everyone while AI announces
        syncMicRef.current(false);
        const updated = current.map((p) => ({
          ...p,
          isMyTurn: p.id === chosen.id,
          isSpeaking: false,
          micMuted: true,
          handRaised: p.id === chosen.id ? false : p.handRaised,
          turnsTaken:
            p.id === chosen.id ? (p.turnsTaken || 0) + 1 : p.turnsTaken || 0,
          energy:
            p.id === chosen.id
              ? Math.max(10, (p.energy ?? 70) - 8)
              : Math.min(100, (p.energy ?? 70) + 3),
        }));

        const announcement = `Team ${pickedTeam}, ${chosen.name} — you have the floor. Please make your argument.`;
        addMsg("AI Moderator", 99, announcement);

        speakModRef.current(announcement, () => {
          // After AI finishes → open speaker mic + start mandatory window
          if (isLocalSpeaker) syncMicRef.current(true);

          setParticipants((ps) =>
            ps.map((p) => ({
              ...p,
              micMuted: p.id !== chosen.id,
              isSpeaking: false,
            })),
          );

          // Start 10s mandatory speaking countdown
          startMandatoryWindow();

          // Audience reactions
          reactionTickerRef.current = setInterval(() => {
            setParticipants((cur) => {
              const audience = cur.filter(
                (p) => p.id !== chosen.id && !p.isMed,
              );
              if (!audience.length) return cur;
              const fan = randomPick(audience);
              const emoji = randomPick(MULTI_REACTIONS);
              emitTileReaction(chosen.id, emoji);
              if (Math.random() > 0.6) {
                addMsg(
                  fan.name,
                  fan.id,
                  `${emoji} Good point, ${chosen.name}!`,
                );
              }
              return cur;
            });
          }, 3500);

          // Dummy speakers: auto-advance after a realistic window (>10s mandatory + extra)
          if (!isLocalSpeaker) {
            const dummyLine = randomPick(AI_MULTI_LINES);
            addMsg(chosen.name, chosen.id, dummyLine);
            // Mark as spoken after mandatory window
            setTimeout(() => {
              setParticipants((ps) =>
                ps.map((p) =>
                  p.id === chosen.id ? { ...p, hasSpoken: true } : p,
                ),
              );
            }, MANDATORY_SPEAK_SECONDS * 1000);
            // Then auto-advance after another few seconds
            autoAdvanceRef.current = setTimeout(
              () => {
                if (reactionTickerRef.current)
                  clearInterval(reactionTickerRef.current);
                setParticipants((ps) =>
                  ps.map((p) => ({
                    ...p,
                    micMuted: true,
                    isSpeaking: false,
                    isMyTurn: false,
                    hasSpoken: p.id === chosen.id ? true : p.hasSpoken,
                  })),
                );
                // Next team is opposite of pickedTeam
                pickNextSpeaker("auto-next", pickedTeam === "A" ? "B" : "A");
              },
              (MANDATORY_SPEAK_SECONDS + 6 + Math.floor(Math.random() * 6)) *
                1000,
            );
          }
        });

        return updated;
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      activeSpeakerId,
      timeExpired,
      emitTileReaction,
      isMulti,
      clearCountdown,
      startMandatoryWindow,
    ],
  );

  const pickNextRef = useRef(pickNextSpeaker);
  useEffect(() => {
    pickNextRef.current = pickNextSpeaker;
  }, [pickNextSpeaker]);

  // ── INIT (once) ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (initDoneRef.current) return;
    initDoneRef.current = true;

    if (isAI1v1) {
      const greeting = `Welcome ${config.name}. I will argue the opposing position on: ${config.topic}. You have the floor first. Make your opening statement.`;
      // No delay — speak immediately for snappy UX
      addMsg("AI Debater", 1, greeting);
      updateP(1, { isAITyping: true });
      speakDebaterRef.current(greeting, () => {
        updateP(1, { isAITyping: false });
        setWhoTurn("you");
        updateP(0, { isMyTurn: true });
        syncMicRef.current(true);
        startNudge();
      });
    }

    if (isMulti) {
      syncMicRef.current(false);

      // Use server-provided teams if available (from startDebateRoom API response)
      // Otherwise fall back to local assignTeams()
      const serverTeams = config.teamsFromServer as { A: any[]; B: any[] } | null | undefined;

      setParticipants((ps) => {
        let withTeams: typeof ps;
        if (serverTeams?.A && serverTeams?.B) {
          // Map server teams onto participant list
          withTeams = ps.map((p) => {
            const inA = serverTeams.A.find((t: any) => String(t.id) === String(p.id));
            const inB = serverTeams.B.find((t: any) => String(t.id) === String(p.id));
            return {
              ...p,
              team: inA ? "A" : inB ? "B" : p.team,
              teamOrder: inA?.teamOrder ?? inB?.teamOrder ?? p.teamOrder,
            };
          });
        } else {
          withTeams = assignTeams(ps);
        }

        // Use server ai_opening greeting directly — no local generation
        const intro = config.initialAiMessage || (() => {
          const teamA = withTeams.filter((p) => p.team === "A").map((p) => p.name).join(", ");
          const teamB = withTeams.filter((p) => p.team === "B").map((p) => p.name).join(", ");
          return `Welcome everyone to the debate on: ${config.topic}. I am your AI Moderator. Teams have been assigned. Team A: ${teamA}. Team B: ${teamB}. Each speaker must speak for at least 10 seconds before passing the turn. Teams will alternate strictly. Let us begin with Team A.`;
        })();

        // Pre-populate chat with turns already in the session (from API)
        const existingTurns: any[] = config.turnsFromServer || [];
        existingTurns.forEach((turn: any) => {
          if (turn?.message) {
            addMsg(turn.speakerName || "AI Moderator", 99, turn.message);
          }
        });

        // Speak the AI opening immediately — no delay
        speakModRef.current(intro, () => {
          pickNextRef.current("opening", "A");
        });

        // Only add the intro message if it wasn't already in turnsFromServer
        const alreadyInTurns = existingTurns.some((t: any) => t?.message === intro);
        if (!alreadyInTurns) {
          addMsg("AI Moderator", 99, intro);
        }

        setTeamsAssigned(true);
        setCurrentTeamTurn("A");
        return withTeams;
      });
    }

    return () => {
      voiceEngine.cancel();
      clearCountdown();
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
      if (reactionTickerRef.current) clearInterval(reactionTickerRef.current);
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── NUDGE (1v1 only) ──────────────────────────────────────────────────────
  function startNudge() {
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    nudgeTimerRef.current = setTimeout(() => {
      setNudge("💬 Your turn to argue!");
      setTimeout(() => setNudge(null), 5000);
    }, 10000);
  }
  function clearNudge() {
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    setNudge(null);
  }

  // ── AI DEBATER RESPONSE (1v1) ─────────────────────────────────────────────
  const triggerAI = useCallback(() => {
    if (aiLocked) return;
    setAiLocked(true);
    clearNudge();
    setWhoTurn("ai");
    updateP(0, { isMyTurn: false });
    updateP(1, { isAITyping: true, isSpeaking: false });
    syncMicRef.current(false);

    aiTimerRef.current = setTimeout(
      () => {
        const response = randomPick(AI_LINES);
        addMsg("AI Debater", 1, response);
        setScores((s) => ({
          you: Math.min(s.you + Math.floor(Math.random() * 5), 100),
          ai: Math.min(s.ai + Math.floor(Math.random() * 4), 100),
        }));
        setTranscript((t) => {
          if (t.length > 0 && t.length % 4 === 0)
            setPhaseIdx((i) => Math.min(i + 1, PHASES.length - 1));
          return t;
        });

        speakDebaterRef.current(response, () => {
          setWhoTurn("you");
          updateP(0, { isMyTurn: true });
          setAiLocked(false);
          syncMicRef.current(true);
          startNudge();
        });
      },
      600 + Math.random() * 800,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiLocked, updateP]);

  // ── MIC TOGGLE ────────────────────────────────────────────────────────────
  const toggleMic = () => {
    // ── 1v1 ──────────────────────────────────────────────────────────────
    if (isAI1v1) {
      if (whoTurn !== "you") {
        toast$("Wait for the AI to finish speaking.", "warn");
        return;
      }
      const next = !micOn;
      syncLocalMic(next);
      if (!next && !aiLocked) setTimeout(() => triggerAI(), 500);
      return;
    }

    // ── Multi ─────────────────────────────────────────────────────────────
    if (!isMulti) return;

    if (aiIsSpeaking) {
      toast$("Wait for the AI Moderator to finish.", "warn");
      return;
    }
    if (activeSpeakerId !== 0) {
      toast$("Only the current speaker can pass the turn.", "warn");
      return;
    }

    // Mandatory 10s window — mute button is locked
    if (speakCountdown != null && speakCountdown > 0) {
      toast$(
        `🔒 Must speak for ${speakCountdown}s more before passing.`,
        "warn",
      );
      return;
    }

    if (!micOn) return;

    // Mark local user as hasSpoken and pass turn to next team
    syncLocalMic(false);
    clearCountdown();
    if (reactionTickerRef.current) clearInterval(reactionTickerRef.current);
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

    // Mark local user's turn as done
    setParticipants((ps) =>
      ps.map((p) => ({
        ...p,
        micMuted: true,
        isSpeaking: false,
        isMyTurn: false,
        hasSpoken: p.isLocal ? true : p.hasSpoken,
      })),
    );

    addMsg("AI Moderator", 99, `${config.name} has completed their turn.`);

    const localParticipant = participants.find((p) => p.isLocal);
    const doneTeam: Team = localParticipant?.team ?? "A";
    const nextTeam: Team = doneTeam === "A" ? "B" : "A";

    setTimeout(() => pickNextRef.current("manual-pass", nextTeam), 600);
  };

  const toggleHand = () => {
    const me = participants.find((p) => p.isLocal);
    updateP(0, { handRaised: !me?.handRaised });
    if (!me?.handRaised) toast$("✋ Hand raised!", "warn");
  };

  function sendMsg(text: string) {
    if (!text.trim()) return;
    addMsg(config.name, 0, text.trim());
    setChatInput("");
    updateP(0, { isSpeaking: true });
    setTimeout(() => updateP(0, { isSpeaking: false }), 1200);

    if (isAI1v1) {
      clearNudge();
      if (whoTurn === "you" && !aiLocked) setTimeout(() => triggerAI(), 400);
    }

    if (isMulti && !activeSpeakerId && !aiIsSpeaking && Math.random() > 0.4) {
      const line = randomPick(AI_MULTI_LINES);
      setTimeout(() => {
        addMsg("AI Moderator", 99, line);
        speakModRef.current(line);
      }, 1800);
    }
  }

  function sendReaction(emoji: string) {
    setShowReactions(false);
    const targetId = isMulti ? (activeSpeakerId ?? 0) : 0;
    emitTileReaction(targetId, emoji);
  }

  // ── ADMIT ─────────────────────────────────────────────────────────────────
  function admitParticipant(id: number) {
    const target = waitingRoom.find((p) => p.id === id);
    if (!target) return;
    setWaitingRoom((w) => w.filter((p) => p.id !== id));
    // Assign team to newly admitted participant
    setParticipants((ps) => {
      const teamACnt = ps.filter((p) => p.team === "A").length;
      const teamBCnt = ps.filter((p) => p.team === "B").length;
      const assignedTeam: Team = teamACnt <= teamBCnt ? "A" : "B";
      const teamOrder = ps.filter(
        (p) => p.team === assignedTeam && !p.isAI && !p.isMed,
      ).length;
      return [
        ...ps,
        {
          ...target,
          id: Math.max(...ps.map((p) => p.id)) + 1,
          team: assignedTeam,
          teamOrder,
        },
      ];
    });
    setShowHostPopup(false);
    addMsg("AI Moderator", 99, `${target.name} was admitted to the room.`);
  }
  function admitAll() {
    waitingRoom.forEach((p) => admitParticipant(p.id));
    setShowHostPopup(false);
  }

  // ── END ───────────────────────────────────────────────────────────────────
  function handleEnd() {
    voiceEngine.cancel();
    clearCountdown();
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    if (reactionTickerRef.current) clearInterval(reactionTickerRef.current);
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);

    participants.forEach((p) => {
      if (p.isLocal && p.stream instanceof MediaStream)
        p.stream.getTracks().forEach((t) => t.stop());
    });
    if (config.stream instanceof MediaStream) {
      config.stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    }
    if (recorder.isRecording) recorder.stop();

    const verdict = isMulti ? buildMultiVerdict(participants) : null;
    onEnd({
      timer: elapsedTimer,
      debateLimit: fmtClock(debateDurationSeconds),
      mode: "debate",
      subMode,
      topic: config.topic,
      subject: config.subject,
      unit: config.unit,
      participants: participants.filter((p) => !p.isAI && !p.isMed).length,
      scores,
      recorder,
      hasRecording: !!recorder.blob,
      participantsList: participants,
      transcript,
      meetingEnded: true,
      verdict,
    });
  }

  // ── DERIVED ───────────────────────────────────────────────────────────────
  const n = participants.length;
  const gc = n <= 1 ? "vg-1" : n === 2 ? "vg-2" : "vg-4";
  const fmt = (d: number) =>
    new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const me = participants.find((p) => p.isLocal);
  const activeSpeaker = participants.find((p) => p.id === activeSpeakerId);
  const liveStudents = participants.filter((p) => !p.isAI && !p.isMed);
  const teamAStudents = liveStudents
    .filter((p) => p.team === "A")
    .sort((a, b) => (a.teamOrder ?? 0) - (b.teamOrder ?? 0));
  const teamBStudents = liveStudents
    .filter((p) => p.team === "B")
    .sort((a, b) => (a.teamOrder ?? 0) - (b.teamOrder ?? 0));
  const moderators = participants.filter((p) => p.isAI || p.isMed);
  const leaderboard = [...liveStudents]
    .sort(
      (a, b) =>
        (b.reactionsReceived || 0) +
        (b.turnsTaken || 0) -
        ((a.reactionsReceived || 0) + (a.turnsTaken || 0)),
    )
    .slice(0, 5);

  // Is local user the active speaker?
  const localIsActive = activeSpeakerId === 0;
  // Is mute button locked by mandatory window?
  const muteIsLocked =
    isMulti && localIsActive && speakCountdown != null && speakCountdown > 0;

  const micBtnLabel = isMulti
    ? muteIsLocked
      ? `${speakCountdown}s`
      : localIsActive && micOn
        ? "Pass Turn"
        : micOn
          ? "Live"
          : "Muted"
    : micOn
      ? "Mute"
      : "Unmute";

  const micBtnClass = muteIsLocked
    ? "locked"
    : micOn
      ? isMulti && localIsActive
        ? "mic-live"
        : "on"
      : "off";

  // Team turn badge for top bar
  const teamTurnPill =
    isMulti && teamsAssigned ? (
      <div
        className={`rbar-pill pill-team-${currentTeamTurn === "A" ? "a" : "b"}`}
      >
        {aiIsSpeaking ? "🎙 AI Moderator…" : `Team ${currentTeamTurn}'s Turn`}
      </div>
    ) : null;

  return (
    <div className="dp-room">
      {recorder.isRecording && (
        <div className="rec-overlay">⏺ REC {elapsedTimer}</div>
      )}

      {/* TOP BAR */}
      <div className="room-bar">
        <div className="room-logo">
          <div className="room-logo-ico">⚔️</div>DebateArena
        </div>
        <div className="rbar-div" />
        <div className="rbar-topic">
          <strong>
            {config.subject &&
              `${config.subject}${config.unit ? ` · ${config.unit}` : ""} · `}
          </strong>
          {config.topic}
        </div>
        <div className="rbar-pill pill-timer">{debateTimer}</div>
        {recorder.isRecording && (
          <div className="rbar-pill pill-rec">
            <div className="pill-rec-dot" />
            REC
          </div>
        )}
        {isAI1v1 && (
          <div
            className={`rbar-pill ${whoTurn === "you" ? "pill-turn-you" : "pill-turn-ai"}`}
          >
            {whoTurn === "you" ? "🎤 Your Turn" : "🤖 AI Speaking…"}
          </div>
        )}
        {isMulti && teamTurnPill}
        <button className="rbar-end" onClick={() => setShowEnd(true)}>
          ✕ End
        </button>
      </div>

      <div className="room-body">
        <div className="grid-area">
          {/* TILES */}
          {isMulti ? (
            <div className="team-stage">
              <div className="moderator-row">
                {moderators.map((p) => (
                  <Tile
                    key={p.id}
                    p={p}
                    reaction={tileReacts[p.id]}
                    nudge={undefined}
                    countdown={null}
                  />
                ))}
              </div>
              <div className="team-vs-grid">
                {(["A", "B"] as Team[]).map((team) => {
                  const teamStudents =
                    team === "A" ? teamAStudents : teamBStudents;
                  const isActiveTeam = currentTeamTurn === team;
                  return (
                    <section
                      key={team}
                      className={`team-box team-box-${team.toLowerCase()}${isActiveTeam ? " active" : ""}`}
                    >
                      <div className="team-box-head">
                        <div>
                          <div className="team-box-title">Team {team}</div>
                          <div className="team-box-sub">
                            {teamStudents.filter((p) => p.hasSpoken).length}/
                            {teamStudents.length} spoke
                          </div>
                        </div>
                        <span
                          className={
                            team === "A" ? "team-a-badge" : "team-b-badge"
                          }
                        >
                          {team === "A" ? "Left" : "Right"}
                        </span>
                      </div>
                      <div className="team-member-grid">
                        {teamStudents.map((p) => (
                          <Tile
                            key={p.id}
                            p={p}
                            reaction={tileReacts[p.id]}
                            nudge={p.isLocal && nudge ? nudge : undefined}
                            countdown={
                              p.isLocal && localIsActive ? speakCountdown : null
                            }
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={`vid-grid ${gc}`}>
              {participants.map((p) => (
                <Tile
                  key={p.id}
                  p={p}
                  reaction={tileReacts[p.id]}
                  nudge={p.isLocal && nudge ? nudge : undefined}
                  countdown={p.isLocal && localIsActive ? speakCountdown : null}
                />
              ))}
            </div>
          )}

          {/* CONTROL BAR */}
          <div className="ctrl-bar">
            <div className="cg">
              {/* Mic / Pass Turn button */}
              <button
                className={`cbtn ${micBtnClass}`}
                onClick={toggleMic}
                title={
                  muteIsLocked
                    ? `Must speak for ${speakCountdown}s more`
                    : undefined
                }
              >
                <span className="cbtn-ico">
                  {muteIsLocked ? "🔒" : micOn ? "🎤" : "🔇"}
                </span>
                <span>{micBtnLabel}</span>
              </button>

              <div style={{ position: "relative" }}>
                <button
                  className={`cbtn${showReactions ? " hi" : ""}`}
                  onClick={() => setShowReactions((r) => !r)}
                >
                  <span className="cbtn-ico">😊</span>
                  <span>React</span>
                </button>
                {showReactions && (
                  <div className="react-pop">
                    {(isMulti ? MULTI_REACTIONS : REACTIONS).map((r) => (
                      <button
                        key={r}
                        className="react-emoji"
                        onClick={() => sendReaction(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                className={`cbtn${me?.handRaised ? " amb" : ""}`}
                onClick={toggleHand}
              >
                <span className="cbtn-ico">✋</span>
                <span>{me?.handRaised ? "Lower" : "Raise"}</span>
              </button>
            </div>

            <div className="cg">
              <button
                className={`cbtn${aiIsSpeaking ? " speaking" : ""}`}
                disabled
                style={{ cursor: "default" }}
              >
                <span className="cbtn-ico">🔊</span>
                <span>{aiIsSpeaking ? "AI Live" : "AI Voice"}</span>
              </button>

              <button
                className={`cbtn${recorder.isRecording ? " rec" : ""}`}
                onClick={() =>
                  recorder.isRecording
                    ? (recorder.stop(), toast$("Recording stopped", "warn"))
                    : recorder
                        .start(
                          config.stream instanceof MediaStream
                            ? config.stream
                            : null,
                        )
                        .then((ok: boolean) =>
                          ok
                            ? toast$("🔴 Recording started", "info")
                            : toast$("Share screen to record", "error"),
                        )
                }
              >
                <span className="cbtn-ico">⏺</span>
                <span>{recorder.isRecording ? "Stop" : "Record"}</span>
              </button>

              <button className="cbtn em" onClick={() => setShowAnalysis(true)}>
                <span className="cbtn-ico">📊</span>
                <span>Analysis</span>
              </button>
            </div>

            <div className="cg">
              <button
                className={`cbtn${panelTab === "people" ? " hi" : ""}`}
                onClick={() =>
                  setPanelTab((p) => (p === "people" ? null : "people"))
                }
              >
                <span className="cbtn-ico">👥</span>
                <span>People ({n})</span>
              </button>
              <button
                className={`cbtn${panelTab === "chat" ? " hi" : ""}`}
                onClick={() =>
                  setPanelTab((p) => (p === "chat" ? null : "chat"))
                }
              >
                <span className="cbtn-ico">💬</span>
                <span>Chat</span>
              </button>
              <button
                className={`cbtn${panelTab === "score" ? " hi" : ""}`}
                onClick={() =>
                  setPanelTab((p) => (p === "score" ? null : "score"))
                }
              >
                <span className="cbtn-ico">🏆</span>
                <span>{isMulti ? "Teams" : "Score"}</span>
              </button>
              <button className="end-btn" onClick={() => setShowEnd(true)}>
                End
              </button>
            </div>
          </div>
        </div>

        {/* SIDE PANEL */}
        {panelTab && (
          <div className="side-panel">
            {/* Multi-user info grid */}
            {isMulti && panelTab !== "chat" && (
              <div className="room-info-grid">
                <div className="room-info-card live">
                  <div className="room-info-label">Floor Control</div>
                  <div className="room-info-title">
                    {aiIsSpeaking
                      ? "AI Moderator speaking…"
                      : activeSpeaker
                        ? `${activeSpeaker.name} (Team ${activeSpeaker.team})`
                        : "Selecting speaker…"}
                  </div>
                  <div className="room-info-sub">
                    {localIsActive && micOn
                      ? muteIsLocked
                        ? `🔒 Must speak ${speakCountdown}s more before passing`
                        : "🎤 You're live — mute yourself to pass the turn"
                      : "Mic opens automatically after AI announces you"}
                  </div>
                </div>
                <div className="room-info-card game">
                  <div className="room-info-label">Turn Order</div>
                  <div className="room-chip-row">
                    <span
                      className="room-chip"
                      style={{ background: "rgba(99,102,241,.25)" }}
                    >
                      Team A:{" "}
                      {
                        participants.filter(
                          (p) => p.team === "A" && p.hasSpoken,
                        ).length
                      }
                      /{participants.filter((p) => p.team === "A").length}
                    </span>
                    <span
                      className="room-chip"
                      style={{ background: "rgba(236,72,153,.25)" }}
                    >
                      Team B:{" "}
                      {
                        participants.filter(
                          (p) => p.team === "B" && p.hasSpoken,
                        ).length
                      }
                      /{participants.filter((p) => p.team === "B").length}
                    </span>
                  </div>
                </div>
                <div className="room-info-card host">
                  <div className="room-info-label">Host Control</div>
                  <div className="host-popup-wrap">
                    <button
                      className="host-popup-btn"
                      onClick={() => setShowHostPopup((v) => !v)}
                    >
                      <span className="host-popup-dot" />
                      <span>
                        Host Admit{" "}
                        {waitingRoom.length ? `(${waitingRoom.length})` : ""}
                      </span>
                    </button>
                    {showHostPopup && (
                      <div className="host-popup-panel">
                        <div className="host-popup-head">
                          <div>
                            <div
                              className="room-info-label"
                              style={{ marginBottom: 3 }}
                            >
                              Waiting Room
                            </div>
                            <div className="host-popup-title">
                              {waitingRoom.length
                                ? `${waitingRoom.length} student${waitingRoom.length > 1 ? "s" : ""} waiting`
                                : "No one waiting"}
                            </div>
                          </div>
                          <button
                            className="host-popup-close"
                            onClick={() => setShowHostPopup(false)}
                          >
                            ×
                          </button>
                        </div>
                        {waitingRoom.length > 0 ? (
                          <>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                marginBottom: 8,
                              }}
                            >
                              <button
                                className="btn-s"
                                style={{ fontSize: 11, padding: "5px 10px" }}
                                onClick={admitAll}
                              >
                                Admit all
                              </button>
                            </div>
                            <div className="host-popup-list">
                              {waitingRoom.map((p) => (
                                <div key={p.id} className="host-popup-item">
                                  <div
                                    className="p-av"
                                    style={{
                                      background:
                                        (p.avatarColor || avColor(p.name)) +
                                        "28",
                                      color: p.avatarColor || avColor(p.name),
                                    }}
                                  >
                                    {avInit(p.name)}
                                  </div>
                                  <div className="host-popup-meta">
                                    <div className="host-popup-name">
                                      {p.name}
                                    </div>
                                    <div className="host-popup-note">
                                      Waiting
                                    </div>
                                  </div>
                                  <button
                                    className="btn-s"
                                    style={{
                                      fontSize: 11,
                                      padding: "5px 10px",
                                    }}
                                    onClick={() => admitParticipant(p.id)}
                                  >
                                    Admit
                                  </button>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="host-popup-sub">
                            New join requests appear here.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!chatExpanded && (
              <div className="panel-tabs-dark">
                {[
                  { id: "people", ico: "👥", lbl: "People" },
                  { id: "chat", ico: "💬", lbl: "Chat" },
                  ...(isAI1v1
                    ? [{ id: "score", ico: "🏆", lbl: "Score" }]
                    : [{ id: "score", ico: "🏆", lbl: "Teams" }]),
                ].map((t) => (
                  <button
                    key={t.id}
                    className={`ptab${panelTab === t.id ? " active" : ""}`}
                    onClick={() => setPanelTab(t.id)}
                  >
                    {t.ico}
                    <span style={{ fontSize: 8.5, display: "block" }}>
                      {t.lbl}
                    </span>
                  </button>
                ))}
                <button
                  className="ptab ptab-cls"
                  onClick={() => setPanelTab(null)}
                >
                  ✕
                </button>
              </div>
            )}

            {/* PEOPLE */}
            {panelTab === "people" && (
              <div className="pscroll">
                <div
                  style={{
                    padding: "8px 10px 3px",
                    fontSize: 9.5,
                    fontWeight: 800,
                    textTransform: "uppercase" as const,
                    letterSpacing: ".08em",
                    color: "rgba(255,255,255,.22)",
                  }}
                >
                  {n} in room
                </div>
                {isMulti && (
                  <div style={{ padding: "6px 9px 0" }}>
                    {(["A", "B"] as Team[]).map((team) => (
                      <div
                        key={team}
                        style={{
                          marginBottom: 8,
                          padding: "9px 11px",
                          borderRadius: 11,
                          background:
                            team === "A"
                              ? "rgba(99,102,241,.08)"
                              : "rgba(236,72,153,.08)",
                          border: `1px solid ${team === "A" ? "rgba(99,102,241,.22)" : "rgba(236,72,153,.22)"}`,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            textTransform: "uppercase" as const,
                            letterSpacing: ".08em",
                            color: getTeamColor(team),
                            marginBottom: 5,
                          }}
                        >
                          Team {team} —{" "}
                          {
                            participants.filter(
                              (p) => p.team === team && p.hasSpoken,
                            ).length
                          }
                          /{participants.filter((p) => p.team === team).length}{" "}
                          spoke
                        </div>
                        {participants
                          .filter((p) => p.team === team)
                          .map((p) => (
                            <div
                              key={p.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "5px 7px",
                                borderRadius: 7,
                                marginBottom: 3,
                                background: "rgba(255,255,255,.04)",
                              }}
                            >
                              <div
                                className="p-av"
                                style={{
                                  width: 22,
                                  height: 22,
                                  fontSize: 9,
                                  background:
                                    (p.avatarColor || avColor(p.name)) + "28",
                                  color: p.avatarColor || avColor(p.name),
                                }}
                              >
                                {avInit(p.name)}
                              </div>
                              <span
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  color: "#fff",
                                  flex: 1,
                                }}
                              >
                                {p.name}
                                {p.isLocal ? " (You)" : ""}
                              </span>
                              {p.hasSpoken && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    padding: "2px 6px",
                                    borderRadius: 20,
                                    background: "rgba(16,185,129,.15)",
                                    color: "#6ee7b7",
                                  }}
                                >
                                  Done
                                </span>
                              )}
                              {p.isSpeaking && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    padding: "2px 6px",
                                    borderRadius: 20,
                                    background: "rgba(99,102,241,.2)",
                                    color: "#a5b4fc",
                                  }}
                                >
                                  Speaking
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                )}
                {isMulti && waitingRoom.length > 0 && (
                  <div style={{ padding: "0 9px 10px" }}>
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "rgba(245,158,11,.08)",
                        border: "1px solid rgba(245,158,11,.16)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11.5,
                            fontWeight: 800,
                            color: "#fde68a",
                          }}
                        >
                          Waiting room
                        </div>
                        <button
                          className="btn-s"
                          style={{ fontSize: 11, padding: "5px 10px" }}
                          onClick={admitAll}
                        >
                          Admit all
                        </button>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column" as const,
                          gap: 6,
                        }}
                      >
                        {waitingRoom.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "8px 9px",
                              borderRadius: 10,
                              background: "rgba(255,255,255,.05)",
                            }}
                          >
                            <div
                              className="p-av"
                              style={{
                                background:
                                  (p.avatarColor || avColor(p.name)) + "28",
                                color: p.avatarColor || avColor(p.name),
                              }}
                            >
                              {avInit(p.name)}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: "#fff",
                                }}
                              >
                                {p.name}
                              </div>
                              <div
                                style={{
                                  fontSize: 10.5,
                                  color: "rgba(255,255,255,.45)",
                                }}
                              >
                                Awaiting admission
                              </div>
                            </div>
                            <button
                              className="btn-s"
                              style={{ fontSize: 11, padding: "5px 10px" }}
                              onClick={() => admitParticipant(p.id)}
                            >
                              Admit
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {!isMulti && (
                  <div className="p-list">
                        {participants.map((p) => {
                          const c = p.avatarColor || avColor(p.name);
                          const participantSpeaking =
                            p.isLocal && localIsActive ? userIsSpeaking : false;
                          return (
                            <div
                              key={p.id}
                              className={`p-row${participantSpeaking ? " spk" : ""}`}
                            >
                          <div
                            className="p-av"
                            style={{ background: c + "28", color: c }}
                          >
                            {p.isAI ? "🤖" : p.isMed ? "🎙️" : avInit(p.name)}
                          </div>
                          <div className="p-info">
                              <div className="p-name">
                                {p.name}
                                {p.isLocal ? " (You)" : ""}
                                {participantSpeaking ? " 🔊" : ""}
                                {p.handRaised ? " ✋" : ""}
                              </div>
                            <div className="p-role">
                              {p.isHost
                                ? "👑 Host"
                                : p.isMed
                                  ? "🎙️ Mediator"
                                  : p.isAI
                                    ? "🤖 AI"
                                    : "👤 Participant"}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              color: p.micMuted ? "var(--red)" : "var(--em)",
                            }}
                          >
                            {p.micMuted ? "🔇" : "🎤"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CHAT */}
            {panelTab === "chat" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column" as const,
                  height: "100%",
                  minHeight: 0,
                }}
              >
                <button
                  className="chat-side-head"
                  onClick={() => setChatExpanded((v) => !v)}
                >
                  <div>
                    <div className="chat-side-title">Room Chat</div>
                    <div className="chat-side-sub">
                      {chatExpanded
                        ? "Tap to restore sidebar"
                        : "Tap to expand chat"}
                    </div>
                  </div>
                  <span>{chatExpanded ? "Collapse" : "Expand"}</span>
                </button>
                <div className="pscroll" style={{ flex: 1 }}>
                  <div className="chat-msgs">
                    {messages.length === 0 && (
                      <div className="chat-empty">
                        No messages yet.
                        <br />
                        {isAI1v1
                          ? "Type your argument — AI will respond!"
                          : "Start the conversation!"}
                      </div>
                    )}
                    {messages.map((m, i) => {
                      const own = m.sender === config.name;
                      const c = COLORS[m.senderId % COLORS.length];
                      return (
                        <div key={i} className={`chat-msg${own ? " own" : ""}`}>
                          {!own && (
                            <div
                              className="chat-av-sm"
                              style={{ background: c + "28", color: c }}
                            >
                              {m.sender[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="chat-bwrap">
                            {!own && (
                              <span className="chat-sender">{m.sender}</span>
                            )}
                            <div
                              className={`chat-bubble ${own ? "bubble-own" : "bubble-o"}`}
                            >
                              {m.text}
                            </div>
                            <span className="chat-time">{fmt(m.time)}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                </div>
                <div className="chat-ia">
                  <textarea
                    className="chat-inp"
                    placeholder={
                      isAI1v1
                        ? whoTurn === "you"
                          ? "Type your argument…"
                          : "AI is speaking…"
                        : aiIsSpeaking
                          ? "AI Moderator speaking…"
                          : "Send a message…"
                    }
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMsg(chatInput);
                      }
                    }}
                    rows={1}
                    disabled={isAI1v1 && whoTurn === "ai"}
                  />
                  <button
                    className="chat-send"
                    onClick={() => sendMsg(chatInput)}
                    disabled={isAI1v1 && whoTurn === "ai"}
                  >
                    ➤
                  </button>
                </div>
              </div>
            )}

            {/* SCORE — 1v1 */}
            {panelTab === "score" && isAI1v1 && (
              <div className="pscroll">
                <div className="dp-wrap">
                  <div className="turn-box">
                    <div className="turn-label">Current Turn</div>
                    <div
                      className={`turn-ind ${whoTurn === "you" ? "your" : "ai"}`}
                    >
                      <div
                        className="turn-dot"
                        style={{
                          background:
                            whoTurn === "you" ? "var(--em)" : "var(--vio)",
                        }}
                      />
                      <div>
                        <div className="turn-name">
                          {whoTurn === "you" ? "Your Turn" : "AI Debater"}
                        </div>
                        <div className="turn-hint">
                          {whoTurn === "you"
                            ? micOn
                              ? "🎤 Mic open — mute to pass"
                              : "Speak or type your argument"
                            : aiIsSpeaking
                              ? "AI is speaking…"
                              : "AI is formulating…"}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="score-card">
                    <div className="sc-title">📊 Live Score</div>
                    <div className="sc-row">
                      <div className="sc-item">
                        <div className="sc-val sc-u">{scores.you}</div>
                        <div className="sc-lbl">You</div>
                      </div>
                      <div className="sc-vs">VS</div>
                      <div className="sc-item">
                        <div className="sc-val sc-a">{scores.ai}</div>
                        <div className="sc-lbl">AI</div>
                      </div>
                    </div>
                    <div className="sc-bar">
                      <div
                        className="sc-fill"
                        style={{
                          width: `${(scores.you / (scores.you + scores.ai || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="phase-card">
                    <div className="sc-title" style={{ marginBottom: 6 }}>
                      📋 Debate Phases
                    </div>
                    {PHASES.map((ph, i) => (
                      <div
                        key={i}
                        className={`ph-step${i === phaseIdx ? " act" : ""}`}
                      >
                        <div
                          className={`ph-num ${i < phaseIdx ? "ph-done" : i === phaseIdx ? "ph-act" : "ph-pend"}`}
                        >
                          {i < phaseIdx ? "✓" : i + 1}
                        </div>
                        <span className="ph-lbl">{ph}</span>
                      </div>
                    ))}
                    {phaseIdx < PHASES.length - 1 && (
                      <button
                        className="btn-p"
                        style={{ marginTop: 9, fontSize: 11, padding: "7px" }}
                        onClick={() =>
                          setPhaseIdx((i) => Math.min(i + 1, PHASES.length - 1))
                        }
                      >
                        Next Phase →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TEAMS PANEL — Multi */}
            {panelTab === "score" && isMulti && (
              <div className="pscroll">
                <div className="dp-wrap">
                  {/* Team A vs B summary */}
                  <div className="score-card">
                    <div className="sc-title">⚔️ Team Standings</div>
                    <div className="sc-row">
                      <div className="sc-item">
                        <div
                          className="sc-val"
                          style={{ color: "#a5b4fc", fontSize: 20 }}
                        >
                          {participants
                            .filter((p) => p.team === "A")
                            .reduce(
                              (s, p) =>
                                s +
                                (p.reactionsReceived || 0) +
                                (p.turnsTaken || 0) * 2,
                              0,
                            )}
                        </div>
                        <div className="sc-lbl">Team A pts</div>
                      </div>
                      <div className="sc-vs">VS</div>
                      <div className="sc-item">
                        <div
                          className="sc-val"
                          style={{ color: "#f9a8d4", fontSize: 20 }}
                        >
                          {participants
                            .filter((p) => p.team === "B")
                            .reduce(
                              (s, p) =>
                                s +
                                (p.reactionsReceived || 0) +
                                (p.turnsTaken || 0) * 2,
                              0,
                            )}
                        </div>
                        <div className="sc-lbl">Team B pts</div>
                      </div>
                    </div>
                    <div className="sc-bar">
                      {(() => {
                        const aScore = participants
                          .filter((p) => p.team === "A")
                          .reduce(
                            (s, p) =>
                              s +
                              (p.reactionsReceived || 0) +
                              (p.turnsTaken || 0) * 2,
                            0,
                          );
                        const bScore = participants
                          .filter((p) => p.team === "B")
                          .reduce(
                            (s, p) =>
                              s +
                              (p.reactionsReceived || 0) +
                              (p.turnsTaken || 0) * 2,
                            0,
                          );
                        const total = aScore + bScore || 1;
                        return (
                          <div
                            className="sc-fill"
                            style={{
                              width: `${(aScore / total) * 100}%`,
                              background:
                                "linear-gradient(90deg,#6366f1,#a5b4fc)",
                            }}
                          />
                        );
                      })()}
                    </div>
                  </div>

                  {/* Current turn status */}
                  <div className="turn-box">
                    <div className="turn-label">Current Floor</div>
                    <div
                      className={`team-turn-bar ${currentTeamTurn === "A" ? "a" : "b"}`}
                    >
                      <div className="team-turn-dot" />
                      <div>
                        <div className="turn-name">
                          {aiIsSpeaking
                            ? "AI Moderator announcing…"
                            : activeSpeaker
                              ? `${activeSpeaker.name} · Team ${activeSpeaker.team}`
                              : `Team ${currentTeamTurn}'s turn`}
                        </div>
                        <div className="turn-hint">
                          {localIsActive && micOn
                            ? muteIsLocked
                              ? `🔒 Must speak ${speakCountdown}s more`
                              : "Mute yourself to pass to the other team"
                            : "Mic opens automatically when you're called"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Turn history */}
                  <div className="phase-card">
                    <div className="sc-title" style={{ marginBottom: 6 }}>
                      Turn History
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column" as const,
                        gap: 5,
                      }}
                    >
                      {turnHistory.length === 0 && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,.45)",
                          }}
                        >
                          No turns yet.
                        </div>
                      )}
                      {turnHistory.map((entry, idx) => (
                        <div
                          key={`${entry}-${idx}`}
                          style={{
                            padding: "7px 10px",
                            borderRadius: 9,
                            background: "rgba(255,255,255,.05)",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "rgba(255,255,255,.8)",
                          }}
                        >
                          {entry}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Leaderboard */}
                  <div className="score-card">
                    <div className="sc-title">Leaderboard</div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column" as const,
                        gap: 8,
                      }}
                    >
                      {leaderboard.map((p, idx) => (
                        <div
                          key={p.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                            padding: "9px 10px",
                            borderRadius: 10,
                            background: "rgba(255,255,255,.05)",
                            border: "1px solid rgba(255,255,255,.08)",
                          }}
                        >
                          <div
                            style={{
                              width: 22,
                              textAlign: "center" as const,
                              fontSize: 12,
                              fontWeight: 800,
                              color:
                                idx === 0 ? "#fbbf24" : "rgba(255,255,255,.65)",
                            }}
                          >
                            {idx + 1}
                          </div>
                          <div
                            className="p-av"
                            style={{
                              background:
                                (p.avatarColor || avColor(p.name)) + "28",
                              color: p.avatarColor || avColor(p.name),
                            }}
                          >
                            {avInit(p.name)}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: "#fff",
                              }}
                            >
                              {p.name}
                              {p.team === "A" && (
                                <span
                                  className="team-a-badge"
                                  style={{ marginLeft: 4 }}
                                >
                                  A
                                </span>
                              )}
                              {p.team === "B" && (
                                <span
                                  className="team-b-badge"
                                  style={{ marginLeft: 4 }}
                                >
                                  B
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: 10.5,
                                color: "rgba(255,255,255,.45)",
                              }}
                            >
                              Turns {p.turnsTaken || 0} ·{" "}
                              {p.reactionsReceived || 0} reacts
                              {p.hasSpoken ? " · Done" : ""}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ANALYSIS MODAL */}
      {showAnalysis && (
        <div className="analysis-bg" onClick={() => setShowAnalysis(false)}>
          <div className="analysis-box" onClick={(e) => e.stopPropagation()}>
            <div className="analysis-head">
              <div className="analysis-title">🏆 Debate Analysis</div>
              <button
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "rgba(255,255,255,.06)",
                  cursor: "pointer",
                  color: "rgba(255,255,255,.55)",
                  fontSize: 12,
                }}
                onClick={() => setShowAnalysis(false)}
              >
                ✕
              </button>
            </div>
            <div className="analysis-body">
              <div className="a-sec">
                <div className="a-sec-title">📌 Session</div>
                <div
                  style={{
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: "rgba(99,102,241,.08)",
                    border: "1px solid rgba(99,102,241,.18)",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#fff",
                    marginBottom: 7,
                  }}
                >
                  "{config.topic}"
                </div>
                <div
                  style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}
                >
                  {[
                    `⏱ ${elapsedTimer}`,
                    `⌛ ${debateTimer} left`,
                    `👥 ${participants.filter((p) => !p.isAI && !p.isMed).length} participant(s)`,
                    `💬 ${transcript.length} exchanges`,
                  ].map((t) => (
                    <span
                      key={t}
                      style={{
                        padding: "3px 10px",
                        borderRadius: 20,
                        background: "rgba(255,255,255,.06)",
                        border: "1px solid rgba(255,255,255,.1)",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "rgba(255,255,255,.55)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              {isMulti && (
                <div className="a-sec">
                  <div className="a-sec-title">⚔️ Team Scores</div>
                  <div className="score-grid-3">
                    {(["A", "B"] as Team[]).map((team) => (
                      <div key={team} className="score-box">
                        <div
                          className="score-box-val"
                          style={{
                            color: team === "A" ? "#a5b4fc" : "#f9a8d4",
                          }}
                        >
                          {participants
                            .filter((p) => p.team === team)
                            .reduce(
                              (s, p) =>
                                s +
                                (p.reactionsReceived || 0) +
                                (p.turnsTaken || 0) * 2,
                              0,
                            )}
                        </div>
                        <div className="score-box-lbl">Team {team}</div>
                      </div>
                    ))}
                    <div className="score-box">
                      <div
                        className="score-box-val"
                        style={{ color: "var(--em)" }}
                      >
                        {
                          participants.filter(
                            (p) => !p.isAI && !p.isMed && p.hasSpoken,
                          ).length
                        }
                      </div>
                      <div className="score-box-lbl">Spoke</div>
                    </div>
                  </div>
                </div>
              )}
              {isAI1v1 && (
                <div className="a-sec">
                  <div className="a-sec-title">📊 Score</div>
                  <div className="score-grid-3">
                    <div className="score-box">
                      <div
                        className="score-box-val"
                        style={{ color: "var(--sky)" }}
                      >
                        {scores.you}
                      </div>
                      <div className="score-box-lbl">Your Score</div>
                    </div>
                    <div className="score-box">
                      <div
                        className="score-box-val"
                        style={{ color: "var(--vio)" }}
                      >
                        {scores.ai}
                      </div>
                      <div className="score-box-lbl">AI Score</div>
                    </div>
                    <div className="score-box">
                      <div
                        className="score-box-val"
                        style={{ color: "var(--em)" }}
                      >
                        {Math.abs(scores.you - scores.ai)}
                      </div>
                      <div className="score-box-lbl">Margin</div>
                    </div>
                  </div>
                  <div
                    className="verdict-box"
                    style={{
                      borderColor:
                        scores.you > scores.ai
                          ? "rgba(16,185,129,.4)"
                          : "rgba(99,102,241,.4)",
                      background:
                        scores.you > scores.ai
                          ? "rgba(16,185,129,.07)"
                          : "rgba(99,102,241,.07)",
                    }}
                  >
                    <div
                      className="verdict-win"
                      style={{
                        color:
                          scores.you > scores.ai ? "var(--em)" : "var(--ind3)",
                      }}
                    >
                      {scores.you > scores.ai ? "🥇 You Win!" : "🤖 AI Wins"}
                    </div>
                    <div
                      className="verdict-lbl"
                      style={{ color: "rgba(255,255,255,.5)" }}
                    >
                      Score: {Math.max(scores.you, scores.ai)} pts
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="analysis-foot">
              <button
                className="btn-s"
                style={{
                  background: "rgba(255,255,255,.05)",
                  borderColor: "rgba(255,255,255,.1)",
                  color: "rgba(255,255,255,.55)",
                }}
                onClick={() => setShowAnalysis(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* END MODAL */}
      {showEnd && (
        <div className="overlay" onClick={() => setShowEnd(false)}>
          <div
            className="modal dark"
            style={{ maxWidth: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mh">
              <span className="mh-title" style={{ color: "#fff" }}>
                End Debate?
              </span>
              <button
                className="mh-close"
                style={{
                  borderColor: "rgba(255,255,255,.1)",
                  background: "rgba(255,255,255,.06)",
                  color: "rgba(255,255,255,.6)",
                }}
                onClick={() => setShowEnd(false)}
              >
                ✕
              </button>
            </div>
            <div
              className="mb"
              style={{ textAlign: "center" as const, padding: "20px" }}
            >
              <div style={{ fontSize: 42, marginBottom: 10 }}>🏁</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: "#fff",
                  marginBottom: 6,
                }}
              >
                {completedRound
                  ? "All turns are finished."
                  : "End this debate?"}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: "rgba(255,255,255,.4)",
                  lineHeight: 1.75,
                }}
              >
                Elapsed:{" "}
                <strong style={{ color: "var(--ind3)" }}>{elapsedTimer}</strong>
                <br />
                Remaining:{" "}
                <strong style={{ color: "var(--amb)" }}>{debateTimer}</strong>
                {recorder.isRecording && (
                  <>
                    <br />
                    <span style={{ color: "var(--em)" }}>
                      ✅ Recording will be saved
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="mf">
              <button
                className="btn-s"
                style={{
                  background: "rgba(255,255,255,.04)",
                  borderColor: "rgba(255,255,255,.1)",
                  color: "rgba(255,255,255,.5)",
                }}
                onClick={() => setShowEnd(false)}
              >
                {completedRound ? "Review Room" : "Keep Going"}
              </button>
              <button className="btn-d" onClick={handleEnd}>
                {completedRound ? "Show Results" : "End Debate"}
              </button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </div>
  );
}

// ─── RESULTS ─────────────────────────────────────────────────────────────────
function DebateResults({ result, onNew }: { result: any; onNew: () => void }) {
  const verdict = result.verdict;
  const winner = verdict?.winner;
  const runnerUp = verdict?.runnerUp;
  const insights = verdict?.insights || [];
  const winnerTeam = verdict?.winnerTeam;

  // ── Derived from API response ──────────────────────────────────────────────
  const breakdown = result.scores?.breakdown || null;
  const recommendations = result.recommendations || null;
  const feedback = result.feedback || null;
  const feedbackText =
    feedback?.feedback_text ||
    feedback?.summary ||
    feedback?.text ||
    (typeof feedback === "string" ? feedback : null);
  const turns: any[] = Array.isArray(result.transcript) ? result.transcript : [];

  // ── Download transcript as PDF (plain-text based, no lib needed) ──────────
  const downloadTranscriptPDF = () => {
    const lines: string[] = [];
    lines.push("DEBATE TRANSCRIPT");
    lines.push("=================");
    lines.push(`Topic: ${result.topic || "N/A"}`);
    lines.push(`Subject: ${result.subject || "N/A"}${result.unit ? " · " + result.unit : ""}`);
    lines.push(`Duration: ${result.timer || "N/A"}`);
    lines.push(`Date: ${new Date().toLocaleDateString()}`);
    lines.push("");
    lines.push("SCORES");
    lines.push("------");
    if (breakdown) {
      lines.push(`  Reasoning        : ${breakdown.reasoning ?? "-"}`);
      lines.push(`  Textbook Knowledge: ${breakdown.textbook_knowledge ?? "-"}`);
      lines.push(`  Argumentation    : ${breakdown.argumentation ?? "-"}`);
      lines.push(`  Communication    : ${breakdown.communication ?? "-"}`);
      lines.push(`  Total Score      : ${breakdown.total ?? result.scores?.you ?? "-"}`);
    } else {
      lines.push(`  Your Score : ${result.scores?.you ?? "-"}`);
      lines.push(`  AI Score   : ${result.scores?.ai ?? "-"}`);
      lines.push(`  Overall    : ${result.scores?.overall ?? "-"}`);
    }
    lines.push("");
    if (feedbackText) {
      lines.push("FEEDBACK");
      lines.push("--------");
      lines.push(feedbackText);
      lines.push("");
    }
    if (recommendations?.needs_retry != null) {
      lines.push("RECOMMENDATIONS");
      lines.push("---------------");
      lines.push(`  Attempt #${recommendations.attempt_number ?? "-"}`);
      if (recommendations.retry_suggestion) lines.push(`  Retry suggestion: ${recommendations.retry_suggestion}`);
      if (recommendations.next_topic_suggestion) lines.push(`  Next topic: ${recommendations.next_topic_suggestion}`);
      lines.push("");
    }
    if (turns.length > 0) {
      lines.push("TRANSCRIPT");
      lines.push("----------");
      turns.forEach((t: any, i: number) => {
        const speaker = t.speakerName || t.sender || (t.role === "assistant" ? "AI Debater" : "You");
        const msg = t.message || t.transcript || t.text || "";
        const time = t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : "";
        lines.push(`[${i + 1}] ${speaker}${time ? " (" + time + ")" : ""}`);
        lines.push(msg);
        lines.push("");
      });
    }
    const text = lines.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debate_transcript_${result.topic?.replace(/\s+/g, "_").slice(0, 30) || "session"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="results-page">
      <div className="res-trophy">🏆</div>
      <h2 className="res-title">
        {result.meetingEnded ? "Session Ended" : "Debate Complete!"}
      </h2>
      <p className="res-sub">
        ⚔️ Session lasted{" "}
        <strong style={{ color: "var(--ind)" }}>{result.timer}</strong> with{" "}
        <strong>{result.participants}</strong> participant(s).{" "}
        <span style={{ color: "var(--em)" }}>📅 Saved to Calendar.</span>
      </p>
      {result.subject && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 14,
            flexWrap: "wrap" as const,
            justifyContent: "center" as const,
          }}
        >
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 20,
              background: "rgba(99,102,241,.08)",
              border: "1px solid rgba(99,102,241,.18)",
              fontSize: 11.5,
              fontWeight: 700,
              color: "var(--ind)",
            }}
          >
            📚 {result.subject}
          </span>
          {result.unit && (
            <span
              style={{
                padding: "4px 12px",
                borderRadius: 20,
                background: "rgba(16,185,129,.07)",
                border: "1px solid rgba(16,185,129,.2)",
                fontSize: 11.5,
                fontWeight: 700,
                color: "var(--em)",
              }}
            >
              📖 {result.unit}
            </span>
          )}
        </div>
      )}
      <div className="res-stats">
        {[
          { l: "Duration", v: result.timer, i: "⏱️" },
          { l: "Participants", v: result.participants, i: "👥" },
          { l: "Exchanges", v: result.transcript?.length || 0, i: "💬" },
        ].map((s, i) => (
          <div
            key={s.l}
            className="res-stat"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className="res-stat-ico">{s.i}</div>
            <div className="res-stat-val">{s.v}</div>
            <div className="res-stat-lbl">{s.l}</div>
          </div>
        ))}
      </div>

      {result.subMode === "multi" && winner && (
        <>
          {result.scores?.viewer && (
            <div style={{ width: "100%", maxWidth: 520, marginBottom: 16 }}>
              <div
                style={{
                  background: "var(--surf)",
                  border: "1px solid var(--bdr)",
                  borderRadius: 18,
                  padding: 18,
                  boxShadow: "var(--sh)",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: ".08em",
                    textTransform: "uppercase" as const,
                    color: "var(--t3)",
                    marginBottom: 10,
                  }}
                >
                  Your Score
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap" as const,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 900,
                        color: "var(--t1)",
                      }}
                    >
                      {result.scores.viewer.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--t3)" }}>
                      {result.scores.viewer.team
                        ? `Team ${result.scores.viewer.team}`
                        : "Participant"}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 34,
                      fontWeight: 900,
                      color: "var(--ind)",
                    }}
                  >
                    {result.scores.viewer.score}
                  </div>
                </div>
              </div>
            </div>
          )}
          {winnerTeam && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 20px",
                borderRadius: 16,
                background:
                  winnerTeam === "A"
                    ? "rgba(99,102,241,.1)"
                    : "rgba(236,72,153,.1)",
                border: `1.5px solid ${winnerTeam === "A" ? "rgba(99,102,241,.3)" : "rgba(236,72,153,.3)"}`,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: winnerTeam === "A" ? "#a5b4fc" : "#f9a8d4",
                  marginBottom: 4,
                }}
              >
                🏅 Team {winnerTeam} Wins!
              </div>
              <div style={{ fontSize: 13, color: "var(--t2)" }}>
                Team {winnerTeam}:{" "}
                {verdict?.[winnerTeam === "A" ? "teamAScore" : "teamBScore"]}{" "}
                pts vs Team {winnerTeam === "A" ? "B" : "A"}:{" "}
                {verdict?.[winnerTeam === "A" ? "teamBScore" : "teamAScore"]}{" "}
                pts
              </div>
            </div>
          )}
          <div className="res-verdict">
            <div className="res-panel">
              <div className="res-panel-title">MVP</div>
              <div className="res-winner-name">{winner.name}</div>
              <div style={{ marginBottom: 6 }}>
                {winner.team === "A" ? (
                  <span className="team-a-badge">Team A</span>
                ) : (
                  <span className="team-b-badge">Team B</span>
                )}
              </div>
              <div className="res-winner-sub">
                Best speaker based on reactions, turns completed, and audience
                engagement.
              </div>
            </div>
            <div className="res-panel">
              <div className="res-panel-title">Top Rankings</div>
              <div className="res-rank">
                <div className="res-rank-row">
                  <div>
                    <div className="res-rank-name">{winner.name}</div>
                    <div className="res-rank-role">
                      Winner · Team {winner.team}
                    </div>
                  </div>
                  <div className="res-rank-score">{winner.debateScore}</div>
                </div>
                {runnerUp && (
                  <div className="res-rank-row">
                    <div>
                      <div className="res-rank-name">{runnerUp.name}</div>
                      <div className="res-rank-role">
                        Runner-up · Team {runnerUp.team}
                      </div>
                    </div>
                    <div className="res-rank-score">{runnerUp.debateScore}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {Array.isArray(result.scores?.participantScores) &&
            result.scores.participantScores.length > 0 && (
              <div style={{ width: "100%", maxWidth: 720, marginBottom: 18 }}>
                <div
                  style={{
                    background: "var(--surf)",
                    border: "1px solid var(--bdr)",
                    borderRadius: 18,
                    padding: 18,
                    boxShadow: "var(--sh)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: ".08em",
                      textTransform: "uppercase" as const,
                      color: "var(--t3)",
                      marginBottom: 12,
                    }}
                  >
                    Individual Scores
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    {result.scores.participantScores.map((entry: any) => (
                      <div
                        key={entry.participantId}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: 14,
                          background: entry.isViewer
                            ? "rgba(99,102,241,.08)"
                            : "var(--surf2)",
                          border: entry.isViewer
                            ? "1px solid rgba(99,102,241,.2)"
                            : "1px solid var(--bdr)",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: "var(--t1)",
                            }}
                          >
                            {entry.name}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--t3)" }}>
                            {entry.team ? `Team ${entry.team}` : "Participant"}
                            {entry.isViewer ? " · You" : ""}
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 900,
                            color: "var(--ind)",
                          }}
                        >
                          {entry.score}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          {insights.length > 0 && (
            <div className="res-insights">
              {insights.map((entry: string, idx: number) => (
                <div key={idx} className="res-insight">
                  <div className="res-insight-title">Analysis {idx + 1}</div>
                  <div className="res-insight-text">{entry}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {result.subMode === "ai" && (
        <div style={{ width: "100%", maxWidth: 520, marginBottom: 18, display: "flex", flexDirection: "column" as const, gap: 14 }}>

          {/* ── Score Card ── */}
          <div style={{ background: "var(--surf)", border: "1px solid var(--bdr)", borderRadius: 18, padding: 18, boxShadow: "var(--sh)" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "var(--t3)", marginBottom: 10 }}>
              Final Score
            </div>
            {breakdown ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    { label: "Reasoning", value: breakdown.reasoning },
                    { label: "Knowledge", value: breakdown.textbook_knowledge },
                    { label: "Argumentation", value: breakdown.argumentation },
                    { label: "Communication", value: breakdown.communication },
                  ].map((item) => (
                    <div key={item.label} style={{ background: "var(--surf2)", borderRadius: 12, padding: "10px 12px", textAlign: "center" as const }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "var(--ind)" }}>{item.value ?? "-"}</div>
                      <div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 700, marginTop: 2 }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: "center" as const, padding: "12px 0", borderTop: "1px solid var(--bdr)" }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: "var(--em)" }}>{breakdown.total ?? result.scores?.you ?? "-"}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>Total Score</div>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "center" }}>
                <div style={{ textAlign: "center" as const }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: "var(--ind)" }}>{result.scores?.you || 0}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>You</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--t4)" }}>VS</div>
                <div style={{ textAlign: "center" as const }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: "var(--vio)" }}>{result.scores?.ai || 0}</div>
                  <div style={{ fontSize: 11, color: "var(--t3)" }}>AI</div>
                </div>
              </div>
            )}
            {!breakdown && (
              <div style={{ textAlign: "center" as const, marginTop: 10, fontSize: 15, fontWeight: 800, color: (result.scores?.you || 0) >= (result.scores?.ai || 0) ? "var(--em)" : "var(--vio)" }}>
                {(result.scores?.you || 0) >= (result.scores?.ai || 0) ? "🥇 You won the debate!" : "🤖 AI won this round!"}
              </div>
            )}
          </div>

          {/* ── Feedback Card ── */}
          {feedbackText && (
            <div style={{ background: "var(--surf)", border: "1px solid var(--bdr)", borderRadius: 18, padding: 18, boxShadow: "var(--sh)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "var(--t3)", marginBottom: 10 }}>
                💡 Feedback
              </div>
              <div style={{ fontSize: 13, color: "var(--t1)", lineHeight: 1.7 }}>{feedbackText}</div>
            </div>
          )}

          {/* ── Recommendations Card ── */}
          {recommendations && (
            <div style={{ background: "var(--surf)", border: "1px solid var(--bdr)", borderRadius: 18, padding: 18, boxShadow: "var(--sh)" }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "var(--t3)", marginBottom: 10 }}>
                📈 Recommendations
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {recommendations.attempt_number && (
                  <div style={{ fontSize: 12.5, color: "var(--t2)" }}>
                    Attempt <strong style={{ color: "var(--ind)" }}>#{recommendations.attempt_number}</strong> on this topic
                  </div>
                )}
                {recommendations.needs_retry && recommendations.retry_suggestion && (
                  <div style={{ fontSize: 12.5, color: "var(--t2)", padding: "8px 12px", background: "rgba(239,68,68,.07)", borderRadius: 10, border: "1px solid rgba(239,68,68,.15)" }}>
                    🔁 {recommendations.retry_suggestion}
                  </div>
                )}
                {recommendations.next_topic_suggestion && (
                  <div style={{ fontSize: 12.5, color: "var(--t2)", padding: "8px 12px", background: "rgba(16,185,129,.07)", borderRadius: 10, border: "1px solid rgba(16,185,129,.15)" }}>
                    ➡️ Next topic: <strong>{recommendations.next_topic_suggestion}</strong>
                  </div>
                )}
                {recommendations.history_based_suggestions?.length > 0 && (
                  <div style={{ fontSize: 12, color: "var(--t3)" }}>
                    {recommendations.history_based_suggestions.map((s: string, i: number) => (
                      <div key={i} style={{ marginTop: 4 }}>• {s}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Transcript Card ── */}
          {turns.length > 0 && (
            <div style={{ background: "var(--surf)", border: "1px solid var(--bdr)", borderRadius: 18, padding: 18, boxShadow: "var(--sh)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "var(--t3)" }}>
                  💬 Transcript ({turns.length} turns)
                </div>
                <button
                  className="btn-s"
                  style={{ fontSize: 11, padding: "5px 12px", width: "auto" }}
                  onClick={downloadTranscriptPDF}
                >
                  📥 Download
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 10, maxHeight: 320, overflowY: "auto" as const }}>
                {turns.map((t: any, i: number) => {
                  const isAI = t.role === "assistant" || t.speakerId === "ai-debater";
                  const speaker = t.speakerName || (isAI ? "AI Debater" : "You");
                  const msg = t.message || t.transcript || t.text || "";
                  return (
                    <div key={t.id || i} style={{ display: "flex", flexDirection: "column" as const, alignItems: isAI ? "flex-start" : "flex-end" as const }}>
                      <div style={{ fontSize: 10, color: "var(--t4)", marginBottom: 3, fontWeight: 700 }}>{speaker}</div>
                      <div style={{
                        maxWidth: "85%",
                        padding: "8px 12px",
                        borderRadius: 12,
                        fontSize: 12.5,
                        lineHeight: 1.6,
                        background: isAI ? "rgba(139,92,246,.1)" : "rgba(99,102,241,.12)",
                        border: isAI ? "1px solid rgba(139,92,246,.2)" : "1px solid rgba(99,102,241,.2)",
                        color: "var(--t1)",
                      }}>
                        {msg}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="res-actions">
        {result.hasRecording && (
          <button className="btn-s" onClick={() => result.recorder?.download("debate.webm")}>
            📥 Download Recording
          </button>
        )}
        {turns.length > 0 && result.subMode !== "ai" && (
          <button className="btn-s" onClick={downloadTranscriptPDF}>
            📄 Download Transcript
          </button>
        )}
        <button
          className="btn-p"
          style={{ fontSize: 13, width: "auto", padding: "11px 24px" }}
          onClick={onNew}
        >
          Back
        </button>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
type Screen =
  | "setup"
  | "entry"
  | "waiting"
  | "room"
  | "results-loading"
  | "results";

export default function DebatePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
 // ── Clear stale session if this is a join link ──────────────────────────
const isJoinRoute = Boolean(
  new URLSearchParams(window.location.search).get("room") ||
  new URLSearchParams(window.location.search).get("session") ||
  new URLSearchParams(window.location.search).get("sessionId")
);
if (isJoinRoute) {
  sessionStorage.removeItem("dp-screen");
}
// ────────────────────────────────────────────────────────────────────────

const [screen, setScreen, clearScreen] = useSessionState<Screen>(
  "dp-screen",
  "setup",
);
const [config, setConfig, clearConfig] = useSessionState<any>(
  "dp-config",
  null,
);

useEffect(() => {
  const handleUnload = () => {
    sessionStorage.removeItem("dp-screen");
  };
  window.addEventListener("beforeunload", handleUnload);
  return () => window.removeEventListener("beforeunload", handleUnload);
}, []);

useEffect(() => {
  const handleError = (event: ErrorEvent) => {
    debateDebug("[GLOBAL_ERROR]", {
      message: event.message,
      stack: event.error?.stack || null,
    });
  };
  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    debateDebug("[UNHANDLED_REJECTION]", {
      reason: typeof reason === "string" ? reason : String(reason),
      stack: reason?.stack || null,
    });
  };
  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);
  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}, []);

useEffect(() => {
  if (!config) return;
  debateDebug("[SESSION] dp-config loaded", {
    roomId: config.sessionId || config.roomId || null,
    userId: config.candidateId || config.userId || null,
    sessionId: config.sessionId || null,
    participantId: config.participantId || config.candidateId || null,
    role: config.role || config.userRole || null,
  });
}, [config]);
  const [result, setResult] = useState<any>(null);
  const [role, setRole] = useState("student");
  const [entrySessionId, setEntrySessionId] = useState("");
  const [showGuestNameModal, setShowGuestNameModal] = useState(false);
  const [showEntryMicModal, setShowEntryMicModal] = useState(false);
  const [guestName, setGuestName] = useState(
    () => localStorage.getItem(DEBATE_GUEST_NAME_KEY) || "",
  );
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoJoinRef = useRef(false);
  const {
    state: entryMicState,
    stream: entryMicStream,
    error: entryMicError,
    request: requestEntryMic,
    stop: stopEntryMic,
    canProceed: entryCanProceed,
    micEnabled: entryMicEnabled,
    setMicEnabled: setEntryMicEnabled,
  } = useMicPerm();
  const entryMicTrack = entryMicStream?.getAudioTracks?.()[0] || null;
  const entryMicReady = Boolean(
    entryMicStream &&
      entryMicTrack &&
      entryMicTrack.readyState === "live" &&
      entryMicTrack.enabled,
  );

  useEffect(() => {
    if (screen !== "results-loading") return;
    const params = new URLSearchParams(window.location.search);
    const linkedSessionId =
      params.get("sessionId") ||
      params.get("session") ||
      params.get("room") ||
      "";
    // Only handle deep-link join scenario — never fire on normal end debate flow.
    // Normal end: onEnd handler already sets result + screen directly.
    // Without this guard, this effect wipes result and resets screen to "setup".
    if (!linkedSessionId) return;
    setResult(null);
    clearConfig();
    setEntrySessionId(linkedSessionId);
    setScreen("entry");
  }, [clearConfig, screen, setEntrySessionId, setResult, setScreen]);

  useEffect(() => {
    if (screen !== "entry" || !showEntryMicModal) return;
    const entryTrack = entryMicStream?.getAudioTracks?.()[0] || null;
    console.log("[MIC] entry modal state", {
      entryMicState,
      hasStream: Boolean(entryMicStream),
      trackReadyState: entryTrack?.readyState || null,
      trackEnabled: entryTrack?.enabled ?? null,
      entryMicEnabled,
      entryCanProceed,
      entryMicReady,
      entryError,
    });
  }, [
    screen,
    showEntryMicModal,
    entryMicState,
    entryMicStream,
    entryMicEnabled,
    entryCanProceed,
    entryMicReady,
    entryError,
  ]);

  const joinLinkedRoom = useCallback(
    async (nameOverride?: string) => {
      const params = new URLSearchParams(window.location.search);
      const linkedSessionId =
        params.get("sessionId") ||
        params.get("session") ||
        params.get("room") ||
        "";
      if (!linkedSessionId) return;

      console.log("[ROOM] join start", {
        linkedSessionId,
        hasMicStream: Boolean(entryMicStream),
        entryMicState,
      });
      setEntryError(null);
      setEntrySessionId(linkedSessionId);
      if (!entryMicReady) {
        console.log("[MIC] join blocked until mic is ready", {
          entryMicState,
          entryCanProceed,
          entryMicReady,
        });
        setShowEntryMicModal(true);
        setScreen("entry");
        setEntryLoading(false);
        return;
      }

      setEntryLoading(true);
      try {
        let candidateId = "";
        let candidateName = "";

        if (user) {
          const candidate = getCandidateContext(user);
          candidateId = candidate.candidateId;
          candidateName = candidate.candidateName;
        } else {
          const safeName = (nameOverride || guestName || "").trim();
          if (!safeName) {
            setShowGuestNameModal(true);
            setScreen("entry");
            setEntryLoading(false);
            return;
          }
          const storedGuestId = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          localStorage.setItem(DEBATE_GUEST_ID_KEY, storedGuestId);
          localStorage.setItem(DEBATE_GUEST_NAME_KEY, safeName);
          candidateId = storedGuestId;
          candidateName = safeName;
        }

        const room = await joinDebateRoom({
          sessionId: linkedSessionId,
          candidateId,
          candidateName,
        });
        console.log("[ROOM] join success", {
          sessionId: linkedSessionId,
          status: room?.liveSession?.status || null,
          isHost: Boolean(
            room?.liveSession?.participants?.find(
              (participant: any) =>
                String(participant.id) === String(candidateId),
            )?.isHost,
          ),
        });

        const subjectLabel =
          room?.liveSession?.subjectTitle ||
          room?.liveSession?.subject ||
          room?.subject ||
          "Debate";
        const unitLabel =
          room?.liveSession?.unitTitle ||
          room?.liveSession?.unit ||
          room?.unit ||
          "";
        const topicLabel =
          room?.liveSession?.topic ||
          room?.topic ||
          params.get("topic") ||
          "Debate Room";

        const nextConfig = {
          name: candidateName,
          candidateId,
          mode: "debate",
          subMode: "multi",
          subject: subjectLabel,
          unit: unitLabel,
          topic: topicLabel,
          stream: entryMicStream,
          micOn: Boolean(
            entryMicStream?.getAudioTracks?.()[0]?.enabled ?? true,
          ),
          camOn: false,
          invitees: [],
          roomId: linkedSessionId,
          roomLink: genRoomLink(linkedSessionId),
          debateMinutes: 5,
          unitId: room?.liveSession?.unitId || "",
          sessionId: linkedSessionId,
          liveSession: room?.liveSession || null,
          initialAiMessage: room?.ai_greeting || "",
          isHost: Boolean(
            room?.liveSession?.participants?.find(
              (participant: any) =>
                String(participant.id) === String(candidateId),
            )?.isHost,
          ),
          hostApproved:
            room?.liveSession?.status === "active" ||
            room?.liveSession?.status === "waiting_for_ai",
          joinedFromLink: true,
        };

        setConfig(nextConfig);
        setScreen(
          room?.liveSession?.status === "active" ||
            room?.liveSession?.status === "waiting_for_ai"
            ? "room"
            : "waiting",
        );
      } catch (error: any) {
        console.log("[ROOM] join failed", {
          sessionId: linkedSessionId,
          message: error?.message || String(error),
        });
        setEntryError(error?.message || "Unable to join this debate room.");
        setScreen("entry");
      } finally {
        setEntryLoading(false);
      }
    },
    [entryMicReady, entryMicStream, guestName, setConfig, setScreen, user],
  );

  useEffect(() => {
    return () => {
      console.log("[CLEANUP] entry screen cleanup");
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      stopEntryMic(true);
    };
  }, [stopEntryMic]);

  async function handleEntryMicContinue() {
    const entryTrack = entryMicStream?.getAudioTracks?.()[0] || null;
    console.log("[MIC] entry continue clicked", {
      entryMicState,
      hasStream: Boolean(entryMicStream),
      trackReadyState: entryTrack?.readyState || null,
      trackEnabled: entryTrack?.enabled ?? null,
      entryMicEnabled,
      entryCanProceed,
      entryMicReady,
      entryError,
    });
    if (!entryMicReady) {
      setEntryError(
        "Please allow and enable your microphone before continuing.",
      );
      console.warn("[MIC] entry continue blocked", {
        reason: "entryMicReady=false",
        entryMicState,
        hasStream: Boolean(entryMicStream),
        trackReadyState: entryTrack?.readyState || null,
        trackEnabled: entryTrack?.enabled ?? null,
        entryMicEnabled,
        entryCanProceed,
        entryMicReady,
      });
      return;
    }
    setShowEntryMicModal(false);
    await joinLinkedRoom(guestName || undefined);
  }

  async function handleRequestEntryMic() {
    console.log("[MIC] entry allow clicked", {
      entryMicState,
      hasStreamBefore: Boolean(entryMicStream),
      entryMicEnabled,
      entryCanProceed,
      entryMicReady,
    });
    const stream = await requestEntryMic();
    const track = stream?.getAudioTracks?.()[0] || null;
    console.log("[MIC] entry allow result", {
      granted: Boolean(stream),
      hasStream: Boolean(stream),
      trackReadyState: track?.readyState || null,
      trackEnabled: track?.enabled ?? null,
      entryMicStateAfter: entryMicState,
      entryMicEnabledAfter: track?.enabled ?? entryMicEnabled,
      entryMicReadyAfter: Boolean(
        stream &&
          track &&
          track.readyState === "live" &&
          (track.enabled ?? false),
      ),
      entryCanProceedAfter: Boolean(
        stream &&
          track &&
          track.readyState === "live" &&
          (track.enabled ?? false),
      ),
    });
    if (!stream) {
      setEntryError(
        "Microphone permission is required to enter the debate room. Please allow browser access and retry.",
      );
      return;
    }
    setEntryError(null);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedSessionId =
      params.get("sessionId") ||
      params.get("session") ||
      params.get("room") ||
      "";
    if (!linkedSessionId || autoJoinRef.current) return;
    autoJoinRef.current = true;
    setEntrySessionId(linkedSessionId);
    if (user) {
      joinLinkedRoom().catch(() => null);
      return;
    }
    const savedGuestName = localStorage.getItem(DEBATE_GUEST_NAME_KEY) || "";
    if (savedGuestName) {
      setGuestName(savedGuestName);
      joinLinkedRoom(savedGuestName).catch(() => null);
      return;
    }
    setScreen("entry");
  }, [joinLinkedRoom, setScreen, user]);

  function handleLinkLogin() {
    localStorage.setItem(
      POST_AUTH_REDIRECT_KEY,
      `${window.location.pathname}${window.location.search}`,
    );
    setLocation("/auth");
  }

  function handleGuestContinue() {
    setShowGuestNameModal(true);
  }

  function handleGuestJoin() {
    const trimmed = guestName.trim();
    if (!trimmed) {
      setEntryError("Please enter your name to continue as guest.");
      return;
    }
    joinLinkedRoom(trimmed).catch(() => null);
    setShowGuestNameModal(false);
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="dp-app">
        {screen === "setup" && (
          <Navigation currentRole={role} onRoleChange={setRole} />
        )}
        {screen === "setup" && (
          <IntegratedDebateSetup
            onLaunch={(cfg) => {
              setConfig(cfg);
              setScreen(cfg.subMode === "multi" ? "waiting" : "room");
            }}
          />
        )}
        {screen === "entry" && (
          <div
            style={{
              minHeight: "100dvh",
              display: "grid",
              placeItems: "center",
              padding: 24,
              background: "linear-gradient(180deg,#081223 0%,#0f172a 100%)",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 520,
                background: "#0d1428",
                borderRadius: 24,
                border: "1px solid rgba(255,255,255,.08)",
                padding: 24,
                color: "#fff",
                boxShadow: "var(--sh3)",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>
                Join Debate Room
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,.62)",
                  lineHeight: 1.7,
                  marginBottom: 18,
                }}
              >
                You opened a debate room link. Continue with your account or
                join as a guest to enter the waiting room.
              </div>
              {entryError && (
                <div
                  style={{
                    background: "rgba(239,68,68,.08)",
                    border: "1px solid rgba(239,68,68,.24)",
                    borderRadius: 14,
                    padding: 12,
                    color: "#fecaca",
                    fontSize: 12.5,
                    lineHeight: 1.6,
                    marginBottom: 14,
                  }}
                >
                  {entryError}
                </div>
              )}

              {showEntryMicModal && (
                <div className="overlay">
                  <div className="modal dark" style={{ maxWidth: 440 }}>
                    <div className="mh">
                      <span className="mh-title" style={{ color: "#fff" }}>
                        Mic Permission Required
                      </span>
                      <button
                        className="mh-close"
                        style={{
                          borderColor: "rgba(255,255,255,.1)",
                          background: "rgba(255,255,255,.06)",
                          color: "rgba(255,255,255,.6)",
                        }}
                        onClick={() => {
                          stopEntryMic();
                          setShowEntryMicModal(false);
                          setEntryError(
                            "Microphone permission is required to enter the debate room.",
                          );
                        }}
                      >
                        x
                      </button>
                    </div>
                    <div className="mb" style={{ padding: "16px 20px" }}>
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: 13,
                          background: "rgba(99,102,241,.08)",
                          border: "1px solid rgba(99,102,241,.18)",
                          marginBottom: 14,
                          color: "#fff",
                          fontSize: 12.5,
                          lineHeight: 1.7,
                        }}
                      >
                        We need microphone access before you can enter the
                        debate room. This lets the debate use your live mic,
                        show your speaking state, and keep the room synced.
                      </div>
                      <MicPermCard
                        perm={entryMicState}
                        stream={entryMicStream}
                        micLevel={0}
                        micOn={entryMicEnabled}
                        onRequest={handleRequestEntryMic}
                        onToggle={() => {
                          const track =
                            entryMicStream?.getAudioTracks?.()[0] || null;
                          console.log("[DebatePage][ParticipantMic] toggle mic", {
                            hasStream: Boolean(entryMicStream),
                            trackReadyState: track?.readyState || null,
                            trackEnabledBefore: track?.enabled ?? null,
                            entryMicEnabled,
                            entryCanProceed,
                            entryMicReady,
                          });
                          setEntryMicEnabled(!entryMicEnabled);
                        }}
                        error={entryMicError}
                      />
                      <div
                        style={{
                          fontSize: 12,
                          color:
                            entryMicState === "denied"
                              ? "#fecaca"
                              : "rgba(255,255,255,.65)",
                          lineHeight: 1.6,
                        }}
                      >
                        {entryMicState === "denied" || entryMicError
                          ? entryMicError ||
                            "Microphone access was denied. Please allow it in your browser settings or retry permission, then continue."
                          : "Press the permission button first. Continue unlocks only after mic access is granted."}
                      </div>
                    </div>
                    <div
                      className="mf"
                      style={{
                        flexDirection: "column" as const,
                        gap: 8,
                        borderColor: "rgba(255,255,255,.08)",
                      }}
                    >
                      <button
                        className="btn-p"
                        onClick={handleEntryMicContinue}
                        disabled={!entryMicReady}
                        style={{ fontSize: 14 }}
                      >
                        {entryMicReady
                          ? "Continue to Waiting Room"
                          : entryMicState === "requesting"
                            ? "Waiting for Mic..."
                            : "Enable Mic to Continue"}
                      </button>
                      <button
                        className="btn-s"
                        onClick={() => {
                          stopEntryMic();
                          setShowEntryMicModal(false);
                          setEntryError(
                            "Microphone permission is required to enter the debate room.",
                          );
                        }}
                        style={{
                          width: "100%",
                          justifyContent: "center" as const,
                          background: "rgba(255,255,255,.04)",
                          borderColor: "rgba(255,255,255,.1)",
                          color: "rgba(255,255,255,.5)",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gap: 10 }}>
                <button
                  className="btn-p"
                  onClick={handleLinkLogin}
                  disabled={entryLoading}
                >
                  Login
                </button>
                <button
                  className="btn-s"
                  onClick={handleGuestContinue}
                  disabled={entryLoading}
                >
                  Continue as Guest
                </button>
              </div>
            </div>

            {showGuestNameModal && (
              <div className="overlay">
                <div className="modal" style={{ maxWidth: 380 }}>
                  <div className="mh">
                    <div className="mh-title">Continue as Guest</div>
                    <button
                      className="mh-close"
                      onClick={() => setShowGuestNameModal(false)}
                    >
                      ?
                    </button>
                  </div>
                  <div className="mb">
                    <label className="fl">Your Name</label>
                    <input
                      className="finput"
                      value={guestName}
                      onChange={(event) => setGuestName(event.target.value)}
                      placeholder="Enter your display name"
                      maxLength={40}
                    />
                  </div>
                  <div className="mf">
                    <button
                      className="btn-s"
                      onClick={() => setShowGuestNameModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-p"
                      style={{ width: "auto" }}
                      onClick={handleGuestJoin}
                      disabled={entryLoading}
                    >
                      {entryLoading ? "Joining..." : "Join Waiting Room"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {screen === "waiting" && config && (
          <DebateWaitingRoom
            config={config}
            onEnterRoom={(nextConfig) => {
              setConfig(nextConfig);
              setScreen("room");
            }}
            onClose={() => {
              clearConfig();
              setScreen(entrySessionId ? "entry" : "setup");
            }}
          />
        )}
        {screen === "room" && config && (
          <IntegratedDebateRoom
            config={config}
            onEnd={(res) => {
              if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
              setConfig(null);
              setResult(res);
              // Go directly to results — end API already returned data.
              // The random 5-10s delay was wiping result via the results-loading useEffect.
              setScreen("results");
            }}
          />
        )}
        {screen === "results-loading" && (
          <DebateLoadingScreen
            title="Generating debate results"
            subtitle="Reviewing turns, reactions, transcript, and team performance..."
            progress={78}
          />
        )}
        {screen === "results" && result && (
          <DebateResults
            result={result}
            onNew={() => {
              if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
              setResult(null);
              clearScreen();
              clearConfig();
              setScreen("setup");
            }}
          />
        )}
      </div>
    </>
  );
}