BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 1f53b1da10a4

CREATE TABLE companies (
    id UUID NOT NULL, 
    name VARCHAR NOT NULL, 
    size VARCHAR NOT NULL, 
    domain VARCHAR, 
    industry VARCHAR, 
    description TEXT, 
    website VARCHAR, 
    is_active BOOLEAN NOT NULL, 
    subscription_plan VARCHAR NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    UNIQUE (name)
);

CREATE INDEX ix_companies_domain ON companies (domain);

CREATE INDEX ix_companies_id ON companies (id);

CREATE INDEX ix_companies_name ON companies (name);

CREATE TABLE users (
    id UUID NOT NULL, 
    email VARCHAR NOT NULL, 
    hashed_password VARCHAR NOT NULL, 
    first_name VARCHAR NOT NULL, 
    last_name VARCHAR NOT NULL, 
    job_title VARCHAR, 
    company_id UUID NOT NULL, 
    role VARCHAR NOT NULL, 
    is_active BOOLEAN NOT NULL, 
    is_superuser BOOLEAN NOT NULL, 
    onboarding_completed BOOLEAN NOT NULL, 
    theme_preference VARCHAR NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE, 
    last_login_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id), 
    UNIQUE (email)
);

CREATE INDEX ix_users_email ON users (email);

CREATE INDEX ix_users_id ON users (id);

CREATE TABLE workspaces (
    id UUID NOT NULL, 
    name VARCHAR NOT NULL, 
    slug VARCHAR NOT NULL, 
    is_active BOOLEAN NOT NULL, 
    company_id UUID NOT NULL, 
    owner_id UUID NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(company_id) REFERENCES companies (id), 
    FOREIGN KEY(owner_id) REFERENCES users (id), 
    UNIQUE (slug)
);

CREATE INDEX ix_workspaces_id ON workspaces (id);

CREATE INDEX ix_workspaces_slug ON workspaces (slug);

CREATE TABLE integrations (
    id UUID NOT NULL, 
    name VARCHAR NOT NULL, 
    provider VARCHAR NOT NULL, 
    is_active BOOLEAN NOT NULL, 
    access_token TEXT, 
    refresh_token TEXT, 
    token_expires_at TIMESTAMP WITH TIME ZONE, 
    provider_metadata JSONB, 
    external_user_id VARCHAR, 
    external_team_id VARCHAR, 
    external_team_name VARCHAR, 
    workspace_id UUID NOT NULL, 
    last_synced_at TIMESTAMP WITH TIME ZONE, 
    sync_status VARCHAR NOT NULL, 
    sync_error TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(workspace_id) REFERENCES workspaces (id)
);

CREATE INDEX ix_integrations_id ON integrations (id);

INSERT INTO alembic_version (version_num) VALUES ('1f53b1da10a4') RETURNING alembic_version.version_num;

COMMIT;

