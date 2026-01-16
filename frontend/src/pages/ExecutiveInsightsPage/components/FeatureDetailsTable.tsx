/**
 * Feature Details Table Component
 */

import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  alpha,
  useTheme,
  Pagination,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Divider,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useState } from 'react';
import { Feature } from '../store/executiveInsightsStore';

interface FeatureDetailsTableProps {
  topFeatures: Feature[];
  getStatusColor: (status: string) => string;
  getUrgencyColor: (urgency: string) => string;
}

export function FeatureDetailsTable({
  topFeatures,
  getStatusColor,
  getUrgencyColor,
}: FeatureDetailsTableProps): JSX.Element {
  const theme = useTheme();
  const [page, setPage] = useState(1);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const itemsPerPage = 5;
  const totalPages = Math.ceil(topFeatures.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedFeatures = topFeatures.slice(startIndex, endIndex);

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  const handleRowClick = (feature: Feature) => {
    setSelectedFeature(feature);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedFeature(null);
  };

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 1.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: theme.palette.text.secondary,
            }}
          >
            Feature Details
          </Typography>
          {topFeatures.length > itemsPerPage && (
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.688rem',
              }}
            >
              Showing {startIndex + 1}-{Math.min(endIndex, topFeatures.length)} of {topFeatures.length}
            </Typography>
          )}
        </Box>
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            background: 'transparent',
            overflowX: 'auto',
            '&::-webkit-scrollbar': {
              height: 8,
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: alpha(theme.palette.primary.main, 0.3),
              borderRadius: 4,
            },
          }}
        >
          <Table sx={{ width: '100%' }}>
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    p: { xs: 1, sm: 2 },
                  }}
                >
                  #
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    p: { xs: 1, sm: 2 },
                  }}
                >
                  Feature
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    p: { xs: 1, sm: 2 },
                  }}
                >
                  Theme
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    p: { xs: 1, sm: 2 },
                  }}
                >
                  Mentions
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    p: { xs: 1, sm: 2 },
                  }}
                >
                  Urgency
                </TableCell>
                <TableCell
                  sx={{
                    fontWeight: 600,
                    fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    p: { xs: 1, sm: 2 },
                  }}
                >
                  Status
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {displayedFeatures.map((feature, idx) => (
                <TableRow
                  key={feature.id}
                  hover
                  onClick={() => handleRowClick(feature)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.04),
                    },
                  }}
                >
                  <TableCell sx={{ p: { xs: 1, sm: 2 } }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: theme.palette.text.secondary,
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      }}
                    >
                                  {startIndex + idx + 1}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ p: { xs: 1, sm: 2 } }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                      }}
                    >
                      {feature.name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ p: { xs: 1, sm: 2 } }}>
                    {feature.theme ? (
                      <Chip
                        label={feature.theme.name}
                        size="small"
                        sx={{
                          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                          color: theme.palette.primary.main,
                          border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                          fontWeight: 500,
                          height: { xs: 20, sm: 24 },
                          fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        }}
                      />
                    ) : (
                      <Chip
                        label="No Theme"
                        size="small"
                        sx={{
                          background: alpha(theme.palette.text.secondary, 0.1),
                          color: theme.palette.text.secondary,
                          border: `1px solid ${alpha(theme.palette.text.secondary, 0.3)}`,
                          fontWeight: 500,
                          height: { xs: 20, sm: 24 },
                          fontSize: { xs: '0.7rem', sm: '0.75rem' },
                        }}
                      />
                    )}
                  </TableCell>
                  <TableCell sx={{ p: { xs: 1, sm: 2 } }}>
                    <Chip
                      label={feature.mention_count}
                      size="small"
                      sx={{
                        background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.15)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                        color: theme.palette.secondary.main,
                        border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
                        fontWeight: 600,
                        height: { xs: 20, sm: 24 },
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ p: { xs: 1, sm: 2 } }}>
                    <Chip
                      label={feature.urgency}
                      size="small"
                      sx={{
                        background: alpha(getUrgencyColor(feature.urgency), 0.1),
                        color: getUrgencyColor(feature.urgency),
                        border: `1px solid ${alpha(getUrgencyColor(feature.urgency), 0.3)}`,
                        textTransform: 'capitalize',
                        fontWeight: 500,
                        height: { xs: 20, sm: 24 },
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ p: { xs: 1, sm: 2 } }}>
                    <Chip
                      label={feature.status.replace('_', ' ')}
                      size="small"
                      sx={{
                        background: alpha(getStatusColor(feature.status), 0.1),
                        color: getStatusColor(feature.status),
                        border: `1px solid ${alpha(getStatusColor(feature.status), 0.3)}`,
                        textTransform: 'capitalize',
                        fontWeight: 500,
                        height: { xs: 20, sm: 24 },
                        fontSize: { xs: '0.7rem', sm: '0.75rem' },
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {topFeatures.length > itemsPerPage && (
          <Stack spacing={2} sx={{ mt: 2, alignItems: 'center' }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
              size="small"
              sx={{
                '& .MuiPaginationItem-root': {
                  fontSize: { xs: '0.75rem', sm: '0.813rem' },
                  minWidth: { xs: 28, sm: 32 },
                  height: { xs: 28, sm: 32 },
                },
              }}
            />
          </Stack>
        )}
      </CardContent>

      {/* Feature Details Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Feature Details
          </Typography>
          <IconButton
            onClick={handleCloseDialog}
            size="small"
            sx={{
              color: theme.palette.text.secondary,
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {selectedFeature && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: theme.palette.text.secondary }}>
                  Feature Name
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {selectedFeature.name}
                </Typography>
              </Box>

              {selectedFeature.description && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: theme.palette.text.secondary }}>
                    Description
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedFeature.description}
                  </Typography>
                </Box>
              )}

              <Divider />

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: theme.palette.text.secondary, fontSize: '0.75rem' }}>
                    Status
                  </Typography>
                  <Chip
                    label={selectedFeature.status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    size="small"
                    sx={{
                      bgcolor: alpha(getStatusColor(selectedFeature.status), 0.1),
                      color: getStatusColor(selectedFeature.status),
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: theme.palette.text.secondary, fontSize: '0.75rem' }}>
                    Urgency
                  </Typography>
                  <Chip
                    label={selectedFeature.urgency.charAt(0).toUpperCase() + selectedFeature.urgency.slice(1)}
                    size="small"
                    sx={{
                      bgcolor: alpha(getUrgencyColor(selectedFeature.urgency), 0.1),
                      color: getUrgencyColor(selectedFeature.urgency),
                      fontWeight: 600,
                    }}
                  />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: theme.palette.text.secondary, fontSize: '0.75rem' }}>
                    Mentions
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {selectedFeature.mention_count}
                  </Typography>
                </Box>
              </Box>

              {selectedFeature.theme && (
                <>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: theme.palette.text.secondary }}>
                      Theme
                    </Typography>
                    <Typography variant="body2">
                      {selectedFeature.theme.name}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseDialog} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
