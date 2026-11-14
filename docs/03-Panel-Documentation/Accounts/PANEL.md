# Panel: Accounts

> Generated: 2026-10-13 · Status labels: **Verified** (confirmed in code/config) · **Partially verified** (checked, some depth still unread) · **Inferred** (indirect evidence) · **Planned** (recommendation only). Only what is confirmed in the source is stated as fact; anything else is tagged.

## 1. Panel Overview

- **Route base:** `/accounts/*` (Verified — `client/src/panels/accounts/AccountsPanel.jsx`).
- **Entry component:** `AccountsPanel` (same file), rendered with `PanelWrapper roleKey="accounts"` → adds `panel-accounts` class.
- **Access control:** guarded for role `['accounts','admin']` at the router level (`client/src/App.jsx`). The panel's own API layer (`panels/accounts/api/auth.js`) additionally rejects logins whose role is not `accounts` or `super_admin`. Privileged users with dept `accounts`/`admin` can log in (the role `accounts` is distinct from department — Verified comment in `App.jsx`).
- **Purpose:** donation accounting — pending-lead verification and receipts, donor master data, bank/email-based payment reconciliation (Bank Audit), NGO collection reports + targets, attendance & payroll for the finance-facing workforce views, festival/ceremony tools (Awards, Audience Voting, Certificates), asset register, SIM inventory, beneficiary and Sevak-library modules, and invoice/import automation (Razorpay, Email, Bank Statement).
- **Layout:** hamburger → `AccountsSidebar` with collapsible groups (Main: Lead and Audit, Receipts; Workforce: Attendance, Salary & Advances, Teams and Target, Incentive, NGO wise Incentive; Finance & Records: Asset Register, Master Data; Ceremony: Awards, Audience Voting, Certificates; Modules: Bill Reminder, Metropad, Library, Beneficiaries, SIM Management; Settings: Reports, Tickets, UCS Chat). Top bar with title lookup from `ALL_NAV`, user menu + settings drawer, NotificationDrawer. Mobile drawer overlays (max-width 820px) (Verified — `AccountsSidebar.jsx`).
- **Theme system:** reuses `panels/hr/theme` themes applied scoped to `.panel-accounts`; stored under `localStorage['accounts_theme']`, default `'sky'` (Verified).
- **Relationship with other panels:**
  - **HR:** Accounts renders the shared HR `Workers`, `EmployeeDetail`, `Offboarding`, `Loans`, `Awards` inside `/accounts/volunteers/*` and `/accounts/awards` — hence shared worker/salary/loan routes widen roles to include `accounts` (Verified comments in `workerRoutes.js`, `salaryRoutes.js`, `ngoAllocationRoutes.js`).
  - **NGO Admin:** shares `bank-audit` suspense concepts; NGO-admin routes in the same router link suspense to donors and push verified no-matches back to Accounts (Verified — `bankAuditRoutes.js`). FROs resolve their own suspense via `/bank-audit/fro-suspense`.
  - **Beneficiaries & Sevak Library:** separately mounted panels reused under `/accounts/beneficiaries/*` and `/accounts/library` (Verified).
  - **Super Admin:** reuses `IncentivesPage` / `SpecialIncentives` / `LeadIncentive` under `/accounts/incentives`; Metropad moved here from the super-admin panel (Verified — `AccountsPanel.jsx` line 500).
  - Receipts/credits drive FRO collection totals, so Accounts decisions echo into NGO-Admin dashboards.

## 2. Screens & UI

Sidebar + routed screens (all routes Verified — `AccountsPanel.jsx` lines 459–505; NAV lines 55–204):

