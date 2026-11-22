# LeadDesk V3 Enterprise Execution Plan
## Engineering Operations, Multi-Tenancy & Leadership Intelligence Platform

**Document Version:** 3.0.0  
**Status:** In Scoping & Initial Execution  
**Target Release:** LeadDesk Enterprise V3  
**Authors:** LeadDesk Architecture & Core Engineering Team  

---

## 1. Executive Summary & V3 Vision

LeadDesk began as a focused, high-speed command center for individual engineering leads (V1), evolved into a comprehensive leadership operating system with directories, visual calendar, attachments, automated background workers, smart AI NLP capture, and weekly digests (V2).

**LeadDesk V3 elevates the system into a full-scale Enterprise Engineering Operations & Leadership Platform (EngOps)**. V3 is built for modern engineering organizations—from fast-growing mid-market scale-ups (50–300 engineers) to large enterprises (1,000–5,000+ engineers)—that require:
1. **Multi-Tenancy & Organizational Hierarchy:** Seamless isolation across companies, departments/tribes, squads/teams, and individual contributor reporting trees.
2. **Enterprise Identity & Lifecycle Automation:** Federated SAML 2.0 Single Sign-On (Okta, Azure AD, Google Workspace) and SCIM 2.0 automated provisioning and de-provisioning.
3. **Bi-Directional Engineering Toolchain Mesh:** Direct event synchronization with GitHub/GitLab (PR latency watchdog), Jira/Linear (2-way task sync), Slack/Teams (interactive capture & daily briefings), and Google/M365 calendars.
4. **Engineering Operations & DORA Metrics:** Real-time visibility into the 4 DORA metrics alongside developer sentiment and burnout prevention radars.
5. **Enterprise Governance & Security:** SOC-2 Type II audit logging, granular Role-Based Access Control (RBAC), and strict confidentiality perimeters for private 1-on-1s.
6. **Decision Intelligence & AI RAG:** Organizational vector retrieval over architectural RFCs, meeting decisions, and automated 1-on-1 coaching agendas.

---

## 2. Architectural Comparison: V2 vs V3

```
+----------------------------------------------------------------------------------------------------+
|                                    V2: Single-User Leadership OS                                   |
|                                                                                                    |
|  [User] ──► [Inbox / Tasks / Follow-ups / Meetings / Decisions / Notes / Attachments / Calendar]   |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼ EVOLUTION
+----------------------------------------------------------------------------------------------------+
|                                    V3: Enterprise EngOps Platform                                  |
|                                                                                                    |
|  +----------------------------------------------------------------------------------------------+  |
|  |                            ORGANIZATION TENANT (e.g. Acme Corp)                             |  |
|  |                                                                                              |  |
|  |  [SAML 2.0 SSO / Okta] ───► [SCIM 2.0 Sync] ───► [Enterprise RBAC & Permission Matrix]      |  |
|  |                                                                                              |  |
|  |  +-----------------------------+   +-----------------------------+                           |  |
|  |  |  Workspace: Core Platform   |   |  Workspace: Product Eng     |   ... [Other Workspaces]  |  |
|  |  |  - Tribe Lead (Director)    |   |  - Tribe Lead (Director)    |                           |  |
|  |  |  - Squads: Auth, Infra, CI  |   |  - Squads: Web, Mobile, API |                           |  |
|  |  +--------------┬--------------+   +--------------┬--------------+                           |  |
|  |                 │                                 │                                          |  |
|  |                 ▼                                 ▼                                          |  |
|  |  [Engineering Managers & Tech Leads] ──► [Squad Members / Individual Contributors]           |  |
|  |  - 360° Dossiers & 1-on-1s (Private)    - Commitments & Sprint Initiatives                   |  |
|  |  - Architectural Decisions & RFCs       - Blockers & Stakeholder Dependencies                |  |
|  |                                                                                              |  |
|  |  +----------------------------------------------------------------------------------------+  |  |
|  |  |                        Bi-Directional Toolchain Event Mesh                             |  |  |
|  |  |   GitHub / GitLab  │  Jira / Linear  │  Slack / Teams App  │  Google / M365 2-Way Cal  |  |  |
|  |  +----------------------------------------------------------------------------------------+  |  |
|  |  |                    Engineering Operations & Compliance Intelligence                    |  |  |
|  |  |   DORA Metrics  │  DevEx & Burnout Radar  │  AuditLog (SOC-2)  │  AI Decision RAG     |  |  |
|  |  +----------------------------------------------------------------------------------------+  |  |
|  +----------------------------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------------------------+
```

