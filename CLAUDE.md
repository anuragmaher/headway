# HeadwayHQ - Claude Code Context

## Project Overview
HeadwayHQ is a **product intelligence platform** that helps product teams make better decisions by automatically aggregating and analyzing customer feedback from multiple sources using AI.

### Core Value Proposition
"Connect your Slack workspace and see all customer feature requests organized by themes in one dashboard."

### Tech Stack
- **Frontend**: Vite + React + TypeScript + Material UI
- **Backend**: FastAPI + PostgreSQL + SQLAlchemy
- **AI**: Anthropic Claude API
- **Background Jobs**: Celery + Redis
- **Deployment**: Vercel (frontend) + Railway/Render (backend)

## Key Files & Documentation
- `about.md` - Project overview, problem/solution, business goals
- `tech.md` - Technical architecture, implementation steps, deployment
- `coding.md` - 10 coding guidelines for quality standards

## Phase 1 Scope (Current Build)
**Must-Have Features:**
1. User authentication (JWT-based)
2. Slack OAuth integration + channel selection
3. AI feature extraction from messages (Claude API)
4. Theme-based organization (Design, Analytics, Security, etc.)
5. 3-column dashboard (Themes → Features → Details)
6. Dark mode support
7. Onboarding flow

**Success Criteria:**
- 5 Hiver teammates complete onboarding
- AI extracts 80%+ of feature requests accurately
- Dashboard loads in <1 second
- Zero critical bugs

## Development Guidelines

### Coding Standards (MUST FOLLOW)
1. **Naming**: PascalCase for components, camelCase for functions, descriptive names
2. **Single Responsibility**: One function does one thing
3. **Error Handling**: Explicit error handling, never fail silently
4. **Type Safety**: TypeScript everywhere, no `any` types
5. **Small Functions**: <50 lines, focused scope
6. **No Magic Numbers**: Extract to named constants
7. **Self-Documenting**: Comments explain WHY, not WHAT
8. **DRY Principle**: Don't repeat, but don't over-abstract
9. **Immutability**: Use `const`, don't mutate directly
10. **Feature Organization**: Group by feature, not by type

### File Structure
```
src/
  features/
    auth/
      components/ hooks/ store/ types/
    themes/
      components/ hooks/ types/
    features/
      components/ hooks/ types/
  shared/
    components/ hooks/ utils/
```

### Development Commands
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
```

## Code Review Checklist
- [ ] No console.log statements
- [ ] All variables const unless necessary  
- [ ] Type signatures everywhere
- [ ] Error handling for async operations
- [ ] Loading/error states in UI
- [ ] Meaningful commit messages
- [ ] No hardcoded secrets

## Implementation Status
**Current Phase:** Phase 1 - Foundation & Core Features
**Timeline:** 5 weeks to production-ready MVP
**Target Users:** 5 Hiver teammates (internal beta)

## Important Notes
- **Never commit** unless user explicitly asks
- **Always run lint/typecheck** commands before considering complete
- **Use TodoWrite tool** for complex multi-step tasks
- **Follow MUI patterns** for consistent UI
- **Immutable state updates** in React
- **Feature-based file organization**

## AI Extraction Requirements
- Extract feature requests from Slack messages
- Group similar/duplicate requests
- Auto-categorize into themes
- Target: 80%+ accuracy
- Handle urgency levels and mention counts

## Database Schema (Key Models)
- User (auth, profile)
- Workspace (team context)
- Integration (Slack OAuth tokens)
- Theme (categorization)
- Feature (extracted requests)
- Message (source data)

## Deployment Strategy
- Frontend: Vercel with custom domain
- Backend: Railway/Render with PostgreSQL + Redis
- Environment variables for API keys, DB connections
- Separate processes for FastAPI, Celery worker, Celery beat

---

**Last Updated:** October 2, 2025
**Current Status:** Project setup and planning phase