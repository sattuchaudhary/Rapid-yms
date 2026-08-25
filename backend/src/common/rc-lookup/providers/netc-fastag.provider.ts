import { BaseRCLookupProvider } from './base.provider';
import { ProviderLookupResult, VehicleRCDetails } from '../core/rc.types';

/**
 * NETC FASTag & NPCI Resolver Provider
 * Fetches FASTag status, issuing bank, vehicle tag class, and basic identification.
 */
export class NetcFastagProvider extends BaseRCLookupProvider {
  readonly name = 'netc-fastag-provider';
  readonly priority = 3;
  readonly isEnabled = true;

  async lookup(rcNumber: string): Promise<ProviderLookupResult> {
    const startTime = Date.now();
    try {
      const formattedRc = rcNumber.toUpperCase().trim();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Query NETC NPCI Fastag public validation endpoint
      const response = await fetch(`https://echallan.parivahan.gov.in/gst/api/v1/netc/vehicle-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.getRandomUserAgent(),
        },
        body: JSON.stringify({ vehicleNumber: formattedRc }),
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (response && response.ok) {
        const body: any = await response.json().catch(() => null);
        if (body && body.data) {
          const parsed: VehicleRCDetails = {
            rcNumber: formattedRc,
            financier: body.data.bankName || body.data.tagIssuingBank || undefined,
            vehicleClass: body.data.vehicleClass || undefined,
            chassisNumber: body.data.chassisNumber || undefined,
            sourceProvider: this.name,
            fetchedAt: new Date().toISOString(),
          };
          return this.createSuccessResult(parsed, startTime);
        }
      }

      return this.createErrorResult('FASTag data unavailable for this vehicle', startTime);
    } catch (err: any) {
      return this.createErrorResult(err.message || 'NETC lookup failed', startTime);
    }
  }
}
