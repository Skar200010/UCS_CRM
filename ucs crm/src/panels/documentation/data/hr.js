const hrData = {
  id: 'hr',
  title: 'HR Panel',
  icon: 'Users',
  roles: ['hr', 'HR'],description: 'Human Resources panel for managing employee lifecycle including worker CRUD, attendance, leaves, letters, loans, correction tickets, recruiters, incentives, and salary.',
  "keyFeatures": [
    "Full worker lifecycle: add, bulk-add, edit, bulk-edit, deactivate",
    "Leave management with approve/reject and 4 leave types",
    "6 letter templates: Experience, Offer, Appointment, Relieving, Salary, Confirmation",
    "QR code generation with geo-fencing radius",
    "Loan/advance approval with monthly salary deduction",
    "Attendance correction ticket: verify then forward to Super Admin",
    "Recruiter performance leaderboard and incentive targets"
  ],
  screens: [
    {
      name: 'Overview',
      path: '/hr/overview',
      description: 'HR dashboard with attendance metrics, employee stats, and recent activity.',
      features: [{
        name: 'HR Dashboard',
        apis: [{
          method: 'GET',
          path: '/api/dashboard/hr',
          auth: 'hr',
          description: 'Fetch HR dashboard data including workforce metrics, attendance trends, pending actions.',
          curl: 'curl -X GET "https://ucs-crm-backend.vercel.app/api/dashboard/hr" -H "Authorization: Bearer <token>"',
          requestBody: null,
          responseBody: { totalWorkers: 150, activeWorkers: 142, attendanceToday: 85, pendingLeaves: 5, pendingTickets: 3 },
        }],
      }],
    },
    {
      name: 'Workers',
      path: '/hr/employees',
      description: 'Full employee management with CRUD, bulk operations, birthdays, and profile views.',
      features: [{
        name: 'Worker Management',
        apis: [
          { method: 'GET', path: '/api/workers', auth: 'super_admin, admin, hr, accounts', description: 'List all workers with filters.', curl: 'curl -X GET "https://ucs-crm-backend.vercel.app/api/workers?department=FRO" -H "Authorization: Bearer <token>"', requestBody: null, responseBody: [{ id: 1, name: 'John', department: 'FRO', phone: '9876543210', is_active: true }] },
          { method: 'POST', path: '/api/workers', auth: 'super_admin, admin, hr', description: 'Create a new worker.', curl: 'curl -X POST "https://ucs-crm-backend.vercel.app/api/workers" -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d \'{"name":"Jane","email":"jane@test.com","login_id":"jane2026","password":"secret","department":"FRO"}\'', requestBody: { name: 'Jane', email: 'jane@test.com', login_id: 'jane2026', password: 'secret', department: 'FRO' }, responseBody: { id: 2, message: 'Worker created' } },
          { method: 'POST', path: '/api/workers/bulk', auth: 'super_admin, admin, hr', description: 'Bulk create workers.', curl: 'curl -X POST "https://ucs-crm-backend.vercel.app/api/workers/bulk" -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d \'[{"name":"W1","login_id":"w1"},{"name":"W2","login_id":"w2"}]\'', requestBody: [{ name: 'W1', login_id: 'w1' }, { name: 'W2', login_id: 'w2' }], responseBody: { created: 2, message: 'Bulk workers created' } },
          { method: 'PUT', path: '/api/workers/bulk', auth: 'super_admin, admin, hr', description: 'Bulk update workers.', curl: 'curl -X PUT "https://ucs-crm-backend.vercel.app/api/workers/bulk" -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d \'[{"id":1,"department":"HR"},{"id":2,"department":"FRO"}]\'', requestBody: [{ id: 1, department: 'HR' }, { id: 2, department: 'FRO' }], responseBody: { updated: 2, message: 'Bulk update done' } },
          { method: 'PUT', path: '/api/workers/:id', auth: 'super_admin, admin, hr', description: 'Update a worker.', curl: 'curl -X PUT "https://ucs-crm-backend.vercel.app/api/workers/2" -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d \'{"name":"Jane Updated"}\'', requestBody: { name: 'Jane Updated' }, responseBody: { message: 'Worker updated' } },
          { method: 'DELETE', path: '/api/workers/:id', auth: 'super_admin, admin, hr', description: 'Delete worker.', curl: 'curl -X DELETE "https://ucs-crm-backend.vercel.app/api/workers/2" -H "Authorization: Bearer <token>"', requestBody: null, responseBody: { message: 'Worker removed' } },
          { method: 'GET', path: '/api/workers/birthdays', auth: 'super_admin, admin, hr', description: 'Get upcoming birthdays (next 30 days).', curl: 'curl -X GET "https://ucs-crm-backend.vercel.app/api/workers/birthdays" -H "Authorization: Bearer <token>"', requestBody: null, responseBody: [{ name: 'John', dob: '07-20', daysUntil: 7 }] },
          { method: 'GET', path: '/api/workers/:id/allocations', auth: 'super_admin, admin, hr', description: 'Get worker NGO allocations.', curl: 'curl -X GET "https://ucs-crm-backend.vercel.app/api/workers/1/allocations" -H "Authorization: Bearer <token>"', requestBody: null, responseBody: [{ ngo_id: 1, salary_portion: 15000 }] },
          { method: 'PUT', path: '/api/workers/:id/allocations', auth: 'super_admin, admin, hr', description: 'Set worker NGO allocations.', curl: 'curl -X PUT "https://ucs-crm-backend.vercel.app/api/workers/1/allocations" -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d \'{"allocations":[{"ngo_id":1,"salary_portion":15000}],"salary":25000}\'', requestBody: { allocations: [{ ngo_id: 1, salary_portion: 15000 }], salary: 25000 }, responseBody: { message: 'Allocations updated' } },
        ],
        businessRules: ['login_id must be unique', 'Soft delete via is_active flag', 'password auto-hashed with bcrypt'],
      }],
    },
    {
      name: 'Leaves',
      path: '/hr/leaves',
      description: 'Manage all leave applications with approve/reject workflow.',
      features: [{
        name: 'Leave Management',
        apis: [
          { method: 'GET', path: '/api/leaves', auth: 'super_admin, admin, hr', description: 'List all leaves.', curl: 'curl -X GET "https://ucs-crm-backend.vercel.app/api/leaves" -H "Authorization: Bearer <token>"', requestBody: null, responseBody: [{ id: 1, worker_name: 'John', type: 'full_day', status: 'pending' }] },
          { method: 'GET', path: '/api/leaves/pending', auth: 'super_admin, admin, hr', description: 'List pending leaves.', curl: 'curl -X GET "https://ucs-crm-backend.vercel.app/api/leaves/pending" -H "Authorization: Bearer <token>"', requestBody: null, responseBody: [{ id: 1, worker_name: 'John', reason: 'Personal' }] },
          { method: 'PUT', path: '/api/leaves/:id/status', auth: 'super_admin, admin, hr', description: 'Approve/reject leave.', curl: 'curl -X PUT "https://ucs-crm-backend.vercel.app/api/leaves/1/status" -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d \'{"status":"approved"}\'', requestBody: { status: 'approved', admin_remark: 'Approved' }, responseBody: { message: 'Leave status updated' } },
        ],
      }],
    },
    {
      name: 'Tickets',
      path: '/hr/tickets',
      description: 'Attendance correction ticket handling with verify/reject workflow.',
      features: [{
        name: 'Correction Tickets',
        apis: [
          { method: 'GET', path: '/api/attendance-corrections/pending', auth: 'super_admin, admin, hr', description: 'List pending tickets.', curl: 'curl -X GET "https://ucs-crm-backend.vercel.app/api/attendance-corrections/pending" -H "Authorization: Bearer <token>"', requestBody: null, responseBody: [{ id: 1, worker_name: 'John', field: 'punch_in', status: 'pending' }] },
          { method: 'GET', path: '/api/attendance-corrections/all', auth: 'super_admin, admin, hr', description: 'List all tickets.', curl: 'curl -X GET "https://ucs-crm-backend.vercel.app/api/attendance-corrections/all" -H "Authorization: Bearer <token>"', requestBody: null, responseBody: [{ id: 1, status: 'pending' }, { id: 2, status: 'approved' }] },
          { method: 'PUT', path: '/api/attendance-corrections/:id/verify', auth: 'super_admin, admin, hr', description: 'HR verifies a ticket.', curl: 'curl -X PUT "https://ucs-crm-backend.vercel.app/api/attendance-corrections/1/verify" -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d \'{"hr_remark":"Verified correct"}\'', requestBody: { hr_remark: 'Verified correct' }, responseBody: { message: 'Ticket verified', status: 'hr_verified' } },
          { method: 'PUT', path: '/api/attendance-corrections/:id/reject', auth: 'super_admin, admin, hr', description: 'Reject a ticket.', curl: 'curl -X PUT "https://ucs-crm-backend.vercel.app/api/attendance-corrections/1/reject" -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d \'{"admin_remark":"Invalid request"}\'', requestBody: { admin_remark: 'Invalid request' }, responseBody: { message: 'Ticket rejected' } },
        ],
        workflow: [
          { actor: 'Worker', action: 'Raises correction ticket', api: 'POST /api/attendance-corrections' },
          { actor: 'HR', action: 'Verifies ticket', api: 'PUT /api/attendance-corrections/:id/verify' },
          { actor: 'Super Admin', action: 'Approves verified ticket', api: 'PUT /api/attendance-corrections/:id/approve' },
        ],
      }],
    },
    {
      name: 'Loans',
      path: '/hr/loans',
      description: 'Loan/advance management with approval workflow.',
      features: [{
        name: 'Loan Management',
        apis: [
          { method: 'GET', path: '/api/loans', auth: 'super_admin, admin, hr', description: 'List all loans.', curl: 'curl -X GET "https://ucs-crm-backend.vercel.app/api/loans" -H "Authorization: Bearer <token>"', requestBody: null, responseBody: [{ id: 1, worker_name: 'John', type: 'advance', amount: 2000, status: 'pending' }] },
          { method: 'GET', path: '/api/loans/pending', auth: 'super_admin, admin, hr', description: 'List pending loans.', curl: 'curl -X GET "https://ucs-crm-backend.vercel.app/api/loans/pending" -H "Authorization: Bearer <token>"', requestBody: null, responseBody: [{ id: 1, worker_name: 'John', amount: 2000, reason: 'Travel' }] },
          { method: 'PUT', path: '/api/loans/:id/decide', auth: 'super_admin, admin, hr', description: 'Approve/reject loan.', curl: 'curl -X PUT "https://ucs-crm-backend.vercel.app/api/loans/1/decide" -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d \'{"status":"approved","monthly_deduction":500}\'', requestBody: { status: 'approved', monthly_deduction: 500, hr_remark: 'Approved' }, responseBody: { message: 'Loan decision saved' } },
        ],
      }],
    },
    {
      name: 'Salary',
      path: '/hr/salary',
      description: 'Salary management with payroll export.',
      features: [{
        name: 'Salary Management',
        apis: [
          { method: 'GET', path: '/api/salary/workers-summary', auth: 'super_admin, admin, hr', description: 'Get salary summary for all workers.', curl: 'curl -X GET "https://ucs-crm-backend.vercel.app/api/salary/workers-summary" -H "Authorization: Bearer <token>"', requestBody: null, responseBody: [{ worker_id: 1, name: 'John', salary: 25000, month: '2026-07', paid: false }] },
          { method: 'POST', path: '/api/salary', auth: 'super_admin, admin, hr', description: 'Add salary record.', curl: 'curl -X POST "https://ucs-crm-backend.vercel.app/api/salary" -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d \'{"worker_id":1,"salary":25000,"from_month":"2026-07","to_month":"2026-07"}\'', requestBody: { worker_id: 1, salary: 25000, from_month: '2026-07', to_month: '2026-07' }, responseBody: { id: 5, message: 'Salary record created' } },
          { method: 'PUT', path: '/api/salary/:id/pay', auth: 'super_admin, admin, hr', description: 'Mark salary as paid.', curl: 'curl -X PUT "https://ucs-crm-backend.vercel.app/api/salary/1/pay" -H "Authorization: Bearer <token>"', requestBody: null, responseBody: { message: 'Salary marked as paid', paid_at: '2026-07-13T10:00:00Z' } },
        ],
      }],
    },
  ],
};

export default hrData;
