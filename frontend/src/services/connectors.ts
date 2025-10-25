/**
 * Connector API service for managing workspace connectors (Gong, Fathom)
 */

import api from './api';

export interface GongConnectorData {
  connector_type: 'gong';
  gong_access_key: string;
  gong_secret_key: string;
}

export interface FathomConnectorData {
  connector_type: 'fathom';
  fathom_api_token: string;
}

export interface ConnectorResponse {
  id: string;
  workspace_id: string;
  connector_type: 'gong' | 'fathom';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  gong_access_key?: string;
  gong_secret_key?: string;
  fathom_api_token?: string;
}

class ConnectorService {
  private baseUrl = '/api/v1/workspaces';

  /**
   * Save or update a connector for a workspace
   */
  async saveConnector(
    workspaceId: string,
    data: GongConnectorData | FathomConnectorData
  ): Promise<ConnectorResponse> {
    const response = await api.post(
      `${this.baseUrl}/${workspaceId}/connectors`,
      data
    );
    return response.data;
  }

  /**
   * Get all connectors for a workspace
   */
  async getConnectors(workspaceId: string): Promise<ConnectorResponse[]> {
    const response = await api.get(
      `${this.baseUrl}/${workspaceId}/connectors`
    );
    return response.data;
  }

  /**
   * Get a specific connector
   */
  async getConnector(
    workspaceId: string,
    connectorId: string
  ): Promise<ConnectorResponse> {
    const response = await api.get(
      `${this.baseUrl}/${workspaceId}/connectors/${connectorId}`
    );
    return response.data;
  }

  /**
   * Update a connector
   */
  async updateConnector(
    workspaceId: string,
    connectorId: string,
    data: Partial<GongConnectorData | FathomConnectorData>
  ): Promise<ConnectorResponse> {
    const response = await api.put(
      `${this.baseUrl}/${workspaceId}/connectors/${connectorId}`,
      data
    );
    return response.data;
  }

  /**
   * Delete a connector
   */
  async deleteConnector(
    workspaceId: string,
    connectorId: string
  ): Promise<void> {
    await api.delete(
      `${this.baseUrl}/${workspaceId}/connectors/${connectorId}`
    );
  }
}

export const connectorService = new ConnectorService();
