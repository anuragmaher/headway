/**
 * PageHeader - Header with tabs and action buttons for All Messages page
 */

import {
  Box,
  Button,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material';
import {
  AutoAwesome as ThemeSyncIcon,
  ChatBubbleOutline as MessagesIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import { SyncSourcesDropdown } from './SyncSourcesDropdown';

interface PageHeaderProps {
  activeTab: number;
  onTabChange: (event: React.SyntheticEvent, newValue: number) => void;
  messagesTotal: number;
  syncingThemes: boolean;
  syncingAll: boolean;
  workspaceId: string | undefined;
  onSyncTheme: () => void;
  onSyncSources: (selectedSources: string[]) => void;
}

export function PageHeader({
  activeTab,
  onTabChange,
  messagesTotal,
  syncingThemes,
  syncingAll,
  workspaceId,
  onSyncTheme,
  onSyncSources,
}: PageHeaderProps): JSX.Element {
  const theme = useTheme();

  return (
    <Box
      sx={{
        px: 2.5,
        pt: 1.5,
        pb: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
      }}
    >
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={onTabChange}
        sx={{
          minHeight: 40,
          '& .MuiTabs-indicator': {
            height: 2,
            borderRadius: '2px 2px 0 0',
          },
        }}
      >
        <Tab
          icon={<MessagesIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <span>All Transcripts</span>
              <Chip
                label={messagesTotal}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </Box>
          }
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.8rem',
            minHeight: 40,
            py: 1,
            px: 1.5,
            minWidth: 'auto',
            gap: 0.5,
          }}
        />
        <Tab
          icon={<HistoryIcon sx={{ fontSize: 16 }} />}
          iconPosition="start"
          label="Sync History"
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.8rem',
            minHeight: 40,
            py: 1,
            px: 1.5,
            minWidth: 'auto',
            gap: 0.5,
          }}
        />
      </Tabs>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={syncingThemes ? <CircularProgress size={14} /> : <ThemeSyncIcon sx={{ fontSize: 16 }} />}
          onClick={onSyncTheme}
          disabled={syncingThemes || !workspaceId}
          sx={{
            textTransform: 'none',
            fontWeight: 500,
            fontSize: '0.8rem',
            borderRadius: 1.5,
            px: 1.5,
            py: 0.5,
            borderColor: alpha(theme.palette.divider, 0.3),
            color: theme.palette.text.primary,
            '&:hover': {
              borderColor: theme.palette.primary.main,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
            },
          }}
        >
          {syncingThemes ? 'Syncing...' : 'Sync Theme'}
        </Button>
        <SyncSourcesDropdown
          syncing={syncingAll}
          disabled={syncingAll || !workspaceId}
          onSync={onSyncSources}
        />
      </Box>
    </Box>
  );
}

export default PageHeader;
