CREATE TABLE IF NOT EXISTS visitor_keys (
  visitor_key  TEXT    NOT NULL,
  first_seen   INTEGER NOT NULL,
  last_seen    INTEGER NOT NULL,
  PRIMARY KEY (visitor_key)
);

CREATE INDEX IF NOT EXISTS idx_visitor_keys_last_seen
  ON visitor_keys (last_seen);
