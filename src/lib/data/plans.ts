export type Plan = {
	tier: 0 | 1 | 2;
	name: string;
	price: string;
	period: string;
	blurb: string;
	features: string[];
};

// ponytail: placeholder display copy — the amount actually charged comes
// from the Razorpay plan configured behind RAZORPAY_PLAN_ID_1/2 (razorpay.ts),
// not from anything here. Update both places together (Razorpay dashboard too).
export const PLANS: Plan[] = [
	{
		tier: 0,
		name: 'Free',
		price: '₹0',
		period: '/month',
		blurb: 'For practitioners starting their careers — a small gift from us.',
		features: [
			'Up to 10 clients',
			'Unlimited appointments',
			'Calendar with Google Meet links',
			'Automated email reminders for sessions & payments',
			'Notes sent to clients automatically',
			'Payment collection & invoicing (0% commission)',
			'Practitioner community — refer clients to colleagues',
			'No AI features'
		]
	},
	{
		tier: 1,
		name: 'Basic',
		price: '₹899',
		period: '/month',
		blurb: 'For a growing solo practice.',
		features: [
			'Up to 30 clients',
			'Unlimited appointments',
			'Calendar with Google Meet links',
			'Automated email reminders for sessions & payments',
			'Notes sent to clients automatically',
			'Payment collection & invoicing (0% commission)',
			'Practitioner community — refer clients to colleagues',
			'AI: fix note wording, one-line summaries',
			'AI: client-safe recap sent to the client, ask-about-a-client chat',
			'Good limits for AI use'
		]
	},
	{
		tier: 2,
		name: 'Pro',
		price: '₹1499',
		period: '/month',
		blurb: 'For a full practice, with no caseload ceiling.',
		features: [
			'Unlimited clients',
			'Unlimited appointments',
			'Calendar with Google Meet links',
			'Automated email reminders for sessions & payments',
			'Notes sent to clients automatically',
			'Payment collection & invoicing (0% commission)',
			'Practitioner community — refer clients to colleagues',
			'AI: fix note wording, one-line summaries',
			'AI: client-safe recap sent to the client, ask-about-a-client chat',
			'Very high limits for AI use'
		]
	}
];
