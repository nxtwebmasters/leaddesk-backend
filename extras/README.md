# LeadDesk — Engineering Operations & Leadership Platform

> **LeadDesk V3 Enterprise Edition** is a modern, unified Engineering Operations and Leadership Command Center designed specifically for Tech Leads, Engineering Managers, Directors, and VP/CTO leadership.

---

## 🚀 Quick Links & Documentation

* 📖 **[Comprehensive End-to-End User Guide](docs/user-guide.md):** Complete manual covering each of the 16 core modules, workflows, permissions, and keyboard shortcuts.
* 📋 **[V3 Enterprise Solution Plan & Execution Plan](solution-plan/mvp3-execution-plan.md):** Detailed breakdown of all 6 enterprise sprints (Multi-Tenancy, SAML/SCIM, Toolchain Mesh, DORA Engine, Merkle Audit/Compliance, and AI Vector RAG).
* 📐 **[Original System Architecture Blueprint](solution-plan/solution-plan.md):** Architectural specifications, database entity diagrams, and security models.

---

## ⚡ Quick Start (Local Docker Setup)

LeadDesk is containerized and runs with zero external cloud dependencies using Docker Compose.

```bash
# 1. Clone or navigate to the repository
cd leaddesk-skeleton-project

# 2. Start all services (PostgreSQL, Backend API, Frontend SPA)
docker compose up -d

# 3. View service status
docker compose ps
```

### Service Endpoints

| Service | Local URL | Port | Health / Status |
| :--- | :--- | :--- | :--- |
| **Frontend Web Application** | `http://localhost:4200` | `4200` | Angular 19 SPA |
| **Backend REST API** | `http://localhost:4000` | `4000` | Node.js / Express |
| **Backend Health Check** | `http://localhost:4000/api/v1/health` | `4000` | JSON Status Check |
| **PostgreSQL Database** | `localhost:5432` | `5432` | Relational & Vector DB |

### Default Credentials (Seed Administrator)
* **Email:** `lead@example.com`
* **Password:** `ChangeMeImmediately123!`

---

## 🏛️ Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LeadDesk Angular 19 SPA (Port 4200)                   │
│  Tailwind CSS • PrimeIcons • Signals Reactive State • Standalone Components  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ REST API (JSON / JWT / x-org-id)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    LeadDesk Node.js / Express Backend (Port 4000)           │
│ ┌──────────────────────┬──────────────────────┬───────────────────────────┐ │
│ │ Multi-Tenancy & RBAC │ Toolchain Event Mesh │ EngOps & DORA Engine      │ │
│ ├──────────────────────┼──────────────────────┼───────────────────────────┤ │
│ │ SAML 2.0 & SCIM Sync │ Merkle Audit Trail   │ AI Vector Decision RAG    │ │
│ └──────────────────────┴──────────────────────┴───────────────────────────┘ │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Prisma ORM (v5.22.0)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                  PostgreSQL 15 Container (Port 5432)                        │
│   Tenants • Workspaces • Squads • DORA Telemetry • AuditLogs • VectorEmbeds  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Core Modules & Feature Highlights

1. **Dashboard & "My Day" (`/dashboard`):** Focus time tracking, P0/P1 deliverables, and meeting schedule.
2. **Quick Inbox & Omni-Capture (`/inbox`):** Frictionless capture (`Q` key) and GTD triage into tasks, follow-ups, and notes.
3. **Tasks & Delegation Engine (`/tasks`):** Engineering task lifecycles (`P0`-`P3`), sprint assignments, and team delegation.
4. **Follow-up Tracker (`/followups`):** Bilateral accountability ("They owe me" vs. "I owe them") with reminder alerts.
5. **Team Directory & Dossiers (`/team`):** Engineer profiles, reporting lines, and private 1-on-1 notes.
6. **Squad Hierarchy & RBAC (`/team/hierarchy`):** Multi-tenant Org &rarr; Workspace &rarr; Squad hierarchy with visual org chart.
7. **Calendar Hub (`/calendar`):** Focus Wednesdays and meeting conflict protection.
8. **Meetings & Architecture Decisions (`/meetings`):** Structured meeting notes and Architecture Decision Records (ADRs).
9. **Weekly Digest (`/reports/weekly`):** Automated Friday summary of team accomplishments with Markdown export.
10. **Notes & Knowledge Base (`/notes`):** Markdown system designs, runbooks, and specifications.
11. **Toolchain Event Mesh (`/integrations`):** GitHub PR review latency watchdog, 2-way Jira sync, and Slack bots.
12. **EngOps & DORA Intelligence (`/engops`):** Real-time DORA 4 scorecard, DevEx burnout radar, and cascading team OKRs.
13. **Security, Merkle Audit & Compliance (`/compliance`):** Tamper-evident SHA-256 Merkle chain, retention policies, and GDPR erasure.
14. **AI Decision Intelligence & Vector Memory (`/ai-decision`):** 64-D semantic vector search, Architecture Decision RAG with citations, 1-on-1 Agenda Copilot, and Executive QBR generator.
15. **Enterprise Identity & Admin (`/settings/organization`):** Okta/Azure SAML 2.0 SSO, SCIM 2.0 automated provisioning, and tenant settings.

---

## ⌨️ Productivity Keyboard Shortcuts

* **`Ctrl + P` / `Cmd + K`**: Open Omni-Search Command Palette
* **`Q`**: Open Quick Capture Modal from anywhere
* **`Esc`**: Dismiss any open modal, drawer, or search overlay

---

## 📄 License & Intellectual Property

LeadDesk is proprietary software developed for high-performance engineering organizations.
