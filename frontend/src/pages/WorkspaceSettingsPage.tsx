/**
 * Workspace Settings Page
 * Refactored modular version with Zustand state management
 */

import { useEffect } from "react";
import { Box, Grid } from "@mui/material";
import { AdminLayout } from "@/shared/components/layouts";
import { useAuthStore } from "@/features/auth/store/auth-store";
import { CompanyDetailsForm } from "@/shared/components/CompanyDetailsForm";
import GmailConnectModal from "@/shared/components/gmailConnect";
import { useWorkspaceSettingsStore } from "@/shared/store/WorkspaceStore/workspaceSettingsStore";
import {
  ConnectedDataSources,
  CompetitorsSection,
  CompanyDomainsSection,
  AvailableConnectors,
  SlackConnectionDialog,
  GongConnectorDialog,
  FathomConnectorDialog,
  NotificationSnackbars,
} from "@/shared/components/WorkspaceComponents";

export function WorkspaceSettingsPage(): JSX.Element {
  const auth = useAuthStore();

  const {
    companyData,
    isLoadingCompany,
    loadSlackIntegrations,
    loadConnectors,
    loadGmailAccounts,
    loadCompanyDetails,
    loadCompetitors,
    loadCompanyDomains,
    saveCompanyDetails,
  } = useWorkspaceSettingsStore((state) => ({
    companyData: state.companyData,
    isLoadingCompany: state.isLoadingCompany,
    loadSlackIntegrations: state.loadSlackIntegrations,
    loadConnectors: state.loadConnectors,
    loadGmailAccounts: state.loadGmailAccounts,
    loadCompanyDetails: state.loadCompanyDetails,
    loadCompetitors: state.loadCompetitors,
    loadCompanyDomains: state.loadCompanyDomains,
    saveCompanyDetails: state.saveCompanyDetails,
  }));

  const workspaceId = auth.tokens?.workspace_id;
  const accessToken = auth.tokens?.access_token;

  // Load integrations and connectors on component mount
  useEffect(() => {
    loadSlackIntegrations();
    loadGmailAccounts();
    if (workspaceId) {
      loadConnectors(workspaceId);
    }
  }, [workspaceId]);

  // Reload Gmail accounts when URL has gmail=connected parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      // Small delay to ensure backend has processed the connection
      setTimeout(() => {
        loadGmailAccounts();
      }, 1000);
    }
  }, []);

  // Load company details, competitors, and domains when workspace_id is available
  useEffect(() => {
    if (workspaceId && accessToken) {
      loadCompanyDetails(workspaceId);
      loadCompetitors(workspaceId, accessToken);
      loadCompanyDomains(workspaceId, accessToken);
    }
  }, [workspaceId, accessToken]);

  const handleSaveCompanyDetails = async (data: typeof companyData) => {
    if (!workspaceId) {
      throw new Error("No workspace selected");
    }
    await saveCompanyDetails(workspaceId, data);
  };

  return (
    <AdminLayout>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, pt: { xs: 2, sm: 3 } }}>
        {/* Company Details and Competitors - Side by Side */}
        <Grid container spacing={3} sx={{ mb: 3, alignItems: 'stretch' }}>
          <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
            <CompanyDetailsForm
              companyData={companyData}
              onSave={handleSaveCompanyDetails}
              isLoading={isLoadingCompany}
            />
          </Grid>
          <Grid item xs={12} md={6} sx={{ display: 'flex' }}>
            <CompetitorsSection />
          </Grid>
        </Grid>

        {/* Company Domains Section */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={6}>
            <CompanyDomainsSection />
          </Grid>
        </Grid>

        {/* Connected Data Sources and Available Connectors - Side by Side */}
        <Grid container spacing={3} sx={{ mb: 3, alignItems: 'stretch' }}>
          <Grid item xs={12} lg={6} sx={{ display: 'flex' }}>
            <ConnectedDataSources />
          </Grid>
          <Grid item xs={12} lg={6} sx={{ display: 'flex' }}>
            <AvailableConnectors />
          </Grid>
        </Grid>

        {/* Dialogs */}
        <GmailConnectModal />
        <SlackConnectionDialog />
        <GongConnectorDialog />
        <FathomConnectorDialog />

        {/* Notification Snackbars */}
        <NotificationSnackbars />
      </Box>
    </AdminLayout>
  );
}

// Re-export for backwards compatibility
export default WorkspaceSettingsPage;
