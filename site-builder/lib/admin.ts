export type AdminStorageBackupStatus = {
  configured: boolean;
  status: "healthy" | "warning" | "critical" | "unknown";
  lastCompletedAt: string | null;
  ageHours: number | null;
  sourceObjects: number | null;
  retentionDays: number;
};

export type AdminStorageBackupRun = {
  ok: true;
  result: {
    ok: true;
    configured: true;
    capturedAt: string;
    snapshotPath: string;
    summary: {
      sourceObjects: number;
      uploaded: number;
      unchanged: number;
      tombstoned: number;
      expiredVersionsPurged: number;
      oldSnapshotsPurged: number;
    };
  };
};

async function adminSessionToken() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");
  return session.access_token;
}

export async function getAdminStorageBackupStatus(): Promise<AdminStorageBackupStatus> {
  const token = await adminSessionToken();
  const response = await fetch("/api/admin/storage-backup", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "État de sauvegarde indisponible.");
  return body as AdminStorageBackupStatus;
}

export async function adminRunStorageBackup(): Promise<AdminStorageBackupRun> {
  const token = await adminSessionToken();
  const response = await fetch("/api/admin/storage-backup", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Sauvegarde impossible.");
  return body as AdminStorageBackupRun;
}

import { getSupabaseBrowserClient } from "./supabase-browser";
import type { AiFinopsReport, FinopsAlert, FinopsMonitorStatus } from "./ai-finops-report";
import type { AiUsageAnomaly } from "./ai-usage-anomaly";

export async function getAdminAiFinops(month?: string, signal?: AbortSignal): Promise<{ report: AiFinopsReport; alerts: FinopsAlert[]; monitor: FinopsMonitorStatus | null; anomaly: AiUsageAnomaly; generatedAt: string }> {
  const token = await adminSessionToken();
  const response = await fetch("/api/admin/ai-finops" + (month ? "?month=" + encodeURIComponent(month) : ""), {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Rapport FinOps indisponible.");
  return body;
}

export type BuilderE2EStep = {
  key: string;
  label: string;
  status: "pass" | "skipped";
  detail: string;
};

export type BuilderE2EResult = {
  ok: true;
  includeAi: boolean;
  locale: "fr" | "en";
  steps: BuilderE2EStep[];
};

export async function adminRunBuilderE2E(
  includeAi: boolean,
  locale: "fr" | "en" = "fr"
): Promise<BuilderE2EResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");

  const response = await fetch("/api/admin/builder-e2e", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ includeAi, locale }),
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const stage = body?.stage ? ` (étape : ${body.stage})` : "";
    const detail = body?.detail ? ` — ${body.detail}` : "";
    throw new Error((body?.error || "Recette E2E impossible.") + stage + detail);
  }
  return body as BuilderE2EResult;
}

export type AdminVisualReview = {
  locale: "fr" | "en";
  viewport: "desktop" | "mobile";
  approved: boolean;
  reviewed_at: string;
  deployment_sha: string;
  surface_set_version: string;
};

export type AdminVisualReviewStatus = {
  deploymentSha: string;
  surfaceSetVersion: string;
  complete: boolean;
  reviews: AdminVisualReview[];
};

export async function getAdminVisualReview(): Promise<AdminVisualReviewStatus> {
  const token = await adminSessionToken();
  const response = await fetch("/api/admin/visual-review", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Revue visuelle indisponible.");
  return body as AdminVisualReviewStatus;
}

export async function adminSetVisualReview(
  locale: "fr" | "en",
  viewport: "desktop" | "mobile",
  approved: boolean
): Promise<AdminVisualReview> {
  const token = await adminSessionToken();
  const response = await fetch("/api/admin/visual-review", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ locale, viewport, approved }),
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Enregistrement de la revue visuelle impossible.");
  return body.review as AdminVisualReview;
}

export type AdminManagedDomain = {
  id: string;
  siteId: string;
  slug: string;
  siteStatus: string;
  hostname: string;
  verificationStatus: "pending" | "verified" | "failed";
  isPrimary: boolean;
};

