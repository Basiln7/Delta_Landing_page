/** Pure finance maths for the landing-page calculators (unit-testable, no UI). */

export type SipInput = {
  monthly: number;
  years: number;
  /** expected annual return, % */
  annualReturn: number;
  /** yearly increase of the monthly amount, % */
  stepUp: number;
};

export type SipYear = { year: number; invested: number; value: number };

/**
 * SIP with monthly compounding, investments at the start of each month,
 * monthly amount increased by `stepUp`% every 12 months.
 */
export function sipProjection({ monthly, years, annualReturn, stepUp }: SipInput) {
  const i = annualReturn / 100 / 12;
  let value = 0;
  let invested = 0;
  let instalment = monthly;
  const series: SipYear[] = [];
  for (let m = 1; m <= years * 12; m++) {
    value = (value + instalment) * (1 + i);
    invested += instalment;
    if (m % 12 === 0) {
      series.push({ year: m / 12, invested, value });
      instalment *= 1 + stepUp / 100;
    }
  }
  return { invested, value, gain: value - invested, series };
}

export type PositionInput = {
  capital: number;
  /** % of capital you're willing to lose on this trade */
  riskPct: number;
  entry: number;
  stop: number;
  target?: number;
};

export function positionSize({ capital, riskPct, entry, stop, target }: PositionInput) {
  const riskAmount = (capital * riskPct) / 100;
  const perShare = Math.abs(entry - stop);
  const direction = stop < entry ? "long" : stop > entry ? "short" : "invalid";
  if (!(perShare > 0) || !(entry > 0) || !(capital > 0)) {
    return { valid: false as const, riskAmount, perShare, direction, quantity: 0, positionValue: 0, exposurePct: 0, maxLoss: 0 };
  }
  const quantity = Math.floor(riskAmount / perShare);
  const positionValue = quantity * entry;
  const reward = target && target > 0 ? Math.abs(target - entry) : undefined;
  const targetOk = target ? (direction === "long" ? target > entry : target < entry) : false;
  return {
    valid: true as const,
    direction,
    riskAmount,
    perShare,
    quantity,
    positionValue,
    exposurePct: (positionValue / capital) * 100,
    maxLoss: quantity * perShare,
    rr: reward && targetOk ? reward / perShare : undefined,
    potentialGain: reward && targetOk ? quantity * reward : undefined,
  };
}
