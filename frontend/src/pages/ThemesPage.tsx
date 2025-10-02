/**
 * Themes page for managing and organizing feature request themes
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  alpha,
  useTheme,
  IconButton,
  Avatar,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Divider,
} from '@mui/material';
import {
  Category as CategoryIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  TrendingUp as TrendingIcon,
  FeaturedPlayList as FeatureIcon,
  Close as CloseIcon,
  Analytics as AnalyticsIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';

interface Theme {
  id: string;
  name: string;
  description: string;
  color: string;
  featureCount: number;
  totalMentions: number;
  slackMentions: number;
  emailMentions: number;
  competitors: number;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'archived' | 'planning';
  createdAt: string;
  updatedAt: string;
  owner: string;
  progress: number;
  tags: string[];
}

interface ThemeFormData {
  name: string;
  description: string;
  color: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'archived' | 'planning';
  tags: string;
}

export function ThemesPage(): JSX.Element {
  const theme = useTheme();
  const [selectedThemeId, setSelectedThemeId] = useState<string>('1');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [formData, setFormData] = useState<ThemeFormData>({
    name: '',
    description: '',
    color: theme.palette.primary.main,
    priority: 'medium',
    status: 'active',
    tags: '',
  });

  // Mock themes data
  const [themes, setThemes] = useState<Theme[]>([
    {
      id: '1',
      name: 'User Experience',
      description: 'Improvements to user interface and user experience across the platform',
      color: theme.palette.primary.main,
      featureCount: 12,
      totalMentions: 234,
      slackMentions: 142,
      emailMentions: 67,
      competitors: 25,
      priority: 'high',
      status: 'active',
      createdAt: '2024-01-15',
      updatedAt: '2024-01-28',
      owner: 'Sarah Wilson',
      progress: 75,
      tags: ['UI/UX', 'Frontend', 'Design'],
    },
    {
      id: '2',
      name: 'Performance',
      description: 'Speed optimizations and performance improvements for better user experience',
      color: theme.palette.success.main,
      featureCount: 8,
      totalMentions: 189,
      slackMentions: 118,
      emailMentions: 52,
      competitors: 19,
      priority: 'high',
      status: 'active',
      createdAt: '2024-01-10',
      updatedAt: '2024-01-25',
      owner: 'David Chen',
      progress: 60,
      tags: ['Backend', 'Optimization', 'Speed'],
    },
    {
      id: '3',
      name: 'Integrations',
      description: 'Third-party integrations and API connections to enhance platform capabilities',
      color: theme.palette.warning.main,
      featureCount: 15,
      totalMentions: 167,
      slackMentions: 94,
      emailMentions: 55,
      competitors: 18,
      priority: 'medium',
      status: 'active',
      createdAt: '2024-01-08',
      updatedAt: '2024-01-20',
      owner: 'Alex Turner',
      progress: 40,
      tags: ['API', 'Third-party', 'Connectivity'],
    },
    {
      id: '4',
      name: 'Security',
      description: 'Security enhancements and privacy improvements to protect user data',
      color: theme.palette.error.main,
      featureCount: 6,
      totalMentions: 145,
      slackMentions: 88,
      emailMentions: 42,
      competitors: 15,
      priority: 'high',
      status: 'active',
      createdAt: '2024-01-12',
      updatedAt: '2024-01-22',
      owner: 'Emily Rodriguez',
      progress: 85,
      tags: ['Security', 'Privacy', 'Compliance'],
    },
    {
      id: '5',
      name: 'Mobile',
      description: 'Mobile app features and responsive design improvements for mobile users',
      color: theme.palette.info.main,
      featureCount: 9,
      totalMentions: 123,
      slackMentions: 74,
      emailMentions: 35,
      competitors: 14,
      priority: 'medium',
      status: 'planning',
      createdAt: '2024-01-05',
      updatedAt: '2024-01-18',
      owner: 'Chris Johnson',
      progress: 25,
      tags: ['Mobile', 'Responsive', 'iOS', 'Android'],
    },
    {
      id: '6',
      name: 'Analytics',
      description: 'Advanced analytics and reporting features for better insights',
      color: theme.palette.secondary.main,
      featureCount: 4,
      totalMentions: 98,
      slackMentions: 58,
      emailMentions: 28,
      competitors: 12,
      priority: 'low',
      status: 'planning',
      createdAt: '2024-01-03',
      updatedAt: '2024-01-15',
      owner: 'Lisa Park',
      progress: 10,
      tags: ['Analytics', 'Reporting', 'Insights'],
    },
  ]);

  const selectedTheme = themes.find(t => t.id === selectedThemeId) || themes[0];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return theme.palette.error.main;
      case 'medium': return theme.palette.warning.main;
      case 'low': return theme.palette.success.main;
      default: return theme.palette.grey[500];
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return theme.palette.success.main;
      case 'planning': return theme.palette.info.main;
      case 'archived': return theme.palette.grey[500];
      default: return theme.palette.grey[500];
    }
  };

  const handleOpenDialog = (themeToEdit?: Theme) => {
    if (themeToEdit) {
      setEditingTheme(themeToEdit);
      setFormData({
        name: themeToEdit.name,
        description: themeToEdit.description,
        color: themeToEdit.color,
        priority: themeToEdit.priority,
        status: themeToEdit.status,
        tags: themeToEdit.tags.join(', '),
      });
    } else {
      setEditingTheme(null);
      setFormData({
        name: '',
        description: '',
        color: theme.palette.primary.main,
        priority: 'medium',
        status: 'active',
        tags: '',
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingTheme(null);
  };

  const handleSubmit = () => {
    const newTheme: Theme = {
      id: editingTheme?.id || Date.now().toString(),
      name: formData.name,
      description: formData.description,
      color: formData.color,
      priority: formData.priority,
      status: formData.status,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      featureCount: editingTheme?.featureCount || 0,
      totalMentions: editingTheme?.totalMentions || 0,
      slackMentions: editingTheme?.slackMentions || 0,
      emailMentions: editingTheme?.emailMentions || 0,
      competitors: editingTheme?.competitors || 0,
      progress: editingTheme?.progress || 0,
      owner: editingTheme?.owner || 'Current User',
      createdAt: editingTheme?.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };

    if (editingTheme) {
      setThemes(themes.map(t => t.id === editingTheme.id ? newTheme : t));
    } else {
      setThemes([...themes, newTheme]);
    }

    handleCloseDialog();
  };

  const handleDeleteTheme = (themeId: string) => {
    setThemes(themes.filter(t => t.id !== themeId));
    if (selectedThemeId === themeId) {
      setSelectedThemeId(themes[0]?.id || '');
    }
  };

  const totalFeatures = themes.reduce((acc, t) => acc + t.featureCount, 0);
  const totalMentions = themes.reduce((acc, t) => acc + t.totalMentions, 0);
  const activeThemes = themes.filter(t => t.status === 'active').length;

  return (
    <AdminLayout>
      <Box>
        {/* Header */}
        <Box sx={{ 
          mb: 3,
          p: 3,
          borderRadius: 2,
          background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
          border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: -50,
            right: -50,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
            filter: 'blur(20px)',
          },
        }}>
          <Box sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 4px 20px ${alpha(theme.palette.secondary.main, 0.3)}`,
                }}>
                  <CategoryIcon sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
                    Theme Management
                  </Typography>
                  <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                    Organize and categorize feature requests by themes
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
                sx={{
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)`,
                  '&:hover': { transform: 'translateY(-1px)' },
                }}
              >
                Create Theme
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Stats Overview */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': { transform: 'translateY(-2px)' },
            }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <CategoryIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {themes.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Themes
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.success.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.success.main, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': { transform: 'translateY(-2px)' },
            }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.success.main} 0%, ${theme.palette.success.dark} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <SpeedIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {activeThemes}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Themes
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.warning.main, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': { transform: 'translateY(-2px)' },
            }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.warning.main} 0%, ${theme.palette.warning.dark} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <FeatureIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {totalFeatures}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Features
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.info.main, 0.05)} 100%)`,
              border: `1px solid ${alpha(theme.palette.info.main, 0.1)}`,
              transition: 'all 0.3s ease-in-out',
              '&:hover': { transform: 'translateY(-2px)' },
            }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: 2,
                    background: `linear-gradient(135deg, ${theme.palette.info.main} 0%, ${theme.palette.info.dark} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <TrendingIcon sx={{ color: 'white', fontSize: 20 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>
                      {totalMentions}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Mentions
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Main Content */}
        <Grid container spacing={2}>
          {/* Themes List */}
          <Grid item xs={12} lg={8}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <CategoryIcon sx={{ color: theme.palette.primary.main }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    All Themes
                  </Typography>
                  <Chip
                    label={`${themes.length} themes`}
                    size="small"
                    sx={{
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                    }}
                  />
                </Box>

                <Grid container spacing={2}>
                  {themes.map((themeItem) => (
                    <Grid item xs={12} sm={6} key={themeItem.id}>
                      <Card sx={{
                        borderRadius: 1,
                        background: `linear-gradient(135deg, ${alpha(themeItem.color, 0.1)} 0%, ${alpha(themeItem.color, 0.05)} 100%)`,
                        border: selectedThemeId === themeItem.id 
                          ? `2px solid ${themeItem.color}`
                          : `1px solid ${alpha(themeItem.color, 0.2)}`,
                        cursor: 'pointer',
                        transition: 'all 0.3s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: `0 8px 30px ${alpha(themeItem.color, 0.2)}`,
                        },
                      }}
                      onClick={() => setSelectedThemeId(themeItem.id)}
                      >
                        <CardContent sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                              <Box sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: themeItem.color,
                                boxShadow: `0 2px 8px ${alpha(themeItem.color, 0.3)}`,
                              }} />
                              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                {themeItem.name}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton 
                                size="small" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDialog(themeItem);
                                }}
                                sx={{ 
                                  borderRadius: 1,
                                  '&:hover': { bgcolor: alpha(themeItem.color, 0.1) }
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton 
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTheme(themeItem.id);
                                }}
                                sx={{ 
                                  borderRadius: 1,
                                  '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>

                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
                            {themeItem.description}
                          </Typography>

                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                Progress
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                {themeItem.progress}%
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={themeItem.progress}
                              sx={{
                                height: 6,
                                borderRadius: 1,
                                bgcolor: alpha(themeItem.color, 0.1),
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 1,
                                  bgcolor: themeItem.color,
                                },
                              }}
                            />
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Chip
                                label={themeItem.status}
                                size="small"
                                sx={{
                                  bgcolor: alpha(getStatusColor(themeItem.status), 0.1),
                                  color: getStatusColor(themeItem.status),
                                  textTransform: 'capitalize',
                                  fontWeight: 600,
                                }}
                              />
                              <Chip
                                label={themeItem.priority}
                                size="small"
                                sx={{
                                  bgcolor: alpha(getPriorityColor(themeItem.priority), 0.1),
                                  color: getPriorityColor(themeItem.priority),
                                  textTransform: 'capitalize',
                                  fontWeight: 600,
                                }}
                              />
                            </Box>
                          </Box>

                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <FeatureIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                                <Typography variant="caption" color="text.secondary">
                                  {themeItem.featureCount}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                  💬 {themeItem.slackMentions}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                  📧 {themeItem.emailMentions}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                  🏢 {themeItem.competitors}
                                </Typography>
                              </Box>
                            </Box>
                            <Avatar sx={{ 
                              width: 24, 
                              height: 24, 
                              fontSize: '0.7rem',
                              bgcolor: themeItem.color,
                            }}>
                              {themeItem.owner[0]}
                            </Avatar>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Theme Details Sidebar */}
          <Grid item xs={12} lg={4}>
            <Card sx={{
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              position: 'sticky',
              top: 24,
            }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <AnalyticsIcon sx={{ color: theme.palette.info.main }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Theme Details
                  </Typography>
                </Box>

                {selectedTheme && (
                  <Box>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 1, 
                      background: `linear-gradient(135deg, ${alpha(selectedTheme.color, 0.1)} 0%, ${alpha(selectedTheme.color, 0.05)} 100%)`,
                      border: `1px solid ${alpha(selectedTheme.color, 0.2)}`,
                      mb: 3
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                        <Box sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          bgcolor: selectedTheme.color,
                          boxShadow: `0 2px 8px ${alpha(selectedTheme.color, 0.3)}`,
                        }} />
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                          {selectedTheme.name}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                        {selectedTheme.description}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          OWNER
                        </Typography>
                        <Typography variant="caption">
                          {selectedTheme.owner}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          CREATED
                        </Typography>
                        <Typography variant="caption">
                          {selectedTheme.createdAt}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                          LAST UPDATED
                        </Typography>
                        <Typography variant="caption">
                          {selectedTheme.updatedAt}
                        </Typography>
                      </Box>
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    <Box sx={{ mb: 3 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>
                        TAGS
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {selectedTheme.tags.map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            sx={{
                              bgcolor: alpha(selectedTheme.color, 0.1),
                              color: selectedTheme.color,
                              fontSize: '0.7rem',
                            }}
                          />
                        ))}
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => handleOpenDialog(selectedTheme)}
                        sx={{
                          flex: 1,
                          borderColor: alpha(selectedTheme.color, 0.3),
                          color: selectedTheme.color,
                          '&:hover': { 
                            borderColor: selectedTheme.color,
                            bgcolor: alpha(selectedTheme.color, 0.05),
                          },
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<FeatureIcon />}
                        sx={{
                          flex: 1,
                          background: `linear-gradient(135deg, ${selectedTheme.color} 0%, ${alpha(selectedTheme.color, 0.8)} 100%)`,
                          '&:hover': { transform: 'translateY(-1px)' },
                        }}
                      >
                        View Features
                      </Button>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Create/Edit Theme Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 1,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.9)} 100())`,
              backdropFilter: 'blur(20px)',
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            pb: 1
          }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {editingTheme ? 'Edit Theme' : 'Create New Theme'}
            </Typography>
            <IconButton onClick={handleCloseDialog} size="small">
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          
          <DialogContent sx={{ pt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Theme Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
              />
              
              <TextField
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={3}
                required
              />

              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priority"
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                  >
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="low">Low</MenuItem>
                  </Select>
                </FormControl>

                <FormControl sx={{ flex: 1 }}>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="planning">Planning</MenuItem>
                    <MenuItem value="archived">Archived</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <TextField
                label="Color"
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                fullWidth
              />

              <TextField
                label="Tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                fullWidth
                placeholder="Enter tags separated by commas"
                helperText="e.g. UI/UX, Frontend, Design"
              />
            </Box>
          </DialogContent>

          <DialogActions sx={{ p: 2, pt: 1.5 }}>
            <Button onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              variant="contained"
              disabled={!formData.name || !formData.description}
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              }}
            >
              {editingTheme ? 'Update Theme' : 'Create Theme'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
}