export async function getAdminManagedDomains(): Promise<AdminManagedDomain[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");

  const response = await fetch("/api/admin/managed-domains", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Sous-domaines ELTARA indisponibles.");
  return (body?.domains || []) as AdminManagedDomain[];
}

export async function adminSyncManagedDomain(domainId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");

  const response = await fetch("/api/admin/managed-domains", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ domainId }),
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.vercel?.message ? ` — ${body.vercel.message}` : "";
    throw new Error((body?.error || "Préparation du sous-domaine impossible.") + detail);
  }
  return body as {
    ok: true;
    verified: boolean;
    ownershipVerified: boolean;
    misconfigured: boolean | null;
    verification: Array<{ type?: string; domain?: string; value?: string; reason?: string }>;
  };
}

export type AdminBetaOperationsRun = {
  id: number;
  started_at: string;
  completed_at: string | null;
  status: "running" | "healthy" | "attention" | "failed";
  scanned_users: number;
  grant_count: number;
  active_tester_count: number;
  repaired_metadata: number;
  revoked_stale_metadata: number;
  repair_failures: number;
  follow_up_candidates: number;
  awaiting_resume: number;
  unresponsive_after_followup: number;
  completed_missions: number;
  errors: string[];
};

export type AdminBetaOperationsStatus = {
  latest: AdminBetaOperationsRun | null;
  lastSuccessAt: string | null;
  attentionRequired: boolean;
  runs: AdminBetaOperationsRun[];
};

export async function getAdminBetaOperationsStatus(): Promise<AdminBetaOperationsStatus> {
  const token = await adminSessionToken();
  const response = await fetch("/api/admin/beta-operations", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "État de l’agent bêta indisponible.");
  return body as AdminBetaOperationsStatus;
}

export async function adminRunBetaOperationsAgent(): Promise<AdminBetaOperationsStatus & { result: unknown }> {
  const token = await adminSessionToken();
  const response = await fetch("/api/admin/beta-operations", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail ? ` — ${body.detail}` : "";
    throw new Error((body?.error || "Exécution de l’agent bêta impossible.") + detail);
  }
  return body;
}

export type AdminBetaCohortMember = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  invitedAt: string | null;
  accessActive: boolean;
  metadataBeta: boolean;
  grantConfigured: boolean;
  cohortConsistent: boolean;
  accessStartsAt: string | null;
  accessExpiresAt: string | null;
  locale: "fr" | "en";
  siteId: string | null;
  siteSlug: string | null;
  siteStatus: string | null;
  publishedAt: string | null;
  lastActivityAt: string | null;
  feedbackCount: number;
  productEventCount: number;
  aiEventCount: number;
  mission: {
    essentialTested: boolean;
    published: boolean;
    essentialThenGrowth: boolean;
    growthCockpitOpened: boolean;
    analyticsOpened: boolean;
    growthExplored: boolean;
    feedbackSent: boolean;
    completedCount: number;
    percent: number;
    nextAction: "essential" | "publish" | "compare" | "growth_explore" | "feedback" | "complete";
  };
  followUp: {
    count: number;
    lastSentAt: string | null;
    lastAction: "essential" | "publish" | "compare" | "growth_explore" | "feedback" | "complete" | null;
    resumedAfterLast: boolean;
    awaitingResume: boolean;
    overdueAfterFollowUp: boolean;
  };
  betaStage: "invited" | "activated" | "building" | "published" | "complete";
  needsFollowUp: boolean;
  followUpReason: string | null;
};

export type AdminBetaCohort = {
  limit: number;
  consistencyIssues: number;
  operationalTarget: number;
  defaultAccessDays: number;
  followUpRules: {
    invitationHours: number;
    inactivityHours: number;
    duplicateGuardHours: number;
    postFollowUpWaitHours: number;
  };
  missionSummary: {
    averagePercent: number;
    completed: number;
    needsFollowUp: number;
    byStep: {
      essential: number;
      published: number;
      compared: number;
      growthExplored: number;
      feedback: number;
    };
  };
  members: AdminBetaCohortMember[];
};

