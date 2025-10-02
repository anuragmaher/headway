
## Technical Architecture

### High-Level System Design

```
User Browser
    ↓
Frontend (Vite + React + MUI)
    ↓
Backend API (FastAPI + PostgreSQL)
    ↓
External Services:
    - Slack API (OAuth + messages)
    - Anthropic Claude (AI extraction)
    - Celery + Redis (background jobs)
```

### Technology Choices & Rationale

**Frontend: Vite + React**
- Why not Next.js? Too complex for a side project, admin dashboards don't need SSR
- Why React? Team familiarity, large ecosystem
- Why Vite? Lightning-fast dev server, simpler than Next.js

**UI: Material UI (no Tailwind)**
- Complete component library
- Built-in dark mode
- Theme system for consistency
- No need for Tailwind when MUI covers everything

**Backend: FastAPI**
- Modern, fast, async Python framework
- Great for AI/ML integrations
- Auto-generated API docs
- Type safety with Pydantic

**Database: PostgreSQL**
- JSONB for flexible metadata storage
- Mature, reliable, free tier available
- Full-text search capabilities (future)

**AI: Anthropic Claude**
- Best at instruction following
- Good at structured output (JSON)
- Fast response times
- Ethical AI company

**Background Jobs: Celery + Redis**
- Industry standard for Python async tasks
- Reliable task scheduling (hourly Slack sync)
- Scalable (can add workers as needed)

### Why This Stack is Good for a Side Project

✅ **Simple**: Only 2 apps (frontend + backend)  
✅ **Fast to develop**: Minimal boilerplate  
✅ **Cheap to run**: Free tiers cover Phase 1  
✅ **Easy to deploy**: Vercel + Railway  
✅ **Solo-friendly**: No complex orchestration  
✅ **Can scale**: If this takes off, architecture supports it  

---

## Phase 1 Feature Breakdown

### Core Features (Must Have)

**1. User Authentication**
- Email/password registration and login
- JWT token-based authentication
- Secure password hashing
- Token refresh mechanism

**2. Slack Integration**
- OAuth 2.0 flow to connect workspace
- Fetch list of public channels
- User selects channels to monitor
- Hourly automatic message sync
- Store messages with metadata (user, reactions, threads)

**3. AI Feature Extraction**
- Batch processing of Slack messages
- Claude API extracts feature requests
- Identifies: feature name, description, urgency
- Groups similar/duplicate requests
- Auto-categorizes into themes

**4. Theme Management**
- Default themes: Design, Analytics, Integrations, Security, Mobile
- Users can create custom themes
- Each theme has icon, color, name
- Features auto-assigned to themes by AI

**5. 3-Column Dashboard**
- Left: List of themes with mention counts
- Middle: Features for selected theme (sortable)
- Right: Full feature details with linked messages

**6. Dark Mode**
- Toggle between light and dark themes
- Preference persisted to localStorage and database
- All pages support both modes with proper contrast

**7. Onboarding Flow**
- Multi-step wizard for new users
- Connect Slack → Select channels → Initial sync
- Creates default themes automatically
- Redirects to dashboard when complete

### Nice to Have (If Time Permits)

- Search across features
- Export features to CSV
- Email notifications for new high-urgency features
- Slack notifications when competitor ships a feature

---

## User Personas

### Primary: Product Manager Priya

**Background:**
- Works at 50-person B2B SaaS company
- Manages 2 product teams
- Receives 50+ customer feedback messages per week across Slack and email

**Pain Points:**
- Spends 2-3 hours/week reading #customer-feedback Slack channel
- Misses important requests buried in long threads
- Hard to quantify demand: "How many people want SSO?"
- Competitors ship features she didn't know customers wanted

**Goals:**
- Spend less time on manual feedback review
- Make data-driven prioritization decisions
- Spot trends early (multiple customers asking for same thing)
- Stay competitive (know what competitors are building)

