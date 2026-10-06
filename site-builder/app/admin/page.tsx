"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "../../components/AdminShell";
import {
  adminBootstrapPrivateStorage,
  adminInviteBetaMember,
  adminRemoveBetaMember,
  adminRunBuilderE2E,
  adminRunStorageE2E,
  adminRunStorageBackup,
  adminSetFeedbackStatus,
  adminSetPlan,
  adminSyncManagedDomain,
  getAdminBetaCohort,
  getAdminBetaMetrics,
  getAdminFeedback,
  getAdminManagedDomains,
  getAdminMetrics,
  getAdminSites,
  getAdminStorageBackupStatus,
  getReleaseReadiness,
  isCurrentUserAdmin,
  type AdminBetaCohort,
  type AdminBetaMetrics,
  type AdminFeedback,
  type AdminManagedDomain,
  type AdminMetrics,
  type AdminSiteRow,
  type AdminStorageBackupStatus,
  type BuilderE2EResult,
  type ReleaseReadiness,
  type ReleaseReadinessCheck
} from "../../lib/admin";

const stageLabel: Record<AdminBetaMetrics["sites"]["activity"][number]["stage"], string> = {
  opened: "Ouvert",
  engaged: "Engagé",
  review: "Revue",
  published: "Publié",
  feedback: "Feedback"
};

const readinessLabel: Record<ReleaseReadinessCheck["status"], string> = {
  pass: "Prêt",
  warn: "À vérifier",
  blocker: "Bloquant",
  deferred: "Différé"
};

const standardAiOperationLabel: Record<string, string> = {
  standard_field: "Champ éditorial",
  standard_guided: "Parcours guidé",
  standard_review: "Relecture",
  standard_module: "Rubrique",
  standard_repair: "Réparation qualité"
};

