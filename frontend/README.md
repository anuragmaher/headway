# HeadwayHQ Frontend

React TypeScript frontend for the HeadwayHQ product intelligence platform.

## Tech Stack

- **Vite** - Build tool and dev server
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Material UI** - Component library
- **Zustand** - State management
- **React Query** - Server state management
- **React Router** - Routing
- **React Hook Form** - Form handling

## Project Structure

```
src/
├── features/           # Feature-based organization
│   ├── auth/          # Authentication
│   ├── themes/        # Theme management
│   └── features/      # Feature requests
├── shared/            # Shared components and utilities
│   ├── components/    # Reusable UI components
│   ├── hooks/         # Custom React hooks
│   ├── utils/         # Utility functions
│   └── types/         # Shared TypeScript types
├── lib/               # External integrations
│   ├── api/          # API client configuration
│   └── constants/    # App-wide constants
├── pages/            # Route components
└── styles/           # Global styles and themes
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## Coding Standards

Follow the guidelines in `/coding.md`:

- **Components**: PascalCase (`FeatureCard`)
- **Functions**: camelCase (`getUserData`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Hooks**: prefix with `use` (`useAuth`)
- **Boolean variables**: prefix with `is/has/should`

## Key Features

- 🌙 **Dark Mode** - Full theme switching support
- 🔐 **Authentication** - JWT-based auth flow
- 📱 **Responsive** - Mobile-first design
- 🎨 **Material UI** - Consistent design system
- ⚡ **Fast** - Vite-powered development
- 🔧 **TypeScript** - Full type safety

## Environment Variables

Create `.env` file:

```bash
VITE_API_URL=http://localhost:8000
```

## Architecture Decisions

- **Feature-based structure** - Better scalability than type-based
- **Zustand over Redux** - Simpler state management
- **React Query** - Server state caching and synchronization
- **Material UI** - Complete component system with theming
- **TypeScript strict mode** - Maximum type safety