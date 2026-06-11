import React, { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button as UIButton } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { ScrollArea } from "../components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Checkbox } from "../components/ui/checkbox";
import { formatDistanceToNow } from 'date-fns';
import BlogFeed from "../components/BlogFeed";
import { BlogPost } from "../components/BlogPostCard";
import { mockBlogPosts } from "../lib/mock-blog-data";
import { badWords } from "../lib/bad-words";
import {
  Users, MessageSquare, Send, Paperclip, Image as ImageIcon,
  Heart, MessageCircle, Share2, Trash2, Plus, Search, Filter,
  BookOpen, Trophy, Zap, ArrowLeft, Loader2, Lightbulb, Code,
  BrainCircuit, GraduationCap, XCircle, Vote, ShieldAlert,
  Target, Star, BarChart3, Award, TrendingUp
  } from "lucide-react";
  import { TrendingTopics } from "../components/TrendingTopics";
  import { useToast } from "../hooks/use-toast";
  import { useTheme } from '../hooks/use-theme';
  import { useNotificationStore } from "../lib/notification-store";
  import { buildApiUrl } from "../lib/apiBase";
  import { queryClient } from "../lib/queryClient";
  import Navigation from "../components/navigation";
  import { useAuth } from "../hooks/use-auth";
  import FunnyLoader from "../components/ui/FunnyLoader";

  const MotionButton = motion(UIButton);

/* ── Dashboard-matched CSS ── */
const communityStyles = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

