const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, ShadingType, WidthType,
  PageBreak, Header, Footer, PageNumber, NumberFormat, TableOfContents,
  TabStopPosition, TabStopType, convertInchesToTwip
} = require('docx');
const fs = require('fs');

// ─── Color palette ───
const C = {
  primary: '1F3A5F',    // Dark navy
  secondary: '2563EB',   // Blue
  accent: '0D9488',      // Teal
  dark: '1E293B',         // Slate 800
  gray: '64748B',         // Slate 500
  lightBg: 'F1F5F9',     // Slate 100
  codeBg: '1E293B',       // Dark bg for code
  codeFg: 'E2E8F0',       // Light text for code
  white: 'FFFFFF',
  tableHeader: '1E3A5F',
  tableAlt: 'F8FAFC',
  green: '059669',
  red: 'DC2626',
  orange: 'D97706',
  border: 'CBD5E1',
};

// ─── Helpers ───
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200 },
    children: [new TextRun({ text, bold: true, size: 52, color: C.primary, font: 'Calibri Light' })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 160 },
    children: [new TextRun({ text, bold: true, size: 44, color: C.secondary, font: 'Calibri Light' })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, size: 36, color: C.dark, font: 'Calibri Light' })],
  });
}

function h4(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_4,
    spacing: { before: 160, after: 100 },
    children: [new TextRun({ text, bold: true, size: 32, color: C.dark, font: 'Calibri Light' })],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 100, line: 276 },
    ...opts,
    children: [new TextRun({ text, size: 22, font: 'Calibri', color: C.dark, ...opts.run })],
  });
}

function boldPara(label, value) {
  return new Paragraph({
    spacing: { after: 60, line: 260 },
    children: [
      new TextRun({ text: label, bold: true, size: 22, font: 'Calibri', color: C.dark }),
      new TextRun({ text: value, size: 22, font: 'Calibri', color: C.dark }),
    ],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 40, line: 260 },
    children: [new TextRun({ text, size: 22, font: 'Calibri', color: C.dark })],
  });
}

function codeBlock(lines) {
  const codeLines = Array.isArray(lines) ? lines : lines.split('\n');
  return codeLines.map((line) =>
    new Paragraph({
      spacing: { after: 0, line: 240 },
      shading: { type: ShadingType.CLEAR, fill: C.codeBg, color: C.codeBg },
      indent: { left: convertInchesToTwip(0.3), right: convertInchesToTwip(0.3) },
      children: [
        new TextRun({
          text: line || ' ',
          size: 18,
          font: 'Consolas',
          color: C.codeFg,
        }),
      ],
    })
  );
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 60 }, children: [] });
}

function inlineCode(text) {
  return new TextRun({ text, size: 22, font: 'Consolas', color: C.secondary, bold: true });
}

// ─── Table helpers ───
function tableCell(text, opts = {}) {
  const runs = [];
  if (opts.bold) {
    runs.push(new TextRun({ text, bold: true, size: 20, font: 'Calibri', color: opts.header ? C.white : C.dark }));
  } else {
    runs.push(new TextRun({ text, size: 20, font: 'Calibri', color: C.dark }));
  }
  return new TableCell({
    children: [new Paragraph({ children: runs, spacing: { after: 0 } })],
    shading: opts.header
      ? { type: ShadingType.CLEAR, fill: C.tableHeader, color: C.tableHeader }
      : opts.alt
        ? { type: ShadingType.CLEAR, fill: C.tableAlt, color: C.tableAlt }
        : undefined,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
  });
}

function tableRow(cells, isHeader = false) {
  return new TableRow({
    children: cells.map((c, i) => tableCell(c, { header: isHeader, bold: isHeader, alt: !isHeader && i % 2 === 1 })),
  });
}

