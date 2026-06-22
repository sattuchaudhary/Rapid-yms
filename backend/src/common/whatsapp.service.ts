// ============================================
// whatsapp.service.ts — Dynamic WhatsApp & SMS Notifications
// ============================================
import logger from './logger';

export interface WhatsAppConfig {
  whatsappApiKey: string;
}

export interface TwilioConfig {
  twilioSid: string;
  twilioAuth: string;
  twilioFrom: string;
}

export const sendWhatsAppService = async (config: WhatsAppConfig, to: string, message: string) => {
  try {
    logger.info(`[WhatsAppService] Sending WhatsApp to ${to} using API Key [${config.whatsappApiKey.slice(0, 4)}...]`);
    // Simulate WhatsApp Cloud API dispatch
    await new Promise((resolve) => setTimeout(resolve, 1000));
    logger.info(`[WhatsAppService] WhatsApp successfully sent to ${to}`);
    return { success: true };
  } catch (err: any) {
    logger.error(`[WhatsAppService] Error sending WhatsApp to ${to}: ${err.message}`);
    throw err;
  }
};

export const sendSMSService = async (config: TwilioConfig, to: string, message: string) => {
  try {
    logger.info(`[SMSService] Sending Twilio SMS to ${to} from ${config.twilioFrom}`);
    // Simulate Twilio SMS dispatch
    await new Promise((resolve) => setTimeout(resolve, 1000));
    logger.info(`[SMSService] Twilio SMS successfully sent to ${to}`);
    return { success: true };
  } catch (err: any) {
    logger.error(`[SMSService] Error sending SMS to ${to}: ${err.message}`);
    throw err;
  }
};
