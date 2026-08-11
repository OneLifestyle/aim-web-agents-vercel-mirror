import type { LandUnit } from '../types';

export const LAND_SQUARE_METRES_PER_UNIT: Readonly<Record<LandUnit, number>> = {
  'm²': 1,
  ha: 10_000,
  acres: 4_046.8564224,
};

/**
 * Normal conversion rounding is deliberately capped. The precision-derived
 * allowance can otherwise become very broad for a whole-acre surface value.
 */
export const LAND_NORMAL_ROUNDING_RELATIVE_TOLERANCE = 0.0025;

/** Applies only when the generated phrase explicitly signals approximation. */
export const LAND_APPROXIMATION_RELATIVE_TOLERANCE = 0.01;

const NUMBER_WORD_VALUES: Readonly<Record<string, number>> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const NUMBER_WORD_UNIT_PATTERN = '(?:one|two|three|four|five|six|seven|eight|nine)';
const NUMBER_WORD_TENS_PATTERN = '(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)';
const NUMBER_WORD_PATTERN = `(?:${NUMBER_WORD_TENS_PATTERN}(?:[\\s-]+${NUMBER_WORD_UNIT_PATTERN})?|${Object.keys(NUMBER_WORD_VALUES).slice(0, 20).join('|')})`;
const LAND_NUMBER_PATTERN = `(?:minus\\s+|[+-])?(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|\\.\\d+|${NUMBER_WORD_PATTERN})`;
const LAND_UNIT_PATTERN = '(?:square[\\s-]+metres?|square[\\s-]+meters?|hectares?|acres?|sq[.\\s-]*m\\.?|sqm|m²|m2|ha)';
const APPROXIMATION_PATTERN = '(?:approximately|approx(?:imately)?\\.?|about|around)';
const LAND_MEASUREMENT_PATTERN = new RegExp(
  `(?<![a-z0-9.])(${APPROXIMATION_PATTERN}\\s+)?(${LAND_NUMBER_PATTERN})[\\s-]*(${LAND_UNIT_PATTERN})(?![a-z0-9²])`,
  'giu',
);

const normalizeLandMeasurementText = (text: string): string => text
  .replace(/(?<=\d)[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000](?=\d{3}(?:\D|$))/g, ',')
  .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
  .replace(/\u2212/g, '-')
  .replace(/(?<=[A-Za-z0-9])[\u2010\u2011\u2012\u2013\u2014](?=[A-Za-z0-9])/g, '-')
  .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, ' ');