---

## 3. The 6 Enterprise Pillars of LeadDesk V3

| Pillar | Focus Area | Key Capabilities |
|---|---|---|
| **1. Multi-Tenancy & RBAC** | Hierarchy & Governance | Organizations, Workspaces, Squads, Reporting Lines, Granular Role Matrix, 1-on-1 Confidentiality perimeters. |
| **2. Enterprise Identity** | SSO & Lifecycle | SAML 2.0 (Okta, Azure AD, Google), SCIM 2.0 Automated User Provisioning/Offboarding, Enforced MFA, Session Control. |
| **3. Toolchain Mesh** | Bi-Directional Integrations | GitHub/GitLab PR review latency watchdog, 2-way Jira/Linear sync, Slack/Teams Bot & thread capture, Google/M365 2-way calendar sync. |
| **4. EngOps & Health** | Metrics & Retention | DORA 4 Metrics (Deployment Frequency, Lead Time, Failure Rate, MTTR), Anonymous DevEx Sentiment Pulses, Burnout Radar. |
| **5. Security & Compliance**| SOC-2 Readiness | Immutable `AuditLog`, Data Retention policies, GDPR user deletion cascades, Legal e-Discovery exports, IP allowlisting. |
| **6. Decision AI 2.0** | Executive RAG | Vector search over historical decisions and RFCs (pgvector), Automated 1-on-1 prep copilot, Quarterly Retro slide generator. |

---

## 4. Deep-Dive Scope: Phase 1 (Sprint 14)
### Multi-Tenancy, Team Hierarchy & Role-Based Access Control (RBAC)

#### A. Objectives
1. Introduce first-class multi-tenancy without breaking existing single-user V1/V2 records.
2. Enable organizational hierarchy: `Organization` &rarr; `Workspaces` &rarr; `Teams / Squads` &rarr; `Members`.
3. Support management reporting structures (`reportsToId`) to drive automated 1-on-1 pairings and delegation workflows.
4. Implement Enterprise RBAC: 7 predefined organizational roles with fine-grained capability checks.
5. Provide UI controls: Multi-Tenant Workspace Switcher, Organization Management Console, and Squad Visual Tree.