| Nav / route | Component | Notes |
|---|---|---|
| `/accounts/leads` | `pages/LeadAudit.jsx` | **Lead and Audit** hub — dashboard + BankAudit + Matching (default route) |
| `/accounts/receipt-generator` | `pages/Receipts.jsx` | Receipt generation/send (old `/accounts/receipts`, `/accounts/receipt-history` redirect here) |
| `/accounts/donors` (+ `/address`) | `components/DonorSection.jsx` | Tabs: **Master Data** (`Donors`) · **Donor Data Update** (`AddressImport`) |
| `/accounts/attendance` | `pages/Attendance.jsx` | Workforce attendance + selfie verification |
| `/accounts/volunteers[...]` | `PayrollSection` | Tabs **Salary** (HR `Workers`) · **Loan & Advance** (HR `Loans`); `:id` detail (HR `EmployeeDetail`), `:id/offboard`. The Operations actions menu (`⋯`) includes **Add Holiday** (`HolidayManagerModal`): a company-wide paid holiday is written to the shared `holidays` table, so payroll never marks that date absent. |
| `/accounts/teams` (+ `/targets`) | `components/TeamsSection.jsx` | Tabs **Team Allocation** (`Teams`) · **Target Settings** (`FroTargets`) |
| `/accounts/incentive` | `pages/IncentiveSetup.jsx` | AKI incentive slab/config (base + variation 2026-01?) |
| `/accounts/incentive-verify` | `pages/IncentiveVerification.jsx` | Incentive verification (hidden nav item) |
| `/accounts/incentives` | `super-admin/IncentivesPage` | index → `sir` (`SpecialIncentives`) · `lead` (`LeadIncentive`) |
| `/accounts/asset-register` | `pages/AssetRegister.jsx` | Office asset inventory |
| `/accounts/awards` | HR `Awards` (wrapped) | Monthly Award Ceremony setup/voting/results |
| `/accounts/audience-voting` | `pages/AudienceVoting.jsx` | Live stage voting events |
| `/accounts/certificates` | `pages/Certificates.jsx` | Certificate templates (DOCX/PPTX) + issuing |
| `/accounts/template-settings` | `pages/TemplateSettings.jsx` | (settings drawer + route) |
| `/accounts/reports` | `pages/Reports.jsx` | NGO/team collection reports (access-code gated) |
| `/accounts/tickets` | `pages/Tickets.jsx` | Internal ticket inbox (suspense/payment/receipt/technical/HR) |
| `/accounts/chat` | `ChatWorkspace` | UCS Chat |
| `/accounts/sim/*` | `components/SimSection.jsx` | SIM Management (Dashboard, All SIM Cards, SIM Locker, All SIM Owner, + Expiring/Reports/MobileId/Settings/Import-Export pages via `PAGE_META`) |
| `/accounts/beneficiaries/*` | `beneficiaries/BeneficiariesPanel` | Tabs Overview / All Beneficiaries / Collection OTPs / Import Members / Daily Events; `:id` profile |
| `/accounts/bill-reminder/*` | `bill-reminder/BillReminderPage` | Bill reminders |
| `/accounts/library` | `sevak-library/SevakPanel` | Library applications/coupons/import |
| `/accounts/metropad` | `metropad/MetropadPage` | Metropad dashboard (own build in `metropad/App.jsx`) |
| Redirects | `/accounts/address` → donors/address; `/accounts/fro-targets` → teams/targets; `/accounts/loans` → volunteers/loans; `/accounts/data/*`, `/new-data`, `/old-data` → donors; unknown → leads | Verified — Routes list |

Settings drawer views (Verified — `settingsViews`): Razorpay Accounts, Email Accounts, Sync & Imports, Template Settings, Change Access Code, Change Salary Access Code.

Key screen structures (all **Verified** at structure level):

