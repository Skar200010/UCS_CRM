const authData = {
  id: 'auth',
  title: 'Global Auth System',
  icon: 'Key',
  roles: ['*'],
  description: 'Centralized authentication system used by all CRM panels, workers, and the WhatsApp CRM. Supports JWT-based auth with multiple login strategies and role-based access control.',
  architectureNotes: `The UCS CRM authentication system is built on two parallel auth providers:

1. Supabase Auth (Primary for WhatsApp CRM):
   - Email/password authentication via supabase.auth.signInWithPassword()
   - Handles session management, email verification, password reset
   - Linked to public.users via the handle_new_user() database trigger
   - Used only by the WhatsApp CRM standalone project

2. Custom Express Backend Auth (Used by ALL CRM Panels):
   - JWT-based authentication with bcryptjs password hashing
   - Three endpoints for different user types:
     a. /api/auth/login — Unified login for panel users, HR, and workers
     b. /api/auth/admin/login — Super admin login (env-based credentials)
     c. /api/auth/worker/login — Worker/FRO login (by login_id)
   - Rate limited: 10 requests per 15 minute window
   - JWT tokens include: { id, name, email, role, ngo_id }
   - Tokens use 100-year expiry (practically never expire)
   - Role hierarchy: super_admin > admin > hr > accounts > fro > worker

Auth Flow for Main CRM:
- User visits any panel → redirected to Login page if not authenticated
- Login page sends credentials to appropriate endpoint based on user type
- Server verifies against database (bcrypt) or env vars (super_admin)
- On success, returns JWT token + user object + role
- Token stored in localStorage/context for subsequent API calls
- Auth middleware on each backend route verifies JWT and checks role permissions

Auth Flow for WhatsApp CRM:
- Uses Supabase Auth with dual fallback to custom API
- Auto-provisions user records via RPC (get_whatsapp_user / create_whatsapp_user)
- Auto-promotes first verified user to admin role`,
  keyFeatures: [
    'JWT-based authentication with 100-year token expiry',
    'Three login endpoints: unified, admin-only, worker-only',
    'Rate limiting: 10 requests per 15 minutes',
    'Bcryptjs password hashing for all stored credentials',
    'Role-based access control (RBAC) on every backend route',
    'Rate limiting applied at router level via express-rate-limit',
    'Super admin login via environment variables (no DB lookup)',
    'Dual auth system: Supabase Auth + Custom Express JWT',
    'Auto-provisioning of user records on first login (WhatsApp CRM)',
    'Auto-promotion of first verified user to admin (WhatsApp CRM)',
  ],
  screens: [
    {
      name: 'Main CRM Auth',
      path: '/auth/main',
      description: 'Authentication endpoints used by the main CRM panels (Super Admin, HR, Accounts, FRO, NGO Admin, Recruiter, Event Head).',
      logicDescription: `The Main CRM uses a custom JWT-based authentication system built on Express.js with bcryptjs. It supports three distinct login flows:

1. Unified Login (/api/auth/login):
   - Accepts "identifier" (can be email or login_id) + "password"
   - First checks against ADMIN_EMAIL/ADMIN_PASSWORD env vars (super_admin bypass)
   - Then checks USER_EMAIL/USER_PASSWORD env vars (demo user bypass)
   - Then queries users table by email (panel users: admin, hr, accounts, etc.)
   - Then queries hr table by email (HR department users)
   - Then queries workers table by login_id (worker/FRO login)
   - Returns JWT token with user role, id, name, and ngo_id

2. Admin Login (/api/auth/admin/login):
   - Super admin only — checks against ADMIN_EMAIL/ADMIN_PASSWORD env vars
   - Strict rate limiting
   - Returns super_admin role

3. Worker Login (/api/auth/worker/login):
   - For FRO/worker users who log in with login_id (not email)
   - Uses getWorkerByLoginId() model function
   - Verifies password with bcrypt.compare()
   - Returns worker details with department info

All endpoints use the authLimiter middleware configured at 10 requests per 15 minutes to prevent brute force attacks.`,
      features: [
        {
          name: 'Unified Login',
          description: 'Primary login endpoint for all panel users. Accepts email or login_id.',
          apis: [
            {
              method: 'POST',
              path: '/api/auth/login',
              auth: 'None (public, rate limited)',
              description: 'Unified login. Accepts "identifier" (email or login_id) + "password". Supports super_admin (env), panel users (users table), HR users, and workers.',
              curl: 'curl -X POST "https://ucs-crm-backend.vercel.app/api/auth/login" -H "Content-Type: application/json" -d \'{"identifier":"admin@ngo.com","password":"secret"}\'',
              requestBody: { identifier: 'admin@ngo.com', password: 'secret' },
              responseBody: { token: 'eyJhbGciOiJIUzI1NiIs...', role: 'super_admin', user: { id: 1, name: 'Admin', email: 'admin@ngo.com', role: 'super_admin' }, message: 'Login successful' },
            },
          ],
          businessRules: ['Rate limited: 10 requests per 15 minutes', 'Identifier can be email OR login_id', 'Super admin bypass uses env vars, no DB', 'Bcrypt comparison for all DB-stored passwords', 'JWT includes id, ngo_id, email, role, name'],
          workflow: [
            { actor: 'User', action: 'Enters email/login_id and password on login form' },
            { actor: 'System', action: 'Rate limiter checks request count (max 10/15min)' },
            { actor: 'System', action: 'Checks env-based super admin credentials first' },
            { actor: 'System', action: 'If email: queries users table, then HR table' },
            { actor: 'System', action: 'If not email: queries workers table by login_id' },
            { actor: 'System', action: 'Verifies password with bcrypt.compare()' },
            { actor: 'System', action: 'Generates JWT with user payload, returns to client' },
          ],
          logicDescription: `The unified login endpoint is designed to handle all user types through a single interface. The server determines the user type by:
- Checking if the identifier contains "@" (email) or not (login_id)
- For emails: first checks env-based super admin, then users table, then HR table
- For login_ids: queries workers table directly

This design simplifies the frontend — all panels can use the same login form and endpoint, while the backend routes to the correct authentication strategy. The 100-year token expiry eliminates the need for token refresh flows, simplifying the frontend state management.`,
        },
        {
          name: 'Admin Login',
          description: 'Super admin specific login using environment-configured credentials.',
          apis: [
            {
              method: 'POST',
              path: '/api/auth/admin/login',
              auth: 'None (public, rate limited)',
              description: 'Super admin login. Checks credentials against ADMIN_EMAIL and ADMIN_PASSWORD environment variables.',
              curl: 'curl -X POST "https://ucs-crm-backend.vercel.app/api/auth/admin/login" -H "Content-Type: application/json" -d \'{"email":"admin@ucs.org","password":"admin_secret"}\'',
              requestBody: { email: 'admin@ucs.org', password: 'admin_secret' },
              responseBody: { token: 'eyJhbGciOiJIUzI1NiIs...', role: 'super_admin', user: { name: 'Super Admin', email: 'admin@ucs.org', role: 'super_admin' }, message: 'Login successful' },
            },
          ],
          businessRules: ['Credentials stored in ADMIN_EMAIL and ADMIN_PASSWORD env vars', 'No database lookup — purely env-based', 'Rate limited same as unified login', 'Role always set to super_admin'],
          workflow: [
            { actor: 'Super Admin', action: 'Enters email and password on admin login page' },
            { actor: 'System', action: 'Compares against ADMIN_EMAIL/ADMIN_PASSWORD env vars' },
            { actor: 'System', action: 'On match: generates JWT with super_admin role' },
            { actor: 'System', action: 'On mismatch: returns 401 Unauthorized' },
          ],
          logicDescription: `The admin-only endpoint is intentionally separate from the unified login to provide an additional security layer. Super admin credentials are configured via environment variables (not stored in the database), making them manageable through deployment infrastructure (Vercel env vars, CI/CD secrets).

This design means:
- No database query needed — faster login for the most privileged user
- Credentials can be rotated without database migrations
- No risk of super admin credentials leaking via DB compromise
- Separate rate limiting counters for admin vs regular user attempts`,
        },
        {
          name: 'Worker Login',
          description: 'Worker/FRO login using login_id (not email) and password.',
          apis: [
            {
              method: 'POST',
              path: '/api/auth/worker/login',
              auth: 'None (public, rate limited)',
              description: 'Worker/FRO login. Accepts login_id (e.g., "fro2026") + password. Authenticates against workers table.',
              curl: 'curl -X POST "https://ucs-crm-backend.vercel.app/api/auth/worker/login" -H "Content-Type: application/json" -d \'{"identifier":"fro2026","password":"worker_secret"}\'',
              requestBody: { identifier: 'fro2026', password: 'worker_secret' },
              responseBody: { token: 'eyJhbGciOiJIUzI1NiIs...', role: 'fro', user: { id: 5, name: 'Rajesh Kumar', department: 'FRO' }, message: 'Login successful' },
            },
          ],
          businessRules: ['Accepts login_id (not email) as identifier', 'Queries workers table via getWorkerByLoginId()', 'Bcrypt compare against workers.password field', 'Rate limited same as other endpoints'],
          workflow: [
            { actor: 'Worker/FRO', action: 'Enters login_id and password on worker login page' },
            { actor: 'System', action: 'Queries workers table by login_id' },
            { actor: 'System', action: 'If not found: returns 401' },
            { actor: 'System', action: 'Verifies password with bcrypt.compare()' },
            { actor: 'System', action: 'On success: generates JWT with worker role and details' },
          ],
          logicDescription: `Worker login is separate because workers use login_ids (not emails) for authentication. This is typical in field operations where workers may not have email access. The login_id is a short, memorable identifier (e.g., "fro2026") assigned during worker onboarding.

The worker login also serves as the authentication entry point for the FRO WhatsApp Chat system, which uses a separate /api/whatsapp/fro-login endpoint that authenticates against the same workers table but returns WhatsApp-specific account assignment data.`,
        },
      ],
    },
    {
      name: 'Auth Middleware',
      path: '/auth/middleware',
      description: 'JWT verification and role-based authorization middleware used across all backend routes.',
      logicDescription: `The auth middleware (backend/src/middleware/authMiddleware.js) is the gatekeeper for all protected API routes. It:

1. Extracts the JWT from the Authorization header (Bearer token)
2. Verifies the token using jsonwebtoken.verify() with JWT_SECRET
3. Decodes the payload to get user id, role, ngo_id, and name
4. Attaches the decoded user to req.user for downstream use
5. Optionally checks role-based access for specific endpoints

Role Hierarchy: super_admin > admin > hr > accounts > fro/worker > user

The middleware is applied at the router level, with each route file specifying allowed roles. For example:
- Super Admin routes: only super_admin role
- HR routes: super_admin, admin, hr roles
- Worker routes: fro, worker roles

This ensures that even if a user has a valid JWT, they can only access data and operations permitted by their role.`,
      features: [
        {
          name: 'JWT Verification',
          description: 'Middleware that verifies JWT tokens on all protected routes.',
          apis: [],
          businessRules: ['JWT extracted from "Authorization: Bearer <token>" header', 'Token verified with JWT_SECRET env variable', 'Decoded payload attached to req.user', 'Missing/invalid token returns 401 Unauthorized'],
          workflow: [
            { actor: 'Client', action: 'Sends request with Authorization: Bearer <jwt>' },
            { actor: 'Middleware', action: 'Extracts token from header' },
            { actor: 'Middleware', action: 'Verifies token with jwt.verify(token, JWT_SECRET)' },
            { actor: 'Middleware', action: 'If invalid/expired: returns 401' },
            { actor: 'Middleware', action: 'If valid: attaches decoded user to req.user, calls next()' },
          ],
          logicDescription: `JWT verification is the first line of defense. The middleware runs before every protected route handler. It uses synchronous verification (jwt.verify) which is fast and doesn't require a database lookup, making it highly performant for high-traffic APIs.

The 100-year token expiry means tokens effectively never expire during a user's session. This eliminates the complexity of refresh token flows but means compromised tokens are valid until explicitly invalidated (which would require changing the JWT_SECRET).`,
        },
      ],
    },
  ],
}

export default authData
