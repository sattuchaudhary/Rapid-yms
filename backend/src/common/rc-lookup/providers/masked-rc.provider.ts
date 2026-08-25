import { BaseRCLookupProvider } from './base.provider';
import { ProviderLookupResult, VehicleRCDetails } from '../core/rc.types';
import { lookupRTO } from '../core/rto-directory';

/**
 * Masked RC Intelligence Provider
 * Resolves vehicle metadata, RTO details, vehicle class, and available masked records.
 */
export class MaskedRCProvider extends BaseRCLookupProvider {
  readonly name = 'masked-rc-provider';
  readonly priority = 4;
  readonly isEnabled = true;

  async lookup(rcNumber: string): Promise<ProviderLookupResult> {
    const startTime = Date.now();
    try {
      const formattedRc = rcNumber.toUpperCase().trim();
      const rtoInfo = lookupRTO(formattedRc);

      // 1. Try public mobile gateway for masked RC summary
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      let fetchedData: Partial<VehicleRCDetails> = {};

      try {
        const response = await fetch(`https://api.cuvora.com/car/service/view/vehicle/detail?vehicleNumber=${formattedRc}`, {
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });

        if (response.ok) {
          const body: any = await response.json();
          if (body && (body.details || body.vehicleNumber)) {
            const d = body.details || body;
            fetchedData = {
              ownerName: d.ownerName || d.name,
              make: d.make || d.maker,
              model: d.model || d.vehicleModel,
              vehicleClass: d.vehicleClass || d.class,
              fuelType: d.fuelType || d.fuel,
              engineNumber: d.engineNumber || d.engineNo,
              chassisNumber: d.chassisNumber || d.chassisNo,
              registrationDate: d.registrationDate || d.regDate,
              fitnessUpto: d.fitnessUpto || d.fitness,
              insuranceCompany: d.insuranceCompany || d.insurance,
              insuranceUpto: d.insuranceUpto,
              financier: d.financier || d.financer || d.hypothecation,
            };
          }
        }
      } catch {
        // Fallback to RTO directory metadata
      } finally {
        clearTimeout(timeoutId);
      }

      // Assemble unified details enriched with RTO data
      const result: VehicleRCDetails = {
        rcNumber: formattedRc,
        ownerName: fetchedData.ownerName || undefined,
        make: fetchedData.make || undefined,
        model: fetchedData.model || undefined,
        vehicleClass: fetchedData.vehicleClass || 'Motor Vehicle / Commercial Transport',
        fuelType: fetchedData.fuelType || undefined,
        engineNumber: fetchedData.engineNumber || undefined,
        chassisNumber: fetchedData.chassisNumber || undefined,
        registrationDate: fetchedData.registrationDate || undefined,
        fitnessUpto: fetchedData.fitnessUpto || undefined,
        insuranceCompany: fetchedData.insuranceCompany || undefined,
        insuranceUpto: fetchedData.insuranceUpto || undefined,
        financier: fetchedData.financier || undefined,
        rtoName: rtoInfo.rtoName,
        sourceProvider: this.name,
        fetchedAt: new Date().toISOString(),
      };

      return this.createSuccessResult(result, startTime);
    } catch (err: any) {
      return this.createErrorResult(err.message || 'Masked RC lookup failed', startTime);
    }
  }
}