- **Lead and Audit — `pages/LeadAudit.jsx`**: composed of **Dashboard**, **BankAudit** (via `AuditStatCards`), and **MatchLines**. State: `sources`, `summary`, `combo`, global NGO filter, amount/date filters, suspense-card NGO, selected lead / selected entry, detail view, FRO modal (via `/auth/fro-workers`). NGOs: `NGO_COLLECTION` `{bsct:#1e40af, aflf:#166534, mann:#be185d}`. ₹ + en-IN currency; team names `UFS n`. Pending-lead list with per-row quick actions; verification credit flows (see §5).
- **Receipts — `pages/Receipts.jsx` (1352 lines)**: NGO-scoped receipt issuing. `NGO_MAP` `{bsct:Being Sevak / bsct_receipt_2, mann:Mann Care / mann_receipt, aflf:Ashray / ashray_receipt}` Meta templates. Import robots: `TARGET_COLUMNS` (aliases for Donor Name / Address 1 / PAN No. / Email ID / MOP / Payment ID No. / Donor Bank Name / Amount / Receipt No. / Receipt Date / Account Of / Mobile No. / Project), `MANDATORY = ['Donor Name','Amount','Receipt No.']`, `PAGE_SIZE = 20`. Receipt-number cards per NGO (Current/Next). PDF download (single + bulk) via `services/pdfGenerator`; WhatsApp delivery badge (`WhatsAppDeliveryBadge`); `ReceiptHistory` with `prepareImportRows`. Confirmation + bulk-progress modals.
- **Donors — `pages/Donors.jsx` (1306 lines)**: card-grid donor master with NGO tone palette (hashed by id), assignment blocks (visible 3 then expand), per-donor actions (view/edit/delete/assign/replace/unassign), quick search, filters, Excel **export** and **export-duplicates**, maintenance tools: `restore-wrong-assignments`, `repair-sync`, `backfill-receipt-assignments` (all verified API calls).
- **AddressImport — `pages/AddressImport.jsx`**: alias-tolerant CSV mapping (mobile required, name/address-1/address-2/pan/email optional) → `POST /donors/address-import`.
- **Attendance — `pages/Attendance.jsx` (828 lines)**: today + history list per worker (Date/Punch-in/Punch-out/working hours `Ph Xm`), status cells `present/late/half-day/absent/leave/holiday/off` (✓/⚠/◐/✕/✋/★/○), selfie preview + verify/reject (`PUT /attendance/:id/verify-selfie`, presigned expiring URLs with broken-selfie fallback), Excel export (xlsx-js-style). Declared holidays are paid days: the export marks them **H** and counts them in a Holiday column instead of Absent.
- **Reports — `pages/Reports.jsx` (777 lines)**: access-code gated; stat cards, per-team (UFS1–UFS4) collection tables, target vs actual (`/report-targets`), print stylesheet, ₹ en-IN currency. (Tenor-crab animation is purely decorative, Verified.)
- **BankAudit — `pages/BankAudit.jsx` (1004 lines)**: sources CRUD tabs, entries list with summary chips, add/edit entry modal (donor fields + mobile >10-digit lookup + pending-lead picker via `/bank-audit/leads?q=`), **auto-match / manual-match / confirm-match / clear-match**, **manual verify** flow (search donor by mobile ≥3 digits → `/donors?search=`, fallback `/receipts/by-mobile`; conflict credit → `credit_to_fro_worker_id`), suspense rows (kind `suspense`, id `suspense-…` prefix), per-NGO cards, `SuspenseToast` and `receive`, single PDF receipt per NGO (`receivedMeta`), realtime refresh.
- **Certificates — `pages/Certificates.jsx` (1514 lines)**: DOCX/PPTX template library with thumbnails (mammoth-rendered), field types `text/number/date/time/datetime/longtext/select`, statuses active/draft/archived, duplicate/archive/restore/delete, editor page (`CertificateEditorPage`), issuing against donors, purposes (Appreciation/Achievement/Other defaults).
- **AssetRegister — `pages/AssetRegister.jsx` (2030 lines)**: categories (21: Desktop…Kitchen Equipment), locations (12), conditions New/Good/Average/Damaged, lifecycle statuses Available/Assigned/In Repair/Not Working/Lost/Scrapped; dashboard with category/location/status bars, filters with active-chip row, assign/replace, maintenance logs, Excel import/export, per-company code parsing `(COMPANY)`.
- **Awards** (HR component): department groups, voting sessions (draft/live), results + XLSX export.
- **AudienceVoting — `pages/AudienceVoting.jsx`**: events (Not started/Live/Completed), participants ordered list, live current-participant control (`/next`, `/current`, wrap), scoring dimensions Delivery / Stage confidence / Clarity / Relevance / Time taken, results view; endpoints `/audience-voting/*`.
- **IncentiveSetup**: AKI config + slabs (`GET /incentive/aki-config`, `PUT /incentive/aki-slabs`, reset).
- **Teams (`pages/Teams.jsx`)** + **FroTargets** tab; **SIM section**: dashboard/inventory/locker/owner/expiring/reports + import-export; **Beneficiaries** five tabs; **Sevak `SevakPanel`**: Applications / Coupons / Import members tabs + `ApplicationDetail` + `DrillListModal`; **BillReminder**: `ReminderPanel` wrapper (AuthProvider); **Metropad**: standalone-style dashboard.
- **Tech tickets (Accounts `pages/Tickets.jsx`, 787 lines)**: inbox w/ CSV-imported departments `['accounts','developers','hr','fro']`, categories Suspense / Payment Issue / Receipt Issue / Technical / HR Related (+ route labels via `lib/ticketRouting`), realtime subscriptions.

