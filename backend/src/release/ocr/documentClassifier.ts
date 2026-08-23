// ============================================
// Release Order Document Classifier
// ============================================

import { DocumentClassificationType } from './types';

export interface ClassificationResult {
  documentType: DocumentClassificationType;
  documentConfidence: number; // 0 to 100
  isReleaseDocument: boolean;
  matchedKeywords: string[];
  reason: string;
}

interface ClassifierRule {
  type: DocumentClassificationType;
  primaryKeywords: RegExp[];
  secondaryKeywords: RegExp[];
  weight: number;
}

const CLASSIFIER_RULES: ClassifierRule[] = [
  {
    type: 'RELEASE_ORDER',
    primaryKeywords: [
      /release\s*order/i,
      /order\s*for\s*release/i,
      /vehicle\s*release\s*order/i,
      /ro\s*no[\.:]/i,
      /release\s*letter/i,
    ],
    secondaryKeywords: [
      /hand\s*over/i,
      /captioned\s*vehicle/i,
      /repossession/i,
      /yard/i,
      /parking/i,
      /valid\s*till/i,
      /grace\s*period/i,
    ],
    weight: 1.0,
  },
  {
    type: 'DELIVERY_AUTHORIZATION',
    primaryKeywords: [
      /delivery\s*authorization/i,
      /delivery\s*order/i,
      /authority\s*letter/i,
      /authorized\s*to\s*take\s*delivery/i,
      /handover\s*authorization/i,
    ],
    secondaryKeywords: [
      /deliver\s*to/i,
      /specimen\s*signature/i,
      /authorized\s*person/i,
      /chassis\s*no/i,
      /engine\s*no/i,
    ],
    weight: 0.95,
  },
  {
    type: 'BANK_RELEASE_LETTER',
    primaryKeywords: [
      /bank\s*release/i,
      /financier\s*release/i,
      /clearance\s*for\s*release/i,
      /repo\s*release/i,
    ],
    secondaryKeywords: [
      /loan\s*account/i,
      /agreement\s*no/i,
      /settlement/i,
      /dues\s*cleared/i,
    ],
    weight: 0.90,
  },
  {
    type: 'NO_OBJECTION_RELEASE',
    primaryKeywords: [
      /no\s*objection\s*certificate/i,
      /no\s*dues\s*certificate/i,
      /\bnoc\b/i,
    ],
    secondaryKeywords: [
      /hypothecation/i,
      /loan\s*closure/i,
      /full\s*and\s*final/i,
    ],
    weight: 0.85,
  },
  {
    type: 'FINANCE_RELEASE_DOCUMENT',
    primaryKeywords: [
      /repossession\s*clearance/i,
      /surrender\s*release/i,
      /inventory\s*release/i,
    ],
    secondaryKeywords: [
      /borrower/i,
      /customer/i,
      /vehicle\s*no/i,
    ],
    weight: 0.80,
  },
];

export function classifyRoDocument(rawText: string): ClassificationResult {
  if (!rawText || rawText.trim().length < 15) {
    return {
      documentType: 'UNKNOWN',
      documentConfidence: 0,
      isReleaseDocument: false,
      matchedKeywords: [],
      reason: 'Document text is empty or insufficient for analysis',
    };
  }

  let bestType: DocumentClassificationType = 'UNKNOWN';
  let bestScore = 0;
  let allMatched: string[] = [];

  for (const rule of CLASSIFIER_RULES) {
    let ruleScore = 0;
    const ruleMatched: string[] = [];

    for (const pk of rule.primaryKeywords) {
      const match = rawText.match(pk);
      if (match) {
        ruleScore += 40;
        ruleMatched.push(match[0]);
      }
    }

    for (const sk of rule.secondaryKeywords) {
      const match = rawText.match(sk);
      if (match) {
        ruleScore += 15;
        ruleMatched.push(match[0]);
      }
    }

    const normalizedScore = Math.min(100, Math.round(ruleScore * rule.weight));

    if (normalizedScore > bestScore) {
      bestScore = normalizedScore;
      bestType = rule.type;
      allMatched = ruleMatched;
    }
  }

  // Baseline threshold for considering a document an authentic RO
  const isRelease = bestScore >= 35;

  return {
    documentType: isRelease ? bestType : 'UNKNOWN',
    documentConfidence: isRelease ? Math.min(99, Math.max(45, bestScore)) : Math.min(30, bestScore),
    isReleaseDocument: isRelease,
    matchedKeywords: allMatched,
    reason: isRelease
      ? `Document classified as ${bestType} based on matching keywords (${allMatched.slice(0, 3).join(', ')})`
      : 'Document does not contain standard release order or delivery authorization markers',
  };
}
