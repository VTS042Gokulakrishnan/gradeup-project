const fs = require("fs");
const os = require("os");
const path = require("path");
const { promisify } = require("util");
const mongoose = require("mongoose");
const { formidable } = require("formidable");
const axios = require("axios");
const SubjectUpload = require("../model/SubjectUpload");
const SubjectUnit = require("../model/SubjectUnit");
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
const unlinkAsync = promisify(fs.unlink);
const PYTHON_REQUEST_TIMEOUT_MS = Number(
  process.env.PYTHON_REQUEST_TIMEOUT_MS || 15 * 60 * 1000,
);
const BACKGROUND_UPLOAD_PREFIX = "gradeup-subject-upload";
const API_NAME = "UPLOAD_SUBJECT";

let isQueueRunning = false;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function extractImageUrlsFromString(text) {
  if (typeof text !== "string" || !text.trim()) {
    return [];
  }

  const urls = [
    ...text.matchAll(/!\[.*?\]\((https?:\/\/[^)\s]+)\)/gi),
    ...text.matchAll(/https?:\/\/[^\s)"']+\.(?:png|jpe?g|gif|webp|svg)/gi),
  ].map((match) => match[1] || match[0]);

  return urls.filter(Boolean);
}

function normalizeImageUrlList(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim());
  }

  if (isPlainObject(value)) {
    return Object.values(value).filter(
      (item) => typeof item === "string" && item.trim(),
    );
  }

  if (typeof value === "string" && value.trim()) {
    return [value];
  }

  return [];
}

function collectImageUrls(value, bucket = []) {
  if (typeof value === "string") {
    bucket.push(...extractImageUrlsFromString(value));
    return bucket;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, bucket));
    return bucket;
  }

  if (!isPlainObject(value)) {
    return bucket;
  }

  if (typeof value.url === "string") {
    bucket.push(...extractImageUrlsFromString(value.url));
  }

  Object.entries(value).forEach(([key, childValue]) => {
    if (key === "image_urls") {
      return;
    }
    collectImageUrls(childValue, bucket);
  });

  return bucket;
}

function dedupeImageUrls(urls = []) {
  return [...new Set(urls.filter((url) => typeof url === "string" && url.trim()))];
}

function appendImageUrlsLast(value) {
  if (Array.isArray(value)) {
    return value.map((item) => appendImageUrlsLast(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const normalizedObject = {};

  Object.entries(value).forEach(([key, childValue]) => {
    if (key === "image_urls") {
      return;
    }
    normalizedObject[key] = appendImageUrlsLast(childValue);
  });

  const existingImageUrls = normalizeImageUrlList(value.image_urls);
  const discoveredImageUrls = collectImageUrls(normalizedObject, []);
  const mergedImageUrls = dedupeImageUrls([
    ...existingImageUrls,
    ...discoveredImageUrls,
  ]);

  if (mergedImageUrls.length) {
    normalizedObject.image_urls = mergedImageUrls;
  }

  return normalizedObject;
}

function countImageUrlEntries(value) {
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countImageUrlEntries(item), 0);
  }

  if (!isPlainObject(value)) {
    return 0;
  }

  const ownCount = Array.isArray(value.image_urls) ? value.image_urls.length : 0;

  return ownCount + Object.entries(value).reduce((total, [key, childValue]) => {
    if (key === "image_urls") {
      return total;
    }
    return total + countImageUrlEntries(childValue);
  }, 0);
}

function parseMultipartForm(req) {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    uploadDir: os.tmpdir(),
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ fields, files });
    });
  });
}

function pickField(fields, key, fallback = null) {
  const value = fields[key];
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() === "true";
}

function normalizeProcessingMode(value) {
  return value === "whole_subject" ? "whole_subject" : "single_unit";
}

function buildUnitLabel(unitNumber, fallbackTitle) {
  if (typeof unitNumber === "number" && !Number.isNaN(unitNumber)) {
    return `Unit ${unitNumber}`;
  }

  return fallbackTitle || "Unit";
}

