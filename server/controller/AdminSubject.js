const SubjectUnit = require("../model/SubjectUnit");
const SubjectUpload = require("../model/SubjectUpload");
const { handleAdminSubjectUpload } = require("../services/adminSubjectService");
// const { logApiStep, logError } = require("../utils/logger");

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function emit({ api = "APP", status = "INFO", message, requestId = null }) {
  const prefix = `[${formatTimestamp()}] [${api}] [${status}]`;
  const trace = requestId ? ` [${requestId}]` : "";
  console.log(`${prefix}${trace} ${message}`);
}
function logApiStep({ api, status, message, requestId }) {
  emit({ api, status, message, requestId });
}

  function logError({ api, message, error, requestId }) {
  emit({
    api,
    status: "ERROR",
    requestId,
    message: `${message}${error ? `: ${error.message}` : ""}`,
  });
}
const API_NAME = "UPLOAD_SUBJECT";

function buildFallbackGroupKey(unit) {
  return [
    unit.board,
    unit.standard,
    unit.subject,
    unit.part || "general",
    unit.uploadId || "standalone",
  ].join("::");
}

function getGroupKeyFromUnit(unit) {
  return unit.subjectGroupKey || buildFallbackGroupKey(unit);
}

function formatUnit(unit) {
  return {
    id: unit._id,
    uploadId: unit.uploadId,
    documentId: unit.documentId,
    board: unit.board,
    standard: unit.standard,
    subject: unit.subject,
    subjectGroupKey: unit.subjectGroupKey || null,
    part: unit.part,
    unitNumber: unit.unitNumber,
    unitLabel: unit.unitLabel,
    unitTitle: unit.unitTitle,
    chapterName: unit.chapterName,
    originalFileName: unit.originalFileName,
    processingStatus: unit.processing?.status,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  };
}

function formatGroupFromUnits(units = []) {
  if (!units.length) {
    return null;
  }

  const firstUnit = units[0];
  const sortedUnits = [...units].sort((left, right) => {
    const leftOrder = left.unitNumber ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.unitNumber ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return new Date(left.createdAt) - new Date(right.createdAt);
  });

  const status = sortedUnits.some((unit) => unit.processing?.status === "failed")
    ? "failed"
    : sortedUnits.some((unit) => unit.processing?.status === "processing")
      ? "processing"
      : "completed";

  return {
    id: getGroupKeyFromUnit(firstUnit),
    subjectGroupKey: firstUnit.subjectGroupKey || null,
    board: firstUnit.board,
    standard: firstUnit.standard,
    subject: firstUnit.subject,
    part: firstUnit.part || null,
    subjectTitle: firstUnit.part ? `${firstUnit.subject} - ${firstUnit.part}` : firstUnit.subject,
    status,
    unitCount: sortedUnits.length,
    displayMode: sortedUnits.length === 1 ? "single_subject" : "subject_with_units",
    createdAt: sortedUnits[0].createdAt,
    updatedAt: sortedUnits[sortedUnits.length - 1].updatedAt,
    units: sortedUnits.map((unit) => formatUnit(unit)),
  };
}

function buildSubjectGroups(items = []) {
  const grouped = new Map();

  items.forEach((unit) => {
    const key = getGroupKeyFromUnit(unit);
    const existing = grouped.get(key) || [];
    existing.push(unit);
    grouped.set(key, existing);
  });

  return Array.from(grouped.values())
    .map((units) => formatGroupFromUnits(units))
    .filter(Boolean)
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
}

async function findGroupUnits(groupKey) {
  let units = await SubjectUnit.find({ subjectGroupKey: groupKey }).sort({
    unitNumber: 1,
    createdAt: 1,
  });

  if (units.length) {
    return units;
  }

  const [board, standard, subject, rawPart, uploadId] = String(groupKey).split("::");
  if (!board || !standard || !subject || !uploadId) {
    return [];
  }

  const fallbackFilter = {
    board,
    standard,
    subject,
    part: rawPart === "general" ? null : rawPart,
  };

  if (uploadId !== "standalone") {
    fallbackFilter.uploadId = uploadId;
  }

  units = await SubjectUnit.find(fallbackFilter).sort({
    unitNumber: 1,
    createdAt: 1,
  });

  return units;
}