## 3. Features

- Pending-lead verification pipeline: list → verify (`verifyLead`, `quickVerifyLead`) → mark done → reject → go-back → undo → delete (single/all); receipts generated on verify (Verified).
- Receipt issuing per NGO (Being Sevak / Ashray / Mann Car) with branded PDF templates, WhatsApp delivery tracking, receipt-number counters, mark-as-sent, import (receipts + names), undo, excluded queue, fix-and-queue, by-mobile lookup (Verified — `accountsController.js`, `Receipts.jsx`).
- Donor master data: search, detail, assignments (FRO/station), replace/delete, address import, exports + duplicate-assignment export, repair/backfill maintenance (Verified).
- Bank audit & reconciliation: bank sources, entries, suspense, auto-match, manual-match, manual-verify (credit to correct FRO), summaries per NGO (Verified — `BankAudit.jsx`, `bankAuditController.js`).
- Bank-statement import (CSV/XLSX preview + import), email-inbox import, Razorpay/Paytm webhook sync, scraper device import (Verified — `BankImports.jsx`, `EmailImport.jsx`, `EmailAccountsManager.jsx`, `BankStatementImport.jsx`).
- Workforce attendance & selfie verification; payroll views of HR salary/loans (Verified).
- Teams & FRO targets, AKI incentive slabs + verification, NGO-wise incentive rollups (Verified).
- Ceremony suite: Awards voting, live Audience Voting, Docx/PPTX Certificates (Verified).
- Asset register (Categories/Location/Condition/Status + maintenance + Excel) (Verified).
- Access-code gating for receipts download + reports (`useAccessCode`, 4-digit) (Verified).
- SIM lifecycle, beneficiaries (OTP collections, import), library memberships, bill reminders, metropad (Verified mounts).
- Reports (team/target, agent-team collections) with print + target setting via `accounts_report_targets` (Verified — `getReportTargets`/`putReportTargets`).

## 4. Technical Implementation

