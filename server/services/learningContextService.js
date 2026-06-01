const mongoose = require("mongoose");
const SubjectUnit = require("../model/SubjectUnit");
const Unit = require("../model/Unit");
const BookContent = require("../model/BookContent");

function escapeRegExp(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSubjectGroupLookup(unit) {
  return unit.subjectGroupKey || [unit.board, unit.standard, unit.subject].join("::");
}

function normalizeAssetPath(value = "") {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) {
    return raw;
  }

  if (/^[a-z]:\\/i.test(raw)) {
    const normalized = raw.replace(/\\/g, "/");
    const uploadsIndex = normalized.toLowerCase().lastIndexOf("/uploads/");
    if (uploadsIndex >= 0) {
      return normalized.slice(uploadsIndex);
    }
    return null;
  }

  return `/${raw.replace(/^\/+/, "")}`;
}

function collectImageCandidates(...values) {
  const unique = [];
  const seen = new Set();

  const pushValue = (candidate) => {
    const normalized = normalizeAssetPath(candidate);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    unique.push(normalized);
  };

  values.forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach(pushValue);
      return;
    }

    if (value && typeof value === "object") {
      pushValue(value.url);
      pushValue(value.src);
      pushValue(value.image);
      pushValue(value.imageUrl);
      pushValue(value.thumbnail);
      pushValue(value.thumbnailUrl);
      return;
    }

    pushValue(value);
  });

  return unique;
}

const TOPIC_EXCLUDE_PATTERNS = [
  /\bpoints?\s+to\s+remember\b/i,
  /\bproblems?\b/i,
  /\bdo\s+you\s+know\b/i,
  /\bactivit(y|ies)\b/i,
  /\bexercises?\b/i,
  /\bsummary\b/i,
  /\bquestion\s*bank\b/i,
  /\bpractice\s+questions?\b/i,
];

function normalizeTopicLabel(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[\-\u2022•]+\s*/, "")
    .trim();
}

function isEligibleSectionTopic(value = "") {
  const normalized = normalizeTopicLabel(value);
  if (!normalized) {
    return false;
  }

  return !TOPIC_EXCLUDE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function createTopicRecord({
  unit,
  sectionId,
  sectionNumber,
  sectionTitle,
}) {
  const cleanTitle = normalizeTopicLabel(sectionTitle);
  if (!isEligibleSectionTopic(cleanTitle)) {
    return null;
  }

  const normalizedSectionNumber = normalizeTopicLabel(sectionNumber);
  const displayLabel = normalizedSectionNumber
    ? `${normalizedSectionNumber} ${cleanTitle}`.trim()
    : cleanTitle;

  return {
    id: sectionId || `${unit.documentId}:${displayLabel}`,
    subjectGroupKey: getSubjectGroupLookup(unit),
    subject: unit.subject,
    unitId: String(unit._id),
    unitNumber: unit.unitNumber,
    unitTitle: unit.unitTitle,
    documentId: unit.documentId,
    sectionId: sectionId || null,
    sectionNumber: normalizedSectionNumber || null,
    sectionTitle: cleanTitle,
    label: displayLabel,
  };
}

function extractTopicsFromValue(value, unit, collected, seen) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => extractTopicsFromValue(item, unit, collected, seen));
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const directTitle =
    value.section_title ||
    value.sectionTitle ||
    value.topic ||
    value.title ||
    value.heading ||
    value.name;
  const directNumber =
    value.section_number ||
    value.sectionNumber ||
    value.number ||
    value.topic_number ||
    value.topicNumber;

  if (directTitle) {
    const topicRecord = createTopicRecord({
      unit,
      sectionId: value.section_id || value.sectionId || value.id,
      sectionNumber: directNumber,
      sectionTitle: directTitle,
    });

    if (topicRecord) {
      const topicKey = `${topicRecord.unitId}:${topicRecord.label.toLowerCase()}`;
      if (!seen.has(topicKey)) {
        seen.add(topicKey);
        collected.push(topicRecord);
      }
    }
  }

  [
    value.units,
    value.sections,
    value.topics,
    value.content,
    value.children,
    value.items,
    value.chapters,
  ].forEach((nested) => extractTopicsFromValue(nested, unit, collected, seen));
}

