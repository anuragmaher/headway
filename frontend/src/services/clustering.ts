import api from './api';

// Types for clustering API
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
  example_messages?: any;
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
  business_rules?: any;
  target_category: string;
  target_theme: string;
  priority_weight: number;
  precision?: number;
  recall?: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

export interface StartClusteringRequest {
  run_name: string;
  description?: string;
  confidence_threshold?: number;
  max_messages?: number;
}

export interface ApproveClusterRequest {
  customer_feedback?: string;
}

// Clustering API methods
export class ClusteringAPI {
  private static baseUrl = '/api/v1/clustering';

  // Start a new clustering run
  static async startClusteringRun(
    workspaceId: string,
    request: StartClusteringRequest
  ): Promise<ClusteringRun> {
    const response = await api.post(
      `${this.baseUrl}/start?workspace_id=${workspaceId}`,
      request
    );
    return response.data;
  }

  // Get all clustering runs for a workspace
  static async getClusteringRuns(workspaceId: string): Promise<ClusteringRun[]> {
    const response = await api.get(
      `${this.baseUrl}/runs?workspace_id=${workspaceId}`
    );
    return response.data;
  }

  // Get pending clusters for approval
  static async getPendingClusters(workspaceId: string): Promise<DiscoveredCluster[]> {
    const response = await api.get(
      `${this.baseUrl}/pending-clusters?workspace_id=${workspaceId}`
    );
    return response.data;
  }

  // Approve a discovered cluster
  static async approveCluster(
    clusterId: string,
    request: ApproveClusterRequest
  ): Promise<DiscoveredCluster> {
    const response = await api.post(
      `${this.baseUrl}/clusters/${clusterId}/approve`,
      request
    );
    return response.data;
  }

  // Reject a discovered cluster
  static async rejectCluster(
    clusterId: string,
    request: ApproveClusterRequest
  ): Promise<{ message: string; cluster_id: string }> {
    const response = await api.post(
      `${this.baseUrl}/clusters/${clusterId}/reject`,
      request
    );
    return response.data;
  }

  // Get classification signals
  static async getClassificationSignals(
    workspaceId: string,
    signalType?: string,
    isActive?: boolean
  ): Promise<ClassificationSignal[]> {
    const params = new URLSearchParams();
    params.append('workspace_id', workspaceId);
    if (signalType) params.append('signal_type', signalType);
    if (isActive !== undefined) params.append('is_active', isActive.toString());

    const response = await api.get(
      `${this.baseUrl}/signals?${params.toString()}`
    );
    return response.data;
  }

  // Toggle signal status
  static async toggleSignalStatus(signalId: string): Promise<{
    message: string;
    signal_id: string;
    is_active: boolean;
  }> {
    const response = await api.put(
      `${this.baseUrl}/signals/${signalId}/toggle`
    );
    return response.data;
  }
}

export default ClusteringAPI;