// ============================================
// mail.service.ts — Dynamic Nodemailer Email Service
// ============================================
import nodemailer from 'nodemailer';
import logger from './logger';

export interface SMTPConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}

export const sendMailService = async (
  config: SMTPConfig,
  to: string,
  subject: string,
  html: string,
  attachments?: any[]
) => {
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: Number(config.smtpPort),
      secure: Number(config.smtpPort) === 465, // true for 465, false otherwise
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });

    const mailOptions = {
      from: config.smtpFrom,
      to,
      subject,
      html,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`[MailService] Email successfully sent to ${to}. Message ID: ${info.messageId}`);
    return info;
  } catch (err: any) {
    logger.error(`[MailService] Error sending email to ${to}: ${err.message}`);
    throw err;
  }
};
