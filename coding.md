# HeadwayHQ - 10 Coding Guidelines for Top-Notch Quality

---

## 1. **Consistent Naming Conventions**

**Rule:** Use clear, descriptive names that reveal intent. Follow language-specific conventions.

### Frontend (TypeScript/React)
- **Components:** PascalCase (`UserProfile`, `FeatureCard`)
- **Functions/variables:** camelCase (`getUserData`, `isLoading`)
- **Constants:** UPPER_SNAKE_CASE (`API_BASE_URL`, `MAX_RETRIES`)
- **Interfaces/Types:** PascalCase with descriptive names (`User`, `FeatureRequest`)
- **Hooks:** prefix with `use` (`useAuth`, `useFeatures`)
- **Boolean variables:** prefix with `is`, `has`, `should` (`isAuthenticated`, `hasPermission`)

### Backend (Python)
- **Classes:** PascalCase (`UserService`, `FeatureRepository`)
- **Functions/variables:** snake_case (`get_user_by_id`, `is_active`)
- **Constants:** UPPER_SNAKE_CASE (`DATABASE_URL`, `JWT_SECRET_KEY`)
- **Private methods:** prefix with `_` (`_validate_token`)

### Examples

**❌ Bad:**
```typescript
const d = getData(); // What is 'd'?
const flag = true;   // What flag?
```

**✅ Good:**
```typescript
const userData = getUserData();
const isAuthenticated = true;
```

---

## 2. **Single Responsibility Principle**

**Rule:** Each function/class should do ONE thing and do it well. If you can't describe what it does in one sentence, it's doing too much.

### Examples

**❌ Bad:**
```typescript
// This function does too many things
async function handleUserLogin(email: string, password: string) {
  const user = await validateCredentials(email, password);
  const token = generateJWT(user);
  await logActivity(user.id, 'login');
  await sendWelcomeEmail(user.email);
  await updateLastLoginTime(user.id);
  return { user, token };
}
```

**✅ Good:**
```typescript
// Split into focused functions
async function authenticateUser(email: string, password: string): Promise<User> {
  return await validateCredentials(email, password);
}

async function createUserSession(user: User): Promise<string> {
  return generateJWT(user);
}

async function recordUserLogin(user: User): Promise<void> {
  await logActivity(user.id, 'login');
  await updateLastLoginTime(user.id);
}

// Main function orchestrates
async function handleUserLogin(email: string, password: string) {
  const user = await authenticateUser(email, password);
  const token = await createUserSession(user);
  await recordUserLogin(user);
  return { user, token };
}
```

---

## 3. **Explicit Error Handling**

**Rule:** Never let errors fail silently. Handle errors at the appropriate level with clear messages.

### Examples

**❌ Bad:**
```typescript
try {
  const data = await fetchData();
} catch (error) {
  console.log(error); // Silent failure
}
```

**✅ Good:**
```typescript
try {
  const data = await fetchData();
  return data;
} catch (error) {
  if (error instanceof NetworkError) {
    throw new Error('Failed to fetch data: Network unavailable');
  }
  if (error instanceof AuthenticationError) {
    throw new Error('Authentication failed: Invalid token');
  }
  // Log unexpected errors
  logger.error('Unexpected error in fetchData', { error, context: 'userProfile' });
  throw new Error('An unexpected error occurred. Please try again.');
}
```

**Backend (Python):**
```python
# ❌ Bad
def get_user(user_id: str):
    user = db.query(User).get(user_id)
    return user  # Returns None if not found

# ✅ Good
def get_user(user_id: str) -> User:
    user = db.query(User).get(user_id)
    if not user:
        raise UserNotFoundError(f"User with id {user_id} not found")
    return user
```

---

## 4. **Type Safety First**

**Rule:** Use TypeScript types and Python type hints everywhere. No `any` types unless absolutely necessary.

### Examples

**❌ Bad (TypeScript):**
```typescript
function processData(data: any) {  // Avoid 'any'
  return data.map((item: any) => item.value);
}
```

**✅ Good:**
```typescript
interface DataItem {
  id: string;
  value: number;
  label: string;
}

function processData(data: DataItem[]): number[] {
  return data.map(item => item.value);
}
```

**❌ Bad (Python):**
```python
def create_feature(name, description):
    # No type hints
    return Feature(name=name, description=description)
```

**✅ Good:**
```python
def create_feature(name: str, description: str) -> Feature:
    """Create a new feature with the given name and description."""
    if not name or not description:
        raise ValueError("Name and description are required")
    return Feature(name=name, description=description)
```

---

## 5. **Keep Functions Small and Focused**

**Rule:** Functions should be < 50 lines. If longer, break into smaller functions. One level of abstraction per function.

