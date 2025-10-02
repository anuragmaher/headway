# HeadwayHQ - Product Intelligence Platform

AI-powered product intelligence platform that helps product teams make better decisions by automatically aggregating and analyzing customer feedback from multiple sources.

## Project Structure

```
headway/
├── frontend/          # Vite + React + TypeScript + Material UI
├── backend/           # FastAPI + PostgreSQL + SQLAlchemy
├── about.md          # Project overview and business goals
├── tech.md           # Technical architecture and implementation
├── coding.md         # Coding guidelines and standards
└── CLAUDE.md         # Context for Claude Code sessions
```

## Quick Start

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Edit with your configuration
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Development URLs

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Phase 1 Features

- [x] Project foundation setup
- [ ] User authentication (JWT)
- [ ] Slack OAuth integration
- [ ] AI feature extraction (Claude API)
- [ ] Theme-based organization
- [ ] 3-column dashboard
- [ ] Dark mode support
- [ ] Onboarding wizard

## Tech Stack

**Frontend:**
- Vite + React + TypeScript
- Material UI for components
- Zustand for state management
- React Query for API calls
- React Router for routing

**Backend:**
- FastAPI + Python
- PostgreSQL + SQLAlchemy
- Celery + Redis for background jobs
- Anthropic Claude for AI
- JWT for authentication

## Development Guidelines

Follow the coding standards in `coding.md`:
- Feature-based file organization
- TypeScript everywhere (no `any`)
- Immutable state updates
- Functions under 50 lines
- Explicit error handling
- Self-documenting code

## Documentation

- `about.md` - Project overview, problem/solution, business goals
- `tech.md` - Technical architecture, 26-step implementation plan  
- `coding.md` - 10 coding guidelines for quality code
- `CLAUDE.md` - Context file for Claude Code sessions

## Contributing

1. Follow the coding guidelines in `coding.md`
2. Use feature branches for development
3. Test thoroughly before committing
4. Write meaningful commit messages

## License

Private project - HeadwayHQ Phase 1 Implementation