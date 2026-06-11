import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useToast } from "../hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import { Textarea } from "../components/ui/textarea";
import { useIsMobile } from "../hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "../components/ui/resizable";
import {
  ImperativePanelGroupHandle,
  ImperativePanelHandle,
} from "react-resizable-panels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import FunnyLoader from "../components/ui/FunnyLoader";
import {
  BookOpen,
  Bot,
  Brain,
  GraduationCap,
  History,
  Mic,
  MicOff,
  Pause,
  Play,
  Send,
  User,
  VolumeX,
  Wand2,
  BookCheck,
  ClipboardList,
  Database,
  HelpCircle,
  Menu,
  Speech,
  Paperclip,
  Image,
  FileText,
  Trash,
  Calculator,
  Atom,
  FlaskConical,
  Dna,
  Feather,
  Scroll,
  Code,
  Target,
  Book,
  X,
  ChevronRight,
  ChevronLeft,
  Lightbulb,
  Sparkles,
  Zap,
  Star,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Volume2,
  RefreshCw,
  Plus,
  ChevronDown,
} from "lucide-react";
import SubjectSelection from "../components/SubjectSelection";
import AITutorHeader from "../components/AITutorHeader";
import FAQPanel from "../components/FAQPanel";
import AskAIPanel from "../components/AskAIPanel";
import { ChatHistoryPanel } from "../components/ChatHistoryPanel";
import FormattedAIContent from "../components/ai/FormattedAIContent";
import { useAuth } from "../hooks/use-auth";
import Navigation from "../components/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  askTutor,
  clearTutorHistory,
  getCandidateContext,
  getLibrarySubjects,
  getTutorConversation,
  getTutorConversations,
  type LibrarySubject,
} from "../lib/gradeupApi";
import { buildApiUrl } from "../lib/apiBase";

// ── Typing Markdown Component ──────────────────────────────────────────────────
function TypingMarkdown({ content, isLast }: { content: string; isLast: boolean }) {
  const [displayedContent, setDisplayedContent] = useState(isLast ? "" : content);

  useEffect(() => {
    if (!isLast) {
      setDisplayedContent(content);
      return;
    }
    
    let index = 0;
    const charsPerTick = Math.max(1, Math.floor(content.length / 50)); 
    
    const interval = setInterval(() => {
      index += charsPerTick;
      if (index >= content.length) {
        index = content.length;
        clearInterval(interval);
      }
      setDisplayedContent(content.slice(0, index));
    }, 20);

    return () => clearInterval(interval);
  }, [content, isLast]);

  useEffect(() => {
    if (isLast) {
      // Use requestAnimationFrame to ensure DOM is fully painted
      requestAnimationFrame(() => {
        const scrollEls = document.querySelectorAll('.at-msgs-area');
        scrollEls.forEach(el => {
          el.scrollTop = el.scrollHeight + 100; // Adding buffer to ensure bottom
        });
      });
    }
  }, [displayedContent, isLast]);

  return <FormattedAIContent value={displayedContent} />;
}

// ── Types ──────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  subject?: string;
  unit?: string;
  attachments?: { name: string; type: string; size: number }[];
  audioSrc?: string;
}

export interface ChatHistory {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastUpdated: Date;
  subject?: string;
  unit?: string;
}

// ── Design tokens ──────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