### Examples

**❌ Bad:**
```typescript
function DashboardPage() {
  const [themes, setThemes] = useState([]);
  const [features, setFeatures] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const themesData = await fetch('/api/themes');
        setThemes(themesData);
        if (themesData.length > 0) {
          setSelectedTheme(themesData[0].id);
          const featuresData = await fetch(`/api/features?theme=${themesData[0].id}`);
          setFeatures(featuresData);
          if (featuresData.length > 0) {
            setSelectedFeature(featuresData[0].id);
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);
  
  // 100+ more lines of rendering logic...
}
```

**✅ Good:**
```typescript
// Split into custom hooks
function useThemes() {
  const { data: themes, isLoading } = useQuery(['themes'], fetchThemes);
  return { themes, isLoading };
}

function useFeatures(themeId: string | null) {
  const { data: features, isLoading } = useQuery(
    ['features', themeId],
    () => fetchFeatures(themeId),
    { enabled: !!themeId }
  );
  return { features, isLoading };
}

// Main component is now focused on rendering
function DashboardPage() {
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const { themes, isLoading: themesLoading } = useThemes();
  const { features, isLoading: featuresLoading } = useFeatures(selectedTheme);
  
  if (themesLoading) return <LoadingSkeleton />;
  
  return (
    <DashboardLayout>
      <ThemesColumn themes={themes} onSelect={setSelectedTheme} />
      <FeaturesColumn features={features} loading={featuresLoading} />
    </DashboardLayout>
  );
}
```

---

## 6. **No Magic Numbers or Strings**

**Rule:** Extract constants with descriptive names. Makes code self-documenting and easier to change.

### Examples

**❌ Bad:**
```typescript
if (user.loginAttempts > 5) {
  lockAccount(user);
}

setTimeout(retryRequest, 3000);

if (status === 'active') {
  // do something
}
```

**✅ Good:**
```typescript
const MAX_LOGIN_ATTEMPTS = 5;
const RETRY_DELAY_MS = 3000;

enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted'
}

if (user.loginAttempts > MAX_LOGIN_ATTEMPTS) {
  lockAccount(user);
}

setTimeout(retryRequest, RETRY_DELAY_MS);

if (status === AccountStatus.ACTIVE) {
  // do something
}
```

**Python:**
```python
# ❌ Bad
if user.role == 1:
    # admin logic

# ✅ Good
class UserRole(Enum):
    ADMIN = 1
    MEMBER = 2
    GUEST = 3

if user.role == UserRole.ADMIN:
    # admin logic
```

---

## 7. **Write Self-Documenting Code (Comments Explain WHY, Not WHAT)**

**Rule:** Code should be clear enough that you don't need comments. When you do comment, explain WHY, not WHAT.

### Examples

**❌ Bad:**
```typescript
// Increment counter by 1
counter = counter + 1;

// Loop through users
for (const user of users) {
  // Check if user is active
  if (user.isActive) {
    // Send email
    sendEmail(user.email);
  }
}
```

**✅ Good:**
```typescript
// No comments needed - code is self-explanatory
counter += 1;

for (const user of users) {
  if (user.isActive) {
    sendEmail(user.email);
  }
}

// Comments explain WHY when logic is complex
// We batch process every 100 users to avoid overwhelming the email service
// which has a rate limit of 10 emails/second
const BATCH_SIZE = 100;
for (let i = 0; i < users.length; i += BATCH_SIZE) {
  const batch = users.slice(i, i + BATCH_SIZE);
  await processBatchWithDelay(batch);
}
```

**✅ Good Comment (Explains WHY):**
```typescript
// Using exponential backoff because Slack API rate limits are
// aggressive (50 requests/min). Linear retry would trigger limits.
async function retryWithExponentialBackoff(fn: () => Promise<void>) {
  let delay = 1000;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === MAX_RETRIES - 1) throw error;
      await sleep(delay);
      delay *= 2; // Exponential backoff
    }
  }
}
```

---

## 8. **DRY (Don't Repeat Yourself) - But Don't Over-Abstract**

**Rule:** If you copy-paste code more than twice, extract it. But don't create abstractions prematurely.

### Examples

**❌ Bad (Repetition):**
```typescript
// Feature A
const userA = await fetch('/api/users/1');
if (!userA.ok) throw new Error('Failed to fetch user');
const dataA = await userA.json();

// Feature B
const userB = await fetch('/api/users/2');
if (!userB.ok) throw new Error('Failed to fetch user');
const dataB = await userB.json();

// Feature C
const userC = await fetch('/api/users/3');
if (!userC.ok) throw new Error('Failed to fetch user');
const dataC = await userC.json();
```