function extractSectionTopicsForUnit(unit) {
  const collected = [];
  const seen = new Set();

  extractTopicsFromValue(unit.enrichedData, unit, collected, seen);
  extractTopicsFromValue(unit.structuredData, unit, collected, seen);

  return collected.sort((a, b) => {
    const aUnit = a.unitNumber ?? Number.MAX_SAFE_INTEGER;
    const bUnit = b.unitNumber ?? Number.MAX_SAFE_INTEGER;
    if (aUnit !== bUnit) {
      return aUnit - bUnit;
    }

    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" });
  });
}

function normalizeFaqText(value = "") {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function createFaqRecord({
  unit,
  question,
  answer,
  sectionTitle,
  source,
}) {
  const cleanQuestion = normalizeFaqText(question);
  const cleanAnswer = normalizeFaqText(answer);
  if (!cleanQuestion || !cleanAnswer) {
    return null;
  }

  return {
    id: `${unit.documentId}:${cleanQuestion.toLowerCase()}`,
    subjectGroupKey: getSubjectGroupLookup(unit),
    subject: unit.subject,
    unitId: String(unit._id),
    unitNumber: unit.unitNumber,
    unitTitle: unit.unitTitle,
    documentId: unit.documentId,
    question: cleanQuestion,
    answer: cleanAnswer,
    sectionTitle: normalizeFaqText(sectionTitle) || null,
    source: source || null,
  };
}

function extractFaqsFromValue(value, unit, collected, seen, sectionTitle = null) {
  if (!value) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => extractFaqsFromValue(item, unit, collected, seen, sectionTitle));
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const directQuestion =
    value.question ||
    value.q ||
    value.prompt ||
    value.ask ||
    value.title ||
    value.heading;
  const directAnswer =
    value.answer ||
    value.a ||
    value.response ||
    value.reply ||
    value.content ||
    value.summary ||
    value.explanation;

  const nextSectionTitle =
    value.section_title ||
    value.sectionTitle ||
    value.topic ||
    value.title ||
    sectionTitle;

  if (directQuestion && directAnswer) {
    const faqRecord = createFaqRecord({
      unit,
      question: directQuestion,
      answer: directAnswer,
      sectionTitle: nextSectionTitle,
      source: value.source || value.kind || value.type || null,
    });

    if (faqRecord) {
      const faqKey = `${faqRecord.unitId}:${faqRecord.question.toLowerCase()}`;
      if (!seen.has(faqKey)) {
        seen.add(faqKey);
        collected.push(faqRecord);
      }
    }
  }

  [
    value.units,
    value.faq,
    value.faqs,
    value.questions,
    value.qa,
    value.qna,
    value.items,
    value.children,
    value.sections,
    value.topics,
    value.content,
    value.enrichment,
  ].forEach((nested) => extractFaqsFromValue(nested, unit, collected, seen, nextSectionTitle));
}

function extractFaqsForUnit(unit) {
  const collected = [];
  const seen = new Set();

  extractFaqsFromValue(unit.enrichedData, unit, collected, seen);
  extractFaqsFromValue(unit.structuredData, unit, collected, seen);

  return collected;
}

async function resolveSubjectGroupImages(units = []) {
  const firstUnit = units[0];
  if (!firstUnit) {
    return {
      coverImageUrl: null,
      imageCandidates: [],
    };
  }

  const subjectFilter = {
    board: firstUnit.board,
    subject: firstUnit.subject,
  };

  if (firstUnit.standard) {
    subjectFilter.grade = firstUnit.standard;
  }

  const [matchingUnit, matchingBook] = await Promise.all([
    Unit.findOne({
      ...subjectFilter,
      ...(firstUnit.unitNumber ? { unitNumber: firstUnit.unitNumber } : {}),
    })
      .sort({ updatedAt: -1 })
      .select("coverImageUrl metadata"),
    BookContent.findOne(subjectFilter)
      .sort({ updatedAt: -1 })
      .select("coverImageUrl metadata"),
  ]);

  const imageCandidates = collectImageCandidates(
    matchingBook?.coverImageUrl,
    matchingBook?.metadata?.coverImageUrl,
    matchingBook?.metadata?.coverImage,
    matchingBook?.metadata?.thumbnail,
    matchingUnit?.coverImageUrl,
    matchingUnit?.metadata?.coverImageUrl,
    matchingUnit?.metadata?.coverImage,
    matchingUnit?.metadata?.thumbnail,
    firstUnit?.enrichedData?.coverImageUrl,
    firstUnit?.enrichedData?.coverImage,
    firstUnit?.enrichedData?.thumbnail,
    firstUnit?.structuredData?.coverImageUrl,
    firstUnit?.structuredData?.coverImage,
    firstUnit?.structuredData?.thumbnail,
  );

  return {
    coverImageUrl: imageCandidates[0] || null,
    imageCandidates,
  };
}

