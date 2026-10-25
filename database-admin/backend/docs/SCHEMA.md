# ClubHub — Database Schema (Module 4)

Database: **MongoDB** (Atlas), accessed via **Mongoose**.

## ER overview

```
 Club (1) ──────< (many) Event ──────< (many) Registration
   │
   └────< (many) Announcement
```

- A **Club** has many **Events** and many **Announcements**.
- An **Event** belongs to one **Club** and has many **Registrations**.
- A **Registration** belongs to one **Event**.
- An **Announcement** optionally belongs to one **Club** (allows platform-wide announcements with no `clubId`).

---

## `clubs`

| Field         | Type     | Required | Notes                                                        |
|---------------|----------|----------|---------------------------------------------------------------|
| `_id`         | ObjectId | auto     | Primary key                                                   |
| `name`        | String   | ✅        | Club display name                                              |
| `description` | String   | ✅        | Shown on club directory / detail page                         |
| `category`    | String   | ✅        | New values: `Technical` or `Non-Technical`. Legacy values are normalized by consumers; unknown or ambiguous values require admin review. |
| `logoUrl`     | String   | –        | Club logo image URL                                            |
| `contactEmail`| String   | –        | Club contact email                                              |
| `isActive`    | Boolean  | –        | Soft-disable a club without deleting it (default `true`)       |
| `createdAt`   | Date     | auto     | Timestamp                                                       |
| `updatedAt`   | Date     | auto     | Timestamp                                                       |

## `events`

| Field         | Type     | Required | Notes                                              |
|---------------|----------|----------|------------------------------------------------------|
| `_id`         | ObjectId | auto     | Primary key                                          |
| `title`       | String   | ✅        | Event name                                            |
| `description` | String   | ✅        | Event details                                          |
| `date`        | Date     | ✅        | Event date/time. Indexed for upcoming-event queries   |
| `venue`       | String   | ✅        | Location                                              |
| `category`    | String   | –        | `Technical` or `Non-Technical`; legacy or missing values remain readable and require review when unclassified |
| `clubId`      | ObjectId | ✅        | References `clubs._id`                                |
| `bannerUrl`   | String   | –        | Event banner image URL                                |
| `capacity`    | Number   | –        | Max registrations, `0` = unlimited (default `0`)      |
| `registrationFormUrl` | String | – | External registration form URL, such as Google Forms |
| `startTime`   | String   | –        | Local start time in `HH:mm` format                    |
| `endTime`     | String   | –        | Local end time in `HH:mm` format                      |
| `eligibility` | String   | –        | Departments, academic years, or other eligibility     |
| `participationType` | String | – | `individual` or `team`                                |
| `teamSize`    | Number   | –        | Maximum members per team                              |
| `prizes`      | String   | –        | Prize and reward details                              |
| `coordinators`| Array    | –        | Coordinator objects with optional `name`, `phone`, and `email` |
| `registrationDeadline` | Date | – | Registration deadline                                 |
| `createdAt`   | Date     | auto     | Timestamp                                              |
| `updatedAt`   | Date     | auto     | Timestamp                                              |

## `registrations`

| Field       | Type     | Required | Notes                                                          |
|-------------|----------|----------|-------------------------------------------------------------------|
| `_id`       | ObjectId | auto     | Primary key                                                       |
| `eventId`   | ObjectId | ✅        | References `events._id`                                           |
| `name`      | String   | ✅        | Registrant name                                                    |
| `email`     | String   | ✅        | Registrant email                                                    |
| `phone`     | String   | –        | Registrant phone                                                    |
| `rollNo`    | String   | –        | Student roll number                                                  |
| `createdAt` | Date     | auto     | Timestamp                                                             |
| `updatedAt` | Date     | auto     | Timestamp                                                             |

Compound unique index on `(eventId, email)` — stops the same person
registering twice for the same event.

## `announcements`

| Field       | Type     | Required | Notes                                              |
|-------------|----------|----------|--------------------------------------------------------|
| `_id`       | ObjectId | auto     | Primary key                                              |
| `title`     | String   | ✅        | Announcement headline                                     |
| `content`   | String   | ✅        | Body text                                                  |
| `clubId`    | ObjectId | –        | References `clubs._id`. Omit for platform-wide posts       |
| `pinned`    | Boolean  | –        | Pins to top of the Announcement Board (default `false`)    |
| `createdAt` | Date     | auto     | Timestamp                                                    |
| `updatedAt` | Date     | auto     | Timestamp                                                    |

---

## Admin API (this module)

Base URL: `http://localhost:5050/api/admin`

| Method | Endpoint                          | Description                          |
|--------|-------------------------------------|-----------------------------------------|
| GET    | `/clubs`                            | List all clubs                          |
| GET    | `/clubs/:id`                        | Get one club                            |
| POST   | `/clubs`                            | Create a club                           |
| PUT    | `/clubs/:id`                        | Update a club                           |
| DELETE | `/clubs/:id`                        | Delete a club                           |
| GET    | `/events`                           | List all events (club populated)        |
| GET    | `/events/advisor`                   | Read-only scheduling advice for an event |
| GET    | `/events/recommendations`            | AI-ranked upcoming events                |
| POST   | `/events/recommendations`            | Preference-ranked student events         |
| GET    | `/events/:id`                        | Get one event                           |
| POST   | `/events`                           | Create an event                         |
| PUT    | `/events/:id`                       | Update an event                         |
| DELETE | `/events/:id`                       | Delete an event                         |
| GET    | `/events/:eventId/registrations`    | Registrations for one event             |
| GET    | `/announcements`                    | List all announcements (club populated) |
| POST   | `/announcements`                    | Create an announcement                  |
| PUT    | `/announcements/:id`                | Update an announcement                  |
| DELETE | `/announcements/:id`                | Delete an announcement                  |
| GET    | `/registrations`                    | List all registrations, every event     |
| DELETE | `/registrations/:id`                | Remove a registration                   |
| GET    | `/dashboard`                        | Counts + upcoming events + recent regs  |

