/**
 * Message slice - Handles message-related state and actions
 */

import { StateCreator } from 'zustand';
import { ThemesPageStore, MessageState, MessageActions } from '../types';
import { API_BASE_URL } from '@/config/api.config';
import { getAuthToken, getWorkspaceId } from '../utils';

export const initialMessageState: MessageState = {
  featureMessages: [],
  selectedMessageId: null,
  loadingMessages: false,
};

export const createMessageSlice: StateCreator<
  ThemesPageStore,
  [],
  [],
  MessageState & MessageActions
> = (set, get) => ({
  ...initialMessageState,

  fetchFeatureMessages: async (featureId: string) => {
    try {
      set({ loadingMessages: true });
      const workspaceId = getWorkspaceId();
      const token = getAuthToken();

      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features/${featureId}/messages?workspace_id=${workspaceId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.status}`);
      }

      const messages = await response.json();
      set({ featureMessages: messages });
    } catch (error) {
      console.error('Error fetching feature messages:', error);
      set({ featureMessages: [] });
    } finally {
      set({ loadingMessages: false });
    }
  },

  deleteMention: async (featureId: string, messageId: string) => {
    const workspaceId = getWorkspaceId();
    const token = getAuthToken();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/features/features/${featureId}/messages/${messageId}?workspace_id=${workspaceId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete message: ${response.status}`);
    }

    set(state => ({
      featureMessages: state.featureMessages.filter(m => m.id !== messageId),
      selectedMessageId: state.selectedMessageId === messageId ? null : state.selectedMessageId
    }));
  },

  setSelectedMessageId: (id: string | null) => set({ selectedMessageId: id }),
});
