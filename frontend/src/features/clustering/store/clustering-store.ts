import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import ClusteringAPI from '@/services/clustering';
import type {
  ClusteringState,
  ClusteringRun,
  DiscoveredCluster,
  StartClusteringForm,
  ApprovalForm,
} from '../types/clustering.types';

interface ClusteringStore extends ClusteringState {
  // Actions
  setCurrentView: (view: ClusteringState['currentView']) => void;
  setShowStartModal: (show: boolean) => void;
  setShowApprovalModal: (show: boolean, cluster?: DiscoveredCluster) => void;
  setSelectedRun: (run?: ClusteringRun) => void;
  setSelectedCluster: (cluster?: DiscoveredCluster) => void;

  // API Actions
  loadClusteringRuns: (workspaceId: string) => Promise<void>;
  loadPendingClusters: (workspaceId: string) => Promise<void>;
  loadClassificationSignals: (workspaceId: string) => Promise<void>;
  startClusteringRun: (workspaceId: string, form: StartClusteringForm) => Promise<ClusteringRun>;
  approveCluster: (clusterId: string, form: ApprovalForm) => Promise<void>;
  rejectCluster: (clusterId: string, form: ApprovalForm) => Promise<void>;
  toggleSignal: (signalId: string) => Promise<void>;

  // Utility actions
  reset: () => void;
  setError: (error?: string) => void;
  setLoading: (loading: boolean) => void;
}

const initialState: ClusteringState = {
  runs: [],
  pendingClusters: [],
  signals: [],
  selectedRun: undefined,
  selectedCluster: undefined,
  isLoading: false,
  error: undefined,
  currentView: 'overview',
  showStartModal: false,
  showApprovalModal: false,
  selectedClusterForApproval: undefined,
};

export const useClusteringStore = create<ClusteringStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // UI Actions
        setCurrentView: (view) => set({ currentView: view }),
        setShowStartModal: (show) => set({ showStartModal: show }),
        setShowApprovalModal: (show, cluster) =>
          set({
            showApprovalModal: show,
            selectedClusterForApproval: cluster
          }),
        setSelectedRun: (run) => set({ selectedRun: run }),
        setSelectedCluster: (cluster) => set({ selectedCluster: cluster }),

        // API Actions
        loadClusteringRuns: async (workspaceId: string) => {
          set({ isLoading: true, error: undefined });
          try {
            const runs = await ClusteringAPI.getClusteringRuns(workspaceId);
            set({ runs, isLoading: false });
          } catch (error: any) {
            set({
              error: error.response?.data?.detail || 'Failed to load clustering runs',
              isLoading: false
            });
          }
        },

        loadPendingClusters: async (workspaceId: string) => {
          set({ isLoading: true, error: undefined });
          try {
            const pendingClusters = await ClusteringAPI.getPendingClusters(workspaceId);
            set({ pendingClusters, isLoading: false });
          } catch (error: any) {
            set({
              error: error.response?.data?.detail || 'Failed to load pending clusters',
              isLoading: false
            });
          }
        },

        loadClassificationSignals: async (workspaceId: string) => {
          set({ isLoading: true, error: undefined });
          try {
            const signals = await ClusteringAPI.getClassificationSignals(workspaceId);
            set({ signals, isLoading: false });
          } catch (error: any) {
            set({
              error: error.response?.data?.detail || 'Failed to load classification signals',
              isLoading: false
            });
          }
        },

        startClusteringRun: async (workspaceId: string, form: StartClusteringForm) => {
          set({ isLoading: true, error: undefined });
          try {
            const newRun = await ClusteringAPI.startClusteringRun(workspaceId, {
              run_name: form.run_name,
              description: form.description,
              confidence_threshold: form.confidence_threshold,
              max_messages: form.max_messages,
            });

            // Add to runs list
            const { runs } = get();
            set({
              runs: [newRun, ...runs],
              selectedRun: newRun,
              isLoading: false,
              showStartModal: false,
            });

            return newRun;
          } catch (error: any) {
            set({
              error: error.response?.data?.detail || 'Failed to start clustering run',
              isLoading: false
            });
            throw error;
          }
        },

        approveCluster: async (clusterId: string, form: ApprovalForm) => {
          set({ isLoading: true, error: undefined });
          try {
            const approvedCluster = await ClusteringAPI.approveCluster(clusterId, {
              customer_feedback: form.customer_feedback,
            });

            // Update clusters list
            const { pendingClusters } = get();
            set({
              pendingClusters: pendingClusters.map(cluster =>
                cluster.id === clusterId ? approvedCluster : cluster
              ),
              isLoading: false,
              showApprovalModal: false,
              selectedClusterForApproval: undefined,
            });

            // Reload signals since new ones may have been generated
            // Note: We should get workspaceId from context or props
            // For now, we'll let the caller handle this
          } catch (error: any) {
            set({
              error: error.response?.data?.detail || 'Failed to approve cluster',
              isLoading: false
            });
            throw error;
          }
        },

        rejectCluster: async (clusterId: string, form: ApprovalForm) => {
          set({ isLoading: true, error: undefined });
          try {
            await ClusteringAPI.rejectCluster(clusterId, {
              customer_feedback: form.customer_feedback,
            });

            // Update clusters list
            const { pendingClusters } = get();
            set({
              pendingClusters: pendingClusters.map(cluster =>
                cluster.id === clusterId
                  ? { ...cluster, approval_status: 'rejected' as const }
                  : cluster
              ),
              isLoading: false,
              showApprovalModal: false,
              selectedClusterForApproval: undefined,
            });
          } catch (error: any) {
            set({
              error: error.response?.data?.detail || 'Failed to reject cluster',
              isLoading: false
            });
            throw error;
          }
        },

        toggleSignal: async (signalId: string) => {
          set({ isLoading: true, error: undefined });
          try {
            const result = await ClusteringAPI.toggleSignalStatus(signalId);

            // Update signals list
            const { signals } = get();
            set({
              signals: signals.map(signal =>
                signal.id === signalId
                  ? { ...signal, is_active: result.is_active }
                  : signal
              ),
              isLoading: false,
            });
          } catch (error: any) {
            set({
              error: error.response?.data?.detail || 'Failed to toggle signal',
              isLoading: false
            });
            throw error;
          }
        },

        // Utility actions
        reset: () => set(initialState),
        setError: (error) => set({ error }),
        setLoading: (isLoading) => set({ isLoading }),
      }),
      {
        name: 'clustering-store',
        partialize: (state) => ({
          // Only persist some state, not loading states or modals
          currentView: state.currentView,
          selectedRun: state.selectedRun,
          selectedCluster: state.selectedCluster,
        }),
      }
    ),
    {
      name: 'ClusteringStore',
    }
  )
);

export default useClusteringStore;