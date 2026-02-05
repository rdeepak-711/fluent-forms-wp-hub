export interface LoginCredentials {
    username: string;
    password: string;
}

export interface AuthContextType {
    isAuthenticated: boolean;
    login: () => void;
    logout: () => void;
}

export interface AuthTokens {
    access_token: string;
    refresh_token?: string;
    token_type: string;
}

export interface Site {
    id: number;
    name: string;
    url: string;
    is_active: boolean;
    last_synced_at: string | null;  // ISO 8601 string
    contact_form_id: number | null;
}

// Submission status types
export type SubmissionStatus = 'new' | 'waiting_internal' | 'waiting_customer' | 'in_progress' | 'closed';

export interface Submission {
    id: number;
    site_id: number;
    fluent_form_id: number;
    form_id: number;
    status: SubmissionStatus;
    data: Record<string, any>;
    submitted_at: string; // ISO 8601 string
    submitter_name: string | null;
    submitter_email: string | null;
    subject: string | null;
    message: string | null;
    locked_by: number | null;
    locked_at: string | null;
    is_active: boolean;
    gmail_thread_id: string | null;
}

export interface SubmissionUpdate {
    status?: SubmissionStatus;
    locked_by?: number | null;
    locked_at?: string | null;
    is_active?: boolean;
}

export interface Email {
    id: number;
    submission_id: number;
    subject: string | null;
    body: string | null;
    direction: 'inbound' | 'outbound';
    to_email: string | null;
    from_email: string | null;
    status: string | null;
    message_id: string | null;
    user_id: number | null;
    created_at: string; // ISO 8601 string
}

export interface EmailCreate {
    submission_id: number;
    body: string;
    subject?: string;
    direction?: 'inbound' | 'outbound';
}

export interface SyncResult {
    site_id: number;
    forms_found: number;
    submissions_synced: number;
    status: string;
    message: string;
}

export interface TokenResponse {
    access_token: string;
    token_type: string;
}

export interface SubmissionTableProps {
    submissions: Submission[];
    sites: Site[];
    isLoading: boolean;
    onRowClick: (id: number) => void;
    onDelete?: (id: number) => void;
}

export interface ComposePopupProps {
    isOpen: boolean;
    onClose: () => void;
    submissionId: number;
    toEmail: string | null;
    onEmailSent: (email: Email) => void;
    isFirstEmail: boolean;
}

// User types
export interface User {
    id: number;
    email: string;
    is_active: boolean;
    role: 'admin' | 'user';
}

export interface EmailUpdateRequest {
    new_email: string;
    current_password: string;
}

export interface PasswordChangeRequest {
    current_password: string;
    new_password: string;
}

export interface MessageResponse {
    message: string;
}

// Site management types
export interface SiteCreate {
    name: string;
    url: string;
    username: string;
    application_password: string;
    contact_form_id?: number | null;
}

export interface SiteUpdate {
    name?: string;
    url?: string;
    username?: string;
    application_password?: string;
    contact_form_id?: number | null;
    is_active?: boolean;
}

export interface SiteAdmin extends Site {
    username: string;
    created_at: string | null;
    updated_at: string | null;
}