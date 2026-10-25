const Event = require("../models/Event");
const { recommendEvents } = require("../services/eventRecommendationService");

async function recommend(req, res) {
  try {
    res.json(await recommendEvents(Event));
  } catch (error) {
    console.error(
      "Upcoming event recommendation data lookup failed:",
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
