-- Run once, manually, against the database (not something drizzle-kit can push).
-- Guarantees Postgres itself refuses two confirmed appointments for the same
-- therapist whose ranges overlap. Back-to-back bookings (3-4pm, 4-5pm) are
-- allowed. Gaps between sessions come from how the therapist designs their
-- slots, so there is no buffer here.
--
-- The advisory lock is what makes this race-safe: two concurrent booking
-- requests for the same therapist serialize on the lock, so the second one's
-- overlap check always sees the first one's row (committed or rolled back)
-- instead of racing past it. Different therapists never block each other.

CREATE OR REPLACE FUNCTION check_appointment_no_overlap() RETURNS TRIGGER AS $$
BEGIN
	PERFORM pg_advisory_xact_lock(hashtext(NEW.therapist_id));

	IF EXISTS (
		SELECT 1 FROM appointment a
		WHERE a.therapist_id = NEW.therapist_id
			AND a.status = 'confirmed'
			AND a.id != NEW.id
			AND tstzrange(a.start_at, a.end_at, '[)') && tstzrange(NEW.start_at, NEW.end_at, '[)')
	) THEN
		RAISE EXCEPTION 'appointment_overlaps_existing_booking'
			USING DETAIL = 'therapist already has a confirmed appointment in that time';
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
