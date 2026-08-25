import { IRCLookupProvider } from '../core/provider.interface';
import { ProviderLookupResult, VehicleRCDetails } from '../core/rc.types';

export abstract class BaseRCLookupProvider implements IRCLookupProvider {
  abstract readonly name: string;
  abstract readonly priority: number;
  abstract readonly isEnabled: boolean;

  protected userAgents: string[] = [
    'okhttp/4.9.2',
    'Dalvik/2.1.0 (Linux; U; Android 13; SM-S918B Build/TP1A.220624.014)',
    'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  ];

  protected getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  abstract lookup(rcNumber: string): Promise<ProviderLookupResult>;

  protected createSuccessResult(data: VehicleRCDetails, startTime: number): ProviderLookupResult {
    return {
      success: true,
      data: {
        ...data,
        sourceProvider: this.name,
        fetchedAt: new Date().toISOString(),
      },
      providerName: this.name,
      durationMs: Date.now() - startTime,
    };
  }

  protected createErrorResult(error: string, startTime: number): ProviderLookupResult {
    return {
      success: false,
      error,
      providerName: this.name,
      durationMs: Date.now() - startTime,
    };
  }
}
