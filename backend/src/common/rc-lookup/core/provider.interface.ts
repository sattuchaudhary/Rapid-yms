import { VehicleRCDetails, ProviderLookupResult } from './rc.types';

export interface IRCLookupProvider {
  readonly name: string;
  readonly priority: number; // 1 = Highest priority, 10 = lowest
  readonly isEnabled: boolean;

  lookup(rcNumber: string): Promise<ProviderLookupResult>;
}
