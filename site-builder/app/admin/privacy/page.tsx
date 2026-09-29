"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isCurrentUserAdmin } from "../../../lib/admin";
import { getSupabaseBrowserClient } from "../../../lib/supabase-browser";

type PrivacyRequest = {
  id: string;
  scope: "site" | "account";
  status: "requested" | "processing" | "completed" | "canceled";
  requestedAt: string;
  processingStartedAt: string | null;
  completedAt: string | null;
  userId: string | null;
  siteId: string | null;
  email: string;
  siteSlug: string;
  systemsProcessed: string[];
  hasProcessingError: boolean;
};

function statusLabel(status: PrivacyRequest["status"]) {
  if (status === "processing") return "Traitement à reprendre";
  if (status === "completed") return "Traitée";
  if (status === "canceled") return "Annulée";
  return "À traiter";
}

async function authToken() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase n'est pas configuré.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Votre session a expiré.");
  }
  return data.session.access_token;
}

export default function AdminPrivacyPage() {
  const [requests, setRequests] = useState<PrivacyRequest[]>([]);
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  const load = async () => {
    if (!await isCurrentUserAdmin()) {
      setState("denied");
      return;
    }
    const token = await authToken();
    const response = await fetch("/api/admin/privacy-erasure", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error || "Demandes RGPD indisponibles.");
    }
    setRequests(result.requests || []);
    setState("ready");
  };

  useEffect(() => {
    void load().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Erreur.");
      setState("denied");
    });
  }, []);

  async function processRequest(request: PrivacyRequest) {
    const confirmation = window.prompt(
      "Cette purge est irréversible. Recopiez exactement PURGER pour continuer."
    );
    if (confirmation !== "PURGER") return;

    setBusy(request.id);
    setMessage("");
    try {
      const token = await authToken();
      const response = await fetch("/api/admin/privacy-erasure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId: request.id,
          confirmation
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result?.error || "Purge non finalisée.");
      }
      setMessage(
        result.alreadyCompleted
          ? "Cette demande était déjà finalisée."
          : `Purge terminée · ${result.sitesPurged || 0} site(s) supprimé(s).`
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "La purge n’a pas été finalisée."
      );
      await load().catch(() => undefined);
    } finally {
      setBusy("");
    }
  }

  if (state === "loading") {
    return (
      <main className="plans-page">
        <p className="plans-note">Chargement des demandes RGPD…</p>
      </main>
    );
  }

  if (state === "denied") {
    return (
      <main className="plans-page">
        <section className="plans-hero">
          <p className="eyebrow">Administration</p>
          <h1>Accès refusé</h1>
          <Link className="button secondary" href="/builder">
            Retour au Builder
          </Link>
        </section>
        {message ? <p className="plans-note">{message}</p> : null}
      </main>
    );
  }

  return (
    <main className="plans-page">
      <section className="plans-hero">
        <p className="eyebrow">Administration · RGPD</p>
        <h1>Demandes d’effacement</h1>
        <p>
          Une demande suspend déjà les sites concernés. La purge ci-dessous
          annule les abonnements applicables, détache les domaines, supprime
          les médias via Storage, purge les données du Builder puis supprime
          l’identité Auth pour une demande de compte.
        </p>
        <div className="builder-actions">
          <Link className="button secondary" href="/admin">← Administration</Link>
          <Link className="button secondary" href="/builder">Builder</Link>
        </div>
      </section>

      <div className="privacy-admin-warning">
        <b>Action irréversible.</b>
        <p>
          Les données de service du Builder sont supprimées. Les pièces ou
          écritures financières qui doivent rester chez le prestataire de
          paiement ne sont pas effacées aveuglément par ce workflow.
        </p>
      </div>

      {message ? <p className="plans-note" role="status">{message}</p> : null}

      <section className="privacy-admin-list">
        {requests.map((request) => (
          <article className="privacy-admin-card" key={request.id}>
            <div className="privacy-admin-card-heading">
              <div>
                <span className={"privacy-admin-status " + request.status}>
                  {statusLabel(request.status)}
                </span>
                <h2>
                  {request.scope === "account"
                    ? "Suppression du compte"
                    : "Effacement d’un site"}
                </h2>
                <p>
                  {request.email || "Compte déjà supprimé / pseudonymisé"}
                  {request.siteSlug ? ` · /${request.siteSlug}` : ""}
                </p>
              </div>
              <small>
                {new Intl.DateTimeFormat("fr-FR", {
                  dateStyle: "medium",
                  timeStyle: "short"
                }).format(new Date(request.requestedAt))}
              </small>
            </div>

            {request.hasProcessingError ? (
              <p className="privacy-admin-retry">
                Une tentative précédente n’a pas été finalisée. Le site reste
                verrouillé ; la purge peut être reprise.
              </p>
            ) : null}

            {request.systemsProcessed.length ? (
              <div className="privacy-admin-systems">
                <b>Systèmes traités</b>
                <div>
                  {request.systemsProcessed.map((system) => (
                    <span key={system}>{system}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {["requested", "processing"].includes(request.status) ? (
              <button
                type="button"
                className="button secondary"
                disabled={busy === request.id}
                onClick={() => void processRequest(request)}
              >
                {busy === request.id
                  ? "Purge en cours…"
                  : request.status === "processing"
                    ? "Reprendre la purge"
                    : "Exécuter la purge"}
              </button>
            ) : null}
          </article>
        ))}

        {!requests.length ? (
          <section className="panel">
            <p>Aucune demande d’effacement n’est enregistrée.</p>
          </section>
        ) : null}
      </section>
    </main>
  );
}
