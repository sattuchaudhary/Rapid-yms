import prisma from '../common/prisma';

export const getNotificationsService = async (tenantId: string) => {
  const logs = await prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      user: {
        select: {
          name: true,
          role: true,
        }
      }
    }
  });

  return logs.map((log) => {
    let type: 'SYNC' | 'HARDWARE' | 'ACTIVITY' | 'SYSTEM' = 'SYSTEM';
    let title = 'System Update';
    let message = 'An action occurred in the system.';

    const userName = log.user?.name || 'System';
    const details = log.details as any || {};

    if (log.module === 'vehicles') {
      type = 'ACTIVITY';
      if (log.action === 'created') {
        title = 'New Vehicle Checked-In';
        message = `Vehicle ${details.vehicleNumber || ''} has been checked in by ${userName}.`;
      } else if (log.action === 'updated') {
        title = 'Vehicle Details Updated';
        message = `Vehicle ${details.vehicleNumber || ''} details were updated by ${userName}.`;
      } else {
        title = 'Vehicle Log Modified';
        message = `Vehicle details action [${log.action}] was executed by ${userName}.`;
      }
    } else if (log.module === 'release') {
      type = 'ACTIVITY';
      if (log.action === 'completed') {
        title = 'Vehicle Released (Gate Exit)';
        message = `Vehicle ${details.vehicleNumber || 'ID ' + String(details.vehicleId).substring(0, 6)} released by ${userName}. Gate Pass: ${details.gatePass || 'N/A'}`;
      } else {
        title = 'Release Action Logged';
        message = `Release action [${log.action}] executed by ${userName}.`;
      }
    } else if (log.module === 'billing') {
      type = 'SYSTEM';
      if (log.action === 'override' || log.action === 'updated') {
        title = 'Billing Waiver Approved';
        message = `Fee waiver override recorded by ${userName} for calculated dues.`;
      } else {
        title = 'Billing Parameters Updated';
        message = `Billing transaction action [${log.action}] executed by ${userName}.`;
      }
    } else if (log.module === 'rates') {
      type = 'SYSTEM';
      title = 'Tariff Rates Refreshed';
      message = `Latest daily parking rates updated by ${userName}.`;
    } else if (log.module === 'sync') {
      type = 'SYNC';
      title = 'Database Cache Synced';
      message = `Offline cache records synced by ${userName}.`;
    }

    return {
      id: log.id,
      type,
      title,
      message,
      time: log.createdAt.toISOString(),
      unread: false,
    };
  });
};
