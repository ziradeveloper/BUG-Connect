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
All **75 unit tests across 29 test suites** must pass cleanly.

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

---

## 📂 Project Directory Structure

```text
d:\Projects\BUGConnect\BUGConnect\
├── Documents/               # Product Requirements Documents (PRDs)
├── src/
│   ├── app/
│   │   ├── admin/           # Platform Admin Console pages (clients, staff, dashboard)
│   │   ├── client/          # Client Workspace pages (dashboard, users, roles, profile)
│   │   ├── core/
│   │   │   ├── auth/        # SessionService, scope enforcement, auth guards
│   │   │   ├── authorization/# PermissionService, role-capability matrix
│   │   │   ├── data/        # Entity models, deterministic RNG mock data service
│   │   │   ├── navigation/  # Menu catalog definitions
│   │   │   └── workspace/   # Subdomain resolver & WorkspaceContext signal store
│   │   ├── layout/          # AdminShell, ClientShell, ShellFrame frame
│   │   ├── pages/           # LandingPage, LoginPage, ErrorPages (NoAccess, NotFound)
│   │   └── shared/          # DataTable component, SiteHeader, UI primitives
│   ├── styles.css           # Design tokens, global utilities, component styles
│   └── index.html           # Main HTML document
├── ARCHITECTURE.md          # Complete technical blueprint & wave specification
├── TODO.md                  # Detailed page-by-page progress & wave tracker
└── angular.json             # Angular CLI & Vite dev-server configuration
```