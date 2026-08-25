import { BaseRCLookupProvider } from './base.provider';
import { ProviderLookupResult, VehicleRCDetails } from '../core/rc.types';

/**
 * Official Government ULIP (Unified Logistics Interface Platform) Provider
 * When credentials (ULIP_CLIENT_ID, ULIP_CLIENT_SECRET) are added to .env,
 * this provider becomes active with highest priority (Priority 0).
 */
export class ULIPOfficialProvider extends BaseRCLookupProvider {
  readonly name = 'ulip-official-provider';
  readonly priority = 0; // Highest priority when enabled

  get isEnabled(): boolean {
    return Boolean(process.env.ULIP_CLIENT_ID && process.env.ULIP_CLIENT_SECRET);
  }

  private token: string | null = null;
  private tokenExpiresAt: number = 0;

  private async getAuthToken(): Promise<string | null> {
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    try {
      const authUrl = process.env.ULIP_AUTH_URL || 'https://www.goulip.in/api/v1/user/login';
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: process.env.ULIP_CLIENT_ID,
          password: process.env.ULIP_CLIENT_SECRET,
        }),
      });

      if (response.ok) {
        const body: any = await response.json();
        if (body?.response?.id) {
          this.token = body.response.id;
          this.tokenExpiresAt = Date.now() + 3600 * 1000; // 1 hour
          return this.token;
        }
      }
    } catch {
      // Auth failed
    }
    return null;
  }

  async lookup(rcNumber: string): Promise<ProviderLookupResult> {
    const startTime = Date.now();
    if (!this.isEnabled) {
      return this.createErrorResult('ULIP credentials not configured in environment', startTime);
    }

    try {
      const token = await this.getAuthToken();
      if (!token) {
        return this.createErrorResult('ULIP authentication failed', startTime);
      }

      const vahanUrl = process.env.ULIP_VAHAN_URL || 'https://www.goulip.in/api/v1/vahan/search';
      const response = await fetch(vahanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ vehiclenumber: rcNumber.toUpperCase().trim() }),
      });

      if (response.ok) {
        const body: any = await response.json();
        const res = body?.response?.vehicle;
        if (res) {
          const details: VehicleRCDetails = {
            rcNumber: rcNumber.toUpperCase(),
            ownerName: res.rc_owner_name,
            fatherName: res.rc_f_name,
            make: res.rc_maker_desc,
            model: res.rc_maker_model,
            vehicleClass: res.rc_vh_class_desc,
            fuelType: res.rc_fuel_desc,
            engineNumber: res.rc_eng_no,
            chassisNumber: res.rc_chasi_no,
            registrationDate: res.rc_regn_dt,
            fitnessUpto: res.rc_fit_upto,
            insuranceCompany: res.rc_insurance_comp,
            insurancePolicyNumber: res.rc_insurance_policy_no,
            insuranceUpto: res.rc_insurance_upto,
            financier: res.rc_financer,
            puccUpto: res.rc_pucc_upto,
            rtoName: res.rc_registered_at,
            sourceProvider: this.name,
            fetchedAt: new Date().toISOString(),
          };
          return this.createSuccessResult(details, startTime);
        }
      }

      return this.createErrorResult('ULIP vehicle search returned no match', startTime);
    } catch (err: any) {
      return this.createErrorResult(err.message || 'ULIP lookup failed', startTime);
    }
  }
}