function createTable(headers, rows) {
  return new Table({
    rows: [
      tableRow(headers, true),
      ...rows.map((r, i) => tableRow(r, false)),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

// ─── Build document ───
async function main() {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: C.dark },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [
      // ════════════════════════════════════════════════
      // TITLE PAGE
      // ════════════════════════════════════════════════
      {
        children: [
          emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [new TextRun({ text: 'UCS CRM', size: 80, bold: true, color: C.primary, font: 'Calibri Light' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: 'Master Documentation', size: 52, color: C.secondary, font: 'Calibri Light' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            border: {
              top: { style: BorderStyle.SINGLE, size: 6, color: C.border },
              bottom: { style: BorderStyle.SINGLE, size: 6, color: C.border },
            },
            children: [],
          }),
          emptyLine(),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [new TextRun({ text: 'Comprehensive Documentation of the', size: 24, color: C.gray, font: 'Calibri' })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [new TextRun({ text: 'Attendance Tracking & CRM System', size: 28, bold: true, color: C.dark, font: 'Calibri' })],
          }),
          emptyLine(), emptyLine(),
          boldPara('Last Updated: ', 'July 13, 2026'),
          boldPara('Project Root: ', 'C:\\Users\\Administrator\\Desktop\\attendance\\UCS_CRM'),
          boldPara('Live Backend: ', 'https://ucs-crm-backend.vercel.app'),
          boldPara('Document Type: ', 'Technical Reference / API Documentation'),
          emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(), emptyLine(),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: '— Generated by UCS CRM Documentation Tool —', size: 20, color: C.gray, font: 'Calibri', italics: true })],
          }),
        ],
      },

      // ════════════════════════════════════════════════
      // TABLE OF CONTENTS
      // ════════════════════════════════════════════════
      {
        children: [
          h1('Table of Contents'),
          emptyLine(),
          ...'1. Project Overview\n2. Directory Structure\n3. Backend API\n    3.1 Auth Middleware & Role Hierarchy\n    3.2 Complete Route Table\n    3.3 Database Schema\n4. Main CRM SPA — Panel Documentation\n    4.1 Super Admin Panel\n    4.2 HR Panel\n    4.3 Accounts Panel\n    4.4 FRO Panel\n    4.5 NGO Admin Panel\n    4.6 Recruiter Panel\n    4.7 Event Head Panel\n5. Flutter Mobile App\n6. Web PWA (Worker Attendance)\n7. Supporting Components\n8. External Service Integration Summary\n9. Complete cURL API Reference'.split('\n').map((l) => {
            const indent = l.startsWith('    ') ? 1 : 0;
            return new Paragraph({
              spacing: { after: 30 },
              indent: { left: indent * convertInchesToTwip(0.3) },
              children: [new TextRun({ text: l.trim(), size: 22, font: 'Calibri', color: indent ? C.gray : C.dark, bold: !indent })],
            });
          }),
        ],
      },

      // ════════════════════════════════════════════════
      // SECTION 1: PROJECT OVERVIEW
      // ════════════════════════════════════════════════
      {
        children: [
          new Paragraph({ children: [new PageBreak()] }),
          h1('1. Project Overview'),
          para('UCS CRM is a comprehensive attendance tracking + Customer Relationship Management system for NGOs and non-profit organizations. It enables managing field workers (FROs), donor relationships, attendance with QR-based geo-verification, payment collection, receipt generation, bank reconciliation, HR workflows, event management, and recruitment.'),

          h2('System Architecture'),
          ...codeBlock([
            '┌─────────────────────────────────────────────────────────────┐',
            '│                   End Users / Clients                        │',
            '│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐  │',
            '│  │ Flutter   │  │ Web PWA  │  │ CRM SPA  │  │ shon    │  │',
            '│  │ (Mobile)  │  │ (Worker)  │  │ (Admin)  │  │ (Basic) │  │',
            '│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └────┬────┘  │',
            '│        │               │              │              │       │',
            '├────────┼───────────────┼──────────────┼──────────────┼───────┤',
            '│        ▼               ▼              ▼              ▼       │',
            '│  ┌──────────────────────────────────────────────────────┐   │',
            '│  │            Express.js API (Node.js)                  │   │',
            '│  │  47 Controllers · 37 Models · 42 Route Files        │   │',
            '│  └──────────────────────┬───────────────────────────────┘   │',
            '│                         │                                    │',
            '│  ┌──────────────────────┼───────────────────────────────┐   │',
            '│  │         Supabase (PostgreSQL + Realtime)             │   │',
            '│  │          40+ Tables · Edge Functions                 │   │',
            '│  └──────────────────────────────────────────────────────┘   │',
            '│                                                              │',
            '│  External Services:                                          │',
            '│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ │',
            '│  │Firebase│ │Razorpay│ │ Paytm  │ │WhatsApp│ │  Groq AI │ │',
            '│  │  FCM   │ │  PGs   │ │  PGs   │ │  Cloud │ │ (LLaMA)  │ │',
            '│  └────────┘ └────────┘ └────────┘ └────────┘ └──────────┘ │',
            '└─────────────────────────────────────────────────────────────┘',
          ]),

          h2('Tech Stack Summary'),
          createTable(
            ['Layer', 'Technology', 'Version'],
            [
              ['Backend Runtime', 'Node.js', 'v24.x'],
              ['Backend Framework', 'Express.js', '—'],
              ['Database', 'Supabase (PostgreSQL)', '—'],
              ['Authentication', 'JWT + bcryptjs', '—'],
              ['Main CRM Frontend', 'React + Vite', 'React 19, Vite 6'],
              ['Worker Web App', 'React + Vite + Tailwind CSS', 'React 19, Vite 6, Tailwind 4'],
              ['Mobile App', 'Flutter', '^3.12.0'],
              ['Push Notifications', 'Firebase Cloud Messaging', '—'],
              ['AI/ML', 'Groq SDK (LLaMA)', '—'],
              ['Payment Gateways', 'Razorpay, Paytm', '—'],
              ['WhatsApp', 'Meta Cloud API', '—'],
              ['Email Import', 'IMAP (ImapFlow + mailparser)', '—'],
              ['File Parsing', 'xlsx, multer', '—'],
              ['Hosting', 'Vercel', '—'],
              ['Charts', 'Recharts', '3.9'],
              ['PDF Generation', 'jsPDF + html2canvas', '—'],
            ],
          ),
        ],
      },

      // ════════════════════════════════════════════════
      // SECTION 2: DIRECTORY STRUCTURE
      // ════════════════════════════════════════════════
      {
        children: [
          new Paragraph({ children: [new PageBreak()] }),
          h1('2. Directory Structure'),
          para('The project root contains the following major directories and files:'),
          ...codeBlock([
            'UCS_CRM/',
            '├── .gitignore                          (18 lines)',
            '├── .vercel/                            Vercel deployment config',
            '├── backend/                            ★ MAIN BACKEND ★',
            '│   ├── .env                            Environment variables',
            '│   ├── package.json                    Dependencies',
            '│   ├── vercel.json                     Deployment config',
            '│   ├── functions/                      (3 Deno Edge Functions)',
            '│   ├── migrations/                     (29 SQL migration files)',
            '│   ├── scripts/                        (5 utility scripts)',
            '│   └── src/                            Application source',
            '│       ├── index.js                    Express entry point',
            '│       ├── config/                     (6 config files)',
            '│       ├── middleware/                  JWT auth middleware',
            '│       ├── controllers/                (47 controllers)',
            '│       ├── models/                     (37 model files)',
            '│       ├── services/                   (10 service files)',
            '│       ├── utils/                      (2 utilities)',
            '│       └── routes/                     (42 route files)',
            '├── client/                             ★ FLUTTER MOBILE ★',
            '│   ├── pubspec.yaml                    Dependencies',
            '│   ├── lib/                            Source code',
            '│   │   ├── main.dart                   App entry + theme',
            '│   │   ├── config.dart                 API/Supabase URLs',
            '│   │   ├── data/                       Mock data + policies',
            '│   │   ├── models/                     (5 data models)',
            '│   │   ├── pages/                      (14 pages)',
            '│   │   ├── services/                   (3 services)',
            '│   │   └── widgets/                    (6 widgets)',
            '│   ├── android/                        Android config',
            '│   ├── ios/                            iOS config',
            '│   ├── web/                            Web platform',
            '│   ├── linux/                          Linux platform',
            '│   ├── macos/                          macOS platform',
            '│   └── windows/                        Windows platform',
            '├── client-web/                         ★ WORKER WEB PWA ★',
            '│   ├── index.html                      PWA HTML shell',
            '│   ├── package.json                    Dependencies',
            '│   ├── vite.config.js                  Build config',
            '│   ├── public/                         Manifest + SW + icons',
            '│   └── src/                            Source code',
            '│       ├── main.jsx                    Entry + SW registration',
            '│       ├── config.js                   Constants',
            '│       ├── api.js                      All API methods',
            '│       ├── store.jsx                   Auth context',
            '│       ├── App.jsx                     Routing',
            '│       ├── index.css                   Tailwind + iOS PWA',
            '│       └── components/                 (15 components)',
            '├── ucs crm/                            ★ MAIN CRM SPA ★',
            '│   ├── index.html                      HTML entry',
            '│   ├── package.json                    Dependencies',
            '│   ├── vite.config.js                  Build config',
            '│   ├── src/                            Source code',
            '│   │   ├── main.jsx                    Entry',
            '│   │   ├── App.jsx                     Role-based routing',
            '│   │   ├── store.jsx                   Auth context',
            '│   │   ├── theme.js                    17 themes',
            '│   │   ├── icons.jsx                   SVG icons',
            '│   │   ├── index.css                   1100+ lines CSS',
            '│   │   ├── config/                     Supabase client',
            '│   │   ├── hooks/                      Realtime hook',
            '│   │   ├── api/                        Core API module',
            '│   │   ├── components/                 (7 shared components)',
            '│   │   └── panels/                     ★ 7 PANELS ★',
            '│   │       ├── super-admin/            (24+ files)',
            '│   │       ├── hr/                     (30+ files)',
            '│   │       ├── accounts/               (30+ files)',
            '│   │       ├── fro/                    (28+ files)',
            '│   │       ├── ngo-admin/              (18+ files)',
            '│   │       ├── recruiter/              (15+ files)',
            '│   │       └── event-head/             (25+ files)',
            '│   └── public/                         NGO logos, stamps',
            '├── AssertRegister/                     ★ ASSET REGISTER ★',
            '│   ├── AssetRegister.jsx               React component (666 lines)',
            '│   ├── assets_table.sql                PostgreSQL schema',
            '│   └── assets.routes.js                Express routes',
            '├── shon/                               ★ SIMPLE ATTENDANCE ★',
            '└── privacy/                            ★ LEGAL DOCS ★',
            '    ├── privacy-policy.html             Privacy + Terms',
            '    └── whatsapp.txt                    WhatsApp tokens',
          ]),
        ],
      },

      // ════════════════════════════════════════════════
      // SECTION 3: BACKEND API
      // ════════════════════════════════════════════════
      {
        children: [
          new Paragraph({ children: [new PageBreak()] }),
          h1('3. Backend API'),

          h2('3.1 Auth Middleware & Role Hierarchy'),
          h3('authenticate(req, res, next)'),
          para('Reads Authorization: Bearer <token> header. Verifies JWT with process.env.JWT_SECRET. Sets req.user with decoded payload. Returns 401 if no token or invalid.'),
          h3('authenticateRole(...allowedRoles)'),
          para('Returns middleware that checks if decoded.role is in allowedRoles array. Returns 403 if unauthorized.'),
          h3('Pre-configured Middleware Instances'),
          createTable(
            ['Middleware', 'Roles Allowed'],
            [
              ['authenticateAdmin', 'super_admin'],
              ['authenticateWorker', 'worker, fro'],
            ],
          ),
          h3('Role Hierarchy'),
          ...codeBlock([
            'super_admin (highest — can access ALL panels)',
            '  └── admin (NGO admin, department="ngo admin")',
            '      └── hr',
            '          └── accounts',
            '              └── recruiter',
            '                  └── telecaller',
            '                      └── team_lead',
            '                          └── worker / fro (lowest)',
          ]),

          h2('3.2 Complete Route Table'),
          para('Server entry: src/index.js — Express app with CORS (origin: "*"), JSON body parser (10mb limit), raw body capture for webhooks. Static file serving for FRO panel, NGO admin panel, Accounts panel.'),
          para('Cron endpoints (unauthenticated, triggered by Vercel Cron): POST /api/cron/notifications, /api/cron/email-import, /api/cron/razorpay-sync'),
          para('All routes mounted under /api base path.', { run: { bold: true } }),

          h3('3.2.1 Auth Routes'),
          createTable(
            ['Method', 'Path', 'Roles', 'Controller', 'Description'],
            [
              ['POST', '/auth/admin/login', 'rateLimit', 'adminLogin', 'Super admin login via env EMAIL/PASS'],
              ['POST', '/auth/worker/login', 'rateLimit', 'unifiedLogin', 'Worker/user/HR login'],
              ['POST', '/auth/login', 'rateLimit', 'unifiedLogin', 'Unified login'],
            ],
          ),

          h3('3.2.2 Attendance Routes'),
          createTable(
            ['Method', 'Path', 'Roles', 'Controller', 'Description'],
            [
              ['POST', '/attendance/punch-in', 'authenticate', 'punchIn', 'QR + GPS punch-in'],
              ['POST', '/attendance/punch-out', 'authenticate', 'punchOut', 'GPS punch-out'],
              ['GET', '/attendance/today', 'authenticate', 'todayStatus', "Today's attendance"],
              ['GET', '/attendance/history', 'authenticate', 'myHistory', 'Worker history'],
              ['GET', '/attendance/all', 'SA,admin,hr', 'listAll', 'All records'],
              ['POST', '/attendance/', 'SA,admin,hr', 'createAttendanceByHR', 'HR creates record'],
              ['PUT', '/attendance/:id', 'SA,admin,hr', 'updateAttendanceRecord', 'Update record'],
              ['DELETE', '/attendance/:id', 'SA,admin,hr', 'deleteAttendanceRecord', 'Delete record'],
              ['GET', '/attendance/worker/:id', 'SA,admin,hr', 'getWorkerMonthlyAttendance', 'Monthly attendance'],
            ],
          ),

          h3('3.2.3 Worker Routes'),
          createTable(
            ['Method', 'Path', 'Roles', 'Controller', 'Description'],
            [
              ['POST', '/workers/', 'SA,admin,hr', 'addWorker', 'Create worker'],
              ['POST', '/workers/bulk', 'SA,admin,hr', 'bulkAddWorkers', 'Bulk create'],
              ['PUT', '/workers/bulk', 'SA,admin,hr', 'bulkEditWorkers', 'Bulk update'],
              ['GET', '/workers/', 'SA,admin,hr,accounts', 'getWorkers', 'List workers'],
              ['GET', '/workers/birthdays', 'SA,admin,hr', 'getBirthdays', 'Next 30 days'],
              ['GET', '/workers/me', 'authenticate', 'getMyProfile', 'Own profile'],
              ['PUT', '/workers/me', 'authenticate', 'updateMyProfile', 'Update profile'],
              ['PUT', '/workers/me/education', 'authenticate', 'updateMyEducation', 'Update education'],
              ['GET', '/workers/:id', 'SA,admin,hr', 'getWorker', 'Full profile'],
              ['PUT', '/workers/:id', 'SA,admin,hr', 'editWorker', 'Update worker'],
              ['DELETE', '/workers/:id', 'SA,admin,hr', 'removeWorker', 'Delete worker'],
            ],
          ),

          h3('3.2.4 Additional Route Tables'),
          para('QR Code Routes: POST /api/qr/generate, GET /api/qr/, POST /api/qr/validate, DELETE /api/qr/:id'),
          para('Leave Routes: POST /api/leaves/apply, GET /api/leaves/my, GET /api/leaves/, GET /api/leaves/pending, PUT /api/leaves/:id/status'),
          para('Loan Routes: POST /api/loans/apply, GET /api/loans/my, GET /api/loans/, PUT /api/loans/:id/decide'),
          para('Notification Routes: POST /api/notifications/register-token, GET /api/notifications/:worker_id, PUT /api/notifications/:id/read'),
          para('Full route table available for all 42 route files in the source code.', { run: { italics: true } }),

          h2('3.3 Database Schema'),
          para('The system uses Supabase (PostgreSQL) with 40+ tables. Key tables:'),

          h3('workers'),
          createTable(
            ['Column', 'Type', 'Description'],
            [
              ['id', 'UUID PK', 'Primary key'],
              ['name', 'TEXT', 'Worker name'],
              ['login_id', 'TEXT UNIQUE', 'Unique login identifier'],
              ['password', 'TEXT', 'Bcrypt hashed password'],
              ['email', 'TEXT', 'Email address'],
              ['phone', 'TEXT', 'Phone number'],
              ['department', 'TEXT', 'FRO, HR, admin, etc.'],
              ['shift_start_time', 'TEXT', 'e.g., "10:00"'],
              ['shift_end_time', 'TEXT', 'e.g., "19:00"'],
              ['ngo_id', 'INTEGER FK', 'Primary NGO'],
              ['is_active', 'BOOLEAN', 'Active status'],
              ['onboarding_completed', 'BOOLEAN', 'Onboarding flag'],
              ['photo_url', 'TEXT', 'Profile photo URL'],
              ['pan_number', 'TEXT', 'PAN card'],
              ['aadhar_number', 'TEXT', 'Aadhaar number'],
              ['account_number', 'TEXT', 'Bank account'],
              ['ifsc_code', 'TEXT', 'Bank IFSC'],
              ['daily_collection_target', 'DECIMAL(12,2)', 'For NGO admins'],
              ['created_at', 'TIMESTAMPTZ', 'Creation timestamp'],
            ],
          ),

          h3('attendance'),
          createTable(
            ['Column', 'Type', 'Description'],
            [
              ['id', 'UUID PK', ''],
              ['worker_id', 'UUID FK→workers', ''],
              ['date', 'DATE', 'IST date'],
              ['punch_in_time', 'TIMESTAMPTZ', ''],
              ['punch_out_time', 'TIMESTAMPTZ', ''],
              ['punch_in_lat', 'DOUBLE', 'Latitude'],
              ['punch_in_lng', 'DOUBLE', 'Longitude'],
              ['status', 'TEXT', 'present/late/absent/half-day/leave'],
              ['late_minutes', 'INTEGER', ''],
            ],
          ),

          h3('users (panel users)'),
          createTable(
            ['Column', 'Type', 'Description'],
            [
              ['id', 'UUID PK', ''],
              ['ngo_id', 'INTEGER FK', 'NGO association'],
              ['name', 'TEXT', ''],
              ['email', 'TEXT UNIQUE', ''],
              ['password_hash', 'TEXT', ''],
              ['role', 'TEXT', 'super_admin, admin, hr, accounts, etc.'],
              ['is_active', 'BOOLEAN', ''],
            ],
          ),

          h3('donor_profiles'),
          createTable(
            ['Column', 'Type', 'Description'],
            [
              ['id', 'SERIAL PK', ''],
              ['name', 'TEXT', 'Donor name'],
              ['mobile_number', 'TEXT', 'Phone'],
              ['ngo_id', 'INTEGER FK', 'NGO'],
              ['city', 'TEXT', ''],
              ['pan_number', 'TEXT', ''],
              ['total_amount', 'DECIMAL(12,2)', 'Total donated'],
              ['donation_count', 'INTEGER', ''],
              ['project_supported', 'TEXT', ''],
            ],
          ),

          h3('fro_assignments'),
          createTable(
            ['Column', 'Type', 'Description'],
            [
              ['id', 'SERIAL PK', ''],
              ['donor_id', 'INTEGER FK→donor_profiles', ''],
              ['fro_worker_id', 'UUID FK→workers', ''],
              ['ngo_id', 'INTEGER FK→ngos', ''],
              ['station', 'TEXT', 'FRO station name'],
              ['status', 'TEXT', 'pending/contacted/lead_done/etc.'],
              ['next_follow_up', 'DATE', ''],
              ['is_new', 'BOOLEAN', ''],
            ],
          ),

          h3('fro_donor_logs'),
          createTable(
            ['Column', 'Type', 'Description'],
            [
              ['id', 'SERIAL PK', ''],
              ['donor_id', 'INTEGER FK', ''],
              ['fro_worker_id', 'UUID FK', ''],
              ['action', 'TEXT', 'call/visit/message/donation'],
              ['amount_collected', 'DECIMAL(12,2)', ''],
              ['disposition_category', 'TEXT', 'connected/not_connected'],
              ['disposition_detail', 'TEXT', 'lead_done/scheduled/etc.'],
              ['accounts_status', 'TEXT', 'pending/verified/rejected'],
              ['payment_screenshot_url', 'TEXT', ''],
              ['upi_transaction_id', 'TEXT', ''],
              ['payment_mode', 'TEXT', 'UPI/Cash/Card'],
            ],
          ),

          h3('Additional Tables'),
          para('The system also includes tables for: leaves, attendance_corrections, salary_history, worker_loans, holidays, events, notices, achievements, tasks, leads, call_logs, qr_codes, bank_audit_sources, bank_audit_entries, fro_live_status, fro_station_assignments, fro_transfers, fro_targets, daily_achievements, razorpay_accounts, whatsapp_accounts, email_import_accounts, notification_log, settings, letter_templates, causes, data_sources, data_import_batches, event_head_events, event_head_assets, event_head_materials, event_head_volunteers, event_head_expenses, event_head_media, event_head_attendance, event_head_checklist, suspense_entries, donor_crm_leads, and more.', { run: { italics: true } }),
        ],
      },

      // ════════════════════════════════════════════════
      // SECTION 4: MAIN CRM SPA
      // ════════════════════════════════════════════════
      {
        children: [
          new Paragraph({ children: [new PageBreak()] }),
          h1('4. Main CRM SPA — Panel Documentation'),
          para('Location: ucs crm/src/. Entry: src/main.jsx. Uses React 19 + Vite 6 + React Router 7 + Recharts 3.9 + jsPDF 4.2.'),
          h2('Global Auth Context (store.jsx)'),
          para('UcsProvider manages user and token state via localStorage keys ucs_token and ucs_user.'),
          para('Allowed roles: super_admin, admin, hr, accounts, recruiter, telecaller, fro, worker, event_head, event_manager'),
          h2('Role-to-Path Mapping'),
          createTable(
            ['Role(s)', 'Base Path', 'Panel Component'],
            [
              ['super_admin', '/sa/*', 'SuperAdminPanel'],
              ['admin', '/ngo-admin/*', 'NgoAdminPanel'],
              ['hr', '/hr/*', 'HRPanel'],
              ['accounts', '/accounts/*', 'AccountsPanel'],
              ['fro, worker', '/fro/*', 'FROPanel'],
              ['recruiter', '/recruiter/*', 'RecruiterPanel'],
              ['event_head', '/event-head/*', 'EventHeadPanel'],
            ],
          ),

          h2('4.1 Super Admin Panel'),
          para('Location: panels/super-admin/ (24+ files). Entry: SuperAdminPanel.jsx (338 lines). Sidebar: Dashboard, Data Management, Organization, Employees, Leaves, Tickets, Assets, and iframe-wrapped panels (Accounts, FRO, HR, NGO Admin, Event Head, Recruiter).'),
          para('Key pages: Dashboard (3322 lines — KPI metrics, Recharts charts, CSV export), Workers, WorkerDetail, Leaves, Tickets, Events, AssetOverview.'),
          h4('API Endpoints'),
          para('GET /dashboard/super-admin, GET /dashboard/fro-live, GET /ngos, GET/POST/PUT/DELETE /workers, GET /leaves, GET /attendance/all, GET /salary/workers-summary, GET /incentive/monthly-summary, GET /attendance-corrections/*, GET/PUT /super-admin/ngo-admin-targets, GET /dashboard/super-admin-alerts'),

          h2('4.2 HR Panel'),
          para('Location: panels/hr/ (30+ files). Entry: HRPanel.jsx (254 lines). Store: store.jsx (107 lines) with extensive API wrapper.'),
          para('Sidebar: Overview, Employees, Attendance, Leaves, Letters, HR Forms, Recruiters, Holidays, QR Codes, Loans, Tickets, Phone Numbers.'),
          h4('Store Functions (~50+ API methods)'),
          para('Workers CRUD, Attendance, Leaves CRUD, Letter generation (6 templates), Notifications, Holidays, Leads/Recruiters, Salary, Incentives/Targets/Achievements, Allocations, Loans/Advances, Correction Tickets, QR Codes, Settings.'),

          h2('4.3 Accounts Panel'),
          para('Location: panels/accounts/ (30+ files). Entry: AccountsPanel.jsx (244 lines).'),
          para('Sidebar: Lead Verification, Bank Audit, Receipt History, Receipt Generator, Reports, Asset Register, WhatsApp Accounts/Agents.'),
          para('Key features: Lead verification workflow, Receipt generation (3 NGO templates: Mann Car, Being Sevak, Ashray), PDF batch generation via pdfGenerator.js, WhatsApp receipt sending, Razorpay accounts management, Email import, Bank audit.'),

          h2('4.4 FRO Panel'),
          para('Location: panels/fro/ (28+ files). Entry: FROPanel.jsx (513 lines).'),
          para('Sidebar: Dashboard, Follow Up/Callback, My Leads, Transferred, Donors, Call Logs, Rejected Leads, Target, Suspense, WhatsApp Chat.'),
          para('Key features: CallContext for call lifecycle management, DispositionModal (connected: lead_done, scheduled, callback, etc.; not-connected: busy, unreachable, etc.), OCR for payment screenshots, WhatsApp chat integration, target vs achieved tracking.'),

          h2('4.5 NGO Admin Panel'),
          para('Location: panels/ngo-admin/ (18+ files). Entry: NgoAdminPanel.jsx (587 lines).'),
          para('Sidebar: Dashboard, Stations & FROs, FRO Status, Call Analytics, Donor CRM, Suspense, Alerts, Donors, New Data, Attendance, Rejected Leads.'),
          para('Key features: Full donor CRM, Station/FRO assignment management, Master search, New data distribution, Suspense handling, Call analytics, Alert management.'),

          h2('4.6 Recruiter Panel'),
          para('Location: panels/recruiter/ (15+ files). Entry: RecruiterPanel.jsx (180 lines). Store: store.jsx (157 lines — RecProvider/useRec).'),
          para('State: candidates (seed + API), jobs, leads (API poll every 15s), leadFilters, leadStats.'),
          para('Stages: Contacted → Screening → Interview Scheduled → Selected → Offer Sent → Rejected. Lead statuses: 12 options.'),

          h2('4.7 Event Head Panel'),
          para('Location: panels/event-head/ (25+ files). Entry: EventHeadPanel.jsx (268 lines). Store: store.jsx (131 lines — 40+ API functions).'),
          para('Sidebar groups: Dashboard (Event Dashboard, Monthly Planner, Events), Planning (Create Event, Checklist), Resources (Assets, Materials), Execution (Distribution, Volunteers, Attendance), Reports (All Events, Reports, Approvals, Notifications).'),
          para('Categories: Education, Health, Food Distribution, Women Empowerment, Animal Welfare, Disability Support, Environment, Medical Camp, Blood Donation.'),
          para('Event statuses: Draft → Submitted → Approved → Rejected → Completed → Closed → Cancelled → Postponed.'),

          h2('4.8 Shared Components'),
          createTable(
            ['Component', 'File', 'Lines', 'Description'],
            [
              ['DonorDetailModal', 'DonorDetailModal.jsx', '186', 'Donor overlay: profile, donations, transactions, follow-ups'],
              ['NotificationDrawer', 'NotificationDrawer.jsx', '127', 'Slide-in drawer with sections, mark-read, clear'],
              ['SettingsDrawer', 'SettingsDrawer.jsx', '108', 'Theme selector + configurable views'],
              ['RecentNotices', 'RecentNotices.jsx', '113', 'Role-filtered notices'],
              ['Toast', 'Toast.jsx', '55', 'Global toast (success/error/info)'],
              ['Skeleton', 'Skeleton.jsx', '85', 'Loading placeholders (row, table, profile, dashboard, donors)'],
              ['UI', 'ui.jsx', '184', 'Dropdown, DatePicker, Avatar, Pill, Who'],
            ],
          ),
        ],
      },

      // ════════════════════════════════════════════════
      // SECTION 5: FLUTTER MOBILE
      // ════════════════════════════════════════════════
      {
        children: [
          new Paragraph({ children: [new PageBreak()] }),
          h1('5. Flutter Mobile App'),
          para('Package: ufs_attendance (v1.0.0+3). SDK: ^3.12.0. Platforms: Android, iOS, Web, Windows, macOS, Linux.'),

          h2('5.1 Dependencies'),
          createTable(
            ['Package', 'Version', 'Usage'],
            [
              ['mobile_scanner', '^6.0.11', 'QR/Barcode scanning'],
              ['intl', '^0.20.2', 'Date/time formatting'],
              ['google_fonts', '^6.2.1', 'Manrope, Hanken Grotesk fonts'],
              ['http', '^1.2.0', 'HTTP client'],
              ['geolocator', '^13.0.2', 'GPS location'],
              ['shared_preferences', '^2.3.0', 'Local key-value storage'],
              ['firebase_core', '^3.12.0', 'Firebase core'],
              ['firebase_messaging', '^15.2.0', 'FCM push notifications'],
              ['flutter_local_notifications', '^18.0.0', 'Local notification display'],
              ['image_picker', '^1.1.2', 'Camera/gallery image selection'],
              ['supabase_flutter', '^2.5.6', 'Supabase realtime database'],
              ['printing', '^5.13.4', 'PDF printing'],
              ['pdf', '^3.11.1', 'PDF generation'],
            ],
          ),

          h2('5.2 Navigation Flow'),
          ...codeBlock([
            'SplashPage (loading check)',
            '  ├── No token → LoginPage',
            '  │     └── POST /auth/worker/login → saveToken + saveWorkerData',
            '  │           └── checkOnboardingStatus → OnboardingPage or MainShell',
            '  ├── Token + onboarding incomplete → OnboardingPage (11-step wizard)',
            '  │     └── POST /onboarding/submit → MainShell',
            '  └── Token + onboarding complete → MainShell',
            '        ├── [Tab 0] HomePage (dashboard, clock, punch, stats, notifications)',
            '        └── [Tab 1] ProfilePage (profile, calendar, loans, tickets, settings)',
          ]),

          h2('5.3 API Surface Summary'),
          para('ApiService (590 lines) — custom DNS-over-HTTPS via Cloudflare, 10s connect / 15s request timeout, SharedPreferences caching.'),
          createTable(
            ['Method', 'Endpoint', 'Purpose'],
            [
              ['login()', 'POST /auth/worker/login', 'Authenticate user'],
              ['punchIn()', 'POST /attendance/punch-in', 'QR + GPS punch-in'],
              ['punchOut()', 'POST /attendance/punch-out', 'GPS punch-out'],
              ['getTodayStatus()', 'GET /attendance/today', "Today's attendance"],
              ['getHistory()', 'GET /attendance/history', 'Full history'],
              ['applyLeave()', 'POST /leaves/apply', 'Apply for leave'],
              ['getMyLeaves()', 'GET /leaves/my', 'My leaves'],
              ['applyAdvance()', 'POST /advances/apply', 'Apply advance'],
              ['applyLoan()', 'POST /loans/apply', 'Apply loan'],
              ['getMyLoans()', 'GET /loans/my', 'My loans'],
              ['getMyProfile()', 'GET /workers/me', 'Own profile'],
              ['updateMyProfile()', 'PUT /workers/me', 'Update profile'],
              ['registerFcmToken()', 'POST /notifications/register-token', 'FCM registration'],
              ['getNotifications()', 'GET /notifications/{id}', 'List notifications'],
              ['getUnreadCount()', 'GET /notifications/{id}/unread-count', 'Unread count'],
              ['checkOnboardingStatus()', 'GET /onboarding/status', 'Check completion'],
              ['submitOnboarding()', 'POST /onboarding/submit', 'Submit all data'],
              ['uploadPhoto()', 'POST /onboarding/upload-photo', 'Upload profile photo'],
              ['getPrintProfile()', 'GET /onboarding/print-profile', 'Profile for PDF'],
              ['getMySalaryBreakdown()', 'GET /salary/my-breakdown', 'Salary breakdown'],
              ['getCalendar()', 'GET /calendar', 'Events + holidays'],
              ['raiseCorrectionTicket()', 'POST /attendance-corrections', 'Raise ticket'],
            ],
          ),

          h2('5.4 Onboarding Wizard (11 Steps)'),
          createTable(
            ['Step', 'Fields'],
            [
              ['0 — Personal', 'name, email, phone, gender, DOB, address, PAN, Aadhaar, emergency contact'],
              ['1 — Education', 'Dynamic: degree, institution, university, year, percentage'],
              ['2 — Previous Orgs', 'Dynamic: organization, role, from/to year'],
              ['3 — Family', 'Dynamic: name, relationship, occupation, phone, DOB'],
              ['4 — References', 'Dynamic: name, designation, organization, phone'],
              ['5 — Photo', 'Camera/gallery upload'],
              ['6 — Documents', 'Aadhaar front/back, PAN, bank proof, light bill'],
              ['7 — Bank', 'Bank name, account holder, IFSC, account number'],
              ['8 — Declaration', 'Date, place, checkbox'],
              ['9 — Policies', 'Accept all company policies'],
              ['10 — Review/Success', 'Summary + navigate to dashboard'],
            ],
          ),
        ],
      },

      // ════════════════════════════════════════════════
      // SECTION 6: WEB PWA
      // ════════════════════════════════════════════════
      {
        children: [
          new Paragraph({ children: [new PageBreak()] }),
          h1('6. Web PWA (Worker Attendance)'),
          para('Location: client-web/. Stack: React 19, Vite 6, Tailwind CSS 4, jsQR, React Router 7.'),

          h2('6.1 Configuration'),
          ...codeBlock([
            'API_BASE = "https://attendance-roan-zeta.vercel.app/api"',
            'OFFICE_START = "10:00"',
            'OFFICE_END = "19:00"',
            'CACHE_KEYS: TOKEN, WORKER, TODAY, HISTORY, NOTIFICATIONS, UNREAD (localStorage)',
          ]),

          h2('6.2 Routing Structure'),
          createTable(
            ['Path', 'Component', 'Guard'],
            [
              ['/', 'Splash', 'Public (redirects after 1.2s)'],
              ['/login', 'Login', 'Public (redirects if logged in)'],
              ['/onboarding', 'Onboarding', 'Protected (11 steps)'],
              ['/home', 'Home', 'Protected (dashboard + punch)'],
              ['/profile', 'Profile', 'Protected (calendar + loans)'],
              ['/attendance', 'AttendanceList', 'Protected (history)'],
              ['/edit-profile', 'EditProfile', 'Protected'],
              ['/scanner', 'Scanner', 'Protected (QR + GPS)'],
              ['/raise-ticket', 'CorrectionTicket', 'Protected'],
              ['/print', 'PrintForm', 'Protected'],
            ],
          ),

          h2('6.3 Component Catalog'),
          createTable(
            ['Component', 'Lines', 'API Calls', 'Description'],
            [
              ['Splash', '38', 'None', 'Animated logo, 1.2s redirect'],
              ['Login', '70', 'login()', 'Gradient form'],
              ['Layout', '123', 'None', 'Sidebar (desktop) + tab bar (mobile)'],
              ['Home', '323', 'today(), history(), myProfile(), unreadCount(), notifications(), punchOut()', 'Dashboard with clock, punch, stats, 15s poll'],
              ['HomeModals', '158', 'applyLeave(), applyAdvance(), applyLoan()', 'Leave + advance/loan modals'],
              ['Profile', '230', 'history(), today(), myLoans(), myTickets()', 'Profile card, calendar, loans, tickets'],
              ['AttendanceList', '107', 'history()', 'Monthly history with filter'],
              ['EditProfile', '65', 'myProfile(), updateProfile()', 'Edit name, email, phone, address'],
              ['Scanner', '235', 'today(), punchIn()', 'QR scan + GPS -> punch-in'],
              ['CorrectionTicket', '90', 'history(), raiseTicket()', 'Select date/field/time -> submit'],
              ['PrintForm', '40', 'printProfile()', 'Printable profile view'],
              ['Onboarding', '258', 'policies(), uploadPhoto(), submitOnboarding()', '11-step wizard'],
              ['MiniCalendar', '52', 'None', 'Color-coded month grid'],
              ['ProgressCircle', '16', 'None', 'SVG circular progress'],
              ['ConsistencyBar', '18', 'None', 'Horizontal stacked bar'],
            ],
          ),

          h2('6.4 PWA Setup'),
          para('Service Worker: Network-first with fallback to cache. Pre-caches / and /offline. Uses skipWaiting() and clients.claim().'),
          para('Manifest: standalone display, portrait orientation, theme #00152a, background #f6fafe, icons 48-512px.'),
          para('iOS: apple-mobile-web-app-capable, black-translucent status bar, safe-area CSS variables.'),
        ],
      },

      // ════════════════════════════════════════════════
      // SECTION 7: SUPPORTING COMPONENTS
      // ════════════════════════════════════════════════
      {
        children: [
          new Paragraph({ children: [new PageBreak()] }),
          h1('7. Supporting Components'),

          h2('7.1 AssertRegister'),
          para('Standalone asset register system with:'),
          bullet('SQL Schema: assets table with 30+ columns (code, name, category, brand, model, serial_no, department, condition, status, purchase info, warranty, repair history, JSONB history)'),
          bullet('Express Routes: GET/POST/PUT/DELETE /assets with auto-generated AST-XXX codes'),
          bullet('React Component (666 lines): Categories (9), Departments (8), Statuses (6) with colored badges, CSV export, summary cards, warranty alerts, category chart, activity feed'),

          h2('7.2 shon — Simple Attendance App'),
          para('Basic React + Supabase attendance app (gitignored at root). Uses hardcoded admin/user credentials from .env. Admin (readWrite), User (readOnly). Features: employee list, monthly calendar, CRUD attendance (admin only), IST timezone handling.'),

          h2('7.3 Privacy Documents'),
          para('privacy-policy.html: Privacy Policy + Terms & Conditions (effective June 19, 2026). Covers data collection (location, camera, notifications, devices, activity), usage, sharing, security, retention, third-party services, childrens privacy, account deletion. WhatsApp tokens stored in whatsapp.txt.'),
        ],
      },

      // ════════════════════════════════════════════════
      // SECTION 8: EXTERNAL SERVICES
      // ════════════════════════════════════════════════
      {
        children: [
          new Paragraph({ children: [new PageBreak()] }),
          h1('8. External Service Integration Summary'),
          createTable(
            ['Service', 'Integration', 'Used In'],
            [
              ['Supabase', 'PostgreSQL database + Realtime subscriptions', 'Backend (all data), Flutter (realtime), shon (direct DB)'],
              ['Firebase FCM', 'Push notifications via Admin SDK', 'Backend (fcmService.js), Flutter (notification_service.dart)'],
              ['Razorpay', 'Payment gateway webhook + payments sync', 'Backend (razorpayWebhook.js), Accounts panel'],
              ['Paytm', 'Payment gateway webhook with checksum verification', 'Backend (paytmWebhook.js)'],
              ['WhatsApp Cloud API', 'Business messaging (text, templates, receipts)', 'Backend (whatsappService.js, froWhatsAppService.js), Accounts, FRO'],
              ['Groq AI (LLaMA)', 'Email parsing + notification generation', 'Backend (emailImporter.js, notificationScheduler.js)'],
              ['OCR.space', 'Image-to-text OCR for payment screenshots', 'Backend (ocrController.js), FRO panel OCR utility'],
              ['Cloudflare DNS', 'DNS-over-HTTPS for reliable resolution', 'Flutter (api_service.dart custom transport)'],
              ['IMAP (ImapFlow)', 'Email inbox polling for bank statements', 'Backend (emailImporter.js)'],
              ['JWT + bcryptjs', 'Authentication and password hashing', 'Backend (authMiddleware.js, authController.js)'],
            ],
          ),
        ],
      },

      // ════════════════════════════════════════════════
      // SECTION 9: cURL API REFERENCE
      // ════════════════════════════════════════════════
      {
        children: [
          new Paragraph({ children: [new PageBreak()] }),
          h1('9. Complete cURL API Reference'),
          para('All examples use the base URL: https://ucs-crm-backend.vercel.app/api. Replace <token> with actual JWT from login response.'),

          h2('AUTH'),
          h4('Worker Login'),
          ...codeBlock([
            'curl -X POST https://ucs-crm-backend.vercel.app/api/auth/worker/login \\',
            '  -H "Content-Type: application/json" \\',
            '  -d \'{"identifier":"worker123","password":"secret"}\'',
            '',
            '# Response:',
            '# {"token":"jwt...","user":{"id":1,"name":"John","role":"worker","ngo_id":1,...}}',
          ]),
          emptyLine(),
          h4('Admin Login'),
          ...codeBlock([
            'curl -X POST https://ucs-crm-backend.vercel.app/api/auth/admin/login \\',
            '  -H "Content-Type: application/json" \\',
            '  -d \'{"identifier":"admin@ufs.com","password":"admin123"}\'',
          ]),

          h2('ATTENDANCE'),
          h4('Punch In'),
          ...codeBlock([
            'curl -X POST https://ucs-crm-backend.vercel.app/api/attendance/punch-in \\',
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer <token>" \\',
            '  -d \'{"code":"QR-OFFICE-001","latitude":19.0760,"longitude":72.8777}\'',
          ]),
          h4('Punch Out'),
          ...codeBlock([
            'curl -X POST https://ucs-crm-backend.vercel.app/api/attendance/punch-out \\',
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer <token>" \\',
            '  -d \'{"latitude":19.0760,"longitude":72.8777}\'',
          ]),
          h4('Today Status & History'),
          ...codeBlock([
            'curl -X GET https://ucs-crm-backend.vercel.app/api/attendance/today \\',
            '  -H "Authorization: Bearer <token>"',
            '',
            'curl -X GET https://ucs-crm-backend.vercel.app/api/attendance/history \\',
            '  -H "Authorization: Bearer <token>"',
          ]),

          h2('LEAVES & LOANS'),
          ...codeBlock([
            '# Apply Leave',
            'curl -X POST https://ucs-crm-backend.vercel.app/api/leaves/apply \\',
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer <token>" \\',
            '  -d \'{"type":"full_day","leave_date":"2026-07-15","reason":"Personal"}\'',
            '',
            '# Apply Loan',
            'curl -X POST https://ucs-crm-backend.vercel.app/api/loans/apply \\',
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer <token>" \\',
            '  -d \'{"type":"loan","amount":5000,"reason":"Medical expenses"}\'',
            '',
            '# My Loans',
            'curl -X GET https://ucs-crm-backend.vercel.app/api/loans/my \\',
            '  -H "Authorization: Bearer <token>"',
          ]),

          h2('FRO OPERATIONS'),
          ...codeBlock([
            '# FRO Dashboard',
            'curl -X GET https://ucs-crm-backend.vercel.app/api/fro/dashboard \\',
            '  -H "Authorization: Bearer <token>"',
            '',
            '# My Donors List',
            'curl -X GET "https://ucs-crm-backend.vercel.app/api/fro/donors?status=pending" \\',
            '  -H "Authorization: Bearer <token>"',
            '',
            '# Create Donor Log (Disposition)',
            'curl -X POST https://ucs-crm-backend.vercel.app/api/fro/donors/123/logs \\',
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer <token>" \\',
            '  -d \'{"action":"disposition","disposition_category":"connected",\\',
            '    "disposition_detail":"lead_done","amount_collected":500,\\',
            '    "notes":"Donor agreed to donate monthly",\\',
            '    "project_name":"Mission Annapurna","pan_number":"ABCDE1234F"}\'',
            '',
            '# My Target',
            'curl -X GET https://ucs-crm-backend.vercel.app/api/fro/target \\',
            '  -H "Authorization: Bearer <token>"',
          ]),

          h2('ACCOUNTS'),
          ...codeBlock([
            '# List Leads for Verification',
            'curl -X GET "https://ucs-crm-backend.vercel.app/api/accounts/leads?status=pending" \\',
            '  -H "Authorization: Bearer <token>"',
            '',
            '# Verify Lead',
            'curl -X POST https://ucs-crm-backend.vercel.app/api/accounts/leads/456/verify \\',
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer <token>" \\',
            '  -d \'{"collected_amount":500,"receipt_date":"2026-07-13","payment_mode":"UPI"}\'',
            '',
            '# Generate Receipt',
            'curl -X POST https://ucs-crm-backend.vercel.app/api/accounts/leads/456/receipt \\',
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer <token>" \\',
            '  -d \'{"ngo_id":1,"donor_name":"John","amount":500,"pan":"ABCDE1234F"}\'',
          ]),

          h2('DASHBOARDS'),
          ...codeBlock([
            '# Super Admin Dashboard',
            'curl -X GET "https://ucs-crm-backend.vercel.app/api/dashboard/super-admin?period=30d" \\',
            '  -H "Authorization: Bearer <token>"',
            '',
            '# Super Admin Alerts',
            'curl -X GET https://ucs-crm-backend.vercel.app/api/dashboard/super-admin-alerts \\',
            '  -H "Authorization: Bearer <token>"',
            '',
            '# FRO Live Status',
            'curl -X GET https://ucs-crm-backend.vercel.app/api/dashboard/fro-live \\',
            '  -H "Authorization: Bearer <token>"',
          ]),

          h2('WHATSAPP'),
          ...codeBlock([
            '# List WhatsApp Accounts',
            'curl -X GET https://ucs-crm-backend.vercel.app/api/whatsapp/accounts \\',
            '  -H "Authorization: Bearer <token>"',
            '',
            '# Send Direct Message',
            'curl -X POST https://ucs-crm-backend.vercel.app/api/whatsapp/send-direct \\',
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer <token>" \\',
            '  -d \'{"to":"919876543210","message":"Thank you for your donation!"}\'',
          ]),

          h2('EVENT HEAD'),
          ...codeBlock([
            '# Create Event',
            'curl -X POST https://ucs-crm-backend.vercel.app/api/event-head/events \\',
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer <token>" \\',
            '  -d \'{"title":"Food Drive","description":"Monthly food distribution",\\',
            '    "category":"Food Distribution","start_date":"2026-07-20",\\',
            '    "end_date":"2026-07-20","location":"Mumbai","ngo_id":1,"budget":10000}\'',
            '',
            '# Create Asset',
            'curl -X POST https://ucs-crm-backend.vercel.app/api/event-head/assets \\',
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer <token>" \\',
            '  -d \'{"name":"Speakers","type":"Sound System","quantity":2,"condition":"Good"}\'',
          ]),

          h2('BANK AUDIT'),
          ...codeBlock([
            '# List Sources',
            'curl -X GET https://ucs-crm-backend.vercel.app/api/accounts/bank-audit/sources \\',
            '  -H "Authorization: Bearer <token>"',
            '',
            '# List Entries',
            'curl -X GET https://ucs-crm-backend.vercel.app/api/accounts/bank-audit/entries \\',
            '  -H "Authorization: Bearer <token>"',
            '',
            '# Add Entry',
            'curl -X POST https://ucs-crm-backend.vercel.app/api/accounts/bank-audit/entries \\',
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer <token>" \\',
            '  -d \'{"source_id":1,"transaction_date":"2026-07-13",\\',
            '    "description":"UPI transfer","amount":500,"type":"credit"}\'',
          ]),

          h2('USERS & NGOS'),
          ...codeBlock([
            '# List Users',
            'curl -X GET https://ucs-crm-backend.vercel.app/api/users \\',
            '  -H "Authorization: Bearer <token>"',
            '',
            '# Create User',
            'curl -X POST https://ucs-crm-backend.vercel.app/api/users \\',
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer <token>" \\',
            '  -d \'{"name":"HR User","email":"hr@ngo.com","password":"secret","role":"hr","ngo_id":1}\'',
            '',
            '# List NGOs',
            'curl -X GET https://ucs-crm-backend.vercel.app/api/ngos \\',
            '  -H "Authorization: Bearer <token>"',
          ]),

          h2('ASSET REGISTER'),
          ...codeBlock([
            '# List Assets',
            'curl -X GET https://ucs-crm-backend.vercel.app/assets \\',
            '  -H "Authorization: Bearer <token>"',
            '',
            '# Create Asset',
            'curl -X POST https://ucs-crm-backend.vercel.app/assets \\',
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer <token>" \\',
            '  -d \'{"name":"Dell Laptop","category":"Electronics","brand":"Dell",\\',
            '    "model":"Latitude","department":"FRO","purchase_price":45000}\'',
          ]),

          emptyLine(),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
            border: {
              top: { style: BorderStyle.SINGLE, size: 6, color: C.border },
            },
            children: [
              new TextRun({ text: 'End of Master Documentation', size: 28, bold: true, color: C.primary, font: 'Calibri Light' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({ text: 'Generated: July 13, 2026  •  Total Source Files: 300+ across all directories', size: 20, color: C.gray, font: 'Calibri' }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = 'C:\\Users\\Administrator\\Desktop\\attendance\\UCS_CRM\\docs\\MASTER_DOCUMENTATION.docx';
  fs.writeFileSync(outPath, buffer);
  console.log(`✅ DOCX generated: ${outPath}`);
  console.log(`   Size: ${(buffer.length / 1024).toFixed(1)} KB`);
}

main().catch(console.error);
