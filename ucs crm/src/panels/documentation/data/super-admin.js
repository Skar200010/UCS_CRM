const superAdminData = {
  "id": "super-admin",
  "title": "Super Admin Panel",
  "icon": "Shield",
  "roles": [
    "super_admin"
  ],
  "description": "Central oversight of all NGOs, workers, attendance, salary, incentives, data import, and system-wide configuration.",
  "keyFeatures": [
    "KPI dashboards with Recharts visualizations (bar, donut, line charts)",
    "Cross-NGO worker and attendance management",
    "3-stage ticket approval workflow (Worker / HR / Super Admin)",
    "Data import from XLSX/CSV with batch tracking",
    "Salary and incentive monthly summaries across all NGOs",
    "FRO live activity monitoring across all stations",
    "NGO, user, HR, holiday, notice, and achievement CRUD"
  ],
  "screens": [
    {
      "name": "Dashboard",
      "path": "/sa/dashboard",
      "description": "KPI metrics, charts, alerts, FRO live status",
      "features": [
        {
          "name": "Dashboard APIs",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/dashboard/super-admin",
              "auth": "super_admin",
              "description": "Fetch dashboard KPIs: NGOs count, workers, attendance %, events, etc.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/dashboard/super-admin?period=30d\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "ngos": 3,
                "workers": 150,
                "attendanceRate": 87.5,
                "activeFROs": 12,
                "totalLeads": 450,
                "totalCollections": 125000
              }
            },
            {
              "method": "GET",
              "path": "/api/dashboard/super-admin-alerts",
              "auth": "super_admin",
              "description": "Get risk alerts across all categories (14 types).",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/dashboard/super-admin-alerts\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "alerts": [
                  {
                    "type": "low_attendance",
                    "count": 5,
                    "severity": "high"
                  },
                  {
                    "type": "missed_target",
                    "count": 3,
                    "severity": "medium"
                  }
                ]
              }
            },
            {
              "method": "GET",
              "path": "/api/dashboard/fro-live",
              "auth": "super_admin",
              "description": "Get live FRO activity status (online/on_call/break/offline).",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/dashboard/fro-live\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "fros": [
                  {
                    "id": 1,
                    "name": "FRO 1",
                    "status": "on_call",
                    "today_calls": 15,
                    "today_talk_seconds": 3600
                  }
                ]
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Workers",
      "path": "/sa/employees",
      "description": "Manage all workers across NGOs",
      "features": [
        {
          "name": "Worker CRUD",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/workers",
              "auth": "super_admin,admin,hr,accounts",
              "description": "List all workers with optional filters.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/workers?department=FRO&is_active=true\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "id": 1,
                  "name": "John",
                  "department": "FRO",
                  "phone": "9876543210",
                  "is_active": true
                }
              ]
            },
            {
              "method": "POST",
              "path": "/api/workers",
              "auth": "super_admin,admin,hr",
              "description": "Create a new worker.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/workers\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"name\":\"Jane\",\"email\":\"jane@test.com\",\"login_id\":\"jane2026\",\"password\":\"secret\",\"department\":\"FRO\"}'",
              "requestBody": {
                "name": "Jane",
                "email": "jane@test.com",
                "login_id": "jane2026",
                "password": "secret",
                "department": "FRO"
              },
              "responseBody": {
                "id": 2,
                "message": "Worker created"
              }
            },
            {
              "method": "PUT",
              "path": "/api/workers/:id",
              "auth": "super_admin,admin,hr",
              "description": "Update worker details.",
              "curl": "curl -X PUT \"https://ucs-crm-backend.vercel.app/api/workers/2\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"name\":\"Jane Updated\",\"phone\":\"9876543211\"}'",
              "requestBody": {
                "name": "Jane Updated",
                "phone": "9876543211"
              },
              "responseBody": {
                "message": "Worker updated"
              }
            },
            {
              "method": "DELETE",
              "path": "/api/workers/:id",
              "auth": "super_admin,admin,hr",
              "description": "Delete (deactivate) a worker.",
              "curl": "curl -X DELETE \"https://ucs-crm-backend.vercel.app/api/workers/2\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "message": "Worker removed"
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Leaves",
      "path": "/sa/leaves",
      "description": "Manage all leave applications",
      "features": [
        {
          "name": "Leave Management",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/leaves",
              "auth": "super_admin,admin,hr",
              "description": "List all leave applications.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/leaves\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "id": 1,
                  "worker_name": "John",
                  "type": "full_day",
                  "status": "pending",
                  "leave_date": "2026-07-15"
                }
              ]
            },
            {
              "method": "PUT",
              "path": "/api/leaves/:id/status",
              "auth": "super_admin,admin,hr",
              "description": "Approve or reject a leave.",
              "curl": "curl -X PUT \"https://ucs-crm-backend.vercel.app/api/leaves/1/status\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"status\":\"approved\",\"admin_remark\":\"Approved\"}'",
              "requestBody": {
                "status": "approved",
                "admin_remark": "Approved"
              },
              "responseBody": {
                "message": "Leave status updated"
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Tickets",
      "path": "/sa/tickets",
      "description": "Attendance correction ticket approval workflow",
      "features": [
        {
          "name": "Ticket Management",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/attendance-corrections/pending",
              "auth": "super_admin,admin,hr",
              "description": "List pending correction tickets.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/attendance-corrections/pending\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "id": 1,
                  "worker_name": "John",
                  "field": "punch_in",
                  "status": "pending"
                }
              ]
            },
            {
              "method": "PUT",
              "path": "/api/attendance-corrections/:id/approve",
              "auth": "super_admin",
              "description": "Approve a correction ticket (super admin only).",
              "curl": "curl -X PUT \"https://ucs-crm-backend.vercel.app/api/attendance-corrections/1/approve\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"admin_remark\":\"Approved\"}'",
              "requestBody": {
                "admin_remark": "Approved"
              },
              "responseBody": {
                "message": "Ticket approved, attendance updated"
              }
            },
            {
              "method": "PUT",
              "path": "/api/attendance-corrections/:id/reject",
              "auth": "super_admin,admin,hr",
              "description": "Reject a correction ticket.",
              "curl": "curl -X PUT \"https://ucs-crm-backend.vercel.app/api/attendance-corrections/1/reject\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"admin_remark\":\"Incorrect request\"}'",
              "requestBody": {
                "admin_remark": "Incorrect request"
              },
              "responseBody": {
                "message": "Ticket rejected"
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "NGOs",
      "path": "/sa/organization",
      "description": "NGO organization management",
      "features": [
        {
          "name": "NGO CRUD",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/ngos",
              "auth": "super_admin,admin,hr",
              "description": "List all NGOs.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/ngos\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "id": 1,
                  "name": "Mann Care Foundation",
                  "code": "MANN",
                  "is_active": true
                }
              ]
            },
            {
              "method": "POST",
              "path": "/api/ngos",
              "auth": "super_admin",
              "description": "Create a new NGO.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/ngos\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"name\":\"New NGO\",\"code\":\"NNG\",\"is_active\":true}'",
              "requestBody": {
                "name": "New NGO",
                "code": "NNG",
                "is_active": true
              },
              "responseBody": {
                "id": 4,
                "message": "NGO created"
              }
            },
            {
              "method": "PUT",
              "path": "/api/ngos/:id",
              "auth": "super_admin",
              "description": "Update NGO details.",
              "curl": "curl -X PUT \"https://ucs-crm-backend.vercel.app/api/ngos/1\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"name\":\"Updated Name\"}'",
              "requestBody": {
                "name": "Updated Name"
              },
              "responseBody": {
                "message": "NGO updated"
              }
            },
            {
              "method": "PUT",
              "path": "/api/ngos/:id/toggle",
              "auth": "super_admin",
              "description": "Activate/deactivate an NGO.",
              "curl": "curl -X PUT \"https://ucs-crm-backend.vercel.app/api/ngos/1/toggle\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "message": "NGO toggled",
                "is_active": false
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Users",
      "path": "/sa/users",
      "description": "Panel user management",
      "features": [
        {
          "name": "User Management",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/users",
              "auth": "super_admin,admin,hr",
              "description": "List all panel users.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/users\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "id": 1,
                  "name": "Admin",
                  "email": "admin@ngo.com",
                  "role": "admin"
                }
              ]
            },
            {
              "method": "POST",
              "path": "/api/users",
              "auth": "super_admin,admin,hr",
              "description": "Create panel user.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/users\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"name\":\"HR User\",\"email\":\"hr@ngo.com\",\"password\":\"secret\",\"role\":\"hr\",\"ngo_id\":1}'",
              "requestBody": {
                "name": "HR User",
                "email": "hr@ngo.com",
                "password": "secret",
                "role": "hr",
                "ngo_id": 1
              },
              "responseBody": {
                "id": 5,
                "message": "User created"
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    }
  ]
};

export default superAdminData;
