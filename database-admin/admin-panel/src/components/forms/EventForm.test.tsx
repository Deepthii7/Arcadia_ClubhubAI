import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventForm from "./EventForm";
import { eventsApi, type EventAdvisorResponse } from "@/lib/api";
import type { Club } from "@/types";

vi.mock("@/lib/api", () => ({
  eventsApi: {
    advise: vi.fn(),
  },
}));

const club: Club = {
  _id: "507f1f77bcf86cd799439011",
  name: "Tech Club",
  description: "A club for technology.",
  category: "Technical",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const availableResponse: EventAdvisorResponse = {
  status: "available",
  conflicts: [],
  alternatives: [],
  explanations: ["No scheduling conflicts were found."],
  error: null,
};

const conflictResponse: EventAdvisorResponse = {
  status: "conflict_found",
  conflicts: [
    {
      eventId: "507f1f77bcf86cd799439012",
      title: "Existing event",
      date: "2026-06-15",
      startTime: "10:30",
      endTime: "11:30",
      venue: "Main Hall",
      directOverlap: true,
      bufferMinutes: 15,
    },
  ],
  alternatives: [
    {
      date: "2026-06-15",
      startTime: "12:00",
      endTime: "13:00",
      durationMinutes: 60,
      timezone: "Asia/Kolkata",
    },
  ],
  explanations: ["The proposed event conflicts with Existing event."],
  error: null,
};

const noSlotResponse: EventAdvisorResponse = {
  status: "no_slot_found",
  conflicts: conflictResponse.conflicts,
  alternatives: [],
  explanations: ["No available alternative slot was found on 2026-06-15."],
  error: null,
};

const advise = vi.mocked(eventsApi.advise);

function renderForm() {
  const onSubmit = vi.fn();
  render(
    <EventForm
      clubs={[club]}
      onSubmit={onSubmit}
      onCancel={vi.fn()}
    />
  );

  fireEvent.change(screen.getByLabelText("Event date"), {
    target: { value: "2026-06-15" },
  });
  fireEvent.change(screen.getByLabelText("Start time (optional)"), {
    target: { value: "10:00" },
  });
  fireEvent.change(screen.getByLabelText("End time (optional)"), {
    target: { value: "11:00" },
  });
  fireEvent.change(screen.getByLabelText("Venue"), {
    target: { value: "Main Hall" },
  });

  return { onSubmit };
}

describe("EventForm scheduling advisor", () => {
  beforeEach(() => {
    advise.mockReset();
  });

  afterEach(() => cleanup());

  it("shows conflicts and clickable rule-based alternatives without saving", async () => {
    advise.mockResolvedValue(conflictResponse);
    const { onSubmit } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));

    expect(await screen.findByText(/10:30–11:30 at Main Hall/)).toBeTruthy();
    expect(screen.getByText("Rule-based")).toBeTruthy();
    expect(screen.getByText(/Verified against the current event schedule/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use this slot" }));

    expect(screen.getByLabelText("Start time (optional)")).toHaveProperty("value", "12:00");
    expect(screen.getByLabelText("End time (optional)")).toHaveProperty("value", "13:00");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows both the AI-verified and rule-based source labels", async () => {
    advise.mockResolvedValue({
      ...conflictResponse,
      alternatives: [
        conflictResponse.alternatives[0],
        {
          ...conflictResponse.alternatives[0],
          startTime: "13:00",
          endTime: "14:00",
          source: "ai",
          reason: "The afternoon period is clear for a focused session.",
        },
      ],
    });
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));

    expect(await screen.findByText("Rule-based")).toBeTruthy();
    expect(screen.getByText("AI-suggested · verified")).toBeTruthy();
    expect(screen.getByText("The afternoon period is clear for a focused session.")).toBeTruthy();
  });

  it("shows the no-conflict response only after a successful advisor response", async () => {
    advise.mockResolvedValue(availableResponse);
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));

    expect(await screen.findByText("No conflicts were found for this event.")).toBeTruthy();
    expect(screen.queryByText("No alternative slot available.")).toBeNull();
  });

  it("shows the no-slot state", async () => {
    advise.mockResolvedValue(noSlotResponse);
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));

    expect(await screen.findByText("No alternative slot available.")).toBeTruthy();
  });

  it("shows loading while the advisor request is pending", async () => {
    let resolveRequest: (response: EventAdvisorResponse) => void = () => {};
    advise.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        })
    );
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));

    expect(screen.getByRole("status").textContent).toContain("Loading scheduling advice");
    await act(async () => resolveRequest(availableResponse));
    await screen.findByText("No conflicts were found for this event.");
  });

  it("shows request failure as an error instead of no conflicts", async () => {
    advise.mockRejectedValue(new Error("Advisor request failed"));
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Advisor request failed");
    expect(screen.queryByText("No conflicts were found for this event.")).toBeNull();
  });

  it("retries a failed request and renders the successful response", async () => {
    advise
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValueOnce(availableResponse);
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Check availability" }));
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(advise).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("No conflicts were found for this event.")).toBeTruthy();
  });
});
