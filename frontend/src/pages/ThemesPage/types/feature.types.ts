export interface Feature {
  id: string;
  name: string;
  description: string;
  urgency: string;
  status: string;
  mention_count: number;
  theme_id: string | null;
  first_mentioned: string;
  last_mentioned: string;
  created_at: string;
  updated_at: string | null;
  match_confidence?: number | null;
  data_points?: any[];
  ai_metadata?: {
    extraction_source?: string;
    transcript_theme_relevance?: {
      is_relevant: boolean;
      confidence: number;
      matched_themes: string[];
      reasoning: string;
    };
  };
}

export interface FeatureFormData {
  name: string;
  description: string;
}

export interface FeatureSuggestion {
  id: string;
  name: string;
  description: string;
  confidence: number;
}









