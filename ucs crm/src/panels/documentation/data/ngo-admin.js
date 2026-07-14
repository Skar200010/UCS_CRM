const ngoAdminData = {
  "id": "ngo-admin",
  "title": "NGO Admin Panel",
  "icon": "Building",
  "roles": [
    "admin"
  ],
  "description": "NGO-specific administration for donor CRM, FRO worker assignments, station management, collections, targets, and daily operations.",
  "keyFeatures": [
    "Full donor CRM with search, filter, transaction history",
    "FRO station assignment and reassignment with data transfer",
    "New donor data bulk distribution to FROs",
    "Suspense resolution: link to donor or mark unmatched",
    "Call analytics with FRO-level performance metrics",
    "Alert management with acknowledge/resolve workflow",
    "Master search across donors, FROs, stations, and leads"
  ],
  "screens": [
    {
      "name": "Dashboard",
      "path": "/ngo-admin/dashboard",
      "description": "NGO admin dashboard with KPIs",
      "features": [
        {
          "name": "Dashboard APIs",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/ngo-admin/dashboard",
              "auth": "admin, super_admin",
              "description": "Get NGO admin dashboard with KPIs, collection stats, FRO performance.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/ngo-admin/dashboard\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "totalDonors": 5000,
                "assignedFROs": 10,
                "monthlyCollection": 250000,
                "pendingFollowUps": 45
              }
            },
            {
              "method": "GET",
              "path": "/api/ngo-admin/dashboard/daily-target",
              "auth": "admin, super_admin",
              "description": "Get daily collection target and progress.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/ngo-admin/dashboard/daily-target\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "dailyTarget": 10000,
                "collectedToday": 7500,
                "percentage": 75
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Donor CRM",
      "path": "/ngo-admin/donor-crm",
      "description": "Full donor CRM with CRUD",
      "features": [
        {
          "name": "Donor CRM APIs",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/ngo-admin/donors",
              "auth": "admin, super_admin",
              "description": "Get paginated donor list.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/ngo-admin/donors?page=1&limit=50\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "donors": [
                  {
                    "id": 1,
                    "name": "John Donor",
                    "mobile_number": "9876543210",
                    "total_amount": 15000
                  }
                ],
                "total": 5000
              }
            },
            {
              "method": "GET",
              "path": "/api/ngo-admin/master-search",
              "auth": "admin, super_admin",
              "description": "Search across all entities (donors, FROs, stations).",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/ngo-admin/master-search?q=john\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "donors": [],
                "fros": [],
                "stations": []
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "Stations",
      "path": "/ngo-admin/station-mgmt",
      "description": "Manage geographic stations and FRO assignments",
      "features": [
        {
          "name": "Station Management",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/ngo-admin/stations",
              "auth": "admin, super_admin",
              "description": "List all stations.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/ngo-admin/stations\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": [
                {
                  "station": "Area A",
                  "ngo_id": 1,
                  "fro_count": 3
                }
              ]
            },
            {
              "method": "POST",
              "path": "/api/ngo-admin/station-assignments",
              "auth": "admin, super_admin",
              "description": "Assign FRO to station.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/ngo-admin/station-assignments\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"fro_worker_id\":1,\"ngo_id\":1,\"station\":\"Area A\"}'",
              "requestBody": {
                "fro_worker_id": 1,
                "ngo_id": 1,
                "station": "Area A"
              },
              "responseBody": {
                "message": "FRO assigned to station"
              }
            }
          ],
          "businessRules": [],
          "workflow": []
        }
      ]
    },
    {
      "name": "New Data",
      "path": "/ngo-admin/new-data",
      "description": "View and distribute new unassigned donor data",
      "features": [
        {
          "name": "Data Distribution",
          "description": "",
          "apis": [
            {
              "method": "GET",
              "path": "/api/ngo-admin/new-data",
              "auth": "admin, super_admin",
              "description": "Get unassigned donor data ready for distribution.",
              "curl": "curl -X GET \"https://ucs-crm-backend.vercel.app/api/ngo-admin/new-data\" -H \"Authorization: Bearer <token>\"",
              "requestBody": null,
              "responseBody": {
                "count": 150,
                "donors": [
                  {
                    "id": 1001,
                    "name": "New Donor"
                  }
                ]
              }
            },
            {
              "method": "POST",
              "path": "/api/ngo-admin/new-data/distribute",
              "auth": "admin, super_admin",
              "description": "Distribute new donor data to specific FROs.",
              "curl": "curl -X POST \"https://ucs-crm-backend.vercel.app/api/ngo-admin/new-data/distribute\" -H \"Content-Type: application/json\" -H \"Authorization: Bearer <token>\" -d '{\"fro_worker_id\":1,\"donor_ids\":[1001,1002,1003]}'",
              "requestBody": {
                "fro_worker_id": 1,
                "donor_ids": [
                  1001,
                  1002,
                  1003
                ]
              },
              "responseBody": {
                "message": "Distributed 3 donors to FRO",
                "count": 3
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

export default ngoAdminData;