async function getGroupUploads(groupKey, units = []) {
  const subjectGroupKey = units[0]?.subjectGroupKey;

  if (subjectGroupKey) {
    return SubjectUpload.find({ subjectGroupKey }).sort({ createdAt: -1 });
  }

  const uploadIds = [...new Set(units.map((unit) => String(unit.uploadId)).filter(Boolean))];
  if (!uploadIds.length) {
    return [];
  }

  return SubjectUpload.find({ _id: { $in: uploadIds } }).sort({ createdAt: -1 });
}

const controller = {
  async uploadSubject(req, res) {
    try {
      logApiStep({
        api: API_NAME,
        status: "STARTED",
        requestId: req.requestId,
        message: "Process Initiated",
      });

      const result = await handleAdminSubjectUpload(req);

      logApiStep({
        api: API_NAME,
        status: "SUCCESS",
        requestId: req.requestId,
        message: "Accepted for FIFO processing",
      });

      return res.status(202).json({
        status: true,
        message: "Subject upload accepted and added to the processing queue.",
        data: {
          uploadId: result.upload._id,
          queued: true,
          uploadStatus: result.upload.status,
          queuePosition: result.upload.queuePosition,
          progressStage: result.upload.progressStage,
          progressMessage: result.upload.progressMessage,
          unitsCreated: 0,
          units: [],
        },
      });
    } catch (error) {
      logError({
        api: API_NAME,
        requestId: req.requestId,
        message: "Error",
        error,
      });

      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Processing failed",
        error: {
          source: error.source || "node",
          details: error.details || null,
        },
      });
    }
  },

  async listSubjects(req, res) {
    try {
      const filter = {};
      const search = String(req.query.search || "").trim();

      if (req.query.board) {
        filter.board = req.query.board;
      }
      if (req.query.standard) {
        filter.standard = req.query.standard;
      }
      if (req.query.subject) {
        filter.subject = req.query.subject;
      }
      if (search) {
        filter.$or = [
          { unitTitle: { $regex: search, $options: "i" } },
          { chapterName: { $regex: search, $options: "i" } },
          { documentId: { $regex: search, $options: "i" } },
          { subject: { $regex: search, $options: "i" } },
        ];
      }

      const items = await SubjectUnit.find(filter).sort({
        updatedAt: -1,
        createdAt: -1,
        unitNumber: 1,
      });

      const formattedItems = items.map((unit) => formatUnit(unit));
      const groupedItems = buildSubjectGroups(items);

      return res.status(200).json({
        status: true,
        data: {
          items: formattedItems,
          groupedItems,
          pagination: {
            page: 1,
            limit: groupedItems.length || 1,
            totalItems: formattedItems.length,
            totalPages: 1,
          },
        },
      });
    } catch (error) {
      console.log("Error listing admin subjects", error);
      return res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async getSubjectGroup(req, res) {
    try {
      const units = await findGroupUnits(req.params.groupKey);

      if (!units.length) {
        return res.status(404).json({
          status: false,
          message: "Subject group not found",
        });
      }

      const uploads = await getGroupUploads(req.params.groupKey, units);
      const group = formatGroupFromUnits(units);

      return res.status(200).json({
        status: true,
        data: {
          ...group,
          uploads: uploads.map((upload) => ({
            id: upload._id,
            status: upload.status,
            progressStage: upload.progressStage,
            progressMessage: upload.progressMessage,
            createdAt: upload.createdAt,
            processedAt: upload.processedAt,
          })),
        },
      });
    } catch (error) {
      return res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async updateSubjectGroup(req, res) {
    try {
      const units = await findGroupUnits(req.params.groupKey);

      if (!units.length) {
        return res.status(404).json({
          status: false,
          message: "Subject group not found",
        });
      }

      const updates = {};
      ["board", "standard", "subject", "part"].forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          updates[field] = req.body[field] || null;
        }
      });

      if (!Object.keys(updates).length) {
        return res.status(400).json({
          status: false,
          message: "No subject fields provided",
        });
      }

      const groupFilter = units[0].subjectGroupKey
        ? { subjectGroupKey: units[0].subjectGroupKey }
        : { _id: { $in: units.map((unit) => unit._id) } };

      await Promise.all([
        SubjectUnit.updateMany(groupFilter, { $set: updates }),
        units[0].subjectGroupKey
          ? SubjectUpload.updateMany(
              { subjectGroupKey: units[0].subjectGroupKey },
              { $set: updates },
            )
          : Promise.resolve(),
      ]);

      const refreshedUnits = await findGroupUnits(req.params.groupKey);
      return res.status(200).json({
        status: true,
        message: "Subject updated successfully",
        data: formatGroupFromUnits(refreshedUnits),
      });
    } catch (error) {
      return res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async deleteSubjectGroup(req, res) {
    try {
      const units = await findGroupUnits(req.params.groupKey);

      if (!units.length) {
        return res.status(404).json({
          status: false,
          message: "Subject group not found",
        });
      }

      const uploads = await getGroupUploads(req.params.groupKey, units);

      await Promise.all([
        SubjectUnit.deleteMany({ _id: { $in: units.map((unit) => unit._id) } }),
        uploads.length
          ? SubjectUpload.deleteMany({ _id: { $in: uploads.map((upload) => upload._id) } })
          : Promise.resolve(),
      ]);

      return res.status(200).json({
        status: true,
        message: "Subject deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async deleteSubjectUnit(req, res) {
    try {
      const unit = await SubjectUnit.findById(req.params.unitId);

      if (!unit) {
        return res.status(404).json({
          status: false,
          message: "Subject unit not found",
        });
      }

      await SubjectUnit.findByIdAndDelete(req.params.unitId);

      return res.status(200).json({
        status: true,
        message: "Unit deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async getUploadStatus(req, res) {
    try {
      const upload = await SubjectUpload.findById(req.params.id);

      if (!upload) {
        return res.status(404).json({
          status: false,
          message: "Upload not found",
        });
      }

      const units = await SubjectUnit.find({ uploadId: upload._id })
        .sort({ unitNumber: 1, createdAt: 1 })
        .select(
          "_id documentId board standard subject part unitNumber unitLabel unitTitle processing createdAt subjectGroupKey",
        );

      return res.status(200).json({
        status: true,
        data: {
          id: upload._id,
          uploadTitle: upload.uploadTitle,
          board: upload.board,
          standard: upload.standard,
          subject: upload.subject,
          subjectGroupKey: upload.subjectGroupKey,
          part: upload.part,
          originalFileName: upload.originalFileName,
          processingMode: upload.processingMode,
          uploadStatus: upload.status,
          queuePosition: upload.queuePosition,
          progressPercent: upload.progressPercent || 0,
          progressStage: upload.progressStage || "queued",
          progressMessage: upload.progressMessage || "",
          totalUnits: upload.totalUnits || 0,
          processedUnits: upload.processedUnits || 0,
          error: upload.error || null,
          processedAt: upload.processedAt,
          units: units.map((unit) => ({
            id: unit._id,
            documentId: unit.documentId,
            board: unit.board,
            standard: unit.standard,
            subject: unit.subject,
            subjectGroupKey: unit.subjectGroupKey || null,
            part: unit.part,
            unitNumber: unit.unitNumber,
            unitLabel: unit.unitLabel,
            unitTitle: unit.unitTitle,
            processingStatus: unit.processing.status,
            createdAt: unit.createdAt,
          })),
        },
      });
    } catch (error) {
      console.log("Error fetching upload status", error);
      return res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async listUploadProcesses(req, res) {
    try {
      const status = String(req.query.status || "all").trim().toLowerCase();
      const filter = {};

      if (status && status !== "all") {
        filter.status = status === "processing" ? { $in: ["processing", "queued"] } : status;
      }

      const items = await SubjectUpload.find(filter)
        .populate("uploadedBy", "name email")
        .sort({ updatedAt: -1, createdAt: -1 });

      return res.status(200).json({
        status: true,
        data: {
          items: items.map((upload) => ({
            id: upload._id,
            name: upload.uploadTitle,
            board: upload.board,
            standard: upload.standard,
            subject: upload.subject,
            subjectGroupKey: upload.subjectGroupKey || null,
            processingMode: upload.processingMode,
            originalFileName: upload.originalFileName,
            status: upload.status,
            queuePosition: upload.queuePosition,
            latestMessage: upload.progressMessage || "",
            progressPercent: upload.progressPercent || 0,
            progressStage: upload.progressStage || "queued",
            processedUnits: upload.processedUnits || 0,
            totalUnits: upload.totalUnits || 0,
            error: upload.error || null,
            processedAt: upload.processedAt,
            createdAt: upload.createdAt,
            updatedAt: upload.updatedAt,
            uploadedBy: upload.uploadedBy
              ? {
                  id: upload.uploadedBy._id,
                  name: upload.uploadedBy.name,
                  email: upload.uploadedBy.email,
                }
              : null,
          })),
          pagination: {
            page: 1,
            limit: items.length || 1,
            totalItems: items.length,
            totalPages: 1,
          },
        },
      });
    } catch (error) {
      console.log("Error listing upload processes", error);
      return res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async getSubject(req, res) {
    try {
      const subjectUnit = await SubjectUnit.findById(req.params.id);

      if (!subjectUnit) {
        return res.status(404).json({
          status: false,
          message: "Subject unit not found",
        });
      }

      const groupUnits = await findGroupUnits(getGroupKeyFromUnit(subjectUnit));
      const sortedGroupUnits = groupUnits.sort((left, right) => {
        const leftOrder = left.unitNumber ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.unitNumber ?? Number.MAX_SAFE_INTEGER;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return new Date(left.createdAt) - new Date(right.createdAt);
      });

      return res.status(200).json({
        status: true,
        data: {
          id: subjectUnit._id,
          uploadId: subjectUnit.uploadId,
          documentId: subjectUnit.documentId,
          board: subjectUnit.board,
          standard: subjectUnit.standard,
          subject: subjectUnit.subject,
          subjectGroupKey: subjectUnit.subjectGroupKey || null,
          part: subjectUnit.part,
          unitNumber: subjectUnit.unitNumber,
          unitLabel: subjectUnit.unitLabel,
          unitTitle: subjectUnit.unitTitle,
          chapterName: subjectUnit.chapterName,
          structuredData: subjectUnit.structuredData,
          enrichedData: subjectUnit.enrichedData,
          readerIndex: subjectUnit.readerIndex,
          processing: subjectUnit.processing,
          createdAt: subjectUnit.createdAt,
          updatedAt: subjectUnit.updatedAt,
          subjectGroup: {
            id: getGroupKeyFromUnit(subjectUnit),
            subjectTitle: subjectUnit.part
              ? `${subjectUnit.subject} - ${subjectUnit.part}`
              : subjectUnit.subject,
            unitCount: sortedGroupUnits.length,
            units: sortedGroupUnits.map((unit) => ({
              id: unit._id,
              unitTitle: unit.unitTitle,
              unitLabel: unit.unitLabel,
              unitNumber: unit.unitNumber,
            })),
          },
        },
      });
    } catch (error) {
      console.log("Error fetching admin subject", error);
      return res.status(500).json({
        status: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },
};

module.exports = controller;