function getReaderIndex(structuredData) {
  const unit = structuredData?.units?.[0] || structuredData || {};
  const sections = Array.isArray(unit.sections)
    ? unit.sections
        .map((section) => section?.title || section?.section_title)
        .filter(Boolean)
    : [];

  return {
    sections,
    hasGlossary: Boolean(unit?.glossary?.sub_items?.length),
    hasSummary: Boolean(unit?.summary?.content?.length),
  };
}

function createSubjectGroupKey() {
  return new mongoose.Types.ObjectId().toString();
}

async function updateUploadProgress(uploadId, updates = {}) {
  await SubjectUpload.findByIdAndUpdate(uploadId, {
    $set: updates,
  }).catch(() => null);
}

async function persistTempFile(file) {
  const extension = path.extname(file.originalFilename || file.filepath || ".pdf");
  const targetPath = path.join(
    os.tmpdir(),
    `${BACKGROUND_UPLOAD_PREFIX}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}${extension || ".pdf"}`,
  );

  await fs.promises.copyFile(file.filepath, targetPath);
  return targetPath;
}

async function fetchJsonOrNull(url) {
  try {
    const { data } = await axios.get(url);
    return data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

async function sendPdfToPython({ endpoint, filePath, fileName, payload }) {
  const buffer = await fs.promises.readFile(filePath);
  const formData = new FormData();
  const blob = new Blob([buffer], { type: "application/pdf" });

  formData.append("file", blob, fileName);
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      formData.append(key, String(value));
    }
  });

  try {
    const response = await axios.post(endpoint, formData, {
      timeout: PYTHON_REQUEST_TIMEOUT_MS,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        Accept: "application/json",
      },
    });

    return response.data;
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      const timeoutError = new Error(
        `Python service timed out after ${Math.round(PYTHON_REQUEST_TIMEOUT_MS / 1000)} seconds while processing the PDF`,
      );
      timeoutError.statusCode = 504;
      timeoutError.source = "python";
      timeoutError.details = {
        endpoint,
        code: error.code,
      };
      throw timeoutError;
    }

    if (error.response) {
      const pythonError = new Error(
        error.response.data?.detail || "Python service request failed",
      );
      pythonError.statusCode = error.response.status;
      pythonError.source = "python";
      pythonError.details = error.response.data;
      throw pythonError;
    }

    const networkError = new Error(
      error.message || "Unable to reach Python service",
    );
    networkError.statusCode = 502;
    networkError.source = "python";
    networkError.details = {
      endpoint,
      code: error.code || null,
    };
    throw networkError;
  }
}

