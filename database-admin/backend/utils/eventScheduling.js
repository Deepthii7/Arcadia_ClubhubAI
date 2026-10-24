const DEFAULTS = Object.freeze({
  defaultDurationMinutes: 60,
  operatingStartHour: 8,
  operatingEndHour: 22,
  bufferMinutes: 15,
  slotIntervalMinutes: 30,
  timezone: "Asia/Kolkata",
});

const NON_BLOCKING_STATUSES = new Set(["cancelled", "canceled", "draft"]);

function dateFormatter(timezone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch (error) {
    if (error instanceof RangeError) {
      throw new Error(`Invalid timezone: ${timezone}`);
    }
    throw error;
  }
}

function zonedParts(epoch, formatter) {
  const parts = Object.fromEntries(
    formatter
      .formatToParts(new Date(epoch))
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)])
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

function checkedCalendarDate(year, month, day) {
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Event date must be a valid date.");
  }
  return { year, month, day };
}

function dateParts(value, formatter) {
  if (value === undefined || value === null || value === "") {
    throw new Error("Event date is required.");
  }

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return checkedCalendarDate(year, month, day);
  }

  if (!(value instanceof Date) && typeof value !== "string") {
    throw new Error("Event date must be a valid date.");
  }
  if (typeof value === "string") {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})T.+(?:Z|[+-]\d{2}:\d{2})$/i.exec(value);
    if (!match) {
      throw new Error(
        "Event date must be a valid date in YYYY-MM-DD format or an ISO datetime with a timezone."
      );
    }
    checkedCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }
  const epoch = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(epoch)) {
    throw new Error("Event date must be a valid date.");
  }
  return zonedParts(epoch, formatter);
}

function parseTime(value, fieldName) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
    throw new Error(`${fieldName} must be in HH:mm format.`);
  }
  const [hour, minute] = value.split(":").map(Number);
  return { hour, minute };
}

function localDateTimeToEpoch(parts, formatter, timezone) {
  const target = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute
  );
  let epoch = target;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(epoch, formatter);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute
    );
    const difference = actualAsUtc - target;
    if (difference === 0) return epoch;
    epoch -= difference;
  }

  const verified = zonedParts(epoch, formatter);
  if (
    verified.year !== parts.year ||
    verified.month !== parts.month ||
    verified.day !== parts.day ||
    verified.hour !== parts.hour ||
    verified.minute !== parts.minute
  ) {
    throw new Error(
      `The local event time does not exist in timezone ${timezone}.`
    );
  }
  return epoch;
}

function eventInterval(event, options = {}) {
  if (!event || typeof event !== "object") {
    throw new Error("Event data is required.");
  }

  const timezone = options.timezone ?? DEFAULTS.timezone;
  const formatter = dateFormatter(timezone);
  const localDate = dateParts(event.date, formatter);
  let start;

  if (event.startTime) {
    start = parseTime(event.startTime, "Event startTime");
  } else {
    const dateEpoch =
      event.date instanceof Date ? event.date.getTime() : Date.parse(event.date);
    const dateTime =
      typeof event.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(event.date)
        ? null
        : Number.isFinite(dateEpoch)
          ? zonedParts(dateEpoch, formatter)
          : null;
    if (!dateTime || dateTime.hour === 0 && dateTime.minute === 0) {
      throw new Error(
        "Event startTime is required unless event.date includes a local time."
      );
    }
    start = { hour: dateTime.hour, minute: dateTime.minute };
  }

  const startEpoch = localDateTimeToEpoch(
    { ...localDate, ...start },
    formatter,
    timezone
  );
  let durationMinutes = options.defaultDurationMinutes ?? DEFAULTS.defaultDurationMinutes;

  if (event.endTime) {
    const end = parseTime(event.endTime, "Event endTime");
    const startMinutes = start.hour * 60 + start.minute;
    const endMinutes = end.hour * 60 + end.minute;
    durationMinutes = endMinutes - startMinutes;
    if (durationMinutes <= 0) {
      throw new Error("Event endTime must be later than startTime on the same date.");
    }
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new Error("Event duration must be a positive number of minutes.");
  }

  return {
    date: `${String(localDate.year).padStart(4, "0")}-${String(localDate.month).padStart(2, "0")}-${String(localDate.day).padStart(2, "0")}`,
    startTime: `${String(start.hour).padStart(2, "0")}:${String(start.minute).padStart(2, "0")}`,
    endTime: formatTime(start.hour * 60 + start.minute + durationMinutes),
    start: startEpoch,
    end: startEpoch + durationMinutes * 60_000,
    durationMinutes,
    timezone,
  };
}

