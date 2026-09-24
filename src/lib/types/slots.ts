// 'hybrid' = the client picks online or in person when booking
export type SlotModality = 'online' | 'in_person' | 'hybrid';

// A handcrafted bookable slot; times are the therapist's local wall-clock, "HH:MM"
export type DesignedSlot = {
	// database id of a stored slot; absent on a slot the therapist just added and hasn't saved.
	// The weekly save uses it to update/keep existing rows instead of re-creating them
	id?: string;
	// weekly-template slots only: the client this slot is held for every week. Read-only here —
	// it is set through its own action (setSlotReservation), never through the weekly save
	reservedClientId?: string | null;
	startTime: string;
	endTime: string;
	modality: SlotModality;
};

// A reserved weekly slot the therapist is about to edit or remove (see ReservedSlotChangeDialog)
export type ReservedSlotChange = {
	clientName: string;
	weekdayName: string;
	time: string;
	kind: 'changed' | 'removed';
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
