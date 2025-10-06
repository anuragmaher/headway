// Core clustering types
export interface ClusteringRun {
  id: string;
  workspace_id: string;
  run_name: string;
  description?: string;
  status: 'running' | 'completed' | 'failed';
  messages_analyzed: number;
  clusters_discovered: number;
  confidence_threshold: number;
  created_at: string;
  completed_at?: string;
}

export interface DiscoveredCluster {
  id: string;
  clustering_run_id: string;
  cluster_name: string;
  description: string;
  category: string;
  theme: string;
  confidence_score: number;
  message_count: number;
  business_impact?: string;
  example_messages?: {
    message_ids: string[];
    sample_content: string[];
  };
  approval_status: 'pending' | 'approved' | 'rejected' | 'modified';
  approved_by?: string;
  approved_at?: string;
  customer_feedback?: string;
  created_at: string;
}

export interface ClassificationSignal {
  id: string;
  source_cluster_id: string;
  signal_type: 'keyword' | 'pattern' | 'semantic' | 'business_rule';
  signal_name: string;
  keywords?: string[];
  patterns?: string[];
  semantic_threshold?: number;
  business_rules?: Record<string, any>;
  target_category: string;
  target_theme: string;
  priority_weight: number;
  precision?: number;
  recall?: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

// UI State types
export interface ClusteringState {
  runs: ClusteringRun[];
  pendingClusters: DiscoveredCluster[];
  signals: ClassificationSignal[];
  selectedRun?: ClusteringRun;
  selectedCluster?: DiscoveredCluster;
  isLoading: boolean;
  error?: string;

  // UI state
  currentView: 'overview' | 'clustering' | 'approval' | 'signals';
  showStartModal: boolean;
  showApprovalModal: boolean;
  selectedClusterForApproval?: DiscoveredCluster;
}

// Form types
export interface StartClusteringForm {
  run_name: string;
  description: string;
  confidence_threshold: number;
  max_messages?: number;
}

export interface ApprovalForm {
  decision: 'approve' | 'reject' | 'modify';
  customer_feedback: string;
  modifications?: {
    cluster_name?: string;
    description?: string;
    category?: string;
    theme?: string;
  };
}

// Dashboard summary types
export interface ClusteringSummary {
  total_runs: number;
  total_clusters_discovered: number;
  pending_approvals: number;
  active_signals: number;
  recent_activity: ActivityItem[];
  performance_metrics: {
    average_confidence: number;
    classification_accuracy: number;
    processing_speed: number;
  };
}

export interface ActivityItem {
  id: string;
  type: 'run_started' | 'run_completed' | 'cluster_approved' | 'cluster_rejected' | 'signal_created';
  title: string;
  description: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error' | 'info';
  metadata?: Record<string, any>;
}

// Filter and sort types
export interface ClusterFilters {
  status?: ('pending' | 'approved' | 'rejected')[];
  category?: string[];
  theme?: string[];
  confidence_min?: number;
  confidence_max?: number;
  message_count_min?: number;
  created_after?: string;
  created_before?: string;
}

export interface ClusterSort {
  field: 'created_at' | 'confidence_score' | 'message_count' | 'cluster_name';
  direction: 'asc' | 'desc';
}

// Chart data types for analytics
export interface ClusterDistributionData {
  category: string;
  count: number;
  percentage: number;
  color: string;
}

export interface ConfidenceDistributionData {
  confidence_range: string;
  count: number;
  percentage: number;
}

export interface TimelineData {
  date: string;
  clusters_discovered: number;
  clusters_approved: number;
  signals_generated: number;
}

export default ClusteringState;