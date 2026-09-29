"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/AdminShell";
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
  const [e2eBusy, setE2eBusy] = useState(false);

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

  async function runPrivacyE2E() {
    const confirmation = window.prompt(
      "Cette recette crée puis détruit uniquement un compte de test jetable. Recopiez exactement TESTER pour continuer."
    );
    if (confirmation !== "TESTER") return;

    setE2eBusy(true);
    setMessage("");
    try {
      const token = await authToken();
      const response = await fetch("/api/admin/privacy-e2e", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok !== true) {
        throw new Error(
          result?.detail
            ? `${result.error || "Recette RGPD échouée."} · ${result.stage || "étape inconnue"} · ${result.detail}`
            : result?.error || "Recette RGPD échouée."
        );
      }
      setMessage(
        `Recette RGPD E2E validée · ${result.steps?.length || 0} contrôles passés · aucun contenu du compte jetable conservé.`
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Recette RGPD échouée."
      );
    } finally {
      setE2eBusy(false);
    }
  }

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
      <AdminShell
        active="privacy"
        eyebrow="Administration · RGPD"
        title="Demandes d’effacement"
        description="Chargement du registre et des contrôles de purge."
      >
        <p className="admin-empty-state">Chargement des demandes RGPD…</p>
      </AdminShell>
    );
  }

  if (state === "denied") {
    return (
      <AdminShell
        active="privacy"
        eyebrow="Administration"
        title="Accès refusé"
        description="Cette zone est réservée aux comptes disposant du rôle administrateur."
      >
        {message ? <p className="admin-flash" role="alert">{message}</p> : null}
      </AdminShell>
    );
  }

  return (
    <AdminShell
      active="privacy"
      eyebrow="Administration · RGPD"
      title="Demandes d’effacement"
      description="Une demande suspend déjà les sites concernés. La purge annule les abonnements applicables, détache les domaines, supprime les médias et données du Builder puis l’identité Auth pour une demande de compte."
    >
      <div className="privacy-admin-warning">
        <b>Action irréversible.</b>
        <p>
          Les données de service du Builder sont supprimées. Les pièces ou
          écritures financières qui doivent rester chez le prestataire de
          paiement ne sont pas effacées aveuglément par ce workflow.
        </p>
      </div>

      <section className="panel privacy-e2e-panel">
        <div>
          <p className="eyebrow">Recette interne</p>
          <h2>Vérifier l’effacement de bout en bout</h2>
          <p>
            Crée un compte et un site entièrement jetables, ajoute des médias
            public/privé, déclenche une demande de suppression de compte puis
            vérifie la purge Storage, base et Supabase Auth. Aucun compte client
            existant n’est utilisé par ce test.
          </p>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={e2eBusy}
          onClick={() => void runPrivacyE2E()}
        >
          {e2eBusy ? "Recette en cours…" : "Lancer la recette RGPD E2E"}
        </button>
      </section>

      {message ? <p className="admin-flash" role="status">{message}</p> : null}

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
    </AdminShell>
  );
}
