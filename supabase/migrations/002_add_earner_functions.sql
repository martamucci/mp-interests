-- Migration: Add earner query functions
-- Version: 1.0.1

-- =============================================
-- FUNCTION: Get top earners by member (aggregate all payments)
-- Returns top earning MPs with total amounts
-- =============================================
CREATE OR REPLACE FUNCTION get_top_earners_by_member(limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
    member_id INTEGER,
    name_display VARCHAR(255),
    party_name VARCHAR(100),
    constituency VARCHAR(255),
    category_id INTEGER,
    category_name VARCHAR(255),
    total_amount DECIMAL,
    payment_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id as member_id,
        m.name_display,
        m.party_name,
        m.constituency,
        NULL::INTEGER as category_id,
        NULL::VARCHAR(255) as category_name,
        COALESCE(SUM(p.amount), 0) as total_amount,
        COUNT(p.id) as payment_count
    FROM members m
    LEFT JOIN payments p ON p.member_id = m.id
    WHERE m.is_current = true
    GROUP BY m.id, m.name_display, m.party_name, m.constituency
    HAVING COALESCE(SUM(p.amount), 0) > 0
    ORDER BY total_amount DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FUNCTION: Get top earners by category
-- Returns top earning MPs filtered by category
-- =============================================
CREATE OR REPLACE FUNCTION get_top_earners_by_category(category_id_param INTEGER, limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
    member_id INTEGER,
    name_display VARCHAR(255),
    party_name VARCHAR(100),
    constituency VARCHAR(255),
    category_id INTEGER,
    category_name VARCHAR(255),
    total_amount DECIMAL,
    payment_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id as member_id,
        m.name_display,
        m.party_name,
        m.constituency,
        c.id as category_id,
        c.name as category_name,
        COALESCE(SUM(p.amount), 0) as total_amount,
        COUNT(p.id) as payment_count
    FROM members m
    JOIN payments p ON p.member_id = m.id
    JOIN categories c ON c.id = p.category_id
    WHERE m.is_current = true
      AND p.category_id = category_id_param
    GROUP BY m.id, m.name_display, m.party_name, m.constituency, c.id, c.name
    HAVING COALESCE(SUM(p.amount), 0) > 0
    ORDER BY total_amount DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- FUNCTION: Get top earners by party
-- Returns top earning MPs filtered by party name
-- =============================================
CREATE OR REPLACE FUNCTION get_top_earners_by_party(party_name_param VARCHAR, limit_count INTEGER DEFAULT 5)
RETURNS TABLE (
    member_id INTEGER,
    name_display VARCHAR(255),
    party_name VARCHAR(100),
    constituency VARCHAR(255),
    category_id INTEGER,
    category_name VARCHAR(255),
    total_amount DECIMAL,
    payment_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id as member_id,
        m.name_display,
        m.party_name,
        m.constituency,
        NULL::INTEGER as category_id,
        NULL::VARCHAR(255) as category_name,
        COALESCE(SUM(p.amount), 0) as total_amount,
        COUNT(p.id) as payment_count
    FROM members m
    LEFT JOIN payments p ON p.member_id = m.id
    WHERE m.is_current = true
      AND m.party_name = party_name_param
    GROUP BY m.id, m.name_display, m.party_name, m.constituency
    HAVING COALESCE(SUM(p.amount), 0) > 0
    ORDER BY total_amount DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;
