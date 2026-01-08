// src/lib/plan.ts
export type PlanFeatures = {
  tools: Record<string, boolean>;
  daily_job_limit: number;
  brands_max: number;                 // -1 = unlimited
  products_per_brand_max: number;     // -1 = unlimited
  avatars_max: number;
  queue: 'none' | 'standard' | 'priority' | 'fast_lane';
};

export function hasTool(f: PlanFeatures | undefined, key: string) {
  return !!f?.tools?.[key];
}

export function isUnlimited(n?: number) {
  return typeof n === 'number' && n < 0;
}

/** Safely read + normalize plan code from various shapes of "user" */
function getPlanCode(user: any): string {
  const raw =
    user?.plan?.code ??
    user?.plan_code ??
    user?.profile?.plan_code ??
    user?.app_user_profile?.plan_code ??
    null;

  return typeof raw === 'string' ? raw.trim().toLowerCase() : 'free';
}

/** Default feature packs if joined features are missing */
function defaultsFor(code: string): PlanFeatures {
  const packs: Record<string, PlanFeatures> = {
    free: {
      tools: {
        photos: false,
        't2i:v2': false,
        't2i:v3': false,
        't2i:v4': false,
        'ads:sora': false,
        'ads:veo-3.1-fast': false,
      },
      daily_job_limit: 0,
      brands_max: 0,
      products_per_brand_max: 0,
      avatars_max: 0,
      queue: 'none',
    },
    starter: {
      tools: {
        photos: true,
        't2i:v2': true,
        't2i:v3': true,
        't2i:v4': true,
        'ads:sora': false,
        'ads:veo-3.1-fast': true,
      },
      daily_job_limit: 30,
      brands_max: 2,
      products_per_brand_max: 2,
      avatars_max: 5,
      queue: 'standard',
    },
    pro: {
      tools: {
        photos: true,
        't2i:v2': true,
        't2i:v3': true,
        't2i:v4': true,
        'ads:sora': true,
        'ads:veo-3.1-fast': true,
      },
      daily_job_limit: 100,
      brands_max: 5,
      products_per_brand_max: 5,
      avatars_max: 20,
      queue: 'priority',
    },
    generative: {
      tools: {
        photos: true,
        't2i:v2': true,
        't2i:v3': true,
        't2i:v4': true,
        'ads:sora': true,
        'ads:veo-3.1-fast': true,
      },
      daily_job_limit: 300,
      brands_max: -1,
      products_per_brand_max: -1,
      avatars_max: 50,
      queue: 'fast_lane',
    },
  };
  return packs[code] ?? packs.free;
}

/** Use joined plan.features if present; otherwise fallback from plan_code */
export function resolveFeatures(user: any): PlanFeatures {
  const joined = user?.plan?.features;
  if (joined && typeof joined === 'object') return joined as PlanFeatures;
  return defaultsFor(getPlanCode(user));
}

/** Convenience helpers */
export function planCode(user: any): string {
  return getPlanCode(user);
}
export function isProOrHigher(user: any): boolean {
  const code = getPlanCode(user);
  return code === 'pro' || code === 'generative';
}
