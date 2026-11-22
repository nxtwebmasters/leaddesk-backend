# LeadDesk — Complete Solution Plan, Architecture Blueprint & Product Roadmap

**Document Type:** Master Product Requirements Document (PRD), Technical Blueprint & Development Roadmap  
**Product:** LeadDesk — Personal Leadership Command Center  
**Target User (Initial):** Engineering Team Lead / Technical Manager (Single Owner)  
**Document Version:** 2.0 (Consolidated & Architecture Finalized)  
**Status:** Approved for Implementation  
**Primary Platform:** Responsive Web Application / Progressive Web App (PWA)  

---

## Table of Contents
1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [Product Vision & Core Principles](#2-product-vision--core-principles)
3. [Confirmed Architecture Decisions & Technology Stack](#3-confirmed-architecture-decisions--technology-stack)
4. [Monorepo Repository Structure](#4-monorepo-repository-structure)
5. [Core Functional Modules (MVP 1 Scope)](#5-core-functional-modules-mvp-1-scope)
   - 5.1 [Dashboard & My Day](#51-dashboard--my-day)
   - 5.2 [Quick Capture & Inbox Processing](#52-quick-capture--inbox-processing)
   - 5.3 [Task & To-Do Management](#53-task--to-do-management)
   - 5.4 [Follow-up & Commitment Tracker](#54-follow-up--commitment-tracker)
   - 5.5 [Meetings, Discussions & Decision Log](#55-meetings-discussions--decision-log)
   - 5.6 [Notes & Knowledge Repository](#56-notes--knowledge-repository)
   - 5.7 [Calendar & Reminders](#57-calendar--reminders)
6. [Offline-First Capture, Voice & Notifications UX](#6-offline-first-capture-voice--notifications-ux)
7. [Database Design & Complete Prisma Schema](#7-database-design--complete-prisma-schema)
8. [REST API Contracts & Endpoints Specification](#8-rest-api-contracts--endpoints-specification)
9. [Docker & Local Development Blueprint](#9-docker--local-development-blueprint)
10. [Features Deliberately Excluded from MVP 1](#10-features-deliberately-excluded-from-mvp-1)
11. [Multi-Phase Strategic Roadmap (MVP 1 through Long-Term Vision)](#11-multi-phase-strategic-roadmap)
12. [Comprehensive Development Backlog & Actionable To-Dos](#12-comprehensive-development-backlog--actionable-to-dos)
13. [MVP 1 Definition of Done & Acceptance Criteria](#13-mvp-1-definition-of-done--acceptance-criteria)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
As software engineers transition into leadership roles (Team Lead, Engineering Manager), their daily operational challenge shifts from writing code to coordinating people, managing technical decisions, communicating with clients, and tracking deliverables across disparate channels.

Information and commitments become severely fragmented across:
- **Chat tools:** Microsoft Teams, Slack conversations and group channels.
- **Ticketing & Planning:** Jira tickets, sprint boards, release backlogs.
- **Communication:** Outlook/Gmail threads, calendar invites.
- **Documentation:** Outline, Confluence, Google Docs, technical architecture notes.
- **Ad-hoc interactions:** Verbal commitments made in standups, hallway conversations, or one-on-ones.
- **Personal notes:** Scattered notebooks, sticky notes, scratchpads, and desktop to-do apps.

This fragmentation leads to:
1. **Forgotten Commitments:** Tasks discussed in meetings are lost once the call ends.
2. **Follow-up Blindness:** No centralized way to track who owes what (waiting on client approval, QA verification, DevOps deployment, developer updates).
3. **High Cognitive Overhead:** Mental energy is wasted trying to remember what needs follow-up instead of focusing on high-value leadership decisions.
4. **Context Switching:** Repeatedly searching across multiple applications simply to understand what requires attention today.

### 1.2 The Solution: LeadDesk
LeadDesk is a **Personal Leadership Command Center** designed to consolidate daily responsibilities, stakeholder commitments, meeting decisions, and follow-ups into a unified, high-speed workspace.

LeadDesk operates on a fundamental distinction that standard to-do applications lack:
- **My Tasks:** Work that the Team Lead must personally execute.
- **Delegated Tasks:** Work assigned to team members, tracked with expected dates without requiring them to have accounts.
- **Waiting For:** External dependencies, client feedback, management sign-offs, or blockers.
- **Follow-ups:** Scheduled commitments to check in with specific stakeholders at specific times.

---

## 2. Product Vision & Core Principles

### 2.1 Vision Statement
> *"To build an intelligent personal command center that helps leaders capture everything that matters, stay on top of commitments, make better decisions, and execute responsibilities with clarity and confidence."*

### 2.2 Core Product Philosophy
```
Capture everything. Organize automatically. Act on priorities. Never lose context.
```

### 2.3 Product Principles
1. **Capture First:** Recording information must take 5–10 seconds. Never force the user to fill out mandatory metadata fields before saving a thought, commitment, or note.
2. **One Source of Personal Truth:** LeadDesk is the personal operational source of truth. It tracks commitments and references external systems (Jira, Teams, Outlook) without attempting to replace them.
3. **Action-Oriented Context:** Maintain clean separation between discussion notes, concrete decisions, and actionable tasks.
4. **Mobile Capture, Desktop Management:**
   - *Mobile / PWA:* Optimized for one-tap quick capture, voice capture, reviewing today's agenda, and updating follow-up statuses on the move.
   - *Desktop:* Optimized for deep organization, daily planning, meeting minutes review, and knowledge synthesis.
5. **Incremental Simplicity:** Avoid premature microservices, complex multi-tenancy, or opaque AI automation in early releases. Build rock-solid personal workflows first.

---

## 3. Confirmed Architecture Decisions & Technology Stack

Following architectural reviews, LeadDesk is tailored specifically as a **single-owner, lightweight modular monolith** compatible with existing deployment patterns (such as HRM and HMS stacks).

| Layer | Selected Technology | Architecture Justification |
|---|---|---|
| **Frontend** | **Angular 20+** | Modern standalone components, Signals for state management, strict TypeScript. |
| **Styling & UI** | **Tailwind CSS + PrimeNG** | Rapid utility-first styling combined with robust data tables, dialogs, calendar pickers, and menus. |
| **Mobile / PWA** | **Angular Service Worker (`@angular/pwa`)** | App shell caching, mobile installability, fast startup on smartphones. |
| **Offline Storage** | **IndexedDB (via `idb` / custom wrapper)** | Client-side queue for zero-latency offline text capture with background sync. |
| **Backend** | **Node.js + Express (TypeScript)** | Modular monolith; simple, predictable, and robust. High reusability with existing infrastructure. |
| **ORM** | **Prisma ORM** | Type-safe database queries, declarative schema definition, deterministic migrations. |
| **Database** | **PostgreSQL (v15+)** | Relational integrity, native UUIDs, JSONB support for lightweight flexible metadata, ACID compliance. |
| **Authentication** | **JWT (Access + Refresh Token Rotation)** | Single-owner bootstrap; short-lived access JWT (15m), HttpOnly rotating refresh token (30d). |
| **API Architecture** | **RESTful API (`/api/v1`)** | Clear domain-driven routing, Zod schema validation, uniform envelope responses. |
| **API Documentation** | **OpenAPI / Swagger** | Interactive API exploration and client contract generation. |
| **File Storage** | **Provider-Neutral Storage Adapter** | Clean abstract interface for local disk in development, seamlessly swapped to existing storage in production. |
| **Packaging** | **Docker & Docker Compose** | Reproducible multi-stage containers for PostgreSQL, Express API, and Angular (served via Nginx). |

---

## 4. Multi-Repository Structure

The project follows the established HRM/HMS architecture pattern with three dedicated GitHub repositories under the root workspace:
- **Backend Repo:** `https://github.com/nxtwebmasters/leaddesk-backend.git`
- **Frontend Repo:** `https://github.com/nxtwebmasters/leaddesk-frontend.git`
- **Deployment & Skeleton Repo:** `https://github.com/nxtwebmasters/leaddesk-skeleton-project.git`

```
lead-desk/                                  # Root Workspace
├── solution-plan/
│   └── solution-plan.md                   # Master PRD, Architecture & Roadmap
├── leaddesk-backend/                      # GitHub: nxtwebmasters/leaddesk-backend
│   ├── prisma/
│   │   ├── schema.prisma                  # Master database schema
│   │   ├── migrations/                    # Database migrations
│   │   └── seed.ts                        # Single-owner initial bootstrap script
│   ├── src/
│   │   ├── config/                        # Environment variables, constants
│   │   ├── common/                        # Middleware (auth, error-handler, validation, rate-limiter)
│   │   ├── modules/                       # Domain feature modules
│   │   │   ├── auth/                      # Login, token rotation, password change
│   │   │   ├── dashboard/                 # Dashboard metrics, My Day aggregator
│   │   │   ├── inbox/                     # Quick capture, offline sync, conversion engine
│   │   │   ├── tasks/                     # Task CRUD, subtasks, delegation, waiting-for
│   │   │   ├── followups/                 # Follow-up tracker, snooze, completion
│   │   │   ├── meetings/                  # Meetings, discussion notes, decisions, actions
│   │   │   ├── notes/                     # Knowledge notes, tagging, full-text search
│   │   │   ├── calendar/                  # Calendar events, day/week view
│   │   │   ├── reminders/                 # Scheduled reminder workers
│   │   │   └── attachments/               # Storage adapter & file upload handling
│   │   ├── storage/                       # Storage provider interface and implementations
│   │   ├── app.ts                         # Express application configuration
│   │   └── server.ts                      # Server entry point
│   ├── Dockerfile
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.example
├── leaddesk-frontend/                     # GitHub: nxtwebmasters/leaddesk-frontend (Angular 20+ PWA)
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/                      # Auth interceptors, guards, API client service
│   │   │   ├── shared/                    # Common UI components, pipes, PrimeNG modules
│   │   │   ├── layout/                    # App shell, desktop sidebar, mobile navigation, floating capture
│   │   │   └── features/                  # Feature pages
│   │   │       ├── dashboard/             # Daily agenda, overdue stats, waiting-for list
│   │   │       ├── inbox/                 # Quick capture list, conversion modal
│   │   │       ├── tasks/                 # Kanban / List view, filters (Personal, Delegated, Waiting)
│   │   │       ├── followups/             # Follow-up tracker, contact history
│   │   │       ├── meetings/              # Meeting notes editor, decisions & action extractor
│   │   │       ├── notes/                 # Knowledge base, markdown renderer, tags
│   │   │       ├── calendar/              # Calendar view
│   │   │       └── settings/              # Timezone, preferences, profile
│   │   ├── assets/
│   │   └── environments/
│   ├── nginx/
│   │   └── default.conf                   # Production Nginx reverse proxy configuration
│   ├── Dockerfile
│   ├── angular.json
│   ├── tailwind.config.js
│   └── package.json
└── leaddesk-skeleton-project/             # GitHub: nxtwebmasters/leaddesk-skeleton-project
    ├── docker-compose.yml                 # Local development & production orchestration
    ├── docker-compose.prod.yml            # Production deployment overrides
    ├── nginx/                             # Reverse proxy / gateway configuration
    │   └── nginx.conf
    ├── scripts/                           # Deploy, backup, restore, database migration scripts
    │   ├── deploy.sh
    │   ├── backup-db.sh
    │   └── restore-db.sh
    ├── .env.example                       # Unified deployment environment variables
    └── README.md
```

---

## 5. Core Functional Modules (MVP 1 Scope)

### 5.1 Dashboard & My Day
The home screen serves as the daily operational cockpit, instantly answering:
1. *What do I need to achieve today?*
2. *What is overdue?*
3. *Who am I waiting for?*
4. *What follow-ups are due today?*
5. *What meetings are scheduled?*

**Core Components:**
- **Metrics Bar:** Unprocessed inbox items, tasks due today, overdue items, follow-ups due, today's meetings.
- **Top 3 Priorities:** User-curated focal tasks for the active day.
- **Overdue Alert Section:** Visually prominent list of overdue tasks and missed follow-ups with one-click reschedule or complete.
- **Waiting-For Panel:** Items blocked on external team members, clients, or approvals.
- **Today's Agenda:** Chronological list of meetings and time-blocked activities.

### 5.2 Quick Capture & Inbox Processing
The most critical module for user adoption. The user should never have to navigate multiple menus to record a thought or commitment.
- **Global Availability:** Accessible via floating action button (FAB) on mobile, and a global keyboard shortcut (`Ctrl+K` or `Ctrl+Space`) on desktop.
- **Frictionless Input:** Save raw text immediately without mandatory category, date, or tags.
- **Capture Types:** `TASK`, `NOTE`, `REMINDER`, `MEETING`, `DISCUSSION`, `IDEA`, `DECISION`, `FOLLOW_UP`.
- **Conversion Engine:** One-click conversion of an inbox capture into a structured Task, Note, or Follow-up.
- **Traceability:** When an inbox item is converted, the system retains the original captured text and stores polymorphic pointers (`convertedEntityType`, `convertedEntityId`).

### 5.3 Task & To-Do Management
A task system specifically modeled around leadership responsibilities:
- **Task Types:**
  - `TASK`: Personal work to complete.
  - `DELEGATED`: Work handed off to a team member (tracks `assigneeName`, `assigneeEmail`, expected date).
  - `FOLLOW_UP`: An action requiring checking in with someone.
  - `PERSONAL`: Personal life / non-work items.
- **Task Lifecycle:**
  `INBOX` → `PLANNED` → `IN_PROGRESS` → `WAITING` → `COMPLETED` (Terminal: `CANCELLED`, `ARCHIVED`).
- **Subtasks:** Checklists inside tasks with ordering and completion state.
- **Rich Context:** Due date, priority (`LOW`, `MEDIUM`, `HIGH`, `URGENT`), source system references (`sourceUrl`, `sourceSystem` such as Jira or Teams), file attachments.

### 5.4 Follow-up & Commitment Tracker
Tracks commitments involving other people so nothing slips through the cracks.
- **Attributes:** Contact Name, Organization/Team, Reason/Subject, Context, Expected Response Date, Next Follow-up Date, Status (`OPEN`, `WAITING`, `COMPLETED`, `CANCELLED`).
- **Quick Actions:** Snooze (postpone follow-up to tomorrow or next week), mark completed with resolution notes.
- **Views:** Overdue follow-ups, follow-ups due today, upcoming check-ins.

### 5.5 Meetings, Discussions & Decision Log
Dedicated workspace for meeting hygiene and accountability:
- **Meeting Records:** Title, date/time, participants (JSON), project context, discussion notes (Markdown).
- **Explicit Decisions:** Separate table recording specific architectural, technical, or delivery decisions made during the meeting.
- **Action Item Extraction:** Extracted action items with designated owners and due dates, converted into tasks with a single click.

### 5.6 Notes & Knowledge Repository
Centralized knowledge repository for reference material:
- **Content:** Full Markdown support for technical notes, AWS architecture sketches, client preferences, and runbooks.
- **Organization:** Pinned notes, hierarchical tags, full-text search (`ILIKE` in MVP 1, PostgreSQL Full-Text Search ready).
- **Attachments:** PDF, images, or documents attached via the storage adapter.

### 5.7 Calendar & Reminders
- **Internal Calendar:** Day, Week, and Month view of tasks with due dates, meetings, and scheduled events.
- **Reminder Processing:** Background scheduler running in the Node.js backend checking for pending reminders and dispatching browser notifications.

---

## 6. Offline-First Capture, Voice & Notifications UX

### 6.1 Offline-First Quick Capture
To ensure instant mobile usability even with intermittent connectivity:
1. When capturing an item offline, the Angular Service Worker intercepts the request.
2. The item is saved to an **IndexedDB Capture Queue** with a client-generated UUID idempotency key.
3. A visual sync indicator informs the user that items are queued locally.
4. When network connectivity resumes (`window.addEventListener('online')`), the queue is automatically flushed to `POST /api/v1/inbox/sync`.
5. The backend validates idempotency keys to guarantee zero duplicates.

### 6.2 Voice Capture
- Native browser **Web Speech API** (`webkitSpeechRecognition` / `SpeechRecognition`) enables one-tap voice-to-text directly in the mobile quick-capture modal.
- Provides immediate text preview with full manual editing before submission.
- Graceful fallback: If Web Speech is unsupported or permission is denied, standard keyboard input is seamlessly active.

### 6.3 Notification Architecture
- **In-App Alerts:** Dynamic badges and notification center for due tasks and follow-ups.
- **Browser Web Notifications:** Opt-in browser notification permissions for critical reminders.
- **Backend Worker:** Scheduled cron process (`node-cron` or lightweight interval) querying pending reminders in PostgreSQL where `remindAt <= NOW()` and `status = 'PENDING'`.

---

## 7. Database Design & Complete Prisma Schema

The database design uses PostgreSQL with UUID primary keys, UTC timestamping, and comprehensive relational integrity.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==========================================
// ENUMS
// ==========================================

enum TaskStatus {
  INBOX
  PLANNED
  IN_PROGRESS
  WAITING
  COMPLETED
  CANCELLED
  ARCHIVED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TaskType {
  TASK
  DELEGATED
  FOLLOW_UP
  PERSONAL
}

enum InboxItemType {
  TASK
  NOTE
  REMINDER
  MEETING
  DISCUSSION
  IDEA
  DECISION
  FOLLOW_UP
}

enum InboxItemStatus {
  NEW
  PROCESSED
  DISMISSED
}

enum FollowUpStatus {
  OPEN
  WAITING
  COMPLETED
  CANCELLED
}

enum MeetingStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
}

enum ReminderStatus {
  PENDING
  SENT
  DISMISSED
}

enum CalendarEventType {
  MEETING
  PERSONAL
  TASK
  REMINDER
  OTHER
}

// ==========================================
// MODELS
// ==========================================

model User {
  id             String          @id @default(uuid()) @db.Uuid
  email          String          @unique
  passwordHash   String
  displayName    String
  timezone       String          @default("Asia/Karachi")
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  refreshTokens  RefreshToken[]
  inboxItems     InboxItem[]
  tasks          Task[]
  followUps      FollowUp[]
  meetings       Meeting[]
  notes          Note[]
  calendarEvents CalendarEvent[]
  reminders      Reminder[]
  attachments    Attachment[]

  @@map("users")
}

model RefreshToken {
  id         String    @id @default(uuid()) @db.Uuid
  tokenHash  String    @unique
  expiresAt  DateTime
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  userId     String    @db.Uuid
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

model InboxItem {
  id                  String          @id @default(uuid()) @db.Uuid
  content             String          @db.Text
  type                InboxItemType   @default(NOTE)
  status              InboxItemStatus @default(NEW)
  source              String?         @default("WEB") // WEB, MOBILE, VOICE, OFFLINE
  idempotencyKey      String?         @unique
  convertedEntityType String?         // TASK, NOTE, FOLLOW_UP, REMINDER
  convertedEntityId   String?         @db.Uuid
  capturedAt          DateTime        @default(now())
  processedAt         DateTime?
  createdAt           DateTime        @default(now())
  updatedAt           DateTime        @updatedAt

  userId              String          @db.Uuid
  user                User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status, capturedAt])
  @@map("inbox_items")
}

model Task {
  id             String          @id @default(uuid()) @db.Uuid
  title          String
  description    String?         @db.Text
  status         TaskStatus      @default(INBOX)
  priority       Priority        @default(MEDIUM)
  type           TaskType        @default(TASK)
  dueAt          DateTime?
  completedAt    DateTime?
  assigneeName   String?         // Manual delegation without multi-user accounts
  assigneeEmail  String?
  sourceUrl      String?         // Link to Jira / Teams / Outlook
  sourceSystem   String?         // JIRA, TEAMS, OUTLOOK, MANUAL
  sortOrder      Int             @default(0)
  archivedAt     DateTime?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  userId         String          @db.Uuid
  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  subtasks       Subtask[]
  followUps      FollowUp[]
  meetingActions MeetingAction[]
  tags           TaskTag[]
  reminders      Reminder[]
  attachments    Attachment[]

  @@index([userId, status, dueAt])
  @@index([userId, priority])
  @@index([userId, updatedAt])
  @@map("tasks")
}

model Subtask {
  id          String   @id @default(uuid()) @db.Uuid
  title       String
  isCompleted Boolean  @default(false)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  taskId      String   @db.Uuid
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId, sortOrder])
  @@map("subtasks")
}

model FollowUp {
  id              String         @id @default(uuid()) @db.Uuid
  contactName     String
  organization    String?
  subject         String
  context         String?        @db.Text
  expectedOutcome String?        @db.Text
  status          FollowUpStatus @default(OPEN)
  lastContactedAt DateTime?
  nextFollowUpAt  DateTime
  completedAt     DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  userId          String         @db.Uuid
  user            User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  taskId          String?        @db.Uuid
  task            Task?          @relation(fields: [taskId], references: [id], onDelete: SetNull)

  meetingId       String?        @db.Uuid
  meeting         Meeting?       @relation(fields: [meetingId], references: [id], onDelete: SetNull)

  @@index([userId, status, nextFollowUpAt])
  @@map("follow_ups")
}

model Meeting {
  id             String          @id @default(uuid()) @db.Uuid
  title          String
  description    String?         @db.Text
  status         MeetingStatus   @default(SCHEDULED)
  startedAt      DateTime
  endedAt        DateTime?
  location       String?
  meetingUrl     String?
  participants   Json?           // Array of { name: string, email?: string, role?: string }
  notesMarkdown  String?         @db.Text
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt

  userId         String          @db.Uuid
  user           User            @relation(fields: [userId], references: [id], onDelete: Cascade)

  actions        MeetingAction[]
  decisions      Decision[]
  followUps      FollowUp[]
  reminders      Reminder[]

  @@index([userId, startedAt])
  @@map("meetings")
}

model MeetingAction {
  id          String    @id @default(uuid()) @db.Uuid
  title       String
  ownerName   String?
  dueAt       DateTime?
  isCompleted Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  meetingId   String    @db.Uuid
  meeting     Meeting   @relation(fields: [meetingId], references: [id], onDelete: Cascade)

  taskId      String?   @db.Uuid
  task        Task?     @relation(fields: [taskId], references: [id], onDelete: SetNull)

  @@index([meetingId])
  @@map("meeting_actions")
}

model Decision {
  id          String   @id @default(uuid()) @db.Uuid
  title       String
  description String?  @db.Text
  decidedAt   DateTime @default(now())
  createdAt   DateTime @default(now())

  meetingId   String   @db.Uuid
  meeting     Meeting  @relation(fields: [meetingId], references: [id], onDelete: Cascade)

  @@index([meetingId, decidedAt])
  @@map("decisions")
}

model Note {
  id          String       @id @default(uuid()) @db.Uuid
  title       String
  content     String       @db.Text
  isPinned    Boolean      @default(false)
  sourceUrl   String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  userId      String       @db.Uuid
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  tags        NoteTag[]
  attachments Attachment[]

  @@index([userId, updatedAt])
  @@map("notes")
}

model Tag {
  id        String    @id @default(uuid()) @db.Uuid
  name      String    @unique
  createdAt DateTime  @default(now())

  tasks     TaskTag[]
  notes     NoteTag[]

  @@map("tags")
}

model TaskTag {
  taskId String @db.Uuid
  tagId  String @db.Uuid

  task   Task   @relation(fields: [taskId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([taskId, tagId])
  @@map("task_tags")
}

model NoteTag {
  noteId String @db.Uuid
  tagId  String @db.Uuid

  note   Note   @relation(fields: [noteId], references: [id], onDelete: Cascade)
  tag    Tag    @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([noteId, tagId])
  @@map("note_tags")
}

model CalendarEvent {
  id          String            @id @default(uuid()) @db.Uuid
  title       String
  description String?           @db.Text
  eventType   CalendarEventType @default(OTHER)
  startAt     DateTime
  endAt       DateTime?
  allDay      Boolean           @default(false)
  sourceUrl   String?
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  userId      String            @db.Uuid
  user        User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, startAt])
  @@map("calendar_events")
}

model Reminder {
  id        String         @id @default(uuid()) @db.Uuid
  title     String
  remindAt  DateTime
  status    ReminderStatus @default(PENDING)
  sentAt    DateTime?
  createdAt DateTime       @default(now())

  userId    String         @db.Uuid
  user      User           @relation(fields: [userId], references: [id], onDelete: Cascade)

  taskId    String?        @db.Uuid
  task      Task?          @relation(fields: [taskId], references: [id], onDelete: Cascade)

  meetingId String?        @db.Uuid
  meeting   Meeting?       @relation(fields: [meetingId], references: [id], onDelete: Cascade)

  @@index([userId, status, remindAt])
  @@map("reminders")
}

model Attachment {
  id         String   @id @default(uuid()) @db.Uuid
  fileName   String
  mimeType   String
  sizeBytes  BigInt
  storageKey String   @unique
  createdAt  DateTime @default(now())

  userId     String   @db.Uuid
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  taskId     String?  @db.Uuid
  task       Task?    @relation(fields: [taskId], references: [id], onDelete: Cascade)

  noteId     String?  @db.Uuid
  note       Note?    @relation(fields: [noteId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("attachments")
}
```

---

## 8. REST API Contracts & Endpoints Specification

All endpoints are versioned under `/api/v1` and protected by JWT authentication (except `/auth/login` and `/auth/refresh`).

### 8.1 Standard Response Envelopes
**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request payload contains invalid fields.",
    "details": [
      { "field": "dueAt", "issue": "Expected valid ISO-8601 date string" }
    ]
  }
}
```

### 8.2 Endpoint Inventory

| Module | Method | Endpoint | Description |
|---|---|---|---|
| **Auth** | `POST` | `/api/v1/auth/login` | Authenticate single owner, return access JWT + set HttpOnly refresh cookie. |
| | `POST` | `/api/v1/auth/refresh` | Rotate refresh token and issue new access JWT. |
| | `POST` | `/api/v1/auth/logout` | Revoke current refresh token and clear cookie. |
| | `GET` | `/api/v1/auth/me` | Fetch owner profile, timezone, and configuration. |
| | `POST` | `/api/v1/auth/change-password` | Update owner password. |
| **Dashboard** | `GET` | `/api/v1/dashboard` | Aggregated counts: overdue tasks, follow-ups due, today's meetings, inbox count. |
| | `GET` | `/api/v1/dashboard/my-day?date=YYYY-MM-DD` | Aggregated agenda: today's tasks, meetings, due follow-ups. |
| **Inbox** | `POST` | `/api/v1/inbox` | Instant quick capture (text, optional type/source). |
| | `GET` | `/api/v1/inbox` | List unprocessed or dismissed inbox items. |
| | `PATCH` | `/api/v1/inbox/:id` | Edit raw captured content. |
| | `POST` | `/api/v1/inbox/:id/convert` | Polymorphic conversion: create Task, Note, or Follow-up & mark item processed. |
| | `POST` | `/api/v1/inbox/:id/dismiss` | Mark item dismissed without converting. |
| | `POST` | `/api/v1/inbox/sync` | Batch submit queued offline captures with idempotency keys. |
| **Tasks** | `POST` | `/api/v1/tasks` | Create structured task with priority, status, due date, assignee. |
| | `GET` | `/api/v1/tasks` | List/filter tasks (`status`, `priority`, `type`, `dueFrom`, `dueTo`, `search`). |
| | `GET` | `/api/v1/tasks/:id` | Retrieve task details with subtasks, tags, attachments, follow-ups. |
| | `PATCH` | `/api/v1/tasks/:id` | Update task fields. |
| | `PATCH` | `/api/v1/tasks/:id/status` | Quick status transition (`PLANNED`, `IN_PROGRESS`, `WAITING`, `COMPLETED`). |
| | `DELETE` | `/api/v1/tasks/:id` | Soft delete / archive task. |
| | `POST` | `/api/v1/tasks/:id/subtasks` | Add a subtask checklist item. |
| | `PATCH` | `/api/v1/tasks/:id/subtasks/:subtaskId` | Toggle subtask completion or edit title. |
| | `DELETE` | `/api/v1/tasks/:id/subtasks/:subtaskId` | Remove subtask. |
| **Follow-ups** | `POST` | `/api/v1/followups` | Record a follow-up commitment with a stakeholder. |
| | `GET` | `/api/v1/followups` | Filter follow-ups (`status=OPEN`, `overdue=true`, `dueToday=true`). |
| | `PATCH` | `/api/v1/followups/:id` | Update follow-up details or next date. |
| | `POST` | `/api/v1/followups/:id/complete` | Mark follow-up completed with resolution notes. |
| | `POST` | `/api/v1/followups/:id/snooze` | Quick reschedule (`+1 day`, `+3 days`, `+1 week`). |
| **Meetings** | `POST` | `/api/v1/meetings` | Schedule or record a meeting. |
| | `GET` | `/api/v1/meetings` | List meetings with filtering by date range. |
| | `GET` | `/api/v1/meetings/:id` | Retrieve meeting with full markdown notes, decisions, and action items. |
| | `PATCH` | `/api/v1/meetings/:id` | Update meeting details and markdown notes. |
| | `POST` | `/api/v1/meetings/:id/actions` | Add action item (can optionally auto-create linked Task). |
| | `POST` | `/api/v1/meetings/:id/decisions` | Log an explicit technical or product decision. |
| **Notes** | `POST` | `/api/v1/notes` | Create a markdown knowledge note. |
| | `GET` | `/api/v1/notes` | List notes with tag filters, pinned notes first, full-text search. |
| | `GET` | `/api/v1/notes/:id` | Retrieve note details. |
| | `PATCH` | `/api/v1/notes/:id` | Update note content or toggle pinned status. |
| | `DELETE` | `/api/v1/notes/:id` | Delete note. |
| **Calendar** | `GET` | `/api/v1/calendar` | Unified events stream (`startAt`, `endAt`) aggregating tasks & meetings. |
| | `POST` | `/api/v1/calendar` | Create independent personal calendar event. |
| **Reminders** | `GET` | `/api/v1/reminders` | List upcoming scheduled reminders. |
| | `POST` | `/api/v1/reminders` | Create reminder linked to a task or meeting. |
| **Attachments**| `POST` | `/api/v1/attachments` | Upload file (multipart/form-data) via StorageProvider. |
| | `GET` | `/api/v1/attachments/:id` | Get secure download URL or stream content. |

---

## 9. Docker & Local Development Blueprint

All deployment, containerization, and orchestration scripts reside in **`leaddesk-skeleton-project/`**, maintaining parity with your existing HRM and HMS deployment configurations.

### 9.1 `leaddesk-skeleton-project/docker-compose.yml`
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: leaddesk-postgres
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER:-leaddesk}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-leaddesk_secret}
      POSTGRES_DB: ${DB_NAME:-leaddesk_dev}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-leaddesk} -d ${DB_NAME:-leaddesk_dev}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ../leaddesk-backend
      dockerfile: Dockerfile
    container_name: leaddesk-backend
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: development
      PORT: 4000
      DATABASE_URL: postgresql://${DB_USER:-leaddesk}:${DB_PASSWORD:-leaddesk_secret}@postgres:5432/${DB_NAME:-leaddesk_dev}?schema=public
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET:-access_secret_for_local_dev_only_32_chars_min}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:-refresh_secret_for_local_dev_only_32_chars_min}
      STORAGE_DRIVER: local
      STORAGE_LOCAL_PATH: /app/uploads
      CORS_ORIGIN: http://localhost:4200
    ports:
      - "4000:4000"
    volumes:
      - ../leaddesk-backend:/app
      - /app/node_modules
      - backend_uploads:/app/uploads

  frontend:
    build:
      context: ../leaddesk-frontend
      dockerfile: Dockerfile
    container_name: leaddesk-frontend
    restart: unless-stopped
    ports:
      - "4200:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  backend_uploads:
```

### 9.2 `.env.example`
```ini
# Application
NODE_ENV=development
PORT=4000
APP_URL=http://localhost:4200

# Database
DATABASE_URL="postgresql://leaddesk:leaddesk_secret@localhost:5432/leaddesk_dev?schema=public"

# Authentication (Ensure 256-bit secure strings in production)
JWT_ACCESS_SECRET="your-super-secret-jwt-access-token-key-change-in-production"
JWT_REFRESH_SECRET="your-super-secret-jwt-refresh-token-key-change-in-production"
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="30d"

# Default Owner Bootstrap (Used on first database seed)
INITIAL_OWNER_EMAIL="lead@example.com"
INITIAL_OWNER_PASSWORD="ChangeMeImmediately123!"
INITIAL_OWNER_NAME="Team Lead"
INITIAL_OWNER_TIMEZONE="Asia/Karachi"

# File Storage Configuration
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH="./uploads"

# CORS
CORS_ORIGIN="http://localhost:4200"
```

---

## 10. Features Deliberately Excluded from MVP 1

To protect the delivery schedule (7–9 weeks) and ensure rock-solid personal adoption, the following items are **strictly deferred**:

| Feature / Domain | MVP 1 Treatment | Scheduled Release | Justification |
|---|---|---|---|
| **Multiple User Accounts & RBAC** | Single-owner bootstrap only | MVP 3 | Premature multi-tenancy adds significant permission & schema complexity. |
| **Team Workspaces & Sharing** | Excluded | MVP 3 | The initial user is the sole operator. |
| **Jira API Live Synchronization** | Manual links (`sourceUrl`) | MVP 2 | Avoid OAuth & bi-directional sync edge cases before internal workflow is tested. |
| **Microsoft Teams Bot / Graph API** | Manual text capture | MVP 2 | Permissions and enterprise tenant approvals cause long blockers. |
| **Outlook / Gmail Two-Way Sync** | Manual capture | MVP 2 | Email ingestion creates massive noise without strict filtering. |
| **External Google/Outlook Calendar Sync**| Internal calendar only | MVP 2 | Calendar conflict resolution & recurring event sync requires dedicated engineering. |
| **Autonomous AI Agents & Execution** | Excluded | MVP 4 | AI must never silently change statuses or create commitments without explicit confirmation. |
| **Automatic AI Meeting Summaries** | Excluded | MVP 4 | Personal transcription & LLM pipelines deferred until text hygiene is proven. |

---

## 11. Multi-Phase Strategic Roadmap

```mermaid
flowchart LR
    A["MVP 1: Personal Foundation<br/>(Weeks 1-8)"] --> B["MVP 2: Connected Productivity<br/>(Integrations & Smart Capture)"]
    B --> C["MVP 3: Leadership & Team Management<br/>(Multi-user & Delegated Accountability)"]
    C --> D["MVP 4: Intelligent Command Center<br/>(AI Assistant & Proactive Intelligence)"]
```

### 11.1 Phase 1 — MVP 1: Personal Productivity Foundation (Current Target)
- **Goal:** Solve personal information fragmentation and eliminate forgotten commitments.
- **Deliverables:** Single-owner JWT auth, PWA app shell, quick capture (text + voice), inbox conversion engine, task management (personal vs. delegated vs. waiting), follow-up tracker, meeting notes with decisions/action items, personal knowledge repository, daily planning dashboard, offline IndexedDB capture queue, Docker setup.
- **Success Criteria:** The Team Lead uses LeadDesk daily without relying on notebooks, sticky notes, or ad-hoc reminder apps.

### 11.2 Phase 2 — MVP 2: Connected Productivity, Smart Assistance & Leadership Visibility
*(Detailed technical plan available in [mvp2-execution-plan.md](mvp2-execution-plan.md))*
- **Goal:** Evolve from a personal repository into an active intelligence and leadership command center.
- **Deliverables:**
  - **Smart AI Capture & NLP Decomposition:** Auto-decompose mixed thoughts into discrete tasks, follow-ups, and decisions with 1-click batch confirmation.
  - **Team & Contact Directory + 360° Dossiers:** Maintain directory of stakeholders/devs; 1-click view of all delegated tasks, follow-ups, and 1-on-1 notes for any person.
  - **Interactive Calendar Hub:** Full Month, Week, and Day calendar with drag-and-drop rescheduling and secure iCal feed subscription.
  - **Scheduled Reminders & Web Push:** Background cron runner sending morning kickoff digests, 15-min meeting warnings, and end-of-day follow-up sweeps.
  - **File & Image Attachments:** Secure local/S3 asset storage for runbook PDFs, architecture diagrams, and meeting slides.
  - **Global Omni-Search Palette (`Ctrl+P`):** Spotlight modal searching across all entities simultaneously in < 300ms.
  - **Executive Weekly Digest Generator:** 1-click formatted Markdown/PDF report for sprint retrospectives and management 1-on-1s.

### 11.3 Phase 3 — MVP 3: Leadership & Team Management
- **Goal:** Expand from a personal tool into team visibility and shared accountability.
- **Deliverables:**
  - Workspaces, user invitations, role-based access control (Owner, Member, Viewer).
  - True delegation: assign tasks to registered team members with real-time status updates.
  - Team workload distribution view and blocker heatmap.
  - Shared meeting minutes with assigned team action items and automated notifications.
  - Team-level delivery risk alerts.

### 11.4 Phase 4 — MVP 4: Intelligent Assistant & Command Center
- **Goal:** Transform LeadDesk into a proactive, context-aware command center.
- **Deliverables:**
  - **Intelligent Capture:** Natural language parsing (`"Discuss database optimization with DevOps next Tuesday and follow up with Sheraz"` -> automatically parses 2 tasks, assigns dates, and identifies stakeholders).
  - **Meeting Audio Summarization:** Speech-to-text pipeline extracting decisions, risks, and action items.
  - **Daily AI Executive Briefing:** Morning summary highlighting critical deadlines, neglected follow-ups, and potential delivery bottlenecks.
  - **Contextual Semantic Search:** Natural language search over years of technical discussions, decisions, and meeting outcomes.

---

## 12. Comprehensive Development Backlog & Actionable To-Dos

The implementation is structured into 8 sequential iterations (Sprints 0–7):

### 🏁 Sprint 0: Repository Scaffolding & Engineering Foundation ✅
- [x] Connect and configure root workspace for all three repos: `leaddesk-backend`, `leaddesk-frontend`, and `leaddesk-skeleton-project`.
- [x] Initialize Express backend in `leaddesk-backend` with TypeScript, `ts-node-dev`, `eslint`, and `prettier`.
- [x] Initialize Angular standalone application in `leaddesk-frontend` with Tailwind CSS and PrimeNG.
- [x] Setup Prisma ORM in `leaddesk-backend/prisma/` and generate client with the full 16 models schema.
- [x] Configure `leaddesk-skeleton-project` with `docker-compose.yml`, PostgreSQL, backend, frontend, and environment templates.
- [x] Configure `leaddesk-backend/src/config/` for type-safe environment variable parsing with Zod.
- [x] Verify production builds for both backend (`tsc`) and frontend (`ng build`).

### 🔐 Sprint 1: Authentication, Bootstrap & Application Shell ✅
- [x] Write database seed script `leaddesk-backend/prisma/seed.ts` to bootstrap the initial single owner.
- [x] Implement `POST /api/v1/auth/login` with bcrypt password verification and JWT issuance.
- [x] Implement `POST /api/v1/auth/refresh` with rotating refresh token hashes stored in DB.
- [x] Implement `POST /api/v1/auth/logout` and `GET /api/v1/auth/me`.
- [x] Build Angular Auth Service in `leaddesk-frontend`, HTTP Interceptor for automatic JWT token refresh, and Auth Guard.
- [x] Build responsive Layout Shell: desktop sidebar, mobile bottom navigation bar, user profile menu.
- [x] Implement user timezone settings and UTC date formatting pipes.

### ⚡ Sprint 2: Quick Capture & Inbox Processing Workflow ✅
- [x] Implement backend `POST /api/v1/inbox`, `GET /api/v1/inbox`, `PATCH /api/v1/inbox/:id`.
- [x] Build global Quick Capture component: floating action button (mobile) + keyboard shortcut (desktop).
- [x] Support fast raw capture with optional category selector.
- [x] Build Inbox page with list, quick edit, and dismiss actions.
- [x] Implement Polymorphic Conversion service: `POST /api/v1/inbox/:id/convert`.
- [x] Create frontend conversion modal to convert inbox item into Task, Note, or Follow-up with prefilled text.
- [x] Ensure original capture text is preserved with source traceability pointers.

### 📋 Sprint 3: Task & To-Do Management
- [x] Implement Task CRUD endpoints (`/api/v1/tasks`) with Zod request validation.
- [x] Implement task status transitions (`INBOX` -> `PLANNED` -> `IN_PROGRESS` -> `WAITING` -> `COMPLETED`).
- [x] Support leadership task categorizations: My Tasks, Delegated (assignee name/email), Waiting-for.
- [x] Implement Subtask CRUD endpoints (`/api/v1/tasks/:id/subtasks`).
- [x] Build Angular Task Views: Kanban Board & Filterable List View (by status, priority, due date).
- [x] Add task search, overdue indicators, and source URL reference links (Jira/Teams).

### 🤝 Sprint 4: Follow-up & Meeting Decision Log
- [x] Implement Follow-up CRUD endpoints (`/api/v1/followups`).
- [x] Build Follow-up Tracker page: overdue follow-ups, due today, contact history.
- [x] Add quick actions: Snooze (+1d, +3d, +1w) and Mark Completed with notes.
- [x] Implement Meeting endpoints (`/api/v1/meetings`), Action Items, and Decisions.
- [x] Build Meeting Notes editor supporting rich Markdown formatting.
- [x] Implement one-click conversion of Meeting Action Items into linked Tasks.
- [x] Build dedicated Decisions Log view displaying technical and project decisions across meetings.

### 🧠 Sprint 5: Notes Repository, Calendar & Personal Dashboard
- [x] Implement Notes CRUD (`/api/v1/notes`) with tags and pinned status.
- [x] Build Notes Knowledge Base with Markdown preview and tag filtering.
- [x] Implement Dashboard summary metrics endpoint (`/api/v1/dashboard`).
- [x] Build Dashboard / My Day UI: top 3 daily priorities, overdue alerts, waiting-for list, today's agenda.
- [ ] Implement Calendar events aggregation endpoint (`/api/v1/calendar`).
- [ ] Build Calendar View in Angular displaying scheduled tasks, follow-up dates, and meetings.

### 📱 Sprint 6: PWA, Offline Capture Queue & Reminders
- [x] Configure web app manifest (`src/manifest.webmanifest`) and application shell meta tags.
- [x] Implement client-side IndexedDB capture queue (`offline-queue.service.ts`) for zero-latency offline captures.
- [x] Add network connectivity listener and auto-sync to `POST /api/v1/inbox/sync` with idempotency keys.
- [x] Integrate Web Speech API for one-tap voice-to-text in mobile quick capture.
- [ ] Implement Node.js scheduled reminder worker querying due reminders.
- [ ] Add browser notification permissions and dispatch mechanism.

### 🚀 Sprint 7: Hardening, Usability Verification & Deployment
- [x] Validate production multi-stage Dockerfiles (`backend/Dockerfile`, `frontend/Dockerfile` with Nginx).
- [x] Validate responsive UX on mobile screen sizes (iPhone / Android) and desktop browsers.
- [x] Compile and verify backend build (`tsc`) and frontend build (`ng build`) with zero errors.
- [x] Validate full local container deployment stack with `docker-compose config`.

---

## 13. MVP 1 Definition of Done & Acceptance Criteria

The MVP 1 release is declared complete and ready for daily operational use when all following conditions are verified:

1. **Authentication & Security:** The owner can securely log in, tokens rotate smoothly without session dropping, and all data endpoints enforce strict user ownership.
2. **5-Second Quick Capture:** Raw text can be captured and saved on mobile or desktop in under 5 seconds without filling out mandatory forms.
3. **Offline Reliability:** Notes and tasks captured on mobile while offline are stored in IndexedDB and synchronize cleanly upon reconnection with zero duplicate records.
4. **Traceable Inbox Processing:** Items in the inbox can be converted into Tasks, Notes, or Follow-ups with original capture text preserved.
5. **Leadership Task Separation:** Clear distinction between personal tasks, delegated tasks (tracking external assignee), and items in "Waiting For" state.
6. **Follow-up Visibility:** Due and overdue follow-ups are surfaced prominently on the dashboard with one-click snooze or completion.
7. **Meeting Decisions & Actions:** Meeting records distinctly preserve discussion notes, explicit decisions made, and action items converted into active tasks.
8. **Knowledge Retrieval:** Personal notes and architecture records are searchable via keyword and tags in under 1 second.
9. **Daily Clarity:** The dashboard and "My Day" view provide an instant, accurate picture of today's priorities, overdue items, and scheduled commitments.
10. **Data Durability:** All database state is persisted in PostgreSQL with automated volume backup validation.
11. **Mobile Usability:** The PWA installs seamlessly on mobile, provides full layout responsiveness, and supports voice transcription input.
12. **Production Containerization:** The system boots reliably via Docker Compose and runs within existing deployment infrastructure.
