-- The app's history query (limit 20 + 1) on the seed data: first page, then a page 90,000 rows deep.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, prompt, result, cached, created_at FROM generations
WHERE user_id = 'seed-user'
ORDER BY created_at DESC, id DESC
LIMIT 21;

SELECT created_at AS cursor_created_at, id AS cursor_id FROM generations
WHERE user_id = 'seed-user'
ORDER BY created_at DESC, id DESC
OFFSET 90000 LIMIT 1 \gset

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, prompt, result, cached, created_at FROM generations
WHERE user_id = 'seed-user' AND (created_at, id) < (:'cursor_created_at', :cursor_id)
ORDER BY created_at DESC, id DESC
LIMIT 21;
