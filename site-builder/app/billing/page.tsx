"use client";

import { useEffect, useRef, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { downloadMySiteExport, getMyBillingState, openStripeBillingPortal, type BillingState } from "../../lib/billing-access";
import { getMySites } from "../../lib/supabase-site-repository";
import { useProductLocale } from "../../lib/product-i18n";
import { billingGuide, billingStateLabel } from "../../lib/billing-guidance";
import { getMySiteEntitlements } from "../../lib/subscription";

function date(value: string | null, locale: string) {
  return value ? new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { dateStyle: "long" }).format(new Date(value)) : "—";
}

const CHECKOUT_CONFIRMATION_ATTEMPTS = 4;
const CHECKOUT_CONFIRMATION_DELAY_MS = 1_500;

function hasConfirmedPaidRights(rights: Awaited<ReturnType<typeof getMySiteEntitlements>>) {
  return (
    (rights.planKey === "essential" || rights.planKey === "growth") &&
    (rights.status === "active" || rights.status === "trialing")
  );
}

async function confirmPaidRights(siteId: string, shouldStop: () => boolean) {
  for (let attempt = 0; attempt < CHECKOUT_CONFIRMATION_ATTEMPTS; attempt += 1) {
    try {
      if (hasConfirmedPaidRights(await getMySiteEntitlements(siteId))) return true;
    } catch {
      // A transient read failure must never be presented as a confirmed payment.
    }
    if (attempt === CHECKOUT_CONFIRMATION_ATTEMPTS - 1 || shouldStop()) break;
    await new Promise<void>(resolve => window.setTimeout(resolve, CHECKOUT_CONFIRMATION_DELAY_MS));
    if (shouldStop()) break;
  }
  return false;
}

