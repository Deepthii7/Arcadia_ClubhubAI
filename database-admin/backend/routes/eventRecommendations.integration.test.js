const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const express = require("express");
const Event = require("../models/Event");
const eventRoutes = require("./eventRoutes");

const originalFind = Event.find;
const originalFetch = globalThis.fetch;
const originalGeminiApiKey = process.env.GEMINI_API_KEY;
let server;
let baseUrl;

before(async () => {
  process.env.GEMINI_API_KEY = "test-only-key";
  Event.find = () => {
    const query = {
      select() {
        return query;
      },
      sort() {
        return query;
      },
      limit() {
        return query;
      },
      populate() {
        return query;
      },
      async lean() {
        return [
          {
            _id: "507f1f77bcf86cd799439011",
            title: "Real upcoming workshop",
            description: "A workshop from the mocked event database.",
            date: new Date("2099-06-15T00:00:00.000Z"),
            venue: "Main Hall",
            clubId: { _id: "507f1f77bcf86cd799439012", name: "Example Club" },
          },
        ];
      },
    };
    return query;
  };
  globalThis.fetch = async (url, request) => {
    if (String(url).startsWith("https://generativelanguage.googleapis.com/")) {
      assert.equal(request.headers["x-goog-api-key"], "test-only-key");
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        recommendations: [
                          {
                            eventId: "507f1f77bcf86cd799439011",
                            reason: "The database listing describes a workshop.",
                          },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          };
        },
      };
    }
    return originalFetch(url, request);
  };

  const app = express();
  app.use(express.json());
  app.use("/api/admin/events", eventRoutes);
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  Event.find = originalFind;
  globalThis.fetch = originalFetch;
  if (originalGeminiApiKey === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = originalGeminiApiKey;
  }
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test("serves real event data and the AI reason from the recommendations route", async () => {
  const response = await originalFetch(
    `${baseUrl}/api/admin/events/recommendations`
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.source, "ai");
  assert.equal(body.recommendations[0].eventId, "507f1f77bcf86cd799439011");
  assert.equal(body.recommendations[0].event.title, "Real upcoming workshop");
  assert.equal(
    body.recommendations[0].reason,
    "The database listing describes a workshop."
  );
});

test("accepts valid student preferences and returns real fallback event data", async () => {
  const response = await originalFetch(
    `${baseUrl}/api/admin/events/recommendations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: "Technology",
        goal: "Learn New Skills",
        experience: "Beginner",
        eventType: "Workshops",
        availability: "Weekdays",
      }),
    }
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.source, "fallback");
  assert.equal(body.reasonSource, "rules");
  assert.equal(body.recommendations.length, 1);
  assert.equal(
    body.recommendations[0].event.title,
    "Real upcoming workshop"
  );
});

test("rejects invalid or extra student preference fields", async () => {
  const response = await originalFetch(
    `${baseUrl}/api/admin/events/recommendations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: "Technology",
        goal: "Learn New Skills",
        experience: "Beginner",
        eventType: "Workshops",
        availability: "Weekdays",
        email: "student@example.invalid",
      }),
    }
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.code, "INVALID_PREFERENCES");
});

test("returns a safe error when upcoming events cannot be loaded", async () => {
  const originalEventFind = Event.find;
  Event.find = () => {
    throw new Error("sensitive database details");
  };

  try {
    const response = await originalFetch(
      `${baseUrl}/api/admin/events/recommendations`
    );
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.status, "error");
    assert.equal(body.code, "EVENT_LOOKUP_FAILED");
    assert.doesNotMatch(JSON.stringify(body), /sensitive database details/);
  } finally {
    Event.find = originalEventFind;
  }
});
