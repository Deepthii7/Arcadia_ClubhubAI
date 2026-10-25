const Event = require("../models/Event");
const {
  PreferenceInputError,
  recommendStudentEvents,
} = require("../services/studentEventRecommendationService");

async function recommend(req, res) {
  try {
    res.json(await recommendStudentEvents(Event, req.body));
  } catch (error) {
    if (error instanceof PreferenceInputError) {
      return res.status(400).json({
        status: "error",
        code: "INVALID_PREFERENCES",
        message: error.message,
      });
    }

    console.error(
      "Student event recommendation lookup failed:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return res.status(500).json({
      status: "error",
      code: "EVENT_LOOKUP_FAILED",
      message: "Unable to retrieve upcoming events right now.",
    });
  }
}

module.exports = { recommend };