- **Stack:** React function components + hooks, React Router (nested `Routes`; the panel owns its full route map), lazy/suspense where reused, lucide-react icons; Excel via `xlsx` / `xlsx-js-style`; PDF via `services/pdfGenerator` (single + bulk, embedded per-NGO receipt templates); `mammoth` for DOCX thumbnails; toasts via shared and local `Toast`.
- **API layer:** `panels/accounts/api/auth.js` re-implements the shared v4-style core with `_prefix:'ucs'`, `apiGet/apiPost/apiPut/apiPatch/apiDelete`, FormData or JSON serialisation, and login restricted to `accounts`/`super_admin`. `api/receipts.js`: `getReceipt(logId)` GET `/accounts/leads/:logId/receipt`, `generateReceipt(logId,data)` POST same, `listReceipts()` GET `/accounts/receipts`. `api/certificates.js` (`certificateApi`): templates list/purposes CRUD, get raw template file (60s timeout), create/update/reupload (`POST /certificates/templates/:id/file`), set preview, snapshot-all, duplicate, set-status (PATCH), delete, preview endpoint.
- **State:** `store.jsx` simply returns the app-level `UcsContext` (7 lines) — no panel-specific store; components call the API layer directly. Access-code state lives in `useAccessCode` (subset in `AccessGate.jsx` w/ `useAccessCodeStore`).
- **Realtime:** `useRealtime` used in BankAudit (entries/sources/summary via `onDbChange`) and Tickets; routers push DB changes through the notification feed (`/api/notifications/:uid` polled; desktop notif permission requested) (Verified).
- **User settings toggles:** `SyncSettingsView.jsx` reads/writes `/user-settings` (values `'true'/'false'`) → `razorpaySync`, `emailImport`, `bankStatement` (Verified).
- **Server routers (mounted in `backend/src/index.js`, verified):**
  - `/api/accounts` → `accountsRoutes.js` (88 lines) — the big one: leads CRUD + verify/done/reject/go-back/undo, suspense, receipts, donors, report-targets/data, day-end report, collections.
  - `/api/accounts/bank-audit` → `bankAuditRoutes.js` (56 lines).
  - `/api/accounts/email-import` → `emailImportRoutes.js` (15 lines).
  - `/api/accounts/bank-statement` → `bankStatementRoutes.js` (7 lines, multer single `file`, 10 MB, csv/xlsx/xls).
  - `/api/accounts/scraper` → `scraperRoutes.js` (device-keyed via `SCRAPER_DEVICE_KEY` header `x-scraper-key`).
  - `/api/webhooks` → `webhookRoutes.js` (Razorpay/Paytm/WhatsApp entry; authenticated routes registered before the public `/:accountId` param route).
  - `/api/user-settings` → `userSettingsRoutes`.
  - Certificates / assets / sims / teams / incentives / audience-voting / beneficiaries mounted elsewhere in `/api/*` (Verified — route filenames `certificateRoutes.js` 91 lines, `assetsRoutes.js` 178, `simCardRoutes.js` 35, `simInventoryRoutes.js` 25, `teamRoutes.js` 7, `incentiveRoutes.js` 45, `reminderRoutes.js` 51, `beneficiaryRoutes.js` 198).
- **Controllers:** `accountsController.js` (5817 lines; key function map in §5) and `bankAuditController.js` (1855 lines). Role scoping: `accessCodeRole = super_admin/admin/hr/accounts` for the shared access-code endpoints; `donorManageRole = accounts/admin/super_admin` for donor admin (deliberately not broadened); everything else behind `authenticateRole('accounts','super_admin')` (Verified comment).

## 5. Business Logic

Key functions with file + line (Verified — `accountsController.js`, `bankAuditController.js`):

