import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import jsPDF from "jspdf";
import { useSeminarLivekit } from "../hooks/useSeminarLivekit";

import Navigation from "../components/navigation";
import FormattedAIContent from "../components/ai/FormattedAIContent";
import { useAuth } from "../hooks/use-auth";
import { useSessionState } from "../hooks/useSessionState";
import {
  createSeminarRoom,
  endSeminarWithTranscript,
  getActiveSeminarSessions,
  getCandidateContext,
  getLibrarySubjects,
  getSeminarSession,
  getSeminarTopics,
  guideSeminar,
  joinSeminarSession,
  removeSeminarParticipant,
  respondSeminar,
  requestSeminarSpeakingAccess,
  respondSeminarSpeakingAccess,
  sendSeminarMessage,
  startSeminar,
  startSeminarChat,
  respondSeminarChat,
  startSeminarRoom,
  transcribeDebateAudio,
  synthesizeDebateSpeech,
  type LibrarySubject,
} from "../lib/gradeupApi";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;overflow:hidden}
:root{
  --bg:#f0f2f5;--surf:#fff;--surf2:#f7f8fa;--surf3:#eef0f4;
  --bdr:rgba(0,0,0,.08);--bdr2:rgba(0,0,0,.14);
  --em:#00c37a;--em2:#00a366;--em3:#d0fff1;
  --sky:#2d9cdb;--sky2:#1a7bbf;
  --vio:#7c3aed;--pnk:#e91e8c;
  --red:#e53e3e;--amb:#f6a623;
  --t1:#0d1117;--t2:#444d5b;--t3:#8a95a3;--t4:#d6dbe4;
  --font:'DM Sans',system-ui,sans-serif;
  --mono:'JetBrains Mono',monospace;
  --sh:0 1px 4px rgba(0,0,0,.06);
  --sh2:0 4px 20px rgba(0,0,0,.1);
  --sh3:0 16px 60px rgba(0,0,0,.16);
  --grad:linear-gradient(135deg,#00c37a,#2d9cdb);
  --grad2:linear-gradient(135deg,#7c3aed,#e91e8c);
  --r:16px;
  --panel-w:300px;
}
.dark{
  --bg:#080e1a;--surf:#101827;--surf2:#0c1422;--surf3:#1a2336;
  --bdr:rgba(255,255,255,.07);--bdr2:rgba(255,255,255,.12);
  --t1:#e8ecf2;--t2:#8a95a3;--t3:#4a5568;--t4:#1e2a3a;
}
body{font-family:var(--font);background:var(--bg);color:var(--t1);-webkit-font-smoothing:antialiased;font-size:14px}
button,input,select,textarea{font-family:var(--font)}
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-thumb{background:rgba(0,195,122,.25);border-radius:4px}
.sp-app{height:100dvh;display:flex;flex-direction:column;overflow:hidden;width:100vw}

.page-loader{position:fixed;inset:0;background:#060e1c;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px}
.page-loader-logo{width:60px;height:60px;background:var(--grad);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:28px;animation:loaderPulse 1.4s ease-in-out infinite;box-shadow:0 0 40px rgba(0,195,122,.35)}
.page-loader-text{font-size:15px;font-weight:700;color:#fff;letter-spacing:.05em}
.page-loader-sub{font-size:11px;color:rgba(255,255,255,.35);letter-spacing:.08em;text-transform:uppercase}
.page-loader-bar{width:200px;height:3px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden}
.page-loader-fill{height:100%;background:var(--grad);border-radius:3px;transition:width .25s ease}
.page-loader-steps{display:flex;flex-direction:column;gap:8px;margin-top:4px;width:240px}
.page-loader-step{display:flex;align-items:center;gap:9px;padding:7px 11px;border-radius:9px;font-size:11px;font-weight:700;transition:all .3s}
.page-loader-step.done{background:rgba(0,195,122,.1);border:1px solid rgba(0,195,122,.2);color:#5ee3b7}
.page-loader-step.active{background:rgba(45,156,219,.1);border:1px solid rgba(45,156,219,.2);color:#7ed3f7}
.page-loader-step.pending{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.3)}
@keyframes loaderPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}

.route-enter{animation:routeIn .32s cubic-bezier(.34,1.05,.64,1) both}
@keyframes routeIn{from{opacity:0;transform:scale(.97) translateY(8px)}to{opacity:1;transform:none}}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:none}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes recBlink{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes rPop{0%{opacity:0;transform:translate(-50%,-60%) scale(.2)}20%{opacity:1;transform:translate(-50%,-50%) scale(1.2)}60%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-120%) scale(.6)}}
@keyframes dotPulse{0%,80%,100%{transform:scale(.4);opacity:.3}40%{transform:scale(1);opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideUp{from{opacity:0;transform:translateY(20px) scale(.97)}to{opacity:1;transform:none}}
@keyframes typewriterBlink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes panelSlideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}
@keyframes suggestionSlide{from{opacity:0;transform:translateY(20px) scale(.96)}to{opacity:1;transform:none}}

.ai-suggestion-banner{
  position:absolute;bottom:16px;left:55%;transform:translateX(-50%);
  background:linear-gradient(135deg,rgba(45,156,219,.95),rgba(124,58,237,.9));
  border:1.5px solid rgba(45,156,219,.5);border-radius:14px;
  padding:12px 16px;min-width:280px;max-width:420px;
  box-shadow:0 8px 32px rgba(45,156,219,.3);z-index:20;
  animation:suggestionSlide .35s cubic-bezier(.34,1.1,.64,1) both;
  display:flex;gap:10px;align-items:flex-start;
}
.ai-suggestion-banner .ai-icon{font-size:20px;flex-shrink:0;margin-top:1px}
.ai-suggestion-banner .ai-content{flex:1;min-width:0}
.ai-suggestion-banner .ai-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.6);margin-bottom:3px}
.ai-suggestion-banner .ai-text{font-size:12px;font-weight:600;color:#fff;line-height:1.5}
.ai-suggestion-banner .ai-close{width:22px;height:22px;border-radius:6px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.1);cursor:pointer;color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:.15s}
.ai-suggestion-banner .ai-close:hover{background:rgba(255,255,255,.2)}

.demo-ready-banner{
  position:absolute;inset:0;background:rgba(3,10,20,.85);backdrop-filter:blur(4px);
  z-index:15;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
  animation:fadeIn .2s ease;
}
.demo-ready-inner{text-align:center;padding:24px 28px;background:rgba(255,255,255,.04);border:1.5px solid rgba(0,195,122,.3);border-radius:18px;max-width:360px}
.demo-ready-icon{font-size:48px;margin-bottom:10px}
.demo-ready-title{font-size:18px;font-weight:900;color:#fff;margin-bottom:6px;letter-spacing:-.3px}
.demo-ready-desc{font-size:12px;color:rgba(255,255,255,.5);line-height:1.7;margin-bottom:16px}
.demo-start-btn{padding:12px 28px;border-radius:12px;background:var(--grad);border:none;cursor:pointer;font-size:14px;font-weight:800;color:#fff;font-family:var(--font);box-shadow:0 4px 20px rgba(0,195,122,.35);transition:.18s;display:inline-flex;align-items:center;gap:8px}
.demo-start-btn:hover{transform:scale(1.04);box-shadow:0 7px 28px rgba(0,195,122,.45)}

@keyframes soundBar0{0%,100%{height:4px}15%{height:22px}35%{height:10px}55%{height:18px}75%{height:6px}}
@keyframes soundBar1{0%,100%{height:6px}20%{height:28px}40%{height:12px}60%{height:24px}80%{height:8px}}
@keyframes soundBar2{0%,100%{height:3px}10%{height:18px}30%{height:28px}50%{height:14px}70%{height:22px}}
@keyframes soundBar3{0%,100%{height:8px}25%{height:24px}45%{height:6px}65%{height:20px}85%{height:10px}}
@keyframes soundBar4{0%,100%{height:5px}18%{height:20px}38%{height:12px}58%{height:26px}78%{height:8px}}
@keyframes soundBar5{0%,100%{height:7px}22%{height:16px}42%{height:30px}62%{height:10px}82%{height:20px}}
@keyframes soundBar6{0%,100%{height:4px}12%{height:24px}32%{height:8px}52%{height:22px}72%{height:14px}}
.sound-analyser{display:flex;align-items:center;gap:3px;padding:0 2px}
.sound-analyser .bar{width:3px;border-radius:3px;min-height:3px;background:var(--color,#00c37a)}
.sound-analyser.active .bar:nth-child(1){animation:soundBar0 .7s ease-in-out infinite}
.sound-analyser.active .bar:nth-child(2){animation:soundBar1 .7s ease-in-out infinite .08s}
.sound-analyser.active .bar:nth-child(3){animation:soundBar2 .7s ease-in-out infinite .16s}
.sound-analyser.active .bar:nth-child(4){animation:soundBar3 .7s ease-in-out infinite .06s}
.sound-analyser.active .bar:nth-child(5){animation:soundBar4 .7s ease-in-out infinite .12s}
.sound-analyser.active .bar:nth-child(6){animation:soundBar5 .7s ease-in-out infinite .04s}
.sound-analyser.active .bar:nth-child(7){animation:soundBar6 .7s ease-in-out infinite .10s}

.sp-toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--surf);border:1px solid var(--bdr2);border-radius:12px;padding:9px 15px;font-size:12.5px;font-weight:600;color:var(--t1);box-shadow:var(--sh2);z-index:9999;display:flex;align-items:center;gap:7px;animation:slideUp .28s cubic-bezier(.34,1.2,.64,1);white-space:nowrap;max-width:calc(100vw - 32px)}
.sp-toast.success{border-color:rgba(0,195,122,.35)}.sp-toast.error{border-color:rgba(229,62,62,.35)}.sp-toast.warn{border-color:rgba(246,166,35,.35)}.sp-toast.info{border-color:rgba(45,156,219,.3)}

.fi{margin-bottom:10px}.fl{display:block;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--t3);margin-bottom:4px}
.finput{width:100%;padding:9px 12px;border-radius:10px;border:1.5px solid var(--bdr);background:var(--surf);color:var(--t1);font-size:13.5px;outline:none;transition:all .16s}
.finput:focus{border-color:var(--em);box-shadow:0 0 0 3px rgba(0,195,122,.1)}
.finput::placeholder{color:var(--t3)}.finput:disabled{opacity:.4;cursor:not-allowed}
select.finput{cursor:pointer;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%238a95a3' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px}
.fi-row{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.btn-p{padding:10px 20px;border-radius:10px;border:none;cursor:pointer;background:var(--grad);color:#fff;font-size:13.5px;font-weight:700;transition:all .2s;box-shadow:0 4px 16px rgba(0,195,122,.24);display:inline-flex;align-items:center;justify-content:center;gap:7px;font-family:var(--font);width:100%}
.btn-p:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 7px 24px rgba(0,195,122,.34)}
.btn-p:disabled{opacity:.35;cursor:not-allowed;transform:none;box-shadow:none}
.btn-s{padding:8px 15px;border-radius:9px;border:1.5px solid var(--bdr);background:var(--surf2);cursor:pointer;color:var(--t2);font-size:12.5px;font-weight:600;transition:.16s;font-family:var(--font);display:inline-flex;align-items:center;justify-content:center;gap:5px}
.btn-s:hover{border-color:rgba(0,195,122,.3);color:var(--t1);background:rgba(0,195,122,.05)}
.btn-d{padding:8px 15px;border-radius:9px;border:1.5px solid rgba(229,62,62,.25);background:rgba(229,62,62,.06);cursor:pointer;color:var(--red);font-size:12.5px;font-weight:600;transition:.16s;font-family:var(--font);display:inline-flex;align-items:center;justify-content:center;gap:5px}
.btn-d:hover{background:rgba(229,62,62,.12)}
.loader-spin{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;animation:spin .65s linear infinite;flex-shrink:0}
.loader-spin.dark{border-color:rgba(0,195,122,.15);border-top-color:var(--em)}
.lo-progress{width:100%;height:3px;background:rgba(0,0,0,.06);border-radius:3px;overflow:hidden;margin-top:6px}
.lo-progress-fill{height:100%;background:var(--grad);border-radius:3px;transition:width .35s ease}

/* SETUP PAGE */
.sp-setup{display:grid;grid-template-columns:36% 1fr;height:calc(100% - 0px);overflow:hidden;width:100%;flex:1;min-height:0}
.sp-left{background:#060e1c;position:relative;overflow:hidden;display:flex;flex-direction:column}
.sp-left-inner{flex:1;overflow-y:auto;padding:clamp(16px,2.5vw,32px) clamp(14px,2vw,28px);position:relative;z-index:2;display:flex;flex-direction:column}
.sp-grid-lines{position:absolute;inset:0;background-image:linear-gradient(rgba(0,195,122,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(0,195,122,.055) 1px,transparent 1px);background-size:42px 42px;pointer-events:none}
.sp-glow1{position:absolute;width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(0,195,122,.15) 0%,transparent 70%);top:-120px;left:-120px;pointer-events:none}
.sp-glow2{position:absolute;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(45,156,219,.1) 0%,transparent 70%);bottom:-60px;right:-40px;pointer-events:none;animation:pulse 7s ease-in-out infinite}
.sp-logo{display:flex;align-items:center;gap:9px;margin-bottom:16px;animation:fadeUp .45s ease both}
.sp-logo-ico{width:32px;height:32px;background:var(--grad);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 6px 18px rgba(0,195,122,.35)}
.sp-logo-name{font-size:14px;font-weight:800;background:linear-gradient(90deg,#fff 0%,#5ee3b7 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sp-badge{display:inline-flex;align-items:center;gap:6px;padding:3px 11px;border-radius:100px;background:rgba(0,195,122,.12);border:1px solid rgba(0,195,122,.28);font-size:10px;font-weight:700;color:#5ee3b7;letter-spacing:.1em;text-transform:uppercase;margin-bottom:10px;animation:fadeUp .45s ease .08s both;width:fit-content}
.sp-badge-dot{width:5px;height:5px;border-radius:50%;background:#5ee3b7;animation:pulse 1.8s infinite}
.sp-h1{font-size:clamp(16px,1.8vw,24px);font-weight:900;line-height:1.1;letter-spacing:-.5px;color:#fff;margin-bottom:7px;animation:fadeUp .45s ease .14s both}
.sp-h1 .hl{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.sp-desc{font-size:11px;color:rgba(255,255,255,.38);line-height:1.8;margin-bottom:14px;animation:fadeUp .45s ease .2s both}
.sp-features{display:flex;flex-direction:column;gap:5px;animation:fadeUp .45s ease .26s both}
.sp-feat{display:flex;align-items:center;gap:8px;padding:7px 10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);border-radius:10px;transition:.25s}
.sp-feat:hover{background:rgba(0,195,122,.08);border-color:rgba(0,195,122,.22)}
.sp-feat-ic{width:28px;height:28px;border-radius:8px;background:rgba(0,195,122,.18);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.sp-feat-t{font-size:11px;font-weight:700;color:#fff}
.sp-feat-d{font-size:9.5px;color:rgba(255,255,255,.35);margin-top:1px}
.ctx-chip{margin-top:10px;padding:9px 12px;border-radius:11px;background:rgba(0,195,122,.07);border:1px solid rgba(0,195,122,.2);animation:fadeUp .45s ease .32s both}
.ctx-chip-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--em);margin-bottom:3px}
.ctx-chip-val{font-size:12px;font-weight:700;color:#fff}
.ctx-chip-sub{font-size:10px;color:rgba(255,255,255,.38);margin-top:1px}

.sp-right{background:var(--surf);overflow:hidden;display:flex;flex-direction:column}
.sp-right-scroll{overflow-y:auto;flex:1;padding:clamp(14px,2vw,28px);-webkit-overflow-scrolling:touch}
.sp-right-inner{max-width:560px;margin:0 auto;width:100%}
.back-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:9px;border:1.5px solid rgba(0,195,122,.25);background:rgba(0,195,122,.06);cursor:pointer;font-size:12.5px;font-weight:700;color:var(--em);transition:all .2s;margin-bottom:14px;font-family:var(--font)}
.back-btn:hover{background:rgba(0,195,122,.12);transform:translateX(-2px)}
.setup-h{font-size:clamp(14px,1.6vw,18px);font-weight:900;letter-spacing:-.3px;color:var(--t1);margin-bottom:3px}
.setup-sub{font-size:11px;color:var(--t2);margin-bottom:14px;line-height:1.6}

.module-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:14px}
.module-card{padding:13px;border-radius:13px;border:2px solid var(--bdr);background:var(--surf2);cursor:pointer;transition:all .2s;display:flex;gap:10px;align-items:flex-start}
.module-card:hover{border-color:rgba(0,195,122,.3);background:rgba(0,195,122,.03);transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,195,122,.1)}
.module-card.sel{border-color:var(--em);background:rgba(0,195,122,.06);box-shadow:0 6px 20px rgba(0,195,122,.12)}
.mod-ic{width:36px;height:36px;border-radius:11px;background:rgba(0,195,122,.12);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;transition:.2s}
.module-card.sel .mod-ic{background:rgba(0,195,122,.2)}
.mod-title{font-size:12px;font-weight:800;color:var(--t1);margin-bottom:3px}
.mod-desc{font-size:10px;color:var(--t2);line-height:1.5}
.module-card.sel .mod-title{color:var(--em)}

.submode-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:14px}
.submode-card{padding:15px 13px;border-radius:13px;border:2px solid var(--bdr);background:var(--surf2);cursor:pointer;transition:all .22s;text-align:center;display:flex;flex-direction:column;align-items:center;gap:5px}
.submode-card:hover{border-color:rgba(0,195,122,.3);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,195,122,.1)}
.submode-card.sel{border-color:var(--em);background:rgba(0,195,122,.06);box-shadow:0 6px 20px rgba(0,195,122,.14)}
.submode-ic{font-size:26px;margin-bottom:2px}
.submode-title{font-size:12.5px;font-weight:800;color:var(--t1)}
.submode-desc{font-size:10px;color:var(--t2);line-height:1.5}
.submode-card.sel .submode-title{color:var(--em)}

.sec-div{font-size:9.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);margin-bottom:8px;margin-top:6px;display:flex;align-items:center;gap:7px}
.sec-div::after{content:'';flex:1;height:1px;background:var(--bdr)}

.timing-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
.timing-card{padding:11px 12px;border-radius:11px;border:2px solid var(--bdr);background:var(--surf2);cursor:pointer;transition:all .2s;display:flex;align-items:flex-start;gap:9px}
.timing-card:hover{border-color:rgba(0,195,122,.28)}
.timing-card.sel{border-color:var(--em);background:rgba(0,195,122,.05)}
.timing-ic{font-size:16px}
.timing-title{font-size:12px;font-weight:800;color:var(--t1);margin-bottom:1px}
.timing-desc{font-size:10px;color:var(--t2)}
.timing-card.sel .timing-title{color:var(--em)}

.steps{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
.step-r{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:9px;border:1px solid var(--bdr);background:var(--surf2);transition:.18s}
.step-r.done{border-color:rgba(0,195,122,.28);background:rgba(0,195,122,.04)}
.step-r.act{border-color:rgba(45,156,219,.28);background:rgba(45,156,219,.04)}
.step-r.pend{opacity:.42}
.step-num{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0}
.step-r.done .step-num{background:var(--em);color:#fff}
.step-r.act .step-num{background:var(--sky);color:#fff}
.step-r.pend .step-num{background:var(--surf3);color:var(--t3)}
.step-lbl{font-size:12px;font-weight:600;color:var(--t2)}
.step-r.done .step-lbl{color:var(--em)}.step-r.act .step-lbl{color:var(--t1)}.step-r.pend .step-lbl{color:var(--t3)}

.link-box{border-radius:12px;background:rgba(0,195,122,.04);border:1.5px solid rgba(0,195,122,.15);padding:11px 13px;margin-top:10px}
.link-lbl{font-size:9.5px;font-weight:800;color:var(--em);text-transform:uppercase;letter-spacing:.07em;margin-bottom:7px}
.link-row{display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:8px;background:var(--surf);border:1px solid var(--bdr)}
.link-val{flex:1;font-family:var(--mono);font-size:10px;color:var(--em);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.copy-btn{padding:4px 10px;border-radius:6px;border:none;cursor:pointer;background:var(--grad);color:#fff;font-size:11px;font-weight:700;transition:.15s;flex-shrink:0}
.copy-btn:hover{transform:scale(1.04)}
.obs-join-section{padding:14px;border-radius:14px;background:linear-gradient(135deg,rgba(45,156,219,.07),rgba(124,58,237,.05));border:1.5px solid rgba(45,156,219,.2);margin-bottom:14px}
.obs-join-title{font-size:12px;font-weight:800;color:var(--sky);margin-bottom:10px;display:flex;align-items:center;gap:6px}
.obs-join-input-row{display:flex;gap:7px;margin-bottom:10px}
.obs-join-or{text-align:center;font-size:10px;font-weight:700;color:var(--t3);margin:8px 0;position:relative}
.obs-join-or::before,.obs-join-or::after{content:'';position:absolute;top:50%;width:40%;height:1px;background:var(--bdr)}
.obs-join-or::before{left:0}.obs-join-or::after{right:0}
.ongoing-list{display:flex;flex-direction:column;gap:7px;margin-bottom:12px}
.ongoing-card{padding:12px 14px;border-radius:12px;border:1.5px solid var(--bdr);background:var(--surf2);cursor:pointer;transition:all .2s;display:flex;gap:11px;align-items:center}
.ongoing-card:hover{border-color:rgba(0,195,122,.3);background:rgba(0,195,122,.04);transform:translateY(-1px)}
.ongoing-card.sel{border-color:var(--em);background:rgba(0,195,122,.06)}
.ongoing-live-dot{width:8px;height:8px;border-radius:50%;animation:pulse 1.2s infinite;flex-shrink:0}
.ongoing-info{flex:1;min-width:0}
.ongoing-topic{font-size:12.5px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ongoing-meta{font-size:10.5px;color:var(--t2);margin-top:2px}
.ongoing-count{font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px}
.ongoing-empty{text-align:center;padding:18px;font-size:12px;color:var(--t3);border-radius:11px;background:var(--surf2);border:1px dashed var(--bdr)}

.overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(8px);z-index:700;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .18s ease}
.modal{background:var(--surf);border:1px solid var(--bdr);border-radius:var(--r);width:100%;max-height:calc(100dvh - 28px);display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--sh3);animation:slideUp .25s cubic-bezier(.34,1.1,.64,1)}
.mh{padding:14px 18px 12px;border-bottom:1px solid var(--surf3);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.mh-title{font-size:14.5px;font-weight:800;color:var(--t1)}
.mh-close{width:25px;height:25px;border-radius:7px;border:1px solid var(--bdr);background:var(--surf2);cursor:pointer;color:var(--t2);display:flex;align-items:center;justify-content:center;font-size:11px;transition:.12s}
.mh-close:hover{color:var(--t1);transform:rotate(90deg)}
.mb{padding:16px 18px;overflow-y:auto;flex:1}
.mf{padding:11px 18px;border-top:1px solid var(--surf3);display:flex;justify-content:flex-end;gap:7px;flex-shrink:0;flex-wrap:wrap}

/* 2-Step Prepare with AI */
.step-container {
  position: absolute;
  inset: 0;
  background: rgba(3,10,20,.85);
  backdrop-filter: blur(4px);
  z-index: 15;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  animation: fadeIn .2s ease;
}
.step-box {
  text-align: center;
  padding: 24px 28px;
  background: rgba(255,255,255,.04);
  border: 1.5px solid rgba(45,156,219,.3);
  border-radius: 18px;
  max-width: 440px;
  box-shadow: 0 8px 32px rgba(0,0,0,.5);
}
.step-box h3 {
  font-size: 18px;
  font-weight: 900;
  color: #fff;
  margin-bottom: 8px;
}
.step-box p {
  font-size: 12px;
  color: rgba(255,255,255,.6);
  line-height: 1.6;
  margin-bottom: 20px;
}
.step-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.file-upload-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.file-upload-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 12px;
  background: rgba(45,156,219,.1);
  border: 1.5px dashed rgba(45,156,219,.4);
  cursor: pointer;
  color: #7ed3f7;
  font-weight: 700;
  transition: .2s;
  width: 100%;
}
.file-upload-btn:hover {
  background: rgba(45,156,219,.18);
  border-color: rgba(45,156,219,.6);
}
.create-file-btn {
  background: rgba(0,195,122,.1);
  border: 1.5px solid rgba(0,195,122,.3);
  color: #5ee3b7;
  border-style: solid;
}
.create-file-btn:hover {
  background: rgba(0,195,122,.18);
  border-color: rgba(0,195,122,.5);
}
.step-divider {
  display: flex;
  align-items: center;
  text-align: center;
  font-size: 10px;
  color: rgba(255,255,255,.3);
  margin: 10px 0;
}
.step-divider::before, .step-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid rgba(255,255,255,.1);
}
.step-divider:not(:empty)::before {
  margin-right: .5em;
}
.step-divider:not(:empty)::after {
  margin-left: .5em;
}

/* PREPARE WITH AI */
.prep-page{height:100dvh;background:#07111e;color:#e8ecf2;display:flex;flex-direction:column;overflow:hidden;width:100vw}
.prep-bar{height:52px;background:rgba(7,17,30,.98);border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;padding:0 12px;gap:8px;flex-shrink:0;overflow:hidden;position:relative;z-index:10}
.prep-bar-logo{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:#fff;cursor:pointer;border:none;background:none;font-family:var(--font);white-space:nowrap;flex-shrink:0}
.prep-bar-logo-ic{width:26px;height:26px;background:var(--grad);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}
.prep-bar-div{width:1px;height:16px;background:rgba(255,255,255,.1);flex-shrink:0}
.prep-bar-topic{flex:1;font-size:11px;font-weight:500;color:rgba(255,255,255,.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.prep-bar-topic strong{color:#e8ecf2;font-weight:700}
.prep-pill{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:7px;font-size:10px;font-weight:700;flex-shrink:0;border:1px solid;white-space:nowrap}
.pp-timer{background:rgba(0,195,122,.12);border-color:rgba(0,195,122,.2);color:#5ee3b7;font-family:var(--mono)}
.pp-mode{background:rgba(45,156,219,.1);border-color:rgba(45,156,219,.2);color:#7ed3f7}
.pp-demo{background:rgba(246,166,35,.12);border-color:rgba(246,166,35,.22);color:#fcd18e;animation:pulse 1.5s infinite}
.pp-paused{background:rgba(229,62,62,.12);border-color:rgba(229,62,62,.22);color:var(--red)}
.prep-bar-end{padding:5px 13px;border-radius:8px;border:1px solid rgba(229,62,62,.35);background:rgba(229,62,62,.1);color:var(--red);cursor:pointer;font-size:11px;font-weight:700;transition:.15s;flex-shrink:0;font-family:var(--font)}
.prep-bar-end:hover{background:rgba(229,62,62,.22)}

.paused-overlay{position:absolute;inset:0;background:rgba(3,10,20,.75);backdrop-filter:blur(4px);z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;animation:fadeIn .2s ease}
.paused-badge{padding:10px 22px;border-radius:40px;background:rgba(229,62,62,.15);border:2px solid rgba(229,62,62,.4);display:flex;align-items:center;gap:10px;font-size:16px;font-weight:800;color:var(--red)}
.paused-sub{font-size:12px;color:rgba(255,255,255,.35);text-align:center;max-width:260px;line-height:1.6}
.paused-resume-btn{padding:10px 28px;border-radius:12px;background:var(--grad);border:none;cursor:pointer;font-size:14px;font-weight:800;color:#fff;font-family:var(--font);box-shadow:0 4px 20px rgba(0,195,122,.28);transition:.18s}
.paused-resume-btn:hover{transform:scale(1.04)}

.ai-pause-banner{padding:8px 14px;background:rgba(229,62,62,.1);border-top:1px solid rgba(229,62,62,.25);display:flex;align-items:center;gap:9px;flex-shrink:0}
.ai-pause-banner-text{flex:1;font-size:11px;font-weight:700;color:var(--red)}
.ai-pause-resume-btn{padding:4px 12px;border-radius:7px;background:var(--grad);border:none;cursor:pointer;font-size:11px;font-weight:800;color:#fff;font-family:var(--font);transition:.15s}
.ai-pause-resume-btn:hover{transform:scale(1.04)}

.prep-body{flex:1;display:grid;transition:grid-template-columns .28s ease;overflow:hidden;min-height:0}
.prep-body.panel-open{grid-template-columns:1fr var(--panel-w)}
.prep-body.panel-closed{grid-template-columns:1fr 0px}
.prep-main-area{display:flex;flex-direction:column;overflow:hidden;position:relative;min-width:0}

/* STAGE — normal 2-tile mode */
.prep-stage{flex:1;background:#030a14;display:flex;flex-direction:column;position:relative;overflow:hidden;min-height:0}
.prep-tiles-grid{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr;gap:0;z-index:1}
.prep-tile{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:1px solid rgba(255,255,255,.06);transition:border-color .3s,box-shadow .3s;overflow:hidden;background:#0a1628}
.prep-tile.speaking{border-color:var(--em);box-shadow:inset 0 0 0 2px var(--em),0 0 24px rgba(0,195,122,.18)}
.prep-tile.speaking-ai{border-color:var(--sky);box-shadow:inset 0 0 0 2px var(--sky),0 0 24px rgba(45,156,219,.18)}
.prep-tile-you-badge,.prep-tile-ai-badge{position:absolute;top:10px;left:10px;font-size:8.5px;font-weight:800;padding:2px 7px;border-radius:4px;z-index:3}
.prep-tile-you-badge{background:rgba(0,195,122,.85);color:#000}
.prep-tile-ai-badge{background:rgba(45,156,219,.85);color:#000}
.prep-tile-av{width:clamp(44px,6vw,68px);height:clamp(44px,6vw,68px);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:clamp(16px,2.5vw,24px);font-weight:800;border:2px solid rgba(0,195,122,.3)}
.prep-tile-name{font-size:clamp(11px,1.2vw,13px);font-weight:700;color:#e8ecf2}
.prep-tile-role{font-size:clamp(9px,0.9vw,10.5px);color:rgba(255,255,255,.4)}
.prep-tile-analyser{position:absolute;bottom:10px;right:10px;z-index:3}
.prep-tile-muted{position:absolute;top:10px;right:10px;font-size:14px;z-index:3}
.prep-tile-ai-icon{font-size:clamp(28px,4vw,48px);filter:drop-shadow(0 0 16px rgba(45,156,219,.4))}
.prep-tile-typing{display:flex;gap:4px;align-items:center;margin-top:4px}
.prep-tile-typing-dot{width:6px;height:6px;border-radius:50%;background:#7ed3f7;animation:dotPulse .8s ease-in-out infinite}

/* PRESENTER MODE — big screen + strip */
.prep-presenter-stage{flex:1;background:#030a14;display:flex;flex-direction:column;position:relative;overflow:hidden;min-height:0}
.prep-ss-area{flex:1;background:#020810;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;min-height:0}
.prep-ss-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:rgba(255,255,255,.2)}
.prep-ss-active-label{position:absolute;top:12px;left:50%;transform:translateX(-50%);background:rgba(0,195,122,.15);border:1px solid rgba(0,195,122,.3);border-radius:8px;padding:5px 14px;font-size:11px;font-weight:700;color:#5ee3b7;white-space:nowrap;display:flex;align-items:center;gap:6px}
.prep-ss-active-dot{width:6px;height:6px;border-radius:50%;background:var(--em);animation:pulse 1s infinite}
.prep-strip{height:100px;background:rgba(0,0,0,.45);border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:6px;padding:6px 10px;overflow-x:auto;flex-shrink:0}
.prep-strip-tile{width:130px;min-width:130px;height:84px;border-radius:10px;background:#0d1e34;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(255,255,255,.06);transition:.2s;flex-shrink:0}
.prep-strip-tile.speaking{border-color:var(--em);box-shadow:0 0 12px rgba(0,195,122,.2)}
.prep-strip-tile.speaking-ai{border-color:var(--sky);box-shadow:0 0 12px rgba(45,156,219,.2)}
.prep-strip-av{border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800}
.prep-strip-ov{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.85));padding:10px 7px 5px;display:flex;align-items:flex-end;justify-content:space-between}
.prep-strip-name{font-size:9.5px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}

/* AI ANALYSIS OVERLAY for presenter */
.ai-analysis-overlay{position:absolute;bottom:0;left:0;right:0;z-index:5;background:linear-gradient(transparent,rgba(3,10,20,.95));padding:14px 16px 10px}
.aao-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:rgba(45,156,219,.8);margin-bottom:5px;display:flex;align-items:center;gap:5px}
.aao-dot{width:5px;height:5px;border-radius:50%;background:var(--sky);animation:pulse 1.2s infinite}
.aao-text{font-size:11.5px;line-height:1.65;color:rgba(255,255,255,.75);font-style:italic}

.prep-live-transcript{position:absolute;bottom:0;left:0;right:0;z-index:5;background:linear-gradient(transparent,rgba(3,10,20,.95));padding:12px 16px 10px}
.plt-label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:rgba(0,195,122,.7);margin-bottom:4px;display:flex;align-items:center;gap:5px}
.plt-dot{width:5px;height:5px;border-radius:50%;background:var(--em);animation:pulse 1.2s infinite}
.plt-text{font-size:12px;line-height:1.6;color:rgba(255,255,255,.8);font-family:var(--mono);min-height:18px}
.plt-cursor{display:inline-block;width:2px;height:12px;background:#5ee3b7;animation:typewriterBlink .8s infinite;margin-left:2px;vertical-align:middle}
.plt-empty{font-size:11px;color:rgba(255,255,255,.25);font-style:italic}

.prep-demo-badge{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:7px;padding:5px 14px;border-radius:20px;background:rgba(229,62,62,.15);border:1.5px solid rgba(229,62,62,.4);z-index:6;animation:fadeIn .3s ease;white-space:nowrap}
.prep-demo-badge-dot{width:7px;height:7px;border-radius:50%;background:var(--red);animation:recBlink 1s infinite}
.prep-demo-badge-text{font-size:11px;font-weight:700;color:var(--red);font-family:var(--mono)}

/* CTRL BAR */
.prep-ctrl-bar{min-height:60px;padding:8px 12px;background:rgba(7,17,30,.98);border-top:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:6px;overflow-x:auto}
.prep-ctrl-user-info{display:flex;align-items:center;gap:8px;min-width:0;flex:0 0 auto;max-width:160px}
.prep-ctrl-av{width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0}
.prep-ctrl-details{min-width:0;flex:1}
.prep-ctrl-name{font-size:12px;font-weight:700;color:#e8ecf2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prep-ctrl-sub{font-size:9.5px;color:rgba(255,255,255,.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.prep-ctrl-center{display:flex;align-items:center;gap:3px;flex:1;justify-content:center;flex-wrap:nowrap}
.cbtn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 6px;border-radius:9px;border:1px solid rgba(255,255,255,.08);cursor:pointer;background:rgba(255,255,255,.05);color:rgba(255,255,255,.5);font-size:7.5px;font-weight:700;transition:all .16s;min-width:38px;font-family:var(--font)}
.cbtn-ic{font-size:13px;transition:transform .18s}
.cbtn:hover{background:rgba(255,255,255,.1);color:#fff;border-color:rgba(255,255,255,.2);transform:translateY(-1px)}
.cbtn.on{background:rgba(0,195,122,.12);border-color:rgba(0,195,122,.3);color:#5ee3b7}
.cbtn.off{background:rgba(229,62,62,.1);border-color:rgba(229,62,62,.28);color:var(--red)}
.cbtn.hi{background:rgba(45,156,219,.12);border-color:rgba(45,156,219,.3);color:#7ed3f7}
.cbtn.am{background:rgba(246,166,35,.1);border-color:rgba(246,166,35,.25);color:#fcd18e}
.cbtn.em{background:rgba(0,195,122,.1);border-color:rgba(0,195,122,.25);color:#5ee3b7}
.cbtn.rec{background:rgba(229,62,62,.12);border-color:rgba(229,62,62,.4);color:var(--red);animation:recBlink 1.4s infinite}
.cbtn.pause-btn{background:rgba(246,166,35,.12);border-color:rgba(246,166,35,.3);color:#fcd18e}
.cbtn:disabled{opacity:.25;cursor:not-allowed;transform:none}
.cbtn-analyser{margin:1px 0;height:12px;display:flex;align-items:center}
.prep-ctrl-right{display:flex;align-items:center;gap:5px;flex:0 0 auto}
.end-room-btn{padding:6px 13px;border-radius:9px;border:none;cursor:pointer;background:linear-gradient(135deg,#e53e3e,#c53030);color:#fff;font-size:11px;font-weight:800;font-family:var(--font);box-shadow:0 3px 10px rgba(229,62,62,.24);transition:.18s;white-space:nowrap}
.end-room-btn:hover{transform:translateY(-1px);box-shadow:0 5px 18px rgba(229,62,62,.38)}
.react-pop{position:absolute;bottom:calc(100% + 7px);left:50%;transform:translateX(-50%);background:#0d1e34;border:1px solid rgba(255,255,255,.1);border-radius:11px;padding:6px 8px;display:flex;gap:4px;box-shadow:var(--sh2);z-index:200;animation:scaleIn .18s ease}
.react-em{font-size:18px;cursor:pointer;padding:3px;border-radius:6px;border:none;background:none;transition:.14s}
.react-em:hover{transform:scale(1.4)}

/* SIDE PANEL */
.prep-side-panel{background:rgba(7,17,30,.97);border-left:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;overflow:hidden;width:var(--panel-w);animation:panelSlideIn .25s ease;min-width:0}
.prep-panel-header{display:flex;align-items:center;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0}
.prep-panel-tabs{display:flex;flex:1;overflow:hidden}
.prep-ptab{flex:1;padding:10px 4px;background:none;border:none;border-bottom:2px solid transparent;color:rgba(255,255,255,.3);font-size:9px;font-weight:700;cursor:pointer;transition:.16s;display:flex;flex-direction:column;align-items:center;gap:3px;font-family:var(--font);text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
.prep-ptab:hover{color:rgba(255,255,255,.6)}
.prep-ptab.active{color:#5ee3b7;border-bottom-color:var(--em)}
.prep-panel-close{width:36px;height:100%;background:none;border:none;border-left:1px solid rgba(255,255,255,.07);cursor:pointer;color:rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:13px;transition:.15s;flex-shrink:0;padding:10px 8px}
.prep-panel-close:hover{color:rgba(255,255,255,.8);background:rgba(229,62,62,.1)}

.prep-panel-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}

/* AI Chat */
.prep-ai-msgs{display:flex;flex-direction:column;gap:7px;padding:12px;scroll-behavior:smooth}
.prep-ai-msg{animation:fadeUp .22s ease;width:100%}
.prep-ai-msg.from-ai{display:flex;gap:7px;align-items:flex-start}
.prep-ai-msg.from-me{display:flex;flex-direction:row-reverse;gap:7px;align-items:flex-start}
.prep-ai-bubble-av{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;align-self:flex-end}
.prep-ai-bubble-av.ai-side{background:rgba(45,156,219,.2);color:#7ed3f7;border:1px solid rgba(45,156,219,.2)}
.prep-ai-bubble-av.me-side{background:rgba(0,195,122,.2);color:#5ee3b7;border:1px solid rgba(0,195,122,.2)}
.prep-ai-bubble{padding:8px 11px;border-radius:10px;font-size:11.5px;line-height:1.65;max-width:88%;word-break:break-word}
.prep-ai-bubble.ai-style{background:rgba(45,156,219,.09);border:1px solid rgba(45,156,219,.15);color:#d0e8ff;border-radius:3px 10px 10px 10px}
.prep-ai-bubble.me-style{background:linear-gradient(135deg,rgba(0,195,122,.85),rgba(0,163,102,.95));color:#fff;border:none;border-radius:10px 3px 10px 10px}
.prep-ai-bubble.system-style{background:rgba(246,166,35,.07);border:1px solid rgba(246,166,35,.18);color:#fcd18e;font-size:10.5px;border-radius:9px;text-align:center;padding:6px 11px}
.prep-ai-typing{display:flex;gap:4px;padding:8px 12px;background:rgba(45,156,219,.09);border:1px solid rgba(45,156,219,.15);border-radius:3px 10px 10px 10px;width:fit-content}
.prep-ai-typing-dot{width:5px;height:5px;border-radius:50%;background:#7ed3f7;animation:dotPulse .8s ease-in-out infinite}
.prep-ai-speaking-row{padding:6px 10px;border-top:1px solid rgba(255,255,255,.06);background:rgba(45,156,219,.06);display:flex;align-items:center;gap:7px;flex-shrink:0;min-height:32px}
.prep-ai-speaking-text{font-size:10px;font-weight:700;color:#7ed3f7}
.quick-prompts{display:flex;gap:5px;flex-wrap:wrap;padding:7px 10px}
.quick-p{padding:3px 9px;border-radius:6px;border:1px solid rgba(45,156,219,.22);background:rgba(45,156,219,.07);cursor:pointer;font-size:9.5px;font-weight:600;color:#7ed3f7;transition:.15s;font-family:var(--font)}
.quick-p:hover{background:rgba(45,156,219,.16);border-color:rgba(45,156,219,.4)}
.prep-ai-input-area{padding:9px 10px;border-top:1px solid rgba(255,255,255,.07);flex-shrink:0;background:rgba(7,17,30,.7)}
.prep-ai-input-row{display:flex;gap:6px;align-items:flex-end}
.prep-ai-input{flex:1;padding:7px 10px;border-radius:9px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);color:#e8ecf2;font-size:11.5px;outline:none;resize:none;min-height:34px;max-height:72px;transition:border .15s;font-family:var(--font);line-height:1.5}
.prep-ai-input:focus{border-color:rgba(45,156,219,.5);background:rgba(45,156,219,.06)}
.prep-ai-input::placeholder{color:rgba(255,255,255,.2)}
.prep-ai-voice-btn{width:34px;height:34px;border-radius:9px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.06);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:.15s;flex-shrink:0}
.prep-ai-voice-btn.listening{background:rgba(229,62,62,.15);border-color:rgba(229,62,62,.4);animation:recBlink 1.2s infinite}
.prep-ai-voice-btn:hover{background:rgba(255,255,255,.12)}
.prep-ai-send{width:34px;height:34px;border-radius:9px;background:var(--grad);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s;font-size:13px;flex-shrink:0}
.prep-ai-send:hover{transform:scale(1.08)}
.prep-ai-send:disabled{opacity:.35;cursor:not-allowed}

/* Notes Panel */
.prep-notes-header{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.prep-notes-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.35)}
.prep-notes-count{font-size:9px;font-weight:700;padding:2px 7px;border-radius:5px;background:rgba(0,195,122,.12);color:#5ee3b7}
.prep-faq-list{padding:8px}
.prep-faq-item{border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);margin-bottom:6px;overflow:hidden;transition:.2s}
.prep-faq-item:hover{border-color:rgba(0,195,122,.2)}
.prep-faq-q{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 11px;cursor:pointer;user-select:none}
.prep-faq-q-text{font-size:11px;font-weight:700;color:#e8ecf2;flex:1;line-height:1.4}
.prep-faq-chevron{font-size:10px;color:rgba(255,255,255,.3);transition:transform .2s;flex-shrink:0}
.prep-faq-chevron.open{transform:rotate(180deg)}
.prep-faq-a{padding:0 11px 9px;font-size:10.5px;line-height:1.7;color:rgba(255,255,255,.6);border-top:1px solid rgba(255,255,255,.06);padding-top:8px;animation:fadeIn .18s ease;white-space:pre-wrap}
.prep-faq-num{font-size:8px;font-weight:800;color:var(--em);margin-bottom:2px;text-transform:uppercase;letter-spacing:.05em}

/* Actions Panel */
.prep-actions-panel{padding:10px}
.prep-action-btn{padding:9px 12px;border-radius:10px;border:1.5px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);cursor:pointer;font-size:11.5px;font-weight:700;color:rgba(255,255,255,.7);transition:.18s;font-family:var(--font);display:flex;align-items:center;gap:8px;text-align:left;width:100%;margin-bottom:5px}
.prep-action-btn:hover{background:rgba(0,195,122,.1);border-color:rgba(0,195,122,.28);color:#5ee3b7}
.prep-action-btn.primary{background:var(--grad);border-color:transparent;color:#fff;box-shadow:0 4px 14px rgba(0,195,122,.22)}
.prep-action-btn.primary:hover{transform:translateY(-1px);box-shadow:0 7px 20px rgba(0,195,122,.32)}
.prep-action-btn.demo-active{background:rgba(246,166,35,.12);border-color:rgba(246,166,35,.25);color:#fcd18e}
.prep-action-btn.pause-active{background:rgba(229,62,62,.12);border-color:rgba(229,62,62,.3);color:var(--red)}

.panel-toggle-fab{position:absolute;top:50%;right:0;transform:translateY(-50%);width:20px;height:48px;background:rgba(7,17,30,.9);border:1px solid rgba(255,255,255,.1);border-right:none;border-radius:8px 0 0 8px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);font-size:10px;z-index:10;transition:.16s}
.panel-toggle-fab:hover{color:#fff;background:rgba(0,195,122,.15)}

/* PRESENTER ROOM */
.room-page{height:100dvh;display:flex;flex-direction:column;overflow:hidden;background:#07111e;width:100vw}
.room-bar{height:50px;background:rgba(7,17,30,.98);border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;padding:0 10px;gap:6px;flex-shrink:0;z-index:100;overflow:hidden}
.room-logo{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:#fff;border:none;background:none;cursor:pointer;font-family:var(--font);flex-shrink:0}
.room-logo-ic{width:24px;height:24px;background:var(--grad);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px}
.room-divider{width:1px;height:14px;background:rgba(255,255,255,.08);flex-shrink:0}
.room-topic{flex:1;font-size:10.5px;color:rgba(255,255,255,.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;min-width:0}
.room-topic strong{color:#e8ecf2;font-weight:700}
.r-pill{display:flex;align-items:center;gap:3px;padding:2px 7px;border-radius:5px;font-size:9.5px;font-weight:700;flex-shrink:0;border:1px solid;white-space:nowrap}
.rp-timer{background:rgba(0,195,122,.12);border-color:rgba(0,195,122,.2);color:#5ee3b7;font-family:var(--mono)}
.rp-rec{background:rgba(229,62,62,.12);border-color:rgba(229,62,62,.2);color:var(--red);animation:recBlink 1.4s infinite}
.rp-rec-dot{width:5px;height:5px;border-radius:50%;background:var(--red)}
.rp-ai{background:rgba(45,156,219,.1);border-color:rgba(45,156,219,.18);color:#7ed3f7}
.rbar-end-btn{padding:3px 9px;border-radius:6px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.5);cursor:pointer;font-size:10.5px;font-weight:700;transition:.15s;flex-shrink:0;font-family:var(--font)}
.rbar-end-btn:hover{background:rgba(229,62,62,.15);border-color:rgba(229,62,62,.3);color:var(--red)}
.room-body{flex:1;display:flex;min-height:0;overflow:hidden}
.grid-area{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;position:relative}
.ss-area{flex:1;background:#030a14;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;min-height:0}
.ss-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:rgba(255,255,255,.2)}
.ss-active-label{position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(0,195,122,.15);border:1px solid rgba(0,195,122,.3);border-radius:8px;padding:5px 14px;font-size:11px;font-weight:700;color:#5ee3b7;white-space:nowrap;display:flex;align-items:center;gap:6px}
.ss-active-dot{width:6px;height:6px;border-radius:50%;background:var(--em);animation:pulse 1s infinite}
.presenter-strip{height:96px;background:rgba(0,0,0,.4);border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;gap:6px;padding:6px 10px;overflow-x:auto;flex-shrink:0}
.strip-tile{width:124px;min-width:124px;height:80px;border-radius:10px;background:#0d1e34;overflow:hidden;position:relative;display:flex;align-items:center;justify-content:center;border:1.5px solid rgba(255,255,255,.06);transition:.2s;flex-shrink:0}
.strip-tile.spk{border-color:var(--em);box-shadow:0 0 12px rgba(0,195,122,.2)}
.strip-av{border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;width:34px;height:34px;font-size:13px}
.strip-ov{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.85));padding:10px 6px 5px;display:flex;align-items:flex-end;justify-content:space-between}
.strip-name{font-size:9.5px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.live-transcript-bar{padding:6px 10px;border-top:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.35);flex-shrink:0}
.lt-label{font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:rgba(0,195,122,.6);margin-bottom:2px;display:flex;align-items:center;gap:4px}
.lt-dot{width:5px;height:5px;border-radius:50%;background:var(--em);animation:pulse 1.2s infinite;flex-shrink:0}
.lt-text{font-size:10px;color:rgba(255,255,255,.55);line-height:1.5;font-family:var(--mono);min-height:14px}
.ctrl-bar{min-height:56px;padding:6px 10px;background:rgba(7,17,30,.98);border-top:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;gap:5px;flex-wrap:wrap}
.cg{display:flex;align-items:center;gap:3px;flex-wrap:wrap}
.end-room-btn-sm{padding:6px 12px;border-radius:8px;border:none;cursor:pointer;background:linear-gradient(135deg,#e53e3e,#c53030);color:#fff;font-size:11px;font-weight:800;font-family:var(--font);box-shadow:0 3px 10px rgba(229,62,62,.24);transition:.18s;white-space:nowrap}
.end-room-btn-sm:hover{transform:translateY(-1px);box-shadow:0 5px 18px rgba(229,62,62,.38)}
.side-panel{width:260px;min-width:260px;background:rgba(7,17,30,.98);border-left:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;overflow:hidden}
.panel-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.07);flex-shrink:0}
.ptab{flex:1;padding:8px 3px;background:none;border:none;border-bottom:2px solid transparent;color:rgba(255,255,255,.28);font-size:8px;font-weight:700;cursor:pointer;transition:.16s;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:var(--font);text-transform:uppercase;letter-spacing:.05em}
.ptab:hover{color:rgba(255,255,255,.6)}
.ptab.active{color:#5ee3b7;border-bottom-color:var(--em)}
.ptab-close{flex:0 0 auto;padding:8px;color:rgba(255,255,255,.2);cursor:pointer;border:none;background:none;font-size:11px;transition:.15s;font-family:var(--font)}
.ptab-close:hover{color:rgba(255,255,255,.6)}
.pscroll{flex:1;overflow-y:auto;min-height:0;-webkit-overflow-scrolling:touch}
.p-list{padding:7px;display:flex;flex-direction:column;gap:4px}
.p-row{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06);transition:.16s}
.p-row:hover{border-color:rgba(0,195,122,.25);background:rgba(0,195,122,.06)}
.p-av{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0}
.p-info{flex:1;min-width:0}
.p-name{font-size:11px;font-weight:700;color:#e8ecf2}
.p-role{font-size:9px;color:rgba(255,255,255,.28)}
.chat-msgs{padding:8px;display:flex;flex-direction:column;gap:5px}
.chat-msg{display:flex;gap:5px;animation:fadeUp .18s ease}
.chat-msg.own{flex-direction:row-reverse}
.chat-av-s{width:18px;height:18px;border-radius:50%;font-size:7.5px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;align-self:flex-end}
.chat-bw{display:flex;flex-direction:column;gap:2px;max-width:84%}
.chat-msg.own .chat-bw{align-items:flex-end}
.chat-sender{font-size:8.5px;font-weight:700;color:rgba(255,255,255,.25)}
.chat-bubble{padding:5px 8px;border-radius:9px;font-size:11px;line-height:1.5;word-break:break-word}
.b-o{background:rgba(255,255,255,.07);color:#e8ecf2;border:1px solid rgba(255,255,255,.07);border-radius:3px 9px 9px 9px}
.b-own{background:var(--grad);color:#fff;border-radius:9px 3px 9px 9px}
.chat-t{font-size:8px;color:rgba(255,255,255,.18)}
.chat-empty{text-align:center;color:rgba(255,255,255,.2);font-size:11px;padding:18px 10px;line-height:1.7}
.chat-ia{padding:7px;border-top:1px solid rgba(255,255,255,.07);display:flex;gap:5px;align-items:flex-end;flex-shrink:0}
.chat-inp{flex:1;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#e8ecf2;font-size:11px;outline:none;resize:none;min-height:30px;max-height:64px;transition:border .14s;font-family:var(--font)}
.chat-inp:focus{border-color:var(--em)}
.chat-inp::placeholder{color:rgba(255,255,255,.2)}
.chat-send{width:28px;height:28px;border-radius:7px;background:var(--grad);border:none;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;transition:.15s}
.chat-send:hover{transform:scale(1.1)}
.ai-sum-pad{padding:9px;display:flex;flex-direction:column;gap:7px}
.ai-sum-card{background:rgba(0,195,122,.07);border:1px solid rgba(0,195,122,.18);border-radius:11px;padding:10px}
.ai-sum-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:rgba(255,255,255,.28);margin-bottom:5px}
.ai-sum-val{font-size:11.5px;font-weight:600;color:rgba(255,255,255,.7);line-height:1.6}
.ai-sum-dot{width:6px;height:6px;border-radius:50%;background:var(--em);animation:pulse 1.5s infinite;display:inline-block;margin-right:5px}

/* Analysis modal */
.analysis-bg{position:fixed;inset:0;background:rgba(0,0,0,.68);backdrop-filter:blur(12px);z-index:800;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeIn .2s ease}
.analysis-box{background:#0c1422;border:1px solid rgba(0,195,122,.2);border-radius:var(--r);width:100%;max-width:580px;max-height:88dvh;display:flex;flex-direction:column;overflow:hidden;box-shadow:var(--sh3);animation:slideUp .27s ease}
.analysis-head{padding:13px 17px 11px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.analysis-title{font-size:14px;font-weight:800;color:#e8ecf2}
.analysis-body{overflow-y:auto;flex:1;padding:14px 17px}
.a-sec{margin-bottom:13px;animation:fadeUp .35s ease both}
.a-sec-title{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,.28);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.07)}
.prog-wrap{margin-bottom:4px}
.prog-lbl{display:flex;justify-content:space-between;font-size:10px;color:rgba(255,255,255,.4);font-weight:600;margin-bottom:2px}
.prog-track{height:4px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden}
.prog-fill{height:100%;border-radius:3px;transition:width 1s ease}
.analysis-foot{padding:10px 17px;border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:flex-end;gap:7px;flex-shrink:0;flex-wrap:wrap}

/* Results loader */
.results-loader{position:fixed;inset:0;background:rgba(8,16,30,.96);z-index:800;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;animation:fadeIn .2s ease}
.results-loader-icon{font-size:48px;animation:scaleIn .5s cubic-bezier(.34,1.56,.64,1) both}
.results-loader-title{font-size:16px;font-weight:800;color:#e8ecf2}
.results-loader-sub{font-size:11px;color:rgba(255,255,255,.35)}
.results-loader-steps{display:flex;flex-direction:column;gap:8px;margin-top:10px;width:280px}
.results-loader-step{display:flex;align-items:center;gap:9px;padding:7px 11px;border-radius:9px;font-size:11px;font-weight:700;transition:all .3s}
.results-loader-step.done{background:rgba(0,195,122,.1);border:1px solid rgba(0,195,122,.2);color:#5ee3b7}
.results-loader-step.active{background:rgba(45,156,219,.1);border:1px solid rgba(45,156,219,.2);color:#7ed3f7}
.results-loader-step.pending{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.3)}

/* Results page */
.results-page{flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(18px,4vw,52px);text-align:center;background:radial-gradient(ellipse at 50% 20%,rgba(0,195,122,.07) 0%,transparent 65%);-webkit-overflow-scrolling:touch;width:100%;min-height:100dvh}
.res-trophy{font-size:clamp(42px,8vw,64px);margin-bottom:12px;animation:scaleIn .55s cubic-bezier(.34,1.56,.64,1) .15s both}
.res-h{font-size:clamp(17px,3vw,28px);font-weight:900;letter-spacing:-.4px;margin-bottom:6px;color:var(--t1)}
.res-sub{font-size:12px;color:var(--t2);max-width:320px;line-height:1.75;margin-bottom:16px}
.res-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;width:100%;max-width:300px;margin-bottom:14px}
.res-stat{background:var(--surf);border:1px solid var(--bdr);border-radius:13px;padding:10px;box-shadow:var(--sh);animation:fadeUp .35s ease both;text-align:center;transition:all .22s}
.res-stat:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,195,122,.1)}
.res-stat-ic{font-size:16px;margin-bottom:3px}
.res-stat-v{font-size:clamp(14px,2vw,20px);font-weight:900;color:var(--em)}
.res-stat-l{font-size:9px;color:var(--t3);margin-top:1px}
.res-acts{display:flex;gap:7px;flex-wrap:wrap;justify-content:center}

.sched-info{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;background:rgba(0,195,122,.06);border:1px solid rgba(0,195,122,.16);margin-bottom:12px}
.sched-info-text{font-size:11.5px;font-weight:700;color:var(--em)}
.sched-info-sub{font-size:10.5px;color:var(--t2)}

/* RESPONSIVE */
@media(max-width:1200px){:root{--panel-w:280px}}
@media(max-width:1024px){
  .sp-setup{grid-template-columns:34% 1fr}
  .side-panel{width:240px;min-width:240px}
  :root{--panel-w:260px}
}
@media(max-width:900px){
  :root{--panel-w:100%}
  .prep-body.panel-open{grid-template-columns:1fr}
  .prep-side-panel{position:absolute;right:0;top:0;bottom:0;z-index:30;width:min(320px,85vw);box-shadow:-8px 0 32px rgba(0,0,0,.5)}
  .prep-body.panel-closed .prep-side-panel{display:none}
  .prep-bar-topic{display:none}
}
@media(max-width:860px){
  .sp-setup{grid-template-columns:1fr;height:auto;overflow:visible}
  html,body{overflow:auto}.sp-app{height:auto;min-height:100dvh;overflow:visible}.sp-left{min-height:auto}.sp-left-inner{padding:16px}
  .sp-features{display:grid;grid-template-columns:1fr 1fr;gap:5px}.ctx-chip{display:none}
  .sp-right{height:auto;overflow:visible}.sp-right-scroll{overflow:visible;height:auto}
  .room-body{flex-direction:column}
  .side-panel{width:100%;min-width:unset;border-left:none;border-top:1px solid rgba(255,255,255,.07);max-height:280px}
}
@media(max-width:640px){
  .fi-row{grid-template-columns:1fr}.module-grid{grid-template-columns:1fr}.submode-grid{grid-template-columns:1fr 1fr}
  .sp-features{grid-template-columns:1fr}
  .ctrl-bar{padding:5px 7px;gap:3px}.cg{gap:2px}.cbtn{padding:4px 3px;min-width:32px;font-size:7px}.cbtn-ic{font-size:11px}
  .side-panel{display:none}.res-stats{grid-template-columns:1fr 1fr 1fr}
  .prep-ctrl-user-info{display:none}
  .prep-ctrl-center{justify-content:flex-start;gap:2px}
  .cbtn{min-width:34px;padding:4px 3px}
  .prep-tiles-grid{grid-template-columns:1fr}
  .prep-tiles-grid .prep-tile:nth-child(2){display:none}
  :root{--panel-w:100vw}
  .prep-side-panel{width:100vw;left:0;right:0}
}
@media(max-width:480px){
  .room-bar{height:44px;padding:0 8px;gap:4px}.r-pill{font-size:8.5px;padding:2px 5px}
  .strip-tile{width:100px;min-width:100px;height:66px}
  .res-acts{flex-direction:column;width:100%;max-width:280px}.res-acts button{width:100%}
  .prep-bar{height:46px;padding:0 8px;gap:4px}
  .prep-bar-logo span{display:none}
  .submode-grid{grid-template-columns:1fr}
  .prep-ctrl-bar{padding:5px 8px;gap:3px;min-height:54px}
  .demo-ready-inner{padding:18px 16px;margin:0 12px}
  .ai-suggestion-banner{min-width:unset;width:calc(100vw - 32px);max-width:none}
}
@media(max-width:360px){
  .cbtn{min-width:28px;padding:3px 2px;font-size:6.5px}
  .cbtn-ic{font-size:10px}
}
`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const COLORS = ["#00c37a","#6366f1","#f59e0b","#38bdf8","#ec4899","#8b5cf6","#f97316","#06b6d4"];
const REACTIONS = ["👍","👏","❤️","🔥","🤔","🎓","✨","💡"];

const SUBJECT_UNITS = {
  "Computer Science":["Data Structures","Algorithms","Operating Systems","Networks","Databases","AI & ML","Web Development","Cybersecurity","Other"],
  "Mathematics":["Calculus","Linear Algebra","Statistics","Number Theory","Discrete Math","Probability","Geometry","Other"],
  "Biology":["Cell Biology","Genetics","Ecology","Evolution","Physiology","Microbiology","Biochemistry","Other"],
  "Physics":["Mechanics","Thermodynamics","Electromagnetism","Quantum Physics","Optics","Relativity","Other"],
  "Chemistry":["Organic Chemistry","Inorganic Chemistry","Physical Chemistry","Analytical Chemistry","Biochemistry","Other"],
  "History":["Ancient History","Medieval History","Modern History","World Wars","Cold War","Economic History","Other"],
  "Literature":["Poetry","Fiction","Drama","Non-Fiction","Literary Theory","Comparative Lit","Other"],
  "Economics":["Microeconomics","Macroeconomics","Development Economics","International Trade","Behavioral Econ","Other"],
  "Philosophy":["Ethics","Logic","Metaphysics","Epistemology","Political Philosophy","Philosophy of Mind","Other"],
  "Psychology":["Cognitive Psychology","Social Psychology","Developmental Psych","Clinical Psychology","Neuroscience","Other"],
  "Law":["Constitutional Law","Criminal Law","Contract Law","International Law","Tort Law","Other"],
  "Business":["Marketing","Finance","Strategy","Operations","Entrepreneurship","HR Management","Other"],
  "Medicine":["Anatomy","Pharmacology","Pathology","Clinical Skills","Public Health","Other"],
  "Engineering":["Mechanical Eng","Electrical Eng","Civil Eng","Chemical Eng","Aerospace Eng","Other"],
  "Arts":["Fine Arts","Design","Music Theory","Film Studies","Architecture","Other"],
};
const SUBJECTS = Object.keys(SUBJECT_UNITS);

const TOPICS = [
  "Should AI replace human teachers?","Is social media harmful to democracy?",
  "Should coding be mandatory in schools?","Is nuclear energy the answer to climate change?",
  "Should universal basic income be implemented?","Is space exploration worth the cost?",
  "Should animal testing be banned?","The ethics of gene editing in humans",
];

const AI_RESPONSES = {
  outline:`Here is a complete outline for your seminar:\n\n1. Opening Hook — start with a bold question or striking statistic\n2. Thesis Statement — one clear sentence stating your position\n3. Argument 1 — your strongest point with supporting evidence\n4. Argument 2 — a second angle supported by a case study\n5. Argument 3 — address the nuance or complexity\n6. Counterarguments — acknowledge and rebut key objections\n7. Conclusion — restate thesis, call to action, or open question for the audience`,
  questions:`Likely audience questions to prepare for:\n\n• What specific evidence supports your main claim?\n• What are the real-world risks of your proposed stance?\n• How does this apply in different cultural or geographic contexts?\n• What would the strongest opponent of your view say?\n• What is your personal position on this topic?\n• If your position is wrong, what would change your mind?`,
  examples:`Strong examples and evidence to use:\n\n• Cite a peer-reviewed study relevant to your subject area\n• Reference a real-world case study (success or failure)\n• Use a recent news event as a contemporary anchor\n• Include a historical precedent for long-term perspective\n• Add a personal or expert anecdote to make it memorable\n• Use statistics sparingly — one powerful number beats ten weak ones`,
  script:`Opening script for your seminar:\n\n"Good [morning/afternoon] everyone. My name is [Name], and today I will be presenting on [topic].\n\nThis is a critical issue because [key reason]. Over the next [X] minutes, I'll walk you through [point 1], [point 2], and [point 3] — before opening the floor to your questions.\n\nLet me start with a question for you all: [pose a thought-provoking question to the audience]..."`,
  feedback:`AI Demo Feedback:\n\n✅ Strong opening — your introduction established the topic clearly\n✅ Main argument was identifiable and well-structured\n⚠️ Pace yourself — slow down during key claims for impact\n⚠️ Add a stronger, memorable closing statement\n💡 Tip: End with a direct question to engage your observers\n💡 Tip: Use pauses after important points — silence is powerful`,
};

const AI_STUCK_SUGGESTIONS = [
  "It seems you've paused — take a breath! Try restating your main argument in one sentence.",
  "You might be stuck — try saying: 'Let me approach this from a different angle...' and continue.",
  "Tip: If you're struggling for words, summarise what you've said so far to regain momentum.",
  "Remember your opening hook — circle back to it to re-engage and refocus yourself.",
  "Try a rhetorical question to buy yourself thinking time: 'What does this really mean for us?'",
];

const AI_PRESENTATION_ANALYSIS = [
  "Your slide structure is clear — the flow from topic to evidence is logical.",
  "Consider adding more visual contrast to highlight key data points on screen.",
  "Your pacing looks steady. Try pausing 2 seconds after each new slide appears.",
  "Good coverage of the main argument. Make sure your closing slide has a strong call-to-action.",
  "The screen layout is effective. Ensure your text is readable from the back of the room.",
  "AI detects you're presenting content confidently — good delivery momentum.",
];

const COMMUNITY_SESSIONS_KEY = "gradeup_community_sessions_v1";
const avColor = n => COLORS[(n||"U").charCodeAt(0) % COLORS.length];
const avInit = n => (n||"U").split(/[_\s]/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
const genId = () => Math.random().toString(36).slice(2,12);
const genRoomLink = id => `${typeof window!=="undefined"?window.location.origin:""}/seminarPage/join?room=${id}`;
const getErrorMessage = (error, fallback) => {
  const raw =
    error?.message ??
    error?.response?.message ??
    error?.response?.data?.message ??
    error?.data?.message ??
    error;
  if (typeof raw === "string" && raw.trim()) return raw;
  if (raw && typeof raw === "object") {
    const nested = raw.message || raw.error || raw.detail || raw.reason || raw.statusText || null;
    if (typeof nested === "string" && nested.trim()) return nested;
    try {
      const json = JSON.stringify(raw);
      if (json && json !== "{}") return json;
    } catch {}
  }
  return fallback;
};
const parseSeminarSessionId = value => {
  const raw = (value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.searchParams.get("room") || url.pathname.split("/").filter(Boolean).pop() || raw;
  } catch {
    const roomMatch = raw.match(/[?&]room=([^&]+)/i);
    if (roomMatch?.[1]) {
      return decodeURIComponent(roomMatch[1]);
    }
    return raw;
  }
};

function publishCommunitySession(session) {
  try {
    const prev = JSON.parse(localStorage.getItem(COMMUNITY_SESSIONS_KEY)||"[]");
    const next = [session,...prev.filter(s=>s.id!==session.id)].slice(0,20);
    localStorage.setItem(COMMUNITY_SESSIONS_KEY,JSON.stringify(next));
    window.dispatchEvent(new StorageEvent("storage",{key:COMMUNITY_SESSIONS_KEY}));
  } catch {}
}

function getCommunitySessions() {
  try {
    return JSON.parse(localStorage.getItem(COMMUNITY_SESSIONS_KEY)||"[]");
  } catch { return []; }
}

// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useTimer(running) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setS(x=>x+1), 1000);
    return () => clearInterval(id);
  }, [running]);
  return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
}

function usePausableTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(x=>x+1), 1000);
    return () => clearInterval(id);
  }, [running]);
  const fmt = n => `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
  return { display: fmt(elapsed), elapsed, isPaused: !running, pause: () => setRunning(false), resume: () => setRunning(true) };
}

function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recRef = useRef(null);
  const start = useCallback((onResult) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous=true; rec.interimResults=true; rec.lang="en-US";
    rec.onstart = () => setIsListening(true);
    rec.onend   = () => setIsListening(false);
    rec.onresult = e => {
      let final="",interim="";
      for (let i=e.resultIndex;i<e.results.length;i++) {
        if (e.results[i].isFinal) final+=e.results[i][0].transcript;
        else interim+=e.results[i][0].transcript;
      }
      const combined=(final+" "+interim).trim();
      setTranscript(combined);
      if (final.trim()) onResult(final.trim());
    };
    rec.onerror = () => setIsListening(false);
    recRef.current=rec;
    try { rec.start(); } catch {}
  }, []);
  const stop = useCallback(() => { try { recRef.current?.stop(); } catch {} setIsListening(false); setTranscript(""); }, []);
  return { transcript, isListening, start, stop };
}

function useMicPerm() {
  const [state, setState] = useState("idle");
  const [stream, setStream] = useState(null);

  async function request() {
    setState("requesting");
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setStream(nextStream);
      setState("granted");
      return nextStream;
    } catch {
      setState("denied");
      return null;
    }
  }

  function stop() {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setState("idle");
  }

  return { state, stream, request, stop };
}

function useAIVoice() {
  const [isSpeaking,setIsSpeaking] = useState(false);
  const voiceRef = useRef(null);
  const audioRef = useRef(null);
  useEffect(() => {
    const pick = () => {
      const v=window.speechSynthesis?.getVoices()||[];
      voiceRef.current=v.find(x=>x.name.includes("Google UK English"))||v.find(x=>x.lang.startsWith("en")&&!x.localService)||v[0]||null;
    };
    pick(); window.speechSynthesis?.addEventListener("voiceschanged",pick);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged",pick);
  },[]);
  const speak = useCallback((text,onDone,callbacks={}) => {
    const onStart = typeof callbacks?.onStart === "function" ? callbacks.onStart : null;
    const speakWithBrowserVoice = () => {
      if (!("speechSynthesis" in window)){onDone?.();return;}
      window.speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.rate=0.9;u.pitch=1.05;u.volume=1;
      if (voiceRef.current) u.voice=voiceRef.current;
      u.onstart=()=>{setIsSpeaking(true);onStart?.();};
      u.onend=()=>{setIsSpeaking(false);onDone?.();};
      u.onerror=()=>{setIsSpeaking(false);onDone?.();};
      setTimeout(()=>window.speechSynthesis.speak(u),80);
    };

    synthesizeDebateSpeech({ text, voice: "alloy" })
      .then((audio) => {
        if (!audio?.dataUrl) {
          throw new Error("Missing audio data");
        }
        window.speechSynthesis?.cancel();
     if (audioRef.current) {
          audioRef.current.onended = null;
          audioRef.current.pause();
        }
        const player = new Audio(audio.dataUrl);
        audioRef.current = player;
        player.onplay = () => { setIsSpeaking(true); onStart?.(); };
        player.onended = () => {
          setIsSpeaking(false);
          onDone?.();
        };
        player.onerror = () => {
          setIsSpeaking(false);
          onStart?.();          // advance greetingState to "speaking" before fallback
          speakWithBrowserVoice();
        };
        player.play().then(() => {
          // play() resolved — audio started (onplay will also fire, that's fine)
        }).catch(() => {
          setIsSpeaking(false);
          onStart?.();          // ensure greetingState advances to "speaking"
          speakWithBrowserVoice();
        });
      })
      .catch(() => {
        speakWithBrowserVoice();
      });
  },[]);
  const cancel = useCallback(()=>{
    window.speechSynthesis?.cancel();
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onplay = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  },[]);
  return useMemo(() => ({isSpeaking,speak,cancel}), [isSpeaking, speak, cancel]);
}

function useToast() {
  const [toast,setToast] = useState(null);
  const show = useCallback((msg,type="success") => setToast({msg,type}), []);
  useEffect(() => {
    if (!toast) return;
    const t=setTimeout(()=>setToast(null),3200);
    return ()=>clearTimeout(t);
  },[toast]);
  const node = toast ? (
    <div className={`sp-toast ${toast.type}`} onClick={()=>setToast(null)}>
      {toast.type==="success"?"✅":toast.type==="error"?"❌":toast.type==="warn"?"⚠️":"ℹ️"} {toast.msg}
    </div>
  ) : null;
  return {show,node};
}

// Kept only as a fallback reference while the premium exporter below owns all downloads.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function downloadSessionPDFLegacy({ config, timer, transcriptHistory, notes, messages }) {
  const doc = new jsPDF();
  const now = new Date().toLocaleString();
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(0, 195, 122);
  doc.text("SeminarArena Session Report", 20, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${now}`, 20, 30);
  
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.text("Topic:", 20, 45);
  doc.setFont("helvetica", "normal");
  const topicText = `"${config?.topic || "—"}"`;
  const splitTopic = doc.splitTextToSize(topicText, 140);
  doc.text(splitTopic, 40, 45);

  let y = 45 + (splitTopic.length * 7) + 5;
  
  if (notes && notes.length > 0) {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(45, 156, 219);
    doc.text(`AI Notes (${notes.length})`, 20, y);
    y += 10;
    
    notes.forEach((n, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(0, 195, 122);
      doc.text(`Note ${i + 1}`, 20, y);
      y += 6;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(20, 20, 20);
      
      const splitQ = doc.splitTextToSize(n.q, 170);
      if (y + (splitQ.length * 6) > 280) { doc.addPage(); y = 20; }
      doc.text(splitQ, 20, y);
      y += (splitQ.length * 6) + 2;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(80, 80, 80);
      
      const splitA = doc.splitTextToSize(n.a, 170);
      
      if (y + (splitA.length * 5) > 280) { doc.addPage(); y = 20; }
      doc.text(splitA, 20, y);
      y += (splitA.length * 5) + 10;
    });
  }
  
  doc.save(`seminar-report-${Date.now()}.pdf`);
}

function downloadSessionPDF({ config, timer, transcriptHistory, notes, messages, apiScores = null, hintsUsed = 0, topicsCovered = [] }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const PW = 210;
  const PH = 297;
  const ML = 16;
  const MR = 16;
  const CW = PW - ML - MR;
  const TOP = 25;
  const BOTTOM = 20;
  const C = {
    green: [0, 195, 122],
    sky: [45, 156, 219],
    pink: [220, 60, 140],
    amber: [246, 166, 35],
    red: [229, 62, 62],
    ink: [8, 14, 26],
    panel: [14, 22, 38],
    panel2: [20, 31, 52],
    white: [255, 255, 255],
    soft: [232, 236, 242],
    muted: [139, 150, 166],
  };

  const clean = (value) => String(value ?? "")
    .replace(/[•]/g, "-")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126);
    })
    .join("")
    .trim();

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const topic = clean(config?.topic || "Seminar Session");
  const presenter = clean(config?.name || "Student");
  const subject = clean(config?.subject || "General");
  const unit = clean(config?.unit || "Not specified");
  const duration = clean(String(timer || "Not recorded"));
  const safeNotes = Array.isArray(notes) ? notes : [];
  const safeMessages = Array.isArray(messages) ? messages : [];
  const transcript = (Array.isArray(transcriptHistory) ? transcriptHistory : [])
    .map((item) => clean(typeof item === "string" ? item : item?.text || ""))
    .filter(Boolean);
  const chatMessages = safeMessages.filter((m) => (m.from || m.type) !== "system" && clean(m.text || ""));

  let pageNum = 1;
  let y = TOP;

  const fill = (col) => doc.setFillColor(col[0], col[1], col[2]);
  const draw = (col) => doc.setDrawColor(col[0], col[1], col[2]);
  const txtColor = (col) => doc.setTextColor(col[0], col[1], col[2]);
  const rect = (x, ry, w, h, col, r = 0) => {
    fill(col);
    if (r) doc.roundedRect(x, ry, w, h, r, r, "F");
    else doc.rect(x, ry, w, h, "F");
  };
  const strokeRect = (x, ry, w, h, col, r = 0, lw = 0.25) => {
    draw(col);
    doc.setLineWidth(lw);
    if (r) doc.roundedRect(x, ry, w, h, r, r, "S");
    else doc.rect(x, ry, w, h, "S");
  };
  const txt = (value, x, ry, size, col, bold = false, align = "left") => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    txtColor(col);
    doc.text(clean(value), x, ry, { align });
  };
  const wrap = (value, x, ry, w, size, col, bold = false, lineH = 4.8) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    txtColor(col);
    const lines = doc.splitTextToSize(clean(value), w);
    doc.text(lines, x, ry);
    return lines.length * lineH;
  };
  const bg = () => {
    rect(0, 0, PW, PH, C.ink);
    rect(0, 0, 5, PH, C.green);
    rect(5, 0, 1, PH, C.sky);
  };
  const footer = () => {
    rect(0, PH - 12, PW, 12, C.panel);
    txt(`Generated ${dateStr}`, ML, PH - 5, 7, C.muted);
    txt(`Page ${pageNum}`, PW / 2, PH - 5, 7, C.muted, false, "center");
    txt("Confidential report", PW - MR, PH - 5, 7, C.green, true, "right");
  };
  const header = () => {
    rect(0, 0, PW, 16, C.panel);
    txt("SeminarArena", ML, 10.5, 10, C.white, true);
    txt("Session Performance Report", ML + 38, 10.5, 7, C.muted);
    txt(topic.slice(0, 52), PW - MR, 10.5, 7, C.green, true, "right");
  };
  const addPage = () => {
    doc.addPage();
    pageNum += 1;
    bg();
    header();
    footer();
    y = TOP;
  };
  const ensure = (needed) => {
    if (y + needed > PH - BOTTOM) addPage();
  };
  const section = (title, subtitle = "", col = C.green) => {
    ensure(18);
    rect(ML, y, CW, 12, C.panel2, 2);
    rect(ML, y, 3, 12, col, 1.5);
    txt(title, ML + 7, y + 7.8, 9, col, true);
    if (subtitle) txt(subtitle, PW - MR - 4, y + 7.8, 6.5, C.muted, false, "right");
    y += 17;
  };
  const pill = (x, ry, w, label, col) => {
    rect(x, ry, w, 6.5, [10, 42, 32], 2.5);
    strokeRect(x, ry, w, 6.5, col, 2.5, 0.2);
    txt(label, x + w / 2, ry + 4.4, 6, col, true, "center");
  };
  const progress = (x, ry, w, h, pct, col) => {
    rect(x, ry, w, h, C.panel, h / 2);
    rect(x, ry, Math.max(2, (w * pct) / 100), h, col, h / 2);
  };
  const hashScore = (seed, min, max) => {
    let h = 0;
    for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return min + (Math.abs(h) % (max - min + 1));
  };

  const transcriptVolume = Math.min(10, transcript.join(" ").length / 220);
  const aiExchanges = chatMessages.filter((m) => (m.from || m.type) === "ai" || m.sender === "AI Moderator").length;
  const learnerExchanges = chatMessages.filter((m) => (m.from || "").includes("me") || (m.sender && m.sender !== "AI Moderator")).length;
  // Use real API scores if available, otherwise fall back to calculated
  const hasApiScores = apiScores && typeof apiScores === "object" && apiScores.total_score != null;
  const scores = hasApiScores ? {
    delivery: Math.round(((apiScores.presentation_flow ?? 0) / 20) * 100),
    clarity: Math.round(((apiScores.conceptual_understanding ?? 0) / 30) * 100),
    depth: Math.round(((apiScores.depth_of_knowledge ?? 0) / 25) * 100),
    engagement: Math.round(((apiScores.engagement ?? 0) / 15) * 100),
  } : {
    delivery: Math.min(98, hashScore(topic + presenter + "delivery", 68, 92) + Math.round(transcriptVolume / 2)),
    clarity: Math.min(98, hashScore(topic + "clarity", 66, 94) + (safeNotes.length > 2 ? 2 : 0)),
    depth: Math.min(96, hashScore(topic + subject + "depth", 62, 90) + Math.min(6, safeNotes.length)),
    engagement: Math.min(97, hashScore(topic + "engagement", 64, 91) + Math.min(5, aiExchanges + learnerExchanges)),
  };
  const overall = hasApiScores ? (apiScores.total_score ?? 0) : Math.round((scores.delivery + scores.clarity + scores.depth + scores.engagement) / 4);
  const scoreColor = overall >= 82 ? C.green : overall >= 68 ? C.amber : C.red;
  const verdict = overall >= 88 ? "Outstanding" : overall >= 78 ? "Strong" : overall >= 65 ? "Promising" : "Needs focused practice";

  bg();
  for (let i = 0; i < 54; i += 1) {
    const mix = i / 54;
    doc.setFillColor(Math.round(8 + mix * 8), Math.round(14 + mix * 92), Math.round(26 + mix * 55));
    doc.rect(6, i * 1.25, PW - 6, 1.3, "F");
  }
  rect(ML, 19, 16, 16, C.green, 3);
  txt("SA", ML + 8, 29.8, 10, C.white, true, "center");
  txt("SeminarArena", ML + 21, 26, 14, C.white, true);
  txt("AI-powered seminar performance report", ML + 21, 32.2, 7.5, C.green);
  pill(PW - MR - 49, 22, 49, `${dateStr}  ${timeStr}`, C.green);
  txt("SESSION", ML, 58, 9, C.green, true);
  txt("PERFORMANCE", ML, 70, 25, C.white, true);
  txt("REPORT", ML, 83, 25, C.soft, true);

  const cx = PW - MR - 30;
  const cy = 66;
  const cr = 23;
  rect(cx - cr, cy - cr, cr * 2, cr * 2, C.panel2, cr);
  draw(scoreColor);
  doc.setLineWidth(2.6);
  doc.circle(cx, cy, cr - 1, "S");
  txt(overall, cx, cy + 3, 21, scoreColor, true, "center");
  txt("/100", cx, cy + 10, 7, C.muted, false, "center");
  txt(verdict.toUpperCase(), cx, cy + 17, 6.5, C.white, true, "center");

  y = 98;
  rect(ML, y, CW, 38, C.panel2, 4);
  rect(ML, y, 4, 38, C.green, 2);
  txt("SEMINAR TOPIC", ML + 9, y + 8, 7, C.green, true);
  const topicHeight = wrap(topic, ML + 9, y + 16, CW - 18, 11, C.white, true, 5);
  const metaY = y + Math.max(27, topicHeight + 17);
  [["Presenter", presenter], ["Subject", subject], ["Unit", unit], ["Duration", duration]].forEach(([label, value], i) => {
    const x = ML + 9 + i * (CW - 18) / 4;
    txt(label, x, metaY, 6.4, C.muted);
    txt(String(value).slice(0, 20), x, metaY + 5.5, 7.2, C.soft, true);
  });

  y = 148;
  rect(ML, y, CW, 50, C.panel, 4);
  txt("PERFORMANCE SNAPSHOT", ML + 9, y + 9, 8, C.green, true);
  [["Delivery", scores.delivery, C.green], ["Clarity", scores.clarity, C.sky], ["Depth", scores.depth, C.amber], ["Engagement", scores.engagement, C.pink]].forEach(([label, score, col], i) => {
    const by = y + 17 + i * 8.5;
    txt(label, ML + 9, by + 3.6, 7.2, C.soft);
    progress(ML + 46, by, CW - 68, 4.5, score, col);
    txt(`${score}%`, ML + CW - 8, by + 3.8, 7.2, col, true, "right");
  });

  y = 211;
  [["AI Exchanges", String(aiExchanges + learnerExchanges), C.sky], ["Notes Saved", String(safeNotes.length), C.green], ["Transcript Lines", String(transcript.length), C.amber], ["Overall", `${overall}%`, scoreColor]].forEach(([label, value, col], i) => {
    const w = CW / 4;
    const x = ML + i * w;
    rect(x, y, w - 2, 24, C.panel2, 3);
    rect(x, y, w - 2, 3, col, 1.5);
    txt(value, x + (w - 2) / 2, y + 13, 13, col, true, "center");
    txt(label, x + (w - 2) / 2, y + 20, 6.2, C.muted, false, "center");
  });
  y = 250;
  rect(ML, y, CW, 22, [0, 55, 38], 4);
  rect(ML, y, 4, 22, C.green, 2);
  txt(`${verdict} seminar performance`, ML + 10, y + 9, 10, C.white, true);
  wrap(`Composite score ${overall}/100. This report combines session activity, AI coaching notes, transcript volume, and deterministic topic-based performance scoring.`, ML + 10, y + 16, CW - 20, 7, C.green, false, 4);
  footer();

  addPage();
  section("Detailed Performance Analysis", "score breakdown", C.green);
  [["Delivery", "Pace, voice control, confidence, and presentation flow.", scores.delivery, C.green], ["Clarity", "Argument structure, framing, and ease of audience understanding.", scores.clarity, C.sky], ["Depth", "Evidence quality, nuance, research grounding, and examples.", scores.depth, C.amber], ["Engagement", "Audience connection, energy, responsiveness, and memorable moments.", scores.engagement, C.pink]].forEach(([label, desc, score, col], i) => {
    const x = ML + (i % 2) * ((CW - 5) / 2 + 5);
    const ry = y + Math.floor(i / 2) * 37;
    rect(x, ry, (CW - 5) / 2, 32, C.panel2, 3);
    rect(x, ry, (CW - 5) / 2, 3, col, 1.5);
    txt(label, x + 6, ry + 10, 9, col, true);
    wrap(desc, x + 6, ry + 16, (CW - 5) / 2 - 30, 6.5, C.muted, false, 3.5);
    txt(score, x + (CW - 5) / 2 - 10, ry + 15, 16, col, true, "right");
    txt("%", x + (CW - 5) / 2 - 4, ry + 11, 7, C.muted, false, "right");
    progress(x + 6, ry + 24, (CW - 5) / 2 - 12, 4, score, col);
  });
  y += 80;

  section("AI Coach Feedback", "strengths and improvements", C.sky);
  const weakest = Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0];
  const feedbackItems = hasApiScores ? [
    ...( apiScores.overall_feedback ? [["Overview", apiScores.overall_feedback, C.sky, [8, 31, 52]]] : [] ),
    ...( (apiScores.strengths||[]).map(s => ["Strength", s, C.green, [0, 42, 28]]) ),
    ...( (apiScores.improvements||[]).map(s => ["Improve", s, C.amber, [48, 33, 6]]) ),
    ...( (apiScores.topics_mastered||[]).map(t => ["Mastered", t, C.sky, [8, 31, 52]]) ),
    ...( (apiScores.topics_need_work||[]).map(t => ["Needs Work", t, C.red, [52, 14, 14]]) ),
  ] : [
    ["Strength", "Your session shows a clear base to build from. The topic framing and saved Q&A notes give you useful material for a stronger final presentation.", C.green, [0, 42, 28]],
    ["Strength", "The strongest scoring area should become your anchor. Open with that confidence, then use transitions to carry the audience across the remaining points.", C.green, [0, 42, 28]],
    ["Improve", `The main development area is ${weakest}. Use shorter claims, one concrete example per claim, and a deliberate pause before moving to the next idea.`, C.amber, [48, 33, 6]],
    ["Improve", "Close with a compact final message: restate the thesis, name the takeaway, then give the audience one question or action to remember.", C.amber, [48, 33, 6]],
    ["Coach Tip", "For the next practice run, record three minutes only. Review filler words, pacing, and whether the central argument is understandable without extra explanation.", C.sky, [8, 31, 52]],
  ];
  feedbackItems.forEach(([label, body, col, box]) => {
    const lines = doc.splitTextToSize(body, CW - 35);
    const h = Math.max(16, lines.length * 4.6 + 8);
    ensure(h + 3);
    rect(ML, y, CW, h, box, 3);
    rect(ML, y, 3, h, col, 1.5);
    pill(PW - MR - 30, y + 5, 24, label, col);
    wrap(body, ML + 8, y + 9, CW - 42, 7.6, C.soft, false, 4.6);
    y += h + 3;
  });

  addPage();
  section("Session Notes", `${safeNotes.length} saved notes`, C.green);
  if (!safeNotes.length) {
    rect(ML, y, CW, 18, C.panel2, 3);
    txt("No AI notes were saved during this session.", ML + 8, y + 11, 8, C.muted);
    y += 24;
  } else {
    safeNotes.forEach((note, i) => {
      const q = clean(note.q || `Note ${note.n || i + 1}`);
      const aLines = doc.splitTextToSize(clean(note.a || "No answer text available."), CW - 16);
      const qLines = doc.splitTextToSize(q, CW - 16);
      const h = Math.max(24, qLines.length * 4.5 + aLines.length * 4.2 + 15);
      ensure(Math.min(h, 70) + 5);
      rect(ML, y, CW, Math.min(h, PH - BOTTOM - y), C.panel2, 3);
      rect(ML, y, 3, Math.min(h, PH - BOTTOM - y), C.green, 1.5);
      txt(`Note ${note.n || i + 1}`, ML + 8, y + 7, 6.8, C.green, true);
      y += 13;
      y += wrap(q, ML + 8, y, CW - 16, 8, C.white, true, 4.5) + 2;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.2);
      txtColor(C.soft);
      aLines.forEach((lineText) => {
        ensure(6);
        doc.text(lineText, ML + 8, y);
        y += 4.2;
      });
      y += 8;
    });
  }

  if (transcript.length) {
    addPage();
    section("Live Transcript", `${transcript.length} captured lines`, C.amber);
    transcript.forEach((lineText, i) => {
      const body = `${String(i + 1).padStart(2, "0")}. ${lineText}`;
      const lines = doc.splitTextToSize(body, CW - 14);
      const h = lines.length * 4.4 + 6;
      ensure(h);
      rect(ML, y, CW, h, i % 2 ? C.panel : C.panel2, 2);
      wrap(body, ML + 7, y + 5, CW - 14, 7.2, C.soft, false, 4.4);
      y += h + 2;
    });
  }

  if (chatMessages.length) {
    addPage();
    section("AI Chat History", `${chatMessages.length} messages`, C.sky);
    chatMessages.slice(-40).forEach((msg, i) => {
      const role = clean(msg.sender || (msg.from === "me" ? presenter : msg.from === "ai" ? "AI Coach" : msg.type || "Message"));
      const body = clean(msg.text || "");
      const col = role.toLowerCase().includes("ai") ? C.sky : C.green;
      const lines = doc.splitTextToSize(body, CW - 28);
      const h = Math.max(16, lines.length * 4.4 + 12);
      ensure(h + 3);
      rect(ML, y, CW, h, i % 2 ? C.panel : C.panel2, 3);
      rect(ML, y, 3, h, col, 1.5);
      txt(role, ML + 8, y + 7, 7, col, true);
      wrap(body, ML + 8, y + 13, CW - 16, 7.2, C.soft, false, 4.4);
      y += h + 3;
    });
  }

  addPage();
  section("Personalised Improvement Plan", "next practice cycle", C.amber);
  [["Delivery", "Record a 3-minute version of the seminar and remove repeated filler words.", "High", C.red], ["Clarity", "Use PEEL for each argument: point, evidence, explanation, link.", "High", C.red], ["Depth", "Add one statistic, case study, or source-backed example to every key claim.", "Medium", C.amber], ["Engagement", "Start with a question and end with a compact audience takeaway.", "Medium", C.amber], ["Pacing", "Practice at 100-120 words per minute and pause after major claims.", "Low", C.green], ["Confidence", "Run one full rehearsal before the next live session.", "Low", C.green]].forEach(([area, action, priority, col]) => {
    ensure(20);
    rect(ML, y, CW, 16, C.panel2, 3);
    rect(ML, y, 3, 16, col, 1.5);
    txt(area, ML + 8, y + 7, 8, C.white, true);
    wrap(action, ML + 36, y + 7, CW - 66, 7, C.soft, false, 4);
    pill(PW - MR - 26, y + 5, 20, priority, col);
    y += 20;
  });
  y += 5;
  ensure(34);
  rect(ML, y, CW, 31, [0, 52, 36], 4);
  rect(ML, y, CW, 3, C.green, 1.5);
  txt("Recommended next steps", ML + 8, y + 10, 9, C.white, true);
  txt("1. Drill the weakest score area with AI Coach.", ML + 10, y + 17, 7.3, C.green);
  txt("2. Schedule one practice run within 3 days.", ML + 10, y + 22.5, 7.3, C.green);
  txt("3. Share this report with a tutor or peer for targeted review.", ML + 10, y + 28, 7.3, C.green);
  y += 42;
  ensure(26);
  rect(ML, y, CW, 24, C.panel, 4);
  txt("SeminarArena Performance Report", PW / 2, y + 8, 9, C.white, true, "center");
  txt(`Presenter: ${presenter} | Topic: ${topic.slice(0, 52)}`, PW / 2, y + 14, 7, C.muted, false, "center");
  txt(`Generated: ${dateStr} at ${timeStr} | Overall score: ${overall}/100`, PW / 2, y + 19, 7, C.green, false, "center");

  const safeName = presenter.replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").toLowerCase() || "student";
  doc.save(`seminararena-report-${safeName}-${Date.now()}.pdf`);
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function SoundAnalyser({ active, color="#00c37a", bars=7, size=32 }) {
  return (
    <div className={`sound-analyser${active?" active":""}`} style={{height:size,"--color":color}}>
      {Array.from({length:bars}).map((_,i)=><div key={i} className="bar" style={{height:active?undefined:3}}/>)}
    </div>
  );
}

function PageLoader({ label="Launching…", sublabel="Setting up your session", steps=[] }) {
  const [progress,setProgress] = useState(0);
  const [step,setStep] = useState(0);
  useEffect(()=>{
    let p=0;
    const id=setInterval(()=>{p+=Math.random()*18+8;if(p>=100){p=100;clearInterval(id);}setProgress(Math.min(p,100));},180);
    return ()=>clearInterval(id);
  },[]);
  useEffect(()=>{
    if (!steps.length) return;
    const delays=[600,1100,1700,2200];
    const timers=delays.map((d,i)=>setTimeout(()=>setStep(i+1),d));
    return ()=>timers.forEach(clearTimeout);
  },[steps]);
  return (
    <div className="page-loader">
      <div className="page-loader-logo">🎓</div>
      <div className="page-loader-text">{label}</div>
      <div className="page-loader-sub">{sublabel}</div>
      <div className="page-loader-bar"><div className="page-loader-fill" style={{width:`${progress}%`}}/></div>
      {steps.length>0&&(
        <div className="page-loader-steps">
          {steps.map((s,i)=>(
            <div key={i} className={`page-loader-step ${i<step?"done":i===step?"active":"pending"}`}>
              <span style={{fontSize:13}}>{s.ic}</span><span>{i<step?"✓ ":""}{s.label}</span>
              {i===step&&<span className="loader-spin" style={{marginLeft:"auto"}}/>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultsLoader({onDone,isObserver}) {
  const steps=isObserver
    ?[{label:"Saving session notes",icon:"📝"},{label:"Updating your progress",icon:"📈"},{label:"Preparing summary",icon:"🎓"}]
    :[{label:"Analysing your delivery",icon:"🎙️"},{label:"Scoring clarity & depth",icon:"📊"},{label:"Generating AI feedback",icon:"🤖"},{label:"Preparing full report",icon:"🏅"}];
  const [step,setStep]=useState(0);
  useEffect(()=>{
    const delays=isObserver?[600,1100,1700]:[500,1100,1700,2300];
    const timers=delays.map((d,i)=>setTimeout(()=>setStep(i+1),d));
    timers.push(setTimeout(()=>onDone(),isObserver?2200:2900));
    return ()=>timers.forEach(clearTimeout);
  },[isObserver,onDone]);
  return (
    <div className="results-loader">
      <div className="results-loader-icon">{isObserver?"👁️":"📊"}</div>
      <div className="results-loader-title">{isObserver?"Wrapping up…":"Generating your report…"}</div>
      <div className="results-loader-sub">{isObserver?"Thank you for observing":"AI is reviewing your performance"}</div>
      <div className="results-loader-steps">
        {steps.map((s,i)=>(
          <div key={i} className={`results-loader-step ${i<step?"done":i===step?"active":"pending"}`}>
            <span style={{fontSize:14}}>{s.icon}</span><span>{i<step?"✓ ":""}{s.label}</span>
            {i===step&&<span className="loader-spin" style={{marginLeft:"auto"}}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleSeminarModal({config,onSchedule,onClose}) {
  const [date,setDate]=useState("");const [time,setTime]=useState("10:00");const [saving,setSaving]=useState(false);
  async function save(){
    if(!date)return;setSaving(true);await new Promise(r=>setTimeout(r,700));
    try {
      const ev={id:`sem-${Date.now()}`,title:config?.topic||"Seminar",type:"seminar",date,startTime:time,subject:config?.subject||"",unit:config?.unit||"",link:config?.roomLink||""};
      const ex=JSON.parse(localStorage.getItem("gradeup_cal_events_v3")||"[]");
      localStorage.setItem("gradeup_cal_events_v3",JSON.stringify([...ex,ev]));
      window.dispatchEvent(new StorageEvent("storage",{key:"gradeup_cal_events_v3"}));
      publishCommunitySession({...ev,roles:["Observer","Participant"],createdAt:new Date().toISOString(),status:"upcoming"});
    } catch {}
    setSaving(false);onSchedule({date,time});
  }
  return (
    <div className="overlay">
      <div className="modal" style={{maxWidth:400}}>
        <div className="mh"><span className="mh-title">📅 Schedule Seminar</span><button className="mh-close" onClick={onClose}>✕</button></div>
        <div className="mb">
          <div className="sched-info">
            <span style={{fontSize:20}}>📅</span>
            <div><div className="sched-info-text">Auto-synced to Calendar & Community</div><div className="sched-info-sub">Anyone in your group can join as Observer or Participant</div></div>
          </div>
          {config?.topic&&<div style={{padding:"8px 11px",borderRadius:9,background:"rgba(0,195,122,.06)",border:"1px solid rgba(0,195,122,.16)",marginBottom:12,fontSize:12.5,fontWeight:700,color:"var(--t1)"}}>🎓 "{config.topic}"</div>}
          <div className="fi-row fi">
            <div><label className="fl">Date *</label><input className="finput" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
            <div><label className="fl">Time</label><input className="finput" type="time" value={time} onChange={e=>setTime(e.target.value)}/></div>
          </div>
        </div>
        <div className="mf">
          <button className="btn-s" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-p" style={{width:"auto",padding:"8px 20px"}} onClick={save} disabled={!date||saving}>
            {saving?<><span className="loader-spin"/>Scheduling…</>:"📅 Schedule & Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AnalysisModal({topic,subject,unit,timer,exchanges,presenterName,apiScores,hintsUsed,onClose,onDownload}) {
  const hasApi = apiScores && apiScores.total_score != null;
  const scores = hasApi ? {
    delivery: Math.round(((apiScores.presentation_flow??0)/20)*100),
    clarity:  Math.round(((apiScores.conceptual_understanding??0)/30)*100),
    depth:    Math.round(((apiScores.depth_of_knowledge??0)/25)*100),
    engagement: Math.round(((apiScores.engagement??0)/15)*100),
  } : {delivery:68+Math.floor(Math.random()*28),clarity:62+Math.floor(Math.random()*30),depth:55+Math.floor(Math.random()*38),engagement:70+Math.floor(Math.random()*25)};
  const overall = hasApi ? (apiScores.total_score??0) : Math.round(Object.values(scores).reduce((a,b)=>a+b,0)/4);
  return (
    <div className="analysis-bg" onClick={onClose}>
      <div className="analysis-box" onClick={e=>e.stopPropagation()}>
        <div className="analysis-head">
          <div className="analysis-title">📊 Seminar Performance Report</div>
          <button style={{width:24,height:24,borderRadius:6,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.05)",cursor:"pointer",color:"rgba(255,255,255,.5)",fontSize:11}} onClick={onClose}>✕</button>
        </div>
        <div className="analysis-body">
          <div className="a-sec">
            <div className="a-sec-title">Session Overview</div>
            <div style={{padding:"8px 11px",borderRadius:9,background:"rgba(0,195,122,.07)",border:"1px solid rgba(0,195,122,.16)",fontSize:12.5,fontWeight:700,color:"#e8ecf2",marginBottom:7}}>"{topic}"</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {[`📚 ${subject||"—"}`,`📖 ${unit||"—"}`,`⏱ ${timer}`,`💬 ${exchanges||0} exchanges`].map(t=>(
                <span key={t} style={{padding:"2px 9px",borderRadius:20,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",fontSize:10,fontWeight:700,color:"rgba(255,255,255,.5)"}}>{t}</span>
              ))}
            </div>
          </div>
          <div className="a-sec" style={{animationDelay:".08s"}}>
            <div className="a-sec-title">Presenter Performance</div>
            <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",borderRadius:10,padding:"11px 13px"}}>
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:avColor(presenterName||"U")+"22",color:avColor(presenterName||"U"),display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800}}>{avInit(presenterName||"?")}</div>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#e8ecf2"}}>{presenterName}</div><div style={{fontSize:10.5,color:"rgba(255,255,255,.35)"}}>Seminar Presenter</div></div>
                <div style={{fontSize:22,fontWeight:900,color:"#5ee3b7"}}>{overall}</div>
              </div>
              {[["Delivery",scores.delivery,"#00c37a"],["Clarity",scores.clarity,"#38bdf8"],["Depth",scores.depth,"#f59e0b"],["Audience Engagement",scores.engagement,"#ec4899"]].map(([l,v,c])=>(
                <div key={l} className="prog-wrap">
                  <div className="prog-lbl"><span>{l}</span><span>{v}%</span></div>
                  <div className="prog-track"><div className="prog-fill" style={{width:`${v}%`,background:c}}/></div>
                </div>
              ))}
            </div>
          </div>
 <div className="a-sec" style={{animationDelay:".16s"}}>
            <div className="a-sec-title">AI Feedback</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {hasApi?(
                <>
                  {apiScores.overall_feedback&&(
                    <div style={{padding:"8px 11px",borderRadius:9,background:"rgba(45,156,219,.06)",border:"1px solid rgba(45,156,219,.2)",fontSize:11.5,fontWeight:600,color:"#7ed3f7",lineHeight:1.6,marginBottom:2}}>
                      {apiScores.overall_feedback}
                    </div>
                  )}
                  {(apiScores.strengths||[]).map((s,i)=>(
                    <div key={`str-${i}`} style={{display:"flex",gap:9,padding:"8px 11px",borderRadius:9,background:"rgba(0,195,122,.08)",border:"1px solid rgba(0,195,122,.2)"}}>
                      <span style={{fontSize:15,flexShrink:0}}>✅</span>
                      <span style={{fontSize:11.5,fontWeight:600,color:"#5ee3b7",lineHeight:1.5}}>{s}</span>
                    </div>
                  ))}
                  {(apiScores.improvements||[]).map((s,i)=>(
                    <div key={`imp-${i}`} style={{display:"flex",gap:9,padding:"8px 11px",borderRadius:9,background:"rgba(246,166,35,.06)",border:"1px solid rgba(246,166,35,.18)"}}>
                      <span style={{fontSize:15,flexShrink:0}}>🎯</span>
                      <span style={{fontSize:11.5,fontWeight:600,color:"#fcd18e",lineHeight:1.5}}>{s}</span>
                    </div>
                  ))}
                  {(apiScores.topics_need_work||[]).map((t,i)=>(
                    <div key={`tnw-${i}`} style={{display:"flex",gap:9,padding:"8px 11px",borderRadius:9,background:"rgba(229,62,62,.06)",border:"1px solid rgba(229,62,62,.18)"}}>
                      <span style={{fontSize:15,flexShrink:0}}>📚</span>
                      <span style={{fontSize:11.5,fontWeight:600,color:"#fca5a5",lineHeight:1.5}}>{t}</span>
                    </div>
                  ))}
                  {hintsUsed>0&&(
                    <div style={{display:"flex",gap:9,padding:"8px 11px",borderRadius:9,background:"rgba(229,62,62,.06)",border:"1px solid rgba(229,62,62,.18)"}}>
                      <span style={{fontSize:15,flexShrink:0}}>💡</span>
                      <span style={{fontSize:11.5,fontWeight:600,color:"#fca5a5",lineHeight:1.5}}>{hintsUsed} hint{hintsUsed>1?"s":""} used during the session.</span>
                    </div>
                  )}
                </>
              ):[{ic:"✅",c:"rgba(0,195,122,.08)",bc:"rgba(0,195,122,.2)",t:"#5ee3b7",msg:"Strong opening with clear thesis statement established."},{ic:"✅",c:"rgba(0,195,122,.08)",bc:"rgba(0,195,122,.2)",t:"#5ee3b7",msg:"Good use of evidence to support main arguments."},{ic:"⚠️",c:"rgba(246,166,35,.06)",bc:"rgba(246,166,35,.18)",t:"#fcd18e",msg:"Consider slowing down during key points for emphasis."},{ic:"💡",c:"rgba(45,156,219,.06)",bc:"rgba(45,156,219,.18)",t:"#7ed3f7",msg:"End with a strong question or call-to-action to engage observers."}].map((f,i)=>(
                <div key={i} style={{display:"flex",gap:9,padding:"8px 11px",borderRadius:9,background:f.c,border:`1px solid ${f.bc}`}}>
                  <span style={{fontSize:15,flexShrink:0}}>{f.ic}</span>
                  <span style={{fontSize:11.5,fontWeight:600,color:f.t,lineHeight:1.5}}>{f.msg}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="a-sec" style={{animationDelay:".22s"}}>
            <div className="a-sec-title">Verdict</div>
            <div style={{padding:"12px 14px",borderRadius:11,border:"1.5px solid rgba(0,195,122,.35)",background:"rgba(0,195,122,.07)",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:900,color:"#5ee3b7",marginBottom:2}}>🏅 {overall>=85?"Outstanding Seminar":overall>=70?"Strong Presentation":"Good Effort — Keep Practising"}</div>
              <div style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,.45)"}}>Overall score: {overall}/100</div>
            </div>
          </div>
        </div>
        <div className="analysis-foot">
          <button className="btn-s" style={{background:"rgba(255,255,255,.04)",borderColor:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)"}} onClick={onClose}>Close</button>
          {onDownload&&<button className="btn-p" style={{width:"auto",padding:"7px 15px",fontSize:12}} onClick={onDownload}>📥 Download Report</button>}
        </div>
      </div>
    </div>
  );
}

function MicPreviewModal({config,onConfirm,onBack}) {
  const [micGranted,setMicGranted]=useState(false);const [micStream,setMicStream]=useState(null);
  const [micChecking,setMicChecking]=useState(false);const [joining,setJoining]=useState(false);const [joinProgress,setJoinProgress]=useState(0);
  const {show:toast$,node:toastNode}=useToast();
  async function requestMic(){
    setMicChecking(true);
    try { const s=await navigator.mediaDevices.getUserMedia({audio:true,video:false});setMicStream(s);setMicGranted(true);toast$("🎤 Microphone active","success"); }
    catch { toast$("Mic permission denied","error"); }
    finally { setMicChecking(false); }
  }
  async function handleConfirm(){
    setJoining(true);
    for (let p=0;p<=100;p+=25){await new Promise(r=>setTimeout(r,120));setJoinProgress(p);}
    setJoining(false);onConfirm({...config,stream:micStream,micOn:micGranted});
  }
  const presenterColor=avColor(config.name||"U");
  return (
    <div className="overlay">
      <div className="modal" style={{maxWidth:400,background:"#0c1422",border:"1px solid rgba(255,255,255,.1)"}}>
        <div style={{background:"linear-gradient(135deg,#060e1c,#081a10)",padding:"22px 18px",textAlign:"center",flexShrink:0}}>
          <div style={{width:60,height:60,borderRadius:"50%",background:`${presenterColor}22`,border:`2px solid ${presenterColor}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:presenterColor,margin:"0 auto 10px"}}>{avInit(config.name||"?")}</div>
          <div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:3}}>{config.name}</div>
          <div style={{fontSize:10.5,color:"rgba(255,255,255,.4)",marginBottom:2}}>{config.seminarMode==="prepare"?"🤖 AI Preparation Mode":"🎙️ Seminar Presenter"}</div>
          {config.subject&&<div style={{fontSize:10,color:"rgba(255,255,255,.28)"}}>📚 {config.subject}{config.unit?` · ${config.unit}`:""}</div>}
        </div>
        <div className="mb" style={{background:"#0c1422"}}>
          {config.topic&&<div style={{padding:"9px 12px",borderRadius:10,background:"rgba(0,195,122,.07)",border:"1px solid rgba(0,195,122,.18)",marginBottom:12,fontSize:12,fontWeight:700,color:"#e8ecf2",lineHeight:1.4}}>🎓 "{config.topic}"</div>}
          <div style={{padding:"12px 13px",borderRadius:12,border:`1.5px solid ${micGranted?"rgba(0,195,122,.4)":"rgba(255,255,255,.12)"}`,background:micGranted?"rgba(0,195,122,.07)":"rgba(255,255,255,.04)",marginBottom:10,transition:"all .2s"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:micGranted?0:10}}>
              <div style={{width:36,height:36,borderRadius:10,background:micGranted?"rgba(0,195,122,.2)":"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{micGranted?"✅":"🎤"}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:micGranted?"#5ee3b7":"#e8ecf2"}}>{micGranted?"Microphone Active":"Microphone Required"}</div>
                <div style={{fontSize:10.5,color:"rgba(255,255,255,.4)"}}>{micGranted?"Voice transcription enabled":"Enable your mic to continue"}</div>
              </div>
            </div>
            {!micGranted&&<button className="btn-p" onClick={requestMic} disabled={micChecking} style={{marginTop:2,fontSize:12}}>{micChecking?<><span className="loader-spin"/>Checking…</>:"🎤 Allow Microphone Access"}</button>}
          </div>
        </div>
        <div className="mf" style={{borderColor:"rgba(255,255,255,.08)",background:"#0c1422",flexDirection:"column",gap:8}}>
          <button className="btn-p" onClick={handleConfirm} disabled={joining||!micGranted} style={{fontSize:13}}>
            {joining?<><span className="loader-spin"/>{joinProgress>0?`Loading ${joinProgress}%`:"Launching…"}</>:config.seminarMode==="prepare"?"🤖 Enter AI Coach Room":"🎙️ Enter Seminar Room"}
          </button>
          {joinProgress>0&&<div className="lo-progress"><div className="lo-progress-fill" style={{width:`${joinProgress}%`}}/></div>}
          <button className="btn-s" onClick={onBack} disabled={joining} style={{width:"100%",justifyContent:"center",background:"rgba(255,255,255,.04)",borderColor:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)"}}>← Back</button>
        </div>
        {toastNode}
      </div>
    </div>
  );
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
function SeminarSetup({onBack,onLaunch}) {
  const { user } = useAuth();
  // Auto-fill name from user auth
  const defaultName = user ? `${user.firstName||""} ${user.lastName||""}`.trim() : "";
  const [name,setName]=useState(defaultName);
  const [seminarMode,setSeminarMode]=useState("");
  const [sessionSubMode,setSessionSubMode]=useState("");
  const [subject,setSubject]=useState("");const [unit,setUnit]=useState("");
  const [topic,setTopic]=useState("");const [custom,setCustom]=useState("");
  const [seminarType,setSeminarType]=useState("instant");
  const [showSchedule,setShowSchedule]=useState(false);const [scheduled,setScheduled]=useState(false);const [scheduledInfo,setScheduledInfo]=useState(null);
  const [copied,setCopied]=useState(false);
  const [showMicPreview,setShowMicPreview]=useState(false);
  const [showObsConfirm,setShowObsConfirm]=useState(false);
  const [joining,setJoining]=useState(false);const [joinProgress,setJoinProgress]=useState(0);
  const [joinId,setJoinId]=useState("");const [selectedSession,setSelectedSession]=useState(null);
  const [onlineSessions,setOnlineSessions]=useState([]);
  const roomId=useRef(genId());const roomLink=genRoomLink(roomId.current);
  const {show:toast$,node:toastNode}=useToast();
  const finalTopic=topic==="__custom__"?custom:topic;
  const availableUnits=subject?SUBJECT_UNITS[subject]||[]:[];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) {
      roomId.current = room;
      setSeminarMode("session");
      setSessionSubMode("observer");
      setTopic("Joined Seminar");
      setSubject("General");
      setSeminarType("instant");
      setShowObsConfirm(true);
    }
  }, []);

  // Update name if user loads after render
  useEffect(()=>{
    if(user&&!name){setName(`${user.firstName||""} ${user.lastName||""}`.trim());}
  },[name,user]);

  useEffect(()=>{
    const load=()=>{const s=getCommunitySessions().filter(s=>s.type==="seminar");setOnlineSessions(s);};
    load();window.addEventListener("storage",load);return()=>window.removeEventListener("storage",load);
  },[]);

  const copyLink=()=>{navigator.clipboard.writeText(roomLink);setCopied(true);setTimeout(()=>setCopied(false),2200);};
  const presenterSteps=[{label:"Enter your name",done:name.trim().length>0},{label:"Select subject & unit",done:!!subject&&!!unit},{label:"Select seminar topic",done:!!finalTopic}];
  const canLaunchPresenter=presenterSteps.every(s=>s.done);
  const canJoinObserver=!!(selectedSession||joinId.trim().length>=4);

  const leftFeatures=seminarMode==="prepare"?[
    {ic:"🎙️",t:"Voice Transcript",d:"Your speech transcribed live"},{ic:"🤖",t:"AI Coach Chat",d:"Ask anything — voice or text"},
    {ic:"📋",t:"FAQ Notes",d:"AI answers saved as notes"},{ic:"▶️",t:"Demo Mode",d:"Practice with AI feedback"},
  ]:sessionSubMode==="observer"?[
    {ic:"👁️",t:"Watch Live",d:"See the presenter's delivery"},{ic:"💬",t:"Ask in Chat",d:"Send questions to the presenter"},
    {ic:"🎤",t:"Raise Hand",d:"Request mic to speak verbally"},{ic:"📊",t:"Session Feed",d:"See all ongoing seminars"},
  ]:[
    {ic:"🖥️",t:"Screen Share",d:"Present your content live"},{ic:"🎙️",t:"Live Transcript",d:"AI transcribes your speech"},
    {ic:"🤖",t:"AI Moderator",d:"Intro, tips, and report"},{ic:"📊",t:"Auto Report",d:"Full performance analysis"},
  ];

  async function handleObsJoin(){
    setJoining(true);
    for (let p=0;p<=100;p+=20){await new Promise(r=>setTimeout(r,150));setJoinProgress(p);}
    setJoining(false);setShowObsConfirm(false);setJoinProgress(0);
    onLaunch({seminarMode:"session",sessionSubMode:"observer",name,role:"Observer",subject:"",unit:"",topic:"",roomId:roomId.current,roomLink,stream:null,micOn:false,joinSession:selectedSession||(joinId.trim()?{id:joinId.trim(),title:"Seminar Session"}:null)});
  }

  return (
    <div className="sp-setup route-enter">
      <div className="sp-left">
        <div className="sp-grid-lines"/><div className="sp-glow1"/><div className="sp-glow2"/>
        <div className="sp-left-inner">
          <div className="sp-logo"><div className="sp-logo-ico">🎓</div><span className="sp-logo-name">SeminarArena</span></div>
          <div className="sp-badge"><div className="sp-badge-dot"/>Seminar Setup</div>
          <h2 className="sp-h1">Your stage,<br/><span className="hl">your seminar.</span></h2>
          <p className="sp-desc">AI-facilitated sessions with voice transcription, screen sharing, observer chat & full performance reports.</p>
          <div className="sp-features">
            {leftFeatures.map((f,i)=>(
              <div key={f.t} className="sp-feat" style={{animationDelay:`${.1+i*.06}s`}}>
                <div className="sp-feat-ic">{f.ic}</div>
                <div><div className="sp-feat-t">{f.t}</div><div className="sp-feat-d">{f.d}</div></div>
              </div>
            ))}
          </div>
          {(subject||finalTopic)&&(
            <div className="ctx-chip">
              <div className="ctx-chip-lbl">Session Context</div>
              {subject&&<div className="ctx-chip-val">📚 {subject}{unit?` · ${unit}`:""}</div>}
              {finalTopic&&<div className="ctx-chip-sub">{finalTopic.length>44?finalTopic.slice(0,44)+"…":finalTopic}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="sp-right">
        <div className="sp-right-scroll">
          <div className="sp-right-inner">
            {onBack&&<button className="back-btn" onClick={onBack}>← Back</button>}
            <h2 className="setup-h">🎓 Seminar Setup</h2>
            <p className="setup-sub">Choose your mode — prepare alone with AI, run a live seminar, or join one as an observer.</p>
            <div className="sec-div">Choose Mode</div>
            <div className="module-grid fi">
              {[{id:"prepare",ic:"🤖",t:"Prepare with AI",d:"AI coach helps you rehearse, build outline, transcribe speech and practice demo."},{id:"session",ic:"🔴",t:"Seminar Session",d:"Start or join a live seminar with AI moderator, screen share & full report."}].map(m=>(
                <div key={m.id} className={`module-card${seminarMode===m.id?" sel":""}`} onClick={()=>{setSeminarMode(m.id);setSessionSubMode("");}}>
                  <div className="mod-ic">{m.ic}</div>
                  <div><div className="mod-title">{m.t}</div><div className="mod-desc">{m.d}</div></div>
                </div>
              ))}
            </div>

            {seminarMode==="session"&&(
              <><div className="sec-div">I want to…</div>
              <div className="submode-grid fi">
                <div className={`submode-card${sessionSubMode==="presenter"?" sel":""}`} onClick={()=>setSessionSubMode("presenter")}>
                  <div className="submode-ic">🎙️</div><div className="submode-title">Present a Seminar</div>
                  <div className="submode-desc">Start a room, share your screen, deliver your seminar.</div>
                </div>
                <div className={`submode-card${sessionSubMode==="observer"?" sel":""}`} onClick={()=>setSessionSubMode("observer")}>
                  <div className="submode-ic">👁️</div><div className="submode-title">Join as Observer</div>
                  <div className="submode-desc">Watch live seminars, ask questions in chat.</div>
                </div>
              </div></>
            )}

            {seminarMode==="session"&&sessionSubMode==="observer"&&(
              <><div className="sec-div">Join a Session</div>
              <div className="obs-join-section">
                <div className="obs-join-title">🔗 Join with Room Link or ID</div>
                <div className="obs-join-input-row">
                  <input className="finput" placeholder="Paste room link or enter Room ID…" style={{flex:1}} value={joinId} onChange={e=>setJoinId(e.target.value)}/>
                  <button className="btn-s" onClick={()=>{if(joinId.trim())toast$("Joining room…","info");}}>Join</button>
                </div>
                <div className="obs-join-or">or</div>
                <div style={{fontSize:10.5,fontWeight:700,color:"var(--t2)",marginBottom:8}}>📡 Live & Upcoming Sessions</div>
                {onlineSessions.length===0
                  ?<div className="ongoing-empty">No active sessions. Check back soon.</div>
                  :<div className="ongoing-list">{onlineSessions.map(s=>(
                    <div key={s.id} className={`ongoing-card${selectedSession?.id===s.id?" sel":""}`} onClick={()=>setSelectedSession(selectedSession?.id===s.id?null:s)}>
                      <div className="ongoing-live-dot" style={{background:s.status==="live"?"var(--red)":"var(--amb)"}}/>
                      <div className="ongoing-info">
                        <div className="ongoing-topic">{s.title}</div>
                        <div className="ongoing-meta">📚 {s.subject||"—"}{s.unit?` · ${s.unit}`:""} · {s.presenterName?`by ${s.presenterName} · `:""}{s.status==="live"?"🔴 Live now":`📅 ${s.date||""} ${s.time||""}`}</div>
                      </div>
                      <div className="ongoing-count" style={{background:s.status==="live"?"rgba(229,62,62,.1)":"rgba(246,166,35,.1)",color:s.status==="live"?"var(--red)":"var(--amb)"}}>
                        {s.status==="live"?(s.observerCount?`${s.observerCount} 👁`:"● LIVE"):"⏰"}
                      </div>
                    </div>
                  ))}</div>
                }
              </div>
              <div className="sec-div">Your Name</div>
              <div className="fi"><label className="fl">Display Name</label><input className="finput" placeholder="e.g. Alex (Observer)" value={name} onChange={e=>setName(e.target.value)} maxLength={40}/></div>
              <div style={{marginTop:14,marginBottom:10}}><button className="btn-p" onClick={()=>setShowObsConfirm(true)} disabled={!canJoinObserver||!name.trim()}>👁️ Join as Observer</button></div></>
            )}

            {(seminarMode==="prepare"||(seminarMode==="session"&&sessionSubMode==="presenter"))&&(
              <>
                <div className="sec-div">Your Identity</div>
                <div className="fi"><label className="fl">Your Name</label><input className="finput" placeholder="e.g. Alex Johnson" value={name} onChange={e=>setName(e.target.value)} maxLength={40}/></div>
                <div className="sec-div">Academic Context</div>
                <div className="fi-row fi">
                  <div><label className="fl">Subject</label>
                    <select className="finput" value={subject} onChange={e=>{setSubject(e.target.value);setUnit("");}}>
                      <option value="">Select subject…</option>{SUBJECTS.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label className="fl">Unit / Module</label>
                    <select className="finput" value={unit} onChange={e=>setUnit(e.target.value)} disabled={!subject}>
                      <option value="">{subject?"Select unit…":"Subject first"}</option>
                      {availableUnits.map(u=><option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div className="sec-div">Seminar Topic</div>
                <div className="fi">
                  <select className="finput" value={topic} onChange={e=>setTopic(e.target.value)}>
                    <option value="">Select a topic…</option>
                    {TOPICS.map(t=><option key={t} value={t}>{t}</option>)}
                    <option value="__custom__">✏️ Custom topic…</option>
                  </select>
                </div>
                {topic==="__custom__"&&<div className="fi"><input className="finput" placeholder="Enter your seminar topic…" value={custom} onChange={e=>setCustom(e.target.value)}/></div>}

                {seminarMode==="session"&&sessionSubMode==="presenter"&&(
                  <>
                    <div className="sec-div">Session Timing</div>
                    <div className="timing-grid fi">
                      {[{id:"instant",ic:"⚡",t:"Start Now",d:"Launch immediately"},{id:"schedule",ic:"📅",t:"Schedule",d:"Plan for a future date"}].map(o=>(
                        <div key={o.id} className={`timing-card${seminarType===o.id?" sel":""}`} onClick={()=>setSeminarType(o.id)}>
                          <div className="timing-ic">{o.ic}</div><div><div className="timing-title">{o.t}</div><div className="timing-desc">{o.d}</div></div>
                        </div>
                      ))}
                    </div>
                    {seminarType==="schedule"&&(
                      <div style={{padding:"11px 13px",borderRadius:11,background:"rgba(0,195,122,.04)",border:"1.5px solid rgba(0,195,122,.16)",marginBottom:10}}>
                        {!scheduled?(<><div style={{fontSize:12,fontWeight:700,color:"var(--t1)",marginBottom:5}}>📅 Schedule & publish to community</div><div style={{fontSize:11,color:"var(--t2)",marginBottom:8}}>Observers in your group will see and can join.</div><button className="btn-s" style={{width:"100%",justifyContent:"center"}} onClick={()=>setShowSchedule(true)}>📅 Set Date & Time</button></>)
                        :(<div style={{display:"flex",alignItems:"center",gap:9}}><span style={{fontSize:20}}>✅</span><div style={{flex:1}}><div style={{fontSize:11.5,fontWeight:800,color:"var(--em)"}}>Scheduled & Published</div><div style={{fontSize:10.5,color:"var(--t2)"}}>📅 {scheduledInfo?.date} at {scheduledInfo?.time}</div></div><button className="btn-s" style={{fontSize:10.5,padding:"3px 8px"}} onClick={()=>{setScheduled(false);setShowSchedule(true);}}>Edit</button></div>)}
                      </div>
                    )}
                    <div className="link-box">
                      <div className="link-lbl">🔗 Your Room Link — Share with Observers</div>
                      <div className="link-row"><span className="link-val">{roomLink}</span><button className="copy-btn" onClick={copyLink}>{copied?"✓ Copied":"Copy"}</button></div>
                      <div style={{display:"flex",gap:6,marginTop:7}}>
                        <button className="btn-s" style={{flex:1,fontSize:11,justifyContent:"center"}} onClick={()=>{navigator.clipboard.writeText(roomLink);toast$("Link copied!","info");}}>📋 Copy</button>
                        <button className="btn-s" style={{flex:1,fontSize:11,justifyContent:"center"}} onClick={()=>{if(navigator.share)navigator.share({title:"Join my seminar",url:roomLink});else copyLink();}}>↗ Share</button>
                      </div>
                    </div>
                  </>
                )}
                <div style={{marginTop:14,marginBottom:10}}>
                  <div className="steps">
                    {presenterSteps.map((s,i)=>{const done=s.done;const prev=presenterSteps.slice(0,i).every(x=>x.done);const act=!done&&prev;return(
                      <div key={i} className={`step-r ${done?"done":act?"act":"pend"}`}><div className="step-num">{done?"✓":i+1}</div><div className="step-lbl">{s.label}</div></div>
                    );})}
                  </div>
                  {seminarType !== "schedule" && (
                    <button className="btn-p" onClick={()=>setShowMicPreview(true)} disabled={!canLaunchPresenter}>
                      {seminarMode==="prepare"?"🤖 Start AI Preparation":"🎙️ Launch Seminar Room"}
                    </button>
                  )}
                </div>
              </>
            )}
            <div style={{height:20}}/>
          </div>
        </div>
      </div>

      {showSchedule&&<ScheduleSeminarModal config={{topic:finalTopic,subject,unit,roomLink}} onSchedule={info=>{setScheduledInfo(info);setScheduled(true);setShowSchedule(false);toast$("📅 Seminar scheduled & published!","success");}} onClose={()=>setShowSchedule(false)}/>}

      {showMicPreview&&(
        <MicPreviewModal
          config={{seminarMode,sessionSubMode,name,subject,unit,topic:finalTopic,roomId:roomId.current,roomLink,date:scheduledInfo?.date,time:scheduledInfo?.time}}
          onConfirm={cfg=>{
            setShowMicPreview(false);
            if(cfg.seminarMode==="session"&&cfg.sessionSubMode==="presenter"){
              const ev={id:`sem-${Date.now()}`,title:cfg.topic,type:"seminar",date:new Date().toISOString().slice(0,10),startTime:new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}),subject:cfg.subject,unit:cfg.unit,link:cfg.roomLink};
              try{const ex=JSON.parse(localStorage.getItem("gradeup_cal_events_v3")||"[]");localStorage.setItem("gradeup_cal_events_v3",JSON.stringify([...ex,ev]));window.dispatchEvent(new StorageEvent("storage",{key:"gradeup_cal_events_v3"}));publishCommunitySession({...ev,roles:["Observer","Participant"],createdAt:new Date().toISOString(),status:"live"});}catch{}
            }
            onLaunch({...cfg,role:"Presenter",joinSession:null});
          }}
          onBack={()=>setShowMicPreview(false)}
        />
      )}

      {showObsConfirm&&(
        <div className="overlay">
          <div className="modal" style={{maxWidth:340,background:"#0c1422",border:"1px solid rgba(255,255,255,.1)"}}>
            <div style={{background:"linear-gradient(135deg,#060e1c,#081a10)",padding:"20px 18px",textAlign:"center"}}>
              <div style={{fontSize:38,marginBottom:8}}>👁️</div>
              <div style={{fontSize:14,fontWeight:800,color:"#fff",marginBottom:2}}>{name}</div>
              <div style={{fontSize:10.5,color:"rgba(255,255,255,.4)"}}>Joining as Observer</div>
            </div>
            <div className="mb" style={{background:"#0c1422"}}>
              {selectedSession&&<div style={{padding:"9px 11px",borderRadius:9,background:"rgba(45,156,219,.06)",border:"1px solid rgba(45,156,219,.2)",marginBottom:9,fontSize:11.5,fontWeight:600,color:"var(--sky)"}}>👁️ Joining: {selectedSession.title}</div>}
            </div>
            <div className="mf" style={{borderColor:"rgba(255,255,255,.08)",background:"#0c1422",flexDirection:"column",gap:7}}>
              <button className="btn-p" onClick={handleObsJoin} disabled={joining}>{joining?<><span className="loader-spin"/>{joinProgress>0?`Loading ${joinProgress}%`:"Joining…"}</>:"👁️ Enter as Observer"}</button>
              {joinProgress>0&&<div className="lo-progress"><div className="lo-progress-fill" style={{width:`${joinProgress}%`}}/></div>}
              <button className="btn-s" onClick={()=>setShowObsConfirm(false)} disabled={joining} style={{width:"100%",justifyContent:"center",background:"rgba(255,255,255,.04)",borderColor:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </div>
  );
}

// ─── PREPARE WITH AI ─────────────────────────────────────────────────────────
function SeminarSetupIntegrated({ onBack, onLaunch }) {
  const { user } = useAuth();
  const defaultName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : "";
  const [name, setName] = useState(defaultName);
  const [seminarMode, setSeminarMode] = useState("");
  const [sessionSubMode, setSessionSubMode] = useState("");
  const [subjectCatalog, setSubjectCatalog] = useState([]);
  const [subject, setSubject] = useState("");
  const [unit, setUnit] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [seminarTopicCatalog, setSeminarTopicCatalog] = useState([]);
  const [topic, setTopic] = useState("");
  const [custom, setCustom] = useState("");
  const [seminarType, setSeminarType] = useState("instant");
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [scheduledInfo, setScheduledInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinProgress, setJoinProgress] = useState(0);
  const [joinId, setJoinId] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);
  const [onlineSessions, setOnlineSessions] = useState([]);
  const [inviteInput, setInviteInput] = useState("");
  const [invitees, setInvitees] = useState([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const nameInitializedRef = useRef(false);
  const roomId = useRef(genId());
  const roomLink = genRoomLink(roomId.current);
  const { state: perm, stream, request } = useMicPerm();
  const { show: toast$, node: toastNode } = useToast();
  const toastRef = useRef(toast$);
  const finalTopic = topic === "__custom__" ? custom.trim() : topic;

  useEffect(() => {
    toastRef.current = toast$;
  }, [toast$]);
  const selectedSubjectEntry = useMemo(
    () => subjectCatalog.find((item) => item.subjectGroupKey === subject) || null,
    [subjectCatalog, subject],
  );
  const selectedSubjectLabel = selectedSubjectEntry?.title || subject;
  const availableUnits = useMemo(
    () => selectedSubjectEntry?.units || [],
    [selectedSubjectEntry],
  );
  const topicOptions = useMemo(() => {
    const selectedUnit = availableUnits.find((item) => item.id === selectedUnitId);
    const sectionTopics = (selectedUnit?.sectionTopics || [])
      .map((item) => item.label || item.sectionTitle || item.sectionNumber)
      .filter(Boolean);
    const fallbackTopics = (seminarTopicCatalog || [])
      .filter((item) => {
        if (!selectedUnitId) return true;
        return item?.unitId === selectedUnitId ||
          item?.unit_id === selectedUnitId ||
          item?.unitTitle === unit ||
          item?.unit === unit;
      })
      .map((item) => item.topic || item.title || item.name || item.label)
      .filter(Boolean);
    return Array.from(new Set([...sectionTopics, ...fallbackTopics]));
  }, [availableUnits, selectedUnitId, seminarTopicCatalog, unit]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (room) {
      roomId.current = room;
      setSeminarMode("session");
      setSessionSubMode("observer");
      setJoinId(room);
      setShowConfirm(true);
    }
  }, []);

  useEffect(() => {
    if (!nameInitializedRef.current && defaultName && !name) {
      nameInitializedRef.current = true;
      setName(defaultName);
    }
  }, [defaultName, name]);

  useEffect(() => {
    let ignore = false;
    async function loadSubjects() {
      try {
        const data = await getLibrarySubjects();
        if (!ignore) {
          setSubjectCatalog(data || []);
        }
      } catch {
        if (!ignore) {
          setSubjectCatalog([]);
          toastRef.current("Unable to load subjects for seminar.", "warn");
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
        setSeminarTopicCatalog([]);
        return;
      }
      try {
        const topics = await getSeminarTopics(subject);
        if (!ignore) {
          setSeminarTopicCatalog(topics || []);
        }
      } catch {
        if (!ignore) {
          setSeminarTopicCatalog([]);
          toastRef.current("Unable to load seminar topics from the server.", "warn");
        }
      }
    }
    loadTopics();
    return () => {
      ignore = true;
    };
  }, [subject]);

  useEffect(() => {
    if (topic && topic !== "__custom__" && !topicOptions.includes(topic)) {
      setTopic((current) => {
        if (!current || current === "__custom__" || topicOptions.includes(current)) {
          return current;
        }
        return "";
      });
    }
  }, [topic, topicOptions]);

  useEffect(() => {
    let ignore = false;
    async function loadActiveSessions() {
      try {
        const sessions = await getActiveSeminarSessions();
        if (!ignore) {
          setOnlineSessions(sessions || []);
        }
      } catch {
        if (!ignore) {
          setOnlineSessions([]);
        }
      }
    }
    loadActiveSessions();
    const pollId = setInterval(loadActiveSessions, 5000);
    return () => {
      ignore = true;
      clearInterval(pollId);
    };
  }, []);

  const copyLink = () => {
    navigator.clipboard.writeText(roomLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const addInvitee = () => {
    const value = inviteInput.trim();
    if (!value) return;
    if (invitees.find((item) => item.value === value)) {
      toast$("Already added", "warn");
      return;
    }
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    setInvitees((current) => [
      ...current,
      {
        id: Date.now() + Math.random(),
        value,
        type: isEmail ? "email" : "name",
        status: isEmail ? "sent" : "pending",
        color: COLORS[current.length % COLORS.length],
      },
    ]);
    setInviteInput("");
    toast$(isEmail ? `Invite sent to ${value}` : `Added ${value}`, isEmail ? "info" : "success");
  };

  const canJoinObserver = !!(selectedSession || parseSeminarSessionId(joinId));
  const presenterSteps = [
    { label: "Choose mode", done: seminarMode !== "" },
    { label: "Enter your name", done: name.trim().length > 0 },
    { label: "Allow microphone", done: perm === "granted" },
    { label: "Select subject and unit", done: !!subject && !!unit && !!selectedUnitId },
    { label: "Select topic", done: !!finalTopic },
  ];
  const observerSteps = [
    { label: "Choose observer mode", done: seminarMode === "session" && sessionSubMode === "observer" },
    { label: "Enter your name", done: name.trim().length > 0 },
    { label: "Pick a live session or paste a link", done: Boolean(selectedSession || parseSeminarSessionId(joinId)) },
  ];
  const activeSteps =
    seminarMode === "session" && sessionSubMode === "observer" ? observerSteps : presenterSteps;
  const canLaunch =
    seminarMode !== "" &&
    name.trim().length > 0 &&
    (seminarMode === "session" && sessionSubMode === "observer"
      ? canJoinObserver
      : perm === "granted" && !!subject && !!selectedUnitId && !!finalTopic);

  const leftFeatures =
    seminarMode === "prepare"
      ? [
          { ic: "AI", t: "AI Coach", d: "Practice seminar flow with guided help." },
          { ic: "TT", t: "Transcript", d: "Speech can be captured and reused for feedback." },
          { ic: "CH", t: "Coach Chat", d: "Ask follow-up questions any time." },
          { ic: "FB", t: "Formatted Feedback", d: "Readable end-of-session analysis." },
        ]
      : sessionSubMode === "observer"
        ? [
            { ic: "LV", t: "Watch Live", d: "Join active seminar rooms as an observer." },
            { ic: "CH", t: "Observer Chat", d: "Message the presenter through Node APIs." },
            { ic: "WR", t: "Waiting Room", d: "See room status before the host starts." },
            { ic: "RT", t: "Real-time Sync", d: "Live participant and session updates." },
          ]
        : [
            { ic: "RM", t: "Presenter Lobby", d: "Create a real room before starting AI." },
            { ic: "AI", t: "AI Greeting", d: "Use backend TTS from the Python response." },
            { ic: "OB", t: "Observer Join", d: "Share a real room link backed by MongoDB." },
            { ic: "RP", t: "Session Report", d: "End with clean seminar feedback." },
          ];

  async function handleJoin() {
    setJoining(true);
    try {
      for (let progress = 0; progress <= 100; progress += 20) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        setJoinProgress(progress);
      }

      const candidate = getCandidateContext(user || { firstName: name, lastName: "" });

      if (seminarMode === "session" && sessionSubMode === "observer") {
        const sessionId = selectedSession?.sessionId || selectedSession?.id || parseSeminarSessionId(joinId);
        if (!sessionId) throw new Error("Enter a valid seminar link or choose a live session.");
        const joinedSession = await joinSeminarSession({
          sessionId,
          candidateId: candidate.candidateId,
          candidateName: candidate.candidateName,
          role: "observer",
        });
        onLaunch({
          name,
          candidateId: candidate.candidateId,
          isGuest: !user,
          role: "Observer",
          subject: joinedSession?.subject || selectedSession?.subject || "",
          unit: joinedSession?.unit || selectedSession?.unit || "",
          topic: joinedSession?.topic || joinedSession?.liveSession?.topic || selectedSession?.topic || selectedSession?.title || "",
          invitees: [...invitees],
          roomId: sessionId,
          roomLink: joinedSession?.shareLink || selectedSession?.roomLink || genRoomLink(sessionId),
          stream: null,
          micOn: false,
          date: scheduledInfo?.date,
          time: scheduledInfo?.time,
          unitId: "",
          sessionId,
          liveSession: joinedSession?.liveSession || joinedSession || null,
          seminarMode: "session",
          sessionSubMode: "observer",
          joinSession: selectedSession || null,
        });
        return;
      }

      if (!selectedUnitId) {
        throw new Error("Please select a subject unit before continuing.");
      }

      if (seminarMode === "session" && sessionSubMode === "presenter") {
        const selectedUnit = availableUnits.find((item) => item.id === selectedUnitId);
        const session = await startSeminar({
          sessionId: roomId.current,
          unitId: selectedUnitId,
          candidateId: candidate.candidateId,
          candidateName: candidate.candidateName,
          topic: finalTopic,
          subject: selectedUnit?.subject || selectedSubjectLabel,
          unitNumber: selectedUnit?.unitNumber ?? undefined,
          board: selectedUnit?.board || undefined,
          classNumber: selectedUnit?.standard || undefined,
          unitName: selectedUnit?.unitTitle || selectedUnit?.unitLabel || unit,
          mode: "main",
          session_mode: "main",
          file: uploadedFile || null,
        });
        const sessionId = session?.session_id || session?.sessionId || roomId.current;
        onLaunch({
          name,
          candidateId: candidate.candidateId,
          isGuest: !user,
          role: "Facilitator",
          subject: selectedSubjectLabel,
          unit,
          topic: finalTopic,
          invitees: [...invitees],
          roomLink,
          stream,
          micOn: true,
          date: scheduledInfo?.date,
          time: scheduledInfo?.time,
          unitId: selectedUnitId,
          roomId: sessionId,
          sessionId,
          liveSession: session?.liveSession || null,
          initialFacilitatorMessage: session?.ai_greeting || session?.message || session?.opening_statement || "",
          seminarMode: "session",
          sessionSubMode: "presenter",
        });
        return;
      }

      const selectedUnit = availableUnits.find((item) => item.id === selectedUnitId);
      console.log("startSeminar called", {
        mode: "practice",
        candidateId: candidate.candidateId,
        candidateName: candidate.candidateName,
        subject: selectedUnit?.subject || selectedSubjectLabel,
        unitId: selectedUnitId,
        topic: finalTopic,
      });
      const liveSession = await startSeminar({
        unitId: selectedUnitId,
        candidateId: candidate.candidateId,
        candidateName: candidate.candidateName,
        topic: finalTopic,
        subject: selectedUnit?.subject || selectedSubjectLabel,
        unitNumber: selectedUnit?.unitNumber ?? undefined,
        board: selectedUnit?.board || undefined,
        classNumber: selectedUnit?.standard || undefined,
        unitName: selectedUnit?.unitTitle || selectedUnit?.unitLabel || unit,
        mode: "practice",
        session_mode: "practice",
      });
      console.log("startSeminar success", {
        sessionId: liveSession?.session_id || liveSession?.sessionId || "",
      });
      onLaunch({
        name,
        candidateId: candidate.candidateId,
        isGuest: !user,
        role: "Participant",
        subject: selectedSubjectLabel,
        unit,
        topic: finalTopic,
        invitees: [...invitees],
        roomId: roomId.current,
        roomLink,
        stream,
        micOn: false,
        date: scheduledInfo?.date,
        time: scheduledInfo?.time,
        unitId: selectedUnitId,
        sessionId: liveSession?.session_id || liveSession?.sessionId || "",
        liveSession: liveSession?.liveSession || null,
        initialFacilitatorMessage: liveSession?.ai_greeting || liveSession?.message || liveSession?.opening_statement || "",
        seminarMode: "prepare",
        sessionSubMode: "practice",
      });
    } catch (error) {
      toast$(getErrorMessage(error, "Unable to launch the seminar flow."), "error");
    } finally {
      setJoining(false);
      setShowConfirm(false);
      setJoinProgress(0);
    }
  }

  return (
    <div className="sp-setup route-enter">
      <div className="sp-left">
        <div className="sp-grid-lines" /><div className="sp-glow1" /><div className="sp-glow2" />
        <div className="sp-left-inner">
          <div className="sp-logo"><div className="sp-logo-ico">🎓</div><span className="sp-logo-name">SeminarArena</span></div>
          <div className="sp-badge"><div className="sp-badge-dot" />Seminar Setup</div>
          <h2 className="sp-h1">Your stage,<br/><span className="hl">your seminar.</span></h2>
          <p className="sp-desc">Switch between AI preparation, presenter session mode, and observer join flow without losing the real API-backed seminar behavior.</p>
          <div className="sp-features">
  {leftFeatures.map((feature, index) => (
  <div
    key={feature.t}
    className="sp-feat"
    style={{ animationDelay: `${0.1 + index * 0.06}s` }}
  >
    <div className="sp-feat-ic">{feature.ic}</div>
    <div>
      <div className="sp-feat-t">{feature.t}</div>
      <div className="sp-feat-d">{feature.d}</div>
    </div>
  </div>
))}
          </div>
          {(subject || finalTopic) && (
            <div className="ctx-chip">
              <div className="ctx-chip-lbl">Session Context</div>
              {subject && <div className="ctx-chip-val">{selectedSubjectLabel}{unit ? ` · ${unit}` : ""}</div>}
              {finalTopic && <div className="ctx-chip-sub">{finalTopic.length > 44 ? `${finalTopic.slice(0, 44)}…` : finalTopic}</div>}
            </div>
          )}
        </div>
      </div>

      <div className="sp-right">
        <div className="sp-right-scroll">
          <div className="sp-right-inner">
            {onBack && <button className="back-btn" onClick={onBack}>← Back</button>}
            <h2 className="setup-h">🎓 Seminar Setup</h2>
            <p className="setup-sub">Choose your mode first, then we keep the new design while routing through the live Node and Python seminar APIs.</p>
            <div className="sec-div">Choose Mode</div>
            <div className="module-grid fi">
              {[{ id: "prepare", ic: "🤖", t: "Prepare with AI", d: "AI coach helps you rehearse, build outline, transcribe speech and practice demo." }, { id: "session", ic: "🔴", t: "Seminar Session", d: "Start or join a live seminar with AI moderator, screen share & full report." }].map((item) => (
                <div key={item.id} className={`module-card${seminarMode === item.id ? " sel" : ""}`} onClick={() => { setSeminarMode(item.id); setSessionSubMode(""); }}>
                  <div className="mod-ic">{item.ic}</div>
                  <div><div className="mod-title">{item.t}</div><div className="mod-desc">{item.d}</div></div>
                </div>
              ))}
            </div>

            {seminarMode === "session" && (
              <>
                <div className="sec-div">I want to…</div>
                <div className="submode-grid fi">
                  <div className={`submode-card${sessionSubMode === "presenter" ? " sel" : ""}`} onClick={() => setSessionSubMode("presenter")}>
                    <div className="submode-ic">🎙️</div><div className="submode-title">Present a Seminar</div>
                    <div className="submode-desc">Start a room, share your screen, deliver your seminar.</div>
                  </div>
                  <div className={`submode-card${sessionSubMode === "observer" ? " sel" : ""}`} onClick={() => setSessionSubMode("observer")}>
                    <div className="submode-ic">👁️</div><div className="submode-title">Join as Observer</div>
                    <div className="submode-desc">Watch live seminars, ask questions in chat.</div>
                  </div>
                </div>
              </>
            )}

            {seminarMode === "session" && sessionSubMode === "observer" && (
              <>
                <div className="sec-div">Join a Session</div>
                <div className="obs-join-section">
                  <div className="obs-join-title">🔗 Join with Room Link or ID</div>
                  <div className="obs-join-input-row">
                    <input className="finput" placeholder="Paste room link or enter Room ID…" style={{ flex: 1 }} value={joinId} onChange={(event) => setJoinId(event.target.value)} />
                    <button className="btn-s" onClick={() => { const parsed = parseSeminarSessionId(joinId); if (parsed) { setJoinId(parsed); toast$("Room ID ready", "info"); } }}>Use Link</button>
                  </div>
                  <div className="obs-join-or">or</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--t2)", marginBottom: 8 }}>📡 Live & Upcoming Sessions</div>
                  {onlineSessions.length === 0 ? <div className="ongoing-empty">No active sessions. Check back soon.</div> : (
                    <div className="ongoing-list">
                      {onlineSessions.map((session) => {
                        const sessionKey = session.sessionId || session.id;
                        const selectedKey = selectedSession?.sessionId || selectedSession?.id;
                        const isActive = session.status === "active";
                        return (
                          <div key={sessionKey} className={`ongoing-card${selectedKey === sessionKey ? " sel" : ""}`} onClick={() => setSelectedSession(selectedKey === sessionKey ? null : session)}>
                            <div className="ongoing-live-dot" style={{ background: isActive ? "var(--red)" : "var(--amb)" }} />
                            <div className="ongoing-info">
                              <div className="ongoing-topic">{session.topic || session.title || "Seminar Session"}</div>
                              <div className="ongoing-meta">📚 {session.subject || "—"}{session.unit ? ` · ${session.unit}` : ""} · {session.presenterName || session.hostCandidateName ? `by ${session.presenterName || session.hostCandidateName} · ` : ""}{isActive ? "🔴 Live now" : `📅 ${session.date || ""} ${session.time || ""}`}</div>
                            </div>
                            <div className="ongoing-count" style={{ background: isActive ? "rgba(229,62,62,.1)" : "rgba(246,166,35,.1)", color: isActive ? "var(--red)" : "var(--amb)" }}>
                              {isActive ? (session.observerCount ? `${session.observerCount} 👁` : "● LIVE") : "⏰"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="sec-div">Your Name</div>
                <div className="fi"><label className="fl">Display Name</label><input className="finput" placeholder="e.g. Alex (Observer)" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} /></div>
                <div style={{ marginTop: 14, marginBottom: 10 }}><button className="btn-p" onClick={() => setShowConfirm(true)} disabled={!canJoinObserver || !name.trim()}>👁️ Join as Observer</button></div>
              </>
            )}

            {(seminarMode === "prepare" || (seminarMode === "session" && sessionSubMode === "presenter")) && (
              <>
                <div className="sec-div">Your Identity</div>
                <div className="fi"><label className="fl">Your Name</label><input className="finput" placeholder="e.g. Alex Johnson" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} /></div>
                <div className="sec-div">Academic Context</div>
                <div className="fi-row fi">
                  <div><label className="fl">Subject</label>
                    <select className="finput" value={subject} onChange={(event) => { setSubject(event.target.value); setUnit(""); setSelectedUnitId(""); setTopic(""); }}>
                      <option value="">Select subject…</option>
                      {subjectCatalog.map((item) => <option key={item.subjectGroupKey} value={item.subjectGroupKey}>{item.title}</option>)}
                    </select>
                  </div>
                  <div><label className="fl">Unit / Module</label>
                    <select className="finput" value={selectedUnitId} onChange={(event) => { const nextId = event.target.value; setSelectedUnitId(nextId); const selectedUnit = availableUnits.find((item) => item.id === nextId); setUnit(selectedUnit?.unitTitle || selectedUnit?.unitLabel || ""); setTopic(""); }} disabled={!subject}>
                      <option value="">{subject ? "Select unit…" : "Subject first"}</option>
                      {availableUnits.map((item) => <option key={item.id} value={item.id}>{item.unitTitle || item.unitLabel}</option>)}
                    </select>
                  </div>
                </div>
                <div className="sec-div">Seminar Topic</div>
                <div className="fi">
                  <select className="finput" value={topic} onChange={(event) => setTopic(event.target.value)} disabled={!selectedUnitId}>
                    <option value="">{selectedUnitId ? "Select a topic…" : "Select unit first"}</option>
                    {topicOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    {!topicOptions.length && subject && <option value="" disabled>No data available</option>}
                    <option value="__custom__">✏️ Custom topic…</option>
                  </select>
                </div>
                {topic === "__custom__" && <div className="fi"><input className="finput" placeholder="Enter your seminar topic…" value={custom} onChange={(event) => setCustom(event.target.value)} /></div>}

                {seminarMode === "session" && sessionSubMode === "presenter" && (
                  <>
                    <div className="sec-div">Session Timing</div>
                    <div className="timing-grid fi">
                      {[{ id: "instant", ic: "⚡", t: "Start Now", d: "Launch immediately" }, { id: "schedule", ic: "📅", t: "Schedule", d: "Plan for a future date" }].map((item) => (
                        <div key={item.id} className={`timing-card${seminarType === item.id ? " sel" : ""}`} onClick={() => setSeminarType(item.id)}>
                          <div className="timing-ic">{item.ic}</div><div><div className="timing-title">{item.t}</div><div className="timing-desc">{item.d}</div></div>
                        </div>
                      ))}
                    </div>
                    <div className="sec-div">Invite Observers</div>
                    <div className="obs-join-input-row" style={{ marginBottom: 10 }}>
                      <input className="finput" placeholder="Add observer email or name…" style={{ flex: 1 }} value={inviteInput} onChange={(event) => setInviteInput(event.target.value)} />
                      <button className="btn-s" onClick={addInvitee}>Add</button>
                    </div>
                    {invitees.length > 0 && <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                      {invitees.map((invitee) => (
                        <div key={invitee.id} className="invite-row">
                          <div className="invite-av" style={{ background: invitee.color }}>{invitee.value.slice(0, 1).toUpperCase()}</div>
                          <div className="invite-info">
                            <div className="invite-name">{invitee.value}</div>
                            <div className="invite-type">{invitee.type === "email" ? "Email invite" : "Link invite"}</div>
                          </div>
                          <div className={`invite-status ${invitee.status === "sent" ? "inv-sent" : "inv-pending"}`}>{invitee.status}</div>
                          <button className="invite-rm" onClick={() => setInvitees((current) => current.filter((item) => item.id !== invitee.id))}>×</button>
                        </div>
                      ))}
                    </div>}
                    {seminarType === "schedule" && <div style={{ padding: "11px 13px", borderRadius: 11, background: "rgba(0,195,122,.04)", border: "1.5px solid rgba(0,195,122,.16)", marginBottom: 10 }}>
                      {!scheduled ? (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t1)", marginBottom: 5 }}>📅 Schedule & publish to community</div>
                          <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 8 }}>Observers in your group will see and can join.</div>
                          <button className="btn-s" style={{ width: "100%", justifyContent: "center" }} onClick={() => setShowSchedule(true)}>📅 Set Date & Time</button>
                        </>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span style={{ fontSize: 20 }}>✅</span>
                          <div style={{ flex: 1 }}><div style={{ fontSize: 11.5, fontWeight: 800, color: "var(--em)" }}>Scheduled & Published</div><div style={{ fontSize: 10.5, color: "var(--t2)" }}>📅 {scheduledInfo?.date} at {scheduledInfo?.time}</div></div>
                          <button className="btn-s" style={{ fontSize: 10.5, padding: "3px 8px" }} onClick={() => { setScheduled(false); setShowSchedule(true); }}>Edit</button>
                        </div>
                      )}
                    </div>}
                    <div className="link-box">
                      <div className="link-lbl">🔗 Your Room Link — Share with Observers</div>
                      <div className="link-row"><span className="link-val">{roomLink}</span><button className="copy-btn" onClick={copyLink}>{copied ? "✓ Copied" : "Copy"}</button></div>
                    </div>
                    <div className="sec-div">Upload Presentation (Optional)</div>
                    <div className="fi">
                      <label className="fl">PDF or PowerPoint for AI context & screen share</label>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:6}}>
                        <label style={{flex:1,padding:"9px 14px",borderRadius:10,border:"1.5px dashed rgba(0,195,122,.35)",background:"rgba(0,195,122,.04)",cursor:"pointer",fontSize:12,color:"var(--t2)",display:"flex",alignItems:"center",gap:8}}>
                          <span style={{fontSize:16}}>📎</span>
                          <span>{uploadedFile ? uploadedFile.name : "Choose PDF, PPT, or PPTX…"}</span>
                          <input type="file" accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" style={{display:"none"}} onChange={(e)=>{const f=e.target.files?.[0]||null;setUploadedFile(f);if(f)toast$(`📎 ${f.name} ready to share`,"success");}}/>
                        </label>
                        {uploadedFile && <button className="btn-s" style={{padding:"8px 10px",fontSize:11}} onClick={()=>setUploadedFile(null)}>✕ Remove</button>}
                      </div>
                    </div>
                  </>
                )}
                <div style={{ marginTop: 14, marginBottom: 10 }}>
                  <div className="steps">
                    {activeSteps.map((step, index) => {
                      const done = step.done;
                      const prev = activeSteps.slice(0, index).every((item) => item.done);
                      const act = !done && prev;
                      return <div key={index} className={`step-r ${done ? "done" : act ? "act" : "pend"}`}><div className="step-num">{done ? "✓" : index + 1}</div><div className="step-lbl">{step.label}</div></div>;
                    })}
                  </div>
                  {perm !== "granted" && <button className="btn-s" style={{ width: "100%", justifyContent: "center", marginBottom: 8 }} onClick={request}>🎤 Allow Microphone</button>}
                  <button className="btn-p" onClick={() => setShowConfirm(true)} disabled={!canLaunch || (seminarType === "schedule" && !scheduled)}>
                    {seminarMode === "prepare" ? "🤖 Start AI Preparation" : sessionSubMode === "observer" ? "👁️ Join as Observer" : "🎙️ Launch Seminar Room"}
                  </button>
                </div>
              </>
            )}
            <div style={{ height: 20 }} />
          </div>
        </div>
      </div>

      {showSchedule && <ScheduleSeminarModal config={{ topic: finalTopic, subject: selectedSubjectLabel || subject, unit, roomLink }} onSchedule={(info) => { setScheduledInfo(info); setScheduled(true); setShowSchedule(false); toast$("📅 Seminar scheduled & published!", "success"); }} onClose={() => setShowSchedule(false)} />}
      {showConfirm && (
        <div className="overlay">
          <div className="modal" style={{ maxWidth: 340, background: "#0c1422", border: "1px solid rgba(255,255,255,.1)" }}>
            <div style={{ background: "linear-gradient(135deg,#060e1c,#081a10)", padding: "20px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 38, marginBottom: 8 }}>{seminarMode === "prepare" ? "🤖" : sessionSubMode === "observer" ? "👁️" : "🎓"}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 2 }}>{name}</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.4)" }}>{seminarMode === "prepare" ? "Launching AI practice" : sessionSubMode === "observer" ? "Joining as Observer" : "Preparing Seminar Room"}</div>
            </div>
            <div className="mb" style={{ background: "#0c1422" }}>
              {(selectedSession || finalTopic) && <div style={{ padding: "9px 11px", borderRadius: 9, background: "rgba(45,156,219,.06)", border: "1px solid rgba(45,156,219,.2)", marginBottom: 9, fontSize: 11.5, fontWeight: 600, color: "var(--sky)" }}>
                {sessionSubMode === "observer" ? `👁️ Joining: ${selectedSession?.topic || selectedSession?.title || parseSeminarSessionId(joinId)}` : `🎓 Topic: ${finalTopic}`}
              </div>}
              {(seminarMode !== "session" || sessionSubMode !== "observer") && <button className={`perm-btn ${perm === "granted" ? "granted" : perm === "denied" ? "denied" : "req"}`} style={{ width: "100%", justifyContent: "center", fontSize: 13, padding: "10px" }} onClick={request} disabled={perm === "requesting" || perm === "granted"}>
                <span style={{ fontSize: 18 }}>{perm === "granted" ? "🎤" : perm === "denied" ? "⚠️" : "🎙️"}</span>
                {perm === "granted" ? "Microphone Active" : perm === "requesting" ? "Checking microphone..." : "Allow microphone"}
              </button>}
            </div>
            <div className="mf" style={{ borderColor: "rgba(255,255,255,.08)", background: "#0c1422", flexDirection: "column", gap: 7 }}>
              <button className="btn-p" onClick={handleJoin} disabled={joining || ((seminarMode !== "session" || sessionSubMode !== "observer") && perm !== "granted")}>
                {joining ? <><span className="loader-spin" />{joinProgress > 0 ? `Loading ${joinProgress}%` : "Joining…"}</> : seminarMode === "prepare" ? "🤖 Enter AI Practice" : sessionSubMode === "observer" ? "👁️ Enter as Observer" : "🎙️ Enter Seminar Room"}
              </button>
              {joinProgress > 0 && <div className="lo-progress"><div className="lo-progress-fill" style={{ width: `${joinProgress}%` }} /></div>}
              <button className="btn-s" onClick={() => setShowConfirm(false)} disabled={joining} style={{ width: "100%", justifyContent: "center", background: "rgba(255,255,255,.04)", borderColor: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.5)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </div>
  );
}

function PrepareWithAIRoom({config,onEnd}) {
  const timer=usePausableTimer();
  const PRACTICE_SILENCE_MS = 4500;
  const DEMO_HELP_SILENCE_MS = 10000;
  
  // Setup Flow State
  const [setupPhase, setSetupPhase] = useState(config.sessionSubMode === "demo" ? "intro" : "session"); // intro, tutoring, preparing, session
  const [demoPreviewModal, setDemoPreviewModal] = useState(false);
  const [demoFile, setDemoFile] = useState(null);
  const [chatOptions, setChatOptions] = useState([{label: "Show me how to present", action: "tutoring"}]);
  const [actionLoader, setActionLoader] = useState(null);

  const [demoReady,setDemoReady]=useState(false);
  const [demoMode,setDemoMode]=useState(false);
  const [demoTimer,setDemoTimer]=useState(0);
  const [demoRunning,setDemoRunning]=useState(false);
  const [micOn,setMicOn]=useState(false);
  const localStreamRef=useRef(null);
  const [sessionId,setSessionId]=useState(config.sessionId || "");
  const [activeSeminarMode,setActiveSeminarMode]=useState(config.sessionSubMode === "demo" ? "demo" : "practice");
  const [speechRecording,setSpeechRecording]=useState(false);
  const [speechProcessing,setSpeechProcessing]=useState(false);
  const [requestingGuide,setRequestingGuide]=useState(false);
  const [showHelpPrompt,setShowHelpPrompt]=useState(false);
  const [guideStatusText,setGuideStatusText]=useState("");
  const [pendingGuideTranscript,setPendingGuideTranscript]=useState("");
  const [endingSession,setEndingSession]=useState(false);
  const [greetingState,setGreetingState]=useState("preparing");
  // Presentation/Screen share state
  const [presentMode,setPresentMode]=useState(false); // true = big screen + strip layout
  const [isScreenSharing,setIsScreenSharing]=useState(false);
  const [presentAnalysis,setPresentAnalysis]=useState(""); // AI analysis of presentation
  const [presentAnalysisInterval,setPresentAnalysisIntervalRef]=useState(null);
  const [panelOpen,setPanelOpen]=useState(true);
  const [activePanel,setActivePanel]=useState("chat");
  const [showReactions,setShowReactions]=useState(false);
  const [reaction,setReaction]=useState(null);
  const [aiInput,setAiInput]=useState("");
  const [voiceListening,setVoiceListening]=useState(false);
  const [isAITyping,setIsAITyping]=useState(false);
  const [exchanges,setExchanges]=useState(0);
  const [messages,setMessages]=useState([]);
  const [notes,setNotes]=useState([
    {id:1,n:1,q:"What structure should my seminar follow?",a:"OUTLINE:\n1. Opening Hook — bold question or statistic\n2. Thesis Statement — one clear sentence\n3. Argument 1 — strongest point + evidence\n4. Argument 2 — case study angle\n5. Argument 3 — nuance or complexity\n6. Counterarguments — acknowledge & rebut\n7. Conclusion — restate thesis, call to action",open:false},
    {id:2,n:2,q:"What are key delivery tips?",a:"DELIVERY TIPS:\n• Speak at 100–120 wpm — don't rush\n• Pause after key claims — silence is powerful\n• Vary your tone to maintain engagement\n• Make eye contact with different parts of the audience\n• Use transitions: 'Building on that…' / 'On the other hand…'\n• End with a direct question to the audience",open:false},
  ]);
  const [noteCount,setNoteCount]=useState(3);
  const [isStudentSpeaking,setIsStudentSpeaking]=useState(false);
  const [liveTranscript,setLiveTranscript]=useState("");
  const [transcriptHistory,setTranscriptHistory]=useState([]);
  const [showEnd,setShowEnd]=useState(false);
  const [showAnalysis,setShowAnalysis]=useState(false);

  const [aiSuggestion,setAiSuggestion]=useState(null);
  const [aiPausedForSuggestion,setAiPausedForSuggestion]=useState(false);
  const lastSpeechTimeRef=useRef(Date.now());
  const stuckCheckRef=useRef(null);
  const resumeCountdownRef=useRef(null);
  const [resumeCountdown,setResumeCountdown]=useState(0);

  const chatEndRef=useRef(null);
  const aiVoice=useAIVoice();
  const speech=useSpeechRecognition();
  const voiceAsk=useSpeechRecognition();
  const demoIntervalRef=useRef(null);
  const presentAnalysisRef=useRef(null);
  const speechRecorderRef=useRef(null);
  const speechChunksRef=useRef([]);
  const speechAudioContextRef=useRef(null);
  const speechAnalyserRef=useRef(null);
  const speechSilenceRef=useRef(null);
  const speechDetectedRef=useRef(false);
  const lastSpeechAtRef=useRef(null);
  const speechStopReasonRef=useRef("manual-submit");
  const initialGreetingPlayedRef=useRef(false);
  const prepareRoomMountedRef=useRef(false);
  const greetingTimeoutRef=useRef(null);
  const captureStartingRef=useRef(false);
  const latestTranscriptHistoryRef=useRef([]);
  const manualSpeakRequestedRef=useRef(false);
  const micPreferenceRef=useRef(false);
  const lastSubmittedTranscriptRef=useRef({ text:"", at:0 });
  const {show:toast$,node:toastNode}=useToast();
  const speakAiReplyRef=useRef(null);
  const triggerAISuggestionRef=useRef(()=>{});
  const roomToastRef=useRef(toast$);
  const voiceAskStopRef=useRef(voiceAsk.stop);
  const aiCancelRef=useRef(aiVoice.cancel);
  const roomStreamRef=useRef(config.stream);
  const isPracticeMode = activeSeminarMode === "practice";
  const isGreetingPending = greetingState !== "ready";
  const isAiResponsePending = !isGreetingPending && (speechProcessing || requestingGuide || Boolean(guideStatusText)) && !aiVoice.isSpeaking;
  const roomLoaderTitle = isGreetingPending
    ? (greetingState === "speaking" ? "AI greeting in progress..." : "Preparing AI greeting...")
    : speechProcessing
      ? "Preparing AI response..."
      : requestingGuide
        ? "Preparing AI guidance..."
        : "Connecting to AI speaker...";
  const roomLoaderText = isGreetingPending
    ? (greetingState === "speaking" ? "Please listen while the AI coach opens the session. Your microphone will unlock right after this greeting." : "Connecting to the AI speaker and getting your seminar coach ready.")
    : speechProcessing
      ? "Processing your speech and drafting the next AI response."
      : guideStatusText || "Getting the AI reply ready for playback.";
  const micStatusText = isGreetingPending
    ? (greetingState === "speaking" ? "AI greeting in progress. Your microphone will unlock when it finishes." : "Preparing AI greeting and connecting to the speaker...")
    : isAiResponsePending
      ? "AI is preparing a spoken response. Your microphone will unlock when it is ready."
      : aiVoice.isSpeaking
      ? "AI is speaking. Your microphone is muted for now."
      : speechProcessing
        ? "Processing your speech and preparing an AI response."
        : speechRecording
          ? (isPracticeMode ? "Listening now. Click Mute Mic to submit your response." : "Listening now. Click Stop Speak when you finish.")
          : micOn
            ? (isPracticeMode ? "Microphone is live. Start speaking when you are ready, or click Mute Mic to submit." : "Microphone ready. Click Start Speak when you want to talk.")
            : "Microphone muted. Unmute it when you are ready to speak.";

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  useEffect(()=>{latestTranscriptHistoryRef.current = transcriptHistory;},[transcriptHistory]);
  useEffect(()=>{roomToastRef.current = toast$;},[toast$]);
  useEffect(()=>{voiceAskStopRef.current = voiceAsk.stop;},[voiceAsk.stop]);
  useEffect(()=>{aiCancelRef.current = aiVoice.cancel;},[aiVoice.cancel]);
  useEffect(()=>{roomStreamRef.current = config.stream;},[config.stream]);
useEffect(()=>{
    prepareRoomMountedRef.current = true;
    // Request mic on mount so stream is always available
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((stream)=>{
        if(!prepareRoomMountedRef.current){ stream.getTracks().forEach(t=>t.stop()); return; }
        localStreamRef.current = stream;
        // mute tracks until user explicitly unmutes
        stream.getAudioTracks().forEach(t=>{ t.enabled = false; });
      })
      .catch(()=>{ console.warn("[PrepareRoom] mic permission denied or unavailable"); });
    return ()=>{
      prepareRoomMountedRef.current = false;
      if(greetingTimeoutRef.current){
        clearTimeout(greetingTimeoutRef.current);
        greetingTimeoutRef.current = null;
      }
      captureStartingRef.current = false;
      // stop local stream on unmount
      localStreamRef.current?.getTracks().forEach(t=>t.stop());
      localStreamRef.current = null;
    };
  },[]);

  const setMicEnabled = useCallback((enabled)=>{
    micPreferenceRef.current = enabled;
    setMicOn(enabled);
    const s = localStreamRef.current || config.stream;
    if(s && typeof s.getAudioTracks==="function"){
      s.getAudioTracks().forEach(track=>{ track.enabled = enabled; });
    }
  },[config.stream]);

  const cleanupSpeechDetection = useCallback(()=>{
    if(speechSilenceRef.current){
      clearInterval(speechSilenceRef.current);
      speechSilenceRef.current=null;
    }
    speechAnalyserRef.current=null;
    if(speechAudioContextRef.current){
      speechAudioContextRef.current.close().catch(()=>null);
      speechAudioContextRef.current=null;
    }
    speechDetectedRef.current=false;
    lastSpeechAtRef.current=null;
    setIsStudentSpeaking(false);
  },[]);

  const stopSpeechCapture = useCallback((reason="manual-submit")=>{
    if(!speechRecorderRef.current) return;
    speechStopReasonRef.current = reason;
    const recorder = speechRecorderRef.current;
    speechRecorderRef.current = null;
    captureStartingRef.current = false;
    cleanupSpeechDetection();
    setSpeechRecording(false);
    setSpeechProcessing(true);
    recorder.stop();
  },[cleanupSpeechDetection]);

  const beginSpeechCapture = useCallback(()=>{
    if(
      !prepareRoomMountedRef.current ||
      !sessionId ||
      !micPreferenceRef.current ||
      (isGreetingPending && activeSeminarMode !== "demo") ||
      speechRecording ||
      speechProcessing ||
      aiVoice.isSpeaking ||
      timer.isPaused ||
      speechRecorderRef.current ||
      captureStartingRef.current
    ){
      return;
    }
    const localStream = localStreamRef.current instanceof MediaStream ? localStreamRef.current : (config.stream instanceof MediaStream ? config.stream : null);
    const audioTrack = localStream?.getAudioTracks?.()[0];
    if(!audioTrack){
      toast$("Microphone is not available. Please allow mic access and try again.","warn");
      return;
    }
    audioTrack.enabled = true;
    const recordingStream = new MediaStream([audioTrack]);
    const mimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    const supportedMimeType = mimeTypes.find((value)=>typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(value));
    let recorder;
    captureStartingRef.current = true;
    try{
      recorder = supportedMimeType ? new MediaRecorder(recordingStream,{ mimeType: supportedMimeType }) : new MediaRecorder(recordingStream);
    } catch(error){
      captureStartingRef.current = false;
      toast$("Your browser could not start seminar voice recording.","error");
      return;
    }
    speechRecorderRef.current = recorder;
    speechChunksRef.current = [];
    setGuideStatusText("");
    setShowHelpPrompt(false);
    recorder.ondataavailable = (event)=>{
      if(event.data.size>0){
        speechChunksRef.current.push(event.data);
      }
    };
    recorder.onstop = async ()=>{
      console.log("recording stopped", { reason: speechStopReasonRef.current });
      captureStartingRef.current = false;
      cleanupSpeechDetection();
      setSpeechRecording(false);
      const blobType = supportedMimeType || recorder.mimeType || "audio/webm";
      const audioBlob = new Blob(speechChunksRef.current,{ type: blobType });
      speechChunksRef.current = [];
      if(!audioBlob.size){
        setSpeechProcessing(false);
        return;
      }
      setSpeechProcessing(true);
      try{
        const response = await transcribeDebateAudio(audioBlob);
        const transcriptText = String(response?.text || "").trim();
        console.log("transcript ready", { transcript: transcriptText });
        if(transcriptText){
          lastSpeechTimeRef.current = Date.now();
          setTranscriptHistory((current)=>[...current, transcriptText].slice(-40));
          setLiveTranscript(transcriptText);
          setMessages((current)=>[...current,{ from:"me", text: transcriptText }]);
          setExchanges((value)=>value+1);
        }
        const stopReason = speechStopReasonRef.current;
        if(stopReason === "help-prompt"){
          setAiPausedForSuggestion(true);
          setPendingGuideTranscript(transcriptText || latestTranscriptHistoryRef.current.join("\n"));
          setShowHelpPrompt(true);
          return;
        }
        if(!transcriptText){
          toast$("No speech detected in the last segment.","warn");
          return;
        }
        if(
          lastSubmittedTranscriptRef.current.text === transcriptText &&
          Date.now() - lastSubmittedTranscriptRef.current.at < 8000
        ){
          setGuideStatusText("");
          return;
        }
        lastSubmittedTranscriptRef.current = { text: transcriptText, at: Date.now() };
        setGuideStatusText("AI is ready to help. Please wait...");
        console.log("respondSeminar called", { sessionId, transcript: transcriptText });
        const seminarReply = await respondSeminar({
          sessionId,
          transcript: transcriptText,
          silenceSeconds: activeSeminarMode === "practice" ? 5 : 10,
        });
        console.log("respondSeminar success", { sessionId });
        const aiReply =
          seminarReply?.ai_response ||
          seminarReply?.response ||
          seminarReply?.reply ||
          seminarReply?.message ||
          seminarReply?.guidance ||
          seminarReply?.answer;
        if(aiReply){
          setAiPausedForSuggestion(false);
          setMessages((current)=>[...current,{ from:"ai", text: aiReply }]);
          setExchanges((value)=>value+1);
          addNote(
            transcriptText.length > 55 ? `${transcriptText.slice(0,55)}…` : transcriptText,
            aiReply
          );
          setGuideStatusText("");
    speakAiReplyRef.current?.(aiReply, { resumeCapture: activeSeminarMode === "demo" });
        } else {
          setGuideStatusText("");
        }
      } catch(error){
        setGuideStatusText("");
        toast$(getErrorMessage(error, "Unable to process seminar speech right now."),"error");
      } finally {
        setSpeechProcessing(false);
      }
    };
    recorder.onerror = ()=>{
      captureStartingRef.current = false;
      speechRecorderRef.current = null;
      cleanupSpeechDetection();
      setSpeechRecording(false);
      setSpeechProcessing(false);
      toast$("Seminar voice recording failed to start.","error");
    };
    try{
      recorder.start(250);
    } catch(error){
      captureStartingRef.current = false;
      speechRecorderRef.current = null;
      cleanupSpeechDetection();
      setSpeechRecording(false);
      setSpeechProcessing(false);
      console.error("recorder.start() failed", error);
      return;
    }
    setSpeechRecording(true);
    try{
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.82;
      const source = audioContext.createMediaStreamSource(recordingStream);
      source.connect(analyser);
      speechAudioContextRef.current = audioContext;
      speechAnalyserRef.current = analyser;
      speechDetectedRef.current = false;
      lastSpeechAtRef.current = Date.now();
      const samples = new Uint8Array(analyser.fftSize);
      speechSilenceRef.current = setInterval(()=>{
        if(!speechAnalyserRef.current) return;
        speechAnalyserRef.current.getByteTimeDomainData(samples);
        let peak = 0;
        for(let index = 0; index < samples.length; index += 1){
          const amplitude = Math.abs(samples[index] - 128);
          if(amplitude > peak) peak = amplitude;
        }
        const detectedSpeech = peak > 8;
        if(detectedSpeech){
          speechDetectedRef.current = true;
          lastSpeechAtRef.current = Date.now();
          lastSpeechTimeRef.current = Date.now();
          setIsStudentSpeaking(true);
          return;
        }
        setIsStudentSpeaking(false);
        if(!lastSpeechAtRef.current){
          lastSpeechAtRef.current = Date.now();
        }
        const silenceThreshold = activeSeminarMode === "demo" ? DEMO_HELP_SILENCE_MS : PRACTICE_SILENCE_MS;
        if(Date.now() - lastSpeechAtRef.current >= silenceThreshold){
          console.log("silence detected", { mode: activeSeminarMode, threshold: silenceThreshold });
          speechStopReasonRef.current = activeSeminarMode === "demo" ? "help-prompt" : "auto-submit";
          if(activeSeminarMode === "practice"){
            setMicEnabled(false);
          }
          setSpeechProcessing(true);
          speechRecorderRef.current?.stop();
          speechRecorderRef.current = null;
        }
      },500);
    } catch {
      captureStartingRef.current = false;
      speechRecorderRef.current = null;
      cleanupSpeechDetection();
    }
    console.log("recording started", { mode: activeSeminarMode });
    toast$(
      activeSeminarMode === "demo"
        ? "Listening... we will offer help after 10 seconds of silence."
        : "Listening... your speech will be submitted after 4.5 seconds of silence.",
      "info"
    );
  },[activeSeminarMode, aiVoice.isSpeaking, cleanupSpeechDetection, config.stream, isGreetingPending, sessionId, setMicEnabled, speechProcessing, speechRecording, timer.isPaused, toast$]);

  const handleMuteUnmutePractice = useCallback(()=>{
    if(isGreetingPending){
      toast$("Please wait until the AI greeting finishes.","info");
      return;
    }
    if(aiVoice.isSpeaking){
      toast$("AI is speaking right now. Please wait.","info");
      return;
    }
    if(speechProcessing){
      toast$("AI is still thinking. Please wait a moment.","info");
      return;
    }
    if(!micOn){
      console.log("mic unmuted");
      manualSpeakRequestedRef.current = true;
      setMicEnabled(true);
      beginSpeechCapture();
      return;
    }
    if(speechRecording){
      console.log("recording stopped", { reason: "manual-submit" });
      manualSpeakRequestedRef.current = false;
      setMicEnabled(false);
      stopSpeechCapture("manual-submit");
      return;
    }
    setMicEnabled(false);
  },[aiVoice.isSpeaking, beginSpeechCapture, isGreetingPending, micOn, setMicEnabled, speechProcessing, speechRecording, stopSpeechCapture, toast$]);

  const handleMainMicToggle = useCallback(()=>{
    if (isGreetingPending) {
      toast$("Please wait until the AI greeting finishes.", "info");
      return;
    }

    if (speechRecording) {
      toast$("Stop speaking before muting your microphone.", "warn");
      return;
    }

    setMicEnabled(!micOn);
    toast$(
      !micOn
        ? "Microphone unmuted. You can start speaking now."
        : "Microphone muted.",
      !micOn ? "success" : "warn"
    );
  },[isGreetingPending, micOn, setMicEnabled, speechRecording, toast$]);

  const handleMicButtonClick = isPracticeMode ? handleMuteUnmutePractice : handleMainMicToggle;

  const speakAiReply = useCallback((text, options = {})=>{
    if(!text) return;
    const resumeCapture = Boolean(options?.resumeCapture);
    const isGreeting = Boolean(options?.isGreeting);
    const unlockMicOnDone = Boolean(options?.unlockMicOnDone);
    const shouldRestoreMic = !isPracticeMode && (micPreferenceRef.current || resumeCapture);
    setMicEnabled(false);
    if(isGreeting){
      setGreetingState("connecting");
    }
    aiVoice.speak(text, ()=>{
      if(isGreeting){
        console.log("greeting speak ended");
      } else {
        console.log("AI response speaking ended");
      }
      if(isGreeting){
        setGreetingState("ready");
      }
if(unlockMicOnDone || shouldRestoreMic){
        setMicEnabled(true);
      }
      if(resumeCapture && sessionId && !speechRecording && !speechProcessing && !timer.isPaused){
        if(manualSpeakRequestedRef.current || activeSeminarMode === "demo"){
          micPreferenceRef.current = true;
          beginSpeechCapture();
        }
      }
       },{
      onStart: ()=>{
        lastSpeechTimeRef.current = Date.now();
        if(isGreeting){
          console.log("greeting speak started");
          setGreetingState("speaking");
        } else {
          console.log("AI response speaking started");
        }
      },
    });
  },[aiVoice, beginSpeechCapture, isPracticeMode, sessionId, setMicEnabled, speechProcessing, speechRecording, timer.isPaused]);

  useEffect(()=>{
    speakAiReplyRef.current = speakAiReply;
  },[speakAiReply]);

useEffect(()=>{
    setGreetingState("connecting");
    roomToastRef.current(activeSeminarMode === "demo" ? "Connecting to your AI seminar coach..." : "Preparing your AI seminar coach...", "info");
    const greeting =
      config.initialFacilitatorMessage ||
      `Welcome to your seminar session on "${config.topic}"${config.subject?` (${config.subject}${config.unit?` - ${config.unit}`:""})`:""}. I'm your AI Coach. Would you like step-by-step instructions on how to present effectively?`;
    setMessages([{ from:"ai", text: greeting }]);
    if(!initialGreetingPlayedRef.current){
      initialGreetingPlayedRef.current = true;
      console.log("[greeting] prepareRoomMountedRef.current =", prepareRoomMountedRef.current);
      speakAiReplyRef.current(greeting,{ resumeCapture: false, isGreeting: true, unlockMicOnDone: false });
    }
    return()=>{
      if(greetingTimeoutRef.current){
        clearTimeout(greetingTimeoutRef.current);
        greetingTimeoutRef.current = null;
      }
      voiceAskStopRef.current?.();
      aiCancelRef.current?.();
      cleanupSpeechDetection();
      if(speechRecorderRef.current){
        try { speechRecorderRef.current.stop(); } catch {}
        speechRecorderRef.current = null;
      }
      if(demoIntervalRef.current)clearInterval(demoIntervalRef.current);
      if(stuckCheckRef.current)clearInterval(stuckCheckRef.current);
      if(resumeCountdownRef.current)clearInterval(resumeCountdownRef.current);
      if(presentAnalysisRef.current)clearInterval(presentAnalysisRef.current);
      if(roomStreamRef.current&&typeof roomStreamRef.current.getTracks==="function")roomStreamRef.current.getTracks().forEach(t=>t.stop());
    };
  },[]);

  // Demo timer
  useEffect(()=>{
    if(!demoRunning){return;}
    const id=setInterval(()=>setDemoTimer(t=>t+1),1000);
    demoIntervalRef.current=id;return()=>clearInterval(id);
  },[demoRunning]);

  // AI stuck detection — only during demo
  useEffect(()=>{
    if(!demoMode||!demoRunning){
      if(stuckCheckRef.current)clearInterval(stuckCheckRef.current);
      return;
    }
    stuckCheckRef.current=setInterval(()=>{
      const silentFor=(Date.now()-lastSpeechTimeRef.current)/1000;
    if(silentFor>=20&&!aiPausedForSuggestion&&activeSeminarMode==="demo"&&!aiVoice.isSpeaking){
        triggerAISuggestionRef.current();
      }
    },3000);
    return()=>{if(stuckCheckRef.current)clearInterval(stuckCheckRef.current);};
  },[activeSeminarMode,demoMode,demoRunning,aiPausedForSuggestion]);

  useEffect(()=>{
    if(showHelpPrompt){
      setAiPausedForSuggestion(true);
      return;
    }
    if(!resumeCountdown){
      setAiPausedForSuggestion(false);
    }
  },[resumeCountdown,showHelpPrompt]);

  useEffect(()=>{
    if(!micOn){
      manualSpeakRequestedRef.current = false;
    }
  },[micOn]);

  useEffect(()=>{
    if(isPracticeMode && activePanel !== "chat"){
      setActivePanel("chat");
    }
  },[activePanel, isPracticeMode]);

 function triggerAISuggestion(){
    if(speechRecorderRef.current){
      stopSpeechCapture("help-prompt");
    }
    setDemoRunning(false);
    timer.pause();
    setAiPausedForSuggestion(true);
    setAiSuggestion(true);
    setPendingGuideTranscript(latestTranscriptHistoryRef.current.join("\n"));
  }

  triggerAISuggestionRef.current = triggerAISuggestion;

  function handleAISuggestionDismiss(){
    setAiSuggestion(null);
    setAiPausedForSuggestion(false);
    setPendingGuideTranscript("");
    setDemoRunning(true);
    timer.resume();
    lastSpeechTimeRef.current = Date.now();
    micPreferenceRef.current = true;
    beginSpeechCapture();
  }

  function handleManualResume(){
    if(resumeCountdownRef.current)clearInterval(resumeCountdownRef.current);
    setResumeCountdown(0);
    setAiSuggestion(null);
    setAiPausedForSuggestion(false);
    setDemoRunning(true);
    timer.resume();
    lastSpeechTimeRef.current=Date.now();
    setMessages(m=>[...m,{from:"system",text:"▶ Session resumed — continue your presentation"}]);
    toast$("▶ Session resumed","success");
  }

  function addNote(q, a){
    setNoteCount(c=>{
      const newC = c + 1;
      setNotes(prev=>[{id:newC, n:newC, q, a, open:false}, ...prev]);
      return newC;
    });
  }

  function getAIReply(q){
    const lower=q.toLowerCase();
    if(lower.includes("ready")||lower.includes("perfect")||lower.includes("skip"))return "APPROVE_FILE_CMD";
    if(lower.includes("outline")||lower.includes("structure"))return AI_RESPONSES.outline;
    if(lower.includes("question")||lower.includes("audience"))return AI_RESPONSES.questions;
    if(lower.includes("example")||lower.includes("evidence"))return AI_RESPONSES.examples;
    if(lower.includes("script")||lower.includes("opening"))return AI_RESPONSES.script;
    if(lower.includes("feedback")||lower.includes("demo")||lower.includes("how am i"))return AI_RESPONSES.feedback;
    
    if(demoMode && setupPhase === "session") {
       return `Based on your PDF, you should consider elaborating on the core concepts here. Keep going, you're doing great!`;
    }
    return `For "${config.topic}":\n\n1. Ground your argument in peer-reviewed evidence\n2. Use a real-world case study relevant to ${config.subject||"your subject"}\n3. Anticipate objections and address them proactively\n4. End with a clear, memorable closing statement\n\nWould you like me to draft any specific section?`;
  }

  async function sendAIRequest(text=aiInput){
  const q=text.trim();if(!q)return;
    setMessages(m=>[...m,{from:"me",text:q}]);setAiInput("");setIsAITyping(true);setExchanges(x=>x+1);
    try{
      const response = await respondSeminar({ sessionId, message: q });
      const reply = response?.ai_response || response?.response || response?.reply || response?.message || response?.guidance || response?.answer;
      if(reply){
        setMessages(m=>[...m,{from:"ai",text:reply}]);
        addNote(q.length>55?`${q.slice(0,55)}…`:q,reply);
        setExchanges(x=>x+1);
      } else {
        toast$("The seminar AI did not return a reply.","warn");
      }
    } catch(error){
      toast$(getErrorMessage(error, "Unable to reach the seminar AI right now."),"error");
    } finally {
      setIsAITyping(false);
    }
  }

  function sendAI(text=aiInput){
    const q=text.trim();if(!q)return;
    setMessages(m=>[...m,{from:"me",text:q}]);setAiInput("");setIsAITyping(true);setExchanges(x=>x+1);
    setTimeout(()=>{
      const reply=getAIReply(q);
      setIsAITyping(false);
      setMessages(m=>[...m,{from:"ai",text:reply}]);
      addNote(q.length>55?q.slice(0,55)+"…":q,reply);
       setExchanges(x=>x+1);
    },900+Math.random()*400);
  }

  function handleChatOption(action) {
    if (action === "tutoring") {
      setChatOptions([]);
      setMessages(m=>[...m, {from:"me", text:"Show me how to present step-by-step."}, {from:"ai", text:"Here are the steps to present effectively:\n1. Hook your audience with a strong opening.\n2. Introduce the core topic clearly.\n3. Present your points with evidence.\n4. Conclude with a memorable statement.\n\nNow, do you want to prepare your presentation file, or go straight to the seminar session?"}]);
      setChatOptions([
         {label: "Prepare Presentation File", action: "prepare_file"},
         {label: "Take to Seminar Session", action: "go_session"}
      ]);
      
    } else if (action === "prepare_file") {
      setChatOptions([{label: "Take to Seminar Session", action: "go_session"}]);
      setSetupPhase("preparing");
      setMessages(m=>[...m, {from:"me", text:"I want to prepare my presentation file."}, {from:"ai", text:"Great! Let's prepare your presentation. What is the main theme you want to focus on? You can use the chat or voice to brainstorm with me."}]);
      
    } else if (action === "go_session") {
      setChatOptions([]);
      setSetupPhase("session");
      setMessages(m=>[...m, {from:"me", text:"Take me to the seminar session."}, {from:"ai", text:"You are now in the seminar session. The controls at the bottom are unlocked. You can start your demo or present your screen!"}]);
      
      toast$("Seminar Session Controls Unlocked", "success");
    }
  }

  function toggleVoiceAsk(){
    if(voiceListening){voiceAsk.stop();setVoiceListening(false);if(voiceAsk.transcript.trim()){sendAIRequest(voiceAsk.transcript.trim());}toast$("Voice captured","info");}
    else{setVoiceListening(true);voiceAsk.start(finalText=>{voiceAsk.stop();setVoiceListening(false);sendAIRequest(finalText);toast$("Voice sent to AI","success");});toast$("🎙️ Listening — speak your question","info");}
  }

  // ─── SCREEN SHARE / PRESENT ───────────────────────────────────────────────
  async function startPresenting(){
    try {
      await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
      setIsScreenSharing(true);
      setPresentMode(true);
      setPanelOpen(false); // more stage space
      setMessages(m=>[...m,{from:"system",text:"🖥️ Presentation started — AI is now analysing your screen content"},{from:"ai",text:"Your screen is now shared. I'll analyse your presentation layout, slide structure, and provide live coaching tips. Speak naturally and I'll track your delivery too!"}]);
      addNote("Presentation started","AI is now monitoring your screen share for layout, slide flow, and delivery coaching.");
      toast$("🖥️ Presenting — AI analysing your slides","success");
      // Start periodic AI analysis of presentation
      const interval=setInterval(()=>{
        const tip=AI_PRESENTATION_ANALYSIS[Math.floor(Math.random()*AI_PRESENTATION_ANALYSIS.length)];
        setPresentAnalysis(tip);
        // Add to chat every few cycles
        if(Math.random()>0.6){
          setMessages(m=>[...m,{from:"ai",text:`🖥️ ${tip}`}]);
        }
      },8000);
      presentAnalysisRef.current=interval;
    } catch {
      toast$("Screen share cancelled","warn");
    }
  }

  function stopPresenting(){
    setIsScreenSharing(false);
    setPresentMode(false);
    setPresentAnalysis("");
    if(presentAnalysisRef.current)clearInterval(presentAnalysisRef.current);
    setMessages(m=>[...m,{from:"system",text:"🖥️ Presentation ended"},{from:"ai",text:"Presentation session ended. Would you like a summary of coaching notes, or shall we review your delivery feedback?"}]);
    toast$("Screen share ended","info");
  }

  // ─── Demo Mode ────────────────────────────────────────────────────────────
  function enterDemoReadyState(){
    if(timer.isPaused){toast$("Resume session first","warn");return;}
    setDemoReady(true);
    toast$("▶️ Click 'Start Demo Now' to begin your presentation practice","info");
  }

  function actuallyStartDemo(){
    setActionLoader({label: "Uploading File", sublabel: `Analysing presentation file and preparing AI...`});
    setTimeout(() => {
      setActionLoader(null);
      setDemoReady(false);
      setDemoMode(true);setDemoRunning(true);setDemoTimer(0);
      lastSpeechTimeRef.current=Date.now();
      const msg=`Demo mode activated! I have analysed your file. Present your seminar on "${config.topic}" as if to a live audience. I'm analysing: introduction clarity, argument structure, evidence usage, transitions, and closing impact. Speak naturally — go ahead!`;
      setMessages(m=>[...m,{from:"system",text:"▶️ Demo Mode Started — Present now"},{from:"ai",text:msg}]);
      addNote("Demo mode started","I am now evaluating: clarity, structure, evidence, transitions, and closing impact based on your file.");
      aiVoice.speak("Demo mode active. Please begin your presentation.");
      toast$("▶️ Demo started — speak freely","info");
      setPanelOpen(false);
    }, 3000);
  }

  function cancelDemoReady(){setDemoReady(false);}

  function pauseDemo(){
    setDemoRunning(false);
    toast$("⏸ Demo paused","warn");
  }

  function resumeDemo(){
    if(timer.isPaused){toast$("Resume main session first","warn");return;}
    setDemoRunning(true);
    lastSpeechTimeRef.current=Date.now();
    toast$("▶ Demo resumed","success");
  }

  function stopDemo(){
    setDemoMode(false);setDemoRunning(false);
    if(demoIntervalRef.current)clearInterval(demoIntervalRef.current);
    if(stuckCheckRef.current)clearInterval(stuckCheckRef.current);
    setAiSuggestion(null);setAiPausedForSuggestion(false);
    if(resumeCountdownRef.current)clearInterval(resumeCountdownRef.current);
    setResumeCountdown(0);
    const full=transcriptHistory.join(" ");
    const score=70+Math.floor(Math.random()*25);
    const ds=`${String(Math.floor(demoTimer/60)).padStart(2,"0")}:${String(demoTimer%60).padStart(2,"0")}`;
    const fa=`Demo Complete (${ds})\n\n${full.length>20?`Detected: "${full.slice(0,60)}…"\n\n`:""}✅ Confident opening detected\n✅ Main argument identifiable\n⚠️ Add more quantitative evidence\n⚠️ Strengthen your closing\n💡 Score: ${score}/100 — keep practising!`;
    setMessages(m=>[...m,{from:"system",text:"🏁 Demo Complete"},{from:"ai",text:fa}]);
    addNote("Demo feedback",fa);
    setPanelOpen(true);setActivePanel("chat");
    toast$(`🏁 Demo ended — score: ${score}/100`,"success");
  }

  function handlePauseSession(){
    timer.pause();
    if(demoRunning)setDemoRunning(false);
    aiVoice.cancel();speech.stop();
    toast$("⏸ Session paused","warn");
  }

  function handleResumeSession(){
    timer.resume();
    lastSpeechTimeRef.current=Date.now();
    toast$("▶ Session resumed","success");
    if(config.stream){
      speech.start(finalText=>{
        lastSpeechTimeRef.current=Date.now();
        setTranscriptHistory(h=>[...h,finalText].slice(-20));
        setIsStudentSpeaking(true);
        setTimeout(()=>setIsStudentSpeaking(false),1800);
      });
    }
  }

  function sendReaction(emoji){setShowReactions(false);const k=Date.now();setReaction({emoji,k});setTimeout(()=>setReaction(null),2400);}

  function handleDownloadPDF(){
    downloadSessionPDF({config,timer:timer.display,transcriptHistory,notes,messages});
    toast$("📥 Report downloaded!","success");
  }

  function handleEnd(){
    speech.stop();voiceAsk.stop();aiVoice.cancel();
    if(demoIntervalRef.current)clearInterval(demoIntervalRef.current);
    if(stuckCheckRef.current)clearInterval(stuckCheckRef.current);
    if(resumeCountdownRef.current)clearInterval(resumeCountdownRef.current);
    if(presentAnalysisRef.current)clearInterval(presentAnalysisRef.current);
    if(config.stream&&typeof config.stream.getTracks==="function")config.stream.getTracks().forEach(t=>t.stop());
    onEnd({modeType:"prepare",timer:timer.display,topic:config.topic,subject:config.subject,unit:config.unit,participants:1,exchanges,presenterName:config.name,transcriptHistory,notes,messages});
  }

  async function actuallyStartDemoLive(){
    if(!demoFile){
      toast$("Upload a PDF or PPT file before starting demo mode.","warn");
      return;
    }
    if(!config.unitId){
      toast$("Unit information is missing for demo mode.","error");
      return;
    }
    const candidate = getCandidateContext({ firstName: config.name || "Guest", lastName: "" });
    setActionLoader({label:"Preparing Demo", sublabel:`Analysing ${demoFile.name} and launching AI demo...`});
    try{
      const selectedUnit = null;
      const response = await startSeminar({
        unitId: config.unitId,
        candidateId: candidate.candidateId,
        candidateName: candidate.candidateName,
        topic: config.topic,
        subject: selectedUnit?.subject || config.subject,
        unitNumber: selectedUnit?.unitNumber ?? undefined,
        board: selectedUnit?.board || undefined,
        classNumber: selectedUnit?.standard || undefined,
        unitName: selectedUnit?.unitTitle || selectedUnit?.unitLabel || config.unit,
        mode: "demo",
        session_mode: "demo",
        file: demoFile,
      });
      setActionLoader(null);
      setDemoReady(false);
      setDemoMode(true);
      setDemoRunning(true);
      setDemoTimer(0);
      setActiveSeminarMode("demo");
      const nextSessionId = response?.session_id || response?.sessionId || sessionId;
      setSessionId(nextSessionId);
      lastSpeechTimeRef.current = Date.now();
      const msg =
        response?.ai_greeting ||
        response?.message ||
        response?.opening_statement ||
        `Demo mode activated for "${config.topic}". Begin your seminar when you are ready.`;
      setMessages(m=>[...m,{from:"system",text:"▶️ Demo Mode Started — Present now"},{from:"ai",text:msg}]);
      addNote("Demo mode started",`Source file: ${demoFile.name}`);
speakAiReply(msg,{ resumeCapture: true });
            speakAiReply(msg,{ resumeCapture: true });
      micPreferenceRef.current = true;
      setMicOn(true);
      toast$("▶️ Demo started — speak freely","info");
      setPanelOpen(false);
    } catch(error){
      setActionLoader(null);
      toast$(getErrorMessage(error, "Unable to start demo mode right now."),"error");
    }
  }

  function pauseDemoLive(){
    setDemoRunning(false);
    if(speechRecording){
      stopSpeechCapture("manual-submit");
    }
    toast$("⏸ Demo paused","warn");
  }

  function resumeDemoLive(){
    if(timer.isPaused){toast$("Resume main session first","warn");return;}
    setDemoRunning(true);
    lastSpeechTimeRef.current=Date.now();
    toast$("▶ Demo resumed","success");
  }

  function stopDemoLive(){
    setDemoMode(false);
    setDemoRunning(false);
    if(speechRecording){
      stopSpeechCapture("manual-submit");
    }
    if(demoIntervalRef.current)clearInterval(demoIntervalRef.current);
    if(stuckCheckRef.current)clearInterval(stuckCheckRef.current);
    setAiSuggestion(null);
    setAiPausedForSuggestion(false);
    if(resumeCountdownRef.current)clearInterval(resumeCountdownRef.current);
    setResumeCountdown(0);
    setMessages(m=>[...m,{from:"system",text:"🏁 Demo practice complete"},{from:"ai",text:"Your demo practice is complete. Use End Call when you want GradeUp AI to generate the final session feedback."}]);
    setPanelOpen(true);
    setActivePanel("chat");
    toast$("🏁 Demo complete — end the call for final feedback","success");
  }

  function handlePauseSessionLive(){
    timer.pause();
    if(demoRunning)setDemoRunning(false);
    aiVoice.cancel();
    if(speechRecording){
      stopSpeechCapture("manual-submit");
    }
    toast$("⏸ Session paused","warn");
  }

  function handleResumeSessionLive(){
    timer.resume();
    lastSpeechTimeRef.current=Date.now();
    toast$("▶ Session resumed","success");
  }

  async function requestSeminarHelp(){
    if(!sessionId || requestingGuide) return;
    setRequestingGuide(true);
    setShowHelpPrompt(false);
    setAiPausedForSuggestion(false);
    setGuideStatusText("AI is ready to help. Please wait...");
    const transcript = pendingGuideTranscript || transcriptHistory.join("\n");
    try{
      const response = transcript
        ? await respondSeminar({ sessionId, transcript, silenceSeconds: activeSeminarMode === "practice" ? 120 : 10 })
        : await guideSeminar(sessionId);
      const guideText = response?.ai_response || response?.guidance || response?.message || response?.response || response?.reply;
      if(!guideText){
        throw new Error("No guidance was returned.");
      }
      setMessages(m=>[...m,{from:"ai",text:guideText}]);
      setExchanges(x=>x+1);
        setGuideStatusText("");
      setPendingGuideTranscript("");
      setAiSuggestion(null);
      setDemoRunning(true);
      timer.resume();
      lastSpeechTimeRef.current = Date.now();
      speakAiReply(guideText,{ resumeCapture: true });
    } catch(error){
      setGuideStatusText("");
      toast$(getErrorMessage(error, "Unable to fetch seminar guidance."),"error");
    } finally {
      setRequestingGuide(false);
    }
  }

  async function handleEndSession(){
    if(endingSession) return;
    setEndingSession(true);
    voiceAsk.stop();
    aiVoice.cancel();
    if(demoIntervalRef.current)clearInterval(demoIntervalRef.current);
    if(stuckCheckRef.current)clearInterval(stuckCheckRef.current);
    if(resumeCountdownRef.current)clearInterval(resumeCountdownRef.current);
    if(presentAnalysisRef.current)clearInterval(presentAnalysisRef.current);
    if(speechRecording){
      stopSpeechCapture("manual-submit");
    }
    cleanupSpeechDetection();
    if(config.stream&&typeof config.stream.getTracks==="function")config.stream.getTracks().forEach(t=>t.stop());
    let endResponse = null;
    try{
      if(sessionId){
        endResponse = await endSeminarWithTranscript({
          sessionId,
          transcript: transcriptHistory.join("\n"),
        });
      }
    } catch(error){
      toast$(getErrorMessage(error, "Unable to end the seminar cleanly."),"error");
    }
    const endScores = endResponse?.scores || endResponse?.data?.scores || endResponse?.data?.feedback?.scores || {};
    const endSession = endResponse?.liveSession || endResponse?.data?.liveSession || {};
    onEnd({
      modeType:"prepare",
      sessionId,
      timer:timer.display,
      topic: config.topic || endSession?.topic,
      subject: config.subject || endSession?.subject,
      unit: config.unit || endSession?.unit,
      participants:1,
      exchanges,
      presenterName: config.name || endSession?.hostCandidateName,
      transcriptHistory,
      notes,
      messages,
      scores: endScores,
      topicsCovered: endResponse?.topics_covered || endResponse?.data?.topics_covered || [],
      hintsUsed: endResponse?.hints_used ?? endResponse?.data?.hints_used ?? 0,
      turns: endSession?.turns || [],
      feedback: endScores,
      canViewFeedback: true,
    });
  }

  const demoTimerStr=`${String(Math.floor(demoTimer/60)).padStart(2,"0")}:${String(demoTimer%60).padStart(2,"0")}`;
  const presenterColor=avColor(config.name);
  const isAiPaused=aiPausedForSuggestion||resumeCountdown>0;

  return (
    <div className="prep-page">
      {actionLoader && <PageLoader label={actionLoader.label} sublabel={actionLoader.sublabel} steps={[]} />}
      {/* TOP BAR */}
      <div className="prep-bar">
        <button className="prep-bar-logo"><div className="prep-bar-logo-ic">🎓</div><span>SeminarArena</span></button>
        <div className="prep-bar-div"/>
        <div className="prep-bar-topic"><strong>{config.subject&&`${config.subject}${config.unit?` · ${config.unit}`:""} · `}</strong>{config.topic}</div>
        {demoMode&&<div className={`prep-pill ${demoRunning?"pp-demo":"pp-paused"}`}>{demoRunning?`▶️ DEMO ${demoTimerStr}`:`⏸ DEMO PAUSED ${demoTimerStr}`}</div>}
        {isScreenSharing&&!demoMode&&<div className="prep-pill" style={{background:"rgba(229,62,62,.12)",borderColor:"rgba(229,62,62,.22)",color:"var(--red)",animation:"recBlink 1.4s infinite"}}>🖥️ PRESENTING</div>}
        {!demoMode&&!isScreenSharing&&<div className="prep-pill pp-mode">🤖 AI Coach</div>}
        <div className={`prep-pill ${timer.isPaused?"pp-paused":"pp-timer"}`}>{timer.isPaused?"⏸ PAUSED":timer.display}</div>
        {!isPracticeMode&&<button className="prep-bar-end" onClick={()=>setShowEnd(true)}>End</button>}
      </div>

      {/* AI auto-paused banner */}
      {isAiPaused&&(
        <div className="ai-pause-banner">
          <span style={{fontSize:16}}>🤖</span>
          <span className="ai-pause-banner-text">
            {resumeCountdown>0
              ?`AI paused your session — resuming in ${resumeCountdown}s…`
              :"Session paused by AI — review the suggestion in chat"}
          </span>
          <button className="ai-pause-resume-btn" onClick={handleManualResume}>▶ Resume Now</button>
        </div>
      )}

      {(isGreetingPending || isAiResponsePending || aiVoice.isSpeaking || setupPhase === "session") && (
        <div style={{margin:"0 18px 10px",padding:"12px 16px",borderRadius:14,background:(isGreetingPending || isAiResponsePending)?"linear-gradient(135deg,rgba(45,156,219,.16),rgba(0,195,122,.12))":"rgba(255,255,255,.04)",border:(isGreetingPending || isAiResponsePending)?"1px solid rgba(126,211,247,.28)":"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",gap:12,boxShadow:"var(--sh2)"}}>
          <div style={{width:34,height:34,borderRadius:"50%",display:"grid",placeItems:"center",background:(isGreetingPending || isAiResponsePending)?"rgba(126,211,247,.14)":"rgba(0,195,122,.12)",color:(isGreetingPending || isAiResponsePending)?"#7ed3f7":"#5ee3b7",fontSize:16,fontWeight:900}}>
            {greetingState === "speaking" ? "AI" : (isGreetingPending || isAiResponsePending) ? "…" : "🎤"}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:800,color:"#fff"}}>
              {greetingState === "speaking" ? "AI greeting in progress" : isGreetingPending ? "Connecting to AI speaker" : isAiResponsePending ? "Preparing AI response" : "Microphone status"}
            </div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.68)",lineHeight:1.5}}>{micStatusText}</div>
          </div>
          {(isGreetingPending || isAiResponsePending || aiVoice.isSpeaking) && <SoundAnalyser active color={greetingState === "speaking" ? "#7ed3f7" : "#5ee3b7"} bars={4} size={18}/>}
        </div>
      )}
      {/* MAIN BODY */}
      <div className={`prep-body ${panelOpen?"panel-open":"panel-closed"}`}>
        <div className="prep-main-area">

          {/* ─── STAGE: Present Mode (big screen + strip) ─── */}
          {presentMode ? (
            <div className="prep-presenter-stage">
              <div className="prep-ss-area">
                {isScreenSharing?(
                  <>
                    <div className="prep-ss-active-label">
                      <div className="prep-ss-active-dot"/>
                      Screen Sharing Active — AI Analysing
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12,color:"rgba(255,255,255,.35)"}}>
                      <span style={{fontSize:52}}>🖥️</span>
                      <span style={{fontSize:13,fontWeight:700}}>Your screen is being shared</span>
                      <span style={{fontSize:11,color:"rgba(255,255,255,.25)",textAlign:"center",maxWidth:260,lineHeight:1.6}}>AI is monitoring your presentation layout, slide flow, and delivery.</span>
                    </div>
                    {/* AI analysis overlay */}
                    {presentAnalysis&&(
                      <div className="ai-analysis-overlay">
                        <div className="aao-label"><div className="aao-dot"/>AI Presentation Coach</div>
                        <div className="aao-text">{presentAnalysis}</div>
                      </div>
                    )}
                  </>
                ):(
                  <div className="prep-ss-placeholder">
                    <div style={{fontSize:52,opacity:.18}}>🖥️</div>
                    <div style={{fontSize:13,fontWeight:700}}>No screen shared yet</div>
                    <button style={{marginTop:14,padding:"9px 20px",borderRadius:10,background:"var(--grad)",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,color:"#fff"}} onClick={startPresenting}>
                      🖥️ Start Screen Share
                    </button>
                  </div>
                )}
                {/* Demo badge on presenter mode */}
                {demoMode&&!demoReady&&(
                  <div className="prep-demo-badge">
                    <div className="prep-demo-badge-dot" style={{animationPlayState:demoRunning?"running":"paused"}}/>
                    <span className="prep-demo-badge-text">⏺ {demoRunning?`DEMO ${demoTimerStr} — AI Analysing`:`DEMO PAUSED ${demoTimerStr}`}</span>
                  </div>
                )}
                {/* Paused overlay */}
                {timer.isPaused&&!isAiPaused&&(
                  <div className="paused-overlay">
                    <div className="paused-badge"><span style={{fontSize:20}}>⏸</span> Session Paused</div>
                    <div className="paused-sub">Your session is paused. Resume to continue.</div>
                    <button className="paused-resume-btn" onClick={handleResumeSessionLive}>▶ Resume Session</button>
                  </div>
                )}
                {/* AI stuck banner */}
                           {aiSuggestion&&!resumeCountdown&&(
                  <div className="ai-suggestion-banner" style={{flexDirection:"column",gap:10,minWidth:300}}>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <div className="ai-icon">🤖</div>
                      <div className="ai-content">
                        <div className="ai-label">AI Coach — You seem stuck</div>
                        <div className="ai-text">You've been silent for a while. Need help with your next point?</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                      <button className="ai-close" style={{width:"auto",padding:"4px 12px",fontSize:11,fontWeight:700}} onClick={handleAISuggestionDismiss}>Resume</button>
                      <button style={{padding:"4px 14px",borderRadius:6,border:"none",background:"rgba(255,255,255,.9)",color:"#030a14",fontSize:11,fontWeight:800,cursor:"pointer"}} onClick={requestSeminarHelp} disabled={requestingGuide}>{requestingGuide?"Preparing…":"Help me"}</button>
                    </div>
                  </div>
                )}
                {/* Countdown */}
                {resumeCountdown>0&&(
                  <div className="ai-suggestion-banner" style={{background:"linear-gradient(135deg,rgba(0,195,122,.92),rgba(45,156,219,.9))"}}>
                    <div className="ai-icon">▶</div>
                    <div className="ai-content">
                      <div className="ai-label">Resuming in…</div>
                      <div className="ai-text" style={{fontSize:20,fontWeight:900}}>{resumeCountdown}s — get ready to continue</div>
                    </div>
                    <button className="ai-close" onClick={handleManualResume}>✓</button>
                  </div>
                )}
                {/* Reaction */}
                {reaction&&<div key={reaction.k} style={{position:"absolute",top:"40%",left:"50%",transform:"translate(-50%,-50%)",fontSize:44,animation:"rPop 2s forwards",pointerEvents:"none",zIndex:7}}>{reaction.emoji}</div>}
                {/* Panel toggle */}
                <button className="panel-toggle-fab" onClick={()=>setPanelOpen(p=>!p)}>{panelOpen?"›":"‹"}</button>
              </div>

              {/* Participant strip at bottom */}
              <div className="prep-strip">
                {/* You tile */}
                <div className={`prep-strip-tile${isStudentSpeaking&&!timer.isPaused?" speaking":""}`}>
                  <div className="prep-strip-av" style={{width:36,height:36,fontSize:14,background:`${presenterColor}22`,color:presenterColor}}>{avInit(config.name)}</div>
                  {isStudentSpeaking&&!timer.isPaused&&<div style={{position:"absolute",top:5,right:5}}><SoundAnalyser active color="#5ee3b7" bars={4} size={14}/></div>}
                  <div className="prep-strip-ov">
                    <span className="prep-strip-name">{config.name}</span>
                    <span style={{fontSize:9,background:"rgba(0,195,122,.85)",color:"#000",padding:"1px 5px",borderRadius:3,fontWeight:800}}>YOU</span>
                  </div>
                </div>
                {/* AI tile */}
                <div className={`prep-strip-tile${aiVoice.isSpeaking&&!timer.isPaused?" speaking-ai":""}`}>
                  <div style={{fontSize:20}}>🤖</div>
                  {aiVoice.isSpeaking&&!timer.isPaused&&<div style={{position:"absolute",top:5,right:5}}><SoundAnalyser active color="#7ed3f7" bars={4} size={14}/></div>}
                  <div className="prep-strip-ov">
                    <span className="prep-strip-name">AI Coach</span>
                    <span style={{fontSize:9,background:"rgba(45,156,219,.85)",color:"#000",padding:"1px 5px",borderRadius:3,fontWeight:800}}>AI</span>
                  </div>
                </div>
              </div>

              {/* Live transcript bar in present mode */}
              {!timer.isPaused&&(liveTranscript||transcriptHistory.length>0)&&(
                <div className="live-transcript-bar">
                  <div className="lt-label"><div className="lt-dot"/>Live Voice</div>
                  <div className="lt-text">{liveTranscript||transcriptHistory[transcriptHistory.length-1]||""}</div>
                </div>
              )}
            </div>
          ) : (
            /* ─── STAGE: Normal 2-tile mode ─── */
            <div className="prep-stage">
              <div className="prep-tiles-grid" style={{marginTop: "auto"}}>
                {/* You tile */}
                <div className={`prep-tile${isStudentSpeaking&&!timer.isPaused?" speaking":""}`}>
                  <div className="prep-tile-you-badge">YOU</div>
                  <div className="prep-tile-av" style={{background:`${presenterColor}22`,color:presenterColor}}>{avInit(config.name)}</div>
                  <div className="prep-tile-name">{config.name}</div>
                  <div className="prep-tile-role">Student · Presenter</div>
                  {isStudentSpeaking&&!timer.isPaused&&(
                    <div className="prep-tile-analyser"><SoundAnalyser active color="#5ee3b7" bars={5} size={14}/></div>
                  )}
                  {!micOn&&<div className="prep-tile-muted">🔇</div>}
                </div>
                {/* AI tile */}
                <div className={`prep-tile${aiVoice.isSpeaking&&!timer.isPaused?" speaking-ai":""}`}>
                  <div className="prep-tile-ai-badge">AI</div>
                  <div className="prep-tile-ai-icon">🤖</div>
                  <div className="prep-tile-name">AI Coach</div>
                  <div className="prep-tile-role">Powered by GradeUp</div>
                  {aiVoice.isSpeaking&&!timer.isPaused&&(
                    <div className="prep-tile-analyser"><SoundAnalyser active color="#7ed3f7" bars={5} size={14}/></div>
                  )}
                  {isAITyping&&!aiVoice.isSpeaking&&!timer.isPaused&&(
                    <div className="prep-tile-typing">{[0,1,2].map(i=><div key={i} className="prep-tile-typing-dot" style={{animationDelay:`${i*.22}s`}}/>)}</div>
                  )}
                </div>
              </div>

              {/* Demo READY overlay */}
              {demoReady&&(
                <div className="demo-ready-banner">
                  <div className="demo-ready-inner">
                    <div className="demo-ready-icon">▶️</div>
                    <div className="demo-ready-title">Ready to Demo?</div>
                    <div className="demo-ready-desc" style={{marginBottom: 15}}>
                      Upload your presentation file first, then tap "Start Demo Now". The timer will begin and AI will analyse your live presentation of:<br/>
                      <strong style={{color:"#5ee3b7"}}>"{config.topic}"</strong><br/>
                      Speak naturally — deliver your seminar as if to a real audience.
                    </div>
                    
                    <div style={{background:"rgba(0,0,0,.2)", padding: "12px", borderRadius: "8px", marginBottom: "15px", border: "1px solid rgba(255,255,255,.1)"}}>
                       <div style={{fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.7)", marginBottom: 8, textAlign: "left"}}>1. Upload File (Required)</div>
                       <input type="file" accept=".pdf,.ppt,.pptx" onChange={e => {
                           if(e.target.files && e.target.files[0]) setDemoFile(e.target.files[0]);
                       }} style={{width: "100%", padding: "10px", background: "rgba(255,255,255,.05)", border: "1px dashed rgba(255,255,255,.2)", borderRadius: "8px", color: "white", fontSize: 13}} />
                       {demoFile && <div style={{marginTop: 8, fontSize: 12, color: "#5ee3b7", textAlign: "left"}}>✅ Selected: {demoFile.name}</div>}
                    </div>

                    <button className="demo-start-btn" onClick={actuallyStartDemoLive} disabled={!demoFile} style={{opacity: demoFile ? 1 : 0.5}}>
                      <span>▶️</span> Start Demo Now
                    </button>
                    <div style={{marginTop:10}}>
                      <button onClick={cancelDemoReady} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.4)",fontSize:11,fontWeight:600,fontFamily:"var(--font)"}}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Demo running badge */}
              {demoMode&&!demoReady&&(
                <div className="prep-demo-badge">
                  <div className="prep-demo-badge-dot" style={{animationPlayState:demoRunning?"running":"paused"}}/>
                  <span className="prep-demo-badge-text">⏺ {demoRunning?`DEMO ${demoTimerStr} — AI Analysing`:`DEMO PAUSED ${demoTimerStr}`}</span>
                </div>
              )}

              {/* Paused overlay */}
              {timer.isPaused&&!isAiPaused&&(
                <div className="paused-overlay">
                  <div className="paused-badge"><span style={{fontSize:20}}>⏸</span> Session Paused</div>
                  <div className="paused-sub">Your session is paused. Resume to continue from where you left off.</div>
                  <button className="paused-resume-btn" onClick={handleResumeSessionLive}>▶ Resume Session</button>
                </div>
              )}

              {/* AI stuck suggestion banner */}
             {aiSuggestion&&!resumeCountdown&&(
                <div className="ai-suggestion-banner" style={{flexDirection:"column",gap:10,minWidth:300}}>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    <div className="ai-icon">🤖</div>
                    <div className="ai-content">
                      <div className="ai-label">AI Coach — You seem stuck</div>
                      <div className="ai-text">You've been silent for a while. Need help with your next point?</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                    <button className="ai-close" style={{width:"auto",padding:"4px 12px",fontSize:11,fontWeight:700}} onClick={handleAISuggestionDismiss}>Resume</button>
                    <button style={{padding:"4px 14px",borderRadius:6,border:"none",background:"rgba(255,255,255,.9)",color:"#030a14",fontSize:11,fontWeight:800,cursor:"pointer"}} onClick={requestSeminarHelp} disabled={requestingGuide}>{requestingGuide?"Preparing…":"Help me"}</button>
                  </div>
                </div>
              )}

              {/* Countdown */}
              {resumeCountdown>0&&(
                <div className="ai-suggestion-banner" style={{background:"linear-gradient(135deg,rgba(0,195,122,.92),rgba(45,156,219,.9))"}}>
                  <div className="ai-icon">▶</div>
                  <div className="ai-content">
                    <div className="ai-label">Resuming in…</div>
                    <div className="ai-text" style={{fontSize:20,fontWeight:900}}>{resumeCountdown}s — get ready to continue</div>
                  </div>
                  <button className="ai-close" onClick={handleManualResume}>✓</button>
                </div>
              )}

              {/* Reaction */}
              {reaction&&<div key={reaction.k} style={{position:"absolute",top:"40%",left:"50%",transform:"translate(-50%,-50%)",fontSize:44,animation:"rPop 2s forwards",pointerEvents:"none",zIndex:7}}>{reaction.emoji}</div>}

              {/* Live Transcript */}
              {!timer.isPaused&&(
                <div className="prep-live-transcript">
                  <div className="plt-label"><div className="plt-dot"/>Live Voice Transcript</div>
                  <div className="plt-text">
                    {liveTranscript?<>{liveTranscript}<span className="plt-cursor"/></>
                      :transcriptHistory.length>0?<>{transcriptHistory[transcriptHistory.length-1]}<span className="plt-cursor"/></>
                      :<span className="plt-empty">Start speaking to see your live transcript…</span>}
                  </div>
                </div>
              )}

              {/* Panel toggle fab */}
              <button className="panel-toggle-fab" onClick={()=>setPanelOpen(p=>!p)} title={panelOpen?"Close panel":"Open panel"}>
                {panelOpen?"›":"‹"}
              </button>
            </div>
          )}

          {/* CTRL BAR */}
          {setupPhase === "session" && (
          <div className="prep-ctrl-bar">
            <div className="prep-ctrl-user-info">
              <div className="prep-ctrl-av" style={{background:`${presenterColor}22`,color:presenterColor}}>{avInit(config.name)}</div>
              <div className="prep-ctrl-details">
                <div className="prep-ctrl-name">{config.name}</div>
                <div className="prep-ctrl-sub">{config.subject}{config.unit?` · ${config.unit}`:""}</div>
              </div>
            </div>

        <div className="prep-ctrl-center">
  {!isPracticeMode && (
    <div style={{ position: "relative" }}>
      <button
        className={`cbtn${showReactions ? " hi" : ""}`}
        onClick={() => setShowReactions((r) => !r)}
      >
        <span className="cbtn-ic">😊</span>
        <span>React</span>
      </button>

      {showReactions && (
        <div className="react-pop">
          {REACTIONS.map((r) => (
            <button
              key={r}
              className="react-em"
              onClick={() => sendReaction(r)}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  )}

  <button
    className={`cbtn ${micOn ? "on" : "off"}`}
    disabled={isGreetingPending || aiVoice.isSpeaking || speechProcessing}
    onClick={handleMicButtonClick}
  >
    <span className="cbtn-ic">{micOn ? "🎤" : "🔇"}</span>
    <span>{micOn ? "Mute Mic" : "Unmute Mic"}</span>
  </button>

  {/* Mic */}
  {!isPracticeMode && (
    <button
      className={`cbtn ${speechRecording ? "on" : micOn ? "hi" : "off"}`}
      disabled={
        isGreetingPending ||
        !micOn ||
        aiVoice.isSpeaking ||
        speechProcessing ||
        timer.isPaused
      }
      onClick={() => {
        if (isGreetingPending) {
          toast$("Please wait until the AI greeting finishes.", "info");
          return;
        }

        if (speechRecording) {
          manualSpeakRequestedRef.current = false;
          stopSpeechCapture("manual-submit");
          toast$("Speech captured and sent to AI.", "info");
          return;
        }

        if (!micOn) {
          toast$("Unmute the microphone first.", "warn");
          return;
        }

        if (aiVoice.isSpeaking) {
          toast$("Please wait until AI finishes speaking.", "info");
          return;
        }

        if (timer.isPaused) {
          toast$("Resume session first.", "warn");
          return;
        }

        manualSpeakRequestedRef.current = true;
        beginSpeechCapture();
      }}
    >
      <span className="cbtn-ic">{micOn ? "🎤" : "🔇"}</span>
      {speechRecording && isStudentSpeaking && !timer.isPaused ? (
        <div className="cbtn-analyser">
          <SoundAnalyser active color="#5ee3b7" bars={4} size={12} />
        </div>
      ) : (
        <span>{speechRecording ? "Stop Speak" : "Start Speak"}</span>
      )}
    </button>
  )}

  {/* Screen Share / Present Button */}
  {!isPracticeMode &&
    (!presentMode && !isScreenSharing ? (
      <button className="cbtn hi" onClick={startPresenting} disabled={timer.isPaused}>
        <span className="cbtn-ic">🖥️</span>
        <span>Present</span>
      </button>
    ) : (
      <button className="cbtn off" onClick={stopPresenting}>
        <span className="cbtn-ic">⏹</span>
        <span>Stop</span>
      </button>
    ))}

  {/* Demo controls — appear only after demo starts */}
  {!demoMode && !demoReady && (
    <button className="cbtn em" onClick={enterDemoReadyState} disabled={timer.isPaused}>
      <span className="cbtn-ic">▶</span>
      <span>Start Demo</span>
    </button>
  )}

  {demoReady && (
    <button className="cbtn em" onClick={actuallyStartDemoLive}>
      <span className="cbtn-ic">▶</span>
      <span>Start!</span>
    </button>
  )}

  {demoMode && demoRunning && !isAiPaused && (
    <>
      <button className="cbtn pause-btn" onClick={pauseDemoLive}>
        <span className="cbtn-ic">⏸</span>
        <span>Pause</span>
      </button>
      <button className="cbtn rec" onClick={stopDemoLive}>
        <span className="cbtn-ic">🏁</span>
        <span>End Demo</span>
      </button>
    </>
  )}

  {demoMode && !demoRunning && !isAiPaused && (
    <>
      <button className="cbtn em" onClick={resumeDemoLive} disabled={timer.isPaused}>
        <span className="cbtn-ic">▶</span>
        <span>Resume</span>
      </button>
      <button className="cbtn rec" onClick={stopDemoLive}>
        <span className="cbtn-ic">🏁</span>
        <span>Stop</span>
      </button>
    </>
  )}

  {isAiPaused && (
    <button className="cbtn em" onClick={handleManualResume}>
      <span className="cbtn-ic">▶</span>
      <span>Resume</span>
    </button>
  )}
</div>

            <div className="prep-ctrl-right">
               {/* Panel tabs */}
              <button className={`cbtn${activePanel==="chat"&&panelOpen?" hi":""}`} onClick={()=>{setActivePanel("chat");setPanelOpen(true);}}><span className="cbtn-ic">🤖</span><span>Chat</span></button>
              {!isPracticeMode&&<button className={`cbtn${activePanel==="notes"&&panelOpen?" hi":""}`} onClick={()=>{setActivePanel("notes");setPanelOpen(true);}}><span className="cbtn-ic">📋</span><span>Notes</span></button>}
              {!isPracticeMode&&<button className={`cbtn${activePanel==="actions"&&panelOpen?" hi":""}`} onClick={()=>{setActivePanel("actions");setPanelOpen(true);}}><span className="cbtn-ic">⚡</span><span>Quick</span></button>}
              {!isPracticeMode&&<button className="end-room-btn" onClick={()=>setShowEnd(true)}>End</button>}
            </div>
          </div>
          )}
        </div>
        {!panelOpen&&(
          <button
            type="button"
            onClick={()=>{setActivePanel("chat");setPanelOpen(true);}}
            style={{position:"absolute",right:18,bottom:92,zIndex:14,display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:14,border:"1px solid rgba(126,211,247,.24)",background:"rgba(8,14,26,.92)",color:"#fff",fontWeight:800,cursor:"pointer",boxShadow:"0 14px 28px rgba(0,0,0,.28)"}}
            title="Open AI chat"
          >
            <span style={{fontSize:16}}>☰</span>
            <span>Open Chat</span>
          </button>
        )}

        {/* RIGHT SIDE PANEL */}
        {panelOpen&&(
          <div className="prep-side-panel">
            <div className="prep-panel-header">
              <div className="prep-panel-tabs">
                {(isPracticeMode ? [{id:"chat",ic:"🤖",lbl:"AI Chat"}] : [{id:"chat",ic:"🤖",lbl:"AI Chat"},{id:"notes",ic:"📋",lbl:"Notes"},{id:"actions",ic:"⚡",lbl:"Quick"}]).map(t=>(
                  <button key={t.id} className={`prep-ptab${activePanel===t.id?" active":""}`} onClick={()=>setActivePanel(t.id)}>
                    <span style={{fontSize:13}}>{t.ic}</span><span>{t.lbl}</span>
                  </button>
                ))}
              </div>
              <button className="prep-panel-close" onClick={()=>setPanelOpen(false)}>✕</button>
            </div>

            {/* AI CHAT */}
            {activePanel==="chat"&&(
              <div style={{display:"flex",flexDirection:"column",height:"100%",minHeight:0,overflow:"hidden"}}>
                <div className="prep-panel-scroll" style={{flex:1}}>
                  <div className="prep-ai-msgs">
                    {messages.map((m,i)=>{
                      if(m.from==="system")return(<div key={i} style={{display:"flex",justifyContent:"center",width:"100%",marginBottom:4}}><div className="prep-ai-bubble system-style">{m.text}</div></div>);
                      return(<div key={i} className={`prep-ai-msg ${m.from==="ai"?"from-ai":"from-me"}`}>
                        <div className={`prep-ai-bubble-av ${m.from==="ai"?"ai-side":"me-side"}`}>{m.from==="ai"?"🤖":avInit(config.name)}</div>
                        <div className={`prep-ai-bubble ${m.from==="ai"?"ai-style":"me-style"}`} style={{whiteSpace:"pre-line"}}>{m.text}</div>
                      </div>);
                    })}
                    {isAITyping&&<div className="prep-ai-msg from-ai"><div className="prep-ai-bubble-av ai-side">🤖</div><div className="prep-ai-typing">{[0,1,2].map(i=><div key={i} className="prep-ai-typing-dot" style={{animationDelay:`${i*.22}s`}}/>)}</div></div>}
                    
                    {/* Chat Options Row */}
                    {chatOptions.length > 0 && (
                      <div style={{display:"flex", gap: 8, padding: "10px", flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,.07)", marginTop: "10px"}}>
                        {chatOptions.map(opt => (
                           <button key={opt.action} onClick={() => handleChatOption(opt.action)} style={{padding: "8px 14px", borderRadius: 20, background: "rgba(45,156,219,.15)", border: "1px solid rgba(45,156,219,.3)", color: "var(--sky)", fontSize: 12, fontWeight: 700, cursor: "pointer"}}>
                             {opt.label}
                           </button>
                        ))}
                      </div>
                    )}

                    <div ref={chatEndRef}/>
                  </div>
                </div>
                <div className="prep-ai-speaking-row">
                  {aiVoice.isSpeaking?<><SoundAnalyser active color="#7ed3f7" bars={5} size={18}/><span className="prep-ai-speaking-text">AI Coach speaking…</span></>
                    :<span className="prep-ai-speaking-text" style={{color:"rgba(255,255,255,.2)"}}>AI Coach ready</span>}
                </div>
                {!isPracticeMode&&<div className="quick-prompts">
                  {["Outline","Script","Questions","Examples","Feedback"].map(qp=>(
                    <button key={qp} className="quick-p" onClick={()=>sendAIRequest(qp)}>{qp}</button>
                  ))}
                </div>}
                <div className="prep-ai-input-area">
                  {voiceListening&&(
                    <div style={{display:"flex",alignItems:"center",gap:7,padding:"5px 8px",marginBottom:6,borderRadius:8,background:"rgba(229,62,62,.1)",border:"1px solid rgba(229,62,62,.3)"}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:"var(--red)",animation:"recBlink 1s infinite"}}/>
                      <span style={{fontSize:10,fontWeight:700,color:"var(--red)",flex:1}}>Listening… tap mic to send</span>
                      <SoundAnalyser active color="#e53e3e" bars={4} size={14}/>
                    </div>
                  )}
                  <div className="prep-ai-input-row">
                    <button className={`prep-ai-voice-btn${voiceListening?" listening":""}`} onClick={toggleVoiceAsk}>
                      {voiceListening?"⏹":"🎙️"}
                    </button>
                    <textarea className="prep-ai-input" placeholder="Ask AI coach (or use 🎙️ to speak)…" value={voiceListening?(voiceAsk.transcript||""):aiInput}
                      onChange={e=>{if(!voiceListening)setAiInput(e.target.value);}}
                      onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAIRequest();}}}
                      rows={1} readOnly={voiceListening}
                    />
                    <button className="prep-ai-send" onClick={()=>sendAIRequest()} disabled={isAITyping||(!aiInput.trim()&&!voiceListening)}>➤</button>
                  </div>
                </div>
              </div>
            )}

            {/* NOTES */}
            {activePanel==="notes"&&(
              <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
                <div className="prep-notes-header">
                  <span className="prep-notes-title">📋 AI Notes & Q&A</span>
                  <span className="prep-notes-count">{notes.length} notes</span>
                </div>
                <div className="prep-panel-scroll" style={{flex:1}}>
                  {notes.length===0?<div style={{padding:20,textAlign:"center",fontSize:11,color:"rgba(255,255,255,.25)"}}>No notes yet.</div>
                    :<div className="prep-faq-list">{notes.map(note=>(
                      <div key={note.id} className="prep-faq-item">
                        <div className="prep-faq-q" onClick={()=>toggleNote(note.id)}>
                          <div style={{flex:1}}><div className="prep-faq-num">Note {note.n}</div><div className="prep-faq-q-text">{note.q}</div></div>
                          <span className={`prep-faq-chevron${note.open?" open":""}`}>▼</span>
                        </div>
                        {note.open&&<div className="prep-faq-a">{note.a}</div>}
                      </div>
                    ))}</div>
                  }
                </div>
                <div style={{padding:"8px 10px",borderTop:"1px solid rgba(255,255,255,.07)",flexShrink:0}}>
                  <button className="prep-action-btn" style={{marginBottom:0}} onClick={handleDownloadPDF}>📥 Download All Notes</button>
                </div>
              </div>
            )}

            {/* QUICK ACTIONS */}
            {activePanel==="actions"&&(
              <div className="prep-panel-scroll">
                <div className="prep-actions-panel">
                  <div style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:".07em",color:"rgba(255,255,255,.25)",marginBottom:8,paddingBottom:6,borderBottom:"1px solid rgba(255,255,255,.07)"}}>Quick AI Requests</div>
                  {[{ic:"📋",label:"Generate Full Outline",prompt:"Generate a complete seminar outline"},
                    {ic:"📝",label:"Write Opening Script",prompt:"Write an opening script for my seminar"},
                    {ic:"❓",label:"Predict Audience Questions",prompt:"Predict the audience questions I may face"},
                    {ic:"💡",label:"Find Strong Examples",prompt:"Give me strong examples and evidence to use"},
                    {ic:"⚠️",label:"Anticipate Objections",prompt:"What are the main objections to my argument"},
                    {ic:"🔚",label:"Write Closing Statement",prompt:"Write a strong closing statement for my seminar"},
                    {ic:"📊",label:"Add Statistics",prompt:"Suggest key statistics I should include"},
                    {ic:"🔄",label:"Write Transition Lines",prompt:"Give me smooth transition lines between sections"},
                  ].map((a,i)=>(
                    <button key={i} className="prep-action-btn" onClick={()=>{sendAIRequest(a.prompt);setActivePanel("chat");setPanelOpen(true);}}>{a.ic} {a.label}</button>
                  ))}

                  {setupPhase === "session" && (
                    <>
                      <div style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:".07em",color:"rgba(255,255,255,.25)",margin:"12px 0 8px",paddingTop:10,borderTop:"1px solid rgba(255,255,255,.07)"}}>Present / Screen Share</div>
                      {!presentMode&&!isScreenSharing?(
                        <button className="prep-action-btn primary" onClick={startPresenting}>🖥️ Share Screen & Present</button>
                      ):(
                        <button className="prep-action-btn pause-active" onClick={stopPresenting}>⏹ Stop Presenting</button>
                      )}

                      <div style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:".07em",color:"rgba(255,255,255,.25)",margin:"12px 0 8px",paddingTop:10,borderTop:"1px solid rgba(255,255,255,.07)"}}>Demo Controls</div>
                      {!demoMode&&!demoReady&&(
                        <button className="prep-action-btn primary" onClick={()=>enterDemoReadyState()}>▶️ Start Demo</button>
                      )}
                      {demoReady&&(
                        <><button className="prep-action-btn primary" onClick={actuallyStartDemoLive}>▶ Start Demo Now</button>
                        <button className="prep-action-btn" onClick={cancelDemoReady}>✕ Cancel Demo</button></>
                      )}
                      {demoMode&&demoRunning&&!isAiPaused&&(
                        <><button className="prep-action-btn pause-active" onClick={pauseDemoLive}>⏸ Pause Demo</button>
                        <button className="prep-action-btn demo-active" onClick={()=>stopDemoLive()}>🏁 End Demo & Get Feedback</button></>
                      )}
                      {demoMode&&!demoRunning&&!isAiPaused&&(
                        <><button className="prep-action-btn primary" onClick={resumeDemoLive}>▶ Resume Demo</button>
                        <button className="prep-action-btn demo-active" onClick={()=>stopDemoLive()}>🏁 End Demo & Get Feedback</button></>
                      )}
                      {isAiPaused&&(
                        <button className="prep-action-btn primary" onClick={handleManualResume}>▶ Resume Now</button>
                      )}
                    </>
                  )}

                  <div style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:".07em",color:"rgba(255,255,255,.25)",margin:"12px 0 8px",paddingTop:10,borderTop:"1px solid rgba(255,255,255,.07)"}}>Session</div>
                  <button className="prep-action-btn" onClick={handleDownloadPDF}>📥 Download Session Report</button>
                  <button className="prep-action-btn" onClick={()=>setShowAnalysis(true)}>📊 View Performance Report</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showAnalysis&&<AnalysisModal topic={config.topic} subject={config.subject} unit={config.unit} timer={timer.display} exchanges={exchanges} presenterName={config.name} onClose={()=>setShowAnalysis(false)} onDownload={handleDownloadPDF}/>}

      {showEnd&&(
        <div className="overlay" onClick={()=>setShowEnd(false)}>
          <div className="modal" style={{maxWidth:360,background:"#0c1422",border:"1px solid rgba(255,255,255,.1)"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"linear-gradient(135deg,#060e1c,#08180e)",padding:"22px 18px",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:9}}>🏁</div>
              <div style={{fontSize:14,fontWeight:800,color:"#fff",marginBottom:4}}>End preparation session?</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.38)",lineHeight:1.7}}>Duration: <strong style={{color:"#5ee3b7"}}>{timer.display}</strong><br/>{exchanges} AI exchanges · {notes.length} notes saved</div>
            </div>
            <div style={{padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
              <button className="prep-action-btn" style={{marginBottom:0}} onClick={()=>handleDownloadPDF()}>📥 Download Session Report First</button>
            </div>
            <div className="mf" style={{borderColor:"rgba(255,255,255,.08)",background:"#0c1422"}}>
              <button className="btn-s" style={{background:"rgba(255,255,255,.04)",borderColor:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)"}} onClick={()=>setShowEnd(false)}>Keep Going</button>
              <button className="btn-d" onClick={handleEndSession} disabled={endingSession}>{endingSession?"Ending...":"End Session"}</button>
            </div>
          </div>
        </div>
      )}
      {/* {showHelpPrompt&&(
        <div className="overlay" onClick={()=>setShowHelpPrompt(false)}>
          <div className="modal" style={{maxWidth:360,background:"#0c1422",border:"1px solid rgba(255,255,255,.1)"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"linear-gradient(135deg,#060e1c,#081a10)",padding:"22px 18px",textAlign:"center"}}>
              <div style={{fontSize:38,marginBottom:8}}>💡</div>
              <div style={{fontSize:14,fontWeight:800,color:"#fff",marginBottom:4}}>Need help?</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.42)",lineHeight:1.7}}>
                {activeSeminarMode === "demo"
                  ? "You have been silent for a while. Would you like the AI coach to guide your next point?"
                  : "Would you like the AI coach to respond to your latest seminar transcript?"}
              </div>
            </div>
            <div className="mf" style={{borderColor:"rgba(255,255,255,.08)",background:"#0c1422"}}>
                          <button className="btn-s" style={{background:"rgba(255,255,255,.04)",borderColor:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)"}} onClick={()=>{
                setShowHelpPrompt(false);
                setAiPausedForSuggestion(false);
                setPendingGuideTranscript("");
                lastSpeechTimeRef.current = Date.now();
                manualSpeakRequestedRef.current = true;
                beginSpeechCapture();
              }}>Continue</button>
              <button className="btn-p" style={{width:"auto"}} onClick={requestSeminarHelp} disabled={requestingGuide}>
                {requestingGuide ? "Preparing..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      )} */}
      {guideStatusText&&(
        <div style={{position:"fixed",bottom:20,right:20,zIndex:760,maxWidth:320,padding:"11px 14px",borderRadius:12,background:"rgba(16,185,129,.12)",border:"1px solid rgba(16,185,129,.28)",color:"#d1fae5",fontSize:12.5,fontWeight:700,boxShadow:"var(--sh2)"}}>
          {guideStatusText}
        </div>
      )}
      {toastNode}
    </div>
  );
}

// ─── PRESENTER ROOM ───────────────────────────────────────────────────────────
function mapSeminarTurnsToMessages(session, currentUserName = "") {
  const turns = Array.isArray(session?.turns) ? session.turns : [];
  return turns
    .filter((turn) => {
      const type = String(turn?.turnType || "");
      return type === "chat" || type === "chat_response" || type === "greeting" || type === "ai_response";
    })
    .map((turn) => {
      const sender = turn?.speakerName || (turn?.role === "assistant" ? "AI Moderator" : "Participant");
      const own = currentUserName && sender === currentUserName;
      return {
        id: turn?.id || `${sender}-${turn?.createdAt || Date.now()}`,
        sender,
        text: turn?.message || turn?.transcript || "",
        type: turn?.role === "assistant" ? "ai" : own ? "own" : "participant",
        time: turn?.createdAt ? new Date(turn.createdAt).getTime() : Date.now(),
      };
    });
}

function getPendingSeminarSpeakRequests(session) {
  const requests = Array.isArray(session?.metadata?.speakRequests) ? session.metadata.speakRequests : [];
  return requests.filter((item) => item?.status === "pending");
}

function isSeminarParticipantApproved(session, participantId) {
  const participant = (session?.participants || []).find((item) => String(item.id) === String(participantId));
  return participant?.status === "approved_to_speak";
}

function PresenterRoomLegacy({config,onEnd}) {
  const timer=useTimer(true);
  const [panelTab,setPanelTab]=useState(null);
  const [messages,setMessages]=useState([]);const [chatInput,setChatInput]=useState("");
  const [micOn,setMicOn]=useState(true);const [isRecording,setIsRecording]=useState(false);
  const [screenSharing,setScreenSharing]=useState(false);
  const [showEnd,setShowEnd]=useState(false);const [showAnalysis,setShowAnalysis]=useState(false);
  const [showReactions,setShowReactions]=useState(false);const [reaction,setReaction]=useState(null);
  const [exchangeCount,setExchangeCount]=useState(0);const [liveTranscript,setLiveTranscript]=useState("");
  const [aiSummaryLines,setAiSummaryLines]=useState(["Session started — AI Moderator is listening.","Waiting for screen share to begin."]);
  const [aiTyping,setAiTyping]=useState(false);const [observerCount,setObserverCount]=useState(Math.floor(Math.random()*4));
  const [isSpeaking,setIsSpeaking]=useState(false);
  const chatEndRef=useRef(null);const aiIntervalRef=useRef(null);
  const aiVoice=useAIVoice();const speech=useSpeechRecognition();
  const {show:toast$,node:toastNode}=useToast();
  const presenterColor=avColor(config.name);

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  function addMsg(sender,text,type){setMessages(ms=>[...ms,{sender,text,type,time:Date.now()}]);setExchangeCount(c=>c+1);}

  useEffect(()=>{
    if(config.stream&&typeof config.stream.getTracks==="function")speech.start(ft=>{setLiveTranscript(ft);setIsSpeaking(true);setTimeout(()=>{setLiveTranscript("");setIsSpeaking(false);},5000);});
    const intro=`Welcome to your seminar on "${config.topic}"${config.subject?` — ${config.subject}`:""}! I'm your AI Moderator. Share your screen and begin whenever you're ready.`;
    setTimeout(()=>{addMsg("AI Moderator",intro,"ai");setAiTyping(true);setTimeout(()=>{setAiTyping(false);aiVoice.speak(intro.slice(0,120));},600);},1000);
    aiIntervalRef.current=setInterval(()=>{
      if(Math.random()>0.6&&!aiVoice.isSpeaking){const tip=["Excellent point! Let's explore how your audience might counter this.","Building on that — has anyone considered the long-term implications?","Remember to pace yourself — let your key points breathe.","You're covering the topic well. Try to invite questions."][Math.floor(Math.random()*4)];addMsg("AI Moderator",tip,"ai");setAiSummaryLines(l=>[...l,tip].slice(-8));}
      if(Math.random()>0.7)setObserverCount(c=>Math.min(c+1,20));
    },25000);
    return()=>{if(aiIntervalRef.current)clearInterval(aiIntervalRef.current);aiVoice.cancel();speech.stop();if(config.stream&&typeof config.stream.getTracks==="function")config.stream.getTracks().forEach(t=>t.stop());};
  },[]);

  useEffect(()=>{if(speech.transcript){setLiveTranscript(speech.transcript);setIsSpeaking(true);}},[speech.transcript]);

  async function toggleScreen(){
    if(screenSharing){setScreenSharing(false);toast$("🖥 Screen sharing stopped","warn");return;}
    try{await navigator.mediaDevices.getDisplayMedia({video:true});setScreenSharing(true);toast$("🖥 Screen sharing started","success");addMsg("AI Moderator","Screen sharing active. Observers can see your content — begin when ready!","ai");}
    catch{toast$("Screen share cancelled","warn");}
  }

  function sendMsg(text){if(!text.trim())return;addMsg(config.name,text.trim());setChatInput("");}
  function sendReaction(emoji){setShowReactions(false);const k=Date.now();setReaction({emoji,k});setTimeout(()=>setReaction(null),2400);}
  function handleEnd(){
    if(aiIntervalRef.current)clearInterval(aiIntervalRef.current);aiVoice.cancel();speech.stop();
    if(config.stream&&typeof config.stream.getTracks==="function")config.stream.getTracks().forEach(t=>t.stop());
    onEnd({timer,topic:config.topic,subject:config.subject,unit:config.unit,participants:1,exchanges:exchangeCount,presenterName:config.name});
  }
  const fmt=d=>new Date(d).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});

  return (
    <div className="room-page">
      {isRecording&&<div style={{position:"fixed",top:58,right:12,background:"rgba(229,62,62,.9)",borderRadius:7,padding:"3px 10px",fontSize:11,fontWeight:800,color:"#fff",zIndex:200,animation:"recBlink 1.4s infinite",fontFamily:"var(--mono)"}}>⏺ REC {timer}</div>}
      <div className="room-bar">
        <div className="room-logo"><div className="room-logo-ic">🎓</div>SeminarArena</div>
        <div className="room-divider"/>
        <div className="room-topic"><strong>{config.subject&&`${config.subject}${config.unit?` · ${config.unit}`:""} · `}</strong>{config.topic}</div>
        <div className="r-pill rp-timer">{timer}</div>
        {isRecording&&<div className="r-pill rp-rec"><div className="rp-rec-dot"/>REC</div>}
        <div className="r-pill rp-ai">🤖 AI Mod</div>
        <div className="r-pill" style={{background:"rgba(0,195,122,.1)",borderColor:"rgba(0,195,122,.2)",color:"#5ee3b7"}}>👁 {observerCount}</div>
        <button className="rbar-end-btn" onClick={()=>setShowEnd(true)}>✕ End</button>
      </div>
      <div className="room-body">
        <div className="grid-area">
          <div className="ss-area">
            {!screenSharing?(<div className="ss-placeholder"><div style={{fontSize:52,opacity:.18}}>🖥️</div><div style={{fontSize:13,fontWeight:700}}>Screen not shared yet</div><button style={{marginTop:14,padding:"9px 20px",borderRadius:10,background:"var(--grad)",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,color:"#fff"}} onClick={toggleScreen}>🖥️ Start Screen Share</button></div>)
              :(<><div className="ss-active-label"><div className="ss-active-dot"/>Screen Sharing Active · {observerCount} watching</div><div style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>Your screen is shared</div></>)}
            {reaction&&<div key={reaction.k} style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:46,animation:"rPop 2s forwards",pointerEvents:"none",zIndex:5}}>{reaction.emoji}</div>}
          </div>
          <div className="presenter-strip">
            <div className="strip-tile" style={{border:`1.5px solid ${presenterColor}44`}}>
              <div className="strip-av" style={{background:presenterColor+"22",color:presenterColor}}>{avInit(config.name)}</div>
              {isSpeaking&&<div style={{position:"absolute",top:5,right:5}}><SoundAnalyser active color="#5ee3b7" bars={4} size={16}/></div>}
              <div className="strip-ov"><span className="strip-name">{config.name}</span><span style={{fontSize:9}}>{micOn?"🎤":"🔇"}</span></div>
              <div style={{position:"absolute",top:5,left:5,fontSize:9,fontWeight:800,padding:"1px 5px",borderRadius:4,background:"rgba(0,195,122,.85)",color:"#000"}}>YOU</div>
            </div>
            <div className="strip-tile" style={{border:"1.5px solid rgba(45,156,219,.3)"}}>
              <div style={{fontSize:24}}>🤖</div>
              {aiTyping&&<div style={{position:"absolute",top:5,right:5,display:"flex",gap:2}}>{[0,1,2].map(i=><div key={i} style={{width:4,height:4,borderRadius:"50%",background:"#7ed3f7",animation:"dotPulse .8s ease-in-out infinite",animationDelay:`${i*.22}s`}}/>)}</div>}
              <div className="strip-ov"><span className="strip-name">AI Moderator</span><span style={{fontSize:9}}>🎙️</span></div>
              <div style={{position:"absolute",top:5,left:5,fontSize:9,fontWeight:800,padding:"1px 5px",borderRadius:4,background:"rgba(45,156,219,.85)",color:"#000"}}>AI</div>
            </div>
            {observerCount>0&&(<div className="strip-tile"><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{fontSize:20}}>👁️</div><div style={{fontSize:16,fontWeight:900,color:"rgba(255,255,255,.6)"}}>{observerCount}</div></div><div className="strip-ov"><span className="strip-name">Observers</span></div></div>)}
          </div>
          {(speech.isListening||liveTranscript)&&(<div className="live-transcript-bar"><div className="lt-label"><div className="lt-dot"/>Live Transcript</div><div className="lt-text">{liveTranscript||"Listening…"}</div></div>)}
          <div className="ctrl-bar">
            <div className="cg">
              <button className={`cbtn ${micOn?"on":"off"}`} onClick={()=>{const n=!micOn;setMicOn(n);if(config.stream&&typeof config.stream.getTracks==="function"){config.stream.getAudioTracks().forEach(t=>t.enabled=n);}toast$(n?"🎤 Mic enabled":"🔇 Mic muted",n?"info":"warn");}}>
                <span className="cbtn-ic">{micOn?"🎤":"🔇"}</span><span>{micOn?"Mute":"Unmute"}</span>
              </button>
              <button className={`cbtn${screenSharing?" hi":""}`} onClick={toggleScreen}><span className="cbtn-ic">🖥</span><span>{screenSharing?"Stop":"Share"}</span></button>
              <div style={{position:"relative"}}>
                <button className={`cbtn${showReactions?" hi":""}`} onClick={()=>setShowReactions(r=>!r)}><span className="cbtn-ic">😊</span><span>React</span></button>
                {showReactions&&<div className="react-pop">{REACTIONS.map(r=><button key={r} className="react-em" onClick={()=>sendReaction(r)}>{r}</button>)}</div>}
              </div>
            </div>
            <div className="cg">
              <button className={`cbtn${isRecording?" rec":""}`} onClick={()=>{setIsRecording(r=>!r);toast$(isRecording?"⏹ Stopped":"🔴 Recording…",isRecording?"warn":"info");}}>
                <span className="cbtn-ic">⏺</span><span>{isRecording?"Stop":"Record"}</span>
              </button>
              <button className="cbtn em" onClick={()=>setShowAnalysis(true)}><span className="cbtn-ic">📊</span><span>Report</span></button>
            </div>
            <div className="cg">
              <button className={`cbtn${panelTab==="chat"?" hi":""}`} onClick={()=>setPanelTab(p=>p==="chat"?null:"chat")}><span className="cbtn-ic">💬</span><span>Chat</span></button>
              <button className={`cbtn${panelTab==="ai"?" hi":""}`} onClick={()=>setPanelTab(p=>p==="ai"?null:"ai")}><span className="cbtn-ic">🤖</span><span>AI Notes</span></button>
              <button className="end-room-btn-sm" onClick={()=>setShowEnd(true)}>End Session</button>
            </div>
          </div>
        </div>
        {panelTab&&(
          <div className="side-panel">

            <div className="panel-tabs">
              {[{id:"chat",ic:"💬",lbl:"Chat"},{id:"ai",ic:"🤖",lbl:"AI Notes"}].map(t=>(
                <button key={t.id} className={`ptab${panelTab===t.id?" active":""}`} onClick={()=>setPanelTab(t.id)}><span style={{fontSize:12}}>{t.ic}</span><span>{t.lbl}</span></button>
              ))}
              <button className="ptab-close" onClick={()=>setPanelTab(null)}>✕</button>
            </div>
            {panelTab==="chat"&&(
              <div style={{display:"flex",flexDirection:"column",height:"100%",minHeight:0}}>
                <div className="pscroll" style={{flex:1}}>
                  <div className="chat-msgs">
                    {messages.length===0&&<div className="chat-empty">No messages yet.<br/>Observer questions appear here.</div>}
                    {messages.map((m,i)=>{const own=m.sender===config.name;const isAI=m.type==="ai";return(<div key={i} className={`chat-msg${own?" own":""}`}>
                      {!own&&<div className="chat-av-s" style={{background:isAI?"rgba(45,156,219,.2)":"rgba(255,255,255,.08)",color:isAI?"#7ed3f7":"rgba(255,255,255,.5)"}}>{isAI?"🤖":m.sender[0]?.toUpperCase()}</div>}
                      <div className="chat-bw">
                        {!own&&<span className="chat-sender">{m.sender}</span>}
                        <div className={`chat-bubble ${own?"b-own":isAI?"":"b-o"}`} style={isAI?{background:"rgba(45,156,219,.09)",border:"1px solid rgba(45,156,219,.15)",color:"#d0e8ff",borderRadius:"3px 9px 9px 9px"}:{}}>{m.text}</div>
                        <span className="chat-t">{fmt(m.time)}</span>
                      </div>
                    </div>);})}
                    <div ref={chatEndRef}/>
                  </div>
                </div>
                <div className="chat-ia">
                  <textarea className="chat-inp" placeholder="Reply to observers…" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg(chatInput);}}} rows={1}/>
                  <button className="chat-send" onClick={()=>sendMsg(chatInput)}>➤</button>
                </div>
              </div>
            )}
            {panelTab==="ai"&&(
              <div className="pscroll">
                <div className="ai-sum-pad">
                  <div style={{padding:"8px 10px",borderRadius:9,background:"rgba(0,195,122,.07)",border:"1px solid rgba(0,195,122,.18)",marginBottom:7}}>
                    <div style={{fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:".07em",color:"rgba(255,255,255,.28)",marginBottom:4}}>Session Status</div>
                    <div style={{fontSize:12,fontWeight:700,color:"#5ee3b7",display:"flex",alignItems:"center",gap:6}}><div style={{width:6,height:6,borderRadius:"50%",background:"var(--em)",animation:"pulse 1.5s infinite"}}/>{timer} · {observerCount} observer(s)</div>
                  </div>
                  <div className="ai-sum-card"><div className="ai-sum-lbl">🤖 AI Moderator Notes</div>{aiSummaryLines.map((l,i)=>(
                    <div key={i} className="ai-sum-val" style={{marginBottom:4,paddingBottom:4,borderBottom:i<aiSummaryLines.length-1?"1px solid rgba(255,255,255,.06)":"none",fontSize:11}}>{i===aiSummaryLines.length-1&&<span><span className="ai-sum-dot"/>Latest: </span>}{l}</div>
                  ))}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {showAnalysis&&<AnalysisModal topic={config.topic} subject={config.subject} unit={config.unit} timer={timer} exchanges={exchangeCount} presenterName={config.name} onClose={()=>setShowAnalysis(false)}/>}
      {showEnd&&(
        <div className="overlay" onClick={()=>setShowEnd(false)}>
          <div className="modal" style={{maxWidth:340,background:"#0c1422",border:"1px solid rgba(255,255,255,.1)"}} onClick={e=>e.stopPropagation()}>
            <div style={{background:"linear-gradient(135deg,#060e1c,#08180e)",padding:"22px 18px",textAlign:"center"}}>
              <div style={{fontSize:40,marginBottom:9}}>🏁</div>
              <div style={{fontSize:14,fontWeight:800,color:"#fff",marginBottom:4}}>End seminar session?</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.38)",lineHeight:1.7}}>Duration: <strong style={{color:"#5ee3b7"}}>{timer}</strong><br/>{observerCount} observer(s) · {exchangeCount} exchanges</div>
            </div>
            <div style={{padding:"11px 13px",margin:"10px 18px",borderRadius:10,background:"rgba(0,195,122,.06)",border:"1px solid rgba(0,195,122,.16)",fontSize:11.5,fontWeight:600,color:"var(--em)",textAlign:"center"}}>
              🤖 AI will generate your full performance report after ending.
            </div>
            <div className="mf" style={{borderColor:"rgba(255,255,255,.08)"}}>
              <button className="btn-s" style={{background:"rgba(255,255,255,.04)",borderColor:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)"}} onClick={()=>setShowEnd(false)}>Keep Going</button>
              <button className="btn-d" onClick={handleEnd}>End &amp; Generate Report</button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </div>
  );
}

// ─── OBSERVER ROOM ────────────────────────────────────────────────────────────
function PresenterRoom({config,onEnd}) {
  const timer=useTimer(true);
  const [panelTab,setPanelTab]=useState("chat");
  const [chatInput,setChatInput]=useState("");
  const [micOn,setMicOn]=useState(Boolean(config.micOn));
  const [screenSharing,setScreenSharing]=useState(false);
  const [showEnd,setShowEnd]=useState(false);
  const [showBackConfirm,setShowBackConfirm]=useState(false);
  const [showReactions,setShowReactions]=useState(false);
  const [reaction,setReaction]=useState(null);
  const [liveSession,setLiveSession]=useState(config.liveSession || null);
  const [messages,setMessages]=useState([]);
  const [roomLoading,setRoomLoading]=useState(true);
  const [roomError,setRoomError]=useState("");
  const [starting,setStarting]=useState(false);
  const [ending,setEnding]=useState(false);
  const [sendingChat,setSendingChat]=useState(false);
  const [isHostSpeaking,setIsHostSpeaking]=useState(false);
  const [sharedFile,setSharedFile]=useState<{url:string,name:string,isPdf:boolean}|null>(null);
  const sharedFileInputRef=useRef<HTMLInputElement>(null);
  const aiVoice=useAIVoice();
  const {show:toast$,node:toastNode}=useToast();
  const presenterColor=avColor(config.name);
  const livekitApiBase = `${import.meta.env.VITE_API_BASE_URL || ""}`;
  const {
    isMuted: livekitMuted,
    muteLocalAudio: livekitMute,
    unmuteLocalAudio: livekitUnmute,
    connected: livekitConnected,
  } = useSeminarLivekit({
    sessionId: config.sessionId || "",
    candidateId: String(config.candidateId || ""),
    candidateName: config.name || "",
    enabled: Boolean(config.sessionId && config.candidateId),
    role: "host",
    localStream: config.stream || null,
    apiBase: livekitApiBase,
    startMuted: !config.micOn,
  });
  const chatEndRef=useRef(null);
  const pollingRef=useRef(null);
  const completionHandledRef=useRef(false);
  const greetingPlayedRef=useRef(false);
  const latestConfigRef=useRef(config);
  const latestTimerRef=useRef(timer);
  const latestOnEndRef=useRef(onEnd);
  const currentCandidateId = String(config.candidateId || config.liveSession?.hostCandidateId || "");
  const isGuestUser = Boolean(config.isGuest);
  const participantList = (liveSession?.participants || []).filter((item)=>!item.isAi);
  const observerList = participantList.filter((item)=>!item.isHost);
  const pendingRequests = getPendingSeminarSpeakRequests(liveSession);
  const pendingRequest = pendingRequests[0] || null;
  const roomStatus = liveSession?.status || "waiting";
  const observerCount = observerList.length;

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  useEffect(()=>{setMessages(mapSeminarTurnsToMessages(liveSession, config.name));},[liveSession, config.name]);
  useEffect(()=>{latestConfigRef.current = config;},[config]);
  useEffect(()=>{latestTimerRef.current = timer;},[timer]);
  useEffect(()=>{latestOnEndRef.current = onEnd;},[onEnd]);

  const syncSession = useCallback(async (showFullLoader = false)=>{
    const latestConfig = latestConfigRef.current;
    if(!latestConfig?.sessionId) return;
    if(showFullLoader) setRoomLoading(true);
    try{
      const session = await getSeminarSession(latestConfig.sessionId);
      setLiveSession(session || null);
      setRoomError("");
      if((session?.status === "completed" || session?.status === "ending") && !completionHandledRef.current){
        completionHandledRef.current = true;
        latestOnEndRef.current({
          sessionId: latestConfig.sessionId,
          timer: latestTimerRef.current,
          topic: session?.topic || latestConfig.topic,
          subject: session?.subject || latestConfig.subject,
          unit: session?.unit || latestConfig.unit,
          exchanges: mapSeminarTurnsToMessages(session, latestConfig.name).length,
          presenterName: latestConfig.name,
          modeType: "session",
          feedback: session?.feedback || session?.results || session?.metadata || null,
          scores: session?.scores || session?.results?.scores || null,
          canViewFeedback: true,
        });
      }
    } catch(error){
      setRoomError(error?.message || "Unable to refresh the seminar room.");
    } finally {
      if(showFullLoader) setRoomLoading(false);
    }
  },[]);

  useEffect(()=>{
    syncSession(true);
    pollingRef.current = setInterval(()=>{ syncSession(false).catch(()=>null); },3000);
    return ()=>{
      if(pollingRef.current) clearInterval(pollingRef.current);
      aiVoice.cancel();
      if(config.stream&&typeof config.stream.getTracks==="function") config.stream.getTracks().forEach((track)=>track.stop());
    };
  },[]);

  useEffect(()=>{
    window.history.pushState({ seminarRoom: true }, "", window.location.href);
    const handlePopState = ()=>{
      window.history.pushState({ seminarRoom: true }, "", window.location.href);
      setShowBackConfirm(true);
    };
    window.addEventListener("popstate", handlePopState);
    return ()=>window.removeEventListener("popstate", handlePopState);
  },[]);

  useEffect(()=>{
    if(roomStatus === "active" && !greetingPlayedRef.current){
      const greeting =
        liveSession?.metadata?.ai_greeting ||
        liveSession?.metadata?.message ||
        liveSession?.turns?.find((turn)=>turn.turnType === "greeting")?.message ||
        "";
      if(greeting){
        greetingPlayedRef.current = true;
        aiVoice.speak(greeting);
      }
    }
  },[aiVoice.speak, liveSession, roomStatus]);

  async function handleStartRoom(){
    setStarting(true);
    try{
      const response = await startSeminarRoom({
        sessionId: config.sessionId,
        unitId: config.unitId,
        candidateId: currentCandidateId,
        candidateName: config.name,
        topic: config.topic,
      });
      setLiveSession(response?.liveSession || response || null);
      toast$("Seminar session started.","success");
    } catch(error){
      toast$(getErrorMessage(error, "Unable to start this seminar session."),"error");
    } finally {
      setStarting(false);
    }
  }

  async function handleRemoveParticipant(participant){
    try{
      const updated = await removeSeminarParticipant({
        sessionId: config.sessionId,
        candidateId: currentCandidateId,
        participantId: participant.id,
      });
      setLiveSession(updated || null);
      toast$(`${participant.name} was removed from the waiting room.`,"success");
    } catch(error){
      toast$(getErrorMessage(error, "Unable to remove this participant."),"error");
    }
  }

  async function sendMsg(text){
    const trimmed = text.trim();
    if(!trimmed || sendingChat) return;
    setSendingChat(true);
    try{
      const session = await sendSeminarMessage({
        sessionId: config.sessionId,
        candidateId: currentCandidateId,
        candidateName: config.name,
        message: trimmed,
        role: "host",
      });
      setChatInput("");
      setLiveSession(session || null);
    } catch(error){
      toast$(getErrorMessage(error, "Unable to send this seminar message."),"error");
    } finally {
      setSendingChat(false);
    }
  }

  async function toggleScreen(){
    if(screenSharing){
      setScreenSharing(false);
      toast$("Screen sharing stopped.","warn");
      return;
    }
    try{
      await navigator.mediaDevices.getDisplayMedia({video:true});
      setScreenSharing(true);
      toast$("Screen sharing started.","success");
    } catch {
      toast$("Screen share cancelled.","warn");
    }
  }

  async function handleSpeakApproval(request, approved){
    try{
      const session = await respondSeminarSpeakingAccess({
        sessionId: config.sessionId,
        candidateId: currentCandidateId,
        candidateName: config.name,
        participantId: request.participantId,
        participantName: request.participantName,
        approved,
      });
      setLiveSession(session || null);
      toast$(approved ? `${request.participantName} can now speak.` : `${request.participantName} was asked to stay muted.`, approved ? "success" : "warn");
    } catch(error){
      toast$(getErrorMessage(error, "Unable to update speaking access."),"error");
    }
  }

  async function handleEndRoom(){
    setEnding(true);
    try{
      const response = await endSeminarWithTranscript({ sessionId: config.sessionId });
      completionHandledRef.current = true;
      onEnd({
        sessionId: config.sessionId,
        timer,
        topic: config.topic,
        subject: config.subject,
        unit: config.unit,
        exchanges: messages.length,
        presenterName: config.name,
        modeType: "session",
        feedback: response?.feedback || response?.results || response?.message || response || null,
        scores: response?.scores || response?.results?.scores || null,
        canViewFeedback: true,
      });
    } catch(error){
      toast$(getErrorMessage(error, "Unable to end this seminar session."),"error");
    } finally {
      setEnding(false);
    }
  }

  async function handleBackExit(){
    await handleEndRoom();
    navigateAfterSeminarExit(isGuestUser);
  }

  function sendReaction(emoji){setShowReactions(false);const k=Date.now();setReaction({emoji,k});setTimeout(()=>setReaction(null),2400);}
  const fmt=(d)=>new Date(d).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});

  if(roomLoading){
    return <div className="room-page"><PageLoader label="Loading seminar room…" sublabel="Syncing live seminar state" /></div>;
  }

  const waitingRoom = roomStatus !== "active";

  return (
    <div className="room-page">
      <div className="room-bar">
        <div className="room-logo"><div className="room-logo-ic">🎓</div>SeminarArena</div>
        <div className="room-divider"/>
        <div className="room-topic"><strong>{config.subject&&`${config.subject}${config.unit?` · ${config.unit}`:""} · `}</strong>{config.topic}</div>
        <div className="r-pill rp-timer">{timer}</div>
        <div className="r-pill rp-ai">{waitingRoom ? "🪪 Waiting Room" : "🎙️ Live Session"}</div>
        <div className="r-pill" style={{background:"rgba(0,195,122,.1)",borderColor:"rgba(0,195,122,.2)",color:"#5ee3b7"}}>👁 {observerCount}</div>
        <button className="rbar-end-btn" onClick={()=>setShowBackConfirm(true)}>← Back</button>
      </div>
      {roomError&&<div style={{margin:"12px 16px 0",padding:"10px 12px",borderRadius:10,background:"rgba(229,62,62,.08)",border:"1px solid rgba(229,62,62,.2)",color:"#fecaca",fontSize:12.5}}>{roomError}</div>}

      {waitingRoom ? (
        <div style={{flex:1,display:"grid",gridTemplateColumns:"1.1fr .9fr",gap:18,padding:18,minHeight:0}}>
          <div style={{background:"#08111d",border:"1px solid rgba(255,255,255,.08)",borderRadius:20,padding:24,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:12,fontWeight:800,color:"#5ee3b7",textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>Presenter Waiting Room</div>
              <div style={{fontSize:28,fontWeight:900,color:"#fff",lineHeight:1.1,marginBottom:10}}>Your observers are gathering.</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,.55)",lineHeight:1.8,maxWidth:520}}>Share the room link, wait for participants to join, then start the seminar when you are ready.</div>
            </div>
            <div className="link-box" style={{marginTop:18,background:"rgba(255,255,255,.03)",borderColor:"rgba(16,185,129,.2)"}}>
              <div className="link-box-title">🔗 Room Link</div>
              <div className="link-row"><span className="link-val">{liveSession?.shareLink || config.roomLink}</span><button className="copy-btn" onClick={()=>navigator.clipboard.writeText(liveSession?.shareLink || config.roomLink)}>Copy</button></div>
            </div>
          </div>
          <div style={{background:"var(--surf)",border:"1px solid var(--bdr)",borderRadius:20,padding:18,display:"flex",flexDirection:"column",minHeight:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div><div style={{fontSize:14,fontWeight:800,color:"var(--t1)"}}>Joined Users</div><div style={{fontSize:11.5,color:"var(--t2)"}}>{observerList.length} participant(s) waiting</div></div>
              <button className="btn-s" onClick={()=>syncSession(false)}>Refresh</button>
            </div>
            <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8}}>
              {observerList.length === 0 ? (
                <div style={{padding:"14px",borderRadius:14,background:"var(--surf2)",border:"1px solid var(--bdr)",fontSize:12,color:"var(--t2)"}}>No users have joined yet. Share the room link above.</div>
              ) : observerList.map((participant)=>{
                const isApproved = participant.status === "approved_to_speak" || participant.status === "approved";
                return (
                <div key={participant.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,background:"var(--surf2)",border:`1px solid ${isApproved?"rgba(0,195,122,.25)":"var(--bdr)"}`}}>
                  <div className="invite-av" style={{background:avColor(participant.name)}}>{avInit(participant.name)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12.5,fontWeight:700,color:"var(--t1)"}}>{participant.name}</div>
                    <div style={{fontSize:10.5,color:isApproved?"#5ee3b7":"var(--t2)"}}>{isApproved?"✅ Approved to enter":"⏳ Waiting to join"}</div>
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {!isApproved && <button className="btn-s" style={{padding:"6px 10px",fontSize:11,background:"rgba(0,195,122,.1)",borderColor:"rgba(0,195,122,.3)",color:"#5ee3b7"}} onClick={()=>handleSpeakApproval({participantId:participant.id,participantName:participant.name},true)}>✓ Allow</button>}
                    <button className="btn-d" style={{padding:"6px 10px",fontSize:11}} onClick={()=>handleRemoveParticipant(participant)}>Remove</button>
                  </div>
                </div>
                );
              })}
            </div>
            <button className="btn-p" style={{marginTop:14}} onClick={handleStartRoom} disabled={starting || !config.unitId}>{starting ? "Starting Seminar..." : "Start Seminar"}</button>
          </div>
        </div>
      ) : (
        <div className="room-body">
          <div className="grid-area">
            <div className="ss-area">
              {sharedFile ? (
                <div style={{width:"100%",height:"100%",position:"relative",display:"flex",flexDirection:"column"}}>
                  <div className="ss-active-label"><div className="ss-active-dot"/>📎 {sharedFile.name} · {observerCount} watching<button style={{marginLeft:"auto",background:"rgba(229,62,62,.8)",border:"none",borderRadius:6,color:"#fff",fontSize:11,padding:"2px 8px",cursor:"pointer"}} onClick={()=>{URL.revokeObjectURL(sharedFile.url);setSharedFile(null);}}>✕ Stop</button></div>
                  {sharedFile.isPdf ? (
                    <iframe src={sharedFile.url} style={{flex:1,width:"100%",border:"none",borderRadius:"0 0 8px 8px"}} title={sharedFile.name}/>
                  ) : (
                    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,color:"rgba(255,255,255,.5)"}}>
                      <div style={{fontSize:52}}>📊</div>
                      <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.7)"}}>{sharedFile.name}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,.35)",textAlign:"center",maxWidth:260}}>PowerPoint files display in the AI context. Use screen share to show slides to participants.</div>
                      <a href={sharedFile.url} download={sharedFile.name} style={{padding:"8px 18px",borderRadius:8,background:"rgba(45,156,219,.2)",border:"1px solid rgba(45,156,219,.35)",color:"#7ed3f7",fontSize:12,fontWeight:700,textDecoration:"none"}}>⬇ Download</a>
                    </div>
                  )}
                </div>
              ) : !screenSharing ? (
                <div className="ss-placeholder">
                  <div style={{fontSize:52,opacity:.18}}>🖥️</div>
                  <div style={{fontSize:13,fontWeight:700}}>Screen not shared yet</div>
                  <div style={{display:"flex",gap:10,marginTop:14}}>
                    <button style={{padding:"9px 20px",borderRadius:10,background:"var(--grad)",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,color:"#fff"}} onClick={toggleScreen}>🖥️ Share Screen</button>
                    <button style={{padding:"9px 16px",borderRadius:10,background:"rgba(45,156,219,.15)",border:"1px solid rgba(45,156,219,.3)",cursor:"pointer",fontSize:13,fontWeight:700,color:"#7ed3f7"}} onClick={()=>sharedFileInputRef.current?.click()}>📎 Share File</button>
                  </div>
                  <input ref={sharedFileInputRef} type="file" accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation" style={{display:"none"}} onChange={(e)=>{const f=e.target.files?.[0];if(f){const url=URL.createObjectURL(f);setSharedFile({url,name:f.name,isPdf:f.type==="application/pdf"||f.name.toLowerCase().endsWith(".pdf")});toast$(`📎 Sharing ${f.name}`,"success");}}}/>
                </div>
              ) : (
                <><div className="ss-active-label"><div className="ss-active-dot"/>Screen Sharing Active · {observerCount} watching</div><div style={{fontSize:11,color:"rgba(255,255,255,.3)"}}>Your screen is shared</div></>
              )}
              {reaction&&<div key={reaction.k} style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:46,animation:"rPop 2s forwards",pointerEvents:"none",zIndex:5}}>{reaction.emoji}</div>}
            </div>
            <div className="presenter-strip">
              <div className="strip-tile" style={{border:`1.5px solid ${presenterColor}44`}}>
                <div className="strip-av" style={{background:presenterColor+"22",color:presenterColor}}>{avInit(config.name)}</div>
                {isHostSpeaking&&<div style={{position:"absolute",top:5,right:5}}><SoundAnalyser active color="#5ee3b7" bars={4} size={16}/></div>}
                <div className="strip-ov"><span className="strip-name">{config.name}</span><span style={{fontSize:9}}>{micOn?"🎤":"🔇"}</span></div>
                <div style={{position:"absolute",top:5,left:5,fontSize:9,fontWeight:800,padding:"1px 5px",borderRadius:4,background:"rgba(0,195,122,.85)",color:"#000"}}>HOST</div>
              </div>
              <div className="strip-tile" style={{border:"1.5px solid rgba(45,156,219,.3)"}}>
                <div style={{fontSize:24}}>🤖</div>
                {aiVoice.isSpeaking&&<div style={{position:"absolute",top:5,right:5}}><SoundAnalyser active color="#7ed3f7" bars={4} size={16}/></div>}
                <div className="strip-ov"><span className="strip-name">AI Moderator</span></div>
              </div>
              <div className="strip-tile"><div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}><div style={{fontSize:20}}>👁️</div><div style={{fontSize:16,fontWeight:900,color:"rgba(255,255,255,.6)"}}>{observerCount}</div></div><div className="strip-ov"><span className="strip-name">Participants</span></div></div>
            </div>
            <div className="ctrl-bar">
              <div className="cg">
                <button className={`cbtn ${micOn?"on":"off"}`} onMouseDown={()=>setIsHostSpeaking(true)} onMouseUp={()=>setIsHostSpeaking(false)} onMouseLeave={()=>setIsHostSpeaking(false)} onClick={()=>{const next=!micOn;setMicOn(next);if(next){livekitUnmute();}else{livekitMute();}}}><span className="cbtn-ic">{micOn?"🎤":"🔇"}</span><span>{micOn?"Mute":"Unmute"}</span></button>
                <button className={`cbtn${screenSharing?" hi":""}`} onClick={toggleScreen}><span className="cbtn-ic">🖥</span><span>{screenSharing?"Stop":"Share"}</span></button>
                <button className={`cbtn${sharedFile?" hi":""}`} onClick={()=>sharedFileInputRef.current?.click()}><span className="cbtn-ic">📎</span><span>{sharedFile?"File On":"Share File"}</span></button>
                <div style={{position:"relative"}}><button className={`cbtn${showReactions?" hi":""}`} onClick={()=>setShowReactions((value)=>!value)}><span className="cbtn-ic">😊</span><span>React</span></button>{showReactions&&<div className="react-pop">{REACTIONS.map((item)=><button key={item} className="react-em" onClick={()=>sendReaction(item)}>{item}</button>)}</div>}</div>
              </div>
              <div className="cg">
                <button className={`cbtn${panelTab==="chat"?" hi":""}`} onClick={()=>setPanelTab("chat")}><span className="cbtn-ic">💬</span><span>Chat</span></button>
                <button className={`cbtn${panelTab==="people"?" hi":""}`} onClick={()=>setPanelTab("people")}><span className="cbtn-ic">👥</span><span>People</span></button>
                <button className="end-room-btn-sm" onClick={()=>setShowEnd(true)}>End Session</button>
              </div>
            </div>
          </div>
          <div className="side-panel" style={{width:320,minWidth:320}}>
            <div className="panel-tabs">
              {[{id:"chat",ic:"💬",lbl:"Chat"},{id:"people",ic:"👥",lbl:"People"}].map((tab)=><button key={tab.id} className={`ptab${panelTab===tab.id?" active":""}`} onClick={()=>setPanelTab(tab.id)}><span style={{fontSize:12}}>{tab.ic}</span><span>{tab.lbl}</span></button>)}
            </div>
            {panelTab==="chat"&&(
              <div style={{display:"flex",flexDirection:"column",height:"100%",minHeight:0}}>
                <div className="pscroll" style={{flex:1}}>
                  <div className="chat-msgs">
                    {messages.length===0&&<div className="chat-empty">No chat messages yet.<br/>Participant questions will appear here.</div>}
                    {messages.map((m)=>{const own=m.sender===config.name;const isAI=m.type==="ai";return(<div key={m.id} className={`chat-msg${own?" own":""}`}>{!own&&<div className="chat-av-s" style={{background:isAI?"rgba(45,156,219,.2)":"rgba(255,255,255,.08)",color:isAI?"#7ed3f7":"rgba(255,255,255,.5)"}}>{isAI?"🤖":m.sender[0]?.toUpperCase()}</div>}<div className="chat-bw">{!own&&<span className="chat-sender">{m.sender}</span>}<div className={`chat-bubble ${own?"b-own":isAI?"":"b-o"}`} style={isAI?{background:"rgba(45,156,219,.09)",border:"1px solid rgba(45,156,219,.15)",color:"#d0e8ff",borderRadius:"3px 9px 9px 9px"}:{}}>{m.text}</div><span className="chat-t">{fmt(m.time)}</span></div></div>);})}
                    <div ref={chatEndRef}/>
                  </div>
                </div>
                <div className="chat-ia">
                  <textarea className="chat-inp" placeholder="Reply to participants…" value={chatInput} onChange={(event)=>setChatInput(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();sendMsg(chatInput);}}} rows={1}/>
                  <button className="chat-send" onClick={()=>sendMsg(chatInput)} disabled={sendingChat}>➤</button>
                </div>
              </div>
            )}
            {panelTab==="people"&&(
              <div className="pscroll">
                <div style={{padding:"7px 10px 2px",fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:".07em",color:"rgba(255,255,255,.2)"}}>Session Users</div>
                <div className="p-list">
                  {[{name:config.name,role:"🎙️ Host",color:presenterColor,speaking:isHostSpeaking},...observerList.map((participant)=>({name:participant.name,role:participant.status==="approved_to_speak"?"🎤 Approved":"👤 Participant",color:avColor(participant.name),speaking:false}))].map((person,index)=><div key={`${person.name}-${index}`} className="p-row"><div className="p-av" style={{background:person.color+"20",color:person.color}}>{avInit(person.name)}</div><div className="p-info"><div className="p-name">{person.name}</div><div className="p-role">{person.role}</div></div>{person.speaking&&<SoundAnalyser active color={person.color} bars={4} size={16}/>}</div>)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {pendingRequest && !waitingRoom && (
        <div className="overlay">
          <div className="modal" style={{maxWidth:360}} onClick={(event)=>event.stopPropagation()}>
            <div className="mh"><div className="mh-title">Speaking Request</div></div>
            <div className="mb" style={{fontSize:13,color:"var(--t2)",lineHeight:1.8}}><strong style={{color:"var(--t1)"}}>{pendingRequest.participantName}</strong> wants to speak.</div>
            <div className="mf"><button className="btn-s" onClick={()=>handleSpeakApproval(pendingRequest,false)}>Keep Muted</button><button className="btn-p" style={{width:"auto"}} onClick={()=>handleSpeakApproval(pendingRequest,true)}>Allow</button></div>
          </div>
        </div>
      )}
      {showEnd&&(
        <div className="overlay" onClick={()=>setShowEnd(false)}>
          <div className="modal" style={{maxWidth:360,background:"#0c1422",border:"1px solid rgba(255,255,255,.1)"}} onClick={(event)=>event.stopPropagation()}>
            <div style={{background:"linear-gradient(135deg,#060e1c,#08180e)",padding:"22px 18px",textAlign:"center"}}><div style={{fontSize:40,marginBottom:9}}>🏁</div><div style={{fontSize:14,fontWeight:800,color:"#fff",marginBottom:4}}>End seminar session?</div><div style={{fontSize:12,color:"rgba(255,255,255,.38)",lineHeight:1.7}}>Duration: <strong style={{color:"#5ee3b7"}}>{timer}</strong><br/>{observerCount} participant(s)</div></div>
            <div style={{padding:"11px 13px",margin:"10px 18px",borderRadius:10,background:"rgba(0,195,122,.06)",border:"1px solid rgba(0,195,122,.16)",fontSize:11.5,fontWeight:600,color:"var(--em)",textAlign:"center"}}>Only the host will see AI feedback after this session ends.</div>
            <div className="mf" style={{borderColor:"rgba(255,255,255,.08)"}}><button className="btn-s" style={{background:"rgba(255,255,255,.04)",borderColor:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)"}} onClick={()=>setShowEnd(false)}>Keep Going</button><button className="btn-d" onClick={handleEndRoom} disabled={ending}>{ending ? "Ending..." : "End Seminar"}</button></div>
          </div>
        </div>
      )}
      {showBackConfirm&&(
        <div className="overlay" onClick={()=>setShowBackConfirm(false)}>
          <div className="modal" style={{maxWidth:340}} onClick={(event)=>event.stopPropagation()}>
            <div className="mh"><div className="mh-title">Leave Seminar?</div></div>
            <div className="mb" style={{fontSize:13,color:"var(--t2)",lineHeight:1.8}}>Going back will end the meeting for everyone in this seminar room.</div>
            <div className="mf"><button className="btn-s" onClick={()=>setShowBackConfirm(false)}>Cancel</button><button className="btn-d" onClick={handleBackExit} disabled={ending}>{ending ? "Leaving..." : "Leave & End"}</button></div>
          </div>
        </div>
      )}
      {toastNode}
    </div>
  );
}

function ObserverRoomLegacy({config,onEnd}) {
  const timer=useTimer(true);const session=config.joinSession;
  const [panelTab,setPanelTab]=useState("chat");
  const [messages,setMessages]=useState([{sender:"AI Moderator",text:`Welcome, ${config.name}! You've joined as an observer for "${session?.title||config.topic||"the seminar"}". Watch, ask questions in chat, or raise your hand.`,type:"ai",time:Date.now()}]);
  const [chatInput,setChatInput]=useState("");const [micOn,setMicOn]=useState(false);
  const [handRaised,setHandRaised]=useState(false);const [showEnd,setShowEnd]=useState(false);
  const [presenterSpeaking,setPresenterSpeaking]=useState(false);const [exchangeCount,setExchangeCount]=useState(0);
  const [reaction,setReaction]=useState(null);const [showReactions,setShowReactions]=useState(false);
  const chatEndRef=useRef(null);const aiVoice=useAIVoice();const {show:toast$,node:toastNode}=useToast();
  const presenterName=session?.presenterName||session?.title?.split(" ")[0]||"Presenter";
  const presenterColor=avColor(presenterName);

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  useEffect(()=>{
    const id=setInterval(()=>{setPresenterSpeaking(v=>!v);if(Math.random()>0.75){const sims=[{sender:"AI Moderator",text:"The presenter is making a strong argument here. Feel free to ask questions.",type:"ai"},{sender:presenterName,text:"Does anyone have questions about this point?",type:"presenter"},{sender:"AI Moderator",text:"Key point: consider the long-term implications of this stance.",type:"ai"}];const m=sims[Math.floor(Math.random()*sims.length)];setMessages(ms=>[...ms,{...m,time:Date.now()}]);}},5000+Math.random()*6000);
    return()=>{clearInterval(id);aiVoice.cancel();};
  },[]);

  function addMsg(sender,text,type){setMessages(ms=>[...ms,{sender,text,type,time:Date.now()}]);setExchangeCount(c=>c+1);}
  function sendMsg(){if(!chatInput.trim())return;addMsg(config.name,chatInput.trim());setChatInput("");if(Math.random()>0.5){setTimeout(()=>addMsg("AI Moderator","Great question! The presenter will address this shortly.","ai"),1800);}}
  function toggleMic(){if(!micOn){navigator.mediaDevices.getUserMedia({audio:true}).then(()=>{setMicOn(true);toast$("🎤 Mic active","success");}).catch(()=>toast$("Mic permission denied","error"));}else{setMicOn(false);toast$("🔇 Mic muted","warn");}}
  function toggleHand(){const n=!handRaised;setHandRaised(n);if(n){addMsg("AI Moderator",`${config.name} has raised their hand. Presenter, please acknowledge.`,"ai");toast$("✋ Hand raised","warn");}else toast$("Hand lowered","info");}
  function sendReaction(emoji){setShowReactions(false);const k=Date.now();setReaction({emoji,k});setTimeout(()=>setReaction(null),2400);}
  const fmt=d=>new Date(d).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});

  return (
    <div className="room-page">
      <div className="room-bar">
        <div className="room-logo"><div className="room-logo-ic">🎓</div>SeminarArena</div>
        <div className="room-divider"/>
        <div className="room-topic"><strong>Observing: </strong>{session?.title||config.topic||"Seminar Session"}</div>
        <div className="r-pill rp-timer">{timer}</div>
        <div className="r-pill rp-ai">👁️ Observer</div>
        <button className="rbar-end-btn" onClick={()=>setShowEnd(true)}>Leave</button>
      </div>
      <div className="room-body">
        <div className="grid-area">
          <div className="ss-area">
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,color:"rgba(255,255,255,.2)",flex:1,width:"100%"}}>
              <div style={{fontSize:52,opacity:.18}}>🖥️</div>
              <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.4)"}}>Presenter's Screen</div>
              <div style={{fontSize:11,textAlign:"center",maxWidth:220,lineHeight:1.6,color:"rgba(255,255,255,.25)"}}>The presenter's screen appears here once they start sharing.</div>
              {presenterSpeaking&&(<div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px",borderRadius:8,background:"rgba(0,195,122,.09)",border:"1px solid rgba(0,195,122,.2)",marginTop:8}}><SoundAnalyser active color="#5ee3b7" bars={6} size={20}/><span style={{fontSize:11,fontWeight:700,color:"#5ee3b7"}}>Presenter speaking…</span></div>)}
            </div>
            {reaction&&<div key={reaction.k} style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:44,animation:"rPop 2s forwards",pointerEvents:"none",zIndex:5}}>{reaction.emoji}</div>}
          </div>
          <div className="presenter-strip">
            <div className="strip-tile" style={{border:`1.5px solid ${presenterColor}44`}}>
              <div className="strip-av" style={{background:presenterColor+"22",color:presenterColor}}>{avInit(presenterName)}</div>
              {presenterSpeaking&&<div style={{position:"absolute",top:5,right:5}}><SoundAnalyser active color="#5ee3b7" bars={4} size={16}/></div>}
              <div className="strip-ov"><span className="strip-name">{presenterName}</span></div>
            </div>
            <div className="strip-tile" style={{border:"1.5px solid rgba(45,156,219,.3)"}}>
              <div style={{fontSize:22}}>🤖</div>
              <div className="strip-ov"><span className="strip-name">AI Mod</span></div>
            </div>
          </div>
          <div className="ctrl-bar">
            <div className="cg">
              <button className={`cbtn ${micOn?"on":"off"}`} onClick={toggleMic}><span className="cbtn-ic">{micOn?"🎤":"🔇"}</span><span>{micOn?"Mute":"Speak"}</span></button>
              <button className={`cbtn${handRaised?" am":""}`} onClick={toggleHand}><span className="cbtn-ic">✋</span><span>{handRaised?"Lower":"Raise"}</span></button>
              <div style={{position:"relative"}}>
                <button className={`cbtn${showReactions?" hi":""}`} onClick={()=>setShowReactions(r=>!r)}><span className="cbtn-ic">😊</span><span>React</span></button>
                {showReactions&&<div className="react-pop">{REACTIONS.map(r=><button key={r} className="react-em" onClick={()=>sendReaction(r)}>{r}</button>)}</div>}
              </div>
            </div>
            <div className="cg">
              <button className={`cbtn${panelTab==="chat"?" hi":""}`} onClick={()=>setPanelTab("chat")}><span className="cbtn-ic">💬</span><span>Chat</span></button>
              <button className={`cbtn${panelTab==="people"?" hi":""}`} onClick={()=>setPanelTab("people")}><span className="cbtn-ic">👥</span><span>People</span></button>
              <button className="end-room-btn-sm" style={{background:"rgba(229,62,62,.8)"}} onClick={()=>setShowEnd(true)}>Leave</button>
            </div>
          </div>
        </div>
        <div className="side-panel" style={{width:280,minWidth:280}}>
          <div className="panel-tabs">
            {[{id:"chat",ic:"💬",lbl:"Chat"},{id:"people",ic:"👥",lbl:"People"}].map(t=>(
              <button key={t.id} className={`ptab${panelTab===t.id?" active":""}`} onClick={()=>setPanelTab(t.id)}><span style={{fontSize:12}}>{t.ic}</span><span>{t.lbl}</span></button>
            ))}
          </div>
          {panelTab==="chat"&&(
            <div style={{display:"flex",flexDirection:"column",height:"100%",minHeight:0}}>
              <div className="pscroll" style={{flex:1}}>
                <div className="chat-msgs">
                  {messages.map((m,i)=>{const own=m.sender===config.name;const isAI=m.type==="ai";return(<div key={i} className={`chat-msg${own?" own":""}`}>
                    {!own&&<div className="chat-av-s" style={{background:isAI?"rgba(45,156,219,.2)":"rgba(255,255,255,.08)",color:isAI?"#7ed3f7":"rgba(255,255,255,.5)"}}>{isAI?"🤖":m.sender[0]?.toUpperCase()}</div>}
                    <div className="chat-bw">
                      {!own&&<span className="chat-sender">{m.sender}</span>}
                      <div className={`chat-bubble ${own?"b-own":""}`} style={isAI?{background:"rgba(45,156,219,.09)",border:"1px solid rgba(45,156,219,.15)",color:"#d0e8ff",borderRadius:"3px 9px 9px 9px"}:!own?{background:"rgba(255,255,255,.07)",color:"#e8ecf2",border:"1px solid rgba(255,255,255,.07)",borderRadius:"3px 9px 9px 9px"}:{}}>{m.text}</div>
                      <span className="chat-t">{fmt(m.time)}</span>
                    </div>
                  </div>);})}
                  <div ref={chatEndRef}/>
                </div>
              </div>
              <div className="chat-ia">
                <textarea className="chat-inp" placeholder="Ask a question…" value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMsg();}}} rows={1}/>
                <button className="chat-send" onClick={sendMsg}>➤</button>
              </div>
            </div>
          )}
          {panelTab==="people"&&(
            <div className="pscroll">
              <div style={{padding:"7px 10px 2px",fontSize:9,fontWeight:800,textTransform:"uppercase",letterSpacing:".07em",color:"rgba(255,255,255,.2)"}}>In this session</div>
              <div className="p-list">
                {[{name:presenterName,role:"🎙️ Presenter",color:presenterColor,speaking:presenterSpeaking},{name:"AI Moderator",role:"🤖 AI Moderator",color:"#2d9cdb",speaking:false},{name:config.name,role:"👁️ Observer (You)",color:avColor(config.name),speaking:micOn}].map((p,i)=>(
                  <div key={i} className="p-row">
                    <div className="p-av" style={{background:p.color+"20",color:p.color}}>{p.name==="AI Moderator"?"🤖":avInit(p.name)}</div>
                    <div className="p-info"><div className="p-name">{p.name}</div><div className="p-role">{p.role}{p.speaking?" 🔊":""}</div></div>
                    {p.speaking&&<SoundAnalyser active color={p.color} bars={4} size={16}/>}
                    {handRaised&&p.name===config.name&&<span style={{fontSize:11}}>✋</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {showEnd&&(
        <div className="overlay" onClick={()=>setShowEnd(false)}>
          <div className="modal" style={{maxWidth:320,background:"#0c1422",border:"1px solid rgba(255,255,255,.1)"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"22px 18px",textAlign:"center"}}><div style={{fontSize:38,marginBottom:8}}>👋</div><div style={{fontSize:13.5,fontWeight:800,color:"#fff",marginBottom:4}}>Leave seminar?</div><div style={{fontSize:11.5,color:"rgba(255,255,255,.38)"}}>You've been observing for {timer}</div></div>
            <div className="mf" style={{borderColor:"rgba(255,255,255,.08)"}}>
              <button className="btn-s" style={{background:"rgba(255,255,255,.04)",borderColor:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)"}} onClick={()=>setShowEnd(false)}>Stay</button>
              <button className="btn-d" onClick={()=>onEnd({timer,topic:session?.title||config.topic,subject:session?.subject||"",unit:session?.unit||"",participants:0,exchanges:exchangeCount,presenterName,modeType:"observer"})}>Leave Session</button>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </div>
  );
}

// ─── RESULTS ─────────────────────────────────────────────────────────────────
function ObserverRoom({config,onEnd}) {
  const timer=useTimer(true);
  const [panelTab,setPanelTab]=useState("chat");
  const [chatInput,setChatInput]=useState("");
  const [micOn,setMicOn]=useState(false);
  // const localStreamRef=useRef(null);
  const [showEnd,setShowEnd]=useState(false);
  const [showReactions,setShowReactions]=useState(false);
  const [reaction,setReaction]=useState(null);
  const [liveSession,setLiveSession]=useState(config.liveSession || null);
  const [messages,setMessages]=useState([]);
  const [roomLoading,setRoomLoading]=useState(true);
  const [roomError,setRoomError]=useState("");
  const [sendingChat,setSendingChat]=useState(false);
  const [requestingSpeak,setRequestingSpeak]=useState(false);
  const {show:toast$,node:toastNode}=useToast();
  const presenterName=liveSession?.hostCandidateName||config.liveSession?.hostCandidateName||"Presenter";
  const presenterColor=avColor(presenterName);
  const chatEndRef=useRef(null);
  const pollingRef=useRef(null);
  const completionHandledRef=useRef(false);
  const observerLivekitApiBase = `${import.meta.env.VITE_API_BASE_URL || ""}`;
  const {
    isMuted: obsLivekitMuted,
    muteLocalAudio: obsLivekitMute,
    unmuteLocalAudio: obsLivekitUnmute,
  } = useSeminarLivekit({
    sessionId: config.sessionId || "",
    candidateId: String(config.candidateId || ""),
    candidateName: config.name || "",
    enabled: Boolean(config.sessionId && config.candidateId),
    role: "observer",
    localStream: null,
    apiBase: observerLivekitApiBase,
    startMuted: true,
  });
  const latestConfigRef=useRef(config);
  const latestTimerRef=useRef(timer);
  const latestOnEndRef=useRef(onEnd);
  const currentCandidateId = String(config.candidateId || "");
  const isGuestUser = Boolean(config.isGuest);
  const approvedToSpeak = isSeminarParticipantApproved(liveSession, currentCandidateId);
  const roomStatus = liveSession?.status || "waiting";

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);
  useEffect(()=>{setMessages(mapSeminarTurnsToMessages(liveSession, config.name));},[liveSession, config.name]);
  useEffect(()=>{if(!approvedToSpeak && micOn) setMicOn(false);},[approvedToSpeak, micOn]);
  useEffect(()=>{latestConfigRef.current = config;},[config]);
  useEffect(()=>{latestTimerRef.current = timer;},[timer]);
  useEffect(()=>{latestOnEndRef.current = onEnd;},[onEnd]);

  const syncSession = useCallback(async (showFullLoader = false)=>{
    const latestConfig = latestConfigRef.current;
    if(!latestConfig?.sessionId) return;
    if(showFullLoader) setRoomLoading(true);
    try{
      const session = await getSeminarSession(latestConfig.sessionId);
      setLiveSession(session || null);
      setRoomError("");
      if((session?.status === "completed" || session?.status === "ending") && !completionHandledRef.current){
        completionHandledRef.current = true;
        if(pollingRef.current) clearInterval(pollingRef.current);
        toast$("The seminar session has ended.","info");
        setTimeout(()=>navigateAfterSeminarExit(latestConfig.isGuest || false), 1500);
      }
    } catch(error){
      setRoomError(error?.message || "Unable to refresh the seminar room.");
    } finally {
      if(showFullLoader) setRoomLoading(false);
    }
  },[presenterName, toast$]);

  useEffect(()=>{
    syncSession(true);
    pollingRef.current = setInterval(()=>{ syncSession(false).catch(()=>null); },3000);
    return ()=>{ if(pollingRef.current) clearInterval(pollingRef.current); };
  },[]);

  useEffect(()=>{
    window.history.pushState({ seminarObserverRoom: true }, "", window.location.href);
    const handlePopState = ()=>{
      window.history.pushState({ seminarObserverRoom: true }, "", window.location.href);
      setShowEnd(true);
    };
    window.addEventListener("popstate", handlePopState);
    return ()=>window.removeEventListener("popstate", handlePopState);
  },[]);

  async function sendMsg(){
    const trimmed = chatInput.trim();
    if(!trimmed || sendingChat) return;
    setSendingChat(true);
    try{
      const session = await sendSeminarMessage({
        sessionId: config.sessionId,
        candidateId: currentCandidateId,
        candidateName: config.name,
        message: trimmed,
        role: "observer",
      });
      setChatInput("");
      setLiveSession(session || null);
    } catch(error){
      toast$(getErrorMessage(error, "Unable to send this seminar message."),"error");
    } finally {
      setSendingChat(false);
    }
  }

  async function handleMicToggle(){
    if(approvedToSpeak){
      setMicOn((value)=>!value);
      return;
    }
    setRequestingSpeak(true);
    try{
      await requestSeminarSpeakingAccess({
        sessionId: config.sessionId,
        candidateId: currentCandidateId,
        candidateName: config.name,
      });
      toast$("Speaking request sent to the host.","info");
      await syncSession(false);
    } catch(error){
      toast$(getErrorMessage(error, "Unable to request speaking access."),"error");
    } finally {
      setRequestingSpeak(false);
    }
  }

  function sendReaction(emoji){setShowReactions(false);const k=Date.now();setReaction({emoji,k});setTimeout(()=>setReaction(null),2400);}
  const fmt=(d)=>new Date(d).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  function leaveAndRedirect(){
    onEnd({timer,topic:liveSession?.topic||config.topic,subject:liveSession?.subject||config.subject||"",unit:liveSession?.unit||config.unit||"",participants:0,exchanges:messages.length,presenterName,modeType:"observer"});
    setTimeout(()=>navigateAfterSeminarExit(isGuestUser),50);
  }

  if(roomLoading){
    return <div className="room-page"><PageLoader label="Joining seminar room…" sublabel="Syncing live seminar state" /></div>;
  }

  const waitingRoom = roomStatus !== "active";

  return (
    <div className="room-page">
      <div className="room-bar">
        <div className="room-logo"><div className="room-logo-ic">🎓</div>SeminarArena</div>
        <div className="room-divider"/>
        <div className="room-topic"><strong>Seminar: </strong>{liveSession?.topic || config.topic || "Seminar Session"}</div>
        <div className="r-pill rp-timer">{timer}</div>
        <div className="r-pill rp-ai">👁️ Participant</div>
        <button className="rbar-end-btn" onClick={()=>setShowEnd(true)}>Leave</button>
      </div>
      {roomError&&<div style={{margin:"12px 16px 0",padding:"10px 12px",borderRadius:10,background:"rgba(229,62,62,.08)",border:"1px solid rgba(229,62,62,.2)",color:"#fecaca",fontSize:12.5}}>{roomError}</div>}

      {waitingRoom ? (
        <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{maxWidth:520,width:"100%",padding:"34px 28px",borderRadius:24,background:"#08111d",border:"1px solid rgba(255,255,255,.08)",textAlign:"center"}}>
            <div style={{fontSize:54,marginBottom:14}}>⏳</div>
            <div style={{fontSize:28,fontWeight:900,color:"#fff",marginBottom:10}}>Waiting for host to start</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,.55)",lineHeight:1.8}}>You’ve joined the seminar room successfully. Once the host starts the session, this page will move into the live seminar meeting layout automatically.</div>
          </div>
        </div>
      ) : (
        <div className="room-body">
          <div className="grid-area">
            <div className="ss-area">
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,color:"rgba(255,255,255,.2)",flex:1,width:"100%"}}>
                <div style={{fontSize:52,opacity:.18}}>🖥️</div>
                <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.4)"}}>Presenter's Screen</div>
                <div style={{fontSize:11,textAlign:"center",maxWidth:240,lineHeight:1.6,color:"rgba(255,255,255,.25)"}}>The host is presenting this seminar. You can use chat freely, and you can request speaking access when you need to ask a question.</div>
                {approvedToSpeak&&(<div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 12px",borderRadius:8,background:"rgba(0,195,122,.09)",border:"1px solid rgba(0,195,122,.2)",marginTop:8}}><span style={{fontSize:11,fontWeight:700,color:"#5ee3b7"}}>Host approved your speaking access.</span></div>)}
              </div>
              {reaction&&<div key={reaction.k} style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",fontSize:44,animation:"rPop 2s forwards",pointerEvents:"none",zIndex:5}}>{reaction.emoji}</div>}
            </div>
            <div className="presenter-strip">
              <div className="strip-tile" style={{border:`1.5px solid ${presenterColor}44`}}>
                <div className="strip-av" style={{background:presenterColor+"22",color:presenterColor}}>{avInit(presenterName)}</div>
                <div className="strip-ov"><span className="strip-name">{presenterName}</span></div>
              </div>
              <div className="strip-tile" style={{border:`1.5px solid ${approvedToSpeak ? "rgba(0,195,122,.3)" : "rgba(255,255,255,.12)"}`}}>
                <div className="strip-av" style={{background:avColor(config.name)+"22",color:avColor(config.name)}}>{avInit(config.name)}</div>
                <div className="strip-ov"><span className="strip-name">{config.name}</span><span style={{fontSize:9}}>{micOn?"🎤":"🔇"}</span></div>
              </div>
            </div>
            <div className="ctrl-bar">
              <div className="cg">
                <button className={`cbtn ${micOn?"on":"off"}`} onClick={handleMicToggle} disabled={requestingSpeak}><span className="cbtn-ic">{micOn?"🎤":"🔇"}</span><span>{approvedToSpeak ? (micOn ? "Mute" : "Unmute") : (requestingSpeak ? "Requesting..." : "Request Speak")}</span></button>
                <div style={{position:"relative"}}><button className={`cbtn${showReactions?" hi":""}`} onClick={()=>setShowReactions((value)=>!value)}><span className="cbtn-ic">😊</span><span>React</span></button>{showReactions&&<div className="react-pop">{REACTIONS.map((item)=><button key={item} className="react-em" onClick={()=>sendReaction(item)}>{item}</button>)}</div>}</div>
              </div>
              <div className="cg">
                <button className={`cbtn${panelTab==="chat"?" hi":""}`} onClick={()=>setPanelTab("chat")}><span className="cbtn-ic">💬</span><span>Chat</span></button>
                <button className="end-room-btn-sm" style={{background:"rgba(229,62,62,.8)"}} onClick={()=>setShowEnd(true)}>Leave</button>
              </div>
            </div>
          </div>
          <div className="side-panel" style={{width:300,minWidth:300}}>
            <div className="panel-tabs">
              <button className="ptab active"><span style={{fontSize:12}}>💬</span><span>Chat</span></button>
            </div>
            <div style={{display:"flex",flexDirection:"column",height:"100%",minHeight:0}}>
              <div className="pscroll" style={{flex:1}}>
                <div className="chat-msgs">
                  {messages.length===0&&<div className="chat-empty">No messages yet.<br/>Use chat to interact with the host.</div>}
                  {messages.map((m)=>{const own=m.sender===config.name;const isAI=m.type==="ai";return(<div key={m.id} className={`chat-msg${own?" own":""}`}>{!own&&<div className="chat-av-s" style={{background:isAI?"rgba(45,156,219,.2)":"rgba(255,255,255,.08)",color:isAI?"#7ed3f7":"rgba(255,255,255,.5)"}}>{isAI?"🤖":m.sender[0]?.toUpperCase()}</div>}<div className="chat-bw">{!own&&<span className="chat-sender">{m.sender}</span>}<div className={`chat-bubble ${own?"b-own":""}`} style={isAI?{background:"rgba(45,156,219,.09)",border:"1px solid rgba(45,156,219,.15)",color:"#d0e8ff",borderRadius:"3px 9px 9px 9px"}:!own?{background:"rgba(255,255,255,.07)",color:"#e8ecf2",border:"1px solid rgba(255,255,255,.07)",borderRadius:"3px 9px 9px 9px"}:{}}>{m.text}</div><span className="chat-t">{fmt(m.time)}</span></div></div>);})}
                  <div ref={chatEndRef}/>
                </div>
              </div>
              <div className="chat-ia">
                <textarea className="chat-inp" placeholder="Ask a question…" value={chatInput} onChange={(event)=>setChatInput(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();sendMsg();}}} rows={1}/>
                <button className="chat-send" onClick={sendMsg} disabled={sendingChat}>➤</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showEnd&&(
        <div className="overlay" onClick={()=>setShowEnd(false)}>
          <div className="modal" style={{maxWidth:320,background:"#0c1422",border:"1px solid rgba(255,255,255,.1)"}} onClick={(event)=>event.stopPropagation()}>
            <div style={{padding:"22px 18px",textAlign:"center"}}><div style={{fontSize:38,marginBottom:8}}>👋</div><div style={{fontSize:13.5,fontWeight:800,color:"#fff",marginBottom:4}}>Leave seminar?</div><div style={{fontSize:11.5,color:"rgba(255,255,255,.38)"}}>You’ve been in this seminar for {timer}</div></div>
            <div className="mf" style={{borderColor:"rgba(255,255,255,.08)"}}><button className="btn-s" style={{background:"rgba(255,255,255,.04)",borderColor:"rgba(255,255,255,.1)",color:"rgba(255,255,255,.5)"}} onClick={()=>setShowEnd(false)}>Stay</button><button className="btn-d" onClick={leaveAndRedirect}>Leave Session</button></div>
          </div>
        </div>
      )}
      {toastNode}
    </div>
  );
}

function SeminarResults({result,onNew}) {
  const [showAnalysis,setShowAnalysis]=useState(false);
  const [showFeedbackChat,setShowFeedbackChat]=useState(false);
  const [feedbackChatMessages,setFeedbackChatMessages]=useState([]);
  const [feedbackChatInput,setFeedbackChatInput]=useState("");
  const [feedbackChatLoading,setFeedbackChatLoading]=useState(false);
  const isObserver=result.modeType==="observer";
  function handleDownload(){downloadSessionPDF({config:{name:result.presenterName,topic:result.topic,subject:result.subject,unit:result.unit},timer:result.timer,transcriptHistory:result.transcriptHistory||[],notes:result.notes||[],messages:result.messages||[],apiScores:result.scores||null,hintsUsed:result.hintsUsed||0,topicsCovered:result.topicsCovered||[]});}
  async function openFeedbackChat(){
    if(!result.sessionId) return;
    setShowFeedbackChat(true);
    if(feedbackChatMessages.length) return;
    setFeedbackChatLoading(true);
    try{
      const response = await startSeminarChat({ sessionId: result.sessionId });
      const opening = response?.ai_response || response?.response || response?.reply || response?.message || "Ask anything about your seminar feedback.";
      setFeedbackChatMessages([{ id:"start", role:"assistant", text: opening }]);
    } catch(error){
      setFeedbackChatMessages([{ id:"error", role:"assistant", text: error?.message || "Unable to start the feedback chat right now." }]);
    } finally {
      setFeedbackChatLoading(false);
    }
  }
  async function sendFeedbackChat(){
    const trimmed = feedbackChatInput.trim();
    if(!trimmed || !result.sessionId || feedbackChatLoading) return;
    setFeedbackChatMessages((current)=>[...current,{ id:`u-${Date.now()}`, role:"user", text: trimmed }]);
    setFeedbackChatInput("");
    setFeedbackChatLoading(true);
    try{
      const response = await respondSeminarChat({ sessionId: result.sessionId, message: trimmed });
      const reply = response?.ai_response || response?.response || response?.reply || response?.message || "I couldn’t generate a deeper review yet.";
      setFeedbackChatMessages((current)=>[...current,{ id:`a-${Date.now()}`, role:"assistant", text: reply }]);
    } catch(error){
      setFeedbackChatMessages((current)=>[...current,{ id:`e-${Date.now()}`, role:"assistant", text: error?.message || "Unable to continue the feedback chat." }]);
    } finally {
      setFeedbackChatLoading(false);
    }
  }
  return (
    <div className="results-page route-enter">
      <div className="res-trophy">{isObserver?"👁️":"🎓"}</div>
      <h2 className="res-h">{isObserver?"Session Ended":"Seminar Complete!"}</h2>
      <p className="res-sub">{isObserver?<>You observed <strong style={{color:"var(--em)"}}>{result.topic?.slice(0,30)||"the seminar"}</strong> for <strong style={{color:"var(--em)"}}>{result.timer}</strong>.</>:<>Seminar on <strong style={{color:"var(--em)"}}>{result.topic?.slice(0,30)}</strong> lasted <strong style={{color:"var(--em)"}}>{result.timer}</strong>.</>}</p>
      {result.subject&&(<div style={{display:"flex",gap:7,marginBottom:13,flexWrap:"wrap",justifyContent:"center"}}>
        <span style={{padding:"3px 11px",borderRadius:20,background:"rgba(0,195,122,.08)",border:"1px solid rgba(0,195,122,.18)",fontSize:11,fontWeight:700,color:"var(--em)"}}>📚 {result.subject}</span>
        {result.unit&&<span style={{padding:"3px 11px",borderRadius:20,background:"rgba(45,156,219,.08)",border:"1px solid rgba(45,156,219,.18)",fontSize:11,fontWeight:700,color:"var(--sky)"}}>📖 {result.unit}</span>}
      </div>)}
      <div className="res-stats">
        {[{l:"Duration",v:result.timer,i:"⏱️"},{l:isObserver?"Watched":"Exchanges",v:isObserver?result.timer:result.exchanges,i:isObserver?"👁️":"💬"},{l:isObserver?"Role":"Mode",v:isObserver?"Observer":result.modeType==="prepare"?"AI Prep":"Live",i:isObserver?"🎓":"🏅"}].map((s,i)=>(
          <div key={s.l} className="res-stat" style={{animationDelay:`${i*.1}s`}}><div className="res-stat-ic">{s.i}</div><div className="res-stat-v">{s.v}</div><div className="res-stat-l">{s.l}</div></div>
        ))}
      </div>
{!isObserver && result.canViewFeedback && result.scores && Object.keys(result.scores).length > 0 && (
        <div style={{width:"100%",maxWidth:780,margin:"6px auto 18px",display:"flex",flexDirection:"column",gap:14}}>

          {/* Score Cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
            {[
              {label:"Conceptual Understanding",key:"conceptual_understanding",color:"#00c37a",max:30},
              {label:"Depth of Knowledge",key:"depth_of_knowledge",color:"#2d9cdb",max:25},
              {label:"Presentation Flow",key:"presentation_flow",color:"#7c3aed",max:20},
              {label:"Engagement",key:"engagement",color:"#f6a623",max:15},
              {label:"Hints Penalty",key:"hints_penalty",color:"#e53e3e",max:10,negative:true},
            ].map(s=>(
              <div key={s.key} style={{padding:"14px 16px",borderRadius:14,background:"var(--surf)",border:"1px solid var(--bdr)",textAlign:"center"}}>
                <div style={{fontSize:22,fontWeight:900,color:s.color}}>{s.negative?"-":""}{result.scores[s.key]??"-"}</div>
                <div style={{fontSize:10,fontWeight:700,color:"var(--t2)",marginTop:4,lineHeight:1.4}}>{s.label}</div>
                <div style={{marginTop:8,height:4,borderRadius:4,background:"rgba(255,255,255,.06)"}}>
                  <div style={{height:"100%",borderRadius:4,background:s.color,width:`${Math.min(100,((result.scores[s.key]??0)/s.max)*100)}%`,transition:"width .6s"}}/>
                </div>
              </div>
            ))}
            <div style={{padding:"14px 16px",borderRadius:14,background:"linear-gradient(135deg,rgba(0,195,122,.12),rgba(45,156,219,.12))",border:"1px solid rgba(0,195,122,.25)",textAlign:"center",display:"flex",flexDirection:"column",justifyContent:"center"}}>
              <div style={{fontSize:28,fontWeight:900,color:"var(--em)"}}>{result.scores.total_score??"-"}</div>
              <div style={{fontSize:10,fontWeight:700,color:"var(--t2)",marginTop:4}}>TOTAL SCORE</div>
              {result.hintsUsed>0&&<div style={{fontSize:10,color:"#e53e3e",marginTop:4}}>💡 {result.hintsUsed} hint{result.hintsUsed>1?"s":""} used</div>}
            </div>
          </div>

          {/* Overall Feedback */}
          {result.scores.overall_feedback&&(
            <div style={{padding:"16px 18px",borderRadius:14,background:"var(--surf)",border:"1px solid var(--bdr)"}}>
              <div style={{fontSize:12,fontWeight:800,color:"var(--t1)",marginBottom:8}}>📋 Overall Feedback</div>
              <div style={{fontSize:13,color:"var(--t2)",lineHeight:1.7}}>{result.scores.overall_feedback}</div>
            </div>
          )}

          {/* Strengths & Improvements */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {result.scores.strengths?.length>0&&(
              <div style={{padding:"14px 16px",borderRadius:14,background:"rgba(0,195,122,.06)",border:"1px solid rgba(0,195,122,.18)"}}>
                <div style={{fontSize:12,fontWeight:800,color:"var(--em)",marginBottom:10}}>✅ Strengths</div>
                {result.scores.strengths.map((s,i)=>(
                  <div key={i} style={{fontSize:12,color:"var(--t2)",marginBottom:6,paddingLeft:10,borderLeft:"2px solid rgba(0,195,122,.4)",lineHeight:1.5}}>{s}</div>
                ))}
              </div>
            )}
            {result.scores.improvements?.length>0&&(
              <div style={{padding:"14px 16px",borderRadius:14,background:"rgba(229,62,62,.06)",border:"1px solid rgba(229,62,62,.18)"}}>
                <div style={{fontSize:12,fontWeight:800,color:"var(--red)",marginBottom:10}}>🎯 Areas to Improve</div>
                {result.scores.improvements.map((s,i)=>(
                  <div key={i} style={{fontSize:12,color:"var(--t2)",marginBottom:6,paddingLeft:10,borderLeft:"2px solid rgba(229,62,62,.4)",lineHeight:1.5}}>{s}</div>
                ))}
              </div>
            )}
          </div>

          {/* Topics Mastered & Need Work */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {result.scores.topics_mastered?.length>0&&(
              <div style={{padding:"14px 16px",borderRadius:14,background:"rgba(45,156,219,.06)",border:"1px solid rgba(45,156,219,.18)"}}>
                <div style={{fontSize:12,fontWeight:800,color:"var(--sky)",marginBottom:10}}>🏆 Topics Mastered</div>
                {result.scores.topics_mastered.map((t,i)=>(
                  <div key={i} style={{fontSize:12,color:"var(--t2)",marginBottom:5,paddingLeft:10,borderLeft:"2px solid rgba(45,156,219,.4)",lineHeight:1.5}}>{t}</div>
                ))}
              </div>
            )}
            {result.scores.topics_need_work?.length>0&&(
              <div style={{padding:"14px 16px",borderRadius:14,background:"rgba(246,166,35,.06)",border:"1px solid rgba(246,166,35,.18)"}}>
                <div style={{fontSize:12,fontWeight:800,color:"#f6a623",marginBottom:10}}>📚 Needs More Work</div>
                {result.scores.topics_need_work.map((t,i)=>(
                  <div key={i} style={{fontSize:12,color:"var(--t2)",marginBottom:5,paddingLeft:10,borderLeft:"2px solid rgba(246,166,35,.4)",lineHeight:1.5}}>{t}</div>
                ))}
              </div>
            )}
          </div>

          {/* Topics Covered */}
          {result.topicsCovered?.length>0&&(
            <div style={{padding:"14px 16px",borderRadius:14,background:"var(--surf)",border:"1px solid var(--bdr)"}}>
              <div style={{fontSize:12,fontWeight:800,color:"var(--t1)",marginBottom:10}}>📖 Topics Covered</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {result.topicsCovered.map((t,i)=>(
                  <span key={i} style={{padding:"4px 12px",borderRadius:20,background:"rgba(124,58,237,.1)",border:"1px solid rgba(124,58,237,.22)",fontSize:11,fontWeight:700,color:"var(--vio)"}}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Session Transcript */}
          {result.turns?.filter(t=>t.role==="user").length>0&&(
            <div style={{padding:"14px 16px",borderRadius:14,background:"var(--surf)",border:"1px solid var(--bdr)"}}>
              <div style={{fontSize:12,fontWeight:800,color:"var(--t1)",marginBottom:10}}>🗣️ Session Transcript</div>
              {result.turns.map((turn,i)=>(
                <div key={i} style={{marginBottom:10,paddingBottom:10,borderBottom:"1px solid var(--bdr)"}}>
                  <div style={{fontSize:10,fontWeight:800,color:turn.role==="user"?"var(--em)":"var(--sky)",marginBottom:4}}>
                    {turn.role==="user"?`👤 ${turn.speakerName}`:"🤖 AI Coach"} · {new Date(turn.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}
                  </div>
                  <div style={{fontSize:12,color:"var(--t2)",lineHeight:1.6}}>{turn.message}</div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
      <div className="res-acts">
        {!isObserver&&<button className="btn-s" style={{borderColor:"rgba(0,195,122,.28)",color:"var(--em)"}} onClick={()=>setShowAnalysis(true)}>📊 View Report</button>}
        
        {!isObserver&&<button className="btn-s" style={{borderColor:"rgba(45,156,219,.28)",color:"var(--sky)"}} onClick={handleDownload}>📥 Download Report</button>}
        <button className="btn-p" style={{fontSize:13,width:"auto",padding:"10px 22px"}} onClick={onNew}>🎓 Back</button>
      </div>
      {showFeedbackChat&&(
        <div className="overlay" onClick={()=>setShowFeedbackChat(false)}>
          <div className="modal" style={{maxWidth:680,height:"min(80vh,720px)"}} onClick={(event)=>event.stopPropagation()}>
            <div className="mh"><div className="mh-title">AI Feedback Chat</div><button className="mh-close" onClick={()=>setShowFeedbackChat(false)}>✕</button></div>
            <div className="mb" style={{display:"flex",flexDirection:"column",gap:12,paddingBottom:10}}>
              {feedbackChatMessages.map((message)=>(
                <div key={message.id} style={{display:"flex",justifyContent:message.role==="user"?"flex-end":"flex-start"}}>
                  <div style={{maxWidth:"82%",padding:"12px 14px",borderRadius:16,background:message.role==="user"?"linear-gradient(135deg,#00c37a,#2d9cdb)":"var(--surf2)",color:message.role==="user"?"#fff":"var(--t1)",border:message.role==="user"?"none":"1px solid var(--bdr)"}}>
                    {message.role==="assistant" ? <FormattedAIContent content={message.text} /> : message.text}
                  </div>
                </div>
              ))}
              {feedbackChatLoading&&<div style={{fontSize:12,color:"var(--t2)"}}>AI is thinking…</div>}
            </div>
            <div className="mf" style={{justifyContent:"stretch"}}>
              <textarea className="finput" style={{minHeight:54,flex:1}} placeholder="Ask about your feedback, strengths, or improvements…" value={feedbackChatInput} onChange={(event)=>setFeedbackChatInput(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();sendFeedbackChat();}}}/>
              <button className="btn-p" style={{width:"auto"}} onClick={sendFeedbackChat} disabled={feedbackChatLoading||!feedbackChatInput.trim()}>{feedbackChatLoading?"Sending...":"Send"}</button>
            </div>
          </div>
        </div>
      )}
      {showAnalysis&&<AnalysisModal topic={result.topic} subject={result.subject} unit={result.unit} timer={result.timer} exchanges={result.exchanges||0} presenterName={result.presenterName} onClose={()=>setShowAnalysis(false)} onDownload={handleDownload}/>}
    </div>
  );
}

function AutoAdvance({delay,onDone}) {
  useEffect(()=>{const t=setTimeout(onDone,delay);return()=>clearTimeout(t);},[]);
  return null;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
const POST_AUTH_REDIRECT_KEY = "gradeup_post_auth_redirect";
const SEMINAR_GUEST_NAME_KEY = "gradeup_seminar_guest_name";
const SEMINAR_GUEST_ID_KEY = "gradeup_seminar_guest_id";

function navigateAfterSeminarExit(isGuest){
  window.location.href = isGuest ? "/auth" : "/dashboard";
}

export default function SeminarPage() {
  const { user } = useAuth();
  const [screen,setScreen]=useState("setup");
  const [config,setConfig]=useState(null);
  const [result,setResult]=useState(null);
  const [role,setRole]=useState("student");
  const [pageInitialLoad, setPageInitialLoad] = useState(true);
  const [entrySessionId,setEntrySessionId]=useState("");
  const [showGuestNameModal,setShowGuestNameModal]=useState(false);
  const [guestName,setGuestName]=useState(()=>localStorage.getItem(SEMINAR_GUEST_NAME_KEY) || "");
  const [entryLoading,setEntryLoading]=useState(false);
  const [entryError,setEntryError]=useState(null);
  const autoJoinRef=useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setPageInitialLoad(false), 1500);
    return () => clearTimeout(t);
  }, []);

  async function joinLinkedSeminar(nameOverride){
    const params = new URLSearchParams(window.location.search);
    const linkedSessionId = params.get("sessionId") || params.get("session") || params.get("room") || "";
    if(!linkedSessionId) return;
    setEntryLoading(true);
    setEntryError(null);
    try{
      let candidateId = "";
      let candidateName = "";
      if(user){
        const candidate = getCandidateContext(user || {});
        candidateId = candidate.candidateId;
        candidateName = candidate.candidateName;
      } else {
        const safeName = (nameOverride || guestName || "").trim();
        if(!safeName){
          setShowGuestNameModal(true);
          setScreen("entry");
          setEntryLoading(false);
          return;
        }
        const storedGuestId = localStorage.getItem(SEMINAR_GUEST_ID_KEY) || `guest-${Date.now()}`;
        localStorage.setItem(SEMINAR_GUEST_ID_KEY, storedGuestId);
        localStorage.setItem(SEMINAR_GUEST_NAME_KEY, safeName);
        candidateId = storedGuestId;
        candidateName = safeName;
      }

      const joinedSession = await joinSeminarSession({
        sessionId: linkedSessionId,
        candidateId,
        candidateName,
        role: "observer",
      });

      setConfig({
        name: candidateName,
        candidateId,
        isGuest: !user,
        role: "Observer",
        subject: joinedSession?.subject || joinedSession?.liveSession?.subject || "",
        unit: joinedSession?.unit || joinedSession?.liveSession?.unitTitle || "",
        topic: joinedSession?.topic || joinedSession?.liveSession?.topic || "",
        invitees: [],
        roomId: linkedSessionId,
        roomLink: joinedSession?.shareLink || genRoomLink(linkedSessionId),
        stream: null,
        micOn: false,
        unitId: "",
        sessionId: linkedSessionId,
        liveSession: joinedSession?.liveSession || joinedSession || null,
        seminarMode: "session",
        sessionSubMode: "observer",
        joinSession: joinedSession || null,
      });
      setScreen("loading");
    } catch(error){
      setEntryError(getErrorMessage(error, "Unable to join this seminar session right now."));
      setScreen("entry");
    } finally {
      setEntryLoading(false);
    }
  }

  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const linkedSessionId = params.get("sessionId") || params.get("session") || params.get("room") || "";
    if(!linkedSessionId || autoJoinRef.current) return;
    autoJoinRef.current = true;
    setEntrySessionId(linkedSessionId);
    if(user){
      joinLinkedSeminar().catch(()=>null);
      return;
    }
    setGuestName(localStorage.getItem(SEMINAR_GUEST_NAME_KEY) || "");
    setScreen("entry");
  },[user]);

  function handleLinkLogin(){
    localStorage.setItem(POST_AUTH_REDIRECT_KEY, `${window.location.pathname}${window.location.search}`);
    window.location.href = "/auth";
  }

  function handleGuestContinue(){
    setShowGuestNameModal(true);
  }

  function handleGuestJoin(){
    const trimmed = guestName.trim();
    if(!trimmed){
      setEntryError("Please enter your name to continue as guest.");
      return;
    }
    joinLinkedSeminar(trimmed).catch(()=>null);
    setShowGuestNameModal(false);
  }

  const isRoom=screen==="room"||screen==="loading"||screen==="results-loading"||screen==="results";

  const loaderSteps={
    prepare:[{ic:"🎙️",label:"Enabling voice transcription"},{ic:"🤖",label:"Loading AI coach"},{ic:"📋",label:"Preparing notes board"},{ic:"✅",label:"Room ready"}],
    presenter:[{ic:"🖥️",label:"Setting up screen share"},{ic:"🤖",label:"Initialising AI moderator"},{ic:"🎙️",label:"Enabling live transcript"},{ic:"✅",label:"Seminar room ready"}],
    observer:[{ic:"👁️",label:"Connecting to session"},{ic:"💬",label:"Loading chat"},{ic:"✅",label:"Joined as observer"}],
  };

  function getLoaderSteps(){
    if(!config)return loaderSteps.prepare;
    if(config.seminarMode==="prepare")return loaderSteps.prepare;
    if(config.sessionSubMode==="observer")return loaderSteps.observer;
    return loaderSteps.presenter;
  }

  function handleLaunch(cfg){setConfig(cfg);setScreen("loading");}
  function handleEnd(res){setConfig(null);setResult(res);setScreen("results-loading");}
  function handleNew(){
    setPageInitialLoad(true);
    setResult(null);setConfig(null);setScreen("setup");
    setTimeout(() => setPageInitialLoad(false), 1500);
  }

  if (pageInitialLoad) {
    return (
      <>
        <style>{CSS}</style>
        <div className="sp-app">
          <PageLoader label="Loading SeminarArena" sublabel="Preparing environment..." />
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="sp-app">
        {/* Navigation shown ONLY on setup screen */}
        {screen==="setup"&&<Navigation currentRole={role} onRoleChange={setRole}/>}

        {screen==="entry"&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px",background:"#060e1c"}}>
            <div className="modal" style={{maxWidth:460,width:"100%",background:"#0c1422",border:"1px solid rgba(255,255,255,.1)"}}>
              <div style={{padding:"24px 22px",textAlign:"center",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
                <div style={{fontSize:40,marginBottom:10}}>🎓</div>
                <div style={{fontSize:18,fontWeight:800,color:"#fff",marginBottom:6}}>Join Seminar Session</div>
                <div style={{fontSize:12.5,color:"rgba(255,255,255,.45)",lineHeight:1.7}}>
                  You opened a seminar room link. Continue with your account or join as a guest to enter the waiting room.
                </div>
              </div>
              <div style={{padding:"18px 20px"}}>
                {entryError&&(
                  <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.24)",borderRadius:14,padding:12,color:"#fecaca",fontSize:12.5,lineHeight:1.6,marginBottom:14}}>
                    {entryError}
                  </div>
                )}
                <div style={{padding:"10px 12px",borderRadius:12,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",fontSize:11.5,fontWeight:700,color:"rgba(255,255,255,.7)",marginBottom:14}}>
                  Room ID: <span style={{color:"#5ee3b7"}}>{entrySessionId || parseSeminarSessionId(window.location.href)}</span>
                </div>
                <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                  <button className="btn-p" style={{width:"auto"}} onClick={handleLinkLogin} disabled={entryLoading}>Login</button>
                  <button className="btn-s" onClick={handleGuestContinue} disabled={entryLoading}>Continue as Guest</button>
                </div>
              </div>

              {showGuestNameModal&&(
                <div className="overlay">
                  <div className="modal" style={{maxWidth:380}}>
                    <div className="mh">
                      <div className="mh-title">Continue as Guest</div>
                      <button className="mh-close" onClick={()=>setShowGuestNameModal(false)}>✕</button>
                    </div>
                    <div className="mb">
                      <label className="fl">Your Name</label>
                      <input className="finput" value={guestName} onChange={(event)=>setGuestName(event.target.value)} placeholder="Enter your display name" maxLength={40}/>
                    </div>
                    <div className="mf">
                      <button className="btn-s" onClick={()=>setShowGuestNameModal(false)}>Cancel</button>
                      <button className="btn-p" style={{width:"auto"}} onClick={handleGuestJoin} disabled={entryLoading}>
                        {entryLoading ? "Joining..." : "Join Waiting Room"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {screen==="loading"&&config&&(
          <>
            <PageLoader
              label={config.seminarMode==="prepare"?"Entering AI Coach Room…":config.sessionSubMode==="observer"?"Joining as Observer…":"Launching Seminar Room…"}
              sublabel={config.seminarMode==="prepare"?"Setting up voice transcription & AI coach":config.sessionSubMode==="observer"?"Connecting to live session":"Preparing screen share & AI moderator"}
              steps={getLoaderSteps()}
            />
            <AutoAdvance delay={2600} onDone={()=>setScreen("room")}/>
          </>
        )}

        {screen==="setup"&&(
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",minHeight:0}}>
            <SeminarSetupIntegrated onLaunch={handleLaunch}/>
          </div>
        )}

        {screen==="room"&&config&&config.seminarMode==="prepare"&&<PrepareWithAIRoom config={config} onEnd={handleEnd}/>}
        {screen==="room"&&config&&config.seminarMode==="session"&&config.sessionSubMode==="presenter"&&<PresenterRoom config={config} onEnd={handleEnd}/>}
        {screen==="room"&&config&&config.seminarMode==="session"&&config.sessionSubMode==="observer"&&<ObserverRoom config={config} onEnd={handleEnd}/>}

        {screen==="results-loading"&&result&&<ResultsLoader onDone={()=>setScreen("results")} isObserver={result.modeType==="observer"}/>}
        {screen==="results"&&result&&<SeminarResults result={result} onNew={handleNew}/>}
      </div>
    </>
  );
}