#### B. Database Schema Additions (Prisma)
```prisma
// ==========================================
// V3 PHASE 1 PRISMA DATA MODELS
// ==========================================

enum OrgRole {
  OWNER               // Full administrative, billing, and deletion rights
  ORG_ADMIN           // Can manage members, integrations, and workspaces
  DIRECTOR            // Can view department-wide metrics, decisions, and squads
  MANAGER             // Can manage squad, view dossiers, conduct 1-on-1s, assign tasks
  MEMBER              // Standard IC: personal tasks, shared team items, meeting notes
  GUEST_STAKEHOLDER   // Read-only access to specific public decisions/initiatives
  COMPLIANCE_AUDITOR  // Read-only access to AuditLogs, retention rules, and exports
}

model Organization {
  id             String          @id @default(uuid()) @db.Uuid
  name           String
  slug           String          @unique
  domain         String?         // Domain matching for auto-joining (e.g. acme.com)
  logoUrl        String?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  workspaces     Workspace[]
  memberships    OrgMembership[]
  invitations    OrgInvitation[]
  auditLogs      AuditLog[]

  @@map("organizations")
}

model Workspace {
  id             String          @id @default(uuid()) @db.Uuid
  name           String          // e.g. "Platform Engineering", "Core Product"
  description    String?
  slug           String
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  orgId          String          @db.Uuid
  organization   Organization    @relation(fields: [orgId], references: [id], onDelete: Cascade)

  parentId       String?         @db.Uuid
  parent         Workspace?      @relation("WorkspaceHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children       Workspace[]     @relation("WorkspaceHierarchy")

  teams          Team[]
  tasks          Task[]
  meetings       Meeting[]
  notes          Note[]

  @@unique([orgId, slug])
  @@index([orgId])
  @@map("workspaces")
}

model Team {
  id             String          @id @default(uuid()) @db.Uuid
  name           String          // e.g. "Identity Pod", "Billing Squad"
  description    String?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  workspaceId    String          @db.Uuid
  workspace      Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  leadUserId     String?         @db.Uuid
  leadUser       User?           @relation("TeamLead", fields: [leadUserId], references: [id], onDelete: SetNull)

  memberships    TeamMembership[]

  @@index([workspaceId])
  @@map("teams")
}

model OrgMembership {
  id             String          @id @default(uuid()) @db.Uuid
  role           OrgRole         @default(MEMBER)
  title          String?         // e.g. "Senior Staff Engineer", "Engineering Director"
  department     String?         // e.g. "Infrastructure", "Growth"
  joinedAt       DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  orgId          String          @db.Uuid
  organization   Organization    @relation(fields: [orgId], references: [id], onDelete: Cascade)

  userId         String          @db.Uuid
  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  reportsToId    String?         @db.Uuid
  reportsTo      OrgMembership?  @relation("ReportingLine", fields: [reportsToId], references: [id], onDelete: SetNull)
  directReports  OrgMembership[] @relation("ReportingLine")

  teamMemberships TeamMembership[]

  @@unique([orgId, userId])
  @@index([orgId, role])
  @@index([reportsToId])
  @@map("org_memberships")
}

model TeamMembership {
  id             String          @id @default(uuid()) @db.Uuid
  isTechLead     Boolean         @default(false)
  joinedAt       DateTime        @default(now())

  teamId         String          @db.Uuid
  team           Team            @relation(fields: [teamId], references: [id], onDelete: Cascade)

  membershipId   String          @db.Uuid
  orgMembership  OrgMembership   @relation(fields: [membershipId], references: [id], onDelete: Cascade)

  @@unique([teamId, membershipId])
  @@map("team_memberships")
}

model OrgInvitation {
  id             String          @id @default(uuid()) @db.Uuid
  email          String
  role           OrgRole         @default(MEMBER)
  token          String          @unique
  expiresAt      DateTime
  invitedById    String          @db.Uuid
  createdAt      DateTime        @default(now())

  orgId          String          @db.Uuid
  organization   Organization    @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@index([orgId, email])
  @@map("org_invitations")
}
```

#### C. Backward Compatibility & Seamless Migration Strategy
* **Zero Downtime Migration:** Existing single-user V1/V2 records in `users`, `tasks`, `meetings`, `notes`, etc. will be automatically backfilled into a default personal organization:
  * For each existing user, create an `Organization` named `"<User>'s Workspace"` with slug `<username>-workspace`.
  * Create a default `Workspace` named `"General"`.
  * Create an `OrgMembership` with role `OWNER`.
  * Set `orgId` and `workspaceId` on all existing records.

#### D. Backend API Endpoints (Sprint 14) ✅
- [x] **Organization Management:**
  - `POST /api/v1/orgs` - Create a new organization.
  - `GET /api/v1/orgs/my` - List all organizations the user belongs to.
  - `GET /api/v1/orgs/:id` - Fetch organization details & active members.
  - `PATCH /api/v1/orgs/:id` - Update organization profile/settings (Admin/Owner only).
- [x] **Workspace & Squad Hierarchy:**
  - `POST /api/v1/orgs/:id/workspaces` - Create workspace.
  - `GET /api/v1/orgs/:id/workspaces` - List workspaces with nested squads.
  - `POST /api/v1/orgs/:id/teams` - Create team/squad with designated lead.
  - `GET /api/v1/orgs/:id/hierarchy` - Visual hierarchy tree payload (Director &rarr; Managers &rarr; ICs).
- [x] **Member Management & Invites:**
  - `POST /api/v1/orgs/:id/invitations` - Invite team members by email with role assignment.
  - `POST /api/v1/orgs/invitations/accept` - Accept invite token and join organization.
  - `PATCH /api/v1/orgs/:id/members/:memberId` - Update member role or assign `reportsToId`.
  - `DELETE /api/v1/orgs/:id/members/:memberId` - Remove member from organization.

#### E. Frontend UI Components (Sprint 14) ✅
- [x] **Workspace & Tenant Switcher:**
  - Global dropdown in top-left sidebar header: displays active organization & role, allowing 1-click switching across all user's organizations with persistence in local storage and request headers.
- [x] **Organization Administration Settings (`/settings/organization`):**
  - Members & RBAC table, Workspaces & Squads manager with creation modals, Pending Invitations table, and Org Profile form.
