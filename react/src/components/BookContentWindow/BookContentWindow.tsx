import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "../ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Label } from "../ui/label";
import {
  BookOpen,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Bot,
  User,
  Send,
  X,
  Highlighter as HighlighterIcon,
  Sparkles,
  Zap,
  Trash2,
  Edit3,
} from "lucide-react";

import Navigation from "../../components/navigation";
import FormattedAIContent from "../ai/FormattedAIContent";
import { useAuth } from "../../hooks/use-auth";
import FunnyLoader from "../ui/FunnyLoader";
import { useTheme } from "../../hooks/use-theme";
import { useToast } from "../../hooks/use-toast";
import {
  explainHighlight,
  askHighlight,
  getLibrarySubjects,
  getLibrarySubjectDetail,
  getUnitContent,
  summarizeHighlight,
  type LibrarySubject,
} from "../../lib/gradeupApi";
import { buildApiUrl } from "../../lib/apiBase";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Chapter {
  id: number | string;
  title: string;
  content: string;
  unit: number;
  unitTitle?: string;
  enhancedContent?: string;
  layout?: any;
  sectionTopics?: Array<{
    id: string;
    label: string;
    title: string;
    number?: string | null;
    anchor: string;
  }>;
  sourceContent?: any;
  isUnitIntro?: boolean;
  realChapter?: Chapter;
}
export interface Highlight {
  id: string;
  text: string;
  comment: string;
  color: string;   // e.g. "yellow" | "green" | "blue" | "pink" | "purple"
}
interface Book {
  id: string;
  title: string;
  subject: string;
  color: string;
  chapters: Chapter[];
  coverImageUrl?: string | null;
  imageCandidates?: string[];
}

// ─── Ask AI chat message type ─────────────────────────────────────────────────
interface AskAIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  selectedText?: string;
  actionLabel?: "Explain" | "Summarize" | "Ask AI";
}

function pickImageCandidate(...values: any[]): string | null {
  for (const value of values) {
    if (!value) continue;

    if (Array.isArray(value)) {
      const nested = pickImageCandidate(...value);
      if (nested) return nested;
      continue;
    }

    if (typeof value === "object") {
      const nested = pickImageCandidate(
        value.url,
        value.src,
        value.path,
        value.assetUrl,
        value.asset,
        value.mediaUrl,
        value.image,
        value.imageUrl,
        value.thumbnail,
        value.thumbnailUrl,
        value.coverImage,
        value.coverImageUrl,
      );
      if (nested) return nested;
      continue;
    }

    const raw = String(value).trim();
    if (!raw) continue;
    return raw;
  }

  return null;
}

function resolveMediaUrl(value: any): string | null {
  const candidate = pickImageCandidate(value);
  if (!candidate) {
    return null;
  }

  return buildApiUrl(candidate);
}