**How HeadwayHQ Helps:**
- Connects Slack, sees all requests in one place
- AI extracts and organizes automatically
- Clear metrics: "23 customers requested dark mode"
- Competitive context: "All 3 competitors have SSO"

### Secondary: Founder Farhan

**Background:**
- Solo founder building B2B SaaS
- Wears multiple hats: product, sales, support
- Uses Slack for team + customer communication

**Pain Points:**
- No time to manually track feature requests
- Customer asks "when will you add X?" - hard to remember all requests
- Building features randomly without data
- Loses deals to competitors with better features

**Goals:**
- Spend more time building, less time organizing
- Make smart decisions about what to build
- Keep promises to customers (remember what they asked for)
- Prioritize features that drive revenue

**How HeadwayHQ Helps:**
- Set it and forget it (automatic syncing)
- Dashboard shows top priorities at a glance
- Links to actual customer messages (proof)
- Revenue impact visible (sales channel feedback)

---

## Implementation Approach

### Development Philosophy

**Ship Fast, Learn Fast:**
- Build minimum viable features
- Get to production quickly
- Learn from real usage
- Iterate based on feedback

**No Over-Engineering:**
- Simple > complex
- Working code > perfect code
- Manual process acceptable if it saves dev time
- Optimize later when needed

**Focus on Core Value:**
- Every feature must directly support: "Help PMs understand what customers want"
- If it doesn't, defer to later phase

### Build Strategy

**Week 1-2: Foundation**
- Set up projects (frontend + backend)
- Database schema
- Authentication
- Dark mode theme system
- Basic layouts

**Week 3: Slack Integration**
- OAuth flow
- Message fetching
- Storage

**Week 4: AI Processing**
- Claude API integration
- Feature extraction
- Theme assignment
- Celery tasks

**Week 5: Polish & Launch**
- UI refinements
- Error handling
- Deployment
- Internal beta

**Total: 5 weeks to production-ready Phase 1**

### Risk Mitigation

**Risk: AI extraction not accurate enough**
- Mitigation: Test with real Slack data early (week 3)
- Fallback: Manual review queue if accuracy <70%

**Risk: Slack API rate limits**
- Mitigation: Implement exponential backoff, batch requests
- Fallback: Reduce sync frequency if needed

**Risk: Running out of time (side project)**
- Mitigation: Cut scope ruthlessly, defer nice-to-haves
- Minimum viable: Slack + AI + Dashboard (skip polish)

**Risk: Low adoption by Hiver team**
- Mitigation: Dogfood it ourselves first, fix UX issues early
- Learning: If team doesn't use it, product isn't viable

---

## Post-Phase 1 Roadmap

### Phase 2: Multi-Source Intelligence (Month 2)
- Gmail integration (OAuth + message syncing)
- Competitive intelligence (scrape competitor changelogs weekly)
- Enhanced dashboard with competitive alerts

### Phase 3: Business Intelligence (Month 3)
- CRM integration (Salesforce/HubSpot - lost deal reasons)
- Support ticket analysis (Zendesk/Intercom)
- Revenue impact data (link features to deals)
- Public launch, billing system

### Phase 4: Advanced Features (Month 4+)
- Product analytics integration (usage patterns)
- Market trend monitoring (Hacker News, Reddit, Twitter)
- Internal ideas pipeline (team submissions)
- Public roadmap publishing (for customers)
- API access for power users

### Long-Term Vision (Year 1)
- 100+ paying customers
- $20,000 MRR
- Team of 2-3 people
- Industry-recognized product intelligence platform

---

## Implementation Steps

### Step 1: Project Setup

**Frontend Setup:**
- Initialize Vite React TypeScript project
- Install dependencies: MUI, React Router, Zustand, React Query, Axios, React Hook Form
- Create folder structure (pages, components, hooks, store, lib, types, styles)
- Set up `.env` files for frontend and backend
- Initialize Git repository

