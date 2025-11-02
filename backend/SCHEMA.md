# HeadwayHQ Database Schema

This document provides a comprehensive overview of the HeadwayHQ database schema, including all tables, columns, data types, relationships, and indexes.

## Table of Contents

1. [Core Organization Models](#core-organization-models)
   - [Users](#users)
   - [Companies](#companies)
   - [Workspaces](#workspaces)
2. [Product Management Models](#product-management-models)
   - [Themes](#themes)
   - [Features](#features)
3. [Data Ingestion Models](#data-ingestion-models)
   - [Messages](#messages)
   - [Customers](#customers)
4. [Integration Models](#integration-models)
   - [Integrations](#integrations)
   - [Workspace Connectors](#workspace-connectors)
5. [ML/Clustering Models](#mlclustering-models)
   - [Clustering Runs](#clustering-runs)
   - [Discovered Clusters](#discovered-clusters)
   - [Classification Signals](#classification-signals)
6. [Data Extraction Models](#data-extraction-models)
   - [Data Extraction Fields](#data-extraction-fields)
   - [Workspace Data Points](#workspace-data-points)
7. [Association Tables](#association-tables)
   - [Feature Messages](#feature-messages)

---

## Core Organization Models

### Users

**Table Name:** `users`

**Purpose:** User authentication and profile management

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique user identifier |
| `email` | String | No | - | Unique, Indexed | User email address |
| `hashed_password` | String | No | - | No | Bcrypt hashed password |
| `first_name` | String | No | - | No | User's first name |
| `last_name` | String | No | - | No | User's last name |
| `job_title` | String | Yes | null | No | User's job title |
| `company_id` | UUID (FK) | No | - | No | Foreign key to companies.id |
| `role` | String | No | "member" | No | User role: owner, admin, member |
| `is_active` | Boolean | No | true | No | Account active status |
| `is_superuser` | Boolean | No | false | No | Superuser privileges |
| `onboarding_completed` | Boolean | No | false | No | Onboarding flow completion status |
| `theme_preference` | String | No | "light" | No | UI theme: light or dark |
| `created_at` | DateTime(TZ) | No | now() | No | Account creation timestamp |
| `updated_at` | DateTime(TZ) | Yes | null | No | Last update timestamp |
| `last_login_at` | DateTime(TZ) | Yes | null | No | Last login timestamp |

**Relationships:**
- `company` → Many-to-One with `companies`
- `workspaces` → One-to-Many with `workspaces` (cascade delete)

**Computed Properties:**
- `full_name` → `{first_name} {last_name}`

---

### Companies

**Table Name:** `companies`

**Purpose:** Organization/company management

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique company identifier |
| `name` | String | No | - | Unique, Indexed | Company name |
| `size` | String | Yes | null | No | Company size: Startup, Small, Medium, Enterprise |
| `domain` | String | Yes | null | Indexed | Company domain (extracted from email) |
| `industry` | String | Yes | null | No | Company industry |
| `description` | Text | Yes | null | No | Company description |
| `website` | String | Yes | null | No | Company website URL |
| `is_active` | Boolean | No | true | No | Active status |
| `subscription_plan` | String | No | "free" | No | Subscription plan: free, pro, enterprise |
| `created_at` | DateTime(TZ) | No | now() | No | Creation timestamp |
| `updated_at` | DateTime(TZ) | Yes | null | No | Last update timestamp |

**Relationships:**
- `users` → One-to-Many with `users` (cascade delete)
- `workspaces` → One-to-Many with `workspaces`

---

### Workspaces

**Table Name:** `workspaces`

**Purpose:** Team/organization workspace representing a product team

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique workspace identifier |
| `name` | String | No | - | No | Workspace name |
| `slug` | String | No | - | Unique, Indexed | URL-friendly slug |
| `is_active` | Boolean | No | true | No | Active status |
| `company_id` | UUID (FK) | No | - | No | Foreign key to companies.id |
| `owner_id` | UUID (FK) | No | - | No | Foreign key to users.id |
| `created_at` | DateTime(TZ) | No | now() | No | Creation timestamp |
| `updated_at` | DateTime(TZ) | Yes | null | No | Last update timestamp |

**Relationships:**
- `company` → Many-to-One with `companies`
- `owner` → Many-to-One with `users`
- `themes` → One-to-Many with `themes` (cascade delete)
- `features` → One-to-Many with `features` (cascade delete)
- `integrations` → One-to-Many with `integrations` (cascade delete)
- `messages` → One-to-Many with `messages` (cascade delete)
- `customers` → One-to-Many with `customers` (cascade delete)
- `clustering_runs` → One-to-Many with `clustering_runs` (cascade delete)
- `classification_signals` → One-to-Many with `classification_signals` (cascade delete)
- `connectors` → One-to-Many with `workspace_connectors` (cascade delete)

---

## Product Management Models

### Themes

**Table Name:** `themes`

**Purpose:** Categorization of features (e.g., Design, Analytics, Security)

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique theme identifier |
| `name` | String | No | - | No | Theme name |
| `description` | String | Yes | null | No | Theme description |
| `color` | String | No | "#1976d2" | No | Material UI color hex code |
| `icon` | String | No | "CategoryIcon" | No | Material UI icon name |
| `sort_order` | Integer | No | 0 | No | Display order |
| `is_default` | Boolean | No | false | No | Default theme flag |
| `workspace_id` | UUID (FK) | No | - | No | Foreign key to workspaces.id |
| `parent_theme_id` | UUID (FK) | Yes | null | No | Self-referencing FK for hierarchy |
| `created_at` | DateTime(TZ) | No | now() | No | Creation timestamp |
| `updated_at` | DateTime(TZ) | Yes | null | No | Last update timestamp |

**Relationships:**
- `workspace` → Many-to-One with `workspaces`
- `features` → One-to-Many with `features` (cascade delete)
- `parent_theme` → Many-to-One with `themes` (self-referencing)
- `sub_themes` → One-to-Many with `themes` (cascade delete)

**Indexes:**
- `idx_themes_workspace` on `workspace_id`
- `idx_themes_workspace_sort` on `workspace_id, sort_order`
- `idx_themes_parent` on `parent_theme_id`

---

### Features

**Table Name:** `features`

**Purpose:** Extracted feature requests from customer conversations

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique feature identifier |
| `name` | String | No | - | No | Feature name/title |
| `description` | Text | Yes | null | No | Detailed feature description |
| `urgency` | String | No | "medium" | No | Urgency: low, medium, high, critical |
| `status` | String | No | "new" | No | Status: new, under-review, planned, shipped |
| `mention_count` | Integer | No | 1 | No | Number of times mentioned |
| `workspace_id` | UUID (FK) | No | - | No | Foreign key to workspaces.id |
| `theme_id` | UUID (FK) | Yes | null | No | Foreign key to themes.id |
| `match_confidence` | Float | Yes | null | No | AI confidence score (0.0-1.0) |
| `extraction_index` | Integer | Yes | null | No | Order of extraction from message |
| `ai_metadata` | JSONB | Yes | {} | No | AI reasoning and metadata |
| `created_at` | DateTime(TZ) | No | now() | No | Creation timestamp |
| `updated_at` | DateTime(TZ) | Yes | null | No | Last update timestamp |
| `first_mentioned` | DateTime(TZ) | No | now() | No | First mention timestamp |
| `last_mentioned` | DateTime(TZ) | No | now() | No | Last mention timestamp |

**Relationships:**
- `workspace` → Many-to-One with `workspaces`
- `theme` → Many-to-One with `themes`
- `messages` → Many-to-Many with `messages` via `feature_messages`

**Indexes:**
- `idx_features_workspace` on `workspace_id`
- `idx_features_theme` on `theme_id`
- `idx_features_workspace_theme` on `workspace_id, theme_id`
- `idx_features_last_mentioned` on `last_mentioned`
- `idx_features_workspace_last_mentioned` on `workspace_id, last_mentioned`

---

## Data Ingestion Models

### Messages

**Table Name:** `messages`

**Purpose:** Messages from external sources (Slack, Gong, Fathom, etc.)

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique message identifier |
| `external_id` | String | No | - | Indexed | External system message ID |
| `content` | Text | No | - | No | Message content/transcript |
| `source` | String | No | - | No | Source: slack, email, gong, fathom |
| `channel_name` | String | Yes | null | No | Channel/folder name |
| `channel_id` | String | Yes | null | No | Channel/folder ID |
| `author_name` | String | Yes | null | No | Author name |
| `author_id` | String | Yes | null | No | Author ID in source system |
| `author_email` | String | Yes | null | No | Author email |
| `title` | String | Yes | null | Indexed | Call/email/thread title |
| `message_metadata` | JSONB | Yes | null | No | Reactions, threads, attachments |
| `ai_insights` | JSONB | Yes | null | GIN | AI-extracted features, bugs, sentiment |
| `thread_id` | String | Yes | null | No | Thread identifier |
| `is_thread_reply` | Boolean | No | false | No | Thread reply flag |
| `is_processed` | Boolean | No | false | No | Processing status |
| `processed_at` | DateTime(TZ) | Yes | null | No | Processing timestamp |
| `workspace_id` | UUID (FK) | No | - | No | Foreign key to workspaces.id |
| `integration_id` | UUID (FK) | No | - | No | Foreign key to integrations.id |
| `customer_id` | UUID (FK) | Yes | null | No | Foreign key to customers.id |
| `created_at` | DateTime(TZ) | No | now() | No | Creation timestamp |
| `updated_at` | DateTime(TZ) | Yes | null | No | Last update timestamp |
| `sent_at` | DateTime(TZ) | No | - | No | Original message timestamp |

**Relationships:**
- `workspace` → Many-to-One with `workspaces`
- `integration` → Many-to-One with `integrations`
- `customer` → Many-to-One with `customers`
- `features` → Many-to-Many with `features` via `feature_messages`

**Indexes:**
- `idx_messages_workspace` on `workspace_id`
- `idx_messages_workspace_sent` on `workspace_id, sent_at`
- `idx_messages_workspace_processed` on `workspace_id, is_processed`
- `idx_messages_customer` on `customer_id`
- `idx_messages_workspace_customer` on `workspace_id, customer_id`
- `idx_messages_ai_insights_gin` on `ai_insights` (GIN index for JSONB queries)

---

### Customers

**Table Name:** `customers`

**Purpose:** Customer/account information from CRM systems

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique customer identifier |
| `name` | String | No | - | Indexed | Customer/company name |
| `domain` | String | Yes | null | Indexed | Primary domain |
| `industry` | String | Yes | null | Indexed | Industry vertical |
| `website` | String | Yes | null | No | Website URL |
| `phone` | String | Yes | null | No | Phone number |
| `contact_name` | String | Yes | null | No | Primary contact person |
| `contact_email` | String | Yes | null | Indexed | Primary contact email |
| `use_cases` | Text | Yes | null | No | How they use the product |
| `external_system` | String | Yes | null | No | CRM system: hubspot, salesforce |
| `external_id` | String | Yes | null | Indexed | CRM object ID |
| `mrr` | Float | Yes | null | No | Monthly Recurring Revenue |
| `arr` | Float | Yes | null | No | Annual Recurring Revenue |
| `deal_stage` | String | Yes | null | Indexed | Current deal stage |
| `deal_amount` | Float | Yes | null | No | Deal value |
| `deal_close_date` | DateTime(TZ) | Yes | null | No | Expected close date |
| `deal_probability` | Float | Yes | null | No | Deal probability (0.0-1.0) |
| `customer_metadata` | JSONB | Yes | null | No | All CRM fields |
| `is_active` | Boolean | No | true | No | Active status |
| `workspace_id` | UUID (FK) | No | - | No | Foreign key to workspaces.id |
| `created_at` | DateTime(TZ) | No | now() | No | Creation timestamp |
| `updated_at` | DateTime(TZ) | Yes | null | No | Last update timestamp |
| `last_activity_at` | DateTime(TZ) | Yes | null | No | Last message/call timestamp |

**Relationships:**
- `workspace` → Many-to-One with `workspaces`
- `messages` → One-to-Many with `messages`

**Indexes:**
- `idx_customers_workspace` on `workspace_id`
- `idx_customers_workspace_industry` on `workspace_id, industry`
- `idx_customers_workspace_stage` on `workspace_id, deal_stage`
- `idx_customers_external` on `external_system, external_id`
- `idx_customers_domain` on `domain`

---

## Integration Models

### Integrations

**Table Name:** `integrations`

**Purpose:** External service integrations (Slack, Gmail, etc.)

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique integration identifier |
| `name` | String | No | - | No | Integration name |
| `provider` | String | No | - | No | Provider: slack, google |
| `is_active` | Boolean | No | true | No | Active status |
| `access_token` | Text | Yes | null | No | OAuth access token (encrypted) |
| `refresh_token` | Text | Yes | null | No | OAuth refresh token (encrypted) |
| `token_expires_at` | DateTime(TZ) | Yes | null | No | Token expiration timestamp |
| `provider_metadata` | JSONB | Yes | null | No | Channels, team info |
| `external_user_id` | String | Yes | null | No | External user ID |
| `external_team_id` | String | Yes | null | No | External team ID |
| `external_team_name` | String | Yes | null | No | External team name |
| `workspace_id` | UUID (FK) | No | - | No | Foreign key to workspaces.id |
| `last_synced_at` | DateTime(TZ) | Yes | null | No | Last sync timestamp |
| `sync_status` | String | No | "pending" | No | Status: pending, syncing, success, error |
| `sync_error` | Text | Yes | null | No | Last sync error message |
| `created_at` | DateTime(TZ) | No | now() | No | Creation timestamp |
| `updated_at` | DateTime(TZ) | Yes | null | No | Last update timestamp |

**Relationships:**
- `workspace` → Many-to-One with `workspaces`
- `messages` → One-to-Many with `messages` (cascade delete)

---

### Workspace Connectors

**Table Name:** `workspace_connectors`

**Purpose:** Generic connector credentials (Gong, Fathom, etc.)

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique connector identifier |
| `workspace_id` | UUID (FK) | No | - | Indexed | Foreign key to workspaces.id |
| `connector_type` | String | No | - | No | Type: gong, fathom |
| `credentials` | JSONB | No | - | No | Connector-specific credentials |
| `is_active` | Boolean | No | true | No | Active status |
| `created_at` | DateTime(TZ) | No | now() | No | Creation timestamp |
| `updated_at` | DateTime(TZ) | Yes | null | No | Last update timestamp |

**Relationships:**
- `workspace` → Many-to-One with `workspaces`

**Credential Formats:**
- **Gong:** `{"access_key": "...", "secret_key": "..."}`
- **Fathom:** `{"api_token": "..."}`

**Methods:**
- `get_credential(key: str)` → Returns credential value by key
- `set_credentials(creds: Dict)` → Sets credentials from dictionary

---

## ML/Clustering Models

### Clustering Runs

**Table Name:** `clustering_runs`

**Purpose:** Tracks clustering analysis runs for workspaces

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique run identifier |
| `workspace_id` | UUID (FK) | No | - | No | Foreign key to workspaces.id |
| `run_name` | String | No | - | No | Run name/label |
| `description` | Text | Yes | null | No | Run description |
| `status` | String | No | "running" | No | Status: running, completed, failed |
| `messages_analyzed` | Integer | No | 0 | No | Messages analyzed count |
| `clusters_discovered` | Integer | No | 0 | No | Clusters discovered count |
| `confidence_threshold` | Float | No | 0.7 | No | Confidence threshold |
| `created_at` | DateTime(TZ) | No | now() | No | Creation timestamp |
| `completed_at` | DateTime(TZ) | Yes | null | No | Completion timestamp |

**Relationships:**
- `workspace` → Many-to-One with `workspaces`
- `discovered_clusters` → One-to-Many with `discovered_clusters` (cascade delete)

---

### Discovered Clusters

**Table Name:** `discovered_clusters`

**Purpose:** Clusters discovered by LLM with customer approval workflow

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique cluster identifier |
| `clustering_run_id` | UUID (FK) | No | - | No | Foreign key to clustering_runs.id |
| `cluster_name` | String | No | - | No | Cluster name |
| `description` | Text | No | - | No | Cluster description |
| `category` | String | No | - | No | Category: Core Features, Integrations, UI/UX |
| `theme` | String | No | - | No | Theme: Security, Productivity |
| `confidence_score` | Float | No | - | No | Confidence score (0.0-1.0) |
| `message_count` | Integer | No | - | No | Messages in cluster |
| `business_impact` | Text | Yes | null | No | Business impact description |
| `example_messages` | JSONB | Yes | null | No | Sample message IDs and snippets |
| `approval_status` | String | No | "pending" | No | Status: pending, approved, rejected, modified |
| `approved_by` | UUID (FK) | Yes | null | No | Foreign key to users.id |
| `approved_at` | DateTime(TZ) | Yes | null | No | Approval timestamp |
| `customer_feedback` | Text | Yes | null | No | Customer feedback notes |
| `created_at` | DateTime(TZ) | No | now() | No | Creation timestamp |
| `updated_at` | DateTime(TZ) | Yes | null | No | Last update timestamp |

**Relationships:**
- `clustering_run` → Many-to-One with `clustering_runs`
- `approved_by_user` → Many-to-One with `users`
- `classification_signals` → One-to-Many with `classification_signals` (cascade delete)

---

### Classification Signals

**Table Name:** `classification_signals`

**Purpose:** Learned signals for fast classification from approved clusters

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique signal identifier |
| `source_cluster_id` | UUID (FK) | No | - | No | Foreign key to discovered_clusters.id |
| `workspace_id` | UUID (FK) | No | - | No | Foreign key to workspaces.id |
| `signal_type` | String | No | - | No | Type: keyword, pattern, semantic, business_rule |
| `signal_name` | String | No | - | No | Human readable name |
| `keywords` | JSONB | Yes | null | No | Keyword list for keyword signals |
| `patterns` | JSONB | Yes | null | No | Regex patterns |
| `semantic_threshold` | Float | Yes | null | No | Semantic similarity threshold |
| `business_rules` | JSONB | Yes | null | No | Complex business logic |
| `target_category` | String | No | - | No | Classification target category |
| `target_theme` | String | No | - | No | Classification target theme |
| `priority_weight` | Float | No | 1.0 | No | Weight in classification |
| `precision` | Float | Yes | null | No | Performance metric |
| `recall` | Float | Yes | null | No | Performance metric |
| `usage_count` | Integer | No | 0 | No | Times signal fired |
| `is_active` | Boolean | No | true | No | Active status |
| `created_at` | DateTime(TZ) | No | now() | No | Creation timestamp |
| `updated_at` | DateTime(TZ) | Yes | null | No | Last update timestamp |
| `last_used_at` | DateTime(TZ) | Yes | null | No | Last usage timestamp |

**Relationships:**
- `source_cluster` → Many-to-One with `discovered_clusters`
- `workspace` → Many-to-One with `workspaces`

---

## Data Extraction Models

### Data Extraction Fields

**Table Name:** `data_extraction_fields`

**Purpose:** Schema/configuration for data points to extract from messages

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique field identifier |
| `workspace_id` | UUID (FK) | No | - | No | Foreign key to workspaces.id |
| `field_name` | String | No | - | No | Field name (e.g., "Customer Name") |
| `field_type` | String | No | - | No | Type: customer_name, mrr, urgency, custom |
| `data_type` | String | No | - | No | Data type: string, number, boolean, date, array |
| `description` | String | Yes | null | No | Field description |
| `is_active` | Boolean | No | true | No | Active status |
| `created_at` | DateTime(TZ) | No | now() | No | Creation timestamp |
| `updated_at` | DateTime(TZ) | Yes | null | No | Last update timestamp |

**Relationships:**
- `workspace` → Many-to-One with `workspaces`

**Indexes:**
- `idx_data_extraction_fields_workspace` on `workspace_id`
- `idx_data_extraction_fields_workspace_active` on `workspace_id, is_active`

---

### Workspace Data Points

**Table Name:** `workspace_data_points`

**Purpose:** Aggregated data points for analytics and fast querying

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `id` | UUID | No | uuid4 | Primary Key | Unique data point identifier |
| `workspace_id` | UUID (FK) | No | - | No | Foreign key to workspaces.id |
| `feature_id` | UUID (FK) | No | - | No | Foreign key to features.id |
| `message_id` | UUID (FK) | No | - | No | Foreign key to messages.id |
| `data_point_key` | String | No | - | No | Key: mrr, urgency_score, pain_level |
| `data_point_category` | String | No | - | No | Category: business_metrics, structured_metrics, entities |
| `numeric_value` | Float | Yes | null | No | Numeric values |
| `integer_value` | Integer | Yes | null | No | Integer values |
| `text_value` | String | Yes | null | No | String values |
| `author` | String | Yes | null | No | Data point author |
| `extracted_at` | DateTime(TZ) | No | now() | No | Extraction timestamp |

**Relationships:**
- `workspace` → Many-to-One with `workspaces`
- `feature` → Many-to-One with `features`
- `message` → Many-to-One with `messages`

**Indexes:**
- `idx_workspace_data_points_workspace_key` on `workspace_id, data_point_key`
- `idx_workspace_data_points_category` on `workspace_id, data_point_category`
- `idx_workspace_data_points_feature` on `feature_id`
- `idx_workspace_data_points_numeric` on `workspace_id, data_point_key, numeric_value`

---

## Association Tables

### Feature Messages

**Table Name:** `feature_messages`

**Purpose:** Many-to-many relationship between features and messages

| Column | Type | Nullable | Default | Indexed | Description |
|--------|------|----------|---------|---------|-------------|
| `feature_id` | UUID (FK) | No | - | Primary Key | Foreign key to features.id |
| `message_id` | UUID (FK) | No | - | Primary Key | Foreign key to messages.id |
| `created_at` | DateTime(TZ) | No | now() | No | Association creation timestamp |

**Composite Primary Key:** (`feature_id`, `message_id`)

---

## Entity Relationship Diagram

```
┌─────────────┐
│  Companies  │
└──────┬──────┘
       │ 1:N
       ▼
┌─────────────┐
│    Users    │
└──────┬──────┘
       │ 1:N
       ▼
┌─────────────┐       1:N      ┌─────────────┐
│ Workspaces  │◄───────────────┤   Themes    │
└──────┬──────┘                └──────┬──────┘
       │                              │ 1:N
       │ 1:N                          ▼
       │                        ┌─────────────┐
       │                        │  Features   │
       │                        └──────┬──────┘
       │                               │ M:N
       │                               ▼
       │                        ┌─────────────┐
       ├────────────────────────┤  Messages   │
       │                        └──────┬──────┘
       │                               │ N:1
       │ 1:N                           ▼
       ├─────────────────────►  ┌─────────────┐
       │                        │  Customers  │
       │                        └─────────────┘
       │ 1:N
       ├─────────────────────►  ┌─────────────┐
       │                        │Integrations │
       │                        └─────────────┘
       │ 1:N
       ├─────────────────────►  ┌─────────────┐
       │                        │ Connectors  │
       │                        └─────────────┘
       │ 1:N
       └─────────────────────►  ┌──────────────────┐
                                │ Clustering Runs  │
                                └────────┬─────────┘
                                         │ 1:N
                                         ▼
                                ┌──────────────────────┐
                                │ Discovered Clusters  │
                                └────────┬─────────────┘
                                         │ 1:N
                                         ▼
                                ┌──────────────────────┐
                                │Classification Signals│
                                └──────────────────────┘
```

---

## Common Query Patterns

### Get all features for a workspace with theme names
```sql
SELECT f.*, t.name as theme_name
FROM features f
LEFT JOIN themes t ON f.theme_id = t.id
WHERE f.workspace_id = :workspace_id
ORDER BY f.last_mentioned DESC;
```

### Get customer consolidated view
```sql
SELECT
  c.*,
  COUNT(DISTINCT m.id) as message_count,
  COUNT(DISTINCT fm.feature_id) as feature_count
FROM customers c
LEFT JOIN messages m ON m.customer_id = c.id
LEFT JOIN feature_messages fm ON fm.message_id = m.id
WHERE c.workspace_id = :workspace_id
  AND c.id = :customer_id
GROUP BY c.id;
```

### Find features mentioned by high-value customers
```sql
SELECT f.*, c.name as customer_name, c.arr
FROM features f
JOIN feature_messages fm ON fm.feature_id = f.id
JOIN messages m ON m.id = fm.message_id
JOIN customers c ON c.id = m.customer_id
WHERE f.workspace_id = :workspace_id
  AND c.arr > 10000
ORDER BY c.arr DESC, f.last_mentioned DESC;
```

### Get messages by industry
```sql
SELECT m.*, c.industry, c.name as customer_name
FROM messages m
JOIN customers c ON c.id = m.customer_id
WHERE m.workspace_id = :workspace_id
  AND c.industry = :industry
  AND m.is_processed = true
ORDER BY m.sent_at DESC;
```

---

## Migration Notes

This schema is managed by Alembic migrations located in `/app/alembic/versions/`.

**Common Commands:**
```bash
# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View current version
alembic current

# View migration history
alembic history
```

---

## Data Types Reference

- **UUID:** Universally Unique Identifier (128-bit)
- **String:** Variable-length text
- **Text:** Unlimited length text
- **Integer:** 32-bit integer
- **Float:** Double precision floating point
- **Boolean:** True/False
- **DateTime(TZ):** Timestamp with timezone
- **JSONB:** Binary JSON (PostgreSQL specific, indexed)

---

**Last Updated:** 2025-11-03
**Database:** PostgreSQL 14+
**ORM:** SQLAlchemy 2.0
