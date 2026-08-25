import { BaseRCLookupProvider } from './base.provider';
import { ProviderLookupResult, VehicleRCDetails } from '../core/rc.types';

/**
 * Telegram Bot RC Lookup Provider
 * Bridges vehicle lookup requests to automated Telegram RTO bots.
 * Parses Customer Name, Bank/Financier, Chassis No, Engine No, Make, and Model.
 */
export class TelegramBotProvider extends BaseRCLookupProvider {
  readonly name = 'telegram-bot-provider';
  readonly priority = 2;

  get isEnabled(): boolean {
    return Boolean(process.env.TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_API_ID);
  }

  async lookup(rcNumber: string): Promise<ProviderLookupResult> {
    const startTime = Date.now();

    if (!this.isEnabled) {
      return this.createErrorResult('Telegram Bot credentials / username not configured in .env', startTime);
    }

    try {
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || '';
      const formattedRc = rcNumber.toUpperCase().trim();

      // If HTTP Telegram Webhook Bridge / MTProto Bridge Endpoint is configured:
      const bridgeUrl = process.env.TELEGRAM_BRIDGE_URL;
      if (bridgeUrl) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

        const response = await fetch(`${bridgeUrl}/lookup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bot: botUsername,
            query: formattedRc,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const body: any = await response.json();
          if (body?.text || body?.data) {
            const parsed = body.data || this.parseBotReplyText(formattedRc, body.text);
            return this.createSuccessResult(parsed, startTime);
          }
        }
      }

      return this.createErrorResult(`Telegram bridge awaiting active bot connection to ${botUsername}`, startTime);
    } catch (err: any) {
      return this.createErrorResult(err.message || 'Telegram Bot query failed', startTime);
    }
  }

  /**
   * Universal Regex Parser for Telegram RTO Bot reply messages
   * Extracts Owner, Bank/Financier, Chassis, Engine, Make, Model
   */
  public parseBotReplyText(rcNumber: string, messageText: string): VehicleRCDetails {
    const text = messageText || '';

    // Regex matchers for various bot output formats
    const ownerMatch = text.match(/(?:Owner|Name|Owner Name|Customer Name)\s*[:=-]\s*([^\n\r,]+)/i);
    const bankMatch = text.match(/(?:Financier|Hypothecation|Bank|Loan|Financed by|Financer)\s*[:=-]\s*([^\n\r,]+)/i);
    const chassisMatch = text.match(/(?:Chassis|Chassis No|Chassis Number|VIN)\s*[:=-]\s*([A-Z0-9]+)/i);
    const engineMatch = text.match(/(?:Engine|Engine No|Engine Number)\s*[:=-]\s*([A-Z0-9]+)/i);
    const makeMatch = text.match(/(?:Maker|Make|Manufacturer|Company)\s*[:=-]\s*([^\n\r,]+)/i);
    const modelMatch = text.match(/(?:Model|Variant|Vehicle Model)\s*[:=-]\s*([^\n\r,]+)/i);
    const classMatch = text.match(/(?:Class|Vehicle Class|Category)\s*[:=-]\s*([^\n\r,]+)/i);
    const fuelMatch = text.match(/(?:Fuel|Fuel Type)\s*[:=-]\s*([A-Z]+)/i);
    const regDateMatch = text.match(/(?:Reg Date|Registration Date|Regn Date)\s*[:=-]\s*([^\n\r,]+)/i);
    const insuranceMatch = text.match(/(?:Insurance|Insurance Co|Insurance Company)\s*[:=-]\s*([^\n\r,]+)/i);
    const fitnessMatch = text.match(/(?:Fitness|Fitness Upto)\s*[:=-]\s*([^\n\r,]+)/i);

    return {
      rcNumber: rcNumber.toUpperCase(),
      ownerName: ownerMatch ? ownerMatch[1].trim() : undefined,
      financier: bankMatch ? bankMatch[1].trim() : undefined,
      chassisNumber: chassisMatch ? chassisMatch[1].trim() : undefined,
      engineNumber: engineMatch ? engineMatch[1].trim() : undefined,
      make: makeMatch ? makeMatch[1].trim() : undefined,
      model: modelMatch ? modelMatch[1].trim() : undefined,
      vehicleClass: classMatch ? classMatch[1].trim() : undefined,
      fuelType: fuelMatch ? fuelMatch[1].trim() : undefined,
      registrationDate: regDateMatch ? regDateMatch[1].trim() : undefined,
      insuranceCompany: insuranceMatch ? insuranceMatch[1].trim() : undefined,
      fitnessUpto: fitnessMatch ? fitnessMatch[1].trim() : undefined,
      sourceProvider: this.name,
      fetchedAt: new Date().toISOString(),
    };
  }
}
