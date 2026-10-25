const { generateJsonContent } = require("./geminiClient");
const REASON_MAX_LENGTH = 240;
const SLOT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    slots: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING" },
          start: { type: "STRING" },
          end: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["date", "start", "end", "reason"],
      },
    },
  },
  required: ["slots"],
};

function isPlainReason(reason) {
  return (
    typeof reason === "string" &&
    reason.length > 0 &&
    reason.length <= REASON_MAX_LENGTH &&
    reason.trim() === reason &&
    !/[\r\n<>`*_#]/.test(reason) &&
    !/[\u0000-\u001f\u007f]/.test(reason)
  );
}

function parseSuggestions(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.keys(parsed).some((key) => key !== "slots") ||
    !Array.isArray(parsed.slots)
  ) {
    return null;
  }

  return parsed.slots
    .filter(
      (slot) =>
        slot &&
        typeof slot === "object" &&
        !Array.isArray(slot) &&
        Object.keys(slot).every((key) =>
          ["date", "start", "end", "reason"].includes(key)
        ) &&
        typeof slot.date === "string" &&
        typeof slot.start === "string" &&
        typeof slot.end === "string" &&
        isPlainReason(slot.reason)
    );
}

function hasOnlySlotTimes(reason, slot) {
  const mentionedTimes =
    reason.match(
      /\b(?:(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*[ap]\.?m\.?|(?:[01]?\d|2[0-3]):[0-5]\d|noon|midnight)\b/gi
    ) ?? [];
  return mentionedTimes.every((time) => {
    const normalized = normalizeMentionedTime(time);
    return normalized === slot.start || normalized === slot.end;
  });
}

function normalizeMentionedTime(time) {
  const normalized = time.toLowerCase().replace(/[.\s]/g, "");
  if (normalized === "noon") return "12:00";
  if (normalized === "midnight") return "00:00";

  const periodMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (periodMatch) {
    const hour = Number(periodMatch[1]);
    if (hour < 1 || hour > 12) return null;
    const minute = periodMatch[2] ?? "00";
    const normalizedHour = (hour % 12) + (periodMatch[3] === "pm" ? 12 : 0);
    return `${String(normalizedHour).padStart(2, "0")}:${minute}`;
  }

  const clockMatch = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (!clockMatch) return null;
  return `${String(Number(clockMatch[1])).padStart(2, "0")}:${clockMatch[2]}`;
}

function promptForSlots(proposed, schedule) {
  return [
    "Return JSON only, with exactly this shape: {\"slots\":[{\"date\":\"YYYY-MM-DD\",\"start\":\"HH:mm\",\"end\":\"HH:mm\",\"reason\":\"short plain-text reason\"}]}.",
    "Return at most 3 slots. Suggest only free slots on the proposed date, on a 30-minute start-time grid, within operating hours, for the same venue and club scope.",
    "Do not include a suggested slot that overlaps an existing blocking event or violates the buffer. Do not include markdown, code fences, extra fields, or text outside JSON.",
    `Proposed event: ${JSON.stringify({
      date: proposed.date,
      start: proposed.startTime,
      end: proposed.endTime,
      durationMinutes: proposed.durationMinutes,
      venue: proposed.venue,
      scope: "same venue and same club",
    })}`,
    `Constraints: ${JSON.stringify({
      operatingHours: "08:00-22:00",
      timezone: "Asia/Kolkata",
      bufferMinutes: 15,
      blockingStatuses: ["all except draft, cancelled, canceled; missing/unknown block"],
    })}`,
    `Existing events (minimized schedule data only): ${JSON.stringify(schedule)}`,
  ].join("\n");
}

async function getAiSlotSuggestions({
  apiKey,
  timeoutMs = 4500,
  proposed,
  schedule,
  fetchImpl,
}) {
  const text = await generateJsonContent({
    apiKey,
    fetchImpl,
    timeoutMs,
    prompt: promptForSlots(proposed, schedule),
    responseSchema: SLOT_RESPONSE_SCHEMA,
  });
  return text ? parseSuggestions(text) : null;
}

function validateAiSuggestions(suggestions, deterministicSlots) {
  if (!Array.isArray(suggestions)) return [];
  const verified = new Map(
    deterministicSlots.map((slot) => [
      `${slot.date}|${slot.startTime}|${slot.endTime}`,
      slot,
    ])
  );
  const seen = new Set();
  const accepted = [];

  for (const suggestion of suggestions) {
    if (
      !isPlainReason(suggestion.reason) ||
      !hasOnlySlotTimes(suggestion.reason, suggestion)
    ) {
      continue;
    }
    const key = `${suggestion.date}|${suggestion.start}|${suggestion.end}`;
    const slot = verified.get(key);
    if (!slot || seen.has(key)) continue;
    seen.add(key);
    accepted.push({
      ...slot,
      reason: suggestion.reason,
      source: "ai",
    });
    if (accepted.length === 3) break;
  }

  return accepted;
}

module.exports = {
  getAiSlotSuggestions,
  parseSuggestions,
  validateAiSuggestions,
};
