import React, { useState, useEffect } from "react";
import { ArrowLeft, ChevronDown, HelpCircle, MessageCircle, Search, X } from "lucide-react";
import { getFaqs } from "../lib/gradeupApi";

interface FAQPanelProps {
  subject?: string;
  unit: string;
  unitId?: string;
  onBack: () => void;
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

/* ── Reset ── */
.fp *, .fp *::before, .fp *::after {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  box-sizing: border-box;
  margin: 0; padding: 0;
}

/* ── Shell
   Key: flex column, height 100%, overflow hidden on the SHELL only.
   The list area handles its own scroll. Nothing else gets overflow:hidden.
── */
.fp {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #f8fafc;
  border-radius: 18px;
  border: 1px solid rgba(0,0,0,.06);
  box-shadow: 0 2px 12px rgba(0,0,0,.05);
  overflow: hidden;          /* only clips the rounded corners */
}

/* ── COMPACT HEADER ─────────────────────────────── */
.fp-head {
  flex-shrink: 0;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #ec4899 100%);
  padding: 10px 14px;
  position: relative;
  overflow: hidden;
}
/* subtle orbs — very small so header stays compact */
.fp-head::before {
  content: '';
  position: absolute; top: -28px; right: -28px;
  width: 90px; height: 90px; border-radius: 50%;
  background: rgba(255,255,255,.1);
  pointer-events: none;
}
.fp-head-row {
  display: flex;
  align-items: center;
  gap: 10px;
  position: relative;
  z-index: 1;
}
.fp-back {
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
  background: rgba(255,255,255,.2); border: 1.5px solid rgba(255,255,255,.3);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: #fff; transition: background .18s;
}
.fp-back:hover { background: rgba(255,255,255,.32); }
.fp-head-info { flex: 1; min-width: 0; }
.fp-head-title {
  font-size: 13.5px; font-weight: 800; color: #fff;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  letter-spacing: -.1px;
}
.fp-head-sub {
  font-size: 10.5px; color: rgba(255,255,255,.72); font-weight: 500;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  margin-top: 1px;
}
.fp-count-badge {
  flex-shrink: 0;
  font-size: 10px; font-weight: 800; padding: 3px 9px; border-radius: 20px;
  background: rgba(255,255,255,.2); border: 1px solid rgba(255,255,255,.28);
  color: rgba(255,255,255,.95); white-space: nowrap;
}

/* ── SEARCH ─────────────────────────────────────── */
.fp-search {
  flex-shrink: 0;
  padding: 10px 12px 8px;
  background: #fff;
  border-bottom: 1px solid #f1f5f9;
}
.fp-search-row {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 11px; border-radius: 11px;
  border: 1.5px solid #f1f5f9; background: #f8fafc;
  transition: all .18s;
}
.fp-search-row:focus-within {
  border-color: #6366f1; background: #fff;
  box-shadow: 0 0 0 3px rgba(99,102,241,.09);
}
.fp-search-inp {
  flex: 1; background: none; border: none; outline: none;
  font-size: 12.5px; color: #0f172a;
}
.fp-search-inp::placeholder { color: #94a3b8; }
.fp-clear-btn {
  width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
  background: #e2e8f0; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #64748b; transition: background .15s;
}
.fp-clear-btn:hover { background: #c7d2fe; color: #6366f1; }

/* ── META BAR (results count / notice) ─────────── */
.fp-meta {
  flex-shrink: 0;
  display: flex; align-items: center; gap: 7px;
  padding: 5px 12px 4px;
}
.fp-meta-label { font-size: 10.5px; font-weight: 600; color: #94a3b8; }
.fp-meta-pill  {
  font-size: 10.5px; font-weight: 700; padding: 1px 8px; border-radius: 20px;
  background: rgba(99,102,241,.1); color: #6366f1;
}
.fp-default-notice {
  flex-shrink: 0;
  margin: 6px 10px 2px;
  padding: 7px 11px; border-radius: 10px;
  background: rgba(245,158,11,.07); border: 1px solid rgba(245,158,11,.2);
  font-size: 11.5px; font-weight: 500; color: #92400e;
  display: flex; align-items: center; gap: 6px;
}

/* ── SCROLLABLE LIST ─────────────────────────────
   flex:1 + min-height:0 = fills remaining space and scrolls.
   overflow-y:auto gives the scroll.
   padding-bottom so last item isn't cramped.
── */
.fp-list {
  flex: 1;
  min-height: 0;           /* ← critical: lets flexbox shrink below content size */
  overflow-y: auto;
  padding: 6px 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fp-list::-webkit-scrollbar { width: 4px; }
.fp-list::-webkit-scrollbar-track { background: transparent; }
.fp-list::-webkit-scrollbar-thumb { background: rgba(99,102,241,.2); border-radius: 99px; }
.fp-list::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,.4); }

/* ── FAQ ITEM ────────────────────────────────────
   NO overflow:hidden here — that's what was clipping answers.
   The accordion uses a measured height approach via JS (ref.scrollHeight).
── */
.fp-item {
  background: #fff;
  border-radius: 13px;
  border: 1.5px solid #f1f5f9;
  transition: border-color .18s, box-shadow .18s;
  /* no overflow:hidden — answers must grow freely */
}
.fp-item:hover { border-color: #c7d2fe; box-shadow: 0 3px 12px rgba(99,102,241,.08); }
.fp-item.open  { border-color: #6366f1; box-shadow: 0 3px 14px rgba(99,102,241,.13); }

/* trigger */
.fp-trigger {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 8px; padding: 12px 13px;
  width: 100%; text-align: left; cursor: pointer;
  background: none; border: none;
}
.fp-trigger-left { display: flex; align-items: flex-start; gap: 9px; flex: 1; min-width: 0; }

.fp-num {
  width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
  background: rgba(99,102,241,.1); color: #6366f1;
  display: flex; align-items: center; justify-content: center;
  font-size: 9.5px; font-weight: 800; margin-top: 1px;
  transition: background .2s, color .2s;
}
.fp-item.open .fp-num {
  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
}

.fp-question {
  font-size: 13px; font-weight: 600; color: #374151; line-height: 1.45;
  transition: color .18s; flex: 1; min-width: 0;
  /* allow wrapping — never overflow */
  white-space: normal; word-break: break-word;
}
.fp-item.open .fp-question,
.fp-item:hover .fp-question { color: #4f46e5; }

.fp-chevron {
  flex-shrink: 0; color: #94a3b8; margin-top: 2px;
  transition: transform .3s cubic-bezier(.4,0,.2,1), color .2s;
}
.fp-item.open .fp-chevron { transform: rotate(180deg); color: #6366f1; }

/* ── ANSWER
   Uses grid trick: grid-template-rows 0fr → 1fr.
   Inner div has min-height:0 so it collapses cleanly.
   NO max-height cap — the answer shows 100% always.
── */
.fp-answer-outer {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows .32s cubic-bezier(.4,0,.2,1);
}
.fp-item.open .fp-answer-outer {
  grid-template-rows: 1fr;
}
.fp-answer-inner {
  min-height: 0;
  overflow: hidden;          /* needed here so collapsed state hides content */
}
.fp-answer {
  /* separator line only when open */
  border-top: 1px solid rgba(99,102,241,.1);
  padding: 10px 13px 13px 42px;
  font-size: 12.5px; color: #64748b; line-height: 1.75; font-weight: 400;
  /* full word wrap — never clips */
  white-space: normal; word-break: break-word;
}

/* ── EMPTY STATE ─────────────────────────────── */
.fp-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px; padding: 32px 20px; text-align: center;
}
.fp-empty-ico {
  width: 50px; height: 50px; border-radius: 14px;
  background: rgba(99,102,241,.08); border: 1px solid rgba(99,102,241,.12);
  display: flex; align-items: center; justify-content: center;
}
.fp-empty-title { font-size: 13.5px; font-weight: 700; color: #374151; }
.fp-empty-sub   { font-size: 12px; color: #94a3b8; }

/* ── responsive ─────────────────────────────── */
@media (max-width: 480px) {
  .fp-head       { padding: 8px 11px; }
  .fp-list       { padding: 4px 8px 12px; }
  .fp-trigger    { padding: 10px 11px; }
  .fp-answer     { padding: 9px 11px 11px 38px; }
  .fp-question   { font-size: 12.5px; }
}
`;

const defaultFaqs = [
  {
    question: "What is the purpose of this FAQ section?",
    answer: "This section answers frequently asked questions about the selected subject and unit. If no specific FAQs are available for your selection, this default list is shown instead."
  },
  {
    question: "How can I find more information about a topic?",
    answer: "You can use the 'Ask AI' feature in the right panel to ask specific questions about the course material. The AI can provide detailed explanations, examples, and step-by-step walkthroughs for any concept."
  },
  {
    question: "How are the quizzes generated?",
    answer: "Quizzes are generated based on the content of the selected subject and unit, focusing on key concepts and learning objectives. You can customise the difficulty, number of questions, and time limit before starting."
  },
  {
    question: "Can I revisit my quiz results?",
    answer: "Yes — your recent quiz results are saved locally and can be reviewed from the progress section. Each result includes a score breakdown and an answer review so you can learn from any mistakes."
  },
  {
    question: "How do I mark a question for review during a quiz?",
    answer: "During an active quiz, click the 'Mark for Review' button on any question. The question will be highlighted in amber in the navigator palette, and you can return to it before submitting."
  },
];

const FAQPanel: React.FC<FAQPanelProps> = ({ subject = "", unit, unitId, onBack }) => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [faqs, setFaqs] = useState<any[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const subjectKey = subject.toLowerCase().replace(/\s/g, "_");
  const unitKey = unit.toLowerCase().replace(/\s/g, "-");
  const unitSelected = Boolean(unitId && unit.trim());

  const toTitle = (s: string) =>
    s.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const filtered = search.trim()
    ? faqs.filter((f: any) =>
        f.question.toLowerCase().includes(search.toLowerCase()) ||
        f.answer.toLowerCase().includes(search.toLowerCase())
      )
    : faqs;

  const toggle = (i: number) => setOpenIdx(prev => prev === i ? null : i);

  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!unitSelected) {
        setFaqs([]);
        setIsDefault(false);
        setErrorMessage("");
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const data = await getFaqs(unitId);
        const items = Array.isArray(data?.faqs)
          ? data.faqs
          : Array.isArray(data?.data?.faqs)
            ? data.data.faqs
            : Array.isArray(data)
              ? data
              : Array.isArray(data?.questions)
                ? data.questions
                : Array.isArray(data?.data?.questions)
                  ? data.data.questions
                  : [];

        if (ignore) return;

        if (!items.length) {
          setFaqs([]);
          setIsDefault(false);
          setErrorMessage("No FAQs found for the selected unit.");
          return;
        }

        setFaqs(
          items.map((item: any) => ({
            question: item.question || item.title || item.section_title || "Question",
            answer:
              item.answer ||
              item.response ||
              item.content ||
              item.summary ||
              "No answer available.",
          })),
        );
        setIsDefault(false);
      } catch (error: any) {
        if (ignore) return;
        setFaqs([]);
        setIsDefault(false);
        setErrorMessage(error.message || "Unable to load FAQs right now.");
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [unitId, unitSelected]);

  return (
    <>
      <style>{CSS}</style>
      <div className="fp">

        {/* ── Compact header ── */}
        <div className="fp-head">
          <div className="fp-head-row">
            <button className="fp-back" onClick={onBack} aria-label="Back">
              <ArrowLeft size={14} />
            </button>
            <div className="fp-head-info">
              <div className="fp-head-title">FAQs</div>
              <div className="fp-head-sub">
                {isDefault
                  ? "General questions"
                  : `${toTitle(subjectKey)} · ${toTitle(unitKey)}`}
              </div>
            </div>
            <span className="fp-count-badge">
              {faqs.length} Q&amp;A
            </span>
          </div>
        </div>

        {/* ── Search ── */}
        <div className="fp-search">
          <div className="fp-search-row">
            <Search size={13} style={{ color: "#94a3b8", flexShrink: 0 }} />
            <input
              className="fp-search-inp"
              placeholder="Search questions…"
              value={search}
              onChange={e => { setSearch(e.target.value); setOpenIdx(null); }}
            />
            {search && (
              <button className="fp-clear-btn" onClick={() => { setSearch(""); setOpenIdx(null); }}>
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {/* ── Meta bar ── */}
        {!unitSelected ? (
          <div className="fp-default-notice">
            <MessageCircle size={12} />
            Select the unit to load FAQs.
          </div>
        ) : isDefault ? (
          <div className="fp-default-notice">
            <MessageCircle size={12} />
            {isLoading
              ? "Loading unit FAQs..."
              : errorMessage
                ? `Showing general FAQs - ${errorMessage}`
                : "Showing general FAQs - no unit-specific content found."}
          </div>
        ) : (
          <div className="fp-meta">
            <span className="fp-meta-label">
              {search.trim() ? "Search results" : "All questions"}
            </span>
            <span className="fp-meta-pill">
              {filtered.length}{search.trim() ? ` of ${faqs.length}` : ""}
            </span>
          </div>
        )}

        {/* ── Scrollable FAQ list ── */}
        <div className="fp-list">
          {!unitSelected ? (
            <div className="fp-empty">
              <div className="fp-empty-ico">
                <HelpCircle size={20} style={{ color: "#6366f1" }} />
              </div>
              <div className="fp-empty-title">Select the unit</div>
              <div className="fp-empty-sub">
                Choose a unit first to load FAQs from that unit’s sections.
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="fp-empty">
              <div className="fp-empty-ico">
                <Search size={20} style={{ color: "#6366f1" }} />
              </div>
              <div className="fp-empty-title">No results found</div>
              <div className="fp-empty-sub">
                Try different keywords or{" "}
                <button
                  onClick={() => setSearch("")}
                  style={{ color: "#6366f1", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "inherit", fontFamily: "inherit" }}
                >
                  clear the search
                </button>.
              </div>
            </div>
          ) : (
            filtered.map((faq: any, i: number) => {
              const isOpen = openIdx === i;
              return (
                <div
                  key={`${search}-${i}`}
                  className={`fp-item${isOpen ? " open" : ""}`}
                >
                  {/* Trigger */}
                  <button
                    className="fp-trigger"
                    onClick={() => toggle(i)}
                    aria-expanded={isOpen}
                  >
                    <div className="fp-trigger-left">
                      <span className="fp-num">{i + 1}</span>
                      <span className="fp-question">{faq.question}</span>
                    </div>
                    <ChevronDown size={15} className="fp-chevron" />
                  </button>

                  {/* Answer — grid trick: 0fr ↔ 1fr, no max-height cap */}
                  <div className="fp-answer-outer">
                    <div className="fp-answer-inner">
                      <div className="fp-answer">
                        {faq.answer}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>
    </>
  );
};

export default FAQPanel;
