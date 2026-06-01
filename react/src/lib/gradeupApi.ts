import { buildApiUrl } from "./apiBase";

export type LibraryUnit = {
  id: string;
  subjectGroupKey: string;
  documentId: string;
  board: string;
  standard: string;
  subject: string;
  part?: string | null;
  unitNumber?: number | null;
  unitTitle: string;
  unitLabel: string;
  chapterName?: string | null;
  readerIndex?: {
    sections?: string[];
    hasGlossary?: boolean;
    hasSummary?: boolean;
  };
  sectionTopics?: Array<{
    id: string;
    sectionId?: string | null;
    sectionNumber?: string | null;
    sectionTitle: string;
    label: string;
  }>;
  hasStructuredData: boolean;
  hasEnrichedData: boolean;
};

export type LibrarySubject = {
  id: string;
  subjectGroupKey: string;
  title: string;
  subject: string;
  board: string;
  standard: string;
  part?: string | null;
  unitCount: number;
  visual?: {
    iconKey?: string;
    colorKey?: string;
  };
  coverImageUrl?: string | null;
  imageCandidates?: string[];
  unitNumbers: number[];
  units: LibraryUnit[];
  updatedAt: string;
};

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(buildApiUrl(url), {
    ...init,
    headers: {
      ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
    credentials: "include",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.status === false) {
    throw new Error(payload?.message || `Request failed with ${response.status}`);
  }

  return payload?.data as T;
}

async function apiFetchRaw(url: string, init?: RequestInit) {
  const response = await fetch(buildApiUrl(url), {
    ...init,
    credentials: "include",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.status === false) {
    throw new Error(payload?.message || `Request failed with ${response.status}`);
  }

  return payload?.data;
}

export function getCandidateContext(user: any) {
  return {
    candidateId: String(user?.id || user?._id || user?.email || "guest-user"),
    candidateName:
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      user?.username ||
      user?.email ||
      "GradeUp Learner",
  };
}

export async function getLibrarySubjects(search = "") {
  const params = new URLSearchParams();
  if (search) {
    params.set("search", search);
  }

  return apiFetch<LibrarySubject[]>(
    `/api/v1/library/subjects${params.toString() ? `?${params.toString()}` : ""}`,
  );
}

export async function getLibrarySubjectDetail(subjectGroupKey: string) {
  return apiFetch<LibrarySubject>(
    `/api/v1/library/subjects/${encodeURIComponent(subjectGroupKey)}`,
  );
}

export async function getUnitContent(unitId: string, format: "structured" | "enriched" = "enriched") {
  return apiFetch<{
    unit: LibraryUnit;
    format: "structured" | "enriched";
    content: any;
  }>(`/api/v1/library/units/${encodeURIComponent(unitId)}/content?format=${format}`);
}

export async function askTutor(payload: {
  unitId: string;
  candidateId: string;
  candidateName: string;
  query: string;
  conversationId?: string;
  limit?: number;
}) {
  return apiFetch<any>("/api/v1/tutor/ask", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getTutorHistory(payload: {
  candidateId: string;
  conversationId?: string;
  subjectGroupKey?: string;
}) {
  const params = new URLSearchParams({
    candidateId: payload.candidateId,
  });
  if (payload.conversationId) {
    params.set("conversationId", payload.conversationId);
  }
  if (payload.subjectGroupKey) {
    params.set("subjectGroupKey", payload.subjectGroupKey);
  }

  return apiFetch<any[]>(`/api/v1/tutor/history?${params.toString()}`);
}

export async function getTutorConversations(payload: {
  candidateId: string;
  subjectGroupKey?: string;
}) {
  const params = new URLSearchParams({
    candidateId: payload.candidateId,
  });
  if (payload.subjectGroupKey) {
    params.set("subjectGroupKey", payload.subjectGroupKey);
  }

  return apiFetch<any[]>(`/api/v1/tutor/conversations?${params.toString()}`);
}

export async function getTutorConversation(payload: {
  candidateId: string;
  conversationId: string;
}) {
  const params = new URLSearchParams({
    candidateId: payload.candidateId,
  });

  return apiFetch<any>(`/api/v1/tutor/conversations/${encodeURIComponent(payload.conversationId)}?${params.toString()}`);
}

export async function clearTutorHistory(payload: {
  candidateId: string;
  conversationId?: string;
}) {
  return apiFetch<any>("/api/v1/tutor/history", {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}

export async function getFaqs(unitId: string) {
  return apiFetch<any>(`/api/v1/library/units/${encodeURIComponent(unitId)}/faq`);
}

export async function generateQuiz(payload: {
  unitId: string;
  candidateId: string;
  candidateName: string;
  difficulty: string;
  numQuestions: number;
}) {
  return apiFetch<any>("/api/v1/tutor/quiz/generate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitQuiz(payload: {
  quizId: string;
  candidateId: string;
  answers: Array<{ question_id: string; answer: string }>;
}) {
  return apiFetch<any>("/api/v1/tutor/quiz/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getQuizHistory(payload: {
  unitId?: string;
  candidateId: string;
}) {
  const params = new URLSearchParams({
    candidateId: payload.candidateId,
  });
  if (payload.unitId) {
    params.set("unitId", payload.unitId);
  }

  return apiFetch<any[]>(`/api/v1/tutor/quiz/history?${params.toString()}`);
}

export async function assignHomework(payload: {
  unitId: string;
  candidateId: string;
  candidateName: string;
  numQuestions: number;
}) {
  return apiFetch<any>("/api/v1/tutor/homework/assign", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitHomework(payload: {
  homeworkId: string;
  candidateId: string;
  answers: Array<{ question_id: string; answer: string }>;
}) {
  return apiFetch<any>("/api/v1/tutor/homework/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getHomework(payload: {
  unitId?: string;
  candidateId: string;
  status?: string;
}) {
  const params = new URLSearchParams({
    candidateId: payload.candidateId,
  });
  if (payload.unitId) {
    params.set("unitId", payload.unitId);
  }
  if (payload.status) {
    params.set("status", payload.status);
  }

  return apiFetch<any[]>(`/api/v1/tutor/homework?${params.toString()}`);
}

export async function getPerformance(payload: {
  unitId?: string;
  candidateId: string;
}) {
  const params = new URLSearchParams({
    candidateId: payload.candidateId,
  });
  if (payload.unitId) {
    params.set("unitId", payload.unitId);
  }

  return apiFetch<any>(`/api/v1/tutor/performance?${params.toString()}`);
}

export async function getPerformancePoints(candidateId: string) {
  return apiFetch<any>(`/api/v1/tutor/performance/points?candidateId=${encodeURIComponent(candidateId)}`);
}

export async function startDebate(payload: {
  unitId: string;
  candidateId: string;
  candidateName: string;
  topic: string;
  debateType?: string;
}) {
  return apiFetch<any>("/api/v1/debate/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getDebateTopics(subjectGroupKey?: string) {
  const params = new URLSearchParams();
  if (subjectGroupKey) {
    params.set("subjectGroupKey", subjectGroupKey);
  }
  return apiFetch<
    Array<{
      id: string;
      subjectGroupKey?: string;
      unitId?: string;
      unitNumber?: number | null;
      unitTitle?: string;
      sectionId?: string | null;
      sectionNumber?: string | null;
      sectionTitle?: string;
      label?: string;
      topic?: string;
      title?: string;
      name?: string;
    }>
  >(`/api/v1/debate/topics${params.toString() ? `?${params.toString()}` : ""}`);
}

export async function getDebateSession(sessionId: string) {
  return apiFetch<any>(`/api/v1/debate/session/${encodeURIComponent(sessionId)}`);
}

export async function joinDebateSession(payload: {
  sessionId: string;
  candidateId: string;
  candidateName: string;
}) {
  return apiFetch<any>("/api/v1/debate/join", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createDebateRoom(payload: {
  unitId: string;
  candidateId: string;
  candidateName: string;
  topic: string;
  maxParticipants?: number;
  roomLink?: string;
}) {
  return apiFetch<any>("/api/v1/debate/room/create", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      debateType: "team",
    }),
  });
}

export async function joinDebateRoom(payload: {
  sessionId: string;
  candidateId: string;
  candidateName: string;
}) {
  return apiFetch<any>("/api/v1/debate/room/join", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function startDebateRoom(payload: {
  sessionId: string;
  candidateId: string;
  candidateName: string;
}) {
  return apiFetch<any>("/api/v1/debate/room/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getDebateRoom(sessionId: string) {
  return apiFetch<any>(`/api/v1/debate/room/${encodeURIComponent(sessionId)}`);
}

export async function submitDebateRoomTurn(payload: {
  sessionId: string;
  candidateId: string;
  candidateName: string;
  team?: "A" | "B";
  message: string;
}) {
  return apiFetch<any>("/api/v1/debate/room/submit", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function endDebateRoom(sessionId: string) {
  return apiFetch<any>("/api/v1/debate/room/end", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function retryEndDebateRoom(sessionId: string) {
  return apiFetch<any>("/api/v1/debate/room/end/retry", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function respondDebate(payload: {
  sessionId: string;
  message: string;
}) {
  return apiFetch<any>("/api/v1/debate/respond", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function endDebate(sessionId: string) {
  return apiFetch<any>("/api/v1/debate/end", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function inviteDebate(payload: {
  emails: string[];
  senderName?: string;
  topic: string;
  debateType: string;
  joinUrl: string;
}) {
  return apiFetch<any>("/api/v1/debate/invite", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function transcribeDebateAudio(audioBlob: Blob, language = "en") {
  const formData = new FormData();
  formData.append("audio", audioBlob, "debate-speech.webm");
  formData.append("language", language);

  return apiFetchRaw("/api/v1/debate/speech/transcribe", {
    method: "POST",
    body: formData,
  });
}

export async function synthesizeDebateSpeech(payload: {
  text: string;
  voice?: string;
  format?: string;
}) {
  return apiFetch<any>("/api/v1/debate/speech/speak", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function startSeminar(payload: {
  unitId: string;
  candidateId: string;
  candidateName: string;
  topic: string;
  subject?: string;
  unitNumber?: number;
  board?: string;
  classNumber?: string;
  unitName?: string;
  mode?: string;
  session_mode?: string;
  sessionId?: string;
  liveSessionId?: string;
  file?: File | null;
}) {
  if (payload.file) {
    const form = new FormData();
    form.append("unitId", payload.unitId);
    form.append("candidateId", payload.candidateId);
    form.append("candidateName", payload.candidateName);
    form.append("topic", payload.topic);
    if (payload.subject) form.append("subject", payload.subject);
    if (payload.unitNumber !== undefined && payload.unitNumber !== null) {
      form.append("unitNumber", String(payload.unitNumber));
    }
    if (payload.board) form.append("board", payload.board);
    if (payload.classNumber) form.append("classNumber", payload.classNumber);
    if (payload.unitName) form.append("unitName", payload.unitName);
    if (payload.mode) form.append("mode", payload.mode);
    if (payload.session_mode) form.append("session_mode", payload.session_mode);
    if (payload.sessionId) form.append("sessionId", payload.sessionId);
    if (payload.liveSessionId) form.append("liveSessionId", payload.liveSessionId);
    form.append("file", payload.file);

    return apiFetch<any>("/api/v1/seminar/start", {
      method: "POST",
      body: form,
    });
  }

  return apiFetch<any>("/api/v1/seminar/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createSeminarRoom(payload: {
  unitId: string;
  candidateId: string;
  candidateName: string;
  topic: string;
  roomLink?: string;
  sessionId?: string;
}) {
  return apiFetch<any>("/api/v1/seminar/create-room", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function startSeminarRoom(payload: {
  sessionId: string;
  unitId: string;
  candidateId: string;
  candidateName: string;
  topic: string;
}) {
  return apiFetch<any>("/api/v1/seminar/room/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSeminarTopics(subjectGroupKey?: string) {
  const params = new URLSearchParams();
  if (subjectGroupKey) {
    params.set("subjectGroupKey", subjectGroupKey);
  }
  return apiFetch<any[]>(`/api/v1/seminar/topics${params.toString() ? `?${params.toString()}` : ""}`);
}

export async function getSeminarSession(sessionId: string) {
  return apiFetch<any>(`/api/v1/seminar/session/${encodeURIComponent(sessionId)}`);
}

export async function getActiveSeminarSessions() {
  return apiFetch<any[]>("/api/v1/seminar/active");
}

export async function joinSeminarSession(payload: {
  sessionId: string;
  candidateId: string;
  candidateName: string;
  role?: string;
}) {
  return apiFetch<any>("/api/v1/seminar/join", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function removeSeminarParticipant(payload: {
  sessionId: string;
  candidateId: string;
  participantId: string;
}) {
  return apiFetch<any>("/api/v1/seminar/remove-participant", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function respondSeminar(payload: {
  sessionId: string;
  message?: string;
  transcript?: string;
  silenceSeconds?: number;
}) {
  return apiFetch<any>("/api/v1/seminar/respond", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function guideSeminar(sessionId: string) {
  return apiFetch<any>("/api/v1/seminar/guide", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function startSeminarChat(payload: {
  sessionId: string;
}) {
  return apiFetch<any>("/api/v1/seminar/chat/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function respondSeminarChat(payload: {
  sessionId: string;
  message: string;
}) {
  return apiFetch<any>("/api/v1/seminar/chat/respond", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendSeminarMessage(payload: {
  sessionId: string;
  candidateId: string;
  candidateName: string;
  message: string;
  role?: string;
}) {
  return apiFetch<any>("/api/v1/seminar/message", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function requestSeminarSpeakingAccess(payload: {
  sessionId: string;
  candidateId: string;
  candidateName: string;
}) {
  return apiFetch<any>("/api/v1/seminar/request-speak", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function respondSeminarSpeakingAccess(payload: {
  sessionId: string;
  candidateId: string;
  candidateName: string;
  participantId: string;
  participantName?: string;
  approved: boolean;
}) {
  return apiFetch<any>("/api/v1/seminar/respond-speak", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function endSeminar(sessionId: string) {
  return apiFetch<any>("/api/v1/seminar/end", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function endSeminarWithTranscript(payload: {
  sessionId: string;
  transcript?: string;
}) {
  return apiFetch<any>("/api/v1/seminar/end", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function explainHighlight(payload: {
  unitId: string;
  highlightedText: string;
}) {
  return apiFetch<any>("/api/v1/highlight/explain", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function summarizeHighlight(payload: {
  unitId: string;
  highlightedText: string;
}) {
  return apiFetch<any>("/api/v1/highlight/summarize", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function askHighlight(payload: {
  unitId: string;
  highlightedText: string;
  messages: Array<{ role: string; content: string }>;
}) {
  return apiFetch<any>("/api/v1/highlight/ask", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
