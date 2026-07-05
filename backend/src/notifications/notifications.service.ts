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
      } else if (log.action === 'deleted') {
        title = 'Vehicle Record Deleted';
        message = `Vehicle ${details.vehicleNumber || ''} has been deleted from stock by ${userName}.`;
      } else if (log.action === 'updated') {
        if (details.changes?.yardStatus === 'PAKKA') {
          title = 'Confirmed to Pakka';
          message = `Vehicle ${details.vehicleNumber || ''} has been transitioned from Kachha to Pakka by ${userName}.`;
        } else {
          title = 'Vehicle Details Edited';
          message = `Vehicle ${details.vehicleNumber || ''} details were modified by ${userName}.`;
        }
      } else {
        title = 'Vehicle Log Modified';
        message = `Vehicle details action [${log.action}] was executed by ${userName}.`;
      }
    } else if (log.module === 'release') {
      type = 'ACTIVITY';
      if (log.action === 'requested') {
        title = 'Release Requested';
        message = `Release request submitted for vehicle ${details.vehicleNumber || 'ID ' + String(details.vehicleId).substring(0, 6)} by ${userName} (${details.releaseType || 'N/A'}).`;
      } else if (log.action === 'approved') {
        title = 'Release Approved';
        message = `Release request approved for vehicle ${details.vehicleNumber || 'ID ' + String(details.vehicleId).substring(0, 6)} by ${userName}.`;
      } else if (log.action === 'payment_verified') {
        title = 'Payment Verified';
        message = `Release payment verified for vehicle ${details.vehicleNumber || 'ID ' + String(details.vehicleId).substring(0, 6)} by ${userName}.`;
      } else if (log.action === 'gate_pass_issued') {
        title = 'Gate Pass Issued';
        message = `Gate pass ${details.gatePassNumber || 'N/A'} issued for vehicle ${details.vehicleNumber || 'ID ' + String(details.vehicleId).substring(0, 6)} by ${userName}.`;
      } else if (log.action === 'completed') {
        title = 'Vehicle Released (Gate Exit)';
        message = `Vehicle ${details.vehicleNumber || 'ID ' + String(details.vehicleId).substring(0, 6)} released by ${userName}. Gate Pass: ${details.gatePass || 'N/A'}.`;
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
