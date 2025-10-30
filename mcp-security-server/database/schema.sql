CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  client_id TEXT,
  status TEXT,
  created_at TIMESTAMP DEFAULT now(),
  finished_at TIMESTAMP,
  severity_summary JSONB,
  advisories JSONB,
  safe BOOLEAN
);