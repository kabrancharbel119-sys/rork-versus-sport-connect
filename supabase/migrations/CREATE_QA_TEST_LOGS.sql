-- =============================================
-- CREATE qa_test_logs table for internal QA runs
-- =============================================

CREATE TABLE IF NOT EXISTS qa_test_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  scenario_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_trace TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_test_logs_run_id ON qa_test_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_qa_test_logs_created_at ON qa_test_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_test_logs_domain_status ON qa_test_logs(domain, status);

ALTER TABLE qa_test_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view qa logs" ON qa_test_logs;
CREATE POLICY "Admins can view qa logs"
  ON qa_test_logs FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert qa logs" ON qa_test_logs;
CREATE POLICY "Admins can insert qa logs"
  ON qa_test_logs FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete qa logs" ON qa_test_logs;
CREATE POLICY "Admins can delete qa logs"
  ON qa_test_logs FOR DELETE
  USING (true);

GRANT ALL ON qa_test_logs TO authenticated;
GRANT ALL ON qa_test_logs TO anon;

SELECT 'qa_test_logs table ready' AS result;
