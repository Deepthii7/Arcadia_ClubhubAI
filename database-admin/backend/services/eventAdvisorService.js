const {
  DEFAULTS,
  detectConflicts,
  explainAlternativeSlots,
  explainConflicts,
  findAlternativeSlots,
} = require("../utils/eventScheduling");
const {
  getAiSlotSuggestions,
  validateAiSuggestions,
} = require("./geminiSlotAdvisor");

const OBJECT_ID_PATTERN = /^[\da-f]{24}$/i;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

class AdvisorInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "AdvisorInputError";
  }
}

function requiredQueryString(query, name) {
  const value = query[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new AdvisorInputError(`${name} is required.`);
  }
  return value.trim();
}

function createProposedEvent(query) {
  const date = requiredQueryString(query, "date");
  const startTime = requiredQueryString(query, "startTime");
  const venue = requiredQueryString(query, "venue");
  const clubId = requiredQueryString(query, "clubId");

  if (!DATE_PATTERN.test(date)) {
    throw new AdvisorInputError("date must be in YYYY-MM-DD format.");
  }
  const [year, month, day] = date.split("-").map(Number);
  const calendarDate = new Date(0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  calendarDate.setUTCHours(0, 0, 0, 0);
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() + 1 !== month ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new AdvisorInputError("date must be a valid calendar date.");
  }
  if (!TIME_PATTERN.test(startTime)) {
    throw new AdvisorInputError("startTime must be in HH:mm format.");
  }
  if (!OBJECT_ID_PATTERN.test(clubId)) {
    throw new AdvisorInputError("clubId must be a valid 24-character ObjectId.");
  }

  const startMinutes =
    Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
  let durationMinutes = DEFAULTS.defaultDurationMinutes;

  if (query.durationMinutes !== undefined) {
    if (
      typeof query.durationMinutes !== "string" ||
      !/^\d+$/.test(query.durationMinutes)
    ) {
      throw new AdvisorInputError("durationMinutes must be a positive whole number.");
    }
    durationMinutes = Number(query.durationMinutes);
    if (durationMinutes < 1 || durationMinutes > 840) {
      throw new AdvisorInputError(
        "durationMinutes must be between 1 and 840 minutes."
      );
    }
  }

  let endTime;
  if (query.endTime !== undefined) {
    endTime = requiredQueryString(query, "endTime");
    if (!TIME_PATTERN.test(endTime)) {
      throw new AdvisorInputError("endTime must be in HH:mm format.");
    }
    const endMinutes = Number(endTime.slice(0, 2)) * 60 + Number(endTime.slice(3));
    const endDuration = endMinutes - startMinutes;
    if (endDuration < 1) {
      throw new AdvisorInputError("endTime must be later than startTime.");
    }
    if (
      query.durationMinutes !== undefined &&
      endDuration !== durationMinutes
    ) {
      throw new AdvisorInputError(
        "durationMinutes must match the interval between startTime and endTime."
      );
    }
    durationMinutes = endDuration;
  } else {
    const endMinutes = startMinutes + durationMinutes;
    if (endMinutes > 24 * 60) {
      throw new AdvisorInputError("Event duration cannot extend past midnight.");
    }
    endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
  }
  if (durationMinutes > 840) {
    throw new AdvisorInputError("durationMinutes must not exceed 840 minutes.");
  }

  const startHour = Number(startTime.slice(0, 2));
  const endHour = Math.floor(
    (startMinutes + durationMinutes) / 60
  );
  if (
    startHour < DEFAULTS.operatingStartHour ||
    startMinutes + durationMinutes >
      DEFAULTS.operatingEndHour * 60
  ) {
    throw new AdvisorInputError(
      `Proposed events must fit within ${String(DEFAULTS.operatingStartHour).padStart(2, "0")}:00–${String(DEFAULTS.operatingEndHour).padStart(2, "0")}:00 operating hours.`
    );
  }
  if (endHour > DEFAULTS.operatingEndHour) {
    throw new AdvisorInputError("endTime is outside operating hours.");
  }

  return {
    date,
    startTime,
    endTime,
    durationMinutes,
    venue,
    clubId,
  };
}

