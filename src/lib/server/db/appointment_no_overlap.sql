-- Run once, manually, against the database (not something drizzle-kit can push).
-- Guarantees Postgres itself refuses two confirmed appointments for the same
-- therapist whose ranges overlap once each appointment's end is padded by
-- that therapist's current buffer_minutes (therapist_settings.buffer_minutes).
-- Buffer only applies after a session, never before it — a 3-4pm appointment
-- with a 10 minute buffer blocks bookings up to 4:10pm; 4:10pm itself is free.
-- buffer_minutes = 0 still allows back-to-back bookings (3-4pm, 4-5pm).
--
-- The advisory lock is what makes this race-safe: two concurrent booking
-- requests for the same therapist serialize on the lock, so the second one's
-- overlap check always sees the first one's row (committed or rolled back)
-- instead of racing past it. Different therapists never block each other.

CREATE OR REPLACE FUNCTION check_appointment_no_overlap() RETURNS TRIGGER AS $$
DECLARE
	buffer_minutes INT;
BEGIN
	PERFORM pg_advisory_xact_lock(hashtext(NEW.therapist_id));

	SELECT COALESCE(ts.buffer_minutes, 0) INTO buffer_minutes
	FROM therapist_settings ts
	WHERE ts.therapist_id = NEW.therapist_id;
	buffer_minutes := COALESCE(buffer_minutes, 0);

	IF EXISTS (
		SELECT 1 FROM appointment a
		WHERE a.therapist_id = NEW.therapist_id
			AND a.status = 'confirmed'
			AND a.id != NEW.id
			AND tstzrange(a.start_at, a.end_at + (buffer_minutes || ' minutes')::interval, '[)')
				&& tstzrange(NEW.start_at, NEW.end_at + (buffer_minutes || ' minutes')::interval, '[)')
	) THEN
		RAISE EXCEPTION 'appointment_overlaps_existing_booking'
			USING DETAIL = 'therapist already has a confirmed appointment within the buffer window';
	END IF;

	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointment_no_overlap ON appointment;
CREATE TRIGGER appointment_no_overlap
	BEFORE INSERT OR UPDATE ON appointment
	FOR EACH ROW
	WHEN (NEW.status = 'confirmed')
	EXECUTE FUNCTION check_appointment_no_overlap();