/* ── Root ── */
.at-root {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  background: #f8fafc;
  height: 100vh;
  height: 100dvh;
  max-height: 100dvh;
  width: 100%;
  display: flex;
  flex-direction: column;
  color: #0f172a;
  overflow: hidden;
  position: fixed;
  inset: 0;
}
.dark .at-root { background: #0f172a; color: #f1f5f9; }

/* ── Scrollbar ── */
.at-scroll::-webkit-scrollbar { width: 4px; }
.at-scroll::-webkit-scrollbar-track { background: transparent; }
.at-scroll::-webkit-scrollbar-thumb { background: rgba(99,102,241,.3); border-radius: 4px; }
.at-scroll { scrollbar-width: thin; scrollbar-color: rgba(99,102,241,.3) transparent; }

/* ── Layout wrapper ── */
.at-layout-wrap {
  flex: 1;
  overflow: hidden;
  padding: 8px 8px 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ══════════════════════════════════════════
   PANELS
══════════════════════════════════════════ */
.at-panel {
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 2px 12px rgba(0,0,0,.05);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  min-height: 0;
  transition: box-shadow .2s;
}
.at-panel:hover { box-shadow: 0 4px 24px rgba(0,0,0,.08); }
.dark .at-panel { background: #1e293b; border-color: rgba(255,255,255,.08); }

.at-panel-head {
  padding: 14px 16px 12px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
  min-height: 56px;
}
.dark .at-panel-head { border-color: rgba(255,255,255,.06); }

/* ── Collapsed panel head ── center the toggle */
.at-panel-head.collapsed {
  justify-content: center;
  padding: 14px 10px 12px;
}

.at-panel-title {
  font-size: 13.5px;
  font-weight: 800;
  color: #0f172a;
  display: flex;
  align-items: center;
  gap: 8px;
  letter-spacing: -.2px;
  flex: 1;
}
.dark .at-panel-title { color: #f1f5f9; }

.at-panel-sub {
  font-size: 11px;
  color: #64748b;
  margin-top: 1px;
}

/* ── Panel toggle button ── */
.at-toggle-btn {
  width: 30px; height: 30px;
  border-radius: 9px;
  background: rgba(99,102,241,.08);
  border: 1.5px solid rgba(99,102,241,.2);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #6366f1;
  transition: all .2s;
  flex-shrink: 0;
}
.at-toggle-btn:hover {
  background: rgba(99,102,241,.15);
  border-color: rgba(99,102,241,.4);
  transform: scale(1.06);
}

/* ── Icon pill ── */
.at-icon-pill {
  width: 38px; height: 38px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
  transition: transform .2s;
}
.at-icon-blue   { background: rgba(99,102,241,.1);  color: #6366f1; }
.at-icon-green  { background: rgba(16,185,129,.1);  color: #10b981; }
.at-icon-purple { background: rgba(139,92,246,.1);  color: #8b5cf6; }
.at-icon-amber  { background: rgba(245,158,11,.1);  color: #f59e0b; }

/* ══════════════════════════════════════════
   LEFT PANEL
══════════════════════════════════════════ */
.at-left-body {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

.at-select-label {
  font-size: 10px; font-weight: 800; color: #94a3b8;
  text-transform: uppercase; letter-spacing: .08em;
  margin-bottom: 5px;
}
.at-select-wrap { position: relative; }
.at-select-wrap select {
  width: 100%; padding: 8px 12px; padding-right: 30px;
  border-radius: 10px; border: 1.5px solid #e2e8f0;
  background: #f8fafc; color: #0f172a;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 12px; font-weight: 600;
  appearance: none; cursor: pointer;
  transition: all .18s;
}
.at-select-wrap select:focus {
  outline: none; border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99,102,241,.12);
}
.at-select-wrap select:hover { border-color: #6366f1; }
.at-select-arrow {
  position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
  pointer-events: none; color: #6366f1;
}
.dark .at-select-wrap select {
  background: #0f172a; border-color: rgba(255,255,255,.1); color: #f1f5f9;
}

.at-divider { height: 1px; background: #f1f5f9; }
.dark .at-divider { background: rgba(255,255,255,.06); }

/* ── History section — fills remaining space ── */
.at-hist-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.at-hist-section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  flex-shrink: 0;
}

/* Scrollable list */
.at-hist-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 2px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 0;
}

.at-hist-footer {
  flex-shrink: 0;
  padding-top: 8px;
}

.at-new-chat-icon-btn {
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 7px; border: 1.5px solid #e2e8f0;
  background: #fff; cursor: pointer; transition: all .2s;
  color: #64748b;
}
.at-new-chat-icon-btn:hover {
  background: #f1f5f9; border-color: #6366f1; color: #6366f1;
  transform: scale(1.05);
}

/* History item */
.at-hist-item {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 9px 10px; border-radius: 11px;
  border: 1.5px solid transparent;
  cursor: pointer; transition: all .18s;
  background: #fafafa;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}
.at-hist-item:hover { background: #fff; border-color: #e0e7ff; box-shadow: 0 2px 8px rgba(99,102,241,.08); }
.at-hist-item.active { background: rgba(99,102,241,.08); border-color: rgba(99,102,241,.25); }
.dark .at-hist-item { background: rgba(255,255,255,.03); }
.dark .at-hist-item.active { background: rgba(99,102,241,.15); }

.at-hist-title {
  font-size: 12px; font-weight: 600; color: #0f172a;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  /* Marquee on hover */
  display: block;
  position: relative;
}
.at-hist-item:hover .at-hist-title {
  animation: marqueeText 4s linear infinite;
  /* only if text is actually truncated - handled via JS check below */
}
@keyframes marqueeText {
  0%   { transform: translateX(0); }
  30%  { transform: translateX(0); }
  70%  { transform: translateX(var(--marquee-offset, -30%)); }
  100% { transform: translateX(0); }
}

.dark .at-hist-title { color: #f1f5f9; }
.at-hist-meta { font-size: 10.5px; color: #94a3b8; }
.at-hist-del {
  width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0;
  background: none; border: none; cursor: pointer; color: #94a3b8;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s; margin-left: auto; margin-top: 1px;
}
.at-hist-del:hover { background: rgba(239,68,68,.1); color: #ef4444; }

.at-clear-btn {
  width: 100%; padding: 7px;
  border-radius: 9px; border: 1.5px solid rgba(239,68,68,.2);
  background: rgba(239,68,68,.04); color: #ef4444;
  font-size: 11.5px; font-weight: 700;
  cursor: pointer; font-family: inherit;
  transition: all .18s;
}
.at-clear-btn:hover { background: rgba(239,68,68,.1); border-color: rgba(239,68,68,.4); }

/* ══════════════════════════════════════════
   MAIN CHAT PANEL
══════════════════════════════════════════ */
.at-chat-header {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  padding: 12px 16px;
  position: relative; overflow: hidden;
  flex-shrink: 0;
  border-radius: 20px 20px 0 0;
}
.at-chat-header::before {
  content: ''; position: absolute; top: -40px; right: -40px;
  width: 120px; height: 120px; border-radius: 50%;
  background: rgba(255,255,255,.1); pointer-events: none;
}
.at-chat-header-inner {
  position: relative; z-index: 1;
  display: flex; align-items: center; gap: 12px;
  justify-content: space-between;
}
.at-chat-avatar {
  width: 40px; height: 40px; border-radius: 13px;
  background: rgba(255,255,255,.2);
  border: 2px solid rgba(255,255,255,.4);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 18px;
}
.at-chat-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 20px;
  background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.28);
  font-size: 10px; font-weight: 700; color: #fff; margin-bottom: 3px;
}
.at-chat-title { font-size: 15px; font-weight: 800; color: #fff; line-height: 1.2; }
.at-chat-sub { font-size: 11px; color: rgba(255,255,255,.7); margin-top: 1px; }
.at-chat-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.at-hbtn {
  padding: 6px 12px; border-radius: 9px; border: none;
  background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.28);
  color: #fff; font-size: 11.5px; font-weight: 700;
  cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 5px;
  transition: all .2s; backdrop-filter: blur(6px); white-space: nowrap;
}
.at-hbtn:hover { background: rgba(255,255,255,.28); transform: translateY(-1px); }
.at-hbtn.white { background: #fff; color: #6366f1; box-shadow: 0 3px 10px rgba(0,0,0,.15); }
.at-hbtn.white:hover { background: #f5f3ff; transform: translateY(-2px); }

/* ── Messages area ── */
.at-msgs-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

/* Empty state */
.at-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1; padding: 32px 20px; text-align: center;
}
.at-empty-icon {
  width: 68px; height: 68px; border-radius: 20px; margin: 0 auto 14px;
  background: linear-gradient(135deg, rgba(99,102,241,.12), rgba(139,92,246,.12));
  border: 2px solid rgba(99,102,241,.15);
  display: flex; align-items: center; justify-content: center; font-size: 30px;
  animation: floatIcon 3s ease-in-out infinite;
}
@keyframes floatIcon {
  0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)}
}
.at-empty-title { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
.dark .at-empty-title { color: #f1f5f9; }
.at-empty-sub { font-size: 13px; color: #64748b; line-height: 1.55; max-width: 280px; }
.at-empty-chips { display: flex; flex-wrap: wrap; gap: 7px; justify-content: center; margin-top: 16px; }
.at-chip {
  padding: 7px 13px; border-radius: 20px; font-size: 11.5px; font-weight: 600;
  background: rgba(99,102,241,.08); border: 1.5px solid rgba(99,102,241,.2); color: #6366f1;
  cursor: pointer; transition: all .18s; font-family: inherit;
}
.at-chip:hover { background: rgba(99,102,241,.15); border-color: rgba(99,102,241,.4); transform: translateY(-1px); }

/* Message bubbles */
.at-msg-row { display: flex; gap: 9px; align-items: flex-end; }
.at-msg-row.user { flex-direction: row-reverse; }

.at-msg-avatar {
  width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
}
.at-msg-avatar.bot {
  background: linear-gradient(135deg, rgba(99,102,241,.12), rgba(139,92,246,.12));
  border: 1.5px solid rgba(99,102,241,.2);
}
.at-msg-avatar.user-av {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff; font-size: 12px; font-weight: 800;
  box-shadow: 0 3px 10px rgba(99,102,241,.35);
}

.at-bubble {
  max-width: 74%; padding: 11px 14px; border-radius: 18px;
  font-size: 13.5px; line-height: 1.6; position: relative;
}
.at-bubble.bot {
  background: #fff; border: 1.5px solid #f1f5f9;
  color: #0f172a; border-radius: 4px 18px 18px 18px;
  box-shadow: 0 2px 8px rgba(0,0,0,.05);
}
.dark .at-bubble.bot {
  background: #1e293b; border-color: rgba(255,255,255,.08); color: #f1f5f9;
}
.at-bubble.user {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff; border-radius: 18px 4px 18px 18px;
  box-shadow: 0 4px 14px rgba(99,102,241,.3);
}

.at-bubble-footer {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 8px; padding-top: 8px;
  border-top: 1px solid rgba(0,0,0,.05); gap: 8px;
}
.at-bubble.user .at-bubble-footer { border-top-color: rgba(255,255,255,.2); }
.at-bubble-time { font-size: 10px; opacity: .6; }
.at-speak-btn {
  width: 24px; height: 24px; border-radius: 7px; border: none; background: rgba(0,0,0,.06);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: #64748b; transition: all .15s;
}
.at-speak-btn:hover { background: rgba(99,102,241,.1); color: #6366f1; }
.at-bubble.user .at-speak-btn { background: rgba(255,255,255,.15); color: rgba(255,255,255,.8); }
.at-bubble.user .at-speak-btn:hover { background: rgba(255,255,255,.25); }

/* Typing indicator */
.at-typing { display: flex; gap: 5px; align-items: center; padding: 4px 2px; }
.at-typing span {
  width: 7px; height: 7px; border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  animation: typingBounce 1.2s ease-in-out infinite;
}
.at-typing span:nth-child(2) { animation-delay: .15s; }
.at-typing span:nth-child(3) { animation-delay: .3s; }
@keyframes typingBounce {
  0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-7px)}
}

/* ── Input area ── */
.at-input-area {
  padding: 12px 14px 14px;
  border-top: 1px solid #f1f5f9;
  flex-shrink: 0; background: #fff;
  border-radius: 0 0 20px 20px;
}
.dark .at-input-area { background: #1e293b; border-color: rgba(255,255,255,.06); }

.at-attachments { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 7px; }
.at-attach-chip {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 7px; font-size: 11px;
  background: rgba(99,102,241,.08); border: 1.5px solid rgba(99,102,241,.2);
  color: #6366f1; font-weight: 600;
}
.at-attach-del {
  background: none; border: none; cursor: pointer;
  color: #94a3b8; display: flex; align-items: center; transition: color .15s;
}
.at-attach-del:hover { color: #ef4444; }

.at-textarea-wrap { position: relative; }
.at-textarea {
  width: 100%; padding: 11px 15px; padding-right: 128px;
  border-radius: 13px; border: 1.5px solid #e2e8f0;
  background: #f8fafc; color: #0f172a;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 13px; font-weight: 500; resize: none;
  min-height: 48px; max-height: 130px;
  line-height: 1.5; transition: all .18s;
}
.at-textarea:focus {
  outline: none; border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99,102,241,.1);
  background: #fff;
}
.at-textarea::placeholder { color: #94a3b8; }
.dark .at-textarea { background: #0f172a; border-color: rgba(255,255,255,.1); color: #f1f5f9; }
.dark .at-textarea:focus { background: rgba(99,102,241,.05); }

.at-input-actions {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  display: flex; align-items: center; gap: 3px;
}
.at-iabtn {
  width: 30px; height: 30px; border-radius: 8px; border: none;
  background: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #94a3b8; transition: all .18s;
}
.at-iabtn:hover { background: rgba(99,102,241,.08); color: #6366f1; transform: scale(1.08); }
.at-iabtn:disabled { opacity: .4; pointer-events: none; }
.at-iabtn.active { color: #ef4444; background: rgba(239,68,68,.08); }

.at-send-btn {
  padding: 7px 14px; border-radius: 10px; border: none;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff; font-size: 12px; font-weight: 700;
  cursor: pointer; font-family: inherit;
  display: flex; align-items: center; gap: 4px;
  box-shadow: 0 3px 10px rgba(99,102,241,.3);
  transition: all .2s; white-space: nowrap;
}
.at-send-btn:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(99,102,241,.4); }
.at-send-btn:disabled { opacity: .5; pointer-events: none; }

/* Recording bar */
.at-recording-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 12px; border-radius: 13px;
  background: linear-gradient(135deg, rgba(239,68,68,.06), rgba(245,158,11,.06));
  border: 1.5px solid rgba(239,68,68,.2); gap: 10px;
}
.at-rec-dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; animation: recPulse 1s ease-in-out infinite; }
@keyframes recPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
.at-rec-time { font-size: 13px; font-weight: 700; color: #ef4444; font-variant-numeric: tabular-nums; }

/* Error banner */
.at-error-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 10px; margin: 8px 16px 0;
  background: rgba(239,68,68,.06); border: 1px solid rgba(239,68,68,.2);
  font-size: 12px; color: #ef4444; font-weight: 600; flex-shrink: 0;
}

/* ══════════════════════════════════════════
   RIGHT PANEL — Mind Lab
══════════════════════════════════════════ */
.at-mindlab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 14px; }
.at-ml-card {
  border-radius: 14px; padding: 16px 12px; text-align: center;
  border: 1.5px solid transparent; position: relative; overflow: hidden;
  cursor: pointer; transition: all .22s cubic-bezier(.34,1.56,.64,1);
  background: #fff;
}
.at-ml-card:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 10px 28px rgba(0,0,0,.1); }
.at-ml-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: 3px 3px 0 0; }
.at-ml-card.blue   { background: rgba(99,102,241,.05); border-color: rgba(99,102,241,.2); }
.at-ml-card.blue::before { background: linear-gradient(90deg,#6366f1,#8b5cf6); }
.at-ml-card.indigo { background: rgba(79,70,229,.05); border-color: rgba(79,70,229,.2); }
.at-ml-card.indigo::before { background: linear-gradient(90deg,#4f46e5,#7c3aed); }
.at-ml-card.orange { background: rgba(245,158,11,.05); border-color: rgba(245,158,11,.2); }
.at-ml-card.orange::before { background: linear-gradient(90deg,#f59e0b,#f97316); }
.at-ml-card.col2 { grid-column: span 2; }
.dark .at-ml-card { background: rgba(255,255,255,.03); }
.at-ml-icon { font-size: 28px; margin-bottom: 7px; display: block; }
.at-ml-name { font-size: 12.5px; font-weight: 800; color: #0f172a; margin-bottom: 2px; }
.dark .at-ml-name { color: #f1f5f9; }
.at-ml-desc { font-size: 10.5px; color: #94a3b8; line-height: 1.4; }

/* Context card */
.at-ctx-card {
  margin: 10px 12px 0;
  padding: 10px 13px; border-radius: 13px;
  background: linear-gradient(135deg, rgba(99,102,241,.08), rgba(139,92,246,.06));
  border: 1.5px solid rgba(99,102,241,.18);
}
.at-ctx-label { font-size: 9.5px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 3px; }
.at-ctx-val { font-size: 12.5px; font-weight: 700; color: #0f172a; }
.dark .at-ctx-val { color: #f1f5f9; }
.at-ctx-note { font-size: 10.5px; color: #64748b; margin-top: 2px; }

/* ══════════════════════════════════════════
   TOOLTIP
══════════════════════════════════════════ */
.at-tip-wrap { position: relative; }
.at-tooltip {
  position: fixed; z-index: 9999;
  background: #1e293b; border: 1px solid rgba(99,102,241,.4);
  color: #f1f5f9; font-size: 11px; font-weight: 600;
  padding: 4px 10px; border-radius: 7px; white-space: nowrap;
  box-shadow: 0 6px 20px rgba(0,0,0,.4);
  pointer-events: none; opacity: 0;
  transition: opacity .15s, transform .15s;
  transform: translateX(-4px);
}
.at-tooltip.vis { opacity: 1; transform: translateX(0); }
.at-tooltip::before {
  content: ''; position: absolute; right: 100%; top: 50%; transform: translateY(-50%);
  border: 5px solid transparent; border-right-color: rgba(99,102,241,.4);
}

/* ══════════════════════════════════════════
   TUTORIAL OVERLAY
══════════════════════════════════════════ */
@keyframes tutPulse {
  0%,100%{box-shadow:0 0 0 3px rgba(99,102,241,.25);}
  50%{box-shadow:0 0 0 8px rgba(99,102,241,.08);}
}

/* ══════════════════════════════════════════
   BOTTOM NAV (mobile)
══════════════════════════════════════════ */
.at-bottom-nav {
  display: none;
  justify-content: space-around; align-items: center;
  padding: 6px 8px;
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 6px);
  border-top: 1px solid #f1f5f9;
  background: #fff; flex-shrink: 0;
}
.dark .at-bottom-nav { background: #1e293b; border-color: rgba(255,255,255,.06); }
.at-bnav-btn {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  flex: 1; padding: 5px 3px; border-radius: 10px;
  border: none; background: none; cursor: pointer;
  color: #94a3b8; font-family: inherit; font-size: 9.5px; font-weight: 600;
  transition: all .18s;
}
.at-bnav-btn:hover { color: #6366f1; background: rgba(99,102,241,.06); }
.at-bnav-btn.active { color: #6366f1; background: rgba(99,102,241,.08); }
.at-bnav-btn:active { transform: scale(.94); }
.at-bnav-icon {
  width: 28px; height: 28px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; transition: all .18s;
}
.at-bnav-btn:hover .at-bnav-icon { transform: translateY(-2px); }

/* ══════════════════════════════════════════
   ANIMATIONS
══════════════════════════════════════════ */
@keyframes slideInLeft  { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:none} }
@keyframes slideInRight { from{opacity:0;transform:translateX(16px)}  to{opacity:1;transform:none} }
@keyframes fadeUp       { from{opacity:0;transform:translateY(10px)}  to{opacity:1;transform:none} }
@keyframes scaleIn      { from{opacity:0;transform:scale(.95)}        to{opacity:1;transform:scale(1)} }

/* ══════════════════════════════════════════
   RESIZABLE HANDLE
══════════════════════════════════════════ */
[data-panel-group-direction="horizontal"] > [data-panel-resize-handle-id] {
  width: 6px !important;
  background: transparent;
  transition: background .2s;
  position: relative;
}
[data-panel-group-direction="horizontal"] > [data-panel-resize-handle-id]:hover,
[data-panel-group-direction="horizontal"] > [data-panel-resize-handle-id][data-resize-handle-state="drag"] {
  background: rgba(99,102,241,.08);
}
[data-panel-group-direction="horizontal"] > [data-panel-resize-handle-id]::after {
  content: '';
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%,-50%);
  width: 4px; height: 28px;
  border-radius: 4px;
  background: rgba(99,102,241,.22);
  transition: all .2s;
}
[data-panel-group-direction="horizontal"] > [data-panel-resize-handle-id]:hover::after,
[data-panel-group-direction="horizontal"] > [data-panel-resize-handle-id][data-resize-handle-state="drag"]::after {
  height: 44px; background: rgba(99,102,241,.45);
}

/* Collapsed panel icon column */
.at-collapsed-icons {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; padding: 14px 0; flex: 1;
}
.at-col-icon {
  width: 34px; height: 34px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(99,102,241,.08); color: #6366f1;
  font-size: 15px; cursor: pointer; transition: all .18s;
}
.at-col-icon:hover { background: rgba(99,102,241,.15); transform: scale(1.08); }

/* ══════════════════════════════════════════
   RESPONSIVE
══════════════════════════════════════════ */
@media(max-width:1023px){
  .at-bottom-nav { display: flex; }
  .at-desktop-only { display: none !important; }
  .at-mobile-chat { height: 100%; display: flex; flex-direction: column; }
}
@media(min-width:1024px){
  .at-mobile-only { display: none !important; }
}
@media(max-width:767px){
  .at-bubble { max-width: 86%; font-size: 13px; }
  .at-chat-title { font-size: 13px; }
  .at-mindlab-grid { grid-template-columns: 1fr 1fr; gap: 8px; padding: 10px; }
  .at-layout-wrap { padding: 6px 6px 0; }
  .at-msgs-area { padding: 12px; gap: 11px; }
  .at-input-area { padding: 10px 11px 12px; }
  .at-hbtn span { display: none; }
  .at-chat-header { padding: 10px 12px; }
}
@media(max-width:479px){
  .at-bubble { max-width: 91%; }
  .at-textarea { padding-right: 115px; }
  .at-chat-avatar { width: 34px; height: 34px; font-size: 15px; }
}

/* Full height mobile fix */
@media(max-width:1023px){
  .at-root {
    height: 100dvh;
    max-height: 100dvh;
  }
}
`;

// ── Subject map ─────────────────────────────────────────────────────────────
const formattedSubjects: {
  value: string;
  label: string;
  icon: React.ElementType;
  color: string;
  id: number;
  emoji: string;
}[] = [
  {
    value: "all",
    label: "All Subjects",
    icon: Target,
    color: "bg-gradient-to-r from-purple-500 to-pink-500",
    id: 0,
    emoji: "🎯",
  },
  ...([] as Array<{ name: string; id: number }>).map((subject) => {
    let icon: React.ElementType = Book;
    let color = "bg-gradient-to-r from-gray-500 to-gray-600";
    let emoji = "📖";
    switch (subject.name.toLowerCase()) {
      case "mathematics":
        icon = Calculator;
        color = "bg-gradient-to-r from-blue-500 to-cyan-500";
        emoji = "🧮";
        break;
      case "physics":
        icon = Atom;
        color = "bg-gradient-to-r from-green-500 to-teal-500";
        emoji = "⚡";
        break;
      case "chemistry":
        icon = FlaskConical;
        color = "bg-gradient-to-r from-red-500 to-orange-500";
        emoji = "🧪";
        break;
      case "biology":
        icon = Dna;
        color = "bg-gradient-to-r from-emerald-500 to-green-500";
        emoji = "🌿";
        break;
      case "english literature":
        icon = Feather;
        color = "bg-gradient-to-r from-indigo-500 to-purple-500";
        emoji = "✍️";
        break;
      case "history":
        icon = Scroll;
        color = "bg-gradient-to-r from-amber-500 to-yellow-500";
        emoji = "📜";
        break;
      case "computer science":
        icon = Code;
        color = "bg-gradient-to-r from-slate-500 to-gray-500";
        emoji = "💻";
        break;
    }
    return {
      value: subject.name.toLowerCase().replace(/\s/g, "_"),
      label: subject.name,
      icon,
      color,
      id: subject.id,
      emoji,
    };
  }),
];

function generateChatTitle(
  messages: ChatMessage[],
  subject?: string,
  unit?: string,
): string {
  const userMsg = messages.find((m) => m.type === "user");
  if (userMsg) {
    const c = userMsg.content;
    return c.length > 32 ? c.substring(0, 32) + "…" : c;
  }
  if (unit) return `${subject}: ${unit}`;
  if (subject) return `${subject}: General`;
  return "New Chat";
}

// ══════════════════════════════════════════════════════════════════════════
// TUTORIAL
// ══════════════════════════════════════════════════════════════════════════
const TUTORIAL_STEPS = [
  {
    id: "history",
    title: "📚 Chat History",
    desc: "Tap here to see all your past conversations. Switch between chats or start fresh.",
    target: "tut-history-btn",
    arrow: "right",
  },
  {
    id: "subjects",
    title: "🎓 Subjects",
    desc: "Tap here to go back and choose a different subject or unit to study.",
    target: "tut-subjects-btn",
    arrow: "up",
  },
  {
    id: "studio",
    title: "🧪 Mind Lab",
    desc: "Access powerful tools — take a Quiz, browse the Question Bank, or read FAQs.",
    target: "tut-studio-btn",
    arrow: "left",
  },
  {
    id: "mic",
    title: "🎤 Voice Input",
    desc: "Use your microphone to speak your question instead of typing.",
    target: "tut-mic-btn",
    arrow: "down",
  },
  {
    id: "attach",
    title: "📎 Attach Files",
    desc: "Upload images or documents. The AI Tutor will read and explain them for you.",
    target: "tut-attach-btn",
    arrow: "down",
  },
  {
    id: "send",
    title: "✉️ Send Message",
    desc: "Type your question and tap Send (or press Enter) to ask the AI Tutor.",
    target: "tut-send-btn",
    arrow: "down",
  },
];

const TutorialTooltip = ({
  step,
  stepIndex,
  total,
  onNext,
  onPrev,
  onSkip,
  targetRect,
}: {
  step: (typeof TUTORIAL_STEPS)[0];
  stepIndex: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  targetRect: DOMRect | null;
}) => {
  if (!targetRect) return null;
  const vw = window.innerWidth,
    vh = window.innerHeight;
  const tooltipW = Math.min(280, vw - 32);
  let left = targetRect.left + targetRect.width / 2 - tooltipW / 2;
  left = Math.max(16, Math.min(left, vw - tooltipW - 16));
  const spaceAbove = targetRect.top,
    spaceBelow = vh - targetRect.bottom;
  const showAbove = spaceAbove > 160 || spaceAbove > spaceBelow;
  const arrowLeft = targetRect.left + targetRect.width / 2 - left;
  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: Math.max(0, targetRect.top - 6),
            background: "rgba(0,0,0,.55)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: targetRect.bottom + 6,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,.55)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: targetRect.top - 6,
            left: 0,
            width: Math.max(0, targetRect.left - 6),
            height: targetRect.height + 12,
            background: "rgba(0,0,0,.55)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: targetRect.top - 6,
            left: targetRect.right + 6,
            right: 0,
            height: targetRect.height + 12,
            background: "rgba(0,0,0,.55)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            borderRadius: 12,
            border: "2.5px solid #6366f1",
            animation: "tutPulse 1.4s ease-in-out infinite",
          }}
        />
      </div>
      <div
        style={{
          position: "fixed",
          zIndex: 9999,
          left,
          ...(showAbove
            ? { bottom: vh - targetRect.top + 12 }
            : { top: targetRect.bottom + 12 }),
          width: tooltipW,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 8px 32px rgba(0,0,0,.22)",
          border: "1.5px solid rgba(99,102,241,.2)",
          padding: "13px 15px 11px",
          fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: Math.max(12, Math.min(arrowLeft - 7, tooltipW - 28)),
            ...(showAbove
              ? {
                  bottom: -8,
                  borderTop: "8px solid #fff",
                  borderLeft: "8px solid transparent",
                  borderRight: "8px solid transparent",
                }
              : {
                  top: -8,
                  borderBottom: "8px solid #fff",
                  borderLeft: "8px solid transparent",
                  borderRight: "8px solid transparent",
                }),
            width: 0,
            height: 0,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a" }}>
            {step.title}
          </div>
          <button
            onClick={onSkip}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 11.5,
              color: "#94a3b8",
              fontFamily: "inherit",
              padding: "2px 6px",
              borderRadius: 5,
            }}
          >
            Skip
          </button>
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "#475569",
            lineHeight: 1.55,
            marginBottom: 11,
          }}
        >
          {step.desc}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 4 }}>
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === stepIndex ? 16 : 5,
                  height: 5,
                  borderRadius: 5,
                  background: i === stepIndex ? "#6366f1" : "#e2e8f0",
                  transition: "all .3s",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {stepIndex > 0 && (
              <button
                onClick={onPrev}
                style={{
                  padding: "5px 11px",
                  borderRadius: 8,
                  border: "1.5px solid #e2e8f0",
                  background: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "#64748b",
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={onNext}
              style={{
                padding: "5px 13px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 11.5,
                fontWeight: 700,
                color: "#fff",
              }}
            >
              {stepIndex === total - 1 ? "Done ✓" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

function useTutorial(isMobile: boolean) {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!isMobile) return;
    if (!localStorage.getItem("ai-tutor-tutorial-seen"))
      setTimeout(() => setActive(true), 800);
  }, [isMobile]);
  const measureTarget = useCallback((id: string) => {
    const el = document.getElementById(id);
    setTargetRect(el ? el.getBoundingClientRect() : null);
  }, []);
  useEffect(() => {
    if (!active) return;
    const step = TUTORIAL_STEPS[stepIdx];
    if (step) {
      const t = setTimeout(() => measureTarget(step.target), 120);
      return () => clearTimeout(t);
    }
  }, [active, stepIdx, measureTarget]);
  useEffect(() => {
    if (!active) return;
    const handle = () => measureTarget(TUTORIAL_STEPS[stepIdx].target);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [active, stepIdx, measureTarget]);
  const start = () => {
    setStepIdx(0);
    setActive(true);
  };
  const skip = () => {
    setActive(false);
    localStorage.setItem("ai-tutor-tutorial-seen", "1");
  };
  const next = () => {
    if (stepIdx < TUTORIAL_STEPS.length - 1) setStepIdx((s) => s + 1);
    else {
      setActive(false);
      localStorage.setItem("ai-tutor-tutorial-seen", "1");
    }
  };
  const prev = () => {
    if (stepIdx > 0) setStepIdx((s) => s - 1);
  };
  return {
    active,
    stepIdx,
    targetRect,
    start,
    skip,
    next,
    prev,
    currentStep: TUTORIAL_STEPS[stepIdx],
  };
}

// ── Tooltip HOC ──────────────────────────────────────────────────────────────
function WithTooltip({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const show = () => {
    if (!collapsed || !wrapRef.current || !tipRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    tipRef.current.style.top = `${r.top + r.height / 2}px`;
    tipRef.current.style.left = `${r.right + 10}px`;
    tipRef.current.style.transform = "translateY(-50%)";
    tipRef.current.classList.add("vis");
  };
  const hide = () => tipRef.current?.classList.remove("vis");
  return (
    <div
      ref={wrapRef}
      className="at-tip-wrap"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      <div ref={tipRef} className="at-tooltip">
        {label}
      </div>
    </div>
  );
}

// ── Marquee title ─────────────────────────────────────────────────────────────
function MarqueeTitle({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldMarquee, setShouldMarquee] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !textRef.current) return;
    const cw = containerRef.current.offsetWidth;
    const tw = textRef.current.scrollWidth;
    if (tw > cw) {
      setShouldMarquee(true);
      setOffset(-(tw - cw + 8));
    } else {
      setShouldMarquee(false);
    }
  }, [text]);

  return (
    <div ref={containerRef} style={{ overflow: "hidden", maxWidth: "100%" }}>
      <span
        ref={textRef}
        className="at-hist-title"
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          ...(shouldMarquee
            ? ({ "--marquee-offset": `${offset}px` } as any)
            : {}),
          animation: shouldMarquee ? undefined : "none",
        }}
      >
        {text}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════
export default function AITutorModern() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { userHeader } = useAuth();

  const [selectedSubject, setSelectedSubject] = useState<number>(0);
  const [availableUnits, setAvailableUnits] = useState<
    { id: number; name: string; unitId?: string; subjectGroupKey?: string }[]
  >([]);
  const [subjectCatalog, setSubjectCatalog] = useState<LibrarySubject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [view, setView] = useState<"subject-selection" | "tutor">(
    "subject-selection",
  );
  const [currentRole, setCurrentRole] = useState("student");
  const [chatError, setChatError] = useState<string | null>(null);
  const pendingFreshChatRef = useRef(false);
  const pendingConversationIdRef = useRef<string | null>(null);

  const panelGroupRef = useRef<ImperativePanelGroupHandle>(null);
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);

  const isMobileOrTablet =
    typeof window !== "undefined" && window.innerWidth < 1024;
  const tutorial = useTutorial(isMobile || isMobileOrTablet);

  const subjects =
    subjectCatalog.length > 0
      ? [
          formattedSubjects[0],
          ...subjectCatalog.map((subjectGroup, index) => {
            const label = subjectGroup.title || subjectGroup.subject;
            let icon: React.ElementType = Book;
            let color = "bg-gradient-to-r from-gray-500 to-gray-600";
            let emoji = "📘";
            switch (label.toLowerCase()) {
              case "mathematics":
                icon = Calculator;
                color = "bg-gradient-to-r from-blue-500 to-cyan-500";
                emoji = "🧮";
                break;
              case "physics":
                icon = Atom;
                color = "bg-gradient-to-r from-green-500 to-teal-500";
                emoji = "⚡";
                break;
              case "chemistry":
                icon = FlaskConical;
                color = "bg-gradient-to-r from-red-500 to-orange-500";
                emoji = "🧪";
                break;
              case "biology":
                icon = Dna;
                color = "bg-gradient-to-r from-emerald-500 to-green-500";
                emoji = "🌿";
                break;
              case "history":
                icon = Scroll;
                color = "bg-gradient-to-r from-amber-500 to-yellow-500";
                emoji = "📜";
                break;
            }

            return {
              value: subjectGroup.subjectGroupKey,
              label,
              icon,
              color,
              id: index + 1,
              emoji,
            };
          }),
        ]
      : [formattedSubjects[0]];
  const selectedSubjectData = subjects.find((s) => s.id === selectedSubject);
  const selectedSubjectGroup =
    selectedSubjectData && selectedSubjectData.value !== "all"
      ? subjectCatalog.find(
          (subjectGroup) =>
            subjectGroup.subjectGroupKey === selectedSubjectData.value,
        ) || null
      : null;
  const candidateContext = getCandidateContext(userHeader);
 const filteredChatHistory = chatHistory.filter((chat) => {
  if (selectedSubject === 0) return true;
  if (!chat.subject) return false;

  return (
    chat.subject === selectedSubjectData?.label ||
    chat.subject === selectedSubjectData?.value
  );
});
  useEffect(() => {
    if (userHeader?.role) setCurrentRole(userHeader.role);
  } ,[userHeader]);

  useEffect(() => {
    const { documentElement } = document;
    const { body } = document;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousHtmlHeight = documentElement.style.height;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyHeight = body.style.height;

    documentElement.style.overflow = "hidden";
    documentElement.style.height = "100%";
    body.style.overflow = "hidden";
    body.style.height = "100%";
    window.scrollTo(0, 0);

    return () => {
      documentElement.style.overflow = previousHtmlOverflow;
      documentElement.style.height = previousHtmlHeight;
      body.style.overflow = previousBodyOverflow;
      body.style.height = previousBodyHeight;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadSubjects() {
      if (!ignore) {
        setSubjectsLoading(true);
      }
      try {
        const data = await getLibrarySubjects();
        if (!ignore) {
          setSubjectCatalog(data);
        }
      } catch (error) {
        if (!ignore) {
          setSubjectCatalog([]);
          toast({
            title: "Unable to load subjects",
            description:
              error instanceof Error
                ? error.message
                : "Failed to load subject catalog.",
            variant: "destructive",
          });
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
  const loadConversationList = useCallback(async () => {
    try {
      const history = await getTutorConversations({
        candidateId: candidateContext.candidateId,
        subjectGroupKey:
          selectedSubjectData?.value && selectedSubjectData.value !== "all"
            ? selectedSubjectData.value
            : undefined,
      });
      const mappedHistory = (history || []).map((chat: any) => ({
        ...chat,
        createdAt: new Date(chat.createdAt),
        lastUpdated: new Date(chat.lastUpdated),
        messages: (chat.messages || []).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        })),
      }));
      setChatHistory(mappedHistory);

      setCurrentChatId((prev) => {
        const refId = currentChatIdRef.current;
        console.log('[loadConversationList] setCurrentChatId called', {
          prev,
          refId,
          pendingFresh: pendingFreshChatRef.current,
          historyIds: mappedHistory.map((c: ChatHistory) => c.id),
        });

        // If user clicked New Chat, stay on empty new chat.
        if (pendingFreshChatRef.current) {
          pendingFreshChatRef.current = false;
          console.log('[loadConversationList] → pendingFresh=true, returning null');
          return null;
        }

        // Use the ref as the source of truth — it holds the ID set by
        // sendMessage synchronously, even before React flushes state.
        const activeId = prev ?? refId;

        if (activeId && mappedHistory.some((chat: ChatHistory) => chat.id === activeId)) {
          console.log('[loadConversationList] → activeId found in history, keeping:', activeId);
          return activeId;
        }

        // If activeId exists but isn't in the list yet (history fetch raced
        // ahead of the server persisting the new conversation), keep it.
        if (activeId) {
          console.warn('[loadConversationList] ⚠️ activeId NOT in history yet (race?) — keeping anyway:', activeId);
          return activeId;
        }

        console.log('[loadConversationList] → no activeId, returning null');
        return null;
      });

      return mappedHistory;
    } catch (error) {
      toast({
        title: "Unable to load chat history",
        description:
          error instanceof Error
            ? error.message
            : "Failed to load AI Tutor history.",
        variant: "destructive",
      });
      setChatHistory([]);
      console.error('[loadConversationList] ❌ fetch failed — resetting currentChatId → null');
      setCurrentChatId(null);
      currentChatIdRef.current = null;
      return [];
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateContext.candidateId, selectedSubjectData?.value]);
  // ↑ INTENTIONALLY omitting `toast` — it recreates every render in most
  // useToast implementations and would cause an infinite loop if included.

  const loadConversationMessages = useCallback(
    async (conversationId: string) => {
      const requestId = ++conversationLoadRequestRef.current;
      try {
        const conversation = await getTutorConversation({
          candidateId: candidateContext.candidateId,
          conversationId,
        });
        if (
          requestId !== conversationLoadRequestRef.current ||
          currentChatIdRef.current !== conversationId
        ) {
          return [];
        }
        const nextMessages = (conversation?.messages || []).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(nextMessages);
        return nextMessages;
      } catch (error) {
        if (
          requestId !== conversationLoadRequestRef.current ||
          currentChatIdRef.current !== conversationId
        ) {
          return [];
        }
        toast({
          title: "Unable to load conversation",
          description:
            error instanceof Error
              ? error.message
              : "Failed to load chat messages.",
          variant: "destructive",
        });
        setMessages([]);
        return [];
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidateContext.candidateId],
    // ↑ INTENTIONALLY omitting `toast` — it recreates on every render and
    // would make this callback unstable, causing the currentChatId useEffect
    // to re-fire on every render and wipe live messages with stale server data.
  );
  const handleSubjectSelect = (subjectId: number) => {
    setIsLoading(true);
    setSelectedSubject(subjectId);
    console.log('[handleSubjectSelect] resetting currentChatId → null (subjectId:', subjectId, ')');
    setCurrentChatId(null);
    currentChatIdRef.current = null;
    setMessages([]);
    setChatError(null);
    setCurrentMessage("");
    setSelectedUnit("");
    setView("tutor");
  };

  useEffect(() => {
    const savedSubject = localStorage.getItem("ai-tutor-selected-subject");
    const savedUnit = localStorage.getItem("ai-tutor-selected-unit");
    if (savedSubject && savedSubject !== "0") {
      setSelectedSubject(parseInt(savedSubject, 10));
      if (savedUnit) setSelectedUnit(savedUnit);
      setView("tutor");
    }
  }, []);

  const handleBack = useCallback(() => {
    localStorage.removeItem("ai-tutor-selected-subject");
    localStorage.removeItem("ai-tutor-selected-unit");
    setView("subject-selection");
  }, []);

  useEffect(() => {
    if (userHeader?.role) setCurrentRole(userHeader.role);
  }, [userHeader]);

  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [rightPanelView, setRightPanelView] = useState<
    "studio" | "ask-ai" | "faq"
  >("studio");
  const [askAIInitialQuestion, setAskAIInitialQuestion] = useState<
    string | undefined
  >();
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedAccent, setSelectedAccent] = useState<"us" | "uk" | "indian">(
    "uk",
  );
  const [speechSpeed, setSpeechSpeed] = useState(0.7);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [responseWords, setResponseWords] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentChatIdRef = useRef<string | null>(null);
  const conversationLoadRequestRef = useRef(0);
  const recognitionRef = useRef<any>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('[useEffect:syncRef] currentChatId state changed → syncing ref:', currentChatId);
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  const handleUnitChange = (newUnit: string) => {
    if (newUnit === selectedUnit) return;
    setIsLoading(true);
    setChatError(null);
    console.log('[handleUnitChange] resetting currentChatId → null (unit changed to:', newUnit, ')');
    setCurrentChatId(null);
    currentChatIdRef.current = null;
    setMessages([]);
    setCurrentMessage("");
    setSelectedUnit(newUnit);
  };

  useEffect(() => {
    if (selectedSubject && selectedSubject !== 0 && selectedSubjectGroup) {
      setAvailableUnits(
        (selectedSubjectGroup?.units || []).map((unit, index) => ({
          id: index + 1,
          name: unit.unitTitle || unit.unitLabel,
          unitId: unit.id,
          subjectGroupKey: unit.subjectGroupKey,
        })),
      );
    } else {
      setAvailableUnits([]);
    }
    setSelectedUnit("");
    setSelectedUnitId("");
    setIsLoading(false);
  }, [selectedSubject, selectedSubjectGroup]);

  useEffect(() => {
    const unitMatch = availableUnits.find((unit) => unit.name === selectedUnit);
    setSelectedUnitId(unitMatch?.unitId || "");
    if (selectedUnit && selectedSubject && selectedSubject !== 0) {
      setIsLoading(false);
      if (messages.length === 0) {
        setMessages([
          {
            id: (Date.now() + 1).toString(),
            type: "assistant",
            content: `You're now in ${selectedUnit}. Ask me anything about this unit and I'll answer using the uploaded subject content.`,
            timestamp: new Date(),
            subject: selectedSubjectData?.value,
            unit: selectedUnit,
          },
        ]);
      }
    }
  }, [selectedUnit, selectedSubject, availableUnits]);

  useEffect(() => {
    localStorage.setItem(
      "ai-tutor-selected-subject",
      selectedSubject.toString(),
    );
  }, [selectedSubject]);
  useEffect(() => {
    localStorage.setItem("ai-tutor-selected-unit", selectedUnit);
  }, [selectedUnit]);
  useEffect(() => {
    if (!selectedSubjectData || view !== "tutor") return;
    console.log('[useEffect:loadConversationList] triggered — subject:', selectedSubjectData?.value, 'unit:', selectedUnit);
    loadConversationList();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubjectData?.value, selectedUnit, view]);
  // ↑ Use primitive selectedSubjectData?.value (string) NOT the object reference.
  // Do NOT include loadConversationList — it's a useCallback that recreates when
  // its own deps change, causing this effect to re-fire → infinite API loop.

  useEffect(() => {
    console.log('[useEffect:currentChatId] fired — currentChatId:', currentChatId, '| ref:', currentChatIdRef.current);
    if (!currentChatId) {
      console.warn('[useEffect:currentChatId] ⚠️ currentChatId is null — clearing messages');
      conversationLoadRequestRef.current += 1;
      setMessages([]);
      return;
    }
    // Only fetch stored messages when switching to an EXISTING chat.
    // Do NOT fetch for a brand-new session that was just created by sendMessage —
    // the server won't have messages yet and the fetch would wipe the live chat.
    // We detect "existing" by checking if this id already exists in chatHistory.
    const isExistingChat = chatHistory.some((c) => c.id === currentChatId);
    console.log('[useEffect:currentChatId] isExistingChat:', isExistingChat, 'for id:', currentChatId);
    if (isExistingChat) {
      loadConversationMessages(currentChatId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChatId]);
  // ↑ INTENTIONALLY only depending on currentChatId (primitive string).
  // Adding loadConversationMessages causes it to re-fire on every render
  // (because toast inside it is unstable), wiping live messages mid-conversation.

  useEffect(() => {
    const enableAudio = async () => {
      try {
        const ctx = new (
          window.AudioContext || (window as any).webkitAudioContext
        )();
        await ctx.resume();
      } catch {}
    };
    enableAudio();
  }, []);

  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) return;
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang =
      selectedAccent === "uk"
        ? "en-GB"
        : selectedAccent === "indian"
          ? "en-IN"
          : "en-US";
    recognition.onresult = (e: any) => {
      setCurrentMessage(e.results[0][0].transcript);
      setIsListening(false);
    };
    recognition.onerror = () => {
      setIsListening(false);
      toast({
        title: "Speech error",
        description: "Please try again.",
        variant: "destructive",
      });
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, [selectedAccent, toast]);

  useEffect(() => {
    // Scroll both mobile and desktop instances of the chat area
    requestAnimationFrame(() => {
      const scrollEls = document.querySelectorAll('.at-msgs-area');
      scrollEls.forEach(el => {
        el.scrollTop = el.scrollHeight + 100;
      });
    });
  }, [messages, isLoading]);

  const highlightTextSync = useCallback(
    (text: string) => {
      // Strip markdown before splitting — must match renderHighlightedText's stripMarkdown
    const cleanForHighlight = text
      .replace(/#{1,6}\s+/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`{1,3}(.*?)`{1,3}/g, "$1")
      .replace(/~~(.*?)~~/g, "$1")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\n{2,}/g, " ")
      .replace(/\n/g, " ")
      .trim();
    const words = cleanForHighlight.split(/\s+/).filter((w) => w.length > 0);
      setResponseWords(words);
      setCurrentWordIndex(-1);
      if (!words.length) return;
      const dur = (text.length / 15) * 1000 * (1 / speechSpeed);
      const wdur = dur / words.length;
      let curr = 0;
      const start = Date.now();
      const interval = setInterval(() => {
        const exp = Math.floor((Date.now() - start) / wdur);
        if (exp < words.length && exp !== curr) {
          setCurrentWordIndex(exp);
          curr = exp;
        }
        if (exp >= words.length) {
          clearInterval(interval);
          setCurrentWordIndex(-1);
          setResponseWords([]);
        }
      }, 50);
      if (highlightTimeoutRef.current)
        clearInterval(highlightTimeoutRef.current);
      highlightTimeoutRef.current = interval;
    },
    [speechSpeed],
  );

  const speakText = async (text: any) => {
    const textStr =
      typeof text === "string" ? text : text?.response || String(text) || "";
    if (!textStr.trim() || isSpeaking) return;
    setIsSpeaking(true);
    try {
      const res = await fetch(buildApiUrl("/api/voice/tts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textStr.slice(0, 3000),
          speed: speechSpeed,
          format: "mp3",
        }),
        credentials: "include",
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) audioRef.current.pause();
        audioRef.current = new Audio(url);
        audioRef.current.onplay = () => highlightTextSync(textStr);
        audioRef.current.onended = () => {
          setIsSpeaking(false);
          setCurrentWordIndex(-1);
          setResponseWords([]);
          URL.revokeObjectURL(url);
        };
        audioRef.current.onerror = () => {
          setIsSpeaking(false);
          setCurrentWordIndex(-1);
          setResponseWords([]);
          URL.revokeObjectURL(url);
        };
        await audioRef.current.play();
        return;
      }
    } catch {}
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(textStr);
      u.rate = speechSpeed;
      u.volume = 1;
      u.lang =
        selectedAccent === "uk"
          ? "en-GB"
          : selectedAccent === "indian"
            ? "en-IN"
            : "en-US";
      u.onstart = () => highlightTextSync(textStr);
      u.onend = () => {
        setIsSpeaking(false);
        setCurrentWordIndex(-1);
        setResponseWords([]);
      };
      u.onerror = () => {
        setIsSpeaking(false);
        setCurrentWordIndex(-1);
        setResponseWords([]);
      };
      speechSynthesis.speak(u);
    } else setIsSpeaking(false);
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (highlightTimeoutRef.current) clearInterval(highlightTimeoutRef.current);
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    setIsSpeaking(false);
    setCurrentWordIndex(-1);
    setResponseWords([]);
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      toast({ title: "Not supported", variant: "destructive" });
      return;
    }
    setIsListening(true);
    recognitionRef.current.start();
  };
  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const startRecording = () => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        setIsRecording(true);
        setIsPaused(false);
        setRecordingTime(0);
        recordingTimerRef.current = setInterval(
          () => setRecordingTime((t) => t + 1),
          1000,
        );
        const mr = new MediaRecorder(stream);
        mediaRecorderRef.current = mr;
        audioChunksRef.current = [];
        mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        mr.onstop = () => {
          if (!audioChunksRef.current.length) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              type: "user",
              content: "Voice Message",
              timestamp: new Date(),
              audioSrc: url,
            },
          ]);
          stream.getTracks().forEach((t) => t.stop());
          if (recordingTimerRef.current)
            clearInterval(recordingTimerRef.current);
          setRecordingTime(0);
          audioChunksRef.current = [];
        };
        mr.start();
      })
      .catch(() =>
        toast({
          title: "Microphone Error",
          description: "Could not access microphone.",
          variant: "destructive",
        }),
      );
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };
  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      recordingTimerRef.current = setInterval(
        () => setRecordingTime((t) => t + 1),
        1000,
      );
    }
  };
  const stopRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsPaused(false);
  };
  const deleteRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {
        audioChunksRef.current = [];
        mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
  };

  // ── FIXED sendMessage — does NOT reset to new chat on error ──────────────
  const sendMessage = async () => {
    if ((!currentMessage.trim() && !attachedFiles.length) || isLoading) return;
    setChatError(null);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: currentMessage,
      timestamp: new Date(),
      subject:
        selectedSubjectData?.value !== "all"
          ? selectedSubjectData?.value
          : undefined,
      attachments: attachedFiles.length
        ? attachedFiles.map((f) => ({
            name: f.name,
            type: f.type,
            size: f.size,
          }))
        : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setCurrentMessage("");
    setAttachedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsLoading(true);

    try {
      if (!selectedUnitId) {
        throw new Error("Please select a unit before asking the AI Tutor.");
      }

      // The API never returns a conversationId in its response.
      // Generate one client-side on the FIRST message of a new session and
      // reuse it for every subsequent message — keeping all messages grouped
      // under one conversation ID for the duration of the session.
      let sessionId = currentChatIdRef.current || currentChatId;
      if (!sessionId) {
        sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        console.log('[sendMessage] 🆕 New session — generated client-side id:', sessionId);
        currentChatIdRef.current = sessionId;
        setCurrentChatId(sessionId);
      }

      console.log('[sendMessage] Sending with conversationId:', sessionId);
      const data = await askTutor({
        unitId: selectedUnitId,
        candidateId: candidateContext.candidateId,
        candidateName: candidateContext.candidateName,
        query: userMsg.content,
        conversationId: sessionId,
        limit: 5,
      });
      const assistantText =
        data?.answer ||
        data?.response ||
        data?.reply ||
        data?.content ||
        "I could not generate a response for that question.";
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: assistantText,
        timestamp: new Date(),
        subject:
          selectedSubjectData?.value !== "all"
            ? selectedSubjectData?.value
            : undefined,
      };
      // Ensure ref stays set after the await (defensive against any mid-flight reset)
      if (!currentChatIdRef.current) {
        currentChatIdRef.current = sessionId;
        setCurrentChatId(sessionId);
      }
      console.log('[sendMessage] ✅ Session held:', currentChatIdRef.current);
      setMessages((prev) => [...prev, assistantMsg]);
      // Refresh sidebar after a short delay — gives the server time to persist
      // the new conversation before we fetch the list. Avoids the race that
      // previously caused loadConversationList to not find the new id and reset it.
      setTimeout(() => loadConversationList(), 1500);
    } catch (err) {
      // ← KEY FIX: show error inline, do NOT reset chat or start new one
      setChatError(
        err instanceof Error
          ? err.message
          : "Failed to get a response. Please try again.",
      );
      // Optionally remove the user message if you want clean retry:
      // setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
    }
  };

const startNewChat = () => {
  pendingFreshChatRef.current = true;
  pendingConversationIdRef.current = null;
  conversationLoadRequestRef.current += 1;

  setIsLoading(false);
  setChatError(null);
  setMessages([]);
  setCurrentChatId(null);
  currentChatIdRef.current = null;
  setCurrentMessage("");
  setAttachedFiles([]);

  if (fileInputRef.current) {
    fileInputRef.current.value = "";
  }

  stopSpeaking();
};

  const loadChat = (chat: ChatHistory) => {
    pendingConversationIdRef.current = null;
    conversationLoadRequestRef.current += 1;
    console.log('[loadChat] switching to chat id:', chat.id);
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
    currentChatIdRef.current = chat.id;
    setCurrentMessage("");
    setChatError(null);
    const subj = subjects.find((s) => s.label === chat.subject);
    if (subj) setSelectedSubject(subj.id);
    else setSelectedSubject(0);
    setSelectedUnit(chat.unit || "");
  };

  const deleteChat = async (chatId: string) => {
    try {
      await clearTutorHistory({
        candidateId: candidateContext.candidateId,
        conversationId: chatId,
      });
      setChatHistory((prev) => prev.filter((c) => c.id !== chatId));
    } catch (error) {
      toast({
        title: "Unable to delete chat",
        description:
          error instanceof Error
            ? error.message
            : "Failed to delete this chat.",
        variant: "destructive",
      });
      return;
    }
    if (currentChatId === chatId) {
      console.log('[deleteChat] deleted active chat, resetting currentChatId → null');
      setMessages([]);
      setCurrentChatId(null);
      currentChatIdRef.current = null;
      pendingConversationIdRef.current = null;
    }
  };

  const clearAllHistory = async () => {
    try {
      await clearTutorHistory({
        candidateId: candidateContext.candidateId,
      });
      console.log('[clearAllHistory] resetting currentChatId → null');
      setChatHistory([]);
      setMessages([]);
      setCurrentChatId(null);
      currentChatIdRef.current = null;
      pendingConversationIdRef.current = null;
      toast({
        title: "History cleared",
        description: "All chat history has been deleted.",
      });
    } catch (error) {
      toast({
        title: "Unable to clear history",
        description:
          error instanceof Error
            ? error.message
            : "Failed to clear AI Tutor history.",
        variant: "destructive",
      });
    }
  };

  const captureSelection = () => {
    const text = window.getSelection()?.toString();
    if (text?.trim()) {
      setAskAIInitialQuestion(`Can you explain this part: "${text.trim()}"`);
      setRightPanelView("ask-ai");
      if (rightPanelRef.current?.isCollapsed()) rightPanelRef.current.expand();
      toast({
        title: "Text Captured",
        description: "Ask your question in the right panel.",
      });
    } else
      toast({
        title: "No text selected",
        description: "Highlight some text first!",
        variant: "destructive",
      });
  };

  const handleAskAI = () => {
    setAskAIInitialQuestion(undefined);
    setRightPanelView("ask-ai");
    if (rightPanelRef.current?.isCollapsed()) rightPanelRef.current.expand();
  };

  const toggleLeftPanel = () => {
    if (leftPanelRef.current) {
      leftPanelRef.current.isCollapsed()
        ? leftPanelRef.current.expand()
        : leftPanelRef.current.collapse();
    }
  };
  const toggleRightPanel = () => {
    if (rightPanelRef.current) {
      rightPanelRef.current.isCollapsed()
        ? rightPanelRef.current.expand()
        : rightPanelRef.current.collapse();
    }
  };

  const renderHighlightedText = (text: string) => {
    // Strip markdown syntax so raw symbols don't show during reading.
    // We render FormattedAIContent underneath and overlay word highlight on top.
    const stripMarkdown = (raw: string) =>
      raw
        .replace(/#{1,6}\s+/g, "")          // ### headings
        .replace(/\*\*(.*?)\*\*/g, "$1")    // **bold**
        .replace(/\*(.*?)\*/g, "$1")        // *italic*
        .replace(/`{1,3}(.*?)`{1,3}/g, "$1") // `code`
        .replace(/~~(.*?)~~/g, "$1")        // ~~strikethrough~~
        .replace(/^\s*[-*+]\s+/gm, "")     // bullet points
        .replace(/^\s*\d+\.\s+/gm, "")     // numbered lists
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [link](url)
        .replace(/\n{2,}/g, " ")
        .replace(/\n/g, " ")
        .trim();

    const cleanText = stripMarkdown(text);
    const words = cleanText.split(/\s+/).filter(Boolean);

    if (!responseWords.length || currentWordIndex === -1) {
      // Not yet highlighting — show fully formatted content
      return <FormattedAIContent value={text} />;
    }

    return (
      <span style={{ lineHeight: 1.7, fontSize: 13.5 }}>
        {words.map((word, i) => (
          <span
            key={i}
            style={
              i === currentWordIndex
                ? {
                    background: "linear-gradient(135deg,#fef3c7,#fde68a)",
                    borderRadius: 3,
                    padding: "0 2px",
                    color: "#1a1a1a",
                    fontWeight: 600,
                    transition: "all .15s",
                  }
                : {}
            }
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAttachedFiles(Array.from(e.target.files));
  };
  const triggerFileInput = (accept?: string) => {
    if (!fileInputRef.current) return;
    if (accept) fileInputRef.current.accept = accept;
    else fileInputRef.current.removeAttribute("accept");
    fileInputRef.current.click();
  };

  const quickPrompts =
    selectedSubjectData && selectedSubjectData.value !== "all"
      ? [
          `Explain a key concept in ${selectedSubjectData.label}`,
          `Give me 3 tips to master ${selectedUnit || selectedSubjectData.label}`,
          `What are common mistakes in ${selectedSubjectData.label}?`,
        ]
      : [
          "Help me understand a topic",
          "Quiz me on what I've learned",
          "Explain step by step",
        ];

  // ════════════════════════════════════════════════════════════════════════
  // LEFT PANEL
  // ════════════════════════════════════════════════════════════════════════
  const leftPanelContent = (
    <div className="at-panel">
      {/* Head */}
      <div
        className={`at-panel-head${isLeftPanelCollapsed ? " collapsed" : ""}`}
      >
        {!isLeftPanelCollapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="at-panel-title">
              <span style={{ fontSize: 16 }}>📚</span> Learning Panel
            </div>
            <div className="at-panel-sub">Subjects & chat history</div>
          </div>
        )}
        <button
          className="at-toggle-btn"
          onClick={toggleLeftPanel}
          title={isLeftPanelCollapsed ? "Expand" : "Collapse"}
        >
          {isLeftPanelCollapsed ? (
            <PanelLeftOpen style={{ width: 14, height: 14 }} />
          ) : (
            <PanelLeftClose style={{ width: 14, height: 14 }} />
          )}
        </button>
      </div>

      {isLeftPanelCollapsed ? (
        <div className="at-collapsed-icons">
          {[
            { icon: "📚", label: "Chat History" },
            { icon: "🎯", label: "Subjects" },
            { icon: "📝", label: "Units" },
          ].map((item, i) => (
            <WithTooltip key={i} label={item.label} collapsed={true}>
              <div className="at-col-icon">{item.icon}</div>
            </WithTooltip>
          ))}
        </div>
      ) : (
        <div className="at-left-body">
          {/* Subject */}
          <div>
            <div className="at-select-label">Subject</div>
            <div className="at-select-wrap">
              <select
                value={selectedSubject.toString()}
                onChange={(e) =>
                  handleSubjectSelect(parseInt(e.target.value, 10))
                }
                disabled={subjectsLoading || subjects.length <= 1}
              >
                <option value="0">
                  {subjectsLoading
                    ? "Loading subjects..."
                    : subjects.length <= 1
                      ? "No subjects available"
                      : "Select subject"}
                </option>
                {subjects
                  .filter((s) => s.id !== 0)
                  .map((s) => (
                    <option key={s.id} value={s.id.toString()}>
                      {s.emoji} {s.label}
                    </option>
                  ))}
              </select>
              <div className="at-select-arrow">
                <ChevronDown style={{ width: 13, height: 13 }} />
              </div>
            </div>
          </div>

          {/* Unit */}
          <div>
            <div className="at-select-label">Unit</div>
            <div className="at-select-wrap">
              <select
                value={selectedUnit}
                onChange={(e) => handleUnitChange(e.target.value)}
                disabled={
                  subjectsLoading ||
                  !selectedSubject ||
                  selectedSubject === 0 ||
                  !availableUnits.length
                }
                style={{
                  opacity:
                    subjectsLoading ||
                    !selectedSubject ||
                    selectedSubject === 0 ||
                    !availableUnits.length
                      ? 0.5
                      : 1,
                }}
              >
                <option value="">
                  {subjectsLoading
                    ? "Loading subjects..."
                    : !selectedSubject || selectedSubject === 0
                      ? "Select a subject first"
                      : !availableUnits.length
                        ? "No units available"
                        : "Select unit"}
                </option>
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
              <div className="at-select-arrow">
                <ChevronDown style={{ width: 13, height: 13 }} />
              </div>
            </div>
          </div>

          <div className="at-divider" />

          {/* History section — scrollable */}
          <div className="at-hist-section">
            <div className="at-hist-section-head">
              <div className="at-select-label" style={{ marginBottom: 0 }}>
                Recent Chats
              </div>
              <button
                className="at-new-chat-icon-btn"
                onClick={startNewChat}
                title="New chat"
              >
                <Plus style={{ width: 13, height: 13 }} />
              </button>
            </div>

            {/* THE SCROLLABLE LIST */}
            <div className="at-hist-list at-scroll">
              {filteredChatHistory.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "18px 8px",
                    color: "#94a3b8",
                    fontSize: 11.5,
                  }}
                >
                  No chat history available
                </div>
              ) : (
                filteredChatHistory.map((chat, i) => (
                  <motion.div
                    key={chat.id}
                    className={`at-hist-item${currentChatId === chat.id ? " active" : ""}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.035 }}
                    onClick={() => {
                      loadChat(chat);
                      if (isMobile) setIsLeftPanelOpen(false);
                    }}
                  >
                    <div style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>
                      {subjects.find((s) => s.label === chat.subject)?.emoji ||
                        "💬"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <MarqueeTitle text={chat.title} />
                      <div className="at-hist-meta">
                        {chat.messages.length} msgs ·{" "}
                        {new Date(chat.lastUpdated).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      className="at-hist-del"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteChat(chat.id);
                      }}
                      title="Delete"
                    >
                      <X style={{ width: 12, height: 12 }} />
                    </button>
                  </motion.div>
                ))
              )}
            </div>

            {filteredChatHistory.length > 0 && (
              <div className="at-hist-footer">
                <button className="at-clear-btn" onClick={clearAllHistory}>
                  🗑 Clear All History
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════
  // RIGHT PANEL
  // ════════════════════════════════════════════════════════════════════════
  const renderRightPanelContent = () => {
    if (rightPanelView === "ask-ai")
      return (
        <div className="at-panel" style={{ height: "100%" }}>
          <div className="at-panel-head">
            <div className="at-panel-title">
              <button
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6366f1",
                  display: "flex",
                  alignItems: "center",
                }}
                onClick={() => setRightPanelView("studio")}
              >
                <ChevronLeft style={{ width: 17, height: 17 }} />
              </button>
              <span style={{ fontSize: 16 }}>🤖</span> Ask AI
            </div>
          </div>
          <AskAIPanel initialQuestion={askAIInitialQuestion} />
        </div>
      );
    if (rightPanelView === "faq")
      return (
        <div className="at-panel" style={{ height: "100%" }}>
          <div className="at-panel-head">
            <div className="at-panel-title">
              <button
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6366f1",
                  display: "flex",
                  alignItems: "center",
                }}
                onClick={() => setRightPanelView("studio")}
              >
                <ChevronLeft style={{ width: 17, height: 17 }} />
              </button>
              <span style={{ fontSize: 16 }}>❓</span> FAQ & Notes
            </div>
          </div>
          <FAQPanel
            subject={selectedSubjectData?.value || ""}
            unit={selectedUnit}
            unitId={selectedUnitId}
            onBack={() => setRightPanelView("studio")}
          />
        </div>
      );

    return (
      <div className="at-panel" style={{ height: "100%" }}>
        <div
          className={`at-panel-head${isRightPanelCollapsed ? " collapsed" : ""}`}
        >
          {!isRightPanelCollapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="at-panel-title">
                <span style={{ fontSize: 16 }}>🧪</span> Mind Lab
              </div>
              <div className="at-panel-sub">Tools to supercharge learning</div>
            </div>
          )}
          <button
            className="at-toggle-btn"
            onClick={toggleRightPanel}
            title={isRightPanelCollapsed ? "Expand" : "Collapse"}
          >
            {isRightPanelCollapsed ? (
              <PanelRightOpen style={{ width: 14, height: 14 }} />
            ) : (
              <PanelRightClose style={{ width: 14, height: 14 }} />
            )}
          </button>
        </div>

        {isRightPanelCollapsed ? (
          <div className="at-collapsed-icons">
            {[
              { icon: "📝", label: "Quiz" },
              { icon: "📖", label: "Q-Bank" },
              { icon: "❓", label: "FAQ" },
              { icon: "🤖", label: "Ask AI" },
            ].map((item, i) => (
              <WithTooltip key={i} label={item.label} collapsed={true}>
                <div className="at-col-icon">{item.icon}</div>
              </WithTooltip>
            ))}
          </div>
        ) : (
          <div style={{ overflowY: "auto", flex: 1 }} className="at-scroll">
            {selectedSubjectData && selectedSubjectData.value !== "all" && (
              <motion.div
                className="at-ctx-card"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="at-ctx-label">Active Context</div>
                <div className="at-ctx-val">
                  {selectedSubjectData.emoji} {selectedSubjectData.label}
                  {selectedUnit ? ` · ${selectedUnit}` : ""}
                </div>
                <div className="at-ctx-note">
                  All tools will use this context
                </div>
              </motion.div>
            )}
            <div className="at-mindlab-grid">
              <motion.div
                className="at-ml-card blue"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                onClick={() => {
                  const p = new URLSearchParams();
                  if (selectedSubjectData?.value !== "all")
                    p.append("subject", selectedSubjectData?.value || "");
                  if (selectedUnit) p.append("unit", selectedUnit);
                  if (selectedUnitId) p.append("unitId", selectedUnitId);
                  if (
                    selectedSubjectData?.value &&
                    selectedSubjectData.value !== "all"
                  )
                    p.append("subjectGroupKey", selectedSubjectData.value);
                  p.append("from", "/ai-tutor-modern");
                  setLocation(`/studio/quiz?${p.toString()}`);
                  if (isMobile) setIsRightPanelOpen(false);
                }}
              >
                <span className="at-ml-icon">📝</span>
                <div className="at-ml-name">Quiz</div>
                <div className="at-ml-desc">
                  Test your knowledge interactively
                </div>
              </motion.div>
              <motion.div
                className="at-ml-card indigo"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                onClick={() => {
                  setLocation(
                    `/studio/question-bank?subjectId=${selectedSubject !== 0 ? selectedSubject : ""}&from=/ai-tutor-modern`,
                  );
                  if (isMobile) setIsRightPanelOpen(false);
                }}
              >
                <span className="at-ml-icon">📖</span>
                <div className="at-ml-name">Q-Bank</div>
                <div className="at-ml-desc">
                  Browse past questions & answers
                </div>
              </motion.div>
              <motion.div
                className="at-ml-card orange col2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                onClick={() => setRightPanelView("faq")}
              >
                <span className="at-ml-icon">❓</span>
                <div className="at-ml-name">FAQ & Notes</div>
                <div className="at-ml-desc">
                  Frequently asked questions and study notes
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════════════════
  // MAIN CHAT PANEL
  // ════════════════════════════════════════════════════════════════════════
  const mainPanelContent = (
    <div className="at-panel">
      {/* Header */}
      <div className="at-chat-header">
        <div className="at-chat-header-inner">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flex: 1,
              minWidth: 0,
            }}
          >
            <div className="at-chat-avatar">🤖</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="at-chat-badge">
                <Sparkles style={{ width: 9, height: 9 }} /> Gemma 3 12B
              </div>
              <div
                className="at-chat-title"
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                AI Tutor
                {selectedSubjectData && selectedSubjectData.value !== "all" && (
                  <span
                    style={{ fontWeight: 600, fontSize: 13, opacity: 0.85 }}
                  >
                    {" "}
                    · {selectedSubjectData.emoji} {selectedSubjectData.label}
                  </span>
                )}
              </div>
              {selectedUnit && !isMobileOrTablet && (
                <div className="at-chat-sub">📌 {selectedUnit}</div>
              )}
            </div>
          </div>
          <div className="at-chat-actions">
            {isSpeaking && (
              <button className="at-hbtn" onClick={stopSpeaking}>
                <VolumeX style={{ width: 13, height: 13 }} />
                <span>Stop</span>
              </button>
            )}
            <button className="at-hbtn" onClick={startNewChat}>
              <RefreshCw style={{ width: 13, height: 13 }} />
              <span>New</span>
            </button>
            <button className="at-hbtn white" onClick={handleBack}>
              <ChevronLeft style={{ width: 13, height: 13 }} />
              <span>Subjects</span>
            </button>
          </div>
        </div>
        {/* Mobile Dropdowns inside header */}
        {isMobileOrTablet && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
             <select
                value={selectedSubject.toString()}
                onChange={(e) => handleSubjectSelect(parseInt(e.target.value, 10))}
                disabled={subjectsLoading || subjects.length <= 1}
                style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: "none", fontSize: 12, background: "rgba(255,255,255,0.9)", color: "#0f172a", outline: "none", cursor: "pointer" }}
              >
                <option value="0">{subjectsLoading ? "Loading..." : "Select Subject"}</option>
                {subjects.filter(s => s.id !== 0).map(s => <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
             </select>
             <select
                value={selectedUnit}
                onChange={(e) => handleUnitChange(e.target.value)}
                disabled={subjectsLoading || !selectedSubject || selectedSubject === 0 || !availableUnits.length}
                style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: "none", fontSize: 12, background: "rgba(255,255,255,0.9)", color: "#0f172a", outline: "none", cursor: "pointer" }}
              >
                <option value="">{!selectedSubject ? "Subject first" : !availableUnits.length ? "No units" : "Select Unit"}</option>
                {availableUnits.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
             </select>
          </div>
        )}
      </div>

      {/* Error banner — inline, no page reset */}
      {chatError && (
        <div className="at-error-banner">
          <span>⚠️</span> {chatError}
          <button
            onClick={() => setChatError(null)}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#ef4444",
            }}
          >
            <X style={{ width: 13, height: 13 }} />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="at-msgs-area at-scroll">
        {messages.length === 0 && isLoading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              padding: "30px 20px",
            }}
          >
            <FunnyLoader />
          </div>
        ) : messages.length === 0 ? (
          <div className="at-empty">
            <div className="at-empty-icon">🤖</div>
            <div className="at-empty-title">Welcome to AI Tutor!</div>
            <div className="at-empty-sub">
              {!selectedUnit
                ? "Select a subject and unit from the Learning Panel to get started."
                : `Ready to help you master ${selectedSubjectData?.label || "any subject"}. Ask me anything!`}
            </div>
            {selectedUnit && (
              <div className="at-empty-chips">
                {quickPrompts.map((p, i) => (
                  <motion.button
                    key={i}
                    className="at-chip"
                    initial={{ opacity: 0, y: 7 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.07 }}
                    onClick={() => setCurrentMessage(p)}
                  >
                    {p}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  className={`at-msg-row${message.type === "user" ? " user" : ""}`}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.26, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  <div
                    className={`at-msg-avatar${message.type === "user" ? " user-av" : " bot"}`}
                  >
                    {message.type === "user"
                      ? userHeader?.firstName?.[0]?.toUpperCase() || "U"
                      : "🤖"}
                  </div>
                  <div
                    className={`at-bubble${message.type === "user" ? " user" : " bot"}`}
                  >
                    <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>
                      {message.audioSrc ? (
                        <audio
                          controls
                          src={message.audioSrc}
                          style={{ maxWidth: "100%" }}
                        />
                      ) : message.type === "assistant" &&
                        isSpeaking &&
                        messages[messages.length - 1]?.id === message.id ? (
                        renderHighlightedText(message.content)
                      ) : message.type === "assistant" ? (
                        <TypingMarkdown content={message.content} isLast={index === messages.length - 1} />
                      ) : (
                        <FormattedAIContent value={message.content} />
                      )}
                    </div>
                    <div className="at-bubble-footer">
                      <span className="at-bubble-time">
                        {message.timestamp.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {message.type === "assistant" && (
                        <button
                          className="at-speak-btn"
                          onClick={() => {
                            if (
                              isSpeaking &&
                              messages[messages.length - 1]?.id === message.id
                            ) {
                              stopSpeaking();
                            } else {
                              speakText(message.content);
                            }
                          }}
                          title={
                            isSpeaking &&
                            messages[messages.length - 1]?.id === message.id
                              ? "Stop reading"
                              : "Read aloud"
                          }
                        >
                          {isSpeaking &&
                          messages[messages.length - 1]?.id === message.id ? (
                            <Pause style={{ width: 11, height: 11 }} />
                          ) : (
                            <Volume2 style={{ width: 11, height: 11 }} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && messages.length > 0 && (
              <motion.div
                className="at-msg-row"
                initial={{ opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="at-msg-avatar bot">🤖</div>
                <div className="at-bubble bot" style={{ padding: "13px 15px" }}>
                  <div className="at-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="at-input-area">
        {attachedFiles.length > 0 && !isRecording && (
          <div className="at-attachments">
            {attachedFiles.map((f, i) => (
              <div key={i} className="at-attach-chip">
                <FileText style={{ width: 10, height: 10 }} />
                <span
                  style={{
                    maxWidth: 90,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.name}
                </span>
                <button
                  className="at-attach-del"
                  onClick={() =>
                    setAttachedFiles((prev) =>
                      prev.filter((_, idx) => idx !== i),
                    )
                  }
                >
                  <X style={{ width: 10, height: 10 }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {isRecording ? (
          <div className="at-recording-bar">
            <button
              onClick={deleteRecording}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                display: "flex",
                alignItems: "center",
                transition: "color .15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
            >
              <Trash style={{ width: 15, height: 15 }} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div className="at-rec-dot" />
              <span className="at-rec-time">
                {new Date(recordingTime * 1000).toISOString().substr(14, 5)}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {isPaused ? (
                <button onClick={resumeRecording} className="at-iabtn">
                  <Play style={{ width: 14, height: 14 }} />
                </button>
              ) : (
                <button onClick={pauseRecording} className="at-iabtn">
                  <Pause style={{ width: 14, height: 14 }} />
                </button>
              )}
              <button onClick={stopRecording} className="at-send-btn">
                <Send style={{ width: 13, height: 13 }} />
              </button>
            </div>
          </div>
        ) : (
          <div className="at-textarea-wrap">
            <textarea
              className="at-textarea"
              value={currentMessage}
              onChange={(e) => setCurrentMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                !selectedUnit
                  ? "Select a unit to start chatting…"
                  : attachedFiles.length
                    ? `${attachedFiles.length} file(s) attached. Add a message or send.`
                    : "Ask anything… Press Enter to send"
              }
              disabled={!selectedUnit || isLoading}
              rows={2}
            />
            <div className="at-input-actions">
              {/* Attach */}
              <span id="tut-attach-btn">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="at-iabtn"
                      disabled={!selectedUnit || isLoading}
                      title="Attach file"
                    >
                      <Paperclip style={{ width: 15, height: 15 }} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() => triggerFileInput("image/*")}
                    >
                      <Image className="mr-2 h-4 w-4" />
                      Images
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => triggerFileInput(".pdf,.doc,.docx,.txt")}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Documents
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
              {/* Mic */}
              <span id="tut-mic-btn">
                {isListening ? (
                  <button
                    className="at-iabtn active"
                    onClick={stopListening}
                    disabled={!selectedUnit || isLoading}
                    title="Stop listening"
                  >
                    <MicOff style={{ width: 15, height: 15 }} />
                  </button>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="at-iabtn"
                        disabled={!selectedUnit || isLoading}
                        title="Voice input"
                      >
                        <Mic style={{ width: 15, height: 15 }} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top">
                      <DropdownMenuItem onSelect={() => startListening()}>
                        <Speech className="mr-2 h-4 w-4" />
                        Speech to Text
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => startRecording()}>
                        <Mic className="mr-2 h-4 w-4" />
                        Voice Record
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled
                        className="text-xs text-muted-foreground pt-1 flex flex-col items-start gap-1.5"
                      >
                        <span className="font-medium text-foreground">
                          Accent
                        </span>
                        <div className="flex gap-1.5 w-full">
                          {(["us", "uk", "indian"] as const).map((a) => (
                            <button
                              key={a}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAccent(a);
                              }}
                              className={`flex-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-colors ${selectedAccent === a ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 hover:border-blue-300"}`}
                            >
                              {a.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled
                        className="text-xs text-muted-foreground flex flex-col items-start gap-1"
                      >
                        <span className="font-medium text-foreground">
                          Speed: {speechSpeed}x
                        </span>
                        <input
                          type="range"
                          min={0.5}
                          max={1.5}
                          step={0.1}
                          value={speechSpeed}
                          onChange={(e) =>
                            setSpeechSpeed(parseFloat(e.target.value))
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="w-full h-1.5 accent-blue-600 cursor-pointer"
                        />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </span>
              {/* Send */}
              <span id="tut-send-btn">
                <button
                  className="at-send-btn"
                  onClick={sendMessage}
                  disabled={!selectedUnit || isLoading}
                >
                  <Send style={{ width: 12, height: 12 }} /> Send
                </button>
              </span>
            </div>
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="hidden"
        />
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════
  // SUBJECT SELECTION
  // ════════════════════════════════════════════════════════════════════════
  if (view === "subject-selection") {
    return (
      <div
        style={{
          height: "100dvh",
          background: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <style>{CSS}</style>
        <Navigation currentRole={currentRole} onRoleChange={setCurrentRole} />
        <SubjectSelection
          subjects={subjects}
          onSelectSubject={handleSubjectSelect}
        />
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // TUTOR VIEW
  // ════════════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{CSS}</style>
      <div className="at-root">
        <Navigation currentRole={currentRole} onRoleChange={setCurrentRole} />
        {/* <AITutorHeader
          onAskAI={handleAskAI}
          onExplain={captureSelection}
          onBack={handleBack}
          subjectLabel={
            selectedSubjectData?.value !== "all"
              ? selectedSubjectData?.label
              : undefined
          }
          unitLabel={selectedUnit || undefined}
        /> */}

        <div className="at-layout-wrap">
          {/* Desktop: resizable panels */}
          <div
            className="at-desktop-only"
            style={{ height: "100%", display: "flex" }}
          >
            <ResizablePanelGroup
              direction="horizontal"
              style={{ height: "100%", gap: 6 }}
              ref={panelGroupRef}
              onLayout={(sizes) => {
                setIsLeftPanelCollapsed(sizes[0] < 5);
                setIsRightPanelCollapsed(sizes[2] < 5);
              }}
            >
              <ResizablePanel
                ref={leftPanelRef}
                collapsible
                collapsedSize={4}
                minSize={15}
                maxSize={26}
                defaultSize={21}
              >
                <div
                  style={{
                    height: "100%",
                    paddingRight: 3,
                    overflow: "hidden",
                  }}
                >
                  {leftPanelContent}
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={58} minSize={32}>
                <div
                  style={{
                    height: "100%",
                    padding: "0 3px",
                    overflow: "hidden",
                  }}
                >
                  {mainPanelContent}
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                ref={rightPanelRef}
                collapsible
                collapsedSize={4}
                minSize={15}
                maxSize={26}
                defaultSize={21}
              >
                <div
                  style={{ height: "100%", paddingLeft: 3, overflow: "hidden" }}
                >
                  {renderRightPanelContent()}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          {/* Mobile/Tablet: full-height chat */}
          <div
            className="at-mobile-only at-mobile-chat"
            style={{ height: "100%" }}
          >
            {mainPanelContent}
          </div>
        </div>

        {/* Bottom nav */}
        <div className="at-bottom-nav">
          <button
            id="tut-history-btn"
            className="at-bnav-btn"
            onClick={() => setIsLeftPanelOpen(true)}
          >
            <div className="at-bnav-icon">📚</div>History
          </button>
          <button
            id="tut-subjects-btn"
            className="at-bnav-btn"
            onClick={handleBack}
          >
            <div className="at-bnav-icon">🎓</div>Subjects
          </button>
          <button
            id="tut-studio-btn"
            className="at-bnav-btn"
            onClick={() => setIsRightPanelOpen(true)}
          >
            <div className="at-bnav-icon">🧪</div>Mind Lab
          </button>
          <button
            className="at-bnav-btn"
            style={{ color: "#f59e0b" }}
            onClick={() => tutorial.start()}
          >
            <div className="at-bnav-icon">💡</div>Guide
          </button>
        </div>

        {/* Mobile Sheets */}
        <Sheet open={isLeftPanelOpen} onOpenChange={setIsLeftPanelOpen}>
          <SheetContent
            side="left"
            className="p-0 w-[85vw] sm:w-80 flex flex-col"
            style={{ background: "#fff", borderRight: "1px solid #f1f5f9" }}
          >
            <SheetHeader
              className="p-4 pb-3 flex-shrink-0"
              style={{ borderBottom: "1px solid #f1f5f9" }}
            >
              <SheetTitle
                className="text-base flex items-center gap-2"
                style={{ color: "#0f172a" }}
              >
                <span>📚</span> Learning Panel
              </SheetTitle>
            </SheetHeader>
            <div
              style={{ flex: 1, overflowY: "auto", padding: "12px" }}
              className="at-scroll"
            >
              <div style={{ marginBottom: 10 }}>
                <div className="at-select-label">Subject</div>
                <div className="at-select-wrap">
                  <select
                    value={selectedSubject.toString()}
                    onChange={(e) => {
                      handleSubjectSelect(parseInt(e.target.value, 10));
                      setIsLeftPanelOpen(false);
                    }}
                    disabled={subjectsLoading || subjects.length <= 1}
                  >
                    <option value="0">
                      {subjectsLoading
                        ? "Loading subjects..."
                        : subjects.length <= 1
                          ? "No subjects available"
                          : "Select subject"}
                    </option>
                    {subjects
                      .filter((s) => s.id !== 0)
                      .map((s) => (
                        <option key={s.id} value={s.id.toString()}>
                          {s.emoji} {s.label}
                        </option>
                      ))}
                  </select>
                  <div className="at-select-arrow">
                    <ChevronDown style={{ width: 13, height: 13 }} />
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div className="at-select-label">Unit</div>
                <div className="at-select-wrap">
                  <select
                    value={selectedUnit}
                    onChange={(e) => {
                      handleUnitChange(e.target.value);
                      setIsLeftPanelOpen(false);
                    }}
                    disabled={
                      subjectsLoading ||
                      !selectedSubject ||
                      selectedSubject === 0 ||
                      !availableUnits.length
                    }
                    style={{
                      opacity:
                        subjectsLoading ||
                        !selectedSubject ||
                        selectedSubject === 0 ||
                        !availableUnits.length
                          ? 0.5
                          : 1,
                    }}
                  >
                    <option value="">
                      {subjectsLoading
                        ? "Loading subjects..."
                        : !selectedSubject || selectedSubject === 0
                          ? "Select a subject first"
                          : !availableUnits.length
                            ? "No units available"
                            : "Select unit"}
                    </option>
                    {availableUnits.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <div className="at-select-arrow">
                    <ChevronDown style={{ width: 13, height: 13 }} />
                  </div>
                </div>
              </div>
              <div className="at-divider" style={{ marginBottom: 10 }} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <div className="at-select-label" style={{ marginBottom: 0 }}>
                  Recent Chats
                </div>
                <button
                  className="at-new-chat-icon-btn"
                  onClick={() => {
                    startNewChat();
                    setIsLeftPanelOpen(false);
                  }}
                  title="New chat"
                >
                  <Plus style={{ width: 13, height: 13 }} />
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {filteredChatHistory.length === 0 ? (
                  <div
                    style={{
                      textAlign: "center",
                      padding: "18px 8px",
                      color: "#94a3b8",
                      fontSize: 11.5,
                    }}
                  >
                    No chat history available
                  </div>
                ) : (
                  filteredChatHistory.map((chat) => (
                    <div
                      key={chat.id}
                      className={`at-hist-item${currentChatId === chat.id ? " active" : ""}`}
                      onClick={() => {
                        loadChat(chat);
                        setIsLeftPanelOpen(false);
                      }}
                    >
                      <div style={{ fontSize: 16, flexShrink: 0 }}>
                        {subjects.find((s) => s.label === chat.subject)
                          ?.emoji || "💬"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <MarqueeTitle text={chat.title} />
                        <div className="at-hist-meta">
                          {chat.messages.length} msgs
                        </div>
                      </div>
                      <button
                        className="at-hist-del"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.id);
                        }}
                      >
                        <X style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              {filteredChatHistory.length > 0 && (
                <button
                  className="at-clear-btn"
                  style={{ marginTop: 10 }}
                  onClick={clearAllHistory}
                >
                  🗑 Clear All History
                </button>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <Sheet
          open={isRightPanelOpen}
          onOpenChange={(open) => {
            setIsRightPanelOpen(open);
            if (!open) setRightPanelView("studio");
          }}
        >
          <SheetContent
            side="right"
            className="p-0 w-[85vw] sm:w-80 flex flex-col"
            style={{ background: "#fff", borderLeft: "1px solid #f1f5f9" }}
          >
            <SheetHeader
              className="p-4 pb-3 flex-shrink-0"
              style={{ borderBottom: "1px solid #f1f5f9" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {rightPanelView !== "studio" && (
                  <button
                    onClick={() => setRightPanelView("studio")}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#6366f1",
                      display: "flex",
                      alignItems: "center",
                      padding: 3,
                      borderRadius: 7,
                    }}
                  >
                    <ChevronLeft style={{ width: 17, height: 17 }} />
                  </button>
                )}
                <SheetTitle
                  className="text-base flex items-center gap-2"
                  style={{ color: "#0f172a" }}
                >
                  <span>{rightPanelView === "faq" ? "❓" : "🧪"}</span>
                  {rightPanelView === "studio" && "Mind Lab"}
                  {rightPanelView === "faq" && "FAQ & Notes"}
                  {rightPanelView === "ask-ai" && "Ask AI"}
                </SheetTitle>
              </div>
            </SheetHeader>
            <div style={{ flex: 1, overflowY: "auto" }} className="at-scroll">
              {rightPanelView === "faq" && (
                <FAQPanel
                  subject={selectedSubjectData?.value || ""}
                  unit={selectedUnit}
                  unitId={selectedUnitId}
                  onBack={() => setRightPanelView("studio")}
                />
              )}
              {rightPanelView === "ask-ai" && (
                <AskAIPanel initialQuestion={askAIInitialQuestion} />
              )}
              {rightPanelView === "studio" && (
                <div>
                  {selectedSubjectData &&
                    selectedSubjectData.value !== "all" && (
                      <div
                        className="at-ctx-card"
                        style={{ margin: "10px 12px 0" }}
                      >
                        <div className="at-ctx-label">Active Context</div>
                        <div className="at-ctx-val">
                          {selectedSubjectData.emoji}{" "}
                          {selectedSubjectData.label}
                          {selectedUnit ? ` · ${selectedUnit}` : ""}
                        </div>
                        <div className="at-ctx-note">
                          Tools will use this context
                        </div>
                      </div>
                    )}
                  <div className="at-mindlab-grid">
                    <div
                      className="at-ml-card blue"
                      onClick={() => {
                        const p = new URLSearchParams();
                        if (selectedSubjectData?.value !== "all")
                          p.append("subject", selectedSubjectData?.value || "");
                        if (selectedUnit) p.append("unit", selectedUnit);
                        if (selectedUnitId) p.append("unitId", selectedUnitId);
                        if (
                          selectedSubjectData?.value &&
                          selectedSubjectData.value !== "all"
                        )
                          p.append(
                            "subjectGroupKey",
                            selectedSubjectData.value,
                          );
                        p.append("from", "/ai-tutor-modern");
                        setLocation(`/studio/quiz?${p.toString()}`);
                        setIsRightPanelOpen(false);
                      }}
                    >
                      <span className="at-ml-icon">📝</span>
                      <div className="at-ml-name">Quiz</div>
                      <div className="at-ml-desc">Test your knowledge</div>
                    </div>
                    <div
                      className="at-ml-card indigo"
                      onClick={() => {
                        setLocation(
                          `/studio/question-bank?subjectId=${selectedSubject !== 0 ? selectedSubject : ""}&from=/ai-tutor-modern`,
                        );
                        setIsRightPanelOpen(false);
                      }}
                    >
                      <span className="at-ml-icon">📖</span>
                      <div className="at-ml-name">Q-Bank</div>
                      <div className="at-ml-desc">Past questions</div>
                    </div>
                    <div
                      className="at-ml-card orange col2"
                      onClick={() => setRightPanelView("faq")}
                    >
                      <span className="at-ml-icon">❓</span>
                      <div className="at-ml-name">FAQ & Notes</div>
                      <div className="at-ml-desc">
                        Frequently asked questions and study notes
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Tutorial */}
        {tutorial.active && tutorial.currentStep && (
          <TutorialTooltip
            step={tutorial.currentStep}
            stepIndex={tutorial.stepIdx}
            total={TUTORIAL_STEPS.length}
            onNext={tutorial.next}
            onPrev={tutorial.prev}
            onSkip={tutorial.skip}
            targetRect={tutorial.targetRect}
          />
        )}
      </div>
    </>
  );
}
