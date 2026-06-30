import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BluetoothDevice {
  name: string;
  address: string;
  connected: boolean;
}

const PRINTER_STORE_KEY = 'yms_selected_printer';

class BluetoothPrintService {
  private activePrinter: BluetoothDevice | null = null;
  private listeners = new Set<(device: BluetoothDevice | null) => void>();

  constructor() {
    this.loadSavedPrinter();
  }

  private async loadSavedPrinter() {
    try {
      const data = await AsyncStorage.getItem(PRINTER_STORE_KEY);
      if (data) {
        this.activePrinter = JSON.parse(data);
        this.notifyListeners();
      }
    } catch (e) {
      console.warn('[Bluetooth] Error loading saved printer:', e);
    }
  }

  public registerPrinterListener(callback: (device: BluetoothDevice | null) => void) {
    this.listeners.add(callback);
    callback(this.activePrinter);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l(this.activePrinter));
  }

  public async scanPrinters(): Promise<BluetoothDevice[]> {
    console.log('[Bluetooth] Scanning for Bluetooth printers...');
    // Simulate scan delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return [
      { name: 'Yard Thermal POS-58', address: '00:11:22:33:AA:BB', connected: false },
      { name: 'TSC Alpha-3R Mobile', address: '88:0F:10:BC:54:19', connected: false },
      { name: 'Bixolon SPP-R310', address: '33:77:AA:EE:22:FF', connected: false },
    ];
  }

  public async connectPrinter(device: BluetoothDevice): Promise<boolean> {
    console.log(`[Bluetooth] Connecting to printer ${device.name} (${device.address})...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    this.activePrinter = { ...device, connected: true };
    await AsyncStorage.setItem(PRINTER_STORE_KEY, JSON.stringify(this.activePrinter));
    this.notifyListeners();
    console.log('[Bluetooth] Connected successfully');
    return true;
  }

  public async disconnectPrinter() {
    this.activePrinter = null;
    await AsyncStorage.removeItem(PRINTER_STORE_KEY);
    this.notifyListeners();
    console.log('[Bluetooth] Printer disconnected');
  }

  public getConnectedPrinter(): BluetoothDevice | null {
    return this.activePrinter;
  }

  // Generates a mock printable string block simulating thermal ticket receipt
  public generateGatePassReceipt(vehicle: {
    vehicleNumber: string;
    brand?: string;
    model?: string;
    vehicleType: string;
    entryDate?: string;
    yardLocation?: string;
    gatePassNumber?: string;
  }): string {
    const divider = '================================';
    const dateStr = vehicle.entryDate 
      ? new Date(vehicle.entryDate).toLocaleString() 
      : new Date().toLocaleString();

    return `
+--------------------------------+
|    ENTERPRISE YARD SYSTEMS     |
|      GATE ENTRY PASS           |
+--------------------------------+
Date: ${dateStr.padEnd(26)}
Pass ID: ${(vehicle.gatePassNumber || 'GP-MOCK-' + Math.floor(1000 + Math.random() * 9000)).padEnd(23)}
${divider}
VEHICLE DETAIL:
Plate No  : ${vehicle.vehicleNumber.toUpperCase()}
Class     : ${vehicle.vehicleType}
Maker/Mfg : ${(vehicle.brand || 'N/A')} ${(vehicle.model || '')}
${divider}
PARKING LOCATION:
Zone-Slot : ${(vehicle.yardLocation || 'A-ZONE (TEMPORARY)')}
${divider}
RULES & REGULATIONS:
- Keep pass safe until checkout.
- Not responsible for private belongings.
- Penalty rate applicable after free slab.
${divider}
   [ QR CODE: SCAN TO CHECKOUT ]
       .---.   .---.   .---.
       | K |   | R |   | C |
       '---'   '---'   '---'
${divider}
          THANK YOU!
`;
  }

  public async printReceipt(receiptText: string): Promise<boolean> {
    if (!this.activePrinter) {
      console.warn('[Bluetooth] Printing failed: No printer connected');
      throw new Error('No printer connected. Please select a bluetooth printer.');
    }
    console.log(`[Bluetooth] PRINTING TO: ${this.activePrinter.name}`);
    console.log(receiptText);
    // Simulate printing delay
    await new Promise((resolve) => setTimeout(resolve, 800));
    return true;
  }
}

export const bluetoothService = new BluetoothPrintService();
export default bluetoothService;