export default function AdminPage() {
  const [rows, setRows] = useState<AdminSiteRow[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedback[]>([]);
  const [betaMetrics, setBetaMetrics] = useState<AdminBetaMetrics | null>(null);
  const [betaCohort, setBetaCohort] = useState<AdminBetaCohort | null>(null);
  const [betaEmail, setBetaEmail] = useState("");
  const [betaDurationDays, setBetaDurationDays] = useState(30);
  const [betaLocale, setBetaLocale] = useState<"fr" | "en">("fr");
  const [betaInviteBusy, setBetaInviteBusy] = useState(false);
  const [managedDomains, setManagedDomains] = useState<AdminManagedDomain[]>([]);
  const [managedDomainBusy, setManagedDomainBusy] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<ReleaseReadiness | null>(null);
  const [storageBootstrapping, setStorageBootstrapping] = useState(false);
  const [storageTesting, setStorageTesting] = useState(false);
  const [storageTestMessage, setStorageTestMessage] = useState("");
  const [storageTestOk, setStorageTestOk] = useState<boolean | null>(null);
  const [backupStatus, setBackupStatus] = useState<AdminStorageBackupStatus | null>(null);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [builderE2ERunning, setBuilderE2ERunning] = useState(false);
  const [builderE2EResult, setBuilderE2EResult] = useState<BuilderE2EResult | null>(null);
  const [builderE2EError, setBuilderE2EError] = useState("");
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!await isCurrentUserAdmin()) {
      setState("denied");
      return;
    }

    const [sites, nextMetrics, nextFeedback] = await Promise.all([
      getAdminSites(),
      getAdminMetrics(),
      getAdminFeedback()
    ]);
    setRows(sites);
    setMetrics(nextMetrics);
    setFeedback(nextFeedback);

    const [nextReadiness, nextBetaMetrics, nextBetaCohort, nextManagedDomains, nextBackupStatus] = await Promise.all([
      getReleaseReadiness().catch(() => null),
      getAdminBetaMetrics().catch(() => null),
      getAdminBetaCohort().catch(() => null),
      getAdminManagedDomains().catch(() => []),
      getAdminStorageBackupStatus().catch(() => null)
    ]);
    setReadiness(nextReadiness);
    setBetaMetrics(nextBetaMetrics);
    setBetaCohort(nextBetaCohort);
    setManagedDomains(nextManagedDomains);
    setBackupStatus(nextBackupStatus);

    setState("ready");
  };

  useEffect(() => {
    void load().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Erreur.");
      setState("denied");
    });
  }, []);

  const bootstrapPrivateStorage = async () => {
    setMessage("");
    setStorageBootstrapping(true);
    try {
      const result = await adminBootstrapPrivateStorage();
      setReadiness(await getReleaseReadiness().catch(() => null));
      setMessage(
        result.created
          ? "Storage privé initialisé et vérifié."
          : "Storage privé déjà présent et vérifié."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Initialisation du Storage privé impossible."
      );
    } finally {
      setStorageBootstrapping(false);
    }
  };

  const testPrivateStorageFlow = async () => {
    setMessage("");
    setStorageTestMessage("");
    setStorageTestOk(null);
    setStorageTesting(true);
    try {
      const result = await adminRunStorageE2E();
      setStorageTestOk(true);
      setStorageTestMessage(
        `Flux Storage validé : média privé inaccessible publiquement (HTTP ${result.privatePublicStatus}), promotion publique HTTP ${result.promotedPublicStatus}, nettoyage terminé.`
      );
      setReadiness(await getReleaseReadiness().catch(() => null));
    } catch (error) {
      setStorageTestOk(false);
      setStorageTestMessage(
        error instanceof Error
          ? error.message
          : "Validation du flux Storage impossible."
      );
    } finally {
      setStorageTesting(false);
    }
  };

  const runStorageBackupNow = async () => {
    setBackupRunning(true);
    setBackupMessage("");
    try {
      const result = await adminRunStorageBackup();
      setBackupMessage(
        `Sauvegarde terminée : ${result.result.summary.sourceObjects} objet(s) analysé(s), ${result.result.summary.uploaded} copié(s), ${result.result.summary.unchanged} inchangé(s).`
      );
      const [nextStatus, nextReadiness] = await Promise.all([
        getAdminStorageBackupStatus().catch(() => null),
        getReleaseReadiness().catch(() => null)
      ]);
      setBackupStatus(nextStatus);
      setReadiness(nextReadiness);
    } catch (error) {
      setBackupMessage(
        error instanceof Error ? error.message : "Sauvegarde impossible."
      );
    } finally {
      setBackupRunning(false);
    }
  };

  const runBuilderE2E = async () => {
    setMessage("");
    setBuilderE2EError("");
    setBuilderE2EResult(null);
    setBuilderE2ERunning(true);
    try {
      const result = await adminRunBuilderE2E(true);
      setBuilderE2EResult(result);
      await load();
    } catch (error) {
      setBuilderE2EError(
        error instanceof Error ? error.message : "Recette E2E impossible."
      );
    } finally {
      setBuilderE2ERunning(false);
    }
  };

  const syncManagedDomain = async (domain: AdminManagedDomain) => {
    setMessage("");
    setManagedDomainBusy(domain.id);
    try {
      const result = await adminSyncManagedDomain(domain.id);
      await load();
      if (result.verified) {
        setMessage(`${domain.hostname} est vérifié, DNS opérationnel et activé.`);
      } else {
        const instructions = result.verification
          .map((item) => [item.type, item.domain, item.value].filter(Boolean).join(" · "))
          .filter(Boolean);
        setMessage(
          instructions.length
            ? `DNS ELTARA à configurer pour ${domain.hostname} : ${instructions.join(" | ")}`
            : result.ownershipVerified
              ? `${domain.hostname} est rattaché à Vercel mais le DNS public n’est pas encore opérationnel.`
              : `${domain.hostname} est encore en attente de vérification.`
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Préparation du sous-domaine impossible.");
    } finally {
      setManagedDomainBusy(null);
    }
  };

  const inviteBetaMember = async () => {
    const email = betaEmail.trim();
    if (!email) return;
    setMessage("");
    setBetaInviteBusy(true);
    try {
      const result = await adminInviteBetaMember(email, betaDurationDays, betaLocale);
      setBetaEmail("");
      await load();
      setMessage(
        result.invited
          ? `Invitation Beta Tester envoyée à ${result.member.email} avec accès BUILD + Growth complet pendant ${betaDurationDays} jours.`
          : `${result.member.email} dispose maintenant de l’accès Beta Tester BUILD + Growth complet pour ${betaDurationDays} jours, sans nouvel e-mail.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invitation bêta impossible.");
    } finally {
      setBetaInviteBusy(false);
    }
  };

  const renewBetaMember = async (email: string, locale: "fr" | "en") => {
    setMessage("");
    setBetaInviteBusy(true);
    try {
      const result = await adminInviteBetaMember(email, betaDurationDays, locale);
      await load();
      setMessage(
        `Accès Beta Tester renouvelé pour ${result.member.email} pendant ${betaDurationDays} jours.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Renouvellement bêta impossible."
      );
    } finally {
      setBetaInviteBusy(false);
    }
  };

  const removeBetaMember = async (userId: string) => {
    setMessage("");
    setBetaInviteBusy(true);
    try {
      await adminRemoveBetaMember(userId);
      await load();
      setMessage("Statut Beta Tester retiré. Le compte ELTARA et ses sites ne sont pas supprimés ; les droits reviennent immédiatement à l’offre réelle.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retrait impossible.");
    } finally {
      setBetaInviteBusy(false);
    }
  };

  const changeFeedback = async (
    id: string,
    status: "new" | "reviewed" | "planned" | "done"
  ) => {
    setMessage("");
    try {
      await adminSetFeedbackStatus(id, status);
      await load();
      setMessage("Retour mis à jour.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mise à jour impossible.");
    }
  };

  const changePlan = async (siteId: string, userId: string, plan: "free" | "essential" | "growth") => {
    setMessage("");
    try {
      await adminSetPlan(siteId, userId, plan);
      await load();
      setMessage("Offre mise à jour.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mise à jour impossible.");
    }
  };

  const betaCriticalKeys = new Set([
    "supabase-public",
    "supabase-server",
    "openai",
    "app-url",
    "deployment-sha",
    "vercel-domain",
    "managed-subdomains",
    "bucket-site-media",
    "bucket-site-private-media"
  ]);
  const betaCriticalChecks =
    readiness?.checks.filter(
      (item) => item.scope === "beta" && betaCriticalKeys.has(item.key)
    ) || [];
  const betaCriticalIssues = betaCriticalChecks.filter(
    (item) => item.status !== "pass"
  );
  const betaWarnings =
    readiness?.checks.filter(
      (item) => item.scope === "beta" && item.status === "warn" && !betaCriticalKeys.has(item.key)
    ) || [];
  const betaTechnicalReady =
    Boolean(readiness) &&
    betaCriticalChecks.length === betaCriticalKeys.size &&
    betaCriticalIssues.length === 0 &&
    readiness!.summary.blocker === 0;
  const betaMemberCount = betaCohort?.members.length ?? 0;
  const betaActivatedCount =
    betaCohort?.members.filter((item) => item.lastSignInAt).length ?? 0;
  const betaFullAccessCount =
    betaCohort?.members.filter((item) => item.accessActive).length ?? 0;
  const betaConsistencyIssues = betaCohort?.consistencyIssues ?? 0;
  const betaPublishedCount =
    betaCohort?.members.filter((item) => ["published", "complete"].includes(item.betaStage)).length ?? 0;
  const betaCompletedCount =
    betaCohort?.members.filter((item) => item.betaStage === "complete").length ?? 0;
  const betaFollowUpCount =
    betaCohort?.members.filter((item) => item.needsFollowUp).length ?? 0;
  const betaTargetReached = betaMemberCount >= 5 && betaMemberCount <= 10;
  const betaInviteAllowed =
    betaTechnicalReady &&
    betaMemberCount < Math.min(betaCohort?.limit ?? 25, 10);

  return (
    <AdminShell
      active="overview"
      eyebrow="ELTARA Administration"
      title="Pilotage du parc de sites"
      description="Vue opérationnelle des sites, offres, domaines, bêta et prérequis de mise en production. L’accès reste contrôlé en base par un rôle administrateur dédié."
      actions={
        <Link className="button secondary admin-compact-action" href="/">
          Tableau de bord
        </Link>
      }
    >
      {state === "loading" ? <p>Chargement…</p> : null}
      {state === "denied" ? (
        <section className="panel admin-access-denied">
          <h2>Accès restreint</h2>
          <p>
            Le compte actuellement connecté n’a pas le rôle administrateur. Le rôle admin est
            enregistré dans Supabase et reste donc valable depuis n’importe quel ordinateur ou
            navigateur.
          </p>
          <p>
            Si vous êtes sur un autre poste ou connecté avec un compte de test, utilisez le bouton
            ci-dessous puis saisissez l’adresse de votre compte administrateur.
          </p>
          <div className="actions">
            <Link className="button primary" href="/admin/login">
              Se connecter / changer de compte administrateur
            </Link>
            <Link className="button secondary" href="/">
              Retour au tableau de bord
            </Link>
          </div>
          <small className="admin-access-security-note">
            Aucun rôle administrateur n’est attribué automatiquement depuis le navigateur.
          </small>
        </section>
      ) : null}

      {state === "ready" && metrics ? (
        <section className="admin-metrics">
          <article><b>{metrics.publishes30d}</b><span>publications · 30 j</span></article>
          <article><b>{metrics.architectApplies30d}</b><span>applications IA · 30 j</span></article>
          <article><b>{metrics.events30d}</b><span>événements produit · 30 j</span></article>
          <article><b>{metrics.feedbackOpen}</b><span>retours à traiter</span></article>
        </section>
      ) : null}
      {state === "ready" && readiness ? (
        <section className={"panel beta-launch-gate " + (betaTechnicalReady ? "is-ready" : "is-blocked")}>
          <div className="admin-readiness-heading">
            <div>
              <p className="eyebrow">Gate bêta privée</p>
              <h2>{betaTechnicalReady ? "Socle technique prêt" : "Invitation suspendue"}</h2>
              <p>
                {betaTechnicalReady
                  ? "Les prérequis critiques de la bêta sont validés. Vous pouvez constituer une cohorte de 5 à 10 testeurs sans attendre les fonctions commerciales différées."
                  : "Au moins un prérequis technique critique n’est pas validé. Les invitations restent désactivées jusqu’à correction."}
              </p>
            </div>
            <div className="beta-side-metrics">
              <span><b>{betaCriticalChecks.filter((item) => item.status === "pass").length}/{betaCriticalKeys.size}</b> contrôles critiques</span>
              <span><b>{betaMemberCount}/5–10</b> testeurs</span>
              <span><b>{betaActivatedCount}</b> activés</span>
            </div>
          </div>

          <div className="beta-gate-grid">
            <article className={betaTechnicalReady ? "pass" : "blocker"}>
              <b>{betaTechnicalReady ? "✓ Technique" : "× Technique"}</b>
              <span>{betaTechnicalReady ? "Prêt pour une bêta privée." : betaCriticalIssues.length + " contrôle(s) critique(s) à corriger."}</span>
            </article>
            <article className={betaTargetReached ? "pass" : "warn"}>
              <b>{betaTargetReached ? "✓ Cohorte" : "○ Cohorte"}</b>
              <span>{betaTargetReached ? "Taille cible atteinte." : "Encore " + Math.max(0, 5 - betaMemberCount) + " testeur(s) pour atteindre le minimum de 5."}</span>
            </article>
            <article className={betaWarnings.length ? "warn" : "pass"}>
              <b>{betaWarnings.length ? betaWarnings.length + " avertissement(s)" : "✓ Aucun avertissement"}</b>
              <span>{betaWarnings.length ? "Non bloquants pour la bêta privée ; à traiter avant activation des flux concernés." : "Aucun warning bêta restant."}</span>
            </article>
          </div>

          {betaCriticalIssues.length ? (
            <div className="beta-gate-issues">
              {betaCriticalIssues.map((item) => (
                <p key={item.key}><b>{item.label}</b> — {item.detail}</p>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {state === "ready" ? (
        <section className="panel admin-managed-domains">
          <div className="admin-readiness-heading">
            <div>
              <p className="eyebrow">Publication ELTARA</p>
              <h2>Sous-domaines gérés</h2>
              <p>
                La préparation DNS des nouvelles adresses <code>*.eltara.ajgsolutionsgroup.com</code>
                reste pilotée par l’administration. Les anciens sous-domaines *.voyage.ajgsolutionsgroup.com restent compatibles pendant la transition. Les bêta-testeurs n’ont rien à configurer.
              </p>
            </div>
            <div className="beta-side-metrics">
              <span><b>{managedDomains.length}</b> sous-domaines</span>
              <span><b>{managedDomains.filter((item) => item.verificationStatus === "verified").length}</b> vérifiés</span>
              <span><b>{managedDomains.filter((item) => item.verificationStatus !== "verified").length}</b> à préparer</span>
            </div>
          </div>

          {managedDomains.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Adresse ELTARA</th>
                    <th>État</th>
                    <th>Primaire</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {managedDomains.map((domain) => (
                    <tr key={domain.id}>
                      <td><b>{domain.slug}</b><small>{domain.siteStatus}</small></td>
                      <td>{domain.hostname}</td>
                      <td>
                        {domain.verificationStatus === "verified"
                          ? "Vérifié"
                          : domain.verificationStatus === "failed"
                            ? "Échec"
                            : "En attente"}
                      </td>
                      <td>{domain.isPrimary ? "Oui" : "Non"}</td>
                      <td>
                        <button
                          type="button"
                          className="text-button"
                          disabled={managedDomainBusy !== null}
                          onClick={() => void syncManagedDomain(domain)}
                        >
                          {managedDomainBusy === domain.id
                            ? "Vérification…"
                            : domain.verificationStatus === "verified"
                              ? "Recontrôler"
                              : "Préparer / vérifier"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="plans-note">Aucun sous-domaine ELTARA à préparer pour le moment.</p>
          )}
        </section>
      ) : null}

      {state === "ready" ? (
        <section className="panel admin-beta-cohort">
          <div className="admin-readiness-heading">
            <div>
              <p className="eyebrow">Bêta privée</p>
              <h2>Beta Testers · accès BUILD + Growth complet gratuit</h2>
              <p>
                Chaque testeur reçoit temporairement tous les droits BUILD + Growth — Concepteur IA,
                domaine personnalisé, quotas renforcés et fonctions payantes — sans créer
                d’abonnement Stripe. À expiration, les droits reviennent automatiquement à
                l’offre réelle du compte.
              </p>
            </div>
            <div className="beta-side-metrics">
              <span><b>{betaCohort?.members.length ?? 0}</b> comptes bêta</span>
              <span><b>{betaActivatedCount}</b> activés</span>
              <span><b>{betaFullAccessCount}</b> accès complets actifs</span>
              <span><b>{betaConsistencyIssues}</b> incohérence{betaConsistencyIssues > 1 ? "s" : ""}</span>
              <span><b>{betaPublishedCount}</b> publiés</span>
              <span><b>{betaCompletedCount}</b> missions terminées</span>
              <span><b>{betaFollowUpCount}</b> à relancer</span>
            </div>
          </div>

          <form
            className="beta-invite-form"
            onSubmit={(event) => {
              event.preventDefault();
              void inviteBetaMember();
            }}
          >
            <label className="field">
              <span>Adresse e-mail du testeur</span>
              <input
                type="email"
                autoComplete="email"
                value={betaEmail}
                onChange={(event) => setBetaEmail(event.target.value)}
                placeholder="testeur@exemple.fr"
                disabled={betaInviteBusy}
              />
            </label>
            <label className="field beta-duration-field">
              <span>Langue du testeur</span>
              <select
                value={betaLocale}
                onChange={(event) => setBetaLocale(event.target.value === "en" ? "en" : "fr")}
                disabled={betaInviteBusy}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="field beta-duration-field">
              <span>Accès complet</span>
              <select
                value={betaDurationDays}
                onChange={(event) => setBetaDurationDays(Number(event.target.value))}
                disabled={betaInviteBusy}
              >
                <option value={14}>14 jours</option>
                <option value={30}>30 jours</option>
                <option value={45}>45 jours</option>
                <option value={60}>60 jours</option>
                <option value={90}>90 jours</option>
              </select>
            </label>
            <button
              type="submit"
              className="button primary"
              disabled={betaInviteBusy || !betaEmail.trim() || !betaInviteAllowed}
              title={!betaTechnicalReady ? "Les prérequis techniques critiques doivent être prêts avant d’inviter." : betaMemberCount >= 10 ? "La cohorte cible est limitée à 10 testeurs pour cette phase." : undefined}
            >
              {betaInviteBusy ? "Traitement…" : "Inviter comme Beta Tester"}
            </button>
          </form>
          <p className="plans-note">
            Le statut Beta Tester est un grant temporaire indépendant de Stripe et ne crée
            aucune facturation. Un nouveau compte reçoit l’invitation Supabase dans la langue sélectionnée et arrive dans ELTARA dans cette même langue ; un compte ELTARA
            existant reçoit immédiatement les droits Pro et la préférence de langue associée. La durée est renouvelable depuis
            cette page. Cette phase reste volontairement plafonnée à 10 testeurs.
          </p>

          {betaCohort?.members.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Testeur</th>
                    <th>Progression</th>
                    <th>Site / activité</th>
                    <th>Accès</th>
                    <th>Expiration</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {betaCohort.members.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <b>{item.email}</b>
                        <small className="admin-cell-note">
                          invité le {new Date(item.invitedAt || item.createdAt).toLocaleDateString("fr-FR")}
                        </small>
                      </td>
                      <td>
                        <span className={
                          "status-badge " +
                          (item.betaStage === "complete"
                            ? "success"
                            : item.needsFollowUp
                              ? "warning"
                              : item.betaStage === "published"
                                ? "success"
                                : "muted")
                        }>
                          {item.betaStage === "complete"
                            ? "Mission terminée"
                            : item.betaStage === "published"
                              ? "Publié · retour attendu"
                              : item.betaStage === "building"
                                ? "Création en cours"
                                : item.betaStage === "activated"
                                  ? "Compte activé"
                                  : "Invitation en attente"}
                        </span>
                        {item.needsFollowUp && item.followUpReason ? (
                          <small className="admin-cell-note beta-follow-up-note">
                            À relancer · {item.followUpReason}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <b>{item.siteSlug || "—"}</b>
                        <small className="admin-cell-note">
                          {item.siteStatus === "published"
                            ? "Publié"
                            : item.siteId
                              ? "Brouillon"
                              : "Aucun site"}
                          {" · "}
                          {item.productEventCount} événement{item.productEventCount > 1 ? "s" : ""}
                          {" · "}
                          {item.aiEventCount} IA
                          {" · "}
                          {item.feedbackCount} retour{item.feedbackCount > 1 ? "s" : ""}
                        </small>
                        {item.lastActivityAt ? (
                          <small className="admin-cell-note">
                            dernière activité {new Date(item.lastActivityAt).toLocaleDateString("fr-FR")}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <span className={item.accessActive ? "status-badge success" : "status-badge muted"}>
                          {item.accessActive ? "BUILD + Growth actif" : "Expiré / retiré"}
                        </span>
                        {!item.cohortConsistent ? (
                          <small className="admin-cell-note beta-follow-up-note">
                            Configuration incomplète · réconcilier le statut bêta
                          </small>
                        ) : null}
                      </td>
                      <td>
                        {item.accessExpiresAt
                          ? new Date(item.accessExpiresAt).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td>
                        <div className="admin-inline-actions">
                          <button
                            type="button"
                            className="text-button"
                            disabled={betaInviteBusy}
                            onClick={() => void renewBetaMember(item.email, item.locale)}
                          >
                            {!item.cohortConsistent ? "Réconcilier l’accès" : `Renouveler ${betaDurationDays} j`}
                          </button>
                          <button
                            type="button"
                            className="text-button danger"
                            disabled={betaInviteBusy || !item.accessActive}
                            onClick={() => void removeBetaMember(item.id)}
                          >
                            Retirer l’accès
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="plans-note">Aucun testeur n’est encore inscrit dans la cohorte bêta.</p>
          )}
        </section>
      ) : null}

      {state === "ready" ? (
        <section className="panel admin-beta-funnel">
          <div className="admin-readiness-heading">
            <div>
              <p className="eyebrow">Bêta · 30 derniers jours</p>
              <h2>Funnel d’activation</h2>
              <p>
                Mesure sur utilisateurs distincts connectés. Les taux sont descriptifs :
                avec une petite cohorte, ils servent à repérer une friction, pas à tirer une
                conclusion statistique.
              </p>
            </div>
            {betaMetrics ? (
              <div className="beta-side-metrics">
                <span><b>{betaMetrics.cohort.size}</b> comptes cohorte</span>
                <span><b>{betaMetrics.cohort.activated}</b> activés</span>
                <span><b>{betaMetrics.ai.generations}</b> générations IA</span>
                <span><b>{betaMetrics.feedback.count}</b> retours</span>
                <span><b>{betaMetrics.feedback.averageRating ?? "—"}</b> note moyenne</span>
                <span><b>{betaMetrics.feedback.byExperience.essential.count}</b> retours Essentiel</span>
                <span><b>{betaMetrics.feedback.byExperience.growth.count}</b> retours Growth</span>
              </div>
            ) : null}
          </div>

          {betaMetrics ? (
            <>
              <div className="beta-plan-journey-grid">
                <article>
                  <span>1</span>
                  <b>{betaMetrics.betaExperience.essentialTesters}</b>
                  <strong>Essentiel testé</strong>
                  <small>{betaMetrics.cohort.size ? Math.round((betaMetrics.betaExperience.essentialTesters / betaMetrics.cohort.size) * 100) : 0} % de la cohorte</small>
                </article>
                <article>
                  <span>2</span>
                  <b>{betaMetrics.betaExperience.growthTesters}</b>
                  <strong>Growth testé</strong>
                  <small>{betaMetrics.cohort.size ? Math.round((betaMetrics.betaExperience.growthTesters / betaMetrics.cohort.size) * 100) : 0} % de la cohorte</small>
                </article>
                <article>
                  <span>✓</span>
                  <b>{betaMetrics.betaExperience.essentialThenGrowth}</b>
                  <strong>Essentiel → Growth</strong>
                  <small>{betaMetrics.betaExperience.orderedCompletionRate} % de la cohorte dans l’ordre demandé</small>
                </article>
              </div>

              <div className="beta-feedback-context-grid">
                <article>
                  <span>RUN</span>
                  <b>{betaMetrics.feedback.byExperience.essential.count}</b>
                  <strong>Feedback Essentiel</strong>
                  <small>note moyenne {betaMetrics.feedback.byExperience.essential.averageRating ?? "—"}/5</small>
                </article>
                <article>
                  <span>RUN + GROW</span>
                  <b>{betaMetrics.feedback.byExperience.growth.count}</b>
                  <strong>Feedback Growth</strong>
                  <small>note moyenne {betaMetrics.feedback.byExperience.growth.averageRating ?? "—"}/5</small>
                </article>
                <article>
                  <span>?</span>
                  <b>{betaMetrics.feedback.byExperience.unknown}</b>
                  <strong>Contexte non attribué</strong>
                  <small>anciens retours ou mode non instrumenté</small>
                </article>
              </div>

              <div className="beta-funnel-grid">
                <article>
                  <span>1</span>
                  <b>{betaMetrics.funnel.opened}</b>
                  <strong>Ouverture</strong>
                  <small>100 % base</small>
                </article>
                <article>
                  <span>2</span>
                  <b>{betaMetrics.funnel.engaged}</b>
                  <strong>Engagement</strong>
                  <small>{betaMetrics.funnel.engagementRate} % des ouvertures</small>
                </article>
                <article>
                  <span>3</span>
                  <b>{betaMetrics.funnel.reviewed}</b>
                  <strong>Revue</strong>
                  <small>{betaMetrics.funnel.reviewRate} % des ouvertures</small>
                </article>
                <article>
                  <span>4</span>
                  <b>{betaMetrics.funnel.published}</b>
                  <strong>Publication</strong>
                  <small>{betaMetrics.funnel.publishRate} % des ouvertures</small>
                </article>
              </div>

              <div className="beta-step-funnel-grid">
                <article><span>1</span><b>{betaMetrics.funnel.steps.identity}</b><strong>Identité</strong><small>{Math.max(0, betaMetrics.funnel.opened - betaMetrics.funnel.steps.identity)} abandon(s) après ouverture</small></article>
                <article><span>2</span><b>{betaMetrics.funnel.steps.story}</b><strong>Message</strong><small>{betaMetrics.funnel.dropOffs.identityToStory} abandon(s) depuis Identité</small></article>
                <article><span>3</span><b>{betaMetrics.funnel.steps.design}</b><strong>Style</strong><small>{betaMetrics.funnel.dropOffs.storyToDesign} abandon(s) depuis Message</small></article>
                <article><span>4</span><b>{betaMetrics.funnel.steps.booking}</b><strong>Rendez-vous</strong><small>{betaMetrics.funnel.dropOffs.designToBooking} abandon(s) depuis Style</small></article>
                <article><span>5</span><b>{betaMetrics.funnel.steps.options}</b><strong>Options</strong><small>{betaMetrics.funnel.dropOffs.bookingToOptions} abandon(s) depuis Rendez-vous</small></article>
                <article><span>6</span><b>{betaMetrics.funnel.steps.review}</b><strong>Revue</strong><small>{betaMetrics.funnel.dropOffs.optionsToReview} abandon(s) depuis Options</small></article>
                <article><span>7</span><b>{betaMetrics.funnel.steps.published}</b><strong>Publié</strong><small>{betaMetrics.funnel.dropOffs.reviewToPublished} abandon(s) depuis Revue</small></article>
              </div>

              <div className="beta-observation-grid">
                <article>
                  <b>{betaMetrics.funnel.openedWithoutEngagement}</b>
                  <span>ouvertures sans engagement détecté</span>
                </article>
                <article>
                  <b>{betaMetrics.funnel.openedWithoutPublication}</b>
                  <span>ouvertures sans publication sur la période</span>
                </article>
                <article>
                  <b>{betaMetrics.ai.users}</b>
                  <span>utilisateurs ayant consommé de l’IA</span>
                </article>
                <article>
                  <b>{betaMetrics.sites.active}</b>
                  <span>sites avec activité instrumentée</span>
                </article>
              </div>

              <div className="onboarding-path-metrics">
                <div className="premium-ai-metrics-heading">
                  <div>
                    <p className="eyebrow">Onboarding · choix de parcours</p>
                    <h3>Le parcours IA accélère-t-il réellement la publication ?</h3>
                    <p>Le premier choix explicite est attribué au parcours Manuel ou Création IA. Le délai est calculé jusqu’à la première publication observée après ce choix.</p>
                  </div>
                  <span>{betaMetrics.onboardingPaths.totalSelections} choix mesuré{betaMetrics.onboardingPaths.totalSelections > 1 ? "s" : ""}</span>
                </div>
                <div className="onboarding-path-kpis">
                  <article>
                    <span>Manuel</span>
                    <b>{betaMetrics.onboardingPaths.manual.publishRate} %</b>
                    <strong>publient après ce choix</strong>
                    <small>{betaMetrics.onboardingPaths.manual.published} / {betaMetrics.onboardingPaths.manual.selected} · médiane {betaMetrics.onboardingPaths.manual.medianHoursToPublish ?? "—"} h</small>
                  </article>
                  <article>
                    <span>Création IA</span>
                    <b>{betaMetrics.onboardingPaths.ai.publishRate} %</b>
                    <strong>publient après ce choix</strong>
                    <small>{betaMetrics.onboardingPaths.ai.published} / {betaMetrics.onboardingPaths.ai.selected} · médiane {betaMetrics.onboardingPaths.ai.medianHoursToPublish ?? "—"} h</small>
                  </article>
                  <article>
                    <span>Mix</span>
                    <b>{betaMetrics.onboardingPaths.aiShare} %</b>
                    <strong>choisissent l’IA</strong>
                    <small>Sur les premiers choix explicites mesurés</small>
                  </article>
                </div>
              </div>

              <div className="premium-ai-metrics">
                <div className="premium-ai-metrics-heading">
                  <div>
                    <p className="eyebrow">Architecte Premium · qualité réelle</p>
                    <h3>La première proposition convainc-elle ?</h3>
                    <p>
                      Ces événements ne stockent ni le brief ni le contenu du client. Ils mesurent
                      uniquement la génération, la régénération, le raffinement interne et
                      l’application d’une proposition.
                    </p>
                  </div>
                  <span>{betaMetrics.ai.architect.requests} demande{betaMetrics.ai.architect.requests > 1 ? "s" : ""} Premium</span>
                </div>
                <div className="premium-ai-kpis">
                  <article>
                    <b>{betaMetrics.ai.architect.userAdoptionRate} %</b>
                    <strong>adoption utilisateurs</strong>
                    <small>{betaMetrics.ai.architect.appliedUsers} / {betaMetrics.ai.architect.users} utilisateurs ont appliqué une proposition</small>
                  </article>
                  <article>
                    <b>{betaMetrics.ai.architect.regenerationRate} %</b>
                    <strong>régénérations</strong>
                    <small>{betaMetrics.ai.architect.regenerations} nouvelle{betaMetrics.ai.architect.regenerations > 1 ? "s" : ""} proposition{betaMetrics.ai.architect.regenerations > 1 ? "s" : ""} demandée{betaMetrics.ai.architect.regenerations > 1 ? "s" : ""}</small>
                  </article>
                  <article>
                    <b>{betaMetrics.ai.architect.refinementRate} %</b>
                    <strong>raffinement automatique</strong>
                    <small>{betaMetrics.ai.architect.refinements} proposition{betaMetrics.ai.architect.refinements > 1 ? "s" : ""} corrigée{betaMetrics.ai.architect.refinements > 1 ? "s" : ""} après audit interne</small>
                  </article>
                  <article>
                    <b>{betaMetrics.ai.architect.applicationRate} %</b>
                    <strong>applications / tentatives</strong>
                    <small>{betaMetrics.ai.architect.applications} application{betaMetrics.ai.architect.applications > 1 ? "s" : ""} pour {betaMetrics.ai.architect.attempts} tentative{betaMetrics.ai.architect.attempts > 1 ? "s" : ""}</small>
                  </article>
                  <article>
                    <b>{betaMetrics.ai.architect.failureRate} %</b>
                    <strong>échecs du pipeline</strong>
                    <small>{betaMetrics.ai.architect.failures} demande{betaMetrics.ai.architect.failures > 1 ? "s" : ""} sans proposition exploitable sur {betaMetrics.ai.architect.requests}</small>
                  </article>
                </div>
                <div className="premium-ai-human-eval">
                  <div>
                    <b>Évaluation directe des propositions</b>
                    <p>
                      Signal explicite donné par les utilisateurs après lecture d’une proposition,
                      sans enregistrer leur brief ni le texte généré.
                    </p>
                  </div>
                  <div className="premium-ai-human-eval-kpis">
                    <span>
                      <b>{betaMetrics.ai.architect.humanEvaluation.positiveRate} %</b>
                      propositions jugées pertinentes
                    </span>
                    <span>
                      <b>{betaMetrics.ai.architect.humanEvaluation.responseRate} %</b>
                      taux de réponse
                    </span>
                    <span>
                      <b>{betaMetrics.ai.architect.humanEvaluation.positive}</b>
                      évaluations positives
                    </span>
                    <span>
                      <b>{betaMetrics.ai.architect.humanEvaluation.negative}</b>
                      à améliorer
                    </span>
                  </div>
                  {betaMetrics.ai.architect.humanEvaluation.reasons.length ? (
                    <div className="premium-ai-human-eval-reasons">
                      <span>Motifs principaux des évaluations « à améliorer »</span>
                      <div>
                        {betaMetrics.ai.architect.humanEvaluation.reasons.map((item) => (
                          <em key={item.reason}>
                            <b>{item.count}</b> {item.reason}
                          </em>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="premium-ai-provider">
                  <div>
                    <b>Empreinte technique Premium</b>
                    <p>
                      Mesure serveur sans prompt ni contenu client. Les prix ne sont volontairement
                      pas figés ici : les tokens permettront de recalculer le coût avec le tarif
                      fournisseur en vigueur au moment de la décision commerciale.
                    </p>
                  </div>
                  <div className="premium-ai-provider-kpis">
                    <span><b>{betaMetrics.ai.architect.provider.avgCallsPerAttempt}</b> appels modèle / tentative</span>
                    <span><b>{new Intl.NumberFormat("fr-FR").format(betaMetrics.ai.architect.provider.avgTokensPerAttempt)}</b> tokens / tentative</span>
                    <span><b>{(betaMetrics.ai.architect.provider.avgDurationMsPerCall / 1000).toFixed(1)} s</b> / appel en moyenne</span>
                    <span><b>{new Intl.NumberFormat("fr-FR").format(betaMetrics.ai.architect.provider.cachedInputTokens)}</b> tokens d’entrée mis en cache</span>
                    <span><b>{betaMetrics.ai.architect.provider.avgStrategyCallsPerRequest}</b> analyse stratégique / demande</span>
                    <span><b>{betaMetrics.ai.architect.provider.estimatedCostUsd.toFixed(4)} $</b> coût fournisseur estimé / 30 j</span>
                    <span><b>{betaMetrics.ai.architect.provider.avgCostUsdPerCall.toFixed(5)} $</b> coût moyen / appel</span>
                    {betaMetrics.ai.architect.provider.unpricedCalls ? <span><b>{betaMetrics.ai.architect.provider.unpricedCalls}</b> appel(s) sans tarif connu</span> : null}
                  </div>
                  {betaMetrics.ai.architect.provider.byModel.length ? (
                    <div className="premium-ai-models">
                      {betaMetrics.ai.architect.provider.byModel.map((item) => (
                        <span key={item.model}>
                          <b>{item.model}</b>
                          {item.calls} appel{item.calls > 1 ? "s" : ""} · {new Intl.NumberFormat("fr-FR").format(item.totalTokens)} tokens
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="premium-ai-provider">
                  <div>
                    <b>Empreinte technique IA standard</b>
                    <p>
                      Même principe de mesure minimale : aucun prompt ni texte client n’est stocké.
                      L’objectif est de suivre la latence et les tokens du parcours guidé, des champs,
                      des relectures et des rubriques.
                    </p>
                  </div>
                  <div className="premium-ai-provider-kpis">
                    <span><b>{betaMetrics.ai.standard.provider.calls}</b> appels modèle</span>
                    <span><b>{new Intl.NumberFormat("fr-FR").format(betaMetrics.ai.standard.provider.avgTokensPerCall)}</b> tokens / appel</span>
                    <span><b>{(betaMetrics.ai.standard.provider.avgDurationMsPerCall / 1000).toFixed(1)} s</b> / appel en moyenne</span>
                    <span><b>{new Intl.NumberFormat("fr-FR").format(betaMetrics.ai.standard.provider.cachedInputTokens)}</b> tokens d’entrée mis en cache</span>
                    <span><b>{betaMetrics.ai.standard.provider.estimatedCostUsd.toFixed(4)} $</b> coût fournisseur estimé / 30 j</span>
                    <span><b>{betaMetrics.ai.standard.provider.avgCostUsdPerCall.toFixed(5)} $</b> coût moyen / appel</span>
                    {betaMetrics.ai.standard.provider.unpricedCalls ? <span><b>{betaMetrics.ai.standard.provider.unpricedCalls}</b> appel(s) sans tarif connu</span> : null}
                  </div>
                  {betaMetrics.ai.standard.provider.byOperation.length ? (
                    <div className="premium-ai-models">
                      {betaMetrics.ai.standard.provider.byOperation.map((item) => (
                        <span key={item.operation}>
                          <b>{standardAiOperationLabel[item.operation] || item.operation}</b>
                          {item.calls} appel{item.calls > 1 ? "s" : ""} · {new Intl.NumberFormat("fr-FR").format(item.totalTokens)} tokens
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <p className="plans-note">
                  Sur une petite cohorte, ces taux servent à détecter une tendance, pas à conclure
                  statistiquement. Une baisse des régénérations combinée à une hausse de l’adoption
                  sera le signal principal d’amélioration de la première proposition.
                </p>
              </div>

              {betaMetrics.sites.activity.length ? (
                <div className="beta-site-activity">
                  <h3>Activité récente par site</h3>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Site</th>
                          <th>Étape atteinte</th>
                          <th>Événements</th>
                          <th>IA appliquée</th>
                          <th>Feedback</th>
                          <th>Offres testées</th>
                          <th>Dernière activité</th>
                        </tr>
                      </thead>
                      <tbody>
                        {betaMetrics.sites.activity.map((item) => (
                          <tr key={item.siteId}>
                            <td><b>{item.slug}</b><small>{item.status}</small></td>
                            <td>{stageLabel[item.stage]}</td>
                            <td>{item.eventCount}</td>
                            <td>{item.aiApplyCount}</td>
                            <td>{item.feedbackCount}</td>
                            <td>
                              <small>
                                {item.betaEssentialTested ? "Essentiel ✓" : "Essentiel —"}
                                {" · "}
                                {item.betaGrowthTested ? "Growth ✓" : "Growth —"}
                              </small>
                            </td>
                            <td>{new Date(item.lastActivity).toLocaleDateString("fr-FR")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="plans-note">
                  Aucune activité bêta instrumentée sur les 30 derniers jours. Le tableau se
                  remplira automatiquement dès les prochains tests.
                </p>
              )}

              {betaMetrics.cohort.scope === "all" ? (
                <p className="plans-note">
                  Aucune cohorte bêta n’est encore définie : les chiffres affichés couvrent
                  temporairement tous les utilisateurs. Dès la première invitation bêta, le
                  dashboard sera automatiquement isolé sur la cohorte.
                </p>
              ) : null}

              <details className="beta-definitions">
                <summary>Définitions des étapes</summary>
                {Object.entries(betaMetrics.definitions).map(([key, value]) => (
                  <p key={key}><b>{key}</b> — {value}</p>
                ))}
              </details>
            </>
          ) : (
            <p className="plans-note">Les métriques bêta serveur sont indisponibles dans cet environnement.</p>
          )}
        </section>
      ) : null}

      {state === "ready" ? (
        <section className="panel admin-readiness">
          <div className="admin-readiness-heading">
            <div>
              <p className="eyebrow">Release readiness</p>
              <h2>Préproduction</h2>
              <p>
                Contrôle serveur des prérequis techniques. Les secrets ne sont jamais renvoyés
                au navigateur : seul leur état de configuration est affiché.
              </p>
            </div>
            {readiness ? (
              <div className="readiness-summary" aria-label="Résumé préproduction">
                <span className="pass">{readiness.summary.pass} prêts</span>
                <span className="warn">{readiness.summary.warn} à vérifier</span>
                <span className="blocker">{readiness.summary.blocker} bloquants</span>
                {readiness.summary.deferred ? (
                  <span className="deferred">{readiness.summary.deferred} différés</span>
                ) : null}
              </div>
            ) : null}
          </div>

          {readiness ? (
            <>
              <div className="readiness-list">
                {readiness.checks.map((item) => (
                  <article className={"readiness-row " + item.status} key={item.key}>
                    <div className="readiness-row-heading">
                      <span>
                        <b>{item.label}</b>
                        <small>{item.scope === "beta" ? "Bêta" : "Commercial"}</small>
                      </span>
                      <em>{readinessLabel[item.status]}</em>
                    </div>
                    <p>{item.detail}</p>
                    {item.key === "bucket-site-private-media" && item.status === "blocker" ? (
                      <button
                        type="button"
                        className="button secondary readiness-action"
                        disabled={storageBootstrapping}
                        onClick={() => void bootstrapPrivateStorage()}
                      >
                        {storageBootstrapping ? "Initialisation…" : "Initialiser le Storage privé"}
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
              <div className="builder-actions">
                <button
                  type="button"
                  className="button secondary"
                  disabled={storageTesting || readiness.checks.some((item) => item.key === "bucket-site-private-media" && item.status === "blocker")}
                  onClick={() => void testPrivateStorageFlow()}
                >
                  {storageTesting
                    ? "Test Storage en cours…"
                    : storageTestOk
                      ? "Flux Storage validé ✓"
                      : "Tester le flux média privé → public"}
                </button>
              </div>
              {storageTestMessage ? (
                <p
                  className="plans-note"
                  role="status"
                  aria-live="polite"
                  data-state={storageTestOk ? "success" : "error"}
                >
                  {storageTestMessage}
                </p>
              ) : null}
              <p className="admin-readiness-meta">
                Environnement : <b>{readiness.environment}</b>
                {readiness.commitSha ? <> · commit <code>{readiness.commitSha.slice(0, 12)}</code></> : null}
                {" · "}contrôle {new Date(readiness.generatedAt).toLocaleString("fr-FR")}
              </p>
            </>
          ) : (
            <p className="plans-note">
              Le diagnostic serveur n’est pas disponible dans cet environnement. Le reste du
              back-office demeure utilisable.
            </p>
          )}
        </section>
      ) : null}

      {state === "ready" ? (
        <section className="panel admin-readiness">
          <div className="admin-readiness-heading">
            <div>
              <p className="eyebrow">Continuité</p>
              <h2>Sauvegarde externe des médias</h2>
              <p>
                Copie privée hors Supabase des buckets publics et privés. Le cron
                quotidien reste actif ; ce contrôle permet aussi de lancer une
                sauvegarde manuelle dès que le store Blob est connecté.
              </p>
            </div>
            <div className="readiness-summary">
              <span className={
                backupStatus?.status === "healthy"
                  ? "pass"
                  : backupStatus?.status === "critical"
                    ? "blocker"
                    : backupStatus?.configured
                      ? "warn"
                      : "deferred"
              }>
                {backupStatus?.status === "healthy"
                  ? "Saine"
                  : backupStatus?.status === "critical"
                    ? "Critique"
                    : backupStatus?.configured
                      ? "À vérifier"
                      : "Store à connecter"}
              </span>
            </div>
          </div>

          <div className="backup-admin-grid">
            <article>
              <small>Dernière sauvegarde</small>
              <b>
                {backupStatus?.lastCompletedAt
                  ? new Date(backupStatus.lastCompletedAt).toLocaleString("fr-FR")
                  : "Aucune"}
              </b>
            </article>
            <article>
              <small>Âge</small>
              <b>
                {typeof backupStatus?.ageHours === "number"
                  ? `${backupStatus.ageHours.toFixed(1)} h`
                  : "—"}
              </b>
            </article>
            <article>
              <small>Objets source</small>
              <b>{backupStatus?.sourceObjects ?? "—"}</b>
            </article>
            <article>
              <small>Rétention</small>
              <b>{backupStatus?.retentionDays ?? 35} j</b>
            </article>
          </div>

          <div className="builder-actions">
            <button
              type="button"
              className="button secondary"
              disabled={backupRunning || backupStatus?.configured !== true}
              onClick={() => void runStorageBackupNow()}
            >
              {backupRunning ? "Sauvegarde en cours…" : "Lancer une sauvegarde maintenant"}
            </button>
          </div>

          {backupStatus?.configured !== true ? (
            <p className="plans-note">
              Connectez d’abord le store Vercel Blob privé au projet Production.
              Le bouton s’activera automatiquement après redéploiement.
            </p>
          ) : null}
          {backupMessage ? (
            <p className="plans-note" role="status">{backupMessage}</p>
          ) : null}
        </section>
      ) : null}

      {state === "ready" ? (
        <section className="panel admin-readiness">
          <div className="admin-readiness-heading">
            <div>
              <p className="eyebrow">Recette E2E</p>
              <h2>Parcours ELTARA complet</h2>
              <p>
                Crée un site temporaire isolé, lui attribue un droit Pro interne éphémère,
                consomme une génération AI Site Architect, teste un média privé, publie,
                contrôle le rendu public, enregistre un feedback, génère l’archive de récupération
                puis supprime toutes les données temporaires.
              </p>
            </div>
          </div>
          <div className="builder-actions">
            <button
              type="button"
              className="button primary"
              disabled={builderE2ERunning}
              onClick={() => void runBuilderE2E()}
            >
              {builderE2ERunning
                ? "Recette E2E en cours…"
                : builderE2EResult
                  ? "Recette E2E validée ✓"
                  : "Lancer la recette E2E complète"}
            </button>
          </div>
          <p className="admin-readiness-meta">
            Ce contrôle consomme exactement une génération IA réelle. Le droit Pro est limité
            au site temporaire de recette et disparaît avec lui. Ton offre réelle, le site existant,
            le feedback et les médias hors recette ne sont pas modifiés.
          </p>
          {builderE2EError ? (
            <p className="plans-note" role="alert" data-state="error">
              {builderE2EError}
            </p>
          ) : null}
          {builderE2EResult ? (
            <div className="readiness-list">
              {builderE2EResult.steps.map((item) => (
                <article
                  className={"readiness-row " + (item.status === "pass" ? "pass" : "deferred")}
                  key={item.key}
                >
                  <div className="readiness-row-heading">
                    <span><b>{item.label}</b><small>E2E</small></span>
                    <em>{item.status === "pass" ? "Validé" : "Ignoré"}</em>
                  </div>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {state === "ready" ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>État</th>
                <th>Offre</th>
                <th>Domaine personnalisé</th>
                <th>Dernière mise à jour</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><b>{row.slug}</b><small>{row.ownerId.slice(0, 8)}…</small></td>
                  <td>{row.status}</td>
                  <td>
                    <select
                      value={row.planKey}
                      onChange={(event) =>
                        void changePlan(row.id, row.ownerId, event.target.value as "free" | "essential" | "growth")
                      }
                    >
                      <option value="free">Gratuit</option>
                      <option value="essential">Essentiel</option>
                      <option value="growth">Growth</option>
                    </select>
                  </td>
                  <td>
                    {row.customDomain || "—"}
                    {row.domainStatus ? <small>{row.domainStatus}</small> : null}
                  </td>
                  <td>{new Date(row.updatedAt).toLocaleDateString("fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state === "ready" && feedback.length ? (
        <section className="admin-feedback">
          <h2>Derniers retours bêta</h2>
          {feedback.map((item) => (
            <article key={item.id}>
              <div>
                <b>{item.category} · {item.rating ? item.rating + "/5" : "sans note"}</b>
                <small>{new Date(item.createdAt).toLocaleDateString("fr-FR")}</small>
              </div>
              <p>{item.message}</p>
              <select
                value={item.status}
                onChange={(event) =>
                  void changeFeedback(
                    item.id,
                    event.target.value as "new" | "reviewed" | "planned" | "done"
                  )
                }
              >
                <option value="new">Nouveau</option>
                <option value="reviewed">Analysé</option>
                <option value="planned">Planifié</option>
                <option value="done">Traité</option>
              </select>
            </article>
          ))}
        </section>
      ) : null}

      {message ? <p className="admin-flash" role="status">{message}</p> : null}
    </AdminShell>
  );
}
