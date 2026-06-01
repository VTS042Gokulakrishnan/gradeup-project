const express = require("express");
const controller = require("../controller/LearningLibrary");

const router = express.Router();

router.get("/subjects", controller.listSubjects);
router.get("/subjects/:subjectGroupKey", controller.getSubjectDetail);
router.get("/units/:unitId", controller.getUnit);
router.get("/units/:unitId/content", controller.getUnitContent);
router.get("/units/:unitId/faq", controller.getUnitFaq);

module.exports = router;
