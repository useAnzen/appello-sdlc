-- Pulse State Migration
-- Stores live Pulse metadata (members, milestones, score, goal) synced from AgentC2
-- by the God Agent at the end of each loop. Dashboard reads this table.

CREATE TABLE IF NOT EXISTS pulse_state (
    pulse_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    goal TEXT,
    description TEXT,
    status TEXT DEFAULT 'ACTIVE',
    score_function TEXT,
    target_score NUMERIC(5,1),
    current_score NUMERIC(5,1),
    score_direction TEXT DEFAULT 'higher',
    eval_cron TEXT,
    members JSONB DEFAULT '[]'::jsonb,
    milestones JSONB DEFAULT '[]'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE pulse_state ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pulse_state' AND policyname = 'anon_select_pulse_state') THEN
        CREATE POLICY "anon_select_pulse_state" ON pulse_state FOR SELECT TO anon USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pulse_state' AND policyname = 'anon_insert_pulse_state') THEN
        CREATE POLICY "anon_insert_pulse_state" ON pulse_state FOR INSERT TO anon WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pulse_state' AND policyname = 'anon_update_pulse_state') THEN
        CREATE POLICY "anon_update_pulse_state" ON pulse_state FOR UPDATE TO anon USING (true) WITH CHECK (true);
    END IF;
END $$;