- **`verifyLead` (line 283):** joins `fro_donor_logs` → `fro_assignments!inner` → `donor_profiles!inner` (+ `ngos`, `workers` LEFT). 404 if the log is missing; 400 `"This lead has already been processed"` if `accounts_status !== 'pending'` (lines 303–304); 400 if no `assignmentId`/`donorProfile`. Sets `accounts_status='verified'`, stamps `verified_at/by`. **Credit rule for `receipts.agent_name` (drives FRO collection totals):** while impersonating (Acting FRO) credit goes to the real operator (`imposter_name`) — same rule as the bank-audit Manual Verify; otherwise to the lead's ACTOR (the `operator_id` recorded on the log during a Work-As/cover session); otherwise to the FRO who owns the lead's assignment (Verified from Verify normal-credit staging).
- **`generateReceipt` (line 1675):** `params.logId`, body `{pan_number, address, mode, purpose}`. Idempotent: `findReceiptByLogId(logId)` → if exists return existing + note. Queries the lead with assignments (donor, FRO, NGO, donor profiles, worker name/login); `agentName` resolved via `resolveOperatorName` — *"Label, not human name — receipts.agent_name is the credit key … already stamped with the label at claim."* (Verified comment). Response includes the receipt + PDF-ready fields.
- **`undoReceipt` (line 1405) / `undoLeadVerification` (line 1283) / `goBackLead` (line 1136):** inverse flows; only `verified` leads can be undone, only `pending`/`verified` can be sent back; `verified_at/by` cleared (Verified line guards 1156–1167, 1302–1312).
- **`rejectLead` (907) / `quickVerifyLead` (730):** reject sets `accounts_status='rejected'`; quick-verify path exists for leads without an FRO agent under explicit conditions (Verified comments).
- **`getReceiptList` (1776) & receipt admin:** real delivery verdict from the Meta status webhook used by `getReceiptList` when present; `markReceiptAsSent` (2188) explicit send; `fixAndQueueReceipt` (2277) / `deleteQueueReceipt` (2359) manage the send queue; `getExcludedReceipts` (2232) the exclusion set (Verified line comments 2171, 2244).
- **`getDayEndReport` (2494):** two-tier totals — per-FRO collected (verified) and overall; `getNgoCollections` drives the audit cards (Verified).
- **Suspense (817→907):** `createSuspense`, `addSuspenseNote` (855), `assignSuspense` (887); NGO-admin routes link suspense receipts to donors or mark no-match and push to Accounts.
- **Bank audit (`bankAuditController.js`):**
  - `suggestEntries` (787) requires `q.length >= 2` for payer-name/amount suggestion; `manualMatch` (931) links an entry to a pending lead (`log_id`) *without* verifying; verification happens later when the lead is claimed — "matched now, credited/verified later" (Verified comment).
  - `manualMatchSuspense`: link a bare suspense receipt (`donor_id` null) to a lead; lead stays pending.
  - `runAutoMatch` (1893) / `confirmMatch` (1902 → `confirmMatchCredit(id, req.user.id)`) / `clearMatch` (1913 sets `match_status='cleared'`, clears `matched_lead_log_id`, `match_score`) — Verified.
  - `searchPendingLeads` (1939): searches pending lead logs (`accounts_status='pending'` or `lead_done` dispositions) with donor+FRO details for the "Log" picker in New/Edit Entry; claims included — the save path reuses the existing receipt instead of double-claiming (Verified).
  - `manualVerifyEntry` (+ save details): validates mobile (≥10 digits), resolves donor via donor master then `receipts/by-mobile`, masks conflicts, and honours `credit_to_fro_worker_id` to award collections to a different FRO (Verified — `BankAudit.jsx` commits lines 666–667).
- **Receipt numbers:** per-ngo counters (`getNextReceiptNo`, `cancelReceiptNo`, `voidReceipt`, model-level in `models/bankAuditModel.js` imported by controller) — sequences shown as Current/Next per NGO.
- **Reports targets:** stored as a setting `accounts_report_targets` (`TARGETS_SETTING_KEY`, line 5619); `getReportTargets`/`putReportTargets` read/write; `getReportData?month=YYYY-MM` computes per-team/per-agent collections; `getAgentTeamCollections` returns `{agents, teams, ngos, grandTotal, grandCount}` (Verified line comments 5687–6038).
- **Access code:** shared 4-digit gate at `/accounts/access-code/status|create|verify|change` (roles super_admin/admin/hr/accounts) — also consumed by HR "Unlock Salary" (Verified comment in `accountsRoutes.js`).
- **Credit to FRO logic shared:** the same `imposter_name`/operator precedence used by `verifyLead` applies in bank-audit manual verify — a deliberate single source of truth for collection totals (Verified comment in `BankAudit.jsx` and `verifyLead`).

