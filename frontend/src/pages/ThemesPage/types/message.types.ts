export interface Message {
  id: string;
  content: string;
  sender_name?: string;
  customer_name?: string;
  sent_at: string;
  source: string;
  feature_id?: string;
  ai_insights?: {
    feature_requests?: any[];
    bug_reports?: any[];
    pain_points?: any[];
    key_topics?: any[];
  };
  business_metrics?: {
    mrr?: number;
    [key: string]: any;
  };
  entities?: any;
  structured_metrics?: any;
}









