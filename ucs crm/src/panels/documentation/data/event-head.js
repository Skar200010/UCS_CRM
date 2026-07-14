const eventHeadData = {
  "id": "event-head",
  "title": "Event Head Panel",
  "icon": "Calendar",
  "roles": [
    "event_head",
    "Event Head",
    "Event Manager"
  ],
  "description": "End-to-end event lifecycle management including creation, approval workflow, asset/material management, volunteer coordination, expense tracking, and reports.",
  "keyFeatures": [
    "Event lifecycle: Draft/Submitted/Approved/Rejected/Completed/Closed",
    "Asset, material, expense, vehicle, and media management",
    "Volunteer registration, role assignment, attendance",
    "Beneficiary distribution tracking",
    "Checklist management with 8 predefined items",
    "Approval workflow: submit, approve, reject",
    "PDF and Excel report generation"
  ],
  "screens": [
    {
      "name": "Dashboard",
      "path": "/event-head/dashboard",
      "description": "Event metrics and KPIs",
      "features": [
        {
          "name": "Event Dashboard",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/event-head/events/dashboard",
              "auth": "authenticate",
              "description": "Get event dashboard with metrics.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/event-head/events/dashboard\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "totalEvents": 25,
                "upcomingEvents": 5,
                "completedEvents": 18,
                "totalBeneficiaries": 5000
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Events",
      "path": "/event-head/events",
      "description": "Full event CRUD with calendar and filters",
      "features": [
        {
          "name": "Event Management",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/event-head/events",
              "auth": "authenticate",
              "description": "List all events with filters.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/event-head/events\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "id": 1,
                  "title": "Food Drive",
                  "category": "Food Distribution",
                  "status": "Approved",
                  "start_date": "2026-07-20"
                }
              ]
            },
            {
              "method": "POST",
              "path": "/api/event-head/events",
              "auth": "authenticate",
              "description": "Create a new event.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/event-head/events\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"title\":\"Food Drive\",\"description\":\"Monthly distribution\",\"category\":\"Food Distribution\",\"start_date\":\"2026-07-20\",\"end_date\":\"2026-07-20\",\"location\":\"Mumbai\",\"ngo_id\":1,\"budget\":10000}'",
              "requestBody": {
                "title": "Food Drive",
                "description": "Monthly distribution",
                "category": "Food Distribution",
                "start_date": "2026-07-20",
                "end_date": "2026-07-20",
                "location": "Mumbai",
                "ngo_id": 1,
                "budget": 10000
              },
              "responseBody": {
                "id": 26,
                "status": "Draft",
                "message": "Event created"
              }
            },
            {
              "method": "PUT",
              "path": "/api/event-head/events/:id",
              "auth": "authenticate",
              "description": "Update event details.",
              "curl": "curl -X PUT \"https://ucs-crm-backend.vercel.app/api/event-head/events/1\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"title\":\"Updated Title\"}'",
              "requestBody": {
                "title": "Updated Title"
              },
              "responseBody": {
                "message": "Event updated"
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Approval",
      "path": "/event-head/approvals",
      "description": "Event approval workflow",
      "features": [
        {
          "name": "Approval Workflow",
          "description": "",
          "apis": [
            {
              "method": "POST",
              "path": "/api/event-head/events/:id/submit",
              "auth": "authenticate",
              "description": "Submit event for approval.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/event-head/events/1/submit\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "message": "Submitted for approval",
                "status": "Submitted"
              }
            },
            {
              "method": "PUT",
              "path": "/api/event-head/events/:id/approve",
              "auth": "authenticate",
              "description": "Approve event.",
              "curl": "curl -X PUT \"https://ucs-crm-backend.vercel.app/api/event-head/events/1/approve\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "message": "Event approved",
                "status": "Approved"
              }
            },
            {
              "method": "PUT",
              "path": "/api/event-head/events/:id/reject",
              "auth": "authenticate",
              "description": "Reject event with remark.",
              "curl": "curl -X PUT \"https://ucs-crm-backend.vercel.app/api/event-head/events/1/reject\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"remark\":\"Budget too high\"}'",
              "requestBody": {
                "remark": "Budget too high"
              },
              "responseBody": {
                "message": "Event rejected",
                "status": "Rejected"
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Assets",
      "path": "/event-head/assets",
      "description": "Event asset register",
      "features": [
        {
          "name": "Asset Management",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/event-head/assets",
              "auth": "authenticate",
              "description": "List all event assets.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/event-head/assets\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "id": 1,
                  "name": "Speakers",
                  "type": "Sound System",
                  "quantity": 2,
                  "condition": "Good"
                }
              ]
            },
            {
              "method": "POST",
              "path": "/api/event-head/assets",
              "auth": "authenticate",
              "description": "Create a new asset.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/event-head/assets\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"name\":\"Tables\",\"type\":\"Furniture\",\"quantity\":10,\"condition\":\"New\"}'",
              "requestBody": {
                "name": "Tables",
                "type": "Furniture",
                "quantity": 10,
                "condition": "New"
              },
              "responseBody": {
                "id": 20,
                "message": "Asset created"
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Volunteers",
      "path": "/event-head/volunteers",
      "description": "Volunteer management",
      "features": [
        {
          "name": "Volunteer CRUD",
          "description": "",
          "apis": [
            {
              "method": "POST",
              "path": "/api/event-head/volunteers",
              "auth": "authenticate",
              "description": "Register a volunteer for an event.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/event-head/volunteers\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"name\":\"Volunteer 1\",\"phone\":\"9876543210\",\"event_id\":1,\"role\":\"Coordinator\"}'",
              "requestBody": {
                "name": "Volunteer 1",
                "phone": "9876543210",
                "event_id": 1,
                "role": "Coordinator"
              },
              "responseBody": {
                "id": 50,
                "message": "Volunteer registered"
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

export default eventHeadData;