- [x] **Interactive Squad & Hierarchy Tree View (`/team/hierarchy`):**
  - Visual organogram diagram showing tribes, squads, engineering managers, and direct reporting lines.
- [x] **Role Permission Guards:**
  - `isOwnerOrAdmin` and `isLeadership` computed properties restricting sensitive management actions.

---

### Phase 2 (Sprint 15): Enterprise Identity, SAML 2.0 SSO & SCIM 2.0 User Provisioning ✅

#### A. Database Schema Additions
- [x] **Enterprise SAML Fields on Organization:** `ssoEnabled`, `ssoProvider`, `ssoEntityId`, `ssoLoginUrl`, `ssoAcsUrl`, `ssoCert`, `ssoMetadataUrl`, `enforceSso`, `allowedDomains`.
- [x] **Enterprise SCIM Fields on Organization:** `scimEnabled`, `scimApiKey` (unique bearer token).
- [x] **Lifecycle & De-provisioning Fields:** `isActive` on `User` and `OrgMembership`, `externalId` on `User`.

#### B. SAML 2.0 Single Sign-On Architecture
- [x] **SP Metadata XML Generation:** `GET /api/v1/auth/sso/metadata/:orgId` (RFC SAML 2.0 EntityDescriptor & SPSSODescriptor).
- [x] **Domain Discovery & SSO Enforcement:** `GET /api/v1/auth/sso/lookup` (checks corporate email domain & enforces SSO when required).
- [x] **SAML AuthN Request Generator:** `GET/POST /api/v1/auth/sso/initiate` (creates signed SAML 2.0 AuthnRequest redirecting to Okta / Azure AD / Google Workspace).
- [x] **SAML Assertion Consumer Service (ACS):** `POST /api/v1/auth/sso/callback` (validates XML signature, decodes NameID / claims, auto-provisions or matches user in tenant, issues LeadDesk JWT tokens).
- [x] **SAML Sandbox Simulator:** `GET /api/v1/auth/sso/test-simulator` (interactive sandbox to verify SSO assertion exchange without third-party subscriptions).

#### C. SCIM 2.0 Automated User Provisioning Engine (RFC 7644)
- [x] **Discovery Endpoints:**
  - `GET /scim/v2/ServiceProviderConfig` (patch, filter, authentication schemes).
  - `GET /scim/v2/Schemas` & `GET /scim/v2/ResourceTypes`.
- [x] **User Lifecycle Endpoints:**
  - `GET /scim/v2/Users` (list users with filter query parsing `userName eq "..."` and pagination).
  - `GET /scim/v2/Users/:id` (fetch single SCIM User resource).
  - `POST /scim/v2/Users` (automated employee onboarding when assigned in Okta / Azure AD).
  - `PUT /scim/v2/Users/:id` & `PATCH /scim/v2/Users/:id` (real-time attribute updates & instant deactivation).
  - `DELETE /scim/v2/Users/:id` (automated offboarding & session invalidation).
- [x] **Bearer Authentication Middleware:** Authenticates SCIM requests via `Authorization: Bearer <scimApiKey>`.

#### D. Frontend SSO & SCIM Experience
- [x] **Enterprise Login Tab (`/login`):**
  - 1-click switcher between Password and Enterprise SSO.
  - Domain lookup resolver routing employees to their corporate IdP.
  - Auto-detection and warning when `enforceSso` is mandated by organization policy.
- [x] **SAML Callback Receiver (`/login/sso-callback`):**
  - Smooth session initialization, organization hydration, and redirect to dashboard.
- [x] **SSO & SCIM Admin Hub (`/settings/organization`):**
  - Interactive SAML 2.0 configuration with SP Entity ID / ACS URL copy buttons and XML download.
  - Corporate allowed domain tag manager.
  - SCIM 2.0 Base URL, Bearer API token generator, rotator, and revoker.
  - Test SSO Simulator launch button.

---

### Phase 3 (Sprint 16): Toolchain Event Mesh & Bi-Directional Integrations ✅

