-- UK Parliament Register of Interests Database Schema
-- Version: 1.0.0

-- =============================================
-- MEMBERS TABLE
-- Stores current MPs with party information
-- =============================================
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY,
    name_display VARCHAR(255) NOT NULL,
    name_list_as VARCHAR(255) NOT NULL,
    constituency VARCHAR(255),
    party_id INTEGER NOT NULL,
    party_name VARCHAR(100) NOT NULL,
    party_abbreviation VARCHAR(20),
    party_color VARCHAR(7),
    thumbnail_url TEXT,
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_members_party ON members(party_id);
CREATE INDEX IF NOT EXISTS idx_members_party_name ON members(party_name);
CREATE INDEX IF NOT EXISTS idx_members_current ON members(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_members_name ON members USING gin(to_tsvector('english', name_display));

-- =============================================
-- CATEGORIES TABLE
-- Interest categories from Parliament API
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_id INTEGER REFERENCES categories(id),
    category_number INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INTERESTS TABLE
-- Core interest records
-- =============================================
CREATE TABLE IF NOT EXISTS interests (
    id INTEGER PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    summary TEXT,
    registration_date DATE,
    published_date DATE,
    parent_interest_id INTEGER REFERENCES interests(id),
    raw_fields JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interests_member ON interests(member_id);
CREATE INDEX IF NOT EXISTS idx_interests_category ON interests(category_id);
CREATE INDEX IF NOT EXISTS idx_interests_dates ON interests(registration_date, published_date);
CREATE INDEX IF NOT EXISTS idx_interests_raw_fields ON interests USING gin(raw_fields);

-- =============================================
-- PAYERS TABLE
-- Normalized payer entities with classification
-- =============================================
CREATE TABLE IF NOT EXISTS payers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255),
    payer_type VARCHAR(50) NOT NULL,
    payer_subtype VARCHAR(100),
    address TEXT,
    nature_of_business TEXT,
    country VARCHAR(100),
    is_manual_override BOOLEAN DEFAULT false,
    override_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_payers_type ON payers(payer_type);
CREATE INDEX IF NOT EXISTS idx_payers_name ON payers USING gin(to_tsvector('english', name));

-- =============================================
-- PAYMENTS TABLE
-- Extracted payment data (denormalized for queries)
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    interest_id INTEGER NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    amount DECIMAL(12, 2),
    amount_raw VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'GBP',
    payment_type VARCHAR(50),
    regularity VARCHAR(50),
    role_description TEXT,
    hours_worked DECIMAL(8, 2),
    hours_period VARCHAR(50),
    hourly_rate DECIMAL(10, 2),
    payer_id INTEGER REFERENCES payers(id),
    payer_name VARCHAR(255),
    payer_address TEXT,
    payer_nature_of_business TEXT,
    start_date DATE,
    end_date DATE,
    received_date DATE,
    is_donated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_member ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_amount ON payments(amount DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_payments_hourly ON payments(hourly_rate DESC NULLS LAST) WHERE hourly_rate IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_role ON payments USING gin(to_tsvector('english', role_description));
CREATE INDEX IF NOT EXISTS idx_payments_interest ON payments(interest_id);

-- =============================================
-- PAYER_OVERRIDES TABLE
-- Manual classification overrides
-- =============================================
CREATE TABLE IF NOT EXISTS payer_overrides (
    id SERIAL PRIMARY KEY,
    payer_name_pattern VARCHAR(255) NOT NULL,
    payer_type VARCHAR(50) NOT NULL,
    payer_subtype VARCHAR(100),
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(payer_name_pattern)
);

-- =============================================
-- SYNC_LOG TABLE
-- Track data synchronization runs
-- =============================================
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    sync_type VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'running',
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB
);

-- =============================================
-- MATERIALIZED VIEWS
-- Pre-computed aggregations for dashboard performance
-- =============================================

-- Party payment totals
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_party_totals AS
SELECT
    m.party_name,
    m.party_color,
    COUNT(DISTINCT m.id) as mp_count,
    COALESCE(SUM(p.amount), 0) as total_amount,
    COALESCE(AVG(p.amount), 0) as avg_amount,
    COUNT(p.id) as payment_count
FROM members m
LEFT JOIN payments p ON p.member_id = m.id
WHERE m.is_current = true
GROUP BY m.party_name, m.party_color
ORDER BY total_amount DESC NULLS LAST;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_party_totals ON mv_party_totals (party_name);

-- Top earners by role
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_earners_by_role AS
SELECT
    m.id as member_id,
    m.name_display,
    m.party_name,
    m.constituency,
    p.role_description,
    COALESCE(SUM(p.amount), 0) as total_amount,
    COUNT(p.id) as payment_count
FROM members m
JOIN payments p ON p.member_id = m.id
WHERE m.is_current = true AND p.role_description IS NOT NULL AND p.amount IS NOT NULL
GROUP BY m.id, m.name_display, m.party_name, m.constituency, p.role_description
ORDER BY total_amount DESC;

CREATE INDEX IF NOT EXISTS idx_mv_earners_role ON mv_top_earners_by_role (role_description);
CREATE INDEX IF NOT EXISTS idx_mv_earners_amount ON mv_top_earners_by_role (total_amount DESC);

-- Top payers by type
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_payers AS
SELECT
    py.id as payer_id,
    py.name,
    py.payer_type,
    py.payer_subtype,
    COALESCE(SUM(p.amount), 0) as total_paid,
    COUNT(DISTINCT p.member_id) as mp_count,
    COUNT(p.id) as payment_count
FROM payers py
JOIN payments p ON p.payer_id = py.id
WHERE p.amount IS NOT NULL
GROUP BY py.id, py.name, py.payer_type, py.payer_subtype
ORDER BY total_paid DESC;

CREATE INDEX IF NOT EXISTS idx_mv_payers_type ON mv_top_payers (payer_type);
CREATE INDEX IF NOT EXISTS idx_mv_payers_total ON mv_top_payers (total_paid DESC);

-- Hourly rates (only records with hours)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_hourly_rates AS
SELECT
    m.id as member_id,
    m.name_display,
    m.party_name,
    p.role_description,
    p.amount,
    p.hours_worked,
    p.hours_period,
    p.hourly_rate,
    p.payer_name
FROM members m
JOIN payments p ON p.member_id = m.id
WHERE m.is_current = true
  AND p.hourly_rate IS NOT NULL
  AND p.hourly_rate > 0
ORDER BY p.hourly_rate DESC;

CREATE INDEX IF NOT EXISTS idx_mv_hourly_rate ON mv_hourly_rates (hourly_rate DESC);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_party_totals;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_earners_by_role;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_top_payers;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_hourly_rates;
END;
$$ LANGUAGE plpgsql;

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to tables
DROP TRIGGER IF EXISTS members_updated_at ON members;
CREATE TRIGGER members_updated_at
    BEFORE UPDATE ON members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS interests_updated_at ON interests;
CREATE TRIGGER interests_updated_at
    BEFORE UPDATE ON interests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS payers_updated_at ON payers;
CREATE TRIGGER payers_updated_at
    BEFORE UPDATE ON payers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
