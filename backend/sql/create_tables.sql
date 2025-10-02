-- HeadwayHQ Database Schema for Supabase
-- Run this in Supabase Dashboard > SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL UNIQUE,
    size VARCHAR NOT NULL,
    domain VARCHAR,
    industry VARCHAR,
    subscription_plan VARCHAR DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on company name and domain
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR NOT NULL UNIQUE,
    first_name VARCHAR,
    last_name VARCHAR,
    full_name VARCHAR,
    job_title VARCHAR,
    hashed_password VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    role VARCHAR DEFAULT 'member',
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    onboarding_completed BOOLEAN DEFAULT false,
    theme_preference VARCHAR DEFAULT 'light',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes on users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on workspace company_id
CREATE INDEX IF NOT EXISTS idx_workspaces_company_id ON workspaces(company_id);

-- Themes table
CREATE TABLE IF NOT EXISTS themes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR NOT NULL,
    description TEXT,
    color VARCHAR,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on themes company_id
CREATE INDEX IF NOT EXISTS idx_themes_company_id ON themes(company_id);

-- Features table
CREATE TABLE IF NOT EXISTS features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR NOT NULL,
    description TEXT,
    status VARCHAR DEFAULT 'requested',
    priority VARCHAR DEFAULT 'medium',
    theme_id UUID REFERENCES themes(id),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    tags JSONB DEFAULT '[]',
    provider_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes on features
CREATE INDEX IF NOT EXISTS idx_features_company_id ON features(company_id);
CREATE INDEX IF NOT EXISTS idx_features_theme_id ON features(theme_id);
CREATE INDEX IF NOT EXISTS idx_features_status ON features(status);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    sender_id VARCHAR,
    sender_name VARCHAR,
    channel_id VARCHAR,
    channel_name VARCHAR,
    workspace_id UUID REFERENCES workspaces(id),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    provider VARCHAR DEFAULT 'slack',
    provider_message_id VARCHAR,
    message_metadata JSONB DEFAULT '{}',
    processed BOOLEAN DEFAULT false,
    feature_extracted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes on messages
CREATE INDEX IF NOT EXISTS idx_messages_company_id ON messages(company_id);
CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id ON messages(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_processed ON messages(processed);

-- Slack integrations table
CREATE TABLE IF NOT EXISTS slack_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    workspace_id VARCHAR NOT NULL,
    team_name VARCHAR,
    access_token VARCHAR NOT NULL,
    bot_token VARCHAR,
    webhook_url VARCHAR,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on slack integrations
CREATE INDEX IF NOT EXISTS idx_slack_integrations_company_id ON slack_integrations(company_id);
CREATE INDEX IF NOT EXISTS idx_slack_integrations_workspace_id ON slack_integrations(workspace_id);

-- Update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_themes_updated_at BEFORE UPDATE ON themes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_features_updated_at BEFORE UPDATE ON features FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_slack_integrations_updated_at BEFORE UPDATE ON slack_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for multi-tenancy
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_integrations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (users can only access their company's data)
-- Note: These policies assume you'll set up Supabase Auth or pass company_id in context

-- Companies: Users can only see their own company
CREATE POLICY "Users can view their own company" ON companies
    FOR SELECT USING (auth.uid() IN (SELECT id FROM users WHERE company_id = companies.id));

-- Users: Users can see other users in their company
CREATE POLICY "Users can view users in their company" ON users
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Similar policies for other tables (example for features)
CREATE POLICY "Users can view features in their company" ON features
    FOR SELECT USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Insert permissions (users can insert into their company)
CREATE POLICY "Users can insert features for their company" ON features
    FOR INSERT WITH CHECK (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Update permissions
CREATE POLICY "Users can update features in their company" ON features
    FOR UPDATE USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Delete permissions
CREATE POLICY "Users can delete features in their company" ON features
    FOR DELETE USING (company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
    ));

-- Grant permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant permissions to anon users (for registration)
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT ON companies TO anon;
GRANT SELECT, INSERT ON users TO anon;