const webPwaData = {
  "id": "web-pwa",
  "title": "Web PWA (Worker Attendance)",
  "icon": "Globe",
  "roles": [
    "*"
  ],
  "description": "Progressive Web Application for workers providing attendance, profile, financial services, notifications, and onboarding via the browser.",
  "keyFeatures": [
    "QR scanner + geolocation API punch-in",
    "Real-time dashboard with live clock and attendance rate",
    "PWA with service worker offline cache and iOS standalone",
    "Leave, advance, and loan application forms",
    "Attendance correction ticket submission",
    "11-step onboarding wizard",
    "Tailwind CSS v4 with safe-area-inset support"
  ],
  "screens": [
    {
      "name": "Authentication",
      "path": "/auth",
      "description": "Login for workers",
      "features": [
        {
          "name": "Worker Login",
          "description": "",
          "apis": [
            {
              "method": "POST",
              "path": "/api/auth/worker/login",
              "auth": "none",
              "description": "Login with identifier and password.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/auth/worker/login\" -H \"Content-Type: application/json\" -d '{\"identifier\":\"worker123\",\"password\":\"secret\"}'",
              "requestBody": {
                "identifier": "worker123",
                "password": "secret"
              },
              "responseBody": {
                "token": "jwt_string",
                "worker": {
                  "id": 1,
                  "name": "John"
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
      "name": "Attendance",
      "path": "/attendance",
      "description": "QR + GPS punch in/out",
      "features": [
        {
          "name": "Punch Operations",
          "description": "",
          "apis": [
            {
              "method": "POST",
              "path": "/api/attendance/punch-in",
              "auth": "authenticate",
              "description": "Punch in with QR code and GPS.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/attendance/punch-in\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"code\":\"QR-OFFICE-001\",\"latitude\":19.0760,\"longitude\":72.8777}'",
              "requestBody": {
                "code": "QR-OFFICE-001",
                "latitude": 19.076,
                "longitude": 72.8777
              },
              "responseBody": {
                "message": "Punched in",
                "lateMinutes": 0
              }
            },
            {
              "method": "POST",
              "path": "/api/attendance/punch-out",
              "auth": "authenticate",
              "description": "Punch out with GPS.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/attendance/punch-out\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"latitude\":19.0760,\"longitude\":72.8777}'",
              "requestBody": {
                "latitude": 19.076,
                "longitude": 72.8777
              },
              "responseBody": {
                "message": "Punched out"
              }
            },
            {
              "method": "GET",
              "path": "/api/attendance/today",
              "auth": "authenticate",
              "description": "Today's attendance.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/attendance/today\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "attendance": {
                  "punch_in_time": "2026-07-13T10:00:00Z",
                  "punch_out_time": null
                }
              }
            },
            {
              "method": "GET",
              "path": "/api/attendance/history",
              "auth": "authenticate",
              "description": "Full history.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/attendance/history\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "date": "2026-07-13",
                  "status": "present",
                  "punch_in_time": "10:00",
                  "punch_out_time": "19:00"
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
      "description": "View and edit profile",
      "features": [
        {
          "name": "Profile",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/workers/me",
              "auth": "authenticate",
              "description": "Get my profile.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/workers/me\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "worker": {
                  "id": 1,
                  "name": "John"
                }
              }
            },
            {
              "method": "PUT",
              "path": "/api/workers/me",
              "auth": "authenticate",
              "description": "Update profile.",
              "curl": "curl -X PUT \"https://ucs-crm-backend.vercel.app/api/workers/me\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"name\":\"John Updated\"}'",
              "requestBody": {
                "name": "John Updated"
              },
              "responseBody": {
                "message": "Updated"
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
      "path": "/leaves",
      "description": "Apply and view leaves",
      "features": [
        {
          "name": "Leaves",
          "description": "",
          "apis": [
            {
              "method": "POST",
              "path": "/api/leaves/apply",
              "auth": "authenticate",
              "description": "Apply leave.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/leaves/apply\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"type\":\"full_day\",\"leave_date\":\"2026-07-15\",\"reason\":\"Personal\"}'",
              "requestBody": {
                "type": "full_day",
                "leave_date": "2026-07-15",
                "reason": "Personal"
              },
              "responseBody": {
                "message": "Leave applied"
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Loans",
      "path": "/loans",
      "description": "Apply for advances/loans",
      "features": [
        {
          "name": "Loans",
          "description": "",
          "apis": [
            {
              "method": "POST",
              "path": "/api/advances/apply",
              "auth": "authenticate",
              "description": "Apply advance.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/advances/apply\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"amount\":2000,\"reason\":\"Travel\"}'",
              "requestBody": {
                "amount": 2000,
                "reason": "Travel"
              },
              "responseBody": {
                "message": "Applied"
              }
            },
            {
              "method": "POST",
              "path": "/api/loans/apply",
              "auth": "authenticate",
              "description": "Apply loan.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/loans/apply\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"amount\":5000,\"reason\":\"Medical\"}'",
              "requestBody": {
                "amount": 5000,
                "reason": "Medical"
              },
              "responseBody": {
                "message": "Applied"
              }
            },
            {
              "method": "GET",
              "path": "/api/loans/my",
              "auth": "authenticate",
              "description": "My loans.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/loans/my\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "id": 1,
                  "type": "advance",
                  "amount": 2000,
                  "status": "approved"
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
      "name": "Tickets",
      "path": "/tickets",
      "description": "Attendance correction tickets",
      "features": [
        {
          "name": "Tickets",
          "description": "",
          "apis": [
            {
              "method": "POST",
              "path": "/api/attendance-corrections",
              "auth": "authenticate",
              "description": "Raise ticket.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/attendance-corrections\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"attendance_id\":123,\"date\":\"2026-07-10\",\"field\":\"punch_in\",\"requested_time\":\"2026-07-10T09:30:00Z\",\"reason\":\"Forgot\"}'",
              "requestBody": {
                "attendance_id": 123,
                "date": "2026-07-10",
                "field": "punch_in",
                "requested_time": "2026-07-10T09:30:00Z",
                "reason": "Forgot"
              },
              "responseBody": {
                "id": 1,
                "status": "pending"
              }
            },
            {
              "method": "GET",
              "path": "/api/attendance-corrections/my",
              "auth": "authenticate",
              "description": "My tickets.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/attendance-corrections/my\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "id": 1,
                  "status": "pending"
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
      "name": "Onboarding",
      "path": "/onboarding",
      "description": "Employee onboarding wizard",
      "features": [
        {
          "name": "Onboarding",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/onboarding/status",
              "auth": "authenticate",
              "description": "Check status.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/onboarding/status\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "onboarding_completed": false
              }
            },
            {
              "method": "POST",
              "path": "/api/onboarding/submit",
              "auth": "authenticate",
              "description": "Submit onboarding.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/onboarding/submit\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"name\":\"John\"}'",
              "requestBody": {
                "name": "John",
                "email": "john@test.com"
              },
              "responseBody": {
                "message": "Done"
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

export default webPwaData;
