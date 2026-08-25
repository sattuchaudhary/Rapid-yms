/**
 * Indian RTO Code Directory
 * Maps State + District codes to RTO Office Name and State.
 */

export interface RTORecord {
  code: string;
  rtoName: string;
  state: string;
}

const RTO_MAP: Record<string, RTORecord> = {
  // Delhi
  'DL01': { code: 'DL01', rtoName: 'Mall Road RTO, North Delhi', state: 'Delhi' },
  'DL02': { code: 'DL02', rtoName: 'IP Depot RTO, New Delhi', state: 'Delhi' },
  'DL03': { code: 'DL03', rtoName: 'Sheikh Sarai RTO, South Delhi', state: 'Delhi' },
  'DL04': { code: 'DL04', rtoName: 'Janakpuri RTO, West Delhi', state: 'Delhi' },
  'DL05': { code: 'DL05', rtoName: 'Loni Road RTO, North East Delhi', state: 'Delhi' },
  'DL06': { code: 'DL06', rtoName: 'Sarai Kale Khan RTO, Central Delhi', state: 'Delhi' },
  'DL07': { code: 'DL07', rtoName: 'Mayur Vihar RTO, East Delhi', state: 'Delhi' },
  'DL08': { code: 'DL08', rtoName: 'Wazirpur RTO, North West Delhi', state: 'Delhi' },
  'DL09': { code: 'DL09', rtoName: 'Palam RTO, South West Delhi', state: 'Delhi' },
  'DL10': { code: 'DL10', rtoName: 'Raja Garden RTO, West Delhi', state: 'Delhi' },
  'DL11': { code: 'DL11', rtoName: 'Rohini RTO, North West Delhi', state: 'Delhi' },
  'DL12': { code: 'DL12', rtoName: 'Vasant Vihar RTO, South West Delhi', state: 'Delhi' },
  'DL13': { code: 'DL13', rtoName: 'Surajmal Vihar RTO, East Delhi', state: 'Delhi' },

  // Haryana
  'HR01': { code: 'HR01', rtoName: 'Ambala RTO', state: 'Haryana' },
  'HR02': { code: 'HR02', rtoName: 'Jagadhri / Yamunanagar RTO', state: 'Haryana' },
  'HR03': { code: 'HR03', rtoName: 'Panchkula RTO', state: 'Haryana' },
  'HR05': { code: 'HR05', rtoName: 'Karnal RTO', state: 'Haryana' },
  'HR06': { code: 'HR06', rtoName: 'Panipat RTO', state: 'Haryana' },
  'HR10': { code: 'HR10', rtoName: 'Sonipat RTO', state: 'Haryana' },
  'HR12': { code: 'HR12', rtoName: 'Rohtak RTO', state: 'Haryana' },
  'HR19': { code: 'HR19', rtoName: 'Charkhi Dadri RTO', state: 'Haryana' },
  'HR20': { code: 'HR20', rtoName: 'Hisar RTO', state: 'Haryana' },
  'HR26': { code: 'HR26', rtoName: 'Gurugram (North) RTO', state: 'Haryana' },
  'HR29': { code: 'HR29', rtoName: 'Ballabgarh RTO', state: 'Haryana' },
  'HR36': { code: 'HR36', rtoName: 'Rewari RTO', state: 'Haryana' },
  'HR51': { code: 'HR51', rtoName: 'Faridabad RTO', state: 'Haryana' },
  'HR55': { code: 'HR55', rtoName: 'Gurugram (Commercial) RTO', state: 'Haryana' },
  'HR72': { code: 'HR72', rtoName: 'Gurugram (South) RTO', state: 'Haryana' },

  // Uttar Pradesh
  'UP11': { code: 'UP11', rtoName: 'Saharanpur RTO', state: 'Uttar Pradesh' },
  'UP12': { code: 'UP12', rtoName: 'Muzaffarnagar RTO', state: 'Uttar Pradesh' },
  'UP13': { code: 'UP13', rtoName: 'Bulandshahr RTO', state: 'Uttar Pradesh' },
  'UP14': { code: 'UP14', rtoName: 'Ghaziabad RTO', state: 'Uttar Pradesh' },
  'UP15': { code: 'UP15', rtoName: 'Meerut RTO', state: 'Uttar Pradesh' },
  'UP16': { code: 'UP16', rtoName: 'Gautam Buddha Nagar (Noida) RTO', state: 'Uttar Pradesh' },
  'UP17': { code: 'UP17', rtoName: 'Baghpat RTO', state: 'Uttar Pradesh' },
  'UP19': { code: 'UP19', rtoName: 'Shamli RTO', state: 'Uttar Pradesh' },
  'UP20': { code: 'UP20', rtoName: 'Bijnor RTO', state: 'Uttar Pradesh' },
  'UP21': { code: 'UP21', rtoName: 'Moradabad RTO', state: 'Uttar Pradesh' },
  'UP22': { code: 'UP22', rtoName: 'Rampur RTO', state: 'Uttar Pradesh' },
  'UP25': { code: 'UP25', rtoName: 'Bareilly RTO', state: 'Uttar Pradesh' },
  'UP32': { code: 'UP32', rtoName: 'Lucknow RTO', state: 'Uttar Pradesh' },
  'UP70': { code: 'UP70', rtoName: 'Prayagraj (Allahabad) RTO', state: 'Uttar Pradesh' },
  'UP78': { code: 'UP78', rtoName: 'Kanpur RTO', state: 'Uttar Pradesh' },
  'UP80': { code: 'UP80', rtoName: 'Agra RTO', state: 'Uttar Pradesh' },
  'UP81': { code: 'UP81', rtoName: 'Aligarh RTO', state: 'Uttar Pradesh' },
  'UP85': { code: 'UP85', rtoName: 'Mathura RTO', state: 'Uttar Pradesh' },

  // Maharashtra
  'MH01': { code: 'MH01', rtoName: 'Mumbai (South / Tardeo) RTO', state: 'Maharashtra' },
  'MH02': { code: 'MH02', rtoName: 'Mumbai (West / Andheri) RTO', state: 'Maharashtra' },
  'MH03': { code: 'MH03', rtoName: 'Mumbai (East / Wadala) RTO', state: 'Maharashtra' },
  'MH04': { code: 'MH04', rtoName: 'Thane RTO', state: 'Maharashtra' },
  'MH12': { code: 'MH12', rtoName: 'Pune RTO', state: 'Maharashtra' },
  'MH14': { code: 'MH14', rtoName: 'Pimpri-Chinchwad RTO', state: 'Maharashtra' },
  'MH43': { code: 'MH43', rtoName: 'Navi Mumbai RTO', state: 'Maharashtra' },

  // Rajasthan
  'RJ14': { code: 'RJ14', rtoName: 'Jaipur (South) RTO', state: 'Rajasthan' },
  'RJ45': { code: 'RJ45', rtoName: 'Jaipur (North) RTO', state: 'Rajasthan' },
  'RJ19': { code: 'RJ19', rtoName: 'Jodhpur RTO', state: 'Rajasthan' },
  'RJ27': { code: 'RJ27', rtoName: 'Udaipur RTO', state: 'Rajasthan' },
};