export default function BillingPage() {
  const { locale, tr } = useProductLocale();
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [message, setMessage] = useState("");
  const [sites,setSites]=useState<Array<{id:string;slug:string}>>([]);
  const [siteId,setSiteId]=useState("");
  const [billingBusy,setBillingBusy]=useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutVerificationSiteId, setCheckoutVerificationSiteId] = useState("");
  const [checkoutVerificationBusy, setCheckoutVerificationBusy] = useState(false);
  const billingInFlight = useRef(false);
  const checkoutVerificationInFlight = useRef(false);
  const selectedSiteIdRef = useRef(siteId);
  selectedSiteIdRef.current = siteId;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBilling(null);
    setMessage("");
    setCheckoutVerificationSiteId("");
    setCheckoutVerificationBusy(false);
    checkoutVerificationInFlight.current = false;
    const search = new URLSearchParams(window.location.search);
    const requestedSiteId = search.get("siteId") || "";
    const selectedId = siteId || requestedSiteId;
    void (async () => {
      const owned = await getMySites();
      const chosen = owned.find(site => site.id === selectedId) || owned[0];
      if (cancelled) return;
      setSites(owned.map(site => ({ id: site.id, slug: site.slug })));
      if (!chosen) {
        setLoading(false);
        return;
      }
      if (chosen.id !== siteId) {
        setSiteId(chosen.id);
        return;
      }

      let state = await getMyBillingState(chosen.id);
      const verifyCheckoutReturn =
        search.get("checkout") === "success" &&
        requestedSiteId === chosen.id;
      let rightsConfirmed = false;
      let billingRefreshFailedAfterConfirmation = false;

      if (verifyCheckoutReturn) {
        rightsConfirmed = await confirmPaidRights(chosen.id, () => cancelled);
        if (cancelled) return;
        if (rightsConfirmed) {
          try {
            state = await getMyBillingState(chosen.id);
          } catch {
            billingRefreshFailedAfterConfirmation = true;
          }
        }
      }

      if (cancelled) return;
      setBilling(state);
      if (verifyCheckoutReturn) {
        setCheckoutVerificationSiteId(rightsConfirmed ? "" : chosen.id);
        setMessage(rightsConfirmed
          ? billingRefreshFailedAfterConfirmation
            ? tr(
                "Vos droits d’abonnement sont confirmés côté serveur, mais l’affichage de facturation n’a pas pu être actualisé. Actualisez la page pour réessayer.",
                "Your subscription entitlements are confirmed server-side, but the billing display could not be refreshed. Refresh the page to try again."
              )
            : tr(
                "Vos droits d’abonnement sont confirmés côté serveur.",
                "Your subscription entitlements are confirmed server-side."
              )
          : tr(
              "Retour du parcours de paiement détecté, mais vos droits serveur ne sont pas encore confirmés. Vous pouvez vérifier à nouveau dans quelques instants.",
              "Payment flow return detected, but your server-side entitlements are not confirmed yet. You can check again in a few moments."
            ));
      }
      setLoading(false);
    })().catch(() => {
      if (cancelled) return;
      setMessage(tr("Impossible de charger l’état de facturation.", "Unable to load billing status."));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [siteId, tr]);

  async function verifyCheckoutRights() {
    const expectedSiteId = checkoutVerificationSiteId;
    if (
      loading ||
      !expectedSiteId ||
      expectedSiteId !== selectedSiteIdRef.current ||
      checkoutVerificationInFlight.current
    ) return;

    checkoutVerificationInFlight.current = true;
    setCheckoutVerificationBusy(true);
    setMessage(tr("Vérification des droits serveur…", "Checking server-side entitlements…"));
    try {
      const confirmed = await confirmPaidRights(
        expectedSiteId,
        () => selectedSiteIdRef.current !== expectedSiteId
      );
      if (selectedSiteIdRef.current !== expectedSiteId) return;
      if (!confirmed) {
        setMessage(tr(
          "Vos droits serveur ne sont pas encore confirmés. Vous pouvez vérifier à nouveau dans quelques instants.",
          "Your server-side entitlements are not confirmed yet. You can check again in a few moments."
        ));
        return;
      }
      setCheckoutVerificationSiteId("");
      try {
        const state = await getMyBillingState(expectedSiteId);
        if (selectedSiteIdRef.current !== expectedSiteId) return;
        setBilling(state);
        setMessage(tr(
          "Vos droits d’abonnement sont confirmés côté serveur.",
          "Your subscription entitlements are confirmed server-side."
        ));
      } catch {
        if (selectedSiteIdRef.current === expectedSiteId) {
          setMessage(tr(
            "Vos droits d’abonnement sont confirmés côté serveur, mais l’affichage de facturation n’a pas pu être actualisé. Actualisez la page pour réessayer.",
            "Your subscription entitlements are confirmed server-side, but the billing display could not be refreshed. Refresh the page to try again."
          ));
        }
      }
    } catch {
      if (selectedSiteIdRef.current === expectedSiteId) {
        setMessage(tr(
          "Impossible de vérifier les droits serveur pour le moment. Vous pouvez réessayer.",
          "Unable to check server-side entitlements right now. You can try again."
        ));
      }
    } finally {
      checkoutVerificationInFlight.current = false;
      if (selectedSiteIdRef.current === expectedSiteId) setCheckoutVerificationBusy(false);
    }
  }

  async function downloadExport() {
    if (loading || !siteId) return;
    try {
      await downloadMySiteExport(siteId);
      setMessage(tr("Archive complète préparée : configuration et fichiers médias inclus.", "Full archive prepared: configuration and media files included."));
    } catch (error) { setMessage(error instanceof Error ? error.message : tr("Export impossible.", "Export unavailable.")); }
  }

  async function manageBilling() {
    if (loading || !siteId || !billing?.hasBillingAccount || billingInFlight.current) return;
    billingInFlight.current = true;
    setBillingBusy(true);
    setMessage("");
    try {
      await openStripeBillingPortal(siteId);
    } catch {
      setMessage(tr("Portail Stripe indisponible. Aucun changement de paiement n’est confirmé ici. Vous pouvez réessayer l’ouverture manuellement.", "Stripe portal unavailable. No payment change is confirmed here. You can try opening it again manually."));
      billingInFlight.current = false;
      setBillingBusy(false);
    }
  }

  const limited = billing && !["free","trial","active"].includes(billing.state);
  const guide = billing ? billingGuide(billing) : [];
  return <AccountShell
    active="billing"
    eyebrow={tr("Facturation & récupération", "Billing & recovery")}
    title={tr("Votre accès ELTARA", "Your ELTARA access")}
    description={tr("Suivez l’état de paiement du site sélectionné, les éventuelles échéances de restriction et vos options de récupération. Un impayé ne déclenche jamais la suppression automatique de vos données.", "Track the selected website’s billing status, any restriction deadlines and your recovery options. A failed payment never triggers automatic deletion of your data.")}
  >
    {sites.length>1?<section className="panel"><label>{tr("Site", "Website")}<select value={siteId} disabled={billingBusy || checkoutVerificationBusy} onChange={e=>{if(billingInFlight.current || checkoutVerificationInFlight.current)return;setBilling(null);setLoading(true);setSiteId(e.target.value);}}>{sites.map(site=><option key={site.id} value={site.id}>{site.slug}</option>)}</select></label></section>:null}
    {loading ? <p className="account-note" role="status">{tr("Chargement de la facturation…", "Loading billing status…")}</p> : null}
    {message ? <p className="account-note" role="alert">{message}</p> : null}
    {checkoutVerificationSiteId === siteId ? <div className="builder-actions">
      <button
        type="button"
        className="secondary-link"
        data-action="verify-checkout-entitlements"
        disabled={loading || checkoutVerificationBusy}
        onClick={() => void verifyCheckoutRights()}
      >
        {checkoutVerificationBusy ? tr("Vérification…", "Checking…") : tr("Vérifier à nouveau", "Check again")}
      </button>
    </div> : null}
    {billing ? <section className="panel billing-guide" aria-labelledby="billing-guide-title">
      <p className="eyebrow">{tr("Parcours guidé", "Guided flow")}</p>
      <h2 id="billing-guide-title">{tr("Comprendre et gérer votre accès", "Understand and manage your access")}</h2>
      <p>{tr(
        "ELTARA vous indique la prochaine action utile sans modifier vos droits depuis le navigateur. Les changements d’accès restent confirmés côté serveur.",
        "ELTARA shows the next useful action without changing your entitlements from the browser. Access changes remain confirmed server-side."
      )}</p>
      <ol className="billing-guide-steps">
        {guide.map((step, index) => (
          <li className={`billing-guide-step ${step.status}`} key={step.key}>
            <span aria-hidden="true">{step.status === "done" ? "✓" : index + 1}</span>
            <div>
              <b>{locale === "en" ? step.titleEn : step.titleFr}</b>
              <p>{locale === "en" ? step.detailEn : step.detailFr}</p>
              {step.href ? <a className="text-link" href={step.href}>{tr("Ouvrir Mon offre", "Open My plan")} →</a> : null}
            </div>
          </li>
        ))}
      </ol>
    </section> : null}
    {billing ? <section className="usage-card"><div><p className="eyebrow">{tr("État", "Status")}</p><h2>{billingStateLabel(billing.state, locale)}</h2>
      {limited ? <p>{tr("L’IA est coupée pendant la grâce. À la restriction, l’édition, les imports, la publication et les nouveaux formulaires sont également arrêtés. Le site public reste en ligne jusqu’à sa date de suspension.", "AI is disabled during the grace period. Once restricted, editing, imports, publishing and new forms are also disabled. The public website remains online until its suspension date.")}</p> : <p>{tr("Votre site dispose de ses capacités normales selon votre offre.", "Your website has its normal capabilities according to your plan.")}</p>}
      <dl className="billing-dates"><div><dt>{tr("Fin de grâce / restriction", "End of grace / restriction")}</dt><dd>{date(billing.graceUntil || billing.restrictedAt, locale)}</dd></div><div><dt>{tr("Suspension publique", "Public suspension")}</dt><dd>{date(billing.publicSuspendAt, locale)}</dd></div><div><dt>{tr("Export disponible jusqu’au", "Export available until")}</dt><dd>{date(billing.exportUntil, locale)}</dd></div><div><dt>{tr("Fin de la fenêtre de récupération prévue", "Planned recovery window end")}</dt><dd>{date(billing.deleteAfter, locale)}</dd></div></dl>
      <div className="builder-actions">
        <button type="button" className="secondary-link" onClick={downloadExport}>{tr("Télécharger l’archive complète", "Download full archive")}</button>
        {billing.hasBillingAccount ? (
          <button type="button" className="primary-link" disabled={loading || billingBusy} onClick={() => void manageBilling()}>
            {billingBusy ? tr("Ouverture de Stripe…", "Opening Stripe…") : limited ? tr("Mettre à jour mon paiement", "Update payment") : tr("Gérer mon abonnement", "Manage subscription")}
          </button>
        ) : null}
      </div>
      {limited && !billing.hasBillingAccount ? <p className="account-note">{tr("Aucun compte Stripe n’est encore rattaché à ce site. Si vous souhaitez souscrire à Essentiel ou Growth, utilisez la page Mon offre.", "No Stripe account is linked to this website yet. To subscribe to Essential or Growth, use the My plan page.")}</p> : null}
    </div></section> : null}
  </AccountShell>;
}
