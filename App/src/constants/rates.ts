export const DEFAULT_DAILY_RATES: Record<string, number> = {
  TW: 50,
  THREE_W: 100,
  FW: 150,
  CV: 400,
};

export const getParkingDailyRate = (vehicle: any): number => {
  if (vehicle && vehicle.bank && vehicle.bank.parkingRates) {
    const match = vehicle.bank.parkingRates.find((r: any) => r.vehicleType === vehicle.vehicleType);
    if (match) return match.dailyRate;
  }
  const type = vehicle?.vehicleType || 'FW';
  return DEFAULT_DAILY_RATES[type] ?? DEFAULT_DAILY_RATES.FW;
};
