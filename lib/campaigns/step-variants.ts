export type StepVariant = {
  subject: string;
  body: string;
};

type StepWithVariants = {
  subject: string;
  body: string;
  variants?: unknown;
  activeVariantIndex?: number | null;
};

export function normalizeStepVariants(step: StepWithVariants): {
  variants: StepVariant[];
  activeVariantIndex: number;
} {
  let variants: StepVariant[] = [];

  if (Array.isArray(step.variants)) {
    variants = step.variants
      .filter(
        (v): v is StepVariant =>
          typeof v === "object" &&
          v !== null &&
          typeof (v as StepVariant).subject === "string" &&
          typeof (v as StepVariant).body === "string",
      )
      .map((v) => ({ subject: v.subject, body: v.body }));
  }

  if (variants.length === 0) {
    variants = [{ subject: step.subject, body: step.body }];
  }

  const activeVariantIndex = Math.min(
    Math.max(0, step.activeVariantIndex ?? 0),
    variants.length - 1,
  );

  return { variants, activeVariantIndex };
}

export function getActiveStepVariant(step: StepWithVariants): StepVariant {
  const { variants, activeVariantIndex } = normalizeStepVariants(step);
  return variants[activeVariantIndex];
}

export function syncStepWithActiveVariant<T extends StepWithVariants>(step: T): T {
  const { variants, activeVariantIndex } = normalizeStepVariants(step);
  const active = variants[activeVariantIndex];
  return {
    ...step,
    variants,
    activeVariantIndex,
    subject: active.subject,
    body: active.body,
  };
}

export function updateStepVariant(
  step: StepWithVariants,
  variantIndex: number,
  patch: Partial<StepVariant>,
): StepWithVariants {
  const { variants, activeVariantIndex } = normalizeStepVariants(step);
  const nextVariants = variants.map((v, i) =>
    i === variantIndex ? { ...v, ...patch } : v,
  );
  const active = nextVariants[activeVariantIndex];
  return {
    ...step,
    variants: nextVariants,
    activeVariantIndex,
    subject: active.subject,
    body: active.body,
  };
}

export function addStepVariant(step: StepWithVariants): StepWithVariants {
  const { variants, activeVariantIndex } = normalizeStepVariants(step);
  const source = variants[activeVariantIndex];
  const nextVariants = [
    ...variants,
    { subject: source.subject, body: source.body },
  ];
  const newIndex = nextVariants.length - 1;
  const active = nextVariants[newIndex];
  return {
    ...step,
    variants: nextVariants,
    activeVariantIndex: newIndex,
    subject: active.subject,
    body: active.body,
  };
}

export function setActiveStepVariant(
  step: StepWithVariants,
  variantIndex: number,
): StepWithVariants {
  const { variants } = normalizeStepVariants(step);
  const index = Math.min(Math.max(0, variantIndex), variants.length - 1);
  const active = variants[index];
  return {
    ...step,
    variants,
    activeVariantIndex: index,
    subject: active.subject,
    body: active.body,
  };
}

/** Ensure every step has an explicit variant A and starts on it when only one variant exists. */
export function ensureStepVariantDefaults<T extends StepWithVariants>(step: T): T {
  const synced = syncStepWithActiveVariant(step);
  const variants = synced.variants as StepVariant[];
  if (variants.length === 1) {
    return { ...synced, variants, activeVariantIndex: 0 } as T;
  }
  return synced as T;
}

export function createInitialStepVariants(
  subject: string,
  body: string,
): { variants: StepVariant[]; activeVariantIndex: number } {
  return {
    variants: [{ subject, body }],
    activeVariantIndex: 0,
  };
}