**Backend Setup:**
- Create Python virtual environment
- Install FastAPI, SQLAlchemy, Alembic, Celery, Redis, Anthropic SDK
- Create backend folder structure (api, models, schemas, services, repositories, tasks, core, utils)
- Configure `.env` for database, JWT secrets, API keys

---

### Step 2: Database Schema

- Create PostgreSQL database
- Set up SQLAlchemy models: User, Workspace, Theme, Feature, Message, Integration
- Initialize Alembic for migrations
- Create initial migration with all tables and indexes
- Apply migration to database
- Verify all tables created correctly

---

### Step 3: Backend Authentication

- Create `security.py`: JWT token functions, password hashing with bcrypt
- Create `auth_service.py`: register_user(), login_user(), verify_token() functions
- Create auth API endpoints: POST /register, POST /login, POST /refresh, GET /me
- Create Pydantic schemas for auth requests/responses
- Test authentication flow with Postman or cURL

---

### Step 4: Frontend Authentication

- Create `auth-store.ts`: Zustand store with login, register, logout, refreshToken
- Create `api-client.ts`: Axios instance with request/response interceptors
- Create `ProtectedRoute.tsx`: Component to guard /app/* routes
- Build LoginPage with React Hook Form and validation
- Build SignupPage with React Hook Form and validation
- Test login/signup flow and token refresh

---

### Step 5: Theme System (Dark Mode)

- Create `theme-store.ts`: Zustand store for light/dark preference (persisted to localStorage)
- Create `theme-light.ts`: MUI light theme with complete color palette
- Create `theme-dark.ts`: MUI dark theme with complete color palette
- Create `ThemeProvider.tsx`: Wraps app with MUI ThemeProvider based on store
- Create `ThemeToggle.tsx`: IconButton component to switch themes
- Test theme switching and verify persistence on reload

---

### Step 6: Routing & Layouts

- Set up React Router in `App.tsx` with all routes (public, auth, protected)
- Create `LandingLayout.tsx`: Simple layout for public pages
- Create `AdminLayout.tsx`: Layout with AppBar, navigation, theme toggle, user menu
- Create `AppBar.tsx` and `UserMenu.tsx` components
- Implement route protection (redirect to /login if not authenticated)
- Create 404 page handling
- Test navigation between all routes

---

### Step 7: Landing Page

- Build `LandingPage.tsx` with main sections
- Create `Hero.tsx`: Gradient background, headline, CTA button (adapts to theme)
- Create `Features.tsx`: 3-column grid of key features with MUI icons
- Create `Pricing.tsx`: Pricing cards (placeholder content for Phase 3)
- Create `Footer.tsx`: Links, social icons, theme toggle
- Optimize for performance and test Lighthouse score

---

### Step 8: Dashboard Layout Structure

- Create `DashboardPage.tsx`: 3-column MUI Grid layout
- Set up column structure: Themes (280px width) | Features (360px width) | Details (flex)
- Create empty state components for each column
- Add loading skeletons using MUI Skeleton component
- Test responsive behavior on different screen sizes
- Ensure all columns scroll independently

---

### Step 9: Slack OAuth Integration

- Register Slack app at api.slack.com
- Configure OAuth redirect URLs and required scopes (channels:read, channels:history, users:read)
- Backend: Create `slack_service.py` with OAuth flow methods
- Backend: Create endpoints: GET /slack/authorize, GET /slack/callback
- Frontend: Create `SlackConnect.tsx` button component
- Frontend: Handle OAuth redirect flow and callback
- Backend: Store access_token and refresh_token in integrations table
- Frontend: Display connection status on integrations page

---

### Step 10: Slack Channel Selection

- Backend: Implement method to fetch list of public channels from Slack API
- Backend: Create endpoint: POST /slack/channels (save selected channels to integration.metadata)
- Frontend: Create `ChannelSelector.tsx` with multi-select checkboxes
- Frontend: Create IntegrationsPage at route `/app/settings/integrations`
- Frontend: Display selected channels and allow user to modify selection
- Backend: Store channel selections in JSONB metadata field

---

### Step 11: Slack Message Fetching

- Backend: Implement `get_messages(channel_id, since)` in slack_service
- Backend: Fetch last 30 days of messages from selected channels
- Backend: Implement `get_thread_replies()` for threaded conversations
- Backend: Create `message_repo.py` for database CRUD operations
- Backend: Store messages in messages table with all metadata (reactions, threads, timestamps)
- Handle Slack API pagination for large channels
- Prevent duplicate messages by checking external_id uniqueness

---

### Step 12: Celery Setup

- Install Celery and Redis
- Configure Celery app with Redis as broker and result backend
- Create `celery_app.py` with configuration
- Create `slack_tasks.py`: Celery task for `sync_slack_messages(workspace_id)`
- Task logic: For each active integration, fetch new messages since last_synced_at, store in database
- Test manual task execution from Python shell
- Set up Celery Beat scheduler for automated hourly syncs
- Deploy Celery worker and beat as separate processes

---

### Step 13: AI Feature Extraction

- Obtain Anthropic API key from console.anthropic.com
- Backend: Create `ai_service.py` with Claude API client
- Implement `extract_feature_requests(messages)`: Send batch of messages to Claude
- Create detailed prompt for feature extraction (feature_name, description, urgency)
- Implement `group_similar_features(features)`: Use Claude to detect duplicates
- Handle JSON parsing from Claude responses
- Test with sample Slack messages and verify extraction accuracy
- Add error handling for API failures

---

### Step 14: Feature Processing Pipeline

- Backend: Create `feature_repo.py` for feature database operations
- Backend: Create `feature_service.py`:
  - `create_or_update_feature()`: Check if similar feature exists, increment count or create new
  - `link_message_to_feature()`: Associate message_id with feature_id
  - `calculate_statistics()`: Update mention counts, first/last mentioned timestamps
- Create Celery task: `process_new_messages()` that finds unprocessed messages
- Task logic: Batch messages, call AI service, create/update features, link messages
- Schedule task to run every 15 minutes via Celery Beat
- Test complete flow: Slack message → stored → AI processed → feature created

---

### Step 15: Theme Management Backend

- Backend: Create `theme_service.py`: CRUD operations for themes
- Backend: Create theme API endpoints: GET, POST, PUT, DELETE /themes
- Backend: Implement `create_default_themes(workspace_id)`: Design, Analytics, Integrations, Security, Mobile
- Backend: Implement `assign_theme(feature, themes)` in AI service using Claude
- Update feature processing pipeline to auto-assign theme after feature creation
- Create endpoint: PUT /themes/reorder for drag-and-drop sorting

---

### Step 16: Theme UI (Left Column)

- Frontend: Create `ThemesList.tsx`: Display all themes with statistics
- Frontend: Create `ThemeCard.tsx`: Individual theme card with icon, name, mention count, urgent count badge
- Frontend: Create `CreateThemeDialog.tsx`: MUI Dialog with form to add new theme (name, icon picker, color picker)
- Frontend: Create `useThemes.ts` React Query hook (useQuery for list, useMutation for create/update/delete)
- Frontend: Handle theme selection (store selected theme_id in Zustand or URL params)
- Display active/selected theme with visual indicator (border or background color)

---

### Step 17: Features UI (Middle Column)

- Frontend: Create `FeaturesList.tsx`: Display features filtered by selected theme
- Frontend: Create `FeatureCard.tsx`: Show name, mention count, trend, urgency badge, competitive status badge
- Frontend: Add sort dropdown: Most mentioned, Most recent, Highest urgency, Competitive gap
- Frontend: Create `useFeatures.ts` React Query hook
- Backend: Create endpoint: GET /features?theme_id=X&sort=Y (with filtering and sorting)
- Frontend: Handle feature selection (highlight selected feature)
- Show empty state component when no features exist for selected theme

---

### Step 18: Feature Details (Right Column)

- Frontend: Create `FeatureDetails.tsx`: Full feature information display
- Frontend: Create `FeatureStats.tsx`: Four stat cards (total mentions, Slack count, email count, competitor status)
- Frontend: Create `FeedbackList.tsx`: Display all linked messages
- Frontend: Create `SlackMessage.tsx`: Format Slack message with user, channel, reactions, timestamp
- Frontend: Create `useFeedback.ts` React Query hook
- Backend: Create endpoint: GET /features/{id}/messages (paginated list)
- Frontend: Add action buttons: Change status dropdown, Reassign theme dropdown
- Show loading state while fetching feature details

---

### Step 19: Onboarding Wizard

- Frontend: Create `OnboardingPage.tsx`: Multi-step wizard using MUI Stepper
- Step 1: Welcome screen with product introduction and value proposition
- Step 2: Theme preference selection (light/dark mode)
- Step 3: Connect Slack button (redirect to OAuth)
- Step 4: Select channels to monitor (multi-select checkboxes)
- Step 5: Show loading indicator while initial sync runs
- Backend: Create endpoint: POST /workspaces/initialize (creates default themes, triggers first sync)
- On completion: Set user.onboarding_completed = true, redirect to /app/dashboard
- Add middleware to redirect to /app/onboarding if not completed

---

### Step 20: Feature Actions

- Backend: Create endpoint: PUT /features/{id}/status (update status: new, under-review, planned, shipped)
- Backend: Create endpoint: PUT /features/{id}/theme (reassign to different theme)
- Backend: Return updated feature object in response
- Frontend: Add status dropdown in FeatureDetails with all status options
- Frontend: Add theme reassignment dropdown with all available themes
- Use React Query mutations with optimistic updates
- Show success toast notification on save
- Show error toast on failure with retry option

---

### Step 21: Settings Pages

- Frontend: Create `SettingsPage.tsx`: User profile settings (name, email, theme preference)
- Frontend: Create form with React Hook Form for profile updates
- Backend: Create endpoint: PUT /auth/me (update user profile)
- Frontend: IntegrationsPage already created - enhance with more details
- Show Slack connection status: connected/disconnected, team name, last sync time
- List connected channels with checkboxes to modify selection
- Add "Disconnect Slack" button with confirmation dialog
- Add "Sync Now" button to trigger manual sync task

---

### Step 22: Error Handling & Polish

- Add ErrorBoundary component around major sections (themes, features, details)
- Create `EmptyState.tsx` reusable component with MUI icon, message, action button
- Add empty states: "No themes yet", "No features yet", "Connect Slack to get started"
- Add loading skeletons for all async data fetching (use MUI Skeleton)
- Add toast notifications for errors using MUI Snackbar
- Handle network errors gracefully with retry buttons
- Add confirmation dialogs for destructive actions (delete theme, disconnect integration)

---

### Step 23: Performance Optimization

- Configure React Query: Set appropriate staleTime (30s) and cacheTime (5min)
- Implement pagination for messages list (infinite scroll or page-based)
- Add database indexes for frequently queried fields
- Test with large datasets (simulate 1000+ messages, 100+ features)
- Use React.memo for expensive components
- Lazy load heavy components (FeatureDetails only when selected)
- Optimize bundle size (check with bundle analyzer)

---

### Step 24: Testing & QA

- Test complete user flow: Register → Login → Onboarding → Connect Slack → Select channels → View dashboard
- Verify AI extraction accuracy: Manually review 20-30 extracted features vs original messages
- Verify theme auto-assignment accuracy
- Test all CRUD operations: Create theme, edit theme, delete theme, change feature status
- Test authentication: Login, logout, token refresh, protected routes
- Test dark mode on all pages and verify proper contrast
- Test responsive design on mobile, tablet, desktop
- Check for console errors in browser and fix all warnings

---

### Step 25: Deployment

**Frontend Deployment (Vercel):**
- Create Vercel project and link Git repository
- Configure build command: `npm run build`
- Configure environment variables (VITE_API_URL, etc.)
- Set up custom domain: headwayhq.com
- Deploy and verify production build

**Backend Deployment (Railway/Render):**
- Create Railway/Render project
- Provision PostgreSQL database (copy connection string)
- Provision Redis instance (copy connection string)
- Configure environment variables (DATABASE_URL, REDIS_URL, JWT_SECRET, ANTHROPIC_API_KEY, etc.)
- Deploy FastAPI app (main process)
- Deploy Celery worker (separate service/dyno)
- Deploy Celery Beat scheduler (separate service/dyno)
- Run database migrations on production
- Set up custom domain: api.headwayhq.com
- Test all endpoints in production

---

### Step 26: Internal Beta Testing

- Invite 5 Hiver teammates as beta testers
- Provide brief walkthrough or video tutorial
- Ask them to complete: Signup → Onboarding → Connect Slack → Use dashboard for 1 week
- Collect feedback via form or calls
- Monitor error logs and fix critical bugs
- Track usage metrics: Daily active users, features created, messages processed
- Iterate on feedback and ship improvements

---

## Phase 1 Completion Checklist

### Technical Milestones
- [ ] User authentication working (register, login, logout, token refresh)
- [ ] Dark mode implemented and persists across sessions
- [ ] Slack OAuth flow complete and functional
- [ ] Slack messages fetched and stored (last 30 days)
- [ ] AI extracts features from messages with 80%+ accuracy
- [ ] Features automatically assigned to correct themes
- [ ] 3-column dashboard displays: themes → features → details
- [ ] User can change feature status (new/under-review/planned/shipped)
- [ ] User can reassign features to different themes
- [ ] Celery tasks run automatically (hourly sync + 15min AI processing)
- [ ] All pages responsive (mobile, tablet, desktop)
- [ ] Frontend and backend deployed to production
- [ ] Custom domains configured and SSL working

### User Experience Milestones
- [ ] 5 Hiver teammates successfully complete onboarding
- [ ] Dashboard loads in under 1 second
- [ ] Features correctly grouped by themes
- [ ] Team finds UI intuitive without training
- [ ] Zero critical bugs reported
- [ ] Positive feedback from beta users

### Data Quality Milestones
- [ ] AI extracts 80%+ of actual feature requests
- [ ] Theme auto-assignment is 80%+ accurate
- [ ] No duplicate features created
- [ ] All Slack messages from selected channels captured
- [ ] Message metadata preserved (reactions, threads, users)

---

## Development Commands Reference

**Frontend:**
```bash
npm run dev          # Start dev server (http://localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
```

**Backend:**
```bash
uvicorn app.main:app --reload                        # Start FastAPI (http://localhost:8000)
celery -A app.tasks.celery_app worker                # Start Celery worker
celery -A app.tasks.celery_app beat                  # Start Celery Beat scheduler
alembic revision --autogenerate -m "message"         # Create new migration
alembic upgrade head                                 # Apply migrations
alembic downgrade -1                                 # Rollback one migration
```

---

## When Phase 1 is Complete

**You have a working product intelligence platform where:**
- Users connect their Slack workspace
- Messages are automatically synced hourly
- AI extracts feature requests from messages
- Features are organized by themes
- Users can manage and prioritize features
- Dark mode works throughout
- 5 Hiver teammates are actively using it

**Metrics to Track:**
- Daily active users
- Features extracted per week
- Time saved per user (survey)
- AI extraction accuracy
- User satisfaction score

**Ready to move to Phase 2: Gmail Integration + Competitive Intelligence**

---