const BUILDING_AREA_ROLE = '(?:bedroom|bed|bathroom|bath|room|dining|living area|living space|accommodation|kitchen|laundry|ensuite|foyer|master suite|lounge|hallway|cellar|walk[\\s-]in robe|wardrobe|garage|shed|studio|floor area|internal area|interior area|building area|building footprint|building|footprint|floorplan|dwelling area|office|deck|patio|terrace|alfresco|courtyard|balcony|verandah|carport|pool|residence|home|house|dwelling|warehouse|workshop|granny flat|cottage|annexe|barn|gym|under roof)';
const SUBORDINATE_LAND_ROLE = '(?:garden|lawn|parkland|park|reserve|paddock|vineyard|orchard|arena|tennis court|sports court|lake|dam)';
const NON_LAND_LINK = '(?:is|was|spans?|measures?|measuring|covers?|covering|extends?|extending|occupies?|occupying|comprises?|comprising|offers?|offering|provides?|providing|totals?|totalling|totaling|of|at|around|approximately|about|spread|over)';
const NON_LAND_DESCRIPTOR = '(?:(?!(?:with|and|on|within|beside|including|plus|featuring|alongside|where|which|that|a|an|the|of)\\b)[a-z]+(?:-[a-z]+)?|\\d+)';
const BUILDING_AREA_LABEL_ROLE = `(?:${BUILDING_AREA_ROLE}|living)`;
const BUILDING_AREA_BEFORE = new RegExp(
  `\\b${BUILDING_AREA_LABEL_ROLE}(?:\\s*(?:/|&|and)\\s*${BUILDING_AREA_LABEL_ROLE})?(?:\\s+\\d+)?(?:\\s+(?:size|area))?(?:\\s+${NON_LAND_LINK}){0,4}[\\s|,:/()\\[\\]{}=—–-]*$`,
  'i',
);
const SUBORDINATE_LAND_BEFORE = new RegExp(`\\b${SUBORDINATE_LAND_ROLE}(?:\\s+${NON_LAND_LINK}){0,4}\\s*$`, 'i');
const BUILDING_AREA_AFTER = new RegExp(
  `^[\\s([{:,-]*(?:of\\s+)?(?:${NON_LAND_DESCRIPTOR}[\\s-]+){0,8}${BUILDING_AREA_ROLE}\\b`,
  'i',
);
const BUILDING_LEVEL_AREA_AFTER = /^[\s([{:,-]*(?:spread\s+)?(?:over|across)\s+(?:[a-z-]+|\d+)\s+(?:levels?|storeys?|stories?|floors?)\b/i;
const SUBORDINATE_LAND_AFTER = new RegExp(
  `^[\\s([{:,-]*(?:of\\s+)?(?:${NON_LAND_DESCRIPTOR}[\\s-]+){0,8}${SUBORDINATE_LAND_ROLE}\\b`,
  'i',
);
const EXTERNAL_AREA_BEFORE = /\b(?:near|nearby|beside|opposite|overlooking|adjacent(?:\s+to)?|adjoining|bordering|next\s+to|neighbouring|neighboring|views?\s+(?:out\s+)?over|backs?\s+onto|backing\s+onto|across\s+the\s+road\s+from)[\s,;:-]+(?:(?:a|an)\s+)?$|\b(?:nearby|neighbouring|neighboring)(?:\s+[a-z-]+){0,3}\s+(?:parkland|park|reserve|vineyard|orchard|property|estate|block)(?:\s+(?:spans?|spanning|covers?|covering|extends?|extending|measures?|measuring|provides?|providing|offers?|offering|comprises?|comprising)){0,2}\s*$|\b(?:national|regional)(?:\s+[a-z-]+){0,2}\s+(?:parkland|park|reserve)(?:\s+(?:spans?|spanning|covers?|covering|extends?|extending|measures?|measuring|provides?|providing|offers?|offering|comprises?|comprising)){0,2}\s*$/i;
const SUBJECT_TOTAL_LAND_BEFORE = /\b(?:this|our|the\s+(?:approved|subject))\s+(?:nearby|adjoining|adjacent|neighbouring|neighboring)\s*$/i;
const SUBJECT_LAND_OWNER_BEFORE = /\b(?:this|our|the\s+(?:approved|subject))\s*$/i;
const EXTERNAL_DESCRIPTOR_AFTER = /^[\s([{:,-]*(?:of\s+)?(?:(?:(?:national|regional)\s+){1,2}(?:parkland|park|reserve)|(?:(?:nearby|neighbouring|neighboring)\s+){1,2}(?:parkland|park|reserve|vineyard|orchard|property|estate|block))\b/i;
const EXTERNAL_NATURAL_RELATION_AFTER = new RegExp(
  `^[\\s([{:,-]*(?:${NON_LAND_DESCRIPTOR}[\\s-]+){0,3}(?:of\\s+)?(?:parkland|park|reserve|vineyard|orchard)\\b[\\s,;:-]+(?:(?:(?:lies?|sits?|is)\\s+)?(?:near|nearby|beside|opposite|adjacent(?:\\s+to)?|adjoining)\\b|(?:borders?|adjoins?)\\b|(?:spans?|spanning|covers?|covering|extends?|extending|measures?|measuring|provides?|providing|offers?|offering|comprises?|comprising)\\s+(?:${NON_LAND_DESCRIPTOR}[\\s-]+){0,4}(?:nearby\\b|(?:beside|opposite|adjacent(?:\\s+to)?|adjoining|bordering)\\s+(?:(?:the|an?|this)\\s+)?(?:(?:approved|subject)\\s+)?(?:property|holding|site|home)\\b))`,
  'i',
);
const EXTERNAL_PROPERTY_RELATION_AFTER = new RegExp(
  `^[\\s([{:,-]*(?:${NON_LAND_DESCRIPTOR}[\\s-]+){0,3}(?:property|estate|block)\\b[\\s,;:-]+(?:(?:(?:lies?|sits?|is)\\s+)?nearby\\b|(?:near|beside|opposite|adjacent\\s+to|bordering)\\s+(?:(?:the|an?|this)\\s+)?(?:(?:approved|subject)\\s+)?(?:property|holding|site|home)\\b|(?:borders?|adjoins?)\\s+(?:(?:the|an?|this)\\s+)?(?:(?:approved|subject)\\s+)?(?:property|holding|site|home)\\b)`,
  'i',
);
const EXTERNAL_SUBORDINATE_OWNER_AFTER = new RegExp(
  `^[\\s([{:,-]*(?:of\\s+)?(?:${NON_LAND_DESCRIPTOR}[\\s-]+){0,4}${SUBORDINATE_LAND_ROLE}\\b\\s+(?:on|within|inside)\\s+(?:(?:the|an?|this)\\s+)?(?:nearby|neighbouring|neighboring|adjacent|adjoining)\\s+(?:property|estate|block|holding|site)\\b`,
  'i',
);
const EXTERNAL_CONTAINER_BEFORE = /(?:\b(?:(?:the|an?|this)\s+)?(?:nearby|neighbouring|neighboring|adjacent|adjoining)\s+(?:property|estate|block|reserve|vineyard|orchard)\s+(?:includes?|contains?|features?|offers?|comprises?|has|with)\b[^.!?;\n]{0,60}$|\b(?:(?:the|an?|this)\s+)?(?:national|regional)\s+(?:park|reserve)\s+(?:includes?|contains?|features?|offers?|comprises?|has|with)\b[^.!?;\n]{0,60}$|\b(?:on|at)\s+(?:the|this|our)\s+(?:property|holding|site)[’']s\s+(?:doorstep|boundary|edge|border)\b[^.!?;\n]{0,60}$|\b(?:(?:the|this|our)\s+)?(?:(?:approved|subject)\s+)?(?:property|holding|site)[’']s\s+(?:nearby|neighbouring|neighboring|adjacent|adjoining|national|regional)\s+(?:parkland|park|reserve|vineyard|orchard)\b[^.!?;\n]{0,40}$)/i;
const CONTAINED_AREA_BEFORE = /\b(?:includes?|contains?|features?|offers?|with|comprises?)\s+(?:a|an|the)?\s*$/i;
const CONTAINED_SUBJECT_BEFORE = new RegExp(
  `(?:\\b(?:within|inside|on)\\s+(?:(?:the|this|our)\\s+)?(?:(?:approved|subject)\\s+)?(?:property|holding|site)\\b[^.!?;\\n]{0,60}\\b${SUBORDINATE_LAND_ROLE}\\b(?:\\s+(?:spans?|spanning|covers?|covering|extends?|extending|measures?|measuring|provides?|providing|offers?|offering|comprises?|comprising)){0,2}\\s*$|\\b(?:(?:the|this|our)\\s+)?(?:(?:approved|subject)\\s+)?(?:property|holding|site)\\s+(?:includes?|contains?|features?|offers?|comprises?|has|with)\\s+(?:(?:a|an|the)\\s+)?(?:${NON_LAND_DESCRIPTOR}[\\s-]+){0,3}${SUBORDINATE_LAND_ROLE}\\b(?:\\s+(?:spans?|spanning|covers?|covering|extends?|extending|measures?|measuring|provides?|providing|offers?|offering|comprises?|comprising)){0,2}\\s*$|\\b(?:our|(?:the\\s+)?(?:(?:approved|subject)\\s+)?(?:property|holding|site)[’']s)\\s+(?:${NON_LAND_DESCRIPTOR}[\\s-]+){0,3}${SUBORDINATE_LAND_ROLE}\\b(?:\\s+(?:spans?|spanning|covers?|covering|extends?|extending|measures?|measuring|provides?|providing|offers?|offering|comprises?|comprising)){0,2}\\s*$)`,
  'i',
);
const CONTAINED_AREA_AFTER = new RegExp(
  `^[\\s([{:,-]*(?:of\\s+)?(?:${NON_LAND_DESCRIPTOR}[\\s-]+){0,8}${SUBORDINATE_LAND_ROLE}\\b\\s+(?:(?:(?:is\\s+)?(?:included|contained|located)\\s+)?(?:within|inside|on)\\b|forms?\\s+part\\s+of\\b)`,
  'i',
);
const LAND_MEASUREMENT_BEFORE = /\b(?:land|block|allotment|parcel|site|grounds|lot|acreage|holding|property)\s*(?:(?:of|is|spans?|extends?|covers?)\s*)?$|\b(?:(?:set|positioned|situated|sits|stands|rests)\s+(?:on|across|over)|on|within|across)\s*$/i;
const LAND_MEASUREMENT_AFTER = new RegExp(
  `^[\\s([{:,-]*(?:of\\s+)?(?:${NON_LAND_DESCRIPTOR}[\\s-]+){0,4}(?:land|grounds|(?:home|house|building)\\s+site|site|block|allotment|parcel|lot|acreage|holding|property|estate)\\b`,
  'i',
);
const SUBJECT_PROPERTY_SALE_AFTER = new RegExp(
  `^[\\s([{:,-]*(?:${NON_LAND_DESCRIPTOR}[\\s-]+){0,4}(?:property|estate|block|holding|site)\\b\\s+(?:(?:is\\s+)?(?:now\\s+)?(?:(?:offered|listed|marketed)\\s+)?for\\s+sale)\\b`,
  'i',
);
const SUBJECT_PROPERTY_SALE_BEFORE = /^\s*(?:(?:now|offered|listed|marketed|available|presented)\s+)?for\s+sale(?:\s+is)?[\s:-]+(?:(?:a|an|the|our)\s+)?$/i;

export interface LandMeasurement {
  value: number;
  unit: LandUnit;
  decimalPlaces?: number;
  approximate?: boolean;
}

export interface LandMeasurementMention extends LandMeasurement {
  matchedText: string;
  start: number;
  end: number;
}

export interface AreaMeasurementMention extends LandMeasurementMention {
  role: 'total-land' | 'subordinate-land' | 'building-area' | 'external-area';
}

export interface LandMeasurementComparison {
  equivalent: boolean;
  reason: 'exact' | 'display-rounding' | 'explicit-approximation' | 'conflict';
  leftSquareMetres: number;
  rightSquareMetres: number;
  differenceSquareMetres: number;
  allowedDifferenceSquareMetres: number;
}

const parseLandNumber = (value: string): number | null => {
  const normalized = value.trim().toLocaleLowerCase('en-AU');
  const negative = normalized.startsWith('minus ') || normalized.startsWith('-');
  const unsigned = normalized
    .replace(/^minus\s+/, '')
    .replace(/^[+-]/, '');
  const sign = negative ? -1 : 1;
  if (unsigned in NUMBER_WORD_VALUES) return sign * NUMBER_WORD_VALUES[unsigned];
  const wordParts = unsigned.split(/[\s-]+/);
  if (
    wordParts.length === 2
    && wordParts[0] in NUMBER_WORD_VALUES
    && NUMBER_WORD_VALUES[wordParts[0]] >= 20
    && NUMBER_WORD_VALUES[wordParts[0]] % 10 === 0
    && wordParts[1] in NUMBER_WORD_VALUES
    && NUMBER_WORD_VALUES[wordParts[1]] > 0
    && NUMBER_WORD_VALUES[wordParts[1]] < 10
  ) return sign * (NUMBER_WORD_VALUES[wordParts[0]] + NUMBER_WORD_VALUES[wordParts[1]]);
  const parsed = Number(unsigned.replace(/,/g, ''));
  return Number.isFinite(parsed) ? sign * parsed : null;
};

export const parseLandUnit = (value: string): LandUnit | null => {
  const normalized = value
    .normalize('NFKD')
    .toLocaleLowerCase('en-AU')
    .replace(/[.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (/^(?:m2|sqm|sq m|square metres?|square meters?)$/.test(normalized)) return 'm²';
  if (/^(?:ha|hectares?)$/.test(normalized)) return 'ha';
  if (/^acres?$/.test(normalized)) return 'acres';
  return null;
};

const decimalPlacesFromSurface = (value: string | number): number => {
  const normalized = String(value).replace(/,/g, '').toLocaleLowerCase('en-AU');
  const [coefficient, exponentText] = normalized.split('e');
  const coefficientPlaces = coefficient.split('.')[1]?.length ?? 0;
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  return Math.max(0, coefficientPlaces - (Number.isFinite(exponent) ? exponent : 0));
};

export const toCanonicalLandSquareMetres = (measurement: Pick<LandMeasurement, 'value' | 'unit'>): number => (
  measurement.value * LAND_SQUARE_METRES_PER_UNIT[measurement.unit]
);

const displayHalfStepSquareMetres = (measurement: LandMeasurement): number => {
  const decimalPlaces = measurement.decimalPlaces ?? decimalPlacesFromSurface(measurement.value);
  const displayStep = 10 ** -Math.max(0, Math.min(decimalPlaces, 12));
  return displayStep * LAND_SQUARE_METRES_PER_UNIT[measurement.unit] / 2;
};

export const compareLandMeasurements = (
  left: LandMeasurement,
  right: LandMeasurement,
): LandMeasurementComparison => {
  const leftSquareMetres = toCanonicalLandSquareMetres(left);
  const rightSquareMetres = toCanonicalLandSquareMetres(right);
  const differenceSquareMetres = Math.abs(leftSquareMetres - rightSquareMetres);
  const scaleSquareMetres = Math.max(Math.abs(leftSquareMetres), Math.abs(rightSquareMetres));
  const floatingPointAllowance = Math.max(scaleSquareMetres, 1) * Number.EPSILON * 8;

  if (differenceSquareMetres <= floatingPointAllowance) {
    return {
      equivalent: true,
      reason: 'exact',
      leftSquareMetres,
      rightSquareMetres,
      differenceSquareMetres,
      allowedDifferenceSquareMetres: floatingPointAllowance,
    };
  }

  const precisionAllowance = displayHalfStepSquareMetres(left) + displayHalfStepSquareMetres(right);
  const normalRoundingAllowance = Math.min(
    precisionAllowance,
    scaleSquareMetres * LAND_NORMAL_ROUNDING_RELATIVE_TOLERANCE,
  );
  if (differenceSquareMetres <= normalRoundingAllowance + floatingPointAllowance) {
    return {
      equivalent: true,
      reason: 'display-rounding',
      leftSquareMetres,
      rightSquareMetres,
      differenceSquareMetres,
      allowedDifferenceSquareMetres: normalRoundingAllowance,
    };
  }

  const approximationAllowed = left.approximate === true || right.approximate === true;
  const approximationAllowance = scaleSquareMetres * LAND_APPROXIMATION_RELATIVE_TOLERANCE;
  if (approximationAllowed && differenceSquareMetres <= approximationAllowance + floatingPointAllowance) {
    return {
      equivalent: true,
      reason: 'explicit-approximation',
      leftSquareMetres,
      rightSquareMetres,
      differenceSquareMetres,
      allowedDifferenceSquareMetres: approximationAllowance,
    };
  }

  return {
    equivalent: false,
    reason: 'conflict',
    leftSquareMetres,
    rightSquareMetres,
    differenceSquareMetres,
    allowedDifferenceSquareMetres: approximationAllowed
      ? approximationAllowance
      : normalRoundingAllowance,
  };
};

export const areLandMeasurementsEquivalent = (
  left: LandMeasurement,
  right: LandMeasurement,
): boolean => compareLandMeasurements(left, right).equivalent;

const classifyAreaMeasurementRole = (
  text: string,
  mention: LandMeasurementMention,
): AreaMeasurementMention['role'] => {
  const fullBefore = text.slice(0, mention.start);
  const clauseBoundary = Math.max(
    fullBefore.lastIndexOf('.'),
    fullBefore.lastIndexOf('!'),
    fullBefore.lastIndexOf('?'),
    fullBefore.lastIndexOf(';'),
    fullBefore.lastIndexOf('\n'),
  );
  const clauseBefore = fullBefore.slice(clauseBoundary + 1);
  const before = fullBefore.slice(Math.max(0, fullBefore.length - 80));
  const after = text.slice(mention.end, Math.min(text.length, mention.end + 80));
  const containedAfter = CONTAINED_AREA_AFTER.test(after);
  const containedSubjectBefore = CONTAINED_SUBJECT_BEFORE.test(before);
  const containedArea = CONTAINED_AREA_BEFORE.test(before) || containedSubjectBefore || containedAfter;
  if (
    (SUBJECT_TOTAL_LAND_BEFORE.test(before) || SUBJECT_LAND_OWNER_BEFORE.test(before))
    && LAND_MEASUREMENT_AFTER.test(after)
  ) return 'total-land';
  if (SUBJECT_PROPERTY_SALE_BEFORE.test(clauseBefore) && LAND_MEASUREMENT_AFTER.test(after)) return 'total-land';
  if (EXTERNAL_SUBORDINATE_OWNER_AFTER.test(after)) return 'external-area';
  if (EXTERNAL_CONTAINER_BEFORE.test(before)) return 'external-area';
  if (EXTERNAL_AREA_BEFORE.test(before) && !containedAfter && !containedSubjectBefore) return 'external-area';
  if (SUBJECT_PROPERTY_SALE_AFTER.test(after)) return 'total-land';
  if (
    (EXTERNAL_NATURAL_RELATION_AFTER.test(after) || EXTERNAL_PROPERTY_RELATION_AFTER.test(after))
    && !containedArea
  ) return 'external-area';
  if (EXTERNAL_DESCRIPTOR_AFTER.test(after) && !containedArea) return 'external-area';
  if (LAND_MEASUREMENT_AFTER.test(after)) return 'total-land';
  if (BUILDING_AREA_AFTER.test(after)) return 'building-area';
  if (BUILDING_LEVEL_AREA_AFTER.test(after)) return 'building-area';
  if (LAND_MEASUREMENT_BEFORE.test(before)) return 'total-land';
  if (SUBORDINATE_LAND_AFTER.test(after)) return 'subordinate-land';
  if (BUILDING_AREA_BEFORE.test(before)) return 'building-area';
  if (SUBORDINATE_LAND_BEFORE.test(before)) return 'subordinate-land';
  return 'total-land';
};

/** Parses explicit area surfaces and deterministically assigns semantic role. */
export const findAreaMeasurementMentions = (text: string): AreaMeasurementMention[] => {
  const mentions: AreaMeasurementMention[] = [];
  const normalizedText = normalizeLandMeasurementText(text);
  for (const match of normalizedText.matchAll(LAND_MEASUREMENT_PATTERN)) {
    const value = parseLandNumber(match[2]);
    const unit = parseLandUnit(match[3]);
    const start = match.index;
    if (value === null || unit === null || start === undefined) continue;
    const measurement: LandMeasurementMention = {
      value,
      unit,
      decimalPlaces: decimalPlacesFromSurface(match[2]),
      approximate: Boolean(match[1]?.trim()),
      matchedText: text.slice(start, start + match[0].length),
      start,
      end: start + match[0].length,
    };
    mentions.push({
      ...measurement,
      role: classifyAreaMeasurementRole(normalizedText, measurement),
    });
  }
  return mentions;
};

export const findLandMeasurementMentions = (text: string): LandMeasurementMention[] => (
  findAreaMeasurementMentions(text)
    .filter(mention => mention.role === 'total-land')
    .map(({ role: _role, ...mention }) => mention)
);

/**
 * Returns the first area surface that contradicts an approved total site area.
 * Subordinate features are not treated as the land fact unless their stated
 * area is negative or materially exceeds the approved total site area.
 */
export const findContradictoryLandMeasurementMention = (
  text: string,
  approved: LandMeasurement | null,
): LandMeasurementMention | null => {
  for (const mention of findAreaMeasurementMentions(text)) {
    if (mention.role === 'external-area') continue;
    if (mention.role === 'building-area') continue;
    if (mention.role === 'total-land') {
      if (approved === null || !areLandMeasurementsEquivalent(mention, approved)) return mention;
      continue;
    }
    if (approved === null) continue;
    const mentionSquareMetres = toCanonicalLandSquareMetres(mention);
    const approvedSquareMetres = toCanonicalLandSquareMetres(approved);
    if (
      mentionSquareMetres < 0
      || (
        mentionSquareMetres > approvedSquareMetres
        && !areLandMeasurementsEquivalent(mention, approved)
      )
    ) return mention;
  }
  return null;
};
