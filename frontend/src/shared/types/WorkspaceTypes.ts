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

export const AVAILABLE_CONNECTORS: ConnectorInfo[] = [
  {
    name: "Slack",
    description: "Monitor channels for feature requests",
    available: true,
  },
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
];