const STATE_CODE_NAMES: Record<string, string> = {
  'AN': 'Andaman and Nicobar',
  'AP': 'Andhra Pradesh',
  'AR': 'Arunachal Pradesh',
  'AS': 'Assam',
  'BR': 'Bihar',
  'CG': 'Chhattisgarh',
  'CH': 'Chandigarh',
  'DD': 'Daman and Diu',
  'DL': 'Delhi',
  'DN': 'Dadra and Nagar Haveli',
  'GA': 'Goa',
  'GJ': 'Gujarat',
  'HP': 'Himachal Pradesh',
  'HR': 'Haryana',
  'JH': 'Jharkhand',
  'JK': 'Jammu and Kashmir',
  'KA': 'Karnataka',
  'KL': 'Kerala',
  'LA': 'Ladakh',
  'LD': 'Lakshadweep',
  'MH': 'Maharashtra',
  'ML': 'Meghalaya',
  'MN': 'Manipur',
  'MP': 'Madhya Pradesh',
  'MZ': 'Mizoram',
  'NL': 'Nagaland',
  'OD': 'Odisha',
  'PB': 'Punjab',
  'PY': 'Puducherry',
  'RJ': 'Rajasthan',
  'SK': 'Sikkim',
  'TN': 'Tamil Nadu',
  'TR': 'Tripura',
  'TS': 'Telangana',
  'UK': 'Uttarakhand',
  'UP': 'Uttar Pradesh',
  'WB': 'West Bengal',
};

export function lookupRTO(rcNumber: string): RTORecord {
  const normalized = rcNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = normalized.substring(0, 4);
  const stateCode = normalized.substring(0, 2);

  if (RTO_MAP[prefix]) {
    return RTO_MAP[prefix];
  }

  const stateName = STATE_CODE_NAMES[stateCode] || 'India';
  return {
    code: prefix,
    rtoName: `${prefix} Regional Transport Office, ${stateName}`,
    state: stateName,
  };
}
