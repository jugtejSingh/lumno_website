// Shared by the server and both UIs (therapist /clients dialog, client portal).
// Order here is the order the tag picker shows; also feeds clientResourceTagEnum.
export const RESOURCE_TAGS = [
	'prescription',
	'assessment',
	'reading',
	'extra_information',
	'medical_report',
	'worksheet',
	'letter',
	'consent_form',
	'other'
] as const;

export type ResourceTag = (typeof RESOURCE_TAGS)[number];

export const RESOURCE_TAG_LABELS: Record<ResourceTag, string> = {
	prescription: 'Prescription',
	assessment: 'Assessment',
	reading: 'Reading',
	extra_information: 'Extra information',
	medical_report: 'Medical report',
	worksheet: 'Worksheet / homework',
	letter: 'Letter / referral',
	consent_form: 'Consent form',
	other: 'Other'
};

// raster images + PDF only: an HTML/SVG upload could carry script
export const RESOURCE_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

export const MAX_RESOURCE_BYTES = 20 * 1024 * 1024;

export type ResourceUploader = 'therapist' | 'client';

export type ResourceRow = {
	id: string;
	kind: 'file' | 'link';
	name: string;
	tag: ResourceTag;
	// signed S3 URL for files, the stored URL for links
	href: string;
	uploadedBy: ResourceUploader;
	createdAt: Date;
};

// What requestUpload hands the browser: POST `fields` + the file to `url`, then
// confirm with `key`.
export type ResourceUploadTicket = {
	url: string;
	fields: Record<string, string>;
	key: string;
};
