"use client";

import { useEffect, useMemo, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { useProductLocale } from "../../lib/product-i18n";
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

export default function DataRightsPage() {
  const { locale, tr } = useProductLocale();
  const requestLabel = (request: DataErasureRequest) => {
    if (request.status === "processing") return tr("Traitement en cours", "Processing");
    if (request.status === "completed") return tr("Traitée", "Completed");
    if (request.status === "canceled") return tr("Annulée", "Canceled");
    return tr("Demande reçue", "Request received");
  };
  const [sites, setSites] = useState<RemoteSite[]>([]);
  const [requests, setRequests] = useState<DataErasureRequest[]>([]);
  const [email, setEmail] = useState("");
  const [siteConfirmations, setSiteConfirmations] = useState<Record<string, string>>({});
  const [accountConfirmation, setAccountConfirmation] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState(tr("Chargement…", "Loading…"));

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
      setMessage(tr("Impossible de charger votre espace de données.", "Unable to load your data area."))
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
      setMessage(`${tr("Archive de", "Archive for")} « ${site.slug} » ${tr("préparée.", "prepared.")}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tr("Export impossible.", "Export unavailable."));
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
    <AccountShell
      active="data"
      eyebrow={tr("Confidentialité & données", "Privacy & data")}
      title={tr("Mes données", "My data")}
      description={tr("Exportez vos données ou demandez leur effacement. Une demande d’effacement reste distincte d’un impayé : un problème de paiement ne supprime jamais automatiquement vos sites.", "Export your data or request erasure. An erasure request is separate from a failed payment: payment issues never automatically delete your websites.")}
    >
      {message ? <p className="account-note" role="status">{message}</p> : null}

      <section className="panel data-rights-panel">
        <div>
          <p className="eyebrow">{tr("Portabilité", "Portability")}</p>
          <h2>{tr("Exporter mes sites", "Export my websites")}</h2>
          <p>{tr("L’archive contient la configuration du site, ses contenus, domaines, messages de contact et médias publics/privés disponibles.", "The archive contains the website configuration, content, domains, contact messages and available public/private media.")}</p>
        </div>
        <div className="data-rights-site-list">
          {sites.map((site) => {
            const pending = openSiteRequests.has(site.id) || Boolean(openAccountRequest);
            return (
              <article className="data-rights-site" key={site.id}>
                <div>
                  <b>{site.config.brandName || site.slug}</b>
                  <small>/{site.slug}</small>
                  {pending ? <span className="data-rights-status">{tr("Effacement demandé", "Erasure requested")}</span> : null}
                </div>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busyKey === "export:" + site.id}
                  onClick={() => void exportSite(site)}
                >
                  {busyKey === "export:" + site.id ? tr("Préparation…", "Preparing…") : tr("Télécharger mon archive", "Download my archive")}
                </button>
              </article>
            );
          })}
          {!sites.length && !message ? <p>{tr("Aucun site n’est associé à ce compte.", "No website is associated with this account.")}</p> : null}
        </div>
      </section>

      <section className="panel data-rights-panel">
        <div>
          <p className="eyebrow">{tr("Droit à l’effacement", "Right to erasure")}</p>
          <h2>{tr("Demander l’effacement d’un site", "Request website erasure")}</h2>
          <p>{tr("La demande retire immédiatement le site du public et bloque les nouvelles modifications et collectes. La purge définitive des données est exécutée séparément afin de contrôler les systèmes concernés et les éventuelles obligations de conservation.", "The request immediately removes the website from public access and blocks new changes and collection. Final deletion is processed separately so affected systems and any retention obligations can be checked.")}</p>
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
                      ? tr("Une demande est déjà en cours.", "A request is already in progress.")
                      : `${tr("Recopiez", "Type")} « ${site.slug} » ${tr("pour confirmer.", "to confirm.")}`}
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
                        ? tr("Enregistrement…", "Saving…")
                        : tr("Demander l’effacement", "Request erasure")}
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
          <p className="eyebrow">AJG Builder</p>
          <h2>{tr("Demander la suppression de mon compte", "Request account deletion")}</h2>
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
              {tr("Reçue le", "Received on")} {new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { dateStyle: "long" }).format(new Date(openAccountRequest.requestedAt))}
            </small>
          </div>
        ) : (
          <div className="data-rights-account-confirm">
            <label>
              <span>{tr("Recopiez votre adresse e-mail pour confirmer", "Type your email address to confirm")}</span>
              <input
                type="email"
                value={accountConfirmation}
                onChange={(event) => setAccountConfirmation(event.target.value)}
                placeholder={email || (locale === "en" ? "you@example.com" : "vous@exemple.fr")}
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
                ? tr("Enregistrement…", "Saving…")
                : tr("Demander la suppression du compte", "Request account deletion")}
            </button>
          </div>
        )}
      </section>

      <section className="plans-note data-rights-note">
        <b>{tr("Ce que cette page ne fait pas :", "What this page does not do:")}</b> un impayé, une carte expirée ou un
        non-renouvellement n’efface jamais automatiquement vos données. Les
        règles de suspension de facturation et les demandes d’effacement restent
        deux mécanismes séparés.
      </section>

      <section className="plans-note data-rights-note">
        <b>{tr("Conservation légale limitée :", "Limited legal retention:")}</b> une suppression de compte efface les
        données nécessaires au fonctionnement du Builder, mais certaines pièces
        comptables peuvent devoir être conservées séparément lorsqu’une obligation
        légale l’impose. En France, les factures et autres pièces justificatives
        comptables sont conservées 10 ans à compter de la clôture de l’exercice.
        Cette exception ne permet pas de conserver le contenu du site ou ses médias.
      </section>
    </AccountShell>
  );
}
