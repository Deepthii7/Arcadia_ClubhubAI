const assert = require("node:assert/strict");
const { test } = require("node:test");
const { adviseEvent } = require("./eventAdvisorService");

const CLUB_ID = "507f1f77bcf86cd799439011";
const PROPOSED = {
  date: "2026-06-15",
  startTime: "10:00",
  endTime: "11:00",
  venue: "Main Hall",
  clubId: CLUB_ID,
};

function existingEvent(overrides = {}) {
  return {
    _id: "507f1f77bcf86cd799439012",
    title: "Private existing event",
    description: "Private event description",
    email: "private@example.invalid",
    date: new Date("2026-06-15T00:00:00.000Z"),
    startTime: "10:30",
    endTime: "11:30",
    status: "confirmed",
    venue: "Main Hall",
    clubId: CLUB_ID,
    ...overrides,
  };
}

function eventModel(events) {
  return {
    find(filter) {
      assert.ok(filter.date.$gte instanceof Date);
      assert.ok(filter.date.$lt instanceof Date);
      return {
        select(fields) {
          assert.equal(fields, "title date startTime endTime status venue clubId");
          return { lean: async () => events };
        },
      };
    },
  };
}

function providerResponse(text, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return {
        candidates: [{ content: { parts: [{ text }] } }],
      };
    },
  };
}

function fetchForSlots(slots, status = 200, inspectRequest) {
  return async (url, request) => {
    assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\//);
    assert.equal(request.headers["x-goog-api-key"], "test-only-key");
    const sentBody = JSON.parse(request.body);
    inspectRequest?.(JSON.stringify(sentBody));
    return providerResponse(JSON.stringify({ slots }), status);
  };
}

async function advise(events, slots, options = {}) {
  return adviseEvent(PROPOSED, eventModel(events), {
    apiKey: "test-only-key",
    fetchImpl: fetchForSlots(slots, options.status ?? 200, options.inspectRequest),
    ...options,
  });
}

test("accepts valid AI slots after deterministic validation", async () => {
  const result = await advise([existingEvent()], [
    {
      date: "2026-06-15",
      start: "12:00",
      end: "13:00",
      reason: "The later block remains open for setup and the event.",
    },
  ]);

  assert.equal(result.status, "conflict_found");
  assert.equal(result.alternatives.length, 1);
  assert.equal(result.alternatives[0].source, "ai");
  assert.match(result.alternatives[0].reason, /later block remains open/);
});

test("rejects an AI slot that overlaps a blocking event", async () => {
  const result = await advise([existingEvent()], [
    {
      date: "2026-06-15",
      start: "10:30",
      end: "11:30",
      reason: "This slot appears convenient for attendees.",
    },
  ]);

  assert.equal(result.alternatives.some((slot) => slot.source === "ai"), false);
  assert.ok(result.alternatives.every((slot) => slot.source === "rules"));
  assert.equal(
    result.alternatives.some((slot) => slot.startTime === "10:30"),
    false
  );
});

test("rejects an AI slot outside operating hours", async () => {
  const result = await advise([existingEvent()], [
    {
      date: "2026-06-15",
      start: "07:00",
      end: "08:00",
      reason: "The early session allows an uninterrupted hour.",
    },
  ]);

  assert.ok(result.alternatives.every((slot) => slot.source === "rules"));
  assert.equal(result.alternatives.some((slot) => slot.startTime === "07:00"), false);
});

test("keeps valid entries from mixed AI output and discards the invalid entries", async () => {
  const result = await advise([existingEvent()], [
    {
      date: "2026-06-15",
      start: "12:00",
      end: "13:00",
      reason: "This later block remains free for the event.",
    },
    {
      date: "2026-06-15",
      start: "10:30",
      end: "11:30",
      reason: "This overlaps the existing event.",
    },
    {
      date: "2026-06-15",
      start: "07:30",
      end: "08:30",
      reason: "This early slot is ideal.",
    },
    { date: "bad", start: 900, end: "10:00", reason: "Malformed slot." },
  ]);

  assert.equal(result.alternatives.length, 1);
  assert.equal(result.alternatives[0].source, "ai");
  assert.equal(result.alternatives[0].startTime, "12:00");
});

