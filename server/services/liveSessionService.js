const LiveSession = require("../model/LiveSession");

function now() {
  return new Date();
}

function toParticipant(candidateId, candidateName, role = "participant", extra = {}) {
  return {
    participantId: String(candidateId),
    name: candidateName || "GradeUp Learner",
    role,
    isAi: Boolean(extra.isAi),
    isHost: Boolean(extra.isHost),
    team: extra.team || null,
    teamOrder: Number.isFinite(extra.teamOrder) ? Number(extra.teamOrder) : null,
    status: extra.status || "waiting",
    warningCount: Number(extra.warningCount || 0),
    warnings: normalizeWarnings(Array.isArray(extra.warnings) ? extra.warnings : []),
    joinedAt: extra.joinedAt || now(),
    lastSeenAt: now(),
  };
}

function normalizeTeamKey(value) {
  if (!value) return null;
  if (value === "A" || value === "team_a" || value === "blue_team") return "A";
  if (value === "B" || value === "team_b" || value === "red_team") return "B";
  return null;
}

function normalizeTeamParticipants(list = [], teamKey) {
  return list.map((item, index) => {
    const value = typeof item === "string" ? { id: item } : item || {};
    return {
    id: String(value.id),
    name: value.name || "Participant",
    team: teamKey,
    teamOrder: index + 1,
    isAi: Boolean(value.isAi || value.id === "__ai_student__"),
  };
  });
}

function normalizeTeams(rawTeams = {}) {
  const teamA = normalizeTeamParticipants(rawTeams.team_a || rawTeams.blue_team || rawTeams.A || [], "A");
  const teamB = normalizeTeamParticipants(rawTeams.team_b || rawTeams.red_team || rawTeams.B || [], "B");
  return {
    A: teamA,
    B: teamB,
  };
}

function normalizeWarnings(warnings = []) {
  if (!Array.isArray(warnings)) return [];
  return warnings.map((warning) => {
    if (typeof warning === "string") return warning;
    // Python returns objects like {message, reason, timestamp} — flatten to a string
    // so Mongoose [String] schema never throws a CastError
    const message =
      warning.message || warning.content || warning.reason || "Warning";
    const reason =
      warning.reason && warning.reason !== message ? ` — ${warning.reason}` : "";
    return `${message}${reason}`;
  });
}

function normalizeSession(session) {
  return {
    id: session.sessionId,
    sessionId: session.sessionId,
    sessionType: session.sessionType,
    topic: session.topic,
    status: session.status,
    subject: session.subject,
    unit: session.unitTitle,
    unitId: session.unitId,
    documentId: session.documentId,
    subjectGroupKey: session.subjectGroupKey,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    debateType: session.debateType,
    hostCandidateId: session.hostCandidateId || null,
    hostCandidateName: session.hostCandidateName || null,
    roomCode: session.roomCode || null,
    shareLink: session.shareLink || null,
    teams: session.teams || null,
    currentRound: session.currentRound || null,
    feedback: session.feedback || null,
    scores: session.scores || null,
    results: session.results || null,
    warnings: session.warnings || [],
    metadata: session.metadata || null,
    participants: (session.participants || []).map((participant) => ({
      id: participant.participantId,
      name: participant.name,
      role: participant.role,
      isAi: participant.isAi,
      isHost: participant.isHost,
      team: participant.team || null,
      teamOrder: participant.teamOrder ?? null,
      status: participant.status || "waiting",
      warningCount: participant.warningCount || 0,
      warnings: participant.warnings || [],
      joinedAt: participant.joinedAt,
      lastSeenAt: participant.lastSeenAt,
    })),
    turns: (session.turns || []).map((turn) => ({
      id: turn.turnId,
      speakerId: turn.speakerId,
      speakerName: turn.speakerName,
      role: turn.role,
      team: turn.team || null,
      turnType: turn.turnType || "message",
      message: turn.message,
      transcript: turn.transcript,
      roundNumber: turn.roundNumber,
      metadata: turn.metadata || null,
      createdAt: turn.createdAt,
    })),
  };
}

