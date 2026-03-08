-- HSQ Portal Database Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clients table - extended user info beyond Traccar
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  traccar_user_id INTEGER UNIQUE,
  document VARCHAR(18) NOT NULL UNIQUE, -- CPF (14) or CNPJ (18) formatted
  document_type VARCHAR(4) NOT NULL CHECK (document_type IN ('CPF', 'CNPJ')),
  name VARCHAR(255) NOT NULL, -- nome completo ou razão social
  trade_name VARCHAR(255), -- nome fantasia
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  contact_person VARCHAR(255), -- pessoa de contato (for CNPJ)
  is_active BOOLEAN DEFAULT true,
  is_first_login BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT true,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Admin users for the portal
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_type VARCHAR(10) NOT NULL, -- 'admin' or 'client'
  user_id VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_clients_document ON clients(document);
CREATE INDEX idx_clients_traccar_user_id ON clients(traccar_user_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
