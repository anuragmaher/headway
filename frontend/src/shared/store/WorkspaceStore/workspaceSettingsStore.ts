/**
 * Zustand store for Workspace Settings state management
 */

import { create } from "zustand";
import type { SlackChannel, SlackIntegration } from "@/services/slack";
import { slackService } from "@/services/slack";
import { connectorService, type ConnectorResponse } from "@/services/connectors";
import { companyService, type CompanyDetails } from "@/services/company";
import { API_BASE_URL } from "@/config/api.config";
import type { DataSource, ExpandedSections } from "../../types/WorkspaceTypes";
import { normalizeDomain, isValidDomain } from "../../utils/WorkspaceUtils";
import { getGmailAccounts, disconnectGmail, type GmailAccount } from "@/services/gmail";

interface WorkspaceSettingsState {
  // UI State
  expandedSections: ExpandedSections;
  autoSync: boolean;
  emailNotifications: boolean;

  // Slack State
  slackDialogOpen: boolean;
  slackTokens: { userToken: string };
  availableChannels: SlackChannel[];
  selectedChannels: string[];
  isLoadingChannels: boolean;
  connectionStep: "tokens" | "channels";
  isConnecting: boolean;
  error: string | null;
  slackIntegrations: SlackIntegration[];
  teamInfo: { team_id: string; team_name: string } | null;
  channelSearch: string;
  isLoadingIntegrations: boolean;

  // Connector State
  gongDialogOpen: boolean;
  fathomDialogOpen: boolean;
  gongAccessKey: string;
  gongSecretKey: string;
  fathomApiToken: string;
  isSavingConnectors: boolean;
  connectorError: string | null;
  connectorSuccess: boolean;
  connectors: ConnectorResponse[];
  isLoadingConnectors: boolean;

  // Company State
  companyData: CompanyDetails;
  isLoadingCompany: boolean;

  // Company Domains State
  companyDomains: string[];
  newDomain: string;
  isLoadingDomains: boolean;
  isSavingDomains: boolean;
  domainsError: string | null;
  domainsSuccess: boolean;

  // Competitors State
  competitors: Array<{ id: string; name: string; website?: string; description?: string }>;
  isLoadingCompetitors: boolean;
  competitorsDialogOpen: boolean;

  // Actions - UI
  setExpandedSection: (section: keyof ExpandedSections, expanded: boolean) => void;
  setAutoSync: (value: boolean) => void;
  setEmailNotifications: (value: boolean) => void;

  // Gmail State
  gmailAccounts: GmailAccount[];
  isLoadingGmailAccounts: boolean;

  // Actions - Slack
  openSlackDialog: () => void;
  closeSlackDialog: () => void;
  setSlackUserToken: (token: string) => void;
  setChannelSearch: (search: string) => void;
  toggleChannel: (channelId: string) => void;
  setError: (error: string | null) => void;
  validateTokensAndGetChannels: () => Promise<void>;
  connectSlackWorkspace: () => Promise<void>;
  loadSlackIntegrations: () => Promise<void>;
  disconnectSlackIntegration: (integrationId: string) => Promise<void>;

  // Actions - Gmail
  loadGmailAccounts: () => Promise<void>;
  disconnectGmailAccount: (accountId: string) => Promise<void>;

  // Actions - Connectors
  openGongDialog: () => void;
  closeGongDialog: () => void;
  openFathomDialog: () => void;
  closeFathomDialog: () => void;
  setGongAccessKey: (key: string) => void;
  setGongSecretKey: (key: string) => void;
  setFathomApiToken: (token: string) => void;
  setConnectorError: (error: string | null) => void;
  setConnectorSuccess: (success: boolean) => void;
  loadConnectors: (workspaceId: string) => Promise<void>;
  saveGongConnector: (workspaceId: string) => Promise<void>;
  saveFathomConnector: (workspaceId: string) => Promise<void>;
  saveAllConnectors: (workspaceId: string) => Promise<void>;
  disconnectConnector: (workspaceId: string, connectorId: string) => Promise<void>;

  // Actions - Company
  setCompanyData: (data: CompanyDetails) => void;
  loadCompanyDetails: (workspaceId: string) => Promise<void>;
  saveCompanyDetails: (workspaceId: string, data: CompanyDetails) => Promise<void>;
  generateDescription: (workspaceId: string, websiteUrl: string) => Promise<string>;