#### A. Database Schema Additions
- [x] **Integration Model:** `IntegrationProvider` enum (`GITHUB`, `GITLAB`, `JIRA`, `LINEAR`, `SLACK`, `TEAMS`), webhook secrets with HMAC verification, API keys, JSON provider config (`prSlaHours`, `channelId`), workspace linking.
- [x] **PullRequestWatch Model:** Telemetry for PR review latency (`openedAt`, `firstReviewAt`, `reviewLatencyMinutes`), stalled detection (`isStalled`, `slaBreachedAt`), review states (`APPROVED`, `CHANGES_REQUESTED`), reviewer tracking.
- [x] **IntegrationEvent Model:** Event Mesh audit trail for all inbound & outbound webhooks (`RECEIVED`, `PROCESSED`, `FAILED`, `IGNORED`).
- [x] **Task 2-Way Sync Enhancement:** Added `externalKey` (e.g. `ENG-9941`, `LIN-42`) and `lastSyncedAt` to `Task`.

#### B. GitHub & GitLab Pull Request Watchdog
- [x] **HMAC-SHA256 Signature Verification:** Validates `X-Hub-Signature-256` using secure constant-time comparisons (`crypto.timingSafeEqual`).
- [x] **PR Lifecycle Tracking:** Captures `opened`, `review_requested`, `submitted`, `closed`, `merged` for GitHub PRs and GitLab Merge Requests.
- [x] **Review Latency Telemetry:** Calculates minute-accurate latency from open to first review submission.
- [x] **Stalled PR Watchdog & SLA Breach Scanner:** Detects PRs exceeding SLA threshold (default 24h) and auto-generates high-priority LeadDesk `FollowUp` items for engineering leaders.
- [x] **Repository Bottleneck Analytics:** Aggregates open PRs, stalled PRs, average review latency, and SLA breach rates across all connected repositories.

#### C. Bi-Directional Jira & Linear Issue Sync
- [x] **Inbound Webhook Sync:** Captures `jira:issue_created`, `jira:issue_updated`, and Linear `Issue` events, mapping issue keys, summaries, descriptions, and priorities.
- [x] **Status State Machine Translation:** Accurately maps Jira/Linear statuses (`To Do` &rarr; `PLANNED`, `In Progress` &rarr; `IN_PROGRESS`, `Done` &rarr; `COMPLETED`).
- [x] **Outbound Transition Triggers:** Automatically records and dispatches task updates back to external tracking systems.

#### D. Slack & Microsoft Teams Quick-Capture & Alerting
- [x] **Slash Command Quick-Capture (`/leaddesk [text]`):** Captures engineering tasks, ideas, and 1-on-1 topics straight from Slack into the user's Leadership Inbox with instant ephemeral confirmation.
- [x] **Teams Bot Activity Capture:** Ingests channel and direct message mentions into LeadDesk Inbox.
- [x] **Outbound Alert Broadcasts:** Dispatches channel webhooks for stalled PR review SLA breaches and digest notifications.

#### E. Frontend Integrations & PR Watchdog Hub (`/integrations`)
- [x] **PR Review Watchdog Dashboard:** Real-time KPI metric cards (Open PRs, Stalled PRs, Avg Latency, Breach Rate %), Repository bottleneck breakdown table, and live PR Watchlist with direct repository deep-links.
- [x] **On-Demand PR Latency Scanner:** 1-click scan button auditing all connected repositories for SLA breaches.
- [x] **Connected Toolchains Manager:** Cards for GitHub, GitLab, Jira, Linear, Slack, and Teams with copyable Inbound Webhook URLs, connection modal, and pause/resume toggles.
- [x] **Live Event Mesh Stream:** Real-time audit log viewer displaying provider, event type, delivery ID, and ingestion status.
- [x] **Navigation Bar Link:** Added "Integrations & PRs" to global sidebar with real-time stalled PR indicator badge.

---

### Phase 4 (Sprint 17): Engineering Operations & DORA Metrics Engine ✅

#### A. Database Schema Additions
- [x] **Deployment Model:** Production/Staging/Canary deployments with `serviceName`, `version`, `status` (`SUCCESS`, `FAILED`, `ROLLED_BACK`), `leadTimeMinutes` (commit-to-prod cycle), and `deployedBy`.
- [x] **Incident Model:** Production incident tracker with `severity` (`SEV1_CRITICAL` through `SEV4_LOW`), `status`, `startedAt`, `resolvedAt`, `recoveryTimeMinutes` (MTTR), `rootCause`, and change failure linkage.
- [x] **DevExPulse Model:** Weekly developer sentiment (`score` 1-5), primary `frictionArea` (`CODE_REVIEW`, `CI_CD_BUILD`, `ON_CALL`, `REQUIREMENTS`, `MEETINGS`, `NONE`), uninterrupted `focusTimeHours`, and `onCallBurden`.
- [x] **Cascading OKR Models (`Objective` & `KeyResult`):** Multi-level OKR hierarchy (`ORGANIZATION`, `WORKSPACE`, `TEAM`), quarter tracking, target vs current progress, and automatic parent objective progress rollups.

