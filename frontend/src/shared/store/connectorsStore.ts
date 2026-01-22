/**
 * Connectors Store
 * Manages state for workspace data source connectors
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { connectorsApi, slackApi, gmailApi } from '@/services/connectors.api';
import type {
  Connector,
  ConnectorLabel,
  ConnectorType,
  SlackChannel,
  GmailLabel,
} from '@/shared/types/api.types';

interface ConnectorsState {
  // Data
  connectors: Connector[];
  selectedConnector: Connector | null;
  channels: SlackChannel[]; // For Slack
  labels: GmailLabel[]; // For Gmail

  // Loading states
  isLoading: boolean;
  isSyncing: boolean;
  isLoadingLabels: boolean;

  // Error state
  error: string | null;

  // Actions
  fetchConnectors: (connectorType?: ConnectorType) => Promise<void>;
  fetchConnector: (connectorId: string) => Promise<void>;
  createAPIConnector: (data: {
    connector_type: ConnectorType;
    name: string;
    api_key: string;
    api_secret?: string;
  }) => Promise<Connector>;
  updateConnector: (
    connectorId: string,
    data: { name?: string; config?: Record<string, unknown>; is_active?: boolean }
  ) => Promise<void>;
  deleteConnector: (connectorId: string) => Promise<void>;
  deactivateConnector: (connectorId: string) => Promise<void>;

  // Labels
  fetchLabels: (connectorId: string) => Promise<void>;
  updateEnabledLabels: (connectorId: string, labelIds: string[]) => Promise<void>;

  // Slack-specific
  fetchSlackChannels: (connectorId: string) => Promise<void>;
  getSlackOAuthUrl: () => Promise<string>;
  handleSlackCallback: (code: string, state?: string) => Promise<Connector>;

  // Gmail-specific
  fetchGmailLabels: (connectorId: string) => Promise<void>;
  getGmailOAuthUrl: () => Promise<string>;
  handleGmailCallback: (code: string, state?: string) => Promise<Connector>;

  // Sync
  triggerSync: (connectorId: string, fullSync?: boolean) => Promise<void>;

  // Utility
  clearError: () => void;
  setSelectedConnector: (connector: Connector | null) => void;
  getConnectorsByType: (type: ConnectorType) => Connector[];
}

export const useConnectorsStore = create<ConnectorsState>()(
  devtools(
    (set, get) => ({
      // Initial state
      connectors: [],
      selectedConnector: null,
      channels: [],
      labels: [],
      isLoading: false,
      isSyncing: false,
      isLoadingLabels: false,
      error: null,

      // Actions
      fetchConnectors: async (connectorType) => {
        set({ isLoading: true, error: null });
        try {
          const response = await connectorsApi.listConnectors(connectorType);
          set({ connectors: response.connectors, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch connectors',
            isLoading: false,
          });
        }
      },

      fetchConnector: async (connectorId) => {
        set({ isLoading: true, error: null });
        try {
          const connector = await connectorsApi.getConnector(connectorId);
          set({ selectedConnector: connector, isLoading: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch connector',
            isLoading: false,
          });
        }
      },

      createAPIConnector: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const connector = await connectorsApi.createAPIConnector(data);
          set((state) => ({
            connectors: [...state.connectors, connector],
            isLoading: false,
          }));
          return connector;
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to create connector',
            isLoading: false,
          });
          throw error;
        }
      },

      updateConnector: async (connectorId, data) => {
        try {
          const updated = await connectorsApi.updateConnector(connectorId, data);
          set((state) => ({
            connectors: state.connectors.map((c) =>
              c.id === connectorId ? updated : c
            ),
            selectedConnector:
              state.selectedConnector?.id === connectorId
                ? updated
                : state.selectedConnector,
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update connector',
          });
          throw error;
        }
      },

      deleteConnector: async (connectorId) => {
        try {
          await connectorsApi.deleteConnector(connectorId);
          set((state) => ({
            connectors: state.connectors.filter((c) => c.id !== connectorId),
            selectedConnector:
              state.selectedConnector?.id === connectorId
                ? null
                : state.selectedConnector,
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to delete connector',
          });
          throw error;
        }
      },

      deactivateConnector: async (connectorId) => {
        try {
          const updated = await connectorsApi.deactivateConnector(connectorId);
          set((state) => ({
            connectors: state.connectors.map((c) =>
              c.id === connectorId ? updated : c
            ),
          }));
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to deactivate connector',
          });
          throw error;
        }
      },

      // Labels
      fetchLabels: async (connectorId) => {
        set({ isLoadingLabels: true });
        try {
          const labels = await connectorsApi.getLabels(connectorId);
          set((state) => ({
            connectors: state.connectors.map((c) =>
              c.id === connectorId ? { ...c, labels } : c
            ),
            isLoadingLabels: false,
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch labels',
            isLoadingLabels: false,
          });
        }
      },

      updateEnabledLabels: async (connectorId, labelIds) => {
        try {
          const labels = await connectorsApi.updateEnabledLabels(connectorId, labelIds);
          set((state) => ({
            connectors: state.connectors.map((c) =>
              c.id === connectorId ? { ...c, labels } : c
            ),
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update labels',
          });
          throw error;
        }
      },

      // Slack-specific
      fetchSlackChannels: async (connectorId) => {
        set({ isLoadingLabels: true });
        try {
          const channels = await slackApi.getChannels(connectorId);
          set({ channels, isLoadingLabels: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch channels',
            isLoadingLabels: false,
          });
        }
      },

      getSlackOAuthUrl: async () => {
        const response = await slackApi.getOAuthUrl();
        return response.url;
      },

      handleSlackCallback: async (code, state) => {
        set({ isLoading: true, error: null });
        try {
          const connector = await slackApi.handleCallback(code, state);
          set((state) => ({
            connectors: [...state.connectors, connector],
            isLoading: false,
          }));
          return connector;
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to connect Slack',
            isLoading: false,
          });
          throw error;
        }
      },

      // Gmail-specific
      fetchGmailLabels: async (connectorId) => {
        set({ isLoadingLabels: true });
        try {
          const labels = await gmailApi.getLabels(connectorId);
          set({ labels, isLoadingLabels: false });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to fetch labels',
            isLoadingLabels: false,
          });
        }
      },

      getGmailOAuthUrl: async () => {
        const response = await gmailApi.getOAuthUrl();
        return response.url;
      },

      handleGmailCallback: async (code, state) => {
        set({ isLoading: true, error: null });
        try {
          const connector = await gmailApi.handleCallback(code, state);
          set((state) => ({
            connectors: [...state.connectors, connector],
            isLoading: false,
          }));
          return connector;
        } catch (error) {
          set({
            error:
              error instanceof Error ? error.message : 'Failed to connect Gmail',
            isLoading: false,
          });
          throw error;
        }
      },

      // Sync
      triggerSync: async (connectorId, fullSync = false) => {
        set({ isSyncing: true, error: null });
        try {
          await connectorsApi.triggerSync(connectorId, fullSync);
          // Update connector status
          const status = await connectorsApi.getSyncStatus(connectorId);
          set((state) => ({
            connectors: state.connectors.map((c) =>
              c.id === connectorId
                ? { ...c, sync_status: status.status as Connector['sync_status'] }
                : c
            ),
            isSyncing: false,
          }));
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to trigger sync',
            isSyncing: false,
          });
          throw error;
        }
      },

      // Utility
      clearError: () => set({ error: null }),
      setSelectedConnector: (connector) => set({ selectedConnector: connector }),
      getConnectorsByType: (type) =>
        get().connectors.filter((c) => c.connector_type === type),
    }),
    { name: 'connectors-store' }
  )
);

export default useConnectorsStore;
