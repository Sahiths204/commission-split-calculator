import { Decimal } from 'decimal.js';

// ROUND_HALF_UP: standard "round half away from zero" behavior expected for money.
export const MONEY_ROUNDING_MODE = Decimal.ROUND_HALF_UP;
