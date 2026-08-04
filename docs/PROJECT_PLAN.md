# ProposalAI — Project Plan

Status: **Draft for approval — no code has been written yet.**
Owner: Founding CTO / Principal Engineer role (Claude)
Last updated: 2026-08-04

This document is the single source of truth for what we build in the MVP, why, and how. Nothing here gets implemented until you approve it. Once approved, we build phase by phase (see Roadmap) and stop for sign-off after each phase.

---

## 1. Product Requirements Document (PRD)

### 1.1 Problem

IT consulting sales cycles are slowed down by proposal writing. A rep or manager gets an RFP, SOW, or a pile of meeting notes, and has to manually turn that into a structured, client-ready proposal — usually by copy-pasting into a Word/Google Doc template, re-writing the same boilerplate sections, and guessing at timeline/cost estimates. This takes hours to days and quality varies wildly by author.

### 1.2 Solution

ProposalAI is a shared workspace where **anyone on the team** — sales executives, delivery managers, solution architects, founders — can drop in a source document (RFP, SOW, notes) and get a structured, editable, on-brand proposal draft in minutes, then export it as PDF or Word.

This is explicitly **not** a sales-only tool. There is no gated "sales role." Every authenticated member of an organization can create, edit, and manage proposals. A manager's dashboard advantage is *visibility across the whole team's output*, not a different feature set — everyone gets the same generator, the same editor, the same export. (See §5 for how roles are modeled without over-engineering permissions in the MVP.)

### 1.3 Target users / personas

| Persona | Goal | Notes |
|---|---|---|
| Sales Executive | Turn an RFP into a proposal fast, before a competitor does | Primary volume user |
| Delivery / Engagement Manager | Draft SOWs and technical proposals from meeting notes | Needs accurate "Proposed Solution" & "Timeline" sections |
| Founder / Principal | Oversee proposal volume and quality across the org | Uses dashboard's org-wide view, still authors proposals personally |
| (Future) Solutions Architect | Contribute technical detail to a proposal in progress | Out of scope for MVP (no multi-author editing yet) |

### 1.4 Core user story (MVP)

> As any member of my company's workspace, I can upload a document describing a client's needs, get an AI-drafted proposal with the right sections, edit it inline until it's accurate, and export a polished PDF or Word file to send to the client — and my manager can see how many proposals the team is producing without me having to report it manually.

### 1.5 In scope (MVP — five features only)

1. **Authentication** — signup, login, forgot password, profile.
2. **Dashboard** — total proposals, recent proposals, AI usage, storage used, quick actions.
3. **AI Proposal Generator** — upload PDF/DOCX/TXT → AI drafts Executive Summary, Project Understanding, Proposed Solution, Timeline, Estimated Cost, Assumptions → user edits and saves.
4. **Proposal Management** — view, search, edit, delete, duplicate.
5. **Export** — PDF and DOCX.

### 1.6 Explicitly out of scope for MVP

- Team invitations / member management UI (org exists as a data model, but invite flow is a fast-follow, not MVP-blocking — see §5.1 for the pragmatic default).
- Proposal templates / branding customization (logo, theme colors on export) — Phase 2.
- Real-time multi-user co-editing of a single proposal.
- E-signature / client-facing proposal links / view tracking.
- Billing/subscriptions (Stripe) — the app ships as internal/allowlisted for now.
- Commenting/approval workflows.
- Version history / diffing of proposal edits (we keep `updatedAt`, not a full audit trail).
- Fine-grained per-proposal permissions (private vs. shared proposals) — everything is org-shared by default in MVP.

### 1.7 Success metrics

- Time from upload → usable draft: **< 60 seconds** perceived (streamed), < 3 min hard ceiling for large docs.
- Proposal creation → export: **< 10 minutes** end-to-end for a first-time user.
- Zero data loss: autosave on the editor, no "lost my edits" reports.
- Dashboard load: **< 1s** perceived (skeleton immediately, data within 500ms on warm cache).

### 1.8 Design bar