## 6. API Endpoints

All paths relative to `/api`; routers mounted as shown (§4). **Verified** from route files + page call-sites.

| Method | Path (relative to `/api`) | Purpose | Source |
|---|---|---|---|
| GET | `/accounts/leads`, `/accounts/leads/address-suggest` | Lead list / address suggestions | `accountsRoutes.js` |
| POST | `/accounts/leads/:logId/verify` · `/quick-verify` | Verify lead (+ credit receipt) | `accountsRoutes.js` |
| POST | `/accounts/leads/:logId/done` · `/reject` · `/go-back` · `/undo` | Lead lifecycle | `accountsRoutes.js` |
| PATCH | `/accounts/leads/:logId/field` | Field-level patch | `accountsRoutes.js` |
| DELETE | `/accounts/leads` · `/accounts/leads/:logId` | Delete (pending only); delete-all-pending | `accountsRoutes.js` |
| GET/POST | `/accounts/suspense`, POST `/suspense/:id/note` `/assign` | Suspense records | `accountsRoutes.js` |
| GET/POST | `/accounts/leads/:logId/receipt` | Receipt fetch / generate | `accountsRoutes.js` |
| GET/POST/DELETE | `/accounts/receipts`, `/count`, `/numbers`, `/suspense-by-ngo`, `/pending`, `/excluded`, `/import`, `/names-import`, `/by-mobile`, `/mark-sent`, `/:id/fix-and-queue`, `/:receiptId` (PATCH), `/:receiptId/undo`, `/fro-workers` | Receipt admin + send queue | `accountsRoutes.js` |
| GET | `/accounts/collections` | NGO collections for audit cards | `accountsRoutes.js` |
| GET/POST/DELETE/PATCH | `/accounts/donors`, `/quick-search`, `/:id`, `/donor/:donorId/history`, `/:id/assignments`, `/:id/assignments/:aid` (+ `/replace`), `/export`, `/export-duplicates`, `/restore-wrong-assignments`, `/backfill-receipt-assignments`, `/repair-sync`, `/address-import`, `/stations-options` | Donor master + maintenance | `accountsRoutes.js` |
| GET/PUT | `/accounts/report-targets`, `/accounts/report-data`, `/accounts/report-agent-team`, `/accounts/day-end-report` | Reports | `accountsRoutes.js` |
| GET/POST/PUT/DELETE | `/accounts/access-code/status|create|verify|change` | Shared 4-digit gate | `accountsRoutes.js` |
| GET/POST/PUT/DELETE | `/accounts/bank-audit/sources`, `/entries`, `/suspense/:id`, `/entries/suggest`, `/entries/available`, `/entries/:id/manual-match`, `/leads`, `/entries/:id/verify`, `/auto-match`, `/entries/:id/confirm-match|clear-match|manual-verify|manual-verify-details`, `/check-donor-assignment`, `/summary`, `/sync-receipt-fields` | Bank audit reconciliation | `bankAuditRoutes.js` |
| GET/PUT | `/accounts/bank-audit/ngo-suspense(/:id/link-donor|/no-match)` | NGO-admin suspense resolution | `bankAuditRoutes.js` |
| GET/PUT | `/accounts/bank-audit/fro-suspense(/:id/resolve)` | FRO suspense resolution | `bankAuditRoutes.js` |
| POST | `/accounts/bank-statement/preview` · `/import` | Bank-statement file import | `bankStatementRoutes.js` |
| POST/GET | `/accounts/email-import/trigger|process-seen|test|status|log` + `/accounts` CRUD | Email inbox import | `emailImportRoutes.js` |
| GET/POST | `/accounts/scraper/device-import` · `/known-refs` · `/ngos` · `/sources` (device), `/status`, `/runs`, `/runs/:runId` | Scraper device + audit | `scraperRoutes.js` |
| GET/POST/PUT/DELETE | `/webhooks/status|log`, `/razorpay/accounts` CRUD + `/sync`, public `/razorpay(/:accountId)`, `/paytm` webhooks, WhatsApp webhooks | Payment gateway webhooks | `webhookRoutes.js` |
| GET/PUT | `/user-settings` | razorpaySync / emailImport / bankStatement toggles | `SyncSettingsView.jsx` call |
| GET/PUT/POST/DELETE | `/audience-voting/events(/:id/…)` | Audience voting | `AudienceVoting.jsx` |
| GET/PUT/POST | `/incentive/aki-config` · `/aki-slabs` · `/aki-config/reset` | AKI incentive setup | `IncentiveSetup.jsx` |
| GET | `/certificates/*` | Certificate templates file/CRUD | `api/certificates.js` |
| GET/PUT | `/attendance/today-all`, `/attendance/all`, `/attendance/:id/verify-selfie`, `/workers?status=all`, `/auth/fro-workers` | Attendance/selfie + worker feeds | `Attendance.jsx` |
| GET/POST | `/holidays` | Declared holidays; Accounts can POST from the Operations action menu (company-wide paid holiday) | `HolidayManagerModal.jsx`, `Attendance.jsx` |
| Various | `/teams/*`, `/fro-targets` (via shared `FroTargets`), `/assets/*`, `/sims/*`, `/beneficiaries/*`, `/reminders/*` | Teams, assets, SIMs, beneficiaries, reminders | mounted routers |

