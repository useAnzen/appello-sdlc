-- SDLC Pulse Migration: Phase 0
-- Adds parent/child WP hierarchy, source tracking, pipeline run tracking, and score query
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

-- 1. Parent/child hierarchy for work packages
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_packages' AND column_name = 'parent_work_package_id') THEN
        ALTER TABLE work_packages ADD COLUMN parent_work_package_id UUID REFERENCES work_packages(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_wp_parent ON work_packages(parent_work_package_id);

-- 2. Source tracking: where did this WP originate?
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_packages' AND column_name = 'source_type') THEN
        ALTER TABLE work_packages ADD COLUMN source_type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_packages' AND column_name = 'source_refs') THEN
        ALTER TABLE work_packages ADD COLUMN source_refs JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_packages' AND column_name = 'deployed_at') THEN
        ALTER TABLE work_packages ADD COLUMN deployed_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_packages' AND column_name = 'ai_rice_reach') THEN
        ALTER TABLE work_packages ADD COLUMN ai_rice_reach INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_packages' AND column_name = 'ai_rice_impact') THEN
        ALTER TABLE work_packages ADD COLUMN ai_rice_impact NUMERIC(3,1);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_packages' AND column_name = 'ai_rice_confidence') THEN
        ALTER TABLE work_packages ADD COLUMN ai_rice_confidence INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_packages' AND column_name = 'ai_rice_effort') THEN
        ALTER TABLE work_packages ADD COLUMN ai_rice_effort NUMERIC(4,1);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_packages' AND column_name = 'pipeline_readiness') THEN
        ALTER TABLE work_packages ADD COLUMN pipeline_readiness TEXT DEFAULT 'unknown';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_packages' AND column_name = 'customer_sources') THEN
        ALTER TABLE work_packages ADD COLUMN customer_sources JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'work_packages' AND column_name = 'complexity_estimate') THEN
        ALTER TABLE work_packages ADD COLUMN complexity_estimate TEXT;
    END IF;
END $$;

-- 3. Pipeline runs: tracks every dispatch through the coding pipeline
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_package_id UUID NOT NULL REFERENCES work_packages(id) ON DELETE CASCADE,
    agentc2_run_id TEXT,
    coding_agent TEXT,
    status TEXT NOT NULL DEFAULT 'queued',
    trust_score NUMERIC(4,3),
    trust_breakdown JSONB,
    branch_name TEXT,
    pr_number INTEGER,
    pr_url TEXT,
    error_message TEXT,
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    result_classification TEXT,
    result_analysis TEXT,
    constraints_generated JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pr_work_package ON pipeline_runs(work_package_id);
CREATE INDEX IF NOT EXISTS idx_pr_status ON pipeline_runs(status);

ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pipeline_runs' AND policyname = 'anon_select_pipeline_runs') THEN
        CREATE POLICY "anon_select_pipeline_runs" ON pipeline_runs FOR SELECT TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pipeline_runs' AND policyname = 'anon_insert_pipeline_runs') THEN
        CREATE POLICY "anon_insert_pipeline_runs" ON pipeline_runs FOR INSERT TO anon WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pipeline_runs' AND policyname = 'anon_update_pipeline_runs') THEN
        CREATE POLICY "anon_update_pipeline_runs" ON pipeline_runs FOR UPDATE TO anon USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Pulse constraints: learned rules from pipeline outcomes
CREATE TABLE IF NOT EXISTS pulse_constraints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    constraint_text TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    source_run_id UUID REFERENCES pipeline_runs(id) ON DELETE SET NULL,
    confidence NUMERIC(3,2) DEFAULT 0.5,
    times_validated INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pc_category ON pulse_constraints(category);
CREATE INDEX IF NOT EXISTS idx_pc_active ON pulse_constraints(is_active);

ALTER TABLE pulse_constraints ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pulse_constraints' AND policyname = 'anon_select_pulse_constraints') THEN
        CREATE POLICY "anon_select_pulse_constraints" ON pulse_constraints FOR SELECT TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pulse_constraints' AND policyname = 'anon_insert_pulse_constraints') THEN
        CREATE POLICY "anon_insert_pulse_constraints" ON pulse_constraints FOR INSERT TO anon WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pulse_constraints' AND policyname = 'anon_update_pulse_constraints') THEN
        CREATE POLICY "anon_update_pulse_constraints" ON pulse_constraints FOR UPDATE TO anon USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 5. Score function view: pipeline success rate over rolling 14-day window
CREATE OR REPLACE VIEW pulse_score AS
SELECT
    COUNT(*) FILTER (WHERE status = 'success' AND trust_score >= 0.7) AS successful_runs,
    COUNT(*) FILTER (WHERE status IN ('success', 'failed', 'partial')) AS total_runs,
    CASE
        WHEN COUNT(*) FILTER (WHERE status IN ('success', 'failed', 'partial')) = 0 THEN 0
        ELSE ROUND(
            100.0 * COUNT(*) FILTER (WHERE status = 'success' AND trust_score >= 0.7)
            / COUNT(*) FILTER (WHERE status IN ('success', 'failed', 'partial')),
            1
        )
    END AS success_rate_pct,
    COUNT(*) FILTER (WHERE status = 'success' AND trust_score >= 0.7
        AND completed_at >= now() - interval '14 days') AS recent_successful,
    COUNT(*) FILTER (WHERE status IN ('success', 'failed', 'partial')
        AND dispatched_at >= now() - interval '14 days') AS recent_total,
    CASE
        WHEN COUNT(*) FILTER (WHERE status IN ('success', 'failed', 'partial')
            AND dispatched_at >= now() - interval '14 days') = 0 THEN 0
        ELSE ROUND(
            100.0 * COUNT(*) FILTER (WHERE status = 'success' AND trust_score >= 0.7
                AND completed_at >= now() - interval '14 days')
            / COUNT(*) FILTER (WHERE status IN ('success', 'failed', 'partial')
                AND dispatched_at >= now() - interval '14 days'),
            1
        )
    END AS recent_success_rate_pct,
    AVG(EXTRACT(EPOCH FROM (completed_at - dispatched_at)) / 3600)
        FILTER (WHERE completed_at IS NOT NULL) AS avg_cycle_hours
FROM pipeline_runs;

-- 6. Velocity view: merged WPs per 14-day window, weighted by RICE
CREATE OR REPLACE VIEW pulse_velocity AS
SELECT
    COUNT(*) FILTER (WHERE deployed_at >= now() - interval '14 days') AS deployed_14d,
    COUNT(*) AS total_deployed,
    COALESCE(SUM(
        CASE WHEN deployed_at >= now() - interval '14 days'
             AND rice_reach IS NOT NULL AND rice_impact IS NOT NULL
             AND rice_confidence IS NOT NULL AND rice_effort IS NOT NULL
             AND rice_effort > 0
        THEN (rice_reach * rice_impact * (rice_confidence::numeric / 100)) / rice_effort
        ELSE 0 END
    ), 0) AS weighted_velocity_14d
FROM work_packages
WHERE status = 'deployed';

-- 7. Auto-set deployed_at when status changes to 'deployed'
CREATE OR REPLACE FUNCTION set_deployed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'deployed' AND (OLD.status IS DISTINCT FROM 'deployed') THEN
        NEW.deployed_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_deployed_at ON work_packages;
CREATE TRIGGER trg_deployed_at
    BEFORE UPDATE ON work_packages
    FOR EACH ROW EXECUTE FUNCTION set_deployed_at();