Every screen must read as premium enterprise SaaS — comparable to Linear/Notion/Stripe Dashboard/Vercel/Ramp/Mercury — not "generated admin template." Concretely: generous whitespace, a restrained neutral palette with one accent color, 8pt spacing grid, subtle elevation (soft shadows, not drop-shadow presets), consistent 200ms ease-out motion on interactive elements, skeleton loaders (never spinners for content areas), and real empty states with a clear next action — never a blank page.

---

## 2. User Flow

### 2.1 First-time user

```
Landing/Login → Sign up (email + password) → Verify email (Supabase)
  → Onboarding (name, company name → creates Organization) → Dashboard (empty state)
  → "New Proposal" quick action → Upload flow → Generated draft → Edit → Save
  → Proposal detail → Export (PDF or DOCX)
```

### 2.2 Returning user

```
Login → Dashboard (populated: stats + recent proposals)
  → Either: open a recent proposal to keep editing
  → Or: Proposals list → search/filter → open one
  → Or: Quick Action → New Proposal
```

### 2.3 Proposal generation flow (the core loop)

```
1. Click "New Proposal"
2. Upload source file (drag/drop or browse) — PDF, DOCX, or TXT, max 15MB
3. Optional: add a short freeform brief ("client is X, budget-conscious, needs Y")
4. Click "Generate" → async job starts
   3a. Extract text from file (server-side)
   3b. Send to AI provider with structured-output prompt
   3c. Stream sections back to the client as they complete
5. User lands on the Proposal Editor with all 6 sections pre-filled and editable
6. User edits inline (rich text), sees "Saved" indicator (autosave, debounced)
7. User renames the proposal, sets client name (metadata)
8. Export → PDF or DOCX → download
9. Proposal now appears in Dashboard "Recent" and in Proposals list
```

### 2.4 Failure paths that must be designed, not bolted on