function toUnitSummary(unit) {
  return {
    id: unit._id,
    subjectGroupKey: getSubjectGroupLookup(unit),
    documentId: unit.documentId,
    board: unit.board,
    standard: unit.standard,
    subject: unit.subject,
    part: unit.part,
    unitNumber: unit.unitNumber,
    unitTitle: unit.unitTitle,
    unitLabel: unit.unitLabel,
    chapterName: unit.chapterName,
    readerIndex: unit.readerIndex,
    hasStructuredData: Boolean(unit.structuredData),
    hasEnrichedData: Boolean(unit.enrichedData),
    sectionTopics: extractSectionTopicsForUnit(unit),
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
  };
}

function getSubjectVisual(subject = "") {
  const normalized = String(subject).toLowerCase();
  if (normalized.includes("math")) {
    return { iconKey: "calculator", colorKey: "blue" };
  }
  if (normalized.includes("physics")) {
    return { iconKey: "zap", colorKey: "cyan" };
  }
  if (normalized.includes("chem")) {
    return { iconKey: "flask", colorKey: "green" };
  }
  if (normalized.includes("bio") || normalized.includes("science")) {
    return { iconKey: "dna", colorKey: "emerald" };
  }
  if (normalized.includes("history")) {
    return { iconKey: "scroll", colorKey: "amber" };
  }
  if (normalized.includes("english")) {
    return { iconKey: "book-open", colorKey: "rose" };
  }
  return { iconKey: "book-open", colorKey: "slate" };
}

function toSubjectGroup(units = []) {
  const orderedUnits = [...units].sort((a, b) => {
    const aNumber = a.unitNumber ?? Number.MAX_SAFE_INTEGER;
    const bNumber = b.unitNumber ?? Number.MAX_SAFE_INTEGER;
    return aNumber - bNumber || a.unitTitle.localeCompare(b.unitTitle);
  });

  const firstUnit = orderedUnits[0];
  const subjectGroupKey = getSubjectGroupLookup(firstUnit);

  return {
    id: subjectGroupKey,
    subjectGroupKey,
    title: firstUnit.subject,
    subject: firstUnit.subject,
    board: firstUnit.board,
    standard: firstUnit.standard,
    part: firstUnit.part,
    unitCount: orderedUnits.length,
    visual: getSubjectVisual(firstUnit.subject),
    coverImageUrl: null,
    imageCandidates: [],
    unitNumbers: orderedUnits
      .map((unit) => unit.unitNumber)
      .filter((unitNumber) => unitNumber !== null && unitNumber !== undefined),
    units: orderedUnits.map(toUnitSummary),
    updatedAt: orderedUnits.reduce(
      (latest, current) => (latest > current.updatedAt ? latest : current.updatedAt),
      orderedUnits[0].updatedAt,
    ),
  };
}

async function listSubjectGroups(filters = {}) {
  const query = {
    "processing.status": { $ne: "failed" },
  };

  if (filters.board) {
    query.board = filters.board;
  }
  if (filters.standard) {
    query.standard = filters.standard;
  }
  if (filters.subject) {
    query.subject = new RegExp(`^${escapeRegExp(filters.subject)}$`, "i");
  }
  if (filters.search) {
    query.$or = [
      { subject: { $regex: filters.search, $options: "i" } },
      { unitTitle: { $regex: filters.search, $options: "i" } },
      { chapterName: { $regex: filters.search, $options: "i" } },
    ];
  }

  const units = await SubjectUnit.find(query).sort({
    board: 1,
    standard: 1,
    subject: 1,
    unitNumber: 1,
    unitTitle: 1,
  });

  const groups = new Map();

  units.forEach((unit) => {
    const key = getSubjectGroupLookup(unit);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(unit);
  });

  const subjectGroups = [...groups.values()].map(toSubjectGroup);

  return Promise.all(
    subjectGroups.map(async (group) => ({
      ...group,
      ...(await resolveSubjectGroupImages(group.units)),
    })),
  );
}

