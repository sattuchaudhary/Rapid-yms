import assert from 'assert';
import { calculateParkingCharges } from './parkingChargeEngine';

function runEngineTests() {
  console.log('=== RUNNING PARKING CHARGE ENGINE SUITE ===');

  // Test Scenario from Prompt Section 37
  {
    const result = calculateParkingCharges({
      kachhaStartDate: '2026-07-10',
      pakkaDate: '2026-07-15',
      releaseOrderDate: '2026-07-20',
      actualReleaseDate: '2026-07-25',
      kachhaParkingRate: 100,
      pakkaParkingRate: 150,
      releaseOrderParkingRate: 200,
      parkingWaiverDays: 2,
      parkingPayer: 'CUSTOMER',
      releasePersonType: 'CUSTOMER',
    });

    assert.strictEqual(result.kachha.days, 5, 'Kachha days must be 5');
    assert.strictEqual(result.kachha.amount, 500, 'Kachha amount must be 500');

    assert.strictEqual(result.pakka.days, 5, 'Pakka days must be 5');
    assert.strictEqual(result.pakka.amount, 750, 'Pakka amount must be 750');

    assert.strictEqual(result.releaseOrder.grossDays, 5, 'RO gross days must be 5');
    assert.strictEqual(result.releaseOrder.waiverDays, 2, 'RO waiver days must be 2');
    assert.strictEqual(result.releaseOrder.chargeableDays, 3, 'RO chargeable days must be 3');
    assert.strictEqual(result.releaseOrder.grossAmount, 1000, 'RO gross amount must be 1000');
    assert.strictEqual(result.releaseOrder.waiverAmount, 400, 'RO waiver amount must be 400');
    assert.strictEqual(result.releaseOrder.netAmount, 600, 'RO net amount must be 600');

    assert.strictEqual(result.totals.totalDays, 15, 'Total days must be 15');
    assert.strictEqual(result.totals.grossAmount, 2250, 'Gross total must be 2250');
    assert.strictEqual(result.totals.waiverAmount, 400, 'Waiver total must be 400');
    assert.strictEqual(result.totals.netAmount, 1850, 'Net total must be 1850');
    assert.strictEqual(result.totals.customerPayable, 1850, 'Customer payable must be 1850');
    assert.strictEqual(result.totals.bankAbsorbed, 0, 'Bank absorbed must be 0');
    assert.strictEqual(result.payer, 'CUSTOMER');
    assert.strictEqual(result.releasePerson, 'CUSTOMER');
    console.log('✔ Section 37 Realistic Scenario PASSED');
  }

  // Case 1: Released while Kachha
  {
    const result = calculateParkingCharges({
      kachhaStartDate: '2026-07-10',
      actualReleaseDate: '2026-07-15',
      kachhaParkingRate: 100,
      pakkaParkingRate: 150,
      releaseOrderParkingRate: 200,
      parkingWaiverDays: 2,
    });

    assert.strictEqual(result.kachha.days, 5);
    assert.strictEqual(result.kachha.amount, 500);
    assert.strictEqual(result.pakka.days, 0);
    assert.strictEqual(result.pakka.amount, 0);
    assert.strictEqual(result.releaseOrder.grossDays, 0);
    assert.strictEqual(result.totals.netAmount, 500);
    console.log('✔ Case 1: Released while Kachha PASSED');
  }

  // Case 2: Released while Pakka
  {
    const result = calculateParkingCharges({
      kachhaStartDate: '2026-07-10',
      pakkaDate: '2026-07-15',
      actualReleaseDate: '2026-07-20',
      kachhaParkingRate: 100,
      pakkaParkingRate: 150,
      releaseOrderParkingRate: 200,
      parkingWaiverDays: 2,
    });

    assert.strictEqual(result.kachha.days, 5);
    assert.strictEqual(result.kachha.amount, 500);
    assert.strictEqual(result.pakka.days, 5);
    assert.strictEqual(result.pakka.amount, 750);
    assert.strictEqual(result.releaseOrder.grossDays, 0);
    assert.strictEqual(result.totals.netAmount, 1250);
    console.log('✔ Case 2: Released while Pakka PASSED');
  }

  // Case 3: Same day transitions
  {
    const result = calculateParkingCharges({
      kachhaStartDate: '2026-07-10',
      pakkaDate: '2026-07-10',
      releaseOrderDate: '2026-07-10',
      actualReleaseDate: '2026-07-10',
      kachhaParkingRate: 100,
      pakkaParkingRate: 150,
      releaseOrderParkingRate: 200,
    });

    assert.strictEqual(result.kachha.days, 0);
    assert.strictEqual(result.pakka.days, 0);
    assert.strictEqual(result.releaseOrder.grossDays, 0);
    assert.strictEqual(result.totals.netAmount, 0);
    console.log('✔ Case 3: Same day transitions PASSED');
  }

  // Case 4: Full waiver covering entire RO period
  {
    const result = calculateParkingCharges({
      releaseOrderDate: '2026-07-20',
      actualReleaseDate: '2026-07-22',
      releaseOrderParkingRate: 200,
      parkingWaiverDays: 5,
    });

    assert.strictEqual(result.releaseOrder.grossDays, 2);
    assert.strictEqual(result.releaseOrder.waiverDays, 2);
    assert.strictEqual(result.releaseOrder.chargeableDays, 0);
    assert.strictEqual(result.releaseOrder.netAmount, 0);
    console.log('✔ Case 4: Full waiver PASSED');
  }

  // Case 5: Live calculation using todayDate
  {
    const result = calculateParkingCharges({
      kachhaStartDate: '2026-07-10',
      todayDate: '2026-07-15',
      kachhaParkingRate: 100,
    });

    assert.strictEqual(result.kachha.days, 5);
    assert.strictEqual(result.kachha.amount, 500);
    assert.strictEqual(result.isFinalSnapshot, false);
    console.log('✔ Case 5: Live calculation PASSED');
  }

  // Case 6: Bank pays parking (in-yard covered by bank, overdue RO days paid by customer)
  {
    const result = calculateParkingCharges({
      kachhaStartDate: '2026-07-01',
      pakkaDate: '2026-07-05',
      releaseOrderDate: '2026-07-10',
      actualReleaseDate: '2026-07-25',
      kachhaParkingRate: 100,
      pakkaParkingRate: 150,
      releaseOrderParkingRate: 200,
      parkingWaiverDays: 2,
      parkingPayer: 'BANK',
      releasePersonType: 'CUSTOMER',
    });

    // RO gross days = 15 (10th to 25th)
    // Waiver days = 2 (10th & 11th waived)
    // Chargeable RO days = 13 days (12th to 25th)
    // RO net amount = 13 * 200 = 2600
    // Bank absorbs: Kachha (4*100=400) + Pakka (5*150=750) + Waiver (2*200=400) = 1550
    assert.strictEqual(result.releaseOrder.grossDays, 15);
    assert.strictEqual(result.releaseOrder.waiverDays, 2);
    assert.strictEqual(result.releaseOrder.chargeableDays, 13);
    assert.strictEqual(result.totals.customerPayable, 2600, 'Customer payable must be 2600 for 13 overdue RO days');
    assert.strictEqual(result.totals.bankAbsorbed, 1550, 'Bank absorbed must cover in-yard + wave-off days');
    assert.strictEqual(result.payer, 'BANK');
    console.log('✔ Case 6: Bank Payer with overdue RO days PASSED');
  }

  // Case 7: Buyer release person selection (Kachha days exempt, starts from Pakka date)
  {
    const result = calculateParkingCharges({
      kachhaStartDate: '2026-07-10',
      pakkaDate: '2026-07-15',
      actualReleaseDate: '2026-07-20',
      kachhaParkingRate: 100,
      pakkaParkingRate: 150,
      releasePersonType: 'BUYER',
    });

    assert.strictEqual(result.releasePerson, 'BUYER');
    assert.strictEqual(result.kachha.days, 0, 'Kachha days must be 0 for Buyer');
    assert.strictEqual(result.kachha.amount, 0, 'Kachha amount must be 0 for Buyer');
    assert.strictEqual(result.pakka.days, 5, 'Pakka days must be 5');
    assert.strictEqual(result.pakka.amount, 750, 'Pakka amount must be 750');
    assert.strictEqual(result.totals.netAmount, 750, 'Total net amount must be 750');
    console.log('✔ Case 7: Buyer release person starting from Pakka date PASSED');
  }

  console.log('ALL ENGINE TESTS PASSED SUCCESSFULLY!');
}

if (require.main === module) {
  runEngineTests();
}

export { runEngineTests };
