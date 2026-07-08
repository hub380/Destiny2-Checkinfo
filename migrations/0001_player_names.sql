CREATE TABLE IF NOT EXISTS player_names (
  bungie_name      TEXT    NOT NULL,
  membership_type  TEXT    NOT NULL,
  membership_id    TEXT    NOT NULL,
  memberships_json TEXT    NOT NULL DEFAULT '[]',
  cached_at        INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL,
  PRIMARY KEY (bungie_name)
);

CREATE INDEX IF NOT EXISTS idx_player_names_expires
  ON player_names (expires_at);