function extractScores(feedback = {}) {
  if (!feedback || typeof feedback !== "object") return null;

  const overall =
    feedback.total_score ??
    feedback.overall_score ??
    feedback.score ??
    feedback.scores?.total_score ??
    feedback.scores?.overall_score ??
    null;
  const student =
    feedback.student_score ??
    feedback.user_score ??
    feedback.scores?.student ??
    feedback.scores?.user ??
    feedback.scores?.you ??
    null;
  const ai =
    feedback.ai_score ??
    feedback.opponent_score ??
    feedback.scores?.ai ??
    feedback.scores?.opponent ??
    null;

  if (overall === null && student === null && ai === null) return null;
  return { overall, student, ai };
}

async function upsertSession({
  sessionType,
  sessionId,
  candidateId,
  candidateName,
  topic,
  unit,
  metadata,
  debateType = "1_vs_ai",
  role = "host",
  status = "active",
  hostCandidateId = null,
  hostCandidateName = null,
  roomCode = null,
  shareLink = null,
}) {
  const participant = toParticipant(candidateId, candidateName, role, {
    isHost: role === "host",
    status: status === "waiting" ? "waiting" : "active",
  });
  const session = await LiveSession.findOneAndUpdate(
    { sessionId },
    {
      $setOnInsert: {
        sessionType,
        sessionId,
        candidateId,
        startedAt: now(),
      },
      $set: {
        candidateName,
        topic,
        unitId: unit._id,
        documentId: unit.documentId,
        subjectGroupKey: unit.subjectGroupKey || [unit.board, unit.standard, unit.subject].join("::"),
        board: unit.board,
        standard: unit.standard,
        subject: unit.subject,
        unitNumber: unit.unitNumber,
        unitTitle: unit.unitTitle,
        debateType,
        metadata: metadata || null,
        status,
        hostCandidateId: hostCandidateId || candidateId,
        hostCandidateName: hostCandidateName || candidateName,
        roomCode,
        shareLink,
      },
      $push: {
        participants: {
          $each: [],
        },
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  await touchParticipant({
    sessionId,
    candidateId,
    candidateName,
    role,
    isHost: role === "host",
    status: status === "waiting" ? "waiting" : "active",
  });

  const updated = await LiveSession.findOne({ sessionId });
  return normalizeSession(updated || session);
}

async function appendTurn({
  sessionId,
  speakerId,
  speakerName,
  role,
  team = null,
  turnType = "message",
  message,
  transcript,
  roundNumber = null,
  metadata = null,
}) {
  const turn = {
    turnId: `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    speakerId: speakerId || null,
    speakerName: speakerName || null,
    role: role || "user",
    team,
    turnType,
    message: message || null,
    transcript: transcript || null,
    roundNumber,
    metadata,
    createdAt: now(),
  };

  const session = await LiveSession.findOneAndUpdate(
    { sessionId },
    {
      $push: { turns: turn },
      $set: { updatedAt: now() },
    },
    { new: true },
  );

  return session ? normalizeSession(session) : null;
}

async function touchParticipant({
  sessionId,
  candidateId,
  candidateName,
  role = "participant",
  isHost = false,
  isAi = false,
  team = null,
  teamOrder = null,
  status = "waiting",
  warningCount = 0,
  warnings = [],
}) {
  const session = await LiveSession.findOne({ sessionId });
  if (!session) return null;

  const existing = (session.participants || []).find(
    (participant) => participant.participantId === String(candidateId),
  );

  if (existing) {
    existing.name = candidateName || existing.name;
    existing.role = role || existing.role;
    existing.isHost = Boolean(isHost || existing.isHost);
    existing.isAi = Boolean(isAi || existing.isAi);
    existing.team = normalizeTeamKey(team) || existing.team || null;
    existing.teamOrder = Number.isFinite(teamOrder) ? Number(teamOrder) : existing.teamOrder;
    existing.status = status || existing.status || "waiting";
    existing.warningCount = Number.isFinite(warningCount) ? Number(warningCount) : existing.warningCount || 0;
    existing.warnings = Array.isArray(warnings) && warnings.length
      ? normalizeWarnings(warnings)
      : existing.warnings || [];
    existing.lastSeenAt = now();
  } else {
    session.participants.push(
      toParticipant(candidateId, candidateName, role, {
        isHost,
        isAi,
        team: normalizeTeamKey(team),
        teamOrder,
        status,
        warningCount,
        warnings,
      }),
    );
  }

  await session.save();
  return normalizeSession(session);
}

async function createRoomSession({
  sessionId,
  candidateId,
  candidateName,
  topic,
  unit,
  metadata,
  roomCode = null,
  shareLink = null,
}) {
  return upsertSession({
    sessionType: "debate",
    sessionId,
    candidateId,
    candidateName,
    topic,
    unit,
    metadata,
    debateType: "team",
    role: "host",
    status: "waiting",
    hostCandidateId: candidateId,
    hostCandidateName: candidateName,
    roomCode,
    shareLink,
  });
}

async function startRoomSession({
  sessionId,
  teams,
  aiOpening,
  warnings = [],
  metadata = null,
}) {
  const session = await LiveSession.findOne({ sessionId });
  if (!session) return null;

  const normalizedTeams = normalizeTeams(teams);
  const teamMap = new Map();
  normalizedTeams.A.forEach((participant) => {
    teamMap.set(String(participant.id), participant);
  });
  normalizedTeams.B.forEach((participant) => {
    teamMap.set(String(participant.id), participant);
  });

  session.status = "active";
  session.startedAt = session.startedAt || now();
  session.teams = normalizedTeams;
  session.currentRound = {
    roundNumber: 1,
    phase: "ai_opening",
    activeTeam: "A",
    awaitingTeams: ["A", "B"],
    currentSpeakerId: normalizedTeams.A.find((participant) => !participant.isAi)?.id || null,
    latestAiMessage: aiOpening || null,
  };
  session.warnings = normalizeWarnings(warnings);
  session.metadata = metadata || session.metadata;

  session.participants = (session.participants || []).map((participant) => {
    const teamMeta = teamMap.get(String(participant.participantId));
    if (!teamMeta) {
      participant.status = "active";
      return participant;
    }
    participant.team = teamMeta.team;
    participant.teamOrder = teamMeta.teamOrder;
    participant.isAi = Boolean(teamMeta.isAi || participant.isAi);
    participant.status = "active";
    return participant;
  });

  for (const teamKey of ["A", "B"]) {
    normalizedTeams[teamKey].forEach((participant) => {
      if (!session.participants.find((item) => item.participantId === String(participant.id))) {
        session.participants.push(
          toParticipant(participant.id, participant.name, "participant", {
            isAi: participant.isAi,
            team: teamKey,
            teamOrder: participant.teamOrder,
            status: "active",
          }),
        );
      }
    });
  }

  await session.save();
  if (aiOpening) {
    await appendTurn({
      sessionId,
      speakerId: "ai-moderator",
      speakerName: "AI Moderator",
      role: "moderator",
      turnType: "opening",
      message: aiOpening,
      transcript: aiOpening,
      roundNumber: 0,
    });
  }

  const updated = await LiveSession.findOne({ sessionId });
  return updated ? normalizeSession(updated) : null;
}

async function updateRoomState(sessionId, patch = {}) {
  const session = await LiveSession.findOneAndUpdate(
    { sessionId },
    { $set: patch },
    { new: true },
  );
  return session ? normalizeSession(session) : null;
}

async function saveRoomRoundSubmission({
  sessionId,
  candidateId,
  candidateName,
  team,
  message,
  roundNumber,
  metadata = null,
  warnings = [],
}) {
  const normalizedTeam = normalizeTeamKey(team);
  const liveSession = await appendTurn({
    sessionId,
    speakerId: candidateId,
    speakerName: candidateName,
    role: normalizedTeam === "A" ? "team_a" : "team_b",
    team: normalizedTeam,
    turnType: "submission",
    message,
    transcript: message,
    roundNumber,
    metadata,
  });

  if (!liveSession) return null;

  const session = await LiveSession.findOne({ sessionId });
  if (!session) return null;

  const currentRound = session.currentRound || {
    roundNumber: roundNumber || 1,
    phase: "team_turn",
    activeTeam: normalizedTeam,
    awaitingTeams: ["A", "B"],
  };
  const awaitingTeams = Array.isArray(currentRound.awaitingTeams)
    ? currentRound.awaitingTeams.filter((item) => item !== normalizedTeam)
    : [];

  currentRound.roundNumber = roundNumber || currentRound.roundNumber || 1;
  currentRound.phase = awaitingTeams.length ? "team_turn" : "waiting_for_ai";
  currentRound.awaitingTeams = awaitingTeams;
  currentRound.lastSubmission = {
    team: normalizedTeam,
    candidateId,
    candidateName,
    message,
    createdAt: now(),
  };
  session.currentRound = currentRound;
  if (warnings.length) {
    session.warnings = [...(session.warnings || []), ...normalizeWarnings(warnings)];
  }

  const participant = session.participants.find((item) => item.participantId === String(candidateId));
  if (participant) {
    participant.status = "active";
    participant.team = normalizedTeam || participant.team;
    participant.lastSeenAt = now();
  }

  await session.save();
  return normalizeSession(session);
}

async function saveRoomAiResponse({
  sessionId,
  message,
  roundNumber,
  metadata = null,
  nextSpeakerId = null,
  nextTeam = null,
}) {
  await appendTurn({
    sessionId,
    speakerId: "ai-moderator",
    speakerName: "AI Moderator",
    role: "moderator",
    turnType: "ai_response",
    message,
    transcript: message,
    roundNumber,
    metadata,
  });

  const session = await LiveSession.findOne({ sessionId });
  if (!session) return null;

  const currentRound = session.currentRound || {};
  currentRound.phase = "team_turn";
  currentRound.roundNumber = Number(roundNumber || currentRound.roundNumber || 1) + 1;
  currentRound.awaitingTeams = ["A", "B"];
  currentRound.activeTeam = normalizeTeamKey(nextTeam) || "A";
  currentRound.currentSpeakerId = nextSpeakerId || null;
  currentRound.latestAiMessage = message;
  session.currentRound = currentRound;
  session.status = "active";

  await session.save();
  return normalizeSession(session);
}

async function completeSession(sessionId, patch = {}) {
  const session = await LiveSession.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        status: "completed",
        endedAt: now(),
        ...patch,
      },
    },
    { new: true },
  );

  return session ? normalizeSession(session) : null;
}

async function saveFeedback(sessionId, feedback, metadata = null) {
  const session = await LiveSession.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        feedback: feedback || null,
        scores: extractScores(feedback),
        results: feedback || null,
        ...(metadata ? { metadata } : {}),
      },
    },
    { new: true },
  );

  return session ? normalizeSession(session) : null;
}

async function getSession(sessionId) {
  const session = await LiveSession.findOne({ sessionId });
  return session ? normalizeSession(session) : null;
}

async function listSessionTopics({ sessionType, subjectGroupKey }) {
  const query = { sessionType };
  if (subjectGroupKey) query.subjectGroupKey = subjectGroupKey;

  const sessions = await LiveSession.find(query).sort({ updatedAt: -1 }).limit(100);
  const uniqueTopics = new Map();

  sessions.forEach((session) => {
    if (!uniqueTopics.has(session.topic)) {
      uniqueTopics.set(session.topic, {
        topic: session.topic,
        subject: session.subject,
        unit: session.unitTitle,
        subjectGroupKey: session.subjectGroupKey,
        lastUsedAt: session.updatedAt,
      });
    }
  });

  return [...uniqueTopics.values()];
}

async function listActiveSessions({ sessionType }) {
  const sessions = await LiveSession.find({
    sessionType,
    status: { $in: ["waiting", "active", "waiting_for_ai"] },
  })
    .sort({ updatedAt: -1 })
    .limit(100);

  return sessions.map((session) => {
    const normalized = normalizeSession(session);
    const observers = (normalized.participants || []).filter((participant) => participant.role === "observer");
    const presenters = (normalized.participants || []).filter(
      (participant) => participant.role !== "observer" && !participant.isAi,
    );

    return {
      id: normalized.sessionId,
      sessionId: normalized.sessionId,
      title: normalized.topic,
      subject: normalized.subject,
      unit: normalized.unit,
      presenterName: normalized.hostCandidateName || presenters[0]?.name || null,
      status: normalized.status,
      observerCount: observers.length,
      participantCount: presenters.length,
      roomLink: normalized.shareLink || normalized.sessionId,
      updatedAt: normalized.metadata?.updatedAt || normalized.startedAt || null,
    };
  });
}

module.exports = {
  appendTurn,
  completeSession,
  createRoomSession,
  extractScores,
  getSession,
  listActiveSessions,
  listSessionTopics,
  normalizeSession,
  normalizeTeamKey,
  normalizeTeams,
  saveFeedback,
  saveRoomAiResponse,
  saveRoomRoundSubmission,
  startRoomSession,
  touchParticipant,
  updateRoomState,
  upsertSession,
};