**✅ Good (Extracted):**
```typescript
async function fetchUser(userId: string): Promise<User> {
  const response = await fetch(`/api/users/${userId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user ${userId}`);
  }
  return response.json();
}

const userA = await fetchUser('1');
const userB = await fetchUser('2');
const userC = await fetchUser('3');
```

**⚠️ But Don't Over-Abstract:**
```typescript
// ❌ Bad - premature abstraction
function createGenericDataFetcher<T>(
  endpoint: string,
  transformer?: (data: any) => T,
  validator?: (data: T) => boolean
) {
  // 50 lines of complex generic logic...
}

// ✅ Good - keep it simple until you need the complexity
async function fetchThemes(): Promise<Theme[]> {
  const response = await apiClient.get('/themes');
  return response.data;
}

async function fetchFeatures(themeId: string): Promise<Feature[]> {
  const response = await apiClient.get(`/features?theme_id=${themeId}`);
  return response.data;
}
```

---

## 9. **Immutability by Default**

**Rule:** Use `const` over `let`. Don't mutate objects/arrays directly. Immutability prevents bugs.

### Examples

**❌ Bad:**
```typescript
let user = { name: 'John', age: 30 };
user.age = 31; // Mutation

let features = ['dark-mode', 'sso'];
features.push('api'); // Mutation
```

**✅ Good:**
```typescript
const user = { name: 'John', age: 30 };
const updatedUser = { ...user, age: 31 }; // Immutable update

const features = ['dark-mode', 'sso'];
const updatedFeatures = [...features, 'api']; // Immutable update
```

**React State Updates:**
```typescript
// ❌ Bad
const [user, setUser] = useState({ name: 'John', settings: {} });
user.settings.theme = 'dark'; // Direct mutation
setUser(user); // Won't trigger re-render

// ✅ Good
setUser(prev => ({
  ...prev,
  settings: {
    ...prev.settings,
    theme: 'dark'
  }
}));
```

---

## 10. **Consistent File Organization and Module Boundaries**

**Rule:** Follow a clear, predictable structure. Group by feature, not by type. Clear separation of concerns.

### Examples

**❌ Bad Structure (Group by Type):**
```
src/
  components/
    UserProfile.tsx
    FeatureCard.tsx
    ThemesList.tsx
    LoginForm.tsx
    Dashboard.tsx
    ... (50 components in one folder)
  hooks/
    useAuth.ts
    useThemes.ts
    ... (30 hooks in one folder)
```

**✅ Good Structure (Group by Feature):**
```
src/
  features/
    auth/
      components/
        LoginForm.tsx
        SignupForm.tsx
      hooks/
        useAuth.ts
      store/
        auth-store.ts
      types/
        auth.types.ts
    
    themes/
      components/
        ThemesList.tsx
        ThemeCard.tsx
        CreateThemeDialog.tsx
      hooks/
        useThemes.ts
      types/
        theme.types.ts
    
    features/
      components/
        FeaturesList.tsx
        FeatureCard.tsx
        FeatureDetails.tsx
      hooks/
        useFeatures.ts
      types/
        feature.types.ts
  
  shared/
    components/
      Button.tsx
      Loading.tsx
    hooks/
      useDebounce.ts
    utils/
      formatDate.ts
```

**Module Boundaries:**
```typescript
// ❌ Bad - circular dependencies
// auth-store.ts imports from theme-store.ts
// theme-store.ts imports from auth-store.ts

// ✅ Good - clear hierarchy
// shared/ has no dependencies
// features/ can import from shared/
// features/ should NOT import from other features/
```

**Backend Structure:**
```
backend/app/
  api/
    v1/
      auth.py      # Endpoints only
      themes.py
      features.py
  
  services/
    auth_service.py     # Business logic
    theme_service.py
    feature_service.py
  
  repositories/
    user_repo.py        # Database access only
    theme_repo.py
  
  models/
    user.py             # SQLAlchemy models
    theme.py
  
  schemas/
    auth.py             # Pydantic schemas
    theme.py
```

---

## Code Review Checklist

Before committing code, check:

- [ ] **No console.log** or print statements (use proper logging)
- [ ] **All variables are const** unless they must be let
- [ ] **All functions have type signatures** (TS) or type hints (Python)
- [ ] **No TODO comments** (create tickets instead)
- [ ] **No commented-out code** (delete it, Git has history)
- [ ] **Error handling is present** for all async operations
- [ ] **Loading and error states** handled in UI
- [ ] **Meaningful commit message** (not "fix" or "update")
- [ ] **Tests pass** (if you have tests)
- [ ] **No hardcoded credentials** or secrets

---

## Quick Reference Card

### ✅ DO:
- Use descriptive names (`getUserById`, not `gub`)
- Keep functions < 50 lines
- Use `const` over `let`
- Handle errors explicitly
- Type everything (no `any`)
- Extract repeated code (DRY)
- Write WHY comments, not WHAT
- Use immutable updates
- Group files by feature
- Extract magic numbers to constants

### ❌ DON'T:
- Use `any` type without good reason
- Leave `console.log` in production code
- Mutate state directly
- Use magic numbers (5, 3000, 'active')
- Create 500-line components
- Ignore errors (silent failures)
- Comment WHAT the code does
- Over-abstract prematurely
- Mix concerns in one function
- Create circular dependencies

---

## Common Patterns for HeadwayHQ

### API Call Pattern
```typescript
// hooks/useFeatures.ts
export function useFeatures(themeId: string | null) {
  return useQuery({
    queryKey: ['features', themeId],
    queryFn: () => fetchFeatures(themeId),
    enabled: !!themeId,
    staleTime: 30000, // 30 seconds
  });
}

// lib/api/features.ts
export async function fetchFeatures(themeId: string | null): Promise<Feature[]> {
  if (!themeId) {
    throw new Error('Theme ID is required');
  }
  
  try {
    const response = await apiClient.get(`/features?theme_id=${themeId}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(`Failed to fetch features: ${error.message}`);
    }
    throw error;
  }
}
```

### Component Pattern
```typescript
// Small, focused component
interface FeatureCardProps {
  feature: Feature;
  onSelect: (id: string) => void;
  isSelected: boolean;
}

