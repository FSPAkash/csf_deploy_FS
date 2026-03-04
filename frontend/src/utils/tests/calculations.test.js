import { describe, it, expect } from 'vitest';
import { 
  calculateSummaryStats, 
  getValidMonthRange,
  generateCSV 
} from '../calculations';
import { MONTHS } from '../constants';

describe('calculateSummaryStats', () => {
  it('should calculate correct stats for valid data', () => {
    const simulated = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210];
    const baseline = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];

    const result = calculateSummaryStats(simulated, baseline);

    expect(result.totalSimulated).toBe(1860);
    expect(result.totalBaseline).toBe(1200);
    expect(result.avgSimulated).toBe(155);
    expect(result.avgBaseline).toBe(100);
    expect(result.deltaPercent).toBe(55);
  });

  it('should handle empty arrays', () => {
    const result = calculateSummaryStats([], []);

    expect(result.totalSimulated).toBe(0);
    expect(result.totalBaseline).toBe(0);
    expect(result.deltaPercent).toBe(0);
  });

  it('should handle null values', () => {
    const simulated = [100, null, 120, null, 140];
    const baseline = [100, 100, null, 100, 100];

    const result = calculateSummaryStats(simulated, baseline);

    expect(result.totalSimulated).toBe(360);
    expect(result.totalBaseline).toBe(300);
  });
});

describe('getValidMonthRange', () => {
  it('should return correct range for full data', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const result = getValidMonthRange(data);

    expect(result.start).toBe(0);
    expect(result.end).toBe(11);
    expect(result.validMonths).toHaveLength(12);
  });

  it('should handle partial data', () => {
    const data = [null, null, 3, 4, 5, 6, 7, 8, 9, 10, null, null];
    const result = getValidMonthRange(data);

    expect(result.start).toBe(2);
    expect(result.end).toBe(9);
  });

  it('should handle empty data', () => {
    const result = getValidMonthRange([]);

    expect(result.start).toBe(0);
    expect(result.end).toBe(11);
    expect(result.validMonths).toEqual(MONTHS);
  });
});

describe('generateCSV', () => {
  it('should generate valid CSV content', () => {
    const params = {
      product: 'CN',
      apsClass: null,
      year: 2025,
      baseline: Array(12).fill(100),
      simulated: Array(12).fill(110),
      multipliers: Object.fromEntries(MONTHS.map(m => [m, 1.1])),
      msAdjustments: Object.fromEntries(MONTHS.map(m => [m, 1.0])),
      msMode: 'relative',
      appliedDetails: Object.fromEntries(MONTHS.map(m => [m, []])),
    };

    const csv = generateCSV(params);

    expect(csv).toContain('Product,APS_Class,Year,Month');
    expect(csv).toContain('CN,Product Total,2025,Jan');
    expect(csv).toContain('110.00');
  });
});