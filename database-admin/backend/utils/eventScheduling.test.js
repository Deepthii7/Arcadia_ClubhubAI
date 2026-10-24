const assert = require("node:assert/strict");
const test = require("node:test");
const {
  detectConflicts,
  explainAlternativeSlots,
  explainConflicts,
  findAlternativeSlots,
} = require("./eventScheduling");

function event(overrides = {}) {
  return {
    title: "Proposed event",
    date: "2026-06-15",
    startTime: "10:00",
    endTime: "11:00",
    venue: "Main Hall",
    clubId: "club-1",
    ...overrides,
  };
}

test("detects a direct time overlap for the same venue and club", () => {
  const conflicts = detectConflicts(event(), [
    event({ title: "Existing", startTime: "10:30", endTime: "11:30" }),
  ]);

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].directOverlap, true);
});

test("strict overlap boundaries do not treat adjacent events as overlapping", () => {
  const conflicts = detectConflicts(
    event(),
    [event({ startTime: "11:00", endTime: "12:00" })],
    { bufferMinutes: 0 }
  );

  assert.equal(conflicts.length, 0);
});

test("does not conflict across a different venue or club", () => {
  const conflicts = detectConflicts(event(), [
    event({ venue: "Other Hall" }),
    event({ clubId: "club-2" }),
  ]);

  assert.equal(conflicts.length, 0);
});

test("rejects missing or invalid event dates and missing start times", () => {
  assert.throws(() => detectConflicts(event({ date: "" }), []), /date is required/i);
  assert.throws(
    () => detectConflicts(event({ date: "not-a-date" }), []),
    /valid date/i
  );
  assert.throws(
    () => detectConflicts(event({ date: "2026-06-15T10:00:00" }), []),
    /ISO datetime with a timezone/i
  );
  assert.throws(
    () => detectConflicts(event({ date: "2026-02-30T10:00:00Z" }), []),
    /valid date/i
  );
  assert.throws(
    () => detectConflicts(event({ startTime: "" }), []),
    /startTime is required/i
  );
});

test("uses explicit end time duration or the approved 60-minute default", () => {
  const alternatives = findAlternativeSlots(
    event({ startTime: "10:00", endTime: "" }),
    []
  );
  assert.equal(alternatives.durationMinutes, 60);
  assert.equal(alternatives.slots[0].startTime, "08:00");
  assert.equal(alternatives.slots[0].endTime, "09:00");

  const longEvent = findAlternativeSlots(
    event({ startTime: "10:00", endTime: "12:30" }),
    []
  );
  assert.equal(longEvent.durationMinutes, 150);
  assert.equal(longEvent.slots[0].endTime, "10:30");
});

test("blocks every status except explicit draft and cancelled values", async (t) => {
  const cases = [
    ["draft", false],
    ["cancelled", false],
    ["canceled", false],
    ["scheduled", true],
    ["confirmed", true],
    ["published", true],
    ["unknown", true],
    [undefined, true],
  ];

  for (const [status, blocks] of cases) {
    await t.test(String(status ?? "missing status"), () => {
      const conflicts = detectConflicts(event(), [
        event({
          startTime: "10:30",
          endTime: "11:30",
          ...(status === undefined ? {} : { status }),
        }),
      ]);
      assert.equal(conflicts.length > 0, blocks);
    });
  }
});

test("returns an explicit no-slot result when the whole operating day is blocked", () => {
  const result = findAlternativeSlots(
    event({ startTime: "10:00", endTime: "" }),
    [event({ title: "All-day reservation", startTime: "08:00", endTime: "22:00" })]
  );

  assert.equal(result.status, "no_slot_found");
  assert.deepEqual(result.slots, []);
  assert.match(explainAlternativeSlots(result), /No available alternative slot/);
});

test("uses the configured timezone to resolve local date and time", () => {
  const conflicts = detectConflicts(
    event({ date: "2026-06-15", startTime: "09:00", endTime: "10:00" }),
    [
      event({
        date: "2026-06-14T18:30:00.000Z",
        startTime: "09:30",
        endTime: "10:30",
      }),
    ],
    { bufferMinutes: 0 }
  );

  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].date, "2026-06-15");
});

test("applies a buffer when checking alternatives", () => {
  const result = findAlternativeSlots(
    event({ startTime: "12:00", endTime: "" }),
    [event({ title: "Earlier event", startTime: "08:30", endTime: "09:30" })]
  );

  assert.equal(result.slots[0].startTime, "10:00");
  assert.equal(result.slots.some((slot) => slot.startTime === "09:00"), false);
});

test("explains conflicts deterministically from computed data", () => {
  const conflicts = detectConflicts(event(), [
    event({ title: "Nearby event", startTime: "11:05", endTime: "12:00" }),
  ]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].directOverlap, false);
  assert.deepEqual(
    explainConflicts(conflicts),
    [
      '"Nearby event" at Main Hall on 2026-06-15 from 11:05 to 12:00 is within the required buffer of the proposed event.',
    ]
  );
  assert.deepEqual(explainConflicts([]), ["No scheduling conflicts were found."]);
});
