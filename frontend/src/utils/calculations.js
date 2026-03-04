import { MONTHS } from './constants';

/**
 * Calculate summary statistics for simulation results
 */
export function calculateSummaryStats(simulated, baseline) {
  if (!simulated || !baseline || simulated.length === 0) {
    return {
      avgSimulated: 0,
      totalSimulated: 0,
      avgBaseline: 0,
      totalBaseline: 0,
      deltaPercent: 0,
    };
  }

  const validSimulated = simulated.filter(v => v !== null && !isNaN(v));
  const validBaseline = baseline.filter(v => v !== null && !isNaN(v));

  const totalSimulated = validSimulated.reduce((a, b) => a + b, 0);
  const totalBaseline = validBaseline.reduce((a, b) => a + b, 0);
  
  const avgSimulated = validSimulated.length > 0 ? totalSimulated / validSimulated.length : 0;
  const avgBaseline = validBaseline.length > 0 ? totalBaseline / validBaseline.length : 0;
  
  const deltaPercent = totalBaseline !== 0 
    ? ((totalSimulated - totalBaseline) / totalBaseline) * 100 
    : 0;

  return {
    avgSimulated,
    totalSimulated,
    avgBaseline,
    totalBaseline,
    deltaPercent,
  };
}

/**
 * Get valid month range from data (non-NaN months)
 */
export function getValidMonthRange(data) {
  if (!data || data.length === 0) {
    return { start: 0, end: 11, validMonths: MONTHS };
  }

  const validIndices = data
    .map((val, idx) => ({ val, idx }))
    .filter(({ val }) => val !== null && !isNaN(val) && val > 0)
    .map(({ idx }) => idx);

  if (validIndices.length === 0) {
    return { start: 0, end: 11, validMonths: MONTHS };
  }

  const start = Math.min(...validIndices);
  const end = Math.max(...validIndices);
  const validMonths = MONTHS.slice(start, end + 1);

  return { start, end, validMonths };
}

/**
 * Slice data arrays to valid range
 */
export function sliceToValidRange(dataArrays, start, end) {
  return dataArrays.map(arr => {
    if (!arr) return null;
    return arr.slice(start, end + 1);
  });
}

/**
 * Generate CSV content from simulation results
 */
export function generateCSV(params) {
  const {
    product,
    apsClass,
    year,
    baseline,
    simulated,
    multipliers,
    msAdjustments,
    msMode,
    appliedDetails,
  } = params;

  const headers = [
    'Product',
    'APS_Class',
    'Year',
    'Month',
    'Manufacturer_Baseline',
    'Event_Multiplier',
    'MS_Adjustment',
    'MS_Mode',
    'Simulated',
    'Delta_vs_Baseline_Pct',
    'Applied_Events',
  ];

  const rows = [headers.join(',')];

  MONTHS.forEach((month, i) => {
    const baselineVal = baseline[i] || 0;
    const simVal = simulated[i] || 0;
    const mult = multipliers[month] || 1.0;
    const msAdj = msAdjustments[month] || 1.0;
    const delta = baselineVal !== 0 ? ((simVal - baselineVal) / baselineVal) * 100 : 0;
    const events = appliedDetails[month] || [];
    const eventsStr = events.length > 0
      ? events.map(([n, v]) => `${n}:${v.toFixed(4)}`).join('; ')
      : 'None';

    const row = [
      product,
      apsClass || 'Product Total',
      year,
      month,
      baselineVal.toFixed(2),
      mult.toFixed(4),
      msAdj.toFixed(4),
      msMode,
      simVal.toFixed(2),
      delta.toFixed(2),
      `"${eventsStr}"`,
    ];

    rows.push(row.join(','));
  });

  return rows.join('\n');
}

/**
 * Download content as file
 */
export function downloadFile(content, filename, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}