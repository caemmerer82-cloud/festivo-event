export interface Tenant {
  id: number;
  slug: string;
  name: string;
  created_at: string;
  is_active: boolean;
  user_count?: number;
  event_count?: number;
}

export interface SystemAdmin {
  id: number;
  username: string;
  role: 'system_admin';
}

export interface TenantUser {
  id: number;
  tenant_id: number;
  username: string;
  email: string;
  is_admin: boolean;
  perm_create_users: boolean;
  perm_create_persons: boolean;
  perm_create_events: boolean;
  perm_set_status: boolean;
  perm_create_mails: boolean;
  perm_send_mails: boolean;
  perm_create_rsvp: boolean;
  perm_edit_rsvp: boolean;
  created_at: string;
}

export interface AuthUser {
  sub: number;
  role: 'system_admin' | 'tenant_user';
  username: string;
  email?: string;
  tenant_id?: number;
  tenant_slug?: string;
  tenant_name?: string;
  is_admin?: boolean;
  permissions?: {
    create_users: boolean;
    create_persons: boolean;
    create_events: boolean;
    set_status: boolean;
    create_mails: boolean;
    send_mails: boolean;
    create_rsvp: boolean;
    edit_rsvp: boolean;
  };
  exp: number;
  iat: number;
}

export interface Person {
  id: number;
  tenant_id: number;
  first_name: string;
  last_name: string;
  gender?: 'm' | 'f' | 'd' | null;
  email: string;
  phone?: string;
  notes?: string;
  created_at: string;
}

export interface Event {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  location?: string;
  event_date: string;
  banner_path?: string;
  attachment_path?: string;
  attachment_filename?: string;
  created_at: string;
  guest_count?: number;
  confirmed_count?: number;
  declined_count?: number;
  invited_count?: number;
  questions?: Question[];
}

export type GuestStatus = 'angelegt' | 'eingeladen' | 'zugesagt' | 'abgesagt';

export interface EventGuest {
  id: number;
  event_id: number;
  person_id: number;
  status: GuestStatus;
  invitation_token?: string;
  token_expires_at?: string;
  invited_at?: string;
  responded_at?: string;
  created_at: string;
  // joined from persons
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
}

export type QuestionType = 'text' | 'dropdown' | 'radio' | 'checkbox';

export interface Question {
  id: number;
  event_id: number;
  question_text: string;
  question_type: QuestionType;
  options?: string[];
  is_required: boolean;
  sort_order: number;
}

export interface MailTemplate {
  id: number;
  tenant_id: number;
  name: string;
  subject: string;
  body_html: string;
  include_attachment: boolean;
  created_at: string;
}

export interface MailLogEntry {
  id: number;
  tenant_id: number;
  event_id?: number;
  person_id?: number;
  template_id?: number;
  recipient_email: string;
  subject: string;
  sent_at: string;
  status: 'sent' | 'failed';
  error_message?: string;
  event_name?: string;
  first_name?: string;
  last_name?: string;
}

export interface SmtpConfig {
  id?: number;
  tenant_id?: number;
  host: string;
  port: number;
  username: string;
  encryption: 'tls' | 'ssl' | 'none';
  from_email: string;
  from_name: string;
}

export interface GuestStats {
  total: number;
  angelegt: number;
  eingeladen: number;
  zugesagt: number;
  abgesagt: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export interface RsvpInvitation {
  guest: {
    id: number;
    first_name: string;
    last_name: string;
    status: GuestStatus;
  };
  event: {
    id: number;
    name: string;
    description?: string;
    location?: string;
    event_date: string;
    banner_url?: string;
    has_attachment: boolean;
    attachment_filename?: string;
    attachment_token?: string;
  };
  questions: Question[];
  existing_answers: Record<number, string>;
  texts: Record<string, string>;
}
