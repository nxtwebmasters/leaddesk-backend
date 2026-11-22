# LeadDesk V3 Enterprise — Platform Deployment, Toolchain Integrations & Operational User Manual

Welcome to the definitive operational manual for **LeadDesk V3 Enterprise**, the unified Engineering Operations and Leadership Command Center designed specifically for Tech Leads, Engineering Managers, Directors, and VP/CTO leadership.

This manual provides exhaustive documentation spanning:
1. **Application Deployment & Infrastructure Setup:** Prerequisites, Docker Compose configuration, complete environment variables, database management, and disaster recovery.
2. **Toolchain & Identity Integrations Setup:** Webhook configuration for GitHub, GitLab, Jira, Linear, Slack, Teams, and enterprise SAML 2.0 & SCIM 2.0 identity federation.
3. **Daily Operational Playbooks:** Hour-by-hour and weekly operating schedules for Tech Leads, Engineering Managers, and Directors.
4. **Deep-Dive Feature Reference (Modules 1–16):** Step-by-step operating procedures, inputs, outputs, permissions, and pro-tips for every module.
5. **Troubleshooting, Administration & FAQ:** Cryptographic Merkle chain audits, diagnostic runbooks, and power-user shortcuts.

---

# Table of Contents

- [Part I: Application Deployment & Infrastructure Setup](#part-i-application-deployment--infrastructure-setup)
  - [1.1 System Architecture & Container Topology](#11-system-architecture--container-topology)
  - [1.2 Local Docker Deployment (Step-by-Step)](#12-local-docker-deployment-step-by-step)
  - [1.3 Complete Environment Variables Reference (`.env`)](#13-complete-environment-variables-reference-env)
  - [1.4 Database Management & Prisma Schema Sync](#14-database-management--prisma-schema-sync)
  - [1.5 Production Deployment (NGINX Reverse Proxy & TLS/SSL)](#15-production-deployment-nginx-reverse-proxy--tlsssl)
  - [1.6 Backup, Disaster Recovery & Restore Procedures](#16-backup-disaster-recovery--restore-procedures)
- [Part II: Toolchain & Identity Integrations Setup](#part-ii-toolchain--identity-integrations-setup)
  - [2.1 GitHub & GitLab PR Watchdog Setup](#21-github--gitlab-pr-watchdog-setup)
  - [2.2 Jira Cloud & Linear 2-Way Issue Sync Setup](#22-jira-cloud--linear-2-way-issue-sync-setup)
  - [2.3 Slack & Microsoft Teams Apps & Capture Bot Setup](#23-slack--microsoft-teams-apps--capture-bot-setup)
  - [2.4 External Calendar Hub Sync (ICS & Webhooks)](#24-external-calendar-hub-sync-ics--webhooks)
  - [2.5 Okta SAML 2.0 Single Sign-On (SSO) Configuration](#25-okta-saml-20-single-sign-on-sso-configuration)
  - [2.6 Microsoft Entra ID (Azure AD) SAML 2.0 Configuration](#26-microsoft-entra-id-azure-ad-saml-20-configuration)
  - [2.7 Google Workspace SAML Configuration](#27-google-workspace-saml-configuration)
  - [2.8 SCIM 2.0 Automated User Directory Provisioning](#28-scim-20-automated-user-directory-provisioning)
- [Part III: Daily Operational Playbooks & Role Schedules](#part-iii-daily-operational-playbooks--role-schedules)
  - [3.1 Tech Lead: Daily Hour-by-Hour Operating Rhythm](#31-tech-lead-daily-hour-by-hour-operating-rhythm)
  - [3.2 Engineering Manager: Weekly Operational Playbook](#32-engineering-manager-weekly-operational-playbook)
  - [3.3 Director & VP / CTO: Quarterly Strategic Cadence](#33-director--vp--cto-quarterly-strategic-cadence)
  - [3.4 Compliance & Security Auditor Protocol](#34-compliance--security-auditor-protocol)
- [Part IV: Deep-Dive Feature Reference (All 16 Operational Modules)](#part-iv-deep-dive-feature-reference-all-16-operational-modules)
  - [Module 1: Dashboard / "My Day" (`/dashboard`)](#module-1-dashboard--my-day-dashboard)
  - [Module 2: Quick Inbox & Triage Hub (`/inbox`)](#module-2-quick-inbox--triage-hub-inbox)
  - [Module 3: Tasks & Delegation Engine (`/tasks`)](#module-3-tasks--delegation-engine-tasks)
  - [Module 4: Follow-up Tracker (`/followups`)](#module-4-follow-up-tracker-followups)
  - [Module 5: Team Directory & Contact Dossiers (`/team`)](#module-5-team-directory--contact-dossiers-team)
  - [Module 6: Organization & Squad Hierarchy (`/team/hierarchy`)](#module-6-organization--squad-hierarchy-teamhierarchy)
  - [Module 7: Calendar Hub & Focus Protection (`/calendar`)](#module-7-calendar-hub--focus-protection-calendar)
  - [Module 8: Meetings & Architecture Decisions (`/meetings`)](#module-8-meetings--architecture-decisions-meetings)
  - [Module 9: Weekly Digest & Executive Reporting (`/reports/weekly`)](#module-9-weekly-digest--executive-reporting-reportsweekly)
  - [Module 10: Notes & Knowledge Base (`/notes`)](#module-10-notes--knowledge-base-notes)
  - [Module 11: Toolchain Event Mesh & PR Watchdog (`/integrations`)](#module-11-toolchain-event-mesh--pr-watchdog-integrations)
  - [Module 12: Engineering Operations & DORA Metrics (`/engops`)](#module-12-engineering-operations--dora-metrics-engops)
  - [Module 13: DevEx & Burnout Radar (`/engops`)](#module-13-devex--burnout-radar-engops)
  - [Module 14: Cascading Team OKRs Engine (`/engops`)](#module-14-cascading-team-okrs-engine-engops)
  - [Module 15: Security, Merkle Audit & Compliance (`/compliance`)](#module-15-security-merkle-audit--compliance-compliance)
  - [Module 16: AI Decisions & Strategic Vector Memory (`/ai-decision`)](#module-16-ai-decisions--strategic-vector-memory-ai-decision)
- [Part V: Troubleshooting, Administration & FAQ](#part-v-troubleshooting-administration--faq)
  - [5.1 Diagnostic Runbook & Health Checks](#51-diagnostic-runbook--health-checks)
  - [5.2 Merkle Integrity Audit & Breach Resolution](#52-merkle-integrity-audit--breach-resolution)
  - [5.3 Frequently Asked Questions (FAQ)](#53-frequently-asked-questions-faq)
  - [5.4 Power-User Keyboard Accelerators Reference](#54-power-user-keyboard-accelerators-reference)

---

# Part I: Application Deployment & Infrastructure Setup

## 1.1 System Architecture & Container Topology

LeadDesk V3 Enterprise runs as a distributed multi-tier containerized stack:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LeadDesk Angular 19 SPA (Port 4200)                   │
│   Tailwind CSS • PrimeIcons • Angular Signals • Standalone Architecture     │
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

* **Network:** Internal bridge network `leaddesk-network`.
* **Data Storage:** Persistent Docker volumes `postgres_data` and `backend_uploads`.

---

## 1.2 Local Docker Deployment (Step-by-Step)

### Prerequisites
* Docker Desktop 24.0+ or Docker Engine with Docker Compose v2.
* Node.js 20+ (optional, only needed for local CLI development).
* Git 2.30+.

### Step-by-Step Launch
1. Clone or navigate to the project directory:
   ```bash
   cd d:\personal-project-repos\lead-desk\leaddesk-skeleton-project
   ```
2. Verify or create your environment file `.env` in `leaddesk-skeleton-project/`:
   ```bash
   cp .env.example .env   # On Windows: copy .env.example .env
   ```
3. Launch all containers in detached mode:
   ```bash
   docker compose up -d
   ```
4. Confirm service health:
   ```bash
   docker compose ps
   ```
   All three containers (`leaddesk-postgres`, `leaddesk-backend`, and `leaddesk-frontend`) should display `running` and `healthy`.
5. Access the application in your browser:
   * **Web Application:** `http://localhost:4200`
   * **API Health Check:** `http://localhost:4000/api/v1/health`

---

## 1.3 Complete Environment Variables Reference (`.env`)

Configure the backend and database behavior using the following environment variables:

| Variable | Type | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | String | `development` | Runtime environment (`development`, `production`, `test`) |
| `BACKEND_PORT` | Number | `4000` | Port on which the Express REST API listens |
| `FRONTEND_PORT` | Number | `4200` | Port mapped to NGINX serving the Angular SPA |
| `DB_USER` | String | `leaddesk` | PostgreSQL database username |
| `DB_PASSWORD` | String | `leaddesk_secret` | PostgreSQL database password |
| `DB_NAME` | String | `leaddesk_dev` | PostgreSQL database schema name |
| `DB_PORT` | Number | `5432` | Exposed PostgreSQL host port |
| `DATABASE_URL` | String | `postgresql://leaddesk:leaddesk_secret@postgres:5432/leaddesk_dev?schema=public` | Prisma database connection string |
| `JWT_ACCESS_SECRET` | String | *(32+ char secret)* | Secret key used to sign short-lived access JWTs |
| `JWT_REFRESH_SECRET`| String | *(32+ char secret)* | Secret key used to sign long-lived refresh JWTs |
| `JWT_ACCESS_EXPIRY` | String | `15m` | Access token lifespan (e.g., `15m`, `1h`) |
| `JWT_REFRESH_EXPIRY`| String | `30d` | Refresh token lifespan (e.g., `30d`, `90d`) |
| `INITIAL_OWNER_EMAIL`| String| `lead@example.com` | Default seed administrator account email |
| `INITIAL_OWNER_PASSWORD`| String| `ChangeMeImmediately123!` | Default seed administrator password |
| `INITIAL_OWNER_NAME`| String| `Team Lead` | Default administrator display name |
| `INITIAL_OWNER_TIMEZONE`| String| `Asia/Karachi` | Default administrator timezone |
| `CORS_ORIGIN` | String | `http://localhost:4200` | Allowed origin for frontend requests |
| `STORAGE_DRIVER` | String | `local` | Upload storage driver (`local`, `s3`) |
| `STORAGE_LOCAL_PATH`| String| `/app/uploads` | Path to store file attachments inside container |

---

## 1.4 Database Management & Prisma Schema Sync

LeadDesk uses **Prisma ORM** to manage PostgreSQL migrations and database schemas.

### Applying Schema Changes
When the database schema in `prisma/schema.prisma` is updated, apply changes directly to the database:
```bash
# Push schema changes to the running database
npx prisma db push

# Re-generate the TypeScript Prisma client locally
npx prisma generate

# Re-generate the client inside the active Docker container
docker exec leaddesk-backend npx prisma generate
```

### Resetting & Re-Seeding the Database
To reset the development database to a clean seed state:
```bash
cd leaddesk-backend
npx prisma db push --force-reset
npm run seed
```

---

## 1.5 Production Deployment (NGINX Reverse Proxy & TLS/SSL)

In production environments, LeadDesk should run behind an NGINX reverse proxy with TLS/SSL encryption.

### Production NGINX Configuration Recipe
```nginx
server {
    listen 80;
    server_name leaddesk.yourcompany.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name leaddesk.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/leaddesk.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/leaddesk.yourcompany.com/privkey.pem;

    # Angular Frontend Single Page Application
    location / {
        proxy_pass http://localhost:4200;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Node.js Backend REST API
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 1.6 Backup, Disaster Recovery & Restore Procedures

### Creating an Automated PostgreSQL Backup
Run a consistent snapshot dump of the database:
```bash
# Dump the active PostgreSQL database to an encrypted SQL archive
docker exec -t leaddesk-postgres pg_dump -U leaddesk leaddesk_dev > leaddesk_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restoring from Backup
```bash
# Drop existing schema and restore from backup file
cat leaddesk_backup_20261122.sql | docker exec -i leaddesk-postgres psql -U leaddesk -d leaddesk_dev
```

---

# Part II: Toolchain & Identity Integrations Setup

## 2.1 GitHub & GitLab PR Watchdog Setup

LeadDesk monitors pull request lifecycles to detect review bottlenecks before sprint milestones slip.

### GitHub Webhook Configuration
1. Navigate to your GitHub Repository or Organization Settings &rarr; **Webhooks** &rarr; **Add Webhook**.
2. **Payload URL:** `http://<your-host>:4000/api/v1/integrations/github/webhook`
3. **Content type:** Select `application/json`.
4. **Secret:** Paste your shared webhook secret (must match `GITHUB_WEBHOOK_SECRET` in `.env`).
5. **Which events would you like to trigger this webhook?:** Choose *Let me select individual events*:
   - Check **Pull requests**
   - Check **Pull request reviews**
   - Check **Workflow runs** / **Check runs**
6. Click **Add webhook**.

### Review Latency SLA Metrics
LeadDesk automatically tracks:
* **Time-to-First-Review (TTFR):** Elapsed time from PR opening to the first review comment/approval.
* **Stale PR Alerts:** Any PR awaiting review for more than 24 hours produces a priority alert in the notification center and morning dashboard.

---

## 2.2 Jira Cloud & Linear 2-Way Issue Sync Setup

### Jira Cloud Webhook Setup
1. In Jira Settings &rarr; **System** &rarr; **Webhooks**.
2. Click **Create a Webhook**.
3. **URL:** `http://<your-host>:4000/api/v1/integrations/jira/webhook`
4. **Issue-related events:** Check `Created`, `Updated`, `Deleted`.
5. **JQL Filter:** `project = "ENG" AND type in (Story, Bug, Task)`
6. Save webhook.

### Issue Status Mapping Matrix

| Jira Cloud Status | Linear State | LeadDesk Task State |
| :--- | :--- | :--- |
| `To Do` / `Backlog` | `Backlog` / `Todo` | `TODO` |
| `In Progress` / `In Development` | `In Progress` | `IN_PROGRESS` |
| `Under Review` / `QA` | `In Review` | `IN_PROGRESS` (Tagged `#review`) |
| `Blocked` / `Impediment` | `Blocked` | `BLOCKED` |
| `Done` / `Closed` / `Resolved` | `Done` / `Completed` | `DONE` |

---

## 2.3 Slack & Microsoft Teams Apps & Capture Bot Setup

### Slack App Configuration
1. Go to [api.slack.com/apps](https://api.slack.com/apps) &rarr; **Create New App** &rarr; *From an app manifest*.
2. Add a Slash Command:
   - **Command:** `/leaddesk`
   - **Request URL:** `http://<your-host>:4000/api/v1/integrations/slack/events`
   - **Usage Hint:** `capture <thought, task, or meeting note>`
3. Add Incoming Webhooks:
   - Configure channel `#eng-incidents` for P0 production alerts.
   - Configure channel `#team-leads` for daily focus time digests.

### Omni-Capture via Slack
Engineers can capture action items without switching out of Slack:
```
/leaddesk capture Review AWS ECS auto-scaling policies before Thursday load test
```
The item immediately appears in the LeadDesk **Quick Inbox (`/inbox`)** with `NEW` status.

---

## 2.4 External Calendar Hub Sync (ICS & Webhooks)

1. Navigate to **Calendar Hub (`/calendar`)**.
2. Click **"Sync External Calendar"**.
3. Paste your corporate calendar ICS feed URL (Google Calendar private address in iCal format or Outlook ICS link).
4. LeadDesk parses recurring meetings, calculates total weekly meeting hours, and highlights protected focus blocks (e.g. Focus Wednesdays).

---

## 2.5 Okta SAML 2.0 Single Sign-On (SSO) Configuration

LeadDesk supports enterprise identity federation using SAML 2.0.

### Step-by-Step Okta Setup
1. Log into your Okta Admin Console &rarr; **Applications** &rarr; **Create App Integration**.
2. Select **SAML 2.0** and click **Next**.
3. **General Settings:** Set App Name to `LeadDesk`.
4. **Configure SAML:**
   - **Single Sign-On URL (ACS URL):** `http://<your-host>:4000/api/v1/auth/sso/saml/callback`
   - Check *Use this for Recipient URL and Destination URL*.
   - **Audience URI (SP Entity ID):** `https://leaddesk.internal/saml/metadata`
   - **Name ID format:** `EmailAddress`
   - **Application username:** `Email`
5. **Attribute Statements (SAML Claims):**

| Name | Name format | Value |
| :--- | :--- | :--- |
| `email` | Unspecified | `user.email` |
| `displayName` | Unspecified | `user.displayName` |
| `role` | Unspecified | `appuser.role` |
| `department` | Unspecified | `user.department` |

6. Download the **Identity Provider metadata XML** or copy the **SSO Target URL** and **X.509 Certificate**.
7. In LeadDesk, navigate to **Org Settings (`/settings/organization`)** as an `OWNER` or `ORG_ADMIN`, paste the IdP credentials, and save.

---

## 2.6 Microsoft Entra ID (Azure AD) SAML 2.0 Configuration

1. In the Microsoft Entra admin center &rarr; **Enterprise Applications** &rarr; **New application** &rarr; **Create your own application**.
2. Select **Set up single sign-on** &rarr; **SAML**.
3. **Basic SAML Configuration:**
   - **Identifier (Entity ID):** `https://leaddesk.internal/saml/metadata`
   - **Reply URL (Assertion Consumer Service URL):** `http://<your-host>:4000/api/v1/auth/sso/saml/callback`
   - **Sign on URL:** `http://<your-host>:4200/login`
4. **Attributes & Claims:** Map `emailaddress` to `user.mail` and `name` to `user.displayname`.
5. Download **Certificate (Base64)** and upload into LeadDesk Organization Settings.

---

## 2.7 Google Workspace SAML Configuration

1. In the Google Admin Console &rarr; **Apps** &rarr; **Web and mobile apps** &rarr; **Add custom SAML app**.
2. Enter App Name: `LeadDesk`.
3. Copy Google SSO URL and download the Google X.509 certificate.
4. **Service Provider Details:**
   - **ACS URL:** `http://<your-host>:4000/api/v1/auth/sso/saml/callback`
   - **Entity ID:** `https://leaddesk.internal/saml/metadata`
5. Set Name ID to **Primary email**.
6. Map Attributes: `email` &rarr; `Primary email`, `displayName` &rarr; `First name` + `Last name`.
7. Turn ON service access for your organization units.

---

## 2.8 SCIM 2.0 Automated User Directory Provisioning

LeadDesk provides an RFC 7644-compliant SCIM 2.0 API allowing Okta or Azure AD to automatically provision and de-provision user accounts.

### Provisioning Setup
1. In LeadDesk, navigate to **Org Settings (`/settings/organization`)**.
2. Under **SCIM 2.0 Directory Sync**, click **Generate SCIM Bearer Token**. Copy the token.
3. In Okta / Azure AD &rarr; Application Provisioning Settings:
   - **SCIM connector base URL:** `http://<your-host>:4000/api/v1/scim/v2`
   - **Unique user identifier attribute:** `userName` (mapped to email)
   - **Authentication Mode:** `HTTP Header / Bearer Token`
   - Paste your LeadDesk SCIM Bearer Token.
4. Enable Provisioning Features:
   - **Create Users:** Automatically provisions accounts when employees join.
   - **Update User Attributes:** Synchronizes department and title updates.
   - **Deactivate Users:** When an employee leaves, Okta sends `PATCH /Users/:id {"active": false}`; LeadDesk immediately revokes active JWT sessions and deactivates the account.

---

# Part III: Daily Operational Playbooks & Role Schedules

## 3.1 Tech Lead: Daily Hour-by-Hour Operating Rhythm

```
09:00 - 09:30 │ Morning Standup & Dashboard Triage
09:30 - 12:30 │ Protected Deep-Work Flow Block
12:30 - 13:30 │ Lunch & Unstructured Time
13:30 - 15:30 │ Code Reviews & PR Watchdog Clearing
15:30 - 16:30 │ Architecture Syncs & ADR Logging
16:30 - 17:30 │ Task Delegation & Follow-Up Wrap-up
```

### Detailed Daily Checklist
* **09:00 - 09:30 (Morning Triage):**
  - Open **Dashboard (`/dashboard`)**. Review P0/P1 tasks due today.
  - Inspect the **Integrations Hub (`/integrations`)**: Check for pull requests awaiting review for more than 24 hours. Assign reviewers or review immediately.
* **09:30 - 12:30 (Protected Flow Block):**
  - Close non-essential Slack channels.
  - If a discussion item or reminder arises, press **`Q`** to launch Quick Capture and log it without breaking concentration.
* **13:30 - 15:30 (Reviews & Unblocking):**
  - Review open pull requests. Verify CI check runs and test coverage.
  - Check the **Tasks Engine (`/tasks`)** for tasks marked `BLOCKED`; reach out to assignees to clear impediments.
* **15:30 - 16:30 (Architecture & Decisions):**
  - If an architectural trade-off was decided during technical syncs, navigate to **Meetings & Decisions (`/meetings`)** and record a formal Architecture Decision Record (ADR).
* **16:30 - 17:30 (Delegation & Follow-up):**
  - Assign next sprint tasks. Update bilateral commitments in the **Follow-up Tracker (`/followups`)**.

---

## 3.2 Engineering Manager: Weekly Operational Playbook

### Monday: Sprint Kickoff & Workload Radar
* Open **EngOps & DORA (`/engops`)** &rarr; **Cascading OKRs** tab.
* Audit the **Workload Overload Radar** on the DevEx tab. Ensure no engineer has more than 3 active high-complexity tasks simultaneously.
* Verify sprint deliverables match quarterly OKRs.

### Wednesday - Thursday: 1-on-1s & DevEx Pulse Audit
* Before each 1-on-1 meeting:
  1. Open **AI Decisions (`/ai-decision`)** &rarr; **1-on-1 Agenda Copilot**.
  2. Select the direct report. Click **"Generate AI Agenda"**.
  3. Review synthesized topics: check stale PR latency and on-call pager duty load.
* Review the **DevEx & Burnout Radar (`/engops`)**: If team burnout risk is `MODERATE` or `HIGH`, investigate on-call fatigue or friction bottlenecks.

### Friday: Weekly Digest Rollup & Stakeholder Reporting
* At 16:00, navigate to **Weekly Digest (`/reports/weekly`)**.
* Review auto-compiled accomplishments, shipped features, and active blockers.
* Add team recognition and next week's strategic focus.
* Click **"Copy Markdown"** and post into the `#engineering-updates` Slack channel.

---

## 3.3 Director & VP / CTO: Quarterly Strategic Cadence

### Month 1: Cascading OKR Alignment
* Establish top-level Organization Objectives in **EngOps (`/engops`)**.
* Guide Engineering Managers to create Workspace and Squad-level Key Results.

### Month 2: Cross-Squad DORA Benchmarking
* Toggle the DORA 4 scorecard filter to **30 Days**.
* Benchmark deployment frequency and change failure rates across all squads.
* Squads with change failure rate > 15% are scheduled for quality reviews and automated testing investments.

### Month 3: Executive QBR Synthesizer & Board Review
* Navigate to **AI Decisions (`/ai-decision`)** &rarr; **Executive Retrospective & QBR**.
* Select the quarter (e.g. `2026-Q4`) and click **"Generate Executive QBR"**.
* Export the comprehensive markdown summary for board decks and executive meetings.

---

## 3.4 Compliance & Security Auditor Protocol

### SOC-2 Type II Audit Walkthrough
1. Log in with a user assigned the `COMPLIANCE_AUDITOR` role.
2. Navigate to **Audit & Compliance (`/compliance`)**.
3. Under the **Audit Trail** tab, click **"Verify Merkle Integrity"**.
4. The system validates the mathematical hash chain across all tenant events. A green verification badge certifies zero database tampering.
5. Under **GDPR & Legal Discovery**, export required compliance archives.

---

# Part IV: Deep-Dive Feature Reference (All 16 Operational Modules)

## Module 1: Dashboard / "My Day" (`/dashboard`)
* **Objective:** Single-pane-of-glass morning situational awareness.
* **Key Widgets:** Focus vs. Meeting meter, Critical Priority items (P0/P1), Overdue Follow-ups, and Quick Metrics Ribbon.
* **SOP:** Check daily at 09:00. Mark completed tasks directly from the dashboard checklist.

## Module 2: Quick Inbox & Triage Hub (`/inbox`)
* **Objective:** GTD capture triage for zero-interruption workflow.
* **Input Methods:** `Q` keyboard shortcut, mobile capture, Slack `/leaddesk capture`.
* **SOP:** Triage twice daily (morning & evening). Convert items into Tasks, Follow-ups, or ADRs; click Archive to clear processed items.

## Module 3: Tasks & Delegation Engine (`/tasks`)
* **Objective:** Engineering task tracking with bilateral delegation.
* **Priority Levels:** `P0` (Critical), `P1` (High), `P2` (Medium), `P3` (Low).
* **Lifecycles:** `TODO` &rarr; `IN_PROGRESS` &rarr; `BLOCKED` &rarr; `DONE`.
* **SOP:** Create actionable tasks with clear acceptance criteria. Filter by assignee or workspace.

## Module 4: Follow-up Tracker (`/followups`)
* **Objective:** Two-way bilateral accountability management.
* **Modes:** "They Owe Me" vs. "I Owe Them".
* **SOP:** Assign due dates to promises. Snooze by +1d, +3d, or +1w if renegotiated.

## Module 5: Team Directory & Contact Dossiers (`/team`)
* **Objective:** 360-degree engineer profiles and private leadership notes.
* **Dossier Data:** Roles, email, timezone, GitHub/Slack handles, direct reports, private 1-on-1 notes.
* **SOP:** Maintain private notes on growth, strengths, and feedback.

## Module 6: Organization & Squad Hierarchy (`/team/hierarchy`)
* **Objective:** Visual org chart and 7-tier RBAC matrix.
* **Hierarchy:** Organization &rarr; Workspaces (Departments) &rarr; Squads (Teams).
* **Roles:** `OWNER`, `ORG_ADMIN`, `DIRECTOR`, `MANAGER`, `MEMBER`, `GUEST`, `AUDITOR`.

## Module 7: Calendar Hub & Focus Protection (`/calendar`)
* **Objective:** Protect engineering flow time and prevent meeting fatigue.
* **SOP:** Guard Focus Wednesdays. Detect conflicts before accepting calendar invites.

## Module 8: Meetings & Architecture Decisions (`/meetings`)
* **Objective:** Structured meeting agendas and Architecture Decision Records (ADRs).
* **ADR Fields:** Context, Decision, Rationale, Trade-offs, Status (`ACCEPTED`, `REJECTED`, `SUPERSEDED`).
* **SOP:** Record technical decisions; accepted ADRs automatically index into Vector Memory.

## Module 9: Weekly Digest & Executive Reporting (`/reports/weekly`)
* **Objective:** Automated Friday rollups of shipped features, blockers, and decisions.
* **SOP:** Generate every Friday at 16:00. Click "Copy Markdown" to post into Slack.

## Module 10: Notes & Knowledge Base (`/notes`)
* **Objective:** Centralized markdown specifications, runbooks, and design docs.
* **Capabilities:** Full GFM markdown, KaTeX math, tags, and full-text/vector search.

## Module 11: Toolchain Event Mesh & PR Watchdog (`/integrations`)
* **Objective:** Real-time developer toolchain correlation.
* **Capabilities:** GitHub PR latency watchdog (>24h SLA), 2-way Jira issue sync, Slack bots.

## Module 12: Engineering Operations & DORA Metrics (`/engops`)
* **Objective:** Real-time DORA 4 metrics scorecard.
* **Metrics:** Deployment Frequency, Lead Time, Change Failure Rate, MTTR.
* **Rolling Filters:** 7 Days, 30 Days, 90 Days.

## Module 13: DevEx & Burnout Radar (`/engops`)
* **Objective:** Developer experience monitoring and attrition prevention.
* **Capabilities:** Weekly sentiment pulse, Burnout Risk Index (`LOW`, `MODERATE`, `HIGH`), Workload Overload Radar.

## Module 14: Cascading Team OKRs Engine (`/engops`)
* **Objective:** Goal alignment from CTO to individual squads.
* **Capabilities:** Key result progress rollup, status tracking (`ON_TRACK`, `AT_RISK`, `BEHIND`, `COMPLETED`).

## Module 15: Security, Merkle Audit & Compliance (`/compliance`)
* **Objective:** SOC-2, ISO 27001, and GDPR compliance certification.
* **Capabilities:** SHA-256 Merkle chain verification, data retention policies, legal holds, GDPR Art. 17/20.

## Module 16: AI Decisions & Strategic Vector Memory (`/ai-decision`)
* **Objective:** Semantic retrieval-augmented decision intelligence.
* **Capabilities:** 64-D vector search, ADR RAG with grounded citations, 1-on-1 Agenda Copilot, Quarterly QBR generator.

---

# Part V: Troubleshooting, Administration & FAQ

## 5.1 Diagnostic Runbook & Health Checks

### Check System Health
```bash
curl -s http://localhost:4000/api/v1/health
```
Expected response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "leaddesk-backend",
    "timestamp": "2026-11-22T10:00:00.000Z",
    "uptimeSeconds": 1420
  }
}
```

### Inspect Container Logs
```bash
docker logs --tail 50 -f leaddesk-backend
docker logs --tail 50 -f leaddesk-frontend
docker logs --tail 50 -f leaddesk-postgres
```

---

## 5.2 Merkle Integrity Audit & Breach Resolution

### How the Merkle Chain Operates
Every state-mutating action computes:
$$\text{Hash}_n = \text{SHA256}(\text{Hash}_{n-1} + \text{TenantID} + \text{Action} + \text{CanonicalPayload})$$

### Resolving a Breach Alert
If the Merkle verifier in `/compliance` reports an integrity failure:
1. Note the `breachedLogId` reported by the verification tool.
2. Query the audit log table to inspect the unverified record:
   ```sql
   SELECT id, action, "entityType", "prevHash", hash, "createdAt" 
   FROM audit_logs 
   WHERE id = '<breachedLogId>';
   ```
3. A mismatch indicates direct database modification, deletion, or injection that bypassed the application layer.

---

## 5.3 Frequently Asked Questions (FAQ)

#### Q: How does multi-tenancy isolation work in LeadDesk V3 Enterprise?
Every database query is strictly scoped by the active tenant organization via the `x-org-id` header. Data across tasks, notes, members, DORA metrics, audit logs, and vector memory embeddings are partitioned per organization, ensuring zero cross-tenant leakage.

#### Q: How do I configure Enterprise SAML 2.0 SSO?
Navigate to `/settings/organization` as an `OWNER` or `ORG_ADMIN`. Enter your Identity Provider SSO Target URL, Entity ID / Issuer, and paste your public X.509 certificate. In Okta / Azure AD, set the ACS Callback URL to `http://<your-host>:4000/api/v1/auth/sso/saml/callback`.

#### Q: How are DORA 4 metrics calculated?
Deployment Frequency and Lead Time for Changes are computed from CI/CD production deployment logs and merged PR timestamps. Change Failure Rate is the percentage of deployments linked to a production incident. Time to Restore Service (MTTR) is the elapsed time from incident trigger to resolved state.

#### Q: How does 64-D semantic vector memory retrieve ADRs with zero hallucination?
LeadDesk encodes ADRs, post-mortems, and team notes into continuous 64-dimensional dense vectors using normalized cosine similarity dot-product retrieval. When a question is asked, the RAG assistant retrieves the top-$k$ nearest documents and provides verbatim text excerpts and reference IDs with grounded citations.

---

## 5.4 Power-User Keyboard Accelerators Reference

| Keyboard Shortcut | Context | Action |
| :--- | :--- | :--- |
| `Ctrl + P` / `Cmd + K` | Global | Open Omni-Search Command Palette |
| `Q` | Global | Launch Quick Capture Modal |
| `Esc` | Global | Close active modal, drawer, or search overlay |
| `Enter` | Omni-Search | Select and jump to highlighted item |
| `Tab` | Forms / Tables | Move to next input field |
| `> engops` | Omni-Search | Direct jump command to EngOps & DORA |
| `> ai` | Omni-Search | Direct jump command to AI Decisions & RAG |
| `> compliance` | Omni-Search | Direct jump command to Audit & Compliance |
| `> guide` | Omni-Search | Direct jump command to User Guide & SOP |
