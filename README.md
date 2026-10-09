# BUGConnect — Multi-Tenant WhatsApp Business Workspace

**BUGConnect** is an enterprise-grade multi-tenant WhatsApp Business SaaS platform built with Angular 21 Standalone components, Signals, and Server-Side Rendering (SSR). It enables businesses to operate one official WhatsApp Business Account (WABA) across multiple team members, featuring flow-first automation, a real-time Team Inbox, visual form builders, template lifecycle management, outbound campaigns, and platform tenant administration.

> 📖 **Deep-Dive Technical Architecture**: For full entity schemas, subdomain resolution algorithms, security policies, and wave implementation specs, refer to [ARCHITECTURE.md](file:///d:/Projects/BUGConnect/BUGConnect/ARCHITECTURE.md).

---

## 🛠️ Quick Start & Developer Setup

### 1. Installation & Dependencies
Ensure Node.js (v20+ recommended) is installed. Install npm packages:
```bash
npm install
```

### 2. Development Server
Start the local Angular development server:
```bash
npx ng serve
```
The application will listen on `http://0.0.0.0:4200` / `http://localhost:4200`.

### 3. Local Subdomain Configuration
BUGConnect relies on subdomains to resolve tenant workspaces. Add the following entries to your operating system's `hosts` file (`C:\Windows\System32\drivers\etc\hosts` on Windows or `/etc/hosts` on Linux/macOS):

```text
127.0.0.1 admin.localhost
127.0.0.1 nazeel.localhost
127.0.0.1 nellai-sweets.localhost
127.0.0.1 scanwell.localhost
127.0.0.1 venkateswara.localhost
```

#### Routing Matrix:

| Browser URL | Resolved Environment | Scope & Description |
| :--- | :--- | :--- |
| `http://admin.localhost:4200/` | **Platform Console** | Platform administration, client tenant list, global health, staff management |
| `http://nazeel.localhost:4200/` | **Client Workspace** | Nazeel Silks & Bridal tenant workspace (Team Inbox, Users, Roles, Settings) |
| `http://localhost:4200/` | **Marketing & Landing** | Public marketing site, feature breakdown, pricing plans, public sign-in |

*💡 **Dev Workspace Override**: If testing in a single-port environment where subdomains are restricted, pass `?ws=nazeel` or `?ws=admin` in the URL. This sets `localStorage['bugconnect-dev-workspace']` to force a specific workspace context.*

---

## 💬 Team Inbox

The Team Inbox (`/inbox`) is a **fixed-height chat workspace**, not a scrolling page: the
shell owns exactly one viewport, the queue and the thread scroll independently, and the
composer is pinned to the bottom — the same contract WhatsApp Web uses.

| Pane | Behaviour |
| :--- | :--- |
| Queue (`Unassigned` / `Mine` / `Open` / `Resolved`) | Header and tabs pinned; only the conversation list scrolls |
| Thread | The only vertical scroller on the right; day separators, quote-replies, reactions, jump-to-latest |
| Composer | Fixed above the fold; grows to six rows, then scrolls |
| Customer panel | Optional third pane; overlays the thread below 1180px |

Below 900px the queue and the thread **swap** instead of stacking, so a phone shows one
surface at a time with a back button in the conversation header.

### Supported outbound message objects

Everything the agent can send maps 1:1 to a Meta WhatsApp Cloud API message object, and
every type flows through the single write path `MockDataService.sendOutbound()`:

| Object | Composer entry point | Meta limits enforced |
| :--- | :--- | :--- |
| `text` | Type and press Enter | 4096 chars |
| `template` | 📋 Template picker — approved templates only, `{{n}}` variables resolved live | Approved status, all variables filled |
| `interactive` | 🔘 Builder — quick replies, call-to-action, list picker, WhatsApp Flow | 3 buttons, 10 list rows, 20-char titles |
| `image` · `video` · `audio` · `voice` | Attach menu or drag-and-drop | 5 MB / 16 MB / 16 MB / 16 MB |
| `document` | Attach menu — any file type | 100 MB |
| `sticker` (static + **animated**) | Sticker panel, three packs | 100 KB static, 500 KB animated WebP |
| `location` | Location picker with saved branches | Coordinate range validation |
| `contacts` | Contact card builder | Digit-only phone validation |
| `reaction` | Hover any bubble → pick an emoji | Six-emoji quick set |
| Internal note | 🔒 Internal note mode | Never leaves the workspace |

Files are staged locally with live previews (`AttachmentService`), validated against
Meta's published limits, and rejected with a readable reason before anything is sent.

---

## 🔑 Demo Credentials

All demo accounts use the standard demo password: **`admin@123`**

| Access Point | Username | Password | Role Scope | Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| `admin.localhost:4200/login` | `systemadmin` | `admin@123` | **Platform Owner** | Full Platform Administration |
| `nazeel.localhost:4200/login` | `admin` | `admin@123` | **Workspace Admin** | Full Tenant Workspace Control |
| `nazeel.localhost:4200/login` | `supervisor` | `admin@123` | **Supervisor** | Team Inbox & Operations (No Billing) |
| `nazeel.localhost:4200/login` | `agent` | `admin@123` | **Support Agent** | Assigned Conversations & Contacts |

---

## 🧪 Testing & Quality Assurance

### Run Unit Tests
Execute the Vitest unit test suite:
```bash
npx ng test --watch=false
```
All unit tests must pass cleanly (currently **122 tests across 34 suites**; the single
`permission.service.spec.ts` failure predates this branch and is tracked in TODO.md).

### Production Build & Budget Check
Compile the production bundle and validate Angular build budgets:
```bash
npx ng build
```

---

## 🏗️ Architecture & Key Concepts Summary

1. **Subdomain Resolution (`src/app/core/workspace/`)**: Pure function `resolveWorkspace(host)` inspects the request host header in SSR context or `window.location` in browser context.
2. **Isolated Route Trees (`src/app/app.routes.ts`)**: Three `canMatch` guarded route branches (`adminGuard`, `clientGuard`, `marketingGuard`) isolate platform routes from tenant routes.
3. **Session & Auth (`src/app/core/auth/`)**: `SessionService` manages authentication, role attachment, scope enforcement, and `sessionStorage['bugconnect-session']` persistence.
4. **RBAC Authorization (`src/app/core/authorization/`)**: `PermissionService` maps roles → menus → capability levels (`none`, `view`, `edit`, `full`).
5. **Reusable Data Table (`src/app/shared/data-table/`)**: `<app-data-table>` handles sorting, filtering, pagination, selection, CSV export, and custom template cells via `*appCell="key"`.
6. **Mock Data Service (`src/app/core/data/`)**: Deterministic seeded RNG (`Rng`) provides mock tenants, users, contacts, conversations, flows, templates, and telemetry.
7. **WhatsApp message contract (`src/app/core/data/whatsapp.ts`)**: One discriminated `MessagePayload` per Cloud API object, plus Meta's published limits (`META_LIMITS`) and the `payloadPreview()` the queue renders.
8. **Fixed-pane inbox**: the shell is one viewport tall; `app-inbox-shell` / `app-conversation-detail-page` hosts join the flex chain so the thread is the only scroller.

---

## 📂 Project Directory Structure

```text
d:\Projects\BUGConnect\BUGConnect\
├── Documents/               # Product Requirements Documents (PRDs)
├── src/
│   ├── app/
│   │   ├── admin/           # Platform Admin Console pages (clients, staff, dashboard)
│   │   ├── client/          # Client Workspace pages (dashboard, users, roles, profile, inbox)
│   │   ├── core/
│   │   │   ├── auth/        # SessionService, scope enforcement, auth guards
│   │   │   ├── authorization/# PermissionService, role-capability matrix
│   │   │   ├── data/        # Entities, WhatsApp payload contract, RNG mock data, attachment staging
│   │   │   ├── navigation/  # Menu catalog definitions
│   │   │   └── workspace/   # Subdomain resolver & WorkspaceContext signal store
│   │   ├── layout/          # AdminShell, ClientShell, ShellFrame frame
│   │   ├── pages/           # LandingPage, LoginPage, ErrorPages (NoAccess, NotFound)
│   │   └── shared/          # DataTable component, SiteHeader, UI primitives
│   ├── styles.css           # Global stylesheet entry (imports src/styles/*)
│   ├── styles/              # ALL styling: tokens, base, components/, pages/
│   └── index.html           # Main HTML document
├── ARCHITECTURE.md          # Complete technical blueprint & wave specification
├── TODO.md                  # Detailed page-by-page progress & wave tracker
└── angular.json             # Angular CLI & Vite dev-server configuration
```