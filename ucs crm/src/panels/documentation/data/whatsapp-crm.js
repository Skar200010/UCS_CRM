const whatsappCrmData = {
  id: 'whatsapp-crm',
  title: 'WhatsApp CRM',
  icon: 'MessageCircle',
  roles: ['admin', 'agent', 'viewer'],
  description: 'Standalone WhatsApp Business CRM platform for multi-NGO messaging, contact management, automation flows, template management, analytics, and deal pipeline tracking.',
  architectureNotes: `The WhatsApp CRM is a React SPA built with Vite, TypeScript, and Tailwind CSS, backed by Supabase (PostgreSQL + Realtime) and the Meta/Facebook WhatsApp Cloud API.

Architecture Layers:
- Frontend: React 19 + React Router DOM with protected routes. State managed via Zustand for auth and Supabase direct queries for data. Recharts for analytics, React Flow (@xyflow/react) for the automation flow builder.
- Auth: Dual authentication — primary via Supabase Auth (email/password), fallback via a custom Express API (VITE_API_URL). Roles: admin, agent, viewer. Auto-promotion on email confirmation.
- Database: 15+ tables on Supabase PostgreSQL (contacts, conversations, messages, whatsapp_accounts, whatsapp_templates, automation_flows, deals, pipelines, quick_replies, api_keys, media_library, whatsapp_webhook_logs, tenants).
- Messaging Pipeline: Inbound messages arrive via Meta webhook → webhook-whatsapp Edge Function processes them → persists to DB → triggers automation flows. Outbound messages go through send-message / send-template Edge Functions → Meta Graph API → delivery/read status via webhook.
- Realtime: Supabase Realtime channels keep the inbox UI in sync without polling.
- External Integrations: Meta Graph API v19/v23 (messaging, templates, WABA management), Supabase Storage (media files).
- Multi-Tenancy: Data isolated by tenant_id with RLS policies. Each tenant can have multiple WhatsApp Business Accounts across different NGO projects (BSCT, AFLF, MAAN).`,
  keyFeatures: [
    'Full WhatsApp Inbox with real-time messaging and conversation labeling',
    'Multi-NGO WhatsApp account management (BSCT, AFLF, MAAN)',
    'Visual drag-and-drop automation flow builder (React Flow)',
    'WhatsApp message template creation and management via Meta API',
    'Contact management with CSV import and detailed profiles',
    'Deal pipeline with Kanban board tracking',
    'Analytics dashboard with Recharts visualizations',
    'Team management with role-based access (admin/agent/viewer)',
    'Quick replies organized by NGO and category',
    'Media library for image/PDF storage and sharing',
    'Admin panel for tenant oversight, system health, webhook logs',
    'Batch user import for team onboarding',
    'API key management for external integrations',
    'Real-time conversation search across all messages',
  ],
  screens: [
    {
      name: 'Auth',
      path: '/whatsapp/auth',
      description: 'Login and registration screens for WhatsApp CRM access.',
      logicDescription: `Authentication uses a dual-strategy approach. Primary auth is via Supabase Auth (email/password with JWT sessions). If Supabase is unavailable, the system falls back to a custom Express API endpoint.

On successful sign-in, the system:
1. Authenticates via Supabase Auth (signInWithPassword)
2. On success, fetches or creates the user record in the application's users table via get_whatsapp_user / create_whatsapp_user RPCs
3. If the user's email is confirmed and role is agent/viewer, auto-promotes to admin
4. Caches the session in localStorage (ucs_token, ucs_user) for persistence across page refreshes
5. Loads Meta WhatsApp credentials from the tenant's settings

Registration creates the Supabase Auth user and returns a verification email link. The user must verify their email before first login.`,
      features: [
        {
          name: 'Login',
          description: 'Email/password authentication for WhatsApp CRM.',
          apis: [
            {
              method: 'POST',
              path: 'supabase.auth.signInWithPassword()',
              auth: 'None (public)',
              description: 'Primary authentication via Supabase Auth.',
              curl: 'N/A (Supabase client SDK)',
              requestBody: { email: 'user@example.com', password: '••••••••' },
              responseBody: { user: { id: 'uuid', email: 'user@example.com' }, session: { access_token: 'jwt...' } },
            },
            {
              method: 'POST',
              path: '{VITE_API_URL}/auth/login',
              auth: 'None (public)',
              description: 'Fallback authentication when Supabase is unavailable.',
              curl: 'curl -X POST "https://ucs-crm-backend.vercel.app/auth/login" -H "Content-Type: application/json" -d \'{"email":"user@example.com","password":"secret"}\'',
              requestBody: { email: 'user@example.com', password: 'secret' },
              responseBody: { token: 'jwt...', user: { id: 1, email: 'user@example.com', role: 'admin' } },
            },
          ],
          businessRules: ['First-time login auto-creates user record in public.users via RPC', 'Agents/viewers are auto-promoted to admin on email confirmation', 'Session persisted in localStorage, survives page refresh', 'Meta credentials loaded from tenant settings on each login'],
          workflow: [
            { actor: 'User', action: 'Enters email/password on login form' },
            { actor: 'System', action: 'Attempts Supabase Auth signInWithPassword', api: 'supabase.auth.signInWithPassword()' },
            { actor: 'System', action: 'On failure, falls back to custom API auth/login' },
            { actor: 'System', action: 'Fetches/creates user record via get_whatsapp_user RPC' },
            { actor: 'System', action: 'Auto-promotes to admin if email confirmed' },
            { actor: 'System', action: 'Loads Meta credentials and redirects to dashboard' },
          ],
          logicDescription: `The dual-auth strategy ensures resilience. Supabase Auth is always preferred for its built-in session management and security. The custom API fallback exists for backward compatibility and environments where Supabase Auth might be temporarily unavailable.

Auto-promotion simplifies onboarding: when the first user from an organization signs up and verifies their email, they automatically become an admin, eliminating the need for a manual role assignment step. Future users from the same org can be added as agents/viewers by the admin.

Session persistence via localStorage ensures the user doesn't need to re-login on browser refresh, critical for a chat application where constant connectivity is expected.`,
        },
        {
          name: 'Register',
          description: 'New user registration with email verification flow.',
          apis: [
            {
              method: 'POST',
              path: 'supabase.auth.signUp()',
              auth: 'None (public)',
              description: 'Create a new user account via Supabase Auth. Sends verification email.',
              curl: 'N/A (Supabase client SDK)',
              requestBody: { email: 'user@example.com', password: 'secret', options: { data: { first_name: 'John', last_name: 'Doe', org_name: 'NGO Name' } } },
              responseBody: { user: { id: 'uuid', email: 'user@example.com' }, session: null, needsVerification: true },
            },
            {
              method: 'POST',
              path: '/api/auth/register',
              auth: 'None (public)',
              description: 'Custom backend user registration (fallback/alternative).',
              curl: 'curl -X POST "https://ucs-crm-backend.vercel.app/api/auth/register" -H "Content-Type: application/json" -d \'{"name":"John Doe","email":"john@ngo.com","password":"secret","role":"agent"}\'',
              requestBody: { name: 'John Doe', email: 'john@ngo.com', password: 'secret', role: 'agent' },
              responseBody: { message: 'User created', user: { id: 1, email: 'john@ngo.com', role: 'agent' } },
            },
          ],
          businessRules: ['Email verification required before first login', 'Registration collects firstName, lastName, orgName in WA standalone version', 'Auto-triggers handle_new_user() database trigger on Supabase Auth insert'],
          workflow: [
            { actor: 'User', action: 'Fills registration form with email, password, name, org' },
            { actor: 'System', action: 'Calls supabase.auth.signUp() to create auth record' },
            { actor: 'System', action: 'Sends verification email via Supabase Auth' },
            { actor: 'User', action: 'Checks email and clicks verification link' },
            { actor: 'System', action: 'Auto-creates public.users record via handle_new_user trigger' },
            { actor: 'User', action: 'Logs in with verified credentials' },
          ],
          logicDescription: `Registration creates a Supabase Auth user record, which triggers an automatic insert into the public.users table via the handle_new_user() database trigger (migration 025_supabase_auth_flow.sql). The trigger extracts the user's name from raw_user_meta_data (falls back to email prefix) and sets the default role to 'viewer'.

The WA standalone version collects extra fields (firstName, lastName, orgName) passed as user_metadata to Supabase, enabling richer profile creation on first signup.

After registration, the user must verify their email before logging in. On first login, the system detects the confirmed email and auto-promotes the user to admin (making them the org administrator).`,
        },
      ],
    },
    {
      name: 'Dashboard',
      path: '/whatsapp/',
      description: 'Main overview dashboard showing key metrics, WhatsApp number status, and template performance.',
      logicDescription: `The dashboard aggregates data from multiple sources: Supabase for conversation/message counts, and Meta Graph API for WABA details and template analytics. This hybrid approach means some data loads instantly (Supabase queries) while others may have a slight delay (Meta API calls).

Key metrics shown:
- Conversations: Total and open conversation counts
- Contacts: Total contact database size
- Messages Today: Outbound message volume for the current day
- Closed Today: Conversations closed today
- WhatsApp Number Status: Green/yellow/red health indicator for each connected phone number
- Template Performance: Approval rates, usage counts per template
- Message Usage & Pricing: Volume tiers, associated costs`,
      features: [
        {
          name: 'Dashboard Metrics',
          description: 'Aggregated KPIs and WhatsApp account status.',
          apis: [
            {
              method: 'GET',
              path: '/rest/v1/conversations?select=count',
              auth: 'Supabase anon key (RLS)',
              description: 'Count total/open conversations.',
              curl: 'N/A (Supabase client SDK)',
              requestBody: null,
              responseBody: { count: 45 },
            },
            {
              method: 'GET',
              path: 'graph.facebook.com/v19.0/{waba_id}',
              auth: 'Meta Access Token',
              description: 'Get WABA details (name, status, etc.).',
              curl: 'curl -X GET "https://graph.facebook.com/v19.0/123456789?fields=name&access_token=EA..."',
              requestBody: null,
              responseBody: { name: 'Mann Care Foundation', id: '123456789' },
            },
          ],
          businessRules: ['Conversation counts are real-time via Supabase queries', 'Meta API data may be cached to avoid rate limits', 'Template analytics fetched per-WABA with analytics field'],
          workflow: [
            { actor: 'User', action: 'Navigates to dashboard' },
            { actor: 'System', action: 'Queries Supabase for conversation/contact/message counts' },
            { actor: 'System', action: 'Fetches WABA details from Meta Graph API' },
            { actor: 'System', action: 'Fetches template analytics and phone number status' },
            { actor: 'System', action: 'Renders stat cards, charts, and status indicators' },
          ],
          logicDescription: `The dashboard serves as the operational command center. Supabase queries provide near-instant counts, while Meta API calls for WABA status and template analytics may take 1-3 seconds. The UI handles this gracefully by showing loading skeletons for API-dependent sections.

The message usage & pricing table is critical for cost management — WhatsApp charges per conversation category (marketing, utility, service, authentication). The dashboard breaks down usage by category, helping admins estimate monthly costs.`,
        },
      ],
    },
    {
      name: 'Inbox',
      path: '/whatsapp/inbox',
      description: 'Real-time WhatsApp chat interface with conversation management, message threads, quick replies, and media sharing.',
      logicDescription: `The Inbox is the core of the WhatsApp CRM — a full-featured chat interface designed for high-volume multi-agent environments.

Architecture:
- Left panel: Scrollable conversation list with search, label filter pills, and a "+ New Conversation" button
- Right panel: Message thread with bubble UI (outbound green, inbound grey), message composer, quick reply bar, media preview
- Real-time: Supabase Realtime channels push new messages and conversation updates without polling
- Conversation labels: Color-coded tags (important, followup, new, completed, spam, urgent) for triage
- Message search: Modal-based full-text search across all conversations using PostgreSQL ILIKE
- Quick replies: NGO-specific pre-written responses organized by category (Info, QR Code, Receipt, Other)

The messaging pipeline works as:
1. Outbound: MessageComposer → supabase.functions.invoke('send-message') → Meta Graph API → message record inserted with wa_message_id
2. Inbound: Meta webhook → webhook-whatsapp Edge Function → messages table → Realtime channel pushes to UI
3. Status updates: Meta webhook (sent/delivered/read/failed) → message status updated → UI reflects via Realtime

The 24-hour messaging window rule is critical: within 24h of the last customer message, any message type is allowed. After 24h, only template messages can be sent. The system handles this transparently — users just type and send; the Edge Function selects the appropriate API call based on the conversation state.`,
      features: [
        {
          name: 'Real-time Messaging',
          description: 'Send and receive WhatsApp messages with real-time updates.',
          apis: [
            {
              method: 'POST',
              path: 'supabase.functions.invoke(send-message)',
              auth: 'Supabase anon key',
              description: 'Send a text or media message via the send-message edge function.',
              curl: `curl -X POST "https://project.supabase.co/functions/v1/send-message" \\
  -H "Authorization: Bearer anon_key" \\
  -H "Content-Type: application/json" \\
  -d '{"conversationId":"uuid","messageText":"Hello!","phoneNumberId":"123456789"}'`,
              requestBody: { conversationId: 'uuid', messageText: 'Hello!', phoneNumberId: '123456789' },
              responseBody: { success: true, message: { id: 'uuid', status: 'queued' } },
            },
            {
              method: 'POST',
              path: 'supabase.functions.invoke(send-template)',
              auth: 'Supabase anon key',
              description: 'Send a pre-approved WhatsApp template message.',
              curl: `curl -X POST "https://project.supabase.co/functions/v1/send-template" \\
  -H "Authorization: Bearer anon_key" \\
  -d '{"templateName":"welcome","phone":"919876543210","params":["John"]}'`,
              requestBody: { templateName: 'welcome', phone: '919876543210', params: ['John'] },
              responseBody: { success: true, message: { id: 'uuid', message_type: 'template' }, conversationId: 'uuid' },
            },
          ],
          businessRules: ['Outbound messages queued with status "queued" then updated to "sent"/"failed"', 'Inbound messages create contacts if they do not exist', 'Conversations auto-created on first inbound message', '24-hour free-form window resets on each customer message', 'After 24h, only template messages allowed for outbound'],
          workflow: [
            { actor: 'Agent', action: 'Types message in composer and presses Enter' },
            { actor: 'System', action: 'Invokes send-message edge function' },
            { actor: 'Edge Function', action: 'Resolves WhatsApp account, inserts message record (queued)' },
            { actor: 'Edge Function', action: 'POSTs to Meta Graph API /messages endpoint' },
            { actor: 'Meta', action: 'Sends message to recipient, returns message ID' },
            { actor: 'Edge Function', action: 'Updates message status to "sent"', api: 'POST graph.facebook.com/v23.0/{phoneNumberId}/messages' },
            { actor: 'System', action: 'Realtime channel pushes update to UI' },
          ],
          logicDescription: `The real-time infrastructure uses Supabase Realtime channels subscribed to the messages and conversations tables. This means when a message is inserted by the webhook or edge function, all connected clients see it instantly without polling.

The 15-second polling fallback (seen in the FRO WhatsApp system) is not used here — this standalone CRM uses pure Realtime subscriptions for lower latency and better scalability.

Message status tracking is critical for operational visibility. Each message goes through: queued → sent → delivered → read. Failed messages show the error reason from Meta. This allows agents to know if their message was received and read by the customer.`,
          diagrams: {
            sequence: `sequenceDiagram
    participant Agent as FRO Agent
    participant UI as Chat UI
    participant EF as Edge Function
    participant Meta as Meta Graph API
    participant DB as Supabase DB
    participant RT as Realtime Channel

    Agent->>UI: Types message, presses Enter
    UI->>EF: POST supabase.functions.invoke('send-message')
    EF->>DB: Insert message (status: queued)
    EF->>Meta: POST graph/v23.0/{phoneId}/messages
    Meta-->>EF: { message_id: "wamid..." }
    EF->>DB: Update message (status: sent, wa_message_id)
    DB-->>RT: Trigger change
    RT-->>UI: Push new message
    UI->>Agent: Show sent message bubble`,
            architecture: `graph LR
    A[Meta Cloud API] -->|Webhook POST| B[webhook-whatsapp Edge Function]
    B -->|Process inbound| C[(Supabase DB)]
    B -->|Trigger| D[run-automation Edge Function]
    D -->|Execute flow| C
    E[Chat UI] -->|Invoke| F[send-message Edge Function]
    F -->|POST| A
    F -->|Insert outbound| C
    C -->|Realtime| E`,
          },
        },
      ],
    },
    {
      name: 'Contacts',
      path: '/whatsapp/contacts',
      description: 'Contact database management with CRUD operations, CSV import, and detailed contact profiles.',
      logicDescription: `Contacts are auto-created from inbound WhatsApp messages (via webhook) and can be manually added or imported via CSV. Each contact has:
- Basic info: name, phone (normalized), email, source (whatsapp/manual/import)
- Linked conversations: all conversation threads associated with this contact
- WA profile name: automatically captured from Meta's contact profile during webhook processing

Phone numbers are normalized (stripped of non-digit characters) to ensure consistent matching across conversations and deduplication.

CSV import supports bulk addition of contacts with phone numbers, names, and custom fields. The import validates phone numbers and provides error reporting for malformed entries.`,
      features: [
        {
          name: 'Contact CRUD',
          description: 'Create, read, update, and delete contacts with search.',
          apis: [
            {
              method: 'GET',
              path: '/rest/v1/contacts',
              auth: 'Supabase anon key (RLS)',
              description: 'List contacts with optional search/filter.',
              curl: 'N/A (Supabase client SDK)',
              requestBody: null,
              responseBody: [{ id: 'uuid', name: 'John Doe', phone: '919876543210', source: 'whatsapp', created_at: '2026-07-01T00:00:00Z' }],
            },
            {
              method: 'POST',
              path: '/rest/v1/contacts',
              auth: 'Supabase anon key (RLS)',
              description: 'Create a new contact.',
              curl: 'N/A (Supabase client SDK)',
              requestBody: { name: 'Jane Doe', phone: '919876543211', email: 'jane@example.com', source: 'manual' },
              responseBody: { id: 'uuid', name: 'Jane Doe', phone: '919876543211' },
            },
          ],
          businessRules: ['Phone numbers normalized (digits only) for dedup', 'Source tracks origin: whatsapp/manual/import', 'WA profile name auto-captured from Meta webhook contacts[]'],
          workflow: [
            { actor: 'Agent', action: 'Views contact list, searches by name/phone' },
            { actor: 'System', action: 'Queries Supabase contacts table with optional ILIKE filter' },
            { actor: 'Agent', action: 'Clicks contact to view detail and linked conversations' },
          ],
        },
      ],
    },
    {
      name: 'Pipeline',
      path: '/whatsapp/pipeline',
      description: 'Kanban-style deal tracking board for managing sales pipeline stages.',
      logicDescription: `The pipeline module implements a visual Kanban board for deal tracking. Deals move across stages (e.g., New → Contacted → Qualified → Proposal → Negotiation → Closed Won/Lost).

Each stage is a column with deal cards. Cards show deal name, value, associated contact, and stage. Dragging a card to a different column updates the deal's stage in the database.

The pipeline is designed for sales teams who want to track donor/partner commitments alongside the messaging inbox. Deals can be directly linked to conversations, providing context during chats.`,
      features: [
        {
          name: 'Pipeline Board',
          description: 'Kanban board with drag-and-drop deal management.',
          apis: [
            {
              method: 'GET',
              path: '/rest/v1/pipeline_stages',
              auth: 'Supabase anon key (RLS)',
              description: 'Fetch pipeline stages.',
              curl: 'N/A (Supabase client SDK)',
              requestBody: null,
              responseBody: [{ id: 'uuid', name: 'New', order: 0 }, { id: 'uuid', name: 'Qualified', order: 1 }],
            },
            {
              method: 'POST',
              path: '/rest/v1/deals',
              auth: 'Supabase anon key (RLS)',
              description: 'Create or update a deal.',
              curl: 'N/A (Supabase client SDK)',
              requestBody: { name: 'Sponsorship Deal', value: 50000, stage_id: 'uuid', contact_id: 'uuid' },
              responseBody: { id: 'uuid', name: 'Sponsorship Deal', value: 50000 },
            },
          ],
          businessRules: ['Stage order determined by pipeline_stages.order column', 'Deal values tracked in INR', 'Deals can be linked to contacts'],
          workflow: [
            { actor: 'Agent', action: 'Views pipeline board with stage columns' },
            { actor: 'Agent', action: 'Drags deal card to a different stage' },
            { actor: 'System', action: 'Updates deal.stage_id in Supabase' },
            { actor: 'Agent', action: 'Clicks + to create new deal via DealFormModal' },
          ],
        },
      ],
    },
    {
      name: 'Automations',
      path: '/whatsapp/automations',
      description: 'Visual drag-and-drop automation flow builder for creating WhatsApp message workflows.',
      logicDescription: `The automation system uses React Flow (@xyflow/react) to provide a visual drag-and-drop interface for building message workflows. This is a no-code tool that allows admins to create complex automated sequences triggered by inbound messages.

Architecture:
- Frontend: React Flow canvas with draggable node palette (left panel) and node property editor (right panel)
- Storage: Flows saved as JSON (nodes + edges) to automation_flows.flow_data
- Execution: The run-automation Edge Function reads the flow graph and executes it step by step

Supported node types:
1. Send Message: Sends a WhatsApp text message to the contact (supports template variables like {{message.text}}, {{contact.name}})
2. Wait/Delay: Pauses execution for a specified duration (seconds)
3. Condition: Branches based on conditions (equals, contains, greater_than, less_than) comparing context values against targets
4. Add Tag: Assigns a label/tag to the contact (stored in contact_tags + contact_tag_map)
5. Assign Agent: Assigns a user/agent to the conversation
6. API Call: Makes an outbound HTTP request (useful for integrating with external systems)

Flow execution logic:
1. Find the start node (node with no incoming edges)
2. Walk the graph following edges, executing each node
3. For conditions, evaluate the expression and follow the true/false path
4. Continue until no more outgoing edges or max steps reached
5. Log every step to automation_run_logs for debugging`,
      features: [
        {
          name: 'Flow Builder',
          description: 'Visual drag-and-drop automation flow builder.',
          apis: [
            {
              method: 'POST',
              path: 'supabase.functions.invoke(run-automation)',
              auth: 'Supabase anon key',
              description: 'Trigger an automation flow for a contact/conversation.',
              curl: `curl -X POST "https://project.supabase.co/functions/v1/run-automation" \\
  -H "Authorization: Bearer anon_key" \\
  -d '{"tenant_id":"uuid","contact_id":"uuid","conversation_id":"uuid","trigger_type":"inbound_message"}'`,
              requestBody: { tenant_id: 'uuid', contact_id: 'uuid', conversation_id: 'uuid', trigger_type: 'inbound_message', message: { text: 'Hello', from: '919876543210' } },
              responseBody: { runs: [{ flow_id: 'uuid', flow_name: 'Welcome Flow', status: 'completed', steps_executed: 3 }] },
            },
          ],
          businessRules: ['Flows triggered by inbound messages via webhook', 'Multiple flows can run per contact (ordered by priority)', 'Each step logged to automation_run_logs', 'Conditions support: equals, contains, greater_than, less_than'],
          workflow: [
            { actor: 'Admin', action: 'Creates new flow in FlowBuilderPage' },
            { actor: 'Admin', action: 'Drags nodes from palette to canvas, connects them' },
            { actor: 'Admin', action: 'Configures node properties (message text, conditions, etc.)' },
            { actor: 'Admin', action: 'Saves and activates the flow' },
            { actor: 'System', action: 'On inbound message, webhook POSTs to run-automation' },
            { actor: 'Edge Function', action: 'Loads flow graph, walks nodes, executes steps' },
          ],
          logicDescription: `The Flow Builder transforms complex messaging workflows into visual diagrams that non-technical admins can create and maintain. It's similar to tools like Zapier or Make but specialized for WhatsApp messaging.

Key design decisions:
- Node-based execution (not event-driven): The run-automation function loads the full flow graph and walks it synchronously, executing each node in sequence. This makes the execution model predictable and debuggable.
- Priority ordering: When multiple flows match a trigger, they run in priority order (highest to lowest), allowing admins to control the precedence of automation rules.
- Variable interpolation: Node configurations support template variables ({{message.text}}, {{contact.name}}, {{conversation_id}}) that are resolved at runtime from the trigger context, making flows reusable across different conversations.`,
        },
      ],
    },
    {
      name: 'Templates',
      path: '/whatsapp/templates',
      description: 'WhatsApp message template creation, management, and submission to Meta for approval.',
      logicDescription: `WhatsApp message templates are pre-approved message formats required by Meta for outbound-initiated conversations outside the 24-hour free-form window. This module manages the full lifecycle: creation → submission → approval/rejection → usage.

Template categories (determine pricing and use cases):
- Marketing: Promotional content, higher cost
- Utility: Transactional updates (order confirmations, receipts)
- Service: Customer service follow-ups
- Authentication: OTP codes

The template editor is a 3-step wizard:
1. Category & Type: Choose category and template type (text, media, interactive)
2. Components: Edit header (text/media), body (with {{variable}} placeholders), footer, buttons (URL, phone, quick reply, flow, copy code)
3. Review & Submit: Preview the template and submit to Meta Graph API for approval

Template statuses: draft → submitted → pending → approved / rejected. Only approved templates can be sent.`,
      features: [
        {
          name: 'Template Editor',
          description: '3-step wizard for creating and submitting WhatsApp templates.',
          apis: [
            {
              method: 'POST',
              path: 'graph.facebook.com/v19.0/{waba_id}/message_templates',
              auth: 'Meta Access Token',
              description: 'Submit a new template to Meta for approval.',
              curl: `curl -X POST "https://graph.facebook.com/v19.0/123456789/message_templates" \\
  -H "Authorization: Bearer EA..." \\
  -H "Content-Type: application/json" \\
  -d '{"name":"welcome_message","language":"en","category":"UTILITY","components":[{"type":"BODY","text":"Hello {{1}}, welcome to {{2}}!"}]}'`,
              requestBody: { name: 'welcome_message', language: 'en', category: 'UTILITY', components: [{ type: 'BODY', text: 'Hello {{1}}, welcome to {{2}}!' }] },
              responseBody: { id: '123456', name: 'welcome_message', status: 'PENDING' },
            },
            {
              method: 'POST',
              path: 'graph.facebook.com/v19.0/{meta_template_id}',
              auth: 'Meta Access Token',
              description: 'Update an existing template.',
              curl: 'curl -X POST "https://graph.facebook.com/v19.0/123456" -H "Authorization: Bearer EA..." -d \'{"components":[{"type":"BODY","text":"Updated body {{1}}"}]}\'',
              requestBody: { components: [{ type: 'BODY', text: 'Updated body {{1}}' }] },
              responseBody: { success: true },
            },
          ],
          businessRules: ['Only approved templates can be sent to customers', 'Template names must be unique per WABA', 'Variables use {{1}}, {{2}}, ... syntax in Meta format', 'Header supports text, image, video, document types', 'Buttons: URL, phone_number, quick_reply, flow, copy_code'],
          workflow: [
            { actor: 'Admin', action: 'Clicks "New Template" in TemplatesPage' },
            { actor: 'Admin', action: 'Selects category and type (Step 1)' },
            { actor: 'Admin', action: 'Edits components: header, body, footer, buttons (Step 2)' },
            { actor: 'Admin', action: 'Previews and submits to Meta (Step 3)' },
            { actor: 'Meta', action: 'Reviews template (hours to days), returns approved/rejected' },
            { actor: 'System', action: 'Updates status in whatsapp_templates table' },
          ],
          logicDescription: `Template management is critical for WhatsApp Business API compliance. Meta requires all outbound-initiated messages to use pre-approved templates, and each template goes through a review process.

The 3-step wizard guides users through the complex template creation process, which involves understanding Meta's component-based template structure. The live mobile preview on the right side shows exactly how the template will appear on a recipient's phone, reducing the risk of rejection due to formatting issues.

Template analytics (available in the Dashboard and Templates list) show usage metrics per template, helping admins identify which templates are most effective.`,
        },
      ],
    },
    {
      name: 'Analytics',
      path: '/whatsapp/analytics',
      description: 'Analytics dashboard with charts for message volume, conversation trends, contact growth, and deal pipeline.',
      logicDescription: `The Analytics module uses Recharts (React charting library) to visualize WhatsApp CRM metrics. It provides insights across five dimensions:

1. Message Volume (Area Chart, 30 days): Daily inbound/outbound message counts, showing overall engagement trends
2. Conversations (Bar Chart): New conversations per day, tracking growth and seasonality
3. Contact Growth (Line Chart): Cumulative contact database growth over time
4. Deal Pipeline (Pie Chart): Distribution of deals across pipeline stages, showing value concentration
5. Message Breakdown (Pie Chart): Inbound vs outbound vs template vs failed message distribution

All data is sourced from Supabase table queries with date-range filtering. Charts update daily (not real-time) since analytics queries can be resource-intensive.`,
      features: [
        {
          name: 'Analytics Dashboard',
          description: 'Multi-chart analytics overview with Recharts visualizations.',
          apis: [],
          businessRules: ['Data aggregated daily, not real-time', 'Message volume filtered to last 30 days', 'Deal values from deals table, grouped by stage'],
          workflow: [
            { actor: 'User', action: 'Navigates to Analytics page' },
            { actor: 'System', action: 'Queries messages, conversations, contacts, deals tables for aggregation' },
            { actor: 'System', action: 'Renders 5 charts: message volume, conversations, contact growth, pipeline, breakdown' },
          ],
          logicDescription: `The analytics dashboard is designed for weekly/monthly performance reviews rather than real-time monitoring. The 30-day rolling window provides meaningful trend data while keeping query scope manageable.

The contact growth and deal pipeline charts are particularly valuable for admins tracking business development — they show whether the WhatsApp engagement is translating into tangible pipeline value.`,
        },
      ],
    },
    {
      name: 'Settings',
      path: '/whatsapp/settings',
      description: 'Multi-tab settings panel for Meta API configuration, team management, API keys, quick replies, and media library.',
      logicDescription: `The Settings page consolidates all system configuration into 6 tabs:

1. General: Profile settings (placeholder for future expansion)
2. WhatsApp: Core Meta API configuration — enter Access Token, WABA ID, test connection
3. Team: User management — list team members, add via batch import, delete users, role display
4. API Keys: Generate and manage programmatic API keys for external integrations (stored in api_keys table)
5. Quick Replies: CRUD for pre-written message templates organized by NGO label and category (Info, QR Code, Receipt)
6. Media Library: File upload to Supabase Storage (whatsapp-media bucket), grid view with delete

The WhatsApp tab's "Test Connection" button is critical — it validates the Meta API credentials before saving, preventing configuration errors that would cause messaging failures.`,
      features: [
        {
          name: 'Settings Management',
          description: 'Tabbed configuration interface.',
          apis: [
            {
              method: 'POST',
              path: 'supabase.storage.from(whatsapp-media).upload()',
              auth: 'Supabase anon key',
              description: 'Upload media file to Supabase Storage.',
              curl: 'N/A (Supabase client SDK)',
              requestBody: 'Multipart file upload',
              responseBody: { path: 'public/uploads/image.jpg', fullPath: 'whatsapp-media/public/uploads/image.jpg' },
            },
          ],
          businessRules: ['Meta credentials persisted in tenants.settings JSON field', 'Media files limited to 16MB per upload', 'API keys support show/hide, activate/deactivate, delete'],
          workflow: [
            { actor: 'Admin', action: 'Configures Meta API credentials in WhatsApp tab' },
            { actor: 'Admin', action: 'Tests connection to validate configuration' },
            { actor: 'Admin', action: 'Saves credentials (persisted to tenants.settings JSON)' },
          ],
          logicDescription: `The Settings page is security-sensitive:
- Meta API credentials (access tokens) are stored in the tenants.settings JSON field, which is protected by RLS policies
- API keys can be revealed/copied (with confirmation) but are stored as hashed values
- The Media Library uses Supabase Storage with RLS policies ensuring users can only access their tenant's media
- Team management allows deleting users with confirmation to prevent accidental removals`,
        },
      ],
    },
    {
      name: 'Admin Panel',
      path: '/whatsapp/admin',
      description: 'Platform administration for tenant oversight, system health monitoring, and webhook inspection.',
      logicDescription: `The Admin Panel is accessible only to super_admin and tenant_admin roles. It provides:

1. Admin Dashboard: Platform-wide stats (tenants count, total users, conversations, messages) and quick action links
2. Tenants: List all tenants with search, suspend/reactivate toggle
3. Tenant Detail: Single tenant view — details, users list, conversation/message counts
4. Metrics: Platform growth (new signups over 30 days), overview placeholders for future expansion
5. System Health: Component status cards — database connectivity, webhook function, send API, auth service, Realtime, Storage
6. Webhook Logs: Recent webhook event logs from whatsapp_webhook_logs with auto-polling for real-time updates
7. Audit Logs: Placeholder for future audit trail implementation

The System Health page is critical for ops — it provides a quick overview of all system components' status, allowing admins to identify and respond to issues proactively.`,
      features: [
        {
          name: 'Admin Management',
          description: 'Platform administration tools.',
          apis: [],
          businessRules: ['Admin routes gated by super_admin/tenant_admin role check', 'Webhook logs polled every few seconds for real-time view', 'Tenant suspension prevents all data access for that tenant'],
          workflow: [
            { actor: 'Super Admin', action: 'Navigates to admin panel' },
            { actor: 'System', action: 'Displays platform-wide dashboard stats' },
            { actor: 'Super Admin', action: 'Checks system health, reviews webhook logs, manages tenants' },
          ],
          logicDescription: `The Admin Panel is designed for platform operators managing multiple NGO tenants. The separation between regular CRM functionality and admin tools is enforced by route-level protection (AdminProtectedRoute component) and role checks.

The System Health page checks each component independently, making it easy to isolate issues. For example, if messages aren't sending, the admin can check whether the send API, webhook, and database components are all healthy.`,
        },
      ],
    },
  ],
}

export default whatsappCrmData
