const { callPython } = require("../services/pythonGateway");
const { sendEmail } = require("../config/EmailTransporter");
const { getDebateInviteEmail } = require("../config/EmailTemplate");
const {
  resolveSubjectUnit,
  getPythonLearningContext,
  listSectionTopicsForSubjectGroup,
} = require("../services/learningContextService");
const {
  createRoomSession,
  upsertSession,
  appendTurn,
  touchParticipant,
  completeSession,
  getSession,
  listSessionTopics,
  saveFeedback,
  startRoomSession,
  saveRoomRoundSubmission,
  saveRoomAiResponse,
  updateRoomState,
  normalizeTeamKey,
  normalizeTeams,
} = require("../services/liveSessionService");

function getCandidate(source = {}) {
  return {
    candidate_id: source.candidateId || source.candidate_id || "guest-user",
    candidate_name: source.candidateName || source.candidate_name || "GradeUp Learner",
  };
}

async function getContext(source = {}) {
  const unit = await resolveSubjectUnit({
    unitId: source.unitId || source.subjectUnitId,
    documentId: source.documentId,
    subjectGroupKey: source.subjectGroupKey,
    unitNumber: source.unitNumber || source.unit_number,
    subject: source.subject,
    unitTitle: source.unitTitle || source.unitName,
  });

  return { unit, context: getPythonLearningContext(unit) };
}

function isTeamDebateRequest(source = {}, liveSession = null) {
  return (
    source.debateType === "team" ||
    source.subMode === "multi" ||
    liveSession?.debateType === "team"
  );
}

function buildJoinCode(sessionId) {
  return String(sessionId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-8)
    .toUpperCase();
}

function normalizeRoomWarnings(room = {}, respondData = null) {
  const warnings = [];

  if (respondData?.ai_moderation) {
    warnings.push({
      type: "warning",
      message: respondData.ai_moderation,
      candidateId: respondData.candidate_id || null,
      createdAt: new Date(),
    });
  }

  (room.messages || [])
    .filter((message) => message.type === "warning" || message.type === "removal")
    .slice(-5)
    .forEach((message) => {
      warnings.push({
        type: message.type,
        message: message.content,
        candidateId: message.target_candidate || message.candidate_id || null,
        createdAt: message.timestamp || new Date(),
      });
    });

  return warnings;
}

function findLatestAiMessage(room = {}) {
  const latest = [...(room.messages || [])]
    .reverse()
    .find(
      (message) =>
        message.role === "moderator" ||
        (message.role === "student" && message.candidate_id === "__ai_student__"),
    );

  return latest ? latest.content : null;
}

function toTeamList(team = [], teamKey) {
  return (team || []).map((participant, index) => ({
    id: String(participant.id),
    name: participant.name || "Participant",
    team: teamKey,
    teamOrder: index + 1,
    isAi: participant.id === "__ai_student__",
    isHost: false,
    status: "active",
  }));
}

function mapRoomTeams(data = {}) {
  const normalized = normalizeTeams(data.teams || {});
  const teamA = normalized.A.length ? normalized.A : toTeamList(data.teams?.blue_team || [], "A");
  const teamB = normalized.B.length ? normalized.B : toTeamList(data.teams?.red_team || [], "B");
  return { A: teamA, B: teamB };
}

function ensureBalancedTeamsForRoom(baseTeams = {}, liveSession = null) {
  const humans = (liveSession?.participants || [])
    .filter((participant) => participant.role !== "observer" && !participant.isAi && participant.status !== "removed")
    .map((participant) => ({
      id: String(participant.id || participant.participantId),
      name: participant.name || "Participant",
      isHost: Boolean(participant.isHost),
      status: participant.status || "active",
    }))
    .sort((left, right) => {
      if (Boolean(left.isHost) !== Boolean(right.isHost)) {
        return left.isHost ? -1 : 1;
      }
      return String(left.name || "").localeCompare(String(right.name || ""));
    });

  const teamA = [];
  const teamB = [];
  humans.forEach((participant, index) => {
    const targetTeam = index % 2 === 0 ? "A" : "B";
    const target = targetTeam === "A" ? teamA : teamB;
    target.push({
      ...participant,
      team: targetTeam,
      teamOrder: target.length + 1,
      isAi: false,
    });
  });

  if (teamA.length !== teamB.length) {
    const target = teamA.length < teamB.length ? teamA : teamB;
    const teamKey = target === teamA ? "A" : "B";
    target.push({
      id: "__ai_student__",
      name: "AI Participant",
      team: teamKey,
      teamOrder: target.length + 1,
      isAi: true,
      isHost: false,
      status: "active",
    });
  }

  if (teamA.length || teamB.length) {
    return { A: teamA, B: teamB };
  }

  return baseTeams;
}

