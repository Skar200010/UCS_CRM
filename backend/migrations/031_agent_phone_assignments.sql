CREATE TABLE IF NOT EXISTS agent_phone_assignments (
  user_id uuid NOT NULL,
  account_id bigint NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, account_id)
);

GRANT ALL ON agent_phone_assignments TO anon;