function normalizeArrayField(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.values(value).map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function serializeBlocksForGenius(layout: any[] | undefined, fallbackContent: string) {
  const blocks = Array.isArray(layout) && layout.length
    ? layout
    : buildTextLayoutFromString(fallbackContent || "");

  return blocks
    .map((block) => {
      if (!block) return "";

      if (block.type === "heading1") return `# ${block.content || ""}`;
      if (block.type === "heading2") return `## ${block.content || ""}`;
      if (block.type === "heading3") return `### ${block.content || ""}`;
      if (block.type === "list" && Array.isArray(block.items)) {
        return block.items.map((item: string) => `- ${item}`).join("\n");
      }
      if (block.type === "formula") {
        return `### Formula\n${block.content || ""}`;
      }
      if (block.type === "table" && Array.isArray(block.rows)) {
        return block.rows
          .map((row: string[]) => row.filter(Boolean).join(" | "))
          .filter(Boolean)
          .join("\n");
      }
      if (block.type === "image" || block.imageUrl || block.image || block.src || block.media || block.images) {
        const imageUrl = resolveMediaUrl(
          block.imageUrl ||
          block.image ||
          block.src ||
          block.url ||
          block.assetUrl ||
          block.asset ||
          block.thumbnail ||
          block.thumbnailUrl ||
          block.coverImage ||
          block.coverImageUrl ||
          block.images ||
          block.media,
        );
        if (!imageUrl) return "";
        const caption = String(block.caption || block.title || "Illustration").replace(/[\r\n]+/g, " ").trim();
        return `![${caption}](${imageUrl})`;
      }
      if (block.type === "html") {
        return flattenContentToText(block.content || "").trim();
      }

      return flattenContentToText(block.content || block.text || "").trim();
    })
    .filter(Boolean)
    .join("\n\n");
}

// ─── sessionStorage helpers ───────────────────────────────────────────────────
function aiChatKey(bookId: string, chapterId: any) {
  return `bcw-ai::${bookId}::${chapterId}`;
}
function loadAIChat(bookId: string, chapterId: any): AskAIMessage[] {
  try {
    const raw = sessionStorage.getItem(aiChatKey(bookId, chapterId));
    if (!raw) return [];
    return JSON.parse(raw).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch { return []; }
}
function saveAIChat(bookId: string, chapterId: any, msgs: AskAIMessage[]) {
  try { sessionStorage.setItem(aiChatKey(bookId, chapterId), JSON.stringify(msgs)); } catch {}
}

const READER_STATE_KEY = "bcw-reader-state";
function saveReaderState(state: { bookId: string; chapterId: any; isDark: boolean }) {
  try { sessionStorage.setItem(READER_STATE_KEY, JSON.stringify(state)); } catch {}
}
function loadReaderState(): { bookId: string; chapterId: any; isDark: boolean } | null {
  try {
    const raw = sessionStorage.getItem(READER_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function clearReaderState() {
  try { sessionStorage.removeItem(READER_STATE_KEY); } catch {}
}


function openEnhancedView(
  content: string,
  title: string,
  subject: string,
  chapterId: any,
  bookId: string,
  isDark: boolean,
) {
  // ── 1. Strip HTML, normalise whitespace ──────────────────────────────────
  const cleanContent = content
    .replace(/<\/p>/gi,   "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<h([1-6])[^>]*>/gi, (_m: string, n: string) => "#".repeat(Number(n)) + " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // ── 2. Escape for JSON / JS string embedding ────────────────────────────
  const safeContent = cleanContent
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");

  const safeTitle   = title.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
  const safeSubject = subject.replace(/\\/g, "\\\\").replace(/`/g, "\\`");

  // ── 3. Build the full HTML (Sample 1 — Indigo Cosmos theme) ─────────────
  const html = `<!DOCTYPE html>
<html lang="en" data-theme="${isDark ? "dark" : "light"}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Enhanced Reader | ${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg-app:#f0f4f8;--bg-panel:#ffffff;--bg-panel2:#fafafa;
  --border:rgba(0,0,0,0.06);--border2:#e8edf3;
  --text-main:#0f172a;--text-sub:#64748b;--text-muted:#94a3b8;
  --shadow:0 2px 12px rgba(0,0,0,.06);--shadow2:0 12px 40px rgba(0,0,0,.12);
  --shadow3:0 32px 80px rgba(0,0,0,.18);
  --indigo:#6366f1;--indigo-d:#4f46e5;--indigo-l:#8b5cf6;
  --green:#10b981;--amber:#f59e0b;--pink:#ec4899;
  --prog-bg:#e8edf3;--hl-bg:rgba(99,102,241,0.14);--hl-border:#6366f1;
  --book-shadow:0 40px 100px rgba(99,102,241,.12),0 20px 60px rgba(0,0,0,.16);
  --page-shadow:inset -4px 0 12px rgba(0,0,0,.06);
}
[data-theme="dark"]{
  --bg-app:#060d1f;--bg-panel:#0f1c35;--bg-panel2:#162040;
  --border:rgba(255,255,255,0.07);--border2:rgba(255,255,255,0.08);
  --text-main:#f1f5f9;--text-sub:#94a3b8;--text-muted:#4e6284;
  --shadow:0 2px 16px rgba(0,0,0,.4);--shadow2:0 12px 40px rgba(0,0,0,.55);
  --shadow3:0 32px 80px rgba(0,0,0,.7);
  --book-shadow:0 40px 100px rgba(99,102,241,.22),0 20px 60px rgba(0,0,0,.5);
  --page-shadow:inset -4px 0 16px rgba(0,0,0,.2);
  --prog-bg:rgba(255,255,255,0.07);
  --hl-bg:rgba(99,102,241,0.22);--hl-border:#a5b4fc;
}
html,body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:var(--bg-app);min-height:100vh;color:var(--text-main);transition:background .35s,color .35s;overflow-x:hidden;}
/* NAV */
.ev-top-nav{position:fixed;top:0;left:0;right:0;height:56px;z-index:1000;display:flex;align-items:center;justify-content:space-between;padding:0 24px;background:var(--bg-panel);border-bottom:1px solid var(--border2);box-shadow:var(--shadow);transition:background .35s,border-color .35s;}
@media(max-width:480px){.ev-top-nav{padding:0 12px;}}
.nav-left{display:flex;align-items:center;gap:10px;}
.nav-logo{width:34px;height:34px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:16px;}
.nav-brand{line-height:1;}
.nav-brand-name{font-size:13px;font-weight:800;color:var(--text-main);letter-spacing:-.2px;}
.nav-brand-sub{font-size:10px;font-weight:500;color:var(--text-muted);margin-top:1px;}
.nav-sep{width:1px;height:26px;background:var(--border2);}
@media(max-width:500px){.nav-sep,.nav-brand-sub{display:none;}}
.nav-pill{padding:4px 12px;border-radius:20px;font-size:10.5px;font-weight:700;background:rgba(99,102,241,.1);color:#6366f1;border:1px solid rgba(99,102,241,.2);white-space:nowrap;}
[data-theme="dark"] .nav-pill{background:rgba(99,102,241,.2);color:#a5b4fc;border-color:rgba(99,102,241,.35);}
@media(max-width:420px){.nav-pill{display:none;}}
.nav-right{display:flex;align-items:center;gap:8px;}
.nav-pg-pill{display:flex;align-items:center;gap:5px;padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700;background:var(--bg-panel2);border:1px solid var(--border2);color:var(--text-sub);}
.pg-dot{width:6px;height:6px;border-radius:50%;background:var(--indigo);animation:pgpulse 2s ease-in-out infinite;}
@keyframes pgpulse{0%,100%{opacity:.35}50%{opacity:1}}
@media(max-width:520px){.nav-pg-pill{display:none;}}
.hl-btn{display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(99,102,241,.09);border:1px solid rgba(99,102,241,.2);color:#6366f1;cursor:pointer;transition:all .2s;}
.hl-btn:hover{background:rgba(99,102,241,.18);transform:translateY(-1px);}
[data-theme="dark"] .hl-btn{background:rgba(99,102,241,.18);color:#a5b4fc;border-color:rgba(99,102,241,.3);}
@media(max-width:400px){.hl-btn{display:none;}}
.icon-btn{width:35px;height:35px;border-radius:10px;flex-shrink:0;border:1px solid var(--border2);background:var(--bg-panel2);cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:all .2s;color:var(--text-sub);}
.icon-btn:hover{border-color:var(--indigo);color:var(--indigo);}
/* READING BAR */
.reading-bar{height:3px;background:var(--prog-bg);}
.reading-bar-fill{height:100%;width:0%;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899);transition:width .5s ease;border-radius:0 3px 3px 0;}
/* STAT CARDS */
.stats-bar{display:flex;gap:10px;padding:65px 24px 0;flex-wrap:wrap;margin-bottom:10px;}
@media(max-width:600px){.stats-bar{padding:75px 12px 0;gap:8px;}}
.scard{display:flex;align-items:center;gap:9px;padding:9px 14px;border-radius:14px;background:var(--bg-panel);border:1px solid var(--border2);box-shadow:var(--shadow);transition:all .25s cubic-bezier(.4,0,.2,1);animation:scardIn .5s cubic-bezier(.34,1.56,.64,1) both;}
@keyframes scardIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.scard:hover{transform:translateY(-3px);box-shadow:var(--shadow2);}
.scard.c-indigo{border-top:3px solid #6366f1;}.scard.c-green{border-top:3px solid #10b981;}.scard.c-amber{border-top:3px solid #f59e0b;}.scard.c-purple{border-top:3px solid #8b5cf6;}
.scard-icon{width:32px;height:32px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:15px;}
.c-indigo .scard-icon{background:rgba(99,102,241,.1);}.c-green .scard-icon{background:rgba(16,185,129,.1);}.c-amber .scard-icon{background:rgba(245,158,11,.1);}.c-purple .scard-icon{background:rgba(139,92,246,.1);}
.scard-n{font-size:15px;font-weight:800;color:var(--text-main);line-height:1;}
.scard-l{font-size:9.5px;font-weight:600;color:var(--text-muted);margin-top:1px;}
@media(max-width:480px){.scard:nth-child(n+4){display:none;}}
/* 3D BOOK */
.ev-scroll-canvas{padding:18px 0 60px;position:relative;}
.ev-book-container-wrapper{width:100%;display:flex;justify-content:center;padding:10px 14px;}
@media(min-width:992px){.ev-book-container-wrapper{perspective:2800px;padding:1.5rem 2.5rem 2rem;}}
.book-scene{position:relative;width:100%;max-width:1100px;}
@media(min-width:992px){.book-scene{transform-style:preserve-3d;animation:bookEntrance .8s cubic-bezier(.34,1.4,.64,1) both;}}
@keyframes bookEntrance{from{opacity:0;transform:rotateX(12deg) rotateY(-6deg) translateY(30px) scale(.96);}to{opacity:1;transform:rotateX(3deg) rotateY(0deg) translateY(0) scale(1);}}
.book-3d{position:relative;border-radius:4px 18px 18px 4px;}
@media(min-width:992px){.book-3d{box-shadow:var(--book-shadow);}.book-3d::after{content:'';position:absolute;bottom:-8px;left:20px;right:12px;height:16px;background:linear-gradient(180deg,var(--border2),transparent);border-radius:0 0 8px 8px;z-index:-1;filter:blur(2px);}}
.book-page-stack{display:none;}
@media(min-width:992px){.book-page-stack{display:block;position:absolute;top:4px;bottom:4px;right:-7px;width:14px;border-radius:0 3px 3px 0;z-index:-1;}.book-page-stack::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,#e2e8f0 0px,#e2e8f0 2px,#f0f4f8 2px,#f0f4f8 4px);border-radius:0 3px 3px 0;box-shadow:3px 0 8px rgba(0,0,0,.09);}[data-theme="dark"] .book-page-stack::before{background:repeating-linear-gradient(0deg,#1a2540 0px,#1a2540 2px,#1f2d4a 2px,#1f2d4a 4px);}}
.book-spine{display:none;}
@media(min-width:992px){.book-spine{display:block;position:absolute;top:0;bottom:0;left:0;width:24px;background:linear-gradient(180deg,#4338ca,#3730a3,#4338ca);border-radius:4px 0 0 4px;z-index:10;box-shadow:inset -3px 0 8px rgba(0,0,0,.25),3px 0 14px rgba(67,56,202,.35);}.book-spine::before{content:'';position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:1px;background:rgba(165,180,252,.3);}.book-spine::after{content:'ENHANCED READER';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-90deg);font-family:'Plus Jakarta Sans',sans-serif;font-size:7px;font-weight:800;letter-spacing:.25em;color:rgba(255,255,255,.45);white-space:nowrap;}}
.ev-book-container{display:flex;flex-direction:column;gap:14px;background:transparent;}
@media(min-width:992px){.ev-book-container{flex-direction:row;gap:0;background:var(--bg-panel);border-radius:0 16px 16px 0;overflow:hidden;min-height:78vh;margin-left:24px;border:1px solid var(--border2);border-left:none;}}
.ev-book-page{flex:1;padding:32px 22px;position:relative;background:var(--bg-panel);border-radius:14px;box-shadow:var(--shadow);transition:background .35s;overflow:hidden;}
@media(min-width:992px){.ev-book-page{padding:52px 48px;border-radius:0;box-shadow:none;overflow:hidden;}.ev-book-page.ev-left{border-right:1px solid var(--border2);box-shadow:var(--page-shadow);}.ev-book-page.ev-right{transform-origin:left center;z-index:5;transition:transform .85s cubic-bezier(.645,.045,.355,1),background .35s;}.flipping{transform:rotateY(-180deg);}}
.ev-book-page.ev-left::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#6366f1,#8b5cf6,#ec4899);z-index:2;}
@media(min-width:992px){.ev-book-page.ev-left::after{content:'';position:absolute;top:0;right:0;bottom:0;width:20px;background:linear-gradient(270deg,rgba(0,0,0,.04),transparent);pointer-events:none;z-index:1;}.ev-book-page.ev-right::after{content:'';position:absolute;top:0;left:0;bottom:0;width:20px;background:linear-gradient(90deg,rgba(0,0,0,.03),transparent);pointer-events:none;z-index:1;}}
.deco-orb{position:absolute;border-radius:50%;pointer-events:none;background:rgba(99,102,241,.05);}
[data-theme="dark"] .deco-orb{background:rgba(99,102,241,.09);}
.ai-scan-line{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(99,102,241,.35),transparent);z-index:3;pointer-events:none;animation:scanDown 5s ease-in-out infinite;opacity:0;}
@keyframes scanDown{0%{top:-10px;opacity:0;}8%{opacity:.8;}90%{opacity:.4;}100%{top:105%;opacity:0;}}
/* CHAPTER HEADER */
.chapter-header{margin-bottom:22px;position:relative;z-index:1;}
.chapter-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 11px;border-radius:20px;margin-bottom:9px;background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.2);font-size:9.5px;font-weight:800;color:#6366f1;letter-spacing:.1em;text-transform:uppercase;}
[data-theme="dark"] .chapter-pill{background:rgba(99,102,241,.2);color:#a5b4fc;border-color:rgba(99,102,241,.35);}
.cpill-dot{width:5px;height:5px;border-radius:50%;background:#6366f1;}
[data-theme="dark"] .cpill-dot{background:#a5b4fc;}
.chapter-h1{font-family:'Playfair Display',serif;font-weight:900;font-size:clamp(22px,3.5vw,38px);line-height:1.05;color:var(--text-main);margin-bottom:6px;letter-spacing:-.5px;}
.chapter-h1 em{font-style:italic;color:#6366f1;}
[data-theme="dark"] .chapter-h1 em{color:#a5b4fc;}
.chapter-tagline{font-family:'Crimson Pro',serif;font-style:italic;font-size:13px;color:var(--text-muted);line-height:1.6;margin-bottom:16px;}
.chapter-hstats{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:18px;}
.chstat{text-align:center;padding:6px 12px;border-radius:10px;min-width:52px;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.15);transition:transform .18s;}
[data-theme="dark"] .chstat{background:rgba(99,102,241,.16);border-color:rgba(99,102,241,.28);}
.chstat:hover{transform:translateY(-2px);}
.chstat-n{font-size:13px;font-weight:800;color:#6366f1;line-height:1;}
[data-theme="dark"] .chstat-n{color:#a5b4fc;}
.chstat-l{font-size:8.5px;font-weight:600;color:var(--text-muted);margin-top:2px;}
.chapter-divider{height:1px;background:var(--border2);margin-bottom:20px;position:relative;}
.chapter-divider::before{content:'';position:absolute;left:0;top:-.5px;width:48px;height:2px;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:2px;}
/* CONTENT */
.ev-book-page p{font-family:'Crimson Pro',serif;font-size:clamp(13.5px,1.45vw,16px);color:var(--text-sub);line-height:1.9;margin-bottom:16px;text-align:justify;position:relative;z-index:1;}
.ev-book-page h2{font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:.14em;margin:22px 0 12px;display:flex;align-items:center;gap:8px;position:relative;z-index:1;}
.ev-book-page h2::after{content:'';flex:1;height:1px;background:var(--border2);}
.ev-book-page h3{font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:700;color:#6366f1;margin:18px 0 10px;border-left:3px solid #6366f1;padding-left:10px;position:relative;z-index:1;}
[data-theme="dark"] .ev-book-page h3{color:#a5b4fc;border-color:#a5b4fc;}
.ev-book-page h4{font-family:'Plus Jakarta Sans',sans-serif;font-size:13px;font-weight:700;color:var(--text-main);margin:16px 0 10px;position:relative;z-index:1;}
.ev-book-page ul{padding-left:20px;margin-bottom:16px;position:relative;z-index:1;}
.ev-book-page ul li{font-family:'Crimson Pro',serif;font-size:clamp(13px,1.35vw,15px);color:var(--text-sub);line-height:1.8;margin-bottom:5px;}
.ev-book-page ul li::marker{color:#6366f1;}
.ev-figure{margin:18px 0 20px;position:relative;z-index:1;}
.ev-figure img{display:block;width:100%;max-height:320px;object-fit:contain;border-radius:14px;border:1px solid var(--border2);background:rgba(99,102,241,.04);box-shadow:var(--shadow);}
.ev-figcaption{font-size:11px;color:var(--text-muted);text-align:center;margin-top:8px;font-style:italic;}
.ev-formula{font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;line-height:1.7;margin:16px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(99,102,241,.18);background:rgba(99,102,241,.08);color:var(--text-main);white-space:pre-wrap;}
.ev-highlighted-text{background:var(--hl-bg);border-bottom:2px solid var(--hl-border);border-radius:2px;padding:1px 3px;cursor:help;transition:background .2s;}
.ev-highlighted-text:hover{background:rgba(99,102,241,.24);}
.continuation-header{margin-bottom:20px;position:relative;z-index:1;}
.continuation-label{font-family:'Plus Jakarta Sans',sans-serif;font-size:9px;font-weight:800;letter-spacing:.2em;color:rgba(99,102,241,.45);text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:8px;}
.continuation-label::after{content:'';flex:1;height:1px;background:var(--border2);}
/* CONTEXT MENU */
#context-menu{position:absolute;display:none;z-index:2000;background:var(--bg-panel);border:1px solid var(--border2);border-radius:14px;padding:8px;box-shadow:var(--shadow2);transform:translateX(-50%);animation:ctxPop .15s cubic-bezier(.34,1.56,.64,1);}
@keyframes ctxPop{from{opacity:0;transform:translateX(-50%) scale(.9) translateY(-4px);}to{opacity:1;transform:translateX(-50%) scale(1) translateY(0);}}
.ctx-btn{display:flex;align-items:center;gap:6px;padding:7px 16px;border-radius:9px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;box-shadow:0 3px 12px rgba(99,102,241,.35);transition:all .18s;}
.ctx-btn:hover{transform:translateY(-1px);box-shadow:0 5px 18px rgba(99,102,241,.5);}
/* MODAL */
#modal-overlay{display:none;position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.5);backdrop-filter:blur(5px);align-items:center;justify-content:center;padding:20px;}
.modal-box{background:var(--bg-panel);border:1px solid var(--border2);border-radius:22px;padding:28px;width:100%;max-width:420px;box-shadow:var(--shadow3);animation:modalPop .3s cubic-bezier(.34,1.56,.64,1);}
@keyframes modalPop{from{opacity:0;transform:scale(.9) translateY(12px);}to{opacity:1;transform:none;}}
.modal-hd{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.modal-icon{width:38px;height:38px;border-radius:11px;flex-shrink:0;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:18px;}
.modal-title{font-size:16px;font-weight:800;color:var(--text-main);}
.modal-sub{font-size:11px;color:var(--text-muted);margin-top:1px;}
.modal-preview{font-family:'Crimson Pro',serif;font-style:italic;font-size:13px;color:var(--text-sub);line-height:1.6;border-left:3px solid #6366f1;padding:8px 0 8px 12px;margin-bottom:14px;background:rgba(99,102,241,.05);border-radius:0 8px 8px 0;}
[data-theme="dark"] .modal-preview{background:rgba(99,102,241,.12);}
.modal-textarea{width:100%;height:82px;border:1.5px solid var(--border2);border-radius:12px;padding:12px;background:var(--bg-panel2);color:var(--text-main);font-family:inherit;font-size:13px;resize:none;outline:none;transition:border-color .2s;margin-bottom:14px;}
.modal-textarea:focus{border-color:#6366f1;}
.modal-actions{display:flex;gap:10px;}
.modal-save{flex:1;padding:10px;border-radius:12px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,.35);transition:all .2s;}
.modal-save:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(99,102,241,.5);}
.modal-cancel{flex:1;padding:10px;border-radius:12px;font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;border:1.5px solid var(--border2);background:none;color:var(--text-sub);}
.modal-cancel:hover{border-color:#6366f1;color:#6366f1;}
/* HL PANEL */
#hl-panel{display:none;position:fixed;right:0;top:56px;bottom:0;width:300px;background:var(--bg-panel);border-left:1px solid var(--border2);box-shadow:-4px 0 24px rgba(0,0,0,.08);z-index:900;overflow-y:auto;padding:18px;animation:panelSlide .25s ease;transition:background .35s;}
@keyframes panelSlide{from{transform:translateX(16px);opacity:0}to{transform:none;opacity:1}}
@media(max-width:640px){#hl-panel{width:100%;left:0;}}
.hlp-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border2);}
.hlp-title{font-size:14px;font-weight:800;color:var(--text-main);display:flex;align-items:center;gap:7px;}
.hlp-ico{width:28px;height:28px;border-radius:8px;background:rgba(99,102,241,.1);display:flex;align-items:center;justify-content:center;font-size:14px;}
.hlp-close{width:30px;height:30px;border-radius:9px;border:1px solid var(--border2);background:none;cursor:pointer;font-size:14px;color:var(--text-muted);display:flex;align-items:center;justify-content:center;transition:all .18s;}
.hlp-close:hover{border-color:#6366f1;color:#6366f1;}
.hlp-empty{text-align:center;padding:40px 20px;font-size:13px;color:var(--text-muted);line-height:1.6;}
.hl-card{border-radius:13px;padding:12px 13px;margin-bottom:8px;border:1.5px solid var(--border2);background:var(--bg-panel2);position:relative;overflow:hidden;transition:all .2s;}
.hl-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,#6366f1,#8b5cf6);}
.hl-card:hover{border-color:rgba(99,102,241,.3);transform:translateY(-1px);box-shadow:var(--shadow);}
.hl-card-text{font-family:'Crimson Pro',serif;font-style:italic;font-size:13px;color:var(--text-sub);line-height:1.55;margin-bottom:6px;}
.hl-card-note{font-size:11px;font-weight:600;color:var(--text-muted);display:flex;align-items:center;gap:5px;}
.hl-tag{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:rgba(99,102,241,.1);color:#6366f1;}
[data-theme="dark"] .hl-tag{background:rgba(99,102,241,.2);color:#a5b4fc;}
/* NAV BUTTONS */
.page-nav-bar{display:flex;align-items:center;justify-content:center;gap:12px;padding:16px 0 28px;flex-wrap:wrap;}
.nav-btn{padding:10px 24px;border-radius:30px;border:1.5px solid var(--border2);font-family:inherit;font-size:13px;font-weight:700;background:var(--bg-panel);color:var(--text-sub);cursor:pointer;transition:all .22s;box-shadow:var(--shadow);}
.nav-btn:hover:not(:disabled){border-color:#6366f1;color:#6366f1;background:rgba(99,102,241,.05);transform:translateY(-2px);box-shadow:var(--shadow2);}
.nav-btn:disabled{opacity:.3;cursor:default;}
.nav-btn.primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-color:transparent;box-shadow:0 4px 16px rgba(99,102,241,.4);}
.nav-btn.primary:hover:not(:disabled){color:#fff;border-color:transparent;box-shadow:0 6px 24px rgba(99,102,241,.55);}
.page-badge{padding:7px 16px;border-radius:20px;font-size:12px;font-weight:700;background:var(--bg-panel2);border:1px solid var(--border2);color:var(--text-muted);}
footer.page-num{position:absolute;bottom:16px;font-size:11px;font-weight:600;color:var(--text-muted);z-index:1;}
.footer-left{left:22px;}.footer-right{right:22px;}
/* AI BOT */
.ai-bot-wrap{position:fixed;bottom:28px;right:24px;z-index:800;display:flex;flex-direction:column;align-items:flex-end;gap:10px;}
@media(max-width:480px){.ai-bot-wrap{bottom:20px;right:14px;}}
.ai-bubble{background:var(--bg-panel);border:1px solid rgba(99,102,241,.25);border-radius:16px 16px 4px 16px;padding:10px 14px;max-width:220px;box-shadow:var(--shadow2);font-size:12px;font-weight:600;color:var(--text-main);line-height:1.5;opacity:0;transform:translateY(8px) scale(.95);transition:all .35s cubic-bezier(.34,1.56,.64,1);pointer-events:none;}
.ai-bubble.visible{opacity:1;transform:none;pointer-events:all;}
.ai-bubble-accent{font-size:10px;font-weight:700;color:var(--indigo);margin-bottom:3px;display:flex;align-items:center;gap:5px;}
.ai-bubble-dot{width:5px;height:5px;border-radius:50%;background:var(--indigo);}
[data-theme="dark"] .ai-bubble{border-color:rgba(99,102,241,.35);}
.ai-bot-btn{width:52px;height:52px;border-radius:50%;cursor:pointer;position:relative;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:3px solid rgba(99,102,241,.3);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(99,102,241,.45);transition:all .3s;animation:botFloat 3s ease-in-out infinite;}
.ai-bot-btn:hover{transform:scale(1.1);box-shadow:0 8px 32px rgba(99,102,241,.6);}
@keyframes botFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}
.ai-bot-orbit{position:absolute;inset:-8px;border-radius:50%;border:1.5px solid rgba(99,102,241,.25);animation:orbitSpin 3s linear infinite;}
.ai-bot-orbit::before{content:'';position:absolute;top:-4px;left:50%;width:8px;height:8px;border-radius:50%;background:#6366f1;transform:translateX(-50%);box-shadow:0 0 8px rgba(99,102,241,.8);}
@keyframes orbitSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.ai-bot-pulse{position:absolute;inset:-6px;border-radius:50%;background:rgba(99,102,241,.15);animation:botPulse 2.5s ease-out infinite;}
@keyframes botPulse{0%{transform:scale(1);opacity:.6;}100%{transform:scale(1.6);opacity:0;}}
.ai-bot-badge{position:absolute;top:2px;right:2px;width:12px;height:12px;border-radius:50%;background:#10b981;border:2px solid var(--bg-panel);animation:badgePulse 2s ease-in-out infinite;z-index:3;}
@keyframes badgePulse{0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.4);}50%{box-shadow:0 0 0 5px rgba(16,185,129,0);}}
.bot-face{font-size:24px;position:relative;z-index:2;animation:botBlink 4s ease-in-out infinite;}
@keyframes botBlink{0%,90%,100%{transform:scaleY(1);}95%{transform:scaleY(.1);}}
.ai-typing{display:flex;align-items:center;gap:3px;margin-top:5px;}
.ai-typing span{width:5px;height:5px;border-radius:50%;background:rgba(99,102,241,.5);animation:typingDot 1.2s ease-in-out infinite;}
.ai-typing span:nth-child(2){animation-delay:.2s;}.ai-typing span:nth-child(3){animation-delay:.4s;}
@keyframes typingDot{0%,100%{transform:translateY(0);opacity:.4;}50%{transform:translateY(-4px);opacity:1;}}
/* TOAST */
.toast{position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(8px);background:var(--bg-panel);border:1px solid var(--border2);border-radius:14px;padding:10px 18px;box-shadow:var(--shadow2);font-size:12px;font-weight:700;color:var(--text-main);display:flex;align-items:center;gap:7px;opacity:0;transition:all .3s;pointer-events:none;z-index:9999;white-space:nowrap;}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0);}
.toast-dot{width:7px;height:7px;border-radius:50%;background:#6366f1;flex-shrink:0;}
/* RESPONSIVE */
@media(min-width:640px) and (max-width:991px){.ev-book-container{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:transparent;}.ev-book-page{border-radius:14px;}}
@media(min-width:1400px){.ev-book-page{padding:60px 56px;}.ev-book-page p{font-size:16.5px;}}
@media(max-width:639px){.ev-book-page{padding:24px 16px 36px;border-radius:14px;}.ev-book-page p{font-size:14px;}.page-nav-bar{gap:8px;}.nav-btn{padding:8px 18px;font-size:12px;}}
@media(max-width:360px){.ev-book-page{padding:20px 14px 32px;}.chapter-h1{font-size:20px;}}
</style>
</head>
<body id="app">

<nav class="ev-top-nav">
  <div class="nav-left">
    <div class="nav-logo">📖</div>
    <div class="nav-brand">
      <div class="nav-brand-name">AI Enhanced Reader</div>
      <div class="nav-brand-sub" id="nav-title-sub">${title}</div>
    </div>
    <div class="nav-sep"></div>
    <div class="nav-pill" id="nav-subject-pill">${subject}</div>
  </div>
  <div class="nav-right">
    <div class="nav-pg-pill"><div class="pg-dot"></div><span id="nav-pg-txt">Page 1</span></div>
   
    <button class="icon-btn" onclick="toggleTheme()" id="theme-btn">${isDark ? "☀️" : "🌙"}</button>
  </div>
</nav>

<div class="reading-bar"><div class="reading-bar-fill" id="reading-bar"></div></div>

<div class="stats-bar">
  <div class="scard c-indigo" style="animation-delay:.05s"><div class="scard-icon">📖</div><div><div class="scard-n" id="stat-chapter">Ch. 1</div><div class="scard-l">Chapter</div></div></div>
  <div class="scard c-green"  style="animation-delay:.12s"><div class="scard-icon">⏱️</div><div><div class="scard-n" id="stat-readtime">~5 min</div><div class="scard-l">Read time</div></div></div>
  <div class="scard c-amber"  style="animation-delay:.19s"><div class="scard-icon">📄</div><div><div class="scard-n" id="stat-pages">1/1</div><div class="scard-l">Pages</div></div></div>
 

<main style="padding-top:5px;">
  <div class="ev-scroll-canvas">
    
    <div class="ev-book-container-wrapper">
      <div class="book-scene">
        <div class="book-3d">
          <div class="book-spine"></div>
          <div class="book-page-stack"></div>
          <article class="ev-book-container">
            <section class="ev-book-page ev-left">
              <div class="deco-orb" style="top:-50px;right:-50px;width:180px;height:180px;"></div>
              <div class="ai-scan-line"></div>
              <div id="left-content" style="position:relative;z-index:1;"></div>
              <footer class="page-num footer-left" id="footer-left"></footer>
            </section>
            <section class="ev-book-page ev-right" id="right-page">
              <div class="deco-orb" style="bottom:-40px;left:10%;width:160px;height:160px;"></div>
              <div id="right-content" style="position:relative;z-index:1;"></div>
              <footer class="page-num footer-right" id="footer-right"></footer>
            </section>
          </article>
        </div>
      </div>
    </div>
    <div class="page-nav-bar">
      <button class="nav-btn" id="prev-btn" onclick="flipPage(-1)">‹ Previous</button>
      <div class="page-badge" id="page-badge">1 / 1</div>
      <button class="nav-btn primary" id="next-btn" onclick="flipPage(1)">Next ›</button>
    </div>
  </div>
</main>

<div id="hl-panel">
  <div class="hlp-hd">
    <div class="hlp-title"><div class="hlp-ico">✏️</div>My Notes</div>
    <button class="hlp-close" onclick="toggleHlPanel()">✕</button>
  </div>
  <div id="hl-list"><div class="hlp-empty">No highlights yet.<br>Select any text to add a note.</div></div>
</div>

<div id="modal-overlay">
  <div class="modal-box">
    <div class="modal-hd">
      <div class="modal-icon">✏️</div>
      <div><div class="modal-title">Create Insight</div><div class="modal-sub">Add a note to your selection</div></div>
    </div>
    <div class="modal-preview" id="modal-preview"></div>
    <textarea class="modal-textarea" id="modal-note" placeholder="What are your thoughts on this passage?"></textarea>
    <div class="modal-actions">
      <button class="modal-save" onclick="saveHighlight()">Save Note</button>
      <button class="modal-cancel" onclick="closeModal()">Cancel</button>
    </div>
  </div>
</div>

<div class="ai-bot-wrap">
  <div class="ai-bubble" id="ai-bubble">
    <div class="ai-bubble-accent"><div class="ai-bubble-dot"></div>AI Assistant</div>
    <span id="ai-bubble-msg">Enhanced reading mode active!</span>
    <div class="ai-typing" id="ai-typing" style="display:none;"><span></span><span></span><span></span></div>
  </div>
  <button class="ai-bot-btn" onclick="toggleBubble()">
    <div class="ai-bot-pulse"></div>
    <div class="ai-bot-orbit"></div>
    <div class="bot-face">🤖</div>
    <div class="ai-bot-badge"></div>
  </button>
</div>

<script>
var state = {
  title: \`${safeTitle}\`,
  subject: \`${safeSubject}\`,
  rawContent: \`${safeContent}\`,
  spreads: [], currentIdx: 0, highlights: [],
  selectedText: '', hlOpen: false, bubbleOpen: false,
};

function init() {
  document.getElementById('nav-title-sub').textContent  = state.title;
  document.getElementById('nav-subject-pill').textContent = state.subject;
  document.title = 'AI Enhanced Reader | ' + state.title;
  var lines = state.rawContent.split('\\n').filter(function(l){ return l.trim(); });
  var perPage = 6;
  for (var i = 0; i < lines.length; i += perPage * 2) {
    state.spreads.push({ left: lines.slice(i, i+perPage), right: lines.slice(i+perPage, i+perPage*2) });
  }
  if (!state.spreads.length) state.spreads.push({ left: lines, right: [] });
  var words = state.rawContent.split(/\\s+/).length;
  document.getElementById('stat-readtime').textContent = '~' + Math.max(1, Math.round(words/200)) + ' min';
  render();
  setTimeout(function(){ showBubble('AI-enhanced content loaded!'); }, 1800);
}

function applyHighlights(text) {
  var t = text;
  state.highlights.forEach(function(h) {
    var esc = h.text.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g,'\\\\$&');
    var reg = new RegExp('('+esc+')','gi');
    t = t.replace(reg,'<span class="ev-highlighted-text" title="'+h.note+'">$1</span>');
  });
  return t;
}
function showSmartInsight() {
  const insights = [
    "This concept connects with earlier ideas...",
    "Notice the pattern in this section.",
    "This could be a key exam point.",
  ];

  setTimeout(() => {
    showBubble(insights[Math.floor(Math.random() * insights.length)]);
  }, 5000);
}
function lineToHTML(line, idx) {
  var l = line.trim();
  if (!l) return '';
  var imageMatch = l.match(/^!\[(.*?)\]\((.+?)\)$/);
  if (imageMatch) {
    var caption = imageMatch[1] || 'Illustration';
    var src = imageMatch[2];
    return '<figure class="ev-figure"><img src="'+src+'" alt="'+caption.replace(/"/g,'&quot;')+'" onerror="this.closest(\\'figure\\').style.display=\\'none\\'" /><figcaption class="ev-figcaption">'+caption+'</figcaption></figure>';
  }
  if (l.startsWith('### ')) return '<h3>'+applyHighlights(l.replace(/^###\\s*/,''))+'</h3>';
  if (l.startsWith('## '))  return '<h2>'+applyHighlights(l.replace(/^##\\s*/,''))+'</h2>';
  if (l.startsWith('# '))   return '<h4>'+applyHighlights(l.replace(/^#\\s*/,''))+'</h4>';
  if (/^[^|]+\\|[^|]+/.test(l)) return '<div class="ev-formula">'+applyHighlights(l)+'</div>';
  if (l.startsWith('- ') || l.startsWith('• ')) return '<ul><li>'+applyHighlights(l.replace(/^[-•]\\s*/,''))+'</li></ul>';
  return '<p>'+applyHighlights(l)+'</p>';
}

function render() {
  var spread = state.spreads[state.currentIdx] || {left:[],right:[]};
  var total  = state.spreads.length;
  var leftHTML = '';
  if (state.currentIdx === 0) {
    leftHTML = '<div class="chapter-header">'
      +'<div class="chapter-pill"><div class="cpill-dot"></div>'+state.subject+'</div>'
      +'<div class="chapter-h1">'+state.title+'</div>'
      +'<div class="chapter-tagline">AI-enhanced — select any text to add personal notes</div>'
      +'<div class="chapter-hstats">'
      +'<div class="chstat"><div class="chstat-n">'+total+'</div><div class="chstat-l">Spreads</div></div>'
      +'<div class="chstat"><div class="chstat-n">AI</div><div class="chstat-l">Enhanced</div></div>'
      +'<div class="chstat"><div class="chstat-n">✓</div><div class="chstat-l">Active</div></div>'
      +'</div><div class="chapter-divider"></div></div>';
  } else {
    leftHTML = '<div class="continuation-header"><div class="continuation-label">'+state.title+' — continued</div></div>';
  }
  spread.left.forEach(function(l,i){ leftHTML += lineToHTML(l,i); });
  var rightHTML = '';
  if (!spread.right || !spread.right.length) {
    rightHTML = '<div style="height:220px;display:flex;align-items:center;justify-content:center;opacity:.12;font-size:26px;letter-spacing:14px;color:#6366f1;">✦ ✦ ✦</div>';
  } else {
    rightHTML = '<div class="continuation-header"><div class="continuation-label">Continued</div></div>';
    spread.right.forEach(function(l,i){ rightHTML += lineToHTML(l,i); });
  }
  document.getElementById('left-content').innerHTML  = leftHTML;
  document.getElementById('right-content').innerHTML = rightHTML;
  document.getElementById('footer-left').innerText   = 'p.'+(state.currentIdx*2+1);
  document.getElementById('footer-right').innerText  = 'p.'+(state.currentIdx*2+2);
  document.getElementById('prev-btn').disabled = state.currentIdx === 0;
  document.getElementById('next-btn').disabled = state.currentIdx >= total-1;
  document.getElementById('page-badge').textContent  = (state.currentIdx+1)+' / '+total;
  document.getElementById('nav-pg-txt').textContent  = 'Page '+(state.currentIdx+1)+' of '+total;
  document.getElementById('stat-pages').textContent  = (state.currentIdx+1)+'/'+total;
  document.getElementById('stat-chapter').textContent= 'Spread '+(state.currentIdx+1);
  var pct = total > 1 ? (state.currentIdx/(total-1))*100 : 100;
  document.getElementById('reading-bar').style.width = pct+'%';
}

function flipPage(dir) {
  var newIdx = state.currentIdx+dir;
  if (newIdx < 0 || newIdx >= state.spreads.length) return;
  var isDesktop = window.innerWidth >= 992;
  if (dir === 1 && isDesktop) {
    var rp = document.getElementById('right-page');
    rp.classList.add('flipping');
    setTimeout(function(){ state.currentIdx=newIdx; rp.classList.remove('flipping'); render(); window.scrollTo({top:0,behavior:'smooth'}); }, 850);
  } else {
    state.currentIdx=newIdx; render(); window.scrollTo({top:0,behavior:'smooth'});
  }
  var msgs=['Great progress!','Select text to add notes.','Keep reading!','Almost there!'];
  setTimeout(function(){ showBubble(msgs[newIdx%msgs.length]); },400);
}

document.addEventListener('mouseup',function(){
  var sel=window.getSelection(), text=sel&&sel.toString().trim();
  var menu=document.getElementById('context-menu');
  if(text&&text.length>3){
    state.selectedText=text;
    var rect=sel.getRangeAt(0).getBoundingClientRect();
    menu.style.display='block';
    menu.style.top=(rect.top+window.scrollY-56)+'px';
    menu.style.left=(rect.left+rect.width/2)+'px';
  } else { menu.style.display='none'; }
});
document.addEventListener('mousedown',function(e){
  if(!e.target.closest('#context-menu')) document.getElementById('context-menu').style.display='none';
});
function openModal(){
  document.getElementById('modal-preview').textContent='"'+state.selectedText.substring(0,110)+(state.selectedText.length>110?'...:':'')+'"';
  document.getElementById('modal-note').value='';
  document.getElementById('modal-overlay').style.display='flex';
  document.getElementById('context-menu').style.display='none';
  setTimeout(function(){document.getElementById('modal-note').focus();},120);
}
function closeModal(){ document.getElementById('modal-overlay').style.display='none'; }
function saveHighlight(){
  var note=document.getElementById('modal-note').value.trim()||'Note added';
  state.highlights.push({text:state.selectedText,note:note});
  closeModal(); render(); updateHlPanel(); updateHlCount();
  showToast('Note saved!'); showBubble('Note saved! Great insight.');
}
function toggleHlPanel(){
  state.hlOpen=!state.hlOpen;
  document.getElementById('hl-panel').style.display=state.hlOpen?'block':'none';
  if(state.hlOpen) updateHlPanel();
}
function updateHlPanel(){
  var list=document.getElementById('hl-list');
  if(!state.highlights.length){list.innerHTML='<div class="hlp-empty">No highlights yet.<br>Select text to add a note.</div>';return;}
  list.innerHTML=state.highlights.map(function(h){
    return '<div class="hl-card"><div class="hl-card-text">"'+h.text.substring(0,90)+(h.text.length>90?'...':'')+'"</div><div class="hl-card-note"><span class="hl-tag">Note</span>'+h.note+'</div></div>';
  }).join('');
}
function updateHlCount(){
  var n=state.highlights.length;
  document.getElementById('hl-count').textContent=n;
  document.getElementById('stat-hl').textContent=n;
}
function toggleTheme(){
  var html=document.documentElement, btn=document.getElementById('theme-btn');
  var dark=html.getAttribute('data-theme')==='dark';
  html.setAttribute('data-theme',dark?'light':'dark');
  btn.textContent=dark?'🌙':'☀️';
  showBubble(dark?'Light mode activated!':'Dark mode activated!');
}
var BOT_MESSAGES = [
  "AI-enhanced reading activated.",
  "Your focus level is improving.",
  "You're building knowledge step by step.",
  "Think critically about this paragraph.",
  "Understanding > memorizing.",
  "You're learning smarter, not harder."
];
var bubbleTimer=null;
function showBubble(msg){
  var bubble=document.getElementById('ai-bubble'), msgEl=document.getElementById('ai-bubble-msg'), typing=document.getElementById('ai-typing');
  msgEl.style.display='none'; typing.style.display='flex';
  bubble.classList.add('visible'); state.bubbleOpen=true;
  clearTimeout(bubbleTimer);
  setTimeout(function(){ typing.style.display='none'; msgEl.style.display='inline'; msgEl.textContent=msg; },900);
  bubbleTimer=setTimeout(function(){ bubble.classList.remove('visible'); state.bubbleOpen=false; },5000);
}
function toggleBubble(){
  if(state.bubbleOpen){ document.getElementById('ai-bubble').classList.remove('visible'); state.bubbleOpen=false; clearTimeout(bubbleTimer); }
  else showBubble(BOT_MESSAGES[Math.floor(Math.random()*BOT_MESSAGES.length)]);
}
setInterval(function(){ if(!state.bubbleOpen) showBubble(BOT_MESSAGES[Math.floor(Math.random()*BOT_MESSAGES.length)]); },15000);
function showToast(msg){
  var t=document.getElementById('toast'); document.getElementById('toast-msg').textContent=msg;
  t.classList.add('show'); setTimeout(function(){t.classList.remove('show');},1600);
}
document.getElementById('modal-overlay').addEventListener('click',function(e){ if(e.target===document.getElementById('modal-overlay')) closeModal(); });
document.addEventListener('keydown',function(e){
  if(e.key==='ArrowRight'||e.key==='ArrowDown') flipPage(1);
  if(e.key==='ArrowLeft'||e.key==='ArrowUp') flipPage(-1);
  if(e.key==='Escape'){ closeModal(); if(state.hlOpen) toggleHlPanel(); document.getElementById('ai-bubble').classList.remove('visible'); }
});
init();
</script>
</body>
</html>`;

  // ── 4. Open as Blob URL (same as original) ──────────────────────────────
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

// ─── Library data ─────────────────────────────────────────────────────────────
const LIBRARY_DATA: Book[] = [
  {
    id: "bio-10",
    title: "Biology: Cellular Life",
    subject: "Science",
    color: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
    chapters: [
      {
        id: 1, unit: 1,
        title: "Cell Discovery & The Microscopic Frontier",
        content: "In 1665, Robert Hooke observed a thin slice of cork under a microscope. He saw thousands of tiny, empty chambers which he called 'cells'. This was the beginning of our understanding of the fundamental unit of life.",
        enhancedContent: `### The Genesis of Cytology\nIn the mid-17th century, the scientific world was limited by the naked eye until the invention of the compound microscope. In 1665, the British polymath Robert Hooke utilized a primitive but effective microscope to examine a thin shaving of cork. What he discovered was not a solid mass, but a complex lattice of tiny, box-like structures.\n\nHooke noted that these structures resembled the cella — the small, austere rooms inhabited by monks. Thus, the term "Cell" was born. While Hooke was actually looking at the dead cell walls of plant tissue, his observations paved the way for Antonie van Leeuwenhoek to later discover living, moving cells in pond water, which he called "animalcules."\n\n### The Three Pillars of Cell Theory\nBy the 1830s, German scientists Matthias Schleiden and Theodor Schwann, along with Rudolf Virchow, synthesized these observations into the Unified Cell Theory:\n\nUniversality: All living organisms, from single-celled bacteria to complex multicellular humans, are composed of one or more cells. Structure: The cell is the basic unit of structure, function, and organization in all biological systems. Biogenesis: All cells arise from pre-existing, living cells through the process of cellular division, debunking the theory of spontaneous generation.\n\n### Modern Implications\nToday, we understand that cells are not just "chambers" but complex chemical factories. Every cell contains hereditary information (DNA) which is passed from parent to daughter cell during division. The discovery of DNA's double helix structure by Watson and Crick in 1953 gave us the molecular key to understanding how this information is copied and transmitted across generations.`,
      },
      {
        id: 2, unit: 1,
        title: "Organelles: The Architecture of Life",
        content: "Mitochondria are known as the powerhouses of the cell. They convert energy from food into ATP. The nucleus acts as the control center, containing DNA.",
        enhancedContent: `### The Intracellular Economy\nA eukaryotic cell is analogous to a modern city, where specialized structures called organelles function as departments ensuring survival and growth. Without this compartmentalization, the chemical reactions necessary for life would interfere with one another.\n\n### The Nucleus: Command and Control\nThe nucleus is the most prominent organelle. It serves as the repository of the cell's genetic blueprint. The Nuclear Envelope is a double membrane that protects the DNA. The Nucleolus is a dense region where ribosome synthesis begins. Chromatin is the complex of DNA and proteins that condenses to form chromosomes.\n\n### Mitochondria: The Energy Generators\nOften called the "powerhouse," mitochondria perform cellular respiration. They take in nutrients from the cell, break them down, and turn them into energy-rich ATP molecules for the cell. The Matrix is where the citric acid cycle occurs. Cristae are the inner folds that increase surface area for higher ATP production efficiency.\n\n### Ribosomes and the ER: The Manufacturing Plant\nProtein synthesis is the cell's primary industry. Ribosomes can be found floating freely in the cytoplasm or attached to the Rough Endoplasmic Reticulum (RER). The RER modifies proteins, while the Smooth ER is responsible for lipid synthesis and detoxification.`,
      },
      {
        id: 3, unit: 2,
        title: "Cell Division: Continuity of Life",
        content: "Cells divide through mitosis for growth and repair, and meiosis for reproduction. Mitosis results in two identical daughter cells.",
        enhancedContent: `### The Cell Cycle and Replication\nLife depends on the ability of cells to reproduce. This is achieved through a highly regulated sequence of events known as the Cell Cycle. This cycle is divided into Interphase (growth) and the M-phase (division).\n\n### Mitosis: Somatic Reproduction\nMitosis is the process used for growth, tissue repair, and asexual reproduction. It ensures that each new cell receives an exact copy of the parent cell's DNA. It consists of four main stages. Prophase: Chromosomes condense and the nuclear envelope breaks down. Metaphase: Chromosomes align in the center of the cell. Anaphase: Sister chromatids are pulled apart toward opposite poles. Telophase: Two new nuclear envelopes form around the separated DNA.\n\n### Meiosis: Genetic Diversity\nUnlike mitosis, Meiosis is a specialized form of division that occurs in germ cells to produce gametes (sperm and eggs). It involves two rounds of division (Meiosis I and II). It results in four non-identical daughter cells, each with half the original number of chromosomes (haploid). During Prophase I, homologous chromosomes exchange genetic material, ensuring that every offspring is genetically unique.\n\n### Checkpoints and Cancer\nThe cell cycle is governed by "checkpoints." If a cell's DNA is damaged, the cycle stops for repairs. If these regulatory proteins (like p53) fail, cells divide uncontrollably, which is the biological basis of cancer.`,
      },
      {
        id: 4, unit: 2,
        title: "Organelles: Advanced Study",
        layout: [
          { type: "text", content: "Within the cell's cytoplasm lies a complex world of specialized structures called organelles, each with a specific job..." },
          { type: "image", src: "mitochondria_diagram_url", caption: "Fig 2.1: Mitochondrial Grid" },
          { type: "text", content: "Often called the 'powerhouse,' mitochondria perform cellular respiration..." },
          { type: "text", content: "The nucleus, a large, often centrally located organelle, acts as the cell's control center..." },
          { type: "image", src: "nucleus_diagram_url", caption: "Fig 2.2: Nuclear Envelope" },
        ],
        content: "",
      },
    ],
  },
  {
    id: "phys-12",
    title: "Quantum Mechanics",
    subject: "Physics",
    color: "linear-gradient(135deg, #0ea5e9 0%, #22d3ee 100%)",
    chapters: [
      { id: 1, unit: 1, title: "Newtonian Laws & Classical Limits", content: "Newton's laws describe the motion of macroscopic objects. They form the foundation of classical mechanics and explain how forces affect motion.", enhancedContent: "### The Deterministic Universe\nBefore the 20th century, physics was governed by the laws of Sir Isaac Newton.\n\n### Newton's Three Axioms\nInertia: An object remains at rest or in uniform motion unless acted upon by an external force. Acceleration: F = ma. Reaction: For every action, there is an equal and opposite reaction.\n\n### The Breakdown\nAt the subatomic level, the deterministic nature of Newtonian physics gives way to the probabilistic nature of Quantum Mechanics." },
      { id: 2, unit: 2, title: "Wave-Particle Duality", content: "Quantum mechanics reveals that particles like electrons exhibit both wave and particle properties.", enhancedContent: "### The Nature of Quanta\nLight and matter do not behave exclusively as particles or waves, but as both.\n\n### The Double-Slit Experiment\nWhen electrons are fired at a barrier with two slits, they create an interference pattern — a behavior typical of waves. However, when observed, the pattern disappears and electrons behave like particles.\n\n### De Broglie's Hypothesis\nAll matter has an associated wavelength, inversely proportional to its momentum." },
    ],
  },
  {
    id: "chem-11",
    title: "Organic Chemistry Basics",
    subject: "Chemistry",
    color: "linear-gradient(135deg, #10b981 0%, #34d399 100%)",
    chapters: [
      { id: 1, unit: 1, title: "Carbon Compounds", content: "Organic chemistry focuses on carbon-based compounds. Carbon's ability to form four covalent bonds allows it to create complex molecules essential for life." },
      { id: 2, unit: 1, title: "Hydrocarbons", content: "Hydrocarbons are compounds consisting only of carbon and hydrogen. They are classified as alkanes, alkenes, and alkynes based on bonding." },
    ],
  },
  {
    id: "cs-10",
    title: "Intro to Computer Science",
    subject: "Computer Science",
    color: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
    chapters: [
      { id: 1, unit: 1, title: "The Von Neumann Architecture", content: "A computer is an electronic device that processes data based on instructions. It consists of hardware and software.", enhancedContent: "### The Logical Machine\nModern computing is based on the Von Neumann Architecture.\n\n### Core Components\nCPU: The brain of the computer. ALU: Handles mathematical and logical operations. Memory (RAM): Volatile storage. I/O Devices: Allow interaction with the machine.\n\n### Binary and Logic\nAt the lowest level, computers process information using Binary (Base-2)." },
      { id: 2, unit: 2, title: "Algorithms & Computational Thinking", content: "An algorithm is a step-by-step procedure to solve a problem. Efficient algorithms improve performance.", enhancedContent: "### The Art of Problem Solving\nAn algorithm is a finite sequence of well-defined instructions.\n\n### Big O Notation\nO(1): Constant time. O(log n): Logarithmic time. O(n): Linear time. O(n²): Quadratic time.\n\n### Data Structures\nArrays, Stacks, Queues, and Trees — choosing the right structure determines solution elegance." },
    ],
  },
  {
    id: "hist-11",
    title: "The Industrial Revolution",
    subject: "History",
    color: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    chapters: [
      { id: 1, unit: 1, title: "Steam Power & The Mechanical Age", content: "The invention of steam engines revolutionized manufacturing and transportation, leading to rapid industrial growth.", enhancedContent: "### The Great Divergence\nThe Industrial Revolution began in Great Britain in the late 18th century.\n\n### The Engine of Change\nJames Watt's improvements to the steam engine in 1776 allowed for the mechanization of the textile industry.\n\n### Transportation\nRailways, Steamships, and Telegraphy transformed commerce and warfare." },
      { id: 2, unit: 2, title: "Social Impact & Urbanization", content: "Industrialization transformed societies by increasing urbanization, altering labor systems, and shaping modern economies.", enhancedContent: "### The Urban Shift\nPopulation migrated from rural farms to crowded cities.\n\n### Labor and Class Structure\nThe Bourgeoisie (factory owners) and the Proletariat (workers) emerged as new social classes.\n\n### Working Conditions and Reform\nInitial growth was unregulated. Labor Unions and Factory Acts improved conditions." },
    ],
  },
  {
    id: "geo-9", title: "Physical Geography", subject: "Geography", color: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
    chapters: [
      { id: 1, unit: 1, title: "Earth's Structure", content: "The Earth consists of the crust, mantle, and core. These layers influence tectonic activity and geological processes." },
      { id: 2, unit: 1, title: "Climate Systems", content: "Climate is influenced by latitude, altitude, wind patterns, and ocean currents, shaping ecosystems worldwide." },
    ],
  },
  {
    id: "eng-10", title: "English Literature Classics", subject: "English", color: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
    chapters: [
      { id: 1, unit: 1, title: "Poetry", content: "Poetry uses rhythm, imagery, and metaphor to express emotions and ideas in a condensed form." },
      { id: 2, unit: 2, title: "Drama", content: "Drama is written for performance and explores human conflicts through dialogue and action." },
    ],
  },
  {
    id: "eco-12", title: "Principles of Economics", subject: "Economics", color: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
    chapters: [
      { id: 1, unit: 1, title: "Demand and Supply", content: "Demand and supply determine prices in a market economy. Their interaction explains price fluctuations." },
      { id: 2, unit: 2, title: "Economic Systems", content: "Economic systems define how resources are allocated. Common systems include capitalism, socialism, and mixed economies." },
    ],
  },
  {
    id: "env-10", title: "Environmental Science", subject: "Environmental Studies", color: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)",
    chapters: [
      { id: 1, unit: 1, title: "Ecosystems", content: "An ecosystem includes living organisms and their physical environment interacting as a system." },
      { id: 2, unit: 1, title: "Climate Change", content: "Climate change refers to long-term shifts in temperature and weather patterns, largely driven by human activities." },
    ],
  },
  {
    id: "math-10", title: "Advanced Trigonometry", subject: "Mathematics", color: "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)",
    chapters: [
      { id: 1, unit: 1, title: "Sine & Cosine", content: "Trigonometric functions describe relationships between angles and sides of triangles and model periodic phenomena." },
      { id: 2, unit: 2, title: "Trigonometric Identities", content: "Identities simplify expressions and equations involving trigonometric functions." },
    ],
  },
];

// ─── Highlight color palette (Word-doc style) ────────────────────────────────
const HL_COLORS = [
  { id: "yellow", label: "Yellow",  mark: "#fde047",        text: "#713f12",        bg: "rgba(253,224,71,.35)",  border: "rgba(253,224,71,.7)"  },
  { id: "green",  label: "Green",   mark: "#86efac",        text: "#14532d",        bg: "rgba(134,239,172,.35)", border: "rgba(134,239,172,.7)" },
  { id: "blue",   label: "Blue",    mark: "#93c5fd",        text: "#1e3a5f",        bg: "rgba(147,197,253,.35)", border: "rgba(147,197,253,.7)" },
  { id: "pink",   label: "Pink",    mark: "#f9a8d4",        text: "#831843",        bg: "rgba(249,168,212,.35)", border: "rgba(249,168,212,.7)" },
  { id: "purple", label: "Purple",  mark: "#c4b5fd",        text: "#3b0764",        bg: "rgba(196,181,253,.35)", border: "rgba(196,181,253,.7)" },
  { id: "orange", label: "Orange",  mark: "#fdba74",        text: "#7c2d12",        bg: "rgba(253,186,116,.35)", border: "rgba(253,186,116,.7)" },
] as const;

type HlColorId = typeof HL_COLORS[number]["id"];

function getHlColor(colorId: string) {
  return HL_COLORS.find(c => c.id === colorId) ?? HL_COLORS[0];
}

const QUIZ_DATA: Record<string, { q: string; opts: string[]; a: number }> = {
  "1": { q: "Who coined the term 'cell' while observing cork?", opts: ["Newton", "Robert Hooke", "Darwin"], a: 1 },
  "2": { q: "Which organelle is considered the 'powerhouse'?", opts: ["Nucleus", "Ribosome", "Mitochondria"], a: 2 },
};

// ─── Page decoration ──────────────────────────────────────────────────────────
const PageDecoration = ({ type, variant = 1, position = "top" }: any) => {
  const isTop = position === "top";
  const shapes: Record<string, string> = {
    wave: "polygon(0% 0%, 100% 0%, 100% 60%, 80% 90%, 50% 70%, 20% 90%, 0% 60%)",
    curve: "ellipse(100% 100% at 50% 0%)",
    corner: isTop ? "polygon(0 0, 100% 0, 100% 20%, 0 80%)" : "polygon(0 20%, 100% 80%, 100% 100%, 0 100%)",
    organic: "circle(70% at 50% -10%)",
  };
  const style: React.CSSProperties = {
    position: "absolute", left: 0, right: 0, height: "120px",
    backgroundColor: `var(--deco-color-${variant})`, opacity: 0.15,
    zIndex: 0, clipPath: shapes[type] || shapes.wave, pointerEvents: "none",
    ...(isTop ? { top: 0 } : { bottom: 0 }),
  };
  const accentStyle: React.CSSProperties = { ...style, height: "130px", opacity: 0.1, backgroundColor: "var(--deco-accent-color)", transform: "translateY(5px) scaleX(1.1)", zIndex: -1 };
  return (<><div style={accentStyle} /><div style={style} /></>);
};

// ─── Ask AI Panel ─────────────────────────────────────────────────────────────
interface AskAIPanelProps {
  messages: AskAIMessage[];
  isLoading: boolean;
  pendingTag: string | null;
  inputValue: string;
  bookTitle: string;
  chapterTitle: string;
  onSend: (text: string) => void;
  setInputValue: (v: string) => void;
  onTagDismiss: () => void;
  onClose: () => void;
}

const AskAIPanel = ({
  messages, isLoading, pendingTag, inputValue, bookTitle, chapterTitle,
  onSend, setInputValue, onTagDismiss, onClose,
}: AskAIPanelProps) => {
  const endRef   = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 150); }, []);

  const doSend = () => {
    const text = inputValue.trim() || pendingTag || "";
    if (!text || isLoading) return;
    onSend(text);
  };

  return (
    <div className="ask-ai-panel">
      <div className="ask-ai-header">
        <div className="ask-ai-header-left">
          <div className="ask-ai-bot-icon"><Bot size={15} /></div>
          <div>
            <p className="ask-ai-title">Ask AI</p>
            <p className="ask-ai-subtitle">{bookTitle} · {chapterTitle}</p>
          </div>
        </div>
        <button className="ask-ai-close" onClick={onClose} title="Close AI panel"><X size={15} /></button>
      </div>
      <div className="ask-ai-messages">
        {messages.length === 0 && !isLoading && !pendingTag && (
          <div className="ask-ai-empty">
            <div className="ask-ai-empty-icon"><Sparkles size={22} /></div>
            <p className="ask-ai-empty-title">Ask anything about this chapter</p>
            <p className="ask-ai-empty-sub">Select text then choose Explain · Summarize · Ask AI</p>
          </div>
        )}
        {messages.map(msg => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`ask-ai-msg-row ${msg.role === "user" ? "user" : "assistant"}`}
          >
            <div className={`ask-ai-avatar ${msg.role}`}>
              {msg.role === "user" ? <User size={13} /> : <Bot size={13} />}
            </div>
            <div className="ask-ai-bubble-col">
              {msg.role === "user" && msg.actionLabel && (
                <span className="ask-ai-action-badge"><Zap size={9} /> {msg.actionLabel}</span>
              )}
              {msg.role === "user" && msg.selectedText && (
                <div className="ask-ai-quote">
                  <HighlighterIcon size={11} className="ask-ai-quote-icon" />
                  <p className="ask-ai-quote-text">"{msg.selectedText.length > 100 ? msg.selectedText.slice(0, 100) + "…" : msg.selectedText}"</p>
                </div>
              )}
              <div className={`ask-ai-bubble ${msg.role}`}>
                <FormattedAIContent value={msg.content} />
              </div>
              <span className="ask-ai-time">{msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="ask-ai-msg-row assistant">
            <div className="ask-ai-avatar assistant"><Bot size={13} /></div>
            <div className="ask-ai-typing">
              {[0, 0.18, 0.36].map((d, i) => (
                <span key={i} className="ask-ai-dot" style={{ animationDelay: `${d}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      <AnimatePresence>
        {pendingTag && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.15 }}
            className="ask-ai-pending-tag"
          >
            <HighlighterIcon size={13} className="ask-ai-pending-icon" />
            <div className="ask-ai-pending-body">
              <p className="ask-ai-pending-label">Selected text</p>
              <p className="ask-ai-pending-text">"{pendingTag.length > 120 ? pendingTag.slice(0, 120) + "…" : pendingTag}"</p>
            </div>
            <button className="ask-ai-pending-dismiss" onClick={onTagDismiss}><X size={12} /></button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="ask-ai-input-row">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } }}
          placeholder={pendingTag ? "Ask about the selection…" : "Ask anything about this content…"}
          rows={1}
          className="ask-ai-textarea"
          onInput={e => {
            const t = e.currentTarget;
            t.style.height = "auto";
            t.style.height = Math.min(t.scrollHeight, 112) + "px";
          }}
        />
        <button onClick={doSend} disabled={(!inputValue.trim() && !pendingTag) || isLoading} className="ask-ai-send">
          <Send size={14} />
        </button>
      </div>
      <p className="ask-ai-hint">Enter to send · Shift+Enter for new line</p>
    </div>
  );
};

const ExplainSummarizePanel = ({ title, content, isLoading, onClose, selectedText }: { title: string, content: string, isLoading: boolean, onClose: () => void, selectedText?: string }) => {
  return (
    <motion.aside
      key="explain-panel"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="explain-panel glass"
    >
      <div className="lab-head">
        <h3>{title}</h3>
        <button onClick={onClose}>✕</button>
      </div>
      <div className="lab-body">
        {selectedText && (
          <div className="ask-ai-quote">
            <HighlighterIcon size={11} className="ask-ai-quote-icon" />
            <p className="ask-ai-quote-text">"{selectedText.length > 100 ? selectedText.slice(0, 100) + "…" : selectedText}"</p>
          </div>
        )}
        {isLoading ? (
          <FunnyLoader />
        ) : (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="ai-card"><FormattedAIContent value={content} /></div>
          </motion.div>
        )}
      </div>
    </motion.aside>
  );
};

// ─── Subject icon helper ──────────────────────────────────────────────────────
function getSubjectSymbol(subject: string): string {
  if (subject.includes("Science") || subject.includes("Biology") || subject.includes("Chemistry") || subject.includes("Environmental")) return "⚛";
  if (subject.includes("Math")) return "π";
  if (subject.includes("Physics")) return "⚡";
  if (subject.includes("Computer")) return "💻";
  if (subject.includes("History")) return "📜";
  if (subject.includes("Geography")) return "🌍";
  if (subject.includes("English")) return "✍️";
  if (subject.includes("Economics")) return "📊";
  return "📖";
}

// ─── Main component ───────────────────────────────────────────────────────────
function flattenContentToText(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flattenContentToText).filter(Boolean).join("\n\n");
  if (typeof value !== "object") return "";

  const preferred = [
    value.markdown,
    value.html,
    value.summary,
    value.introduction,
    value.content,
    value.text,
    value.body,
    value.explanation,
    value.detailed_explanation,
    value.description,
    value.paragraphs,
    value.blocks,
    value.children,
    value.topics,
    value.sections,
    value.enrichedContent,
    value.enrichment,
  ]
    .map(flattenContentToText)
    .filter(Boolean);

  if (preferred.length) {
    return preferred.join("\n\n");
  }

  return Object.values(value)
    .map(flattenContentToText)
    .filter(Boolean)
    .join("\n\n");
}

function extractAiText(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;

  return flattenContentToText(
    value.answer ||
      value.response ||
      value.reply ||
      value.message ||
      value.summary ||
      value.explanation ||
      value.result ||
      value.content ||
      value.data ||
      value,
  );
}

const READER_TOPIC_EXCLUDES = [
  /\bpoints?\s+to\s+remember\b/i,
  /\bproblems?\b/i,
  /\bdo\s+you\s+know\b/i,
  /\bactivit(y|ies)\b/i,
  /\bexercises?\b/i,
  /\bsummary\b/i,
];

function normalizeReaderLabel(value: any): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[\-\u2022•]+\s*/, "")
    .trim();
}

function isReaderTopic(value: any): boolean {
  const label = normalizeReaderLabel(value);
  return Boolean(label) && !READER_TOPIC_EXCLUDES.some((pattern) => pattern.test(label));
}

function makeAnchorId(...parts: Array<string | number | null | undefined>) {
  const source = parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return source || `section-${Date.now()}`;
}

function buildTextLayoutFromString(value: string) {
  return String(value || "")
    .split(/\n+/)
    .filter((line) => line.trim())
    .map((line) => {
      if (line.startsWith("### ")) {
        return { type: "heading3", content: line.replace(/^###\s*/, "") };
      }
      if (line.startsWith("## ")) {
        return { type: "heading2", content: line.replace(/^##\s*/, "") };
      }
      if (line.startsWith("# ")) {
        return { type: "heading1", content: line.replace(/^#\s*/, "") };
      }
      return { type: "text", content: line };
    });
}

function extractSectionTopicsFromContent(content: any, chapterId: string | number) {
  const topics: Array<{ id: string; label: string; title: string; number?: string | null; anchor: string }> = [];
  const seen = new Set<string>();

  const visit = (value: any) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object") return;

    const title =
      value.section_title ||
      value.sectionTitle ||
      value.topic ||
      value.heading ||
      value.title ||
      value.name;
    const number =
      value.section_number ||
      value.sectionNumber ||
      value.number ||
      value.topic_number ||
      value.topicNumber;

    if (title && isReaderTopic(title)) {
      const cleanTitle = normalizeReaderLabel(title);
      const cleanNumber = normalizeReaderLabel(number);
      const label = cleanNumber ? `${cleanNumber} ${cleanTitle}`.trim() : cleanTitle;
      const key = `${chapterId}:${label.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        topics.push({
          id: String(value.section_id || value.sectionId || value.id || key),
          label,
          title: cleanTitle,
          number: cleanNumber || null,
          anchor: makeAnchorId(chapterId, cleanNumber || cleanTitle),
        });
      }
    }

    [value.units, value.sections, value.topics, value.content, value.children, value.items].forEach(visit);
  };

  visit(content);
  return topics;
}

function buildStructuredLayout(content: any, chapterId: string | number, topicMap: Map<string, string>) {
  const blocks: any[] = [];
  const metadataKeys = new Set([
    "id",
    "_id",
    "section_id",
    "sectionId",
    "document_id",
    "documentId",
    "unit_id",
    "unitId",
    "title",
    "section_title",
    "sectionTitle",
    "section_number",
    "sectionNumber",
    "number",
    "topic_number",
    "topicNumber",
    "label",
    "name",
    "type",
    "kind",
    "status",
    "createdAt",
    "updatedAt",
    "image_urls",
  ]);

  const pushTextField = (value: any) => {
    const text = flattenContentToText(value).trim();
    if (!text) return;
    blocks.push(...buildTextLayoutFromString(text));
  };

  const pushListField = (value: any) => {
    if (!Array.isArray(value)) return;
    const items = value
      .map((item) => flattenContentToText(item).trim())
      .filter(Boolean);
    if (items.length) {
      blocks.push({ type: "list", items });
    }
  };

  const pushTableField = (value: any) => {
    if (!value) return;
    const rows = Array.isArray(value?.rows)
      ? value.rows
      : Array.isArray(value)
        ? value
        : [];
    const normalizedRows = rows
      .map((row: any) =>
        Array.isArray(row)
          ? row.map((cell) => flattenContentToText(cell).trim())
          : Object.values(row || {}).map((cell) => flattenContentToText(cell).trim()),
      )
      .filter((row: string[]) => row.some(Boolean));

    if (normalizedRows.length) {
      blocks.push({
        type: "table",
        headers: Array.isArray(value?.headers) ? value.headers.map((header: any) => flattenContentToText(header).trim()) : [],
        rows: normalizedRows,
      });
    }
  };

  const visit = (value: any) => {
    if (!value) return;
    if (typeof value === "string") {
      blocks.push(...buildTextLayoutFromString(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== "object") return;

    if (value.units) {
      visit(value.units);
      return;
    }

    if (Array.isArray(value.blocks)) {
      value.blocks.forEach((block: any) => {
        const blockType = String(block?.type || block?.kind || "").toLowerCase();
        if (blockType.includes("image")) {
          blocks.push({
            type: "image",
            imageUrl: block.imageUrl || block.image || block.url || block.src || block.assetUrl || block.asset || block.images || block.media,
            caption: block.caption || block.title || null,
          });
          return;
        }
        if (blockType.includes("table")) {
          pushTableField(block);
          return;
        }
        if (blockType.includes("list")) {
          pushListField(block.items || block.children || block.content);
          return;
        }
        if (blockType.includes("formula") || blockType.includes("equation")) {
          const text = flattenContentToText(block.content || block.value || block.formula).trim();
          if (text) {
            blocks.push({ type: "formula", content: text });
          }
          return;
        }
        if (blockType.includes("html")) {
          const html = String(block.html || block.content || "").trim();
          if (html) {
            blocks.push({ type: "html", content: html });
          }
          return;
        }

        pushTextField(
          block.markdown ||
            block.content ||
            block.text ||
            block.body ||
            block.description ||
            block.explanation,
        );
        visit(block.children || block.items || block.topics);
      });
    }

    if (value.sections && Array.isArray(value.sections)) {
      value.sections.forEach((section: any) => {
        const title = normalizeReaderLabel(section.section_title || section.sectionTitle || section.title);
        const number = normalizeReaderLabel(section.section_number || section.sectionNumber || section.number);
        if (title && isReaderTopic(title)) {
          const label = number ? `${number} ${title}`.trim() : title;
          const anchor = topicMap.get(label) || makeAnchorId(chapterId, number || title);
          blocks.push({
            type: "heading2",
            content: label,
            anchor,
          });
        }

        const beforeCount = blocks.length;

        const imageCandidate =
          section.src ||
          section.url ||
          section.assetUrl ||
          section.asset ||
          section.image ||
          section.imageUrl ||
          section.thumbnail ||
          section.thumbnailUrl ||
          section.coverImage ||
          section.coverImageUrl ||
          section.images ||
          section.media;
        if (imageCandidate) {
          blocks.push({
            type: "image",
            imageUrl: imageCandidate,
            caption: section.caption || title || null,
          });
        }

        normalizeArrayField(section.image_urls).forEach((url: string) => {
          blocks.push({
            type: "image",
            imageUrl: url,
            caption: section.caption || title || null,
          });
        });

        [
          section.summary,
          section.introduction,
          section.content,
          section.text,
          section.body,
          section.explanation,
          section.detailed_explanation,
          section.description,
          section.markdown,
          section.html,
          section.enrichedContent,
          section.enrichment?.concept_overview,
          section.enrichment?.detailed_explanation,
          section.enrichment?.summary,
          section.enrichment?.description,
        ].forEach(pushTextField);

        [
          section.paragraphs,
          section.objectives,
          section.key_points,
          section.keyPoints,
          section.examples,
          section.bullets,
          section.points,
        ].forEach(pushListField);

        [section.table, section.tables].forEach(pushTableField);

        [section.children, section.items, section.topics].forEach(visit);

        if (blocks.length === beforeCount && title) {
          blocks.push({
            type: "text",
            content: "No content available for this section",
          });
        }
      });
      return;
    }

    const imageCandidate =
      value.src ||
      value.url ||
      value.assetUrl ||
      value.asset ||
      value.image ||
      value.imageUrl ||
      value.thumbnail ||
      value.thumbnailUrl ||
      value.coverImage ||
      value.coverImageUrl ||
      value.images ||
      value.media;
    if (imageCandidate) {
      blocks.push({
        type: "image",
        imageUrl: imageCandidate,
        caption: value.caption || value.title || value.section_title || null,
      });
    }

    normalizeArrayField(value.image_urls).forEach((url: string) => {
      blocks.push({
        type: "image",
        imageUrl: url,
        caption: value.caption || value.title || value.section_title || null,
      });
    });

    [
      value.summary,
      value.introduction,
      value.content,
      value.text,
      value.body,
      value.explanation,
      value.detailed_explanation,
      value.description,
      value.markdown,
      value.html,
      value.enrichedContent,
      value.enrichment?.concept_overview,
      value.enrichment?.detailed_explanation,
    ].forEach(pushTextField);

    [
      value.paragraphs,
      value.objectives,
      value.examples,
      value.points,
      value.bullets,
    ].forEach(pushListField);

    [value.table, value.tables].forEach(pushTableField);

    [value.children, value.items, value.topics, value.enrichment].forEach(visit);

    Object.entries(value).forEach(([key, nested]) => {
      if (metadataKeys.has(key)) return;
      if (
        [
          "units",
          "sections",
          "children",
          "items",
          "topics",
          "content",
          "text",
          "body",
          "summary",
          "introduction",
          "description",
          "explanation",
          "detailed_explanation",
          "paragraphs",
          "objectives",
          "examples",
          "points",
          "bullets",
          "table",
          "tables",
          "image",
          "imageUrl",
          "thumbnail",
          "thumbnailUrl",
          "coverImage",
          "coverImageUrl",
          "images",
          "media",
          "markdown",
          "html",
          "blocks",
          "enrichedContent",
          "enrichment",
        ].includes(key)
      ) {
        return;
      }
      visit(nested);
    });
  };

  visit(content);
  return blocks.filter(Boolean);
}

function buildChapterFromUnit(unit: any, contentPayload: any, index: number) {
  const fallbackTitle = unit.unitTitle || unit.unitLabel || `Unit ${index + 1}`;
  const enrichedContent = contentPayload?.enriched ?? contentPayload?.content ?? contentPayload ?? null;
  const sectionTopics = (contentPayload?.sectionTopics || extractSectionTopicsFromContent(enrichedContent || contentPayload, unit.id)).map((topic: any) => ({
    id: String(topic.id || `${unit.id}:${topic.label}`),
    label: topic.label,
    title: topic.sectionTitle || topic.title || topic.label,
    number: topic.sectionNumber || topic.number || null,
    anchor: topic.anchor || makeAnchorId(unit.id, topic.sectionNumber || topic.sectionTitle || topic.label),
  }));
  const topicAnchorMap = new Map(sectionTopics.map((topic: any) => [topic.label, topic.anchor]));
  const layoutSource = enrichedContent || contentPayload;
  const layout = buildStructuredLayout(layoutSource, unit.id, topicAnchorMap);
  const text = flattenContentToText(layoutSource).trim();

  return {
    id: unit.id,
    title: fallbackTitle,
    unitTitle: fallbackTitle,
    content: text || `${fallbackTitle} content is available for reading.`,
    enhancedContent: text || `${fallbackTitle} content is available for reading.`,
    layout: layout.length ? layout : undefined,
    sectionTopics,
    sourceContent: layoutSource,
    unit: unit.unitNumber || index + 1,
  };
}

function estimateReaderBlockUnits(item: any): number {
  if (!item) return 0;
  const type = item.type || "text";

  if (type === "heading1") return 5;
  if (type === "heading2") return 4;
  if (type === "heading3") return 3;
  if (type === "formula") return 5;
  if (type === "image") return 12;
  if (type === "table") {
    const rowCount = Array.isArray(item.rows) ? item.rows.length : 0;
    return Math.min(14, 5 + rowCount * 1.5);
  }
  if (type === "list") {
    const count = Array.isArray(item.items) ? item.items.length : 0;
    return Math.min(10, 2 + count * 1.2);
  }
  if (type === "html") {
    const text = flattenContentToText(item.content || "").trim();
    return Math.min(12, Math.max(3, Math.ceil(text.length / 180)));
  }

  const text = flattenContentToText(item.content || item.text || "").trim();
  return Math.min(10, Math.max(2, Math.ceil(text.length / 220)));
}

function paginateReaderBlocks(items: any[], pageCapacity: number) {
  const pages: Array<{ items: any[] }> = [];
  const anchorToPage = new Map<string, number>();
  let currentPage: any[] = [];
  let currentUnits = 0;

  const pushPage = () => {
    if (!currentPage.length) return;
    const pageIndex = pages.length;
    currentPage.forEach((block) => {
      if (block?.anchor) {
        anchorToPage.set(block.anchor, pageIndex);
      }
    });
    pages.push({ items: currentPage });
    currentPage = [];
    currentUnits = 0;
  };

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const nextItem = items[index + 1];
    const isHeading = ["heading1", "heading2", "heading3"].includes(item?.type);
    const keepWithNext = isHeading && nextItem && !["heading1", "heading2", "heading3"].includes(nextItem?.type);
    const group = keepWithNext ? [item, nextItem] : [item];
    const groupUnits = group.reduce((sum, block) => sum + estimateReaderBlockUnits(block), 0);

    if (currentPage.length && currentUnits + groupUnits > pageCapacity) {
      pushPage();
    }

    currentPage.push(...group);
    currentUnits += groupUnits;

    if (keepWithNext) {
      index += 1;
    }
  }

  pushPage();

  if (!pages.length) {
    pages.push({
      items: [{ type: "text", content: "No content available for this section" }],
    });
  }

  return { pages, anchorToPage };
}

function buildReaderSpreads(
  pages: Array<{ items: any[] }>,
  singlePageMode: boolean,
) {
  const spreads: Array<{
    left: { items: any[]; pageNumber: number };
    right: { items: any[]; pageNumber: number } | null;
  }> = [];

  if (singlePageMode) {
    pages.forEach((page, index) => {
      spreads.push({
        left: { items: page.items, pageNumber: index + 1 },
        right: null,
      });
    });
    return spreads;
  }

  for (let index = 0; index < pages.length; index += 2) {
    spreads.push({
      left: { items: pages[index]?.items || [], pageNumber: index + 1 },
      right: pages[index + 1]
        ? { items: pages[index + 1].items, pageNumber: index + 2 }
        : null,
    });
  }

  return spreads;
}

const BookContentWindow = () => {
  const { theme, setTheme } = useTheme();
  const { toast: pushToast } = useToast();
  const isDark = theme === 'dark';
  const [, navigate]       = useLocation();
  const [hoveredIndex,     setHoveredIndex]     = useState<number | null>(null);
  const [isLoadingPage,    setIsLoadingPage]    = useState(true);
  const [bookLoadError,    setBookLoadError]    = useState<string | null>(null);
  const [selectedBook,     setSelectedBook]     = useState<Book | null>(null);
  const [activeChapter,    setActiveChapter]    = useState<any>(null);
  const [isTocView,        setIsTocView]        = useState(false);
  const [isFocus,          setIsFocus]          = useState(false);
  const [isQuizOpen,       setIsQuizOpen]       = useState(false);
  const [isSummaryOpen,    setIsSummaryOpen]    = useState(false);
  const [isEnhancing,      setIsEnhancing]      = useState(false);
  const [activeFilter,     setActiveFilter]     = useState<string>("All");
  const [libraryBooks,     setLibraryBooks]     = useState<Book[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(true);
  const [brokenBookImages, setBrokenBookImages] = useState<Record<string, boolean>>({});
  const [brokenFigureImages, setBrokenFigureImages] = useState<Record<string, boolean>>({});
  const [isSidebarOpen,    setIsSidebarOpen]    = useState(false);
  const [pendingSectionAnchor, setPendingSectionAnchor] = useState<string | null>(null);
  const [highlights,       setHighlights]       = useState<Highlight[]>([]);
  const [editingHighlight, setEditingHighlight] = useState<Highlight | null>(null);

  // ── Stable storage key — unique per book + chapter ──────────────────────
  // Defined as a computed value (not useState) so it updates instantly.
  const hlStorageKey = selectedBook && activeChapter && !activeChapter.isUnitIntro
    ? `hl::${selectedBook.id}::${activeChapter.id}`
    : null;

  // LOAD highlights from localStorage whenever chapter changes
  useEffect(() => {
    if (!hlStorageKey) { setHighlights([]); return; }
    try {
      const saved = localStorage.getItem(hlStorageKey);
      setHighlights(saved ? JSON.parse(saved) : []);
    } catch { setHighlights([]); }
  }, [hlStorageKey]);

  // SAVE highlights to localStorage whenever they change
  useEffect(() => {
    if (!hlStorageKey) return;
    try {
      if (highlights.length === 0) {
        localStorage.removeItem(hlStorageKey);
      } else {
        localStorage.setItem(hlStorageKey, JSON.stringify(highlights));
      }
    } catch { /* storage full — ignore */ }
  }, [highlights, hlStorageKey]);
  const [isLoading,        setIsLoading]        = useState(false);
  const [timer,            setTimer]            = useState(0);
  const [toast,            setToast]            = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [newHighlightText, setNewHighlightText] = useState("");
  const [newComment,       setNewComment]       = useState("");
  const [newHlColor,       setNewHlColor]       = useState("yellow");  // active color for new highlight
  const [editedComment,    setEditedComment]    = useState("");         // for edit modal
  const [editedColor,      setEditedColor]      = useState("yellow");   // for edit modal
  const newCommentRef      = useRef<HTMLTextAreaElement>(null);
  const [isFlipping,       setIsFlipping]       = useState(false);
  const [displayChapter,   setDisplayChapter]   = useState<any>(null);
  const [direction,        setDirection]        = useState<"next" | "prev">("next");
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [displaySpreadIndex, setDisplaySpreadIndex] = useState(0);
  const [isSinglePageView, setIsSinglePageView] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 900 : false,
  );
  const [expandedUnit,     setExpandedUnit]     = useState<number | null>(null);

  const [isAiPanelOpen,  setIsAiPanelOpen]  = useState(false);
  const [aiMessages,     setAiMessages]     = useState<AskAIMessage[]>([]);
  const [aiLoading,      setAiLoading]      = useState(false);
  const [aiInput,        setAiInput]        = useState("");
  const [pendingTag,     setPendingTag]     = useState<string | null>(null);

  const [isExplainPanelOpen, setIsExplainPanelOpen] = useState(false);
  const [isExplainLoading,   setIsExplainLoading]   = useState(false);
  const [explainData,        setExplainData]        = useState<{title: string, content: string, selectedText?: string} | null>(null);

  const [menuPos,          setMenuPos]          = useState<{ x: number; y: number } | null>(null);
  const persistentSelection = useRef("");
  const menuRef             = useRef<HTMLDivElement>(null);

  const { userHeader } = useAuth();
  const [currentRole, setCurrentRole] = useState("student");
  useEffect(() => { if (userHeader?.role) setCurrentRole(userHeader.role); }, [userHeader]);

  const mapRemoteSubjectToBook = (
    subjectGroup: Pick<LibrarySubject, "subjectGroupKey" | "title" | "subject" | "units" | "coverImageUrl" | "imageCandidates">,
    index = 0,
  ): Book => {
    const palette = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899"];
    return {
      id: subjectGroup.subjectGroupKey,
      title: subjectGroup.title,
      subject: subjectGroup.subject,
      color: palette[index % palette.length],
      coverImageUrl: subjectGroup.coverImageUrl || null,
      imageCandidates: subjectGroup.imageCandidates || [],
      chapters: (subjectGroup.units || []).map((unit, unitIndex) => ({
        id: unit.id,
        title: unit.unitTitle || unit.unitLabel || `Unit ${unitIndex + 1}`,
        content: `${unit.unitTitle || unit.unitLabel || `Unit ${unitIndex + 1}`} content is available for reading.`,
        enhancedContent: `${unit.unitTitle || unit.unitLabel || `Unit ${unitIndex + 1}`} content is available for reading.`,
        unit: unit.unitNumber || unitIndex + 1,
      })),
    };
  };

  const loadChapterContentPayload = async (unit: any) => {
    const [enrichedResult] = await Promise.allSettled([
      getUnitContent(unit.id, "enriched"),
    ]);

    const enriched =
      enrichedResult.status === "fulfilled" ? enrichedResult.value : null;

    const sectionTopics =
      enriched?.sectionTopics ||
      unit.sectionTopics ||
      [];

    return {
      enriched: enriched?.content || null,
      sectionTopics,
    };
  };

  useEffect(() => {
    let ignore = false;

    async function loadLibraryBooks() {
      setIsLibraryLoading(true);
      try {
        const data = await getLibrarySubjects();
        if (!ignore) {
          setLibraryBooks(data.map((subjectGroup, index) => mapRemoteSubjectToBook(subjectGroup, index)));
        }
      } catch (error) {
        if (!ignore) {
          setLibraryBooks([]);
          pushToast({
            title: "Library unavailable",
            description: error instanceof Error ? error.message : "Failed to load the library.",
            variant: "destructive",
          });
        }
      } finally {
        if (!ignore) setIsLibraryLoading(false);
      }
    }

    loadLibraryBooks();
    return () => {
      ignore = true;
    };
  }, [pushToast]);

  const openBookFromLibrary = async (book: Book) => {
    try {
      setIsLoadingPage(true);
      setBookLoadError(null);
      if (book.id.startsWith("sci-") || book.id.startsWith("phy-")) {
        const firstChapter = book.chapters[0] || null;
        setSelectedBook(book);
        setActiveChapter(firstChapter);
        setDisplayChapter(firstChapter);
        setIsTocView(false);
        setCurrentSpreadIndex(0);
        setDisplaySpreadIndex(0);
        clearReaderState();
        return;
      }
      const detail = await getLibrarySubjectDetail(book.id);
      const chapters = await Promise.all(
        detail.units.map(async (unit, index) => {
          try {
            const chapterContent = await loadChapterContentPayload(unit);
            return buildChapterFromUnit(
              unit,
              chapterContent,
              index,
            );
          } catch (error) {
            return buildChapterFromUnit(unit, { sectionTopics: unit.sectionTopics || [] }, index);
          }
        }),
      );
      const hydratedBook = {
        ...mapRemoteSubjectToBook(detail, 0),
        chapters,
      };
      const firstChapter = hydratedBook.chapters[0] || null;
      setSelectedBook(hydratedBook);
      setActiveChapter(firstChapter);
      setDisplayChapter(firstChapter);
      setIsTocView(false);
      setCurrentSpreadIndex(0);
      setDisplaySpreadIndex(0);
      clearReaderState();
    } catch (error) {
      setBookLoadError(error instanceof Error ? error.message : "Failed to open this book.");
      pushToast({
        title: "Book unavailable",
        description: error instanceof Error ? error.message : "Failed to open this book.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPage(false);
    }
  };

  useEffect(() => {
    let ignore = false;

    async function loadRemoteBook(bookId: string, chapterId?: any) {
      setBookLoadError(null);
      const detail = await getLibrarySubjectDetail(bookId);
      const chapterPayloads = await Promise.all(
        detail.units.map(async (unit, index) => {
          try {
            const chapterContent = await loadChapterContentPayload(unit);
            return buildChapterFromUnit(
              unit,
              chapterContent,
              index,
            );
          } catch (error) {
            return buildChapterFromUnit(unit, { sectionTopics: unit.sectionTopics || [] }, index);
          }
        }),
      );

      if (ignore) return;

      const palettes = [
        "#6366f1",
        "#0ea5e9",
        "#10b981",
        "#f59e0b",
        "#ec4899",
      ];
      const remoteBook: Book = {
        id: detail.subjectGroupKey,
        title: detail.title,
        subject: detail.subject,
        color: palettes[0],
        coverImageUrl: detail.coverImageUrl || null,
        imageCandidates: detail.imageCandidates || [],
        chapters: chapterPayloads,
      };
      const nextChapter =
        remoteBook.chapters.find((chapter) => String(chapter.id) === String(chapterId)) ||
        remoteBook.chapters[0] ||
        null;

      setSelectedBook(remoteBook);
      setActiveChapter(nextChapter);
      setDisplayChapter(nextChapter);
      setIsTocView(false);
      setCurrentSpreadIndex(0);
      setDisplaySpreadIndex(0);
    }

    const queryBookId = new URLSearchParams(window.location.search).get("book");
    if (queryBookId) {
      loadRemoteBook(queryBookId).catch((error) => {
        if (!ignore) {
          setBookLoadError(error instanceof Error ? error.message : "Failed to load the selected book.");
        }
      }).finally(() => {
        if (!ignore) {
          setIsLoadingPage(false);
        }
      });
      return () => {
        ignore = true;
      };
    }

    const rawCtx = sessionStorage.getItem("readerContext");
    if (rawCtx) {
      try {
        const ctx = JSON.parse(rawCtx) as { bookId: string; chapterId: any; isDark: boolean };
        sessionStorage.removeItem("readerContext");
        if (ctx.bookId && !ctx.bookId.startsWith("sci-") && !ctx.bookId.startsWith("phy-")) {
          loadRemoteBook(ctx.bookId, ctx.chapterId).catch((error) => {
            if (!ignore) {
              setBookLoadError(error instanceof Error ? error.message : "Failed to restore the selected book.");
            }
          }).finally(() => {
            if (!ignore && ctx.isDark !== undefined) setTheme(ctx.isDark ? 'dark' : 'light');
          });
          return () => {
            ignore = true;
          };
        }
        const book = LIBRARY_DATA.find(b => b.id === ctx.bookId);
        if (book) {
          const ch = book.chapters.find((c: any) => String(c.id) === String(ctx.chapterId));
          if (ch) {
            setSelectedBook(book); setActiveChapter(ch);
            setDisplayChapter(ch); setIsTocView(false);
            if (ctx.isDark !== undefined) setTheme(ctx.isDark ? 'dark' : 'light');
            setIsLoadingPage(false);
            return;
          }
        }
      } catch {}
    }
    const state = loadReaderState();
    if (state) {
      const book = LIBRARY_DATA.find(b => b.id === state.bookId);
      if (book) {
        const ch = book.chapters.find((c: any) => String(c.id) === String(state.chapterId));
        if (ch) {
          setSelectedBook(book); setActiveChapter(ch);
          setDisplayChapter(ch); setIsTocView(false);
          if (state.isDark !== undefined) setTheme(state.isDark ? 'dark' : 'light');
        }
      }
    }
    setIsLoadingPage(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedBook && activeChapter && !activeChapter.isUnitIntro) {
      saveReaderState({ bookId: selectedBook.id, chapterId: activeChapter.id, isDark });
    }
  }, [selectedBook, activeChapter, isDark]);

  useEffect(() => {
    if (selectedBook && activeChapter && !activeChapter.isUnitIntro) {
      setAiMessages(loadAIChat(selectedBook.id, activeChapter.id));
    }
  }, [selectedBook?.id, activeChapter?.id]);

  useEffect(() => {
    if (selectedBook && activeChapter && aiMessages.length) {
      saveAIChat(selectedBook.id, activeChapter.id, aiMessages);
    }
  }, [aiMessages]);

  useEffect(() => {
    if (activeChapter?.isUnitIntro) {
      const t = setTimeout(() => setActiveChapter(activeChapter.realChapter), 1500);
      return () => clearTimeout(t);
    }
    if (activeChapter && !activeChapter.isUnitIntro) setExpandedUnit(activeChapter.unit);
  }, [activeChapter]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const media = window.matchMedia("(max-width: 900px)");
    const handleChange = () => setIsSinglePageView(media.matches);
    handleChange();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!displayChapter && activeChapter) {
      setDisplayChapter(activeChapter);
      setCurrentSpreadIndex(0);
      setDisplaySpreadIndex(0);
      return;
    }
    if (!displayChapter || !activeChapter || displayChapter.id === activeChapter.id) return;
    setDirection(activeChapter.id > displayChapter.id ? "next" : "prev");
    setIsFlipping(true);
    const t = setTimeout(() => {
      setDisplayChapter(activeChapter);
      setCurrentSpreadIndex(0);
      setDisplaySpreadIndex(0);
      setIsFlipping(false);
    }, 600);
    return () => clearTimeout(t);
  }, [activeChapter]);

  useEffect(() => {
    const t = setTimeout(() => setIsLoadingPage(false), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let interval: any;
    if (selectedBook && !isQuizOpen && !isSummaryOpen) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [selectedBook, isQuizOpen, isSummaryOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuPos(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setIsAiPanelOpen(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // â”€â”€â”€ Build content blocks, pages, and spreads â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let allPageContent: any[] = [];
  if (displayChapter && !displayChapter.isUnitIntro) {
    const textContent = displayChapter.enhancedContent || displayChapter.content || "";
    let layout = displayChapter.layout as any[] | undefined;
    if (!layout || !layout.length) {
      const paragraphs = textContent.split(/\n+/).filter((p: string) => p.trim());
      layout = [];
      for (const p of paragraphs) {
        if      (p.startsWith("### ")) layout.push({ type: "heading3", content: p.replace(/^###\s*/, "") });
        else if (p.startsWith("## "))  layout.push({ type: "heading2", content: p.replace(/^##\s*/, "") });
        else if (p.startsWith("# "))   layout.push({ type: "heading1", content: p.replace(/^#\s*/, "") });
        else                           layout.push({ type: "text",     content: p });
      }
    }
    allPageContent = layout;
  }

  const { pages: readerPages, anchorToPage } = paginateReaderBlocks(
    allPageContent,
    isSinglePageView ? 16 : 18,
  );
  const readerSpreads = buildReaderSpreads(readerPages, isSinglePageView);
  const safeSpreadIndex = Math.min(displaySpreadIndex, Math.max(readerSpreads.length - 1, 0));
  const activeSpread = readerSpreads[safeSpreadIndex] || {
    left: { items: [], pageNumber: 1 },
    right: null,
  };
  const hasPrevSpread = safeSpreadIndex > 0;
  const hasNextSpread = safeSpreadIndex < readerSpreads.length - 1;
  const anchorToSpread = (() => {
    const nextMap = new Map<string, number>();
    anchorToPage.forEach((pageIndex, anchor) => {
      nextMap.set(anchor, isSinglePageView ? pageIndex : Math.floor(pageIndex / 2));
    });
    return nextMap;
  })();

  useEffect(() => {
    const handleNav = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        if (hasNextSpread) {
          event.preventDefault();
          goSpread(1);
        }
        return;
      }
      if (event.key === "ArrowLeft" && hasPrevSpread) {
        event.preventDefault();
        goSpread(-1);
      }
    };

    document.addEventListener("keydown", handleNav);
    return () => document.removeEventListener("keydown", handleNav);
  }, [hasNextSpread, hasPrevSpread, currentSpreadIndex, isFlipping]);

  // Sync edit form when a highlight is opened for editing
  useEffect(() => {
    if (editingHighlight) {
      setEditedComment(editingHighlight.comment || "");
      setEditedColor(editingHighlight.color || "yellow");
    }
  }, [editingHighlight]);

  useEffect(() => {
    if (!pendingSectionAnchor) return;

    const nextSpreadIndex = anchorToSpread.get(pendingSectionAnchor);
    if (nextSpreadIndex === undefined) {
      setPendingSectionAnchor(null);
      return;
    }

    const t = window.setTimeout(() => {
      setDirection(nextSpreadIndex >= currentSpreadIndex ? "next" : "prev");
      setCurrentSpreadIndex(nextSpreadIndex);
      setDisplaySpreadIndex(nextSpreadIndex);
      setPendingSectionAnchor(null);
    }, 350);

    return () => window.clearTimeout(t);
  }, [anchorToSpread, currentSpreadIndex, pendingSectionAnchor]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const triggerToast = (msg: string) => {
    setToast({ msg, type: msg.includes("✅") ? "success" : "error" });
    setTimeout(() => setToast(null), 2000);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // If the event target is (or is inside) a highlighted span,
    // the span's own onClick handles it — skip the selection menu entirely
    const target = e.target as HTMLElement;
    if (
      target.closest(".reader-highlight-wrap") ||
      target.closest("mark.reader-highlight")  ||
      target.classList.contains("hl-tooltip")  ||
      target.classList.contains("hl-tooltip-icon")
    ) {
      return;
    }

    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setMenuPos(null);
        persistentSelection.current = "";
        return;
      }
      const text = sel.toString().trim();
      if (!text) { setMenuPos(null); persistentSelection.current = ""; return; }

      const range    = sel.getRangeAt(0);
      const ancestor = range.commonAncestorContainer;

      const bookEls = Array.from(
        document.querySelectorAll(".bk-page-inner, .bk-unit-intro"),
      ) as HTMLElement[];
      const isInsideBookBody = bookEls.some((bookEl) => bookEl.contains(ancestor as Node));
      if (!isInsideBookBody) {
        setMenuPos(null);
        persistentSelection.current = "";
        return;
      }

      const rects = range.getClientRects();
      if (!rects || rects.length === 0) { setMenuPos(null); return; }

      const last = rects[rects.length - 1];
      setMenuPos({ x: last.left + last.width / 2, y: last.bottom });
      persistentSelection.current = text;
    }, 30);
  };

  const handleAskAI = async (
    prompt: string,
    selectedText?: string,
    actionLabel?: "Explain" | "Summarize" | "Ask AI",
  ) => {
    if (!prompt.trim()) return;
    if (!activeChapter?.id || activeChapter.isUnitIntro) return;

    if (actionLabel === "Ask AI") {
      // Open the panel and show the selected text as a user message bubble
      setIsAiPanelOpen(true);

      const userMsg: AskAIMessage = {
        id:           Date.now().toString(),
        role:         "user",
        content:      prompt,
        timestamp:    new Date(),
        selectedText,
        actionLabel:  "Ask AI",
      };
      setAiMessages(prev => [...prev, userMsg]);
      setAiInput("");
      setPendingTag(null);
      setAiLoading(true);

      // AI asks a clarifying question — no mock content response
      setTimeout(() => {
        setAiMessages(prev => [...prev, {
          id:        (Date.now() + 1).toString(),
          role:      "assistant",
          content:   "What doubts do you have about this? I'm here to help! 😊",
          timestamp: new Date(),
        }]);
        setAiLoading(false);
      }, 900);

    } else {
      // Explain / Summarize
      setExplainData({ title: actionLabel || "AI Response", content: "", selectedText });
      setIsExplainPanelOpen(true);
      setIsExplainLoading(true);
      setTimeout(() => {
        const resp = actionLabel === "Summarize"
          ? `Key Takeaways:\n• Core Concept: Highlights fundamental principles of the selected passage.\n• Significance: Vital for understanding ${selectedBook?.subject || "this subject"}.\n• Application: Critical for problem solving in this unit.`
          : `To understand this clearly, consider the selected text as a bridge between your previous knowledge and this unit's goals. The passage discusses key ideas that form the foundation for advanced topics ahead.`;
        setExplainData({ title: actionLabel || "AI Response", content: resp, selectedText });
        setIsExplainLoading(false);
      }, 900);
    }
  };

  const handleLiveAskAI = async (
    prompt: string,
    selectedText?: string,
    actionLabel?: "Explain" | "Summarize" | "Ask AI",
  ) => {
    if (!prompt.trim()) return;
    if (!activeChapter?.id || activeChapter.isUnitIntro) return;

    if (actionLabel === "Ask AI") {
      setIsAiPanelOpen(true);

      const userMsg: AskAIMessage = {
        id: Date.now().toString(),
        role: "user",
        content: prompt,
        timestamp: new Date(),
        selectedText,
        actionLabel: "Ask AI",
      };

      setAiMessages((prev) => [...prev, userMsg]);
      setAiInput("");
      setPendingTag(null);
      setAiLoading(true);

      try {
        const response = await askHighlight({
          unitId: String(activeChapter.id),
          highlightedText: selectedText || prompt,
          messages: [
            ...aiMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            { role: "user", content: prompt },
          ],
        });

        setAiMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content:
              extractAiText(response) ||
              "I reviewed that passage, but I couldn't generate a detailed answer yet.",
            timestamp: new Date(),
          },
        ]);
      } catch (error: any) {
        setAiMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content:
              error?.message || "I couldn't reach the AI service for this question.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setAiLoading(false);
      }

      return;
    }

    setExplainData({ title: actionLabel || "AI Response", content: "", selectedText });
    setIsExplainPanelOpen(true);
    setIsExplainLoading(true);

    try {
      const response =
        actionLabel === "Summarize"
          ? await summarizeHighlight({
              unitId: String(activeChapter.id),
              highlightedText: selectedText || prompt,
            })
          : await explainHighlight({
              unitId: String(activeChapter.id),
              highlightedText: selectedText || prompt,
            });

      setExplainData({
        title: actionLabel || "AI Response",
        content:
          extractAiText(response) ||
          `No ${actionLabel?.toLowerCase() || "AI"} response was returned for this passage.`,
        selectedText,
      });
    } catch (error: any) {
      setExplainData({
        title: actionLabel || "AI Response",
        content: error?.message || "I couldn't process this request right now.",
        selectedText,
      });
    } finally {
      setIsExplainLoading(false);
    }
  };

  const hasGeniusContent = Boolean(
    activeChapter?.layout?.length || activeChapter?.enhancedContent || activeChapter?.sourceContent || activeChapter?.content,
  );

  const handleEnhanceContent = () => {
    if (!hasGeniusContent || !activeChapter || !selectedBook) {
      pushToast({
        title: "Genius Mode unavailable",
        description: "No live chapter content is available for this unit yet.",
        variant: "destructive",
      });
      return;
    }
    setIsEnhancing(true);
    setTimeout(() => {
      setIsEnhancing(false);
      const geniusSource = activeChapter.sourceContent || activeChapter.enhancedContent || activeChapter.content || "";
      const geniusUnitTitle =
        activeChapter.unitTitle ||
        selectedBook.chapters.find((entry: any) => entry.unit === activeChapter.unit)?.unitTitle ||
        selectedBook.chapters.find((entry: any) => entry.unit === activeChapter.unit)?.title ||
        activeChapter.title ||
        selectedBook.title;
      const geniusContent = serializeBlocksForGenius(
        activeChapter.layout,
        activeChapter.enhancedContent || activeChapter.content || flattenContentToText(geniusSource),
      );
      openEnhancedView(
        geniusContent,
        geniusUnitTitle,
        selectedBook.subject,
        activeChapter.id,
        selectedBook.id,
        isDark,
      );
    }, 600);
  };

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (isLoadingPage) {
    return (
      <div className="app-root" >
        <div className="overlay">
          <FunnyLoader />
        </div>
        <style>{libStyles + readerStyles}</style>
      </div>
    );
  }

  if (bookLoadError && !selectedBook) {
    return (
      <div className="app-root">
        <div className="overlay">
          <div className="modal glass animate-pop" style={{ maxWidth: 420 }}>
            <h2>Book Unavailable</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>{bookLoadError}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
              <button className="btn-premium" onClick={() => window.location.reload()}>Retry</button>
              <button className="btn-ghost" onClick={() => { setBookLoadError(null); setSelectedBook(null); setIsTocView(false); }}>Back to Library</button>
            </div>
          </div>
        </div>
        <style>{libStyles + readerStyles}</style>
      </div>
    );
  }

  // ─── Build content blocks, pages, and spreads ──────────────────────────────
  // ─── Apply highlights — hover tooltip + click to edit ───────────────────
  const normalise = (s: string) =>
    s.replace(/\s+/g, " ").replace(/\u00AD/g, "").trim();

  const applyHighlights = (text: string, baseKey: string): (string | React.ReactElement)[] => {
    let segs: (string | React.ReactElement)[] = [text];
    highlights.forEach(h => {
      if (!h.text) return;
      const needle   = normalise(h.text);
      const next: (string | React.ReactElement)[] = [];
      segs.forEach(seg => {
        if (typeof seg !== "string") { next.push(seg); return; }
        const normSeg  = normalise(seg);
        let matchIdx   = seg.indexOf(h.text);
        let matchLen   = h.text.length;
        if (matchIdx === -1) {
          matchIdx = normSeg.indexOf(needle);
          matchLen = needle.length;
          if (matchIdx === -1) { next.push(seg); return; }
        }
        if (matchIdx > 0) next.push(seg.slice(0, matchIdx));
        const matchedText = seg.slice(matchIdx, matchIdx + matchLen);
        const hlCol = getHlColor(h.color || "yellow");
        next.push(
          <span
            key={`${baseKey}-${h.id}`}
            className="reader-highlight-wrap"
            onMouseDown={e => { e.stopPropagation(); }}
            onClick={e => { e.preventDefault(); e.stopPropagation(); setEditingHighlight(h); }}
          >
            <mark
              className="reader-highlight"
              style={{
                background: hlCol.bg,
                borderBottom: `2px solid ${hlCol.border}`,
                borderRadius: 3,
                padding: "1px 2px",
                color: "inherit",
                cursor: "pointer",
                transition: "background .15s",
              }}
            >
              {matchedText}
            </mark>
            {/* Tooltip — shown on hover via CSS visibility/opacity */}
            <span className="hl-tooltip">
              <span
                className="hl-tooltip-dot"
                style={{ background: hlCol.mark }}
              />
              {h.comment ? h.comment : "Click to edit or delete"}
            </span>
          </span>
        );
        const after = seg.slice(matchIdx + matchLen);
        if (after) next.push(...applyHighlights(after, `${baseKey}-${h.id}-tail`));
      });
      segs = next;
    });
    return segs;
  };

  // ─── Render one content item ───────────────────────────────────────────────
  // Headings/images are NOT selectable (pointer-events:none / user-select:none
  // applied via className). Only .reader-paragraph nodes are selectable.
  const renderItem = (item: any, index: number) => {
    if (item.type === "text") {
      return (
        <p key={index} className="reader-paragraph">
          {applyHighlights(item.content, `p-${index}`)}
        </p>
      );
    }
    if (item.type === "heading1") return <h1 key={index} id={item.anchor} className="reader-h1 no-select">{item.content}</h1>;
    if (item.type === "heading2") return <h2 key={index} id={item.anchor} className="reader-h2 no-select">{item.content}</h2>;
    if (item.type === "heading3") return <h3 key={index} id={item.anchor} className="reader-h3 no-select">{item.content}</h3>;
    if (item.type === "formula") {
      return (
        <pre key={index} className="reader-formula no-select">
          {item.content}
        </pre>
      );
    }
    if (item.type === "html") {
      return (
        <div
          key={index}
          className="reader-html-block"
          dangerouslySetInnerHTML={{ __html: item.content }}
        />
      );
    }
    if (item.type === "list" && Array.isArray(item.items)) {
      return (
        <ul key={index} className="reader-list">
          {item.items.map((listItem: string, itemIndex: number) => (
            <li key={`${index}-${itemIndex}`} className="reader-list-item">
              {applyHighlights(listItem, `li-${index}-${itemIndex}`)}
            </li>
          ))}
        </ul>
      );
    }
    if (item.type === "table" && Array.isArray(item.rows)) {
      return (
        <div key={index} className="reader-table-wrap no-select">
          <table className="reader-table">
            {Array.isArray(item.headers) && item.headers.length ? (
              <thead>
                <tr>
                  {item.headers.map((header: string, headerIndex: number) => (
                    <th key={`${index}-h-${headerIndex}`}>{header}</th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {item.rows.map((row: string[], rowIndex: number) => (
                <tr key={`${index}-r-${rowIndex}`}>
                  {row.map((cell: string, cellIndex: number) => (
                    <td key={`${index}-c-${rowIndex}-${cellIndex}`}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (item.type === "image" || item.imageUrl || item.thumbnail || item.coverImageUrl || item.coverImage || item.images || item.media) {
      const figureKey = `${selectedBook?.id || "book"}-${displayChapter?.id || "chapter"}-${index}`;
      const imageSrc = resolveMediaUrl(
        item.src ||
          item.imageUrl ||
          item.thumbnail ||
          item.thumbnailUrl ||
          item.coverImage ||
          item.coverImageUrl ||
          item.url ||
          item.images ||
          item.media,
      );

      return (
        <figure key={index} className="reader-figure no-select">
          <div className="reader-figure-img-wrap">
            {imageSrc && !brokenFigureImages[figureKey] ? (
              <img
                src={imageSrc}
                alt={item.caption || displayChapter?.title || selectedBook?.title || "Book illustration"}
                className="reader-figure-img"
                draggable={false}
                onError={() => setBrokenFigureImages((current) => ({ ...current, [figureKey]: true }))}
              />
            ) : (
              <div className="reader-figure-fallback">
                <span>Image unavailable</span>
              </div>
            )}
          </div>
          {item.caption && <figcaption className="reader-figcaption">{item.caption}</figcaption>}
        </figure>
      );
    }
    return null;
  };

  const renderReaderPage = (
    page: { items: any[]; pageNumber: number } | null,
    side: "left" | "right",
    showChapterHeader = false,
  ) => {
    if (!page) {
      return (
        <section className={`bk-page-surface ${side} empty no-select`}>
          <div className="bk-page-empty">End of this spread</div>
        </section>
      );
    }

    return (
      <section className={`bk-page-surface ${side}`}>
        <div className="bk-page-inner">
          {showChapterHeader && (
            <div className="bk-chapter-header no-select">
              <span className="bk-ch-eyebrow">{activeUnitLabel}</span>
              <h2 className="bk-ch-title">{activeUnitTitle || displayChapter?.title}</h2>
              {activeSectionTitle ? <p className="bk-ch-subtitle">{activeSectionTitle}</p> : null}
              <div className="bk-ch-rule" />
            </div>
          )}
          {page.items.length ? page.items.map(renderItem) : (
            <p className="reader-paragraph">No content available for this section.</p>
          )}
        </div>
        <div className="bk-page-number">{page.pageNumber}</div>
      </section>
    );
  };

  // ─── Chapter prev / next helpers ───────────────────────────────────────────
  const allChapters = selectedBook?.chapters ?? [];
  const currentChIdx = allChapters.findIndex((c: any) => c.id === activeChapter?.id);
  const getUnitTitle = (chapter: any) => {
    if (!chapter) return "";
    const sibling = allChapters.find((entry: any) => entry.unit === chapter.unit);
    return chapter.unitTitle || sibling?.unitTitle || sibling?.title || chapter.title || `Unit ${chapter.unit}`;
  };
  const activeUnitTitle = getUnitTitle(displayChapter || activeChapter);
  const activeUnitLabel = displayChapter?.unit ? `Unit ${displayChapter.unit}` : "Unit";
  const activeSectionTitle =
    displayChapter?.title && normalizeReaderLabel(displayChapter.title) !== normalizeReaderLabel(activeUnitTitle)
      ? displayChapter.title
      : "";
  const hasPrev = currentChIdx > 0;
  const hasNext = currentChIdx < allChapters.length - 1;
  const getBookCoverUrl = (book: Book | null) => {
    if (!book || brokenBookImages[book.id]) {
      return null;
    }

    return resolveMediaUrl(book.coverImageUrl || book.imageCandidates || null);
  };
  const goChapter = (delta: number) => {
    const target = allChapters[currentChIdx + delta];
    if (!target) return;
    setActiveChapter(target);
  };
  const goSpread = (delta: number) => {
    const nextIndex = currentSpreadIndex + delta;
    if (nextIndex < 0 || nextIndex >= readerSpreads.length || isFlipping) return;
    setDirection(delta > 0 ? "next" : "prev");
    setIsFlipping(true);
    setTimeout(() => {
      setCurrentSpreadIndex(nextIndex);
      setDisplaySpreadIndex(nextIndex);
      setIsFlipping(false);
    }, 420);
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // ── LIBRARY VIEW ──────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  if (!selectedBook) {
    const booksForLibrary = libraryBooks;
    const subjects = ["All", ...new Set(booksForLibrary.map(b => b.subject.split(" • ")[0]))];
    const filteredBooks = activeFilter === "All" ? booksForLibrary : booksForLibrary.filter(b => b.subject.includes(activeFilter));

    return (
      <div className="app-root" >
        <Navigation currentRole={currentRole} onRoleChange={setCurrentRole} />
        <div className="lib-root">

          {/* ── Hero ── */}
          <div className="lib-hero">
            <div className="lib-hero-inner">
              <div>
                <div className="lib-hero-title">Your Digital Library 📚</div>
                <div className="lib-hero-sub">
                  Continue where you left off — pick up any book and keep learning.
                </div>
              </div>
              {getBookCoverUrl(selectedBook) ? (
                <div className="toc-hero-cover">
                  <img
                    src={getBookCoverUrl(selectedBook) || ""}
                    alt={selectedBook.title}
                    className="toc-hero-cover-image"
                    onError={() => setBrokenBookImages((current) => ({ ...current, [selectedBook.id]: true }))}
                  />
                </div>
              ) : null}
              <div className="lib-hero-right">
                <div className="lib-hero-stat">
                  <div className="lib-hero-sn">{filteredBooks.length}</div>
                  <div className="lib-hero-sl">Books Available</div>
                </div>
                <div className="lib-hero-div" />
                <button className="lib-hero-btn" onClick={() => setTheme(isDark ? 'light' : 'dark')}>
                  {isDark ? "☀️ Light" : "🌙 Dark"}
                </button>
              </div>
            </div>
          </div>

          {/* ── Stats row ── */}
          <div className="lib-stats-row">
            {[
              { label: "Total Books",    value: booksForLibrary.length, icon: "📚", color: "blue"   },
              { label: "Available Units", value: booksForLibrary.reduce((sum, book) => sum + book.chapters.length, 0), icon: "📖", color: "indigo" },
              { label: "Subjects",       value: new Set(booksForLibrary.map(b => b.subject.split(" • ")[0])).size, icon: "🎯", color: "purple" },
              { label: "Ready to Read",  value: booksForLibrary.filter((book) => book.chapters.length > 0).length, icon: "✅", color: "green"  },
            ].map((s, i) => (
              <div key={i} className={`lib-stat-card lib-stat-${s.color}`} style={{ animationDelay: `${0.05 + i * 0.07}s` }}>
                <div className="lib-stat-icon">{s.icon}</div>
                <div className="lib-stat-num">{s.value}</div>
                <div className="lib-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Filter chips ── */}
          <div className="lib-filter-row">
            {subjects.map(subject => (
              <button
                key={subject}
                className={`lib-chip ${activeFilter === subject ? "active" : ""}`}
                onClick={() => setActiveFilter(subject)}
              >
                {subject}
              </button>
            ))}
          </div>

          {/* ── Book grid ── */}
          <div className="lib-grid">
            {!isLibraryLoading && filteredBooks.length === 0 && (
              <div className="lib-empty-card">
                <div className="lib-empty-icon">📚</div>
                <div className="lib-empty-title">No data available</div>
                <div className="lib-empty-copy">No subjects are available for the selected filter yet.</div>
              </div>
            )}
            {filteredBooks.map((book, i) => (
              <div
                key={book.id}
                className="lib-book-card"
                style={{ animationDelay: `${0.07 + i * 0.07}s` }}
                onClick={() => { openBookFromLibrary(book); }}
              >
                <div className="lib-cover" style={{ background: book.color }}>
                  {getBookCoverUrl(book) ? (
                    <img
                      src={getBookCoverUrl(book) || ""}
                      alt={book.title}
                      className="lib-cover-image"
                      onError={() => setBrokenBookImages((current) => ({ ...current, [book.id]: true }))}
                    />
                  ) : null}
                  <div className="lib-cover-glare" />
                  <span className="lib-cover-symbol">{getSubjectSymbol(book.subject)}</span>
                </div>
                <div className="lib-book-info">
                  <span className="lib-subject-tag">{book.subject}</span>
                  <h3 className="lib-book-title">{book.title}</h3>
                  <div className="lib-progress-bg">
                    <div className="lib-progress-fill" style={{ width: "45%", background: book.color }} />
                  </div>
                  <div className="lib-progress-pct">45% complete</div>
                  <div className="lib-card-footer">
                    <span className="lib-chapters">{book.chapters.length} Chapters</span>
                    <button
                      className="lib-open-btn"
                      onClick={e => { e.stopPropagation(); openBookFromLibrary(book); }}
                    >
                      Open →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
        <style>{libStyles + readerStyles}</style>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ── TOC VIEW ──────────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  if (selectedBook && isTocView) {
    const unitNumbers = Array.from(new Set(selectedBook.chapters.map(ch => ch.unit)));

    return (
      <div className="app-root" >
        <Navigation currentRole={currentRole} onRoleChange={setCurrentRole} />
        <div className="lib-root">

          {/* ── TOC Hero ── */}
          <div className="lib-hero toc-hero" style={{ background: selectedBook.color }}>
            <div className="lib-hero-inner">
              <div>
                <div className="toc-hero-subject">{selectedBook.subject}</div>
                <div className="lib-hero-title">{selectedBook.title}</div>
                <div className="lib-hero-sub">
                  {selectedBook.chapters.length} chapters across {unitNumbers.length} units · Select a chapter to begin
                </div>
              </div>
              <div className="lib-hero-right">
                <div className="lib-hero-stat">
                  <div className="lib-hero-sn">{unitNumbers.length}</div>
                  <div className="lib-hero-sl">Units</div>
                </div>
                <div className="lib-hero-div" />
                <div className="lib-hero-stat">
                  <div className="lib-hero-sn">{selectedBook.chapters.length}</div>
                  <div className="lib-hero-sl">Chapters</div>
                </div>
                <div className="lib-hero-div" />
                <button
                  className="lib-hero-btn"
                  onClick={() => { setSelectedBook(null); setIsTocView(false); clearReaderState(); }}
                >
                  ← Library
                </button>
              </div>
            </div>
          </div>

          {/* ── TOC unit + chapter cards ── */}
          <div className="toc-grid">
            {unitNumbers.map((unitNumber: any, idx: number) => {
              const unitChapters = selectedBook.chapters.filter(ch => ch.unit === unitNumber);
              const firstChapter = unitChapters[0];
              const sectionTopics = firstChapter?.sectionTopics || [];
              return (
                <div
                  key={unitNumber}
                  className="toc-card"
                  style={{ animationDelay: `${0.07 + idx * 0.09}s` }}
                >
                  {/* Unit accent strip */}
                  <div className="toc-card-accent" style={{ background: selectedBook.color }}>
                    <span className="toc-unit-num">{String(unitNumber).padStart(2, "0")}</span>
                    <div className="toc-unit-info">
                      <span className="toc-unit-label">Unit {unitNumber}</span>
                      <span className="toc-unit-title">{firstChapter.title || `Unit ${unitNumber}`}</span>
                    </div>
                  </div>

                  {/* Preview text */}
                  <div className="toc-card-preview-text">
                    {(firstChapter.content || "").substring(0, 100)}…
                  </div>

                  {/* Chapter rows */}
                  <div className="toc-chapter-list">
                    {sectionTopics.length > 0
                      ? sectionTopics.map((topic: any, ci: number) => (
                          <div
                            key={topic.id}
                            className="toc-chapter-row"
                            onClick={() => {
                              setActiveChapter(firstChapter);
                              setIsTocView(false);
                              setDisplayChapter(null);
                              setPendingSectionAnchor(topic.anchor);
                            }}
                          >
                            <span className="toc-ch-num">{topic.number || `${unitNumber}.${ci + 1}`}</span>
                            <span className="toc-ch-title">{topic.title}</span>
                            <span className="toc-ch-arrow">→</span>
                          </div>
                        ))
                      : unitChapters.map((ch: any, ci: number) => (
                          <div
                            key={ch.id}
                            className="toc-chapter-row"
                            onClick={() => {
                              setActiveChapter(ch);
                              setIsTocView(false);
                              setDisplayChapter(null);
                            }}
                          >
                            <span className="toc-ch-num">{unitNumber}.{ci + 1}</span>
                            <span className="toc-ch-title">{ch.title}</span>
                            <span className="toc-ch-arrow">→</span>
                          </div>
                        ))}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
        <style>{libStyles + readerStyles}</style>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // ── READER VIEW ───────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════════
  return (
    <div className={`app-root ${isFocus ? "focus-active" : ""}`} >
      <AnimatePresence>
        <motion.div key="reader-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
          <div className="workstation">

            {/* ── PREMIUM SIDEBAR ── */}
            <aside className={`sidebar glass ${isSidebarOpen ? "open" : ""}`}>
              {/* Sidebar Hero */}
              <div className="sb-hero">
                <div className="sb-hero-inner">
                  <div className="sb-hero-top">
                    <div className="sb-book-icon">{getSubjectSymbol(selectedBook?.subject || "")}</div>
                    <button className="sb-close-btn" onClick={() => setIsSummaryOpen(true)}>
                      <X size={14} />
                    </button>
                  </div>
                  <div className="sb-book-title">{selectedBook?.title}</div>
                  <div className="sb-book-subject">{selectedBook?.subject}</div>
                  {/* Progress mini bar */}
                  <div className="sb-progress-row">
                    <div className="sb-progress-bg">
                      <div className="sb-progress-fill" style={{ width: `${Math.round(((currentChIdx + 1) / Math.max(allChapters.length, 1)) * 100)}%` }} />
                    </div>
                    <span className="sb-progress-pct">{Math.round(((currentChIdx + 1) / Math.max(allChapters.length, 1)) * 100)}%</span>
                  </div>
                </div>
              </div>

              {/* Back to library */}
              {/* <button className="sb-back-btn" onClick={() => setIsSummaryOpen(true)}>
                <ArrowLeft size={13} />
                Back to Subjects
              </button> */}

              {/* Chapter nav */}
              <div className="sb-section-label">CONTENTS</div>
              <div className="nav-group-items">
                {Array.from(new Set(selectedBook.chapters.map((ch: any) => ch.unit))).map((unitNumber: any) => {
                  const unitChapters = selectedBook.chapters.filter((ch: any) => ch.unit === unitNumber);
                  const sectionTopics = unitChapters[0]?.sectionTopics || [];
                  const isExpanded   = expandedUnit === unitNumber;
                  const hasActive    = unitChapters.some((ch: any) => ch.id === activeChapter?.id);
                  const unitTitle    = unitChapters[0]?.unitTitle || unitChapters[0]?.title || `Unit ${unitNumber}`;
                  return (
                    <div key={`unit-${unitNumber}`} className="sb-unit-group">
                      {/* Unit header */}
                      <div
                        className={`sb-unit-header ${hasActive ? "active" : ""}`}
                        onClick={() => setExpandedUnit(isExpanded ? null : unitNumber)}
                      >
                        <div className="sb-unit-badge">{String(unitNumber).padStart(2,"0")}</div>
                        <span className="sb-unit-label">
                          <strong>{`Unit ${unitNumber}`}</strong>
                          <small>{unitTitle}</small>
                        </span>
                        <span className={`sb-unit-chevron ${isExpanded ? "open" : ""}`}>▾</span>
                      </div>
                      {/* Chapter rows */}
                      <div className={`sb-chapters-wrap ${isExpanded ? "open" : ""}`} style={{ maxHeight: isExpanded ? `${Math.max(sectionTopics.length, unitChapters.length) * 52}px` : "0px" }}>
                        {sectionTopics.length > 0
                          ? sectionTopics.map((topic: any, idx: number) => {
                              const isCur = activeChapter?.id === unitChapters[0]?.id;
                              return (
                                <div
                                  key={topic.id}
                                  className={`sb-chapter-row ${isCur ? "active" : ""}`}
                                  onClick={() => {
                                    setActiveChapter(unitChapters[0]);
                                    setPendingSectionAnchor(topic.anchor);
                                    setIsSidebarOpen(false);
                                  }}
                                >
                                  <span className="sb-ch-num">{topic.number || `${unitNumber}.${idx + 1}`}</span>
                                  <span className="sb-ch-title">{topic.title}</span>
                                  {isCur && <span className="sb-ch-active-dot" />}
                                </div>
                              );
                            })
                          : unitChapters.map((ch: any, idx: number) => {
                              const isCur = activeChapter?.id === ch.id;
                              return (
                                <div
                                  key={ch.id}
                                  className={`sb-chapter-row ${isCur ? "active" : ""}`}
                                  onClick={() => {
                                    if (activeChapter && activeChapter.unit !== ch.unit) {
                                      setActiveChapter({ id: `unit-intro-${ch.unit}`, title: `Unit ${ch.unit}`, content: "", isUnitIntro: true, realChapter: ch, unit: ch.unit });
                                    } else { setActiveChapter(ch); }
                                    setIsSidebarOpen(false);
                                  }}
                                >
                                  <span className="sb-ch-num">{unitNumber}.{idx + 1}</span>
                                  <span className="sb-ch-title">{ch.title}</span>
                                  {isCur && <span className="sb-ch-active-dot" />}
                                </div>
                              );
                            })}
                      </div>
                    </div>
                  );
                })}
              </div>

            </aside>

            {/* Reader main */}
            <main className="main-viewport" onMouseUp={handleMouseUp}>
              <div className="scroll-canvas">

                {/* ── TOP BAR — hamburger + chapter title + theme ── */}
                <div className="reader-topbar">
                  <div className="reader-topbar-left">
                    <button className="reader-hamburger" onClick={() => setIsSidebarOpen(true)}>
                      <span /><span /><span />
                    </button>
                    <div className="reader-topbar-info">
                      <span className="reader-topbar-chapter">
                        {activeUnitLabel}: {activeUnitTitle || displayChapter?.title}
                        {activeSectionTitle ? ` — ${activeSectionTitle}` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="reader-topbar-right">
                   
                          {/* <button
                            className={`bk-float-btn bk-float-ai ${isAiPanelOpen ? "active" : ""}`}
                            onClick={e => { e.stopPropagation(); setIsAiPanelOpen(o => !o); }}
                            title="Ask AI about this chapter"
                          >
                            <Bot size={13} />
                            <span>Ask AI</span>
                            {aiMessages.filter(m => m.role === "assistant").length > 0 && (
                              <span className="bk-float-badge">
                                {aiMessages.filter(m => m.role === "assistant").length}
                              </span>
                            )}
                          </button> */}
                       <motion.button
  className={`bk-float-btn bk-float-thunder ${!hasGeniusContent ? "locked" : ""}`}
  onClick={e => { e.stopPropagation(); handleEnhanceContent(); }}
  disabled={!hasGeniusContent || isEnhancing}
  
  // High-voltage animations
  whileHover={hasGeniusContent ? { 
    scale: 1.05,
    x: [0, -1, 1, -1, 1, 0], // Subtle "electric vibration"
    transition: { x: { repeat: Infinity, duration: 0.1 } } 
  } : {}}
  whileTap={{ scale: 0.95 }}
>
  <div className="bolt-container">
    <div className="bolt bolt-1" />
    <div className="bolt bolt-2" />
  </div>
  
  <Sparkles className="sparkle-icon" size={14} />
  <span>{isEnhancing ? "Preparing Genius Mode..." : "Try with Genius Mode"}</span>
  
  {!hasGeniusContent && <span className="bk-float-lock">🔒</span>}
</motion.button>
                        
                    <button className="rtb-icon-btn" onClick={() => setTheme(isDark ? 'light' : 'dark')} title="Toggle theme">
                      {isDark ? <Sun size={15} /> : <Moon size={15} />}
                    </button>
                  </div>
                </div>

                <div className="genius-top-strip">
                  <div className="genius-top-copy">
                    <span className="genius-top-eyebrow">Genius Mode</span>
                    <strong>Open the original immersive Genius reader for this unit with live content and media</strong>
                  </div>
                </div>

                {/* Context menu */}
                <AnimatePresence>
                  {menuPos && (
                    <ContextMenuFixed
                      viewportX={menuPos.x}
                      viewportY={menuPos.y}
                      selectedText={persistentSelection.current}
                      onClose={() => setMenuPos(null)}
                      onHighlight={() => { setNewHighlightText(persistentSelection.current); setIsCommentModalOpen(true); setMenuPos(null); }}
                      onAskAI={(prompt, text, label) => { handleLiveAskAI(prompt, text, label); setMenuPos(null); }}
                    />
                  )}
                </AnimatePresence>

                {/* ══ CREATE HIGHLIGHT DIALOG — Word-doc style ══ */}
                <Dialog open={isCommentModalOpen} onOpenChange={open => { if (!open) { setIsCommentModalOpen(false); setNewHighlightText(""); if (newCommentRef.current) newCommentRef.current.value = ""; } }}>
                  <DialogContent
                    className="hl-dialog-content sm:max-w-[480px] p-0 overflow-hidden border-0 shadow-2xl"
                    style={{
                      background: "linear-gradient(145deg,#1e1b4b 0%,#0f172a 100%)",
                      border: "1px solid rgba(139,92,246,.28)",
                      borderRadius: 20,
                      zIndex: 100000,
                    }}
                  >
                    {/* Header */}
                    <DialogHeader style={{ padding:"20px 24px 16px", borderBottom:"1px solid rgba(139,92,246,.15)" }}>
                      <DialogTitle style={{
                        fontSize:17, fontWeight:800,
                        background:"linear-gradient(135deg,#a78bfa,#f472b6)",
                        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                        display:"flex", alignItems:"center", gap:8,
                        fontFamily:"'Plus Jakarta Sans',system-ui",
                      }}>
                        <HighlighterIcon size={15} style={{color:"#a78bfa"}}/>
                        Create Highlight
                      </DialogTitle>
                      <DialogDescription style={{fontSize:12, color:"rgba(167,139,250,.6)", marginTop:4, fontFamily:"'Plus Jakarta Sans',system-ui"}}>
                        Choose a color, add a note, then save.
                      </DialogDescription>
                    </DialogHeader>

                    <div style={{padding:"16px 24px 20px", display:"flex", flexDirection:"column", gap:16}}>

                      {/* ── Selected text preview ── */}
                      <div>
                        <div className="hl-label">
                          <HighlighterIcon size={11} style={{color:"#a78bfa"}}/>
                          Selected text
                        </div>
                        <div
                          className="hl-quote-scroll"
                          style={{
                            borderLeft: `3px solid ${getHlColor(newHlColor).mark}`,
                            background: getHlColor(newHlColor).bg.replace(".35", ".12"),
                          }}
                        >
                          "{newHighlightText}"
                        </div>
                        <div style={{fontSize:10, color:"rgba(148,163,184,.45)", marginTop:4, textAlign:"right", fontFamily:"'Plus Jakarta Sans',system-ui"}}>
                          {newHighlightText.length} characters
                        </div>
                      </div>

                      {/* ── Color picker ── */}
                      <div>
                        <div className="hl-label">
                          <span style={{fontSize:12}}>🎨</span>
                          Highlight color
                        </div>
                        <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"center"}}>
                          {HL_COLORS.map(c => (
                            <button
                              key={c.id}
                              title={c.label}
                              onClick={() => setNewHlColor(c.id)}
                              style={{
                                width:30, height:30, borderRadius:9, border:"none",
                                cursor:"pointer", background:c.mark,
                                outline: newHlColor === c.id ? "3px solid #fff" : "2px solid transparent",
                                outlineOffset: 2,
                                boxShadow: newHlColor === c.id
                                  ? `0 0 0 5px rgba(139,92,246,.45), 0 4px 10px rgba(0,0,0,.3)`
                                  : "0 2px 6px rgba(0,0,0,.2)",
                                transform: newHlColor === c.id ? "scale(1.22)" : "scale(1)",
                                transition: "all .15s cubic-bezier(.4,0,.2,1)",
                                position: "relative",
                              }}
                            >
                              {newHlColor === c.id && (
                                <span style={{
                                  position:"absolute", inset:0, display:"flex",
                                  alignItems:"center", justifyContent:"center",
                                  fontSize:14, lineHeight:1, pointerEvents:"none",
                                }}>✓</span>
                              )}
                            </button>
                          ))}
                          <span style={{fontSize:11.5, color:"rgba(167,139,250,.6)", fontWeight:600, marginLeft:4, fontFamily:"'Plus Jakarta Sans',system-ui"}}>
                            {getHlColor(newHlColor).label}
                          </span>
                        </div>
                      </div>

                      {/* ── Note textarea ── */}
                      <div>
                        <div className="hl-label">
                          <span style={{fontSize:12}}>📝</span>
                          Your note (optional)
                        </div>
                        <textarea
                          ref={newCommentRef}
                          className="hl-textarea"
                          placeholder="Why is this passage important to you…?"
                        />
                      </div>

                      {/* ── Action buttons ── */}
                      <div style={{display:"flex", gap:10}}>
                        <button
                          className="hl-btn-cancel"
                          style={{marginLeft:0}}
                          onClick={() => { setIsCommentModalOpen(false); setNewHighlightText(""); if (newCommentRef.current) newCommentRef.current.value = ""; }}
                        >
                          Cancel
                        </button>
                        <button
                          className="hl-btn-save"
                          style={{flex:1, background:`linear-gradient(135deg,${getHlColor(newHlColor).border.replace(".7","1")},${getHlColor(newHlColor).mark})`}}
                          onClick={() => {
                            const raw = newHighlightText;
                            if (!raw.trim()) return;
                            const color = newHlColor;

                            // Split multi-paragraph selections per paragraph
                            const paraNodes = Array.from(document.querySelectorAll(".bk-page-inner .reader-paragraph")) as HTMLElement[];
                            const pieces: { text: string }[] = [];
                            const normRaw = raw.replace(/\s+/g, " ").trim();
                            let remaining = normRaw;
                            for (const para of paraNodes) {
                              const paraText = (para.textContent || "").replace(/\s+/g, " ").trim();
                              if (!paraText || !remaining) break;
                              let found = "";
                              for (let len = Math.min(remaining.length, paraText.length); len >= 3; len--) {
                                const candidate = remaining.slice(0, len);
                                if (paraText.includes(candidate)) { found = candidate; break; }
                              }
                              if (found) {
                                pieces.push({ text: found });
                                remaining = remaining.slice(found.length).replace(/^\s+/, "");
                              }
                            }
                            const toSave = pieces.length > 0 ? pieces : [{ text: raw }];

                            setHighlights(prev => [
                              ...prev,
                              ...toSave.map(p => ({
                                id: `h-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
                                text: p.text,
                                comment: newCommentRef.current?.value || "",
                                color,
                              }))
                            ]);
                            setIsCommentModalOpen(false);
                            setNewHighlightText("");
                            if (newCommentRef.current) newCommentRef.current.value = "";
                          }}
                        >
                          Highlight ✦
                        </button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                
                <div className="book-container-wrapper">
                    
                  {displayChapter && (
                    <div className={`book-spread ${isFlipping ? `flipping-${direction}` : ""}`}>

                      {/* ── Real-book embossing layers ── */}
                      <div className="book-shadow-left"  />
                      <div className="book-shadow-right" />
                      <div className="book-desk-glow"    />

                      {/* ── Single paper sheet that holds both pages ── */}
                      <div className="book-sheet book-sheet-paged">

                      {/* ── TOP HEADER BAR (non-selectable) ── */}
                        <div className="bk-topbar no-select">
                          <span className="bk-topbar-left">{selectedBook?.title?.toUpperCase()}</span>
                          <div className="bk-topbar-spine-mark" />
                          <span className="bk-topbar-right">
                            {isSinglePageView
                              ? `PAGE ${activeSpread.left.pageNumber} / ${readerPages.length}`
                              : `SPREAD ${safeSpreadIndex + 1} / ${readerSpreads.length}`}
                          </span>
                        </div>                      

                        {/* ── SPINE LINE through the middle ── */}
                        {!isSinglePageView && <div className="bk-spine" />}

                        {/* ── CHAPTER TITLE — first column, non-selectable ── */}

                        {/* ── UNIT INTRO ── */}
                        {displayChapter.isUnitIntro && (
                          <div className="bk-unit-intro no-select">
                            <div className="bk-unit-num">
                              {String(displayChapter.unit).padStart(2, "0")}
                            </div>
                            <div className="bk-unit-label">Unit {displayChapter.unit}</div>
                            <div className="bk-unit-name">{getUnitTitle(displayChapter.realChapter || displayChapter)}</div>
                          </div>
                        )}

                        {/* ── BODY TEXT — two-column flow, fully selectable ── */}
                        {!displayChapter.isUnitIntro && (
                          <div
                            className={`bk-pages-shell ${isSinglePageView ? "single" : "spread"}`}
                            style={{ opacity: isFlipping ? 0.3 : 1 }}
                          >
                            {renderReaderPage(activeSpread.left, "left", safeSpreadIndex === 0)}
                            {!isSinglePageView && renderReaderPage(activeSpread.right, "right")}
                          </div>
                        )}

                        {/* ── BOTTOM FOOTER BAR (non-selectable) ── */}
                        <div className="bk-footer no-select">
                          <span className="bk-footer-left">{selectedBook?.subject}</span>
                          <div className="bk-footer-dots">
                            <span /><span /><span />
                          </div>
                          <span className="bk-footer-right">
                            {displayChapter?.isUnitIntro
                              ? `${currentChIdx + 1} / ${allChapters.length}`
                              : `${safeSpreadIndex + 1} / ${readerSpreads.length}`}
                          </span>
                        </div>
                      </div>{/* /book-sheet */}

                    </div>
                  )}
                </div>

                {/* ── PREV / NEXT CHAPTER NAVIGATION ── */}
                {!displayChapter?.isUnitIntro && (
                  <div className="bk-nav-row bk-spread-row">
                    <button
                      className={`bk-nav-btn bk-nav-prev ${!hasPrevSpread ? "disabled" : ""}`}
                      onClick={() => hasPrevSpread && goSpread(-1)}
                      disabled={!hasPrevSpread}
                    >
                      <ChevronLeft size={18} />
                      <span>Previous Page</span>
                    </button>
                    <div className="bk-nav-dots">
                      {readerSpreads.slice(0, 10).map((_, i: number) => (
                        <button
                          key={`spread-${i}`}
                          className={`bk-nav-dot ${i === safeSpreadIndex ? "active" : ""}`}
                          onClick={() => {
                            setDirection(i >= safeSpreadIndex ? "next" : "prev");
                            setCurrentSpreadIndex(i);
                            setDisplaySpreadIndex(i);
                          }}
                        />
                      ))}
                      {readerSpreads.length > 10 && <span className="bk-nav-more">+{readerSpreads.length - 10}</span>}
                    </div>
                    <button
                      className={`bk-nav-btn bk-nav-next ${!hasNextSpread ? "disabled" : ""}`}
                      onClick={() => hasNextSpread && goSpread(1)}
                      disabled={!hasNextSpread}
                    >
                      <span>Next Page</span>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
                <div className="bk-nav-row">
                  <button
                    className={`bk-nav-btn bk-nav-prev ${!hasPrev ? "disabled" : ""}`}
                    onClick={() => hasPrev && goChapter(-1)}
                    disabled={!hasPrev}
                  >
                    <ChevronLeft size={18} />
                    <span>
                      {hasPrev
                        ? allChapters[currentChIdx - 1]?.title ?? "Previous"
                        : "First Chapter"}
                    </span>
                  </button>

                  {/* Chapter dots progress */}
                  <div className="bk-nav-dots">
                    {allChapters.slice(0, 8).map((_: any, i: number) => (
                      <button
                        key={i}
                        className={`bk-nav-dot ${i === currentChIdx ? "active" : ""}`}
                        onClick={() => setActiveChapter(allChapters[i])}
                      />
                    ))}
                    {allChapters.length > 8 && (
                      <span className="bk-nav-more">+{allChapters.length - 8}</span>
                    )}
                  </div>

                  <button
                    className={`bk-nav-btn bk-nav-next ${!hasNext ? "disabled" : ""}`}
                    onClick={() => hasNext && goChapter(1)}
                    disabled={!hasNext}
                  >
                    <span>
                      {hasNext
                        ? allChapters[currentChIdx + 1]?.title ?? "Next"
                        : "Last Chapter"}
                    </span>
                    <ChevronRight size={18} />
                  </button>
                </div>

                {/* Tip bar */}
                <div className="reader-tip-bar">
                  <Zap size={11} className="tip-bar-icon" />
                  <span>Select any text to highlight · explain · summarize · ask AI</span>
                </div>
              </div>
            </main>

            {/* Ask AI desktop panel */}
            <AnimatePresence>
              {isAiPanelOpen && (
                <>
                  <motion.aside
                    key="ai-panel-desktop"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 360, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: "easeInOut" }}
                    className="ai-panel-desktop glass"
                    style={{ minWidth: 0, overflow: "hidden" }}
                  >
                    <AskAIPanel
                      messages={aiMessages} isLoading={aiLoading}
                      pendingTag={pendingTag} inputValue={aiInput}
                      bookTitle={selectedBook?.title || ""} chapterTitle={activeChapter?.title || ""}
                      onSend={text => handleLiveAskAI(text, text, "Ask AI")}
                      setInputValue={setAiInput}
                      onTagDismiss={() => setPendingTag(null)}
                      onClose={() => setIsAiPanelOpen(false)}
                    />
                  </motion.aside>

                  <motion.div
                    key="ai-panel-mobile"
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "100%", opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="ai-panel-mobile glass"
                  >
                    <AskAIPanel
                      messages={aiMessages} isLoading={aiLoading}
                      pendingTag={pendingTag} inputValue={aiInput}
                      bookTitle={selectedBook?.title || ""} chapterTitle={activeChapter?.title || ""}
                      onSend={text => handleLiveAskAI(text, text, "Ask AI")}
                      setInputValue={setAiInput}
                      onTagDismiss={() => setPendingTag(null)}
                      onClose={() => setIsAiPanelOpen(false)}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            {/* Explain/Summarize panel */}
            <AnimatePresence>
              {isExplainPanelOpen && explainData && (
                <ExplainSummarizePanel
                  title={explainData.title}
                  content={explainData.content}
                  selectedText={explainData.selectedText}
                  isLoading={isExplainLoading}
                  onClose={() => setIsExplainPanelOpen(false)}
                />
              )}
            </AnimatePresence>

          </div>

          {isEnhancing && (
            <div className="overlay blur">
              <FunnyLoader />
            </div>
          )}

          {/* Quiz modal */}
          {isQuizOpen && (
            <div className="overlay">
              <div className="modal glass animate-pop">
                <h2>Knowledge Check</h2>
                <p>{QUIZ_DATA[activeChapter?.id]?.q}</p>
                <div className="opt-list">
                  {QUIZ_DATA[activeChapter?.id]?.opts.map((o, i) => (
                    <button key={i} className="opt-btn" onClick={() => {
                      const isCorrect = i === QUIZ_DATA[activeChapter.id].a;
                      if (isCorrect) { triggerToast("✅ Correct! Excellent understanding."); setIsQuizOpen(false); }
                      else triggerToast("❌ Incorrect. Review the chapter text!");
                    }}>{o}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Session summary */}
          {isSummaryOpen && (
            <div className="overlay">
              <div className="modal glass animate-pop">
                <div className="modal-close-row">
                  <button className="modal-x-btn" onClick={() => setIsSummaryOpen(false)}><X size={18} /></button>
                </div>
                <div className="medal">🏆</div>
                <h2>Session Complete</h2>
                <div className="stats">
                  <div><strong>{formatTime(timer)}</strong><br /><small>Time Read</small></div>
                </div>
                <button className="btn-premium full" onClick={() => {
                  setSelectedBook(null); setIsTocView(false); setIsSummaryOpen(false);
                  setTimer(0); setDisplayChapter(null); clearReaderState();
                }}>
                  Finish & Save
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <style>{libStyles + readerStyles}</style>
      {toast && <div className={`toast-notification ${toast.type} animate-pop`}>{toast.msg}</div>}

      {/* ══ INLINE HIGHLIGHTER — Edit / Delete modal ══ */}
      {editingHighlight && (
        <Dialog open={!!editingHighlight} onOpenChange={open => !open && setEditingHighlight(null)}>
          <DialogContent
            className="hl-dialog-content sm:max-w-[480px] p-0 overflow-hidden border-0 shadow-2xl"
            style={{
              background: "linear-gradient(145deg,#1e1b4b 0%,#0f172a 100%)",
              border: "1px solid rgba(139,92,246,.28)",
              borderRadius: 20,
              zIndex: 100000,
            }}
          >
            {/* Header */}
            <DialogHeader style={{ padding:"20px 24px 16px", borderBottom:"1px solid rgba(139,92,246,.15)" }}>
              <DialogTitle style={{
                fontSize:17, fontWeight:800,
                background:"linear-gradient(135deg,#a78bfa,#f472b6)",
                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
                display:"flex", alignItems:"center", gap:8,
              }}>
                <Edit3 size={16} style={{color:"#a78bfa"}}/>
                Edit Highlight
              </DialogTitle>
              <DialogDescription style={{fontSize:12, color:"rgba(167,139,250,.6)", marginTop:4}}>
                Change color, update your note, or delete this highlight.
              </DialogDescription>
            </DialogHeader>

            <div style={{padding:"16px 24px 20px", display:"flex", flexDirection:"column", gap:16}}>

              {/* Highlighted text preview */}
              <div>
                <div className="hl-label"><span style={{fontSize:12}}>✏️</span> Highlighted text</div>
                <div className="hl-quote-scroll">"{editingHighlight.text}"</div>
                <div style={{fontSize:10, color:"rgba(148,163,184,.45)", marginTop:4, textAlign:"right"}}>
                  {editingHighlight.text.length} characters
                </div>
              </div>

              {/* Color picker */}
              <div>
                <div className="hl-label"><span style={{fontSize:12}}>🎨</span> Highlight color</div>
                <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                  {HL_COLORS.map(c => (
                    <button
                      key={c.id}
                      title={c.label}
                      onClick={() => setEditedColor(c.id)}
                      style={{
                        width:28, height:28, borderRadius:8, border:"none", cursor:"pointer",
                        background:c.mark,
                        outline: editedColor === c.id ? "3px solid #fff" : "2px solid transparent",
                        outlineOffset:2,
                        boxShadow: editedColor === c.id ? "0 0 0 5px rgba(139,92,246,.5)" : "none",
                        transition:"all .15s",
                        transform: editedColor === c.id ? "scale(1.2)" : "scale(1)",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Note textarea */}
              <div>
                <div className="hl-label"><span style={{fontSize:12}}>📝</span> Your note (optional)</div>
                <textarea
                  className="hl-textarea"
                  value={editedComment}
                  onChange={e => setEditedComment(e.target.value)}
                  placeholder="Why is this passage important to you…?"
                />
              </div>

              {/* Buttons */}
              <div className="hl-footer">
                <button className="hl-btn-delete" onClick={() => {
                  setHighlights(prev => prev.filter(h => h.id !== editingHighlight.id));
                  setEditingHighlight(null);
                }}>
                  <Trash2 size={13}/> Delete
                </button>
                <button className="hl-btn-cancel" onClick={() => setEditingHighlight(null)}>
                  Cancel
                </button>
                <button className="hl-btn-save" onClick={() => {
                  setHighlights(prev => prev.map(h =>
                    h.id === editingHighlight.id
                      ? { ...h, comment: editedComment, color: editedColor }
                      : h
                  ));
                  setEditingHighlight(null);
                }}>
                  Save Changes ✦
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// ─── Context Menu — premium dashboard-matched floating toolbar ────────────────
interface ContextMenuFixedProps {
  viewportX: number;
  viewportY: number;
  selectedText: string;
  onClose: () => void;
  onHighlight: () => void;
  onAskAI: (prompt: string, text: string, label: "Explain" | "Summarize" | "Ask AI") => void;
}

const ContextMenuFixed = ({ viewportX, viewportY, selectedText, onClose, onHighlight, onAskAI }: ContextMenuFixedProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<React.CSSProperties>({ position:"fixed", opacity:0, top: viewportY + 14, left: viewportX, zIndex:99999 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width: mw, height: mh } = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = viewportX - mw / 2;
    let top  = viewportY + 14;
    if (left < 8)            left = 8;
    if (left + mw > vw - 8)  left = vw - mw - 8;
    if (top + mh > vh - 12)  top  = viewportY - mh - 14;
    if (top < 8)              top  = 8;
    setPos({ position:"fixed", top, left, opacity:1, zIndex:99999 });
  }, [viewportX, viewportY]);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  // Short preview shown inside the menu
  const preview = selectedText.length > 60
    ? selectedText.slice(0, 60).trimEnd() + "…"
    : selectedText;

  const actions: { label: string; emoji: string; color: string; bg: string; onClick: () => void }[] = [
    {
      label: "Highlight", emoji: "✏️",
      color: "#6366f1", bg: "rgba(99,102,241,.1)",
      onClick: () => { onHighlight(); onClose(); },
    },
    {
      label: "Explain", emoji: "🔍",
      color: "#8b5cf6", bg: "rgba(139,92,246,.1)",
      onClick: () => { onAskAI(`Explain this: "${selectedText}"`, selectedText, "Explain"); onClose(); },
    },
    {
      label: "Summarize", emoji: "📝",
      color: "#0ea5e9", bg: "rgba(14,165,233,.1)",
      onClick: () => { onAskAI(`Summarize: "${selectedText}"`, selectedText, "Summarize"); onClose(); },
    },
    {
      label: "Ask AI", emoji: "✨",
      color: "#ec4899", bg: "rgba(236,72,153,.1)",
      onClick: () => { onAskAI(selectedText, selectedText, "Ask AI"); onClose(); },
    },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity:0, scale:.88, y:-8 }}
      animate={{ opacity:1, scale:1,   y:0  }}
      exit={{    opacity:0, scale:.88, y:-8 }}
      transition={{ duration:.13, ease:"easeOut" }}
      style={pos}
      onMouseDown={e => e.stopPropagation()}
      className="ctx-menu"
    >
      {/* Upward caret */}
      <div className="ctx-caret" />

      {/* Action buttons only — no quote preview */}
      <div className="ctx-actions">
        {actions.map(a => (
          <button
            key={a.label}
            className="ctx-action-btn"
            style={{ "--ctx-color": a.color, "--ctx-bg": a.bg } as React.CSSProperties}
            onClick={a.onClick}
          >
            <span className="ctx-action-icon">{a.emoji}</span>
            <span className="ctx-action-label">{a.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// ── LIB STYLES — dashboard-matched library + TOC ─────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const libStyles = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

/* ── Root ── */
.lib-root {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  padding: 24px 28px;
  max-width: 1280px;
  margin: 0 auto;
  min-height: 100%;
}

/* The Base Button */
.bk-float-thunder:not(.locked) {
  position: relative;
  background: #020617;
  color: #fff;
  border: 1px solid #3b82f6;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  overflow: visible; /* Bolts need to "strike" outside the button */
  box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
}

/* Lightning Bolt Styling */
.bolt {
  position: absolute;
  background: #fff;
  width: 2px;
  height: 20px;
  opacity: 0;
  filter: drop-shadow(0 0 8px #60a5fa) blur(0.5px);
  z-index: 10;
}

/* Bolt Shapes using Clip-Path */
.bolt-1 {
  top: -15px; left: 20%;
  clip-path: polygon(50% 0%, 0% 50%, 40% 50%, 10% 100%, 100% 40%, 60% 40%);
}

.bolt-2 {
  bottom: -15px; right: 20%;
  clip-path: polygon(50% 0%, 0% 50%, 40% 50%, 10% 100%, 100% 40%, 60% 40%);
  transform: rotate(180deg);
}

/* The Lightning Strike Animation */
@keyframes lightning-strike {
  0%, 10%, 25%, 70%, 100% { opacity: 0; transform: scaleY(0); }
  11%, 24% { opacity: 1; transform: scaleY(1.2) skewX(-10deg); }
  12% { opacity: 0.2; }
  13% { opacity: 1; }
}

.bk-float-thunder:hover .bolt {
  animation: lightning-strike 1.5s infinite;
}

.bk-float-thunder:hover .bolt-2 {
  animation-delay: 0.4s; /* Staggered strikes */
}

/* Sparkle Icon Pulse */
.sparkle-icon {
  color: #60a5fa;
  filter: drop-shadow(0 0 5px #fff);
  margin-right: 8px;
}

.bk-float-thunder:hover .sparkle-icon {
  animation: pulse-glow 0.5s infinite alternate;
}

@keyframes pulse-glow {
  from { filter: drop-shadow(0 0 2px #60a5fa); transform: scale(1); }
  to { filter: drop-shadow(0 0 10px #fff); transform: scale(1.2); }
}

/* Locked state styling */
.bk-float-thunder.locked {
  background: #1e293b;
  border-color: #334155;
  color: #64748b;
  cursor: not-allowed;
  opacity: 0.7;
}
/* ═══════════════════════════ HERO ═══════════════════════════ */
.lib-hero {
  border-radius: 24px;
  padding: 32px 36px;
  margin-bottom: 28px;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  color: #fff;
  animation: libHeroIn .6s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes libHeroIn {
  from { opacity:0; transform:translateY(20px) scale(.97); }
  to   { opacity:1; transform:none; }
}
.lib-hero::before {
  content:''; position:absolute; top:-60px; right:-60px;
  width:260px; height:260px; border-radius:50%; background:rgba(255,255,255,.1);
}
.lib-hero::after {
  content:''; position:absolute; bottom:-80px; left:30%;
  width:180px; height:180px; border-radius:50%; background:rgba(255,255,255,.07);
}
.lib-hero-inner  { display:flex; align-items:center; justify-content:space-between; position:relative; z-index:1; gap:16px; }
.lib-hero-title  { font-size:clamp(20px,3vw,28px); font-weight:800; margin-bottom:6px; }
.lib-hero-sub    { font-size:14px; opacity:.75; max-width:420px; line-height:1.5; }
.lib-hero-right  { display:flex; align-items:center; gap:16px; flex-shrink:0; }
.lib-hero-stat   { text-align:center; }
.lib-hero-sn     { font-size:32px; font-weight:800; line-height:1; }
.lib-hero-sl     { font-size:12px; opacity:.65; margin-top:2px; white-space:nowrap; }
.lib-hero-div    { width:1px; height:50px; background:rgba(255,255,255,.2); }
.lib-hero-btn {
  padding:12px 24px; background:#fff; color:#6366f1; border:none; border-radius:14px;
  font-size:14px; font-weight:700; cursor:pointer; font-family:inherit;
  transition:all .2s; white-space:nowrap; box-shadow:0 4px 16px rgba(0,0,0,.15);
}
.lib-hero-btn:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.2); background:#f5f3ff; }

/* TOC hero additions */
.toc-hero { background: linear-gradient(135deg,#6366f1,#8b5cf6) !important; }
.toc-hero-subject {
  font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase;
  opacity:.7; margin-bottom:8px;
}
.toc-hero-cover {
  width:96px; height:128px; border-radius:18px; overflow:hidden; flex-shrink:0;
  border:1px solid rgba(255,255,255,.22);
  box-shadow:0 12px 28px rgba(15,23,42,.24);
}
.toc-hero-cover-image {
  width:100%; height:100%; object-fit:cover; display:block;
}

/* ═══════════════════════════ STAT MINI CARDS ═══════════════════════════ */
.lib-stats-row {
  display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:24px;
}
.lib-stat-card {
  background:#fff; border-radius:18px; padding:18px 20px;
  border:1px solid rgba(0,0,0,.06); box-shadow:0 2px 12px rgba(0,0,0,.05);
  transition:all .25s cubic-bezier(.4,0,.2,1); cursor:default;
  animation:libCardIn .5s cubic-bezier(.34,1.56,.64,1) both;
  display:flex; flex-direction:column; gap:4px;
}
.lib-stat-card:hover { transform:translateY(-4px); box-shadow:0 12px 32px rgba(0,0,0,.10); }
.dark .lib-stat-card { background:#1e1b4b; border-color:rgba(255,255,255,.08); }
.lib-stat-card.lib-stat-blue   { border-top:3px solid #6366f1; }
.lib-stat-card.lib-stat-indigo { border-top:3px solid #4f46e5; }
.lib-stat-card.lib-stat-purple { border-top:3px solid #8b5cf6; }
.lib-stat-card.lib-stat-green  { border-top:3px solid #10b981; }
.lib-stat-icon  { font-size:22px; margin-bottom:2px; }
.lib-stat-num   { font-size:28px; font-weight:800; color:#0f172a; letter-spacing:-1px; line-height:1; }
.dark .lib-stat-num { color:#e2e8f0; }
.lib-stat-label { font-size:12px; color:#64748b; font-weight:500; }

/* ═══════════════════════════ FILTER CHIPS ═══════════════════════════ */
.lib-filter-row { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:24px; }
.lib-chip {
  padding:8px 18px; border-radius:24px; border:1.5px solid #e2e8f0;
  background:#fff; font-size:13px; font-weight:600; color:#64748b;
  cursor:pointer; font-family:inherit; transition:all .2s;
}
.lib-chip:hover  { border-color:#6366f1; color:#6366f1; background:rgba(99,102,241,.05); }
.lib-chip.active {
  background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff;
  border-color:transparent; box-shadow:0 4px 14px rgba(99,102,241,.35);
}
.dark .lib-chip {
  background:#1e1b4b; border-color:rgba(255,255,255,.12); color:#94a3b8;
}
.dark .lib-chip:hover {
  background:rgba(99,102,241,.18); border-color:#6366f1; color:#a5b4fc;
}

/* ═══════════════════════════ BOOK GRID ═══════════════════════════ */
.lib-grid {
  display:grid; grid-template-columns:repeat(auto-fill,minmax(230px,1fr)); gap:18px;
}

/* ── Book card ── */
.lib-book-card {
  background:#fff; border-radius:20px; border:1px solid rgba(0,0,0,.06);
  box-shadow:0 2px 12px rgba(0,0,0,.05); overflow:hidden; cursor:pointer;
  transition:all .25s cubic-bezier(.4,0,.2,1);
  animation:libCardIn .5s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes libCardIn {
  from { opacity:0; transform:translateY(16px); }
  to   { opacity:1; transform:none; }
}
.lib-book-card:hover {
  transform:translateY(-6px) scale(1.01);
  box-shadow:0 16px 40px rgba(0,0,0,.12);
  border-color:#e0e7ff;
}
.dark .lib-book-card {
  background:#1e1b4b; border-color:rgba(255,255,255,.08);
}
.dark .lib-book-card:hover { border-color:#6366f1; }

/* Cover */
.lib-cover {
  position:relative; height:160px;
  display:flex; align-items:center; justify-content:center; overflow:hidden;
}
.lib-cover-image {
  position:absolute; inset:0;
  width:100%; height:100%;
  object-fit:cover; display:block;
}
.lib-cover-glare {
  position:absolute; top:0; left:0; right:0; height:50%;
  background:linear-gradient(180deg,rgba(255,255,255,.25),transparent);
}
.lib-cover-symbol {
  font-size:52px; position:relative; z-index:1;
  filter:drop-shadow(0 4px 12px rgba(0,0,0,.2));
}

/* Card info */
.lib-book-info { padding:16px; }
.lib-subject-tag {
  display:inline-block; font-size:11px; font-weight:700; padding:3px 10px;
  border-radius:20px; background:rgba(99,102,241,.1); color:#6366f1;
  margin-bottom:8px; letter-spacing:.3px; text-transform:uppercase;
}
.dark .lib-subject-tag { background:rgba(99,102,241,.2); color:#a5b4fc; }
.lib-book-title { font-size:14px; font-weight:700; color:#0f172a; margin:0 0 10px; line-height:1.35; }
.dark .lib-book-title { color:#e2e8f0; }
.lib-progress-bg   { height:6px; background:#f1f5f9; border-radius:6px; overflow:hidden; margin-bottom:4px; }
.dark .lib-progress-bg { background:rgba(255,255,255,.08); }
.lib-progress-fill { height:100%; border-radius:6px; transition:width .8s cubic-bezier(.4,0,.2,1); opacity:.85; }
.lib-progress-pct  { font-size:11px; color:#94a3b8; font-weight:600; margin-bottom:12px; }
.lib-card-footer { display:flex; align-items:center; justify-content:space-between; }
.lib-chapters    { font-size:12px; color:#94a3b8; font-weight:500; }
.lib-open-btn {
  padding:7px 16px; border-radius:10px; border:none; font-size:12px; font-weight:700;
  cursor:pointer; font-family:inherit; color:#fff;
  background:linear-gradient(135deg,#6366f1,#8b5cf6);
  box-shadow:0 4px 12px rgba(99,102,241,.35); transition:all .2s;
}
.lib-open-btn:hover { transform:translateY(-1px); box-shadow:0 6px 18px rgba(99,102,241,.45); }

/* ═══════════════════════════ TOC GRID ═══════════════════════════ */
.toc-grid {
  display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:18px;
}

/* ── TOC card ── */
.toc-card {
  background:#fff; border-radius:20px; border:1px solid rgba(0,0,0,.06);
  box-shadow:0 2px 12px rgba(0,0,0,.05); overflow:hidden;
  transition:all .25s cubic-bezier(.4,0,.2,1);
  animation:libCardIn .5s cubic-bezier(.34,1.56,.64,1) both;
  display:flex; flex-direction:column;
}
.toc-card:hover { transform:translateY(-5px); box-shadow:0 16px 40px rgba(0,0,0,.12); border-color:#e0e7ff; }
.dark .toc-card { background:#1e1b4b; border-color:rgba(255,255,255,.08); }
.dark .toc-card:hover { border-color:#6366f1; }

/* Accent strip */
.toc-card-accent {
  display:flex; align-items:center; gap:16px; padding:20px 22px;
  position:relative; overflow:hidden;
}
.toc-card-accent::before {
  content:''; position:absolute; top:-40px; right:-40px;
  width:140px; height:140px; border-radius:50%; background:rgba(255,255,255,.12);
}
.toc-card-accent::after {
  content:''; position:absolute; bottom:-50px; left:15%;
  width:100px; height:100px; border-radius:50%; background:rgba(255,255,255,.08);
}
.toc-unit-num {
  font-size:44px; font-weight:800; color:#fff; line-height:1;
  position:relative; z-index:1; letter-spacing:-2px; opacity:.9;
  flex-shrink:0;
}
.toc-unit-info  { display:flex; flex-direction:column; gap:2px; position:relative; z-index:1; min-width:0; }
.toc-unit-label { font-size:11px; font-weight:700; color:rgba(255,255,255,.65); text-transform:uppercase; letter-spacing:1.5px; }
.toc-unit-title { font-size:14px; font-weight:700; color:#fff; line-height:1.3; opacity:.9; }

/* Preview text */
.toc-card-preview-text {
  padding:14px 20px 10px;
  font-size:12.5px; color:#64748b; line-height:1.6;
  border-bottom:1px solid #f1f5f9;
}
.dark .toc-card-preview-text { color:#94a3b8; border-color:rgba(255,255,255,.07); }

/* Chapter list */
.toc-chapter-list {
  display:flex; flex-direction:column; padding:10px 12px 14px;
}
.toc-chapter-row {
  display:flex; align-items:center; gap:10px; padding:9px 10px;
  border-radius:11px; cursor:pointer; transition:all .18s; background:transparent;
}
.toc-chapter-row:hover { background:rgba(99,102,241,.07); transform:translateX(4px); }
.dark .toc-chapter-row:hover { background:rgba(99,102,241,.15); }
.toc-ch-num {
  font-size:11px; font-weight:700; color:#6366f1;
  background:rgba(99,102,241,.1); padding:3px 8px; border-radius:6px; flex-shrink:0;
}
.dark .toc-ch-num { background:rgba(99,102,241,.2); color:#a5b4fc; }
.toc-ch-title { font-size:12.5px; font-weight:500; color:#374151; flex:1; line-height:1.3; }
.dark .toc-ch-title { color:#cbd5e1; }
.toc-ch-arrow { font-size:14px; color:#94a3b8; flex-shrink:0; transition:all .18s; }
.toc-chapter-row:hover .toc-ch-arrow { transform:translateX(3px); color:#6366f1; }

/* ═══════════════════════════ RESPONSIVE ═══════════════════════════ */
@media (max-width:1024px) {
  .lib-stats-row { grid-template-columns:repeat(2,1fr); }
}
@media (max-width:768px) {
  .lib-root       { padding:16px; }
  .lib-hero       { padding:22px 20px; }
  .lib-hero-inner { flex-direction:column; align-items:flex-start; gap:16px; }
  .lib-hero-right { width:100%; flex-wrap:wrap; }
  .lib-stats-row  { grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:18px; }
  .lib-grid       { grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; }
  .lib-cover      { height:130px; }
  .lib-cover-symbol { font-size:40px; }
  .toc-grid       { grid-template-columns:1fr; }
}
@media (max-width:480px) {
  .lib-stats-row  { grid-template-columns:repeat(2,1fr); }
  .lib-grid       { grid-template-columns:1fr 1fr; }
  .lib-hero-right { gap:10px; }
}
`;

// ══════════════════════════════════════════════════════════════════════════════
// ── READER STYLES — all original reader/workstation styles ───────────────────
// ══════════════════════════════════════════════════════════════════════════════
const readerStyles = `
:root {
  --bg-app:#fcfcfd; --text-main:#0f172a; --text-muted:#64748b;
  --card-bg:rgba(255,255,255,0.8); --border:#f1f5f9; --accent:#6366f1;
  --shadow:0 10px 30px -10px rgba(0,0,0,0.04);
  --book-bg:#fff; --book-page-bg-left:#fdfdfd; --book-page-bg-right:#ffffff;
  --book-text-title:#111827; --book-text-chapter:#3b82f6;
  --book-text-footer:#9ca3af; --book-text-page-number:#111827;
  --book-border:#d1d5db;
  --deco-color-1:#60a5fa; --deco-color-2:#93c5fd;
  --deco-color-3:#3b82f6; --deco-color-4:#2563eb; --deco-accent-color:#1d4ed8;
  --glass:rgba(255,255,255,0.7);
}
.dark {
  --bg-app:#020617; --text-main:#f8fafc; --text-muted:#cbd5e1;
  --card-bg:rgba(15,23,42,0.6); --border:#1e293b;
  --shadow:0 10px 40px -15px rgba(0,0,0,0.4);
  --book-bg:#0b1120; --book-page-bg-left:#0f172a; --book-page-bg-right:#020617;
  --book-text-title:#f8fafc; --book-text-chapter:#93c5fd;
  --book-text-footer:#64748b; --book-text-page-number:#cbd5e1;
  --book-border:#334155;
  --deco-color-1:#1e40af; --deco-color-2:#1d4ed8;
  --deco-color-3:#2563eb; --deco-color-4:#3b82f6; --deco-accent-color:#93c5fd;
  --glass:rgba(15,23,42,0.75);
}

.app-root { min-height:100vh; background:var(--bg-app); color:var(--text-main); font-family:'Plus Jakarta Sans',-apple-system,sans-serif; transition:all 0.4s cubic-bezier(0.4,0,0.2,1); }

/* Toast */
.toast-notification { position:fixed; bottom:40px; left:50%; transform:translateX(-50%); padding:14px 28px; border-radius:16px; font-weight:700; z-index:9999; box-shadow:0 15px 30px rgba(0,0,0,0.2); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.1); color:white; }
.toast-notification.success { background:rgba(34,197,94,0.9); }
.toast-notification.error   { background:rgba(239,68,68,0.9); }

/* Workstation shell */
*{box-sizing:border-box;}
.glass { background:var(--glass); backdrop-filter:blur(20px); border:1px solid var(--border); border-radius:20px; }
.workstation { display:flex; height:100vh; padding:12px; gap:12px; overflow:hidden; background:var(--bg-app); }
.main-viewport { flex:1; display:flex; flex-direction:column; min-width:0; overflow:hidden; }
.scroll-canvas { flex:1; overflow-y:auto; position:relative; }
.scroll-canvas::-webkit-scrollbar { width:5px; }
.scroll-canvas::-webkit-scrollbar-thumb { background:rgba(99,102,241,.2); border-radius:99px; }
.nav-group-items { overflow-y:auto; flex:1; padding:0 0 8px; }
.nav-group-items::-webkit-scrollbar { width:3px; }
.nav-group-items::-webkit-scrollbar-thumb { background:rgba(99,102,241,.2); border-radius:3px; }
.btn-premium { background:var(--accent); color:white; border:none; padding:10px 20px; border-radius:12px; font-weight:600; cursor:pointer; box-shadow:0 5px 15px rgba(99,102,241,.2); transition:all 0.3s; }
.btn-premium:hover { transform:translateY(-2px); filter:brightness(1.1); }
.btn-premium.full { width:100%; }
.hamburger-btn { display:none; }
.sidebar-overlay { display:none; }
.focus-active .sidebar { width:0!important; overflow:hidden; padding:0; }

/* ══════════════════════════════════════════════════════════
   PREMIUM SIDEBAR — dashboard design tokens
   Font:  Plus Jakarta Sans
   Hero:  linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899)
   Cards: white · radius 18px · border rgba(0,0,0,.06)
   Accent:#6366f1  Purple:#8b5cf6  Body:#f8fafc
══════════════════════════════════════════════════════════ */
.sidebar {
  width: 272px;
  display: flex;
  flex-direction: column;
  gap: 0;
  flex-shrink: 0;
  overflow: hidden;
  background: #fff;
  border-radius: 20px;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 2px 12px rgba(0,0,0,.06);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}

/* ── Sidebar Hero ── */
.sb-hero {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #ec4899 100%);
  border-radius: 18px 18px 0 0;
  padding: 0;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}
.sb-hero::before {
  content: '';
  position: absolute; top: -40px; right: -40px;
  width: 130px; height: 130px; border-radius: 50%;
  background: rgba(255,255,255,.1); pointer-events: none;
}
.sb-hero::after {
  content: '';
  position: absolute; bottom: -50px; left: 20%;
  width: 100px; height: 100px; border-radius: 50%;
  background: rgba(255,255,255,.07); pointer-events: none;
}
.sb-hero-inner { padding: 18px 18px 16px; position: relative; z-index: 1; }
.sb-hero-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.sb-book-icon { font-size: 2rem; line-height: 1; filter: drop-shadow(0 2px 6px rgba(0,0,0,.2)); }
.sb-close-btn {
  width: 28px; height: 28px; border-radius: 8px;
  background: rgba(255,255,255,.2); border: 1.5px solid rgba(255,255,255,.3);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #fff; transition: background .18s;
}
.sb-close-btn:hover { background: rgba(255,255,255,.32); }
.sb-book-title {
  font-size: 13px; font-weight: 800; color: #fff;
  line-height: 1.25; margin-bottom: 3px; letter-spacing: -.1px;
}
.sb-book-subject {
  font-size: 11px; color: rgba(255,255,255,.7); font-weight: 500; margin-bottom: 12px;
}
.sb-progress-row { display: flex; align-items: center; gap: 8px; }
.sb-progress-bg {
  flex: 1; height: 5px; border-radius: 5px; background: rgba(255,255,255,.2); overflow: hidden;
}
.sb-progress-fill {
  height: 100%; border-radius: 5px;
  background: rgba(255,255,255,.85);
  transition: width .6s cubic-bezier(.4,0,.2,1);
}
.sb-progress-pct { font-size: 10px; font-weight: 700; color: rgba(255,255,255,.8); flex-shrink: 0; }

/* ── Back button ── */
.sb-back-btn {
  display: flex; align-items: center; gap: 7px;
  margin: 12px 12px 4px;
  padding: 9px 14px; border-radius: 12px;
  border: 1.5px solid #f1f5f9; background: #f8fafc;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 12.5px; font-weight: 600; color: #6366f1;
  cursor: pointer; transition: all .18s;
}
.sb-back-btn:hover { background: rgba(99,102,241,.08); border-color: #c7d2fe; }

/* ── Section label ── */
.sb-section-label {
  font-size: 10px; font-weight: 800; letter-spacing: .12em; color: #94a3b8;
  padding: 8px 18px 4px; text-transform: uppercase;
}

/* ── Unit group ── */
.sb-unit-group { margin: 0 10px 4px; }
.sb-unit-header {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 12px;
  cursor: pointer; transition: all .18s;
  user-select: none;
}
.sb-unit-header:hover { background: rgba(99,102,241,.06); }
.sb-unit-header.active { background: rgba(99,102,241,.08); }
.sb-unit-badge {
  width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
  background: rgba(99,102,241,.1); color: #6366f1;
  font-size: 10px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  transition: all .18s;
}
.sb-unit-header.active .sb-unit-badge {
  background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff;
}
.sb-unit-label {
  flex: 1; display:flex; flex-direction:column; gap:2px;
  font-size: 12.5px; font-weight: 700; color: #374151; min-width:0;
}
.sb-unit-label strong {
  display:block; font-size:11px; font-weight:800; letter-spacing:.08em;
  text-transform:uppercase; color:#6366f1;
}
.sb-unit-label small {
  display:block; font-size:12.5px; font-weight:700; color:#374151;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.sb-unit-header.active .sb-unit-label { color: #4f46e5; }
.sb-unit-header.active .sb-unit-label small { color: #4f46e5; }
.sb-unit-chevron {
  font-size: .65rem; color: #94a3b8;
  transition: transform .25s cubic-bezier(.4,0,.2,1);
  display: inline-block;
}
.sb-unit-chevron.open { transform: rotate(180deg); }

/* ── Chapters wrap (accordion) ── */
.sb-chapters-wrap {
  overflow: hidden; max-height: 0;
  transition: max-height .35s cubic-bezier(.4,0,.2,1);
  padding: 0 4px;
}
.sb-chapters-wrap.open { /* max-height set inline */ }

/* ── Chapter row ── */
.sb-chapter-row {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 10px; border-radius: 10px;
  cursor: pointer; transition: all .18s; position: relative;
  margin-bottom: 2px;
}
.sb-chapter-row:hover { background: rgba(99,102,241,.06); transform: translateX(3px); }
.sb-chapter-row.active {
  background: linear-gradient(135deg,rgba(99,102,241,.12),rgba(139,92,246,.08));
  border-left: 3px solid #6366f1;
  padding-left: 7px;
}
.sb-ch-num {
  font-size: 10px; font-weight: 800; color: #6366f1;
  background: rgba(99,102,241,.1); padding: 2px 7px; border-radius: 6px; flex-shrink: 0;
}
.sb-chapter-row.active .sb-ch-num { background: #6366f1; color: #fff; }
.sb-ch-title {
  font-size: 12px; font-weight: 500; color: #374151; flex: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sb-chapter-row.active .sb-ch-title { color: #4f46e5; font-weight: 600; }
.sb-ch-active-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #6366f1; flex-shrink: 0;
  box-shadow: 0 0 6px rgba(99,102,241,.4);
}

.dark .sidebar { background: #1e1b4b; border-color: rgba(255,255,255,.08); }
.dark .sb-back-btn { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.1); color: #a5b4fc; }
.dark .sb-unit-header:hover { background: rgba(99,102,241,.15); }
.dark .sb-unit-label { color: #cbd5e1; }
.dark .sb-unit-label strong { color: #a5b4fc; }
.dark .sb-unit-label small { color: #cbd5e1; }
.dark .sb-ch-title { color: #cbd5e1; }
.dark .sb-chapter-row:hover { background: rgba(99,102,241,.15); }

/* ══════════════════════════════════════════════════════════
   PREMIUM TOP BAR
══════════════════════════════════════════════════════════ */
.reader-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 20px; margin-bottom: 0;
  background: #fff;
  border-bottom: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 2px 8px rgba(0,0,0,.04);
  flex-shrink: 0; z-index: 20; position: relative;
}
.dark .reader-topbar { background: #1e1b4b; border-bottom-color: rgba(255,255,255,.08); }

.reader-topbar-left { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
.reader-hamburger {
  width: 34px; height: 34px; border-radius: 10px; border: 1.5px solid #f1f5f9;
  background: #f8fafc; cursor: pointer; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px; flex-shrink: 0; transition: all .18s;
}
.reader-hamburger:hover { border-color: #c7d2fe; background: rgba(99,102,241,.06); }
.reader-hamburger span { display: block; width: 15px; height: 1.5px; background: #64748b; border-radius: 2px; }
.dark .reader-hamburger { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1); }
.dark .reader-hamburger span { background: #94a3b8; }
.reader-topbar-info { min-width: 0; }
.reader-topbar-chapter {
  font-size: 12.5px; font-weight: 700; color: #374151;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: block; max-width: 460px;
}
.dark .reader-topbar-chapter { color: #cbd5e1; }

.reader-topbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.genius-top-strip {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  margin: 10px 16px 0;
  padding: 12px 14px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(99,102,241,.1), rgba(236,72,153,.08));
  border: 1px solid rgba(99,102,241,.14);
}
.genius-top-copy { display:flex; flex-direction:column; gap:3px; min-width:0; }
.genius-top-eyebrow {
  font-size:10px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:#6366f1;
}
.genius-top-copy strong { font-size:13px; color:#0f172a; }
.dark .genius-top-strip { background: linear-gradient(135deg, rgba(99,102,241,.18), rgba(139,92,246,.12)); border-color: rgba(129,140,248,.25); }
.dark .genius-top-copy strong { color:#e2e8f0; }

/* Ask AI pill button */
.rtb-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 24px; border: none; cursor: pointer;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 12.5px; font-weight: 700; position: relative;
  transition: all .2s cubic-bezier(.4,0,.2,1);
  white-space: nowrap;
}
.rtb-ai {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  box-shadow: 0 4px 14px rgba(99,102,241,.32);
}
.rtb-ai:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99,102,241,.45); }
.rtb-ai.active {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  box-shadow: 0 4px 14px rgba(99,102,241,.5), inset 0 1px 0 rgba(255,255,255,.15);
}
.rtb-badge {
  position: absolute; top: -5px; right: -5px;
  width: 17px; height: 17px; border-radius: 50%;
  background: #ec4899; color: #fff;
  font-size: 9px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  border: 2px solid #fff;
}

/* AI Enhanced — premium gold shimmer */
.rtb-enhanced {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
  box-shadow: 0 4px 14px rgba(245,158,11,.28);
}
.rtb-enhanced:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(245,158,11,.42); }
.rtb-enhanced.locked {
  background: linear-gradient(135deg, #94a3b8, #64748b);
  box-shadow: none; opacity: .75;
}
.rtb-enhanced:disabled { cursor: not-allowed; }
.rtb-lock { font-size: 11px; }

/* Icon-only button */
.rtb-icon-btn {
  width: 36px; height: 36px; border-radius: 12px;
  border: 1.5px solid #f1f5f9; background: #f8fafc;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #64748b; transition: all .18s;
}
.rtb-icon-btn:hover { border-color: #c7d2fe; color: #6366f1; background: rgba(99,102,241,.06); }
.dark .rtb-icon-btn { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1); color: #94a3b8; }

/* Tip bar */
.reader-tip-bar {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 20px; font-size: .68rem; color: var(--text-muted);
  border-top: 1px solid var(--border); margin-top: 4px;
}
.tip-bar-icon { color: var(--accent); flex-shrink: 0; }

/* ══ FLOATING BOOK BUTTONS — Ask AI + AI Enhanced inside book ══ */
.bk-float-btns {
  position: absolute;
  top: 44px;
  right: 16px;
  display: flex;
  flex-direction: row;   /* straight line side by side */
  align-items: center;
  gap: 8px;
  z-index: 30;
  pointer-events: auto !important;
  user-select: none;
}
.bk-float-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 20px; border: none; cursor: pointer;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 12px; font-weight: 700;
  position: relative; white-space: nowrap;
  transition: all .2s cubic-bezier(.4,0,.2,1);
  box-shadow: 0 3px 10px rgba(0,0,0,.14);
  pointer-events: auto !important;
}
.bk-float-ai {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
}
.bk-float-ai:hover  { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(99,102,241,.42); }
.bk-float-ai.active { background: linear-gradient(135deg, #4f46e5, #7c3aed); box-shadow: 0 4px 14px rgba(79,70,229,.5); }
.bk-float-enhanced {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
}
.bk-float-enhanced:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 18px rgba(245,158,11,.4); }
.bk-float-enhanced.locked {
  background: linear-gradient(135deg, #94a3b8, #64748b);
  box-shadow: none; opacity: .7;
}
.bk-float-enhanced:disabled { cursor: not-allowed; transform: none !important; }
.bk-float-badge {
  position: absolute; top: -4px; right: -4px;
  width: 15px; height: 15px; border-radius: 50%;
  background: #ec4899; color: #fff; border: 2px solid #fff;
  font-size: 8px; font-weight: 900;
  display: flex; align-items: center; justify-content: center;
}
.bk-float-lock { font-size: 10px; }

/* On mobile ≤900px — icon only, still in a row */
@media (max-width: 900px) {
  .bk-float-btns { top: 36px; right: 10px; gap: 6px; }
  .bk-float-btn  { padding: 7px 10px; }
  .bk-float-btn > span:not(.bk-float-badge):not(.bk-float-lock) { display: none; }
}

/* ══ INLINE HIGHLIGHTER — Word-doc style dialogs ══ */
.hl-dialog-content {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
.hl-dialog-content * { font-family: inherit; box-sizing: border-box; }
.hl-quote-scroll {
  max-height: 110px; overflow-y: auto;
  background: rgba(139,92,246,.08);
  border: 1px solid rgba(139,92,246,.2);
  border-left: 3px solid #8b5cf6;
  border-radius: 0 10px 10px 0;
  padding: 10px 14px;
  font-size: 13px; font-style: italic; color: rgba(221,214,254,.88); line-height: 1.65;
  scrollbar-width: thin; scrollbar-color: rgba(139,92,246,.4) transparent;
}
.hl-quote-scroll::-webkit-scrollbar { width: 4px; }
.hl-quote-scroll::-webkit-scrollbar-thumb { background: rgba(139,92,246,.4); border-radius: 4px; }
.hl-label {
  font-size: 10.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .08em; color: rgba(167,139,250,.7);
  display: flex; align-items: center; gap: 6px; margin-bottom: 7px;
}
.hl-textarea {
  width: 100%; min-height: 88px;
  padding: 10px 14px; border-radius: 12px;
  border: 1.5px solid rgba(139,92,246,.25);
  background: rgba(255,255,255,.05); color: #fff;
  font-size: 13.5px; resize: none; outline: none; line-height: 1.6;
  transition: border .18s, box-shadow .18s;
}
.hl-textarea:focus { border-color: rgba(139,92,246,.6); box-shadow: 0 0 0 3px rgba(139,92,246,.12); }
.hl-textarea::placeholder { color: rgba(167,139,250,.38); }
.hl-footer { display: flex; align-items: center; gap: 8px; padding-top: 4px; }
.hl-btn-delete {
  display: flex; align-items: center; gap: 6px;
  padding: 9px 14px; border-radius: 12px;
  border: 1.5px solid rgba(239,68,68,.3); background: none; cursor: pointer;
  color: #f87171; font-size: 12.5px; font-weight: 700;
  transition: all .18s;
}
.hl-btn-delete:hover { background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.5); color: #ef4444; }
.hl-btn-cancel {
  padding: 9px 16px; border-radius: 12px;
  border: 1.5px solid rgba(139,92,246,.25); background: none; cursor: pointer;
  color: rgba(167,139,250,.8); font-size: 12.5px; font-weight: 600;
  transition: all .18s;
}
.hl-btn-cancel:hover { background: rgba(139,92,246,.1); }
.hl-btn-save {
  flex: 1; padding: 9px 16px; border-radius: 12px;
  border: none; cursor: pointer;
  background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff;
  font-size: 12.5px; font-weight: 800;
  box-shadow: 0 4px 14px rgba(99,102,241,.32); transition: all .2s;
  text-align: center;
}
.hl-btn-save:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99,102,241,.45); }

/* ── Highlight wrap + tooltip (Word-doc hover) ── */
.reader-highlight-wrap {
  position: relative;
  display: inline;
  pointer-events: auto !important;
  cursor: pointer;
}

/* The mark itself */
.reader-highlight-wrap mark.reader-highlight {
  cursor: pointer;
  transition: background .15s, border-bottom-color .15s;
}
.reader-highlight-wrap:hover mark.reader-highlight {
  background: rgba(99,102,241,.3);
  border-bottom-color: rgba(99,102,241,.85);
}

/* ── Tooltip bubble ── */
.hl-tooltip {
  visibility: hidden; opacity: 0; pointer-events: none;
  position: absolute;
  bottom: calc(100% + 10px); left: 50%;
  transform: translateX(-50%) translateY(6px);
  min-width: 140px; max-width: 240px;
  background: #1e1b4b; color: #e2e8f0;
  font-size: 11.5px; font-weight: 500; font-style: normal; line-height: 1.55;
  padding: 8px 12px; border-radius: 10px;
  border: 1px solid rgba(139,92,246,.4);
  box-shadow: 0 8px 24px rgba(0,0,0,.32);
  white-space: normal; word-break: break-word; text-align: left;
  z-index: 9999;
  transition: opacity .18s ease, transform .18s ease, visibility .18s;
  display: flex; align-items: flex-start; gap: 7px;
}
.hl-tooltip-dot {
  width: 10px; height: 10px; border-radius: 50%;
  flex-shrink: 0; margin-top: 2px;
  box-shadow: 0 1px 4px rgba(0,0,0,.3);
}
.hl-tooltip::after {
  content: '';
  position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
  border: 6px solid transparent; border-top-color: #1e1b4b;
}
.reader-highlight-wrap:hover .hl-tooltip {
  visibility: visible; opacity: 1; transform: translateX(-50%) translateY(0);
}
.dark .hl-tooltip { background: #1e1b4b; border-color: rgba(139,92,246,.5); }
.dark .hl-tooltip::after { border-top-color: #1e1b4b; }

/* Remove old static mark colour — colour applied inline per highlight */
mark.reader-highlight {
  color: inherit; cursor: pointer;
  user-select: text; -webkit-user-select: text;
}
mark.reader-highlight:hover { filter: brightness(1.15); }
.ctx-menu {
  position: fixed;
  z-index: 99999;
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,.08);
  box-shadow: 0 12px 40px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08);
  padding: 12px;
  min-width: 220px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  user-select: none;
}
.dark .ctx-menu {
  background: #1e1b4b;
  border-color: rgba(255,255,255,.12);
  box-shadow: 0 12px 40px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.3);
}
.ctx-caret {
  position: absolute; top: -7px; left: 50%; transform: translateX(-50%);
  width: 14px; height: 14px; background: #fff; border: 1px solid rgba(0,0,0,.08);
  border-right: none; border-bottom: none;
  transform: translateX(-50%) rotate(45deg);
  border-radius: 3px 0 0 0;
  pointer-events: none;
}
.dark .ctx-caret { background: #1e1b4b; border-color: rgba(255,255,255,.12); }

.ctx-actions {
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px;
}
.ctx-action-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 11px; border-radius: 10px;
  border: 1.5px solid transparent;
  background: var(--ctx-bg);
  cursor: pointer; transition: all .15s;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 12px; font-weight: 700; color: var(--ctx-color);
}
.ctx-action-btn:hover {
  border-color: var(--ctx-color);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,.1);
}
.ctx-action-icon { font-size: 14px; line-height: 1; flex-shrink: 0; }
.ctx-action-label { line-height: 1; }

/* ══ Ask AI panel — desktop side panel ══ */
.ai-panel-desktop {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: 360px; max-width: 100vw;
  z-index: 200; display: none; height: 100%;
  border-left: 1px solid rgba(0,0,0,.06);
}
.ai-panel-mobile {
  display: none; position: fixed; inset-x: 0; bottom: 0;
  z-index: 200; height: 72dvh;
  border-radius: 24px 24px 0 0; flex-direction: column;
}
@media(min-width:769px) { .ai-panel-desktop{display:flex;} .ai-panel-mobile{display:none!important;} }
@media(max-width:768px) { .ai-panel-desktop{display:none!important;} .ai-panel-mobile{display:flex;} }

/* Explain panel */
.explain-panel {
  position: fixed; top: 60px; right: 16px; bottom: 16px; width: 360px; max-width: 90vw;
  z-index: 201; display: flex; flex-direction: column; gap: 0; padding: 0;
  box-shadow: 0 20px 60px rgba(0,0,0,.2); border-radius: 20px; overflow: hidden;
  border: 1px solid rgba(0,0,0,.06);
}
.explain-panel .lab-body { flex: 1; overflow-y: auto; padding: 18px; }
.ai-card { background: rgba(99,102,241,.05); padding: 20px; border-radius: 14px; border: 1px solid rgba(99,102,241,.2); line-height: 1.7; font-size: 0.88rem; }
.lab-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; border-bottom: 1px solid var(--border);
  background: linear-gradient(135deg, rgba(99,102,241,.06), rgba(139,92,246,.04));
  flex-shrink: 0;
}
.lab-head h3 { font-size: .9rem; font-weight: 800; color: var(--text-main); margin: 0; }
.lab-head button { background: transparent; border: none; font-size: 1.1rem; cursor: pointer; color: var(--text-muted); border-radius: 8px; padding: 4px 8px; transition: all .15s; }
.lab-head button:hover { background: rgba(239,68,68,.1); color: #ef4444; }

/* Ask AI panel inner */
.ask-ai-panel { display:flex; flex-direction:column; height:100%; background:var(--bg-app); border-radius: inherit; overflow: hidden; }
.ask-ai-header {
  display:flex; align-items:center; justify-content:space-between;
  padding: 14px 16px; border-bottom:1px solid var(--border); flex-shrink:0;
  background: linear-gradient(135deg,rgba(99,102,241,.07),rgba(139,92,246,.05));
}
.ask-ai-header-left { display:flex; align-items:center; gap:10px; }
.ask-ai-bot-icon {
  width:34px; height:34px; border-radius:12px;
  background: linear-gradient(135deg,#6366f1,#8b5cf6);
  display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0;
  box-shadow: 0 4px 12px rgba(99,102,241,.3);
}
.ask-ai-title { font-size:.87rem; font-weight:800; color:var(--text-main); line-height:1; font-family:'Plus Jakarta Sans',system-ui,sans-serif; }
.ask-ai-subtitle { font-size:.67rem; color:var(--accent); margin-top:2px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; }
.ask-ai-close {
  width:30px; height:30px; border-radius:9px; border:none; background:transparent;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  color:var(--text-muted); transition:all .15s;
}
.ask-ai-close:hover { background:rgba(239,68,68,.1); color:#ef4444; }

.ask-ai-messages { flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:14px; min-height:0; }
.ask-ai-messages::-webkit-scrollbar { width:3px; }
.ask-ai-messages::-webkit-scrollbar-thumb { background:rgba(99,102,241,.25); border-radius:3px; }

.ask-ai-empty { display:flex; flex-direction:column; align-items:center; text-align:center; padding:40px 16px; gap:10px; }
.ask-ai-empty-icon {
  width:52px; height:52px; border-radius:16px;
  background: linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.1));
  display:flex; align-items:center; justify-content:center; color:var(--accent);
  border: 1px solid rgba(99,102,241,.15);
}
.ask-ai-empty-title { font-size:.88rem; font-weight:700; color:var(--text-main); }
.ask-ai-empty-sub { font-size:.75rem; color:var(--text-muted); line-height:1.55; }

.ask-ai-msg-row { display:flex; gap:8px; }
.ask-ai-msg-row.user { flex-direction:row-reverse; }
.ask-ai-avatar { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; }
.ask-ai-avatar.user { background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff; }
.ask-ai-avatar.assistant { background:var(--card-bg); color:var(--text-muted); border:1px solid var(--border); }
.ask-ai-bubble-col { display:flex; flex-direction:column; gap:4px; max-width:84%; }
.ask-ai-msg-row.user .ask-ai-bubble-col { align-items:flex-end; }
.ask-ai-msg-row.assistant .ask-ai-bubble-col { align-items:flex-start; }
.ask-ai-quote { display:flex; align-items:flex-start; gap:6px; background:rgba(245,158,11,.07); border:1px solid rgba(245,158,11,.2); border-radius:10px; padding:8px 10px; max-width:100%; }
.ask-ai-quote-icon { color:#f59e0b; flex-shrink:0; margin-top:1px; }
.ask-ai-quote-text { font-size:.68rem; color:#b45309; line-height:1.5; }
.dark .ask-ai-quote-text { color:#fbbf24; }
.ask-ai-bubble { border-radius:16px; padding:10px 14px; font-size:.8rem; line-height:1.65; font-family:'Plus Jakarta Sans',system-ui,sans-serif; }
.ask-ai-bubble.user { background:linear-gradient(135deg,#6366f1,#7c3aed); color:#fff; border-radius:16px 16px 4px 16px; box-shadow:0 4px 14px rgba(99,102,241,.3); }
.ask-ai-bubble.assistant { background:var(--card-bg); border:1px solid var(--border); color:var(--text-main); border-radius:16px 16px 16px 4px; box-shadow:0 2px 8px rgba(0,0,0,.05); }
.ask-ai-time { font-size:.6rem; color:var(--text-muted); padding:0 4px; }
.ask-ai-dot { display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--accent); animation:dotBounce .9s infinite; }
@keyframes dotBounce { 0%,100%{transform:translateY(0);opacity:.4} 50%{transform:translateY(-5px);opacity:1} }

.ask-ai-pending-tag { margin:0 12px 6px; display:flex; align-items:flex-start; gap:8px; background:rgba(245,158,11,.07); border:1px solid rgba(245,158,11,.2); border-radius:11px; padding:9px 11px; flex-shrink:0; }
.ask-ai-pending-icon { color:#f59e0b; flex-shrink:0; margin-top:2px; }
.ask-ai-pending-body { flex:1; min-width:0; }
.ask-ai-pending-label { font-size:.63rem; font-weight:800; color:#d97706; text-transform:uppercase; letter-spacing:.05em; margin-bottom:2px; }
.dark .ask-ai-pending-label { color:#fbbf24; }
.ask-ai-pending-text { font-size:.7rem; color:#92400e; line-height:1.5; }
.dark .ask-ai-pending-text { color:#fde68a; }
.ask-ai-pending-dismiss { color:#f59e0b; background:none; border:none; cursor:pointer; padding:0; flex-shrink:0; margin-top:1px; }

.ask-ai-input-row { display:flex; gap:8px; align-items:flex-end; padding:10px 12px; border-top:1px solid var(--border); flex-shrink:0; }
.ask-ai-textarea {
  flex:1; resize:none; border-radius:12px; border:1.5px solid var(--border);
  background:var(--card-bg); color:var(--text-main); font-size:.8rem;
  padding:9px 12px; outline:none; min-height:38px; max-height:112px; overflow-y:auto;
  transition:border .18s; font-family:'Plus Jakarta Sans',system-ui,sans-serif;
}
.ask-ai-textarea:focus { border-color:var(--accent); box-shadow:0 0 0 3px rgba(99,102,241,.1); }
.ask-ai-textarea::placeholder { color:var(--text-muted); }
.ask-ai-send {
  width:36px; height:36px; flex-shrink:0; border-radius:11px;
  background:linear-gradient(135deg,#6366f1,#8b5cf6); border:none;
  cursor:pointer; display:flex; align-items:center; justify-content:center;
  color:#fff; transition:all .18s; box-shadow:0 4px 10px rgba(99,102,241,.28);
}
.ask-ai-send:disabled { opacity:.3; cursor:not-allowed; box-shadow:none; }
.ask-ai-send:not(:disabled):hover { transform:scale(1.07); box-shadow:0 6px 14px rgba(99,102,241,.4); }
.ask-ai-hint { text-align:center; font-size:.6rem; color:var(--text-muted); padding:0 12px 8px; flex-shrink:0; }

/* typing indicator */
.typing-container { display:flex; gap:4px; align-items:center; background:var(--card-bg); border:1px solid var(--border); border-radius:16px 16px 16px 4px; padding:12px 14px; }
.typing-dot { width:7px; height:7px; border-radius:50%; background:var(--accent); animation:dotBounce .9s infinite; }
.typing-dot:nth-child(2) { animation-delay:.2s; }
.typing-dot:nth-child(3) { animation-delay:.4s; }

/* ═══════════════════════════════════════════════════════════
   OPEN-BOOK MAGAZINE SPREAD
   ─────────────────────────────────────────────────────────
   Visual : two equal pages side-by-side, like the reference
            image — thin vertical spine, top/bottom bars, two
            columns of flowing text.
   DOM    : ONE .bk-body div contains every paragraph, styled
            with CSS column-count:2 on desktop. The browser
            flows text into both columns; no DOM boundary.
   Select : only .reader-paragraph has user-select:text.
            Everything else (.no-select) is unselectable.
═══════════════════════════════════════════════════════════ */

/* Outer wrapper — provides 3D perspective tilt */
.book-container-wrapper {
  width: 100%;
  padding: 2rem 1.5rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  perspective: 2400px;
  perspective-origin: 50% 38%;
}

/* ── The spread wrapper — holds embossing layers + sheet ── */
.book-spread {
  width: 100%;
  max-width: 1160px;
  position: relative;
  transform: rotateX(1.8deg);
  transform-origin: center top;
  transition: opacity .4s ease;
}
.book-spread.flipping-next { animation: bkFlipNext .55s ease both; }
.book-spread.flipping-prev { animation: bkFlipPrev .55s ease both; }
@keyframes bkFlipNext {
  0%   { opacity:1; transform:rotateX(1.8deg) rotateY(0deg); }
  40%  { opacity:0; transform:rotateX(1.8deg) rotateY(-7deg) scaleX(.97); }
  60%  { opacity:0; transform:rotateX(1.8deg) rotateY( 5deg) scaleX(.97); }
  100% { opacity:1; transform:rotateX(1.8deg) rotateY(0deg); }
}
@keyframes bkFlipPrev {
  0%   { opacity:1; transform:rotateX(1.8deg) rotateY(0deg); }
  40%  { opacity:0; transform:rotateX(1.8deg) rotateY( 7deg) scaleX(.97); }
  60%  { opacity:0; transform:rotateX(1.8deg) rotateY(-5deg) scaleX(.97); }
  100% { opacity:1; transform:rotateX(1.8deg) rotateY(0deg); }
}

/* ── Embossing / depth layers ── */
/* Left stacked pages */
.book-shadow-left {
  position: absolute; top: 6px; bottom: 6px; left: -14px; width: 14px;
  background: linear-gradient(to right, #bbb 0%, #ccc 40%, #e0e0e0 100%);
  border-radius: 3px 0 0 3px;
  box-shadow: -3px 0 8px rgba(0,0,0,.18);
  pointer-events: none;
}
.dark .book-shadow-left {
  background: linear-gradient(to right, #1a1a2e 0%, #252540 100%);
}
/* Right stacked pages */
.book-shadow-right {
  position: absolute; top: 6px; bottom: 6px; right: -14px; width: 14px;
  background: linear-gradient(to left, #bbb 0%, #ccc 40%, #e0e0e0 100%);
  border-radius: 0 3px 3px 0;
  box-shadow: 3px 0 8px rgba(0,0,0,.18);
  pointer-events: none;
}
.dark .book-shadow-right {
  background: linear-gradient(to left, #1a1a2e 0%, #252540 100%);
}
/* Soft desk reflection glow below the book */
.book-desk-glow {
  position: absolute; bottom: -24px; left: 8%; right: 8%; height: 28px;
  background: radial-gradient(ellipse at center, rgba(0,0,0,.18) 0%, transparent 80%);
  filter: blur(10px);
  pointer-events: none;
}

/* ── The paper sheet ── */
.book-sheet {
  background: var(--book-bg);
  border-radius: 3px;
  /* Inner shadow simulates paper depth */
  box-shadow:
    inset 0 2px 8px rgba(0,0,0,.06),
    inset 0 -2px 8px rgba(0,0,0,.04),
    0 2px 40px rgba(0,0,0,.18);
  position: relative;
  /* No overflow:hidden — floating buttons (.bk-float-btns) must not be clipped */
}
.book-sheet-paged {
  display: flex;
  flex-direction: column;
  min-height: 78vh;
}
.dark .book-sheet {
  box-shadow:
    inset 0 2px 12px rgba(0,0,0,.3),
    inset 0 -2px 8px rgba(0,0,0,.2),
    0 2px 40px rgba(0,0,0,.5);
}

/* ── TOP BAR ── */
.bk-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 40px;
  border-bottom: 1px solid var(--border);
  background: rgba(0,0,0,.018);
  position: relative;
}
.dark .bk-topbar { background: rgba(255,255,255,.025); }
.bk-topbar-left, .bk-topbar-right {
  font-size: .6rem; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; color: var(--text-muted); opacity: .7;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%;
}
.bk-topbar-spine-mark {
  width: 1px; height: 14px;
  background: var(--border);
}

/* ── CENTRE SPINE LINE ── */
.bk-spine {
  position: absolute;
  top: 0; bottom: 0;
  left: calc(50% - 1px);
  width: 2px;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    var(--border) 8%,
    var(--border) 92%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 4;
}
/* Subtle shadow on each side of spine */
.bk-spine::before {
  content: '';
  position: absolute; inset: 0;
  box-shadow: -3px 0 8px rgba(0,0,0,.07), 3px 0 8px rgba(0,0,0,.07);
}

/* ── CHAPTER HEADER — sits in the first column only ── */
.bk-chapter-header {
  padding: 36px 40px 20px;
  /* Occupies full width above the two-column body */
}
.bk-ch-eyebrow {
  font-size: .62rem; font-weight: 800; letter-spacing: 3px;
  text-transform: uppercase; color: var(--accent); display: block; margin-bottom: 8px;
}
.bk-ch-title {
  font-size: clamp(1.5rem, 3vw, 2.4rem);
  font-weight: 800; color: var(--book-text-title);
  line-height: 1.15; letter-spacing: -.5px; margin: 0 0 16px;
  /* Only spans the LEFT column on desktop so right column starts with body text */
  max-width: calc(50% - 28px);
}
.bk-ch-subtitle {
  margin: -4px 0 12px;
  max-width: calc(50% - 28px);
  font-size: .98rem;
  font-weight: 600;
  line-height: 1.55;
  color: var(--text-muted);
}
.bk-ch-rule {
  width: 48px; height: 3px;
  background: linear-gradient(90deg, var(--accent), transparent);
  border-radius: 2px; margin-bottom: 4px;
}

/* ── UNIT INTRO ── */
.bk-unit-intro {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 80px 40px;
  min-height: 60vh;
}
.bk-unit-num {
  font-size: 8rem; font-weight: 900; line-height: 1;
  color: var(--accent); opacity: .18; letter-spacing: -6px;
}
.bk-unit-label {
  font-size: 1.5rem; font-weight: 800; color: var(--book-text-title); margin-top: 12px;
}
.bk-unit-name {
  margin-top: 10px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-muted);
  text-align: center;
  max-width: 420px;
  line-height: 1.5;
}

/* ── BODY — two CSS columns, one DOM element ── */
.bk-pages-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  min-height: 62vh;
}
.bk-pages-shell.single {
  grid-template-columns: 1fr;
}
.bk-page-surface {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 62vh;
  padding: 0 28px 42px;
}
.bk-page-surface.left {
  border-right: 1px solid var(--border);
}
.bk-pages-shell.single .bk-page-surface.left,
.bk-page-surface.right {
  border-right: none;
}
.bk-page-inner {
  flex: 1;
  color: var(--text-main);
  font-size: .97rem;
  line-height: 1.85;
  transition: opacity .25s;
  user-select: text;
  -webkit-user-select: text;
}
.bk-page-number {
  padding-top: 10px;
  text-align: right;
  font-size: .7rem;
  font-weight: 700;
  letter-spacing: .12em;
  color: var(--text-muted);
}
.bk-page-empty {
  margin: auto;
  color: var(--text-muted);
  font-size: .92rem;
}
.bk-spread-row {
  padding-top: 16px;
}

/* ── Only paragraph text is selectable ── */
.reader-paragraph {
  font-size: .97rem;
  line-height: 1.85;
  margin-bottom: 1rem;
  text-align: left;
  hyphens: none;
  word-break: normal;
  overflow-wrap: normal;
  white-space: normal;
  color: var(--text-main);
  break-inside: avoid-column;    /* keep a paragraph on one column if possible */
  user-select: text;
  -webkit-user-select: text;
}

/* no-select: only blocks text selection, NOT pointer clicks */
.no-select {
  user-select: none !important;
  -webkit-user-select: none !important;
  /* Do NOT set pointer-events:none here — it would break button clicks */
}
/* Only truly non-interactive elements get pointer-events:none */
.bk-topbar, .bk-footer, .bk-chapter-header, .bk-unit-intro {
  pointer-events: none;
}
/* Restore pointer-events for interactive wrappers that use no-select */
.bk-nav-btn, .bk-nav-dot, .bk-float-btns, .bk-float-btn,
.reader-highlight-wrap { pointer-events: auto !important; }

.reader-h1 {
  font-size: 1.6rem; font-weight: 800; color: var(--book-text-title);
  margin: 2rem 0 .75rem; line-height: 1.18; letter-spacing: -.35px;
  column-span: all;              /* big H1 spans both columns like a section break */
}
.reader-h2 {
  font-size: 1.22rem; font-weight: 800; color: var(--book-text-title);
  margin: 1.7rem 0 .65rem; line-height: 1.25;
}
.reader-h3 {
  font-size: 1rem; font-weight: 700; color: var(--accent);
  margin: 1.35rem 0 .45rem; line-height: 1.35;
  border-left: 3px solid var(--accent); padding-left: 11px;
}

.reader-list {
  margin: 0 0 1rem 1.2rem;
  padding: 0;
  color: var(--text-main);
  break-inside: avoid-column;
}
.reader-list-item {
  margin-bottom: .45rem;
  line-height: 1.7;
}
.reader-formula {
  margin: 1rem 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgba(99,102,241,.08);
  border: 1px solid rgba(99,102,241,.16);
  color: var(--text-main);
  font-size: .9rem;
  white-space: pre-wrap;
  break-inside: avoid-column;
}
.reader-table-wrap {
  overflow-x: auto;
  margin: 1rem 0;
  break-inside: avoid-column;
}
.reader-table {
  width: 100%;
  border-collapse: collapse;
  font-size: .86rem;
  background: rgba(255,255,255,.68);
}
.reader-table th,
.reader-table td {
  border: 1px solid var(--border);
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}
.reader-html-block {
  break-inside: avoid-column;
}

/* mark.reader-highlight — colour applied inline per highlight (see applyHighlights) */

/* ── Figures — NOT selectable, break cleanly ── */
.reader-figure {
  margin: 20px 0;
  break-inside: avoid-column;
}
.reader-figure-img-wrap {
  border-radius: 7px; overflow: hidden;
  border: 1px solid var(--border);
  box-shadow: 0 3px 12px rgba(0,0,0,.09);
}
.reader-figure-img {
  width:100%; display:block; pointer-events:none; -webkit-user-drag:none;
  max-height: 320px; object-fit: contain; background: rgba(99,102,241,.03);
}
.reader-figure-fallback {
  min-height: 180px;
  display:flex; align-items:center; justify-content:center;
  padding:16px; text-align:center;
  background:linear-gradient(135deg, rgba(99,102,241,.08), rgba(139,92,246,.08));
  color:var(--text-muted); font-size:.86rem; font-weight:600;
}
.reader-figcaption {
  font-size: .75rem; color: var(--text-muted);
  text-align: center; margin-top: 6px; font-style: italic;
}

/* ── FOOTER BAR ── */
.bk-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 40px;
  border-top: 1px solid var(--border);
  background: rgba(0,0,0,.018);
}
.dark .bk-footer { background: rgba(255,255,255,.025); }
.bk-footer-left, .bk-footer-right {
  font-size: .6rem; font-weight: 700; letter-spacing: 2px;
  text-transform: uppercase; color: var(--text-muted); opacity: .7;
}
.bk-footer-dots { display:flex; gap:5px; align-items:center; }
.bk-footer-dots span {
  width:4px; height:4px; border-radius:50%;
  background: var(--accent); opacity: .4;
  display: block;
}
.bk-footer-dots span:nth-child(2) { opacity:.65; }
.bk-footer-dots span:nth-child(3) { opacity:.9; }

/* ── PREV / NEXT NAV ROW ── */
.bk-nav-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 20px 0 8px;
  width: 100%; max-width: 1160px;
}
.bk-nav-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 11px 20px; border-radius: 14px;
  border: 1.5px solid var(--border);
  background: var(--book-bg);
  color: var(--text-main);
  font-family: inherit; font-size: .82rem; font-weight: 600;
  cursor: pointer; transition: all .18s;
  max-width: 260px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.bk-nav-btn:hover:not(.disabled) {
  border-color: var(--accent); color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(99,102,241,.15);
}
.bk-nav-btn.disabled { opacity: .3; cursor: not-allowed; }
.bk-nav-btn span { overflow:hidden; text-overflow:ellipsis; min-width:0; }
.bk-nav-next { flex-direction: row-reverse; }

/* Chapter dots */
.bk-nav-dots { display:flex; gap:6px; align-items:center; flex-shrink:0; }
.bk-nav-dot {
  width:8px; height:8px; border-radius:50%;
  background: var(--border); border:none; cursor:pointer; transition:all .18s; padding:0;
}
.bk-nav-dot:hover { background: rgba(99,102,241,.4); transform:scale(1.2); }
.bk-nav-dot.active { background: var(--accent); transform:scale(1.25); box-shadow:0 0 6px rgba(99,102,241,.4); }
.bk-nav-more { font-size:.68rem; color:var(--text-muted); font-weight:600; }

/* ── Misc ── */
.highlighted-text { background:rgba(99,102,241,.15); border-bottom:2px solid var(--accent); padding:0 2px; cursor:pointer; border-radius:2px; }
.unit-intro-display { display:flex; align-items:center; justify-content:center; flex-direction:column; min-height:60vh; }
.unit-intro-display h1 { font-size:5rem; font-weight:900; color:var(--accent); opacity:.5; }

/* ── Responsive ── */

/* 1024–1200px: keep two columns, tighten spacing */
@media (max-width: 1200px) {
  .bk-chapter-header { padding: 28px 32px 16px; }
  .bk-ch-title { font-size: clamp(1.3rem,2.5vw,2rem); max-width: calc(50% - 20px); }
  .bk-page-surface { padding: 0 22px 36px; }
  .bk-topbar, .bk-footer { padding-left: 32px; padding-right: 32px; }
}

/* ≤900px: collapse to single column, hide spine */
@media (max-width: 900px) {
  .book-container-wrapper { padding: 1.5rem .75rem 0; }
  .book-spread { transform: none; max-width: 680px; }
  .book-shadow-left, .book-shadow-right { display: none; }
  .bk-spine { display: none; }
  .bk-pages-shell { grid-template-columns: 1fr; }
  .bk-page-surface { padding: 0 20px 34px; min-height: 54vh; }
  .bk-page-surface.left { border-right: none; }
  .bk-chapter-header { padding: 24px 28px 14px; }
  .bk-ch-title { max-width: 100%; font-size: 1.6rem; }
  .bk-ch-subtitle { max-width: 100%; }
  .bk-topbar, .bk-footer { padding-left: 28px; padding-right: 28px; }
  .reader-paragraph { font-size: .95rem; }
  .bk-nav-row { max-width: 680px; }
}

/* ≤640px: mobile */
@media (max-width: 640px) {
  .book-container-wrapper { padding: 1rem .5rem 0; }
  .bk-chapter-header { padding: 20px 20px 12px; }
  .bk-ch-title { font-size: 1.35rem; }
  .bk-page-surface { padding: 0 16px 28px; }
  .bk-topbar, .bk-footer { padding-left: 20px; padding-right: 20px; }
  .reader-paragraph { font-size: .92rem; line-height: 1.78; }
  .bk-nav-btn { padding: 9px 14px; font-size: .78rem; max-width: 180px; }
  .bk-nav-row { padding-top: 14px; }
}

/* ≤480px */
@media (max-width: 480px) {
  .bk-page-surface { padding: 0 12px 24px; }
  .bk-chapter-header { padding: 16px 14px 10px; }
  .bk-ch-title { font-size: 1.2rem; }
  .bk-topbar, .bk-footer { padding-left: 14px; padding-right: 14px; }
  .reader-paragraph { font-size: .89rem; }
  .bk-nav-dots { display: none; }
  .bk-nav-btn { max-width: calc(50% - 6px); }
}

/* ≤375px */
@media (max-width: 375px) {
  .bk-page-surface { padding: 0 10px 20px; }
  .bk-ch-title { font-size: 1.1rem; }
  .reader-paragraph { font-size: .86rem; }
}

/* Modal */
.modal-close-row { display:flex; justify-content:flex-end; margin-bottom:8px; }
.modal-x-btn { background:transparent; border:none; cursor:pointer; color:var(--text-muted); border-radius:8px; padding:4px; display:flex; align-items:center; justify-content:center; transition:all 0.15s; }
.modal-x-btn:hover { background:rgba(239,68,68,.1); color:#ef4444; }
.overlay { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; z-index:3001; background:rgba(0,0,0,0.4); }
.overlay.blur { backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
.modal { background:var(--card-bg); padding:40px; border-radius:28px; border:1px solid var(--border); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); max-width:500px; width:90%; position:relative; z-index:2001; }
.opt-btn { width:100%; padding:18px; border-radius:18px; border:1px solid var(--border); background:var(--bg-app); color:var(--text-main); margin-bottom:10px; cursor:pointer; font-weight:600; }
.opt-btn:hover { border-color:var(--accent); background:rgba(99,102,241,.05); }
.stats { display:flex; justify-content:center; gap:40px; margin:30px 0; text-align:center; }
.medal { font-size:4rem; margin-bottom:20px; text-align:center; }
@keyframes popUp { from{transform:scale(0.9);opacity:0} to{transform:scale(1);opacity:1} }
.animate-pop { animation:popUp 0.3s cubic-bezier(0.18,0.89,0.32,1.28); }

/* ── Responsive — workstation ── */
@media(max-width:1280px) { .ai-panel-desktop{width:300px;} }

/* Tablet: sidebar becomes a drawer */
@media(max-width:1024px) {
  .workstation { padding:8px; gap:8px; }
  .sidebar {
    position: fixed; top:0; left:0; bottom:0; width:280px;
    transform: translateX(-100%); z-index:3000;
    transition: transform 0.3s ease-in-out;
    box-shadow: 10px 0 40px rgba(0,0,0,.15);
    border-radius: 0 20px 20px 0;
  }
  .sidebar.open { transform: translateX(0); }
  .sidebar-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,.45); z-index:2999; display:block; }
  .reader-hamburger { display:flex; }
}
@media(min-width:1025px) {
  .reader-hamburger { display:none; }
}

/* Mobile */
@media(max-width:768px) {
  .rtb-btn span { display:none; }
  .rtb-btn { padding:9px 12px; }
  .reader-topbar { padding:8px 12px; }
}
@media(max-width:480px) {
  .workstation { padding:4px; gap:4px; }
  .modal { padding:22px 16px; }
}
`;

export default BookContentWindow;