- Upload rejected (wrong type / too large) → inline error, no dead-end.
- Text extraction yields near-empty content (e.g., scanned image PDF with no OCR) → explicit "we couldn't read this file" state with retry/replace-file action, not a silently bad AI draft.
- AI generation fails or times out → partial sections kept, failed sections marked with a retry button per-section (don't discard the whole draft).
- AI provider outage → automatic fallback to secondary provider (see §9), user never sees a raw provider error.

---

## 3. Information Architecture

### 3.1 Sitemap

```
/ (marketing redirect → /login or /dashboard if authed)
/login
/signup
/forgot-password
/reset-password
/onboarding                      (first-login only: create org / name)
/dashboard                       (protected, app shell)
/proposals                       (list + search)
/proposals/new                   (upload + generate)
/proposals/[id]                  (editor / detail)
/proposals/[id]/export           (export modal, not a route in practice — see below)
/settings/profile
/settings/organization           (name, plan placeholder — minimal in MVP)
```

Auth, onboarding are outside the app shell (no sidebar). Everything under `/dashboard`, `/proposals/*`, `/settings/*` shares one authenticated app shell: left sidebar (nav + org switcher stub) + top bar (search, user menu).

### 3.2 Primary navigation (sidebar)

- Dashboard
- Proposals
- (Settings, at the bottom, secondary)

### 3.3 Proposal detail page structure

Two-pane layout: left = section navigator (jump to Executive Summary / Project Understanding / ... ), right = editable rich-text content per section, with a sticky top bar (title, client name, status pill, Export button, Save indicator).

---

## 4. Database Design

PostgreSQL via Supabase, accessed through Prisma. Multi-tenant by **Organization**, because the requirement is that a manager and a sales person share one workspace — proposals are org-scoped, not user-siloed.

### 4.1 Entity-relationship overview

```
Organization 1 ──< User
Organization 1 ──< Proposal
User          1 ──< Proposal        (createdBy — for "Recent" / attribution, not access control)
Proposal      1 ──< ProposalSection (one row per section: summary, understanding, solution, timeline, cost, assumptions)
Proposal      1 ──< SourceDocument  (the uploaded file(s) + extracted text)
Proposal      1 ──< ProposalExport  (audit of generated PDF/DOCX files, for storage cleanup + re-download)
User          1 ──< AIUsageEvent    (token/cost tracking for the "AI Usage" dashboard stat)
```

### 4.2 Prisma schema (source of truth for Phase 1 migration)

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum OrgRole {
  ADMIN   // full org visibility + (future) member/billing management
  MEMBER  // full proposal CRUD, same as ADMIN — no feature gating in MVP
}

enum ProposalStatus {
  DRAFT       // generated but not touched, or actively being edited
  READY       // user marked complete
  EXPORTED    // at least one export produced
  ARCHIVED    // soft-deleted
}

enum SourceFileType {
  PDF
  DOCX
  TXT
}

enum ExportFormat {
  PDF
  DOCX
}

enum ProposalSectionKey {
  EXECUTIVE_SUMMARY
  PROJECT_UNDERSTANDING
  PROPOSED_SOLUTION
  TIMELINE
  ESTIMATED_COST
  ASSUMPTIONS
}

enum AIProvider {
  OPENAI
  ANTHROPIC
}

model Organization {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users      User[]
  proposals  Proposal[]

  @@map("organizations")
}

model User {
  id             String   @id @default(cuid()) // mirrors Supabase auth user id
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  email       String   @unique
  fullName    String
  avatarUrl   String?
  role        OrgRole  @default(MEMBER)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  proposalsCreated Proposal[]     @relation("ProposalCreatedBy")
  aiUsageEvents    AIUsageEvent[]

  @@index([organizationId])
  @@map("users")
}

model Proposal {
  id             String   @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  createdById String
  createdBy   User   @relation("ProposalCreatedBy", fields: [createdById], references: [id])

  title      String
  clientName String?
  status     ProposalStatus @default(DRAFT)

  // denormalized for fast list/search without joining sections every time
  searchText String @default("") // title + clientName + section excerpts, lowercased

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime? // soft delete backs the "Delete" action; excluded from all default queries

  sections        ProposalSection[]
  sourceDocuments SourceDocument[]
  exports         ProposalExport[]

  @@index([organizationId, deletedAt, updatedAt])
  @@map("proposals")
}

model ProposalSection {
  id         String @id @default(cuid())
  proposalId String
  proposal   Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)

  key     ProposalSectionKey
  order   Int
  content String             @db.Text // rich text stored as sanitized HTML (or Tiptap JSON — see §6)

  aiGenerated    Boolean  @default(true) // false once user meaningfully edits it, drives a small "edited" badge
  generationMeta Json?    // model, provider, tokens, prompt version — for debugging/regeneration

  updatedAt DateTime @updatedAt

  @@unique([proposalId, key])
  @@map("proposal_sections")
}

model SourceDocument {
  id         String @id @default(cuid())
  proposalId String
  proposal   Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)

  fileName      String
  fileType      SourceFileType
  storagePath   String // Supabase Storage object path
  fileSizeBytes Int
  extractedText String  @db.Text
  extractionOk  Boolean @default(true) // false → drives the "we couldn't read this file" UI state

  createdAt DateTime @default(now())

  @@map("source_documents")
}

model ProposalExport {
  id         String @id @default(cuid())
  proposalId String
  proposal   Proposal @relation(fields: [proposalId], references: [id], onDelete: Cascade)

  format      ExportFormat
  storagePath String
  createdAt   DateTime @default(now())

  @@map("proposal_exports")
}

