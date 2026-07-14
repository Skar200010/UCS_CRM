# UCS CRM — Master Documentation

> **Last Updated:** July 13, 2026  
> **Project Root:** `C:\Users\Administrator\Desktop\attendance\UCS_CRM`  
> **Live Backend:** `https://ucs-crm-backend.vercel.app` / `https://attendance-roan-zeta.vercel.app`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Directory Structure](#2-directory-structure)
3. [Backend API](#3-backend-api)
   - [Auth Middleware & Role Hierarchy](#31-auth-middleware--role-hierarchy)
   - [Complete Route Table](#32-complete-route-table)
   - [Database Schema](#33-database-schema)
4. [Main CRM SPA — Panel Documentation](#4-main-crm-spa--panel-documentation)
   - [4.1 Super Admin Panel](#41-super-admin-panel)
   - [4.2 HR Panel](#42-hr-panel)
   - [4.3 Accounts Panel](#43-accounts-panel)
   - [4.4 FRO Panel](#44-fro-panel)
   - [4.5 NGO Admin Panel](#45-ngo-admin-panel)
   - [4.6 Recruiter Panel](#46-recruiter-panel)
   - [4.7 Event Head Panel](#47-event-head-panel)
5. [Flutter Mobile App](#5-flutter-mobile-app)
6. [Web PWA (Worker Attendance)](#6-web-pwa-worker-attendance)
7. [Supporting Components](#7-supporting-components)
8. [External Service Integration Summary](#8-external-service-integration-summary)
9. [Complete cURL API Reference](#9-complete-curl-api-reference)

---

## 1. Project Overview

**UCS CRM** is a comprehensive **attendance tracking + Customer Relationship Management** system for NGOs and non-profit organizations. It enables managing field workers (FROs), donor relationships, attendance with QR-based geo-verification, payment collection, receipt generation, bank reconciliation, HR workflows, event management, and recruitment.

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   End Users / Clients                        │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐  │
│  │ Flutter   │  │ Web PWA  │  │ CRM SPA  │  │ shon    │  │
│  │ (Mobile)  │  │ (Worker)  │  │ (Admin)  │  │ (Basic) │  │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └────┬────┘  │
│        │               │              │              │       │
├────────┼───────────────┼──────────────┼──────────────┼───────┤
│        ▼               ▼              ▼              ▼       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Express.js API (Node.js)                  │   │
│  │  47 Controllers · 37 Models · 42 Route Files        │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                         │                                    │
│  ┌──────────────────────┼───────────────────────────────┐   │
│  │         Supabase (PostgreSQL + Realtime)             │   │
│  │          40+ Tables · Edge Functions                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  External Services:                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ │
│  │Firebase│ │Razorpay│ │ Paytm  │ │WhatsApp│ │  Groq AI │ │
│  │  FCM   │ │  PGs   │ │  PGs   │ │  Cloud │ │ (LLaMA)  │ │
│  └────────┘ └────────┘ └────────┘ └────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack Summary

| Layer | Technology | Version |
|-------|------------|---------|
| **Backend Runtime** | Node.js | v24.x |
| **Backend Framework** | Express.js | — |
| **Database** | Supabase (PostgreSQL) | — |
| **Authentication** | JWT + bcryptjs | — |
| **Main CRM Frontend** | React + Vite | React 19, Vite 6 |
| **Worker Web App** | React + Vite + Tailwind CSS | React 19, Vite 6, Tailwind 4 |
| **Mobile App** | Flutter | ^3.12.0 |
| **Push Notifications** | Firebase Cloud Messaging | — |
| **AI/ML** | Groq SDK (LLaMA) | — |
| **Payment Gateways** | Razorpay, Paytm | — |
| **WhatsApp** | Meta Cloud API | — |
| **Email Import** | IMAP (ImapFlow + mailparser) | — |
| **File Parsing** | xlsx, multer | — |
| **Hosting** | Vercel | — |
| **Charts** | Recharts | 3.9 |
| **PDF Generation** | jsPDF + html2canvas | — |

---

## 2. Directory Structure

```
UCS_CRM/
├── .gitignore                          (18 lines - ignores node_modules, .env, dist, etc.)
├── .vercel/                            (Vercel deployment config)
│   ├── README.txt                      (11 lines - auto-generated explanation)
│   └── repo.json                       (11 lines - project ID, org ID)
│
├── backend/                            ★ MAIN BACKEND ★
│   ├── .env                            (environment variables)
│   ├── package.json                    (dependencies)
│   ├── vercel.json                     (Vercel deployment config)
│   ├── functions/                      (Deno/TypeScript Supabase Edge Functions)
│   │   ├── aflf/webhook-whatsapp.js    (Ashray For Life Foundation)
│   │   ├── bsct/webhook-whatsapp.js    (Being Sevak Foundation)
│   │   └── mann/webhook-whatsapp.js    (Mann Care Foundation)
│   ├── migrations/                     (29 SQL migration files)
│   │   ├── 001_create_fro_transfers.sql
│   │   ├── 002_create_worker_loans.sql
│   │   ├── 003_create_attendance_corrections.sql
│   │   ├── ... (003–023)
│   │   └── 023_add_donor_id_to_bank_audit_entries.sql
│   ├── scripts/                        (5 utility scripts)
│   │   ├── backfill-notifs-alerts.js
│   │   ├── backfill-rejected-leads.js
│   │   ├── cleanup.js
│   │   ├── reassign-ngos.js
│   │   └── seed.js
│   └── src/                            ★ APPLICATION SOURCE ★
│       ├── index.js                    (Express entry point, CORS, static files, cron routes)
│       ├── config/                     (6 config files)
│       │   ├── emailConfig.js          (IMAP settings)
│       │   ├── firebase.js             (Firebase Admin SDK)
│       │   ├── groq.js                 (Groq AI SDK)
│       │   ├── paymentGatewayConfig.js (Razorpay + Paytm)
│       │   ├── supabase.js             (Supabase client)
│       │   └── whatsappConfig.js       (WhatsApp Cloud API)
│       ├── middleware/
│       │   └── authMiddleware.js       (JWT verify + role-based auth)
│       ├── controllers/                (47 controllers)
│       │   ├── accountsController.js
│       │   ├── achievementController.js
│       │   ├── attendanceController.js
│       │   ├── attendanceCorrectionController.js
│       │   ├── authController.js
│       │   ├── bankAuditController.js
│       │   ├── bankStatementController.js
│       │   ├── callLogController.js
│       │   ├── causeController.js
│       │   ├── dashboardController.js
│       │   ├── dataImportController.js
│       │   ├── dataSourceController.js
│       │   ├── emailAccountController.js
│       │   ├── emailImportController.js
│       │   ├── eventController.js
│       │   ├── eventHeadController.js
│       │   ├── froController.js
│       │   ├── froWhatsAppAssignmentController.js
│       │   ├── froWhatsAppAuthController.js
│       │   ├── froWhatsAppController.js
│       │   ├── holidayController.js
│       │   ├── hrController.js
│       │   ├── incentiveController.js
│       │   ├── leadController.js
│       │   ├── leaveController.js
│       │   ├── letterController.js
│       │   ├── loanController.js
│       │   ├── ngoAdminController.js
│       │   ├── ngoController.js
│       │   ├── noticeController.js
│       │   ├── notificationAdminController.js
│       │   ├── notificationController.js
│       │   ├── ocrController.js
│       │   ├── onboardingController.js
│       │   ├── qrController.js
│       │   ├── recruiterController.js
│       │   ├── salaryController.js
│       │   ├── settingsController.js
│       │   ├── superAdminController.js
│       │   ├── taskController.js
│       │   ├── userController.js
│       │   ├── webhookController.js
│       │   ├── whatsappAccountController.js
│       │   ├── whatsappController.js
│       │   ├── workerController.js
│       │   └── index.js               (barrel export)
│       ├── models/                     (37 model files)
│       │   ├── achievementModel.js, attendanceCorrectionModel.js
│       │   ├── attendanceModel.js, bankAuditModel.js
│       │   ├── callLogModel.js, causeModel.js
│       │   ├── dailyAchievementModel.js, dataSourceModel.js
│       │   ├── donorProfileModel.js, emailAccountModel.js
│       │   ├── emailImportLogModel.js, eventHeadModel.js
│       │   ├── eventModel.js, froAssignmentModel.js
│       │   ├── froDonorLogModel.js, froStationAssignmentModel.js
│       │   ├── froTargetModel.js, froWhatsAppAssignmentModel.js
│       │   ├── holidayModel.js, hrModel.js
│       │   ├── incentiveModel.js, leadModel.js
│       │   ├── leaveModel.js, letterModel.js
│       │   ├── loanModel.js, newDataModel.js
│       │   ├── ngoModel.js, noticeModel.js
│       │   ├── notificationAdminModel.js, notificationModel.js
│       │   ├── onboardingModel.js, paymentWebhookLogModel.js
│       │   ├── qrModel.js, razorpayAccountModel.js
│       │   ├── receiptModel.js, salaryModel.js
│       │   ├── settingsModel.js, taskModel.js
│       │   ├── userModel.js, userNgoAccessModel.js
│       │   ├── whatsappAccountModel.js, workerModel.js
│       │   └── workerNgoAllocationModel.js
│       ├── services/                   (10 service files)
│       │   ├── bankStatementParser.js  (CSV/XLSX parsing, bank auto-detection)
│       │   ├── emailImporter.js        (IMAP polling + Groq AI extraction)
│       │   ├── fcmService.js           (Firebase push notifications)
│       │   ├── fileParser.js           (Import file parsing)
│       │   ├── froWhatsAppService.js   (FRO WhatsApp via Meta API)
│       │   ├── notificationScheduler.js (Cron-based scheduler)
│       │   ├── paymentWebhookService.js (Shared webhook processing)
│       │   ├── paytmWebhook.js         (Paytm checksum verification)
│       │   ├── razorpayWebhook.js      (Razorpay signature verification)
│       │   └── whatsappService.js      (WhatsApp Cloud API messaging)
│       ├── utils/                      (2 utilities)
│       │   ├── geo.js                  (Haversine distance for QR validation)
│       │   └── incentive.js            (AKI incentive calculation)
│       └── routes/                     (42 route files)
│           ├── accountsRoutes.js, achievementRoutes.js
│           ├── assetsRoutes.js, attendanceCorrectionRoutes.js
│           ├── attendanceRoutes.js, authRoutes.js
│           ├── bankAuditRoutes.js, bankStatementRoutes.js
│           ├── calendarRoutes.js, callLogRoutes.js
│           ├── causeRoutes.js, dashboardRoutes.js
│           ├── dataImportRoutes.js, dataSourceRoutes.js
│           ├── emailImportRoutes.js, eventHeadRoutes.js
│           ├── eventRoutes.js, froRoutes.js
│           ├── froWhatsAppRoutes.js, holidayRoutes.js
│           ├── hrRoutes.js, incentiveRoutes.js
│           ├── leadRoutes.js, leaveRoutes.js
│           ├── letterRoutes.js, loanRoutes.js
│           ├── ngoAdminRoutes.js, ngoRoutes.js
│           ├── noticeRoutes.js, notificationAdminRoutes.js
│           ├── notificationRoutes.js, ocrRoutes.js
│           ├── onboardingRoutes.js, qrRoutes.js
│           ├── recruiterRoutes.js, salaryRoutes.js
│           ├── settingsRoutes.js, superAdminRoutes.js
│           ├── taskRoutes.js, userRoutes.js
│           ├── webhookRoutes.js, whatsappRoutes.js
│           └── workerRoutes.js
│
├── client/                             ★ FLUTTER MOBILE APP (ufs_attendance) ★
│   ├── pubspec.yaml                    (114 lines - dependencies)
│   ├── analysis_options.yaml           (28 lines - lint rules)
│   ├── build.sh                        (24 lines - CI build script)
│   ├── vercel.json                     (Vercel web deployment)
│   ├── lib/
│   │   ├── main.dart                   (501 lines - App entry + theme + routing)
│   │   ├── config.dart                 (12 lines - API/Supabase URLs)
│   │   ├── data/
│   │   │   ├── mock_data.dart          (52 lines - demo data)
│   │   │   └── volunteer_policies.dart (80 lines - 10 company policies)
│   │   ├── models/
│   │   │   ├── attendance_record.dart  (13 lines)
│   │   │   ├── employee.dart           (21 lines)
│   │   │   ├── leave_record.dart       (17 lines)
│   │   │   ├── monthly_breakdown.dart  (17 lines)
│   │   │   └── punch_log.dart          (7 lines)
│   │   ├── pages/
│   │   │   ├── splash_page.dart        (68 lines - animated splash)
│   │   │   ├── login_page.dart         (226 lines - login with gradient bg)
│   │   │   ├── onboarding_page.dart    (1944 lines - 11-step wizard)
│   │   │   ├── home_page.dart          (1260+ lines - dashboard)
│   │   │   ├── profile_page.dart       (1315 lines - profile + calendar)
│   │   │   ├── scan_page.dart          (300 lines - legacy QR scanner)
│   │   │   ├── scanner_page.dart       (272 lines - active QR scanner)
│   │   │   ├── edit_profile_page.dart  (460 lines - full edit form)
│   │   │   ├── attendance_list_page.dart (456 lines - history)
│   │   │   ├── leave_page.dart         (692 lines - leave application)
│   │   │   ├── advance_page.dart       (249 lines - advance/loan)
│   │   │   ├── correction_ticket_page.dart (259 lines - correction tickets)
│   │   │   └── print_form_page.dart    (304 lines - PDF generation)
│   │   ├── services/
│   │   │   ├── api_service.dart        (590 lines - complete REST client)
│   │   │   ├── notification_service.dart (146 lines - FCM push)
│   │   │   └── supabase_service.dart   (55 lines - realtime)
│   │   └── widgets/
│   │       ├── consistency_bar.dart    (53 lines - stacked bar chart)
│   │       ├── menu_item.dart          (59 lines - list item)
│   │       ├── mini_calendar.dart      (173 lines - month grid)
│   │       ├── organic_background.dart (99 lines - blob shapes)
│   │       ├── progress_circle.dart    (97 lines - circular indicator)
│   │       └── skeleton_loader.dart    (174 lines - loading skeletons)
│   ├── android/                        (Android platform config)
│   │   ├── build.gradle.kts            (24 lines)
│   │   ├── settings.gradle.kts         (27 lines)
│   │   └── app/
│   │       ├── build.gradle.kts        (76 lines)
│   │       ├── google-services.json    (Firebase config)
│   │       └── src/main/
│   │           ├── AndroidManifest.xml  (55 lines - permissions)
│   │           └── kotlin/.../MainActivity.kt (5 lines)
│   ├── ios/                            (iOS platform config)
│   ├── web/                            (Web platform files)
│   ├── linux/                          (Linux platform)
│   ├── macos/                          (macOS platform)
│   ├── windows/                        (Windows platform)
│   └── test/                           (widget tests)
│
├── client-web/                         ★ WORKER WEB PWA ★
│   ├── index.html                      (23 lines - PWA HTML shell)
│   ├── package.json                    (28 lines)
│   ├── vercel.json                     (5 lines - SPA rewrites)
│   ├── vite.config.js                  (7 lines - React + Tailwind)
│   ├── public/
│   │   ├── manifest.json               (23 lines - PWA manifest)
│   │   ├── sw.js                       (19 lines - service worker)
│   │   └── logo/logo.png               (app icon)
│   └── src/
│       ├── main.jsx                    (22 lines - entry + SW registration)
│       ├── config.js                   (13 lines - API_BASE, CACHE_KEYS)
│       ├── api.js                      (82 lines - all API methods)
│       ├── store.jsx                   (60 lines - AuthContext + AuthProvider)
│       ├── App.jsx                     (46 lines - routing + guards)
│       ├── index.css                   (164 lines - Tailwind + iOS safe areas)
│       └── components/
│           ├── Splash.jsx              (38 lines)
│           ├── Login.jsx               (70 lines)
│           ├── Layout.jsx              (123 lines - sidebar + tab bar)
│           ├── Home.jsx                (323 lines - dashboard)
│           ├── HomeModals.jsx          (158 lines - leave/advance modals)
│           ├── Profile.jsx             (230 lines)
│           ├── AttendanceList.jsx      (107 lines)
│           ├── EditProfile.jsx         (65 lines)
│           ├── Scanner.jsx             (235 lines - QR + geolocation)
│           ├── CorrectionTicket.jsx    (90 lines)
│           ├── PrintForm.jsx           (40 lines)
│           ├── Onboarding.jsx          (258 lines - 11 steps)
│           ├── MiniCalendar.jsx        (52 lines)
│           ├── ProgressCircle.jsx      (16 lines)
│           └── ConsistencyBar.jsx      (18 lines)
│
├── ucs crm/                            ★ MAIN CRM SPA ★
│   ├── index.html                      (16 lines)
│   ├── package.json                    (34 lines)
│   ├── vite.config.js                  (7 lines)
│   ├── .env                            (3 lines - VITE_API_URL, Supabase)
│   ├── src/
│   │   ├── main.jsx                    (13 lines - entry)
│   │   ├── App.jsx                     (146 lines - role-based routing)
│   │   ├── store.jsx                   (56 lines - UcsContext + auth)
│   │   ├── theme.js                    (31 lines - 17 themes)
│   │   ├── icons.jsx                   (38 lines - SVG components)
│   │   ├── index.css                   (1106+ lines - comprehensive styles)
│   │   ├── config/supabase.js          (6 lines - Supabase client)
│   │   ├── hooks/useRealtime.js        (32 lines - Supabase realtime hook)
│   │   ├── api/auth.js                 (57 lines - API core + login)
│   │   ├── components/                 (shared components)
│   │   │   ├── DonorDetailModal.jsx    (186 lines)
│   │   │   ├── NotificationDrawer.jsx  (127 lines)
│   │   │   ├── RecentNotices.jsx       (113 lines)
│   │   │   ├── SettingsDrawer.jsx      (108 lines)
│   │   │   ├── Skeleton.jsx           (85 lines)
│   │   │   ├── Toast.jsx              (55 lines)
│   │   │   └── ui.jsx                 (184 lines - Dropdown, DatePicker, etc.)
│   │   └── panels/                     ★ 7 ROLE-BASED PANELS ★
│   │       ├── super-admin/            (24+ files)
│   │       ├── hr/                     (30+ files)
│   │       ├── accounts/               (30+ files)
│   │       ├── fro/                    (28+ files)
│   │       ├── ngo-admin/              (18+ files)
│   │       ├── recruiter/              (15+ files)
│   │       └── event-head/             (25+ files)
│   ├── public/
│   │   ├── logo/                       (NGO logos)
│   │   └── receipt-assets/             (stamp images)
│   └── dist/                           (built output)
│
├── AssertRegister/                     ★ STANDALONE ASSET REGISTER ★
│   ├── AssetRegister.jsx               (666 lines - React component)
│   ├── assets_table.sql                (47 lines - PostgreSQL schema)
│   └── assets.routes.js               (128 lines - Express routes)
│
├── shon/                               ★ SIMPLE ATTENDANCE APP ★
│   ├── .env                            (6 lines - Supabase + test creds)
│   ├── index.html                      (14 lines)
│   ├── package.json                    (20 lines)
│   ├── vite.config.js                  (6 lines)
│   └── src/
│       ├── main.jsx                    (10 lines)
│       ├── App.jsx                     (77 lines - login + routing)
│       ├── App.css                     (364 lines)
│       ├── api.js                      (48 lines - Supabase client)
│       └── AttendanceView.jsx          (456 lines - attendance CRUD)
│
└── privacy/                            ★ LEGAL DOCUMENTS ★
    ├── privacy-policy.html             (383 lines - Privacy + Terms)
    └── whatsapp.txt                    (2 lines - WhatsApp tokens)
```

---

## 3. Backend API

### 3.1 Auth Middleware & Role Hierarchy

**File:** `src/middleware/authMiddleware.js`

#### `authenticate(req, res, next)`
- Reads `Authorization: Bearer <token>` header
- Verifies JWT with `process.env.JWT_SECRET`
- Sets `req.user` with decoded payload (id, ngo_id, email, role, name, department)
- Returns 401 if no token or invalid

#### `authenticateRole(...allowedRoles)`
- Returns middleware that checks if `decoded.role` is in `allowedRoles` array
- Returns 403 with required roles message if unauthorized

#### Pre-configured Middleware Instances

| Middleware | Roles Allowed |
|---|---|
| `authenticateAdmin` | `super_admin` |
| `authenticateWorker` | `worker`, `fro` |

#### Role Hierarchy

```
super_admin (highest — can access ALL panels)
  └── admin (NGO admin, department='ngo admin')
      └── hr
          └── accounts
              └── recruiter
                  └── telecaller
                      └── team_lead
                          └── worker / fro (lowest)
```

---

### 3.2 Complete Route Table

**Server Entry:** `src/index.js` — Express app with CORS (`origin: '*'`), JSON body parser (`10mb limit`), raw body capture for webhooks.

**Static File Serving:**
- FRO panel build served at route paths
- NGO admin panel build at `/admin*`
- Accounts panel build at `/accounts*`

**Cron Endpoints (POST — unauthenticated, triggered by Vercel Cron):**
- `/api/cron/notifications` — runs notification cycles
- `/api/cron/email-import` — polls email inboxes
- `/api/cron/razorpay-sync` — syncs Razorpay payments

**Base Path:** All routes are mounted under `/api` unless noted.

---

#### 3.2.1 Auth Routes (`authRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/auth/admin/login` | rateLimit(10/15min) | `adminLogin` | Super admin login (env EMAIL/PASS) |
| POST | `/auth/worker/login` | rateLimit(10/15min) | `unifiedLogin` | Worker/user/HR login |
| POST | `/auth/login` | rateLimit(10/15min) | `unifiedLogin` | Unified login (same as above) |

**cURL:**
```bash
# Worker Login
curl -X POST https://ucs-crm-backend.vercel.app/api/auth/worker/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "worker123", "password": "secret"}'

# Response:
# {"token":"jwt...","user":{"id":1,"name":"John","role":"worker","ngo_id":1,...}}
```

```bash
# Admin Login
curl -X POST https://ucs-crm-backend.vercel.app/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"identifier": "admin@ufs.com", "password": "admin123"}'
```

---

#### 3.2.2 Attendance Routes (`attendanceRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/attendance/punch-in` | authenticate | `punchIn` | QR + GPS punch-in |
| POST | `/attendance/punch-out` | authenticate | `punchOut` | GPS punch-out |
| GET | `/attendance/today` | authenticate | `todayStatus` | Today's attendance + late stats |
| GET | `/attendance/history` | authenticate | `myHistory` | Worker attendance history |
| GET | `/attendance/all` | super_admin,admin,hr | `listAll` | All attendance records |
| POST | `/attendance/` | super_admin,admin,hr | `createAttendanceByHR` | HR creates record |
| PUT | `/attendance/:id` | super_admin,admin,hr | `updateAttendanceRecord` | Update record |
| DELETE | `/attendance/:id` | super_admin,admin,hr | `deleteAttendanceRecord` | Delete record |
| GET | `/attendance/worker/:id` | super_admin,admin,hr | `getWorkerMonthlyAttendance` | Monthly attendance |

**cURL:**
```bash
# Punch In
curl -X POST https://ucs-crm-backend.vercel.app/api/attendance/punch-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"code":"QR-OFFICE-001","latitude":19.0760,"longitude":72.8777}'

# Response:
# {"message":"Punched in successfully","lateMinutes":0}

# Punch Out
curl -X POST https://ucs-crm-backend.vercel.app/api/attendance/punch-out \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"latitude":19.0760,"longitude":72.8777}'

# Get Today Status
curl -X GET https://ucs-crm-backend.vercel.app/api/attendance/today \
  -H "Authorization: Bearer <token>"

# Get History
curl -X GET https://ucs-crm-backend.vercel.app/api/attendance/history \
  -H "Authorization: Bearer <token>"
```

---

#### 3.2.3 Worker Routes (`workerRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/workers/` | super_admin,admin,hr | `addWorker` | Create worker |
| POST | `/workers/bulk` | super_admin,admin,hr | `bulkAddWorkers` | Bulk create |
| PUT | `/workers/bulk` | super_admin,admin,hr | `bulkEditWorkers` | Bulk update |
| GET | `/workers/` | super_admin,admin,hr,accounts | `getWorkers` | List workers |
| GET | `/workers/birthdays` | super_admin,admin,hr | `getBirthdays` | Next 30 days |
| GET | `/workers/me` | authenticate | `getMyProfile` | Own profile |
| PUT | `/workers/me` | authenticate | `updateMyProfile` | Update profile |
| PUT | `/workers/me/education` | authenticate | `updateMyEducation` | Update education |
| GET | `/workers/:id` | super_admin,admin,hr | `getWorker` | Full profile |
| PUT | `/workers/:id` | super_admin,admin,hr | `editWorker` | Update worker |
| DELETE | `/workers/:id` | super_admin,admin,hr | `removeWorker` | Delete worker |
| GET | `/workers/:id/allocations` | super_admin,admin,hr | `getWorkerAllocations` | NGO allocations |
| PUT | `/workers/:id/allocations` | super_admin,admin,hr | `setWorkerAllocations` | Set allocations |

**cURL:**
```bash
# List Workers
curl -X GET https://ucs-crm-backend.vercel.app/api/workers \
  -H "Authorization: Bearer <token>"

# Get My Profile
curl -X GET https://ucs-crm-backend.vercel.app/api/workers/me \
  -H "Authorization: Bearer <token>"

# Update My Profile
curl -X PUT https://ucs-crm-backend.vercel.app/api/workers/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"John Doe","phone":"9876543210"}'
```

---

#### 3.2.4 User Routes (`userRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/users/` | super_admin,admin,hr | `addUser` | Create panel user |
| GET | `/users/` | super_admin,admin,hr | `listUsers` | List panel users |
| GET | `/users/:id` | super_admin,admin,hr | `getUser` | Get user |
| PUT | `/users/:id` | super_admin,admin | `editUser` | Update user |
| GET | `/users/:id/ngo-access` | super_admin,admin | `getUserNgoAccessHandler` | NGO access |
| PUT | `/users/:id/ngo-access` | super_admin,admin | `setUserNgoAccessHandler` | Set NGO access |

---

#### 3.2.5 QR Code Routes (`qrRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/qr/generate` | super_admin,admin,hr | `generateQR` | Generate QR with GPS |
| GET | `/qr/` | super_admin,admin,hr | `listQRCodes` | List QR codes |
| POST | `/qr/validate` | worker,fro | `validateQRAndLocation` | Validate QR + location |
| DELETE | `/qr/:id` | super_admin,admin,hr | `removeQRCode` | Delete QR |

**cURL:**
```bash
# Generate QR Code
curl -X POST https://ucs-crm-backend.vercel.app/api/qr/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"label":"Office-Main","latitude":19.0760,"longitude":72.8777,"radius_meters":100}'
```

---

#### 3.2.6 Settings Routes (`settingsRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| GET | `/settings/` | super_admin,admin,hr | `getSettings` | Get all settings |
| PUT | `/settings/` | super_admin,admin,hr | `updateSettings` | Update settings |

---

#### 3.2.7 Leave Routes (`leaveRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/leaves/apply` | authenticate | `apply` | Apply for leave |
| GET | `/leaves/my` | authenticate | `myLeaves` | My leaves |
| GET | `/leaves/` | super_admin,admin,hr | `listAll` | All leaves |
| GET | `/leaves/pending` | super_admin,admin,hr | `listPending` | Pending leaves |
| PUT | `/leaves/:id/status` | super_admin,admin,hr | `updateStatus` | Approve/reject |

**cURL:**
```bash
# Apply Leave
curl -X POST https://ucs-crm-backend.vercel.app/api/leaves/apply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"type":"full_day","leave_date":"2026-07-15","reason":"Personal"}'

# Response:
# {"message":"Leave applied","leave":{"id":1,"status":"pending",...}}
```

---

#### 3.2.8 NGO Routes (`ngoRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| GET | `/ngos/` | super_admin,admin,hr | `listNgos` | List NGOs |
| POST | `/ngos/` | super_admin | `addNgo` | Create NGO |
| GET | `/ngos/:id` | super_admin,admin,hr | `getNgo` | Get NGO |
| PUT | `/ngos/:id` | super_admin | `editNgo` | Update NGO |
| DELETE | `/ngos/:id` | super_admin | `removeNgo` | Delete NGO |
| PUT | `/ngos/:id/toggle` | super_admin | `toggleNgo` | Activate/deactivate |

---

#### 3.2.9 HR Routes (`hrRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/hrs/` | super_admin,admin | `addHR` | Create HR user |
| GET | `/hrs/` | super_admin,admin,hr | `listHRs` | List HR users |
| GET | `/hrs/:id` | super_admin,admin,hr | `getHR` | Get HR |
| PUT | `/hrs/:id` | super_admin,admin | `editHR` | Update HR |

---

#### 3.2.10 Letter Routes (`letterRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/letters/seed` | super_admin,admin,hr | `seedTemplates` | Seed default templates |
| GET | `/letters/templates` | super_admin,admin,hr | `listTemplates` | List templates |
| GET | `/letters/templates/:id` | super_admin,admin,hr | `getTemplate` | Get template |
| POST | `/letters/templates` | super_admin,admin,hr | `addTemplate` | Create template |
| PUT | `/letters/templates/:id` | super_admin,admin,hr | `editTemplate` | Update template |
| DELETE | `/letters/templates/:id` | super_admin,admin,hr | `removeTemplate` | Delete template |
| POST | `/letters/generate` | super_admin,admin,hr | `generateLetter` | Generate letter |
| GET | `/letters/generated` | super_admin,admin,hr | `listGeneratedLetters` | List generated |
| GET | `/letters/generated/worker/:workerId` | super_admin,admin,hr | `getWorkerLetters` | Worker's letters |
| GET | `/letters/generated/:id/download` | super_admin,admin,hr | `downloadLetter` | Download PDF |

---

#### 3.2.11 Dashboard Routes (`dashboardRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| GET | `/dashboard/super-admin` | super_admin | `getSuperAdminDashboard` | All KPIs + charts |
| GET | `/dashboard/super-admin-alerts` | super_admin | `getSuperAdminAlerts` | Risk alerts (14 categories) |
| GET | `/dashboard/admin` | admin | `getAdminDashboard` | NGO admin dashboard |
| GET | `/dashboard/hr` | hr | `getHrDashboard` | HR dashboard |
| GET | `/dashboard/accounts` | super_admin,accounts | `getAccountsDashboard` | Accounts dashboard |
| GET | `/dashboard/recruiter` | recruiter | `getRecruiterDashboard` | Recruiter dashboard |
| GET | `/dashboard/telecaller` | telecaller OR fro | `getTelecallerDashboard` | Telecaller stats |
| GET | `/dashboard/fro-live` | super_admin | `getFroLiveStatus` | FRO live activity |
| GET | `/dashboard/fro-worker/:workerId` | super_admin | `getFroWorkerDashboard` | Single FRO |

**cURL:**
```bash
# Super Admin Dashboard
curl -X GET "https://ucs-crm-backend.vercel.app/api/dashboard/super-admin?period=30d" \
  -H "Authorization: Bearer <token>"

# Super Admin Alerts
curl -X GET https://ucs-crm-backend.vercel.app/api/dashboard/super-admin-alerts \
  -H "Authorization: Bearer <token>"
```

---

#### 3.2.12 Lead Routes (`leadRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| GET | `/leads/dashboard` | multi-role | `dashboard` | Lead stats |
| POST | `/leads/` | multi-role | `addLead` | Create lead |
| GET | `/leads/` | leadReadWrite | `listLeads` | List leads |
| GET | `/leads/:id` | leadReadWrite | `getLead` | Get lead |
| PUT | `/leads/:id` | leadReadWrite | `editLead` | Update lead |
| PUT | `/leads/:id/transfer` | super_admin,admin,hr,recruiter | `transferLeadOwner` | Transfer ownership |
| DELETE | `/leads/:id` | super_admin,admin | `removeLead` | Delete lead |

---

#### 3.2.13 Recruiter Routes (`recruiterRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| GET | `/recruiters/overview` | multi-role | `getRecruiterOverview` | Analytics overview |
| GET | `/recruiters/` | multi-role | `listRecruiters` | List with lead counts |
| GET | `/recruiters/:id/stats` | multi-role | `getRecruiterStats` | Single stats |

---

#### 3.2.14 Event Routes (`eventRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/events/` | super_admin,admin,hr | `addEvent` | Create event |
| GET | `/events/` | broad access | `listEvents` | List events |
| GET | `/events/:id` | super_admin,admin,hr | `getEvent` | Get event |
| PUT | `/events/:id` | super_admin,admin,hr | `editEvent` | Update event |
| DELETE | `/events/:id` | super_admin,admin,hr | `removeEvent` | Delete event |

---

#### 3.2.15 Notice Routes (`noticeRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/notices/` | super_admin,admin,hr | `addNotice` | Create notice |
| GET | `/notices/` | broad access | `listNotices` | List notices |
| GET | `/notices/:id` | super_admin,admin,hr | `getNotice` | Get notice |
| PUT | `/notices/:id` | super_admin,admin,hr | `editNotice` | Update notice |
| DELETE | `/notices/:id` | super_admin,admin,hr | `removeNotice` | Delete notice |

---

#### 3.2.16 Achievement Routes (`achievementRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/achievements/` | super_admin,admin,hr | `addAchievement` | Create |
| GET | `/achievements/` | broad access | `listAchievements` | List |
| GET | `/achievements/:id` | super_admin,admin,hr | `getAchievement` | Get |
| DELETE | `/achievements/:id` | super_admin,admin,hr | `removeAchievement` | Delete |

---

#### 3.2.17 Notification Routes (`notificationRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/notifications/register-token` | authenticate | `registerToken` | Register FCM token |
| POST | `/notifications/test-send` | super_admin,admin,hr | `sendTestNotification` | Test push |
| GET | `/notifications/:worker_id` | authenticate | `getNotifications` | Get notifications |
| GET | `/notifications/:worker_id/unread-count` | authenticate | `getUnreadCount` | Unread count |
| GET | `/notifications/:id/lead-info` | authenticate | `getNotificationLeadInfo` | Lead info |
| PUT | `/notifications/:id/read` | authenticate | `markRead` | Mark read |
| DELETE | `/notifications/:id` | authenticate | `deleteNotification` | Delete |

---

#### 3.2.18 Admin Notification Routes (`notificationAdminRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/admin/notifications/send-now` | super_admin,admin,hr | `sendNow` | Send to workers/role/all |
| POST | `/admin/notifications/schedule` | super_admin,admin,hr | `scheduleNotification` | Schedule |
| GET | `/admin/notifications/scheduled` | super_admin,admin,hr | `listScheduledNotifications` | List scheduled |
| PUT | `/admin/notifications/scheduled/:id/cancel` | super_admin,admin,hr | `cancelScheduled` | Cancel |
| DELETE | `/admin/notifications/scheduled/:id` | super_admin,admin,hr | `removeScheduled` | Delete |

---

#### 3.2.19 Onboarding Routes (`onboardingRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/onboarding/submit` | authenticate | `submitOnboarding` | Submit full data |
| GET | `/onboarding/status` | authenticate | `checkOnboardingStatus` | Check completion |
| POST | `/onboarding/upload-photo` | authenticate | `uploadPhoto` | Upload profile photo |
| POST | `/onboarding/upload-document` | authenticate | `uploadDocument` | Upload document |
| GET | `/onboarding/policies` | authenticate | `getPolicies` | Get active policies |
| GET | `/onboarding/print-profile` | authenticate | `getProfileForPrint` | Profile for printing |
| GET | `/onboarding/admin/policies` | super_admin,admin,hr | `adminGetPolicies` | Admin list |
| POST | `/onboarding/admin/policies` | super_admin,admin,hr | `adminAddPolicy` | Add policy |
| PUT | `/onboarding/admin/policies/:id` | super_admin,admin,hr | `adminEditPolicy` | Edit policy |
| DELETE | `/onboarding/admin/policies/:id` | super_admin,admin,hr | `adminRemovePolicy` | Remove policy |

**cURL:**
```bash
# Check Onboarding Status
curl -X GET https://ucs-crm-backend.vercel.app/api/onboarding/status \
  -H "Authorization: Bearer <token>"

# Upload Photo (base64)
curl -X POST https://ucs-crm-backend.vercel.app/api/onboarding/upload-photo \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"photo_base64":"/9j/4AAQ...","mime_type":"image/jpeg"}'

# Submit Onboarding
curl -X POST https://ucs-crm-backend.vercel.app/api/onboarding/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"personal_details":{"name":"John","email":"john@test.com",...},"education":[...],"family":[...],"references":[...]}'
```

---

#### 3.2.20 Holiday Routes (`holidayRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/holidays/` | super_admin,admin,hr | `addHoliday` | Create holiday |
| GET | `/holidays/` | broad access | `listHolidays` | List holidays |
| GET | `/holidays/:id` | super_admin,admin,hr | `getHoliday` | Get holiday |
| PUT | `/holidays/:id` | super_admin,admin,hr | `editHoliday` | Update holiday |
| DELETE | `/holidays/:id` | super_admin,admin,hr | `removeHoliday` | Delete holiday |

---

#### 3.2.21 Calendar Route (`calendarRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| GET | `/calendar` | broad access | Inline handler | Events + holidays + birthdays for month |

**cURL:**
```bash
curl -X GET "https://ucs-crm-backend.vercel.app/api/calendar?year=2026&month=7" \
  -H "Authorization: Bearer <token>"
```

---

#### 3.2.22 Salary Routes (`salaryRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| GET | `/salary/workers-summary` | super_admin,admin,hr | `getWorkersSummary` | Salary summary |
| GET | `/salary/payroll` | super_admin,admin,hr | `getPayrollExport` | Payroll export |
| GET | `/salary/worker/:workerId` | super_admin,admin,hr | `getWorkerSalaries` | Worker history |
| POST | `/salary/` | super_admin,admin,hr | `addSalary` | Add salary |
| PUT | `/salary/:id` | super_admin,admin,hr | `editSalary` | Edit salary |
| PUT | `/salary/:id/pay` | super_admin,admin,hr | `paySalary` | Mark paid |
| DELETE | `/salary/:id` | super_admin,admin,hr | `removeSalary` | Delete salary |
| GET | `/salary/my-breakdown` | authenticate | `getMySalaryBreakdown` | Own breakdown |
| GET | `/salary/worker/:workerId/allocations` | super_admin,admin,hr | `getWorkerSalaryWithAllocations` | Salary + allocations |

---

#### 3.2.23 Incentive Routes (`incentiveRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| GET | `/incentive/worker/:workerId/targets` | super_admin,admin,hr | `getWorkerTargets` | FRO targets |
| GET | `/incentive/worker/:workerId/month/:month` | super_admin,admin,hr | `getWorkerTargetForMonth` | Target for month |
| PUT | `/incentive/worker/:workerId/month/:month` | super_admin,admin,hr | `updateTarget` | Set target |
| GET | `/incentive/current-month-targets` | super_admin,admin,hr | `getCurrentMonthTargetsList` | All current targets |
| POST | `/incentive/generate-all` | super_admin,admin,hr | `generateAllTargets` | Auto-generate |
| GET | `/incentive/my-target` | worker,fro | `getMyTarget` | Own target |
| PUT | `/incentive/worker/:workerId/achievement/:date` | super_admin,admin,hr | `setAchievement` | Set daily achievement |
| GET | `/incentive/worker/:workerId/achievements/:month` | super_admin,admin,hr | `getWorkerAchievements` | Monthly achievements |
| DELETE | `/incentive/achievement/:id` | super_admin,admin,hr | `removeAchievement` | Delete |
| GET | `/incentive/worker/:workerId/incentive-summary/:month` | super_admin,admin,hr | `getIncentiveSummary` | Full summary |
| GET | `/incentive/monthly-summary` | super_admin,admin,hr | `getMonthlySummary` | All FRO summary |
| POST | `/incentive/bulk-achievements` | super_admin,admin,hr | `bulkSetAchievements` | Bulk set |

---

#### 3.2.24 Call Log Routes (`callLogRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/call-logs/` | telecaller/hr/recruiter/fro | `addCallLog` | Create call log |
| GET | `/call-logs/` | telecaller/hr/recruiter/fro | `listMyCallLogs` | My call logs |
| GET | `/call-logs/lead/:leadId` | telecaller/hr/recruiter/fro | `getLeadCallLogs` | Lead's logs |
| GET | `/call-logs/:id` | telecaller/hr/recruiter/fro | `getSingleCallLog` | Single log |

---

#### 3.2.25 Cause Routes (`causeRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| GET | `/causes/` | super_admin,admin,hr | `listCauses` | List |
| POST | `/causes/` | super_admin,admin | `addCause` | Create |
| GET | `/causes/:id` | super_admin,admin,hr | `getCause` | Get |
| PUT | `/causes/:id` | super_admin,admin | `editCause` | Update |
| DELETE | `/causes/:id` | super_admin | `removeCause` | Delete |
| PUT | `/causes/:id/toggle` | super_admin | `toggleCause` | Toggle active |

---

#### 3.2.26 Data Source Routes (`dataSourceRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| GET | `/data-sources/` | super_admin | `listDataSources` | |
| POST | `/data-sources/` | super_admin | `addDataSource` | |
| GET | `/data-sources/:id` | super_admin | `getDataSource` | |
| PUT | `/data-sources/:id` | super_admin | `editDataSource` | |
| DELETE | `/data-sources/:id` | super_admin | `removeDataSource` | |
| PUT | `/data-sources/:id/toggle` | super_admin | `toggleDataSource` | |

---

#### 3.2.27 Data Import Routes (`dataImportRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/data-import/inspect` | super_admin | `inspectImport` | Inspect XLSX |
| POST | `/data-import/upload` | super_admin | `uploadImport` | Import XLSX |
| GET | `/data-import/batches` | super_admin | `listImportBatches` | List batches |
| GET | `/data-import/batch/:id` | super_admin | `getImportBatch` | Batch details |
| GET | `/data-import/batch/:id/export` | super_admin | `exportBatch` | Export to XLSX |
| GET | `/data-import/sample` | super_admin | `downloadSample` | Sample XLSX |

---

#### 3.2.28 Loan Routes (`loanRoutes.js`) & Advance Routes

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/loans/apply` | authenticate | `apply` | Apply for loan/advance |
| GET | `/loans/my` | authenticate | `myLoans` | My loans |
| GET | `/loans/` | super_admin,admin,hr | `listAll` | All loans |
| GET | `/loans/pending` | super_admin,admin,hr | `listPending` | Pending |
| PUT | `/loans/:id/decide` | super_admin,admin,hr | `decide` | Approve/reject |
| GET | `/loans/worker/:workerId` | super_admin,admin,hr | `getWorkerLoansHandler` | Worker loans |
| GET | `/loans/worker/:workerId/active` | super_admin,admin,hr | `getWorkerActiveLoans` | Active loans |

**cURL:**
```bash
# Apply for Loan
curl -X POST https://ucs-crm-backend.vercel.app/api/loans/apply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"type":"loan","amount":5000,"reason":"Medical expenses"}'

# My Loans
curl -X GET https://ucs-crm-backend.vercel.app/api/loans/my \
  -H "Authorization: Bearer <token>"
```

---

#### 3.2.29 Attendance Correction Routes (`attendanceCorrectionRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/attendance-corrections/` | authenticate | `raiseTicket` | Raise ticket |
| GET | `/attendance-corrections/my` | authenticate | `myTickets` | My tickets |
| GET | `/attendance-corrections/pending` | super_admin,admin,hr | `listPending` | Pending |
| GET | `/attendance-corrections/hr-verified` | super_admin | `listHrVerified` | HR verified |
| GET | `/attendance-corrections/all` | super_admin,admin,hr | `listAllTickets` | All |
| GET | `/attendance-corrections/pending-count` | super_admin,admin,hr | `pendingCount` | Count |
| GET | `/attendance-corrections/:id` | super_admin,admin,hr | `getTicket` | Get ticket |
| PUT | `/attendance-corrections/:id/verify` | super_admin,admin,hr | `verifyTicket` | HR verify |
| PUT | `/attendance-corrections/:id/approve` | super_admin | `approveTicket` | Super admin approve |
| PUT | `/attendance-corrections/:id/reject` | super_admin,admin,hr | `rejectTicket` | Reject |

**cURL:**
```bash
# Raise Correction Ticket
curl -X POST https://ucs-crm-backend.vercel.app/api/attendance-corrections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"attendance_id":123,"date":"2026-07-10","field":"punch_in","requested_time":"2026-07-10T09:30:00Z","reason":"Forgot to punch in"}'
```

---

#### 3.2.30 NGO Admin Routes (`ngoAdminRoutes.js`)

All routes require `authenticateRole('admin', 'super_admin')`.

| Method | Path | Controller | Description |
|--------|------|------------|-------------|
| GET | `/ngo-admin/dashboard` | `getDashboard` | NGO admin dashboard |
| GET | `/ngo-admin/dashboard/daily-target` | `getDailyTarget` | Daily collection target |
| GET | `/ngo-admin/dashboard/station-stats` | `getStationStats` | FRO station stats |
| GET | `/ngo-admin/ngos` | `getAccessibleNgos` | Accessible NGOs |
| GET | `/ngo-admin/donors` | `getDonors` | List donors (paginated) |
| GET | `/ngo-admin/donors/:mobile` | `getDonorDetail` | Donor detail |
| GET | `/ngo-admin/donors-by-station` | `getDonorsByStation` | Donors by station |
| GET | `/ngo-admin/fro-workers` | `getFroWorkers` | FRO workers |
| GET | `/ngo-admin/assignments` | `getAssignments` | FRO assignments |
| GET | `/ngo-admin/targets` | `getTargets` | FRO targets |
| POST | `/ngo-admin/targets` | `setTarget` | Set FRO target |
| GET | `/ngo-admin/collections/fro-wise` | `getFroWiseCollection` | Collection per FRO |
| GET | `/ngo-admin/fro-performance` | `getFroPerformance` | FRO performance |
| GET | `/ngo-admin/fro/:id/summary` | `getFroSummary` | Single FRO summary |
| POST | `/ngo-admin/achieved-target` | `setAchievedTarget` | Set achieved target |
| GET | `/ngo-admin/incentives` | `getIncentives` | Incentive list |
| POST | `/ngo-admin/incentive` | `setIncentive` | Set incentive |
| GET | `/ngo-admin/verification` | `getVerificationFroWise` | Verification stats |
| GET | `/ngo-admin/accounts/pending` | `getAccountsPending` | Pending verifications |
| POST | `/ngo-admin/accounts/:logId/verify` | `verifyLeadDone` | Verify lead |
| GET | `/ngo-admin/stations` | `getStations` | List stations |
| POST | `/ngo-admin/stations` | `createStationHandler` | Create station |
| POST | `/ngo-admin/station-assignments` | `saveStationAssignment` | Assign FRO to station |
| DELETE | `/ngo-admin/station-assignments/:id` | `removeStationAssignment` | Remove assignment |
| PUT | `/ngo-admin/station-assignments/:id/reassign` | `reassignStationFro` | Reassign FRO |
| PUT | `/ngo-admin/stations/:station/update-ngos` | `updateStationNgos` | Update station NGOs |
| DELETE | `/ngo-admin/stations/:station` | `removeStationByName` | Delete station |
| POST | `/ngo-admin/stations/:station/transfer-data` | `transferStationData` | Transfer data |
| GET | `/ngo-admin/transfers` | `getTransferHistory` | Transfer history |
| GET | `/ngo-admin/transfers/:id/donors` | `getTransferDonors` | Transferred donors |
| POST | `/ngo-admin/transfers/:id/return-early` | `returnTransferEarly` | Return early |
| GET | `/ngo-admin/new-data` | `getNewData` | New unassigned data |
| POST | `/ngo-admin/new-data/distribute` | `distributeNewData` | Distribute data |
| GET | `/ngo-admin/alerts` | `getAlerts` | List alerts |
| PUT | `/ngo-admin/alerts/:id/acknowledge` | `acknowledgeAlert` | Acknowledge |
| GET | `/ngo-admin/database-requests` | `getDataRequests` | FRO data requests |
| PUT | `/ngo-admin/database-requests/:id/resolve` | `resolveDataRequest` | Resolve |
| GET | `/ngo-admin/suspense` | `listNgoSuspense` | NGO suspense |
| PUT | `/ngo-admin/suspense/:id/link-donor` | `linkSuspenseToDonor` | Link suspense |
| PUT | `/ngo-admin/suspense/:id/no-match` | `markSuspenseUnmatched` | No match |
| GET | `/ngo-admin/suspense/search-donors` | `searchDonorsForSuspense` | Search |
| GET | `/ngo-admin/donor-crm/leads` | `listLeads` | CRM leads |
| POST | `/ngo-admin/donor-crm/leads` | `createLead` | Create CRM lead |
| POST | `/ngo-admin/donor-crm/leads/import` | `importLeads` | Import leads |
| PUT | `/ngo-admin/donor-crm/leads/assign` | `assignLeads` | Assign leads |
| PUT | `/ngo-admin/donor-crm/leads/:id/transfer` | `transferLead` | Transfer lead |
| GET | `/ngo-admin/donor-crm/leads/history` | `getLeadHistory` | Lead history |
| GET | `/ngo-admin/donor-crm/duplicates` | `getDuplicateLeads` | Duplicates |
| GET | `/ngo-admin/donor-crm/donors/:id` | `getFullDonorDetail` | Full detail |
| GET | `/ngo-admin/donor-crm/donors/:id/receipts` | `getDonorReceipts` | Receipts |
| GET | `/ngo-admin/donor-crm/donors/:id/followups` | `getDonorFollowups` | Follow-ups |
| GET | `/ngo-admin/donor-crm/donors/:id/transactions` | `getDonorTransactions` | Transactions |
| POST | `/ngo-admin/donor-crm/followups` | `createFollowup` | Create follow-up |
| GET | `/ngo-admin/master-search` | `masterSearch` | Master search |
| GET | `/ngo-admin/call-analytics` | `getCallAnalytics` | Call analytics |
| GET | `/ngo-admin/rejected-leads` | `getRejectedLeads` | Rejected lead tickets |
| PUT | `/ngo-admin/rejected-leads/:id/acknowledge` | `acknowledgeRejectedLead` | Acknowledge |

---

#### 3.2.31 FRO Routes (`froRoutes.js`)

All routes require `authenticate` + custom `requireFro` middleware (department === 'fro') unless noted.

| Method | Path | Controller | Description |
|--------|------|------------|-------------|
| GET | `/fro/status` | super_admin,admin (before requireFro) | `getLiveStatuses` |
| GET | `/fro/dashboard` | `getDashboard` | FRO dashboard |
| GET | `/fro/donors` | `getMyDonors` | Assigned donors |
| GET | `/fro/transferred-leads` | `getTransferredLeads` | Unassigned station leads |
| PUT | `/fro/donors/:id/status` | `updateDonorStatus` | Update donor status |
| PUT | `/fro/donors/:id/mark-seen` | Inline | Mark donor seen |
| GET | `/fro/donors/:id/logs` | `getDonorLogs` | Interaction logs |
| POST | `/fro/donors/:id/logs` | `createDonorLogHandler` | Create interaction log |
| POST | `/fro/donors/:id/schedule` | `scheduleContact` | Schedule contact |
| POST | `/fro/upload-payment-screenshot` | `uploadPaymentScreenshot` | Upload screenshot |
| GET | `/fro/scheduled` | `getFroScheduled` | Scheduled contacts |
| GET | `/fro/callbacks` | `getFroCallbacks` | Callback list |
| PUT | `/fro/status` | `updateLiveStatus` | Update FRO live status |
| GET | `/fro/history` | `getMyHistory` | Activity history |
| GET | `/fro/target` | `getMyTarget` | Monthly target |
| POST | `/fro/request-data` | `requestData` | Request data from admin |
| GET | `/fro/database-requests` | `getMyDataRequests` | My data requests |
| GET | `/fro/follow-ups` | `getFollowUps` | Follow-up list |
| GET | `/fro/rejected-leads` | `getRejectedLeads` | Rejected leads |
| GET | `/fro/lead-stats` | `getLeadStats` | Lead disposition stats |
| GET | `/fro/monthly-donors` | `getMonthlyDonors` | Monthly donor stats |
| GET | `/fro/donors/:id/history` | `getDonorHistory` | Donor history |
| GET | `/fro/donors/:id/full-history` | `getFullDonorHistory` | Full history |
| GET | `/fro/search-donors` | `searchDonors` | Search donors |
| GET | `/fro/suspense` | `listFroSuspense` | FRO suspense |
| PUT | `/fro/suspense/:id/resolve` | `resolveSuspenseEntry` | Resolve suspense |
| GET | `/fro/suspense/search-dispositions` | `searchFroDispositions` | Search dispositions |
| GET | `/fro/debug/my-stations` | `debugMyStations` | Debug |

**cURL:**
```bash
# FRO Dashboard
curl -X GET https://ucs-crm-backend.vercel.app/api/fro/dashboard \
  -H "Authorization: Bearer <token>"

# FRO Donors List
curl -X GET "https://ucs-crm-backend.vercel.app/api/fro/donors?status=pending&statusGroup=all" \
  -H "Authorization: Bearer <token>"

# Create Donor Log (Disposition)
curl -X POST https://ucs-crm-backend.vercel.app/api/fro/donors/123/logs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"action":"disposition","disposition_category":"connected","disposition_detail":"lead_done","amount_collected":500,"notes":"Donor agreed to donate monthly","project_name":"Mission Annapurna","pan_number":"ABCDE1234F"}'

# Upload Payment Screenshot
curl -X POST https://ucs-crm-backend.vercel.app/api/fro/upload-payment-screenshot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"file_base64":"base64data...","mime_type":"image/jpeg"}'
```

---

#### 3.2.32 Accounts Routes (`accountsRoutes.js`)

All require `authenticateRole('accounts', 'super_admin')`.

| Method | Path | Controller | Description |
|--------|------|------------|-------------|
| GET | `/accounts/leads` | `getLeadList` | Lead verification list |
| POST | `/accounts/leads/:logId/verify` | `verifyLead` | Verify & generate receipt |
| POST | `/accounts/leads/:logId/reject` | `rejectLead` | Reject lead |
| PATCH | `/accounts/leads/:logId/field` | `patchLeadField` | Inline field edit |
| GET | `/accounts/suspense` | `getSuspenseList` | Suspense list |
| POST | `/accounts/suspense` | `createSuspense` | Create suspense |
| POST | `/accounts/suspense/:id/note` | `addSuspenseNote` | Add note |
| POST | `/accounts/suspense/:id/assign` | `assignSuspense` | Assign to FRO |
| POST | `/accounts/leads/:logId/receipt` | `generateReceipt` | Generate receipt |
| GET | `/accounts/leads/:logId/receipt` | `getReceipt` | Get receipt |
| GET | `/accounts/receipts` | `getReceiptList` | List receipts |
| GET | `/accounts/receipts/pending` | `getPendingReceipts` | Unsent receipts |
| POST | `/accounts/receipts/mark-sent` | `markReceiptAsSent` | Mark sent |
| GET | `/accounts/donor/:donorId/history` | `getDonorHistory` | Donor transaction history |
| GET | `/accounts/day-end-report` | `getDayEndReport` | Day-end reconciliation |

**cURL:**
```bash
# List Leads for Verification
curl -X GET "https://ucs-crm-backend.vercel.app/api/accounts/leads?status=pending" \
  -H "Authorization: Bearer <token>"

# Verify Lead (Accounts)
curl -X POST https://ucs-crm-backend.vercel.app/api/accounts/leads/456/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"collected_amount":500,"receipt_date":"2026-07-13","payment_mode":"UPI"}'

# Generate Receipt
curl -X POST https://ucs-crm-backend.vercel.app/api/accounts/leads/456/receipt \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"ngo_id":1,"donor_name":"John","amount":500,"pan":"ABCDE1234F"}'
```

---

#### 3.2.33 Bank Audit Routes (`bankAuditRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| GET | `/accounts/bank-audit/sources` | accounts,super_admin | `listSources` | List sources |
| POST | `/accounts/bank-audit/sources` | accounts,super_admin | `addSource` | Add source |
| PUT | `/accounts/bank-audit/sources/:id` | accounts,super_admin | `editSource` | Edit source |
| DELETE | `/accounts/bank-audit/sources/:id` | accounts,super_admin | `removeSource` | Delete source |
| GET | `/accounts/bank-audit/entries` | accounts,super_admin | `listEntries` | List entries |
| POST | `/accounts/bank-audit/entries` | accounts,super_admin | `addEntry` | Add entry |
| PUT | `/accounts/bank-audit/entries/:id` | accounts,super_admin | `editEntry` | Edit entry |
| DELETE | `/accounts/bank-audit/entries/:id` | accounts,super_admin | `removeEntry` | Delete entry |
| GET | `/accounts/bank-audit/entries/suggest` | accounts,super_admin | `suggestEntries` | Suggest matching |
| PUT | `/accounts/bank-audit/entries/:id/verify` | accounts,super_admin | `markEntryVerified` | Verify |
| PUT | `/accounts/bank-audit/entries/:id/assign-ngo` | accounts,super_admin | `assignEntryToNgo` | Assign NGO |

---

#### 3.2.34 Email Import Routes (`emailImportRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/accounts/email-import/trigger` | accounts,super_admin | `triggerImport` | Manual import |
| POST | `/accounts/email-import/process-seen` | accounts,super_admin | `processSeenEmails` | Process seen |
| POST | `/accounts/email-import/test` | accounts,super_admin | `testEmail` | Test connection |
| GET | `/accounts/email-import/status` | accounts,super_admin | `getImportStatus` | Status |
| GET | `/accounts/email-import/log` | accounts,super_admin | `getLog` | Import log |
| GET | `/accounts/email-import/accounts` | accounts,super_admin | `list` | Email accounts |
| POST | `/accounts/email-import/accounts` | accounts,super_admin | `create` | Create account |
| PUT | `/accounts/email-import/accounts/:id` | accounts,super_admin | `update` | Update |
| DELETE | `/accounts/email-import/accounts/:id` | accounts,super_admin | `remove` | Delete |

---

#### 3.2.35 Webhook Routes (`webhookRoutes.js`)

**Public (unauthenticated):**

| Method | Path | Controller | Description |
|--------|------|------------|-------------|
| POST | `/webhooks/razorpay` | `razorpayWebhookEntry` | Razorpay (legacy) |
| POST | `/webhooks/razorpay/:accountId` | `razorpayWebhookForAccount` | Per-account |
| POST | `/webhooks/paytm` | `paytmWebhookEntry` | Paytm |

**Authenticated (accounts, super_admin):**

| Method | Path | Controller | Description |
|--------|------|------------|-------------|
| GET | `/webhooks/status` | `getWebhookStatus` | Status counts |
| GET | `/webhooks/log` | `getWebhookLogs` | Webhook log |
| GET | `/webhooks/razorpay/accounts` | `listRazorpayAccounts` | List accounts |
| POST | `/webhooks/razorpay/accounts` | `createRazorpayAccount` | Create |
| GET | `/webhooks/razorpay/accounts/:id` | `getRazorpayAccount` | Get |
| PUT | `/webhooks/razorpay/accounts/:id` | `updateRazorpayAccount` | Update |
| DELETE | `/webhooks/razorpay/accounts/:id` | `deleteRazorpayAccount` | Delete |
| POST | `/webhooks/razorpay/sync` | `triggerRazorpaySync` | Sync all/default |
| POST | `/webhooks/razorpay/accounts/:id/sync` | `triggerRazorpaySyncForAccount` | Sync specific |

---

#### 3.2.36 Bank Statement Routes (`bankStatementRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/accounts/bank-statement/preview` | accounts,super_admin | `previewStatement` | Preview CSV/XLSX |
| POST | `/accounts/bank-statement/import` | accounts,super_admin | `importStatement` | Import to bank_audit_entries |

---

#### 3.2.37 WhatsApp Routes (`whatsappRoutes.js`)

All require `accounts` or `super_admin` unless noted.

| Method | Path | Controller | Description |
|--------|------|------------|-------------|
| GET | `/whatsapp/accounts` | `list` | WhatsApp accounts |
| GET | `/whatsapp/accounts/agents/search` | `searchAgents` | Search FRO agents |
| GET | `/whatsapp/accounts/:id` | `getById` | Get account |
| POST | `/whatsapp/accounts` | `create` | Create account |
| PUT | `/whatsapp/accounts/:id` | `update` | Update |
| DELETE | `/whatsapp/accounts/:id` | `remove` | Delete |
| GET | `/whatsapp/accounts/:accountId/agents` | `listAgents` | List FRO agents |
| POST | `/whatsapp/accounts/:accountId/agents` | `assignAgent` | Assign agent |
| DELETE | `/whatsapp/accounts/:accountId/agents/:froId` | `removeAgent` | Remove agent |
| POST | `/whatsapp/test` | `test` | Test connection |
| GET | `/whatsapp/status` | `status` | API status |
| POST | `/whatsapp/send-receipt/:logId` | `sendReceipt` | Send receipt |
| POST | `/whatsapp/send-ngo-info` | `sendNgoInfo` | NGO info template |
| POST | `/whatsapp/send-template` | `sendCustomTemplate` | Custom template |
| GET | `/whatsapp/templates` | `listTemplates` | List templates |
| POST | `/whatsapp/send-direct` | `sendDirect` | Direct message |

---

#### 3.2.38 OCR Routes (`ocrRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/ocr/parse` | None | `parseImage` | OCR image → text |
| POST | `/ocr/extract` | None | `extractImage` | Extract structured data |

---

#### 3.2.39 Super Admin Routes (`superAdminRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| GET | `/super-admin/ngo-admin-targets` | super_admin | `getNgoAdminTargets` | NGO admin targets |
| PUT | `/super-admin/ngo-admin-targets/:workerId` | super_admin | `setNgoAdminTarget` | Set target |

---

#### 3.2.40 Event Head Routes (`eventHeadRoutes.js`)

All routes require `authenticate` (any authenticated user).

| Method | Path | Controller | Description |
|--------|------|------------|-------------|
| GET | `/event-head/events/dashboard` | `getEventHeadDashboard` | Dashboard |
| GET | `/event-head/events/calendar` | Calendar events | |
| GET | `/event-head/events/ngo/:ngoId` | Events by NGO | |
| GET | `/event-head/events/state/:state` | Events by state | |
| POST | `/event-head/events` | `createEventHandler` | Create event |
| GET | `/event-head/events` | `listEventHeadEvents` | List events |
| GET | `/event-head/events/:id` | `getEventHeadEvent` | Get event |
| PUT | `/event-head/events/:id` | `updateEventHeadEvent` | Update event |
| PUT | `/event-head/events/:id/status` | `updateEventHeadStatus` | Update status |
| DELETE | `/event-head/events/:id` | `deleteEventHeadEvent` | Delete event |
| POST | `/event-head/events/:id/submit` | `submitEventHeadApproval` | Submit approval |
| PUT | `/event-head/events/:id/approve` | `approveEventHeadEvent` | Approve |
| PUT | `/event-head/events/:id/reject` | `rejectEventHeadEvent` | Reject |
| POST | `/event-head/assets` | `createAsset` | Create asset |
| GET | `/event-head/assets` | `listAssets` | List assets |
| GET | `/event-head/assets/utilization` | `getAssetUtilization` | Utilization |
| GET | `/event-head/assets/:id` | `getAsset` | Get asset |
| PUT | `/event-head/assets/:id` | `editAsset` | Edit asset |
| DELETE | `/event-head/assets/:id` | `removeAsset` | Delete asset |
| POST | `/event-head/assets/issue` | `issueAssetItem` | Issue asset |
| PUT | `/event-head/assets/return/:id` | `returnAssetItem` | Return asset |
| POST | `/event-head/materials` | `createMaterial` | Create material |
| GET | `/event-head/materials` | `listMaterials` | List materials |
| GET | `/event-head/materials/stock` | `getMaterialStock` | Stock overview |
| PUT | `/event-head/materials/:id` | `editMaterial` | Edit material |
| PUT | `/event-head/materials/:id/stock` | `adjustMaterialStock` | Adjust stock |
| DELETE | `/event-head/materials/:id` | `removeMaterial` | Delete material |
| GET | `/event-head/events/:eventId/distributions` | `listDistributions` | Distributions |
| POST | `/event-head/events/:eventId/distributions` | `createDistribution` | Create distribution |
| GET | `/event-head/beneficiaries` | `listBeneficiaries` | List beneficiaries |
| POST | `/event-head/beneficiaries` | `createBeneficiary` | Create beneficiary |
| POST | `/event-head/volunteers` | `createVolunteer` | Create volunteer |
| GET | `/event-head/volunteers` | `listVolunteers` | List volunteers |
| PUT | `/event-head/volunteers/:id` | `editVolunteer` | Edit volunteer |
| GET | `/event-head/events/:eventId/expenses` | `listExpenses` | Event expenses |
| POST | `/event-head/events/:eventId/expenses` | `createExpense` | Create expense |
| DELETE | `/event-head/events/:eventId/expenses/:id` | `removeExpense` | Delete expense |
| POST | `/event-head/vehicles` | `createVehicle` | Create vehicle |
| GET | `/event-head/vehicles` | `listVehicles` | List vehicles |
| POST | `/event-head/vehicles/assign` | `assignVehicle` | Assign vehicle |
| GET | `/event-head/events/:eventId/media` | `listMedia` | Event media |
| POST | `/event-head/events/:eventId/media` | `uploadMedia` | Upload media |
| DELETE | `/event-head/events/:eventId/media/:id` | `removeMedia` | Delete media |
| GET | `/event-head/events/:eventId/attendance` | `listAttendance` | Event attendance |
| POST | `/event-head/events/:eventId/attendance` | `createAttendance` | Mark attendance |
| GET | `/event-head/events/:eventId/checklist` | `getChecklist` | Checklist |
| PUT | `/event-head/events/:eventId/checklist/:itemId` | `updateChecklistItem` | Update checklist |
| GET | `/event-head/reports/event/:eventId` | `generateEventReport` | Generate report |
| GET | `/event-head/approvals` | `listApprovals` | Pending approvals |
| GET | `/event-head/csr-partners` | `listPartners` | CSR partners |
| GET | `/event-head/donors` | `listDonors` | Donors list |

---

#### 3.2.41 FRO WhatsApp Routes (`froWhatsAppRoutes.js`)

| Method | Path | Middleware | Controller | Description |
|--------|------|-----------|------------|-------------|
| POST | `/fro/whatsapp/login` | None | `whatsappLogin` | FRO WhatsApp login |
| GET | `/fro/whatsapp/conversations` | authenticate+fro | `listConversations` | Conversations |
| GET | `/fro/whatsapp/conversations/unread-count` | authenticate+fro | `unreadCount` | Unread |
| GET | `/fro/whatsapp/conversations/:id/messages` | authenticate+fro | `listMessages` | Messages |
| POST | `/fro/whatsapp/conversations/:id/send` | authenticate+fro | `sendMessage` | Send reply |
| POST | `/fro/whatsapp/send-direct` | authenticate+fro | `sendDirect` | Direct message |
| PUT | `/fro/whatsapp/conversations/:id/read` | authenticate+fro | `markRead` | Mark read |

---

### 3.3 Database Schema

#### Table: `workers`
Core worker/employee table.
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| name | TEXT | |
| email | TEXT | |
| login_id | TEXT UNIQUE | |
| password | TEXT | bcrypt hash |
| gender | TEXT | Male/Female/Other |
| dob | DATE | |
| phone | TEXT | |
| alternate_phone | TEXT | |
| department | TEXT | FRO, HR, admin, etc. |
| shift | TEXT | Shift name |
| address, city, state, pincode | TEXT | |
| permanent_address | TEXT | |
| photo_url | TEXT | |
| is_active | BOOLEAN | |
| onboarding_completed | BOOLEAN | |
| ngo_id | INTEGER FK→ngos | Primary NGO |
| created_by | UUID FK→workers | |
| father_husband_name | TEXT | |
| marital_status | TEXT | |
| pan_number | TEXT | |
| aadhar_number | TEXT | |
| aadhar_front_url, aadhar_back_url | TEXT | |
| pan_card_url, bank_proof_url, light_bill_url | TEXT | |
| account_holder_name, ifsc_code, account_number | TEXT | |
| emergency_contact_name, emergency_contact_relation, emergency_contact_phone | TEXT | (×2) |
| declaration_date, declaration_place | TEXT | |
| previous_organizations | TEXT | JSON string |
| shift_start_time, shift_end_time | TEXT | "10:00", "19:00" |
| daily_collection_target | DECIMAL(12,2) | For NGO admins |
| created_at | TIMESTAMPTZ | |

#### Table: `attendance`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| worker_id | UUID FK→workers | |
| date | DATE | IST |
| punch_in_time | TIMESTAMPTZ | |
| punch_out_time | TIMESTAMPTZ | |
| punch_in_lat, punch_in_lng | DOUBLE | |
| punch_out_lat, punch_out_lng | DOUBLE | |
| status | TEXT | present/late/absent/half-day/leave |
| late_minutes | INTEGER | |
| created_at | TIMESTAMPTZ | |

#### Table: `users`
Panel users (admin, hr, recruiter, telecaller, accounts, etc.)
| Column | Type |
|--------|------|
| id | UUID PK |
| ngo_id | INTEGER FK→ngos |
| name | TEXT |
| email | TEXT UNIQUE |
| password_hash | TEXT |
| role | TEXT |
| department | TEXT |
| is_active | BOOLEAN |
| login_id | TEXT |

#### Table: `ngos`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| name | TEXT UNIQUE |
| code | TEXT |
| is_active | BOOLEAN |
| daily_collection_target | DECIMAL(12,2) |

#### Table: `donor_profiles`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | |
| name | TEXT | |
| mobile_number | TEXT | |
| ngo | TEXT | |
| ngo_id | INTEGER FK→ngos | |
| city, address_1, email | TEXT | |
| pan_number | TEXT | |
| project_supported | TEXT | |
| amount, total_amount | DECIMAL(12,2) | |
| donation_count | INTEGER | |
| birth_date | DATE | |
| last_donation_date, first_donation_date | DATE | |

#### Table: `fro_assignments`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | |
| donor_id | INTEGER FK→donor_profiles | |
| fro_worker_id | UUID FK→workers | |
| ngo_id | INTEGER FK→ngos | |
| station | TEXT | |
| status | TEXT | pending/contacted/lead_done/etc |
| notes | TEXT | |
| last_contacted_at | TIMESTAMPTZ | |
| next_follow_up | DATE | |
| is_new | BOOLEAN | |
| assigned_at | TIMESTAMPTZ | |

#### Table: `fro_donor_logs`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | |
| assignment_id | INTEGER FK | |
| donor_id | INTEGER FK | |
| fro_worker_id | UUID FK | |
| action | TEXT | call/visit/message/donation |
| notes | TEXT | |
| outcome | TEXT | |
| amount_collected | DECIMAL(12,2) | |
| disposition_category | TEXT | connected/not_connected |
| disposition_detail | TEXT | lead_done/scheduled/etc |
| scheduled_at | TIMESTAMPTZ | |
| payment_screenshot_url | TEXT | |
| pan_number | TEXT | |
| accounts_status | TEXT | pending/verified/rejected |
| rejection_reason | TEXT | |
| remark | TEXT | |
| upi_transaction_id | TEXT | |
| transaction_datetime | TIMESTAMPTZ | |
| payment_from | TEXT | |
| payment_mode | TEXT | UPI/Cash/Card |
| verified_at, verified_by | TIMESTAMPTZ/TEXT | |
| created_at | TIMESTAMPTZ | |

#### Table: `fro_live_status`
| Column | Type |
|--------|------|
| id | UUID PK |
| worker_id | UUID UNIQUE FK |
| status | TEXT (online, on_call, idle, offline, break) |
| current_donor_name, current_donor_id | TEXT/INT |
| call_started_at | TIMESTAMPTZ |
| today_calls, today_talk_seconds | INT |
| today_skipped, today_idle_seconds, today_break_seconds | INT |
| on_break | BOOLEAN |
| break_started_at | TIMESTAMPTZ |
| break_type | TEXT |

#### Table: `fro_station_assignments`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| fro_worker_id | UUID FK |
| ngo_id | INTEGER FK |
| station | TEXT |

#### Table: `fro_transfers`
| Column | Type |
|--------|------|
| id | UUID PK |
| station | TEXT |
| source_fro_worker_id | TEXT |
| target_fro_worker_id | TEXT |
| target_station | TEXT |
| ngo_id | TEXT |
| donor_count | INTEGER |
| donor_ids | JSONB |
| returned | BOOLEAN |
| auto_return_at | TIMESTAMPTZ |

#### Table: `fro_targets`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| worker_id | UUID FK |
| month | DATE |
| target_amount | DECIMAL(12,2) |
| achieved_target | DECIMAL(12,2) |
| is_auto_generated | BOOLEAN |
| incentive | DECIMAL(12,2) |

#### Table: `daily_achievements`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| worker_id | UUID FK |
| date | DATE |
| amount | DECIMAL(12,2) |

#### Table: `salary_history`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| worker_id | UUID FK |
| salary | DECIMAL(12,2) |
| from_month, to_month | TEXT (YYYY-MM) |
| paid_at | TIMESTAMPTZ |
| extra_amount | DECIMAL(12,2) |
| created_by | UUID |

#### Table: `worker_loans`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| worker_id | UUID FK | |
| type | TEXT | advance/loan |
| total_amount | DECIMAL(12,2) | |
| reason | TEXT | |
| monthly_deduction | DECIMAL(12,2) | |
| remaining_amount | DECIMAL(12,2) | |
| status | TEXT | pending/approved/rejected/active/closed |

#### Table: `worker_loan_deductions`
| Column | Type |
|--------|------|
| id | UUID PK |
| loan_id | UUID FK |
| month | DATE |
| amount | DECIMAL(12,2) |

#### Table: `leaves`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| worker_id | UUID FK | |
| type | TEXT | full_day/half_day/vacational/emergency |
| leave_date, start_date, end_date | DATE | |
| half_start_time, half_end_time | TEXT | |
| reason | TEXT | |
| status | TEXT | pending/approved/rejected |
| days | INTEGER | |
| proof_data, proof_mime | TEXT | |
| admin_remark | TEXT | |

#### Table: `attendance_corrections`
| Column | Type |
|--------|------|
| id | UUID PK |
| worker_id | UUID FK |
| attendance_id | UUID FK |
| date | DATE |
| field | TEXT (punch_in/punch_out) |
| requested_time | TIMESTAMPTZ |
| reason | TEXT |
| status | TEXT (pending/hr_verified/approved/rejected) |
| hr_remark, admin_remark | TEXT |

#### Table: `events`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| title | TEXT |
| description | TEXT |
| event_date | DATE |
| event_time | TIME |
| location | TEXT |
| ngo_id | INTEGER |
| is_active | BOOLEAN |
| created_by | UUID |

#### Table: `holidays`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| name | TEXT |
| date | DATE |
| is_recurring | BOOLEAN |
| ngo_id | INTEGER |

#### Table: `notices`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| title | TEXT |
| content | TEXT |
| target_role | TEXT |
| is_active | BOOLEAN |
| ngo_id | INTEGER |
| created_by_name | TEXT |

#### Table: `achievements`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| worker_id | UUID FK |
| title | TEXT |
| description | TEXT |
| ngo_id | INTEGER |

#### Table: `tasks`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| worker_id | UUID FK |
| title | TEXT |
| description | TEXT |
| status | TEXT |
| deadline | TIMESTAMPTZ |

#### Table: `leads`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| name, phone | TEXT |
| age | INTEGER |
| source, status, notes | TEXT |
| recruiter_id | INTEGER |
| created_by | INTEGER |
| dob | DATE |

#### Table: `call_logs`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| lead_id | INTEGER FK |
| telecaller_id | INTEGER |
| duration_seconds | INTEGER |
| call_type, status, notes | TEXT |
| follow_up_date | DATE |

#### Table: `qr_codes`
| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| label | TEXT | |
| latitude, longitude | DOUBLE | GPS center |
| radius_meters | DOUBLE | Geo-fence radius |
| code | TEXT | QR code data |
| is_active | BOOLEAN | |
| created_by | UUID | |

#### Table: `bank_audit_sources`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| name | TEXT |
| type | TEXT (bank/upi) |

#### Table: `bank_audit_entries`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| source_id | INTEGER FK |
| transaction_date | DATE |
| description | TEXT |
| amount | DECIMAL(12,2) |
| type | TEXT (credit/debit) |
| reference_no | TEXT |
| donor_id | INTEGER FK |
| ngo_id | INTEGER |
| status | TEXT (unverified/verified/matched/unmatched) |
| notes | TEXT |

#### Table: `razorpay_accounts`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| name | TEXT |
| key_id | TEXT |
| key_secret | TEXT (encrypted) |
| webhook_secret | TEXT (encrypted) |
| is_active | BOOLEAN |

#### Table: `whatsapp_accounts`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| name | TEXT |
| phone_number_id | TEXT |
| business_account_id | TEXT |
| access_token | TEXT (encrypted) |
| is_active | BOOLEAN |

#### Table: `email_import_accounts`
| Column | Type |
|--------|------|
| id | SERIAL PK |
| email | TEXT |
| imap_host, imap_port | TEXT/INT |
| username, password | TEXT |
| ngo_id | INTEGER |
| is_active | BOOLEAN |

#### Additional Tables:
- `rejected_lead_tickets` — Rejected donation leads with review workflow
- `payment_webhook_log` — Webhook event log
- `email_import_log` — Email import history
- `notification_log` — Push notification history
- `worker_ngo_allocations` — Worker NGO allocation with salary portion
- `event_head_events` — Event head detailed events
- `event_head_assets`, `event_head_materials` — Event resources
- `event_head_volunteers` — Event volunteers
- `event_head_vehicles` — Event vehicles
- `event_head_expenses` — Event expense tracking
- `event_head_media` — Event media files
- `event_head_attendance` — Event volunteer attendance
- `event_head_checklist` — Event checklist items
- `settings` — App configuration key-value store
- `letter_templates` — HR letter templates
- `generated_letters` — Generated HR letters
- `causes` — NGO causes/funds
- `data_sources` — Data import source definitions
- `data_import_batches` — Data import batch tracking
- `fro_whatsapp_assignments` — FRO WhatsApp account assignments
- `fro_scheduled_contacts` — Scheduled FRO callbacks
- `rejected_lead_tickets` — Rejected donation ticket workflow
- `suspense_entries` — Suspense account management
- `donor_crm_leads` — NGO admin CRM leads
- `donor_crm_followups` — CRM follow-up records

---

## 4. Main CRM SPA — Panel Documentation

**Location:** `ucs crm/src/`

**Entry Point:** `src/main.jsx` — Renders `<App />` in `<BrowserRouter>` with `<React.StrictMode>`.

**Global Auth Context** (`src/store.jsx`): `UcsProvider` manages `user` and `token` state via localStorage keys `ucs_token` and `ucs_user`.

**Allowed Roles:** `super_admin`, `admin`, `hr`, `accounts`, `recruiter`, `telecaller`, `fro`, `worker`, `event_head`, `event_manager`, `Event Manager`, `Event Head`

**Core API Module** (`src/api/auth.js`):
- `api(path, options)` — fetch wrapper with Bearer token, 120s timeout, JSON parsing, auto-logout on 401
- `login(identifier, password)` — `POST /auth/login`

**Routing** (`src/App.jsx`):
- `/sa/*` → `SuperAdminPanel`
- `/hr/*` → `HRPanel`
- `/ngo-admin/*` → `NgoAdminPanel`
- `/fro/*` → `FROPanel`
- `/accounts/*` → `AccountsPanel`
- `/recruiter/*` → `RecruiterPanel`
- `/event-head/*` → `EventHeadPanel`
- `/login` → `Login`

---

### 4.1 Super Admin Panel

**Location:** `ucs crm/src/panels/super-admin/` (24+ source files)  
**Base Path:** `/sa/*`  
**Entry:** `SuperAdminPanel.jsx` (338 lines)

#### Sidebar Navigation
```
Dashboard        /sa/dashboard
Data Management  /sa/data-management
Organization     /sa/organization
Employees        /sa/employees
Leaves           /sa/leaves
Tickets          /sa/tickets
Assets Overview  /sa/assets
┌─ Organization Group ─┐
│ Organization         │
│ Employees            │
└──────────────────────┘
```

#### Internal Routes
| Path | Page | Description |
|------|------|-------------|
| `/sa/dashboard` | Dashboard (3322 lines) | KPI metrics, charts (Recharts), FRO live status, CSV export |
| `/sa/data-management` | DataManagement | Data import, batches, sources |
| `/sa/organization` | Organization | NGOs, structure |
| `/sa/employees` | Workers | Employee list with search/filter |
| `/sa/employees/:id` | WorkerDetail | Full profile, salary, attendance, targets |
| `/sa/leaves` | Leaves | All leaves, approve/reject |
| `/sa/tickets` | Tickets | Correction tickets, approve/reject |
| `/sa/events` | Events | Across-NGO events |
| `/sa/assets` | AssetOverview | Cross-panel asset summary |
| `/sa/accounts` | PanelFrame (iframe) | Embedded Accounts panel |
| `/sa/fro` | PanelFrame (iframe) | Embedded FRO panel |
| `/sa/hr` | PanelFrame (iframe) | Embedded HR panel |
| `/sa/ngo-admin` | PanelFrame (iframe) | Embedded NGO Admin |
| `/sa/event-head` | PanelFrame (iframe) | Embedded Event Head |
| `/sa/recruiter` | PanelFrame (iframe) | Embedded Recruiter |

#### API Endpoints Used
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/dashboard/super-admin?period=` | GET | Dashboard data |
| `/dashboard/fro-live` | GET | FRO live status |
| `/ngos` | GET | List NGOs |
| `/users` | GET | List users |
| `/hrs` | GET | List HRs |
| `/workers` | GET | Workers list |
| `/workers/:id` | GET | Worker detail |
| `/workers/:id/allocations` | GET/PUT | Worker allocations |
| `/attendance/all` | GET | All attendance |
| `/leaves` | GET | All leaves |
| `/holidays` | GET | Holidays |
| `/salary/workers-summary` | GET | Salary summary |
| `/salary/worker/:id/allocations` | GET | Worker salary |
| `/incentive/monthly-summary` | GET | Incentive summary |
| `/events` | GET | Events |
| `/notices` | GET | Notices |
| `/achievements` | GET | Achievements |
| `/causes` | GET | Causes |
| `/data-sources` | GET | Data sources |
| `/data-import/batches` | GET | Import batches |
| `/accounts/leads` | GET | Accounts leads |
| `/leads` | GET | Recruiter leads |
| `/attendance-corrections/pending` | GET | Pending tickets |
| `/attendance-corrections/hr-verified` | GET | HR verified tickets |
| `/attendance-corrections/all` | GET | All tickets |
| `/attendance-corrections/:id/approve` | PUT | Approve ticket |
| `/attendance-corrections/:id/reject` | PUT | Reject ticket |
| `/super-admin/ngo-admin-targets` | GET/PUT | NGO admin targets |
| `/dashboard/super-admin-alerts` | GET | Risk alerts |

---

### 4.2 HR Panel

**Location:** `ucs crm/src/panels/hr/` (30+ source files)  
**Base Path:** `/hr/*`  
**Entry:** `HRPanel.jsx` (254 lines)  
**Store:** `store.jsx` (107 lines — extensive API wrapper)

#### Sidebar Navigation
```
Overview       /hr/overview
Employees      /hr/employees
Attendance     /hr/attendance
Leaves         /hr/leaves
Letters        /hr/letters
HR Forms       /hr/hr-forms
Recruiters     /hr/recruiters
Holidays       /hr/holidays
QR Codes       /hr/qr
Loans & Adv.   /hr/loans
Tickets        /hr/tickets
Phone Numbers  /hr/phone-numbers
```

#### Store Functions (via `useHR()`)
| Category | Functions |
|----------|-----------|
| **Workers** | `fetchWorkers()`, `addWorker()`, `removeWorker()`, `fetchWorkerById()`, `updateWorker()`, `bulkUpdateWorkers()` |
| **NGOs** | `fetchNGOs()` |
| **Attendance** | `fetchAttendance()` |
| **Leaves** | `fetchLeaves()`, `decideLeave()` |
| **Letters** | `fetchTemplates()`, `generateLetter()`, `fetchWorkerLetters()` |
| **Notifications** | `sendNotif()` |
| **Holidays** | `fetchHolidays()`, `addHoliday()`, `removeHoliday()` |
| **Leads** | `fetchLeads()`, `addLead()`, `updateLead()` |
| **Recruiters** | `fetchRecruiters()`, `fetchRecruiterStats()`, `fetchRecruiterOverview()`, `fetchLeadsDashboard()` |
| **Salary** | `fetchWorkerSalaries()`, `addWorkerSalary()`, `updateWorkerSalary()` |
| **Incentives** | `fetchWorkerTargets()`, `updateWorkerTarget()`, `generateAllTargets()`, `setAchievement()`, `fetchIncentiveSummary()` |
| **Allocations** | `fetchWorkerAllocations()`, `setWorkerAllocations()`, `fetchWorkerSalaryAllocations()` |
| **Loans** | `fetchLoans()`, `fetchPendingLoans()`, `decideLoan()`, `fetchWorkerLoans()`, `fetchWorkerActiveLoans()` |
| **Tickets** | `fetchPendingTickets()`, `fetchAllTickets()`, `verifyTicket()`, `rejectTicket()` |
| **QR Codes** | `generateQR()`, `fetchQRCodes()`, `removeQRCode()` |
| **Settings** | `fetchSettings()`, `updateSettings()` |

#### Components
- **Overview** — Dashboard with metrics, attendance chart
- **Workers/EmployeeDetail** — Employee CRUD, full profile
- **Attendance** — Daily marking and view
- **Leaves** — Approve/reject
- **Letters** — Generate from templates (temp1.html–temp6.html)
- **HRForms** — Onboarding forms (Templates 1–6)
- **Holidays** — Calendar management
- **Recruiters** — Performance, leaderboard
- **GenerateQR** — Geofenced QR code generation
- **Loans** — Advance/loan approval workflow
- **Tickets** — Attendance correction handling
- **PhoneNumbers** — Worker phone management

#### Route Structure
| Path | Component |
|------|-----------|
| `/hr/overview` | Overview |
| `/hr/employees` | EmployeeList (Workers) |
| `/hr/employees/:id` | EmployeeDetail |
| `/hr/attendance` | Attendance |
| `/hr/leaves` | Leaves |
| `/hr/letters` | Letters |
| `/hr/hr-forms` | HRForms |
| `/hr/recruiters` | Recruiters |
| `/hr/holidays` | Holidays |
| `/hr/qr` | GenerateQR |
| `/hr/loans` | Loans |
| `/hr/tickets` | Tickets |
| `/hr/phone-numbers` | PhoneNumbers |
| `/hr/settings` | Settings |

**Letter Templates** (in `components/templates/`):
- `temp1.html` → Experience Letter
- `temp2.html` → Offer Letter
- `temp3.html` → Appointment Letter
- `temp4.html` → Relieving Letter
- `temp5.html` → Salary Certificate
- `temp6.html` → Confirmation Letter

---

### 4.3 Accounts Panel

**Location:** `ucs crm/src/panels/accounts/` (30+ source files)  
**Base Path:** `/accounts/*`  
**Entry:** `AccountsPanel.jsx` (244 lines)  
**Store:** `useAccounts()` — re-exports UcsContext

#### Sidebar Navigation
```
Lead Verification  /accounts/leads
Bank Audit         /accounts/bank-audit
Receipt History    /accounts/receipts
Receipts           /accounts/receipt-generator
Reports            /accounts/reports
Asset Register     /accounts/asset-register
WhatsApp Accounts  /accounts/whatsapp-accounts
WhatsApp Agents    /accounts/whatsapp-agents
```

#### Internal Routes
| Path | Page | Description |
|------|------|-------------|
| `/accounts/leads` | Dashboard | Lead verification with realtime updates |
| `/accounts/reports` | Reports | Financial reports |
| `/accounts/receipts` | ReceiptHistory | Generated receipts |
| `/accounts/receipt-generator` | Receipts | Bulk receipt generation |
| `/accounts/bank-audit` | BankAudit | Bank statement import & audit |
| `/accounts/whatsapp` | WhatsAppSettings | WhatsApp API config |
| `/accounts/whatsapp-agents` | WhatsAppAgents | Agent management |
| `/accounts/whatsapp-accounts` | WhatsAppAccountsManager | Account CRUD |
| `/accounts/template-settings` | TemplateSettings | Receipt template config |
| `/accounts/asset-register` | AssetRegister | NGO asset inventory |

#### Auth API
```js
apiGet(path), apiPost(path, body), apiPut(path, body), apiPatch(path, body), apiDelete(path)
```

#### Key Pages & Components

**Dashboard (Lead Verification):**
- Stat cards: Pending/Verified/Rejected counts + amounts
- Lead table with status, donor, NGO, amount filters
- Click to open `LeadDetail` modal
- Realtime subscription to `fro_donor_logs`

**Receipt Generator:**
- XLSX import → column matching → multi-NGO templates
- Bulk PDF generation via `pdfGenerator.js`
- Bulk WhatsApp sending via `ConfirmBulkModal` + `BulkProgressModal`

**Receipt Templates:**
| Template | Lines | Description |
|----------|-------|-------------|
| `ReceiptTemplate_MannCar.jsx` | 325 | Certificate-style with donation table |
| `ReceiptTemplate_BeingSevak.jsx` | 463 | Thank-you letter + formal receipt |
| `ReceiptTemplate_Ashray.jsx` | 412 | 80G receipt with gradient header |
| `ReceiptTemplateManncar.jsx` | 97 | Simplified variant |
| `ReceiptTemplateBeingSevak.jsx` | 130 | Simplified variant |
| `ReceiptTemplateAshray.jsx` | 138 | Simplified variant |

**Services:**
- `pdfGenerator.js` — jsPDF + html2canvas receipt PDF generation, ZIP batch download

**Components:**
- `RazorpayAccountsManager.jsx` — Payment gateway CRUD
- `WhatsAppAccountsManager.jsx` — WhatsApp account + template management
- `EmailAccountsView.jsx` — Email import account CRUD
- `ConfirmBulkModal.jsx`, `BulkProgressModal.jsx` — Bulk sending UI

---

### 4.4 FRO Panel (Field Relations Officer)

**Location:** `ucs crm/src/panels/fro/` (28+ source files)  
**Base Path:** `/fro/*`  
**Entry:** `FROPanel.jsx` (513 lines)  
**Store:** `useTelecaller()` — re-exports UcsContext

#### Sidebar Navigation
```
Dashboard          /fro/dashboard
Follow Up/Callback /fro/scheduled
My Leads           /fro/my-leads
Transferred        /fro/transferred-leads
Donors             /fro/donors
Call Logs          /fro/logs
Rejected Leads     /fro/rejected-leads
My Target          /fro/target
Suspense           /fro/suspense
WhatsApp Chat      /fro/whatsapp-chat
```

#### Internal Routes
| Path | Page | Description |
|------|------|-------------|
| `/fro/dashboard` | Dashboard | Today's stats, schedules |
| `/fro/scheduled` | Scheduled | Follow-ups + callbacks |
| `/fro/my-leads` | MyDonors | Assigned donor list |
| `/fro/transferred-leads` | TransferredLeads | Station leads |
| `/fro/rejected-leads` | RejectedLeads | Rejected by accounts |
| `/fro/donors` | Donors | Full searchable list |
| `/fro/logs` | CallLogs | Detailed call records |
| `/fro/target` | MyTarget | Monthly collection vs achieved |
| `/fro/history` | History | Activity history |
| `/fro/incentive-info` | IncentiveInfo | Incentive calculation |
| `/fro/suspense` | Suspense | Suspense handling |
| `/fro/whatsapp-chat` | WhatsAppChat | Chat interface |

#### API Endpoints Used

**Donors API** (`api/donors.js`):
- `GET /fro/donors` — List donors (with status/statusGroup filters)
- `GET /fro/donors/:id/logs` — Donor interaction logs
- `PUT /fro/donors/:id/status` — Update donor status
- `POST /fro/donors/:id/logs` — Create interaction log
- `POST /fro/donors/:id/schedule` — Schedule contact
- `GET /fro/dashboard` — Dashboard data
- `GET /fro/target` — Monthly target
- `GET /fro/scheduled` — Scheduled contacts
- `GET /fro/callbacks` — Callback list
- `GET /fro/history` — Activity history
- `GET /fro/rejected-leads` — Rejected leads
- `GET /fro/lead-stats` — Disposition stats
- `GET /fro/search-donors?q=` — Search donors
- `POST /fro/upload-payment-screenshot` — Upload screenshot
- `POST /fro/request-data` — Request data from admin
- `PUT /fro/status` — Update live status
- `PUT /fro/donors/:id/mark-seen` — Mark donor seen

#### Call Context (`CallContext.jsx`)
Manages FRO call lifecycle:
- `startCall`, `endCall` — Call timer
- `toggleBreak` — Break tracking with overtime warning (>1hr)
- `startDonorView`, `endDonorView` — Donor viewing time
- Auto-syncs status to `PUT /fro/status`
- Stats stored in localStorage key `fro_call_stats`

#### DispositionModal (`components/DispositionModal.jsx`)
Central FRO call disposition interface:

**Connected Dispositions:**
- `lead_done`, `scheduled`, `callback`, `visit_donate`, `promise_to_pay`, `payment_pending`, `already_donated`, `not_interested_now`, `language_barrier`, `transferred_senior`, `query_complaint`, `receipt_request`

**Not-Connected Dispositions:**
- `busy`, `ringing`, `unreachable`, `switched_off`, `wrong_number`, `invalid`, `rejected`

**Lead Done Flow:**
1. Select Project (Mission Annapurna/Vidhya/Aurat/Bezubaan/Atmanirbhar/Arogya, Sevak Seva Kendra, Eco-Warriors)
2. Enter Amount
3. Upload Payment Screenshot (with OCR for transaction extraction)
4. Enter UPI Transaction ID
5. Enter Address, PAN, DOB

#### Other Components
- `CallTimer.jsx` — Visual call timer
- `CardView.jsx` — Card-based donor navigation
- `ChatThread.jsx`, `ConversationList.jsx` — WhatsApp chat UI
- `TimePicker.jsx`, `ui.jsx` — Shared UI
- `utils/ocr.js` — OCR for payment screenshot processing

---

### 4.5 NGO Admin Panel

**Location:** `ucs crm/src/panels/ngo-admin/` (18+ source files)  
**Base Path:** `/ngo-admin/*`  
**Entry:** `NgoAdminPanel.jsx` (587 lines)  
**Store:** `useNgoAdmin()` — re-exports UcsContext

#### Sidebar Navigation
```
Dashboard          /ngo-admin/dashboard
Stations & FROs    /ngo-admin/station-mgmt
FRO Status         /ngo-admin/fro-status
Call Analytics     /ngo-admin/call-analytics
Donor CRM          /ngo-admin/donor-crm
Suspense           /ngo-admin/suspense
Alerts             /ngo-admin/alerts
Donors             /ngo-admin/donors
New Data           /ngo-admin/new-data
Attendance         /ngo-admin/attendance
Rejected Leads     /ngo-admin/rejected-leads
```

#### Internal Routes
| Path | Page | Description |
|------|------|-------------|
| `/ngo-admin/dashboard` | Dashboard | NGO KPIs, FRO performance |
| `/ngo-admin/alerts` | Alerts | System alerts |
| `/ngo-admin/donor-crm` | DonorCRM | Full CRM view |
| `/ngo-admin/donors` | Donors | Searchable donor list |
| `/ngo-admin/donors/:id` | DonorDetail | Full donor profile |
| `/ngo-admin/new-data` | NewData | Allocate new data to FROs |
| `/ngo-admin/station-mgmt` | StationManagement | Stations & FRO assignments |
| `/ngo-admin/attendance` | NgoAttendance | FRO attendance |
| `/ngo-admin/rejected-leads` | RejectedLeads | Review rejects |
| `/ngo-admin/fro-status` | FroLiveStatus | Live FRO activity |
| `/ngo-admin/suspense` | Suspense | Unmatched payments |
| `/ngo-admin/search` | SearchResults | Master search |
| `/ngo-admin/call-analytics` | CallAnalytics | FRO call performance |

#### API Endpoints
- `GET /ngo-admin/master-search?q=` — Global search
- `GET /ngo-admin/call-analytics` — Call analytics
- `GET /ngo-admin/accounts/pending` — Pending verifications
- `POST /ngo-admin/accounts/:logId/verify` — Verify lead
- `GET /ngo-admin/donor-crm/*` — Full CRM CRUD
- `GET /ngo-admin/stations` — Station management
- `GET /ngo-admin/new-data` — Unassigned data
- `POST /ngo-admin/new-data/distribute` — Distribute to FROs
- `GET /ngo-admin/alerts` — Alert management
- `GET /ngo-admin/suspense` — Suspense handling

---

### 4.6 Recruiter Panel

**Location:** `ucs crm/src/panels/recruiter/` (15+ source files)  
**Base Path:** `/recruiter/*`  
**Entry:** `RecruiterPanel.jsx` (180 lines)  
**Store:** `store.jsx` (157 lines — RecProvider/useRec)

#### State Management
| State | Description |
|-------|-------------|
| `candidates` | Array (hardcoded seed + API) |
| `jobs` | Job postings |
| `leads` | Recruiter leads (API-fetched) |
| `leadFilters` | `{ search, status, source }` |
| `leadStats` | `{ leads, today, onHold, conversion }` |

#### Constants
- `STAGES`: Contacted → Screening → Interview Scheduled → Selected → Offer Sent → Rejected
- `LEAD_SOURCES`: Walk-in, LinkedIn, Referral, Job Portal, Other
- `LEAD_STATUSES`: 12 statuses (hold, followed_up, call_back, scheduled, etc.)

#### Actions
| Action | Description |
|--------|-------------|
| `moveCandidate(id, stage)` | Pipeline stage change |
| `addCandidate(c)` | Add candidate |
| `addJob(j)` | Add job posting |
| `fetchLeads()` | API poll every 15s |
| `addLead(data)` | Optimistic create |
| `updateLead(id, data)` | Update lead |
| `deleteLead(id)` | Delete lead |

#### Sidebar Navigation
```
Dashboard   /recruiter/dashboard
Leads       /recruiter/leads
Candidates  /recruiter/candidates
Interviews  /recruiter/interviews
```

#### Components
- **Dashboard** — Pipeline metrics, lead stats, activity feed
- **Leads** — Filterable lead table
- **Candidates** — Searchable candidate list
- **Interviews** — Upcoming interviews
- **Pipeline** — Kanban pipeline
- **LeadDetail** — Edit modal
- **Jobs** — Job posting management

---

### 4.7 Event Head Panel

**Location:** `ucs crm/src/panels/event-head/` (25+ source files)  
**Base Path:** `/event-head/*`  
**Entry:** `EventHeadPanel.jsx` (268 lines)  
**Store:** `store.jsx` (131 lines — 40+ API functions)

#### Sidebar Navigation
```
DASHBOARD:
  Event Dashboard    /event-head/dashboard
  Monthly Planner    /event-head/monthly-planner
  Events             /event-head/events-list

PLANNING:
  Create Event       /event-head/create
  Event Checklist    /event-head/checklist

RESOURCES:
  Asset Register     /event-head/assets
  Material Register  /event-head/materials

EXECUTION:
  Beneficiary Dist.  /event-head/distribution
  Volunteer Mgmt     /event-head/volunteers
  Attendance         /event-head/attendance

REPORTS:
  All Events         /event-head/events
  Event Reports      /event-head/reports
  Approval Workflow  /event-head/approvals
  Notifications      /event-head/notifications
```

#### Internal Routes
| Path | Page | Description |
|------|------|-------------|
| `/event-head/dashboard` | EventDashboard | KPIs, metrics |
| `/event-head/monthly-planner` | MonthlyPlanner | Calendar grid |
| `/event-head/create` | CreateEvent | Event creation |
| `/event-head/checklist` | EventChecklist | Checklist management |
| `/event-head/assets` | AssetRegister | Event assets |
| `/event-head/materials` | MaterialRegister | Materials inventory |
| `/event-head/distribution` | BeneficiaryDistribution | Distribution tracking |
| `/event-head/volunteers` | VolunteerManagement | Volunteer CRUD |
| `/event-head/attendance` | AttendanceManagement | Event attendance |
| `/event-head/events-list` | MyEvents | Personal events |
| `/event-head/events` | EventsPage | All events |
| `/event-head/reports` | EventReports | Generated reports |
| `/event-head/approvals` | ApprovalWorkflow | Submit/approve/reject |
| `/event-head/notifications` | NotificationsPage | Notifications |

#### Store API Functions (~40+)
| Domain | Functions |
|--------|-----------|
| **Events** | `fetchEvents()`, `createEvent()`, `updateEvent()`, `deleteEvent()`, `fetchEventDashboard()`, `fetchEventsByMonth()`, `fetchEventsByNgo()`, `fetchEventsByState()`, `updateEventStatus()` |
| **Checklist** | `fetchChecklist()`, `updateChecklistItem()` |
| **Assets** | `fetchAssets()`, `createAsset()`, `updateAsset()`, `deleteAsset()`, `issueAsset()`, `returnAsset()`, `fetchAssetUtilization()` |
| **Materials** | `fetchMaterials()`, `createMaterial()`, `updateMaterial()`, `deleteMaterial()`, `fetchMaterialStock()`, `adjustMaterialStock()` |
| **Distributions** | `fetchDistributions()`, `createDistribution()`, `fetchBeneficiaries()`, `createBeneficiary()` |
| **Volunteers** | `fetchVolunteers()`, `createVolunteer()`, `updateVolunteer()`, `markVolunteerAttendance()` |
| **Expenses** | `fetchExpenses()`, `createExpense()`, `deleteExpense()` |
| **Vehicles** | `fetchVehicles()`, `createVehicle()`, `assignVehicle()` |
| **Media** | `fetchMedia()`, `uploadMedia()`, `deleteMedia()` |
| **Attendance** | `fetchEventAttendance()`, `markAttendance()` |
| **Reports** | `generateEventReport()`, `generateEventPdf()`, `generateEventExcel()` |
| **Approvals** | `fetchApprovals()`, `submitApproval()`, `approveEvent()`, `rejectEvent()` |

#### Constants
- `CATEGORIES`: Education, Health, Food Distribution, Women Empowerment, Animal Welfare, Disability Support, Environment, Medical Camp, Blood Donation
- `EVENT_STATUSES`: Draft → Submitted → Approved → Rejected → Completed → Closed → Cancelled → Postponed
- `ASSET_TYPES`: 24 types (Tables, Chairs, Canopy, Stage, Sound System, etc.)
- `MATERIAL_TYPES`: 15 types (Food Kits, Grocery Kits, Education Kits, etc.)
- `EXPENSE_TYPES`: 10 categories
- `CHECKLIST_ITEMS`: 8 items

#### Components
- **Overview** — Event dashboard metrics
- **CreateEvent** — Event creation form
- **Table** — Generic data table
- **Planner sub-components**: CalendarGrid, CalendarToolbar, EventModal, PlannerFilters, SummaryCards, LoadingSkeleton, EmptyState

---

### 4.8 Shared Components

**Location:** `ucs crm/src/components/`

| Component | File | Lines | Description |
|-----------|------|-------|-------------|
| DonorDetailModal | `DonorDetailModal.jsx` | 186 | Donor overlay: profile, donations, transactions, follow-ups |
| NotificationDrawer | `NotificationDrawer.jsx` | 127 | Slide-in drawer with sections, mark-read, clear |
| SettingsDrawer | `SettingsDrawer.jsx` | 108 | Theme selector + configurable views |
| RecentNotices | `RecentNotices.jsx` | 113 | Role-filtered notices |
| Toast | `Toast.jsx` | 55 | Global toast (success/error/info) |
| Skeleton | `Skeleton.jsx` | 85 | Loading placeholders (row, table, profile, dashboard, donors) |
| UI | `ui.jsx` | 184 | Dropdown, DatePicker, Avatar, Pill, Who |

### 4.9 Theme Architecture

**Global Themes** (`src/theme.js`) — 17 themes:
`sage, blue, emerald, purple, rose, amber, teal, ocean, sky, marine, indigo, steel, iceberg, twilight, cerulean, sapphire`

`applyTheme(themeId)` sets CSS variables on `:root` and persists to localStorage.

**Panel-Specific Themes** (`panels/hr/theme.js`, `panels/event-head/theme.js`):
8–10 themes per panel with CSS variable keys: `sand`, `paper`, `ink`, `line`, `sage`, `clay`, `gold`, `danger`, `radius`

### 4.10 CSS Architecture (`src/index.css`)

Single file with scoped classes per panel:
- `.panel-sa` — Super Admin (lines 64–497)
- `.panel-hr` — HR (lines 498–1053)
- `.panel-accounts`, `.panel-ngo-admin`, `.panel-fro`, `.panel-event-head` — Shared (lines 1055–1528)
- `.panel-recruiter` — Recruiter (lines 1530–1577+)

**Design Tokens:** Each panel defines CSS custom properties for colors, spacing, shadows.

**Responsive Breakpoints:** 820px (tablet sidebar), 480px (mobile compact)

---

## 5. Flutter Mobile App

**Location:** `client/` — Package: `ufs_attendance` (v1.0.0+3)  
**SDK:** ^3.12.0  
**Platforms:** Android, iOS, Web, Windows, macOS, Linux

### 5.1 Dependencies

| Package | Version | Usage |
|---------|---------|-------|
| mobile_scanner | ^6.0.11 | QR/Barcode scanning |
| intl | ^0.20.2 | Date/time formatting |
| google_fonts | ^6.2.1 | Manrope, Hanken Grotesk fonts |
| http | ^1.2.0 | HTTP client |
| geolocator | ^13.0.2 | GPS location |
| shared_preferences | ^2.3.0 | Local key-value storage |
| firebase_core | ^3.12.0 | Firebase core |
| firebase_messaging | ^15.2.0 | FCM push notifications |
| flutter_local_notifications | ^18.0.0 | Local notification display |
| image_picker | ^1.1.2 | Camera/gallery image selection |
| supabase_flutter | ^2.5.6 | Supabase realtime database |
| printing | ^5.13.4 | PDF printing |
| pdf | ^3.11.1 | PDF generation |

### 5.2 Configuration

**File:** `lib/config.dart`
```dart
class Config {
  static const String apiBaseUrl = 'https://attendance-roan-zeta.vercel.app/api';
  static const String supabaseUrl = 'https://sqlbimnmhdvesudpxtbi.supabase.co';
  static const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
}
```

### 5.3 Navigation Flow

```
SplashPage (loading check)
  ├── No token → LoginPage
  │     └── POST /auth/worker/login → saveToken + saveWorkerData
  │           └── checkOnboardingStatus → OnboardingPage or MainShell
  ├── Token + onboarding incomplete → OnboardingPage (11-step wizard)
  │     └── POST /onboarding/submit → MainShell
  └── Token + onboarding complete → MainShell
        ├── [Tab 0] HomePage (dashboard, clock, punch, stats, notifications)
        └── [Tab 1] ProfilePage (profile, calendar, loans, tickets, settings)
```

### 5.4 Complete API Surface

**Transport:** Custom DNS-over-HTTPS via Cloudflare (bypasses carrier DNS), 10s connect / 15s request timeout, SharedPreferences caching.

#### Auth & Profile
| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| `login()` | `POST /auth/worker/login` | `{identifier, password}` | `{token, user:{id,name,role,...}}` |
| `getMyProfile()` | `GET /workers/me` | — | `{id, name, email, phone, ...}` |
| `updateMyProfile()` | `PUT /workers/me` | profile fields | Updated profile |
| `updateMyEducation()` | `PUT /workers/me/education` | `{education:[...]}` | — |

#### Attendance
| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| `punchIn()` | `POST /attendance/punch-in` | `{code, latitude, longitude}` | `{message, lateMinutes}` |
| `punchOut()` | `POST /attendance/punch-out` | `{latitude, longitude}` | `{message}` |
| `getTodayStatus()` | `GET /attendance/today` | — | `{officeStartTime, officeEndTime, attendance, lateUsed}` |
| `getHistory()` | `GET /attendance/history` | — | `[{id, date, status, punch_in_time, punch_out_time, late_minutes}]` |

#### Leave & Loans
| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| `applyLeave()` | `POST /leaves/apply` | `{type, leave_date, reason, ...}` | `{message, leave}` |
| `getMyLeaves()` | `GET /leaves/my` | — | `[{id, type, status, ...}]` |
| `applyAdvance()` | `POST /advances/apply` | `{amount, reason, type}` | `{message, ...}` |
| `applyLoan()` | `POST /loans/apply` | `{amount, reason, type}` | `{message, ...}` |
| `getMyLoans()` | `GET /loans/my` | — | `[{id, type, total_amount, status, ...}]` |

#### Notifications
| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| `registerFcmToken()` | `POST /notifications/register-token` | `{worker_id, token, device_type}` | — |
| `getNotifications()` | `GET /notifications/{workerId}` | — | `[{id, title, body, type, ...}]` |
| `getUnreadCount()` | `GET /notifications/{workerId}/unread-count` | — | `{count}` |
| `markNotificationRead()` | `PUT /notifications/{id}/read` | — | — |

#### Onboarding
| Method | Endpoint | Request | Response |
|--------|----------|---------|----------|
| `checkOnboardingStatus()` | `GET /onboarding/status` | — | `{onboarding_completed}` |
| `getOnboardingPolicies()` | `GET /onboarding/policies` | — | `[{title, content, sort_order}]` |
| `uploadPhoto()` | `POST /onboarding/upload-photo` | `{photo_base64, mime_type}` | `{photo_url}` |
| `uploadDocument()` | `POST /onboarding/upload-document` | `{document_type, file_base64, mime_type}` | `{document_url}` |
| `submitOnboarding()` | `POST /onboarding/submit` | Full onboarding JSON | `{message}` |
| `getPrintProfile()` | `GET /onboarding/print-profile` | — | `{profile, policies}` |

#### Other
| Method | Endpoint | Response |
|--------|----------|----------|
| `getMySalaryBreakdown()` | `GET /salary/my-breakdown` | Salary breakdown |
| `getCalendar()` | `GET /calendar?year=&month=` | `{events, holidays, birthdays}` |
| `raiseCorrectionTicket()` | `POST /attendance-corrections` | Ticket object |
| `getMyCorrectionTickets()` | `GET /attendance-corrections/my` | `[{id, field, status, ...}]` |

### 5.5 Data Models (Dart)

```dart
// Employee
{ name, id, shift, role, department, joined, manager, email }

// AttendanceRecord
{ status, inTime?, outTime?, leaveType? }

// LeaveRecord
{ type, from, to, days, status, reason }

// MonthlyBreakdown
{ month, present, absent, late, leave, rate }

// PunchLog
{ time, label, type }
```

### 5.6 Services

**ApiService** (`services/api_service.dart`) — 590 lines:
- DNS-over-HTTPS resolution (Cloudflare DOH)
- Custom socket-level HTTP client
- Token/cache management via SharedPreferences
- All methods static, timeout 15s

**NotificationService** (`services/notification_service.dart`) — 146 lines:
- Singleton pattern
- FCM initialization, permission request, token registration
- Foreground messages via flutter_local_notifications
- Background handler with navigation

**SupabaseService** (`services/supabase_service.dart`) — 55 lines:
- Realtime subscription to `attendance` table
- Used by ProfilePage for live updates

### 5.7 Onboarding Wizard (11 Steps)

| Step | Fields |
|------|--------|
| 0 — Personal | name, email, phone, gender, DOB, address, PAN, Aadhaar, emergency contact |
| 1 — Education | Dynamic: degree, institution, university, year, percentage |
| 2 — Previous Orgs | Dynamic: organization, role, from/to year |
| 3 — Family | Dynamic: name, relationship, occupation, phone, DOB |
| 4 — References | Dynamic: name, designation, organization, phone |
| 5 — Photo | Camera/gallery upload |
| 6 — Documents | Aadhaar front/back, PAN, bank proof, light bill |
| 7 — Bank | Bank name, account holder, IFSC, account number |
| 8 — Declaration | Date, place, checkbox |
| 9 — Policies | Accept all company policies |
| 10 — Review/Success | Summary + navigate to dashboard |

### 5.8 Key Widgets

| Widget | File | Description |
|--------|------|-------------|
| SkeletonLoader | `skeleton_loader.dart` | Animated shimmer (0.3–0.7 opacity, 1200ms) |
| ProgressCircle | `progress_circle.dart` | Circular progress with CustomPainter |
| MiniCalendar | `mini_calendar.dart` | Color-coded month grid |
| ConsistencyBar | `consistency_bar.dart` | Stacked attendance bar |
| MenuItem | `menu_item.dart` | Tappable list row |
| OrganicBackground | `organic_background.dart` | Blob-shaped decorative painter |

---

## 6. Web PWA (Worker Attendance)

**Location:** `client-web/` — Name: `client-web` (v1.0.0)  
**Tech:** React 19, Vite 6, Tailwind CSS 4, jsQR, React Router 7

### 6.1 Configuration

```
API_BASE = 'https://attendance-roan-zeta.vercel.app/api'
OFFICE_START = '10:00'
OFFICE_END = '19:00'
CACHE_KEYS: TOKEN, WORKER, TODAY, HISTORY, NOTIFICATIONS, UNREAD (localStorage)
```

### 6.2 Routing Structure

| Path | Component | Guard |
|------|-----------|-------|
| `/` | Splash | Public (redirects after 1.2s) |
| `/login` | Login | Public (redirects if logged in) |
| `/onboarding` | Onboarding | Protected (11 steps) |
| `/home` | Home | Protected (dashboard + punch) |
| `/profile` | Profile | Protected (calendar + loans) |
| `/attendance` | AttendanceList | Protected (history) |
| `/edit-profile` | EditProfile | Protected |
| `/scanner` | Scanner | Protected (QR + GPS) |
| `/raise-ticket` | CorrectionTicket | Protected |
| `/print` | PrintForm | Protected |

### 6.3 Complete API Surface

**File:** `src/api.js` (82 lines)

| Method | HTTP | Endpoint | Params |
|--------|------|----------|--------|
| `login` | POST | `auth/worker/login` | `{identifier, password}` |
| `punchIn` | POST | `attendance/punch-in` | `{code, latitude, longitude}` |
| `punchOut` | POST | `attendance/punch-out` | `{latitude, longitude}` |
| `today` | GET | `attendance/today` | — |
| `history` | GET | `attendance/history` | — |
| `myProfile` | GET | `workers/me` | — |
| `updateProfile` | PUT | `workers/me` | profile fields |
| `applyLeave` | POST | `leaves/apply` | `{type, from_date, to_date, reason}` |
| `myLeaves` | GET | `leaves/my` | — |
| `applyAdvance` | POST | `advances/apply` | `{amount, reason}` |
| `applyLoan` | POST | `loans/apply` | `{amount, reason}` |
| `myLoans` | GET | `loans/my` | — |
| `myTickets` | GET | `attendance-corrections/my` | — |
| `raiseTicket` | POST | `attendance-corrections` | `{attendance_id, date, field, requested_time, reason}` |
| `notifications` | GET | `notifications/{workerId}` | workerId |
| `unreadCount` | GET | `notifications/{workerId}/unread-count` | workerId |
| `markRead` | PUT | `notifications/{id}/read` | id |
| `onboardingStatus` | GET | `onboarding/status` | — |
| `submitOnboarding` | POST | `onboarding/submit` | Full onboarding data |
| `uploadPhoto` | POST | `onboarding/upload-photo` | FormData |
| `uploadDocument` | POST | `onboarding/upload-document` | FormData |
| `printProfile` | GET | `onboarding/print-profile` | — |
| `salaryBreakdown` | GET | `salary/my-breakdown` | — |
| `calendar` | GET | `calendar` | — |
| `policies` | GET | `onboarding/policies` | — |

### 6.4 Component Catalog

| Component | Lines | API Usage | Description |
|-----------|-------|-----------|-------------|
| Splash | 38 | None | Animated logo, 1.2s redirect |
| Login | 70 | `login()` | Gradient form |
| Layout | 123 | None | Sidebar (desktop) + tab bar (mobile) |
| Home | 323 | `today()`, `history()`, `myProfile()`, `unreadCount()`, `notifications()`, `punchOut()` | Dashboard with clock, punch, stats, notifications (15s poll, 30s poll) |
| HomeModals | 158 | `applyLeave()`, `applyAdvance()`, `applyLoan()` | Leave + advance/loan modals |
| Profile | 230 | `history()`, `today()`, `myLoans()`, `myTickets()` | Profile card, calendar, loans, tickets |
| AttendanceList | 107 | `history()` | Monthly history with filter |
| EditProfile | 65 | `myProfile()`, `updateProfile()` | Edit name, email, phone, address |
| Scanner | 235 | `today()`, `punchIn()` | QR scan + GPS → punch-in |
| CorrectionTicket | 90 | `history()`, `raiseTicket()` | Select date/field/time → submit |
| PrintForm | 40 | `printProfile()` | Printable profile view |
| Onboarding | 258 | `policies()`, `uploadPhoto()`, `submitOnboarding()` | 11-step wizard |
| MiniCalendar | 52 | None | Color-coded month grid |
| ProgressCircle | 16 | None | SVG circular progress |
| ConsistencyBar | 18 | None | Horizontal stacked bar |

### 6.5 PWA Setup

**Service Worker** (`public/sw.js`): Network-first with fallback to cache.
- Pre-caches: `/` and `/offline`
- Install: `skipWaiting()`
- Activate: `clients.claim()`
- Fetch: network first, cache fallback

**Manifest** (`public/manifest.json`):
- `display: standalone`, `orientation: portrait`
- Theme: `#00152a`, Background: `#f6fafe`
- Icons: 48–512px

**iOS Support:**
- `apple-mobile-web-app-capable: yes`
- `apple-mobile-web-app-status-bar-style: black-translucent`
- Safe-area CSS variables + utility classes

---

## 7. Supporting Components

### 7.1 AssertRegister (Standalone Asset Register)

**Location:** `AssertRegister/`

#### SQL Schema (`assets_table.sql`)
47 lines — PostgreSQL `assets` table:
```sql
id UUID PK, code TEXT UNIQUE, name TEXT, category TEXT, brand TEXT, model TEXT,
serial_no TEXT, department TEXT, condition TEXT, status TEXT (available/assigned/repair/not_working/lost/scrapped),
assigned_to UUID, assigned_to_name TEXT, assigned_date DATE, purchase_date DATE,
purchase_price DECIMAL, vendor TEXT, warranty_expiry DATE, sim_number TEXT, sim_operator TEXT,
sim_plan TEXT, repair_shop TEXT, repair_cost DECIMAL, repair_date DATE,
total_repair_cost DECIMAL, remarks TEXT, history JSONB, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
```

#### Express Routes (`assets.routes.js`) — 128 lines
| Method | Path | Description |
|--------|------|-------------|
| GET | `/assets` | List all |
| GET | `/assets/:id` | Get single |
| POST | `/assets` | Create (auto-generate AST-XXX code) |
| PUT | `/assets/:id` | Update (handles status changes, history) |
| DELETE | `/assets/:id` | Delete |

#### React Component (`AssetRegister.jsx`) — 666 lines
- Categories: Electronics, Mobile & SIM, Furniture, Vehicle, Field Kit, Electrical, Pantry, Safety, Digital
- Departments: FRO, Accounts, HR, Admin, Digital, Reception, NGO Admin, Common
- Statuses with colored badges
- CSV export with BOM
- Sub-components: StatusBadge, Field, AssetFormModal, ActionModal, AssetDetailModal
- Summary cards, warranty alerts, category chart, activity feed

### 7.2 shon — Simple Attendance App

**Location:** `shon/` (gitignored at root level)  
**Stack:** React 19 + Vite 8 + Supabase (direct DB access)

**Files:**
| File | Lines | Description |
|------|-------|-------------|
| `src/api.js` | 48 | Supabase client, session mgmt, `fetchAttendance()`, `fetchWorkers()` |
| `src/App.jsx` | 77 | Login with hardcoded admin/user creds from `.env` |
| `src/App.css` | 364 | Full stylesheet |
| `src/AttendanceView.jsx` | 456 | Employee list + monthly calendar + CRUD attendance (admin) |

**Hardcoded Credentials** (from `.env`):
```
Admin: admin@ufs.com / 123456  (readWrite)
User:  user@ufs.com  / 123456  (readOnly)
```

### 7.3 Privacy Documents

**Location:** `privacy/`

| File | Lines | Description |
|------|-------|-------------|
| `privacy-policy.html` | 383 | Privacy Policy + Terms & Conditions tabs (effective June 19, 2026) |
| `whatsapp.txt` | 2 | Supabase secrets: WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN |

**Privacy Policy covers:** Data collection (location, camera, notifications, devices, activity), usage, sharing, security, retention, third-party services, children's privacy, account deletion.

**Terms cover:** 15 sections including acceptance, accounts, acceptable use, attendance/location accuracy, IP, liability, jurisdiction (Mumbai, India).

### 7.4 Vercel Configuration

**File:** `.vercel/repo.json`
```json
{
  "project": "ucs-crm",
  "projectId": "prj_l9oYC7xpuYK4f2m3RPbH5Tz7vZix",
  "orgId": "team_ro0E1xXaxaypHjxXrkd5kbDq",
  "settings": { "framework": null, "directory": "backend" }
}
```

**Root `.gitignore`** (18 lines): Ignores node_modules, .env, dist, .apk, images, shon/

---

## 8. External Service Integration Summary

| Service | Integration | Used In |
|---------|-------------|---------|
| **Supabase** | PostgreSQL database + Realtime subscriptions | Backend (all data), Flutter (realtime), shon (direct) |
| **Firebase FCM** | Push notifications via Admin SDK | Backend (fcmService.js), Flutter (notification_service.dart) |
| **Razorpay** | Payment gateway webhook + payments sync | Backend (razorpayWebhook.js), Accounts panel |
| **Paytm** | Payment gateway webhook with checksum verification | Backend (paytmWebhook.js) |
| **WhatsApp Cloud API** | Business messaging (text, templates, receipts, documents) | Backend (whatsappService.js, froWhatsAppService.js), Accounts panel, FRO panel |
| **Groq AI (LLaMA)** | Email content parsing for bank transaction extraction + notification generation | Backend (emailImporter.js, notificationScheduler.js) |
| **OCR.space** | Image-to-text OCR for payment screenshots | Backend (ocrController.js), FRO panel OCR utility |
| **Cloudflare DNS** | DNS-over-HTTPS for reliable domain resolution | Flutter (api_service.dart — custom transport) |
| **IMAP (ImapFlow)** | Email inbox polling for bank statements | Backend (emailImporter.js) |
| **JWT + bcryptjs** | Authentication and password hashing | Backend (authMiddleware.js, authController.js) |

---

## 9. Complete cURL API Reference

### AUTH
```bash
# Worker Login
curl -X POST https://ucs-crm-backend.vercel.app/api/auth/worker/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"worker123","password":"secret"}'

# Admin Login
curl -X POST https://ucs-crm-backend.vercel.app/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@ufs.com","password":"admin123"}'
```

### ATTENDANCE
```bash
# Punch In
curl -X POST https://ucs-crm-backend.vercel.app/api/attendance/punch-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"code":"QR-OFFICE-001","latitude":19.0760,"longitude":72.8777}'

# Punch Out
curl -X POST https://ucs-crm-backend.vercel.app/api/attendance/punch-out \
  -H "Authorization: Bearer <token>" \
  -d '{"latitude":19.0760,"longitude":72.8777}'

# Today Status
curl -X GET https://ucs-crm-backend.vercel.app/api/attendance/today \
  -H "Authorization: Bearer <token>"

# History
curl -X GET https://ucs-crm-backend.vercel.app/api/attendance/history \
  -H "Authorization: Bearer <token>"

# All Records (HR/Admin)
curl -X GET https://ucs-crm-backend.vercel.app/api/attendance/all \
  -H "Authorization: Bearer <token>"

# Worker Monthly Attendance
curl -X GET https://ucs-crm-backend.vercel.app/api/attendance/worker/123 \
  -H "Authorization: Bearer <token>"
```

### WORKERS
```bash
# List Workers
curl -X GET https://ucs-crm-backend.vercel.app/api/workers \
  -H "Authorization: Bearer <token>"

# Get My Profile
curl -X GET https://ucs-crm-backend.vercel.app/api/workers/me \
  -H "Authorization: Bearer <token>"

# Update My Profile
curl -X PUT https://ucs-crm-backend.vercel.app/api/workers/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"John Doe","phone":"9876543210"}'

# Add Worker (HR/Admin)
curl -X POST https://ucs-crm-backend.vercel.app/api/workers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Jane","email":"jane@test.com","login_id":"jane2026","password":"secret"}'

# Worker Detail
curl -X GET https://ucs-crm-backend.vercel.app/api/workers/123 \
  -H "Authorization: Bearer <token>"

# Birthdays
curl -X GET https://ucs-crm-backend.vercel.app/api/workers/birthdays \
  -H "Authorization: Bearer <token>"
```

### LEAVES
```bash
# Apply Leave
curl -X POST https://ucs-crm-backend.vercel.app/api/leaves/apply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"type":"full_day","leave_date":"2026-07-15","reason":"Personal"}'

# My Leaves
curl -X GET https://ucs-crm-backend.vercel.app/api/leaves/my \
  -H "Authorization: Bearer <token>"

# All Leaves (HR/Admin)
curl -X GET https://ucs-crm-backend.vercel.app/api/leaves \
  -H "Authorization: Bearer <token>"

# Pending Leaves
curl -X GET https://ucs-crm-backend.vercel.app/api/leaves/pending \
  -H "Authorization: Bearer <token>"

# Approve/Reject Leave
curl -X PUT https://ucs-crm-backend.vercel.app/api/leaves/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"status":"approved"}'
```

### LOANS / ADVANCES
```bash
# Apply Loan
curl -X POST https://ucs-crm-backend.vercel.app/api/loans/apply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"type":"loan","amount":5000,"reason":"Medical"}'

# My Loans
curl -X GET https://ucs-crm-backend.vercel.app/api/loans/my \
  -H "Authorization: Bearer <token>"

# All Loans (HR/Admin)
curl -X GET https://ucs-crm-backend.vercel.app/api/loans \
  -H "Authorization: Bearer <token>"

# Pending Loans
curl -X GET https://ucs-crm-backend.vercel.app/api/loans/pending \
  -H "Authorization: Bearer <token>"

# Approve/Reject Loan
curl -X PUT https://ucs-crm-backend.vercel.app/api/loans/1/decide \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"status":"approved","monthly_deduction":500}'

# Worker Loans
curl -X GET https://ucs-crm-backend.vercel.app/api/loans/worker/123 \
  -H "Authorization: Bearer <token>"
```

### ATTENDANCE CORRECTIONS
```bash
# Raise Ticket
curl -X POST https://ucs-crm-backend.vercel.app/api/attendance-corrections \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"attendance_id":123,"date":"2026-07-10","field":"punch_in","requested_time":"2026-07-10T09:30:00Z","reason":"Forgot to punch in"}'

# My Tickets
curl -X GET https://ucs-crm-backend.vercel.app/api/attendance-corrections/my \
  -H "Authorization: Bearer <token>"

# Pending Tickets (HR)
curl -X GET https://ucs-crm-backend.vercel.app/api/attendance-corrections/pending \
  -H "Authorization: Bearer <token>"

# Verify Ticket (HR)
curl -X PUT https://ucs-crm-backend.vercel.app/api/attendance-corrections/1/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"hr_remark":"Verified"}'

# Approve Ticket (Super Admin)
curl -X PUT https://ucs-crm-backend.vercel.app/api/attendance-corrections/1/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"admin_remark":"Approved"}'
```

### QR CODES
```bash
# Generate QR
curl -X POST https://ucs-crm-backend.vercel.app/api/qr/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"label":"Office-Main","latitude":19.0760,"longitude":72.8777,"radius_meters":100}'

# List QR Codes
curl -X GET https://ucs-crm-backend.vercel.app/api/qr \
  -H "Authorization: Bearer <token>"
```

### NOTIFICATIONS
```bash
# Register FCM Token
curl -X POST https://ucs-crm-backend.vercel.app/api/notifications/register-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"worker_id":1,"token":"fcm_token_here","device_type":"flutter"}'

# Get Notifications
curl -X GET https://ucs-crm-backend.vercel.app/api/notifications/1 \
  -H "Authorization: Bearer <token>"

# Unread Count
curl -X GET https://ucs-crm-backend.vercel.app/api/notifications/1/unread-count \
  -H "Authorization: Bearer <token>"

# Mark Read
curl -X PUT https://ucs-crm-backend.vercel.app/api/notifications/1/read \
  -H "Authorization: Bearer <token>"
```

### ONBOARDING
```bash
# Check Status
curl -X GET https://ucs-crm-backend.vercel.app/api/onboarding/status \
  -H "Authorization: Bearer <token>"

# Get Policies
curl -X GET https://ucs-crm-backend.vercel.app/api/onboarding/policies \
  -H "Authorization: Bearer <token>"

# Submit Onboarding
curl -X POST https://ucs-crm-backend.vercel.app/api/onboarding/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"personal_details":{"name":"John","email":"john@test.com","phone":"9876543210","gender":"Male","dob":"1990-01-01","address":"Mumbai","city":"Mumbai","state":"MH","pincode":"400001"},"education":[{"degree":"B.Com","institution":"MU","university":"Mumbai","year_of_passing":"2012","percentage":"75"}],"family":[{"name":"Jane","relationship":"Spouse","occupation":"Teacher","phone":"9876543211"}],"references":[{"name":"Raj","designation":"Manager","organization":"ABC","phone":"9876543212"}],"declaration_date":"2026-07-13","declaration_place":"Mumbai"}'
```

### FRO
```bash
# FRO Dashboard
curl -X GET https://ucs-crm-backend.vercel.app/api/fro/dashboard \
  -H "Authorization: Bearer <token>"

# My Donors
curl -X GET "https://ucs-crm-backend.vercel.app/api/fro/donors?status=pending" \
  -H "Authorization: Bearer <token>"

# Create Donor Log (Disposition)
curl -X POST https://ucs-crm-backend.vercel.app/api/fro/donors/123/logs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"action":"disposition","disposition_category":"connected","disposition_detail":"lead_done","amount_collected":500,"notes":"Donor agreed","project_name":"Mission Annapurna","pan_number":"ABCDE1234F"}'

# Schedule Contact
curl -X POST https://ucs-crm-backend.vercel.app/api/fro/donors/123/schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"scheduled_at":"2026-07-14T10:00:00Z","notes":"Follow up"}'

# My Target
curl -X GET https://ucs-crm-backend.vercel.app/api/fro/target \
  -H "Authorization: Bearer <token>"

# Scheduled
curl -X GET https://ucs-crm-backend.vercel.app/api/fro/scheduled \
  -H "Authorization: Bearer <token>"

# Upload Payment Screenshot
curl -X POST https://ucs-crm-backend.vercel.app/api/fro/upload-payment-screenshot \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"file_base64":"base64data...","mime_type":"image/jpeg"}'

# Search Donors
curl -X GET "https://ucs-crm-backend.vercel.app/api/fro/search-donors?q=9876543210" \
  -H "Authorization: Bearer <token>"
```

### ACCOUNTS
```bash
# Lead Verification List
curl -X GET "https://ucs-crm-backend.vercel.app/api/accounts/leads?status=pending" \
  -H "Authorization: Bearer <token>"

# Verify Lead
curl -X POST https://ucs-crm-backend.vercel.app/api/accounts/leads/456/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"collected_amount":500,"receipt_date":"2026-07-13","payment_mode":"UPI"}'

# Reject Lead
curl -X POST https://ucs-crm-backend.vercel.app/api/accounts/leads/456/reject \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"rejection_reason":"Invalid transaction"}'

# Generate Receipt
curl -X POST https://ucs-crm-backend.vercel.app/api/accounts/leads/456/receipt \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"ngo_id":1,"donor_name":"John","amount":500,"pan":"ABCDE1234F"}'

# List Receipts
curl -X GET https://ucs-crm-backend.vercel.app/api/accounts/receipts \
  -H "Authorization: Bearer <token>"

# Suspense List
curl -X GET https://ucs-crm-backend.vercel.app/api/accounts/suspense \
  -H "Authorization: Bearer <token>"
```

### NGO ADMIN
```bash
# Dashboard
curl -X GET https://ucs-crm-backend.vercel.app/api/ngo-admin/dashboard \
  -H "Authorization: Bearer <token>"

# Donors List
curl -X GET https://ucs-crm-backend.vercel.app/api/ngo-admin/donors \
  -H "Authorization: Bearer <token>"

# Donor Detail
curl -X GET https://ucs-crm-backend.vercel.app/api/ngo-admin/donors/9876543210 \
  -H "Authorization: Bearer <token>"

# FRO Workers
curl -X GET https://ucs-crm-backend.vercel.app/api/ngo-admin/fro-workers \
  -H "Authorization: Bearer <token>"

# Master Search
curl -X GET "https://ucs-crm-backend.vercel.app/api/ngo-admin/master-search?q=john" \
  -H "Authorization: Bearer <token>"

# New Data
curl -X GET https://ucs-crm-backend.vercel.app/api/ngo-admin/new-data \
  -H "Authorization: Bearer <token>"

# Distribute Data
curl -X POST https://ucs-crm-backend.vercel.app/api/ngo-admin/new-data/distribute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"fro_worker_id":1,"donor_ids":[1,2,3]}'
```

### DASHBOARDS
```bash
# Super Admin Dashboard
curl -X GET "https://ucs-crm-backend.vercel.app/api/dashboard/super-admin?period=30d" \
  -H "Authorization: Bearer <token>"

# Super Admin Alerts
curl -X GET https://ucs-crm-backend.vercel.app/api/dashboard/super-admin-alerts \
  -H "Authorization: Bearer <token>"

# HR Dashboard
curl -X GET https://ucs-crm-backend.vercel.app/api/dashboard/hr \
  -H "Authorization: Bearer <token>"

# Accounts Dashboard
curl -X GET https://ucs-crm-backend.vercel.app/api/dashboard/accounts \
  -H "Authorization: Bearer <token>"

# Recruiter Dashboard
curl -X GET https://ucs-crm-backend.vercel.app/api/dashboard/recruiter \
  -H "Authorization: Bearer <token>"

# Telecaller Dashboard
curl -X GET https://ucs-crm-backend.vercel.app/api/dashboard/telecaller \
  -H "Authorization: Bearer <token>"

# FRO Live Status
curl -X GET https://ucs-crm-backend.vercel.app/api/dashboard/fro-live \
  -H "Authorization: Bearer <token>"
```

### WEBHOOKS
```bash
# List Razorpay Accounts
curl -X GET https://ucs-crm-backend.vercel.app/api/webhooks/razorpay/accounts \
  -H "Authorization: Bearer <token>"

# Create Razorpay Account
curl -X POST https://ucs-crm-backend.vercel.app/api/webhooks/razorpay/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Main Account","key_id":"rzp_live_xxx","key_secret":"secret","webhook_secret":"whsec_xxx"}'

# Trigger Razorpay Sync
curl -X POST https://ucs-crm-backend.vercel.app/api/webhooks/razorpay/sync \
  -H "Authorization: Bearer <token>"
```

### WHATSAPP
```bash
# List WhatsApp Accounts
curl -X GET https://ucs-crm-backend.vercel.app/api/whatsapp/accounts \
  -H "Authorization: Bearer <token>"

# Create WhatsApp Account
curl -X POST https://ucs-crm-backend.vercel.app/api/whatsapp/accounts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Main","phone_number_id":"123456","business_account_id":"789012","access_token":"EAAx..."}'

# Send Receipt via WhatsApp
curl -X POST https://ucs-crm-backend.vercel.app/api/whatsapp/send-receipt/456 \
  -H "Authorization: Bearer <token>"

# Send Direct Message
curl -X POST https://ucs-crm-backend.vercel.app/api/whatsapp/send-direct \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"to":"919876543210","message":"Thank you for your donation!"}'

# Send Template
curl -X POST https://ucs-crm-backend.vercel.app/api/whatsapp/send-template \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"to":"919876543210","template_name":"donation_receipt","parameters":["John","500"]}'
```

### INCENTIVES
```bash
# Worker Targets
curl -X GET https://ucs-crm-backend.vercel.app/api/incentive/worker/1/targets \
  -H "Authorization: Bearer <token>"

# Set Target
curl -X PUT https://ucs-crm-backend.vercel.app/api/incentive/worker/1/month/2026-07-01 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"target_amount":50000}'

# Set Daily Achievement
curl -X PUT https://ucs-crm-backend.vercel.app/api/incentive/worker/1/achievement/2026-07-13 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"amount":2000}'

# Incentive Summary
curl -X GET https://ucs-crm-backend.vercel.app/api/incentive/worker/1/incentive-summary/2026-07 \
  -H "Authorization: Bearer <token>"

# Monthly Summary (All FROs)
curl -X GET https://ucs-crm-backend.vercel.app/api/incentive/monthly-summary \
  -H "Authorization: Bearer <token>"
```

### SALARY
```bash
# Workers Summary
curl -X GET https://ucs-crm-backend.vercel.app/api/salary/workers-summary \
  -H "Authorization: Bearer <token>"

# Worker Salary History
curl -X GET https://ucs-crm-backend.vercel.app/api/salary/worker/123 \
  -H "Authorization: Bearer <token>"

# Add Salary
curl -X POST https://ucs-crm-backend.vercel.app/api/salary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"worker_id":123,"salary":25000,"from_month":"2026-07","to_month":"2026-07"}'

# My Salary Breakdown (Worker)
curl -X GET https://ucs-crm-backend.vercel.app/api/salary/my-breakdown \
  -H "Authorization: Bearer <token>"
```

### LEADS
```bash
# List Leads
curl -X GET "https://ucs-crm-backend.vercel.app/api/leads?status=pending" \
  -H "Authorization: Bearer <token>"

# Create Lead
curl -X POST https://ucs-crm-backend.vercel.app/api/leads \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Jane","phone":"9876543210","source":"Walk-in","status":"new"}'

# Update Lead
curl -X PUT https://ucs-crm-backend.vercel.app/api/leads/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"status":"contacted","notes":"Called, will visit"}'

# Transfer Lead
curl -X PUT https://us-crm-backend.vercel.app/api/leads/1/transfer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"new_owner_id":2}'

# Leads Dashboard
curl -X GET https://ucs-crm-backend.vercel.app/api/leads/dashboard \
  -H "Authorization: Bearer <token>"
```

### USERS & NGOS
```bash
# List Users
curl -X GET https://ucs-crm-backend.vercel.app/api/users \
  -H "Authorization: Bearer <token>"

# Create User
curl -X POST https://ucs-crm-backend.vercel.app/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"HR User","email":"hr@ngo.com","password":"secret","role":"hr","ngo_id":1}'

# List NGOs
curl -X GET https://ucs-crm-backend.vercel.app/api/ngos \
  -H "Authorization: Bearer <token>"

# Create NGO
curl -X POST https://ucs-crm-backend.vercel.app/api/ngos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"New NGO Foundation","code":"NNF","is_active":true}'
```

### BANK AUDIT
```bash
# List Sources
curl -X GET https://ucs-crm-backend.vercel.app/api/accounts/bank-audit/sources \
  -H "Authorization: Bearer <token>"

# Add Source
curl -X POST https://ucs-crm-backend.vercel.app/api/accounts/bank-audit/sources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"HDFC Current","type":"bank"}'

# List Entries
curl -X GET https://ucs-crm-backend.vercel.app/api/accounts/bank-audit/entries \
  -H "Authorization: Bearer <token>"

# Add Entry
curl -X POST https://ucs-crm-backend.vercel.app/api/accounts/bank-audit/entries \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"source_id":1,"transaction_date":"2026-07-13","description":"UPI transfer","amount":500,"type":"credit"}'

# Verify Entry
curl -X PUT https://ucs-crm-backend.vercel.app/api/accounts/bank-audit/entries/1/verify \
  -H "Authorization: Bearer <token>"
```

### EVENT HEAD
```bash
# Create Event
curl -X POST https://ucs-crm-backend.vercel.app/api/event-head/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"title":"Food Drive","description":"Monthly food distribution","category":"Food Distribution","start_date":"2026-07-20","end_date":"2026-07-20","location":"Mumbai","ngo_id":1,"budget":10000}'

# List Events
curl -X GET https://ucs-crm-backend.vercel.app/api/event-head/events \
  -H "Authorization: Bearer <token>"

# Create Asset
curl -X POST https://ucs-crm-backend.vercel.app/api/event-head/assets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Speakers","type":"Sound System","quantity":2,"condition":"Good"}'

# Create Volunteer
curl -X POST https://ucs-crm-backend.vercel.app/api/event-head/volunteers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Volunteer 1","phone":"9876543210","event_id":1,"role":"Coordinator"}'

# Add Expense
curl -X POST https://ucs-crm-backend.vercel.app/api/event-head/events/1/expenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"category":"Food","amount":5000,"description":"Food packets","vendor":"Local Catering"}'
```

### ASSET REGISTER (AssertRegister)
```bash
# List Assets
curl -X GET https://ucs-crm-backend.vercel.app/assets \
  -H "Authorization: Bearer <token>"

# Create Asset
curl -X POST https://ucs-crm-backend.vercel.app/assets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Dell Laptop","category":"Electronics","brand":"Dell","model":"Latitude","department":"FRO","purchase_price":45000}'
```

### CALENDAR
```bash
curl -X GET "https://ucs-crm-backend.vercel.app/api/calendar?year=2026&month=7" \
  -H "Authorization: Bearer <token>"
```

### OCR
```bash
curl -X POST https://ucs-crm-backend.vercel.app/api/ocr/parse \
  -H "Content-Type: application/json" \
  -d '{"image_base64":"base64data...","mime_type":"image/jpeg"}'
```

---

## 10. WhatsApp CRM (Standalone)

### 10.1 Overview

The **WhatsApp CRM** is a standalone multi-tenant platform for NGO WhatsApp Business communication, built as a React SPA with Supabase and Meta Cloud API. It exists in two variants:

| Variant | Location | Type |
|---------|----------|------|
| **whatsapp-crm (Panel)** | `whatsapp-crm/src/panels/whatsapp-crm/` | Embedded panel inside main CRM |
| **wa (Standalone)** | `wa/` | Full standalone SPA with Vite + TypeScript |

Both share identical core functionality: real-time WhatsApp inbox, contact management, automation flows, template management, analytics, deal pipeline, and admin panel.

### 10.2 Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    WhatsApp CRM SPA                        │
│  React 19 · Vite · TypeScript · Tailwind CSS · Zustand    │
├────────────────────────────────────────────────────────────┤
│                        Routes                              │
│  / → Dashboard, /inbox → Chat, /contacts → CRM            │
│  /automations → Flow Builder, /templates → Template Mgmt   │
│  /analytics → Charts, /settings → Config, /admin → Admin  │
├───────────────────┬────────────────────────────────────────┤
│   Supabase Auth    │      Meta Graph API v19/v23           │
│   (email/password) │      (messaging, templates, WABA)     │
├───────────────────┴────────────────────────────────────────┤
│                    Edge Functions (Deno)                    │
│  send-message · send-template · webhook-whatsapp           │
│  run-automation (flow executor)                            │
├────────────────────────────────────────────────────────────┤
│                    Supabase PostgreSQL                      │
│  contacts, conversations, messages, whatsapp_accounts       │
│  whatsapp_templates, automation_flows, deals, pipelines    │
│  quick_replies, api_keys, media_library, tenants           │
└────────────────────────────────────────────────────────────┘
```

### 10.3 Authentication Flow

1. Primary auth via `supabase.auth.signInWithPassword()` (Supabase Auth)
2. Fallback to custom API `{VITE_API_URL}/auth/login` if Supabase unavailable
3. On success: creates/updates user via RPC (`get_whatsapp_user` / `create_whatsapp_user`)
4. Auto-promotes agent/viewer to admin on email confirmation
5. Persists session in localStorage (`ucs_token`, `ucs_user`)
6. Meta credentials loaded from tenant settings on each login

### 10.4 Key Features

| Feature | Description |
|---------|-------------|
| **Real-time Inbox** | Supabase Realtime-powered chat with message bubbles, read receipts, file attachments |
| **Contact Management** | CRUD + CSV import + auto-creation from webhook inbound messages |
| **Automation Flows** | Visual drag-and-drop builder (React Flow) with send/wait/condition/tag/assign/api nodes |
| **Message Templates** | 3-step wizard for Meta template creation → submission → approval tracking |
| **Pipeline** | Kanban board for deal tracking with drag-and-drop stage management |
| **Analytics** | Recharts: message volume, conversations, contact growth, pipeline distribution |
| **Team Management** | Role-based access (admin/agent/viewer) with batch user import |
| **Admin Panel** | Tenant management, system health monitoring, webhook log inspection |

### 10.5 Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | KPIs, WhatsApp number status, template performance |
| `/inbox` | Inbox | Real-time chat with conversation list, labels, quick replies |
| `/contacts` | Contacts | Contact database with search, CRUD, CSV import |
| `/pipeline` | Pipeline | Kanban deal tracking board |
| `/automations` | Automations | Flow list + FlowBuilder (drag-and-drop) |
| `/templates` | Templates | Template list + TemplateEditor (3-step wizard) |
| `/analytics` | Analytics | 5 Recharts dashboards with 30-day trends |
| `/settings` | Settings | 6 tabs: General, WhatsApp, Team, API Keys, Quick Replies, Media |
| `/phone-numbers` | Phone Numbers | WhatsApp Business account management |
| `/admin` | Admin | Dashboard, Tenants, Metrics, Health, Webhooks, Audit |
| `/auth/login` | Login | Email/password authentication |
| `/auth/register` | Register | Organization sign-up with name fields |

---

## 11. Backend Edge Functions (WhatsApp)

### 11.1 send-message (`backend/functions/send-message/index.js`)

**Purpose:** Generic outbound WhatsApp message sender (text + media).

**Input:** `{ conversationId, phone, messageText, mediaUrl, mediaMimeType, project, phoneNumberId }`

**Flow:**
1. Resolve or create contact and conversation by phone number
2. Detect message type from media MIME type (image/video/audio/document)
3. Resolve WhatsApp account credentials (by phone_number_id, project, is_default, or first active)
4. Insert message record with status `queued`
5. POST to `https://graph.facebook.com/v23.0/{phoneNumberId}/messages`
6. Update message status to `sent` or `failed`

### 11.2 send-template (`backend/functions/send-template/index.js`)

**Purpose:** Send pre-approved WhatsApp template messages (required after 24-hour window).

**Input:** `{ templateName, phone, conversationId, language, params, headerMediaUrl, project }`

**Flow:**
1. Same contact/conversation resolution as send-message
2. Look up template from `whatsapp_templates` table
3. Construct Meta-compatible components (HEADER, BODY, BUTTONS) with parameter interpolation
4. POST template payload to Meta Graph API
5. Track as `message_type: "template"` in messages table

### 11.3 webhook-whatsapp (`backend/functions/webhook-whatsapp/index.js`)

**Purpose:** Process all incoming Meta WhatsApp Cloud API webhooks.

**Flow:**
1. **GET** → Webhook verification handshake (verify_token = `ucscompany123`)
2. **POST** → Process message events and status updates:
   - **messages**: Upsert contact, upsert conversation, insert inbound message, trigger automation flows
   - **message_status**: Update message delivery/read status by `wa_message_id`

### 11.4 run-automation (`backend/functions/run-automation/index.js`)

**Purpose:** Execute automation flow graphs triggered by inbound messages.

**Flow:**
1. Resolve WhatsApp account credentials
2. Load flow graph from `automation_flows.flow_data` (JSON: nodes + edges)
3. Find start node (no incoming edges), walk graph sequentially
4. Supported node types: `send_message`, `condition`, `add_tag`, `assign_agent`, `api_call`, `wait`
5. Log every step to `automation_run_logs`
6. Record final run status in `automation_runs`

---

## 12. Database Migrations (WhatsApp)

### 12.1 Migration 022 — Core WhatsApp Tables

Creates the foundational WhatsApp schema in the main database:

| Table | Purpose |
|-------|---------|
| `whatsapp_phone_numbers` | WhatsApp Business phone number configurations |
| `contacts` | Contact records (phone normalized, source tracking) |
| `conversations` | Message threads linked to contacts and phone numbers |
| `messages` | Individual messages with direction, status, template support |
| `whatsapp_webhook_logs` | Raw webhook ingress log |

All use UUID primary keys with `uuid_generate_v4()`.

### 12.2 Migration 023-026 — Role & Auth Simplification

| Migration | Purpose |
|-----------|---------|
| `023_add_agent_role_to_users.sql` | Adds `agent` role to existing CHECK constraint |
| `024_whatsapp_only_roles.sql` | Simplifies to 3 roles: `admin`, `agent`, `viewer` |
| `025_supabase_auth_flow.sql` | Auto-creates `public.users` record on `auth.users` INSERT |
| `026_whatsapp_rpc.sql` | Creates RPCs: `get_whatsapp_user`, `create_whatsapp_user`, `promote_to_admin`, `search_whatsapp_users`, `list_whatsapp_users` |

The role migration maps old CRM roles to new WhatsApp roles:
- `hoadmin`, `super_admin` → `admin`
- `telecaller`, `hr`, `accounts`, `leads`, `recruiter`, `team_lead` → `agent`

---

## 13. FRO WhatsApp System

The FRO (Field Reporting Officer) WhatsApp system has two authentication flows:

### 13.1 Legacy QR Code Login
- Uses puppeteer-based WhatsApp Web session management
- FRO scans QR code to link personal WhatsApp
- Session persists 24 hours or until logout
- Endpoints: `POST /api/fro/whatsapp/login`, `GET /api/fro/whatsapp/conversations`, `POST /api/fro/whatsapp/conversations/:id/send`

### 13.2 Meta API Login (Current)
- Separate bcrypt-based auth: `POST /api/whatsapp/fro-login`
- Uses CRM worker credentials (email + password)
- Returns assigned WhatsApp account details
- Session stored in localStorage (`wa_auth` key)
- 15-second polling for conversation updates
- Endpoints: `GET /fro/whatsapp/conversations`, `GET /fro/whatsapp/conversations/:id/messages`, `POST /fro/whatsapp/conversations/:id/send`, `PUT /fro/whatsapp/conversations/:id/read`

### 13.3 Agent Assignment
Managed by Accounts admins via:
- `GET/POST /api/whatsapp/accounts/:id/agents` — list/assign
- `DELETE /api/whatsapp/accounts/:id/agents/:froId` — remove
- `GET /api/whatsapp/accounts/agents/search?q=` — search workers
- Junction table: `fro_whatsapp_assignments`

---

> **End of Master Documentation**  
> Generated: July 14, 2026  
> Total Source Files: 400+ across all directories