  // Actions - Company Domains
  setNewDomain: (domain: string) => void;
  loadCompanyDomains: (workspaceId: string, accessToken: string) => Promise<void>;
  addDomain: (workspaceId: string, accessToken: string) => Promise<void>;
  removeDomain: (workspaceId: string, accessToken: string, domain: string) => Promise<void>;

  // Actions - Competitors
  loadCompetitors: (workspaceId: string, accessToken: string) => Promise<void>;
  openCompetitorsDialog: () => void;
  closeCompetitorsDialog: () => void;

  // Computed
  getDataSources: () => DataSource[];
  getFilteredChannels: () => SlackChannel[];
}

export const useWorkspaceSettingsStore = create<WorkspaceSettingsState>((set, get) => ({
  // Initial UI State
  expandedSections: {
    dataSources: true,
    preferences: false,
    workspaceInfo: false,
    connectors: false,
    availableConnectors: false,
  },
  autoSync: true,
  emailNotifications: true,

  // Initial Slack State
  slackDialogOpen: false,
  slackTokens: { userToken: "" },
  availableChannels: [],
  selectedChannels: [],
  isLoadingChannels: false,
  connectionStep: "tokens",
  isConnecting: false,
  error: null,
  slackIntegrations: [],
  teamInfo: null,
  channelSearch: "",
  isLoadingIntegrations: true,

  // Initial Gmail State
  gmailAccounts: [],
  isLoadingGmailAccounts: false,

  // Initial Connector State
  gongDialogOpen: false,
  fathomDialogOpen: false,
  gongAccessKey: "",
  gongSecretKey: "",
  fathomApiToken: "",
  isSavingConnectors: false,
  connectorError: null,
  connectorSuccess: false,
  connectors: [],
  isLoadingConnectors: true,

  // Initial Company State
  companyData: {
    name: "",
    website: "",
    size: "",
    description: "",
  },
  isLoadingCompany: false,

  // Initial Company Domains State
  companyDomains: [],
  newDomain: "",
  isLoadingDomains: false,
  isSavingDomains: false,
  domainsError: null,
  domainsSuccess: false,

  // Initial Competitors State
  competitors: [],
  isLoadingCompetitors: false,
  competitorsDialogOpen: false,

  // UI Actions
  setExpandedSection: (section, expanded) =>
    set((state) => ({
      expandedSections: { ...state.expandedSections, [section]: expanded },
    })),

  setAutoSync: (value) => set({ autoSync: value }),
  setEmailNotifications: (value) => set({ emailNotifications: value }),

  // Slack Actions
  openSlackDialog: () =>
    set({
      slackDialogOpen: true,
      connectionStep: "tokens",
      slackTokens: { userToken: "" },
      selectedChannels: [],
      availableChannels: [],
      channelSearch: "",
      error: null,
    }),

  closeSlackDialog: () => set({ slackDialogOpen: false }),

  setSlackUserToken: (token) =>
    set((state) => ({
      slackTokens: { ...state.slackTokens, userToken: token },
    })),

  setChannelSearch: (search) => set({ channelSearch: search }),

  toggleChannel: (channelId) =>
    set((state) => {
      const { selectedChannels } = state;
      if (selectedChannels.includes(channelId)) {
        return { selectedChannels: selectedChannels.filter((id) => id !== channelId) };
      } else if (selectedChannels.length < 5) {
        return { selectedChannels: [...selectedChannels, channelId] };
      }
      return state;
    }),

  setError: (error) => set({ error }),

  validateTokensAndGetChannels: async () => {
    const { slackTokens } = get();
    if (!slackTokens.userToken) return;

    set({ isLoadingChannels: true, error: null });

    try {
      const response = await slackService.validateTokensAndGetChannels({
        user_token: slackTokens.userToken,
      });

      set({
        availableChannels: response.channels,
        teamInfo: { team_id: response.team_id, team_name: response.team_name },
        connectionStep: "channels",
        isLoadingChannels: false,
      });
    } catch (error: any) {
      console.error("Failed to fetch Slack channels:", error);
      set({
        error: error.response?.data?.detail || "Failed to validate tokens or fetch channels",
        isLoadingChannels: false,
      });
    }
  },

  connectSlackWorkspace: async () => {
    const { slackTokens, selectedChannels } = get();
    if (selectedChannels.length === 0) return;

    set({ isConnecting: true, error: null });

    try {
      await slackService.connectWorkspace({
        user_token: slackTokens.userToken,
        selected_channels: selectedChannels,
      });

      await get().loadSlackIntegrations();
      set({ slackDialogOpen: false, isConnecting: false });
    } catch (error: any) {
      console.error("Failed to connect Slack:", error);
      set({
        error: error.response?.data?.detail || "Failed to connect Slack workspace",
        isConnecting: false,
      });
    }
  },

  loadSlackIntegrations: async () => {
    set({ isLoadingIntegrations: true });

    try {
      const integrations = await slackService.getIntegrations();
      set({ slackIntegrations: integrations, isLoadingIntegrations: false });
    } catch (error) {
      console.error("Failed to load Slack integrations:", error);
      set({ isLoadingIntegrations: false });
    }
  },

  disconnectSlackIntegration: async (integrationId) => {
    try {
      await slackService.disconnectIntegration(integrationId);
      await get().loadSlackIntegrations();
    } catch (error: any) {
      console.error("Failed to disconnect Slack integration:", error);
      set({
        error: error.response?.data?.detail || "Failed to disconnect Slack integration",
      });
    }
  },

  // Connector Actions
  openGongDialog: () =>
    set({ gongDialogOpen: true, gongAccessKey: "", gongSecretKey: "", connectorError: null }),

  closeGongDialog: () => set({ gongDialogOpen: false }),

  openFathomDialog: () =>
    set({ fathomDialogOpen: true, fathomApiToken: "", connectorError: null }),

  closeFathomDialog: () => set({ fathomDialogOpen: false }),

  setGongAccessKey: (key) => set({ gongAccessKey: key }),
  setGongSecretKey: (key) => set({ gongSecretKey: key }),
  setFathomApiToken: (token) => set({ fathomApiToken: token }),
  setConnectorError: (error) => set({ connectorError: error }),
  setConnectorSuccess: (success) => set({ connectorSuccess: success }),

  // Gmail Actions
  loadGmailAccounts: async () => {
    set({ isLoadingGmailAccounts: true });
    try {
      const accounts = await getGmailAccounts();
      set({ gmailAccounts: accounts, isLoadingGmailAccounts: false });
    } catch (error) {
      console.error("Failed to load Gmail accounts:", error);
      set({ isLoadingGmailAccounts: false });
    }
  },

  disconnectGmailAccount: async (accountId) => {
    try {
      await disconnectGmail(accountId);
      await get().loadGmailAccounts();
    } catch (error: any) {
      console.error("Failed to disconnect Gmail account:", error);
      set({
        error: error.response?.data?.detail || "Failed to disconnect Gmail account",
      });
    }
  },

  loadConnectors: async (workspaceId) => {
    if (!workspaceId) return;

    set({ isLoadingConnectors: true });

    try {
      const loadedConnectors = await connectorService.getConnectors(workspaceId);
      set({ connectors: loadedConnectors });

      // Populate form fields with existing connector data
      const gongConnector = loadedConnectors.find((c) => c.connector_type === "gong");
      const fathomConnector = loadedConnectors.find((c) => c.connector_type === "fathom");

      if (gongConnector) {
        set({
          gongAccessKey: gongConnector.gong_access_key || "",
          gongSecretKey: gongConnector.gong_secret_key || "",
        });
      }
      if (fathomConnector) {
        set({ fathomApiToken: fathomConnector.fathom_api_token || "" });
      }
    } catch (error) {
      console.error("Failed to load connectors:", error);
    } finally {
      set({ isLoadingConnectors: false });
    }
  },

  saveGongConnector: async (workspaceId) => {
    const { gongAccessKey, gongSecretKey } = get();

    if (!workspaceId) {
      set({ connectorError: "Workspace ID not found. Please refresh the page." });
      return;
    }
    if (!gongAccessKey || !gongSecretKey) {
      set({ connectorError: "Please enter both Gong Access Key and Secret Key" });
      return;
    }

    set({ isSavingConnectors: true, connectorError: null });

    try {
      await connectorService.saveConnector(workspaceId, {
        connector_type: "gong",
        gong_access_key: gongAccessKey,
        gong_secret_key: gongSecretKey,
      });

      set({ connectorSuccess: true, gongDialogOpen: false });
      await get().loadConnectors(workspaceId);
      setTimeout(() => set({ connectorSuccess: false }), 3000);
    } catch (error: any) {
      console.error("Failed to save Gong connector:", error);
      set({ connectorError: error.response?.data?.detail || "Failed to save Gong connector" });
    } finally {
      set({ isSavingConnectors: false });
    }
  },

  saveFathomConnector: async (workspaceId) => {
    const { fathomApiToken } = get();

    if (!workspaceId) {
      set({ connectorError: "Workspace ID not found. Please refresh the page." });
      return;
    }
    if (!fathomApiToken) {
      set({ connectorError: "Please enter your Fathom API token" });
      return;
    }

    set({ isSavingConnectors: true, connectorError: null });

    try {
      await connectorService.saveConnector(workspaceId, {
        connector_type: "fathom",
        fathom_api_token: fathomApiToken,
      });

      set({ connectorSuccess: true, fathomDialogOpen: false });
      await get().loadConnectors(workspaceId);
      setTimeout(() => set({ connectorSuccess: false }), 3000);
    } catch (error: any) {
      console.error("Failed to save Fathom connector:", error);
      set({ connectorError: error.response?.data?.detail || "Failed to save Fathom connector" });
    } finally {
      set({ isSavingConnectors: false });
    }
  },

  saveAllConnectors: async (workspaceId) => {
    if (!workspaceId) return;

    const { gongAccessKey, gongSecretKey, fathomApiToken } = get();

    set({ isSavingConnectors: true, connectorError: null, connectorSuccess: false });

    try {
      if (gongAccessKey && gongSecretKey) {
        await connectorService.saveConnector(workspaceId, {
          connector_type: "gong",
          gong_access_key: gongAccessKey,
          gong_secret_key: gongSecretKey,
        });
      }

      if (fathomApiToken) {
        await connectorService.saveConnector(workspaceId, {
          connector_type: "fathom",
          fathom_api_token: fathomApiToken,
        });
      }

      set({ connectorSuccess: true });
      await get().loadConnectors(workspaceId);
      setTimeout(() => set({ connectorSuccess: false }), 3000);
    } catch (error: any) {
      console.error("Failed to save connectors:", error);
      set({
        connectorError:
          error.response?.data?.detail || "Failed to save connectors. Please try again.",
      });
    } finally {
      set({ isSavingConnectors: false });
    }
  },

  disconnectConnector: async (workspaceId, connectorId) => {
    try {
      await connectorService.deleteConnector(workspaceId, connectorId);
      await get().loadConnectors(workspaceId);
    } catch (error: any) {
      console.error("Failed to disconnect connector:", error);
      set({
        error: error.response?.data?.detail || "Failed to disconnect connector",
      });
    }
  },

  // Company Actions
  setCompanyData: (data) => set({ companyData: data }),

  loadCompanyDetails: async (workspaceId) => {
    if (!workspaceId) return;

    try {
      const details = await companyService.getCompanyDetails(workspaceId);
      set({ companyData: details });
    } catch (error: any) {
      console.error("Failed to load company details:", error);
    }
  },

  saveCompanyDetails: async (workspaceId, data) => {
    if (!workspaceId) throw new Error("No workspace selected");

    set({ isLoadingCompany: true });

    try {
      await companyService.updateCompanyDetails(workspaceId, data);
      await get().loadCompanyDetails(workspaceId);
    } catch (error: any) {
      console.error("Failed to save company details:", error);
      throw error;
    } finally {
      set({ isLoadingCompany: false });
    }
  },

  generateDescription: async (workspaceId, websiteUrl) => {
    if (!workspaceId) throw new Error("No workspace selected");

    try {
      return await companyService.generateDescription(workspaceId, websiteUrl);
    } catch (error: any) {
      console.error("Failed to generate description:", error);
      throw error;
    }
  },

  // Company Domains Actions
  setNewDomain: (domain) => set({ newDomain: domain }),

  loadCompanyDomains: async (workspaceId, accessToken) => {
    if (!workspaceId) {
      console.warn("[Company Domains] No workspace ID found");
      return;
    }

    set({ isLoadingDomains: true });

    try {
      const url = `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/company-domains`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Company Domains] Error response:", errorText);
        throw new Error(`Failed to load company domains: ${response.status}`);
      }

      const data = await response.json();
      set({ companyDomains: data.company_domains || [] });
    } catch (error: any) {
      console.error("[Company Domains] Failed to load:", error);
      set({ domainsError: "Failed to load company domains" });
    } finally {
      set({ isLoadingDomains: false });
    }
  },

  addDomain: async (workspaceId, accessToken) => {
    const { newDomain, companyDomains } = get();

    if (!newDomain.trim()) return;

    const domainToAdd = normalizeDomain(newDomain);

    if (!isValidDomain(domainToAdd)) {
      set({ domainsError: "Please enter a valid domain (e.g., hiverhq.com)" });
      return;
    }

    if (companyDomains.includes(domainToAdd)) {
      set({ domainsError: "This domain is already in the list" });
      return;
    }

    const updatedDomains = [...companyDomains, domainToAdd];
    await saveCompanyDomainsInternal(workspaceId, accessToken, updatedDomains, set);
    set({ newDomain: "" });
  },

  removeDomain: async (workspaceId, accessToken, domain) => {
    const { companyDomains } = get();
    const updatedDomains = companyDomains.filter((d) => d !== domain);
    await saveCompanyDomainsInternal(workspaceId, accessToken, updatedDomains, set);
  },

  // Competitors Actions
  loadCompetitors: async (workspaceId, accessToken) => {
    if (!workspaceId || !accessToken) {
      console.warn("[Competitors] No workspace ID or access token found");
      return;
    }

    set({ isLoadingCompetitors: true });

    try {
      const url = `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/competitors`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Competitors] Error response:", errorText);
        throw new Error(`Failed to load competitors: ${response.status}`);
      }

      const data = await response.json();
      set({ competitors: data.competitors || [] });
    } catch (error: any) {
      console.error("[Competitors] Failed to load:", error);
      set({ competitors: [] });
    } finally {
      set({ isLoadingCompetitors: false });
    }
  },

  openCompetitorsDialog: () => set({ competitorsDialogOpen: true }),
  closeCompetitorsDialog: () => set({ competitorsDialogOpen: false }),

  // Computed getters
  getDataSources: () => {
    const { slackIntegrations, connectors, gmailAccounts } = get();

    const dataSources: DataSource[] = [
      // Slack integrations
      ...slackIntegrations.map((integration) => ({
        id: integration.id,
        name: integration.team_name,
        type: "slack" as const,
        status:
          integration.status === "pending" || integration.status === "connected"
            ? ("connected" as const)
            : ("disconnected" as const),
        lastSync: integration.last_synced ? "Just now" : undefined,
        channels: integration.channels,
      })),
      // Gmail accounts
      ...gmailAccounts.map((account) => ({
        id: account.id,
        name: account.first_name || account.gmail_email.split("@")[0],
        type: "gmail" as const,
        status: "connected" as const,
      })),
      // Gong connector
      ...(connectors.some((c) => c.connector_type === "gong" && c.is_active)
        ? [
            {
              id: connectors.find((c) => c.connector_type === "gong")?.id || "gong",
              name: "Gong",
              type: "gong" as const,
              status: "connected" as const,
            },
          ]
        : []),
      // Fathom connector
      ...(connectors.some((c) => c.connector_type === "fathom" && c.is_active)
        ? [
            {
              id: connectors.find((c) => c.connector_type === "fathom")?.id || "fathom",
              name: "Fathom",
              type: "fathom" as const,
              status: "connected" as const,
            },
          ]
        : []),
    ];

    return dataSources;
  },

  getFilteredChannels: () => {
    const { availableChannels, channelSearch } = get();
    return availableChannels.filter(
      (channel) =>
        channel.name.toLowerCase().includes(channelSearch.toLowerCase()) ||
        channel.purpose?.toLowerCase().includes(channelSearch.toLowerCase()) ||
        channel.topic?.toLowerCase().includes(channelSearch.toLowerCase())
    );
  },
}));

// Helper function for saving company domains
async function saveCompanyDomainsInternal(
  workspaceId: string,
  accessToken: string,
  domains: string[],
  set: (state: Partial<WorkspaceSettingsState>) => void
) {
  set({ isSavingDomains: true, domainsError: null });

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/company-domains`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company_domains: domains }),
      }
    );

    if (!response.ok) throw new Error("Failed to update company domains");

    const data = await response.json();
    set({ companyDomains: data.company_domains || [], domainsSuccess: true });
    setTimeout(() => set({ domainsSuccess: false }), 3000);
  } catch (error: any) {
    console.error("Failed to save company domains:", error);
    set({ domainsError: "Failed to save company domains" });
  } finally {
    set({ isSavingDomains: false });
  }
}