function getSpeakerProgress(turns = [], team, participantId) {
  return turns.filter(
    (turn) =>
      turn.turnType === "submission" &&
      normalizeTeamKey(turn.team) === team &&
      String(turn.speakerId) === String(participantId),
  ).length;
}

function pickNextSpeaker(liveSession, team) {
  const normalizedTeam = normalizeTeamKey(team) || "A";
  const teamParticipants = (liveSession?.participants || [])
    .filter(
      (participant) =>
        normalizeTeamKey(participant.team) === normalizedTeam &&
        !participant.isAi &&
        participant.status !== "removed",
    )
    .sort((a, b) => {
      const aTurns = getSpeakerProgress(liveSession?.turns || [], normalizedTeam, a.id || a.participantId);
      const bTurns = getSpeakerProgress(liveSession?.turns || [], normalizedTeam, b.id || b.participantId);
      if (aTurns !== bTurns) return aTurns - bTurns;
      const aOrder = Number.isFinite(a.teamOrder) ? a.teamOrder : 999;
      const bOrder = Number.isFinite(b.teamOrder) ? b.teamOrder : 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  return teamParticipants[0] || null;
}

function buildRoomSnapshot(pythonRoom, liveSession) {
  const participantCount = liveSession?.participants?.filter((participant) => !participant.isAi).length || 0;
  return {
    ...(pythonRoom || {}),
    liveSession,
    participantCount,
    waitingForHost: liveSession?.status === "waiting",
    currentSpeakerId: liveSession?.currentRound?.currentSpeakerId || null,
    activeTeam: liveSession?.currentRound?.activeTeam || null,
  };
}

async function fetchRoomState(sessionId) {
  const [pythonRoom, liveSession] = await Promise.all([
    callPython({
      path: `/debate/room/${encodeURIComponent(sessionId)}`,
    }).catch(() => null),
    getSession(sessionId),
  ]);

  return buildRoomSnapshot(pythonRoom, liveSession);
}

async function syncRoomParticipantsFromPython(sessionId, pythonRoom) {
  const participants = pythonRoom?.participants || {};
  const entries = Array.isArray(participants)
    ? participants.map((item) => [item.id, item])
    : Object.entries(participants);

  for (const [candidateId, participant] of entries) {
    await touchParticipant({
      sessionId,
      candidateId,
      candidateName: participant.candidate_name || participant.name,
      role: participant.is_ai_student ? "assistant" : "participant",
      isAi: Boolean(participant.is_ai_student),
      status: participant.status || "active",
      team: participant.team,
      warningCount: participant.warning_count || 0,
      warnings: participant.off_topic_warnings || [],
    });
  }
}

const controller = {
  async start(req, res) {
    try {
      const candidate = getCandidate(req.body);
      const { unit, context } = await getContext(req.body);
      const isTeamDebate = isTeamDebateRequest(req.body);

      if (isTeamDebate) {
        const roomData = await callPython({
          method: "post",
          path: "/debate/room/create",
          data: {
            ...candidate,
            subject: context.subject,
            unit_number: context.unitNumber,
            board: context.board,
            class_number: context.classNumber,
            unit_name: context.unitName,
            topic: req.body.topic,
            max_participants: Number(req.body.maxParticipants || 8),
          },
        });

        const sessionId =
          roomData?.session_id || roomData?.sessionId || `debate-room-${candidate.candidate_id}-${Date.now()}`;
        const roomCode = buildJoinCode(sessionId);
        const liveSession = await createRoomSession({
          sessionId,
          candidateId: candidate.candidate_id,
          candidateName: candidate.candidate_name,
          topic: req.body.topic,
          unit,
          metadata: roomData,
          roomCode,
          shareLink: req.body.roomLink || null,
        });

        return res.status(200).json({
          status: true,
          data: {
            ...roomData,
            session_id: sessionId,
            sessionId,
            roomCode,
            liveSession,
          },
        });
      }

      const data = await callPython({
        method: "post",
        path: "/debate/start",
        data: {
          ...candidate,
          subject: context.subject,
          unit_number: context.unitNumber,
          board: context.board,
          class_number: context.classNumber,
          unit_name: context.unitName,
          topic: req.body.topic,
        },
      });

      const storedSession = await upsertSession({
        sessionType: "debate",
        sessionId: data?.session_id || data?.sessionId || `debate-${candidate.candidate_id}-${Date.now()}`,
        candidateId: candidate.candidate_id,
        candidateName: candidate.candidate_name,
        topic: req.body.topic,
        unit,
        metadata: data,
        debateType: req.body.debateType || "1_vs_ai",
      });

      return res.status(200).json({ status: true, data: { ...data, liveSession: storedSession } });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to start debate",
      });
    }
  },

  async createRoom(req, res) {
    return controller.start(req, res);
  },

  async respond(req, res) {
    try {
      const liveSession = await getSession(req.body.sessionId || req.body.session_id);
      if (isTeamDebateRequest(req.body, liveSession)) {
        return controller.submitRoomTurn(req, res);
      }

      const candidate = getCandidate(req.body);
      const data = await callPython({
        method: "post",
        path: "/debate/respond",
        data: {
          session_id: req.body.sessionId || req.body.session_id,
          message: req.body.message,
        },
      });

      const touchedSession = await touchParticipant({
        sessionId: req.body.sessionId || req.body.session_id,
        candidateId: candidate.candidate_id,
        candidateName: candidate.candidate_name,
        status: "active",
      });

      const updatedSession = await appendTurn({
        sessionId: req.body.sessionId || req.body.session_id,
        speakerId: candidate.candidate_id,
        speakerName: candidate.candidate_name,
        role: req.body.role || "user",
        message: req.body.message,
        transcript: req.body.transcript || req.body.message,
      });

      const aiReply =
        data?.ai_response ||
        data?.ai_greeting ||
        data?.response ||
        data?.reply ||
        data?.message ||
        data?.answer;

      if (aiReply) {
        await appendTurn({
          sessionId: req.body.sessionId || req.body.session_id,
          speakerId: "ai-debater",
          speakerName: "AI Debater",
          role: "assistant",
          message: aiReply,
          transcript: aiReply,
        });
      }

      return res.status(200).json({ status: true, data: { ...data, liveSession: updatedSession || touchedSession } });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to send debate response",
      });
    }
  },

  async join(req, res) {
    try {
      const candidate = getCandidate(req.body);
      const liveSession = await getSession(req.body.sessionId || req.body.session_id);

      if (isTeamDebateRequest(req.body, liveSession)) {
        const existingParticipant = (liveSession?.participants || []).find(
          (participant) => String(participant.id) === String(candidate.candidate_id),
        );
        const roomStatus = liveSession?.status;
        const hasStarted = roomStatus === "active" || roomStatus === "waiting_for_ai" || roomStatus === "completed";

        if (hasStarted && !existingParticipant) {
          return res.status(403).json({
            status: false,
            message: roomStatus === "completed"
              ? "This debate has already ended."
              : "This debate has already started. New participants cannot join now.",
          });
        }

        if (existingParticipant) {
          const refreshedSession = await touchParticipant({
            sessionId: req.body.sessionId || req.body.session_id,
            candidateId: candidate.candidate_id,
            candidateName: candidate.candidate_name,
            status: hasStarted ? "active" : "waiting",
          });

          return res.status(200).json({
            status: true,
            data: {
              liveSession: refreshedSession,
            },
          });
        }

        const roomData = await callPython({
          method: "post",
          path: "/debate/room/join",
          data: {
            session_id: req.body.sessionId || req.body.session_id,
            candidate_id: candidate.candidate_id,
            candidate_name: candidate.candidate_name,
          },
        });

        await touchParticipant({
          sessionId: req.body.sessionId || req.body.session_id,
          candidateId: candidate.candidate_id,
          candidateName: candidate.candidate_name,
          status: hasStarted ? "active" : "waiting",
        });

        const updatedSession = await getSession(req.body.sessionId || req.body.session_id);
        return res.status(200).json({
          status: true,
          data: {
            ...roomData,
            liveSession: updatedSession,
          },
        });
      }

      const updatedSession = await touchParticipant({
        sessionId: req.body.sessionId || req.body.session_id,
        candidateId: candidate.candidate_id,
        candidateName: candidate.candidate_name,
        status: "active",
      });

      return res.status(200).json({ status: true, data: { liveSession: updatedSession } });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to join debate session",
      });
    }
  },

  async joinRoom(req, res) {
    return controller.join(req, res);
  },

  async startRoom(req, res) {
    try {
      const sessionId = req.body.sessionId || req.body.session_id;
      const candidate = getCandidate(req.body);
      const liveSession = await getSession(sessionId);

      if (!liveSession) {
        return res.status(404).json({ status: false, message: "Debate session not found" });
      }

      if (String(liveSession.hostCandidateId) !== String(candidate.candidate_id)) {
        return res.status(403).json({
          status: false,
          message: "Only the host can start the debate.",
        });
      }

      const data = await callPython({
        method: "post",
        path: "/debate/room/start",
        data: { session_id: sessionId },
      });

      const teams = ensureBalancedTeamsForRoom(mapRoomTeams(data), liveSession);
      const updatedSession = await startRoomSession({
        sessionId,
        teams,
        aiOpening: data.ai_opening,
        metadata: {
          ...(liveSession.metadata || {}),
          ...data,
          hasAiStudent: Boolean(data.has_ai_student),
        },
      });

      return res.status(200).json({
        status: true,
        data: {
          ...data,
          liveSession: updatedSession,
        },
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to start debate room",
      });
    }
  },

  async submitRoomTurn(req, res) {
    try {
      const sessionId = req.body.sessionId || req.body.session_id;
      const candidate = getCandidate(req.body);
      const liveSession = await getSession(sessionId);
      if (!liveSession) {
        return res.status(404).json({ status: false, message: "Debate session not found" });
      }

      const team = normalizeTeamKey(req.body.team) || normalizeTeamKey(req.body.role) || normalizeTeamKey(
        liveSession.participants.find((participant) => String(participant.id) === String(candidate.candidate_id))?.team,
      );

      if (!team) {
        return res.status(400).json({ status: false, message: "Participant team is not assigned yet." });
      }

      const currentRound = liveSession.currentRound || {};
      const activeTeam = normalizeTeamKey(currentRound.activeTeam) || "A";
      const currentSpeakerId = currentRound.currentSpeakerId;

      if (activeTeam && activeTeam !== team) {
        return res.status(409).json({
          status: false,
          message: `It is Team ${activeTeam}'s turn right now.`,
        });
      }

      if (currentSpeakerId && String(currentSpeakerId) !== String(candidate.candidate_id)) {
        return res.status(409).json({
          status: false,
          message: "It is not your turn to speak yet.",
        });
      }

      // Wrap Python respond in try/catch so a 500 (e.g. Qdrant timeout,
      // OpenAI error) does NOT abort the turn. The message is always saved
      // and the next speaker is always picked — Python failure surfaces as a
      // visible warning, not a frozen turn.
      let pythonRespond = null;
      let pythonRespondWarning = null;
      try {
        pythonRespond = await callPython({
          method: "post",
          path: "/debate/room/respond",
          data: {
            session_id: sessionId,
            candidate_id: candidate.candidate_id,
            message: req.body.message,
          },
        });
      } catch (pythonErr) {
        // Non-fatal: record the error as a warning and continue advancing the turn
        pythonRespondWarning = pythonErr?.message || "AI moderation temporarily unavailable.";
        console.warn("[DEBATE] Python respond failed (non-fatal):", pythonRespondWarning);
      }

      const pythonRoom = await callPython({
        path: `/debate/room/${encodeURIComponent(sessionId)}`,
      }).catch(() => null);

      if (pythonRoom) {
        await syncRoomParticipantsFromPython(sessionId, pythonRoom);
      }

      const warnings = normalizeRoomWarnings(pythonRoom, {
        ...pythonRespond,
        candidate_id: candidate.candidate_id,
      });

      // Wrap saveRoomRoundSubmission so a Mongoose validation error (e.g. the
      // [String] cast error when Python returns warning objects) never aborts the
      // turn. The turn message is always saved and the next speaker always advances.
      let updatedAfterTurn;
      let saveWarning = null;
      try {
        updatedAfterTurn = await saveRoomRoundSubmission({
          sessionId,
          candidateId: candidate.candidate_id,
          candidateName: candidate.candidate_name,
          team,
          message: req.body.message,
          roundNumber: currentRound.roundNumber || 1,
          metadata: pythonRespond,
          warnings,
        });
      } catch (saveErr) {
        // Log for debugging but continue — fetch the latest session state so
        // we can still advance to the next speaker
        console.warn("[DEBATE] saveRoomRoundSubmission failed (non-fatal):", saveErr?.message);
        saveWarning = saveErr?.message || "Session save partially failed.";
        updatedAfterTurn = await getSession(sessionId).catch(() => null);
      }

      const remainingTeams = updatedAfterTurn?.currentRound?.awaitingTeams || [];
      if (remainingTeams.length) {
        const nextTeam = remainingTeams[0];
        const nextSpeaker = pickNextSpeaker(updatedAfterTurn, nextTeam);
        const pending = await updateRoomState(sessionId, {
          status: "active",
          currentRound: {
            ...(updatedAfterTurn?.currentRound || {}),
            phase: "team_turn",
            activeTeam: nextTeam,
            currentSpeakerId: nextSpeaker?.id || null,
          },
        });

        return res.status(200).json({
          status: true,
          data: {
            ...(pythonRespond || {}),
            warnings,
            pythonWarning: pythonRespondWarning || saveWarning || null,
            liveSession: pending,
            waitingForAi: false,
          },
        });
      }

      await updateRoomState(sessionId, { status: "waiting_for_ai" });

      let aiResponse = findLatestAiMessage(pythonRoom);
      let aiPayload = null;
      const hasAiStudent = Boolean(updatedAfterTurn?.metadata?.hasAiStudent || liveSession?.metadata?.hasAiStudent);

      if (hasAiStudent) {
        aiPayload = await callPython({
          method: "post",
          path: "/debate/room/ai-student",
          data: { session_id: sessionId },
        }).catch(() => null);
        aiResponse =
          aiPayload?.ai_response ||
          aiPayload?.response ||
          aiPayload?.message ||
          aiResponse;
      }

      const nextRoundTeam = "A";
      const refreshedSession = await getSession(sessionId);
      const nextSpeaker = pickNextSpeaker(refreshedSession || updatedAfterTurn, nextRoundTeam);

      let finalSession;
      if (aiResponse) {
        finalSession = await saveRoomAiResponse({
          sessionId,
          message: aiResponse,
          roundNumber: currentRound.roundNumber || 1,
          metadata: aiPayload,
          nextSpeakerId: nextSpeaker?.id || null,
          nextTeam: nextRoundTeam,
        });
      } else {
        finalSession = await updateRoomState(sessionId, {
          status: "active",
          currentRound: {
            ...(updatedAfterTurn?.currentRound || {}),
            phase: "team_turn",
            roundNumber: Number(currentRound.roundNumber || 1) + 1,
            awaitingTeams: ["A", "B"],
            activeTeam: nextRoundTeam,
            currentSpeakerId: nextSpeaker?.id || null,
          },
        });
      }

      return res.status(200).json({
        status: true,
        data: {
          ...(pythonRespond || {}),
          warnings,
          aiResponse: aiResponse || null,
          pythonWarning:
            pythonRespondWarning ||
            saveWarning ||
            (!aiResponse && !hasAiStudent
              ? "Python room API did not return a round-level AI response for this even-team room."
              : null),
          waitingForAi: false,
          liveSession: finalSession,
        },
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to submit debate turn",
      });
    }
  },

  async end(req, res) {
    try {
      const sessionId = req.body.sessionId || req.body.session_id;
      const liveSession = await getSession(sessionId);
      if (isTeamDebateRequest(req.body, liveSession)) {
        return controller.endRoom(req, res);
      }

      const data = await callPython({
        method: "post",
        path: "/debate/end",
        data: {
          session_id: sessionId,
        },
      });

      await saveFeedback(sessionId, data, data);
      const updatedSession = await completeSession(sessionId);
      return res.status(200).json({ status: true, data: { ...data, liveSession: updatedSession } });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to end debate",
      });
    }
  },

  async endRoom(req, res) {
    try {
      const sessionId = req.body.sessionId || req.body.session_id;
      await updateRoomState(sessionId, { status: "ending" });
      const data = await callPython({
        method: "post",
        path: "/debate/room/end",
        data: { session_id: sessionId },
      });

      await saveFeedback(sessionId, data, data);
      const updatedSession = await completeSession(sessionId, {
        results: data,
        teams: normalizeTeams(data.teams || {}),
      });
      return res.status(200).json({
        status: true,
        data: {
          ...data,
          liveSession: updatedSession,
        },
      });
    } catch (error) {
      const sessionId = req.body.sessionId || req.body.session_id;
      if (sessionId) {
        await updateRoomState(sessionId, { status: "end_error" }).catch(() => null);
      }
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to end debate room",
      });
    }
  },

  async retryEndRoom(req, res) {
    return controller.endRoom(req, res);
  },

  async getSession(req, res) {
    try {
      const liveSession = await getSession(req.params.sessionId);
      if (liveSession?.debateType === "team") {
        const snapshot = await fetchRoomState(req.params.sessionId);
        return res.status(200).json({ status: true, data: snapshot });
      }

      const [pythonSession, storedSession] = await Promise.all([
        callPython({
          path: `/debate/session/${encodeURIComponent(req.params.sessionId)}`,
        }).catch(() => null),
        getSession(req.params.sessionId),
      ]);

      return res.status(200).json({ status: true, data: { ...(pythonSession || {}), liveSession: storedSession } });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to fetch debate session",
      });
    }
  },

  async getRoom(req, res) {
    try {
      const snapshot = await fetchRoomState(req.params.sessionId);
      return res.status(200).json({ status: true, data: snapshot });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to fetch debate room",
      });
    }
  },

  async getHistory(req, res) {
    try {
      const data = await callPython({
        path: `/debate/history/${encodeURIComponent(req.query.candidateId || req.query.candidate_id)}`,
        params: {
          subject: req.query.subject,
        },
      });

      return res.status(200).json({ status: true, data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to fetch debate history",
      });
    }
  },

  async getRecommendations(req, res) {
    try {
      const data = await callPython({
        path: `/debate/recommendations/${encodeURIComponent(req.params.sessionId)}`,
      });

      return res.status(200).json({ status: true, data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to fetch debate recommendations",
      });
    }
  },

  async getTopics(req, res) {
    try {
      let data = [];

      if (req.query.subjectGroupKey) {
        data = await listSectionTopicsForSubjectGroup(req.query.subjectGroupKey);
      } else {
        data = await listSessionTopics({
          sessionType: "debate",
          subjectGroupKey: req.query.subjectGroupKey,
        });
      }

      return res.status(200).json({ status: true, data });
    } catch (error) {
      return res.status(500).json({
        status: false,
        message: error.message || "Failed to fetch debate topics",
      });
    }
  },

  async invite(req, res) {
    try {
      const emails = Array.isArray(req.body.emails)
        ? req.body.emails
        : String(req.body.emails || "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);

      if (!emails.length) {
        return res.status(400).json({
          status: false,
          message: "At least one email address is required",
        });
      }

      const invite = getDebateInviteEmail({
        senderName: req.body.senderName,
        debateTopic: req.body.topic,
        debateType: req.body.debateType,
        joinUrl: req.body.joinUrl || process.env.APP_URL || process.env.ADMIN_APP_URL || "",
      });

      await Promise.all(
        emails.map((email) =>
          sendEmail({
            to: email,
            subject: invite.subject,
            text: invite.text,
            html: invite.html,
          }),
        ),
      );

      return res.status(200).json({
        status: true,
        data: {
          sent: emails.length,
        },
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to send debate invites",
      });
    }
  },
};

module.exports = controller;