export async function getAdminBetaCohort(): Promise<AdminBetaCohort> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");

  const response = await fetch("/api/admin/beta-cohort", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Cohorte bêta indisponible.");
  return body as AdminBetaCohort;
}

export async function adminRecordBetaFollowUp(
  member: AdminBetaCohortMember,
  channel: "email" | "other" = "email"
) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");
  if (member.mission.nextAction === "complete") throw new Error("Cette mission est déjà terminée.");

  const response = await fetch("/api/admin/beta-followups", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId: member.id,
      siteId: member.siteId,
      nextAction: member.mission.nextAction,
      channel
    }),
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Enregistrement de la relance impossible.");
  return body as {
    followUp: {
      id: string;
      user_id: string;
      site_id: string | null;
      mission_next_action: string;
      channel: string;
      sent_at: string;
    };
  };
}

export async function adminInviteBetaMember(email: string, durationDays = 30, locale: "fr" | "en" = "fr") {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");

  const response = await fetch("/api/admin/beta-cohort", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, durationDays, locale }),
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const issueDetail = Array.isArray(body?.issues)
      ? body.issues
          .map((item: { detail?: string }) => item?.detail)
          .filter(Boolean)
          .join(" · ")
      : "";
    const detail = body?.detail || issueDetail;
    throw new Error(
      (body?.error || "Invitation bêta impossible.") +
        (detail ? ` — ${detail}` : "")
    );
  }
  return body as { invited: boolean; existing: boolean; member: AdminBetaCohortMember };
}

export async function adminRemoveBetaMember(userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");

  const response = await fetch("/api/admin/beta-cohort", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ userId }),
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Retrait de la cohorte impossible.");
}

export type AdminBetaMetrics = {
  periodDays: number;
  cohort: {
    scope: "beta" | "all";
    size: number;
    activated: number;
  };
  generatedAt: string;
  funnel: {
    opened: number;
    engaged: number;
    reviewed: number;
    published: number;
    engagementRate: number;
    reviewRate: number;
    publishRate: number;
    openedWithoutEngagement: number;
    openedWithoutPublication: number;
    steps: {
      identity: number;
      story: number;
      design: number;
      booking: number;
      options: number;
      review: number;
      published: number;
    };
    dropOffs: {
      identityToStory: number;
      storyToDesign: number;
      designToBooking: number;
      bookingToOptions: number;
      optionsToReview: number;
      reviewToPublished: number;
    };
  };
  betaExperience: {
    essentialTesters: number;
    growthTesters: number;
    bothTested: number;
    essentialThenGrowth: number;
    completionRate: number;
    orderedCompletionRate: number;
  };
  onboardingPaths: {
    totalSelections: number;
    aiShare: number;
    manual: {
      selected: number;
      published: number;
      publishRate: number;
      medianHoursToPublish: number | null;
    };
    ai: {
      selected: number;
      published: number;
      publishRate: number;
      medianHoursToPublish: number | null;
    };
  };
  ai: {
    generations: number;
    users: number;
    appliedUsers: number;
    architect: {
      attempts: number;
      requests: number;
      failures: number;
      failureRate: number;
      firstGenerations: number;
      regenerations: number;
      refinements: number;
      applications: number;
      users: number;
      regeneratedUsers: number;
      appliedUsers: number;
      regenerationRate: number;
      refinementRate: number;
      applicationRate: number;
      userAdoptionRate: number;
      humanEvaluation: {
        responses: number;
        positive: number;
        negative: number;
        positiveRate: number;
        responseRate: number;
        reasons: Array<{ reason: string; count: number }>;
      };
      provider: {
        calls: number;
        inputTokens: number;
        cachedInputTokens: number;
        outputTokens: number;
        reasoningTokens: number;
        totalTokens: number;
        estimatedCostUsd: number;
        avgCostUsdPerCall: number;
        pricedCalls: number;
        unpricedCalls: number;
        strategyCalls: number;
        avgStrategyCallsPerRequest: number;
        avgCallsPerAttempt: number;
        avgTokensPerAttempt: number;
        avgDurationMsPerCall: number;
        byModel: Array<{
          model: string;
          calls: number;
          inputTokens: number;
          cachedInputTokens: number;
          outputTokens: number;
          totalTokens: number;
          estimatedCostUsdMicros: number;
        }>;
      };
    };
    standard: {
      provider: {
        calls: number;
        inputTokens: number;
        cachedInputTokens: number;
        outputTokens: number;
        reasoningTokens: number;
        totalTokens: number;
        estimatedCostUsd: number;
        avgCostUsdPerCall: number;
        pricedCalls: number;
        unpricedCalls: number;
        avgTokensPerCall: number;
        avgDurationMsPerCall: number;
        byOperation: Array<{
          operation: string;
          calls: number;
          totalTokens: number;
          estimatedCostUsdMicros: number;
        }>;
        byModel: Array<{
          model: string;
          calls: number;
          inputTokens: number;
          cachedInputTokens: number;
          outputTokens: number;
          totalTokens: number;
          estimatedCostUsdMicros: number;
        }>;
      };
    };
  };
  feedback: {
    count: number;
    users: number;
    averageRating: number | null;
    open: number;
    byExperience: {
      essential: { count: number; averageRating: number | null };
      growth: { count: number; averageRating: number | null };
      unknown: number;
    };
  };
  sites: {
    active: number;
    published: number;
    activity: Array<{
      siteId: string;
      slug: string;
      status: string;
      stage: "opened" | "engaged" | "review" | "published" | "feedback";
      eventCount: number;
      aiApplyCount: number;
      feedbackCount: number;
      betaEssentialTested: boolean;
      betaGrowthTested: boolean;
      lastActivity: string;
    }>;
  };
  definitions: Record<string, string>;
};

