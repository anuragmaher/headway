/**
 * Features page with 3-column layout: Themes, Features, Details
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Avatar,
  IconButton,
  Badge,
  LinearProgress,
} from '@mui/material';
import {
  Category as CategoryIcon,
  FeaturedPlayList as FeatureIcon,
  TrendingUp as TrendingIcon,
  Comment as CommentIcon,
  ThumbUp as ThumbUpIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { AdminLayout } from '@/shared/components/layouts';

interface Theme {
  id: string;
  name: string;
  description: string;
  color: string;
  featureCount: number;
  priority: 'high' | 'medium' | 'low';
}

interface Feature {
  id: string;
  title: string;
  description: string;
  themeId: string;
  status: 'backlog' | 'in-progress' | 'review' | 'completed';
  priority: 'high' | 'medium' | 'low';
  votes: number;
  comments: number;
  assignee?: string;
  createdAt: string;
  source: 'slack' | 'gmail' | 'manual';
}

interface FeatureDetail {
  id: string;
  title: string;
  description: string;
  fullDescription: string;
  status: 'backlog' | 'in-progress' | 'review' | 'completed';
  priority: 'high' | 'medium' | 'low';
  votes: number;
  comments: Array<{
    id: string;
    author: string;
    message: string;
    timestamp: string;
  }>;
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  source: 'slack' | 'gmail' | 'manual';
  tags: string[];
}

export function FeaturesPage(): JSX.Element {
  const theme = useTheme();
  const [selectedThemeId, setSelectedThemeId] = useState<string>('1');
  const [selectedFeatureId, setSelectedFeatureId] = useState<string>('1');

  // Mock themes data
  const themes: Theme[] = [
    {
      id: '1',
      name: 'User Experience',
      description: 'Improvements to user interface and experience',
      color: theme.palette.primary.main,
      featureCount: 12,
      priority: 'high',
    },
    {
      id: '2',
      name: 'Performance',
      description: 'Speed and optimization improvements',
      color: theme.palette.success.main,
      featureCount: 8,
      priority: 'high',
    },
    {
      id: '3',
      name: 'Integrations',
      description: 'Third-party integrations and APIs',
      color: theme.palette.warning.main,
      featureCount: 15,
      priority: 'medium',
    },
    {
      id: '4',
      name: 'Security',
      description: 'Security and privacy enhancements',
      color: theme.palette.error.main,
      featureCount: 6,
      priority: 'high',
    },
    {
      id: '5',
      name: 'Mobile',
      description: 'Mobile app features and improvements',
      color: theme.palette.info.main,
      featureCount: 9,
      priority: 'medium',
    },
  ];

  // Mock features data for all themes
  const features: Feature[] = [
    // User Experience Theme (themeId: '1')
    {
      id: '1',
      title: 'Dark Mode Support',
      description: 'Add dark mode theme option for better user experience',
      themeId: '1',
      status: 'in-progress',
      priority: 'high',
      votes: 45,
      comments: 12,
      assignee: 'John Doe',
      createdAt: '2024-01-15',
      source: 'slack',
    },
    {
      id: '2',
      title: 'Advanced Search Filters',
      description: 'Implement advanced filtering options for better navigation',
      themeId: '1',
      status: 'backlog',
      priority: 'medium',
      votes: 32,
      comments: 8,
      createdAt: '2024-01-12',
      source: 'gmail',
    },
    {
      id: '3',
      title: 'Keyboard Shortcuts',
      description: 'Add keyboard shortcuts for power users',
      themeId: '1',
      status: 'review',
      priority: 'low',
      votes: 28,
      comments: 15,
      assignee: 'Jane Smith',
      createdAt: '2024-01-10',
      source: 'manual',
    },
    {
      id: '4',
      title: 'Bulk Operations',
      description: 'Allow bulk actions on multiple items',
      themeId: '1',
      status: 'completed',
      priority: 'medium',
      votes: 67,
      comments: 22,
      assignee: 'Mike Johnson',
      createdAt: '2024-01-08',
      source: 'slack',
    },
    {
      id: '5',
      title: 'Drag & Drop Interface',
      description: 'Enable drag and drop functionality for better UX',
      themeId: '1',
      status: 'backlog',
      priority: 'medium',
      votes: 38,
      comments: 9,
      createdAt: '2024-01-14',
      source: 'slack',
    },

    // Performance Theme (themeId: '2')
    {
      id: '6',
      title: 'Database Query Optimization',
      description: 'Optimize slow database queries to improve response time',
      themeId: '2',
      status: 'in-progress',
      priority: 'high',
      votes: 52,
      comments: 18,
      assignee: 'Sarah Wilson',
      createdAt: '2024-01-16',
      source: 'manual',
    },
    {
      id: '7',
      title: 'Lazy Loading Implementation',
      description: 'Implement lazy loading for images and components',
      themeId: '2',
      status: 'completed',
      priority: 'high',
      votes: 89,
      comments: 25,
      assignee: 'David Chen',
      createdAt: '2024-01-05',
      source: 'gmail',
    },
    {
      id: '8',
      title: 'Caching Strategy',
      description: 'Implement comprehensive caching for better performance',
      themeId: '2',
      status: 'review',
      priority: 'high',
      votes: 73,
      comments: 31,
      assignee: 'Emily Rodriguez',
      createdAt: '2024-01-09',
      source: 'slack',
    },
    {
      id: '9',
      title: 'Bundle Size Optimization',
      description: 'Reduce JavaScript bundle size for faster loading',
      themeId: '2',
      status: 'backlog',
      priority: 'medium',
      votes: 34,
      comments: 12,
      createdAt: '2024-01-11',
      source: 'manual',
    },

    // Integrations Theme (themeId: '3')
    {
      id: '10',
      title: 'Slack Bot Integration',
      description: 'Create interactive Slack bot for feature requests',
      themeId: '3',
      status: 'in-progress',
      priority: 'high',
      votes: 91,
      comments: 34,
      assignee: 'Alex Turner',
      createdAt: '2024-01-17',
      source: 'slack',
    },
    {
      id: '11',
      title: 'Google Analytics Integration',
      description: 'Integrate with GA for better usage tracking',
      themeId: '3',
      status: 'backlog',
      priority: 'medium',
      votes: 26,
      comments: 7,
      createdAt: '2024-01-13',
      source: 'gmail',
    },
    {
      id: '12',
      title: 'Jira Sync',
      description: 'Two-way sync with Jira for project management',
      themeId: '3',
      status: 'backlog',
      priority: 'high',
      votes: 78,
      comments: 29,
      createdAt: '2024-01-18',
      source: 'manual',
    },
    {
      id: '13',
      title: 'Microsoft Teams Bot',
      description: 'Bot integration for Microsoft Teams users',
      themeId: '3',
      status: 'backlog',
      priority: 'medium',
      votes: 43,
      comments: 16,
      createdAt: '2024-01-19',
      source: 'gmail',
    },
    {
      id: '14',
      title: 'Zapier Integration',
      description: 'Connect with Zapier for workflow automation',
      themeId: '3',
      status: 'review',
      priority: 'low',
      votes: 21,
      comments: 5,
      assignee: 'Lisa Park',
      createdAt: '2024-01-07',
      source: 'slack',
    },

    // Security Theme (themeId: '4')
    {
      id: '15',
      title: 'Two-Factor Authentication',
      description: 'Implement 2FA for enhanced account security',
      themeId: '4',
      status: 'in-progress',
      priority: 'high',
      votes: 94,
      comments: 42,
      assignee: 'Robert Kim',
      createdAt: '2024-01-20',
      source: 'manual',
    },
    {
      id: '16',
      title: 'Role-Based Access Control',
      description: 'Granular permissions and role management',
      themeId: '4',
      status: 'backlog',
      priority: 'high',
      votes: 67,
      comments: 23,
      createdAt: '2024-01-21',
      source: 'slack',
    },
    {
      id: '17',
      title: 'Security Audit Logs',
      description: 'Comprehensive logging for security events',
      themeId: '4',
      status: 'backlog',
      priority: 'medium',
      votes: 38,
      comments: 14,
      createdAt: '2024-01-22',
      source: 'gmail',
    },
    {
      id: '18',
      title: 'Data Encryption at Rest',
      description: 'Encrypt sensitive data in database storage',
      themeId: '4',
      status: 'completed',
      priority: 'high',
      votes: 82,
      comments: 28,
      assignee: 'Jennifer Lee',
      createdAt: '2024-01-03',
      source: 'manual',
    },

    // Mobile Theme (themeId: '5')
    {
      id: '19',
      title: 'Native Mobile App',
      description: 'Develop native iOS and Android applications',
      themeId: '5',
      status: 'backlog',
      priority: 'high',
      votes: 156,
      comments: 67,
      createdAt: '2024-01-23',
      source: 'slack',
    },
    {
      id: '20',
      title: 'Progressive Web App',
      description: 'Convert to PWA for mobile-first experience',
      themeId: '5',
      status: 'in-progress',
      priority: 'high',
      votes: 89,
      comments: 35,
      assignee: 'Chris Johnson',
      createdAt: '2024-01-24',
      source: 'gmail',
    },
    {
      id: '21',
      title: 'Mobile Push Notifications',
      description: 'Real-time notifications for mobile users',
      themeId: '5',
      status: 'backlog',
      priority: 'medium',
      votes: 52,
      comments: 19,
      createdAt: '2024-01-25',
      source: 'slack',
    },
    {
      id: '22',
      title: 'Offline Mode Support',
      description: 'Enable app functionality without internet',
      themeId: '5',
      status: 'backlog',
      priority: 'low',
      votes: 31,
      comments: 11,
      createdAt: '2024-01-26',
      source: 'manual',
    },
    {
      id: '23',
      title: 'Touch Gestures',
      description: 'Implement swipe and gesture controls',
      themeId: '5',
      status: 'review',
      priority: 'medium',
      votes: 44,
      comments: 16,
      assignee: 'Maria Garcia',
      createdAt: '2024-01-27',
      source: 'gmail',
    },
  ];

  // Mock feature detail
  const selectedFeature: FeatureDetail = {
    id: selectedFeatureId,
    title: 'Dark Mode Support',
    description: 'Add dark mode theme option for better user experience',
    fullDescription: 'Implement a comprehensive dark mode theme that adapts all UI components, reduces eye strain during night usage, and provides users with theme preference options. This should include automatic theme switching based on system preferences and manual toggle controls.',
    status: 'in-progress',
    priority: 'high',
    votes: 45,
    comments: [
      {
        id: '1',
        author: 'Sarah Wilson',
        message: 'This would be really helpful for night-time usage!',
        timestamp: '2 hours ago',
      },
      {
        id: '2',
        author: 'David Chen',
        message: 'Please make sure it works well with all the charts and graphs.',
        timestamp: '5 hours ago',
      },
      {
        id: '3',
        author: 'Emily Rodriguez',
        message: 'Can we also add an auto-switch based on time of day?',
        timestamp: '1 day ago',
      },
    ],
    assignee: 'John Doe',
    createdAt: '2024-01-15',
    updatedAt: '2024-01-20',
    source: 'slack',
    tags: ['UI/UX', 'Accessibility', 'High Priority'],
  };

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
      case 'completed': return theme.palette.success.main;
      case 'in-progress': return theme.palette.info.main;
      case 'review': return theme.palette.warning.main;
      case 'backlog': return theme.palette.grey[500];
      default: return theme.palette.grey[500];
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'slack': return '💬';
      case 'gmail': return '📧';
      case 'manual': return '✏️';
      default: return '📝';
    }
  };

  const filteredFeatures = features.filter(feature => feature.themeId === selectedThemeId);

  return (
    <AdminLayout>
      <Box>
        {/* Header */}
        <Box sx={{ 
          mb: 4,
          p: 3,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
                Feature Management
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
                Organize and prioritize feature requests across themes
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<FilterIcon />}
                sx={{
                  borderRadius: 2,
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                  '&:hover': { borderColor: theme.palette.primary.main },
                }}
              >
                Filter
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{
                  borderRadius: 2,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  '&:hover': { transform: 'translateY(-1px)' },
                }}
              >
                Add Feature
              </Button>
            </Box>
          </Box>
        </Box>

        {/* 3-Column Layout */}
        <Grid container spacing={3}>
          {/* Column 1: Themes */}
          <Grid item xs={12} lg={3}>
            <Card sx={{
              height: 'calc(100vh - 280px)',
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}>
              <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CategoryIcon sx={{ color: theme.palette.primary.main }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Themes
                    </Typography>
                  </Box>
                </Box>
                
                <List sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
                  {themes.map((themeItem) => (
                    <ListItem
                      key={themeItem.id}
                      sx={{
                        borderRadius: 2,
                        mb: 1,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        bgcolor: selectedThemeId === themeItem.id ? alpha(themeItem.color, 0.1) : 'transparent',
                        border: selectedThemeId === themeItem.id ? `2px solid ${alpha(themeItem.color, 0.3)}` : `2px solid transparent`,
                        '&:hover': {
                          bgcolor: alpha(themeItem.color, 0.05),
                          transform: 'translateX(4px)',
                        },
                      }}
                      onClick={() => setSelectedThemeId(themeItem.id)}
                    >
                      <ListItemIcon>
                        <Box sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: themeItem.color,
                          boxShadow: `0 2px 8px ${alpha(themeItem.color, 0.3)}`,
                        }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={themeItem.name}
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Chip
                              label={`${themeItem.featureCount} features`}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                bgcolor: alpha(themeItem.color, 0.1),
                                color: themeItem.color,
                              }}
                            />
                            <Chip
                              label={themeItem.priority}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                bgcolor: alpha(getPriorityColor(themeItem.priority), 0.1),
                                color: getPriorityColor(themeItem.priority),
                              }}
                            />
                          </Box>
                        }
                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.9rem' }}
                        secondaryTypographyProps={{ fontSize: '0.75rem' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Column 2: Features */}
          <Grid item xs={12} lg={4}>
            <Card sx={{
              height: 'calc(100vh - 280px)',
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}>
              <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <FeatureIcon sx={{ color: theme.palette.success.main }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Features
                    </Typography>
                    <Chip
                      label={filteredFeatures.length}
                      size="small"
                      sx={{
                        bgcolor: alpha(theme.palette.success.main, 0.1),
                        color: theme.palette.success.main,
                      }}
                    />
                  </Box>
                </Box>
                
                <List sx={{ flexGrow: 1, overflow: 'auto', p: 1 }}>
                  {filteredFeatures.map((feature) => (
                    <ListItem
                      key={feature.id}
                      sx={{
                        borderRadius: 2,
                        mb: 1,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease-in-out',
                        bgcolor: selectedFeatureId === feature.id ? alpha(theme.palette.primary.main, 0.1) : 'transparent',
                        border: selectedFeatureId === feature.id ? `2px solid ${alpha(theme.palette.primary.main, 0.3)}` : `2px solid transparent`,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.05),
                          transform: 'translateY(-2px)',
                          boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.1)}`,
                        },
                      }}
                      onClick={() => setSelectedFeatureId(feature.id)}
                    >
                      <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                            {feature.title}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption">{getSourceIcon(feature.source)}</Typography>
                            <IconButton size="small">
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.4 }}>
                          {feature.description}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip
                              label={feature.status}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                bgcolor: alpha(getStatusColor(feature.status), 0.1),
                                color: getStatusColor(feature.status),
                              }}
                            />
                            <Chip
                              label={feature.priority}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.7rem',
                                bgcolor: alpha(getPriorityColor(feature.priority), 0.1),
                                color: getPriorityColor(feature.priority),
                              }}
                            />
                          </Box>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ThumbUpIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {feature.votes}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CommentIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {feature.comments}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                        
                        {feature.assignee && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                            <Avatar sx={{ width: 20, height: 20, fontSize: '0.7rem' }}>
                              {feature.assignee[0]}
                            </Avatar>
                            <Typography variant="caption" color="text.secondary">
                              {feature.assignee}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Column 3: Details */}
          <Grid item xs={12} lg={5}>
            <Card sx={{
              height: 'calc(100vh - 280px)',
              borderRadius: 3,
              background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.8)} 0%, ${alpha(theme.palette.background.paper, 0.4)} 100%)`,
              backdropFilter: 'blur(10px)',
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}>
              <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <TrendingIcon sx={{ color: theme.palette.warning.main }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Feature Details
                    </Typography>
                  </Box>
                  
                  <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                    {selectedFeature.title}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    {selectedFeature.tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        sx={{
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: theme.palette.primary.main,
                        }}
                      />
                    ))}
                  </Box>
                </Box>
                
                <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
                  {/* Status and Priority */}
                  <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        STATUS
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                        <Box sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: getStatusColor(selectedFeature.status),
                        }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                          {selectedFeature.status.replace('-', ' ')}
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        PRIORITY
                      </Typography>
                      <Typography variant="body2" sx={{ 
                        fontWeight: 600, 
                        textTransform: 'capitalize',
                        color: getPriorityColor(selectedFeature.priority),
                        mt: 0.5,
                      }}>
                        {selectedFeature.priority}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Progress */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      PROGRESS
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={selectedFeature.status === 'completed' ? 100 : 
                               selectedFeature.status === 'review' ? 80 :
                               selectedFeature.status === 'in-progress' ? 50 : 20}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            bgcolor: getStatusColor(selectedFeature.status),
                          },
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Description */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      DESCRIPTION
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1, lineHeight: 1.6 }}>
                      {selectedFeature.fullDescription}
                    </Typography>
                  </Box>

                  {/* Engagement Stats */}
                  <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Badge badgeContent={selectedFeature.votes} color="primary">
                        <ThumbUpIcon sx={{ color: 'text.secondary' }} />
                      </Badge>
                      <Typography variant="body2" color="text.secondary">Votes</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Badge badgeContent={selectedFeature.comments.length} color="secondary">
                        <CommentIcon sx={{ color: 'text.secondary' }} />
                      </Badge>
                      <Typography variant="body2" color="text.secondary">Comments</Typography>
                    </Box>
                  </Box>

                  {/* Recent Comments */}
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      RECENT COMMENTS
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      {selectedFeature.comments.map((comment) => (
                        <Box key={comment.id} sx={{ 
                          mb: 2, 
                          p: 2, 
                          borderRadius: 2, 
                          bgcolor: alpha(theme.palette.background.paper, 0.5),
                          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                        }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem' }}>
                              {comment.author[0]}
                            </Avatar>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {comment.author}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {comment.timestamp}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                            {comment.message}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </AdminLayout>
  );
}