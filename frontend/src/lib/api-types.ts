export type CampaignContent = {
  provider: 'YouTube' | 'X' | 'TikTok' | 'LinkedIn' | 'Facebook' | 'Instagram';
  url: string;
  embed_url?: string;
};
export type Campaign = {
  id: string;
  name: string;
  created_at: string;
  feedback_count?: number;
  creator_name?: string;
  creator_picture?: string;
  content_url?: string;
  content?: CampaignContent;
};
export type Feedback = { id: string; campaign_id: string; text: string; created_at: string };
export type User = { id: string; email: string; name: string };