#### B. DORA 4 Metrics Analytics Engine
- [x] **Deployment Frequency (DF):** Analyzes rolling window deployment volume against Google DORA performance thresholds (`ELITE` &ge; 1/day, `HIGH` &ge; 1/7 days, `MEDIUM` &ge; 1/30 days, `LOW`).
- [x] **Lead Time for Changes (LTTC):** Calculates median cycle latency from code commit to production release (`ELITE` &le; 1 hour, `HIGH` &le; 24 hours, `MEDIUM` &le; 168 hours).
- [x] **Change Failure Rate (CFR):** De-duplicates failed deployments and change-induced incidents over total releases (`ELITE` 0-5%, `HIGH` 5-10%, `MEDIUM` 10-15%, `LOW` > 15%).
- [x] **Time to Restore Service (MTTR):** Evaluates median incident duration across severity tiers (`ELITE` &le; 1 hour, `HIGH` &le; 24 hours, `MEDIUM` &le; 168 hours).
- [x] **Overall DORA Performance Tier:** Weighted scoring combining throughput and stability into an executive scorecard.

#### C. Developer Experience (DevEx) & Burnout Radar
- [x] **Continuous Sentiment Telemetry:** Aggregates anonymous or identified weekly engineer pulses into average morale, flow time, and on-call ratings.
- [x] **Burnout Risk Evaluation:** Automatic risk level calculation (`LOW`, `MODERATE`, `HIGH`) alerting engineering leadership before attrition occurs.
- [x] **Friction Bottleneck Aggregation:** Frequency distribution of engineering obstacles (code review, CI/CD delays, requirements thrash).
- [x] **Workload Overload Radar:** Real-time audit across all squad members highlighting overdue backlogs and critical capacity crunches.

#### D. Cascading Team OKRs Engine
- [x] **Quarterly Goal Alignment:** Hierarchical objectives at Organization, Workspace, and Squad levels.
- [x] **Automated Key Result Rollup:** Submitting progress increments on key results recalculates parent objective completion percentage dynamically.
- [x] **Status Progression:** Automatic transition across `ON_TRACK`, `AT_RISK`, `BEHIND`, and `COMPLETED`.

#### E. Frontend EngOps & DORA Intelligence Dashboard (`/engops`)
- [x] **DORA 4 Scorecard Tab:** Glowing DORA tier banner, 4 KPI cards with benchmark targets, rolling window filter (7d / 30d / 90d), Deployment History table, and Production Incidents MTTR table.
- [x] **DevEx & Burnout Radar Tab:** Team sentiment gauge, burnout risk alert badge, focus hours vs on-call meters, friction breakdown bars, "Submit Weekly Pulse" modal, and squad Workload Overload Radar table.
- [x] **Cascading OKRs Tab:** Quarter selector, Objective cards with progress bars, nested Key Results with live inline progress adjustment buttons, and modals for creating Objectives and Key Results.
- [x] **Global Shell Integration:** Added "EngOps & DORA" navigation link in sidebar layout.

---

### Phase 5 (Sprint 18): Enterprise Security, Tamper-Evident Audit Logs & Compliance ✅

#### A. Database Schema Additions
- [x] **AuditLog Model:** Merkle tree cryptographic chaining (`prevHash`, `hash`, `action`, `entityType`, `entityId`, `ipAddress`, `userAgent`, `payload`, `createdAt`).
- [x] **RetentionPolicy Model:** Multi-entity storage limitation rules (`entityType`, `retentionDays`, `action`: `DELETE` / `ANONYMIZE` / `ARCHIVE`, `isActive`, `legalHold`).
- [x] **ComplianceExport Model:** Traceable data export bundles (`type`: `GDPR_TAKEOUT` / `LEGAL_DISCOVERY` / `AUDIT_REPORT`, `recordCount`, `fileSizeBytes`, `downloadUrl`, `expiresAt`).

