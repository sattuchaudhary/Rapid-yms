import { BaseRCLookupProvider } from './base.provider';
import { ProviderLookupResult, VehicleRCDetails } from '../core/rc.types';

/**
 * Fast Mobile App Reverse-Engineered Provider
 * Queries lightweight mobile JSON endpoints with Android client headers.
 * Zero captcha, sub-500ms latency.
 */
export class FastAppProvider extends BaseRCLookupProvider {
  readonly name = 'fast-app-provider';
  readonly priority = 1;
  readonly isEnabled = true;

  async lookup(rcNumber: string): Promise<ProviderLookupResult> {
    const startTime = Date.now();
    try {
      // Clean vehicle number format
      const formattedRc = rcNumber.toUpperCase().trim();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

      // Primary reverse mobile endpoint simulator
      const response = await fetch(`https://api.cuvora.com/car/service/view/vehicle/detail?vehicleNumber=${encodeURIComponent(formattedRc)}`, {
        method: 'GET',
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://carinfo.app',
          'Referer': 'https://carinfo.app/',
        },
        signal: controller.signal,
      }).catch((err) => {
        return null;
      });

      clearTimeout(timeoutId);

      if (response && response.ok) {
        const body: any = await response.json().catch(() => null);
        if (body && (body.vehicleNumber || body.rcNumber || body.details)) {
          const details = body.details || body;
          const parsed: VehicleRCDetails = {
            rcNumber: formattedRc,
            ownerName: details.ownerName || details.name || undefined,
            make: details.make || details.maker || undefined,
            model: details.model || details.vehicleModel || undefined,
            vehicleClass: details.vehicleClass || details.class || undefined,
            fuelType: details.fuelType || details.fuel || undefined,
            engineNumber: details.engineNumber || details.engineNo || undefined,
            chassisNumber: details.chassisNumber || details.chassisNo || undefined,
            registrationDate: details.registrationDate || details.regDate || undefined,
            fitnessUpto: details.fitnessUpto || details.fitness || undefined,
            insuranceCompany: details.insuranceCompany || details.insurance || undefined,
            insuranceUpto: details.insuranceUpto || details.insuranceExpiry || undefined,
            financier: details.financier || details.financer || details.hypothecation || undefined,
            puccUpto: details.puccUpto || details.puccExpiry || undefined,
            rtoName: details.rto || details.rtoName || undefined,
            color: details.color || undefined,
            sourceProvider: this.name,
            fetchedAt: new Date().toISOString(),
          };

          return this.createSuccessResult(parsed, startTime);
        }
      }

      // If upstream endpoint is unreachable or changed, return failure gracefully to allow cascade
      return this.createErrorResult('No record found or upstream format changed', startTime);
    } catch (error: any) {
      return this.createErrorResult(error.message || 'Lookup failed', startTime);
    }
  }
}
