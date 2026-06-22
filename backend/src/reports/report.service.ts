import prisma from '../common/prisma';
import { differenceInDays } from 'date-fns';

export const getDashboardStatsService = async (tenantId: string, startDate?: Date, endDate?: Date) => {
  const now = new Date();

  if (startDate && endDate) {
    const [
      totalVehicles,
      kachhaCount,
      pakkaCount,
      releasedPeriod,
      pendingReleases,
      bankStatsRaw,
      revenuePeriodAgg,
      revenuePeriodCount,
      kachhaInPeriod,
    ] = await Promise.all([
      // Active vehicles inside yard at any point (or entered in this period)
      prisma.vehicle.count({ where: { tenantId, entryDate: { lte: endDate }, OR: [{ yardStatus: { in: ['KACHHA', 'PAKKA'] } }, { yardStatus: 'RELEASED', release: { releasedAt: { gte: startDate } } }] } }),
      // Kachha count
      prisma.vehicle.count({ where: { tenantId, yardStatus: 'KACHHA', entryDate: { lte: endDate } } }),
      // Pakka count
      prisma.vehicle.count({ where: { tenantId, yardStatus: 'PAKKA', entryDate: { lte: endDate } } }),
      // Released in period
      prisma.vehicle.count({ where: { tenantId, yardStatus: 'RELEASED', release: { releasedAt: { gte: startDate, lte: endDate } } } }),
      // Pending releases
      prisma.release.count({ where: { tenantId, releaseStatus: { in: ['REQUESTED', 'APPROVED', 'PAYMENT_VERIFIED', 'GATE_PASS_ISSUED'] } } }),
      // Bank-wise count aggregation
      prisma.vehicle.groupBy({
        by: ['bankName'],
        where: { tenantId },
        _count: { bankName: true }
      }),
      // Revenue in period
      prisma.parkingBilling.aggregate({
        where: {
          tenantId,
          vehicle: {
            yardStatus: 'RELEASED',
            release: { releasedAt: { gte: startDate, lte: endDate } }
          }
        },
        _sum: { paidAmount: true }
      }),
      // Revenue count in period
      prisma.vehicle.count({
        where: {
          tenantId,
          yardStatus: 'RELEASED',
          release: { releasedAt: { gte: startDate, lte: endDate } },
          billing: { paidAmount: { gt: 0 } }
        }
      }),
      // Kachha in period
      prisma.vehicle.findMany({
        where: {
          tenantId,
          entryDate: { lte: endDate },
          OR: [
            { yardStatus: 'KACHHA' },
            {
              yardStatus: 'RELEASED',
              release: { releasedAt: { gte: startDate } }
            }
          ]
        },
        include: { billing: true, release: true }
      })
    ]);

    const revenuePeriod = revenuePeriodAgg._sum.paidAmount || 0;
    
    // Dynamic accrued loss during custom period
    let lossPeriod = 0;
    for (const v of kachhaInPeriod) {
      const dailyRate = v.billing?.dailyRate || 100.0;
      
      const entryDate = new Date(v.entryDate);
      const exitDate = v.yardStatus === 'RELEASED' && v.release?.releasedAt 
        ? new Date(v.release.releasedAt)
        : now;

      const lossStart = entryDate > startDate ? entryDate : startDate;
      const lossEnd = exitDate < endDate ? exitDate : endDate;

      if (lossStart <= lossEnd) {
        const diffTime = lossEnd.getTime() - lossStart.getTime();
        let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays < 1) diffDays = 1;
        lossPeriod += diffDays * dailyRate;
      }
    }

    const bankStats = bankStatsRaw.map(s => ({
      bank: s.bankName,
      count: s._count.bankName
    }));

    // Recent entries
    const recentEntries = await prisma.vehicle.findMany({
      where: { tenantId },
      orderBy: { entryDate: 'desc' },
      take: 5,
      include: { yardLocation: true },
    });

    // Recent releases
    const recentReleases = await prisma.release.findMany({
      where: { tenantId, releaseStatus: 'RELEASED' },
      orderBy: { releasedAt: 'desc' },
      take: 5,
      include: { vehicle: true },
    });

    return {
      stats: {
        totalVehicles,
        kachhaVehicles: {
          thisMonth: kachhaCount,
          total: kachhaCount,
        },
        pakkaVehicles: {
          thisMonth: pakkaCount,
          total: pakkaCount,
        },
        releasedVehicles: {
          today: releasedPeriod,
          thisMonth: releasedPeriod,
          thisYear: releasedPeriod,
        },
        pendingReleases,
        dailyRevenue: {
          today: { amount: revenuePeriod, count: revenuePeriodCount },
          thisMonth: { amount: revenuePeriod, count: revenuePeriodCount },
          thisYear: { amount: revenuePeriod, count: revenuePeriodCount },
        },
        dailyLoss: {
          today: { amount: lossPeriod, count: kachhaCount },
          thisMonth: { amount: lossPeriod, count: kachhaCount },
          thisYear: { amount: lossPeriod, count: kachhaCount },
        },
        isCustomRange: true,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      },
      bankStats,
      recentEntries,
      recentReleases,
    };
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startOfYear = new Date();
  startOfYear.setMonth(0, 1);
  startOfYear.setHours(0, 0, 0, 0);

  const [
    totalVehicles,
    kachhaCount,
    pakkaCount,
    releasedToday,
    releasedThisMonth,
    releasedThisYear,
    pendingReleases,
    bankStatsRaw,
    activeDailyRateAgg,
    dailyLossAgg,
    pakkaThisMonth,
    kachhaThisMonth,
    revenueTodayPaidAgg,
    revenueThisMonthAgg,
    revenueThisYearAgg,
    revenueTodayPaidCount,
    revenueThisMonthCount,
    revenueThisYearCount,
    activeKachha,
  ] = await Promise.all([
    // Active vehicles inside yard
    prisma.vehicle.count({ where: { tenantId, yardStatus: { in: ['KACHHA', 'PAKKA'] } } }),
    // Kachha vehicles count
    prisma.vehicle.count({ where: { tenantId, yardStatus: 'KACHHA' } }),
    // Pakka vehicles count
    prisma.vehicle.count({ where: { tenantId, yardStatus: 'PAKKA' } }),
    // Released vehicles today
    prisma.vehicle.count({ where: { tenantId, yardStatus: 'RELEASED', release: { releasedAt: { gte: startOfToday } } } }),
    // Released vehicles this month
    prisma.vehicle.count({ where: { tenantId, yardStatus: 'RELEASED', release: { releasedAt: { gte: startOfMonth } } } }),
    // Released vehicles this year
    prisma.vehicle.count({ where: { tenantId, yardStatus: 'RELEASED', release: { releasedAt: { gte: startOfYear } } } }),
    // Pending release requests
    prisma.release.count({ where: { tenantId, releaseStatus: { in: ['REQUESTED', 'APPROVED', 'PAYMENT_VERIFIED', 'GATE_PASS_ISSUED'] } } }),
    // Bank-wise count aggregation
    prisma.vehicle.groupBy({
      by: ['bankName'],
      where: { tenantId },
      _count: { bankName: true }
    }),
    // Actual Daily Revenue Accrual from Active Stock in Yard
    prisma.parkingBilling.aggregate({
      where: { tenantId, vehicle: { yardStatus: { in: ['KACHHA', 'PAKKA'] } } },
      _sum: { dailyRate: true }
    }),
    // Daily Loss Aggregation (KACHHA vehicles)
    prisma.parkingBilling.aggregate({
      where: { tenantId, vehicle: { yardStatus: 'KACHHA' } },
      _sum: { dailyRate: true }
    }),
    // Pakka vehicles count this month
    prisma.vehicle.count({ where: { tenantId, yardStatus: 'PAKKA', entryDate: { gte: startOfMonth } } }),
    // Kachha vehicles count this month
    prisma.vehicle.count({ where: { tenantId, yardStatus: 'KACHHA', entryDate: { gte: startOfMonth } } }),
    // Revenue collected today (paidAmount of vehicles released today)
    prisma.parkingBilling.aggregate({
      where: {
        tenantId,
        vehicle: {
          yardStatus: 'RELEASED',
          release: { releasedAt: { gte: startOfToday } }
        }
      },
      _sum: { paidAmount: true }
    }),
    // Revenue collected this month (paidAmount of vehicles released this month)
    prisma.parkingBilling.aggregate({
      where: {
        tenantId,
        vehicle: {
          yardStatus: 'RELEASED',
          release: { releasedAt: { gte: startOfMonth } }
        }
      },
      _sum: { paidAmount: true }
    }),
    // Revenue collected this year (paidAmount of vehicles released this year)
    prisma.parkingBilling.aggregate({
      where: {
        tenantId,
        vehicle: {
          yardStatus: 'RELEASED',
          release: { releasedAt: { gte: startOfYear } }
        }
      },
      _sum: { paidAmount: true }
    }),
    // Count of vehicles released today with paid amount > 0
    prisma.vehicle.count({
      where: {
        tenantId,
        yardStatus: 'RELEASED',
        release: { releasedAt: { gte: startOfToday } },
        billing: { paidAmount: { gt: 0 } }
      }
    }),
    // Count of vehicles released this month with paid amount > 0
    prisma.vehicle.count({
      where: {
        tenantId,
        yardStatus: 'RELEASED',
        release: { releasedAt: { gte: startOfMonth } },
        billing: { paidAmount: { gt: 0 } }
      }
    }),
    // Count of vehicles released this year with paid amount > 0
    prisma.vehicle.count({
      where: {
        tenantId,
        yardStatus: 'RELEASED',
        release: { releasedAt: { gte: startOfYear } },
        billing: { paidAmount: { gt: 0 } }
      }
    }),
    // Active KACHHA vehicles to compute accrued losses
    prisma.vehicle.findMany({
      where: { tenantId, yardStatus: 'KACHHA' },
      include: { billing: true }
    })
  ]);

  const dailyRevenueToday = activeDailyRateAgg._sum.dailyRate || 0;
  const dailyLossToday = dailyLossAgg._sum.dailyRate || 0;

  const dailyRevenueThisMonth = revenueThisMonthAgg._sum.paidAmount || 0;
  const dailyRevenueThisYear = revenueThisYearAgg._sum.paidAmount || 0;

  // Calculate dynamic accrued loss for currently active KACHHA vehicles
  let dailyLossThisMonth = 0;
  let dailyLossThisYear = 0;

  for (const v of activeKachha) {
    const dailyRate = v.billing?.dailyRate || 100.0;

    // For This Month: loss since vehicle entered OR start of month
    const startOfLossMonth = v.entryDate > startOfMonth ? v.entryDate : startOfMonth;
    const diffTimeMonth = now.getTime() - startOfLossMonth.getTime();
    let diffDaysMonth = Math.floor(diffTimeMonth / (1000 * 60 * 60 * 24)) + 1;
    if (diffDaysMonth < 1) diffDaysMonth = 1;
    dailyLossThisMonth += diffDaysMonth * dailyRate;

    // For This Year: loss since vehicle entered OR start of year
    const startOfLossYear = v.entryDate > startOfYear ? v.entryDate : startOfYear;
    const diffTimeYear = now.getTime() - startOfLossYear.getTime();
    let diffDaysYear = Math.floor(diffTimeYear / (1000 * 60 * 60 * 24)) + 1;
    if (diffDaysYear < 1) diffDaysYear = 1;
    dailyLossThisYear += diffDaysYear * dailyRate;
  }

  const bankStats = bankStatsRaw.map(s => ({
    bank: s.bankName,
    count: s._count.bankName
  }));

  // Recent entries
  const recentEntries = await prisma.vehicle.findMany({
    where: { tenantId },
    orderBy: { entryDate: 'desc' },
    take: 5,
    include: { yardLocation: true },
  });

  // Recent releases
  const recentReleases = await prisma.release.findMany({
    where: { tenantId, releaseStatus: 'RELEASED' },
    orderBy: { releasedAt: 'desc' },
    take: 5,
    include: { vehicle: true },
  });

  return {
    stats: {
      totalVehicles,
      kachhaVehicles: {
        thisMonth: kachhaThisMonth,
        total: kachhaCount,
      },
      pakkaVehicles: {
        thisMonth: pakkaThisMonth,
        total: pakkaCount,
      },
      releasedVehicles: {
        today: releasedToday,
        thisMonth: releasedThisMonth,
        thisYear: releasedThisYear,
      },
      pendingReleases,
      dailyRevenue: {
        today: { amount: dailyRevenueToday, count: totalVehicles },
        thisMonth: { amount: dailyRevenueThisMonth, count: revenueThisMonthCount },
        thisYear: { amount: dailyRevenueThisYear, count: revenueThisYearCount },
      },
      dailyLoss: {
        today: { amount: dailyLossToday, count: kachhaCount },
        thisMonth: { amount: dailyLossThisMonth, count: kachhaCount },
        thisYear: { amount: dailyLossThisYear, count: kachhaCount },
      },
    },
    bankStats,
    recentEntries,
    recentReleases,
  };
};

