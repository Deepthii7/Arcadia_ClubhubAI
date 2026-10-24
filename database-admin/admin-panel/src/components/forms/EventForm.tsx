import { FormEvent, useState } from "react";
import axios from "axios";
import type { Club, ClubEvent, ClubEventInput, EventCategory, EventCoordinator } from "@/types";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import {
  eventsApi,
  type EventAdvisorAlternative,
  type EventAdvisorResponse,
} from "@/lib/api";
import {
  getEventCategoryLabel,
  isCanonicalEventCategory,
  shouldSubmitEventCategory,
} from "@/lib/eventCategory";

interface EventFormProps {
  initial?: ClubEvent;
  clubs: Club[];
  onSubmit: (data: ClubEventInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

// datetime-local inputs need "YYYY-MM-DDTHH:mm"
function toLocalInputValue(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function toLocalDateValue(iso?: string) {
  return toLocalInputValue(iso).split("T")[0] ?? "";
}

function toLocalTimeValue(iso?: string) {
  return toLocalInputValue(iso).split("T")[1] ?? "";
}

export default function EventForm({ initial, clubs, onSubmit, onCancel, submitting }: EventFormProps) {
  const initialClubId =
    typeof initial?.clubId === "string" ? initial.clubId : initial?.clubId?._id ?? clubs[0]?._id ?? "";

  const [form, setForm] = useState<ClubEventInput>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    date: initial?.date ?? "",
    venue: initial?.venue ?? "",
    category: isCanonicalEventCategory(initial?.category)
      ? initial.category
      : "",
    clubId: initialClubId,
    bannerUrl: initial?.bannerUrl ?? "",
    capacity: initial?.capacity ?? 0,
    registrationFormUrl: initial?.registrationFormUrl ?? "",
    startTime: initial?.startTime ?? toLocalTimeValue(initial?.date),
    endTime: initial?.endTime ?? "",
    eligibility: initial?.eligibility ?? "",
    participationType: initial?.participationType,
    teamSize: initial?.teamSize,
    prizes: initial?.prizes ?? "",
    coordinators: initial?.coordinators ?? [],
    registrationDeadline: initial?.registrationDeadline,
  });

  const [dateInput, setDateInput] = useState(toLocalDateValue(initial?.date));
  const [registrationDeadlineInput, setRegistrationDeadlineInput] = useState(
    toLocalInputValue(initial?.registrationDeadline)
  );
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [advisorState, setAdvisorState] = useState<"idle" | "loading" | "error" | "result">("idle");
  const [advisorResult, setAdvisorResult] = useState<EventAdvisorResponse | null>(null);
  const [advisorError, setAdvisorError] = useState("");

  const parsedDate = new Date(`${dateInput}T00:00:00.000Z`);
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(dateInput) &&
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === dateInput;
  const validStartTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(form.startTime ?? "");
  const validEndTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(form.endTime ?? "");
  const advisorInputIsValid =
    validDate &&
    validStartTime &&
    validEndTime &&
    Number(form.endTime?.replace(":", "")) > Number(form.startTime?.replace(":", "")) &&
    !!form.venue.trim() &&
    !!form.clubId;

  function clearAdvisorResult() {
    setAdvisorState("idle");
    setAdvisorResult(null);
    setAdvisorError("");
  }

  function updateSchedulingField(
    field: "startTime" | "endTime" | "venue" | "clubId",
    value: string
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    clearAdvisorResult();
  }

  async function requestSchedulingAdvice() {
    if (
      !advisorInputIsValid ||
      !form.startTime ||
      !form.endTime ||
      advisorState === "loading"
    ) {
      return;
    }

    setAdvisorState("loading");
    setAdvisorResult(null);
    setAdvisorError("");
    try {
      const result = await eventsApi.advise({
        date: dateInput,
        startTime: form.startTime,
        endTime: form.endTime,
        venue: form.venue.trim(),
        clubId: form.clubId,
      });
      if (result.status === "error") {
        throw new Error(result.error?.message || "Scheduling advice could not be loaded.");
      }
      setAdvisorResult(result);
      setAdvisorState("result");
    } catch (error) {
      const message = axios.isAxiosError<{ error?: { message?: string } }>(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
          ? error.message
          : "Scheduling advice could not be loaded.";
      setAdvisorError(message);
      setAdvisorState("error");
    }
  }

  function selectAlternative(slot: EventAdvisorAlternative) {
    setForm((current) => ({
      ...current,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const submission: ClubEventInput = {
      ...form,
      date: new Date(`${dateInput}T00:00:00`).toISOString(),
      registrationDeadline: registrationDeadlineInput
        ? new Date(registrationDeadlineInput).toISOString()
        : undefined,
      coordinators: form.coordinators?.filter(
        (coordinator) =>
          coordinator.name.trim() ||
          coordinator.phone.trim() ||
          coordinator.email.trim()
      ),
    };

    if (initial && !shouldSubmitEventCategory(initial.category, categoryTouched)) {
      delete submission.category;
    }

    onSubmit(submission);
  }

  function updateCoordinator(index: number, field: keyof EventCoordinator, value: string) {
    setForm((current) => ({
      ...current,
      coordinators: (current.coordinators ?? []).map((coordinator, coordinatorIndex) =>
        coordinatorIndex === index
          ? { ...coordinator, [field]: value }
          : coordinator
      ),
    }));
  }

  if (clubs.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Create a club first — events must belong to a club.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Event title"
        name="title"
        required
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
        placeholder="e.g. HackNight 2026"
      />
      <Textarea
        label="Description"
        name="description"
        required
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
      />
      <Select
        label="Event category"
        name="category"
        required={!initial || categoryTouched}
        value={form.category ?? ""}
        onChange={(e) => {
          setCategoryTouched(true);
          setForm({
            ...form,
            category: e.target.value as EventCategory,
          });
        }}
      >
        <option value="">Select a category</option>
        <option value="Technical">Technical</option>
        <option value="Non-Technical">Non-Technical</option>
      </Select>
      {initial && !isCanonicalEventCategory(initial.category) && (
        <p className="text-xs text-amber-700">
          {initial.category
            ? `Current category “${initial.category}” is classified as ${getEventCategoryLabel(initial.category)}.`
            : "This event has no category assigned and needs review."}{" "}
          Choose a category to save a canonical value, or leave it unchanged to preserve it.
        </p>
      )}
      <Select
        label="Club"
        name="clubId"
        required
        value={form.clubId}
        onChange={(e) => updateSchedulingField("clubId", e.target.value)}
      >
        {clubs.map((c) => (
          <option key={c._id} value={c._id}>
            {c.name}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Event date"
          name="date"
          type="date"
          required
          value={dateInput}
          onChange={(e) => {
            setDateInput(e.target.value);
            clearAdvisorResult();
          }}
        />
        <Input
          label="Start time (optional)"
          name="startTime"
          type="time"
          value={form.startTime ?? ""}
          onChange={(e) => updateSchedulingField("startTime", e.target.value)}
        />
        <Input
          label="End time (optional)"
          name="endTime"
          type="time"
          value={form.endTime ?? ""}
          onChange={(e) => updateSchedulingField("endTime", e.target.value)}
        />
        <Input
          label="Venue"
          name="venue"
          required
          value={form.venue}
          onChange={(e) => updateSchedulingField("venue", e.target.value)}
          placeholder="e.g. Main Auditorium"
        />
      </div>
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Scheduling advisor</h3>
            <p className="mt-1 text-xs text-slate-500">
              Check this date, time, venue, and club against the current event schedule.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={requestSchedulingAdvice}
            disabled={!advisorInputIsValid || advisorState === "loading"}
          >
            {advisorState === "loading" ? "Checking..." : "Check availability"}
          </Button>
        </div>

        {advisorState === "loading" && (
          <p className="mt-3 text-sm text-slate-600" role="status">
            Loading scheduling advice...
          </p>
        )}

        {advisorState === "error" && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3" role="alert">
            <p className="text-sm text-red-700">{advisorError}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={requestSchedulingAdvice}
              disabled={!advisorInputIsValid}
            >
              Retry
            </Button>
          </div>
        )}

        {advisorState === "result" && advisorResult?.status === "available" && (
          <p className="mt-3 text-sm text-green-700">
            No conflicts were found for this event.
          </p>
        )}

        {advisorState === "result" && advisorResult?.status === "conflict_found" && (
          <div className="mt-3 space-y-3">
            <div>
              <h4 className="text-sm font-medium text-slate-800">Conflicts</h4>
              <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-amber-800">
                {advisorResult.conflicts.map((conflict) => (
                  <li key={`${conflict.eventId}-${conflict.startTime}`}>
                    {conflict.title || "Existing event"} — {conflict.date},{" "}
                    {conflict.startTime}–{conflict.endTime} at {conflict.venue}
                  </li>
                ))}
              </ul>
            </div>
            {advisorResult.alternatives.length > 0 ? (
              <div>
                <h4 className="text-sm font-medium text-slate-800">Alternative slots</h4>
                <ul className="mt-2 space-y-2">
                  {advisorResult.alternatives.map((slot) => (
                    <li
                      key={`${slot.date}-${slot.startTime}-${slot.endTime}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {slot.date} · {slot.startTime}–{slot.endTime}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          <span className="font-medium text-slate-600">
                            {slot.source === "ai"
                              ? "AI-suggested · verified"
                              : "Rule-based"}
                          </span>
                          {" · "}Verified against the current event schedule.
                        </p>
                        {slot.reason && (
                          <p className="mt-1 text-xs text-slate-600">{slot.reason}</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => selectAlternative(slot)}
                      >
                        Use this slot
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-600">No alternative slot available.</p>
            )}
          </div>
        )}

        {advisorState === "result" && advisorResult?.status === "no_slot_found" && (
          <div className="mt-3 space-y-2">
            {advisorResult.conflicts.length > 0 && (
              <ul className="list-inside list-disc space-y-1 text-sm text-amber-800">
                {advisorResult.conflicts.map((conflict) => (
                  <li key={`${conflict.eventId}-${conflict.startTime}`}>
                    {conflict.title || "Existing event"} — {conflict.date},{" "}
                    {conflict.startTime}–{conflict.endTime} at {conflict.venue}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-slate-600">No alternative slot available.</p>
            {advisorResult.explanations.map((explanation, index) => (
              <p className="text-xs text-slate-500" key={`${index}-${explanation}`}>
                {explanation}
              </p>
            ))}
          </div>
        )}
      </section>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label="Participation type (optional)"
          name="participationType"
          value={form.participationType ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              participationType:
                (e.target.value as ClubEventInput["participationType"]) || undefined,
            })
          }
        >
          <option value="">Not specified</option>
          <option value="individual">Individual</option>
          <option value="team">Team</option>
        </Select>
        <Input
          label="Maximum participants (0 = unlimited)"
          name="capacity"
          type="number"
          min={0}
          value={form.capacity ?? 0}
          onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
        />
        {form.participationType === "team" && (
          <Input
            label="Maximum team size (optional)"
            name="teamSize"
            type="number"
            min={1}
            value={form.teamSize ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                teamSize: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        )}
        <Input
          label="Registration deadline (optional)"
          name="registrationDeadline"
          type="datetime-local"
          value={registrationDeadlineInput}
          onChange={(e) => setRegistrationDeadlineInput(e.target.value)}
        />
        <Input
          label="Banner URL (optional)"
          name="bannerUrl"
          value={form.bannerUrl}
          onChange={(e) => setForm({ ...form, bannerUrl: e.target.value })}
          placeholder="https://..."
        />
        <Input
          label="Google Forms Registration URL (optional)"
          name="registrationFormUrl"
          value={form.registrationFormUrl ?? ""}
          onChange={(e) =>
            setForm({ ...form, registrationFormUrl: e.target.value })
          }
          placeholder="https://forms.google.com/..."
        />
      </div>
      <Textarea
        label="Eligibility (optional)"
        name="eligibility"
        value={form.eligibility ?? ""}
        onChange={(e) => setForm({ ...form, eligibility: e.target.value })}
        placeholder="Departments, academic years, or other eligibility details"
      />
      <Textarea
        label="Prizes and rewards (optional)"
        name="prizes"
        value={form.prizes ?? ""}
        onChange={(e) => setForm({ ...form, prizes: e.target.value })}
      />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">
            Coordinator contacts (optional)
          </h3>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setForm({
                ...form,
                coordinators: [
                  ...(form.coordinators ?? []),
                  { name: "", phone: "", email: "" },
                ],
              })
            }
          >
            Add coordinator
          </Button>
        </div>
        {(form.coordinators ?? []).map((coordinator, index) => (
          <div
            key={index}
            className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <Input
              label="Name"
              name={`coordinator-${index}-name`}
              value={coordinator.name}
              onChange={(e) => updateCoordinator(index, "name", e.target.value)}
            />
            <Input
              label="Phone"
              name={`coordinator-${index}-phone`}
              type="tel"
              value={coordinator.phone}
              onChange={(e) => updateCoordinator(index, "phone", e.target.value)}
            />
            <Input
              label="Email"
              name={`coordinator-${index}-email`}
              type="email"
              value={coordinator.email}
              onChange={(e) => updateCoordinator(index, "email", e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setForm({
                  ...form,
                  coordinators: (form.coordinators ?? []).filter(
                    (_, coordinatorIndex) => coordinatorIndex !== index
                  ),
                })
              }
            >
              Remove
            </Button>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : initial ? "Save changes" : "Create event"}
        </Button>
      </div>
    </form>
  );
}