test("rejects AI reasons containing unrelated times", async () => {
  for (const reason of [
    "The room is free after 15:00 and works well.",
    "The room is free after 3 pm and works well.",
  ]) {
    const result = await advise([existingEvent()], [
      {
        date: "2026-06-15",
        start: "12:00",
        end: "13:00",
        reason,
      },
    ]);

    assert.ok(result.alternatives.every((slot) => slot.source === "rules"));
  }
});

test("falls back to rules when provider output is malformed JSON", async () => {
  const result = await advise([existingEvent()], [], {
    fetchImpl: async () => providerResponse("{not valid JSON"),
  });

  assert.ok(result.alternatives.length > 0);
  assert.ok(result.alternatives.every((slot) => slot.source === "rules"));
});

test("falls back after a provider timeout", async () => {
  const fetchImpl = (_url, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    });
  const result = await advise([existingEvent()], [], {
    fetchImpl,
    timeoutMs: 5,
  });

  assert.ok(result.alternatives.length > 0);
  assert.ok(result.alternatives.every((slot) => slot.source === "rules"));
});

test("falls back on rate limit responses", async () => {
  const result = await advise([existingEvent()], [], { status: 429 });

  assert.ok(result.alternatives.length > 0);
  assert.ok(result.alternatives.every((slot) => slot.source === "rules"));
});

test("falls back on other provider errors", async () => {
  const result = await advise([existingEvent()], [], { status: 500 });

  assert.ok(result.alternatives.length > 0);
  assert.ok(result.alternatives.every((slot) => slot.source === "rules"));
});

test("falls back without a provider key and does not call the provider", async () => {
  let called = false;
  const result = await adviseEvent(PROPOSED, eventModel([existingEvent()]), {
    apiKey: "",
    fetchImpl: async () => {
      called = true;
      throw new Error("must not fetch");
    },
  });

  assert.equal(called, false);
  assert.ok(result.alternatives.length > 0);
  assert.ok(result.alternatives.every((slot) => slot.source === "rules"));
});

test("returns explicit no-slot status without calling the AI", async () => {
  let called = false;
  const result = await adviseEvent(
    { ...PROPOSED, startTime: "08:00", endTime: "22:00" },
    eventModel([
      existingEvent({ startTime: "08:00", endTime: "22:00" }),
    ]),
    {
      apiKey: "test-only-key",
      fetchImpl: async () => {
        called = true;
        throw new Error("must not fetch");
      },
    }
  );

  assert.equal(called, false);
  assert.equal(result.status, "no_slot_found");
  assert.deepEqual(result.alternatives, []);
});

test("sends only minimized same-day, same-scope event data to Gemini", async () => {
  let sentPayload = "";
  const result = await advise([
    existingEvent(),
    existingEvent({
      _id: "507f1f77bcf86cd799439013",
      date: new Date("2026-06-16T00:00:00.000Z"),
      title: "Other date event",
      email: "other@example.invalid",
    }),
    existingEvent({
      _id: "507f1f77bcf86cd799439014",
      clubId: "507f1f77bcf86cd799439015",
      title: "Other club event",
      email: "another@example.invalid",
    }),
  ], [
    {
      date: "2026-06-15",
      start: "12:00",
      end: "13:00",
      reason: "A quiet later session avoids the scheduled event.",
    },
  ], {
    inspectRequest: (payload) => {
      sentPayload = payload;
    },
  });

  assert.equal(result.alternatives[0].source, "ai");
  assert.ok(sentPayload.includes('\\"start\\":\\"10:30\\"'));
  assert.ok(sentPayload.includes('\\"end\\":\\"11:30\\"'));
  assert.ok(sentPayload.includes('\\"scope\\":\\"same venue and same club\\"'));
  assert.equal(sentPayload.includes("Private existing event"), false);
  assert.equal(sentPayload.includes("Private event description"), false);
  assert.equal(sentPayload.includes("private@example.invalid"), false);
  assert.equal(sentPayload.includes("507f1f77bcf86cd799439012"), false);
  assert.equal(sentPayload.includes("Other date event"), false);
  assert.equal(sentPayload.includes("Other club event"), false);
  assert.equal(sentPayload.includes("other@example.invalid"), false);
});
