const {
  listSubjectGroups,
  getSubjectGroupByKey,
  resolveSubjectUnit,
  toUnitSummary,
  extractSectionTopicsForUnit,
  extractFaqsForUnit,
} = require("../services/learningContextService");

const controller = {
  async listSubjects(req, res) {
    try {
      const data = await listSubjectGroups(req.query);
      return res.status(200).json({ status: true, data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to list subjects",
      });
    }
  },

  async getSubjectDetail(req, res) {
    try {
      const data = await getSubjectGroupByKey(req.params.subjectGroupKey);
      return res.status(200).json({ status: true, data });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to fetch subject detail",
      });
    }
  },

  async getUnit(req, res) {
    try {
      const unit = await resolveSubjectUnit({ unitId: req.params.unitId });
      return res.status(200).json({ status: true, data: toUnitSummary(unit) });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to fetch unit",
      });
    }
  },

  async getUnitContent(req, res) {
    try {
      const format = req.query.format === "structured" ? "structured" : "enriched";
      const unit = await resolveSubjectUnit({ unitId: req.params.unitId });
      const content =
        format === "structured"
          ? unit.structuredData || unit.enrichedData
          : unit.enrichedData || null;

      return res.status(200).json({
        status: true,
        data: {
          unit: toUnitSummary(unit),
          format,
          content,
          sectionTopics: extractSectionTopicsForUnit(unit),
        },
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to fetch unit content",
      });
    }
  },

  async getUnitFaq(req, res) {
    try {
      const unit = await resolveSubjectUnit({ unitId: req.params.unitId });
      const faqs = extractFaqsForUnit(unit);

      return res.status(200).json({
        status: true,
        data: {
          unit: toUnitSummary(unit),
          faqs,
        },
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        status: false,
        message: error.message || "Failed to fetch unit FAQs",
      });
    }
  },
};

module.exports = controller;
