// 'hybrid' = the client picks online or in person when booking
export type SlotModality = 'online' | 'in_person' | 'hybrid';

// A handcrafted bookable slot; times are the therapist's local wall-clock, "HH:MM"
export type DesignedSlot = {
	// database id of a weekly-template slot; the per-slot actions (weeklySlots.ts) target it
	id?: string;
	// weekly-template slots only: the client this slot is held for every week. Read-only here —
	// it is set through its own action (reserveSlot in weeklySlots.ts)
	reservedClientId?: string | null;
	startTime: string;
	endTime: string;
	modality: SlotModality;
};

// One day of the design: its slots plus the most sessions it takes (null = no limit)
export type DesignedDay = {
	slots: DesignedSlot[];
	maxSessions: number | null;
};

// A weekday of the weekly template. On holiday it keeps its slots but nothing can be booked.
export type WeeklyDay = DesignedDay & {
	holiday: boolean;
};