model AIUsageEvent {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  organizationId String
  provider       AIProvider
  model          String
  promptTokens   Int
  completionTokens Int
  costUsdMicros  Int      // cost stored as integer micros (1e-6 USD) to avoid float drift
  createdAt      DateTime @default(now())

  @@index([organizationId, createdAt])
  @@map("ai_usage_events")
}
```

### 4.3 Notes on modeling decisions

- **Org-shared proposals, not user-siloed.** This directly implements "one solution for both managers and sales persons." There is no `visibility` field in MVP — every proposal in an org is visible to every member of that org. `createdById` is attribution only (drives "Recent" and avatars), never an access filter.
- **Roles exist but don't gate features yet.** `OrgRole.ADMIN` vs `MEMBER` is stored from day one so we don't need a breaking migration later, but in the MVP both roles get identical proposal CRUD permissions. The only place role could matter later (Phase 2+) is org settings / member management — not part of the five MVP features, so we don't build UI for it now.
- **Sections are rows, not a JSON blob**, so we can independently mark a section as edited, regenerate a single section, and query/search efficiently.
- **Soft delete** (`deletedAt`) backs "Delete" so accidental deletes are recoverable via a support/DB fix without a full trash-bin UI in MVP.
- **`searchText`** is a pragmatic MVP search approach: a denormalized lowercase text column with a Postgres `GIN`/trigram index (`pg_trgm`), refreshed on save. Good enough for hundreds-to-low-thousands of proposals per org; if search needs grow, swap for `tsvector` full-text search without changing the API shape.
- **Storage usage** (dashboard stat) is computed on read as `sum(fileSizeBytes)` for `SourceDocument` + estimated export sizes, not a separately maintained counter — avoids drift.

---

## 5. Backend Architecture

### 5.1 Auth & multi-tenancy model

- **Supabase Auth** issues the JWT (email/password, magic-link reset). Supabase manages the `auth.users` table; our `User` table mirrors the subset of fields we need, keyed on the same `id` (created via a Supabase Postgres trigger or, more simply for MVP, created lazily on first authenticated API call — "just-in-time provisioning").
- **First login → onboarding** creates the `Organization` row and the `User` row with `role = ADMIN` for whoever creates it; anyone who signs up afterward without an invite also gets their own org for now (invite-into-existing-org is a fast-follow, not required for the 5 MVP features to function — a solo user or a small team that all sign up gets full value day one).
- **Every API route** resolves `organizationId` from the authenticated session and scopes every Prisma query to it. There is no cross-org query path in the codebase — enforced by a single `getScopedPrismaContext(req)` helper every route must call, so this can't be forgotten route-by-route.
- Route protection via Next.js middleware checking the Supabase session cookie; unauthenticated requests to any `/dashboard`, `/proposals/*`, `/settings/*`, or `/api/*` (except `/api/auth/*`) redirect to `/login`.

### 5.2 Request/response layer

- Next.js Route Handlers (`app/api/**/route.ts`) as thin controllers: parse + validate (Zod) → call a service function → return typed JSON. No business logic in route handlers.
- **Service layer** (`src/features/*/server/service.ts`) holds the actual logic (Prisma calls, orchestration), independently testable without HTTP.
- **Consistent envelope**: success → `{ data }`; error → `{ error: { code, message, fieldErrors? } }` with matching HTTP status. One shared error class hierarchy (`AppError`, `ValidationError`, `NotFoundError`, `ForbiddenError`) and one error-handling wrapper around every route handler.

### 5.3 File processing pipeline

1. Client requests a signed upload URL from `/api/proposals/upload-url` (validates file type/size first).
2. Client uploads directly to Supabase Storage (keeps large files off our API routes/serverless payload limits).
3. Client calls `/api/proposals` (create) with the storage path → server downloads the file server-side, runs extraction:
   - PDF → `pdf-parse` (or `unpdf` if we need better layout fidelity)
   - DOCX → `mammoth`
   - TXT → read as-is
4. Extracted text saved to `SourceDocument.extractedText`; if extraction yields < ~50 meaningful characters, mark `extractionOk = false` and short-circuit to the "couldn't read this file" UI state instead of generating.
5. Kick off AI generation (see §9) against the extracted text.

### 5.4 Background/async work

MVP keeps this **in-request but streamed**, not a separate job queue — the generation step is the only slow operation, and streaming keeps perceived latency low without adding infra (queue, worker, Redis) before we need it. Implementation: a Route Handler returning a streamed response (`ReadableStream`) that the client consumes section-by-section, updating the editor as each section arrives. If a real background queue becomes necessary (e.g., very large documents, batch generation), that's an additive Phase 3 change (e.g., a Supabase Edge Function or a lightweight queue), not a rearchitecture.

### 5.5 Rate limiting & cost control

- Per-organization AI usage is metered via `AIUsageEvent` (already in the schema) — dashboard's "AI Usage" stat reads from this.
- Simple per-user rate limit on `/api/proposals/generate` (e.g., 10 generations / 10 minutes) via a small in-memory/Upstash-Redis-backed limiter, to contain runaway cost from a misbehaving client, not to gate legitimate use.

---

## 6. Frontend Architecture

### 6.1 Rendering strategy

- Next.js App Router, React Server Components by default; Client Components only where interactivity requires it (forms, the rich text editor, upload dropzone, charts).
- Server Components fetch data directly (via the service layer) for the Dashboard and Proposals list — no client-side waterfall for initial paint. Mutations (save, delete, generate) go through Route Handlers called from Client Components with optimistic UI where safe (e.g., delete, duplicate) and pessimistic UI where correctness matters (e.g., generation).

### 6.2 State management

- **Server state**: TanStack Query for anything fetched/mutated from a Client Component (proposal list refresh after delete, editor autosave status) — gives us caching, retries, and optimistic updates for free instead of hand-rolled `useEffect` fetching.
- **Local/UI state**: React state + a couple of small Zustand stores only where state must persist across route changes in a way Query doesn't fit (e.g., "generation in progress" banner surviving navigation). Default to co-located `useState` first; reach for Zustand only when state is genuinely cross-cutting.
- **Forms**: React Hook Form + Zod resolvers everywhere (login, signup, proposal metadata, settings).

### 6.3 Design system

- **shadcn/ui** as the base (Radix primitives + Tailwind), customized via a single design-tokens layer (`tailwind.config.ts` + CSS variables) rather than default shadcn theme — this is how we avoid the "generic AI dashboard" look: one accent color, a restrained neutral gray scale (not pure gray — slightly warm/cool tinted per brand choice), one heading font pairing, consistent 8px spacing scale, soft multi-layer shadows (`shadow-sm`/`shadow-md` custom-tuned, not Tailwind defaults).
- A small internal component layer on top of shadcn primitives (`src/components/ui-custom` or similar) for composite patterns used repeatedly: `StatCard`, `EmptyState`, `PageHeader`, `SectionCard`, `Skeleton*` variants — so every screen composes from the same primitives instead of bespoke one-off markup.
- Framer Motion for the small set of animations that matter (page/section transitions, stat card count-up, modal/drawer enter-exit) — not applied indiscriminately.

### 6.4 Rich text editor (proposal sections)

- **Tiptap** (ProseMirror-based) for the section editor: supports structured content (headings, lists, tables for timeline/cost breakdowns), clean HTML/JSON serialization, and is the de facto standard for this in modern SaaS (Notion-like editing feel). Content persisted as sanitized HTML in `ProposalSection.content`.

### 6.5 Loading/empty/error states (non-negotiable per screen)

Every data-bearing screen ships with all three from day one, not retrofitted:
- **Loading** → skeleton matching final layout (never a spinner for page content).
- **Empty** → illustration/icon + one sentence + a primary action ("Create your first proposal").
- **Error** → inline, specific, with retry — never a raw stack trace or generic "Something went wrong" with no next step.

---

## 7. API Structure

REST-ish JSON API via Next.js Route Handlers. All routes below are implicitly organization-scoped and auth-protected unless noted.

```
Auth (thin wrappers around Supabase Auth; most auth UI calls Supabase client SDK directly)
  POST   /api/auth/signup
  POST   /api/auth/login
  POST   /api/auth/forgot-password
  POST   /api/auth/reset-password
  POST   /api/auth/logout

Onboarding
  POST   /api/onboarding                 create Organization + finalize User profile (first login only)

Profile
  GET    /api/profile
  PATCH  /api/profile

Dashboard
  GET    /api/dashboard/summary          totals, AI usage, storage used (aggregated, cached briefly)
  GET    /api/dashboard/recent-proposals

Proposals
  GET    /api/proposals                  list — supports ?q=&page=&sort=
  POST   /api/proposals                  create (from an uploaded source doc) — kicks off extraction
  GET    /api/proposals/:id
  PATCH  /api/proposals/:id              metadata (title, clientName, status) + section content upserts
  DELETE /api/proposals/:id              soft delete
  POST   /api/proposals/:id/duplicate

  POST   /api/proposals/upload-url       returns a signed Supabase Storage upload URL
  POST   /api/proposals/:id/generate     streaming AI generation (SSE or streamed chunks)
  POST   /api/proposals/:id/sections/:key/regenerate   regenerate a single section

Export
  POST   /api/proposals/:id/export       body: { format: "pdf" | "docx" } → returns a download URL
```

### 7.1 Conventions

- Validation: every request body validated with a Zod schema colocated with the route; invalid input → `400` with `fieldErrors`.
- Pagination: cursor-based (`?cursor=&limit=`) for the proposals list, not offset — cheap and correct even as data grows.
- All mutating endpoints return the full updated resource (so the client can just replace cache state, no refetch-on-mutate needed).

---

## 8. Folder Structure

Feature-based, not type-based — a `proposals` feature owns its components, server logic, and types together, so the codebase scales by feature count, not by ever-growing shared folders.

```
proposalai/
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/
│  │  │  ├─ login/page.tsx
│  │  │  ├─ signup/page.tsx
│  │  │  ├─ forgot-password/page.tsx
│  │  │  └─ reset-password/page.tsx
│  │  ├─ (app)/                        # authenticated shell (sidebar + topbar layout)
│  │  │  ├─ layout.tsx
│  │  │  ├─ dashboard/page.tsx
│  │  │  ├─ proposals/
│  │  │  │  ├─ page.tsx                # list
│  │  │  │  ├─ new/page.tsx            # upload + generate
│  │  │  │  └─ [id]/page.tsx           # editor
│  │  │  └─ settings/
│  │  │     ├─ profile/page.tsx
│  │  │     └─ organization/page.tsx
│  │  ├─ onboarding/page.tsx
│  │  ├─ api/
│  │  │  ├─ auth/**/route.ts
│  │  │  ├─ onboarding/route.ts
│  │  │  ├─ profile/route.ts
│  │  │  ├─ dashboard/**/route.ts
│  │  │  └─ proposals/**/route.ts
│  │  ├─ layout.tsx                    # root layout, fonts, providers
│  │  └─ globals.css
│  ├─ features/
│  │  ├─ auth/
│  │  │  ├─ components/ (LoginForm, SignupForm, ...)
│  │  │  ├─ server/ (service.ts)
│  │  │  └─ schemas.ts                 # Zod
│  │  ├─ dashboard/
│  │  │  ├─ components/ (StatGrid, RecentProposalsCard, UsageMeter, QuickActions)
│  │  │  └─ server/service.ts
│  │  ├─ proposals/
│  │  │  ├─ components/ (ProposalList, ProposalCard, SearchBar, UploadDropzone,
│  │  │  │               ProposalEditor, SectionEditor, ExportDialog)
│  │  │  ├─ server/ (service.ts, extraction.ts)
│  │  │  ├─ hooks/ (useProposals.ts, useGenerateProposal.ts — TanStack Query)
│  │  │  └─ schemas.ts
│  │  └─ settings/
│  │     ├─ components/
│  │     └─ server/service.ts
│  ├─ ai/
│  │  ├─ provider.ts                    # AIProvider interface
│  │  ├─ providers/openai.ts
│  │  ├─ providers/anthropic.ts
│  │  ├─ prompts/                       # versioned prompt templates per section
│  │  └─ generateProposal.ts            # orchestration: prompt → provider → structured sections
│  ├─ lib/
│  │  ├─ prisma.ts                      # singleton client
│  │  ├─ supabase/ (server.ts, client.ts, middleware.ts)
│  │  ├─ storage.ts                     # Supabase Storage helpers
│  │  ├─ export/ (pdf.ts, docx.ts)
│  │  ├─ errors.ts
│  │  └─ apiHandler.ts                  # shared route-handler wrapper (auth + error envelope)
│  ├─ components/
│  │  ├─ ui/                            # shadcn primitives (generated, lightly customized)
│  │  └─ ui-custom/                     # StatCard, EmptyState, PageHeader, Skeletons, etc.
│  ├─ hooks/                            # cross-feature hooks (useDebounce, useSession)
│  ├─ types/                            # shared types not owned by one feature
│  └─ middleware.ts                     # Supabase session check / route protection
├─ public/
├─ .env.example
├─ tailwind.config.ts
├─ next.config.ts
├─ tsconfig.json                        # strict: true
└─ package.json
```

---

## 9. AI Workflow

### 9.1 Design goal: provider-agnostic from day one

Both OpenAI and Anthropic models must be swappable without touching feature code. We define one interface and two adapters:

```ts
// src/ai/provider.ts
interface AIProvider {
  generateProposalSections(input: {
    extractedText: string
    userBrief?: string
  }): AsyncIterable<{ key: ProposalSectionKey; content: string }>
}
```

`providers/openai.ts` and `providers/anthropic.ts` each implement this against their respective structured-output / tool-use APIs. A single config value (env var or org setting, MVP: env var) selects the active provider; a fallback provider is used automatically on a provider-level failure (timeout, 5xx, rate limit) so generation doesn't hard-fail because one vendor is down.

### 9.2 Pipeline

```
Uploaded file
   │
   ▼
