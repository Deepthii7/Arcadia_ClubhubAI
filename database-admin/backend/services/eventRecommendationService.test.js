const assert = require("node:assert/strict");
const { test } = require("node:test");
const { recommendEvents } = require("./eventRecommendationService");

const NOW = new Date("2026-01-01T00:00:00.000Z");
const FIRST_ID = "507f1f77bcf86cd799439011";
const SECOND_ID = "507f1f77bcf86cd799439012";

function event(id = FIRST_ID, overrides = {}) {
  return {
    _id: id,
    title: `Event ${id.slice(-1)}`,
    description: "A useful upcoming event.",
    date: new Date("2026-06-15T00:00:00.000Z"),
    startTime: "10:00",
    endTime: "11:00",
    venue: "Main Hall",
    category: "Technical",
    clubId: { _id: "507f1f77bcf86cd799439099", name: "Example Club" },
    registrationFormUrl: "https://example.invalid/register",
    coordinators: [{ email: "private@example.invalid" }],
    ...overrides,
  };
}

function eventModel(events) {
  return {
    find(filter) {
      assert.deepEqual(filter, { date: { $gte: NOW } });
      const query = {
        select(fields) {
          assert.match(fields, /title description date/);
          assert.match(fields, /registrationFormUrl/);
          return query;
        },
        sort(value) {
          assert.deepEqual(value, { date: 1 });
          return query;
        },
        limit(value) {
          assert.equal(value, 20);
          return query;
        },
        populate(path, fields) {
          assert.equal(path, "clubId");
          assert.equal(fields, "name");
          return query;
        },
        async lean() {
          return events;
        },
      };
      return query;
    },
  };
}

function providerFetch(text, status = 200, inspectRequest) {
  return async (url, request) => {
    assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\//);
    assert.equal(request.headers["x-goog-api-key"], "test-only-key");
    const body = JSON.parse(request.body);
    inspectRequest?.(body);
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return {
          candidates: [{ content: { parts: [{ text }] } }],
        };
      },
    };
  };
}

function responseText(recommendations) {
  return JSON.stringify({ recommendations });
}

async function recommend(events, recommendations, options = {}) {
  return recommendEvents(eventModel(events), {
    now: NOW,
    apiKey: "test-only-key",
    fetchImpl: providerFetch(responseText(recommendations)),
    ...options,
  });
}

test("returns Gemini-ranked recommendations joined to real event records", async () => {
  const first = event(FIRST_ID);
  const second = event(SECOND_ID, {
    title: "Database-backed event title",
    venue: "Actual Venue",
  });
  let sentPrompt;
  const result = await recommend([first, second], [
    { eventId: SECOND_ID, reason: "Its technical topic is described in the listing." },
    { eventId: FIRST_ID, reason: "Its details provide a clear upcoming activity." },
  ], {
    fetchImpl: providerFetch(
      responseText([
        { eventId: SECOND_ID, reason: "Its technical topic is described in the listing." },
        { eventId: FIRST_ID, reason: "Its details provide a clear upcoming activity." },
      ]),
      200,
      (body) => {
        sentPrompt = body.contents[0].parts[0].text;
      }
    ),
  });

  assert.equal(result.source, "ai");
  assert.deepEqual(
    result.recommendations.map(({ eventId }) => eventId),
    [SECOND_ID, FIRST_ID]
  );
  assert.equal(result.recommendations[0].event.title, "Database-backed event title");
  assert.equal(result.recommendations[0].event.venue, "Actual Venue");
  assert.equal(
    result.recommendations[0].event.registrationFormUrl,
    "https://example.invalid/register"
  );
  assert.match(sentPrompt, new RegExp(FIRST_ID));
  assert.doesNotMatch(sentPrompt, /example\.invalid\/register|private@example\.invalid/);
});

test("drops hallucinated event IDs and keeps valid recommendations", async () => {
  const result = await recommend([event(FIRST_ID)], [
    { eventId: "507f1f77bcf86cd799439099", reason: "This event has a useful topic." },
    { eventId: FIRST_ID, reason: "The real listing contains event details." },
  ]);

  assert.equal(result.source, "ai");
  assert.deepEqual(
    result.recommendations.map(({ eventId }) => eventId),
    [FIRST_ID]
  );
});

test("discards duplicate event IDs while retaining model ranking order", async () => {
  const result = await recommend([event(FIRST_ID), event(SECOND_ID)], [
    { eventId: SECOND_ID, reason: "The later listing has a detailed topic." },
    { eventId: SECOND_ID, reason: "Duplicate item must be removed." },
    { eventId: FIRST_ID, reason: "The first listing is also useful." },
  ]);

  assert.deepEqual(
    result.recommendations.map(({ eventId }) => eventId),
    [SECOND_ID, FIRST_ID]
  );
  assert.equal(
    result.recommendations[0].reason,
    "The later listing has a detailed topic."
  );
});

