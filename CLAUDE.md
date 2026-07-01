# CLAUDE.md

# ContextGrade Browser Extension

## Mission

The browser extension is the primary **human-facing** capture mechanism for ContextGrade, a Decision
Intelligence Platform. The backend (`contextgrade` API, prefixed `/api/v1`) and staff dashboard are
separate repos with their own CLAUDE.md files — this doc only covers the extension. The backend is the
source of truth for all business logic; the extension is a thin, opinionated capture surface over it.

It lives where work happens. Most modern work occurs inside browser-based software:

* Jira
* Figma
* HubSpot
* Salesforce
* Zendesk
* Linear
* GitHub

The extension captures decision context at the moment decisions happen.

There are two capture surfaces into ContextGrade: this extension, and a REST API for direct B2B
integrations (webhooks, CRM sync). This repo only implements the first.

---

# Product Goal

Capture the "why" behind important actions.

Not every click matters. Not every page view matters. Only meaningful decisions matter.

Good signals:

* Ticket closed / escalated
* Discount changed
* Deal approved (stage → closed-won/closed-lost/contract sent)
* Comment resolved
* Design published
* Incident acknowledged
* Pull request approved

Bad signals:

* Mouse movement
* Navigation
* Scrolling
* Typing
* Random clicks

We are not analytics software. We are not surveillance software.

This isn't just a principle — it's enforced in code. Detectors only fire on an explicit allowlist of
state transitions (`MEANINGFUL_JIRA_STATUSES`, `MEANINGFUL_HUBSPOT_STAGES` in
[src/lib/constants.ts](src/lib/constants.ts)). When adding a new detector, extend an allowlist;
don't make a detector fire on every DOM mutation it happens to see.

---

# Extension Responsibilities

The extension should:

1. Observe meaningful events (via narrow, allowlisted DOM signals)
2. Ask whether context should be saved (non-blocking prompt, auto-dismisses if ignored)
3. Collect rationale (the "why" — required on every decision)
4. Send trace data to the backend
5. Remain lightweight and degrade gracefully offline

The extension should NOT:

1. Make decisions
2. Score employees
3. Monitor productivity
4. Record unnecessary activity
5. Register or create tracked sites/subject companies — that's admin-only, done on the dashboard

---

# Tech Stack & Project Layout