## 7. Panel Summary

| Aspect | Status |
|---|---|
| Entry, routing, NAV, shell, theme | **Verified** |
| Lead & Audit (dashboard + leads + matching) | **Verified** (structure + credit/verify logic read) |
| Receipt generator (issue, import, send, PDF, WhatsApp) | **Verified** (structure + key logic) |
| Donors + Address import + maintenance | **Verified** (structure + API calls) |
| Bank audit + manual/auto match + manual verify | **Verified** (logic read in controller) |
| Bank-statement / email / webhook / scraper imports | **Verified** (routes + controllers read) |
| Reports (access-code gated) + targets | **Verified** |
| Attendance & selfie verification | **Verified** |
| Certificates / Asset Register / IncenotiveSetup / AudienceVoting / Awards | **Verified** (structure level; 1.5k–2k-line files read selectively) |
| Teams + FRO Targets, Incentive Verify, NGO-wise Incentives | **Partially verified** (mounts + calls verified) |
| PayrollSection (HR reuse) | **Verified** (props/route map) |
| SIM section, Beneficiaries, Library, Bill Reminder, Metropad | **Partially verified** (entry/tab structure verified; internal pages read selectively) |
| Long-tail un-routed pages (`Dashboard.jsx`, `NewData/OldData.jsx`, `EmailImport.jsx`, `BankStatementImport.jsx`, `BankImports.jsx`, `PaymentGateways.jsx`, legacy `WhatsApp*`) | **Partially verified** — real components on disk with verified API calls, but not in the current route map (mostly superseded by tabs/drawers) |
| End-to-end modal/drawer interactions | **Partially verified** |
| Screenshots | **screenshots pending** — not yet captured; add under Testing when available |

Known limitations (Verified): single 4-digit access code shared across receipts+reports+HR salary; receipt renewals are manual/organic (counters per NGO); email-import test writes a synthetic entry (amount 1500, `TESTUPI123456`) into `bank_audit_entries`; donor credit depends on `receipts.agent_name` labels kept in sync across verify/manual-verify paths.

Cross-links: shared `FroTargets`, `SpecialIncentive`, `LeadChampionCelebration`, `NoticePopup`, `ChatWorkspace`, HR components (Workers/EmployeeDetail/Offboarding/Loans/Awards), `beneficiaries/BeneficiariesPanel`, `sevak-library/SevakPanel`, `super-admin` Incentives, `Docs — NGO Admin PANEL.md` for the shared suspense/numbering concepts.