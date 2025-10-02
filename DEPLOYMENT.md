# HeadwayHQ Deployment Guide

## Serverless Deployment to Vercel

This project is configured for serverless deployment to Vercel with both frontend and backend in the same repository.

### Prerequisites

1. **Vercel CLI**: Install globally with `npm i -g vercel`
2. **Supabase Account**: Your database credentials from the image you provided
3. **Environment Variables**: Set up in Vercel dashboard

### Environment Variables

Set these in your Vercel project dashboard (Settings > Environment Variables):

```env
# Database - Supabase
DATABASE_URL=postgresql://postgres.wyoakbnxehosonecuovy:YOUR_ACTUAL_DB_PASSWORD@aws-0-us-west-1.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://wyoakbnxehosonecuovy.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5b2FrYm54ZWhvc29uZWN1b3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA1NjI2MTYsImV4cCI6MjA0NjEzODYxNn0.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5b2FrYm54ZWhvc29uZWN1b3Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA1NjI2MTYsImV4cCI6MjA0NjEzODYxNn0

# JWT Configuration
JWT_SECRET_KEY=your-production-jwt-secret-key-make-it-strong
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
EMAIL_RESET_TOKEN_EXPIRE_HOURS=48

# Environment
ENVIRONMENT=production
DEBUG=false

# CORS Origins (your production domains)
CORS_ORIGINS=https://your-vercel-domain.vercel.app,https://headwayhq.com
```

### Deployment Steps

1. **Get Database Password**
   - Go to your Supabase dashboard
   - Navigate to Settings > Database
   - Copy the database password
   - Update the `YOUR_ACTUAL_DB_PASSWORD` in the DATABASE_URL

2. **Deploy to Vercel**
   ```bash
   # In the project root
   vercel
   
   # Follow the prompts:
   # - Link to existing project or create new one
   # - Set build settings if prompted
   ```

3. **Initialize Database**
   ```bash
   # After deployment, run this to create tables
   python scripts/init_db.py
   ```

### Project Structure

```
/
├── frontend/          # React + Vite frontend
├── backend/           # FastAPI backend
├── api/               # Vercel serverless function entry
├── scripts/           # Database and utility scripts
├── vercel.json        # Vercel configuration
├── package.json       # Root package.json for build
└── requirements.txt   # Python dependencies
```

### How It Works

- **Frontend**: Built as static files and served from Vercel's CDN
- **Backend**: Deployed as serverless functions via `/api/*` routes
- **Database**: Hosted on Supabase PostgreSQL
- **Authentication**: JWT-based with secure httpOnly cookies

### Local Development

```bash
# Install dependencies
npm run install-deps

# Run both frontend and backend
npm run dev

# Frontend: http://localhost:5173
# Backend API: http://localhost:8000
```

### Database Management

- **Schema Changes**: Update models in `backend/app/models/`
- **Create Tables**: Run `python scripts/init_db.py`
- **Migrations**: Consider Supabase migrations for production

### Monitoring

- **Vercel Dashboard**: Monitor function execution and errors
- **Supabase Dashboard**: Database performance and queries
- **Logs**: Check Vercel function logs for backend issues

### Security Notes

- All sensitive keys are environment variables
- CORS is configured for your domains only
- JWT tokens use secure httpOnly cookies
- Database connections use SSL by default

### Next Steps After Deployment

1. Test all API endpoints
2. Verify authentication flow
3. Test registration and login
4. Configure custom domain (optional)
5. Set up monitoring and alerts