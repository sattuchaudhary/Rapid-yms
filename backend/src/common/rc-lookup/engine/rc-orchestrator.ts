import { IRCLookupProvider } from '../core/provider.interface';
import { VehicleRCDetails, ProviderLookupResult } from '../core/rc.types';
import { normalizeRCNumber, isValidRCNumber, InvalidRCNumberError, RCLookupError } from '../core/errors';
import { RCCacheService } from '../cache/rc-cache.service';
import { FastAppProvider } from '../providers/fast-app.provider';
import { NetcFastagProvider } from '../providers/netc-fastag.provider';
import { ULIPOfficialProvider } from '../providers/ulip.provider';
import { TelegramBotProvider } from '../providers/telegram-bot.provider';
import { MaskedRCProvider } from '../providers/masked-rc.provider';

export class RCLookupOrchestrator {
  private static instance: RCLookupOrchestrator;
  private providers: IRCLookupProvider[] = [];
  private cache: RCCacheService;

  private constructor() {
    this.cache = RCCacheService.getInstance();
    this.registerDefaultProviders();
  }

  public static getInstance(): RCLookupOrchestrator {
    if (!RCLookupOrchestrator.instance) {
      RCLookupOrchestrator.instance = new RCLookupOrchestrator();
    }
    return RCLookupOrchestrator.instance;
  }

  /**
   * Register active providers sorted by priority
   */
  private registerDefaultProviders(): void {
    this.providers = [
      new ULIPOfficialProvider(),
      new TelegramBotProvider(),
      new FastAppProvider(),
      new NetcFastagProvider(),
      new MaskedRCProvider(),
    ];
  }

  /**
   * Add custom or external provider dynamically
   */
  public registerProvider(provider: IRCLookupProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Primary lookup method with Cache -> Cascade Providers -> Merge & Cache
   */
  public async lookup(rawRcNumber: string, bypassCache: boolean = false): Promise<VehicleRCDetails> {
    const rcNumber = normalizeRCNumber(rawRcNumber);

    if (!isValidRCNumber(rcNumber)) {
      throw new InvalidRCNumberError(rawRcNumber);
    }

    // 1. Check Cache Layer (Instant Return < 1ms)
    if (!bypassCache) {
      const cached = this.cache.get(rcNumber);
      if (cached) {
        return cached;
      }
    }

    // 2. Cascade through enabled providers
    const activeProviders = this.providers
      .filter((p) => p.isEnabled)
      .sort((a, b) => a.priority - b.priority);

    let accumulatedDetails: Partial<VehicleRCDetails> = {
      rcNumber,
    };
    let resolved = false;

    for (const provider of activeProviders) {
      try {
        const result: ProviderLookupResult = await provider.lookup(rcNumber);
        if (result.success && result.data) {
          resolved = true;
          accumulatedDetails = this.mergeDetails(accumulatedDetails, result.data);

          // If we have both Vehicle Core (make/model) AND Financier/Bank, we have full data
          if (accumulatedDetails.make && accumulatedDetails.financier) {
            break;
          }
        }
      } catch (err) {
        // Continue to next provider in cascade
        continue;
      }
    }

    if (!resolved || (!accumulatedDetails.make && !accumulatedDetails.financier && !accumulatedDetails.ownerName && !accumulatedDetails.rtoName)) {
      throw new RCLookupError(`Vehicle details could not be found for registration: ${rcNumber}`, 'RC_NOT_FOUND', 404);
    }

    const finalDetails: VehicleRCDetails = {
      rcNumber,
      ownerName: accumulatedDetails.ownerName,
      fatherName: accumulatedDetails.fatherName,
      make: accumulatedDetails.make,
      model: accumulatedDetails.model,
      vehicleClass: accumulatedDetails.vehicleClass,
      fuelType: accumulatedDetails.fuelType,
      engineNumber: accumulatedDetails.engineNumber,
      chassisNumber: accumulatedDetails.chassisNumber,
      registrationDate: accumulatedDetails.registrationDate,
      manufacturingDate: accumulatedDetails.manufacturingDate,
      fitnessUpto: accumulatedDetails.fitnessUpto,
      insuranceCompany: accumulatedDetails.insuranceCompany,
      insurancePolicyNumber: accumulatedDetails.insurancePolicyNumber,
      insuranceUpto: accumulatedDetails.insuranceUpto,
      financier: accumulatedDetails.financier,
      puccUpto: accumulatedDetails.puccUpto,
      rtoName: accumulatedDetails.rtoName,
      color: accumulatedDetails.color,
      sourceProvider: accumulatedDetails.sourceProvider || 'cascade-engine',
      fetchedAt: new Date().toISOString(),
    };

    // 3. Save to cache for future lookups
    this.cache.set(rcNumber, finalDetails);

    return finalDetails;
  }

  private mergeDetails(base: Partial<VehicleRCDetails>, incoming: VehicleRCDetails): Partial<VehicleRCDetails> {
    return {
      rcNumber: base.rcNumber || incoming.rcNumber,
      ownerName: incoming.ownerName || base.ownerName,
      fatherName: incoming.fatherName || base.fatherName,
      make: incoming.make || base.make,
      model: incoming.model || base.model,
      vehicleClass: incoming.vehicleClass || base.vehicleClass,
      fuelType: incoming.fuelType || base.fuelType,
      engineNumber: incoming.engineNumber || base.engineNumber,
      chassisNumber: incoming.chassisNumber || base.chassisNumber,
      registrationDate: incoming.registrationDate || base.registrationDate,
      manufacturingDate: incoming.manufacturingDate || base.manufacturingDate,
      fitnessUpto: incoming.fitnessUpto || base.fitnessUpto,
      insuranceCompany: incoming.insuranceCompany || base.insuranceCompany,
      insurancePolicyNumber: incoming.insurancePolicyNumber || base.insurancePolicyNumber,
      insuranceUpto: incoming.insuranceUpto || base.insuranceUpto,
      financier: incoming.financier || base.financier,
      puccUpto: incoming.puccUpto || base.puccUpto,
      rtoName: incoming.rtoName || base.rtoName,
      color: incoming.color || base.color,
      sourceProvider: incoming.sourceProvider || base.sourceProvider,
      fetchedAt: incoming.fetchedAt || base.fetchedAt,
    };
  }
}
