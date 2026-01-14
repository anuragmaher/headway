import { GmailLabel } from "@/shared/types/GmailTypes";
import api from "./api";

export interface GmailAccount {
  id: string;
  gmail_email: string;
  created_at: string;
  first_name?: string;
}

export const connectGmail = async () => {
  const res = await api.get(`/api/v1/gmail/connect`);
  return res.data as { auth_url: string };
};

export const fetchLabels = async () => {
  const res = await api.get(`/api/v1/gmail/labels`);
  return res.data.labels as GmailLabel[];
};

export const saveSelectedLabels = async (selected: GmailLabel[]) => {
  console.log(selected);
  const res = await api.post(`/api/v1/gmail/labels/selected`, { selected });
  return res.data;
};

/**
 * Get connected Gmail accounts
 */
export const getGmailAccounts = async (): Promise<GmailAccount[]> => {
  const res = await api.get(`/api/v1/gmail/accounts`);
  return res.data.accounts || [];
};

/**
 * Disconnect a Gmail account
 */
export const disconnectGmail = async (accountId: string): Promise<void> => {
  await api.delete(`/api/v1/gmail/accounts/${accountId}`);
};

/**
 * Get selected labels for the current Gmail account
 */
export const getSelectedLabels = async (): Promise<GmailLabel[]> => {
  const res = await api.get(`/api/v1/gmail/labels/selected`);
  return res.data.labels as GmailLabel[];
};