export const getKachhaAgingReportService = async (tenantId: string) => {
  const kachhaVehicles = await prisma.vehicle.findMany({
    where: { tenantId, yardStatus: 'KACHHA' },
    include: { billing: true, enteredBy: { select: { name: true } } },
    orderBy: { entryDate: 'asc' }, // oldest first
  });

  return kachhaVehicles.map(v => {
    const daysInYard = differenceInDays(new Date(), new Date(v.entryDate)) + 1;
    return {
      id: v.id,
      vehicleNumber: v.vehicleNumber,
      brand: v.brand,
      model: v.model,
      bankName: v.bankName,
      repoAgency: v.repoAgency,
      entryDate: v.entryDate,
      daysInYard,
      estimatedLoss: daysInYard * (v.billing?.dailyRate || 100.0),
    };
  });
};

export const getRevenueReportService = async (tenantId: string) => {
  return prisma.parkingBilling.findMany({
    where: { tenantId, paidAmount: { gt: 0 } },
    include: { vehicle: { select: { vehicleNumber: true, bankName: true, entryDate: true } } },
    orderBy: { updatedAt: 'desc' },
  });
};

export const getSuperAdminDashboardStatsService = async () => {
  const [
    totalTenants,
    activeTenants,
    suspendedTenants,
    totalVehicles,
    kachhaCount,
    pakkaCount,
    releasedCount,
    totalUsers,
    totalStorageAgg,
    billingRevenueAgg,
    planDistributionRaw,
    recentYards,
    recentActivityLogs,
  ] = await Promise.all([
    // 1. Total Tenants
    prisma.tenant.count(),
    // 2. Active Tenants
    prisma.tenant.count({ where: { status: 'ACTIVE' } }),
    // 3. Suspended Tenants
    prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
    // 4. Total Active Vehicles (Kachha + Pakka) across all tenants
    prisma.vehicle.count({ where: { yardStatus: { in: ['KACHHA', 'PAKKA'] } } }),
    // 5. Kachha count
    prisma.vehicle.count({ where: { yardStatus: 'KACHHA' } }),
    // 6. Pakka count
    prisma.vehicle.count({ where: { yardStatus: 'PAKKA' } }),
    // 7. Released count
    prisma.vehicle.count({ where: { yardStatus: 'RELEASED' } }),
    // 8. Total Registered Users
    prisma.user.count(),
    // 9. Total Storage Allocated (MB)
    prisma.tenant.aggregate({
      _sum: { storageLimit: true }
    }),
    // 10. Overall Platform Parking revenue collected (INR)
    prisma.parkingBilling.aggregate({
      _sum: { paidAmount: true }
    }),
    // 11. Subscription Plan Breakdown
    prisma.tenant.groupBy({
      by: ['planName'],
      _count: { planName: true }
    }),
    // 12. Latest 5 provisioned yards
    prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    }),
    // 13. System-wide Audit Log stream
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        tenant: { select: { yardName: true } },
        user: { select: { name: true } }
      }
    })
  ]);

  const planDistribution = planDistributionRaw.map(p => ({
    planName: p.planName,
    count: p._count.planName
  }));

  const globalRevenue = billingRevenueAgg._sum.paidAmount || 0;
  const globalStorage = totalStorageAgg._sum.storageLimit || 0;

  // Calculate dynamic 6 months growth trajectory of check-ins
  const last6Months = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return {
      start: new Date(d.getFullYear(), d.getMonth(), 1),
      end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999),
      label: d.toLocaleString('en-US', { month: 'short' }),
    };
  }).reverse();

  const growthTrajectory = await Promise.all(
    last6Months.map(async (m) => {
      const count = await prisma.vehicle.count({
        where: {
          entryDate: {
            gte: m.start,
            lte: m.end
          }
        }
      });
      return {
        label: m.label,
        count
      };
    })
  );

  return {
    overview: {
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalVehicles,
      kachhaCount,
      pakkaCount,
      releasedCount,
      totalUsers,
      globalRevenue,
      globalStorage
    },
    planDistribution,
    recentYards,
    recentActivityLogs,
    growthTrajectory
  };
};

