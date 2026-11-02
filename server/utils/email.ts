import { Resend } from 'resend'
import { getServerRuntimeConfig } from '~/server/utils/runtime'

let resend: Resend | null = null

function getResend(): Resend | null {
  if (resend) return resend
  const apiKey = getServerRuntimeConfig()?.resendApiKey ?? process.env.RESEND_API_KEY
  if (!apiKey) return null
  try {
    resend = new Resend(apiKey)
  } catch (error) {
    console.error('[email] Failed to initialise Resend client:', error)
    return null
  }
  return resend
}

const BRAND_PRIMARY = '#E91E8C'
const BRAND_DEEP = '#C4157A'
const INK = '#2D2D2D'

function wrap(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tawasul Academy</title>
</head>
<body style="margin:0;padding:0;background-color:#FAFAFA;font-family:Inter,Arial,Helvetica,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAFA;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding:32px 40px 8px 40px;text-align:center;">
              <div style="font-size:22px;font-weight:600;color:${INK};letter-spacing:-0.01em;">Tawasul <span style="color:${BRAND_PRIMARY};">Academy</span></div>
            </td>
          </tr>
          ${bodyHtml}
          <tr>
            <td style="padding:32px 40px;text-align:center;border-top:1px solid #EBEBEB;color:#888888;font-size:12px;line-height:1.5;">
              © 2024 Tawasul Academy · Online mental health counseling platform
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function button(url: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px 0;">
  <a href="${url}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:9999px;box-shadow:0 4px 24px rgba(233,30,140,0.20);">${label}</a>
</td></tr></table>`
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  const client = getResend()
  if (!client) {
    console.warn(`[email] RESEND_API_KEY is not configured — skipping email to ${to} (subject: "${subject}")`)
    return
  }
  const config = getServerRuntimeConfig()
  const fromName = config?.resendFromName ?? process.env.RESEND_FROM_NAME ?? 'Tawasul Academy'
  const fromEmail = config?.resendFromEmail ?? process.env.RESEND_FROM_EMAIL
  const from = `${fromName} <${fromEmail}>`
  try {
    await client.emails.send({ from, to, subject, html })
  } catch (error) {
    console.error('[email] Failed to send email via Resend:', error)
    throw error
  }
}

export function passwordResetTemplate(name: string, resetUrl: string): string {
  return wrap(`<tr><td style="padding:24px 40px 8px 40px;">
  <h1 style="margin:0;font-size:22px;font-weight:600;color:${INK};">Hi ${name},</h1>
  <p style="margin:16px 0 0 0;font-size:16px;line-height:1.6;color:#4D4D4D;">We received a request to reset your Tawasul Academy password. Click the button below to choose a new one.</p>
</td></tr>
${button(resetUrl, 'Reset my password')}
<tr><td style="padding:0 40px 8px 40px;">
  <p style="margin:0;font-size:14px;line-height:1.5;color:#888888;">This link expires in 1 hour. If you didn't request this, ignore this email and your password will stay the same.</p>
</td></tr>`)
}

export function bookingConfirmationTemplate(patientName: string, doctorName: string, date: string, time: string, service: string): string {
  return wrap(`<tr><td style="padding:24px 40px 8px 40px;">
  <h1 style="margin:0;font-size:22px;font-weight:600;color:${INK};">Hi ${patientName},</h1>
  <p style="margin:16px 0 0 0;font-size:16px;line-height:1.6;color:#4D4D4D;">Your session is confirmed. Here are the details:</p>
</td></tr>
<tr><td style="padding:8px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAFA;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:16px 24px;font-size:14px;color:#888888;width:120px;">Doctor</td><td style="padding:16px 24px;font-size:15px;color:${INK};font-weight:500;">${doctorName}</td></tr>
    <tr><td style="padding:16px 24px;font-size:14px;color:#888888;width:120px;">Date</td><td style="padding:16px 24px;font-size:15px;color:${INK};font-weight:500;">${date}</td></tr>
    <tr><td style="padding:16px 24px;font-size:14px;color:#888888;width:120px;">Time</td><td style="padding:16px 24px;font-size:15px;color:${INK};font-weight:500;">${time}</td></tr>
    <tr><td style="padding:16px 24px;font-size:14px;color:#888888;width:120px;">Service</td><td style="padding:16px 24px;font-size:15px;color:${INK};font-weight:500;">${service}</td></tr>
  </table>
</td></tr>
<tr><td style="padding:8px 40px 24px 40px;">
  <p style="margin:0;font-size:14px;line-height:1.5;color:#4D4D4D;">Please join the video session a few minutes early. We'll make sure you know how to connect before it starts.</p>
</td></tr>`)
}

export function bookingReceivedTemplate(patientName: string, date: string, time: string): string {
  return wrap(`<tr><td style="padding:24px 40px 8px 40px;">
  <h1 style="margin:0;font-size:22px;font-weight:600;color:${INK};">Hi ${patientName},</h1>
  <p style="margin:16px 0 0 0;font-size:16px;line-height:1.6;color:#4D4D4D;">We have received your booking request for:</p>
</td></tr>
<tr><td style="padding:8px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAFA;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:16px 24px;font-size:14px;color:#888888;width:120px;">Date</td><td style="padding:16px 24px;font-size:15px;color:${INK};font-weight:500;">${date}</td></tr>
    <tr><td style="padding:16px 24px;font-size:14px;color:#888888;width:120px;">Time</td><td style="padding:16px 24px;font-size:15px;color:${INK};font-weight:500;">${time}</td></tr>
  </table>
</td></tr>
<tr><td style="padding:8px 40px 24px 40px;">
  <p style="margin:0;font-size:14px;line-height:1.5;color:#4D4D4D;">Our team will review and confirm your session shortly. You will receive a confirmation email with your session details once confirmed.</p>
</td></tr>`)
}

export function bookingCancellationTemplate(patientName: string, doctorName: string, date: string, time: string): string {
  return wrap(`<tr><td style="padding:24px 40px 8px 40px;">
  <h1 style="margin:0;font-size:22px;font-weight:600;color:${INK};">Hi ${patientName},</h1>
  <p style="margin:16px 0 0 0;font-size:16px;line-height:1.6;color:#4D4D4D;">Your session has been cancelled. Here are the details for reference:</p>
</td></tr>
<tr><td style="padding:8px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAFA;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:16px 24px;font-size:14px;color:#888888;width:120px;">Doctor</td><td style="padding:16px 24px;font-size:15px;color:${INK};font-weight:500;">${doctorName}</td></tr>
    <tr><td style="padding:16px 24px;font-size:14px;color:#888888;width:120px;">Date</td><td style="padding:16px 24px;font-size:15px;color:${INK};font-weight:500;">${date}</td></tr>
    <tr><td style="padding:16px 24px;font-size:14px;color:#888888;width:120px;">Time</td><td style="padding:16px 24px;font-size:15px;color:${INK};font-weight:500;">${time}</td></tr>
  </table>
</td></tr>
<tr><td style="padding:8px 40px 24px 40px;">
  <p style="margin:0;font-size:14px;line-height:1.5;color:#4D4D4D;">If this was unexpected, you can book a new session at any time from your dashboard.</p>
</td></tr>`)
}

export function doctorWelcomeTemplate(doctorName: string, email: string, temporaryPassword: string, loginUrl: string): string {
  return wrap(`<tr><td style="padding:24px 40px 8px 40px;">
  <h1 style="margin:0;font-size:22px;font-weight:600;color:${INK};">Welcome, ${doctorName}</h1>
  <p style="margin:16px 0 0 0;font-size:16px;line-height:1.6;color:#4D4D4D;">Your Tawasul Academy account is ready. Use the credentials below to log in for the first time.</p>
</td></tr>
<tr><td style="padding:8px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAFA;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:16px 24px;font-size:14px;color:#888888;width:120px;">Email</td><td style="padding:16px 24px;font-size:15px;color:${INK};font-weight:500;">${email}</td></tr>
    <tr><td style="padding:16px 24px;font-size:14px;color:#888888;width:120px;">Password</td><td style="padding:16px 24px;font-size:15px;color:${INK};font-weight:500;">${temporaryPassword}</td></tr>
  </table>
</td></tr>
<p style="margin:0;font-size:14px;line-height:1.5;color:#4D4D4D;padding:16px 40px 8px 40px;"><strong>Please change your password after your first login.</strong></p>
${button(`${loginUrl}/login`, 'Log in to Tawasul Academy')}`)
}

export function sessionReminderTemplate(recipientName: string, doctorOrPatientLabel: string, date: string, time: string): string {
  return wrap(`<tr><td style="padding:24px 40px 8px 40px;">
  <h1 style="margin:0;font-size:22px;font-weight:600;color:${INK};">Hi ${recipientName},</h1>
  <p style="margin:16px 0 0 0;font-size:16px;line-height:1.6;color:#4D4D4D;">A quick reminder that your session with <strong>${doctorOrPatientLabel}</strong> is tomorrow:</p>
</td></tr>
<tr><td style="padding:8px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAFAFA;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:16px 24px;font-size:14px;color:#888888;width:120px;">Date</td><td style="padding:16px 24px;font-size:15px;color:${INK};font-weight:500;">${date}</td></tr>
    <tr><td style="padding:16px 24px;font-size:14px;color:#888888;width:120px;">Time</td><td style="padding:16px 24px;font-size:15px;color:${INK};font-weight:500;">${time}</td></tr>
  </table>
</td></tr>
<tr><td style="padding:8px 40px 24px 40px;">
  <p style="margin:0;font-size:14px;line-height:1.5;color:#4D4D4D;">Please join the session room 5 minutes early so we can get started on time.</p>
</td></tr>`)
}