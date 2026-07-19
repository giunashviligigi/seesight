export const BUDGET_CURRENCIES = ["USD", "EUR", "GEL"] as const;

export type BudgetCurrency = (typeof BUDGET_CURRENCIES)[number];

export const BUDGET_CURRENCY_OPTIONS = BUDGET_CURRENCIES.map((code) => ({
  value: code,
  label: code,
}));

export function isBudgetCurrency(value: unknown): value is BudgetCurrency {
  return (
    typeof value === "string" &&
    (BUDGET_CURRENCIES as readonly string[]).includes(value.toUpperCase())
  );
}

export function normalizeBudgetCurrency(
  value: unknown,
  fallback: BudgetCurrency = "EUR",
): BudgetCurrency {
  if (typeof value !== "string") return fallback;
  const upper = value.trim().toUpperCase();
  return isBudgetCurrency(upper) ? upper : fallback;
}

/** Read per-trip budget defaults from company.policyJson. */
export function readCompanyBudgetPolicy(policyJson: Record<string, unknown> | null | undefined): {
  defaultBudgetLimit: number | null;
  defaultBudgetCurrency: BudgetCurrency;
} {
  const limitRaw = policyJson?.defaultBudgetLimit;
  const limit =
    typeof limitRaw === "number" && Number.isFinite(limitRaw)
      ? limitRaw
      : typeof limitRaw === "string" && limitRaw.trim() !== "" && Number.isFinite(Number(limitRaw))
        ? Number(limitRaw)
        : null;

  const currency = normalizeBudgetCurrency(
    policyJson?.defaultBudgetCurrency ?? policyJson?.currency,
  );

  return {
    defaultBudgetLimit: limit,
    defaultBudgetCurrency: currency,
  };
}
