import { Request, Response } from 'express';
import prisma from '../common/prisma';

// Default master inventory checklist template
export const DEFAULT_INVENTORY_TEMPLATE = [
  {
    id: 'inv_1',
    itemName: 'RC-Original',
    category: 'Documents & Keys',
    inputType: 'boolean', // 'boolean' | 'text' | 'condition' | 'number'
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 1,
  },
  {
    id: 'inv_2',
    itemName: 'Keys',
    category: 'Documents & Keys',
    inputType: 'boolean',
    isRequired: true,
    enabled: true,
    printEnabled: true,
    order: 2,
  },
  {
    id: 'inv_3',
    itemName: 'Insurance Certificate',
    category: 'Documents & Keys',
    inputType: 'boolean',
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 3,
  },
  {
    id: 'inv_4',
    itemName: 'Battery',
    category: 'Electrical & Battery',
    inputType: 'text', // Battery make / number
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 4,
  },
  {
    id: 'inv_5',
    itemName: 'Horn',
    category: 'Electrical & Battery',
    inputType: 'boolean',
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 5,
  },
  {
    id: 'inv_6',
    itemName: 'Front Light',
    category: 'Electrical & Battery',
    inputType: 'boolean',
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 6,
  },
  {
    id: 'inv_7',
    itemName: 'Back Light',
    category: 'Electrical & Battery',
    inputType: 'boolean',
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 7,
  },
  {
    id: 'inv_8',
    itemName: 'Indicator Lights',
    category: 'Electrical & Battery',
    inputType: 'boolean',
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 8,
  },
  {
    id: 'inv_9',
    itemName: 'Front Tyre',
    category: 'Tyres & Wheels',
    inputType: 'text', // Tyre make
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 9,
  },
  {
    id: 'inv_10',
    itemName: 'Back Tyre',
    category: 'Tyres & Wheels',
    inputType: 'text', // Tyre make
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 10,
  },
  {
    id: 'inv_11',
    itemName: 'Spare Tyre',
    category: 'Tyres & Wheels',
    inputType: 'text',
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 11,
  },
  {
    id: 'inv_12',
    itemName: 'Side Mirror (Left)',
    category: 'Body & Mirrors',
    inputType: 'boolean',
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 12,
  },
  {
    id: 'inv_13',
    itemName: 'Side Mirror (Right)',
    category: 'Body & Mirrors',
    inputType: 'boolean',
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 13,
  },
  {
    id: 'inv_14',
    itemName: 'Body Condition',
    category: 'Condition & Assessment',
    inputType: 'condition', // Good / Average / Bad
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 14,
  },
  {
    id: 'inv_15',
    itemName: 'Tool Kit & Jack',
    category: 'Tools & Accessories',
    inputType: 'boolean',
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 15,
  },
  {
    id: 'inv_16',
    itemName: 'Music System',
    category: 'Tools & Accessories',
    inputType: 'boolean',
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 16,
  },
  {
    id: 'inv_17',
    itemName: 'Meter Running Condition',
    category: 'Condition & Assessment',
    inputType: 'boolean',
    isRequired: false,
    enabled: true,
    printEnabled: true,
    order: 17,
  },
];

// In-memory tenant store as fallback if not migrated
const tenantInventoryStore: Record<string, any[]> = {};

/**
 * Get tenant inventory customization configuration
 */
export const getInventoryConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenantId || 'default';
    
    // Check if custom config exists for tenant
    const config = tenantInventoryStore[tenantId] || DEFAULT_INVENTORY_TEMPLATE;

    res.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch inventory configuration',
    });
  }
};

/**
 * Update tenant inventory customization configuration
 */
export const updateInventoryConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req as any).user?.tenantId || 'default';
    const { items } = req.body;

    if (!Array.isArray(items)) {
      res.status(400).json({
        success: false,
        message: 'Invalid inventory configuration items array',
      });
      return;
    }

    tenantInventoryStore[tenantId] = items;

    res.json({
      success: true,
      message: 'Inventory customization saved successfully',
      data: items,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update inventory configuration',
    });
  }
};