### Event recommendations

`GET /events/recommendations` returns up to five AI-ranked upcoming events
without personalization.

`POST /events/recommendations` accepts exactly five string fields: `domain`
(`Technology`, `Arts & Culture`, or `Sports & Social Activities`), `goal`
(`Learn New Skills`, `Win Competitions`, or `Network & Have Fun`),
`experience` (`Beginner`, `Intermediate`, or `Advanced`), `eventType`
(`Workshops`, `Competitions & Hackathons`, or `Cultural & Club Events`), and
`availability` (`Weekdays`, `Weekends`, or `Both`). It validates these choices
and rejects missing or additional fields. Preferences are not persisted:
there is no student login/profile or preference store in this app.

Upcoming events are ranked using weighted keyword matches against their
category, title, and description, experience-level wording, and the weekday or
weekend of their date. If fewer than three events match, the endpoint returns
soonest upcoming events as a labeled fallback. Gemini does not determine rank.
When available, Gemini receives only the five answers and the top three ranked
events' IDs, titles, descriptions, categories, and dates to suggest reasons.
Only known event IDs and short reasons grounded in provided words are accepted;
otherwise template reasons are used. The top-level `reasonSource` is `ai` if at
least one Gemini reason is accepted, otherwise `rules`; each item also carries
its own exact reason source.

For the existing `GET` endpoint, Gemini receives only event IDs and selected
event information (title,
description, date/time, venue, club, category, eligibility, and registration
deadline). The response joins accepted IDs to event records from MongoDB, so
event details and links are never taken from model output. Unknown and duplicate
IDs are discarded.

The response `source` is `ai` when valid Gemini recommendations are returned,
or `fallback` when the soonest upcoming events are shown instead. Empty event
lists skip Gemini and return a clear empty state. Missing keys, timeouts,
provider errors including quota limits, or invalid output use the labeled
fallback. This GET endpoint has no login identity or user preference data, so
its recommendations are based only on event information.

### Scheduling advisor

`GET /events/advisor` requires `date` (`YYYY-MM-DD`), `startTime` (`HH:mm`),
`venue`, and `clubId` (a 24-character ObjectId). Supply `endTime` (`HH:mm`)
or `durationMinutes`; duration defaults to 60 minutes, and when both are
provided they must agree. The proposed event must fit within 08:00–22:00
Asia/Kolkata time.

The response contains `status`, `conflicts`, `alternatives`, `explanations`,
and `error`. `status` is `available`, `conflict_found`, `no_slot_found`, or
`error`. Alternatives are same-day 30-minute-start-grid slots, with a
15-minute buffer, for conflicts sharing both the venue and club. Each slot
includes `source` (`ai` or `rules`) and a short `reason`. Events block unless
their status is explicitly `draft`, `cancelled`, or `canceled` (the schema
does not currently define event status).

When `GEMINI_API_KEY` is configured, the server may send Gemini the proposed
event's date/time/duration, venue and scope, plus same-day events reduced to
date, start/end, status, venue and scope. Event names, descriptions, IDs,
contacts, and secrets are excluded. Every AI slot is checked against the
deterministic scheduler before it is returned. Missing keys, provider errors,
timeouts, invalid output, and unverified suggestions use deterministic
alternatives instead. The server never requires paid billing; free-tier quota
and eligibility are controlled by Google and may change.

To obtain a key, use [Google AI Studio API keys](https://aistudio.google.com/apikey)
and configure `GEMINI_API_KEY` in the backend environment (never the frontend).
Review Google's current [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
and free-tier terms; do not enable paid billing for this integration.

### Advisor rules, AI, and limitations

The approved defaults are 60 minutes when no end time is supplied, same-day
alternatives in `Asia/Kolkata`, operating hours 08:00–22:00, a 15-minute
buffer, and 30-minute alternative start intervals. Conflicts are scoped to
events at the same venue and belonging to the same club. Only `draft`,
`cancelled`, and `canceled` are non-blocking; other, missing, or unknown
statuses block. The event schema does not define a status field, so existing
events without one block by default.

The optional server-side provider is Gemini 2.5 Flash. When configured with
`GEMINI_API_KEY`, the advisor sends the proposed date, times, duration, venue
and scope, plus same-day matching events reduced to date, start/end, status,
venue and scope. It does not send event names or descriptions, IDs, contact
details, or credentials. AI suggestions are returned only when they exactly
match a free candidate verified by the deterministic scheduler. Missing keys,
invalid output, timeouts, and provider errors use rule-based alternatives
instead; if none are available, the advisor reports no slot found. With no key,
the deterministic advisor continues to work.

Google's [free-tier documentation](https://ai.google.dev/gemini-api/docs/pricing)
describes limited model access and free input/output for eligible models;
free-tier content may be used to improve Google's products. Rate limits vary
by model and project/account, are not guaranteed, and must be checked in
[Google AI Studio](https://aistudio.google.com/rate-limit). Eligibility,
quotas, model availability, and terms can change. This integration does not
enable or enforce billing settings: keep paid billing disabled if using only
the free tier.

Advice is not a reservation: the schedule can change after it is fetched, so
verify availability again before relying on a suggested slot. The advisor only
checks the approved same-date, same-venue, same-club scope and does not model
other operational constraints.