async function createOrUpdateSubjectUnit({
  uploadId,
  uploadedBy,
  originalFileName,
  board,
  standard,
  subject,
  subjectGroupKey,
  requestedTitle,
  pythonResponse,
  structuredData,
  enrichedData,
  requestId,
}) {
  const normalizedStructuredData = appendImageUrlsLast(structuredData);
  const normalizedEnrichedData = appendImageUrlsLast(enrichedData);
  const structuredUnit =
    normalizedStructuredData?.units?.[0] || normalizedStructuredData || {};
  const enrichedUnit = normalizedEnrichedData?.units?.[0] || {};
  const resolvedUnitNumber =
    structuredUnit?.unit_number ?? enrichedUnit?.unit_number ?? null;
  const resolvedUnitTitle =
    structuredUnit?.title || enrichedUnit?.title || requestedTitle;
  const resolvedPart = structuredUnit?.part || pythonResponse?.part || null;

  const update = {
    uploadId,
    uploadedBy,
    originalFileName,
    board,
    standard,
    subject,
    subjectGroupKey,
    part: resolvedPart,
    unitNumber: resolvedUnitNumber,
    unitTitle: resolvedUnitTitle,
    unitLabel: buildUnitLabel(resolvedUnitNumber, requestedTitle),
    chapterName: requestedTitle,
    processing: {
      status: "completed",
      message: pythonResponse?.message || "Processed successfully",
      pythonResponse,
      processedAt: new Date(),
    },
    structuredData: normalizedStructuredData,
    enrichedData: normalizedEnrichedData,
    readerIndex: getReaderIndex(normalizedStructuredData),
  };

  logApiStep({
    api: API_NAME,
    status: "STARTED",
    requestId,
    message: "DB Store Process Started",
  });

  logApiStep({
    api: API_NAME,
    status: "STARTED",
    requestId,
    message: `Normalized image_urls before DB store (structured=${countImageUrlEntries(normalizedStructuredData)}, enriched=${countImageUrlEntries(normalizedEnrichedData)})`,
  });

  return SubjectUnit.findOneAndUpdate(
    { documentId: pythonResponse.document_id },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
}

async function processSingleUnitUpload(upload) {
  const pythonBaseUrl = process.env.AI_URL;
  const requestId = upload._id.toString();

  logApiStep({
    api: API_NAME,
    status: "STARTED",
    requestId,
    message: "File Processing Started",
  });

  await updateUploadProgress(upload._id, {
    status: "processing",
    queuePosition: null,
    progressPercent: 20,
    progressStage: "uploading_to_python",
    progressMessage: "Sending unit PDF to Python service",
  });

  logApiStep({
    api: API_NAME,
    status: "STARTED",
    requestId,
    message: "Sending request to Python service",
  });

  const pythonResponse = await sendPdfToPython({
    endpoint: `${pythonBaseUrl}/upload-subject`,
    filePath: upload.queuedFilePath,
    fileName: upload.originalFileName,
    payload: {
      board: upload.board,
      subject: upload.subject,
      part: upload.part,
      class_name: upload.standard,
      skip_enrichment: upload.skipEnrichment,
      skip_qdrant: upload.skipQdrant,
      skip_llm_refinement: upload.skipLlmRefinement,
    },
  });

  logApiStep({
    api: API_NAME,
    status: "SUCCESS",
    requestId,
    message: "Received response from Python service",
  });

  const structuredData = await fetchJsonOrNull(
    `${pythonBaseUrl}/structured/${pythonResponse.document_id}`,
  );
  const enrichedData = pythonResponse.has_enriched
    ? await fetchJsonOrNull(`${pythonBaseUrl}/enrich/${pythonResponse.document_id}`)
    : null;

  const unit = await createOrUpdateSubjectUnit({
    uploadId: upload._id,
    uploadedBy: upload.uploadedBy,
    originalFileName: upload.originalFileName,
    board: upload.board,
    standard: upload.standard,
    subject: upload.subject,
    subjectGroupKey: upload.subjectGroupKey,
    requestedTitle: upload.unitOrChapterName,
    pythonResponse,
    structuredData,
    enrichedData,
    requestId,
  });

  logApiStep({
    api: API_NAME,
    status: "SUCCESS",
    requestId,
    message: "DB Store Completed",
  });

  await updateUploadProgress(upload._id, {
    status: "processing",
    progressPercent: 90,
    progressStage: "saving_results",
    progressMessage: "Saving processed unit results",
    totalUnits: 1,
    processedUnits: 1,
  });

  return { pythonResponse, units: [unit] };
}

async function processWholeSubjectUpload(upload) {
  const pythonBaseUrl = process.env.AI_URL;
  const requestId = upload._id.toString();

  logApiStep({
    api: API_NAME,
    status: "STARTED",
    requestId,
    message: "File Processing Started",
  });

  await updateUploadProgress(upload._id, {
    status: "processing",
    queuePosition: null,
    progressPercent: 10,
    progressStage: "uploading_to_python",
    progressMessage: "Uploading full subject PDF to Python service",
  });

  logApiStep({
    api: API_NAME,
    status: "STARTED",
    requestId,
    message: "Sending request to Python service",
  });

  const pythonResponse = await sendPdfToPython({
    endpoint: `${pythonBaseUrl}/upload_pdf`,
    filePath: upload.queuedFilePath,
    fileName: upload.originalFileName,
    payload: {
      board: upload.board,
      subject: upload.subject,
      part: upload.part,
      class_name: upload.standard,
      auto_upload: true,
      skip_enrichment: upload.skipEnrichment,
      skip_qdrant: upload.skipQdrant,
      skip_llm_refinement: upload.skipLlmRefinement,
    },
  });

  logApiStep({
    api: API_NAME,
    status: "SUCCESS",
    requestId,
    message: "Received response from Python service",
  });

  const successfulUnits = (pythonResponse.processing_results || []).filter(
    (item) => item?.success && item?.document_id,
  );

  await updateUploadProgress(upload._id, {
    status: "processing",
    progressPercent: successfulUnits.length ? 55 : 75,
    progressStage: "processing_units",
    progressMessage: `Processing ${successfulUnits.length} detected unit${successfulUnits.length === 1 ? "" : "s"}`,
    totalUnits: successfulUnits.length,
    processedUnits: 0,
  });

  const units = [];
  for (let index = 0; index < successfulUnits.length; index += 1) {
    const item = successfulUnits[index];
    const structuredData = await fetchJsonOrNull(
      `${pythonBaseUrl}/structured/${item.document_id}`,
    );
    const enrichedData = item.has_enriched
      ? await fetchJsonOrNull(`${pythonBaseUrl}/enrich/${item.document_id}`)
      : null;

    const unit = await createOrUpdateSubjectUnit({
      uploadId: upload._id,
      uploadedBy: upload.uploadedBy,
      originalFileName: upload.originalFileName,
      board: upload.board,
      standard: upload.standard,
      subject: upload.subject,
      subjectGroupKey: upload.subjectGroupKey,
      requestedTitle: upload.unitOrChapterName,
      pythonResponse: item,
      structuredData,
      enrichedData,
      requestId,
    });

    units.push(unit);
    logApiStep({
      api: API_NAME,
      status: "SUCCESS",
      requestId,
      message: "DB Store Completed",
    });

    const processedUnits = index + 1;
    const progressPercent = successfulUnits.length
      ? Math.min(92, 55 + Math.round((processedUnits / successfulUnits.length) * 35))
      : 92;

    await updateUploadProgress(upload._id, {
      status: "processing",
      progressPercent,
      progressStage: "processing_units",
      progressMessage: `Processed unit ${processedUnits} of ${successfulUnits.length}`,
      totalUnits: successfulUnits.length,
      processedUnits,
    });
  }

  return { pythonResponse, units };
}

async function finalizeUploadSuccess(upload, result) {
  upload.status = "completed";
  upload.queuePosition = null;
  upload.progressPercent = 100;
  upload.progressStage = "completed";
  upload.progressMessage = "Processing completed successfully";
  upload.processedUnits = result.units.length;
  upload.totalUnits = result.units.length;
  upload.pythonResponse = result.pythonResponse;
  upload.processedAt = new Date();
  upload.queuedFilePath = null;
  await upload.save();
}

async function finalizeUploadFailure(upload, error) {
  upload.status = "failed";
  upload.queuePosition = null;
  upload.progressStage = "failed";
  upload.progressMessage = error.message;
  upload.error = {
    message: error.message,
    source: error.source || "node",
    details: error.details || null,
  };
  upload.queuedFilePath = null;
  await upload.save();
}

async function refreshQueuedPositions() {
  const queued = await SubjectUpload.find({ status: "queued" })
    .sort({ createdAt: 1, _id: 1 })
    .select("_id");

  await Promise.all(
    queued.map((upload, index) =>
      SubjectUpload.findByIdAndUpdate(upload._id, {
        $set: {
          queuePosition: index + 1,
          progressStage: "queued",
          progressMessage:
            index === 0 && !isQueueRunning
              ? "Queued and waiting to start"
              : `Queued at position ${index + 1}`,
        },
      }),
    ),
  );
}

async function processUploadRecord(upload) {
  const requestId = upload._id.toString();
  const queuedFilePath = upload.queuedFilePath;

  try {
    if (!queuedFilePath || !fs.existsSync(queuedFilePath)) {
      const missingFileError = new Error("Queued upload file is no longer available");
      missingFileError.statusCode = 410;
      throw missingFileError;
    }

    upload.status = "processing";
    upload.queuePosition = null;
    upload.progressStage = "processing";
    upload.progressMessage = "Processing started";
    upload.progressPercent = Math.max(upload.progressPercent || 0, 10);
    await upload.save();

    const result =
      upload.processingMode === "whole_subject"
        ? await processWholeSubjectUpload(upload)
        : await processSingleUnitUpload(upload);

    await finalizeUploadSuccess(upload, result);

    logApiStep({
      api: API_NAME,
      status: "SUCCESS",
      requestId,
      message: "Completed Successfully",
    });
  } catch (error) {
    await finalizeUploadFailure(upload, error);
    logError({
      api: API_NAME,
      requestId,
      message: "Error",
      error,
    });
  } finally {
    if (queuedFilePath && fs.existsSync(queuedFilePath)) {
      await unlinkAsync(queuedFilePath).catch(() => null);
    }
    await refreshQueuedPositions();
  }
}

async function runSubjectUploadQueue() {
  if (isQueueRunning) {
    return;
  }

  isQueueRunning = true;
  try {
    while (true) {
      const nextUpload = await SubjectUpload.findOne({ status: "queued" }).sort({
        createdAt: 1,
        _id: 1,
      });

      if (!nextUpload) {
        break;
      }

      await processUploadRecord(nextUpload);
    }
  } finally {
    isQueueRunning = false;
  }
}

function ensureSubjectUploadQueueRunning() {
  setTimeout(() => {
    runSubjectUploadQueue().catch((error) => {
      logError({
        api: API_NAME,
        requestId: "queue-runner",
        message: "Queue runner failed",
        error,
      });
    });
  }, 0);
}

async function findSubjectGroupSnapshot(subjectGroupKey) {
  let units = await SubjectUnit.find({ subjectGroupKey }).sort({
    unitNumber: 1,
    createdAt: 1,
  });

  if (!units.length && String(subjectGroupKey).includes("::")) {
    const [board, standard, subject, rawPart, uploadId] = String(subjectGroupKey).split("::");
    const fallbackFilter = {
      board,
      standard,
      subject,
      part: rawPart === "general" ? null : rawPart,
    };

    if (uploadId && uploadId !== "standalone") {
      fallbackFilter.uploadId = uploadId;
    }

    units = await SubjectUnit.find(fallbackFilter).sort({
      unitNumber: 1,
      createdAt: 1,
    });
  }

  if (units.length) {
    const firstUnit = units[0];
    return {
      subjectGroupKey: firstUnit.subjectGroupKey || subjectGroupKey,
      board: firstUnit.board,
      standard: firstUnit.standard,
      subject: firstUnit.subject,
      part: firstUnit.part || null,
      unitCount: units.length,
      units,
    };
  }

  const upload = await SubjectUpload.findOne({ subjectGroupKey }).sort({
    createdAt: -1,
  });

  if (!upload) {
    return null;
  }

  return {
    subjectGroupKey,
    board: upload.board,
    standard: upload.standard,
    subject: upload.subject,
    part: upload.part || null,
    unitCount: 0,
    units: [],
  };
}

async function handleAdminSubjectUpload(req) {
  const { fields, files } = await parseMultipartForm(req);
  const assignmentMode =
    pickField(fields, "subjectAssignmentMode", "new_subject") === "existing_subject"
      ? "existing_subject"
      : "new_subject";
  const existingSubjectKey = pickField(fields, "existingSubjectKey");
  let board = pickField(fields, "board");
  let standard = pickField(fields, "standard");
  let subject = pickField(fields, "subject");
  let part = pickField(fields, "part");
  const unitOrChapterName = pickField(fields, "unitOrChapterName");
  const processingMode = normalizeProcessingMode(
    pickField(fields, "processingMode"),
  );
  const skipEnrichment = parseBoolean(pickField(fields, "skip_enrichment"), false);
  const skipQdrant = parseBoolean(pickField(fields, "skip_qdrant"), false);
  const skipLlmRefinement = parseBoolean(
    pickField(fields, "skip_llm_refinement"),
    false,
  );
  const file = files.file?.[0] || files.file;
  const requiresUnitTitle = processingMode === "single_unit";
  let subjectGroupKey = null;

  if (assignmentMode === "existing_subject") {
    if (!existingSubjectKey) {
      const error = new Error("existingSubjectKey is required when adding to an existing subject");
      error.statusCode = 400;
      throw error;
    }

    const existingGroup = await findSubjectGroupSnapshot(existingSubjectKey);
    if (!existingGroup) {
      const error = new Error("Selected subject was not found");
      error.statusCode = 404;
      throw error;
    }

    subjectGroupKey = existingGroup.subjectGroupKey;
    board = existingGroup.board;
    standard = existingGroup.standard;
    subject = existingGroup.subject;
    part = existingGroup.part;
  } else {
    subjectGroupKey = createSubjectGroupKey();
  }

  if (!board || !standard || !subject) {
    const error = new Error("board, standard, and subject are required");
    error.statusCode = 400;
    throw error;
  }

  if (requiresUnitTitle && !unitOrChapterName) {
    const error = new Error("unitOrChapterName is required for unit wise processing");
    error.statusCode = 400;
    throw error;
  }

  if (!file) {
    const error = new Error("file is required");
    error.statusCode = 400;
    throw error;
  }

  const fileName = file.originalFilename || path.basename(file.filepath);
  if (!fileName.toLowerCase().endsWith(".pdf")) {
    const error = new Error("Only PDF uploads are supported right now");
    error.statusCode = 400;
    throw error;
  }

  const queuedFilePath = await persistTempFile(file);

  const upload = await SubjectUpload.create({
    board,
    standard,
    subject,
    subjectGroupKey,
    uploadTitle: unitOrChapterName || subject,
    unitOrChapterName: unitOrChapterName || null,
    part: processingMode === "single_unit" ? part || null : part || null,
    originalFileName: fileName,
    uploadType: "pdf",
    processingMode,
    uploadedBy: req.admin._id,
    status: "queued",
    queuePosition: 0,
    queuedFilePath,
    skipEnrichment,
    skipQdrant,
    skipLlmRefinement,
    progressPercent: 5,
    progressStage: "queued",
    progressMessage: "Queued for processing",
  });

  if (file?.filepath && fs.existsSync(file.filepath)) {
    await unlinkAsync(file.filepath).catch(() => null);
  }

  await refreshQueuedPositions();
  ensureSubjectUploadQueueRunning();

  const refreshedUpload = await SubjectUpload.findById(upload._id);

  logApiStep({
    api: API_NAME,
    status: "STARTED",
    requestId: req.requestId,
    message: "Queued for FIFO processing",
  });

  return {
    upload: refreshedUpload || upload,
    units: [],
    queued: true,
  };
}

function initializeSubjectUploadQueue() {
  SubjectUpload.updateMany(
    { status: "processing" },
    {
      $set: {
        status: "queued",
        progressStage: "queued",
        progressMessage: "Server restarted. Job re-queued.",
      },
    },
  )
    .then(() => refreshQueuedPositions())
    .then(() => ensureSubjectUploadQueueRunning())
    .catch((error) => {
      logError({
        api: API_NAME,
        requestId: "queue-init",
        message: "Queue initialization failed",
        error,
      });
    });
}

module.exports = {
  appendImageUrlsLast,
  handleAdminSubjectUpload,
  initializeSubjectUploadQueue,
};
