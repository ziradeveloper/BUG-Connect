# BUGConnect — Implementation Ledger & Wave Tracking

Living master ledger for BUGConnect development. Newest entries on top. Nothing is marked done (`[x]`) unless it builds cleanly (`npx ng build`), passes unit test suites (`npx ng test --watch=false`), and renders accurately across Desktop and Mobile viewports.

**Legend:** `[x]` done · `[~]` in progress · `[ ]` todo · `[!]` blocked/decision needed · `»` detail

- **App Name:** BUGConnect (`BUG Connect`)
- **Repository / PR:** [ziradeveloper/BUG-Connect](https://github.com/ziradeveloper/BUG-Connect)
- **Stack:** Angular 21.2 Standalone + Signals, SSR (`@angular/ssr`), Tailwind v4 via PostCSS, Vitest runner (`@angular/build:unit-test`), Strict TypeScript
- **Architecture Spec:** See [ARCHITECTURE.md](file:///d:/Projects/BUGConnect/BUGConnect/ARCHITECTURE.md) for full data models, host resolution pipeline, and security specs.

---

## 🔑 Configured Demo Credentials Matrix

| Environment / Subdomain | Target Scope | Username | Password | Resolved Role |
| :--- | :--- | :--- | :--- | :--- |
| `admin.localhost:4200` | **Platform Console** | `systemadmin` | `admin@123` | Platform Owner |
| `nazeel.localhost:4200` | **Client Workspace** | `admin` | `admin@123` | Workspace Admin |
| `nazeel.localhost:4200` | **Client Workspace** | `supervisor` | `admin@123` | Supervisor (No Billing/WhatsApp) |
| `nazeel.localhost:4200` | **Client Workspace** | `agent` | `admin@123` | Support Agent (Inbox & Contacts) |
| `nazeel.localhost:4200` | **Client Workspace** | `developer` | `admin@123` | Integration User (Developer Hub) |

---

## 🔒 System Architecture & Locked Decisions

| Topic | Locked Decision | Rationale |
|---|---|---|
| Product Branding | **BUGConnect** (Logo: `BUG` + `Connect`) | Standardized project branding across header, footer, shells, titles, and storage keys |
| Subdomain Isolation | Subdomain from core: `admin.localhost:4200` / `nazeel.localhost:4200` | Subdomain-isolated architecture matching multi-tenant security requirements |
| Host Resolution | `resolveWorkspace(host, queryOverride, storedOverride)` in core | SSR-safe dynamic host resolution; fallback via `?ws=<slug>` & `localStorage['bugconnect-dev-workspace']` |
| Route Guarding | Three `canMatch` route trees in `app.routes.ts` | Prevents route leakage: `/clients` is unreachable on client host; `/inbox` is unreachable on platform admin host |
| Shared Data Table | Custom `<app-data-table>` component | Zero external UI libraries; full control over accessibility (`aria-sort`), custom cell templates, sorting, pagination, search, and CSV export |
| Styling System | Global stylesheet tree in `src/styles/` (tokens, base, components, pages), no component-scoped CSS | High-aesthetic dark/light modes, micro-animations, glassmorphism, responsive mobile drawers, and horizontal scroll tables |
| SSR Configuration | `RenderMode.Server` for all routes (`app.routes.server.ts`) | Disables static prerendering to ensure host header dynamically resolves per request |

---

## 🌊 Waves & Progress Overview

| Wave | Scope | Page Count | Status |
|---|---|---|---|
| **1** | **Foundation**: Workspace context, auth, login fixes, brand alignment, roles/menu CRUD, users CRUD, shells, DataTable, error routes | 12 | `[x]` |
| **2** | **Team Inbox**: Split-pane inbox, active conversation view, weighted router, internal notes, resolution handoff, full Meta Cloud API send support, fixed-pane layout | 4 | `[x]` |
| **3** | **Client Operations**: Contacts hub, contact detail, segments, opt-outs, templates manager, teams, quick replies, settings | 9 | `[x]` |
| **4** | **Platform Admin**: Onboard client wizard, client detail tabs, plans feature matrix, subscriptions, invoices, Meta app config, webhook health monitor, WhatsApp connection | 10 | `[x]` |
| **5** | **Lifecycle & Self-Service**: Billing, audit logging, onboarding wizard, suspended state, password reset, invite acceptance | 7 + suspended | `[x]` |
| **6** | **Advanced Automation**: Visual Flow Builder canvas, WhatsApp Flows form studio, Campaign broadcast wizard, Executive analytics | 12 | `[~]` 9/12 |

---

## 📋 Full Page Inventory (59 Pages) — Detailed Status Tracker

`W1..W6` = Wave assignment. `stub` = Route + empty state placeholder, proving navigation and permission enforcement.

### Shared & Entry Pages (8 Pages)
- `[x]` `W1` **Landing Page** (`/`) — Product overview, flow-first pipeline, RBAC matrix, industry use cases, pricing draft, FAQ.
- `[x]` `W1` **Sign In Page** (`/login`) — Host-aware authentication, demo accounts selector, show/hide password toggle, error validation.
- `[x]` `W1` **Profile Page** (`/profile`) — User identity, resolved host/source, granted capability chips, theme toggle, sign out.
- `[x]` `W1` **No Access Page** (`/no-access`) — Access denied error screen displaying required capability level.
- `[x]` `W1` **Not Found Page** (`/404`) — Host-aware 404 page with navigation fallbacks.
- `[x]` `W5` **Forgot Password** (`/forgot-password`) — Self-service password recovery email request form.
  » Built: `pages/forgot-password-page`. Email lookup against the seeded directory, a sealed "check your inbox" panel that reveals the simulated single-use link (30-minute TTL), an explicit unknown-address state that mints nothing, and a seeded-accounts shortcut row so the flow is walkable without reading the data layer.
- `[x]` `W5` **Reset Password** (`/reset-password`, `?token=`) — Password reset token handler and form.
  » Built: `pages/reset-password-page`. Reads the token through `input()` (component input binding), rejects unknown/spent/expired links before rendering a form, live strength rules, then `completePasswordReset()` + `session.registerCredential()` so the new password signs in immediately.
- `[x]` `W5` **Accept Invite** (`/accept-invite`, `?token=`) — Team member invitation acceptance and initial password setup.
  » Built: `pages/accept-invite-page`. Shows the invited person, role, workspace and expiry; explicit expired / already-accepted states; accepting spends the single-use token, activates the seat and registers the password. Reachable from the Users list — every pending row now carries **Invite link** (opens the screen on the invitee's token) and **Copy** (clipboard).

### Platform Admin Module — `admin.localhost:4200` (19 Pages)
- `[x]` `W1` **Platform Dashboard** (`/`) — Platform tenant counts, active seats, webhook events ingestion queue monitor.
- `[x]` `W1` **Clients List** (`/clients`) — Onboarded tenant data table with subdomain link, subscription tier, WABA ID status, view-as shortcut, and suspension action.
- `[x]` `W1` **Platform Staff List** (`/users`) — Platform staff team members list and role assignment.
- `[x]` `W1` **Roles & Menus** (`/roles`, `/roles/:roleId`) — Platform roles list and permission capability matrix.
- `[x]` `W1` **Planned Stubs** (`/plans`, `/subscriptions`, `/meta-config`, `/health`, `/analytics`, `/announcements`, `/audit`) — Route stubs with `PlannedState` placeholders. (W4 replaced the first four with real modules; the entry originally listed `/config`, which never existed as a route.)
- `[x]` `W4` **Onboard Client Wizard** (`/clients/new`) — 3-step wizard (business → subdomain + tier → admin + review). Validates subdomain shape + uniqueness, previews the workspace URL and tier limits, provisions the tenant on trial and creates its admin. Fixes the dead `Onboard client` button on the Clients list.
- `[x]` `W4` **Client Detail View** (`/clients/:clientId`, `?tab=`) — Overview facts, Seats (staff table + online count), WhatsApp (WABA status + recent deliveries), Subscription (tier move with confirm, limits-vs-usage meters, tenant invoices), History (subscription trail + provisioned/connected milestones timeline). Suspend/reactivate with confirm, dev `Open workspace` shortcut.
- `[x]` `W4` **Plans Management** (`/plans`, `/plans/edit`) — Tier overview cards (limits, module count, workspaces on tier, Custom pricing) plus the limits editor: tier tabs, per-dimension number-or-Unlimited rows, saved to the live plan records.
- `[x]` `W4` **Feature Matrix** (`/plans/matrix`) — Module × tier checkbox matrix writing straight to `MockDataService.plans`, which `PermissionService.planModules` reads — tier edits re-gate client sidebars without a reload (pinned by spec).
- `[x]` `W4` **Subscriptions** (`/subscriptions`, `/subscriptions/log`) — Per-tenant current state derived from the event trail (suspension overrides billing) with summary metrics, plus the full newest-first transition log.
- `[x]` `W4` **Invoices List** (`/invoices`) — New menu key + sidebar entry. Status filter chips, outstanding/overdue/collected totals, per-row link into the client subscription tab.
- `[x]` `W4` **Meta App Configuration** (`/meta-config`) — App ID, secret (masked + reveal), API version, callback URL + verify token (copy + rotate), test number, save stamp, and the connected-numbers-per-workspace list. (Ledger originally wrote `/config`; the route has always been `/meta-config`.)
- `[x]` `W4` **Queue Health Monitor** (`/health/monitor`, `/health` redirects) — Ack p50/p95/max, dead-letter + backlog metrics, latency distribution bars, outcome filter chips, and failed-event acknowledgement back into the retry queue.
- `[ ]` `W6` **Announcements** (`/announcements/new`) — System-wide operational broadcast announcements.
- `[x]` `W5` **Platform Audit Log** (`/audit`) — Global administrative action audit log.
  » Built: `admin/audit/` (`PLATFORM_AUDIT_ROUTES`, `audit.view`). Metric grid (total / critical / actors / tenants), area + severity chips and an impersonation-only toggle over the whole trail, workspace column linking into `/clients/:id` (null tenant renders a "Platform" badge), severity pills, CSV export `bugconnect-platform-audit`.
- `[x]` `W5` **Platform Settings** (`/settings`) — System configuration and domain settings.
  » Built: `admin/settings/` (`PLATFORM_SETTINGS_ROUTES`, `platform.configure` edit). Identity, domain (apex / tenant suffix / admin subdomain), onboarding (default tier, trial days, session timeout) and switches (self-service signup, WhatsApp self-connect, maintenance mode); `validate()` gates save, the record stamps `updatedBy`, every save writes an audit row and the page links into `/audit`.

### Client Tenant Module — `nazeel.localhost:4200` (32 Pages)
- `[x]` `W1` **Client Dashboard** (`/`) — Workspace KPIs (Unassigned, With Agent, In Automation, Capacity), Needs Attention list, Available Modules directory.
- `[x]` `W1` **Users List** (`/users`) — Workspace staff members data table, online presence, active chat load, role badge, remove action.
- `[x]` `W1` **User Create/Edit Form** (`/users/new`, `/users/:id/edit`) — Staff member form (fullName, email, role, department, activeChatCapacity).
- `[x]` `W1` **Roles List** (`/roles`) — Tenant role list, system role badge, member count.
- `[x]` `W1` **Role Menu Matrix** (`/roles/:roleId`) — Interactive permission matrix mapping roles to menu keys and capability levels.
- `[x]` `W1` **Planned Stubs** (`/inbox`, `/contacts`, `/flows`, `/templates`, `/campaigns`, `/reports`, `/teams`, `/replies`, `/settings`, `/developer`, `/billing`, `/audit`) — Route stubs with `PlannedState` placeholders.
- `[x]` `W2` **Team Inbox Queue** (`/inbox`) — Split-pane conversation list (`Unassigned`, `Mine`, `Open`, `Resolved`). Implemented as `InboxShellComponent` with search, tab counts, avatar initials, unread badge, priority badge, status pill, time.
- `[x]` `W2` **Active Conversation View** (`/inbox/:conversationId`) — Message thread (inbound surface / outbound brand gradient / whisper amber dashed), agent response bar with character counter, internal note toggle (🔒), Enter send, Resolve/Re-open, Assign agent, Set priority. Delivery tick icons (✓ sent, ✓✓ delivered/read, ✗ failed). Simulate inbound (+) button triggers `MockDataService.simulateInboundMessage()` with weighted agent router.
- `[x]` `W2` **Meta Cloud API Send Support** — Every message object is sendable from one composer: `text`, `template` (approved only, `{{n}}` variables resolved live), `interactive` (quick replies, CTA, list picker, Flow), `image`, `video`, `audio`, `voice`, `document`, `sticker` (static **and animated**), `location`, `contacts`, `reaction`, plus internal notes. `AttachmentService` stages files with previews and enforces `META_LIMITS` before staging.
- `[x]` `W2` **Fixed-Pane Inbox Layout** — Shell is one viewport tall (`height: 100dvh; overflow: hidden`); the queue, the thread and the customer panel each scroll independently with `overscroll-behavior: contain`; the composer is pinned to the bottom. Component hosts (`app-inbox-shell`, `app-conversation-detail-page`, `app-inbox-empty`) join the flex chain and every link sets `min-height: 0`. Below 900px the queue and thread swap instead of stacking.
- `[x]` `W2` **Thread Ergonomics** — Day separators, conversation-start line, quote-reply context, hover reaction picker, reaction chips, jump-to-latest FAB with unread count, image lightbox, drag-and-drop attachments, slash shortcuts (`/hi`, `/hours`, …), emoji panel, sticker packs, optimistic sent → delivered → read lifecycle.
- `[x]` `W3` **Contact Hub Directory** (`/contacts`) — Implement `<app-data-table>` with `MockDataService.contacts()`. Needs server-side pagination simulation, tag filtering UI, and an opt-out badge column.
  » Built: `client/contacts/contacts-page` on `<app-data-table>` over `listContacts()`, tag filter chips, opt-in/opt-out status pill column, summary metrics, `contacts.view` guard, `styles/pages/contacts.css`. Browser-verified (tag filter, metrics add up). Rows now activate into `/contacts/:id`. **Still open:** server-side pagination simulation (deferred — datasets <100 rows, `Page<T>` already models it); opt-out uses `Contact.optInStatus` (inverse), not an `optOut` field as originally written.
- `[x]` `W3` **Contact Detail View** (`/contacts/:contactId`) — Split layout: left profile pane (identity, opt-in toggle, tag editor, custom-attribute editor), right timeline (newest-first threads linking into the inbox). Not-found state for unknown ids.
- `[x]` `W3` **Contact Segments** (`/contacts/segments`) — Saved audiences with an AND/OR rule builder (tag, opt-in, conversations, name, inactivity) evaluated live via `evaluateSegment()`, with match preview before saving.
- `[x]` `W3` **Opt-Out List** (`/contacts/opt-outs`) — Data table of opted-out contacts (`!optInStatus`) with one-click resubscribe and a manual Meta sync stamp.
- `[x]` `W3` **Template Manager** (`/templates`) — Category tabs, language badge, status pills, approval counts, and draft submission straight from the list.
- `[x]` `W3` **Template Editor** (`/templates/new`, `/templates/:templateId`) — Header (text/media), body with sequential-`{{n}}` validation + sample values, footer, buttons (quick reply / URL), live phone preview. Drafts editable; anything Meta has seen renders locked. (Template-driven per codebase convention, not reactive as first written.)
- `[x]` `W3` **Teams & Departments** (`/teams`) — CRUD routing groups with member picker, 1–10 round-robin weights shown as shares, and a single-default invariant (deleting the default promotes the next team).
- `[x]` `W3` **Quick Replies** (`/quick-replies`) — CRUD for `/` triggers with uniqueness validation. The inbox composer reads these same rows, so page edits appear in slash matching immediately.
  » Route is `/quick-replies` (menu-catalog and client.routes), not `/replies` as first written.
- `[x]` `W3` **Business Settings** (`/settings/business`) — Business identity, 7-day operating-hours grid, greeting and out-of-hours auto-responder. (Template-driven per codebase convention; no logo upload — dummy layer has no asset store.)
- `[x]` `W4` **WhatsApp Settings** (`/settings/whatsapp`) — WABA status card (IDs, customer-facing number, connected date, recent failures), last-5 sync health list, and `Connect via Meta` (needs `settings.manage`) simulating the Embedded Signup handoff. New `client/settings/settings.routes.ts`; `/settings` home stays a stub for W3's business profile.
- `[x]` `W4` **WhatsApp Callback Handler** (`/settings/whatsapp/callback`) — Parses `?code=&state=`, exchanges the code via `MockDataService.connectWaba()` (stamps WABA IDs, sets `connectedAt`, flips pending workspaces to active, appends the trial→active subscription event), with explicit failed states for missing codes and unresolved hosts.
- `[x]` `W5` **Workspace Billing** (`/billing`) — Display current tier limits vs usage (e.g., active seats, monthly campaigns). Stripe checkout simulation for upgrades.
  » Built: `client/billing/` (`BILLING_ROUTES`, `billing.view`). Metric row, tier cards with the current one flagged and every other tier open to a simulated Stripe checkout sheet (confirms → `changeTenantTier()`, writes a billing audit row), usage-vs-limits meters from `planUsage()`, and the tenant invoice table with client-side download. Prices stay `null` in the seed, so the UI reads "Custom pricing".
- `[x]` `W5` **Workspace Audit Log** (`/audit`) — Simple chronological table of `MockDataService.auditEvents()` filtered by `tenantId`.
  » Built: `client/audit/` (`AUDIT_ROUTES`, `audit.view`). Area and severity filters plus summary metrics over `auditForTenant()`, newest-first, with the acting member and target for every row.
- `[x]` `W6` **Flow Builder List** (`/flows`) — Table of saved flows. Columns: Name, Trigger, Status (Draft, Live), Last Edited.
  » Built: `client/flows/flows-page` + `flows.routes.ts` (new module, `flows.view`; the stub in `later.routes.ts` is gone and the menu flag is cleared). Metric row (saved / live / sessions 30d / avg handoff), rows over `MockDataService.flows()` with graph size and routing rule in the name cell, Live/Draft pills, per-row Canvas · Simulate · Versions actions and a confirm-gated live↔draft toggle for `flows.manage`. Rows activate into the canvas.
- `[x]` `W6` **Flow Visual Canvas** (`/flows/:id/edit`) — Drag-and-drop canvas (recommend checking if we can build a pure HTML/SVG custom visualizer or a tree-based builder) with Node property side-panel.
  » Built: `client/flows/flow-canvas-page`. Chose the **pure HTML/SVG visualiser**: node cards are DOM positioned from their saved coordinates and one SVG layer draws the connectors (solid per option, dashed for the automatic continuation), so no diagramming dependency and no direct DOM mutation. Palette adds any of the five node kinds, arrow nudges move a node by one grid step (Shift = four), the side panel edits title/message/condition/options/continuation, delete clears every reference. Publishing calls `saveFlowGraph()` → bumps `version`, appends a snapshot, writes a `flows` audit row; drafts discard back to the published graph.
- `[x]` `W6` **Flow Simulator** (`/flows/:id/simulate`) — Re-use `ConversationDetailPage` styles to render an interactive mock WhatsApp chat based on flow JSON.
  » Built: `client/flows/flow-simulator-page`. Phone frame reusing the inbox `.bubble` styles: the opening message renders server-side (no client-side seeding), the automatic continuation has a "Run the next step" control, options render as quick replies, choices walk the real connectors, the close node reports the handoff. Restart / replay-as-customer / back-a-step included; bubble times derive from the graph's own timestamp so SSR and hydration agree. Nothing is written back (spec-pinned).
- `[x]` `W6` **Flow Version History** (`/flows/:id/versions`) — Table of published commits for a flow.
  » Built: `client/flows/flow-versions-page`. Metric row (current / total / authors / nodes now) plus the publish log over `versionsFor()`, newest first, current version badged. Restore is confirm-gated and **append-only**: `restoreFlowVersion()` republishes the old nodes as a new version rather than rewriting the trail, and the notice names the version it came from.
- `[x]` `W6` **WhatsApp Flows List** (`/whatsapp-flows`) — Table for native Meta forms.
  » Built: `client/whatsapp-flows/whatsapp-flows-page` + `whatsapp-flows.routes.ts`. Metric row (forms / published / submissions 30d / avg completion) over a new `whatsappFlows` collection, three industry-shaped forms per tenant (appointment, lead capture, support) with per-row screens, components and the chat flow that sends each one. Publish / withdraw / archive / delete all run through one service write path with a `flows` audit row; publish re-runs the validator, so a document Meta would reject stays in draft and the row explains why.
  » New `whatsappFlows` menu key (Automation group, gated by `flows.view`) — sidebar label reads **WhatsApp Forms** so it is not confused with the chat Flow Builder; added to `CLIENT_ALL_MENUS`, Growth and the Supervisor role.
- `[x]` `W6` **WhatsApp Form Studio** (`/whatsapp-flows/new`, also `/whatsapp-flows/:id` to reopen a saved form) — Multi-screen form designer. Needs JSON schema generator mapped to Meta's flow JSON spec.
  » Built: `client/whatsapp-flows/whatsapp-form-studio-page`. Three panes — the routing model, the screen editor, and the document shown three ways (phone preview, generated JSON, publish check). Palette covers nine Meta components (`TextHeading`, `TextBody`, `TextInput`, `TextArea`, `Dropdown`, `RadioButtonsGroup`, `CheckboxGroup`, `DatePicker`, `OptIn`); screens and components reorder, retitling a screen renames its id and repoints every footer, deleting one rewires the routing so exactly one terminal survives.
  » `core/data/whatsapp-flows.ts` is the generator: `toFlowJson()` emits `version` / `routing_model` / `screens[].layout.type = SingleColumnLayout` with `data-source` choices and a `Footer` `on-click-action` of `navigate` or `complete` (payload `${form.x}` on the current screen, `${screen.<ID>.form.x}` from earlier ones). `validateFlow()` mirrors Meta's `validation_errors` — duplicate or lowercase ids, dangling navigation, two terminals, repeated data keys, choice lists under two options, a form that posts nothing. Copy and Download `.json` included.
- `[x]` `W6` **Campaign Manager List** (`/campaigns`) — Dashboard of recent campaigns, progress bars for delivery status.
  » Built: `client/campaigns/campaigns-page` + `campaigns.routes.ts`; the `later.routes.ts` stub is gone and `campaigns` no longer carries the `planned` flag. Metric row plus a per-row delivery bar built from the same counters the monitor polls, the audience segment and template named on each row, plan allowance in the header, and confirm-gated start/pause for `campaigns.manage`. A campaign with no approved template or an empty audience cannot start, and the disabled button says which.
- `[x]` `W6` **Campaign Broadcast Wizard** (`/campaigns/new`) — Multi-step wizard: 1. Select Segment, 2. Select Template, 3. Map Variables, 4. Schedule/Send.
  » Built: `client/campaigns/campaign-wizard-page`. Audience step evaluates the saved segment live (`evaluateSegment`), names the opted-out contacts it will skip and shows five real recipients; template step lists approved templates only with a phone preview; variables step maps each `{{n}}` to fixed text, contact name, phone or first tag and renders the body with the samples; schedule step checks the tier's monthly allowance before `createCampaign()`, then optionally hands the broadcast straight to the sender.
- `[x]` `W6` **Campaign Delivery Monitor** (`/campaigns/:id`) — Real-time metrics dashboard (Sent, Delivered, Read, Failed) using a simulated WebSocket or interval polling on mock data.
  » Built: `client/campaigns/campaign-monitor-page`. Interval polling (the ledger's second option): every 2.5 s the page calls `tickCampaign()`, which advances the counters by one paced batch and appends a `CampaignSample`, so the CSS bar chart is a real time series rather than four static numbers. Browser-only, cleared on destroy, and pausable by the operator. Six metric cards, rates measured against the step before them, the template as it went out, and the audit trail this broadcast produced.
- `[ ]` `W6` **Analytics & Reports** (`/reports`) — Chart components (implement using basic CSS/SVG or evaluate minimal charting lib). KPIs: resolution time, flow completion.
- `[ ]` `W6` **Developer Hub** (`/developer`) — Form to generate API Key, input for webhook URL, and `<pre><code>` block for Postman snippet download.

---

## 📜 History & Updates Log

### 2026-10-11 — W1–W5 integrity re-check, then Wave 6 continues: WhatsApp Flows + Campaign Manager (9 of 12)
- **Verification first, as asked.** `npx ng test --watch=false` → **307/307 across 75 files** on the pre-existing tree. `npx ng build` → clean production bundle (initial 159 kB CSS + ~330 kB JS, 95 kB estimated transfer, budgets pass) with one environment caveat: Angular's font inliner fetches `fonts.googleapis.com`, which this sandbox blocks, so the production run sets `optimization.fonts: false` and nothing else — `angular.json` is reverted afterwards and the repo copy is untouched. SSR-rendered every completed route on `nazeel.localhost`, `admin.localhost` and the marketing host; all 200 with real seeded content, and `/clients` on a client host and `/inbox` on the platform host still 302 to `/`, so host isolation holds.
- **WhatsApp Flows module (2 pages).** `WhatsAppFlowForm`/`WaFormScreen`/`WaFormField` entities plus a `whatsappFlows` collection: three industry-shaped forms per tenant (appointment, lead capture, support) hydrated from blueprints on a private stream (`SEED + 5000 + index`), published only where the WABA is connected, so no existing tenant's draws shift. `core/data/whatsapp-flows.ts` owns the model → flow JSON mapping (spec version 7.3, `routing_model`, `SingleColumnLayout`, `data-source`, `Footer.on-click-action` navigate/complete) and the publish validation. Service: `listWhatsAppFlows`, `waFlowById`, `linkedFlowFor`, `saveWhatsAppFlow`, `setWaFormStatus` (refuses with Meta's own reason), `deleteWhatsAppFlow` (drafts only), each audited under `flows`.
- **Campaign Manager module (3 pages).** `Campaign` gained `failed`, `templateId`, `segmentId`, `createdBy` and `createdAt`, and a new `campaignSamples` collection holds the delivery series — both filled by post-processing on `SEED + 6000 + index`, so the seeded counters keep their exact values and each series ends precisely on them. Service: `campaignById`, `segmentFor`, `templateFor`, `samplesFor`, `campaignMetrics`, `createCampaign`, `scheduleCampaign`, `startCampaign`, `pauseCampaign`, `tickCampaign` (one paced batch + one sample, completes at the audience size, audited). The monitor polls that tick every 2.5 s in the browser only and clears the interval on destroy; watching is a view action, starting and pausing need `campaigns.manage`.
- **Routing and menu.** New `whatsapp-flows.routes.ts` and `campaigns/campaigns.routes.ts`; the campaign stub left `later.routes.ts` (reports and developer remain) and `campaigns` lost its `planned` flag. New `whatsappFlows` menu key in the Automation group → `flows.view`, added to `CLIENT_ALL_MENUS`, the Growth plan and the Supervisor role.
- **Styling.** New `styles/pages/growth.css` (delivery chart, legend) and a `waform-*` block in `automation.css` (studio grid, screen rail, palette, component cards, preview controls, JSON pane), folding at 70rem / 60rem / 40rem. `wave6-styling.spec.ts` now covers all nine wave-6 templates.
- **Verification after.** `npx ng test --watch=false` → **376/376 across 83 files** (was 307/75). New specs: `whatsapp-flows.spec.ts` (generator + validator, 17 cases), `mock-data.whatsapp-flows.spec.ts` (seeding, publish gate, archive, delete), `mock-data.campaigns.spec.ts` (wiring, series monotonicity, tick/pause/reschedule), and page specs for all five screens — including the two bugs they caught and fixed: `addScreen()` left a form with no terminal screen, and a renamed component kept its generated data key. Production build clean with the five new lazy chunks; SSR re-rendered every wave-6 route plus the not-found states.
- **W6 remaining (3):** `/reports`, `/developer` and the platform `/announcements/new`.

### 2026-10-11 — Wave 6 started: Flow Builder module shipped (4 of 12 pages)
- Built the whole Flow Builder: `/flows` list, `/flows/:id/edit` canvas, `/flows/:id/simulate` simulator and `/flows/:id/versions` history, behind `flows.view` / `flows.manage`. New `client/flows/flows.routes.ts`; the flow stub left `later.routes.ts`, and `flows` no longer carries the `planned` flag in the menu catalogue.
- Data layer: `FlowNodeKind`/`FlowOption`/`FlowNode`/`FlowGraph`/`FlowVersion` entities and two new collections. Each flow gets a five-node graph (inbound trigger → interactive menu → selection → weighted router → close) with an automatic-continuation pointer per node alongside the option edges, plus one published snapshot per version — all post-processed on a private RNG (`SEED + 4000 + flow`), so every existing tenant seed keeps its exact draws. Service: `flowById`, `graphFor`, `versionsFor`, `listFlowVersions`, and the write path `saveFlowGraph` / `setFlowActive` / `restoreFlowVersion`, each with a `flows` audit row. `AuditArea` gained `flows`, `campaigns` and `developer`.
- Canvas decision: the ledger asked whether to build a pure HTML/SVG visualiser or a tree builder — HTML/SVG won, because node cards keep their text, focus order and edit-in-place fields, and only the connectors belong in SVG. Positioning is keyboard nudges rather than pointer drag (the repo forbids direct DOM manipulation), which also keeps the canvas usable without a mouse.
- Styling: new `styles/pages/automation.css` (canvas surface, node kind accents, wires incl. the dashed auto edge, properties panel, publish block, phone frame and quick replies), imported after `auth.css`; folds to one column at 60rem and to a stacked option editor at 40rem.
- Verification: `npx ng build` clean; **307/307 tests across 75 files** (was 277/277). New coverage: `mock-data.flows.spec.ts` (graph wiring per flow, tenant isolation, one snapshot per version with the newest matching the canvas, publish/audit, live↔draft, rollback-is-append-only, unknown ids), page specs for all four screens (publish from the canvas, grid nudges, reference cleanup on delete, simulator walk incl. "never writes to the workspace", restore flow) and `wave6-styling.spec.ts`.
- Render: SSR-verified `/flows` (rows, metrics, triggers), the canvas (all five node labels), the simulator (opening bubble + "Run the next step") and the history (snapshots, Current badge) on `nazeel.localhost`, plus the not-found state on an unknown id; `/audit`, `/billing`, client `/`, platform `/clients` and platform `/audit` stayed green.
- W6 remaining: WhatsApp Flows list + studio, the three campaign screens, `/reports`, `/developer` and the platform `/announcements/new`.

### 2026-10-11 — Wave 5 shipped (Lifecycle & Self-Service) + W1–W5 integrity pass
- Built all 7 W5 ledger pages plus the roadmap's extra surface: `/forgot-password`, `/reset-password`, `/accept-invite` (shared across hosts), admin `/audit`, admin `/settings`, client `/billing`, client `/audit`, and the `/suspended` lock screen from ARCHITECTURE §6. Ledger row counts W5 as 7 pages; the suspended state is the 8th route and is tracked here, not renumbered.
- Data layer: `AuditEvent`/`InviteToken`/`PasswordResetToken`/`PlatformSettings` entities; a single `recordAudit()` write path (id `audit-<ts36>-<seq>`, oldest-first storage, `auditLog` newest-first, `auditForTenant()`, `platformAudit()`); 32 seeded tenant rows + 7 platform rows on private RNG streams (zero impact on the existing per-tenant streams); invites (14-day TTL, single-use, one pending seat per tenant) and reset requests (30-minute TTL, single-use); `currentPlan`/`planUsage`/`subscriptionState`/`tenantInvoices`/`suspensionReason` computeds; `platformSettings` + `savePlatformSettings()`. Roughly twenty mutations now write a row, including role/menu and platform-settings edits.
- Guards & routing: `tenantSuspendedGuard` wraps the client shell and `activeTenantGuard` keeps healthy workspaces out of `/suspended`; billing/audit/audit-platform/announcements stubs in `later.routes.ts` were replaced by real modules and the `planned` flags dropped from the menu catalogue. New `platformSettings` menu key → `platform.configure`; the platform-owner seed role holds it.
- W1–W4 integrity pass (the request that opened this wave): deleted 8 unreferenced component templates, an empty `demo-auth.ts` and a stray root script; removed the dead `PLANNED.inbox` / `INBOX_ROUTES` stub pair; replaced the `/settings` stub with a real directory page; added the fifth demo login (`developer`) and pointed "Forgot password" at the new self-service route; fixed digit-ending names seeding invalid addresses (`sangeetha.pillai.@…`) in `emailFor()`.
- Verification: `npx ng build` clean; **277/277 tests across 69 files** (was 236/236). New coverage: `mock-data.lifecycle.spec.ts` (audit seeding/isolation, actor attribution, single-use reset + invite tokens, expiry, usage vs collections, suspension trail, tier moves, platform-settings merge), page specs for billing, both audit pages, platform settings, suspended, the auth trio and the Users invite actions, plus `wave5-styling.spec.ts` (every wave-5 class resolves in the global tree; the fixed-width rows have ≤40rem rules).
- Render: SSR-verified every wave-5 route on both hosts (`/forgot-password`, `/reset-password?token=…`, `/accept-invite?token=…`, client `/billing`, client `/audit`, admin `/audit`, admin `/settings` all 200 with real seeded content, zero server errors). The suspended path was exercised end-to-end by temporarily seeding a suspended tenant: `/`, `/inbox`, `/billing` → 302 → `/suspended`, and `/suspended` renders the workspace name, the suspension reason and support contacts; healthy tenants still bounce off `/suspended` → `/`. The temporary seed was reverted before the final build.
- Still open (unchanged conventions): no real browser in this sandbox — the Desktop/Mobile bar is met with jsdom render specs, SSR content checks and the new styling contract; server-side pagination simulation remains deferred (datasets <100 rows, `Page<T>` already models it).

### 2026-10-10 — Wave 3 finished (Client Operations, remaining 8 pages)
- Built all 8 remaining W3 entries: contact detail, segments builder, opt-out list, template manager + editor, teams, quick replies, business settings. W3 is now 9/9 `[x]`.
- Data layer: `Team`/`QuickReply`/`ContactSegment`/`BusinessProfile` entities, zero-draw deterministic seeds per tenant, and `evaluateSegment`/`updateContact`/`saveTeam`/`saveQuickReply`/`saveSegment`/`saveBusinessProfile`/`saveTemplate`/`submitTemplate` on `MockDataService`, plus `contactById`/`conversationsForContact` lookups.
- Integrity fix: `Contact.conversationCount` was a decorative `rng.int(1, 9)` — reconciled from the conversations actually attached to each contact (pure post-processing, zero stream impact). The hub's "with conversations" metric and segment rules now read real numbers.
- Integrations: the inbox composer reads slash snippets from the managed quick-reply rows; directory rows activate into the detail page; `quickReplies` unmarked as planned; replaced stubs removed from `later.routes.ts`.
- Verified: `npx ng build` clean; **236/236 tests across 59 files** (was 192/192); SSR-rendered all new routes plus not-found/locked states with correct content, zero server errors.
- Still open (unchanged): server-side pagination simulation deferred; no browser-viewport pass in this environment (jsdom render specs + SSR content checks instead).

### 2026-10-10 — Wave 4 shipped (Platform Admin + WhatsApp connection)
- Built all 10 W4 entries: onboard wizard, client detail tabs, plans overview + limits editor + feature matrix, subscriptions overview + lifecycle log, invoices, Meta app config, queue health monitor, WhatsApp settings + OAuth callback.
- Data layer: `Plan`/`PlanLimits`/`SubscriptionEvent`/`Invoice`/`MetaAppConfig` entities, `Tenant.phoneNumber`, `plan.seed.ts`, subscription + invoice trails in `buildDataset()`, and `saveTenant` / `changeTenantTier` / `connectWaba` / `savePlanLimits` / `setPlanModule` / `saveMetaConfig` / `ackWebhookEvent` / cross-tenant readers on `MockDataService`.
- `PermissionService.planModules` now reads the live plan records, so matrix/tier edits re-gate sidebars immediately (spec-pinned). New `invoices` menu key; `subscriptions` unmarked as planned.
- W1–W3 fixes in the same pass: removed `console.log` spam from `PermissionService.can`; added the missing `role-developer` seed (developer logins previously failed open on menus, closed on routes); inbox queue now sorts unread-first then newest-first; `saveUser()` honors an explicit `tenantId`; added the missing `.form-control--invalid` style so form errors actually render; pinned seats 2–3 to developer/agent so every demo login resolves in every tenant.
- Determinism: new seeds consume zero shared-RNG calls for existing tenants (phone number derives from the WABA digits, invoices roll on a private stream), and the first template pins to `approved` so the composer's approved-only shelf can never be empty by chance.
- SSR actually wired: `angular.json` now emits `server/server.mjs` (`serve:ssr` worked for the first time), `server.ts` allowlists the multi-tenant hosts (Angular rejects them otherwise and silently falls back to CSR), and `permissionGuard` matches `authGuard`'s SSR-lenient behavior so signed-in users don't SSR as `/no-access`.
- Verified: `npx ng build` clean; **192/192 tests across 50 files** (was 132/132); SSR-rendered 20+ routes across marketing/client/platform hosts with correct content, host isolation intact, `?ws=` override working, zero server errors.
- Ledger corrections: W3 count 7→9, W4 count 9→10, `/config`→`/meta-config`, platform stub list synced to the real routes, developer demo credentials added.
- Still open (unchanged): W3's 8 unstarted pages; server-side pagination simulation deferred (datasets <100 rows — `Page<T>` already models server paging for when seeds scale); no browser-viewport pass in this environment (jsdom render specs + SSR content checks instead).

### 2026-10-10 — Wave 1 & 2 re-verified; Wave 3 started (Contact Hub Directory)
- Verified W1 and W2 against the ledger's own bar (build, unit tests, render):
  - `npx ng build` passes.
  - Unit tests: 1 failure in `permission.service.spec.ts` (`fails closed with no session at all`), now fixed. The spec cleared `sessionStorage` only, but the session persists to `localStorage` (`bugconnect-session-v2`), so a session from an earlier case leaked in. The `configure()` helper now clears both stores.
  - Suite: 127/127 before W3 work, 132/132 after.
  - Browser (Playwright on Chromium, signed in as `admin` on `nazeel.localhost`): every W1/W2 route renders with no console or page errors. A real thread (`/inbox/tenant-1-conv-1`) renders with its composer. `/inbox/conv-1` correctly shows "Conversation not found" (IDs are `tenant-N-conv-M`).
  - Not verified: the marketing and admin hosts were only checked over HTTP, not in a browser.
- Started W3 with the Contact Hub Directory: replaced the `CONTACTS_ROUTES` stub with `client/contacts/` (`contacts.routes.ts`, `contacts-page/`), added `styles/pages/contacts.css`, and added a spec.
- Known inconsistencies left for follow-up: W3 header says 7 pages but 9 entries are listed; `/replies` vs `/quick-replies`.

### 2026-10-09 — Global Styling System & UI Refresh
- Moved all styling out of components into the global stylesheet tree `src/styles/` (tokens → base → components → pages), imported in order from `src/styles.css`. Removed every `styleUrl`, inline `styles` block and component `.css` file, and the dead `app.css`.
- Redesigned the token set: calmer teal-tinted surfaces, a shape scale (`--radius-*`), layered elevation (`--theme-shadow-xs` → `-lg`), glass chrome, and a single focus treatment. Light and dark themes keep the same token names.
- Restyled shared primitives (buttons incl. ghost/danger, form controls, badges incl. neutral), the workspace shell (active-item accent bar, glass top bar, responsive rail), the data table, the login split layout, the site header, the inbox and chat bubbles, and metric cards.
- Fixed inbox styles that referenced undefined variables (`--surface-0`, `--text-secondary`, …) and hard-coded colours; both now resolve through tokens.
- Added `src/app/styles-convention.spec.ts` to keep component styles out of `src/app`.
- Known follow-ups: landing page still has a few duplicated selectors (`.faq-section`, `.faq-intro h2`, `.faq-item__toggle::after`) that need a visual check before merging; `permission.service.spec.ts` fails on the base commit too and is unrelated to styling.

### 2026-10-09 — Meta Cloud API message types & fixed-pane inbox layout
- Added `src/app/core/data/whatsapp.ts`: `WhatsAppMessageType`, the discriminated `MessagePayload`, `META_LIMITS` (Meta's published caps), `META_MIME_ACCEPT`, `renderTemplateBody()` and `payloadPreview()`. `Message` now carries `type` + `payload`; `content` stays a plain-text mirror so search, CSV export and previews are unchanged.
- Added `AttachmentService` (`src/app/core/data/attachment.service.ts`): stages files, reads intrinsic dimensions/duration, creates object URLs for previews, validates size and MIME type against Meta's limits and revokes URLs when a draft is dropped.
- Rewrote the composer as `message-composer/`: auto-growing textarea, attach menu (photo, video, document, audio, voice note), sticker panel (static + animated packs), emoji panel, template picker, interactive builder, location picker, contact builder, staging strip with per-file captions, reply context chip, slash shortcuts, internal-note mode and drag-and-drop.
- Added `dialogs/`: `template-picker-dialog` (approved templates only, live `{{n}}` preview), `interactive-builder-dialog` (quick replies / CTA / list / Flow with live preview), `location-picker-dialog`, `contact-picker-dialog`.
- Added `message-bubble/` with a render branch for every message object, and `contact-panel/` for the customer record beside the thread.
- `MockDataService`: added `sendOutbound()` (single write path for all types), `toggleReaction()`, `markRead()`, `sendableTemplates()`, and a simulated sent → delivered → read status webhook. `sendMessage()` is now a text-only wrapper.
- Seeded data now emits real Cloud API objects — photos, videos, voice notes, documents, stickers, locations, contact cards, templates with resolved variables, interactive lists and Flow responses — and threads span several days so day separators are exercised.
- Fixed the layout: the shell is one viewport tall, page scroll moved inside `.shell__main`, and the inbox opts out via `:has(.inbox-layout)`. Styles split into `inbox.css` (layout), `inbox-bubbles.css` (message objects) and `inbox-composer.css` (send bar), plus a shared `sheet.css` for the composer dialogs.
- `angular.json`: replaced the ineffective `"all"` entry with `".e2b.app"` so the Arena preview host is accepted by the Vite dev server.
- Tests: added `whatsapp.spec.ts`, `mock-data.inbox.spec.ts`, `message-bubble.spec.ts`, `message-composer.spec.ts` and `conversation-detail-page.spec.ts` (renders the whole thread against seeded data). Suite is 126 passing / 1 pre-existing failure (`permission.service.spec.ts` — fails on the base commit too).

### 2026-10-09 — Wave 2 Team Inbox Shipped
- Built full Team Inbox module: `InboxShellComponent` (queue pane) + `ConversationDetailPageComponent` (thread + composer) + `InboxEmptyComponent`.
- All components generated with `ng g c` — separate `.ts`, `.html`, `.css` files. No inline templates.
- **Files created**: `client/inbox/inbox.routes.ts`, `inbox-shell.{ts,html,css}`, `inbox-empty.{ts,html,css}`, `conversation-detail/conversation-detail-page.{ts,html,css}`.
- **Features**: Unassigned/Mine/Open/Resolved tabs with live counts, search filter, avatar initials, unread badge, status pill, priority badge, agent assignment, simulate inbound message with weighted router, send reply, send internal whisper note, resolve/re-open conversation, change priority.
- Added `MockDataService.updateConversationPriority()` to expose clean priority update API.
- Build verified clean: `npx ng build --configuration development` — 0 errors, inbox-shell and conversation-detail-page appear as lazy chunks.
- Tested in Chrome via MCP: login, navigate to `/inbox`, sent a reply, verified thread update.

### 2026-10-09 — Architecture Documentation & Technical Blueprint Added
- Created [ARCHITECTURE.md](file:///d:/Projects/BUGConnect/BUGConnect/ARCHITECTURE.md) detailing system topology, entity DDL schemas, subdomain resolution algorithms, security policies, and wave implementation specs.
- Rewrote [README.md](file:///d:/Projects/BUGConnect/BUGConnect/README.md) with comprehensive local setup instructions, hosts mapping, demo credentials, technology stack, directory structure, and testing standards.
- Expanded [TODO.md](file:///d:/Projects/BUGConnect/BUGConnect/TODO.md) into a complete 59-page inventory ledger with wave assignments, data schemas, and implementation guidance.
- Verified test suite: All **75 unit tests across 29 test files passed cleanly** (`npx ng test --watch=false`).

### 2026-10-09 — Brand Alignment to BUGConnect & UI/Responsiveness Fixes
- Standardized product branding to **BUGConnect** across `index.html`, `SiteHeader`, `AdminShell`, `ClientShell`, `LandingPage`, `LoginPage`, `subdomain.resolver.ts`, `workspace.model.ts`, `session.service.ts`, `mock-data.ts`, `styles.css`, and test specs.
- Configured credentials in `SessionService`: `systemadmin` (`admin@123`) on `admin.localhost` (Platform Owner scope) and `admin` (`admin@123`) on `nazeel.localhost` (Workspace Admin scope).
- Added `allowedHosts` entries to `angular.json` (`"localhost"`, `".localhost"`, `"admin.localhost"`, `"nazeel.localhost"`, `"127.0.0.1"`, `"all"`) to eliminate dev server host header errors.
- Fixed login page password toggle button layout (`.password-control`) and form header flex justification (`.form-field__heading`).
- Resolved mobile viewport grid/table truncation using `min-width: 0`, `max-width: 100%`, and `-webkit-overflow-scrolling: touch`.

### 2026-10-08 — Wave 1 Foundation Landed
- Built core workspace context resolver, session service, permission matrix, menu catalogue, deterministic mock data generator, DataTable component, shells, and initial route trees.