/** mailService.ts — SMTP email sending using the active SmtpConfig from the database. */
import nodemailer from 'nodemailer';
import SmtpConfig, { ISmtpConfig } from '../models/SmtpConfig';
import User from '../models/User';
import { createLogger } from '../config/logger';

const log = createLogger('mail-service');

export interface SmtpTestConfigInput {
  smtpHost: string;
  smtpPort: number;
  tlsMode: 'none' | 'starttls' | 'ssl';
  smtpUser?: string;
  smtpPassword?: string;
  fromEmail: string;
  fromName?: string;
}

function createTransporter(config: ISmtpConfig): nodemailer.Transporter {
  const secure = config.tlsMode === 'ssl';
  const requireTLS = config.tlsMode === 'starttls';

  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure,
    ...(requireTLS ? { requireTLS: true } : {}),
    auth:
      config.smtpUser
        ? { user: config.smtpUser, pass: config.smtpPassword }
        : undefined,
  });
}

/**
 * Send a single email using the currently active SMTP configuration.
 * Returns silently on failure — callers should treat this as fire-and-forget.
 */
export async function sendMail(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<void> {
  const config = await SmtpConfig.findOne({ isActive: true }).lean();
  if (!config) {
    log.warn('No active SMTP configuration — skipping email');
    return;
  }

  const transporter = createTransporter(config as ISmtpConfig);
  const from = config.fromName
    ? `"${config.fromName}" <${config.fromEmail}>`
    : config.fromEmail;

  try {
    const info = await transporter.sendMail({ from, to, subject, text, html });
    log.info({ to, subject, messageId: info.messageId }, 'Email sent');
  } catch (err) {
    log.error({ err, to, subject }, 'Failed to send email');
  }
}

/**
 * Notify all admin users that a new user has registered.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function sendNewUserNotification(newUserEmail: string): Promise<void> {
  try {
    const admins = await User.find({ role: 'admin' }).select('email').lean();
    if (admins.length === 0) {
      log.warn('No admin users found — cannot send signup notification');
      return;
    }

    const subject = `[PhiloGPT] New user registration: ${newUserEmail}`;
    const text = [
      `A new user has registered on PhiloGPT:`,
      '',
      `  Email: ${newUserEmail}`,
      '',
      `The account is locked and awaiting manual activation.`,
      `Please log in to the admin panel to review and unlock the account.`,
    ].join('\n');

    for (const admin of admins) {
      await sendMail(admin.email, subject, text);
    }
  } catch (err) {
    log.error({ err, newUserEmail }, 'Failed to send new-user notification');
  }
}

/**
 * Send a test email using an explicit SMTP config payload.
 * Throws on failure so callers can surface actionable errors in the UI.
 */
export async function sendTestMailWithConfig(
  to: string,
  configInput: SmtpTestConfigInput,
): Promise<void> {
  const config = {
    smtpHost: configInput.smtpHost,
    smtpPort: configInput.smtpPort,
    tlsMode: configInput.tlsMode,
    smtpUser: configInput.smtpUser ?? '',
    smtpPassword: configInput.smtpPassword ?? '',
    fromEmail: configInput.fromEmail,
    fromName: configInput.fromName ?? 'PhiloGPT',
  } as ISmtpConfig;

  const transporter = createTransporter(config);
  const from = config.fromName
    ? `"${config.fromName}" <${config.fromEmail}>`
    : config.fromEmail;

  const subject = '[PhiloGPT] SMTP test email';
  const text = [
    'This is a test email from PhiloGPT SMTP settings.',
    '',
    `Host: ${config.smtpHost}`,
    `Port: ${config.smtpPort}`,
    `TLS Mode: ${config.tlsMode}`,
    '',
    'If you received this message, SMTP is configured correctly.',
  ].join('\n');

  const info = await transporter.sendMail({ from, to, subject, text });
  log.info({ to, messageId: info.messageId }, 'SMTP test email sent');
}
