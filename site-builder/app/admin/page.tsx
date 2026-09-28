"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  adminSetFeedbackStatus,
  adminSetPlan,
  getAdminFeedback,
  getAdminMetrics,
  getAdminSites,
  getReleaseReadiness,
  isCurrentUserAdmin,
  type AdminFeedback,
  type AdminMetrics,
  type AdminSiteRow,
  type ReleaseReadiness,
  type ReleaseReadinessCheck
} from "../../lib/admin";

const readinessLabel: Record<ReleaseReadinessCheck["status"], string> = {
  pass: "Prêt",
  warn: "À vérifier",
  blocker: "Bloquant",
  deferred: "Différé"
};

export default function AdminPage() {
  const [rows, setRows] = useState<AdminSiteRow[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedback[]>([]);
  const [readiness, setReadiness] = useState<ReleaseReadiness | null>(null);
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

    try {
      setReadiness(await getReleaseReadiness());
    } catch {
      setReadiness(null);
    }

    setState("ready");
  };

  useEffect(() => {
    void load().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Erreur.");
      setState("denied");
    });
  }, []);

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

  const changePlan = async (siteId: string, userId: string, plan: "free" | "pro") => {
    setMessage("");
    try {
      await adminSetPlan(siteId, userId, plan);
      await load();
      setMessage("Offre mise à jour.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mise à jour impossible.");
    }
  };

  return (
    <main className="plans-page">
      <section className="plans-hero">
        <p className="eyebrow">AJG Administration</p>
        <h1>Pilotage du parc de sites</h1>
        <p>
          Vue opérationnelle des sites, offres, domaines et prérequis de mise en production.
          L’accès est contrôlé en base par un rôle administrateur dédié.
        </p>
        <Link className="button secondary" href="/">← Tableau de bord</Link>
      </section>

      {state === "loading" ? <p>Chargement…</p> : null}
      {state === "denied" ? (
        <section className="panel">
          <h2>Accès restreint</h2>
          <p>
            Votre compte n’a pas le rôle administrateur. Aucun rôle n’est attribué
            automatiquement depuis le navigateur.
          </p>
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
                  </article>
                ))}
              </div>
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
                        void changePlan(row.id, row.ownerId, event.target.value as "free" | "pro")
                      }
                    >
                      <option value="free">Gratuit</option>
                      <option value="pro">Pro</option>
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

      {message ? <p className="plans-note" role="status">{message}</p> : null}
    </main>
  );
}
