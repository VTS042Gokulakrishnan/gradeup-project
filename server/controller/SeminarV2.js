const { callPython } = require("../services/pythonGateway");
const formidable = require("formidable");
const FormData = require("form-data");
const fs = require("fs");
const {
  resolveSubjectUnit,
  getPythonLearningContext,
} = require("../services/learningContextService");
const {
  upsertSession,
  touchParticipant,
  completeSession,
  getSession,
  appendTurn,
  listActiveSessions,
  listSessionTopics,
  saveFeedback,
} = require("../services/liveSessionService");

function ensureSeminarStartPayload(context = {}) {
  const missing = [];

  if (!String(context.subject || "").trim()) missing.push("subject");
  if (!Number.isFinite(Number(context.unitNumber))) missing.push("unit_number");
  if (!String(context.board || "").trim()) missing.push("board");
  if (!String(context.classNumber || "").trim()) missing.push("class_number");
  if (!String(context.topic || "").trim()) missing.push("topic");

  if (missing.length) {
    const error = new Error(`Seminar start is missing required learning context: ${missing.join(", ")}`);
    error.statusCode = 422;
    throw error;
  }
}

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

function getRequestedSessionId(source = {}) {
  return source.sessionId || source.session_id || source.liveSessionId || source.live_session_id || null;
}

function normalizeParsedFieldValue(value) {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

async function parseSeminarStartRequest(req) {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("multipart/form-data")) {
    return { body: req.body || {}, file: null };
  }

  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false, keepExtensions: true });
    form.parse(req, (error, fields, files) => {
      if (error) {
        error.statusCode = error.statusCode || 400;
        reject(error);
        return;
      }

      const body = Object.fromEntries(
        Object.entries(fields || {}).map(([key, value]) => [key, normalizeParsedFieldValue(value)]),
      );

      const incomingFile = normalizeParsedFieldValue(files?.file || null);
      resolve({ body, file: incomingFile || null });
    });
  });
}

async function resolveLiveSessionAndPythonSessionId(sessionId) {
  if (!sessionId) {
    return { liveSession: null, pythonSessionId: null };
  }

  const liveSession = await getSession(sessionId);
  if (!liveSession) {
    return { liveSession: null, pythonSessionId: sessionId };
  }

  const pythonSessionId =
    liveSession.metadata?.pythonSessionId ||
    liveSession.metadata?.session_id ||
    liveSession.metadata?.sessionId ||
    sessionId;

  return { liveSession, pythonSessionId };
}