async function getSubjectGroupByKey(subjectGroupKey) {
  const units = await SubjectUnit.find({
    $or: [
      { subjectGroupKey },
      {
        $expr: {
          $eq: [{ $concat: ["$board", "::", "$standard", "::", "$subject"] }, subjectGroupKey],
        },
      },
    ],
  }).sort({
    unitNumber: 1,
    unitTitle: 1,
  });

  if (!units.length) {
    const error = new Error("Subject group not found");
    error.statusCode = 404;
    throw error;
  }

  const group = toSubjectGroup(units);
  return {
    ...group,
    ...(await resolveSubjectGroupImages(group.units)),
  };
}

async function listSectionTopicsForSubjectGroup(subjectGroupKey) {
  const group = await getSubjectGroupByKey(subjectGroupKey);
  const units = await Promise.all(
    (group.units || []).map((summary) => resolveSubjectUnit({ unitId: summary.id })),
  );

  return units.flatMap((unit) => extractSectionTopicsForUnit(unit));
}

async function resolveSubjectUnit({
  unitId,
  documentId,
  subjectGroupKey,
  unitNumber,
  subject,
  unitTitle,
}) {
  if (unitId && mongoose.Types.ObjectId.isValid(unitId)) {
    const unit = await SubjectUnit.findById(unitId);
    if (unit) {
      return unit;
    }
  }

  if (documentId) {
    const unit = await SubjectUnit.findOne({ documentId });
    if (unit) {
      return unit;
    }
  }

  if (subjectGroupKey && unitNumber !== undefined && unitNumber !== null && unitNumber !== "") {
    const unit = await SubjectUnit.findOne({
      $or: [
        { subjectGroupKey },
        {
          $expr: {
            $eq: [{ $concat: ["$board", "::", "$standard", "::", "$subject"] }, subjectGroupKey],
          },
        },
      ],
      unitNumber: Number(unitNumber),
    });

    if (unit) {
      return unit;
    }
  }

  const fallbackFilter = {};

  if (subjectGroupKey) {
    fallbackFilter.$or = [
      { subjectGroupKey },
      {
        $expr: {
          $eq: [{ $concat: ["$board", "::", "$standard", "::", "$subject"] }, subjectGroupKey],
        },
      },
    ];
  }

  if (subject) {
    fallbackFilter.subject = new RegExp(`^${escapeRegExp(subject)}$`, "i");
  }

  if (unitNumber !== undefined && unitNumber !== null && unitNumber !== "") {
    fallbackFilter.unitNumber = Number(unitNumber);
  }

  if (unitTitle) {
    fallbackFilter.$or = [
      ...(fallbackFilter.$or || []),
      { unitTitle: new RegExp(`^${escapeRegExp(unitTitle)}$`, "i") },
      { chapterName: new RegExp(`^${escapeRegExp(unitTitle)}$`, "i") },
      { unitLabel: new RegExp(`^${escapeRegExp(unitTitle)}$`, "i") },
    ];
  }

  const unit = await SubjectUnit.findOne(fallbackFilter).sort({
    updatedAt: -1,
  });

  if (!unit) {
    const error = new Error("Subject unit not found");
    error.statusCode = 404;
    throw error;
  }

  return unit;
}

function getPythonLearningContext(unit) {
  return {
    documentId: unit.documentId,
    board: unit.board,
    classNumber: unit.standard,
    subject: unit.subject,
    unitNumber: unit.unitNumber || 1,
    unitName: unit.unitTitle || unit.chapterName || unit.unitLabel || "",
  };
}

module.exports = {
  listSubjectGroups,
  getSubjectGroupByKey,
  listSectionTopicsForSubjectGroup,
  extractSectionTopicsForUnit,
  extractFaqsForUnit,
  resolveSubjectUnit,
  getPythonLearningContext,
  toUnitSummary,
  getSubjectVisual,
};
