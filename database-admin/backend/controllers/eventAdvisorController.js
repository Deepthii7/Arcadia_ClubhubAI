const Event = require("../models/Event");
const {
  AdvisorInputError,
  adviseEvent,
} = require("../services/eventAdvisorService");

async function advise(req, res) {
  try {
    const result = await adviseEvent(req.query, Event);
    res.json(result);
  } catch (error) {
    if (error instanceof AdvisorInputError) {
      return res.status(400).json({
        status: "error",
        conflicts: [],
        alternatives: [],
        explanations: [],
        error: {
          code: "INVALID_INPUT",
          message: error.message,
        },
      });
    }

    console.error("Event scheduling advisor data lookup failed:", error);
    return res.status(500).json({
      status: "error",
      conflicts: [],
      alternatives: [],
      explanations: [],
      error: {
        code: "DATA_ACCESS_FAILED",
        message: "Unable to retrieve existing events for scheduling advice.",
      },
    });
  }
}

module.exports = { advise };
