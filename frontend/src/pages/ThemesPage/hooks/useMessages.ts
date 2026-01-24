import { useState, useCallback } from 'react';
import { Message, Feature, MentionDetailsTab } from '../types';
import { API_BASE_URL } from '@/config/api.config';
import { useAuthStore } from '@/features/auth/store/auth-store';

export const useMessages = () => {
  const { tokens } = useAuthStore();
  const WORKSPACE_ID = tokens?.workspace_id;

  const [featureMessages, setFeatureMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedFeatureForMessages, setSelectedFeatureForMessages] = useState<Feature | null>(null);
  const [showMessagesFullPage, setShowMessagesFullPage] = useState(false);
  const [mentionDetailsTab, setMentionDetailsTab] = useState<MentionDetailsTab>('highlights');

  // Message deletion state
  const [mentionToDelete, setMentionToDelete] = useState<Message | null>(null);
  const [deletingMention, setDeletingMention] = useState(false);

  const getAuthToken = useCallback(() => {
    return tokens?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTk3NDIzODgsInN1YiI6ImI0NzE0NGU3LTAyYTAtNGEyMi04MDBlLTNmNzE3YmZiNGZhYSIsInR5cGUiOiJhY2Nlc3MifQ.L2dOy92Nim5egY3nzRXQts3ywgxV_JvO_8EEiePpDNY';
  }, [tokens]);

  const fetchFeatureMessages = useCallback(async (featureId: string) => {
    if (!WORKSPACE_ID) return;

    try {
      setLoadingMessages(true);
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features/${featureId}/messages?workspace_id=${WORKSPACE_ID}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch feature messages: ${response.status}`);
      }

      const messages = await response.json();
      setFeatureMessages(messages);
    } catch (error) {
      console.error('Error fetching feature messages:', error);
      setFeatureMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, [WORKSPACE_ID, getAuthToken]);

  const deleteMention = useCallback(async (messageId: string) => {
    if (!WORKSPACE_ID || !selectedFeatureForMessages) throw new Error('Missing required data');

    setDeletingMention(true);
    try {
      const token = getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/v1/features/features/${selectedFeatureForMessages.id}/messages/${messageId}?workspace_id=${WORKSPACE_ID}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete mention: ${response.status}`);
      }

      // Update local state
      setFeatureMessages(prev => prev.filter(m => m.id !== messageId));
      setMentionToDelete(null);
    } catch (error) {
      console.error('Error deleting mention:', error);
      throw error;
    } finally {
      setDeletingMention(false);
    }
  }, [WORKSPACE_ID, selectedFeatureForMessages, getAuthToken]);

  const openMessagesForFeature = useCallback((feature: Feature, fullPage: boolean = false) => {
    setSelectedFeatureForMessages(feature);
    setShowMessagesFullPage(fullPage);
    fetchFeatureMessages(feature.id);
  }, [fetchFeatureMessages]);

  const closeMessages = useCallback(() => {
    setSelectedFeatureForMessages(null);
    setShowMessagesFullPage(false);
    setFeatureMessages([]);
    setSelectedMessageId(null);
  }, []);

  const prepareMentionForDelete = useCallback((message: Message) => {
    setMentionToDelete(message);
  }, []);

  return {
    // State
    featureMessages,
    loadingMessages,
    selectedMessageId,
    selectedFeatureForMessages,
    showMessagesFullPage,
    mentionDetailsTab,
    mentionToDelete,
    deletingMention,

    // Actions
    setSelectedMessageId,
    setMentionDetailsTab,
    fetchFeatureMessages,
    deleteMention,
    openMessagesForFeature,
    closeMessages,
    prepareMentionForDelete,
  };
};









