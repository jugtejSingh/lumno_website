export type CalendarSession = {
	id: string;
	time: string;
	endLabel: string; // end time in the same "2:00 PM" style as `time`
	name: string;
	color: string;
	notes: string | null;
	modality: 'online' | 'in_person';
	modalityLabel: string;
	status: 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';

	startTime: string; // "HH:MM", therapist's own timezone — used to prefill a reschedule
	endTime: string;
	meetLink: string | null; // Google Meet link for online sessions once the therapist has connected Google
};

export type CalendarDay = {
	day: number | null;
	isToday: boolean;
	sessions: CalendarSession[];
	extraCount: number;
	kind: 'online' | 'in_person' | 'hybrid' | 'off' | null;
};

export type CalendarWeek = {
	id: number;
	days: CalendarDay[];
};

