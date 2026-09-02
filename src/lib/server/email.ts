import { env } from '$env/dynamic/private';
import { Resend } from 'resend';

const resend = new Resend(env.RESEND_API);

export async function sendEmail(to: string, subject: string, html: string) {
	const { error } = await resend.emails.send({ from: env.EMAIL_FROM, to, subject, html });
	if (error) {
		throw new Error(`failed to send email to ${to}: ${error.message}`);
	}
}
