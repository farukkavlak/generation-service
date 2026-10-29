CREATE TABLE daily_quota (
  user_id text NOT NULL,
  day date NOT NULL,
  used smallint NOT NULL,
  PRIMARY KEY (user_id, day),
  CONSTRAINT daily_quota_user_id_length CHECK (char_length(user_id) BETWEEN 1 AND 128),
  CONSTRAINT daily_quota_used_not_negative CHECK (used >= 0)
);
