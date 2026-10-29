BEGIN;

DELETE FROM generations WHERE user_id = 'seed-user';

-- One row per second, so the history looks like real use instead of one shared timestamp.
INSERT INTO generations (user_id, prompt, result, cached, created_at)
SELECT 'seed-user', 'seed prompt ' || n, 'Sonuç: seed prompt ' || n, n % 3 = 0,
       now() - n * interval '1 second'
FROM generate_series(1, 100000) AS n;

COMMIT;

ANALYZE generations;
