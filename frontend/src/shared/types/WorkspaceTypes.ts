/**
 * Type definitions for Workspace Settings
 */

import type { SlackChannel } from "@/services/slack";

export interface DataSource {
  id: string;
  name: string;
  type: "slack" | "gmail" | "teams" | "discord" | "api" | "gong" | "fathom";
  status: "connected" | "disconnected" | "error";
  lastSync?: string;
  channels?: SlackChannel[];
  userToken?: string;
}

export interface ExpandedSections {
  dataSources: boolean;
  preferences: boolean;
  workspaceInfo: boolean;
  connectors: boolean;
  availableConnectors: boolean;
}

export interface ConnectorInfo {
  name: string;
  description: string;
  available: boolean;
}

// All active connectors that can be connected
export const ACTIVE_CONNECTORS: ConnectorInfo[] = [
  {
    name: "Slack",
    description: "Monitor channels for feature requests",
    available: true,
  },
  {
    name: "Gmail",
    description: "Collect feedback from email conversations",
    available: true,
  },
  {
    name: "Gong",
    description: "Analyze sales call recordings",
    available: true,
  },
  {
    name: "Fathom",
    description: "Import meeting transcripts and notes",
    available: true,
  },
];

// Coming soon connectors
export const COMING_SOON_CONNECTORS: ConnectorInfo[] = [
  {
    name: "Microsoft Teams",
    description: "Collect feedback from team conversations",
    available: false,
  },
  {
    name: "Discord",
    description: "Track community suggestions",
    available: false,
  },
  {
    name: "Hubspot",
    description: "Sync customer feedback from CRM",
    available: false,
  },
  {
    name: "Zendesk",
    description: "Import support tickets and feedback",
    available: false,
  },
  {
    name: "Intercom",
    description: "Capture conversations and feedback",
    available: false,
  },
];

// Combined list for backwards compatibility
export const AVAILABLE_CONNECTORS: ConnectorInfo[] = [
  ...ACTIVE_CONNECTORS,
  ...COMING_SOON_CONNECTORS,
];
