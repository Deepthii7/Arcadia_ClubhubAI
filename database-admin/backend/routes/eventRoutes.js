const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const eventAdvisorController = require("../controllers/eventAdvisorController");
const eventRecommendationController = require("../controllers/eventRecommendationController");
const studentEventRecommendationController = require("../controllers/studentEventRecommendationController");
const registrationController = require("../controllers/registrationController");

router.get("/", eventController.getAll);
router.get("/advisor", eventAdvisorController.advise);
router.get("/recommendations", eventRecommendationController.recommend);
router.post("/recommendations", studentEventRecommendationController.recommend);
router.get("/:id", eventController.getOne);
router.post("/", eventController.create);
router.put("/:id", eventController.update);
router.delete("/:id", eventController.remove);

// Registrations scoped to a single event
router.get("/:eventId/registrations", registrationController.getByEvent);

module.exports = router;