#### B. Tamper-Evident SHA-256 Merkle Audit Chain
- [x] **Cryptographic Chaining Engine:** Encapsulates canonical serialized payload, tenant ID, action, and previous record's SHA-256 digest into an immutable Merkle link.
- [x] **Full-Chain Integrity Verification Algorithm:** Audits all organization records sequentially, verifying both `prevHash` linkages and payload signatures, with instant detection of modified, injected, or deleted blocks.
- [x] **Tamper Breach Alerting:** Identifies the precise breached record ID and delta signature when direct database alterations occur.

#### C. Compliance Retention Engine & Legal Holds
- [x] **Automated Lifecycle Seeding:** Templates for SOC-2 (Audit Logs: 7 years), toolchain webhooks (90 days), and inbox items (1 year).
- [x] **Legal Hold Freeze Guard:** Overrides retention rules during litigation or active regulatory audits, strictly blocking automated purges.
- [x] **Compliance Purge Worker:** Safely prunes expired integration events and processed inbox items, logging immutable `DATA_RETENTION_PURGE` audit records.

#### D. GDPR Data Subject Rights (Articles 17 & 20) & Legal Discovery
- [x] **Article 20 Data Portability Takeout:** Compiles comprehensive JSON portability bundles including profile, tasks, notes, followups, and DevEx pulses.
- [x] **Article 17 Right-to-be-Forgotten:** Anonymizes user PII (`displayName`, `email`, wipes `passwordHash`, revokes refresh tokens, marks `isActive: false`) while preserving relational integrity and logging `GDPR_RIGHT_TO_ERASURE` in the Merkle audit trail.
- [x] **Legal e-Discovery Bundles:** Gathers decisions, audit logs, meeting records, and retention policies with expiration tracking.

#### E. Frontend Security & Compliance Center (`/compliance`)
- [x] **Audit Trail Tab:** Cryptographic verification banner with "Verify Merkle Chain" button, action & entity filters, live event stream, and expandable JSON delta inspector.
- [x] **Data Retention & Legal Holds Tab:** Policy duration selector, action configuration modal, visual Legal Hold freeze toggle, and "Run Purge Now" action with execution summary.
- [x] **GDPR & Legal Discovery Tab:** Machine-readable takeout export modal, Right-to-be-Forgotten erasure modal with double confirmation, and Compliance Exports history table with direct download actions.
- [x] **Global Shell Integration:** Added "Audit & Compliance" shield navigation item in sidebar layout.

---

### Phase 6 (Sprint 19): AI Decision Intelligence 2.0 & Vector Memory ✅

#### A. Database Schema Additions
- [x] **SemanticMemory Model:** 64-dimensional dense semantic vector storage (`embedding Float[]`, `entityType`, `entityId`, `title`, `content`, `metadata Json?`, `orgId`).
- [x] **OneOnOneAgenda Model:** Proactive 1-on-1 meeting synthesis (`leadId`, `memberId`, `status`: `DRAFT` / `FINALIZED` / `COMPLETED`, `scheduledFor`, `talkingPoints Json`, `actionItems Json?`, `notes String?`).
- [x] **QuarterlyReview Model:** Executive retrospective & QBR reports (`quarter`, `title`, `executiveSummary`, `doraSummary Json`, `okrSummary Json`, `reliabilitySummary Json`, `devexSummary Json`, `strategicPriorities String[]`).

#### B. Dense Semantic Vector Memory & Cosine Similarity Engine
- [x] **64-Dimensional Semantic Embedding Engine:** L2-normalized dense vector generator mapping architecture concepts, tech stacks, and domain terms into continuous vector space.
- [x] **Cosine Similarity Mathematical Dot-Product Search:** High-performance in-memory vector ranking across tenant documents with similarity thresholding and top-$k$ retrieval.
- [x] **Automated Core Entity Synchronizer:** Automatically indexes existing architectural decisions, incident post-mortems, design notes, and engineering policies into vector memory.

#### C. Grounded Architecture Decision RAG Assistant
- [x] **Grounded Question Answering:** Synthesizes clear technical answers to complex architecture, incident, and policy queries with zero hallucination.
- [x] **Verbatim Citations & Evidence:** Provides source artifact citations (`[DECISION]`, `[INCIDENT]`, `[NOTE]`, `[POLICY]`) with reference IDs, titles, and exact textual excerpts.
- [x] **Grounded Confidence Metric:** Scores answer grounding based on retrieved vector similarity distance.

