const flutterAppData = {
  "id": "flutter-app",
  "title": "Flutter Mobile App",
  "icon": "Smartphone",
  "roles": [
    "*"
  ],
  "description": "Mobile application (UFS Attend) for workers covering attendance, leaves, advances, loans, profile, notifications, onboarding, and salary.",
  "keyFeatures": [
    "QR code + GPS geo-verified attendance punching",
    "4 leave types: full day, half day, vacational, emergency",
    "Advance and loan application with status tracking",
    "11-step onboarding with photo, documents, bank details",
    "Push notifications via Firebase Cloud Messaging",
    "PDF generation of onboarding form",
    "Custom DNS-over-HTTPS transport"
  ],
  "screens": [
    {
      "name": "Authentication",
      "path": "/auth",
      "description": "Login and session management",
      "features": [
        {
          "name": "Worker Login",
          "description": "",
          "apis": [
            {
              "method": "POST",
              "path": "/api/auth/worker/login",
              "auth": "none",
              "description": "Authenticate worker with login_id and password.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/auth/worker/login\" -H \"Content-Type: application/json\" -d '{\"identifier\":\"worker123\",\"password\":\"secret\"}'",
              "requestBody": {
                "identifier": "worker123",
                "password": "secret"
              },
              "responseBody": {
                "token": "jwt_string",
                "user": {
                  "id": 1,
                  "name": "John",
                  "role": "worker",
                  "ngo_id": 1,
                  "shift_start_time": "10:00",
                  "shift_end_time": "19:00"
                }
              }
            }
          ],
          "businessRules": [
            "Custom DNS-over-HTTPS via Cloudflare",
            "Token persisted in SharedPreferences as worker_token"
          ],
          "workflow": []
        }
      ]
    },
    {
      "name": "Attendance",
      "path": "/attendance",
      "description": "QR-based punch in/out with GPS verification",
      "features": [
        {
          "name": "Punch Operations",
          "description": "",
          "apis": [
            {
              "method": "POST",
              "path": "/api/attendance/punch-in",
              "auth": "authenticate",
              "description": "QR code + GPS verified punch-in.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/attendance/punch-in\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"code\":\"QR-OFFICE-001\",\"latitude\":19.0760,\"longitude\":72.8777}'",
              "requestBody": {
                "code": "QR-OFFICE-001",
                "latitude": 19.076,
                "longitude": 72.8777
              },
              "responseBody": {
                "message": "Punched in successfully",
                "lateMinutes": 0
              }
            },
            {
              "method": "POST",
              "path": "/api/attendance/punch-out",
              "auth": "authenticate",
              "description": "GPS verified punch-out.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/attendance/punch-out\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"latitude\":19.0760,\"longitude\":72.8777}'",
              "requestBody": {
                "latitude": 19.076,
                "longitude": 72.8777
              },
              "responseBody": {
                "message": "Punched out successfully"
              }
            },
            {
              "method": "GET",
              "path": "/api/attendance/today",
              "auth": "authenticate",
              "description": "Get today's attendance status with shift timings.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/attendance/today\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "officeStartTime": "10:00",
                "officeEndTime": "19:00",
                "lateUsed": 0,
                "attendance": {
                  "punch_in_time": "2026-07-13T10:05:00Z",
                  "punch_out_time": null
                }
              }
            },
            {
              "method": "GET",
              "path": "/api/attendance/history",
              "auth": "authenticate",
              "description": "Get full attendance history.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/attendance/history\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "date": "2026-07-13",
                  "status": "present",
                  "punch_in_time": "2026-07-13T10:05:00Z",
                  "punch_out_time": "2026-07-13T19:10:00Z",
                  "late_minutes": 5,
                  "hours_worked": 9.08
                }
              ]
            }
          ],
          "businessRules": [
            "Status auto-calculated: present, late, absent, half-day, leave",
            "Cached in SharedPreferences with cache_ prefix"
          ],
          "workflow": []
        }
      ]
    },
    {
      "name": "Leaves",
      "path": "/leaves",
      "description": "Leave application with 4 types",
      "features": [
        {
          "name": "Leave Management",
          "description": "",
          "apis": [
            {
              "method": "POST",
              "path": "/api/leaves/apply",
              "auth": "authenticate",
              "description": "Apply for leave (full_day, half_day, vacational, emergency).",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/leaves/apply\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"type\":\"full_day\",\"leave_date\":\"2026-07-15\",\"reason\":\"Personal\"}'",
              "requestBody": {
                "type": "full_day",
                "leave_date": "2026-07-15",
                "reason": "Personal"
              },
              "responseBody": {
                "message": "Leave applied",
                "leave": {
                  "id": 1,
                  "type": "full_day",
                  "status": "pending"
                }
              }
            },
            {
              "method": "GET",
              "path": "/api/leaves/my",
              "auth": "authenticate",
              "description": "Get list of own leave applications.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/leaves/my\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "id": 1,
                  "type": "full_day",
                  "leave_date": "2026-07-15",
                  "status": "pending",
                  "reason": "Personal",
                  "days": 1
                }
              ]
            }
          ],
          "businessRules": [
            "Full day: 2 days prior",
            "Vacational: 30 days prior",
            "Emergency: immediate",
            "Half day: requires start/end time"
          ],
          "workflow": []
        }
      ]
    },
    {
      "name": "Loans & Advances",
      "path": "/loans",
      "description": "Apply for advances and loans",
      "features": [
        {
          "name": "Loan Management",
          "description": "",
          "apis": [
            {
              "method": "POST",
              "path": "/api/advances/apply",
              "auth": "authenticate",
              "description": "Apply for a salary advance.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/advances/apply\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"amount\":2000,\"reason\":\"Travel expenses\"}'",
              "requestBody": {
                "amount": 2000,
                "reason": "Travel expenses"
              },
              "responseBody": {
                "message": "Advance applied",
                "id": 1,
                "status": "pending"
              }
            },
            {
              "method": "POST",
              "path": "/api/loans/apply",
              "auth": "authenticate",
              "description": "Apply for a loan with monthly deduction.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/loans/apply\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"amount\":5000,\"reason\":\"Medical\"}'",
              "requestBody": {
                "amount": 5000,
                "reason": "Medical"
              },
              "responseBody": {
                "message": "Loan applied",
                "id": 2,
                "status": "pending"
              }
            },
            {
              "method": "GET",
              "path": "/api/loans/my",
              "auth": "authenticate",
              "description": "List own loans and advances.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/loans/my\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "id": 1,
                  "type": "advance",
                  "total_amount": 2000,
                  "remaining_amount": 0,
                  "status": "approved",
                  "monthly_deduction": null
                }
              ]
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Profile",
      "path": "/profile",
      "description": "View and edit personal profile",
      "features": [
        {
          "name": "Profile Management",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/workers/me",
              "auth": "authenticate",
              "description": "Get own profile with all details.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/workers/me\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "id": 1,
                "name": "John",
                "email": "john@test.com",
                "phone": "9876543210",
                "shift_start_time": "10:00",
                "shift_end_time": "19:00"
              }
            },
            {
              "method": "PUT",
              "path": "/api/workers/me",
              "auth": "authenticate",
              "description": "Update own profile fields.",
              "curl": "curl -X PUT \"https://ucs-crm-backend.vercel.app/api/workers/me\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"name\":\"John Updated\",\"phone\":\"9876543211\"}'",
              "requestBody": {
                "name": "John Updated",
                "phone": "9876543211"
              },
              "responseBody": {
                "message": "Profile updated",
                "worker": {
                  "id": 1,
                  "name": "John Updated"
                }
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Notifications",
      "path": "/notifications",
      "description": "Push notifications via FCM",
      "features": [
        {
          "name": "Notification Management",
          "description": "",
          "apis": [
            {
              "method": "POST",
              "path": "/api/notifications/register-token",
              "auth": "authenticate",
              "description": "Register FCM push token for device.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/notifications/register-token\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"worker_id\":1,\"token\":\"fcm_token_string\",\"device_type\":\"flutter\"}'",
              "requestBody": {
                "worker_id": 1,
                "token": "fcm_token_string",
                "device_type": "flutter"
              },
              "responseBody": {
                "message": "Token registered"
              }
            },
            {
              "method": "GET",
              "path": "/api/notifications/:worker_id",
              "auth": "authenticate",
              "description": "Get list of notifications for worker.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/notifications/1\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "id": 1,
                  "title": "Birthday Reminder",
                  "body": "Today is John's birthday",
                  "type": "birthday",
                  "read_at": null,
                  "created_at": "2026-07-13T00:00:00Z"
                }
              ]
            },
            {
              "method": "GET",
              "path": "/api/notifications/:worker_id/unread-count",
              "auth": "authenticate",
              "description": "Get count of unread notifications.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/notifications/1/unread-count\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "count": 3
              }
            },
            {
              "method": "PUT",
              "path": "/api/notifications/:id/read",
              "auth": "authenticate",
              "description": "Mark a notification as read.",
              "curl": "curl -X PUT \"https://ucs-crm-backend.vercel.app/api/notifications/1/read\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "message": "Marked as read"
              }
            },
            {
              "method": "DELETE",
              "path": "/api/notifications/:id",
              "auth": "authenticate",
              "description": "Delete a notification.",
              "curl": "curl -X DELETE \"https://ucs-crm-backend.vercel.app/api/notifications/1\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "message": "Notification deleted"
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Onboarding",
      "path": "/onboarding",
      "description": "11-step employee onboarding wizard",
      "features": [
        {
          "name": "Onboarding",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/onboarding/status",
              "auth": "authenticate",
              "description": "Check if onboarding is completed.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/onboarding/status\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "onboarding_completed": false
              }
            },
            {
              "method": "POST",
              "path": "/api/onboarding/upload-photo",
              "auth": "authenticate",
              "description": "Upload profile photo as base64.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/onboarding/upload-photo\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"photo_base64\":\"base64data\",\"mime_type\":\"image/jpeg\"}'",
              "requestBody": {
                "photo_base64": "base64data",
                "mime_type": "image/jpeg"
              },
              "responseBody": {
                "photo_url": "https://storage.url/photo.jpg"
              }
            },
            {
              "method": "POST",
              "path": "/api/onboarding/submit",
              "auth": "authenticate",
              "description": "Submit complete onboarding data.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/onboarding/submit\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"personal_details\":{\"name\":\"John\",\"email\":\"john@test.com\",\"phone\":\"9876543210\"}}'",
              "requestBody": {
                "personal_details": {
                  "name": "John",
                  "email": "john@test.com",
                  "phone": "9876543210"
                },
                "education": [],
                "family": [],
                "references": []
              },
              "responseBody": {
                "message": "Onboarding completed"
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Salary",
      "path": "/salary",
      "description": "View salary breakdown",
      "features": [
        {
          "name": "Salary Breakdown",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/salary/my-breakdown",
              "auth": "authenticate",
              "description": "Get own salary breakdown with deductions.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/salary/my-breakdown\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "salary": 25000,
                "deductions": {
                  "loan": 500,
                  "advance": 0
                },
                "netPayable": 24500
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Correction Tickets",
      "path": "/correction-tickets",
      "description": "Raise attendance correction requests",
      "features": [
        {
          "name": "Correction Tickets",
          "description": "",
          "apis": [
            {
              "method": "POST",
              "path": "/api/attendance-corrections",
              "auth": "authenticate",
              "description": "Raise a correction ticket for punch in/out time.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/attendance-corrections\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"attendance_id\":123,\"date\":\"2026-07-10\",\"field\":\"punch_in\",\"requested_time\":\"2026-07-10T09:30:00Z\",\"reason\":\"Forgot to punch in\"}'",
              "requestBody": {
                "attendance_id": 123,
                "date": "2026-07-10",
                "field": "punch_in",
                "requested_time": "2026-07-10T09:30:00Z",
                "reason": "Forgot to punch in"
              },
              "responseBody": {
                "id": 1,
                "status": "pending",
                "message": "Ticket raised"
              }
            },
            {
              "method": "GET",
              "path": "/api/attendance-corrections/my",
              "auth": "authenticate",
              "description": "Get own correction tickets.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/attendance-corrections/my\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "id": 1,
                  "attendance_id": 123,
                  "field": "punch_in",
                  "requested_time": "2026-07-10T09:30:00Z",
                  "status": "pending"
                }
              ]
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    }
  ]
};

export default flutterAppData;
