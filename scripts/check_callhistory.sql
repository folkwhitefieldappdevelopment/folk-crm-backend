SELECT id, substring("callHistory", 1, 200) as sample FROM people WHERE "callHistory" IS NOT NULL AND "callHistory" != '[]' LIMIT 3;
