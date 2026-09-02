export type Note = {
	id: string;
	createdAt: Date;
	body: string; // markdown source
	sessionLabel: string | null;
};

export type NotesClient = {
	id: string;
	name: string;
	notes: Note[];
	sharedNotes: Note[];
};