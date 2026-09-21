// 'hybrid' = the client picks online or in person when booking
export type SlotModality = 'online' | 'in_person' | 'hybrid';

// A handcrafted bookable slot; times are the therapist's local wall-clock, "HH:MM"
export type DesignedSlot = {
	startTime: string;
	endTime: string;
	modality: SlotModality;
};

// One day of the design: its slots plus the most sessions it takes (null = no limit)
export type DesignedDay = {
	slots: DesignedSlot[];
	maxSessions: number | null;
};
