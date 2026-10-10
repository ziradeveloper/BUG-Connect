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
| **3** | **Client Operations**: Contacts hub, contact detail, segments, opt-outs, templates manager, teams, quick replies, settings | 9 | `[~]` |
| **4** | **Platform Admin**: Onboard client wizard, client detail tabs, plans feature matrix, subscriptions, invoices, Meta app config, webhook health monitor, WhatsApp connection | 10 | `[x]` |
| **5** | **Lifecycle & Self-Service**: Billing, audit logging, onboarding wizard, suspended state, password reset, invite acceptance | 7 | `[ ]` |
| **6** | **Advanced Automation**: Visual Flow Builder canvas, WhatsApp Flows form studio, Campaign broadcast wizard, Executive analytics | 12 | `[ ]` |

---

## 📋 Full Page Inventory (59 Pages) — Detailed Status Tracker

`W1..W6` = Wave assignment. `stub` = Route + empty state placeholder, proving navigation and permission enforcement.

### Shared & Entry Pages (8 Pages)
- `[x]` `W1` **Landing Page** (`/`) — Product overview, flow-first pipeline, RBAC matrix, industry use cases, pricing draft, FAQ.
- `[x]` `W1` **Sign In Page** (`/login`) — Host-aware authentication, demo accounts selector, show/hide password toggle, error validation.
- `[x]` `W1` **Profile Page** (`/profile`) — User identity, resolved host/source, granted capability chips, theme toggle, sign out.
- `[x]` `W1` **No Access Page** (`/no-access`) — Access denied error screen displaying required capability level.
- `[x]` `W1` **Not Found Page** (`/404`) — Host-aware 404 page with navigation fallbacks.
- `[ ]` `W5` **Forgot Password** (`/forgot-password`) — Self-service password recovery email request form.
- `[ ]` `W5` **Reset Password** (`/reset-password`) — Password reset token handler and form.
- `[ ]` `W5` **Accept Invite** (`/accept-invite`) — Team member invitation acceptance and initial password setup.

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
- `[ ]` `W5` **Platform Audit Log** (`/audit`) — Global administrative action audit log.
- `[ ]` `W5` **Platform Settings** (`/settings`) — System configuration and domain settings.

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
- `[~]` `W3` **Contact Hub Directory** (`/contacts`) — Implement `<app-data-table>` with `MockDataService.contacts()`. Needs server-side pagination simulation, tag filtering UI, and an opt-out badge column.
  » Built: `client/contacts/contacts-page` on `<app-data-table>` over `listContacts()`, tag filter chips, opt-in/opt-out status pill column, summary metrics, `contacts.view` guard, `styles/pages/contacts.css`. Browser-verified (tag filter, metrics add up). **Still open:** server-side pagination simulation (table pages client-side today); opt-out uses `Contact.optInStatus` (inverse), not an `optOut` field as originally written.
- `[ ]` `W3` **Contact Detail View** (`/contacts/:id`) — Create split layout: Left pane for customer profile/attributes, right pane for timeline (`ConversationHistoryComponent`). Include edit form for custom attributes.
- `[ ]` `W3` **Contact Segments** (`/contacts/segments`) — Builder UI using a reactive form array for `AND`/`OR` rules (e.g., `tag = VIP`, `lastOrder > 30 days`).
- `[ ]` `W3` **Opt-Out List** (`/contacts/opt-outs`) — Simple data table reflecting contacts where `optOut: true`, with manual sync button.
- `[ ]` `W3` **Template Manager** (`/templates`) — Card grid or table for Meta-approved templates. Must include category tabs (Marketing, Utility, Authentication) and language badge.
- `[ ]` `W3` **Template Editor** (`/templates/new`) — Complex reactive form: Header (Text/Media), Body (Variables mapping `{{1}}`), Footer, Buttons (Quick Reply / URL).
- `[ ]` `W3` **Teams & Departments** (`/teams`) — CRUD for routing groups. Assign users to teams, define weighting rules for round-robin assignment.
- `[ ]` `W3` **Quick Replies** (`/quick-replies`) — CRUD list for `/` commands used in `ConversationDetailPageComponent`.
  » Route is `/quick-replies` (menu-catalog and client.routes), not `/replies` as first written.
- `[ ]` `W3` **Business Settings** (`/settings/business`) — Reactive form for business profile (address, logo, default operating hours logic, auto-responder text).
- `[x]` `W4` **WhatsApp Settings** (`/settings/whatsapp`) — WABA status card (IDs, customer-facing number, connected date, recent failures), last-5 sync health list, and `Connect via Meta` (needs `settings.manage`) simulating the Embedded Signup handoff. New `client/settings/settings.routes.ts`; `/settings` home stays a stub for W3's business profile.
- `[x]` `W4` **WhatsApp Callback Handler** (`/settings/whatsapp/callback`) — Parses `?code=&state=`, exchanges the code via `MockDataService.connectWaba()` (stamps WABA IDs, sets `connectedAt`, flips pending workspaces to active, appends the trial→active subscription event), with explicit failed states for missing codes and unresolved hosts.
- `[ ]` `W5` **Workspace Billing** (`/billing`) — Display current tier limits vs usage (e.g., active seats, monthly campaigns). Stripe checkout simulation for upgrades.
- `[ ]` `W5` **Workspace Audit Log** (`/audit`) — Simple chronological table of `MockDataService.auditEvents()` filtered by `tenantId`.
- `[ ]` `W6` **Flow Builder List** (`/flows`) — Table of saved flows. Columns: Name, Trigger, Status (Draft, Live), Last Edited.
- `[ ]` `W6` **Flow Visual Canvas** (`/flows/:id/edit`) — Drag-and-drop canvas (recommend checking if we can build a pure HTML/SVG custom visualizer or a tree-based builder) with Node property side-panel.
- `[ ]` `W6` **Flow Simulator** (`/flows/:id/simulate`) — Re-use `ConversationDetailPage` styles to render an interactive mock WhatsApp chat based on flow JSON.
- `[ ]` `W6` **Flow Version History** (`/flows/:id/versions`) — Table of published commits for a flow.
- `[ ]` `W6` **WhatsApp Flows List** (`/whatsapp-flows`) — Table for native Meta forms.
- `[ ]` `W6` **WhatsApp Form Studio** (`/whatsapp-flows/new`) — Multi-screen form designer. Needs JSON schema generator mapped to Meta's flow JSON spec.
- `[ ]` `W6` **Campaign Manager List** (`/campaigns`) — Dashboard of recent campaigns, progress bars for delivery status.
- `[ ]` `W6` **Campaign Broadcast Wizard** (`/campaigns/new`) — Multi-step wizard: 1. Select Segment, 2. Select Template, 3. Map Variables, 4. Schedule/Send.
- `[ ]` `W6` **Campaign Delivery Monitor** (`/campaigns/:id`) — Real-time metrics dashboard (Sent, Delivered, Read, Failed) using a simulated WebSocket or interval polling on mock data.
- `[ ]` `W6` **Analytics & Reports** (`/reports`) — Chart components (implement using basic CSS/SVG or evaluate minimal charting lib). KPIs: resolution time, flow completion.
- `[ ]` `W6` **Developer Hub** (`/developer`) — Form to generate API Key, input for webhook URL, and `<pre><code>` block for Postman snippet download.

---

## 📜 History & Updates Log

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