function formatTime(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function statusBlocks(event) {
  const status = typeof event.status === "string" ? event.status.trim().toLowerCase() : "";
  return !NON_BLOCKING_STATUSES.has(status);
}

function getClubId(value) {
  const id = value && typeof value === "object" ? value._id : value;
  return id === undefined || id === null ? "" : String(id);
}

function sameSchedulingScope(proposed, existing) {
  const proposedVenue = String(proposed.venue ?? "").trim().toLowerCase();
  const existingVenue = String(existing.venue ?? "").trim().toLowerCase();
  const proposedClub = getClubId(proposed.clubId);
  const existingClub = getClubId(existing.clubId);
  return Boolean(
    proposedVenue &&
      existingVenue &&
      proposedClub &&
      existingClub &&
      proposedVenue === existingVenue &&
      proposedClub === existingClub
  );
}

function detectConflicts(proposed, existingEvents, options = {}) {
  if (!proposed || typeof proposed !== "object") {
    throw new Error("Proposed event data is required.");
  }
  if (!Array.isArray(existingEvents)) {
    throw new Error("Existing events must be provided as an array.");
  }
  if (!String(proposed.venue ?? "").trim() || !getClubId(proposed.clubId)) {
    throw new Error("Proposed event venue and clubId are required.");
  }

  const bufferMinutes = options.bufferMinutes ?? DEFAULTS.bufferMinutes;
  if (!Number.isFinite(bufferMinutes) || bufferMinutes < 0) {
    throw new Error("Buffer must be a non-negative number of minutes.");
  }

  const proposedInterval = eventInterval(proposed, options);
  const conflicts = [];

  for (const event of existingEvents) {
    if (!event || typeof event !== "object") {
      throw new Error("Existing events must contain event objects.");
    }
    if (!statusBlocks(event) || !sameSchedulingScope(proposed, event)) continue;
    const existingInterval = eventInterval(event, options);
    const overlaps =
      proposedInterval.start < existingInterval.end + bufferMinutes * 60_000 &&
      proposedInterval.end + bufferMinutes * 60_000 > existingInterval.start;

    if (overlaps) {
      conflicts.push({
        event,
        date: existingInterval.date,
        startTime: existingInterval.startTime,
        endTime: existingInterval.endTime,
        directOverlap:
          proposedInterval.start < existingInterval.end &&
          proposedInterval.end > existingInterval.start,
        bufferMinutes,
      });
    }
  }

  return conflicts;
}

function findAlternativeSlots(proposed, existingEvents, options = {}) {
  const interval = eventInterval(proposed, options);
  const slotIntervalMinutes =
    options.slotIntervalMinutes ?? DEFAULTS.slotIntervalMinutes;
  const operatingStartHour =
    options.operatingStartHour ?? DEFAULTS.operatingStartHour;
  const operatingEndHour =
    options.operatingEndHour ?? DEFAULTS.operatingEndHour;

  if (!Number.isInteger(slotIntervalMinutes) || slotIntervalMinutes <= 0) {
    throw new Error("Slot interval must be a positive whole number of minutes.");
  }
  if (
    !Number.isInteger(operatingStartHour) ||
    !Number.isInteger(operatingEndHour) ||
    operatingStartHour < 0 ||
    operatingEndHour > 24 ||
    operatingStartHour >= operatingEndHour
  ) {
    throw new Error("Operating hours must be valid whole hours within one day.");
  }

  const originalStartMinutes =
    Number(interval.startTime.slice(0, 2)) * 60 +
    Number(interval.startTime.slice(3));
  const lastStart =
    operatingEndHour * 60 - interval.durationMinutes;
  const slots = [];

  for (
    let candidateMinutes = operatingStartHour * 60;
    candidateMinutes <= lastStart;
    candidateMinutes += slotIntervalMinutes
  ) {
    if (candidateMinutes === originalStartMinutes) continue;
    const startTime = formatTime(candidateMinutes);
    const endTime = formatTime(candidateMinutes + interval.durationMinutes);
    const candidate = { ...proposed, startTime, endTime };

    if (detectConflicts(candidate, existingEvents, options).length === 0) {
      slots.push({
        date: interval.date,
        startTime,
        endTime,
        durationMinutes: interval.durationMinutes,
        timezone: interval.timezone,
      });
    }
  }

  return {
    status: slots.length > 0 ? "found" : "no_slot_found",
    date: interval.date,
    durationMinutes: interval.durationMinutes,
    timezone: interval.timezone,
    slots,
  };
}

function explainConflicts(conflicts) {
  if (!Array.isArray(conflicts)) {
    throw new Error("Conflicts must be provided as an array.");
  }
  if (conflicts.length === 0) return ["No scheduling conflicts were found."];

  return conflicts.map(({ event, date, startTime, endTime, directOverlap }) => {
    const title = event.title ? `"${event.title}"` : "an existing event";
    const reason = directOverlap ? "overlaps" : "is within the required buffer of";
    return `${title} at ${event.venue} on ${date} from ${startTime} to ${endTime} ${reason} the proposed event.`;
  });
}

function explainAlternativeSlots(result) {
  if (!result || !Array.isArray(result.slots)) {
    throw new Error("Alternative slot results are required.");
  }
  if (result.status === "no_slot_found") {
    return `No available alternative slot was found on ${result.date}.`;
  }
  return result.slots.map(
    ({ date, startTime, endTime }) =>
      `Available alternative: ${date} from ${startTime} to ${endTime}.`
  );
}

module.exports = {
  DEFAULTS,
  detectConflicts,
  explainAlternativeSlots,
  explainConflicts,
  findAlternativeSlots,
};
