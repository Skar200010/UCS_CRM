export type UserRole = 'tenant_admin' | 'agent' | 'viewer';

export type UserStatus = 'active' | 'invited' | 'deactivated';

export type ConversationStatus = 'open' | 'pending' | 'closed' | 'snoozed';

export type ConversationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type MessageDirection = 'inbound' | 'outbound';

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'location'
  | 'contact'
  | 'interactive'
  | 'template'
  | 'reaction'
  | 'sticker'
  | 'system';

export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export type ContactSource = 'whatsapp' | 'manual' | 'import' | 'api' | 'campaign';

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  phone?: string;
  role: UserRole;
  status?: UserStatus;
  last_login_at?: string;
  last_active_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface Contact {
  id: string;
  tenant_id: string;
  phone: string;
  phone_normalized?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  company?: string | null;
  profile_pic_url?: string;
  wa_profile_name?: string;
  source?: ContactSource;
  opted_in?: boolean;
  custom_fields?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  tenant_id: string;
  conversation_id: string;
  contact_id: string;
  user_id?: string;
  direction: MessageDirection;
  message_type: MessageType;
  body_text: string;
  caption?: string;
  media_url?: string;
  media_id?: string;
  media_mime_type?: string;
  wa_message_id?: string;
  wa_context_id?: string;
  template_id?: string;
  template_params?: unknown;
  interactive_payload?: unknown;
  status: MessageStatus;
  status_updated_at?: string;
  failure_reason?: string;
  failure_code?: string;
  message_category?: string;
  metadata?: Record<string, unknown>;
  is_automated?: boolean;
  automation_id?: string;
  campaign_id?: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  tenant_id: string;
  contact_id: string;
  phone_number_id?: string;
  assigned_to?: string;
  status: ConversationStatus;
  priority?: ConversationPriority;
  source?: 'whatsapp' | 'manual';
  last_message_at?: string;
  last_inbound_at?: string;
  snoozed_until?: string;
  closed_at?: string;
  closed_by?: string;
  labels?: string[];
  created_at: string;
  updated_at?: string;
  contact?: Contact;
}

export interface Deal {
  id: string;
  tenant_id?: string;
  pipeline_id?: string;
  stage_id: string;
  contact_id: string;
  assigned_to?: string;
  title: string;
  value?: number | null;
  currency?: string;
  expected_close_date?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  contact?: Contact;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  color?: string;
  created_at?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  settings?: Record<string, unknown>;
  status: string;
  max_users: number;
  max_contacts: number;
  created_at: string;
  updated_at?: string;
}

export type AutomationFlowType = 'auto_reply' | 'chatbot' | 'drip_campaign' | 'trigger_action';
export type AutomationFlowStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface AutomationFlow {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  type: AutomationFlowType;
  status: AutomationFlowStatus;
  trigger_type?: string;
  trigger_config?: Record<string, unknown>;
  flow_data?: { nodes?: unknown[]; edges?: unknown[]; [key: string]: unknown };
  priority?: number;
  stats?: Record<string, unknown>;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface WhatsAppTemplate {
  id: string;
  tenant_id: string;
  phone_number_id: string;
  meta_template_id?: string;
  name: string;
  language: string;
  category?: string;
  status: string;
  components?: unknown;
  rejection_reason?: string;
  synced_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface WhatsAppPhoneNumber {
  id: string;
  tenant_id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name?: string;
  quality_rating?: string;
  status: string;
  is_primary?: boolean;
  label?: string;
  created_at: string;
  updated_at?: string;
}

export interface QuickReply {
  id: string;
  tenant_id: string;
  name: string;
  message_text: string;
  label: string;
  category: string;
  sort_order?: number;
  is_active?: boolean;
  media_url?: string;
  media_type?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MediaItem {
  id: string;
  tenant_id: string;
  name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  category: string;
  created_at: string;
}
