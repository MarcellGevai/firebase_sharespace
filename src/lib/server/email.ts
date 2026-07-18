import { Resend } from 'resend';
import { RESEND_API_KEY } from '$env/static/private';

const resend = new Resend(RESEND_API_KEY);

/**
 * Sends a transactional email using Resend.
 * 
 * @param to The recipient's email address.
 * @param subject The subject line of the email.
 * @param html The HTML content of the email.
 * @returns A boolean indicating whether the email was sent successfully.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
	try {
		const { data, error } = await resend.emails.send({
			from: 'ShareSpace <onboarding@resend.dev>',
			to,
			subject,
			html
		});

		if (error) {
			console.error('Failed to send email via Resend:', error);
			return false;
		}

		console.log('Email sent successfully, id:', data?.id);
		return true;
	} catch (err) {
		console.error('Unexpected error while sending email:', err);
		return false;
	}
}