async function adviseEvent(query, EventModel, options = {}) {
  const proposed = createProposedEvent(query);

  detectConflicts(proposed, []);
  const calendarDate = new Date(`${proposed.date}T00:00:00.000Z`);
  const fromDate = new Date(calendarDate.getTime() - 24 * 60 * 60 * 1000);
  const toDate = new Date(calendarDate.getTime() + 2 * 24 * 60 * 60 * 1000);
  const existingEvents = await EventModel.find({
    date: { $gte: fromDate, $lt: toDate },
  })
    .select("title date startTime endTime status venue clubId")
    .lean();
  const conflicts = detectConflicts(proposed, existingEvents);
  const deterministicResult =
    conflicts.length > 0
      ? findAlternativeSlots(proposed, existingEvents)
      : {
          status: "not_needed",
          date: proposed.date,
          durationMinutes: proposed.durationMinutes,
          timezone: DEFAULTS.timezone,
          slots: [],
        };
  const deterministicAlternatives = deterministicResult.slots.map((slot) => ({
    ...slot,
    reason: `Available within operating hours and respects the same-venue, same-club conflict and buffer rules.`,
    source: "rules",
  }));
  let alternatives = deterministicAlternatives;
  let sourceExplanations = [];

  if (deterministicAlternatives.length > 0 && conflicts.length > 0) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: DEFAULTS.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const proposedClubId = clubIdValue(proposed.clubId);
    const proposedVenue = normalizeVenue(proposed.venue);
    const schedule = existingEvents
      .filter((event) => {
        const clubId = clubIdValue(event.clubId);
        return (
          localDateString(event.date, formatter) === proposed.date &&
          normalizeVenue(event.venue) === proposedVenue &&
          clubId === proposedClubId
        );
      })
      .map((event) => ({
        date: localDateString(event.date, formatter),
        start: event.startTime ?? "",
        end: event.endTime ?? "",
        status: typeof event.status === "string" ? event.status : "unspecified",
        venue: String(event.venue ?? ""),
        scope: "same venue and same club",
      }));
    const suggestions = await getAiSlotSuggestions({
      apiKey: options.apiKey ?? process.env.GEMINI_API_KEY,
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
      proposed,
      schedule,
    });
    const aiAlternatives = validateAiSuggestions(
      suggestions,
      deterministicAlternatives
    );

    if (aiAlternatives.length > 0) {
      alternatives = aiAlternatives;
      sourceExplanations = aiAlternatives.map((slot) => slot.reason);
    }
  }

  const alternativeExplanations =
    conflicts.length > 0 && sourceExplanations.length === 0
      ? explainAlternativeSlots(deterministicResult)
      : sourceExplanations;

  return {
    status:
      conflicts.length === 0
        ? "available"
        : deterministicResult.status === "no_slot_found"
          ? "no_slot_found"
          : "conflict_found",
    conflicts: conflicts.map((conflict) => ({
      eventId: String(conflict.event._id ?? conflict.event.id ?? ""),
      title: conflict.event.title ?? "",
      date: conflict.date,
      startTime: conflict.startTime,
      endTime: conflict.endTime,
      venue: conflict.event.venue,
      directOverlap: conflict.directOverlap,
      bufferMinutes: conflict.bufferMinutes,
    })),
    alternatives,
    explanations: [
      ...explainConflicts(conflicts),
      ...(Array.isArray(alternativeExplanations)
        ? alternativeExplanations
        : [alternativeExplanations]),
    ],
    error: null,
  };
}

function clubIdValue(value) {
  const id = value && typeof value === "object" ? value._id : value;
  return id === undefined || id === null ? "" : String(id);
}

function normalizeVenue(value) {
  return String(value ?? "").trim().toLocaleLowerCase();
}

function localDateString(value, formatter) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const parts = Object.fromEntries(
    formatter
      .formatToParts(parsed)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: partValue }) => [type, partValue])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

module.exports = { AdvisorInputError, adviseEvent };