const controller = {
  async createRoom(req, res) {
    try {
      const candidate = getCandidate(req.body);
      const { unit } = await getContext(req.body);
      const requestedSessionId = getRequestedSessionId(req.body);
      const sessionId = requestedSessionId || `seminar-room-${candidate.candidate_id}-${Date.now()}`;
      const shareLink = req.body.roomLink || req.body.shareLink || null;

      const maxParticipants = req.body.maxParticipants
        ? Number(req.body.maxParticipants)
        : null;

      const liveSession = await upsertSession({
        sessionType: "seminar",
        sessionId,
        candidateId: candidate.candidate_id,
        candidateName: candidate.candidate_name,
        topic: req.body.topic,
        unit,
        role: "host",
        status: "waiting",
        hostCandidateId: candidate.candidate_id,
        hostCandidateName: candidate.candidate_name,
        shareLink,
        metadata: {
          createdVia: "seminar_room",
          session_mode: "main",
          maxParticipants,
        },
      });

      return res.status(200).json({
        status: true,
        data: {
          session_id: sessionId,
          sessionId,
          shareLink,
          liveSession,
        },
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to create seminar room",
      });
    }
  },

  async start(req, res) {
    try {
      const parsed = await parseSeminarStartRequest(req);
      const body = parsed.body || {};
      const uploadedFile = parsed.file || null;

      if (!body || typeof body !== "object" || !Object.keys(body).length) {
        return res.status(400).json({
          status: false,
          message:
            "Seminar start request body was empty. Expected unitId, candidateId, candidateName, topic, and mode.",
        });
      }

      const candidate = getCandidate(body);
      const { unit, context } = await getContext(body);
      const requestedSessionId = getRequestedSessionId(body);
      const requestedMode = body.mode || body.session_mode || "main";
      const existingLiveSession = requestedSessionId ? await getSession(requestedSessionId) : null;
      const learningContext = {
        subject: body.subject || context.subject,
        unitNumber: Number(body.unitNumber ?? body.unit_number ?? context.unitNumber),
        board: body.board || context.board,
        classNumber: body.classNumber || body.class_number || context.classNumber,
        unitName: body.unitName || body.unit_name || context.unitName,
        topic: body.topic,
      };
      ensureSeminarStartPayload({
        subject: learningContext.subject,
        unitNumber: learningContext.unitNumber,
        board: learningContext.board,
        classNumber: learningContext.classNumber,
        topic: learningContext.topic,
      });
      if ((requestedMode === "demo" || requestedMode === "main") && !uploadedFile) {
        return res.status(400).json({
          status: false,
          message: "PDF or PPT file upload is required for demo and main seminar sessions.",
        });
      }

      let pythonPayload;
      let pythonHeaders;

      if (uploadedFile) {
        pythonPayload = new FormData();
        pythonPayload.append("candidate_id", String(candidate.candidate_id || ""));
        pythonPayload.append("candidate_name", String(candidate.candidate_name || ""));
        pythonPayload.append("subject", String(learningContext.subject || ""));
        pythonPayload.append("unit_number", String(learningContext.unitNumber ?? ""));
        pythonPayload.append("board", String(learningContext.board || ""));
        pythonPayload.append("class_number", String(learningContext.classNumber || ""));
        pythonPayload.append("unit_name", String(learningContext.unitName || ""));
        pythonPayload.append("topic", String(learningContext.topic || ""));
        pythonPayload.append("session_mode", String(requestedMode || "main"));
        pythonPayload.append(
          "file",
          fs.createReadStream(uploadedFile.filepath),
          {
            filename: uploadedFile.originalFilename || uploadedFile.newFilename || "seminar-material",
            contentType: uploadedFile.mimetype || "application/octet-stream",
          },
        );
        pythonHeaders = pythonPayload.getHeaders();
      } else {
        pythonPayload = new URLSearchParams({
          candidate_id: String(candidate.candidate_id || ""),
          candidate_name: String(candidate.candidate_name || ""),
          subject: String(learningContext.subject || ""),
          unit_number: String(learningContext.unitNumber ?? ""),
          board: String(learningContext.board || ""),
          class_number: String(learningContext.classNumber || ""),
          unit_name: String(learningContext.unitName || ""),
          topic: String(learningContext.topic || ""),
          session_mode: String(requestedMode || "main"),
        }).toString();
        pythonHeaders = {
          "Content-Type": "application/x-www-form-urlencoded",
        };
      }
      const data = await callPython({
        method: "post",
        path: "/seminar/start",
        data: pythonPayload,
        headers: pythonHeaders,
      });

      const storedSession = await upsertSession({
        sessionType: "seminar",
        sessionId:
          existingLiveSession?.sessionId ||
          requestedSessionId ||
          data?.session_id ||
          data?.sessionId ||
          `seminar-${candidate.candidate_id}-${Date.now()}`,
        candidateId: candidate.candidate_id,
        candidateName: candidate.candidate_name,
        topic: body.topic,
        unit,
        role: existingLiveSession ? "host" : "participant",
        status: "active",
        hostCandidateId: existingLiveSession?.hostCandidateId || candidate.candidate_id,
        hostCandidateName: existingLiveSession?.hostCandidateName || candidate.candidate_name,
        shareLink: existingLiveSession?.shareLink || body.roomLink || body.shareLink || null,
        metadata: {
          ...(existingLiveSession?.metadata || {}),
          ...data,
          pythonSessionId: data?.session_id || data?.sessionId || null,
          session_mode: requestedMode,
        },
      });

      if (data?.ai_greeting) {
        await appendTurn({
          sessionId: storedSession.sessionId,
          speakerId: "ai_mediator",
          speakerName: "AI Mediator",
          role: "assistant",
          turnType: "greeting",
          message: data.ai_greeting,
          transcript: data.ai_greeting,
          metadata: { source: "seminar_start" },
        }).catch(() => null);
      }

      return res.status(200).json({ status: true, data: { ...data, liveSession: storedSession } });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to start seminar",
      });
    }
  },

  async respond(req, res) {
    try {
      const candidate = getCandidate(req.body);
      const sessionId = getRequestedSessionId(req.body);
      const { liveSession, pythonSessionId } = await resolveLiveSessionAndPythonSessionId(sessionId);
      const transcript = req.body.message || req.body.transcript || "";
      const data = await callPython({
        method: "post",
        path: "/seminar/respond",
        data: {
          session_id: pythonSessionId,
          message: transcript,
          silence_seconds: Number(req.body.silenceSeconds || req.body.silence_seconds || 0),
        },
      });

      const updatedLiveSession = liveSession
        ? await touchParticipant({
            sessionId: liveSession.sessionId,
            candidateId: candidate.candidate_id,
            candidateName: candidate.candidate_name,
            status: "active",
          })
        : null;

      if (liveSession && transcript) {
        await appendTurn({
          sessionId: liveSession.sessionId,
          speakerId: candidate.candidate_id,
          speakerName: candidate.candidate_name,
          role: "user",
          turnType: "transcript",
          message: transcript,
          transcript,
          metadata: {
            source: "seminar_respond",
            silenceSeconds: Number(req.body.silenceSeconds || req.body.silence_seconds || 0),
          },
        }).catch(() => null);
      }

      if (liveSession && data?.ai_response) {
        await appendTurn({
          sessionId: liveSession.sessionId,
          speakerId: "ai_mediator",
          speakerName: "AI Mediator",
          role: "assistant",
          turnType: "ai_response",
          message: data.ai_response,
          transcript: data.ai_response,
          metadata: { source: "seminar_respond" },
        }).catch(() => null);
      }

      return res.status(200).json({ status: true, data: { ...data, liveSession: updatedLiveSession || liveSession } });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to send seminar response",
      });
    }
  },

  async startRoom(req, res) {
    try {
      const candidate = getCandidate(req.body);
      const sessionId = getRequestedSessionId(req.body);
      const liveSession = await getSession(sessionId);

      if (!liveSession) {
        return res.status(404).json({ status: false, message: "Seminar room not found" });
      }

      if (String(liveSession.hostCandidateId) !== String(candidate.candidate_id)) {
        return res.status(403).json({ status: false, message: "Only the host can start the seminar." });
      }

      req.body.sessionId = sessionId;
      req.body.mode = "main";
      return controller.start(req, res);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to start seminar room",
      });
    }
  },

  async removeParticipant(req, res) {
    try {
      const candidate = getCandidate(req.body);
      const sessionId = getRequestedSessionId(req.body);
      const targetParticipantId = String(req.body.participantId || req.body.participant_id || "");
      const liveSession = await getSession(sessionId);

      if (!liveSession) {
        return res.status(404).json({ status: false, message: "Seminar session not found" });
      }

      if (String(liveSession.hostCandidateId) !== String(candidate.candidate_id)) {
        return res.status(403).json({ status: false, message: "Only the host can remove waiting users." });
      }

      const LiveSessionModel = require("../model/LiveSession");
      const updated = await LiveSessionModel.findOneAndUpdate(
        { sessionId },
        {
          $pull: {
            participants: {
              participantId: targetParticipantId,
            },
          },
        },
        { new: true },
      );

      return res.status(200).json({ status: true, data: updated });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to remove waiting participant",
      });
    }
  },

  async guide(req, res) {
    try {
      const { liveSession, pythonSessionId } = await resolveLiveSessionAndPythonSessionId(getRequestedSessionId(req.body));
      const data = await callPython({
        method: "post",
        path: "/seminar/guide",
        data: {
          session_id: pythonSessionId,
        },
      });

      if (liveSession && data?.guidance) {
        await appendTurn({
          sessionId: liveSession.sessionId,
          speakerId: "ai_mediator",
          speakerName: "AI Mediator",
          role: "assistant",
          turnType: "guidance",
          message: data.guidance,
          transcript: data.guidance,
          metadata: { source: "seminar_guide" },
        }).catch(() => null);
      }

      return res.status(200).json({ status: true, data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to fetch seminar guidance",
      });
    }
  },

  async end(req, res) {
    try {
      const sessionId = getRequestedSessionId(req.body);
      const { liveSession, pythonSessionId } = await resolveLiveSessionAndPythonSessionId(sessionId);
      const transcript = String(req.body.transcript || "").trim();

      if (transcript && pythonSessionId) {
        await callPython({
          method: "post",
          path: "/seminar/respond",
          data: {
            session_id: pythonSessionId,
            message: transcript,
            silence_seconds: 0,
          },
        }).catch(() => null);
      }

      const data = await callPython({
        method: "post",
        path: "/seminar/end",
        data: {
          session_id: pythonSessionId,
        },
      });

      if (liveSession) {
        if (transcript) {
          await appendTurn({
            sessionId: liveSession.sessionId,
            speakerId: liveSession.candidateId || liveSession.hostCandidateId || null,
            speakerName: liveSession.candidateName || liveSession.hostCandidateName || null,
            role: "user",
            turnType: "transcript",
            message: transcript,
            transcript,
            metadata: { source: "seminar_end" },
          }).catch(() => null);
        }
        await saveFeedback(liveSession.sessionId, data, {
          ...(liveSession.metadata || {}),
          ...data,
          pythonSessionId,
        }).catch(() => null);
      }

      const updatedLiveSession = await completeSession(liveSession?.sessionId || sessionId, {
        metadata: {
          ...(liveSession?.metadata || {}),
          ...data,
          pythonSessionId,
        },
        results: data,
      });
      return res.status(200).json({ status: true, data: { ...data, liveSession: updatedLiveSession } });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to end seminar",
      });
    }
  },

  async join(req, res) {
    try {
      const candidate = getCandidate(req.body);
      const sessionId = getRequestedSessionId(req.body);
      const existingSession = await getSession(sessionId);
      if (!existingSession) {
        return res.status(404).json({ status: false, message: "Seminar session not found" });
      }

      // ── Participant limit enforcement ──────────────────────────────────────
      const maxParticipants = existingSession?.metadata?.maxParticipants
        ? Number(existingSession.metadata.maxParticipants)
        : null;

      if (maxParticipants && maxParticipants > 0) {
        // Count non-host, non-AI participants already in session
        const STALE_MS = 35_000;
        const now = Date.now();
        const activeParticipants = (existingSession.participants || []).filter((p) => {
          if (p.isHost || p.isAi) return false;
          // Check if this is the same candidate rejoining
          if (String(p.participantId) === String(candidate.candidate_id)) return false;
          if (!p.lastSeenAt) return true;
          return now - new Date(p.lastSeenAt).getTime() < STALE_MS;
        });

        if (activeParticipants.length >= maxParticipants) {
          return res.status(403).json({
            status: false,
            code: "limit_exceeded",
            message: `This seminar has reached its participant limit of ${maxParticipants}. Please contact the host.`,
            maxParticipants,
          });
        }
      }

      const liveSession = await touchParticipant({
        sessionId,
        candidateId: candidate.candidate_id,
        candidateName: candidate.candidate_name,
        role: req.body.role || "observer",
        status: existingSession?.status === "active" ? "active" : "waiting",
        lastSeenAt: new Date(),
      });

      return res.status(200).json({ status: true, data: liveSession });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to join seminar session",
      });
    }
  },

  async message(req, res) {
    try {
      const candidate = getCandidate(req.body);
      const sessionId = getRequestedSessionId(req.body);
      await touchParticipant({
        sessionId,
        candidateId: candidate.candidate_id,
        candidateName: candidate.candidate_name,
        role: req.body.role || "participant",
        status: "active",
      });

      await appendTurn({
        sessionId,
        speakerId: candidate.candidate_id,
        speakerName: candidate.candidate_name,
        role: "user",
        turnType: "chat",
        message: req.body.message,
        transcript: req.body.message,
        metadata: {
          channel: "seminar_chat",
          senderRole: req.body.role || "participant",
        },
      });

      const liveSession = await getSession(sessionId);
      return res.status(200).json({ status: true, data: liveSession });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to send seminar message",
      });
    }
  },

  async requestSpeak(req, res) {
    try {
      const candidate = getCandidate(req.body);
      const sessionId = getRequestedSessionId(req.body);
      const LiveSessionModel = require("../model/LiveSession");
      const session = await LiveSessionModel.findOne({ sessionId });

      if (!session) {
        return res.status(404).json({ status: false, message: "Seminar session not found" });
      }

      if (session.status !== "active") {
        return res.status(409).json({ status: false, message: "The seminar has not started yet." });
      }

      if (String(session.hostCandidateId) === String(candidate.candidate_id)) {
        return res.status(400).json({ status: false, message: "Host does not need speaker approval." });
      }

      const requests = Array.isArray(session.metadata?.speakRequests)
        ? [...session.metadata.speakRequests]
        : [];
      const existingIndex = requests.findIndex(
        (item) => String(item.participantId) === String(candidate.candidate_id) && item.status === "pending",
      );

      const nextRequest = {
        participantId: candidate.candidate_id,
        participantName: candidate.candidate_name,
        status: "pending",
        requestedAt: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        requests[existingIndex] = {
          ...requests[existingIndex],
          ...nextRequest,
        };
      } else {
        requests.push(nextRequest);
      }

      session.metadata = {
        ...(session.metadata || {}),
        speakRequests: requests,
      };

      const participant = (session.participants || []).find(
        (item) => String(item.participantId) === String(candidate.candidate_id),
      );
      if (participant) {
        participant.status = "requested_speak";
        participant.lastSeenAt = new Date();
      }

      await session.save();
      const updated = await getSession(sessionId);
      return res.status(200).json({ status: true, data: updated });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to request speaking access",
      });
    }
  },

  async respondSpeak(req, res) {
    try {
      const candidate = getCandidate(req.body);
      const sessionId = getRequestedSessionId(req.body);
      const participantId = String(req.body.participantId || req.body.participant_id || "");
      const approved = Boolean(req.body.approved);
      const LiveSessionModel = require("../model/LiveSession");
      const session = await LiveSessionModel.findOne({ sessionId });

      if (!session) {
        return res.status(404).json({ status: false, message: "Seminar session not found" });
      }

      if (String(session.hostCandidateId) !== String(candidate.candidate_id)) {
        return res.status(403).json({ status: false, message: "Only the host can approve speaking access." });
      }

      const requests = Array.isArray(session.metadata?.speakRequests)
        ? [...session.metadata.speakRequests]
        : [];
      const existingIndex = requests.findIndex(
        (item) => String(item.participantId) === participantId && item.status === "pending",
      );

      if (existingIndex >= 0) {
        requests[existingIndex] = {
          ...requests[existingIndex],
          status: approved ? "approved" : "rejected",
          resolvedAt: new Date().toISOString(),
          resolvedBy: candidate.candidate_name,
        };
      } else {
        requests.push({
          participantId,
          participantName: req.body.participantName || "Participant",
          status: approved ? "approved" : "rejected",
          requestedAt: new Date().toISOString(),
          resolvedAt: new Date().toISOString(),
          resolvedBy: candidate.candidate_name,
        });
      }

      session.metadata = {
        ...(session.metadata || {}),
        speakRequests: requests,
      };

      const participant = (session.participants || []).find(
        (item) => String(item.participantId) === participantId,
      );
      if (participant) {
        participant.status = approved ? "approved_to_speak" : "active";
        participant.lastSeenAt = new Date();
      }

      await session.save();
      const updated = await getSession(sessionId);
      return res.status(200).json({ status: true, data: updated });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to update speaking access",
      });
    }
  },

  async chatStart(req, res) {
    try {
      const sessionId = getRequestedSessionId(req.body);
      const { liveSession, pythonSessionId } = await resolveLiveSessionAndPythonSessionId(sessionId);
      const data = await callPython({
        method: "post",
        path: "/seminar/chat/start",
        data: { session_id: pythonSessionId },
      });
      return res.status(200).json({ status: true, data: { ...data, liveSession } });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to start seminar chat",
      });
    }
  },

  async chatRespond(req, res) {
    try {
      const candidate = getCandidate(req.body);
      const sessionId = getRequestedSessionId(req.body);
      const { liveSession, pythonSessionId } = await resolveLiveSessionAndPythonSessionId(sessionId);
      const message = String(req.body.message || "").trim();
      const data = await callPython({
        method: "post",
        path: "/seminar/chat/respond",
        data: {
          session_id: pythonSessionId,
          message,
        },
      });

      if (liveSession && message) {
        await appendTurn({
          sessionId: liveSession.sessionId,
          speakerId: candidate.candidate_id,
          speakerName: candidate.candidate_name,
          role: "user",
          turnType: "chat",
          message,
          transcript: message,
          metadata: { source: "seminar_chat_respond", channel: "post_session_chat" },
        }).catch(() => null);
      }

      const reply = data?.ai_response || data?.response || data?.reply || data?.message || data?.answer;
      if (liveSession && reply) {
        await appendTurn({
          sessionId: liveSession.sessionId,
          speakerId: "ai_mediator",
          speakerName: "AI Mediator",
          role: "assistant",
          turnType: "chat_response",
          message: reply,
          transcript: reply,
          metadata: { source: "seminar_chat_respond", channel: "post_session_chat" },
        }).catch(() => null);
      }

      return res.status(200).json({ status: true, data: { ...data, liveSession } });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to respond in seminar chat",
      });
    }
  },

  async getActive(req, res) {
    try {
      const data = await listActiveSessions({ sessionType: "seminar" });
      return res.status(200).json({ status: true, data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to load active seminar sessions",
      });
    }
  },

  async getTopics(req, res) {
    try {
      const data = await listSessionTopics({
        sessionType: "seminar",
        subjectGroupKey: req.query.subjectGroupKey || req.query.subject || undefined,
      });
      return res.status(200).json({ status: true, data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to load seminar topics",
      });
    }
  },

  async getSession(req, res) {
    try {
      const data = await getSession(req.params.sessionId);
      if (!data) {
        return res.status(404).json({ status: false, message: "Seminar session not found" });
      }
      return res.status(200).json({ status: true, data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to load seminar session",
      });
    }
  },

  async getHistory(req, res) {
    return res.status(200).json({ status: true, data: [] });
  },

  async getAttendedTopics(req, res) {
    return res.status(200).json({ status: true, data: [] });
  },

  async getReport(req, res) {
    try {
      const data = await getSession(req.params.sessionId);
      if (!data) {
        return res.status(404).json({ status: false, message: "Seminar report not found" });
      }
      return res.status(200).json({ status: true, data: data.feedback || data.results || data.metadata || null });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to load seminar report",
      });
    }
  },
};

module.exports = controller;