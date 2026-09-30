import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { appBaseUrl } from "../../../../lib/app-url";
import { runAiFinopsMonitorSafely } from "../../../../lib/ai-finops-monitor";

export const runtime = "nodejs";

type NotificationLocale = "fr" | "en";
type NotificationCopy = Record<string, { subject: string; body: string }>;

const copy: Record<NotificationLocale, NotificationCopy> = {
  fr: {
    payment_failed: {
      subject: "Action requise sur votre abonnement AJG Builder",
      body: "Nous n’avons pas pu confirmer votre dernier règlement. Votre site reste modifiable et publié pendant la période de grâce, mais l’assistant IA est temporairement suspendu."
    },
    reminder_j3: {
      subject: "Rappel — règlement AJG Builder",
      body: "Votre règlement reste à régulariser. Votre site continue de fonctionner pendant la période de grâce."
    },
    reminder_j7: {
      subject: "Rappel — accès AJG Builder",
      body: "Votre règlement n’est pas encore régularisé. Pensez à mettre à jour votre moyen de paiement avant la fin de la période de grâce."
    },
    reminder_j12: {
      subject: "AJG Builder — restriction prochaine",
      body: "Sans régularisation, l’édition, les nouvelles publications, les imports et la collecte de nouveaux formulaires seront prochainement suspendus. Votre site public restera encore accessible pendant la période prévue."
    },
    retention_j74: {
      subject: "AJG Builder — vos données sont toujours conservées",
      body: "Votre site est suspendu, mais vos données restent conservées. Vous pouvez régulariser votre abonnement ou récupérer vos données depuis votre espace de facturation."
    },
    retention_j97: {
      subject: "AJG Builder — rappel concernant vos données",
      body: "Votre site reste suspendu et vos données sont toujours conservées. Aucune suppression automatique n’est déclenchée par ce rappel. Vous pouvez régulariser votre abonnement ou préparer votre export depuis votre espace de facturation."
    },
    reactivated: {
      subject: "Votre site AJG Builder est réactivé",
      body: "Votre règlement a été confirmé. Les capacités de votre site et son accès public ont été rétablis."
    }
  },
  en: {
    payment_failed: {
      subject: "Action required for your AJG Builder subscription",
      body: "We could not confirm your latest payment. Your website remains editable and published during the grace period, but the AI assistant is temporarily suspended."
    },
    reminder_j3: {
      subject: "Reminder — AJG Builder payment",
      body: "Your payment still needs attention. Your website continues to operate during the grace period."
    },
    reminder_j7: {
      subject: "Reminder — AJG Builder access",
      body: "Your payment has not been resolved yet. Please update your payment method before the grace period ends."
    },
    reminder_j12: {
      subject: "AJG Builder — restriction approaching",
      body: "Without payment recovery, editing, new publications, imports and collection through new forms will soon be suspended. Your public website will remain accessible for the planned period."
    },
    retention_j74: {
      subject: "AJG Builder — your data is still retained",
      body: "Your website is suspended, but your data is still retained. You can restore your subscription or recover your data from Billing."
    },
    retention_j97: {
      subject: "AJG Builder — reminder about your data",
      body: "Your website remains suspended and your data is still retained. This reminder does not trigger automatic deletion. You can restore your subscription or prepare an export from Billing."
    },
    reactivated: {
      subject: "Your AJG Builder website is active again",
      body: "Your payment has been confirmed. Your website capabilities and public access have been restored."
    }
  }
};

function userLocale(
  userMetadata: Record<string, unknown> | null | undefined,
  fallback: unknown
): NotificationLocale {
  if (userMetadata?.ajg_builder_locale === "en") return "en";
  if (userMetadata?.ajg_builder_locale === "fr") return "fr";
  return fallback === "en" ? "en" : "fr";
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const finops = await runAiFinopsMonitorSafely();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resend = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const appUrl = appBaseUrl();
  if (!url || !serviceKey || !resend || !from) {
    return NextResponse.json({ error: "Notification service not configured" }, { status: 503 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: jobs, error } = await supabase.rpc("claim_due_billing_notifications", { p_limit: 20 });
  if (error) return NextResponse.json({ error: "Queue unavailable" }, { status: 503 });

  const siteIds = [...new Set((jobs || []).map((job: any) => job.site_id).filter(Boolean))];
  const { data: sites } = siteIds.length
    ? await supabase.from("sites").select("id,config").in("id", siteIds)
    : { data: [] as Array<{ id: string; config: any }> };
  const siteLocales = new Map(
    (sites || []).map((site: any) => [site.id, site.config?.language === "en" ? "en" : "fr"])
  );

  let sent = 0;
  let failed = 0;
  for (const job of jobs || []) {
    try {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(job.owner_id);
      if (userError || !userData.user?.email) throw new Error("owner_email_unavailable");

      const locale = userLocale(
        userData.user.user_metadata,
        siteLocales.get(job.site_id)
      );
      const message = copy[locale][job.notification_key];
      if (!message) throw new Error("unknown_notification");
      const billingLabel = locale === "en" ? "Open Billing" : "Accéder à votre espace";

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resend}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `billing-${job.id}`
        },
        body: JSON.stringify({
          from,
          to: [userData.user.email],
          subject: message.subject,
          text: `${message.body}\n\n${billingLabel} : ${appUrl}/billing\n\nAJG Builder`
        })
      });
      if (!response.ok) throw new Error(`resend_${response.status}`);

      await supabase.rpc("finish_billing_notification", {
        p_id: job.id,
        p_success: true,
        p_error: null
      });
      sent++;
    } catch (error) {
      await supabase.rpc("finish_billing_notification", {
        p_id: job.id,
        p_success: false,
        p_error: error instanceof Error ? error.message : "unknown"
      });
      failed++;
    }
  }

  return NextResponse.json({ claimed: (jobs || []).length, sent, failed, finops }, { status: finops.ok ? 200 : 503 });
}

export const GET = POST;