export function FeatureCard({ feature, onSelect, isSelected }: FeatureCardProps) {
  const handleClick = () => onSelect(feature.id);
  
  return (
    <Card 
      onClick={handleClick}
      sx={{ 
        cursor: 'pointer',
        borderLeft: isSelected ? 4 : 0,
        borderColor: 'primary.main',
      }}
    >
      <CardContent>
        <Typography variant="h6">{feature.name}</Typography>
        <Box display="flex" gap={1} mt={1}>
          <Chip label={`${feature.mention_count} mentions`} size="small" />
          <Chip label={feature.urgency} color="warning" size="small" />
        </Box>
      </CardContent>
    </Card>
  );
}
```

### Backend Service Pattern
```python
# services/feature_service.py
class FeatureService:
    def __init__(self, db: Session):
        self.db = db
        self.feature_repo = FeatureRepository(db)
        self.ai_service = AIService()
    
    def create_or_update_feature(
        self, 
        workspace_id: str, 
        feature_data: FeatureCreate
    ) -> Feature:
        """
        Create a new feature or increment mention count if similar feature exists.
        
        Args:
            workspace_id: The workspace ID
            feature_data: Feature creation data
            
        Returns:
            Created or updated Feature object
            
        Raises:
            ValidationError: If feature data is invalid
        """
        # Check if similar feature exists
        existing = self.feature_repo.find_similar(
            workspace_id=workspace_id,
            name=feature_data.name
        )
        
        if existing:
            return self._increment_mention_count(existing)
        
        # Create new feature
        feature = self.feature_repo.create(
            workspace_id=workspace_id,
            **feature_data.dict()
        )
        
        # Auto-assign theme
        self._auto_assign_theme(feature)
        
        return feature
    
    def _increment_mention_count(self, feature: Feature) -> Feature:
        """Private helper to increment mention count."""
        feature.mention_count += 1
        feature.last_mentioned = datetime.utcnow()
        self.db.commit()
        return feature
    
    def _auto_assign_theme(self, feature: Feature) -> None:
        """Private helper to auto-assign theme using AI."""
        themes = self.db.query(Theme).filter_by(
            workspace_id=feature.workspace_id
        ).all()
        
        theme_name = self.ai_service.assign_theme(
            feature={'name': feature.name, 'description': feature.description},
            themes=[t.name for t in themes]
        )
        
        theme = next(t for t in themes if t.name == theme_name)
        feature.theme_id = theme.id
        self.db.commit()
```

---

## Final Tips

1. **Read code twice**: Once to understand what it does, again to see if it's clear
2. **Refactor constantly**: Don't wait for "refactor day" - improve as you go
3. **Learn from reviews**: Every code review comment is a learning opportunity
4. **Use linters**: ESLint, Black, Pylint - they catch issues automatically
5. **Test your code**: If you can't test it, it's probably too complex

**Remember:** Code is read 10x more than it's written. Write for the next developer (which might be you in 6 months)!

---

These guidelines will keep your HeadwayHQ codebase clean, maintainable, and professional. Stick to them religiously! 🚀