Built with [Plasmo](https://docs.plasmo.com/) (MV3), React 18, TypeScript, Tailwind. No test runner or
linter is currently wired up — `pnpm dev` / `pnpm build` are the only scripts ([package.json](package.json)).

```
src/
  contents/            Plasmo-registered content scripts — each file's `config.matches`
                        controls which domains it injects into. This is the ONLY directory
                        Plasmo auto-discovers; don't confuse with src/content/ below.
    jira.tsx              *.atlassian.net, *.jira.com — detector + FloatingIcon + FloatingPrompt
    figma.tsx             figma.com — same pattern as jira.tsx
    hubspot.tsx           *.hubspot.com — same pattern
    tracked-site.tsx      catch-all (https://*/*, excludes the above + the webapp itself) —
                          icon-only, no DOM detector, for any other admin-registered domain
                          (e.g. lattice.com, bamboohr.com)
    webapp.ts             localhost:3000 / app.contextgrade.com only — auth bridge, no UI at all

  content/              Plain TS support code imported BY src/contents/*.tsx. Not auto-registered.
    detector.ts            BaseDetector — abstract MutationObserver lifecycle (start/stop/observe)
    sites/jira.ts           JiraDetector — DOM-only, no business logic, no API calls
    sites/figma.ts          FigmaDetector
    sites/hubspot.ts        HubSpotDetector

  background.ts         Single MV3 service worker: auth session pickup, ExtensionMessage router,
                         periodic sync alarm. All API orchestration funnels through here or services/.

  popup.tsx              Toolbar popup — master on/off toggle, signed-in user, read-only tracked
                         sites list, pending-sync-queue badge. No capture UI.
  sidepanel.tsx          Side panel — where DecisionForm actually renders; handles both an
                         auto-detected pending event and manual entry.

  components/
    FloatingIcon.tsx        Persistent corner button injected by content scripts
    FloatingPrompt.tsx      Ephemeral card shown after a detected event; auto-dismisses after 12s
    DecisionForm.tsx        The capture form (rendered inside the side panel)
    SignInPrompt.tsx        Links out to `${WEBAPP_URL}/login` — no auth UI lives in the extension
    ui/                     Badge, Button, Input, Textarea primitives

  services/
    api.ts                 Typed fetch wrappers, one per backend endpoint the extension calls
    auth.ts                Validates a raw session against GET /users/me, token freshness checks
    cache.ts                Offline sync-queue CRUD (CachedDecision records)
    sync.ts                 flushSyncQueue() (alarm-driven) + syncDecisionNow() (immediate, on submit)
                            — these are the ONLY two call sites that hit POST /events / POST /decisions

  hooks/
    useAuth.ts              Reactive auth state via Plasmo storage.watch
    useDecision.ts          Pending-event + just-saved-decision state for the side panel
    useTrackedSource.ts     Resolves + 5-min-caches the admin-registered source matching current tab
    useStorage.ts

  lib/
    constants.ts            Storage keys, TTLs, retry caps, the MEANINGFUL_* allowlists
    messaging.ts             Typed sendToBackground / onMessage wrappers around chrome.runtime
    storage.ts               Plasmo Storage wrapper: settings, auth, pending event, sync queue, sources cache
    utils.ts

  types/index.ts          Single source of truth for every shared type — DetectedEvent,
                           DecisionPayload, the ExtensionMessage union, API response shapes.
```

---

# Architecture

## Content Scripts (`src/contents/*` + `src/content/*`)

Responsible for: DOM observation, event detection, site-specific integrations.

No business logic. No AI logic. No API orchestration — content scripts never call `services/api.ts`
directly. They emit a `DetectedEvent` via `sendToBackground({ type: "DECISION_DETECTED" | "OPEN_SIDE_PANEL", ... })`
and let the background worker own everything past that point.

Each detector (`src/content/sites/*.ts`) extends `BaseDetector`, watches the DOM via `MutationObserver`,
and only calls back on an allowlisted state transition (see `MEANINGFUL_*` constants). Detectors read
text/attributes already rendered on the page (status badges, stage labels, resolved markers) — never
form inputs, never anything the user is actively typing.

## Background Worker (`src/background.ts`)

Responsible for: authentication, API communication, caching, syncing. This is where "no business logic
in content scripts" cashes out — `background.ts` + `src/services/*` are the only code that talks to the
backend or persists durable state.

## UI Layer (`src/components/*`, `popup.tsx`, `sidepanel.tsx`)

Responsible for: prompts, side panel, note capture, user interaction. Should feel like Grammarly / Loom /
Notion AI — minimal and unobtrusive. The popup is status-only (toggle, who's signed in, tracked sites);
the side panel is where capture actually happens.

---

# Auth Model

The extension has no sign-in UI of its own — `SignInPrompt` only deep-links to `${WEBAPP_URL}/login`
([src/lib/constants.ts](src/lib/constants.ts) — defaults to `http://localhost:3000`). Session handoff
from the webapp works like this:

1. `src/contents/webapp.ts` runs only on the webapp's own origin (`localhost:3000` / `app.contextgrade.com`,
   `run_at: document_start`). It scans `localStorage` for the Supabase `sb-*-auth-token` key, and also
   listens for a `cg:auth` CustomEvent, a `cg:signout` CustomEvent, and cross-tab `storage` events — so it
   picks up a session whether the user just logged in, already had one, or signed out in another tab.
2. On finding a session, it writes the raw tokens to `chrome.storage.local` under `cg_raw_session`
   (`RAW_SESSION` in `STORAGE_KEYS`). It never touches passwords — only the already-issued Supabase
   access/refresh token pair.
3. `background.ts` listens on `chrome.storage.onChanged` for that key (more reliable than
   `runtime.sendMessage` when the service worker is idle), calls `GET /users/me` with the bearer token to
   validate it and pull `memberships[]`, then stores an `AuthState` (`access_token`, `refresh_token`,
   `expires_at`, `user`, and `activeClientId` = the first `ACTIVE` membership) and clears the raw session.
4. Every authenticated request from `services/api.ts` attaches `Authorization: Bearer <token>` and
   `X-Client-Id: <activeClientId>` (see `buildHeaders` in [src/services/api.ts](src/services/api.ts)).
   **Never use `X-API-Key` here** — that header is for server-to-server integrations only, per the
   backend's auth model.
5. There is no refresh-token flow implemented. `getValidToken()` ([src/services/auth.ts](src/services/auth.ts))
   just checks `expires_at` against `TOKEN_REFRESH_BUFFER_SECS` (5 min) and clears auth state if it's
   expired or close to it — the user re-establishes session by visiting the webapp again.

A `PENDING` membership (per the backend's membership lifecycle) is not usable here — `activeClientId`
only ever resolves from an `ACTIVE` one. If a user has none, `validateAndStoreSession` returns `null` and
the extension shows `SignInPrompt`.

---

# Tracked Sources (Subject Companies)

Every domain the extension does anything on must be admin-registered on the dashboard first
(`POST /decisions/subject-companies`, admin-only). The extension only ever **reads** this list — it has
no way to register a new source, by design (matches the backend's "lookup-only, never auto-creates" model).

* `listSubjectCompanies()` → `GET /decisions/subject-companies`, cached 5 minutes in
  `cg_sources_cache` (`SOURCES_CACHE_TTL_MS`) to avoid refetching on every page load across every tab.
* `useTrackedSource(url)` resolves the hostname of the current tab against that cached list
  (`matchSource` — exact match or subdomain, e.g. `app.hubspot.com` matches a registered `hubspot.com`).
* This match gates everything: whether `FloatingIcon` renders at all, and whether a detector is allowed
  to run (`canDetect = masterEnabled && !!source` in `contents/jira.tsx` and siblings).
* `POST /decisions` is then called with `external_id` = the matched source's `external_id` — if a domain
  isn't registered, the API returns 400 and the UI surfaces "this site isn't registered as a tracked
  source, add it from the dashboard" (see the error paths in `DecisionForm.tsx` and `sidepanel.tsx`).

Three integration tiers follow from this:

| Tier | Where | Behavior |
|---|---|---|
| Dedicated | `contents/jira.tsx`, `figma.tsx`, `hubspot.tsx` | DOM detector + auto-prompt + icon |
| Catch-all | `contents/tracked-site.tsx` | Icon only, manual capture, no DOM observation — any other admin-registered domain |
| Auth bridge | `contents/webapp.ts` | No capture UI at all — session handoff only |

---

# Event & Decision Capture Flow

1. A detector (e.g. `JiraDetector`) sees an allowlisted state change and emits a `DetectedEvent`,
   enriched with the matched tracked source (`sourceCompanyExternalId`/`sourceCompanyName`) right there
   in the content script before it ever leaves the page (see `contents/jira.tsx`).
2. The content script sends `DECISION_DETECTED` to the background (stores it as the pending event) and
   shows `FloatingPrompt` — a small, non-blocking card that **auto-dismisses after 12 seconds** if
   ignored. This is the "Preferred pattern" below in code form.
3. Clicking "Save reasoning" sends `OPEN_SIDE_PANEL`, which opens `sidepanel.tsx` with that event loaded.
4. Alternatively, on a tracked domain with nothing auto-detected, the user can click "Log a decision" in
   the side panel — this builds a synthetic `DetectedEvent` (`eventType: "manual_entry"`) from the active
   tab's URL/title via `detectSiteFromUrl`.
5. `DecisionForm` requires: a context category and decision type (both fetched live, per-client, from
   `GET /decisions/context-categories` / `GET /decisions/types` — **never hardcode these lists**, they're
   per-client and admin-extensible), a decision summary, and rationale. Both summary and rationale are
   required client-side — an empty "why" defeats the entire point of the product.
6. On submit, `SAVE_DECISION` goes to the background, which calls `syncDecisionNow()`:
   `POST /events` (raw signal) → `POST /decisions` (referencing that event's id, `external_id` from the
   matched source, plus the inline `note`). If this throws anything other than `UNAUTHORIZED`, the
   payload is queued via `enqueueDecision()` instead of being dropped.
7. A successful response may include an AI `recommendation` (`APPROVE`/`REJECT`/`ESCALATE` + confidence +
   rationale + suggested conditions). `DecisionForm` renders this as a follow-up review step
   (`POST /decisions/:id/review`) the user can act on or explicitly skip — this is the one place the
   extension surfaces AI output, and it is always shown with its rationale, never a bare verdict
   (explainability principle, inherited from the backend).

## Offline / Sync Queue

`services/cache.ts` + `services/sync.ts` back a small offline queue so a flaky network never loses a
decision:

* Failed immediate syncs (`syncDecisionNow`) fall back to `enqueueDecision()` → `CachedDecision` in
  `cg_sync_queue`, status `"pending"`.
* `background.ts` registers a `cg-sync` alarm (`SYNC_INTERVAL_MS`, 30s) that calls `flushSyncQueue()`,
  retrying each pending item up to `MAX_SYNC_RETRIES` (3) before marking it `"failed"`.
* A `401`/`UNAUTHORIZED` during flush clears auth state and stops the flush early — queued items stay
  queued until the user re-authenticates, rather than being retried against a session that won't validate.
* Successfully synced items are pruned (`pruneQueue`), not kept around — there's no "synced history" view
  in the queue itself.

---

# Backend API Surface Used by the Extension

All under `/api/v1`. This is the subset the extension actually calls today — see the backend's own
CLAUDE.md for the full API.

| Method | Path | Called from |
|---|---|---|
| GET | `/users/me` | `services/auth.ts` — session validation, only place that bootstraps `AuthState` |
| GET | `/decisions/subject-companies` | `services/api.ts` `listSubjectCompanies` → `useTrackedSource` |
| GET | `/decisions/types` | `DecisionForm` on mount |
| GET | `/decisions/context-categories` | `DecisionForm` on mount |
| POST | `/events` | `services/sync.ts` — always called before `POST /decisions` |
| POST | `/decisions` | `services/sync.ts` — `external_id` lookup-only, never creates a subject company |
| POST | `/decisions/:id/review` | `DecisionForm`'s post-recommendation review step |

`services/api.ts` also defines `listDecisions`, `getDecision`, and `addDecisionNote` (comments reference
a future "popup dashboard tab" and a decision-history view), but **nothing in the current UI calls them
yet** — there is no decision-history/list screen in the extension today. If you build one, that API
surface is already there; don't assume it's already wired into a screen just because the client function
exists.

---

# Decision Payload Shape

`POST /decisions` is lookup-only — `external_id` must reference an existing, active subject company
already registered on the dashboard; the extension never sends inline `subject_company: {name, domain}`
(that pattern is deprecated — `external_id` resolution replaced it).

```ts
// What DecisionForm builds (src/components/DecisionForm.tsx) and
// services/api.ts createDecision() sends as POST /decisions body:
{
  external_id: "figma.com",          // from the matched tracked source, not user-entered
  decision_type: "CUSTOM",            // per-client, from GET /decisions/types
  context_category: "ENGINEERING",    // per-client, from GET /decisions/context-categories — independent of decision_type
  summary: "Change the base color to navy",
  note: {
    content: "Change the base color to navy.\n\nWhy: Because navy is the project theme color.",
    source_app: "figma",
    source_url: "https://www.figma.com/file/..."
  },
  event_id: "evt_123"                 // id of the POST /events row logged just before this call
}
```

`decision_type` and `context_category` are both required and resolved independently by value against
the client's own tables — picking one never constrains or defaults the other. Both dropdowns must be
populated live from the API on every form load; the 8 reserved decision types and 9 reserved context
categories are seeded per-client and admins can add custom ones, so a hardcoded list will drift.

---

# Supported Applications

Dedicated detector + auto-capture (`src/content/sites/*.ts` + matching `src/contents/*.tsx`):

* Jira (`*.atlassian.net`, `*.jira.com`) — status badge transitions (Done/Closed/Resolved/Approved/Rejected/Won't Do)
* Figma (`figma.com`, including FigJam boards) — comment/thread resolution
* HubSpot (`*.hubspot.com`) — deal stage transitions (closed-won/closed-lost/contract-sent/decision-maker-bought-in)

Catch-all manual capture (`src/contents/tracked-site.tsx`) — any other domain an admin registers as a
subject company gets the floating icon and manual entry, with no DOM detector. This is how future
targets (Salesforce, GitHub, Zendesk, Linear, Google Docs) get supported with zero extension code changes
until/unless a dedicated detector is built for them.

When adding a new dedicated integration: create `src/content/sites/<site>.ts` (detector only, extends
`BaseDetector`, no API calls) and `src/contents/<site>.tsx` (Plasmo entry point wiring the detector to
`FloatingIcon`/`FloatingPrompt`, following the existing `jira.tsx` pattern). Never mix site-specific
selectors into a shared file — each site's DOM quirks stay isolated.

---

# UX Principles

Capture should be frictionless. Users should never feel interrupted.

Preferred pattern (implemented literally as `FloatingIcon` → `FloatingPrompt` → `DecisionForm`):

```
Decision detected
↓
Small prompt (FloatingPrompt, auto-dismisses after 12s)
↓
Optional rationale (DecisionForm, in the side panel)
↓
Save
```

Avoid: full-screen modals, repeated popups, intrusive notifications. There is exactly one ambient UI
element per tracked page (`FloatingIcon`), and exactly one ephemeral one (`FloatingPrompt`) — don't add
a second always-visible surface without removing one.

---

# Security Principles

Collect the minimum amount of data required. Never collect: passwords, payment information, private
messages, keystrokes. Only collect decision-related metadata.

In this codebase specifically:

* The auth bridge (`contents/webapp.ts`) reads only an already-issued Supabase session token from
  `localStorage` — it never has access to, and never touches, credentials.
* Detectors (`content/sites/*.ts`) extract only text/attributes already rendered on the page for display
  (status labels, stage names, resolved markers) — never form field values, never anything mid-typing.
* `rawData` attached to a `DetectedEvent` is limited to the small set of fields each detector explicitly
  extracts (e.g. `{ statusText, issueKey, issueTitle }`) — don't widen this to dump arbitrary DOM/page
  state "just in case."

---

# Future Vision

The extension becomes a memory layer for work — eventually helping users answer: Why did we do this?
Have we done this before? What precedent exists? What happened last time? The extension captures
context; the backend builds memory. Together they create the Context Graph.

---

# Engineering Principle

Optimize for: signal quality, maintainability, explainability.

Do not optimize for: event volume, surveillance, complexity.

The goal is preserving human judgment.