Text extraction (pdf-parse / mammoth / raw txt)
   │  (if extractionOk === false → stop, surface "couldn't read this file")
   ▼
Pre-processing: truncate/chunk to fit context window, strip boilerplate
   │
   ▼
Prompt assembly (versioned templates per section, shared system prompt
establishing "you are drafting a professional IT consulting proposal")
   │
   ▼
AIProvider.generateProposalSections() — streamed
   │
   ├─▶ Executive Summary        ─┐
   ├─▶ Project Understanding     │  each section streamed independently to the
   ├─▶ Proposed Solution         │  client and persisted to ProposalSection
   ├─▶ Timeline                  │  as it completes — user sees progressive fill-in,
   ├─▶ Estimated Cost            │  not a single long spinner
   └─▶ Assumptions              ─┘
   │
   ▼
AIUsageEvent recorded (tokens + cost) for dashboard metering
```

### 9.3 Prompting approach

- One shared system prompt (role, tone, output constraints: no invented client names/pricing beyond what's inferable, flag uncertainty explicitly in "Assumptions" rather than fabricating).
- Structured output enforced via the provider's native mechanism (OpenAI: JSON schema / tool calling; Anthropic: tool use) rather than asking the model to format sections in prose and parsing — this eliminates a whole class of parsing bugs.
- Prompt templates versioned (`prompts/v1/*.ts`) and the version stored in `ProposalSection.generationMeta`, so we can improve prompts later without losing the ability to see what generated an existing proposal.
- Per-section regeneration reuses the same pipeline scoped to one `ProposalSectionKey`, so a user unhappy with just the "Estimated Cost" section doesn't have to regenerate everything.

### 9.4 Cost/latency guardrails

- Extracted text truncated to a sane token budget (e.g., ~15k tokens) with a "document truncated, review Assumptions" notice if the source was longer — predictable cost per generation.
- Timeouts per provider call with the fallback-provider retry described above; if both fail, sections are marked failed with a retry button — never a blank editor.

---

## 10. Recommended Libraries

| Concern | Library | Why |
|---|---|---|
| Framework | Next.js (App Router) | Already specified; SSR/RSC fits the data-heavy dashboard |
| Language | TypeScript (strict) | Already specified |
| Styling | Tailwind CSS | Already specified |
| Components | shadcn/ui (Radix + Tailwind) | Already specified; owns markup so we can restyle freely |
| Forms | React Hook Form + Zod | Already specified |
| Server state | TanStack Query | Caching/optimistic updates for mutations, avoids hand-rolled fetch logic |
| Client state (minimal) | Zustand | Only for genuinely cross-route UI state |
| Rich text editor | Tiptap | Structured, serializable, Notion-like editing feel |
| Animation | Framer Motion | Used sparingly for the interactions that matter |
| Charts (dashboard) | Recharts or Tremor | Lightweight, composes well with Tailwind/shadcn look |
| ORM | Prisma | Already specified |
| DB | PostgreSQL (Supabase) | Already specified |
| Auth | Supabase Auth | Already specified |
| Storage | Supabase Storage | Already specified |
| PDF text extraction | pdf-parse (or unpdf) | Reliable, well-maintained |
| DOCX text extraction | mammoth | Standard for DOCX → text/HTML |
| PDF export | @react-pdf/renderer (or Puppeteer for HTML→PDF fidelity) | React-driven templates keep export styling in sync with in-app design |
| DOCX export | docx (npm package) | Programmatic native .docx generation |
| AI SDKs | openai, @anthropic-ai/sdk | Official SDKs behind our own `AIProvider` interface |
| Rate limiting | @upstash/ratelimit (+ Upstash Redis) | Simple, serverless-friendly |
| Validation | Zod | Already specified; shared between forms and API routes |
| Testing | Vitest + React Testing Library, Playwright (e2e) | Standard, fast, good Next.js support |
| Linting/formatting | ESLint, Prettier | Baseline hygiene |

---

## 11. Development Roadmap

Work proceeds phase by phase. **Each phase ends with a summary + explicit request for your approval before starting the next.**

### Phase 0 — Project scaffolding
Next.js app, TypeScript strict mode, Tailwind + shadcn/ui installed and themed (tokens, not defaults), ESLint/Prettier, Prisma initialized, Supabase project wired (env vars), base folder structure from §8, CI-ready lint/typecheck scripts. No features yet — this is the foundation.

### Phase 1 — Authentication
Signup, login, forgot/reset password via Supabase Auth; onboarding flow that provisions `Organization` + `User`; profile page; route protection middleware; the authenticated app shell (sidebar/topbar) with empty pages behind it.

### Phase 2 — Dashboard (with mock/empty data first, then live)
Stat cards (Total Proposals, AI Usage, Storage Used), Recent Proposals card, Quick Actions, full skeleton/empty states — built against the real `/api/dashboard/*` endpoints once Phase 3 exists, stubbed against realistic data shapes until then.

### Phase 3 — Proposal Management (CRUD, no AI yet)
Proposals list (search, pagination), create a proposal manually with empty sections, edit metadata, delete (soft), duplicate. This proves out the data model and editor shell before layering AI on top.

### Phase 4 — AI Proposal Generator
Upload flow (signed URL, dropzone, validation), text extraction pipeline, `AIProvider` abstraction with OpenAI + Anthropic adapters, streaming generation into the editor, per-section regenerate, AI usage metering feeding the Phase 2 dashboard stat.

### Phase 5 — Export
PDF export (styled, on-brand template) and DOCX export (native, editable in Word), download flow, `ProposalExport` records, storage cleanup considerations.

### Phase 6 — Polish pass
Cross-cutting design QA against the Linear/Notion/Stripe bar: animation consistency, responsive/mobile pass on every screen, accessibility check (focus states, contrast, keyboard nav), performance pass (dashboard/list query performance, image/font optimization).

---

## Open questions for you before we start building

1. **Org/team model**: does the org-shared-proposals approach in §4.3/§5.1 (everyone in a company sees everyone else's proposals, roles don't gate anything yet) match what you want, or do you want per-proposal privacy from day one?
2. **AI provider default**: start with OpenAI, Anthropic, or both live behind a toggle from day one?
3. **Branding**: do you have a name/logo/color direction already, or should Phase 0 include a quick design-direction proposal (palette + type pairing) for you to pick from?
4. **Export template**: any existing proposal template/branding to match, or should we design a clean original one?

---

**Nothing above has been implemented.** Once you approve this plan (and answer the open questions, or tell me to use my best judgment on them), we start Phase 0.
