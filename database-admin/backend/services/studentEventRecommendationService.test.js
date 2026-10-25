const assert = require("node:assert/strict");
const { test } = require("node:test");
const {
  PreferenceInputError,
  recommendStudentEvents,
  scoreEvent,
} = require("./studentEventRecommendationService");

const NOW = new Date("2026-01-01T00:00:00.000Z");
const PREFERENCES = {
  domain: "Technology",
  goal: "Learn New Skills",
  experience: "Beginner",
  eventType: "Workshops",
  availability: "Weekdays",
};

function event(id, date, overrides = {}) {
  return {
    _id: id,
    title: "Technology workshop for beginners",
    description: "Learn practical coding skills in this introductory workshop.",
    category: "Technical",
    date: new Date(date),
    venue: "Main Hall",
    clubId: { _id: "club-id", name: "Tech Club" },
    ...overrides,
  };
}

function eventModel(events) {
  return {
    find(filter) {
      assert.ok(filter.date.$gte instanceof Date);
      const query = {
        select(fields) {
          assert.match(fields, /title description date/);
          assert.match(fields, /category/);
          return query;
        },
        sort(value) {
          assert.deepEqual(value, { date: 1 });
          return query;
        },
        limit(value) {
          assert.equal(value, 100);
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

function aiFetch(reasons, inspectRequest) {
  return async (_url, request) => {
    assert.equal(request.headers["x-goog-api-key"], "test-only-key");
    const body = JSON.parse(request.body);
    inspectRequest?.(body);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify({ reasons }) }],
              },
            },
          ],
        };
      },
    };
  };
}

test("weights matching domain, goal, event type, experience, and weekday", () => {
  const weekdayMatch = scoreEvent(
    event("1", "2026-06-15T12:00:00.000Z"),
    PREFERENCES
  );
  const weekendMatch = scoreEvent(
    event("2", "2026-06-20T12:00:00.000Z"),
    PREFERENCES
  );
  const localWeekendMatch = scoreEvent(
    event("3", "2026-06-19T20:00:00.000Z"),
    PREFERENCES
  );

  assert.equal(weekdayMatch.score, 15);
  assert.equal(weekdayMatch.matched.availability, true);
  assert.equal(weekendMatch.score, 13);
  assert.equal(weekendMatch.matched.availability, false);
  assert.equal(localWeekendMatch.matched.availability, false);
  assert.equal(
    scoreEvent(
      event("4", "2026-06-19T20:00:00.000Z"),
      { ...PREFERENCES, availability: "Weekends" }
    ).matched.availability,
    true
  );
  assert.equal(
    scoreEvent(event("both", "2026-06-20T12:00:00.000Z"), {
      ...PREFERENCES,
      availability: "Both",
    }).matched.availability,
    true
  );
});

test("scores events with missing or invalid optional fields safely", () => {
  const result = scoreEvent(
    {
      _id: "missing-fields",
      title: undefined,
      description: null,
      category: 42,
      date: "not-a-date",
    },
    PREFERENCES
  );

  assert.equal(result.score, 0);
  assert.equal(result.matched.availability, false);
});

test("rejects missing, invalid, and extra preference fields", async () => {
  for (const preferences of [
    { ...PREFERENCES, goal: undefined },
    { ...PREFERENCES, domain: "Other" },
    { ...PREFERENCES, extra: "not allowed" },
  ]) {
    await assert.rejects(
      recommendStudentEvents(eventModel([]), preferences, { now: NOW }),
      PreferenceInputError
    );
  }
});

test("ranks preference matches by score and returns template reasons without Gemini", async () => {
  let providerCalled = false;
  const result = await recommendStudentEvents(
    eventModel([
      event("first", "2026-06-15T12:00:00.000Z", {
        title: "Technology workshop for beginners",
      }),
      event("second", "2026-06-20T12:00:00.000Z", {
        title: "Technology workshop for beginners",
      }),
      event("third", "2026-06-16T12:00:00.000Z", {
        title: "Technology workshop for beginners",
      }),
      event("lower-score", "2026-06-17T12:00:00.000Z", {
        title: "Technology beginner meetup",
        description: "Meet and learn basic coding.",
      }),
    ]),
    PREFERENCES,
    {
      now: NOW,
      apiKey: "",
      fetchImpl: async () => {
        providerCalled = true;
        throw new Error("Gemini must not be called without a key");
      },
    }
  );

  assert.equal(providerCalled, false);
  assert.equal(result.source, "matched");
  assert.equal(result.reasonSource, "rules");
  assert.deepEqual(
    result.recommendations.slice(0, 3).map(({ eventId }) => eventId),
    ["first", "third", "second"]
  );
  assert.match(result.recommendations[0].reason, /Recommended because/);
  assert.equal(result.recommendations[0].event.title, "Technology workshop for beginners");
});

