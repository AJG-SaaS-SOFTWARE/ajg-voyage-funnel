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

export type BuilderE2EStep = {
  key: string;
  label: string;
  status: "pass" | "skipped";
  detail: string;
};

export type BuilderE2EResult = {
  ok: true;
  includeAi: boolean;
  steps: BuilderE2EStep[];
};

export async function adminRunBuilderE2E(includeAi: boolean): Promise<BuilderE2EResult> {
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
    body: JSON.stringify({ includeAi }),
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
  if (!response.ok) throw new Error(body?.error || "Sous-domaines AJG indisponibles.");
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

export type AdminBetaCohortMember = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  invitedAt: string | null;
  accessActive: boolean;
  accessStartsAt: string | null;
  accessExpiresAt: string | null;
};

export type AdminBetaCohort = {
  limit: number;
  defaultAccessDays: number;
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

export async function adminInviteBetaMember(email: string, durationDays = 30) {
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
    body: JSON.stringify({ email, durationDays }),
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
        avgTokensPerCall: number;
        avgDurationMsPerCall: number;
        byOperation: Array<{
          operation: string;
          calls: number;
          totalTokens: number;
        }>;
        byModel: Array<{
          model: string;
          calls: number;
          inputTokens: number;
          cachedInputTokens: number;
          outputTokens: number;
          totalTokens: number;
        }>;
      };
    };
  };
  feedback: { count: number; users: number; averageRating: number | null; open: number };
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

export async function adminSetPlan(siteId:string,userId:string,planKey:"free"|"essential"|"pro"){
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