.comm-page {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  background: #f8fafc;
  min-height: 100vh;
}
.dark .comm-page { background: #0d1117; }

/* ══════════════════ HERO ══════════════════ */
.comm-hero {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  padding: 36px 40px;
  position: relative; overflow: hidden;
  animation: heroIn .6s cubic-bezier(.34,1.56,.64,1) both;
}
@keyframes heroIn { from{opacity:0;transform:translateY(-16px)} to{opacity:1;transform:none} }
.comm-hero::before {
  content:''; position:absolute; top:-60px; right:-60px;
  width:260px; height:260px; border-radius:50%; background:rgba(255,255,255,.09);
}
.comm-hero::after {
  content:''; position:absolute; bottom:-80px; left:28%;
  width:200px; height:200px; border-radius:50%; background:rgba(255,255,255,.06);
}
.comm-hero-inner {
  position:relative; z-index:1; max-width:1280px; margin:0 auto;
  display:flex; align-items:center; justify-content:space-between; gap:20px; flex-wrap:wrap;
}
.comm-hero-title { font-size:clamp(22px,3.5vw,32px); font-weight:800; color:#fff; letter-spacing:-.5px; margin-bottom:6px; }
.comm-hero-sub   { font-size:14px; color:rgba(255,255,255,.75); max-width:420px; line-height:1.5; }
.comm-hero-right { display:flex; align-items:center; gap:16px; flex-shrink:0; }
.comm-hero-stat  { text-align:center; }
.comm-hero-sn    { font-size:28px; font-weight:800; color:#fff; line-height:1; }
.comm-hero-sl    { font-size:11px; color:rgba(255,255,255,.65); margin-top:2px; }
.comm-hero-div   { width:1px; height:44px; background:rgba(255,255,255,.22); }
.comm-hero-btn {
  padding:11px 22px; background:#fff; color:#6366f1; border:none; border-radius:14px;
  font-size:13.5px; font-weight:700; cursor:pointer; font-family:inherit;
  transition:all .2s; white-space:nowrap; box-shadow:0 4px 16px rgba(0,0,0,.15);
}
.comm-hero-btn:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.2); background:#f5f3ff; }

/* ══════════════════ BODY ══════════════════ */
.comm-body { max-width:1280px; margin:0 auto; padding:28px 32px 48px; }

/* ── Stat mini-cards (matches dashboard) ── */
.comm-stats-row {
  display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:28px;
}
.comm-stat-card {
  background:#fff; border-radius:18px; padding:18px 20px;
  border:1px solid rgba(0,0,0,.06); box-shadow:0 2px 12px rgba(0,0,0,.05);
  transition:all .25s cubic-bezier(.4,0,.2,1);
  animation:cardIn .5s cubic-bezier(.34,1.56,.64,1) both; cursor:default;
  display:flex; flex-direction:column;
}
.dark .comm-stat-card { background: #161b22; border-color: rgba(255,255,255,.1); box-shadow: none; }
.comm-stat-card:hover { transform:translateY(-3px); box-shadow:0 10px 28px rgba(0,0,0,.09); }
.dark .comm-stat-card:hover { box-shadow:0 10px 28px rgba(0,0,0,.2); }
.comm-stat-card.blue   { border-top:3px solid #6366f1; }
.comm-stat-card.green  { border-top:3px solid #10b981; }
.comm-stat-card.purple { border-top:3px solid #8b5cf6; }
.comm-stat-card.amber  { border-top:3px solid #f59e0b; }
.comm-stat-top  { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.comm-stat-icon { width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; }
.si-blue   { background:rgba(99,102,241,.1);  color:#6366f1; }
.si-green  { background:rgba(16,185,129,.1);  color:#10b981; }
.si-purple { background:rgba(139,92,246,.1);  color:#8b5cf6; }
.si-amber  { background:rgba(245,158,11,.1);  color:#f59e0b; }
.comm-stat-badge { font-size:10.5px; font-weight:600; padding:3px 8px; border-radius:20px; color:#9ca3af; background:#f9fafb; }
.dark .comm-stat-badge { background: #21262d; color: #8b949e; }
.comm-stat-num   { font-size:28px; font-weight:800; color:#0f172a; letter-spacing:-1px; line-height:1; margin-bottom:3px; }
.dark .comm-stat-num { color: #c9d1d9; }
.comm-stat-label { font-size:12px; color:#64748b; font-weight:500; }
.dark .comm-stat-label { color: #8b949e; }

/* ── Tab bar ── */
.comm-tabs-bar {
  display:flex; gap:4px; background:#fff; border-radius:20px; padding:5px;
  border:1px solid rgba(0,0,0,.06); box-shadow:0 2px 12px rgba(0,0,0,.05);
  width:fit-content; margin-bottom:24px;
}
.dark .comm-tabs-bar { background: #161b22; border-color: rgba(255,255,255,.1); box-shadow: none; }
.comm-tab {
  display:flex; align-items:center; gap:7px;
  padding:9px 20px; border-radius:14px; border:none; cursor:pointer;
  font-size:13px; font-weight:600; font-family:inherit; transition:all .2s;
  background:transparent; color:#64748b; white-space:nowrap;
}
.dark .comm-tab { color: #8b949e; }
.comm-tab:hover { background:#f1f5f9; color:#374151; }
.dark .comm-tab:hover { background: #21262d; color: #c9d1d9; }
.comm-tab.active {
  background:linear-gradient(135deg,#6366f1,#8b5cf6);
  color:#fff; box-shadow:0 4px 14px rgba(99,102,241,.35);
}

/* ── Feed layout ── */
.comm-feed-layout {
  display:grid; grid-template-columns:280px 1fr 280px; gap:20px; align-items:start;
}

/* ── Card base ── */
.comm-card {
  background:#fff; border-radius:20px; border:1px solid rgba(0,0,0,.06);
  box-shadow:0 2px 12px rgba(0,0,0,.05); overflow:hidden;
  animation:cardIn .5s cubic-bezier(.34,1.56,.64,1) both;
}
.dark .comm-card { background: #161b22; border-color: rgba(255,255,255,.1); box-shadow: none; }
.comm-card-header {
  padding:18px 20px 14px; border-bottom:1px solid #f1f5f9;
  display:flex; align-items:center; justify-content:space-between;
}
.dark .comm-card-header { border-bottom-color: #30363d; }
.comm-card-title {
  font-size:14px; font-weight:700; color:#0f172a;
  display:flex; align-items:center; gap:8px;
}
.dark .comm-card-title { color: #c9d1d9; }
.comm-card-body { padding:18px 20px; }

/* ── Create post ── */
.comm-post-textarea {
  width:100%; border-radius:12px; border:1.5px solid #e2e8f0; padding:12px 14px;
  font-size:13.5px; font-family:inherit; color:#0f172a; resize:none; outline:none;
  transition:border .2s; background:#fafafa; min-height:90px;
}
.dark .comm-post-textarea { background: #21262d; border-color: #30363d; color: #c9d1d9; }
.comm-post-textarea:focus { border-color:#6366f1; background:#fff; box-shadow:0 0 0 3px rgba(99,102,241,.1); }
.dark .comm-post-textarea:focus { border-color: #818cf8; background: #161b22; }
.comm-post-actions { display:flex; align-items:center; justify-content:space-between; margin-top:10px; flex-wrap:wrap; gap:8px; }
.comm-post-tools   { display:flex; align-items:center; gap:6px; }
.comm-tool-btn {
  display:flex; align-items:center; gap:5px; padding:6px 12px; border-radius:10px;
  border:1px solid #e2e8f0; background:#fff; font-size:12px; font-weight:600;
  color:#64748b; cursor:pointer; font-family:inherit; transition:all .15s;
}
.dark .comm-tool-btn { background: #21262d; border-color: #30363d; color: #8b949e; }
.comm-tool-btn:hover { border-color:#6366f1; color:#6366f1; background:rgba(99,102,241,.05); }
.dark .comm-tool-btn:hover { background: #30363d; border-color: #818cf8; color: #818cf8; }
.comm-post-btn {
  padding:9px 20px; background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff;
  border:none; border-radius:12px; font-size:13px; font-weight:700; cursor:pointer;
  font-family:inherit; transition:all .2s; box-shadow:0 4px 12px rgba(99,102,241,.35);
}
.comm-post-btn:hover { transform:translateY(-1px); box-shadow:0 6px 18px rgba(99,102,241,.45); }
.comm-post-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }

/* ── Search bar ── */
.comm-search-bar { position:relative; margin-bottom:16px; }
.comm-search-bar input {
  width:100%; height:42px; border-radius:12px; border:1.5px solid #e2e8f0;
  padding:0 14px 0 40px; font-size:13px; font-family:inherit; outline:none;
  background:#fafafa; color:#0f172a; transition:border .2s;
}
.dark .comm-search-bar input { background: #21262d; border-color: #30363d; color: #c9d1d9; }
.comm-search-bar input:focus { border-color:#6366f1; background:#fff; }
.dark .comm-search-bar input:focus { border-color: #818cf8; background: #161b22; }
.comm-search-icon { position:absolute; left:13px; top:50%; transform:translateY(-50%); color:#94a3b8; width:16px; height:16px; pointer-events:none; }

/* ── Post card ── */
.comm-post {
  background:#fff; border-radius:16px; border:1px solid rgba(0,0,0,.06);
  box-shadow:0 2px 10px rgba(0,0,0,.04); padding:18px 20px; margin-bottom:12px;
  transition:all .2s; animation:cardIn .4s cubic-bezier(.34,1.56,.64,1) both;
}
.dark .comm-post { background: #161b22; border-color: rgba(255,255,255,.1); box-shadow: none; }
.comm-post:hover { box-shadow:0 6px 24px rgba(0,0,0,.08); transform:translateY(-2px); }
.dark .comm-post:hover { box-shadow:0 6px 24px rgba(0,0,0,.2); }
.comm-post-meta { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
.comm-post-avatar {
  width:38px; height:38px; border-radius:50%;
  background:linear-gradient(135deg,#6366f1,#8b5cf6);
  display:flex; align-items:center; justify-content:center;
  color:#fff; font-weight:700; font-size:14px; flex-shrink:0;
}
.comm-post-author { font-size:13.5px; font-weight:700; color:#0f172a; }
.dark .comm-post-author { color: #c9d1d9; }
.comm-post-time   { font-size:11.5px; color:#94a3b8; margin-left:auto; }
.dark .comm-post-time { color: #8b949e; }
.comm-post-type-badge {
  font-size:10px; font-weight:700; padding:2px 8px; border-radius:20px;
  background:rgba(99,102,241,.1); color:#6366f1; text-transform:uppercase; letter-spacing:.05em;
}
.comm-post-content { font-size:13.5px; color:#374151; line-height:1.65; margin-bottom:12px; }
.dark .comm-post-content { color: #adbac7; }
.comm-post-reactions { display:flex; align-items:center; gap:12px; padding-top:10px; border-top:1px solid #f1f5f9; }
.dark .comm-post-reactions { border-top-color: #30363d; }
.comm-reaction-btn {
  display:flex; align-items:center; gap:5px; font-size:12.5px; color:#64748b;
  background:none; border:none; cursor:pointer; font-family:inherit; padding:4px 8px;
  border-radius:8px; transition:all .15s; font-weight:500;
}
.dark .comm-reaction-btn { color: #8b949e; }
.comm-reaction-btn:hover { background:#f1f5f9; color:#6366f1; }
.dark .comm-reaction-btn:hover { background: #21262d; color: #818cf8; }

/* ── Poll card ── */
.comm-poll {
  background:#fff; border-radius:16px; border:1px solid rgba(0,0,0,.06);
  box-shadow:0 2px 10px rgba(0,0,0,.04); padding:16px 18px; margin-bottom:12px;
  animation:cardIn .4s cubic-bezier(.34,1.56,.64,1) both;
}
.dark .comm-poll { background: #21262d; border-color: rgba(255,255,255,.1); }
.comm-poll-q { font-size:13.5px; font-weight:700; color:#0f172a; margin-bottom:10px; display:flex; align-items:center; gap:7px; }
.dark .comm-poll-q { color: #c9d1d9; }
.comm-poll-opt {
  width:100%; padding:9px 14px; margin-bottom:7px; border-radius:10px;
  border:1.5px solid #e2e8f0; background:#fafafa; font-size:12.5px; font-weight:500;
  color:#374151; cursor:pointer; font-family:inherit; transition:all .15s;
  display:flex; align-items:center; justify-content:space-between;
  text-align:left;
}
.dark .comm-poll-opt { background: #161b22; border-color: #30363d; color: #adbac7; }
.comm-poll-opt:hover:not(:disabled) { border-color:#6366f1; background:rgba(99,102,241,.04); color:#4338ca; }
.dark .comm-poll-opt:hover:not(:disabled) { border-color: #818cf8; background: rgba(99,102,241,.1); }
.comm-poll-opt:disabled { cursor:default; opacity:.7; }
.comm-poll-footer { font-size:11px; color:#94a3b8; text-align:right; margin-top:4px; font-weight:500; }
.dark .comm-poll-footer { color: #8b949e; }

/* ── Trending topic ── */
.comm-topic {
  display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:12px;
  cursor:pointer; transition:all .15s; margin-bottom:6px;
}
.comm-topic:hover { background:rgba(99,102,241,.06); }
.dark .comm-topic:hover { background: rgba(99,102,241,.15); }
.comm-topic-icon {
  width:34px; height:34px; border-radius:10px; background:rgba(99,102,241,.1);
  display:flex; align-items:center; justify-content:center; color:#6366f1; flex-shrink:0;
}
.comm-topic-name  { font-size:13px; font-weight:600; color:#0f172a; }
.dark .comm-topic-name { color: #c9d1d9; }
.comm-topic-count { font-size:11px; color:#94a3b8; margin-top:1px; }
.dark .comm-topic-count { color: #8b949e; }
.comm-topic-arrow { margin-left:auto; color:#94a3b8; font-size:14px; }
.dark .comm-topic-arrow { color: #8b949e; }

/* ── Leaderboard entry ── */
.comm-lb-row {
  display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:14px;
  border:1px solid rgba(0,0,0,.06); margin-bottom:8px; background:#fff;
  transition:all .2s; animation:cardIn .4s cubic-bezier(.34,1.56,.64,1) both;
}
.dark .comm-lb-row { background: #21262d; border-color: rgba(255,255,255,.1); }
.comm-lb-row:hover { box-shadow:0 4px 16px rgba(0,0,0,.08); transform:translateX(3px); }
.dark .comm-lb-row:hover { box-shadow:0 4px 16px rgba(0,0,0,.2); }
.comm-lb-rank { font-size:18px; font-weight:800; color:#94a3b8; width:30px; text-align:center; flex-shrink:0; }
.dark .comm-lb-rank { color: #8b949e; }
.comm-lb-avatar {
  width:38px; height:38px; border-radius:50%;
  background:linear-gradient(135deg,#6366f1,#8b5cf6);
  display:flex; align-items:center; justify-content:center;
  color:#fff; font-size:14px; font-weight:700; flex-shrink:0;
}
.comm-lb-name   { font-size:13.5px; font-weight:700; color:#0f172a; }
.dark .comm-lb-name { color: #c9d1d9; }
.comm-lb-points { font-size:12px; color:#64748b; margin-top:1px; }
.dark .comm-lb-points { color: #8b949e; }

/* ── Messaging layout ── */
.comm-msg-layout { display:grid; grid-template-columns:300px 1fr; gap:16px; height:70vh; }
.comm-contacts { background:#fff; border-radius:20px; border:1px solid rgba(0,0,0,.06); overflow:hidden; display:flex; flex-direction:column; }
.dark .comm-contacts { background: #161b22; border-color: rgba(255,255,255,.1); }
.comm-contacts-header { padding:16px 18px; border-bottom:1px solid #f1f5f9; font-size:14px; font-weight:700; color:#0f172a; display:flex; align-items:center; justify-content:space-between; }
.dark .comm-contacts-header { border-bottom-color: #30363d; color: #c9d1d9; }
.comm-contact-item { padding:12px 16px; cursor:pointer; transition:background .15s; display:flex; align-items:center; gap:10px; border-bottom:1px solid #f8fafc; }
.dark .comm-contact-item { border-bottom-color: #1e293b; }
.comm-contact-item:hover { background:#f8fafc; }
.dark .comm-contact-item:hover { background: #21262d; }
.comm-contact-item.active { background:rgba(99,102,241,.06); }
.dark .comm-contact-item.active { background: rgba(99,102,241,.15); }
.comm-contact-avatar { width:36px; height:36px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; color:#fff; font-size:13px; font-weight:700; flex-shrink:0; }
.comm-contact-name { font-size:13px; font-weight:600; color:#0f172a; }
.dark .comm-contact-name { color: #c9d1d9; }
.comm-chat-area { background:#fff; border-radius:20px; border:1px solid rgba(0,0,0,.06); display:flex; flex-direction:column; overflow:hidden; }
.dark .comm-chat-area { background: #161b22; border-color: rgba(255,255,255,.1); }
.comm-chat-header { padding:14px 18px; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:10px; }
.dark .comm-chat-header { border-bottom-color: #30363d; }
.comm-chat-messages { flex:1; overflow-y:auto; padding:16px 18px; display:flex; flex-direction:column; gap:12px; }
.comm-chat-input-row { padding:12px 16px; border-top:1px solid #f1f5f9; display:flex; gap:10px; align-items:center; }
.dark .comm-chat-input-row { border-top-color: #30363d; }
.comm-chat-input {
  flex:1; height:40px; border-radius:12px; border:1.5px solid #e2e8f0;
  padding:0 14px; font-size:13px; font-family:inherit; outline:none; transition:border .2s;
}
.dark .comm-chat-input { background: #21262d; border-color: #30363d; color: #c9d1d9; }
.comm-chat-input:focus { border-color:#6366f1; }
.dark .comm-chat-input:focus { border-color: #818cf8; }
.comm-send-btn {
  width:40px; height:40px; border-radius:12px; background:linear-gradient(135deg,#6366f1,#8b5cf6);
  border:none; cursor:pointer; display:flex; align-items:center; justify-content:center;
  color:#fff; transition:all .2s; flex-shrink:0;
}
.comm-send-btn:hover { transform:scale(1.07); }

/* ── Create poll form ── */
.comm-create-poll-btn {
  width:100%; padding:9px 16px; border-radius:12px;
  background:linear-gradient(135deg,#6366f1,#8b5cf6); color:#fff;
  border:none; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit;
  transition:all .2s; box-shadow:0 4px 12px rgba(99,102,241,.3); margin-top:8px;
  display:flex; align-items:center; justify-content:center; gap:6px;
}
.comm-create-poll-btn:hover { transform:translateY(-1px); }
.comm-cancel-poll-btn {
  width:100%; padding:9px 16px; border-radius:12px;
  background:#f1f5f9; color:#64748b;
  border:none; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit;
  transition:all .2s; margin-top:6px;
}
.dark .comm-cancel-poll-btn { background: #21262d; color: #8b949e; }

/* ── Loader ── */
.comm-loader {
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:64px 32px; gap:16px; text-align:center;
}
.comm-loader-text { font-size:15px; font-weight:600; color:#64748b; }
.dark .comm-loader-text { color: #8b949e; }

/* ── Badge pill ── */
.comm-badge {
  display:inline-block; font-size:10.5px; font-weight:700; padding:2px 9px;
  border-radius:20px; text-transform:uppercase; letter-spacing:.05em;
}
.comm-badge.indigo { background:rgba(99,102,241,.1); color:#6366f1; }
.comm-badge.green  { background:rgba(16,185,129,.1);  color:#059669; }
.comm-badge.amber  { background:rgba(245,158,11,.1);  color:#d97706; }
.comm-badge.gold   { background:rgba(234,179,8,.15);  color:#a16207; }

@keyframes cardIn {
  from { opacity:0; transform:translateY(14px); }
  to   { opacity:1; transform:translateY(0); }
}

/* ══════════════════ RESPONSIVE ══════════════════ */
@media (max-width: 1200px) {
  .comm-feed-layout { grid-template-columns:240px 1fr 240px; }
  .comm-stats-row   { grid-template-columns:repeat(2,1fr); }
}
@media (max-width: 1024px) {
  .comm-feed-layout { grid-template-columns:1fr; }
  .comm-feed-left, .comm-feed-right { display:none; }
}
@media (max-width: 768px) {
  .comm-hero   { padding:24px 20px 28px; }
  .comm-hero-inner { flex-direction:column; align-items:flex-start; }
  .comm-hero-right { display:none; }
  .comm-body   { padding:18px 16px 36px; }
  .comm-stats-row { grid-template-columns:1fr 1fr; gap:10px; }
  .comm-tabs-bar { width:100%; overflow-x:auto; }
  .comm-tab span { display:none; }
  .comm-msg-layout { grid-template-columns:1fr; height:auto; }
}
@media (max-width: 480px) {
  .comm-stats-row { grid-template-columns:1fr 1fr; }
  .comm-tab { padding:9px 14px; }
}
`;

const moderateContent = (content: string) => {
  const lowerCaseContent = content.toLowerCase();
  return badWords.some(word => lowerCaseContent.includes(word));
};

interface TrendingTopic { id: string; title: string; posts: number; icon: string; }
const mockTrendingTopics: TrendingTopic[] = [
  { id: '1', title: 'Generative AI in Education', posts: 120, icon: 'Zap' },
  { id: '2', title: 'New Study Techniques',       posts: 85,  icon: 'BookOpen' },
  { id: '3', title: 'Exam Prep Hacks',            posts: 60,  icon: 'BrainCircuit' },
  { id: '4', title: 'Post-Graduation Plans',      posts: 45,  icon: 'GraduationCap' },
  { id: '5', title: 'Coding Challenges',          posts: 30,  icon: 'Code' },
];

interface PollOption { id: string; text: string; votes: number; }
interface CommunityPoll { id: string; question: string; options: PollOption[]; totalVotes: number; userVoted: boolean; icon: string; }

const mockCommunityPolls: CommunityPoll[] = [
  { id: 'p1', question: 'What is your favorite study method?', options: [
    { id: 'o1', text: 'Flashcards', votes: 15 }, { id: 'o2', text: 'Spaced Repetition', votes: 25 },
    { id: 'o3', text: 'Pomodoro Technique', votes: 10 }, { id: 'o4', text: 'Group Study', votes: 20 },
  ], totalVotes: 70, userVoted: false, icon: 'Lightbulb' },
  { id: 'p2', question: 'Which subject do you find most challenging?', options: [
    { id: 'o5', text: 'Mathematics', votes: 30 }, { id: 'o6', text: 'Physics', votes: 20 },
    { id: 'o7', text: 'Literature', votes: 10 }, { id: 'o8', text: 'Computer Science', votes: 15 },
  ], totalVotes: 75, userVoted: true, icon: 'XCircle' },
];

interface User { id: number; username: string; firstName: string; lastName: string; email: string; role: string; profileImage?: string; }
interface Group { id: string; name: string; members: number[]; messages: any[]; }
interface Channel { id: string; name: string; groups: Group[]; }

export default function CommunityPage() {
  const { addNotification } = useNotificationStore();
  const { toast } = useToast();
  const [activeTab, setActiveTab]   = useState("feed");
  const [selectedConversation, setSelectedConversation] = useState<string | number | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [postContent, setPostContent]       = useState("");
  const [postType, setPostType]             = useState("discussion");
  const [contentFilter, setContentFilter]   = useState("all");
  const [searchTerm, setSearchTerm]         = useState("");
  const [showComments, setShowComments]     = useState<{[k:number]:boolean}>({});
  const [commentTexts, setCommentTexts]     = useState<{[k:number]:string}>({});
  const [attachedFile, setAttachedFile]     = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [polls, setPolls]                             = useState<CommunityPoll[]>(mockCommunityPolls);
  const [newPollQuestion, setNewPollQuestion]         = useState('');
  const [newPollOptions, setNewPollOptions]           = useState<string[]>(['', '']);
  const [showPollCreationForm, setShowPollCreationForm] = useState(false);

  const [channels, setChannels]         = useState<Channel[]>([]);
  const [newChannelName, setNewChannelName] = useState("");
  const [newGroupName, setNewGroupName]     = useState("");
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  const [showCreateGroupModal,   setShowCreateGroupModal]   = useState(false);

  const { userHeader } = useAuth();
  const [currentRole, setCurrentRole] = useState("student");
  useEffect(() => { if (userHeader?.role) setCurrentRole(userHeader.role); }, [userHeader]);

  const { data: user }            = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: posts, isLoading: isLoadingPosts } = useQuery<any[]>({ queryKey: ["/api/community/posts"] });
  const { data: privateMessages } = useQuery<any[]>({ queryKey: ["/api/community/messages"] });
  const { data: classmates }      = useQuery<any[]>({ queryKey: ["/api/community/classmates"] });
  const { data: communityPoints } = useQuery<number>({ queryKey: ["/api/community/points"] });
  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useQuery<any[]>({ queryKey: ["/api/community/leaderboard"] });
  const { data: badges }          = useQuery<any[]>({ queryKey: ["/api/community/badges"] });

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:"smooth" }); }, [privateMessages, selectedConversation]);

  const createPostMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(buildApiUrl("/api/community/posts"), { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data), credentials:"include" });
      if (!r.ok) throw new Error('Failed'); return r.json();
    },
    onSuccess: (data) => { 
      queryClient.invalidateQueries({ queryKey:["/api/community/posts"] }); 
      setPostContent(""); 
      addNotification(`New post created: "${data.content.substring(0, 20)}..."`);
      toast({ title:"Post created!" }); 
    },
  });

  const likePostMutation = useMutation({
    mutationFn: async (postId: number) => {
      const r = await fetch(buildApiUrl(`/api/community/posts/${postId}/like`), { method:"POST", headers:{"Content-Type":"application/json"}, credentials:"include" });
      if (!r.ok) throw new Error('Failed'); return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey:["/api/community/posts"] }),
  });

  const commentPostMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: number; content: string }) => {
      const r = await fetch(buildApiUrl(`/api/community/posts/${postId}/comments`), { method:"POST", body:JSON.stringify({ content }), headers:{"Content-Type":"application/json"}, credentials:"include" });
      if (!r.ok) throw new Error('Failed'); return r.json();
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey:["/api/community/posts"] });
      setCommentTexts(p => ({ ...p, [vars.postId]:"" }));
      addNotification(`New comment on post: "${vars.content.substring(0, 20)}..."`);
      toast({ title:"Comment added!" });
    },
  });

  const createPrivateMessageMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(buildApiUrl("/api/community/messages"), { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data), credentials:"include" });
      if (!r.ok) throw new Error('Failed'); return r.json();
    },
    onSuccess: (data) => { 
      queryClient.invalidateQueries({ queryKey:["/api/community/messages"] }); 
      setMessageContent(""); 
      addNotification(`New private message: "${data.content.substring(0, 20)}..."`);
    },
  });

  const createGroupMessageMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(buildApiUrl("/api/community/group-messages"), { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data), credentials:"include" });
      if (!r.ok) throw new Error('Failed'); return r.json();
    },
    onSuccess: (data) => { 
      queryClient.invalidateQueries({ queryKey:["/api/community/group-messages"] }); 
      setMessageContent(""); 
      addNotification(`New group message: "${data.content.substring(0, 20)}..."`);
    },
  });

  const sendMessage = () => {
    if (moderateContent(messageContent)) { toast({ title:"Please keep conversations appropriate." }); return; }
    if (!messageContent.trim() || !selectedConversation) return;
    const data = { content: messageContent.trim(), courseId:27, messageType:"text" };
    if (selectedConversation === 'group') { createGroupMessageMutation.mutate(data); }
    else if (typeof selectedConversation === 'string' && selectedConversation.startsWith('group_')) {
      const newMsg = { id:`msg_${Date.now()}`, senderId:user?.id, content:messageContent.trim(), createdAt:new Date().toISOString(), sender:{ firstName:user?.firstName, lastName:user?.lastName } };
      setChannels(prev => prev.map(c => ({ ...c, groups: c.groups.map(g => g.id === selectedConversation ? { ...g, messages:[...g.messages,newMsg] } : g) })));
      setMessageContent("");
    } else { createPrivateMessageMutation.mutate({ ...data, receiverId:selectedConversation }); }
  };

  const createPost = () => {
    if (moderateContent(postContent)) { toast({ title:"Please keep posts appropriate." }); return; }
    if (postContent.trim()) createPostMutation.mutate({ content:postContent.trim(), type:postType, courseId:27 });
    else toast({ title:"Please enter post content" });
  };

  const handleCreatePoll = () => {
    const validOpts = newPollOptions.filter(o => o.trim());
    if (!newPollQuestion.trim() || validOpts.length < 2) { toast({ title:"Add a question and at least 2 options." }); return; }
    const newPoll: CommunityPoll = {
      id: `p${polls.length+1}`, question: newPollQuestion.trim(), userVoted:false, icon:'Target', totalVotes:0,
      options: validOpts.map((o,i) => ({ id:`o${i}`, text:o.trim(), votes:0 })),
    };
    setPolls(p => [newPoll,...p]); setNewPollQuestion(''); setNewPollOptions(['','']); setShowPollCreationForm(false);
    toast({ title:"Poll created!" });
  };

  const handleVote = (pollId: string, optionId: string) => {
    setPolls(p => p.map(poll => {
      if (poll.id === pollId && !poll.userVoted) {
        return { ...poll, options:poll.options.map(o => o.id===optionId ? {...o,votes:o.votes+1} : o), totalVotes:poll.totalVotes+1, userVoted:true };
      }
      return poll;
    }));
    toast({ title:"Vote cast!" });
  };

  const handleCreateChannel = () => {
    if (!newChannelName.trim()) return;
    setChannels(prev => [...prev, { id:`ch_${Date.now()}`, name:newChannelName, groups:[] }]);
    setNewChannelName(""); setShowCreateChannelModal(false); toast({ title:"Channel created!" });
  };

  const tabs = [
    { id:"feed",        label:"Feed",       icon:<MessageSquare /> },
    { id:"messaging",   label:"Messages",   icon:<Send /> },
    { id:"blogs",       label:"Blogs",      icon:<BookOpen /> },
    { id:"leaderboard", label:"Leaderboard",icon:<Trophy /> },
  ];

  const statCards = [
    { label:"Posts",          value: posts?.length ?? 0,          badge:"Total",    cls:"blue",   icon:<MessageSquare size={18}/>,  si:"si-blue"   },
    { label:"Community Pts",  value: communityPoints ?? 0,         badge:"Earned",   cls:"green",  icon:<Award size={18}/>,          si:"si-green"  },
    { label:"Active Members", value: classmates?.length ?? 0,      badge:"Online",   cls:"purple", icon:<Users size={18}/>,          si:"si-purple" },
    { label:"Badges",         value: badges?.length ?? 0,          badge:"Earned",   cls:"amber",  icon:<Star size={18}/>,           si:"si-amber"  },
  ];

  return (
    <>
      <style>{communityStyles}</style>
      <div className="comm-page">
        <Navigation currentRole={currentRole} onRoleChange={setCurrentRole} />

        {/* ── HERO ── */}
        <div className="comm-hero">
          <div className="comm-hero-inner">
            <div>
              <div className="comm-hero-title">Community Hub 🌟</div>
              <div className="comm-hero-sub">Connect, collaborate and grow together with your peers and mentors.</div>
            </div>
            <div className="comm-hero-right">
              <div className="comm-hero-stat">
                <div className="comm-hero-sn">{posts?.length ?? 0}</div>
                <div className="comm-hero-sl">Posts</div>
              </div>
              <div className="comm-hero-div" />
              <div className="comm-hero-stat">
                <div className="comm-hero-sn">{classmates?.length ?? 0}</div>
                <div className="comm-hero-sl">Members</div>
              </div>
              <div className="comm-hero-div" />
              <button className="comm-hero-btn" onClick={() => setActiveTab('feed')}>
                Explore Feed →
              </button>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="comm-body">

          {/* Stat cards */}
          <div className="comm-stats-row">
            {statCards.map((s, i) => (
              <div key={i} className={`comm-stat-card ${s.cls}`} style={{ animationDelay:`${0.05+i*.07}s` }}>
                <div className="comm-stat-top">
                  <div className={`comm-stat-icon ${s.si}`}>{s.icon}</div>
                  <span className="comm-stat-badge">{s.badge}</span>
                </div>
                <div className="comm-stat-num">{s.value}</div>
                <div className="comm-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div className="comm-tabs-bar">
            {tabs.map(t => (
              <button key={t.id} className={`comm-tab ${activeTab === t.id ? "active" : ""}`} onClick={() => setActiveTab(t.id)}>
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* ── FEED TAB ── */}
          {activeTab === "feed" && (
            isLoadingPosts ? <FunnyLoader text="Loading community posts..." /> : (
              <div className="comm-feed-layout">

                {/* Left — Polls */}
                <div className="comm-feed-left">
                  <div className="comm-card" style={{ animationDelay:".1s" }}>
                    <div className="comm-card-header">
                      <div className="comm-card-title"><Vote size={15} style={{color:"#6366f1"}} /> Community Polls</div>
                    </div>
                    <div className="comm-card-body" style={{ maxHeight:480, overflowY:"auto" }}>
                      {polls.map(poll => (
                        <div key={poll.id} className="comm-poll">
                          <div className="comm-poll-q"><BarChart3 size={14} style={{color:"#6366f1",flexShrink:0}} />{poll.question}</div>
                          {poll.options.map(opt => (
                            <button key={opt.id} className="comm-poll-opt"
                              onClick={() => handleVote(poll.id, opt.id)} disabled={poll.userVoted}>
                              <span>{opt.text}</span>
                              <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>({opt.votes})</span>
                            </button>
                          ))}
                          <div className="comm-poll-footer">
                            {poll.totalVotes} votes {poll.userVoted && <span style={{color:"#10b981",fontWeight:700}}>· Voted ✓</span>}
                          </div>
                        </div>
                      ))}

                      <button className="comm-create-poll-btn" onClick={() => setShowPollCreationForm(!showPollCreationForm)}>
                        <Plus size={14} /> {showPollCreationForm ? "Cancel" : "Create Poll"}
                      </button>

                      {showPollCreationForm && (
                        <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} style={{marginTop:12}}>
                          <input
                            value={newPollQuestion} onChange={e => setNewPollQuestion(e.target.value)}
                            placeholder="Your poll question…"
                            style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,marginBottom:8,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}
                          />
                          {newPollOptions.map((opt,i) => (
                            <input key={i} value={opt} onChange={e => { const o=[...newPollOptions]; o[i]=e.target.value; setNewPollOptions(o); }}
                              placeholder={`Option ${i+1}`}
                              style={{width:"100%",padding:"8px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:12.5,marginBottom:6,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}
                            />
                          ))}
                          <button onClick={() => setNewPollOptions([...newPollOptions,''])}
                            style={{fontSize:12,color:"#6366f1",fontWeight:600,background:"none",border:"none",cursor:"pointer",padding:"4px 0",marginBottom:6}}>
                            + Add option
                          </button>
                          <button className="comm-create-poll-btn" onClick={handleCreatePoll}><Target size={14}/> Create Poll</button>
                          <button className="comm-cancel-poll-btn" onClick={() => setShowPollCreationForm(false)}>Cancel</button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Centre — Posts */}
                <div>
                  {/* Create post card */}
                  <div className="comm-card" style={{marginBottom:16,animationDelay:".05s"}}>
                    <div className="comm-card-header">
                      <div className="comm-card-title"><MessageSquare size={15} style={{color:"#6366f1"}}/> Share with your class</div>
                    </div>
                    <div className="comm-card-body">
                      <select value={postType} onChange={e => setPostType(e.target.value)}
                        className="w-full p-2 rounded-lg border bg-gray-50 dark:bg-gray-700 text-sm mb-2.5 font-sans outline-none text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600 focus:border-indigo-500 dark:focus:border-indigo-400">
                        <option value="discussion">Discussion</option>
                        <option value="question">Question</option>
                        <option value="achievement">Achievement</option>
                        <option value="study_tip">Study Tip</option>
                      </select>
                      <textarea className="comm-post-textarea" placeholder="What's on your mind?"
                        value={postContent} onChange={e => setPostContent(e.target.value)} rows={3} />
                      <div className="comm-post-actions">
                        <div className="comm-post-tools">
                          <input type="file" ref={fileInputRef} style={{display:"none"}} accept="image/*" onChange={e => { const f=e.target.files?.[0]; if(f) setAttachedFile(f); }} />
                          <button className="comm-tool-btn" onClick={() => fileInputRef.current?.click()}><ImageIcon size={13}/> Photo</button>
                          {attachedFile && <span style={{fontSize:11,color:"#6366f1",fontWeight:600}}>{attachedFile.name}</span>}
                        </div>
                        <button className="comm-post-btn" onClick={createPost} disabled={createPostMutation.isPending}>
                          {createPostMutation.isPending ? "Posting…" : "Post"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Search + filter */}
                  <div className="flex gap-2.5 mb-4 flex-wrap">
                    <div className="comm-search-bar flex-grow min-w-[160px] m-0">
                      <Search size={15} className="comm-search-icon" />
                      <input placeholder="Search posts…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <select value={contentFilter} onChange={e => setContentFilter(e.target.value)}
                      className="p-2.5 rounded-lg border bg-white dark:bg-gray-800 text-sm font-sans outline-none text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600 focus:border-indigo-500 dark:focus:border-indigo-400 h-[42px]">
                      <option value="all">All Content</option>
                      <option value="question">Questions</option>
                      <option value="discussion">Discussions</option>
                      <option value="achievement">Achievements</option>
                      <option value="study_tip">Study Tips</option>
                    </select>
                  </div>

                  {/* Post list */}
                  {posts && Array.isArray(posts) && posts.length > 0 ? (
                    posts
                      .filter((p:any) => {
                        const ms = !searchTerm || p.content?.toLowerCase().includes(searchTerm.toLowerCase());
                        const mf = contentFilter === "all" || p.type === contentFilter;
                        return ms && mf;
                      })
                      .map((post:any, idx:number) => (
                        <motion.div key={post.id} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:idx*.06}}>
                          <div className="comm-post">
                            <div className="comm-post-meta">
                              <div className="comm-post-avatar">
                                {(post.author?.firstName?.[0] || 'U').toUpperCase()}
                              </div>
                              <div>
                                <div className="comm-post-author">{post.author?.firstName} {post.author?.lastName}</div>
                                <span className="comm-badge indigo">{post.type}</span>
                              </div>
                              <span className="comm-post-time">{formatDistanceToNow(new Date(post.createdAt), {addSuffix:true})}</span>
                            </div>
                            <div className="comm-post-content">{post.content}</div>
                            <div className="comm-post-reactions">
                              <button className="comm-reaction-btn" onClick={() => likePostMutation.mutate(post.id)}>
                                <Heart size={14}/> Like ({post.likesCount || 0})
                              </button>
                              <button className="comm-reaction-btn" onClick={() => setShowComments(p => ({...p,[post.id]:!p[post.id]}))}>
                                <MessageCircle size={14}/> Comments ({post.commentsCount || 0})
                              </button>
                              <button className="comm-reaction-btn"><Share2 size={14}/> Share</button>
                            </div>
                            {showComments[post.id] && (
                              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                {post.comments?.map((c:any) => (
                                  <div key={c.id} className="flex gap-2 mb-2.5">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                      {(c.author?.firstName?.[0]||'U').toUpperCase()}
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 flex-1">
                                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{c.author?.firstName}</span>
                                      <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-1.5">{formatDistanceToNow(new Date(c.createdAt),{addSuffix:true})}</span>
                                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 leading-snug">{c.content}</p>
                                    </div>
                                  </div>
                                ))}
                                <div className="flex gap-2 mt-2">
                                  <input
                                    placeholder="Write a comment…"
                                    value={commentTexts[post.id]||""}
                                    onChange={e => setCommentTexts(p=>({...p,[post.id]:e.target.value}))}
                                    onKeyPress={e => { if(e.key==='Enter'&&(commentTexts[post.id]||"").trim()) commentPostMutation.mutate({postId:post.id,content:(commentTexts[post.id]||"").trim()}); }}
                                    className="comm-chat-input flex-1 h-9 text-sm"
                                  />
                                  <button className="comm-send-btn w-9 h-9 rounded-lg"
                                    onClick={() => { if((commentTexts[post.id]||"").trim()) commentPostMutation.mutate({postId:post.id,content:(commentTexts[post.id]||"").trim()}); }}>
                                    <Send size={14}/>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))
                  ) : (
                    <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-indigo-100 dark:border-gray-700">
                      <MessageSquare size={36} className="text-indigo-200 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-md font-bold text-gray-800 dark:text-gray-200">No posts yet</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Be the first to share something with the community!</p>
                    </div>
                  )}
                </div>

                {/* Right — Trending + Quick Stats */}
                <div className="comm-feed-right">
                  <div className="comm-card" style={{marginBottom:16,animationDelay:".12s"}}>
                    <div className="comm-card-header">
                      <div className="comm-card-title"><TrendingUp size={15} style={{color:"#6366f1"}}/> Trending Topics</div>
                    </div>
                    <div className="comm-card-body">
                      {mockTrendingTopics.map(t => (
                        <div key={t.id} className="comm-topic">
                          <div className="comm-topic-icon"><Zap size={15}/></div>
                          <div>
                            <div className="comm-topic-name">{t.title}</div>
                            <div className="comm-topic-count">{t.posts} posts</div>
                          </div>
                          <span className="comm-topic-arrow">›</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="comm-card" style={{animationDelay:".18s"}}>
                    <div className="comm-card-header">
                      <div className="comm-card-title"><Star size={15} style={{color:"#f59e0b"}}/> Quick Stats</div>
                    </div>
                    <div className="comm-card-body">
                      <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
                        <span style={{fontSize:13,color:"#64748b"}}>Community Points</span>
                        <span className="comm-badge green">{communityPoints || 0}</span>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0"}}>
                        <span style={{fontSize:13,color:"#64748b"}}>Badges Earned</span>
                        <span className="comm-badge amber">{badges?.length || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* ── MESSAGING TAB ── */}
          {activeTab === "messaging" && (
            <div className="comm-msg-layout">
              {/* Channels list */}
              <div className="comm-contacts">
                <div className="comm-contacts-header">
                  Channels
                  <button onClick={() => setShowCreateChannelModal(true)}
                    style={{width:28,height:28,borderRadius:8,background:"rgba(99,102,241,.1)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#6366f1"}}>
                    <Plus size={14}/>
                  </button>
                </div>
                <div style={{flex:1,overflowY:"auto"}}>
                  {channels.map(ch => (
                    <div key={ch.id}>
                      <div className="comm-contact-item" onClick={() => setSelectedChannel(ch.id === selectedChannel ? null : ch.id)}>
                        <div className="comm-contact-avatar">#</div>
                        <span className="comm-contact-name">{ch.name}</span>
                      </div>
                      {selectedChannel === ch.id && ch.groups.map(g => (
                        <div key={g.id} className={`comm-contact-item ${selectedConversation===g.id?"active":""}`}
                          style={{paddingLeft:28}} onClick={() => setSelectedConversation(g.id)}>
                          <div style={{width:28,height:28,borderRadius:"50%",background:"rgba(139,92,246,.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            <Users size={13} style={{color:"#8b5cf6"}}/>
                          </div>
                          <div style={{minWidth:0}}>
                            <div style={{fontSize:12.5,fontWeight:600,color:"#0f172a",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.name}</div>
                            <div style={{fontSize:11,color:"#94a3b8"}}>{g.members.length} members</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {channels.length === 0 && (
                    <div style={{textAlign:"center",padding:"40px 16px",color:"#94a3b8"}}>
                      <MessageSquare size={28} style={{margin:"0 auto 8px",opacity:.4}}/>
                      <p style={{fontSize:13}}>No channels yet. Create one!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat window */}
              {selectedConversation ? (
                <div className="comm-chat-area">
                  <div className="comm-chat-header">
                    <div className="comm-contact-avatar" style={{width:34,height:34,fontSize:12}}>
                      {channels.flatMap(c=>c.groups).find(g=>g.id===selectedConversation)?.name[0]||'G'}
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:"#0f172a"}}>
                        {channels.flatMap(c=>c.groups).find(g=>g.id===selectedConversation)?.name||'Chat'}
                      </div>
                      <div style={{fontSize:11.5,color:"#94a3b8"}}>{channels.find(c=>c.groups.some(g=>g.id===selectedConversation))?.name}</div>
                    </div>
                  </div>
                  <div className="comm-chat-messages">
                    {channels.flatMap(c=>c.groups).find(g=>g.id===selectedConversation)?.messages.map((m:any) => (
                      <div key={m.id} style={{display:"flex",justifyContent:m.senderId===user?.id?"flex-end":"flex-start"}}>
                        <div style={{
                          maxWidth:"72%",padding:"9px 14px",borderRadius:m.senderId===user?.id?"16px 16px 4px 16px":"16px 16px 16px 4px",
                          background:m.senderId===user?.id?"linear-gradient(135deg,#6366f1,#8b5cf6)":"#f1f5f9",
                          color:m.senderId===user?.id?"#fff":"#374151",
                          fontSize:13,lineHeight:1.55,
                        }}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef}/>
                  </div>
                  <div className="comm-chat-input-row">
                    <input className="comm-chat-input" placeholder="Type a message…"
                      value={messageContent} onChange={e=>setMessageContent(e.target.value)}
                      onKeyPress={e=>e.key==='Enter'&&sendMessage()} />
                    <button className="comm-send-btn" onClick={sendMessage}><Send size={14}/></button>
                  </div>
                </div>
              ) : (
                <div style={{background:"#fff",borderRadius:20,border:"1px solid rgba(0,0,0,.06)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10,color:"#94a3b8"}}>
                  <MessageSquare size={32} style={{opacity:.4}}/>
                  <p style={{fontSize:14,fontWeight:600,color:"#374151"}}>Select a group to chat</p>
                  <p style={{fontSize:12.5}}>Choose a channel group from the left sidebar</p>
                </div>
              )}
            </div>
          )}

          {/* ── BLOGS TAB ── */}
          {activeTab === "blogs" && (
            user ? (
              <BlogFeed currentUser={{ id:user.id.toString(), firstName:user.firstName, lastName:user.lastName, profileImage:user.profileImage }} />
            ) : (
              <FunnyLoader text="Please log in to view blog posts." />
            )
          )}

          {/* ── LEADERBOARD TAB ── */}
          {activeTab === "leaderboard" && (
            isLoadingLeaderboard ? <FunnyLoader text="Tallying scores…" /> : (
              <div className="comm-card" style={{maxWidth:720,margin:"0 auto"}}>
                <div className="comm-card-header">
                  <div className="comm-card-title"><Trophy size={15} style={{color:"#f59e0b"}}/> Class Leaderboard</div>
                </div>
                <div className="comm-card-body">
                  {leaderboard && (leaderboard as any[]).map((student:any, i:number) => (
                    <motion.div key={student.id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*.07}}>
                      <div className="comm-lb-row" style={{animationDelay:`${i*.07}s`}}>
                        <div className="comm-lb-rank">#{i+1}</div>
                        <div className="comm-lb-avatar">{student.firstName?.[0]}{student.lastName?.[0]}</div>
                        <div style={{flex:1}}>
                          <div className="comm-lb-name">{student.firstName} {student.lastName}</div>
                          <div className="comm-lb-points">{student.points} points</div>
                        </div>
                        <span className={`comm-badge ${i===0?"gold":i<3?"indigo":"amber"}`}>
                          {i===0?"🏆 Champion":i===1?"🥈 Pro":i===2?"🥉 Rising Star":`${student.points} pts`}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )
          )}

        </div>

        {/* ── Create Channel Modal ── */}
        {showCreateChannelModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] flex items-center justify-center"
            onClick={() => setShowCreateChannelModal(false)}>
            <motion.div initial={{opacity:0,scale:.95,y:12}} animate={{opacity:1,scale:1,y:0}}
              className="bg-white dark:bg-gray-800 rounded-2xl p-7 w-full max-w-md shadow-2xl"
              onClick={e=>e.stopPropagation()}>
              <h3 className="text-lg font-extrabold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-3">
                <MessageSquare size={18} className="text-indigo-500"/> Create Channel
              </h3>
              <input value={newChannelName} onChange={e=>setNewChannelName(e.target.value)}
                placeholder="Channel name"
                onKeyPress={e=>e.key==='Enter'&&handleCreateChannel()}
                className="w-full p-2.5 rounded-lg border bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:border-indigo-500 dark:focus:border-indigo-400 outline-none mb-3.5" />
              <div className="flex gap-2.5">
                <button onClick={()=>setShowCreateChannelModal(false)}
                  className="flex-1 p-2.5 rounded-lg border bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600">
                  Cancel
                </button>
                <button onClick={handleCreateChannel} disabled={!newChannelName.trim()}
                  className="flex-1 p-2.5 rounded-lg border-none bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-bold cursor-pointer disabled:opacity-50">
                  Create
                </button>
              </div>
            </motion.div>
          </div>
        )}

      </div>
    </>
  );
}
