const accountsData = {
  id: 'accounts',
  title: 'Accounts Panel',
  icon: 'Dollar',
  roles: ['accounts', 'admin'],description: 'Handles lead verification, receipt generation, bank reconciliation, payment gateway integration, WhatsApp communication, and day-end closing for the Accounts department.',
  databaseTables: [
    {
      name: 'fro_donor_logs',
      description: 'Core table storing all donor pledge logs submitted by FROs. Each log goes through verification (pending → verified/rejected) and may generate receipts.',
      columns: [
        { name: 'id', type: 'INT PK AUTO_INCREMENT' },
        { name: 'fro_id', type: 'INT FK → users.id' },
        { name: 'donor_name', type: 'VARCHAR(255)' },
        { name: 'donor_phone', type: 'VARCHAR(20)' },
        { name: 'amount', type: 'DECIMAL(12,2)' },
        { name: 'pledge_date', type: 'DATE' },
        { name: 'status', type: "ENUM('pending','verified','rejected')" },
        { name: 'verified_by', type: 'INT FK → users.id' },
        { name: 'verified_at', type: 'DATETIME' },
        { name: 'rejection_reason', type: 'TEXT' },
        { name: 'receipt_generated', type: "ENUM('no','yes') DEFAULT 'no'" },
        { name: 'receipt_number', type: 'VARCHAR(50)' },
        { name: 'remarks', type: 'TEXT' },
        { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'DATETIME ON UPDATE CURRENT_TIMESTAMP' },
      ],
    },
    {
      name: 'bank_audit_sources',
      description: 'Configuration entries defining bank account sources for reconciliation (e.g., HDFC Current, SBI Savings).',
      columns: [
        { name: 'id', type: 'INT PK AUTO_INCREMENT' },
        { name: 'account_name', type: 'VARCHAR(255)' },
        { name: 'account_number', type: 'VARCHAR(50)' },
        { name: 'bank_name', type: 'VARCHAR(255)' },
        { name: 'branch', type: 'VARCHAR(255)' },
        { name: 'ifsc_code', type: 'VARCHAR(20)' },
        { name: 'is_active', type: "TINYINT(1) DEFAULT '1'" },
        { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'DATETIME ON UPDATE CURRENT_TIMESTAMP' },
      ],
    },
    {
      name: 'bank_audit_entries',
      description: 'Individual bank transactions imported from statements, mapped to a source account. Each entry can be verified or flagged as unmatched.',
      columns: [
        { name: 'id', type: 'INT PK AUTO_INCREMENT' },
        { name: 'source_id', type: 'INT FK → bank_audit_sources.id' },
        { name: 'transaction_date', type: 'DATE' },
        { name: 'narration', type: 'VARCHAR(500)' },
        { name: 'debit', type: 'DECIMAL(12,2) DEFAULT 0' },
        { name: 'credit', type: 'DECIMAL(12,2) DEFAULT 0' },
        { name: 'balance', type: 'DECIMAL(12,2) DEFAULT 0' },
        { name: 'cheque_no', type: 'VARCHAR(50)' },
        { name: 'reference', type: 'VARCHAR(100)' },
        { name: 'is_verified', type: "TINYINT(1) DEFAULT '0'" },
        { name: 'verified_by', type: 'INT FK → users.id' },
        { name: 'verified_at', type: 'DATETIME' },
        { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'DATETIME ON UPDATE CURRENT_TIMESTAMP' },
      ],
    },
    {
      name: 'razorpay_accounts',
      description: 'Connected Razorpay merchant accounts for payment collection and reconciliation.',
      columns: [
        { name: 'id', type: 'INT PK AUTO_INCREMENT' },
        { name: 'merchant_name', type: 'VARCHAR(255)' },
        { name: 'key_id', type: 'VARCHAR(100)' },
        { name: 'key_secret', type: 'VARCHAR(255) ENCRYPTED' },
        { name: 'webhook_secret', type: 'VARCHAR(255) ENCRYPTED' },
        { name: 'is_active', type: "TINYINT(1) DEFAULT '1'" },
        { name: 'last_synced_at', type: 'DATETIME' },
        { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'DATETIME ON UPDATE CURRENT_TIMESTAMP' },
      ],
    },
    {
      name: 'whatsapp_accounts',
      description: 'WhatsApp Business API accounts used to send receipt messages and direct communications.',
      columns: [
        { name: 'id', type: 'INT PK AUTO_INCREMENT' },
        { name: 'phone_number_id', type: 'VARCHAR(100)' },
        { name: 'business_account_id', type: 'VARCHAR(100)' },
        { name: 'access_token', type: 'TEXT ENCRYPTED' },
        { name: 'provider', type: "ENUM('meta','gupshup','twilio') DEFAULT 'meta'" },
        { name: 'is_active', type: "TINYINT(1) DEFAULT '1'" },
        { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'DATETIME ON UPDATE CURRENT_TIMESTAMP' },
      ],
    },
    {
      name: 'email_import_accounts',
      description: 'Email accounts configured for importing payment receipts and statements via IMAP/POP3.',
      columns: [
        { name: 'id', type: 'INT PK AUTO_INCREMENT' },
        { name: 'email_address', type: 'VARCHAR(255)' },
        { name: 'imap_host', type: 'VARCHAR(255)' },
        { name: 'imap_port', type: 'INT DEFAULT 993' },
        { name: 'username', type: 'VARCHAR(255)' },
        { name: 'password', type: 'TEXT ENCRYPTED' },
        { name: 'use_ssl', type: "TINYINT(1) DEFAULT '1'" },
        { name: 'last_fetched_at', type: 'DATETIME' },
        { name: 'is_active', type: "TINYINT(1) DEFAULT '1'" },
        { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'DATETIME ON UPDATE CURRENT_TIMESTAMP' },
      ],
    },
  ],
  coreWorkflow: [
    { step: 1, actor: 'Field Relations Officer (FRO)', action: 'Submits donor pledge log via FRO panel', api: 'POST /api/fro/logs' },
    { step: 2, actor: 'Accounts User', action: 'Views pending leads on Lead Verification Dashboard', api: 'GET /api/accounts/leads?status=pending' },
    { step: 3, actor: 'Accounts User', action: 'Verifies donor details, marks log as verified', api: 'POST /api/accounts/leads/:logId/verify' },
    { step: 4, actor: 'Accounts User', action: 'Optionally patches lead field before verification', api: 'PATCH /api/accounts/leads/:logId/field' },
    { step: 5, actor: 'Accounts User', action: 'Generates official receipt for the verified lead', api: 'POST /api/accounts/leads/:logId/receipt' },
    { step: 6, actor: 'System / Accounts User', action: 'Sends receipt via WhatsApp to donor', api: 'POST /api/whatsapp/send-receipt/:logId' },
    { step: 7, actor: 'Accounts User', action: 'Runs day-end report to reconcile daily collections', api: 'GET /api/accounts/day-end-report' },
    { step: 8, actor: 'Accounts Manager', action: 'Performs bank audit by importing statements and reconciling entries', api: 'POST /api/accounts/bank-statement/import' },
  ],
  "keyFeatures": [
    "Lead verification: pending / verified / rejected",
    "Receipt generation with 3 NGO-specific 80G templates",
    "Bulk PDF download via JSZip and WhatsApp sending",
    "Bank statement CSV/XLSX import with auto bank detection",
    "Razorpay multi-account management and auto-sync",
    "Email import from IMAP with Groq AI extraction",
    "Day-end reconciliation with suspense handling"
  ],
  screens: [
    {
      name: 'Lead Verification Dashboard',
      path: '/accounts/leads',
      description: 'Displays all FRO-submitted donor logs with filtering by status (pending, verified, rejected). Allows accounts users to verify, reject, patch fields, and generate receipts.',
      features: [
        {
          name: 'List Leads with Filters',
          description: 'Fetch donor logs with optional status filter and pagination for the Accounts dashboard.',
          apis: [
            {
              method: 'GET',
              path: '/api/accounts/leads?status=pending&page=1&limit=20',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X GET "https://api.ucs.org/api/accounts/leads?status=pending&page=1&limit=20" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Accept: application/json"`,
              requestBody: null,
              responseBody: {
                success: true,
                data: [
                  {
                    id: 101,
                    fro_id: 12,
                    fro_name: 'Rajesh Sharma',
                    donor_name: 'Amit Verma',
                    donor_phone: '+91-9876543210',
                    amount: 25000.00,
                    pledge_date: '2026-07-12',
                    status: 'pending',
                    receipt_generated: 'no',
                    created_at: '2026-07-12T10:30:00.000Z',
                  },
                  {
                    id: 102,
                    fro_id: 15,
                    fro_name: 'Sunita Patil',
                    donor_name: 'Priya Mehta',
                    donor_phone: '+91-8765432109',
                    amount: 11000.00,
                    pledge_date: '2026-07-12',
                    status: 'pending',
                    receipt_generated: 'no',
                    created_at: '2026-07-12T11:15:00.000Z',
                  },
                ],
                pagination: {
                  page: 1,
                  limit: 20,
                  total: 2,
                  totalPages: 1,
                },
              },
            },
          ],
          businessRules: [
            'Only FRO-submitted logs with status "pending" are shown by default',
            'Accounts users cannot see logs from other departments',
            'Filters: status (pending, verified, rejected), date range, FRO name, donor name',
            'Results are paginated with default 20 records per page',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Opens Lead Verification Dashboard', api: 'N/A (UI Navigation)' },
            { actor: 'System', action: 'Fetches pending leads from fro_donor_logs', api: 'GET /api/accounts/leads?status=pending' },
            { actor: 'Accounts User', action: 'Reviews list of pending donor pledges', api: 'N/A' },
          ],
        },
        {
          name: 'Verify Lead',
          description: 'Mark a donor log as verified after confirming donor details and pledge amount.',
          apis: [
            {
              method: 'POST',
              path: '/api/accounts/leads/:logId/verify',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/accounts/leads/101/verify" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "verified_by": 25,
    "remarks": "Donor confirmed pledge of ₹25,000 via cash. All details verified."
  }'`,
              requestBody: {
                verified_by: 25,
                remarks: 'Donor confirmed pledge of ₹25,000 via cash. All details verified.',
              },
              responseBody: {
                success: true,
                message: 'Lead verified successfully',
                data: {
                  id: 101,
                  status: 'verified',
                  verified_by: 25,
                  verified_at: '2026-07-13T09:30:00.000Z',
                  remarks: 'Donor confirmed pledge of ₹25,000 via cash. All details verified.',
                },
              },
            },
          ],
          businessRules: [
            'Only pending leads can be verified',
            'Verified leads cannot be re-verified or rejected',
            'The verifying user must have accounts or admin role',
            'The verified_at timestamp is auto-set on the server',
            'Remarks field is optional but recommended',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Selects a pending lead and clicks Verify', api: 'N/A' },
            { actor: 'Accounts User', action: 'Optionally enters remarks', api: 'N/A' },
            { actor: 'System', action: 'Updates fro_donor_logs.status to "verified"', api: 'POST /api/accounts/leads/:logId/verify' },
            { actor: 'System', action: 'Sets verified_by, verified_at, and audit trail', api: 'N/A' },
          ],
        },
        {
          name: 'Reject Lead',
          description: 'Reject a donor log with a reason when the pledge is invalid or cannot be processed.',
          apis: [
            {
              method: 'POST',
              path: '/api/accounts/leads/:logId/reject',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/accounts/leads/101/reject" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "rejection_reason": "Donor phone number unreachable after 3 attempts. Cannot verify identity.",
    "rejected_by": 25
  }'`,
              requestBody: {
                rejection_reason: 'Donor phone number unreachable after 3 attempts. Cannot verify identity.',
                rejected_by: 25,
              },
              responseBody: {
                success: true,
                message: 'Lead rejected',
                data: {
                  id: 101,
                  status: 'rejected',
                  rejection_reason: 'Donor phone number unreachable after 3 attempts. Cannot verify identity.',
                  rejected_by: 25,
                  rejected_at: '2026-07-13T10:00:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Only pending leads can be rejected',
            'Rejection reason is mandatory (min 10 characters)',
            'Rejected leads are visible in filtered view for audit',
            'FRO is notified about rejection via in-app notification',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Selects a lead and clicks Reject', api: 'N/A' },
            { actor: 'Accounts User', action: 'Provides rejection reason in the dialog', api: 'N/A' },
            { actor: 'System', action: 'Updates fro_donor_logs.status to "rejected"', api: 'POST /api/accounts/leads/:logId/reject' },
            { actor: 'System', action: 'Sends notification to the FRO who submitted the log', api: 'POST /api/notifications' },
          ],
        },
        {
          name: 'Patch Lead Field',
          description: 'Update specific fields of a donor log (e.g., amount, donor name, phone) before verification.',
          apis: [
            {
              method: 'PATCH',
              path: '/api/accounts/leads/:logId/field',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X PATCH "https://api.ucs.org/api/accounts/leads/101/field" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "field": "amount",
    "value": 26000.00,
    "reason": "Donor increased pledge from ₹25,000 to ₹26,000 during confirmation call"
  }'`,
              requestBody: {
                field: 'amount',
                value: 26000.00,
                reason: 'Donor increased pledge from ₹25,000 to ₹26,000 during confirmation call',
              },
              responseBody: {
                success: true,
                message: 'Field updated successfully',
                data: {
                  id: 101,
                  field: 'amount',
                  old_value: '25000.00',
                  new_value: '26000.00',
                  reason: 'Donor increased pledge from ₹25,000 to ₹26,000 during confirmation call',
                  updated_by: 25,
                  updated_at: '2026-07-13T09:15:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Only pending leads can have fields patched',
            'Allowed fields: donor_name, donor_phone, amount, pledge_date, remarks',
            'A reason must be provided for the change (audit trail)',
            'Original value is preserved in the audit log',
            'Patching does not change the status of the lead',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Clicks edit icon next to a field on a pending lead', api: 'N/A' },
            { actor: 'Accounts User', action: 'Enters new value and reason for change', api: 'N/A' },
            { actor: 'System', action: 'Validates field name, updates fro_donor_logs', api: 'PATCH /api/accounts/leads/:logId/field' },
            { actor: 'System', action: 'Logs the change in audit trail with old/new values', api: 'N/A' },
          ],
        },
        {
          name: 'Generate Receipt',
          description: 'Generate an official receipt PDF for a verified lead, assigning a unique receipt number.',
          apis: [
            {
              method: 'POST',
              path: '/api/accounts/leads/:logId/receipt',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/accounts/leads/101/receipt" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "generated_by": 25,
    "receipt_date": "2026-07-13",
    "payment_mode": "cash",
    "remarks": "Receipt generated after successful verification"
  }'`,
              requestBody: {
                generated_by: 25,
                receipt_date: '2026-07-13',
                payment_mode: 'cash',
                remarks: 'Receipt generated after successful verification',
              },
              responseBody: {
                success: true,
                message: 'Receipt generated successfully',
                data: {
                  receipt_id: 501,
                  receipt_number: 'RCP-2026-07-00101',
                  donor_name: 'Amit Verma',
                  amount: 26000.00,
                  payment_mode: 'cash',
                  receipt_date: '2026-07-13',
                  pdf_url: 'https://storage.ucs.org/receipts/2026/07/RCP-2026-07-00101.pdf',
                  generated_by: 25,
                  generated_at: '2026-07-13T11:00:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Only verified leads can generate a receipt',
            'Each lead generates exactly one receipt (receipt_generated flag prevents duplicates)',
            'Receipt number is auto-generated in format RCP-YYYY-MM-NNNNNN',
            'Receipt PDF is stored on cloud storage and URL is returned',
            'Setting receipt_generated = "yes" on fro_donor_logs is transactional with receipt creation',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Selects a verified lead and clicks Generate Receipt', api: 'N/A' },
            { actor: 'Accounts User', action: 'Optionally selects payment mode and enters remarks', api: 'N/A' },
            { actor: 'System', action: 'Creates receipt record, generates PDF, uploads to storage', api: 'POST /api/accounts/leads/:logId/receipt' },
            { actor: 'System', action: 'Updates fro_donor_logs.receipt_generated = "yes"', api: 'N/A' },
          ],
        },
        {
          name: 'Get Receipt',
          description: 'Retrieve the receipt details and PDF URL for a specific lead.',
          apis: [
            {
              method: 'GET',
              path: '/api/accounts/leads/:logId/receipt',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X GET "https://api.ucs.org/api/accounts/leads/101/receipt" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Accept: application/json"`,
              requestBody: null,
              responseBody: {
                success: true,
                data: {
                  receipt_id: 501,
                  receipt_number: 'RCP-2026-07-00101',
                  log_id: 101,
                  donor_name: 'Amit Verma',
                  donor_phone: '+91-9876543210',
                  amount: 26000.00,
                  payment_mode: 'cash',
                  receipt_date: '2026-07-13',
                  pdf_url: 'https://storage.ucs.org/receipts/2026/07/RCP-2026-07-00101.pdf',
                  generated_by: 25,
                  generated_at: '2026-07-13T11:00:00.000Z',
                  fro_name: 'Rajesh Sharma',
                },
              },
            },
          ],
          businessRules: [
            'Returns 404 if no receipt exists for the given log ID',
            'Receipt PDF URL is a pre-signed URL valid for 1 hour',
            'Only the lead\'s assigned FRO and accounts users can view the receipt',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Navigates to a verified lead detail view', api: 'N/A' },
            { actor: 'System', action: 'Fetches receipt by log ID from receipts table', api: 'GET /api/accounts/leads/:logId/receipt' },
            { actor: 'Accounts User', action: 'Views receipt details or downloads PDF', api: 'N/A' },
          ],
        },
      ],
    },
    {
      name: 'Receipts Management',
      path: '/accounts/receipts',
      description: 'Centralized view of all generated receipts with filtering, pending send actions, and mark-as-sent functionality.',
      features: [
        {
          name: 'List All Receipts',
          description: 'Fetch paginated list of all generated receipts across all leads.',
          apis: [
            {
              method: 'GET',
              path: '/api/accounts/receipts?page=1&limit=50&from=2026-07-01&to=2026-07-13',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X GET "https://api.ucs.org/api/accounts/receipts?page=1&limit=50&from=2026-07-01&to=2026-07-13" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Accept: application/json"`,
              requestBody: null,
              responseBody: {
                success: true,
                data: [
                  {
                    receipt_id: 501,
                    receipt_number: 'RCP-2026-07-00101',
                    donor_name: 'Amit Verma',
                    amount: 26000.00,
                    payment_mode: 'cash',
                    receipt_date: '2026-07-13',
                    whatsapp_sent: false,
                    generated_by_name: 'Priya Singh',
                    generated_at: '2026-07-13T11:00:00.000Z',
                  },
                  {
                    receipt_id: 500,
                    receipt_number: 'RCP-2026-07-00100',
                    donor_name: 'Sneha Kapoor',
                    amount: 15000.00,
                    payment_mode: 'online',
                    receipt_date: '2026-07-12',
                    whatsapp_sent: true,
                    generated_by_name: 'Priya Singh',
                    generated_at: '2026-07-12T16:30:00.000Z',
                  },
                ],
                pagination: {
                  page: 1,
                  limit: 50,
                  total: 2,
                  totalPages: 1,
                },
              },
            },
          ],
          businessRules: [
            'Filterable by date range, payment mode, FRO, and sent status',
            'Results ordered by receipt date descending',
            'whatsapp_sent flag indicates if receipt was sent via WhatsApp',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Opens Receipts Management page', api: 'N/A' },
            { actor: 'System', action: 'Fetches all receipts with filters', api: 'GET /api/accounts/receipts' },
            { actor: 'Accounts User', action: 'Reviews receipts and identifies unsent ones', api: 'N/A' },
          ],
        },
        {
          name: 'Pending Receipts (Not Sent)',
          description: 'Fetch only receipts that have not been sent via WhatsApp, for bulk action.',
          apis: [
            {
              method: 'GET',
              path: '/api/accounts/receipts/pending',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X GET "https://api.ucs.org/api/accounts/receipts/pending" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Accept: application/json"`,
              requestBody: null,
              responseBody: {
                success: true,
                data: [
                  {
                    receipt_id: 501,
                    receipt_number: 'RCP-2026-07-00101',
                    donor_name: 'Amit Verma',
                    donor_phone: '+91-9876543210',
                    amount: 26000.00,
                    receipt_date: '2026-07-13',
                    pdf_url: 'https://storage.ucs.org/receipts/2026/07/RCP-2026-07-00101.pdf',
                  },
                ],
                total_pending: 1,
              },
            },
          ],
          businessRules: [
            'Only receipts where whatsapp_sent = false are returned',
            'Includes donor phone number for WhatsApp dispatch',
            'PDF URL is included for attachment in WhatsApp message',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Clicks "Pending Sends" tab', api: 'N/A' },
            { actor: 'System', action: 'Returns receipts pending WhatsApp delivery', api: 'GET /api/accounts/receipts/pending' },
            { actor: 'Accounts User', action: 'Selects receipts and sends via WhatsApp', api: 'POST /api/whatsapp/send-receipt/:logId' },
          ],
        },
        {
          name: 'Mark Receipt as Sent',
          description: 'Manually mark one or more receipts as sent when delivery is confirmed outside the system.',
          apis: [
            {
              method: 'POST',
              path: '/api/accounts/receipts/mark-sent',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/accounts/receipts/mark-sent" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "receipt_ids": [501, 502, 503],
    "marked_by": 25,
    "delivery_channel": "whatsapp",
    "notes": "Receipts shared manually via WhatsApp broadcast"
  }'`,
              requestBody: {
                receipt_ids: [501, 502, 503],
                marked_by: 25,
                delivery_channel: 'whatsapp',
                notes: 'Receipts shared manually via WhatsApp broadcast',
              },
              responseBody: {
                success: true,
                message: '3 receipt(s) marked as sent',
                data: {
                  updated_count: 3,
                  receipt_ids: [501, 502, 503],
                  delivery_channel: 'whatsapp',
                  marked_at: '2026-07-13T12:00:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Receipts must exist and not already be marked as sent',
            'Bulk operation supports up to 50 receipt IDs per request',
            'Delivery channel must be one of: whatsapp, email, manual',
            'Audit log records who marked and when',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Selects pending receipts from the list', api: 'N/A' },
            { actor: 'Accounts User', action: 'Clicks "Mark as Sent" and confirms', api: 'N/A' },
            { actor: 'System', action: 'Updates whatsapp_sent flag for each receipt', api: 'POST /api/accounts/receipts/mark-sent' },
            { actor: 'System', action: 'Logs the action in audit trail', api: 'N/A' },
          ],
        },
      ],
    },
    {
      name: 'Day End Report',
      path: '/accounts/day-end-report',
      description: 'Generate and view the daily closing report summarizing all verifications, receipts generated, and amounts processed.',
      features: [
        {
          name: 'Get Day End Report',
          description: 'Fetch the day-end summary for a specific date, including totals for verified leads, receipts, and payment modes.',
          apis: [
            {
              method: 'GET',
              path: '/api/accounts/day-end-report?date=2026-07-13',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X GET "https://api.ucs.org/api/accounts/day-end-report?date=2026-07-13" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Accept: application/json"`,
              requestBody: null,
              responseBody: {
                success: true,
                data: {
                  report_date: '2026-07-13',
                  generated_at: '2026-07-13T23:59:00.000Z',
                  generated_by: 25,
                  totals: {
                    total_leads_processed: 18,
                    total_verified: 15,
                    total_rejected: 3,
                    total_receipts_generated: 15,
                    total_amount_verified: 425000.00,
                    total_amount_receipted: 425000.00,
                  },
                  payment_mode_breakdown: {
                    cash: { count: 8, amount: 210000.00 },
                    online: { count: 5, amount: 165000.00 },
                    cheque: { count: 2, amount: 50000.00 },
                  },
                  fro_wise_breakdown: [
                    { fro_name: 'Rajesh Sharma', verified: 6, rejected: 1, amount: 180000.00 },
                    { fro_name: 'Sunita Patil', verified: 5, rejected: 1, amount: 145000.00 },
                    { fro_name: 'Amit Joshi', verified: 4, rejected: 1, amount: 100000.00 },
                  ],
                  receipts_generated: [
                    { receipt_number: 'RCP-2026-07-00101', donor: 'Amit Verma', amount: 26000.00 },
                    { receipt_number: 'RCP-2026-07-00102', donor: 'Meera Nair', amount: 50000.00 },
                  ],
                },
              },
            },
          ],
          businessRules: [
            'Report can only be generated for past dates (not future)',
            'Data is aggregated by the date of verification (not pledge date)',
            'Report is read-only; once generated it can be viewed again',
            'Access restricted to Accounts and Admin roles',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Navigates to Day End Report section', api: 'N/A' },
            { actor: 'Accounts User', action: 'Selects a date and clicks Generate', api: 'N/A' },
            { actor: 'System', action: 'Aggregates data from fro_donor_logs and receipts tables', api: 'GET /api/accounts/day-end-report' },
            { actor: 'Accounts User', action: 'Reviews report and optionally exports as PDF', api: 'N/A' },
          ],
        },
      ],
    },
    {
      name: 'Suspense Management',
      path: '/accounts/suspense',
      description: 'Manage suspense entries for transactions that cannot be immediately matched to a donor or pledge.',
      features: [
        {
          name: 'List Suspense Entries',
          description: 'Fetch all suspense entries with filtering by status, date range, and assigned user.',
          apis: [
            {
              method: 'GET',
              path: '/api/accounts/suspense?status=open&page=1&limit=20',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X GET "https://api.ucs.org/api/accounts/suspense?status=open&page=1&limit=20" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Accept: application/json"`,
              requestBody: null,
              responseBody: {
                success: true,
                data: [
                  {
                    id: 201,
                    transaction_date: '2026-07-10',
                    donor_name: 'Unknown',
                    amount: 12000.00,
                    source: 'bank_import',
                    reference: 'HDFC-20260710-1234',
                    status: 'open',
                    assigned_to: null,
                    notes_count: 2,
                    created_at: '2026-07-10T14:30:00.000Z',
                  },
                  {
                    id: 200,
                    transaction_date: '2026-07-09',
                    donor_name: 'Unknown',
                    amount: 5000.00,
                    source: 'cheque_deposit',
                    reference: 'CHQ-567812',
                    status: 'assigned',
                    assigned_to: {
                      id: 30,
                      name: 'Vikram Desai',
                    },
                    notes_count: 1,
                    created_at: '2026-07-09T10:00:00.000Z',
                  },
                ],
                pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
              },
            },
          ],
          businessRules: [
            'Status values: open, assigned, resolved, closed',
            'Source indicates where the entry originated (bank_import, cheque_deposit, manual)',
            'Only open and assigned entries are actionable',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Opens Suspense Management page', api: 'N/A' },
            { actor: 'System', action: 'Fetches open suspense entries', api: 'GET /api/accounts/suspense' },
            { actor: 'Accounts User', action: 'Reviews unmatched transactions', api: 'N/A' },
          ],
        },
        {
          name: 'Create Suspense Entry',
          description: 'Manually create a suspense entry for a transaction that cannot be immediately matched.',
          apis: [
            {
              method: 'POST',
              path: '/api/accounts/suspense',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/accounts/suspense" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "donor_name": "Unknown",
    "donor_phone": null,
    "amount": 8500.00,
    "transaction_date": "2026-07-13",
    "source": "manual",
    "reference": "NEFT-UTIB00078912",
    "remarks": "NEFT credit from unknown sender. Awaiting donor identification."
  }'`,
              requestBody: {
                donor_name: 'Unknown',
                donor_phone: null,
                amount: 8500.00,
                transaction_date: '2026-07-13',
                source: 'manual',
                reference: 'NEFT-UTIB00078912',
                remarks: 'NEFT credit from unknown sender. Awaiting donor identification.',
              },
              responseBody: {
                success: true,
                message: 'Suspense entry created',
                data: {
                  id: 202,
                  donor_name: 'Unknown',
                  amount: 8500.00,
                  transaction_date: '2026-07-13',
                  source: 'manual',
                  reference: 'NEFT-UTIB00078912',
                  status: 'open',
                  created_by: 25,
                  created_at: '2026-07-13T15:00:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Amount must be greater than 0',
            'Donor name can be "Unknown" if not identified',
            'Source must be one of: bank_import, cheque_deposit, manual, online',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Clicks "Add Suspense Entry" button', api: 'N/A' },
            { actor: 'Accounts User', action: 'Fills in transaction details', api: 'N/A' },
            { actor: 'System', action: 'Creates suspense entry with status "open"', api: 'POST /api/accounts/suspense' },
          ],
        },
        {
          name: 'Add Suspense Note',
          description: 'Add a note to a suspense entry for collaboration and tracking resolution progress.',
          apis: [
            {
              method: 'POST',
              path: '/api/accounts/suspense/:id/note',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/accounts/suspense/201/note" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "Checked with HDFC bank. The transaction is from a UPI payment. Attempting to match with donor phone number.",
    "added_by": 25
  }'`,
              requestBody: {
                content: 'Checked with HDFC bank. The transaction is from a UPI payment. Attempting to match with donor phone number.',
                added_by: 25,
              },
              responseBody: {
                success: true,
                message: 'Note added to suspense entry',
                data: {
                  note_id: 51,
                  suspense_id: 201,
                  content: 'Checked with HDFC bank. The transaction is from a UPI payment. Attempting to match with donor phone number.',
                  added_by: 25,
                  added_at: '2026-07-13T15:30:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Content is mandatory and must be at least 10 characters',
            'Notes are immutable (cannot be edited or deleted after creation)',
            'All notes are visible to anyone with access to the suspense entry',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Opens a suspense entry detail view', api: 'N/A' },
            { actor: 'Accounts User', action: 'Types a note and clicks Add', api: 'N/A' },
            { actor: 'System', action: 'Appends note to the suspense entry thread', api: 'POST /api/accounts/suspense/:id/note' },
          ],
        },
        {
          name: 'Assign Suspense Entry',
          description: 'Assign a suspense entry to a specific user for investigation and resolution.',
          apis: [
            {
              method: 'POST',
              path: '/api/accounts/suspense/:id/assign',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/accounts/suspense/201/assign" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "assigned_to": 30,
    "assigned_by": 25,
    "notes": "Assigning to Vikram for donor identification and resolution."
  }'`,
              requestBody: {
                assigned_to: 30,
                assigned_by: 25,
                notes: 'Assigning to Vikram for donor identification and resolution.',
              },
              responseBody: {
                success: true,
                message: 'Suspense entry assigned',
                data: {
                  id: 201,
                  assigned_to: {
                    id: 30,
                    name: 'Vikram Desai',
                    email: 'vikram.desai@ucs.org',
                  },
                  assigned_by: 25,
                  assigned_at: '2026-07-13T16:00:00.000Z',
                  status: 'assigned',
                },
              },
            },
          ],
          businessRules: [
            'Cannot assign to a user who is not in accounts or admin role',
            'Assignment changes status from "open" to "assigned"',
            'System sends notification to the assigned user',
          ],
          workflow: [
            { actor: 'Accounts Supervisor', action: 'Selects a user from the assignee dropdown', api: 'N/A' },
            { actor: 'Accounts Supervisor', action: 'Confirms assignment with optional notes', api: 'N/A' },
            { actor: 'System', action: 'Updates suspense entry with assignee and status', api: 'POST /api/accounts/suspense/:id/assign' },
            { actor: 'System', action: 'Sends notification to the assigned user', api: 'POST /api/notifications' },
          ],
        },
      ],
    },
    {
      name: 'Donor History',
      path: '/accounts/donor-history',
      description: 'View complete history of a donor including all pledges, verifications, receipts, and communications.',
      features: [
        {
          name: 'Get Donor History',
          description: 'Fetch the full history for a specific donor across all modules.',
          apis: [
            {
              method: 'GET',
              path: '/api/accounts/donor/:donorId/history',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X GET "https://api.ucs.org/api/accounts/donor/501/history" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Accept: application/json"`,
              requestBody: null,
              responseBody: {
                success: true,
                data: {
                  donor: {
                    id: 501,
                    name: 'Amit Verma',
                    phone: '+91-9876543210',
                    email: 'amit.verma@example.com',
                    total_pledged: 51000.00,
                    total_receipted: 51000.00,
                    last_pledge_date: '2026-07-13',
                  },
                  logs: [
                    {
                      log_id: 101,
                      amount: 26000.00,
                      pledge_date: '2026-07-12',
                      status: 'verified',
                      fro_name: 'Rajesh Sharma',
                      verified_at: '2026-07-13T09:30:00.000Z',
                      receipt_number: 'RCP-2026-07-00101',
                      receipt_sent: true,
                    },
                    {
                      log_id: 89,
                      amount: 25000.00,
                      pledge_date: '2026-06-15',
                      status: 'verified',
                      fro_name: 'Rajesh Sharma',
                      verified_at: '2026-06-16T10:00:00.000Z',
                      receipt_number: 'RCP-2026-06-00089',
                      receipt_sent: true,
                    },
                  ],
                  communications: [
                    {
                      type: 'whatsapp',
                      sent_at: '2026-07-13T11:30:00.000Z',
                      message: 'Receipt RCP-2026-07-00101 for ₹26,000 sent via WhatsApp',
                      status: 'delivered',
                    },
                  ],
                },
              },
            },
          ],
          businessRules: [
            'Donor ID corresponds to the donor record in the CRM',
            'Returns all logs regardless of status (including rejected)',
            'Communications include WhatsApp and email history',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Searches for a donor by name or phone', api: 'N/A' },
            { actor: 'Accounts User', action: 'Clicks on donor to view full history', api: 'N/A' },
            { actor: 'System', action: 'Aggregates data from logs, receipts, and communications', api: 'GET /api/accounts/donor/:donorId/history' },
          ],
        },
      ],
    },
    {
      name: 'Bank Audit',
      path: '/accounts/bank-audit',
      description: 'Bank reconciliation module with configurable bank sources and transaction entries for matching and verification.',
      features: [
        {
          name: 'List Bank Audit Sources',
          description: 'Fetch all configured bank accounts used as sources for reconciliation.',
          apis: [
            {
              method: 'GET',
              path: '/api/accounts/bank-audit/sources',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X GET "https://api.ucs.org/api/accounts/bank-audit/sources" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Accept: application/json"`,
              requestBody: null,
              responseBody: {
                success: true,
                data: [
                  {
                    id: 1,
                    account_name: 'HDFC Current Account',
                    account_number: '50100123456789',
                    bank_name: 'HDFC Bank',
                    branch: 'MG Road, Bangalore',
                    ifsc_code: 'HDFC0001234',
                    is_active: true,
                    created_at: '2026-01-01T00:00:00.000Z',
                  },
                  {
                    id: 2,
                    account_name: 'SBI Savings Account',
                    account_number: '112233445566',
                    bank_name: 'State Bank of India',
                    branch: 'Connaught Place, Delhi',
                    ifsc_code: 'SBIN0005678',
                    is_active: true,
                    created_at: '2026-01-01T00:00:00.000Z',
                  },
                ],
              },
            },
          ],
          businessRules: [
            'At least one source must be active for bank statement import',
            'Account numbers are masked in non-admin views',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Navigates to Bank Audit section', api: 'N/A' },
            { actor: 'System', action: 'Loads list of bank sources', api: 'GET /api/accounts/bank-audit/sources' },
          ],
        },
        {
          name: 'Create Bank Audit Source',
          description: 'Add a new bank account source for reconciliation.',
          apis: [
            {
              method: 'POST',
              path: '/api/accounts/bank-audit/sources',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/accounts/bank-audit/sources" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "account_name": "ICICI Corporate Account",
    "account_number": "7890123456",
    "bank_name": "ICICI Bank",
    "branch": "Andheri East, Mumbai",
    "ifsc_code": "ICIC0009012",
    "is_active": true
  }'`,
              requestBody: {
                account_name: 'ICICI Corporate Account',
                account_number: '7890123456',
                bank_name: 'ICICI Bank',
                branch: 'Andheri East, Mumbai',
                ifsc_code: 'ICIC0009012',
                is_active: true,
              },
              responseBody: {
                success: true,
                message: 'Bank source created',
                data: {
                  id: 3,
                  account_name: 'ICICI Corporate Account',
                  account_number: '7890123456',
                  bank_name: 'ICICI Bank',
                  branch: 'Andheri East, Mumbai',
                  ifsc_code: 'ICIC0009012',
                  is_active: true,
                  created_at: '2026-07-13T10:00:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Account number must be unique across all sources',
            'IFSC code is validated against RBI database',
          ],
          workflow: [
            { actor: 'Accounts Manager', action: 'Clicks "Add Bank Source"', api: 'N/A' },
            { actor: 'Accounts Manager', action: 'Enters bank account details', api: 'N/A' },
            { actor: 'System', action: 'Creates new bank source', api: 'POST /api/accounts/bank-audit/sources' },
          ],
        },
        {
          name: 'Update Bank Audit Source',
          description: 'Update an existing bank account source configuration.',
          apis: [
            {
              method: 'PUT',
              path: '/api/accounts/bank-audit/sources/:id',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X PUT "https://api.ucs.org/api/accounts/bank-audit/sources/1" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "account_name": "HDFC Current Account - Main",
    "account_number": "50100123456789",
    "bank_name": "HDFC Bank",
    "branch": "MG Road, Bangalore",
    "ifsc_code": "HDFC0001234",
    "is_active": true
  }'`,
              requestBody: {
                account_name: 'HDFC Current Account - Main',
                account_number: '50100123456789',
                bank_name: 'HDFC Bank',
                branch: 'MG Road, Bangalore',
                ifsc_code: 'HDFC0001234',
                is_active: true,
              },
              responseBody: {
                success: true,
                message: 'Bank source updated',
                data: {
                  id: 1,
                  account_name: 'HDFC Current Account - Main',
                  account_number: '50100123456789',
                  bank_name: 'HDFC Bank',
                  branch: 'MG Road, Bangalore',
                  ifsc_code: 'HDFC0001234',
                  is_active: true,
                  updated_at: '2026-07-13T11:00:00.000Z',
                },
              },
            },
          ],
          businessRules: ['Cannot change account_number to one that already exists', 'Deactivating a source does not delete its entries'],
          workflow: [
            { actor: 'Accounts Manager', action: 'Edits a bank source', api: 'N/A' },
            { actor: 'System', action: 'Updates source record', api: 'PUT /api/accounts/bank-audit/sources/:id' },
          ],
        },
        {
          name: 'Delete Bank Audit Source',
          description: 'Soft-delete or deactivate a bank account source.',
          apis: [
            {
              method: 'DELETE',
              path: '/api/accounts/bank-audit/sources/:id',
              auth: 'Bearer Token (Admin only)',
              curl: `curl -X DELETE "https://api.ucs.org/api/accounts/bank-audit/sources/3" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzE4MjQwMDAwfQ.sample_admin_token"`,
              requestBody: null,
              responseBody: {
                success: true,
                message: 'Bank source deleted',
                data: { id: 3 },
              },
            },
          ],
          businessRules: [
            'Only admin role can delete a source',
            'Deletion is soft (is_active set to false) to preserve referential integrity',
            'Associated entries remain but are orphaned',
          ],
          workflow: [
            { actor: 'Admin', action: 'Deletes a bank source', api: 'N/A' },
            { actor: 'System', action: 'Soft-deletes the source', api: 'DELETE /api/accounts/bank-audit/sources/:id' },
          ],
        },
        {
          name: 'List Bank Audit Entries',
          description: 'Fetch bank transaction entries with filtering by source, date range, and verification status.',
          apis: [
            {
              method: 'GET',
              path: '/api/accounts/bank-audit/entries?source_id=1&from=2026-07-01&to=2026-07-13&is_verified=0',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X GET "https://api.ucs.org/api/accounts/bank-audit/entries?source_id=1&from=2026-07-01&to=2026-07-13&is_verified=0" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Accept: application/json"`,
              requestBody: null,
              responseBody: {
                success: true,
                data: [
                  {
                    id: 1001,
                    source_id: 1,
                    source_name: 'HDFC Current Account',
                    transaction_date: '2026-07-10',
                    narration: 'NEFT CR - AMIT VERMA',
                    debit: 0,
                    credit: 26000.00,
                    balance: 125000.00,
                    cheque_no: null,
                    reference: 'NEFT-HDFC-789012',
                    is_verified: false,
                    created_at: '2026-07-10T18:30:00.000Z',
                  },
                  {
                    id: 1002,
                    source_id: 1,
                    source_name: 'HDFC Current Account',
                    transaction_date: '2026-07-11',
                    narration: 'CHG DR - ACCOUNT MAINTENANCE',
                    debit: 500.00,
                    credit: 0,
                    balance: 124500.00,
                    cheque_no: null,
                    reference: 'CHG-12345',
                    is_verified: true,
                    verified_by: 25,
                    verified_at: '2026-07-12T09:00:00.000Z',
                    created_at: '2026-07-11T20:00:00.000Z',
                  },
                ],
                pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
              },
            },
          ],
          businessRules: [
            'Entries are imported from bank statement uploads',
            'Entries can be filtered by source, date range, and verification status',
            'Unverified entries are those not yet matched/reconciled',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Selects a bank source and date range', api: 'N/A' },
            { actor: 'System', action: 'Returns matching bank entries', api: 'GET /api/accounts/bank-audit/entries' },
            { actor: 'Accounts User', action: 'Reviews entries and marks as verified', api: 'N/A' },
          ],
        },
        {
          name: 'Create Bank Audit Entry',
          description: 'Manually add a bank transaction entry.',
          apis: [
            {
              method: 'POST',
              path: '/api/accounts/bank-audit/entries',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/accounts/bank-audit/entries" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source_id": 1,
    "transaction_date": "2026-07-13",
    "narration": "NEFT CR - PRIYA MEHTA",
    "credit": 15000.00,
    "debit": 0,
    "balance": 139500.00,
    "reference": "NEFT-HDFC-789456"
  }'`,
              requestBody: {
                source_id: 1,
                transaction_date: '2026-07-13',
                narration: 'NEFT CR - PRIYA MEHTA',
                credit: 15000.00,
                debit: 0,
                balance: 139500.00,
                reference: 'NEFT-HDFC-789456',
              },
              responseBody: {
                success: true,
                message: 'Entry created',
                data: {
                  id: 1003,
                  source_id: 1,
                  transaction_date: '2026-07-13',
                  narration: 'NEFT CR - PRIYA MEHTA',
                  credit: 15000.00,
                  debit: 0,
                  balance: 139500.00,
                  reference: 'NEFT-HDFC-789456',
                  is_verified: false,
                  created_at: '2026-07-13T14:00:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Either debit or credit must be > 0 (not both zero)',
            'Reference should be unique per source to prevent duplicates',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Clicks "Add Entry" on entries page', api: 'N/A' },
            { actor: 'Accounts User', action: 'Enters transaction details', api: 'N/A' },
            { actor: 'System', action: 'Creates entry with is_verified = false', api: 'POST /api/accounts/bank-audit/entries' },
          ],
        },
        {
          name: 'Update Bank Audit Entry',
          description: 'Update an existing bank transaction entry.',
          apis: [
            {
              method: 'PUT',
              path: '/api/accounts/bank-audit/entries/:id',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X PUT "https://api.ucs.org/api/accounts/bank-audit/entries/1001" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "narration": "NEFT CR - AMIT VERMA (PLEDGE)",
    "credit": 26000.00,
    "debit": 0,
    "balance": 125000.00,
    "reference": "NEFT-HDFC-789012"
  }'`,
              requestBody: {
                narration: 'NEFT CR - AMIT VERMA (PLEDGE)',
                credit: 26000.00,
                debit: 0,
                balance: 125000.00,
                reference: 'NEFT-HDFC-789012',
              },
              responseBody: {
                success: true,
                message: 'Entry updated',
                data: {
                  id: 1001,
                  source_id: 1,
                  transaction_date: '2026-07-10',
                  narration: 'NEFT CR - AMIT VERMA (PLEDGE)',
                  credit: 26000.00,
                  debit: 0,
                  balance: 125000.00,
                  reference: 'NEFT-HDFC-789012',
                  updated_at: '2026-07-13T14:30:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Cannot change source_id after creation',
            'Verification status resets to false on update if entry was verified',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Edits an existing entry', api: 'N/A' },
            { actor: 'System', action: 'Updates entry record', api: 'PUT /api/accounts/bank-audit/entries/:id' },
          ],
        },
        {
          name: 'Delete Bank Audit Entry',
          description: 'Delete a bank transaction entry.',
          apis: [
            {
              method: 'DELETE',
              path: '/api/accounts/bank-audit/entries/:id',
              auth: 'Bearer Token (Admin only)',
              curl: `curl -X DELETE "https://api.ucs.org/api/accounts/bank-audit/entries/1003" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzE4MjQwMDAwfQ.sample_admin_token"`,
              requestBody: null,
              responseBody: {
                success: true,
                message: 'Entry deleted',
                data: { id: 1003 },
              },
            },
          ],
          businessRules: [
            'Only admin role can delete entries',
            'Verified entries can be deleted only after unverifying first',
          ],
          workflow: [
            { actor: 'Admin', action: 'Deletes an entry', api: 'N/A' },
            { actor: 'System', action: 'Removes entry from database', api: 'DELETE /api/accounts/bank-audit/entries/:id' },
          ],
        },
        {
          name: 'Verify Bank Audit Entry',
          description: 'Mark a bank transaction entry as verified/reconciled.',
          apis: [
            {
              method: 'PUT',
              path: '/api/accounts/bank-audit/entries/:id/verify',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X PUT "https://api.ucs.org/api/accounts/bank-audit/entries/1001/verify" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "verified_by": 25,
    "matched_log_id": 101,
    "remarks": "Matched with verified lead #101 - Amit Verma ₹26,000"
  }'`,
              requestBody: {
                verified_by: 25,
                matched_log_id: 101,
                remarks: 'Matched with verified lead #101 - Amit Verma ₹26,000',
              },
              responseBody: {
                success: true,
                message: 'Entry verified',
                data: {
                  id: 1001,
                  is_verified: true,
                  verified_by: 25,
                  verified_at: '2026-07-13T15:00:00.000Z',
                  matched_log_id: 101,
                  remarks: 'Matched with verified lead #101 - Amit Verma ₹26,000',
                },
              },
            },
          ],
          businessRules: [
            'An entry can only be verified once (no duplicate verification)',
            'matched_log_id is optional but recommended for reconciliation',
            'Verification is reversible (admin can unverify)',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Selects an entry and clicks Verify', api: 'N/A' },
            { actor: 'Accounts User', action: 'Optionally matches to a donor log', api: 'N/A' },
            { actor: 'System', action: 'Marks entry as verified', api: 'PUT /api/accounts/bank-audit/entries/:id/verify' },
          ],
        },
      ],
    },
    {
      name: 'Bank Statement Management',
      path: '/accounts/bank-statement',
      description: 'Upload, preview, and import bank statements (CSV/Excel/PDF) for reconciliation.',
      features: [
        {
          name: 'Preview Bank Statement',
          description: 'Upload a bank statement file and preview parsed transactions before importing.',
          apis: [
            {
              method: 'POST',
              path: '/api/accounts/bank-statement/preview',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/accounts/bank-statement/preview" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@/path/to/hdfc_statement_jul2026.csv" \\
  -F "source_id=1"`,
              requestBody: {
                file: '(binary .csv/.xlsx/.pdf file)',
                source_id: 1,
              },
              responseBody: {
                success: true,
                data: {
                  file_name: 'hdfc_statement_jul2026.csv',
                  total_rows: 45,
                  parsed_entries: [
                    {
                      row: 1,
                      transaction_date: '2026-07-01',
                      narration: 'NEFT CR - AMIT VERMA',
                      debit: 0,
                      credit: 26000.00,
                      balance: 150000.00,
                      cheque_no: null,
                      reference: 'NEFT-HDFC-001',
                    },
                    {
                      row: 2,
                      transaction_date: '2026-07-01',
                      narration: 'CHG DR - SMS CHARGES',
                      debit: 50.00,
                      credit: 0,
                      balance: 149950.00,
                      cheque_no: null,
                      reference: 'CHG-SMS-JUL',
                    },
                  ],
                  duplicate_count: 0,
                  warning_count: 1,
                  warnings: ['Row 15: Date format ambiguous, assuming DD-MM-YYYY'],
                },
              },
            },
          ],
          businessRules: [
            'Supported formats: .csv, .xlsx, .xls, .pdf (PDF parsed via OCR)',
            'Duplicate detection is based on reference + amount + date',
            'Preview does not persist data; user must confirm import',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Selects a bank source and uploads a statement file', api: 'N/A' },
            { actor: 'System', action: 'Parses file and returns preview of entries', api: 'POST /api/accounts/bank-statement/preview' },
            { actor: 'Accounts User', action: 'Reviews parsed entries for accuracy', api: 'N/A' },
          ],
        },
        {
          name: 'Import Bank Statement',
          description: 'Confirm and import the previewed bank statement entries into the database.',
          apis: [
            {
              method: 'POST',
              path: '/api/accounts/bank-statement/import',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/accounts/bank-statement/import" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "source_id": 1,
    "entries": [
      {
        "transaction_date": "2026-07-01",
        "narration": "NEFT CR - AMIT VERMA",
        "credit": 26000.00,
        "debit": 0,
        "balance": 150000.00,
        "reference": "NEFT-HDFC-001"
      },
      {
        "transaction_date": "2026-07-01",
        "narration": "CHG DR - SMS CHARGES",
        "credit": 0,
        "debit": 50.00,
        "balance": 149950.00,
        "reference": "CHG-SMS-JUL"
      }
    ],
    "imported_by": 25
  }'`,
              requestBody: {
                source_id: 1,
                entries: [
                  {
                    transaction_date: '2026-07-01',
                    narration: 'NEFT CR - AMIT VERMA',
                    credit: 26000.00,
                    debit: 0,
                    balance: 150000.00,
                    reference: 'NEFT-HDFC-001',
                  },
                  {
                    transaction_date: '2026-07-01',
                    narration: 'CHG DR - SMS CHARGES',
                    credit: 0,
                    debit: 50.00,
                    balance: 149950.00,
                    reference: 'CHG-SMS-JUL',
                  },
                ],
                imported_by: 25,
              },
              responseBody: {
                success: true,
                message: '45 entries imported successfully',
                data: {
                  imported_count: 45,
                  duplicate_skipped: 0,
                  source_id: 1,
                  imported_by: 25,
                  imported_at: '2026-07-13T16:00:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'All entries in the import are created in a single transaction',
            'Duplicates (by reference + amount + date) are skipped automatically',
            'Each entry is created with is_verified = false by default',
            'Maximum 500 entries per import request',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Confirms preview and clicks Import', api: 'N/A' },
            { actor: 'System', action: 'Bulk inserts entries into bank_audit_entries', api: 'POST /api/accounts/bank-statement/import' },
            { actor: 'Accounts User', action: 'Proceeds to verify individual entries', api: 'N/A' },
          ],
        },
      ],
    },
    {
      name: 'WhatsApp Integration',
      path: '/whatsapp',
      description: 'Manage WhatsApp Business API accounts and send receipt messages to donors.',
      features: [
        {
          name: 'List WhatsApp Accounts',
          description: 'Fetch all configured WhatsApp Business API accounts.',
          apis: [
            {
              method: 'GET',
              path: '/api/whatsapp/accounts',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X GET "https://api.ucs.org/api/whatsapp/accounts" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Accept: application/json"`,
              requestBody: null,
              responseBody: {
                success: true,
                data: [
                  {
                    id: 1,
                    phone_number_id: '123456789012345',
                    business_account_id: '12345678901234567890',
                    provider: 'meta',
                    phone_number: '+91-9876543210',
                    is_active: true,
                    created_at: '2026-01-15T00:00:00.000Z',
                  },
                  {
                    id: 2,
                    phone_number_id: '234567890123456',
                    business_account_id: '23456789012345678901',
                    provider: 'gupshup',
                    phone_number: '+91-8765432109',
                    is_active: true,
                    created_at: '2026-03-01T00:00:00.000Z',
                  },
                ],
              },
            },
          ],
          businessRules: [
            'Only active accounts are used for sending messages',
            'Provider can be meta, gupshup, or twilio',
            'Access tokens are stored encrypted and never returned in API responses',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Opens WhatsApp Integration settings', api: 'N/A' },
            { actor: 'System', action: 'Fetches configured WhatsApp accounts', api: 'GET /api/whatsapp/accounts' },
          ],
        },
        {
          name: 'Create WhatsApp Account',
          description: 'Add a new WhatsApp Business API account configuration.',
          apis: [
            {
              method: 'POST',
              path: '/api/whatsapp/accounts',
              auth: 'Bearer Token (Admin only)',
              curl: `curl -X POST "https://api.ucs.org/api/whatsapp/accounts" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzE4MjQwMDAwfQ.sample_admin_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone_number_id": "345678901234567",
    "business_account_id": "34567890123456789012",
    "access_token": "EAAxExampleAccessToken1234567890abcdef",
    "provider": "meta",
    "is_active": true
  }'`,
              requestBody: {
                phone_number_id: '345678901234567',
                business_account_id: '34567890123456789012',
                access_token: 'EAAxExampleAccessToken1234567890abcdef',
                provider: 'meta',
                is_active: true,
              },
              responseBody: {
                success: true,
                message: 'WhatsApp account created',
                data: {
                  id: 3,
                  phone_number_id: '345678901234567',
                  business_account_id: '34567890123456789012',
                  provider: 'meta',
                  is_active: true,
                  created_at: '2026-07-13T12:00:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Access token is encrypted at rest using AES-256',
            'Provider validation is done by testing the API on creation',
            'Only admin role can create/modify WhatsApp accounts',
          ],
          workflow: [
            { actor: 'Admin', action: 'Clicks "Add WhatsApp Account"', api: 'N/A' },
            { actor: 'Admin', action: 'Enters WhatsApp Business API credentials', api: 'N/A' },
            { actor: 'System', action: 'Validates credentials and stores encrypted', api: 'POST /api/whatsapp/accounts' },
          ],
        },
        {
          name: 'Update WhatsApp Account',
          description: 'Update an existing WhatsApp account configuration.',
          apis: [
            {
              method: 'PUT',
              path: '/api/whatsapp/accounts/:id',
              auth: 'Bearer Token (Admin only)',
              curl: `curl -X PUT "https://api.ucs.org/api/whatsapp/accounts/1" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzE4MjQwMDAwfQ.sample_admin_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "access_token": "EAAxNewAccessToken9876543210abcdef",
    "is_active": false
  }'`,
              requestBody: {
                access_token: 'EAAxNewAccessToken9876543210abcdef',
                is_active: false,
              },
              responseBody: {
                success: true,
                message: 'WhatsApp account updated',
                data: {
                  id: 1,
                  phone_number_id: '123456789012345',
                  provider: 'meta',
                  is_active: false,
                  updated_at: '2026-07-13T12:30:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Partial updates allowed (only send changed fields)',
            'Deactivating an account prevents it from being used for sending',
          ],
          workflow: [
            { actor: 'Admin', action: 'Edits a WhatsApp account', api: 'N/A' },
            { actor: 'System', action: 'Updates the account configuration', api: 'PUT /api/whatsapp/accounts/:id' },
          ],
        },
        {
          name: 'Delete WhatsApp Account',
          description: 'Delete a WhatsApp account configuration.',
          apis: [
            {
              method: 'DELETE',
              path: '/api/whatsapp/accounts/:id',
              auth: 'Bearer Token (Admin only)',
              curl: `curl -X DELETE "https://api.ucs.org/api/whatsapp/accounts/3" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzE4MjQwMDAwfQ.sample_admin_token"`,
              requestBody: null,
              responseBody: {
                success: true,
                message: 'WhatsApp account deleted',
                data: { id: 3 },
              },
            },
          ],
          businessRules: [
            'Cannot delete an account if it has pending message queues',
            'Deletion is permanent (not soft)',
          ],
          workflow: [
            { actor: 'Admin', action: 'Deletes a WhatsApp account', api: 'N/A' },
            { actor: 'System', action: 'Permanently removes the account', api: 'DELETE /api/whatsapp/accounts/:id' },
          ],
        },
        {
          name: 'Send Receipt via WhatsApp',
          description: 'Send a pre-generated receipt PDF to the donor via WhatsApp using a configured WhatsApp account.',
          apis: [
            {
              method: 'POST',
              path: '/api/whatsapp/send-receipt/:logId',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/whatsapp/send-receipt/101" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "whatsapp_account_id": 1,
    "message_text": "Dear Amit Verma, thank you for your generous donation of ₹26,000. Please find your receipt attached. Regards, UCS Team",
    "sent_by": 25
  }'`,
              requestBody: {
                whatsapp_account_id: 1,
                message_text: 'Dear Amit Verma, thank you for your generous donation of ₹26,000. Please find your receipt attached. Regards, UCS Team',
                sent_by: 25,
              },
              responseBody: {
                success: true,
                message: 'Receipt sent via WhatsApp successfully',
                data: {
                  message_id: 'wamid.HBgLOTEyMzQ1Njc4OVUA',
                  recipient: '+91-9876543210',
                  receipt_number: 'RCP-2026-07-00101',
                  status: 'sent',
                  sent_at: '2026-07-13T11:30:00.000Z',
                  whatsapp_account_id: 1,
                },
              },
            },
          ],
          businessRules: [
            'Log must have a receipt generated before sending',
            'Donor phone number must be valid and have WhatsApp',
            'WhatsApp account must be active',
            'On success, receipt\'s whatsapp_sent flag is set to true',
            'Message delivery status is tracked via webhook callbacks',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Clicks "Send WhatsApp" on a verified lead with receipt', api: 'N/A' },
            { actor: 'Accounts User', action: 'Optionally edits the message template', api: 'N/A' },
            { actor: 'System', action: 'Fetches receipt PDF and donor phone, sends via WhatsApp API', api: 'POST /api/whatsapp/send-receipt/:logId' },
            { actor: 'System', action: 'Updates receipt whatsapp_sent = true and logs the communication', api: 'N/A' },
          ],
        },
        {
          name: 'Send Direct WhatsApp Message',
          description: 'Send a direct text or media message to any phone number without an associated lead.',
          apis: [
            {
              method: 'POST',
              path: '/api/whatsapp/send-direct',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/whatsapp/send-direct" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "whatsapp_account_id": 1,
    "recipient_phone": "+91-9988776655",
    "message_type": "template",
    "template_name": "donor_thank_you",
    "template_params": {
      "name": "Sunil Gupta",
      "amount": "10000"
    },
    "media_url": null,
    "sent_by": 25
  }'`,
              requestBody: {
                whatsapp_account_id: 1,
                recipient_phone: '+91-9988776655',
                message_type: 'template',
                template_name: 'donor_thank_you',
                template_params: {
                  name: 'Sunil Gupta',
                  amount: '10000',
                },
                media_url: null,
                sent_by: 25,
              },
              responseBody: {
                success: true,
                message: 'Direct message sent',
                data: {
                  message_id: 'wamid.HBgLOTk4ODc3NjY1NVUA',
                  recipient: '+91-9988776655',
                  message_type: 'template',
                  status: 'sent',
                  sent_at: '2026-07-13T17:00:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Message type can be: text, template, or media',
            'Template messages require pre-approved WhatsApp template names',
            'Media URL must be a publicly accessible URL for images/documents',
            'Communication is logged in donor_communications table if donor is identified',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Opens WhatsApp Direct Message composer', api: 'N/A' },
            { actor: 'Accounts User', action: 'Selects template or types message, enters phone number', api: 'N/A' },
            { actor: 'System', action: 'Sends message via WhatsApp Business API', api: 'POST /api/whatsapp/send-direct' },
            { actor: 'System', action: 'Logs communication for audit', api: 'N/A' },
          ],
        },
      ],
    },
    {
      name: 'Razorpay Integration',
      path: '/webhooks/razorpay',
      description: 'Manage Razorpay merchant accounts and sync payment data for reconciliation.',
      features: [
        {
          name: 'List Razorpay Accounts',
          description: 'Fetch all configured Razorpay merchant accounts.',
          apis: [
            {
              method: 'GET',
              path: '/api/webhooks/razorpay/accounts',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X GET "https://api.ucs.org/api/webhooks/razorpay/accounts" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Accept: application/json"`,
              requestBody: null,
              responseBody: {
                success: true,
                data: [
                  {
                    id: 1,
                    merchant_name: 'UCS Main Account',
                    key_id: 'rzp_live_XXXXXXXXXXXXXXXX',
                    is_active: true,
                    last_synced_at: '2026-07-13T10:00:00.000Z',
                    created_at: '2026-01-01T00:00:00.000Z',
                  },
                  {
                    id: 2,
                    merchant_name: 'UCS Emergency Fund',
                    key_id: 'rzp_live_YYYYYYYYYYYYYYYY',
                    is_active: true,
                    last_synced_at: '2026-07-12T23:00:00.000Z',
                    created_at: '2026-03-15T00:00:00.000Z',
                  },
                ],
              },
            },
          ],
          businessRules: [
            'Key secret is never returned in API responses',
            'Only active accounts are included in automated sync',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Opens Razorpay Integration page', api: 'N/A' },
            { actor: 'System', action: 'Loads configured Razorpay accounts', api: 'GET /api/webhooks/razorpay/accounts' },
          ],
        },
        {
          name: 'Create Razorpay Account',
          description: 'Add a new Razorpay merchant account configuration.',
          apis: [
            {
              method: 'POST',
              path: '/api/webhooks/razorpay/accounts',
              auth: 'Bearer Token (Admin only)',
              curl: `curl -X POST "https://api.ucs.org/api/webhooks/razorpay/accounts" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzE4MjQwMDAwfQ.sample_admin_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "merchant_name": "UCS Donation Fund",
    "key_id": "rzp_live_ZZZZZZZZZZZZZZZZ",
    "key_secret": "rzp_secret_XXXXXXXXXXXXXXXXXXXXXXXX",
    "webhook_secret": "whsec_XXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    "is_active": true
  }'`,
              requestBody: {
                merchant_name: 'UCS Donation Fund',
                key_id: 'rzp_live_ZZZZZZZZZZZZZZZZ',
                key_secret: 'rzp_secret_XXXXXXXXXXXXXXXXXXXXXXXX',
                webhook_secret: 'whsec_XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
                is_active: true,
              },
              responseBody: {
                success: true,
                message: 'Razorpay account created',
                data: {
                  id: 3,
                  merchant_name: 'UCS Donation Fund',
                  key_id: 'rzp_live_ZZZZZZZZZZZZZZZZ',
                  is_active: true,
                  created_at: '2026-07-13T13:00:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Key secret and webhook secret are encrypted at rest',
            'Credentials are validated by making a test API call to Razorpay',
          ],
          workflow: [
            { actor: 'Admin', action: 'Clicks "Add Razorpay Account"', api: 'N/A' },
            { actor: 'Admin', action: 'Enters Razorpay API credentials', api: 'N/A' },
            { actor: 'System', action: 'Encrypts secrets and stores the account', api: 'POST /api/webhooks/razorpay/accounts' },
          ],
        },
        {
          name: 'Update Razorpay Account',
          description: 'Update an existing Razorpay account configuration.',
          apis: [
            {
              method: 'PUT',
              path: '/api/webhooks/razorpay/accounts/:id',
              auth: 'Bearer Token (Admin only)',
              curl: `curl -X PUT "https://api.ucs.org/api/webhooks/razorpay/accounts/1" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzE4MjQwMDAwfQ.sample_admin_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "key_secret": "rzp_secret_NEW_SECRET_KEY_XXXXXXXXXXXX",
    "webhook_secret": "whsec_NEW_WEBHOOK_SECRET_XXXXXXXXXX",
    "is_active": false
  }'`,
              requestBody: {
                key_secret: 'rzp_secret_NEW_SECRET_KEY_XXXXXXXXXXXX',
                webhook_secret: 'whsec_NEW_WEBHOOK_SECRET_XXXXXXXXXX',
                is_active: false,
              },
              responseBody: {
                success: true,
                message: 'Razorpay account updated',
                data: {
                  id: 1,
                  merchant_name: 'UCS Main Account',
                  key_id: 'rzp_live_XXXXXXXXXXXXXXXX',
                  is_active: false,
                  updated_at: '2026-07-13T14:00:00.000Z',
                },
              },
            },
          ],
          businessRules: ['Secrets are re-encrypted on update', 'Deactivating stops automated sync'],
          workflow: [
            { actor: 'Admin', action: 'Edits a Razorpay account', api: 'N/A' },
            { actor: 'System', action: 'Updates encrypted credentials', api: 'PUT /api/webhooks/razorpay/accounts/:id' },
          ],
        },
        {
          name: 'Delete Razorpay Account',
          description: 'Delete a Razorpay merchant account configuration.',
          apis: [
            {
              method: 'DELETE',
              path: '/api/webhooks/razorpay/accounts/:id',
              auth: 'Bearer Token (Admin only)',
              curl: `curl -X DELETE "https://api.ucs.org/api/webhooks/razorpay/accounts/3" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzE4MjQwMDAwfQ.sample_admin_token"`,
              requestBody: null,
              responseBody: {
                success: true,
                message: 'Razorpay account deleted',
                data: { id: 3 },
              },
            },
          ],
          businessRules: ['Cannot delete account with pending reconciliation data', 'Deletion is permanent'],
          workflow: [
            { actor: 'Admin', action: 'Deletes a Razorpay account', api: 'N/A' },
            { actor: 'System', action: 'Permanently removes the account', api: 'DELETE /api/webhooks/razorpay/accounts/:id' },
          ],
        },
        {
          name: 'Sync Razorpay Payments',
          description: 'Trigger an on-demand sync of payments from Razorpay for a configured account within a date range.',
          apis: [
            {
              method: 'POST',
              path: '/api/webhooks/razorpay/sync',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X POST "https://api.ucs.org/api/webhooks/razorpay/sync" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "account_id": 1,
    "from_date": "2026-07-01",
    "to_date": "2026-07-13"
  }'`,
              requestBody: {
                account_id: 1,
                from_date: '2026-07-01',
                to_date: '2026-07-13',
              },
              responseBody: {
                success: true,
                message: 'Sync completed',
                data: {
                  account_id: 1,
                  merchant_name: 'UCS Main Account',
                  from_date: '2026-07-01',
                  to_date: '2026-07-13',
                  payments_fetched: 23,
                  new_payments: 18,
                  already_synced: 5,
                  total_amount: 425000.00,
                  synced_at: '2026-07-13T15:00:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Maximum date range for one sync is 31 days',
            'Duplicate payments are detected by Razorpay payment_id',
            'New payments are stored in a razorpay_payments table for reconciliation',
            'Sync also updates last_synced_at on the account',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Selects a Razorpay account and date range', api: 'N/A' },
            { actor: 'Accounts User', action: 'Clicks "Sync Payments"', api: 'N/A' },
            { actor: 'System', action: 'Calls Razorpay API to fetch payments and stores them', api: 'POST /api/webhooks/razorpay/sync' },
            { actor: 'System', action: 'Updates last_synced_at for the account', api: 'N/A' },
          ],
        },
      ],
    },
    {
      name: 'Email Import Management',
      path: '/accounts/email-import',
      description: 'Configure email accounts for automatic import of payment receipts and bank statements via IMAP.',
      features: [
        {
          name: 'List Email Import Accounts',
          description: 'Fetch all configured email accounts for importing payment data.',
          apis: [
            {
              method: 'GET',
              path: '/api/accounts/email-import/accounts',
              auth: 'Bearer Token (Accounts / Admin)',
              curl: `curl -X GET "https://api.ucs.org/api/accounts/email-import/accounts" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjUsInJvbGUiOiJhY2NvdW50cyIsImlhdCI6MTcxODI0MDAwMH0.sample_token" \\
  -H "Accept: application/json"`,
              requestBody: null,
              responseBody: {
                success: true,
                data: [
                  {
                    id: 1,
                    email_address: 'donations@ucs.org',
                    imap_host: 'imap.gmail.com',
                    imap_port: 993,
                    use_ssl: true,
                    is_active: true,
                    last_fetched_at: '2026-07-13T08:00:00.000Z',
                    created_at: '2026-02-01T00:00:00.000Z',
                  },
                  {
                    id: 2,
                    email_address: 'accounts@ucs.org',
                    imap_host: 'outlook.office365.com',
                    imap_port: 993,
                    use_ssl: true,
                    is_active: true,
                    last_fetched_at: '2026-07-12T18:00:00.000Z',
                    created_at: '2026-02-15T00:00:00.000Z',
                  },
                ],
              },
            },
          ],
          businessRules: [
            'Passwords are never returned in API responses',
            'Only active accounts are included in scheduled fetch jobs',
          ],
          workflow: [
            { actor: 'Accounts User', action: 'Opens Email Import Settings', api: 'N/A' },
            { actor: 'System', action: 'Returns configured email accounts', api: 'GET /api/accounts/email-import/accounts' },
          ],
        },
        {
          name: 'Create Email Import Account',
          description: 'Add a new email account for importing payment receipts and statements.',
          apis: [
            {
              method: 'POST',
              path: '/api/accounts/email-import/accounts',
              auth: 'Bearer Token (Admin only)',
              curl: `curl -X POST "https://api.ucs.org/api/accounts/email-import/accounts" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzE4MjQwMDAwfQ.sample_admin_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email_address": "receipts@ucs.org",
    "imap_host": "imap.zoho.com",
    "imap_port": 993,
    "username": "receipts@ucs.org",
    "password": "secure_email_password_2026",
    "use_ssl": true,
    "is_active": true
  }'`,
              requestBody: {
                email_address: 'receipts@ucs.org',
                imap_host: 'imap.zoho.com',
                imap_port: 993,
                username: 'receipts@ucs.org',
                password: 'secure_email_password_2026',
                use_ssl: true,
                is_active: true,
              },
              responseBody: {
                success: true,
                message: 'Email import account created',
                data: {
                  id: 3,
                  email_address: 'receipts@ucs.org',
                  imap_host: 'imap.zoho.com',
                  imap_port: 993,
                  use_ssl: true,
                  is_active: true,
                  created_at: '2026-07-13T16:00:00.000Z',
                },
              },
            },
          ],
          businessRules: [
            'Password is encrypted at rest using AES-256',
            'IMAP connection is tested on creation before saving',
            'Only admin role can create email import accounts',
          ],
          workflow: [
            { actor: 'Admin', action: 'Clicks "Add Email Account"', api: 'N/A' },
            { actor: 'Admin', action: 'Enters email server credentials', api: 'N/A' },
            { actor: 'System', action: 'Tests IMAP connection and saves encrypted', api: 'POST /api/accounts/email-import/accounts' },
          ],
        },
        {
          name: 'Update Email Import Account',
          description: 'Update an existing email import account configuration.',
          apis: [
            {
              method: 'PUT',
              path: '/api/accounts/email-import/accounts/:id',
              auth: 'Bearer Token (Admin only)',
              curl: `curl -X PUT "https://api.ucs.org/api/accounts/email-import/accounts/1" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzE4MjQwMDAwfQ.sample_admin_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "password": "new_secure_password_2026",
    "is_active": false
  }'`,
              requestBody: {
                password: 'new_secure_password_2026',
                is_active: false,
              },
              responseBody: {
                success: true,
                message: 'Email import account updated',
                data: {
                  id: 1,
                  email_address: 'donations@ucs.org',
                  imap_host: 'imap.gmail.com',
                  is_active: false,
                  updated_at: '2026-07-13T17:00:00.000Z',
                },
              },
            },
          ],
          businessRules: ['Password is re-encrypted on update', 'Deactivating stops the scheduled fetch job'],
          workflow: [
            { actor: 'Admin', action: 'Edits an email account', api: 'N/A' },
            { actor: 'System', action: 'Updates and re-encrypts credentials', api: 'PUT /api/accounts/email-import/accounts/:id' },
          ],
        },
        {
          name: 'Delete Email Import Account',
          description: 'Delete an email import account configuration.',
          apis: [
            {
              method: 'DELETE',
              path: '/api/accounts/email-import/accounts/:id',
              auth: 'Bearer Token (Admin only)',
              curl: `curl -X DELETE "https://api.ucs.org/api/accounts/email-import/accounts/3" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzE4MjQwMDAwfQ.sample_admin_token"`,
              requestBody: null,
              responseBody: {
                success: true,
                message: 'Email import account deleted',
                data: { id: 3 },
              },
            },
          ],
          businessRules: ['Deletion is permanent', 'Scheduled fetch jobs for this account are removed'],
          workflow: [
            { actor: 'Admin', action: 'Deletes an email import account', api: 'N/A' },
            { actor: 'System', action: 'Permanently deletes the account', api: 'DELETE /api/accounts/email-import/accounts/:id' },
          ],
        },
      ],
    },
  ],
}

export default accountsData
