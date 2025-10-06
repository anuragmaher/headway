import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Switch,
  IconButton,
  Tooltip,
  LinearProgress,
  useTheme,
  alpha,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  KeyboardArrowUp as HighIcon,
  KeyboardArrowDown as LowIcon,
  Remove as MediumIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useClusteringStore } from '../store/clustering-store';
import type { ClassificationSignal } from '../types/clustering.types';

interface ClassificationSignalsViewProps {
  workspaceId: string;
}

const ClassificationSignalsView: React.FC<ClassificationSignalsViewProps> = ({ workspaceId }) => {
  const theme = useTheme();
  const { signals, isLoading, toggleSignal } = useClusteringStore();

  const [filterType, setFilterType] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const handleToggleSignal = async (signalId: string) => {
    try {
      await toggleSignal(signalId);
    } catch (error) {
      console.error('Failed to toggle signal:', error);
    }
  };

  const getSignalTypeColor = (type: ClassificationSignal['signal_type']) => {
    switch (type) {
      case 'keyword': return 'primary';
      case 'pattern': return 'secondary';
      case 'semantic': return 'success';
      case 'business_rule': return 'warning';
      default: return 'default';
    }
  };

  const getSignalTypeIcon = (type: ClassificationSignal['signal_type']) => {
    switch (type) {
      case 'keyword': return '🔑';
      case 'pattern': return '🔍';
      case 'semantic': return '🧠';
      case 'business_rule': return '⚖️';
      default: return '📋';
    }
  };

  const getPriorityIcon = (weight: number) => {
    if (weight >= 0.8) return <HighIcon color="error" />;
    if (weight >= 0.5) return <MediumIcon color="warning" />;
    return <LowIcon color="success" />;
  };

  const getPriorityText = (weight: number) => {
    if (weight >= 0.8) return 'High';
    if (weight >= 0.5) return 'Medium';
    return 'Low';
  };

  const getPerformanceColor = (value?: number) => {
    if (!value) return theme.palette.text.disabled;
    if (value >= 0.8) return theme.palette.success.main;
    if (value >= 0.6) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const formatPercentage = (value?: number) => {
    return value ? `${Math.round(value * 100)}%` : 'N/A';
  };

  const filteredSignals = signals.filter(signal => {
    if (filterType !== 'all' && signal.signal_type !== filterType) return false;
    if (filterActive === 'active' && !signal.is_active) return false;
    if (filterActive === 'inactive' && signal.is_active) return false;
    if (searchTerm && !signal.signal_name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const signalTypeStats = signals.reduce((acc, signal) => {
    acc[signal.signal_type] = (acc[signal.signal_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            Loading classification signals...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Box>
      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={800} color="primary">
                {signals.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Signals
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={800} color="success.main">
                {signals.filter(s => s.is_active).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Signals
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={800} color="info.main">
                {signals.reduce((sum, s) => sum + s.usage_count, 0)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Usage
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" fontWeight={800} color="warning.main">
                {signals.filter(s => s.precision && s.precision >= 0.8).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                High Precision
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Signal Type Distribution */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Signal Types Distribution
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(signalTypeStats).map(([type, count]) => (
              <Grid item key={type}>
                <Chip
                  icon={<span>{getSignalTypeIcon(type as ClassificationSignal['signal_type'])}</span>}
                  label={`${type.charAt(0).toUpperCase() + type.slice(1)}: ${count}`}
                  color={getSignalTypeColor(type as ClassificationSignal['signal_type'])}
                  variant="outlined"
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                placeholder="Search signals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Signal Type</InputLabel>
                <Select
                  value={filterType}
                  label="Signal Type"
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="keyword">Keyword</MenuItem>
                  <MenuItem value="pattern">Pattern</MenuItem>
                  <MenuItem value="semantic">Semantic</MenuItem>
                  <MenuItem value="business_rule">Business Rule</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterActive}
                  label="Status"
                  onChange={(e) => setFilterActive(e.target.value)}
                >
                  <MenuItem value="all">All Signals</MenuItem>
                  <MenuItem value="active">Active Only</MenuItem>
                  <MenuItem value="inactive">Inactive Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Signals Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Classification Signals ({filteredSignals.length})
          </Typography>

          {filteredSignals.length === 0 ? (
            <Box
              sx={{
                textAlign: 'center',
                py: 6,
                color: 'text.secondary',
              }}
            >
              <InfoIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
              <Typography variant="h6" sx={{ mb: 1 }}>
                No signals found
              </Typography>
              <Typography variant="body2">
                {searchTerm || filterType !== 'all' || filterActive !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Approve some clusters to generate classification signals'}
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Signal Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell align="center">Priority</TableCell>
                    <TableCell align="center">Precision</TableCell>
                    <TableCell align="center">Recall</TableCell>
                    <TableCell align="center">Usage</TableCell>
                    <TableCell align="center">Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSignals.map((signal) => (
                    <TableRow
                      key={signal.id}
                      sx={{
                        opacity: signal.is_active ? 1 : 0.6,
                        '&:hover': {
                          backgroundColor: alpha(theme.palette.primary.main, 0.04),
                        },
                      }}
                    >
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {signal.signal_name}
                          </Typography>
                          {signal.keywords && signal.keywords.length > 0 && (
                            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {signal.keywords.slice(0, 3).map((keyword, index) => (
                                <Chip
                                  key={index}
                                  label={keyword}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem' }}
                                />
                              ))}
                              {signal.keywords.length > 3 && (
                                <Chip
                                  label={`+${signal.keywords.length - 3} more`}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem' }}
                                />
                              )}
                            </Box>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<span>{getSignalTypeIcon(signal.signal_type)}</span>}
                          label={signal.signal_type}
                          color={getSignalTypeColor(signal.signal_type)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {signal.target_category}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {signal.target_theme}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={`Priority: ${getPriorityText(signal.priority_weight)}`}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                            {getPriorityIcon(signal.priority_weight)}
                            <Typography variant="body2" fontWeight={600}>
                              {getPriorityText(signal.priority_weight)}
                            </Typography>
                          </Box>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={getPerformanceColor(signal.precision)}
                        >
                          {formatPercentage(signal.precision)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          color={getPerformanceColor(signal.recall)}
                        >
                          {formatPercentage(signal.recall)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" fontWeight={600}>
                          {signal.usage_count.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Switch
                          checked={signal.is_active}
                          onChange={() => handleToggleSignal(signal.id)}
                          color="success"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default ClassificationSignalsView;