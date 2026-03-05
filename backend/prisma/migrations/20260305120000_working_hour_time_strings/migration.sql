-- Normalize dayOfWeek: 0 (Sun) -> 7, keep 1-6 as-is (target is 1-7 Mon-Sun)
UPDATE "WorkingHour"
SET "dayOfWeek" = CASE WHEN "dayOfWeek" = 0 THEN 7 ELSE "dayOfWeek" END;

-- Convert DateTime startTime/endTime to "HH:MM" (24h) strings (time-of-day in UTC)
ALTER TABLE "WorkingHour"
  ALTER COLUMN "startTime" TYPE TEXT USING to_char("startTime" AT TIME ZONE 'UTC', 'HH24:MI');

ALTER TABLE "WorkingHour"
  ALTER COLUMN "endTime" TYPE TEXT USING to_char("endTime" AT TIME ZONE 'UTC', 'HH24:MI');