export const getDashboardVehiclesService = async (
  tenantId: string,
  status: 'KACHHA' | 'PAKKA' | 'RELEASED' | 'REVENUE' | 'LOSS',
  timeframe: 'today' | 'this_month' | 'this_year' | 'all' | 'custom',
  startDate?: Date,
  endDate?: Date
) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startOfYear = new Date();
  startOfYear.setMonth(0, 1);
  startOfYear.setHours(0, 0, 0, 0);

  let dateGte: Date | null = null;
  let dateLte: Date | null = null;

  if (timeframe === 'today') {
    dateGte = startOfToday;
  } else if (timeframe === 'this_month') {
    dateGte = startOfMonth;
  } else if (timeframe === 'this_year') {
    dateGte = startOfYear;
  } else if (timeframe === 'custom' && startDate && endDate) {
    dateGte = startDate;
    dateLte = endDate;
  }

  if (status === 'RELEASED') {
    const whereClause: any = {
      tenantId,
      yardStatus: 'RELEASED',
    };
    if (dateGte || dateLte) {
      const releaseFilter: any = {};
      if (dateGte) releaseFilter.gte = dateGte;
      if (dateLte) releaseFilter.lte = dateLte;
      whereClause.release = {
        releasedAt: releaseFilter,
      };
    }
    return prisma.vehicle.findMany({
      where: whereClause,
      include: {
        yardLocation: true,
        billing: true,
        release: true,
      },
      orderBy: {
        release: { releasedAt: 'desc' },
      },
    });
  }

  if (status === 'REVENUE') {
    const whereClause: any = {
      tenantId,
      yardStatus: 'RELEASED',
      billing: { paidAmount: { gt: 0 } },
    };
    if (dateGte || dateLte) {
      const releaseFilter: any = {};
      if (dateGte) releaseFilter.gte = dateGte;
      if (dateLte) releaseFilter.lte = dateLte;
      whereClause.release = {
        releasedAt: releaseFilter,
      };
    }
    return prisma.vehicle.findMany({
      where: whereClause,
      include: {
        yardLocation: true,
        billing: true,
        release: true,
      },
      orderBy: {
        release: { releasedAt: 'desc' },
      },
    });
  }

  if (status === 'LOSS') {
    // Loss is contributed by active KACHHA vehicles in the yard
    const whereClause: any = {
      tenantId,
      yardStatus: 'KACHHA',
    };
    if (dateGte || dateLte) {
      const entryFilter: any = {};
      if (dateGte) entryFilter.gte = dateGte;
      if (dateLte) entryFilter.lte = dateLte;
      whereClause.entryDate = entryFilter;
    }
    return prisma.vehicle.findMany({
      where: whereClause,
      include: {
        yardLocation: true,
        billing: true,
      },
      orderBy: {
        entryDate: 'asc', // oldest first
      },
    });
  }

  // Fallback for standard KACHHA / PAKKA counts
  const whereClause: any = {
    tenantId,
    yardStatus: status as 'KACHHA' | 'PAKKA',
  };

  if (dateGte || dateLte) {
    const entryFilter: any = {};
    if (dateGte) entryFilter.gte = dateGte;
    if (dateLte) entryFilter.lte = dateLte;
    whereClause.entryDate = entryFilter;
  }

  return prisma.vehicle.findMany({
    where: whereClause,
    include: {
      yardLocation: true,
      billing: true,
    },
    orderBy: {
      entryDate: 'desc',
    },
  });
};