export async function getAdminBetaMetrics(): Promise<AdminBetaMetrics> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");

  const response = await fetch("/api/admin/beta-metrics", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Métriques bêta indisponibles.");
  return body as AdminBetaMetrics;
}

export async function adminBootstrapPrivateStorage(): Promise<{ created: boolean; bucket: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");

  const response = await fetch("/api/admin/storage-bootstrap", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || "Initialisation du Storage privé impossible.");
  }
  return body as { created: boolean; bucket: string };
}

export type StorageE2EResult = {
  ok: true;
  siteId: string;
  privateBucket: string;
  privatePublicStatus: number;
  promotedPublicStatus: number;
  cleanupOk: boolean;
};

export async function adminRunStorageE2E(): Promise<StorageE2EResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");

  const response = await fetch("/api/admin/storage-e2e", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const stage = body?.stage ? ` (étape : ${body.stage})` : "";
    throw new Error((body?.error || "Validation Storage impossible.") + stage);
  }
  return body as StorageE2EResult;
}

export type ReleaseReadinessCheck = {
  key: string;
  label: string;
  status: "pass" | "warn" | "blocker" | "deferred";
  scope: "beta" | "commercial";
  detail: string;
};

export type ReleaseReadiness = {
  generatedAt: string;
  environment: string;
  commitSha: string | null;
  summary: { pass: number; warn: number; blocker: number; deferred: number };
  checks: ReleaseReadinessCheck[];
};

