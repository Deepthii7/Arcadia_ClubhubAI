const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const express = require("express");
const Event = require("../models/Event");
const eventRoutes = require("./eventRoutes");

const CLUB_ID = "507f1f77bcf86cd799439011";
const originalFind = Event.find;
let server;
let baseUrl;

function validQuery(overrides = {}) {
  return {
    date: "2026-06-15",
    startTime: "10:00",
    endTime: "11:00",
    venue: "Main Hall",
    clubId: CLUB_ID,
    ...overrides,
  };
}

function event(overrides = {}) {
  return {
    _id: "507f1f77bcf86cd799439012",
    title: "Existing event",
    date: new Date("2026-06-15T04:00:00.000Z"),
    startTime: "10:30",
    endTime: "11:30",
    venue: "Main Hall",
    clubId: CLUB_ID,
    ...overrides,
  };
}

function advisorUrl(query = validQuery()) {
  const url = new URL("/api/admin/events/advisor", baseUrl);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return url;
}

before(async () => {
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
  if (server) {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
});

test("preserves public event-route access for unauthenticated advisor requests", async () => {
  Event.find = () => ({ lean: async () => [] });

  const response = await fetch(advisorUrl());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "available");
  assert.deepEqual(body.conflicts, []);
});

test("returns a stable validation error for invalid date, time, duration, or id", async (t) => {
  const invalidCases = [
    ["date", { date: "2026-02-30" }, /date/i],
    ["startTime", { startTime: "25:00" }, /startTime/i],
    ["duration", { durationMinutes: "0" }, /durationMinutes/i],
    ["clubId", { clubId: "not-an-object-id" }, /clubId/i],
  ];

  for (const [name, overrides, message] of invalidCases) {
    await t.test(name, async () => {
      const response = await fetch(advisorUrl(validQuery(overrides)));
      const body = await response.json();

      assert.equal(response.status, 400);
      assert.equal(body.status, "error");
      assert.equal(body.error.code, "INVALID_INPUT");
      assert.match(body.error.message, message);
      assert.deepEqual(body.conflicts, []);
      assert.deepEqual(body.alternatives, []);
    });
  }
});

test("reports a conflict and matching alternative slots", async () => {
  Event.find = () => ({ lean: async () => [event()] });

  const response = await fetch(advisorUrl());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "conflict_found");
  assert.equal(body.conflicts.length, 1);
  assert.equal(body.conflicts[0].eventId, "507f1f77bcf86cd799439012");
  assert.ok(body.alternatives.length > 0);
  assert.ok(body.explanations.length > 0);
  assert.equal(body.error, null);
});

test("reports no conflict without proposing unnecessary alternatives", async () => {
  Event.find = () => ({ lean: async () => [] });

  const response = await fetch(advisorUrl());
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "available");
  assert.deepEqual(body.conflicts, []);
  assert.deepEqual(body.alternatives, []);
  assert.match(body.explanations[0], /No scheduling conflicts/);
});

test("reports no_slot_found when all same-day operating hours are occupied", async () => {
  Event.find = () => ({
    lean: async () => [
      event({ startTime: "08:00", endTime: "22:00", title: "All-day event" }),
    ],
  });

  const response = await fetch(
    advisorUrl(validQuery({ startTime: "08:00", endTime: "22:00", durationMinutes: "840" }))
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "no_slot_found");
  assert.deepEqual(body.alternatives, []);
  assert.match(body.explanations[1], /No available alternative slot/);
});

test("returns a visible stable error when event lookup fails", async () => {
  Event.find = () => ({
    lean: async () => {
      throw new Error("simulated data-layer failure");
    },
  });
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const response = await fetch(advisorUrl());
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(body.status, "error");
    assert.equal(body.error.code, "DATA_ACCESS_FAILED");
    assert.match(body.error.message, /Unable to retrieve existing events/);
    assert.deepEqual(body.conflicts, []);
    assert.deepEqual(body.alternatives, []);
    assert.deepEqual(body.explanations, []);
  } finally {
    console.error = originalConsoleError;
  }
});
