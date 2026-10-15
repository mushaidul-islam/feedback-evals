export type Campaign = { id: string; name: string; created_at: string; feedback_count?: number };
export type Feedback = { id: string; campaign_id: string; text: string; created_at: string };
export type User = { id: string; email: string; name: string };