export const getProfitLossStatsService = async (tenantId: string) => {
  const releasedBillings = await prisma.parkingBilling.findMany({
    where: { tenantId, vehicle: { yardStatus: 'RELEASED' } },
    include: {
      vehicle: {
        include: {
          release: true
        }
      }
    }
  });

  let totalAccruedPakka = 0;
  let totalSettledPakka = 0;
  let outstandingReceivable = 0;
  let reconciliationLoss = 0;
  let kachhaRevenueRealized = 0;

  const bankReceivablesMap: Record<string, number> = {};

  for (const b of releasedBillings) {
    const isPakka = b.vehicle?.release?.releaseType === 'PAKKA';
    const isKachha = b.vehicle?.release?.releaseType === 'KACHHA';

    if (isKachha) {
      kachhaRevenueRealized += b.paidAmount;
    } else if (isPakka) {
      totalAccruedPakka += b.totalAmount;
      totalSettledPakka += b.paidAmount;

      if (b.paymentStatus === 'PAID') {
        if (b.paidAmount < b.totalAmount) {
          reconciliationLoss += (b.totalAmount - b.paidAmount);
        }
      } else {
        const outstanding = b.totalAmount - b.paidAmount;
        if (outstanding > 0) {
          outstandingReceivable += outstanding;
          const bankName = b.vehicle.bankName || 'Unknown Bank';
          bankReceivablesMap[bankName] = (bankReceivablesMap[bankName] || 0) + outstanding;
        }
      }
    }
  }

  const activeKachha = await prisma.vehicle.findMany({
    where: { tenantId, yardStatus: 'KACHHA' },
    include: { billing: true }
  });

  const now = new Date();
  let kachhaRunningOpportunityLoss = 0;
  for (const v of activeKachha) {
    const dailyRate = v.billing?.dailyRate || 100.0;
    const diffTime = now.getTime() - new Date(v.entryDate).getTime();
    let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays < 1) diffDays = 1;
    kachhaRunningOpportunityLoss += diffDays * dailyRate;
  }

  const bankReceivablesBreakdown = Object.entries(bankReceivablesMap).map(([bank, amount]) => ({
    bank,
    amount
  })).sort((a, b) => b.amount - a.amount);

  return {
    totalAccruedPakka,
    totalSettledPakka,
    outstandingReceivable,
    reconciliationLoss,
    kachhaRevenueRealized,
    kachhaRunningOpportunityLoss,
    bankReceivablesBreakdown
  };
};

export const getPendingSettlementsService = async (tenantId: string, search?: string) => {
  const whereClause: any = {
    tenantId,
    paymentStatus: { in: ['PENDING', 'PARTIAL'] },
    vehicle: {
      yardStatus: 'RELEASED',
      release: {
        releaseType: 'PAKKA'
      }
    }
  };

  if (search) {
    whereClause.vehicle.OR = [
      { vehicleNumber: { contains: search, mode: 'insensitive' } },
      { chassisNumber: { contains: search, mode: 'insensitive' } },
      { bankName: { contains: search, mode: 'insensitive' } },
      { brand: { contains: search, mode: 'insensitive' } }
    ];
  }

  return prisma.parkingBilling.findMany({
    where: whereClause,
    include: {
      vehicle: {
        include: {
          release: true
        }
      }
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });
};

export const getFinanceLedgerService = async (tenantId: string) => {
  return prisma.vehicle.findMany({
    where: { tenantId },
    include: {
      billing: true,
      release: true
    },
    orderBy: {
      entryDate: 'desc'
    }
  });
};


