CREATE TABLE generations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL,
  prompt text NOT NULL,
  result text NOT NULL,
  cached boolean NOT NULL,
  -- Millisecond precision matches JavaScript dates, so cursors round-trip exactly.
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT generations_user_id_length CHECK (char_length(user_id) BETWEEN 1 AND 128),
  CONSTRAINT generations_prompt_length CHECK (char_length(prompt) BETWEEN 1 AND 2000)
);

-- id breaks ties between equal timestamps in the history cursor.
CREATE INDEX generations_user_history_idx ON generations (user_id, created_at DESC, id DESC);
