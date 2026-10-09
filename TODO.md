# BUGConnect — Build & Architecture TODO

Living log for the BUGConnect build. Newest entries on top. Nothing gets marked done unless it builds, tests, and renders.

**Legend:** `[x]` done · `[~]` in progress · `[ ]` todo · `[!]` blocked/decision needed · `»` detail

- **App Name:** BUGConnect (`BUG Connect`)
- **Repository / PR:** [ziradeveloper/BUG-Connect](https://github.com/ziradeveloper/BUG-Connect)
- **Stack:** Angular 21.2 Standalone + Signals, SSR (`@angular/ssr`), Tailwind v4 via PostCSS, Vitest runner (`@angular/build:unit-test`), Strict TypeScript
- **Data:** Deterministic mock data service (`MockDataService`) behind async interfaces.

---

## 🔑 Configured Demo Credentials & Credentials Mapping

| Environment / Subdomain | Target Scope | Username | Password | Resolved Role |
| :--- | :--- | :--- | :--- | :--- |
| `admin.localhost:4200` | **Platform Console** | `systemadmin` | `admin@123` | Platform Owner |
| `nazeel.localhost:4200` | **Client Workspace** | `admin` | `admin@123` | Workspace Admin |
| `nazeel.localhost:4200` | **Client Workspace** | `supervisor` | `admin@123` | Supervisor (No Billing/WhatsApp) |
| `nazeel.localhost:4200` | **Client Workspace** | `agent` | `admin@123` | Support Agent (Inbox & Contacts) |

---

## 🔒 Locked Architecture Decisions

| Topic | Decision | Why |
|---|---|---|
| Product Branding | **BUGConnect** (Logo: `BUG` + `Connect`) | Aligned project branding across header, footer, shells, titles, and storage keys |
| Modules | **2** — Admin Platform Console (`admin.localhost`) + Client Tenant Workspace (`<tenant>.localhost`) | Subdomain-isolated architecture matching multi-tenant requirements |
| Host Resolution | `resolveWorkspace(host, queryOverride, storedOverride)` in core | SSR-safe dynamic host resolution; fallback via `?ws=<slug>` & `localStorage['bugconnect-dev-workspace']` |
| Login Routing | Single `/login` page; scope inferred from resolved workspace host | Platform vs tenant scope handled cleanly with redirect |
| Table Component | Shared `<app-data-table>` without external libraries | Full control over accessibility (`aria-sort`), custom cell templates, sorting, pagination, search, and CSV export |
| Styling & UI | CSS Custom Properties design system in `src/styles.css` | High-aesthetic dark/light modes, micro-animations, glassmorphism, responsive mobile drawers, and horizontal scroll tables |
| SSR Configuration | `RenderMode.Server` for all routes (`app.routes.server.ts`) | Disables static prerendering to ensure host header dynamically resolves per request |

---

## 🌊 Waves & Progress

| Wave | Scope | Pages | Status |
|---|---|---|---|
| **1** | Foundation: workspace context, auth, login fixes, brand alignment, roles/menu CRUD, users CRUD, shells, DataTable, error routes | 12 | `[x]` |
| **2** | Team Inbox + conversation + dashboard (client) | 4 | `[ ]` |
| **3** | Client admin: contacts, templates, teams, quick replies, business settings | 7 | `[ ]` |
| **4** | Platform admin: dashboard, clients list/detail, plans, feature matrix, subscriptions, meta-config, health | 9 | `[ ]` |
| **5** | Wave 3 client leftovers: roles UI on client side, audit, billing, onboarding, suspended, reset-password, accept-invite | 7 | `[ ]` |
| **6** | Later modules as proven stubs: flows, campaigns, reports, developer, analytics | 12 | `[ ]` |

---

## 📋 Full Page Inventory (59) — Status Tracker

`W1..W6` = Wave. `stub` = Route + empty state only, proves navigation and permission enforcement.

### Shared / Entry
- `[x]` `W1` Landing page (`/`)
- `[x]` `W1` Login page (`/login`)
- `[x]` `W1` Profile page (`/profile`)
- `[x]` `W1` No access page (`/no-access`)
- `[x]` `W1` Not found page (`/404`)
- `[ ]` `W5` Forgot password (`/forgot-password`)
- `[ ]` `W5` Reset password (`/reset-password`)
- `[ ]` `W5` Accept invite (`/accept-invite`)
- `[ ]` `W4` Onboarding wizard (`/onboarding`)
- `[ ]` `W5` Suspended notice (`/suspended`)

### Platform Admin Module (`admin.localhost:4200`)
- `[x]` `W1` Admin dashboard (`/`)
- `[x]` `W1` Clients list (`/clients`)
- `[x]` `W1` Platform staff list (`/users`)
- `[x]` `W1` Roles & menus (`/roles`, `/roles/:roleId`)
- `[x]` `W1` Planned module stubs (`/plans`, `/subscriptions`, `/health`, `/announcements`, `/audit`, `/config`)
- `[ ]` `W4` Onboard client (`/clients/new`)
- `[ ]` `W4` Client detail with tabs (`/clients/:id`)

### Client Tenant Module (`nazeel.localhost:4200`)
- `[x]` `W1` Client dashboard (`/`)
- `[x]` `W1` Users list (`/users`)
- `[x]` `W1` User create/edit form (`/users/new`, `/users/:id/edit`)
- `[x]` `W1` Roles list (`/roles`)
- `[x]` `W1` Role menu matrix (`/roles/:roleId`)
- `[x]` `W1` Planned module stubs (`/inbox`, `/contacts`, `/flows`, `/templates`, `/campaigns`, `/reports`, `/teams`, `/replies`, `/settings`, `/developer`, `/billing`, `/audit`)

---

## 📜 History & Updates Log

### 2026-10-09 — Brand Alignment to BUGConnect, Authentication & UI/Responsiveness Fixes
- **Rebranding**: Standardized product branding to **BUGConnect** across `index.html`, `SiteHeader`, `AdminShell`, `ClientShell`, `LandingPage`, `LoginPage`, `subdomain.resolver.ts`, `workspace.model.ts`, `session.service.ts`, `mock-data.ts`, `styles.css`, and test specs.
- **Login Credentials & Resolution**: Fixed `SessionService` to allow `systemadmin` (`admin@123`) on `admin.localhost` (Platform Owner scope) and `admin` (`admin@123`) on `nazeel.localhost` (Workspace Admin scope).
- **Vite Dev Server Configuration**: Added `"localhost"`, `".localhost"`, `"admin.localhost"`, `"nazeel.localhost"`, `"127.0.0.1"`, `"all"` to `angular.json` `allowedHosts` to eliminate `Header "host" with value "localhost:4200" is not allowed` dev server errors.
- **Login UI Fixes**: Fixed password show/hide button positioning (`.password-control`), form label/link collisions (`.form-field__heading`), and redesigned demo account selectors into pill buttons.
- **Responsive Layout Fixes**: Fixed grid/table viewport overflow issues across Desktop, Tablet, and Mobile viewports using `min-width: 0`, `max-width: 100%`, and `-webkit-overflow-scrolling: touch`.
- **Testing Verification**: All **75 unit tests across 29 test files passed cleanly** (`npx ng test --watch=false`).

### 2026-10-08 — Wave 1 Foundation Landed
- Added core workspace resolver, session service, permission matrix, menu catalogue, deterministic mock data generator, DataTable component, shells, and initial route trees.