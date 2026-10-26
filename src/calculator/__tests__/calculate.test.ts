import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { calculateBasePayout } from '../calculate.js';

describe('calculateBasePayout', () => {
  it('computes amount * rate as an exact decimal, without IEEE754 float rounding error', () => {
    // 100.10 * 0.15 = 15.015 exactly.
    // Under native IEEE754 floats, 100.10 * 0.15 === 15.014999999999999 (fails strict equality),
    // so this test only passes when the implementation uses exact decimal math.
    const amount = new Decimal('100.10');
    const rate = new Decimal('0.15');

    const result = calculateBasePayout(amount, rate);

    expect(result.equals(new Decimal('15.015'))).toBe(true);
  });
});