#### D. Proactive 1-on-1 Agenda Copilot
- [x] **Cross-System Telemetry Correlation:** Pulls active Jira tasks/backlog, GitHub pull request review latencies, and DevEx pulse sentiment into prioritized talking points.
- [x] **Categorized Topics:** Automatically organizes agenda into:
  - 📌 `PROJECT_STATUS`: Active tasks, deliverables, milestone progress.
  - ⚠️ `BLOCKERS_AND_SLA`: Stale PR reviews, pipeline blockers, SLA risks.
  - 💚 `WELLBEING_AND_DEVEX`: Burnout indicators, on-call alert load, morale score.
  - 🚀 `CAREER_AND_GROWTH`: Strategic roadmap, technical mentorship, promotion alignment.
- [x] **Bilateral Action Items & Meeting Notes:** Interactive checklist and shared collaborative notes.

#### E. Quarterly Retrospective & QBR Generator
- [x] **90-Day Telemetry Synthesis:** Aggregates rolling DORA 4 metrics, cascading OKR completion percentages, production incident MTTR and outage minutes, and DevEx wellbeing surveys.
- [x] **Executive Summary & Strategic Priorities:** Generates actionable board-ready narrative and next-quarter strategic objectives.
- [x] **Markdown Export:** One-click copy for Slack, Confluence, or executive briefing decks.

#### F. Frontend AI Decision Center (`/ai-decision`)
- [x] **Architecture Decision RAG Tab:** Modern AI hero search console, quick prompt suggestion pills, grounded answer card with confidence badge, interactive citation cards, and "Index Document" modal.
- [x] **1-on-1 Agenda Copilot Tab:** Engineer selector, date picker, context input, 4-category talking points grid, interactive action items checklist, and meeting notes editor.
- [x] **Executive Retrospective & QBR Tab:** Quarter selector, DORA 4 quadrant, OKR achievement meters, reliability/outage retro, DevEx health breakdown, and markdown export.
- [x] **Vector Memory Explorer Tab:** Raw dense vector inspection with cosine similarity match indicators.
- [x] **Global Shell Integration:** Added "AI Decisions & RAG" (`pi pi-sparkles`) navigation link in sidebar layout.

---

## 5. Full V3 Enterprise Sprint Roadmap

```
Sprint 14 (Phase 1) ──► Sprint 15 (Phase 2) ──► Sprint 16 (Phase 3)
Multi-Tenancy & RBAC    SAML 2.0 & SCIM Sync    Toolchain Event Mesh
- Org/Workspace Models  - Okta & Azure SAML      - GitHub PR Watchdog
- Squad Hierarchy Tree  - SCIM User Provisioning - 2-Way Jira/Linear Sync
- Role Permission Guard - Session & IP Security  - Slack/Teams App & Bot

          │                     │                     │
          ▼                     ▼                     ▼

Sprint 17 (Phase 4) ──► Sprint 18 (Phase 5) ──► Sprint 19 (Phase 6)
EngOps & DORA Metrics   SOC-2 Audit & Security   AI Decision RAG
- DORA 4 Dashboards     - Tamper-Evident Logs    - Vector Search (pgvector)
- DevEx Burnout Radar   - Retention & GDPR Purge - 1-on-1 Agenda Copilot
- Cascading Team OKRs   - Legal e-Discovery Zip  - QBR & Retro Generator
```

---

## 6. Definition of Done for LeadDesk V3 Enterprise

The LeadDesk V3 Enterprise release is certified production-ready when:
1. **Multi-Tenancy Isolation:** Multiple organizations operate completely isolated in the same cluster with zero data leakage across tenant perimeters.
2. **Enterprise SSO & Directory Sync:** Users log in via Okta or Azure AD SAML, and accounts are automatically provisioned or de-provisioned via SCIM 2.0.
3. **Engineering Graph Sync:** GitHub PR review latency and Jira ticket transitions sync bi-directionally in under 2 seconds.
4. **DORA Visibility:** Engineering Directors can inspect team-level deployment frequency and MTTR in real-time.
5. **Audit Integrity:** 100% of state-mutating actions produce immutable records in the `AuditLog` table.
6. **Decision RAG Accuracy:** The AI Decision Assistant accurately answers historical architecture questions with direct citations to logged decisions and meeting notes.