test("uses a clearly labeled fallback for malformed JSON", async () => {
  const result = await recommend([event()], [], {
    fetchImpl: providerFetch("{not valid JSON"),
  });

  assert.equal(result.source, "fallback");
  assert.match(result.message, /AI recommendations are unavailable/);
  assert.equal(result.recommendations[0].eventId, FIRST_ID);
});

test("does not call Gemini when no upcoming events exist", async () => {
  let called = false;
  const result = await recommendEvents(eventModel([]), {
    now: NOW,
    apiKey: "test-only-key",
    fetchImpl: async () => {
      called = true;
      throw new Error("Gemini must not be called");
    },
  });

  assert.equal(called, false);
  assert.equal(result.source, "fallback");
  assert.match(result.message, /No upcoming events/);
  assert.deepEqual(result.recommendations, []);
});

test("uses fallback when Gemini omits required response fields", async () => {
  const result = await recommend([event()], [], {
    fetchImpl: providerFetch(JSON.stringify({ recommendations: [{ reason: "Missing ID." }] })),
  });

  assert.equal(result.source, "fallback");
  assert.equal(result.recommendations[0].eventId, FIRST_ID);
});

test("rejects model-supplied event facts outside the response schema", async () => {
  const result = await recommend([event()], [], {
    fetchImpl: providerFetch(
      JSON.stringify({
        recommendations: [
          {
            eventId: FIRST_ID,
            reason: "The listing has a useful topic.",
            title: "Model-supplied title",
            venue: "Model-supplied venue",
          },
        ],
      })
    ),
  });

  assert.equal(result.source, "fallback");
  assert.notEqual(result.recommendations[0].event.title, "Model-supplied title");
  assert.notEqual(result.recommendations[0].event.venue, "Model-supplied venue");
});

test("handles absent optional event fields without inventing values", async () => {
  const sparseEvent = event(FIRST_ID, {
    category: undefined,
    clubId: undefined,
    startTime: undefined,
    endTime: undefined,
  });
  let sentPrompt;
  const result = await recommend(
    [sparseEvent],
    [{ eventId: FIRST_ID, reason: "The listing describes an upcoming activity." }],
    {
      fetchImpl: providerFetch(
        responseText([
          { eventId: FIRST_ID, reason: "The listing describes an upcoming activity." },
        ]),
        200,
        (body) => {
          sentPrompt = body.contents[0].parts[0].text;
        }
      ),
    }
  );

  assert.equal(result.source, "ai");
  assert.match(sentPrompt, /"club":""/);
  assert.match(sentPrompt, /"category":""/);
  assert.equal(result.recommendations[0].event.category, undefined);
});

test("uses a clearly labeled fallback after timeout", async () => {
  const result = await recommend([event()], [], {
    timeoutMs: 5,
    fetchImpl: (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            const error = new Error("request aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true }
        );
      }),
  });

  assert.equal(result.source, "fallback");
  assert.equal(result.recommendations[0].eventId, FIRST_ID);
});

test("uses a clearly labeled fallback on Gemini quota responses", async () => {
  const result = await recommend([event()], [], {
    fetchImpl: providerFetch("", 429),
  });

  assert.equal(result.source, "fallback");
  assert.match(result.message, /AI recommendations are unavailable/);
});

test("uses a clearly labeled fallback on other Gemini provider failures", async () => {
  const result = await recommend([event()], [], {
    fetchImpl: providerFetch("", 500),
  });

  assert.equal(result.source, "fallback");
  assert.match(result.message, /AI recommendations are unavailable/);
});

test("uses a clearly labeled fallback when Gemini cannot be reached", async () => {
  const result = await recommend([event()], [], {
    fetchImpl: async () => {
      throw new Error("provider unavailable");
    },
  });

  assert.equal(result.source, "fallback");
  assert.match(result.message, /AI recommendations are unavailable/);
});

test("uses a clearly labeled fallback without a Gemini key", async () => {
  let called = false;
  const result = await recommendEvents(eventModel([event()]), {
    now: NOW,
    apiKey: "",
    fetchImpl: async () => {
      called = true;
      throw new Error("Gemini must not be called");
    },
  });

  assert.equal(called, false);
  assert.equal(result.source, "fallback");
  assert.equal(result.recommendations[0].eventId, FIRST_ID);
});