export async function getReleaseReadiness(): Promise<ReleaseReadiness> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error("Votre session a expiré.");

  const response = await fetch("/api/admin/release-readiness", {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store"
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Diagnostic de préproduction indisponible.");
  return body as ReleaseReadiness;
}

export type AdminSiteRow = { id:string; ownerId:string; slug:string; status:string; updatedAt:string; planKey:string; subscriptionStatus:string; customDomain:string; domainStatus:string };

export async function isCurrentUserAdmin() {
  const supabase=getSupabaseBrowserClient(); if(!supabase) return false;
  const {data:{user}}=await supabase.auth.getUser(); if(!user) return false;
  const {data,error}=await supabase.from("user_roles").select("role").eq("user_id",user.id).maybeSingle();
  if(error) throw error; return data?.role==="admin";
}

export async function getAdminSites():Promise<AdminSiteRow[]> {
  const supabase=getSupabaseBrowserClient(); if(!supabase) return [];
  if(!await isCurrentUserAdmin()) throw new Error("Accès administrateur requis.");
  const [{data:sites,error:sitesError},{data:subs,error:subsError},{data:domains,error:domainsError}]=await Promise.all([
    supabase.from("sites").select("id,owner_id,slug,status,updated_at").order("updated_at",{ascending:false}),
    supabase.from("site_subscriptions").select("site_id,owner_id,plan_key,status"),
    supabase.from("domains").select("site_id,hostname,kind,verification_status,is_primary")
  ]);
  if(sitesError) throw sitesError;if(subsError) throw subsError;if(domainsError) throw domainsError;
  return (sites||[]).map((site:any)=>{const sub=(subs||[]).find((x:any)=>x.site_id===site.id);const domain=(domains||[]).find((x:any)=>x.site_id===site.id&&x.kind==="custom_domain");
    return {id:site.id,ownerId:site.owner_id,slug:site.slug,status:site.status,updatedAt:site.updated_at,planKey:sub?.plan_key||"free",subscriptionStatus:sub?.status||"active",customDomain:domain?.hostname||"",domainStatus:domain?.verification_status||""};});
}

export async function adminSetPlan(siteId:string,userId:string,planKey:"free"|"essential"|"growth"){
  const supabase=getSupabaseBrowserClient();if(!supabase) throw new Error("Supabase n'est pas configuré.");
  if(!await isCurrentUserAdmin()) throw new Error("Accès administrateur requis.");
  const {error}=await supabase.from("site_subscriptions").upsert({site_id:siteId,owner_id:userId,plan_key:planKey,status:"active",updated_at:new Date().toISOString()},{onConflict:"site_id"});
  if(error) throw error;
}

export type AdminMetrics={events30d:number;publishes30d:number;architectApplies30d:number;feedbackOpen:number};
export type AdminFeedback={id:string;category:string;rating:number|null;message:string;status:string;createdAt:string};

export async function getAdminMetrics():Promise<AdminMetrics>{
 const supabase=getSupabaseBrowserClient();if(!supabase||!await isCurrentUserAdmin())throw new Error("Accès administrateur requis.");
 const since=new Date(Date.now()-30*24*60*60*1000).toISOString();
 const [events,publishes,architect,feedback]=await Promise.all([
  supabase.from("product_events").select("*",{count:"exact",head:true}).gte("created_at",since),
  supabase.from("product_events").select("*",{count:"exact",head:true}).eq("event_name","publish_success").gte("created_at",since),
  supabase.from("product_events").select("*",{count:"exact",head:true}).in("event_name",["architect_applied","revision_applied"]).gte("created_at",since),
  supabase.from("user_feedback").select("*",{count:"exact",head:true}).in("status",["new","reviewed","planned"])
 ]);
 for(const result of [events,publishes,architect,feedback])if(result.error)throw result.error;
 return {events30d:events.count||0,publishes30d:publishes.count||0,architectApplies30d:architect.count||0,feedbackOpen:feedback.count||0};
}

export async function getAdminFeedback():Promise<AdminFeedback[]>{
 const supabase=getSupabaseBrowserClient();if(!supabase||!await isCurrentUserAdmin())throw new Error("Accès administrateur requis.");
 const {data,error}=await supabase.from("user_feedback").select("id,category,rating,message,status,created_at").order("created_at",{ascending:false}).limit(50);
 if(error)throw error;return (data||[]).map((x:any)=>({id:x.id,category:x.category,rating:x.rating,message:x.message,status:x.status,createdAt:x.created_at}));
}


export async function adminSetFeedbackStatus(id:string,status:"new"|"reviewed"|"planned"|"done"){
 const supabase=getSupabaseBrowserClient();if(!supabase||!await isCurrentUserAdmin())throw new Error("Accès administrateur requis.");
 const {error}=await supabase.from("user_feedback").update({status}).eq("id",id);
 if(error)throw error;
}