test("falls back to upcoming events when fewer than three score well", async () => {
  let providerCalled = false;
  const result = await recommendStudentEvents(
    eventModel([
      event("soonest", "2026-06-15T12:00:00.000Z", {
        title: "Open gathering",
        description: "A general club gathering.",
        category: "Non-Technical",
      }),
      event("later", "2026-06-16T12:00:00.000Z", {
        title: "Open gathering",
        description: "A general club gathering.",
        category: "Non-Technical",
      }),
      event("latest", "2026-06-17T12:00:00.000Z", {
        title: "Open gathering",
        description: "A general club gathering.",
        category: "Non-Technical",
      }),
    ]),
    PREFERENCES,
    {
      now: NOW,
      fetchImpl: async () => {
        providerCalled = true;
        throw new Error("Fallback does not call Gemini");
      },
    }
  );

  assert.equal(providerCalled, false);
  assert.equal(result.source, "fallback");
  assert.equal(result.reasonSource, "rules");
  assert.match(result.message, /showing upcoming events/i);
  assert.deepEqual(
    result.recommendations.map(({ eventId }) => eventId),
    ["soonest", "later", "latest"]
  );
  assert.match(result.recommendations[0].reason, /Recommended because/);
});

test("returns an empty state without calling Gemini when there are no events", async () => {
  let providerCalled = false;
  const result = await recommendStudentEvents(
    eventModel([]),
    PREFERENCES,
    {
      now: NOW,
      apiKey: "test-only-key",
      fetchImpl: async () => {
        providerCalled = true;
        throw new Error("Gemini must not be called for an empty event list");
      },
    }
  );

  assert.equal(providerCalled, false);
  assert.equal(result.source, "fallback");
  assert.equal(result.message, "No upcoming events are currently available.");
  assert.deepEqual(result.recommendations, []);
});

test("uses grounded Gemini reasons for known recommendation IDs only", async () => {
  const events = [
    event("one", "2026-06-15T12:00:00.000Z"),
    event("two", "2026-06-16T12:00:00.000Z"),
    event("three", "2026-06-17T12:00:00.000Z"),
  ];
  let prompt;
  const result = await recommendStudentEvents(
    eventModel(events),
    PREFERENCES,
    {
      now: NOW,
      apiKey: "test-only-key",
      fetchImpl: aiFetch(
        [
          {
            eventId: "one",
            reason:
              "Recommended because this beginner workshop matches your Technology preference.",
          },
          {
            eventId: "unknown",
            reason:
              "Recommended because this beginner workshop matches your Technology preference.",
          },
          {
            eventId: "two",
            reason:
              "This Technology workshop matches Beginner preferences. It is an event.",
          },
        ],
        (body) => {
          prompt = body.contents[0].parts[0].text;
        }
      ),
    }
  );

  assert.equal(result.source, "matched");
  assert.equal(result.reasonSource, "ai");
  assert.equal(result.recommendations[0].reasonSource, "ai");
  assert.equal(result.recommendations[0].reason, "Recommended because this beginner workshop matches your Technology preference.");
  assert.equal(result.recommendations[1].reasonSource, "rules");
  assert.match(prompt, /"experience":"Beginner"/);
  assert.match(prompt, /"eventId":"one"/);
  assert.doesNotMatch(prompt, /Main Hall|registrationFormUrl|coordinators/);
});

test("uses rule-based reasons when Gemini times out or returns quota errors", async () => {
  const events = [
    event("one", "2026-06-15T12:00:00.000Z"),
    event("two", "2026-06-16T12:00:00.000Z"),
    event("three", "2026-06-17T12:00:00.000Z"),
  ];
  const timeoutResult = await recommendStudentEvents(
    eventModel(events),
    PREFERENCES,
    {
      now: NOW,
      apiKey: "test-only-key",
      timeoutMs: 5,
      fetchImpl: (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new Error("request aborted")),
            { once: true }
          );
        }),
    }
  );
  const quotaResult = await recommendStudentEvents(
    eventModel(events),
    PREFERENCES,
    {
      now: NOW,
      apiKey: "test-only-key",
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        json: async () => ({}),
      }),
    }
  );
  const malformedResult = await recommendStudentEvents(
    eventModel(events),
    PREFERENCES,
    {
      now: NOW,
      apiKey: "test-only-key",
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "{not JSON" }] } }],
        }),
      }),
    }
  );

  assert.equal(timeoutResult.reasonSource, "rules");
  assert.ok(timeoutResult.recommendations.every(({ reasonSource }) => reasonSource === "rules"));
  assert.equal(quotaResult.reasonSource, "rules");
  assert.equal(malformedResult.reasonSource, "rules");
});
