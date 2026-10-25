#Module 2 
Frontend - Events & Announcements 

## Student event recommendations

The Events Directory posts five selected preferences to
`POST /api/admin/events/recommendations` on the database-admin backend.
Preferences are held in page state only and are not saved to a user profile:
this app has no student login/profile or preference store.

The backend ranks real upcoming events with weighted keyword matches against
category, title, and description, experience-level wording, and event-date
availability. If fewer than three events match, it returns the soonest
upcoming events as a fallback. Gemini is optional and only writes reasons for
up to three top-ranked matches; it receives the five answers and event IDs,
titles, descriptions, categories, and dates. Ranking remains rule-based,
and only grounded reasons for known event IDs are accepted. `GEMINI_API_KEY`
must remain server-side; never add it or Gemini requests to frontend code.

Each recommendation identifies its reason source as `ai` or `rules`; only
Gemini-written reasons are labeled AI-assisted. Missing keys, timeouts, quota
errors, or invalid output use template reasons. Gemini free-tier quota and rate
limits apply and vary; see Google's
[pricing](https://ai.google.dev/gemini-api/docs/pricing) and
[rate-limit documentation](https://ai.google.dev/gemini-api/docs/rate-limits).
