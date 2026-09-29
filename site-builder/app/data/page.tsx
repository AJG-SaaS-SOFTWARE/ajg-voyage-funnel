"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { downloadMySiteExport } from "../../lib/billing-access";
import {
  getMyErasureRequests,
  requestDataErasure,
  type DataErasureRequest
} from "../../lib/data-rights";
import {
  getCurrentUser,
  getMySites,
  type RemoteSite
} from "../../lib/supabase-site-repository";

function requestLabel(request: DataErasureRequest) {
  if (request.status === "processing") return "Traitement en cours";
  if (request.status === "completed") return "Traitée";
  if (request.status === "canceled") return "Annulée";
  return "Demande reçue";
}

export default function DataRightsPage() {
  const [sites, setSites] = useState<RemoteSite[]>([]);
  const [requests, setRequests] = useState<DataErasureRequest[]>([]);
  const [email, setEmail] = useState("");
  const [siteConfirmations, setSiteConfirmations] = useState<Record<string, string>>({});
  const [accountConfirmation, setAccountConfirmation] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState("Chargement…");

  const load = async () => {
    const [user, ownedSites, erasureRequests] = await Promise.all([
      getCurrentUser(),
      getMySites(),
      getMyErasureRequests()
    ]);
    setEmail(user?.email || "");
    setSites(ownedSites);
    setRequests(erasureRequests);
    setMessage("");
  };

  useEffect(() => {
    void load().catch(() =>
      setMessage("Impossible de charger votre espace de données.")
    );
  }, []);

  const openSiteRequests = useMemo(
    () =>
      new Set(
        requests
          .filter(
            (request) =>
              request.scope === "site" &&
              request.siteId &&
              ["requested", "processing"].includes(request.status)
          )
          .map((request) => request.siteId as string)
      ),
    [requests]
  );

  const openAccountRequest = requests.find(
    (request) =>
      request.scope === "account" &&
      ["requested", "processing"].includes(request.status)
  );

  async function exportSite(site: RemoteSite) {
    setBusyKey("export:" + site.id);
    setMessage("");
    try {
      await downloadMySiteExport(site.id);
      setMessage(`Archive de « ${site.slug} » préparée.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export impossible.");
    } finally {
      setBusyKey("");
    }
  }

  async function requestSiteErasure(site: RemoteSite) {
    const confirmation = siteConfirmations[site.id]?.trim() || "";
    if (confirmation !== site.slug) return;
    if (
      !window.confirm(
        `Le site « ${site.slug} » sera immédiatement retiré du public et verrouillé pendant le traitement de la demande. Continuer ?`
      )
    ) return;

    setBusyKey("site:" + site.id);
    setMessage("");
    try {
      await requestDataErasure({
        scope: "site",
        siteId: site.id,
        confirmation
      });
      setMessage(
        "Demande enregistrée. Le site est retiré du public et ses nouvelles mutations sont bloquées pendant le traitement."
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer la demande."
      );
    } finally {
      setBusyKey("");
    }
  }

  async function requestAccountErasure() {
    if (!email || accountConfirmation.trim().toLowerCase() !== email.toLowerCase()) {
      return;
    }
    if (
      !window.confirm(
        "Tous vos sites seront immédiatement retirés du public et verrouillés pendant le traitement de votre demande d’effacement. Continuer ?"
      )
    ) return;

    setBusyKey("account");
    setMessage("");
    try {
      await requestDataErasure({
        scope: "account",
        confirmation: accountConfirmation.trim()
      });
      setMessage(
        "Demande de suppression du compte enregistrée. Vos sites sont retirés du public pendant le traitement."
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer la demande."
      );
    } finally {
      setBusyKey("");
    }
  }

  return (
    <main className="plans-page data-rights-page">
      <section className="plans-hero">
        <p className="eyebrow">Confidentialité & données</p>
        <h1>Mes données</h1>
        <p>
          Exportez vos données ou demandez leur effacement. Une demande
          d’effacement est distincte d’un impayé : un problème de paiement ne
          supprime jamais automatiquement vos sites.
        </p>
        <div className="builder-actions">
          <Link className="button secondary" href="/builder">← Retour au Builder</Link>
          <Link className="button secondary" href="/billing">Facturation & récupération</Link>
        </div>
      </section>

      {message ? <p className="plans-note" role="status">{message}</p> : null}

      <section className="panel data-rights-panel">
        <div>
          <p className="eyebrow">Portabilité</p>
          <h2>Exporter mes sites</h2>
          <p>
            L’archive contient la configuration du site, ses contenus,
            domaines, messages de contact et médias publics/privés disponibles.
          </p>
        </div>
        <div className="data-rights-site-list">
          {sites.map((site) => {
            const pending = openSiteRequests.has(site.id) || Boolean(openAccountRequest);
            return (
              <article className="data-rights-site" key={site.id}>
                <div>
                  <b>{site.config.brandName || site.slug}</b>
                  <small>/{site.slug}</small>
                  {pending ? <span className="data-rights-status">Effacement demandé</span> : null}
                </div>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busyKey === "export:" + site.id}
                  onClick={() => void exportSite(site)}
                >
                  {busyKey === "export:" + site.id ? "Préparation…" : "Télécharger mon archive"}
                </button>
              </article>
            );
          })}
          {!sites.length && !message ? <p>Aucun site n’est associé à ce compte.</p> : null}
        </div>
      </section>

      <section className="panel data-rights-panel">
        <div>
          <p className="eyebrow">Droit à l’effacement</p>
          <h2>Demander l’effacement d’un site</h2>
          <p>
            La demande retire immédiatement le site du public et bloque les
            nouvelles modifications et collectes. La purge définitive des
            données est exécutée séparément afin de contrôler les systèmes
            concernés et les éventuelles obligations de conservation.
          </p>
        </div>
        <div className="data-rights-site-list">
          {sites.map((site) => {
            const pending = openSiteRequests.has(site.id) || Boolean(openAccountRequest);
            return (
              <article className="data-rights-site data-rights-danger" key={"erase-" + site.id}>
                <div>
                  <b>{site.config.brandName || site.slug}</b>
                  <small>
                    {pending
                      ? "Une demande est déjà en cours."
                      : `Recopiez « ${site.slug} » pour confirmer.`}
                  </small>
                </div>
                {!pending ? (
                  <div className="data-rights-confirm">
                    <input
                      value={siteConfirmations[site.id] || ""}
                      onChange={(event) =>
                        setSiteConfirmations((current) => ({
                          ...current,
                          [site.id]: event.target.value
                        }))
                      }
                      placeholder={site.slug}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="button secondary"
                      disabled={
                        busyKey === "site:" + site.id ||
                        siteConfirmations[site.id]?.trim() !== site.slug
                      }
                      onClick={() => void requestSiteErasure(site)}
                    >
                      {busyKey === "site:" + site.id
                        ? "Enregistrement…"
                        : "Demander l’effacement"}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel data-rights-panel data-rights-account">
        <div>
          <p className="eyebrow">Compte AJG Builder</p>
          <h2>Demander la suppression de mon compte</h2>
          <p>
            Cette demande concerne l’ensemble du compte. Tous les sites sont
            retirés du public immédiatement. L’identité de connexion n’est
            supprimée qu’après traitement des dépendances et des données qui
            doivent éventuellement être conservées pour une obligation légale.
          </p>
        </div>
        {openAccountRequest ? (
          <div className="data-rights-request-state">
            <b>{requestLabel(openAccountRequest)}</b>
            <small>
              Reçue le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(openAccountRequest.requestedAt))}
            </small>
          </div>
        ) : (
          <div className="data-rights-account-confirm">
            <label>
              <span>Recopiez votre adresse e-mail pour confirmer</span>
              <input
                type="email"
                value={accountConfirmation}
                onChange={(event) => setAccountConfirmation(event.target.value)}
                placeholder={email || "vous@exemple.fr"}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className="button secondary"
              disabled={
                busyKey === "account" ||
                !email ||
                accountConfirmation.trim().toLowerCase() !== email.toLowerCase()
              }
              onClick={() => void requestAccountErasure()}
            >
              {busyKey === "account"
                ? "Enregistrement…"
                : "Demander la suppression du compte"}
            </button>
          </div>
        )}
      </section>

      <section className="plans-note data-rights-note">
        <b>Ce que cette page ne fait pas :</b> un impayé, une carte expirée ou un
        non-renouvellement n’efface jamais automatiquement vos données. Les
        règles de suspension de facturation et les demandes d’effacement restent
        deux mécanismes séparés.
      </section>

      <section className="plans-note data-rights-note">
        <b>Conservation légale limitée :</b> une suppression de compte efface les
        données nécessaires au fonctionnement du Builder, mais certaines pièces
        comptables peuvent devoir être conservées séparément lorsqu’une obligation
        légale l’impose. En France, les factures et autres pièces justificatives
        comptables sont conservées 10 ans à compter de la clôture de l’exercice.
        Cette exception ne permet pas de conserver le contenu du site ou ses médias.
      </section>
    </main>
  );
}
