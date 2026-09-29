"use client";

import { useEffect, useMemo, useState } from "react";
import { AccountShell } from "../../components/AccountShell";
import { useUiLanguage } from "../../components/LanguageProvider";
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

function requestLabel(request: DataErasureRequest, en: boolean) {
  if (request.status === "processing") return en ? "Processing" : "Traitement en cours";
  if (request.status === "completed") return en ? "Completed" : "Traitée";
  if (request.status === "canceled") return en ? "Canceled" : "Annulée";
  return en ? "Request received" : "Demande reçue";
}

export default function DataRightsPage() {
  const { locale } = useUiLanguage();
  const en = locale === "en";
  const [sites, setSites] = useState<RemoteSite[]>([]);
  const [requests, setRequests] = useState<DataErasureRequest[]>([]);
  const [email, setEmail] = useState("");
  const [siteConfirmations, setSiteConfirmations] = useState<Record<string, string>>({});
  const [accountConfirmation, setAccountConfirmation] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [message, setMessage] = useState(en ? "Loading…" : "Chargement…");

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
      setMessage(en ? "Your data area could not be loaded." : "Impossible de charger votre espace de données.")
    );
  }, [en]);

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
      setMessage(en ? `Archive for “${site.slug}” is ready.` : `Archive de « ${site.slug} » préparée.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? "Export unavailable." : "Export impossible."));
    } finally {
      setBusyKey("");
    }
  }

  async function requestSiteErasure(site: RemoteSite) {
    const confirmation = siteConfirmations[site.id]?.trim() || "";
    if (confirmation !== site.slug) return;
    if (
      !window.confirm(
        en
          ? `The website “${site.slug}” will immediately be taken offline and locked while the request is processed. Continue?`
          : `Le site « ${site.slug} » sera immédiatement retiré du public et verrouillé pendant le traitement de la demande. Continuer ?`
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
        en
          ? "Request recorded. The website has been taken offline and new changes are blocked while it is processed."
          : "Demande enregistrée. Le site est retiré du public et ses nouvelles mutations sont bloquées pendant le traitement."
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : (en ? "The request could not be recorded." : "Impossible d’enregistrer la demande.")
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
        en
          ? "All your websites will immediately be taken offline and locked while your erasure request is processed. Continue?"
          : "Tous vos sites seront immédiatement retirés du public et verrouillés pendant le traitement de votre demande d’effacement. Continuer ?"
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
        en
          ? "Account deletion request recorded. Your websites are offline while the request is processed."
          : "Demande de suppression du compte enregistrée. Vos sites sont retirés du public pendant le traitement."
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : (en ? "The request could not be recorded." : "Impossible d’enregistrer la demande.")
      );
    } finally {
      setBusyKey("");
    }
  }

  return (
    <AccountShell
      active="data"
      eyebrow={en ? "Privacy & data" : "Confidentialité & données"}
      title={en ? "My data" : "Mes données"}
      description={en
        ? "Export your data or request erasure. An erasure request is separate from billing: a payment issue never automatically deletes your websites."
        : "Exportez vos données ou demandez leur effacement. Une demande d’effacement reste distincte d’un impayé : un problème de paiement ne supprime jamais automatiquement vos sites."}
    >
      {message ? <p className="account-note" role="status">{message}</p> : null}

      <section className="panel data-rights-panel">
        <div>
          <p className="eyebrow">{en ? "Portability" : "Portabilité"}</p>
          <h2>{en ? "Export my websites" : "Exporter mes sites"}</h2>
          <p>{en
            ? "The archive contains the website configuration, content, domains, contact messages and available public/private media."
            : "L’archive contient la configuration du site, ses contenus, domaines, messages de contact et médias publics/privés disponibles."}</p>
        </div>
        <div className="data-rights-site-list">
          {sites.map((site) => {
            const pending = openSiteRequests.has(site.id) || Boolean(openAccountRequest);
            return (
              <article className="data-rights-site" key={site.id}>
                <div>
                  <b>{site.config.brandName || site.slug}</b>
                  <small>/{site.slug}</small>
                  {pending ? <span className="data-rights-status">{en ? "Erasure requested" : "Effacement demandé"}</span> : null}
                </div>
                <button
                  type="button"
                  className="button secondary"
                  disabled={busyKey === "export:" + site.id}
                  onClick={() => void exportSite(site)}
                >
                  {busyKey === "export:" + site.id
                    ? (en ? "Preparing…" : "Préparation…")
                    : (en ? "Download my archive" : "Télécharger mon archive")}
                </button>
              </article>
            );
          })}
          {!sites.length && !message ? <p>{en ? "No website is associated with this account." : "Aucun site n’est associé à ce compte."}</p> : null}
        </div>
      </section>

      <section className="panel data-rights-panel">
        <div>
          <p className="eyebrow">{en ? "Right to erasure" : "Droit à l’effacement"}</p>
          <h2>{en ? "Request website erasure" : "Demander l’effacement d’un site"}</h2>
          <p>{en
            ? "The request immediately takes the website offline and blocks new changes and collection. Final deletion is handled separately so affected systems and any legal retention duties can be checked."
            : "La demande retire immédiatement le site du public et bloque les nouvelles modifications et collectes. La purge définitive des données est exécutée séparément afin de contrôler les systèmes concernés et les éventuelles obligations de conservation."}</p>
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
                      ? (en ? "A request is already in progress." : "Une demande est déjà en cours.")
                      : (en ? `Type “${site.slug}” to confirm.` : `Recopiez « ${site.slug} » pour confirmer.`)}
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
                        ? (en ? "Saving…" : "Enregistrement…")
                        : (en ? "Request erasure" : "Demander l’effacement")}
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
          <p className="eyebrow">{en ? "AJG Builder account" : "Compte AJG Builder"}</p>
          <h2>{en ? "Request account deletion" : "Demander la suppression de mon compte"}</h2>
          <p>{en
            ? "This request applies to the entire account. All websites are taken offline immediately. Your sign-in identity is deleted only after dependencies and data that may need legal retention have been handled."
            : "Cette demande concerne l’ensemble du compte. Tous les sites sont retirés du public immédiatement. L’identité de connexion n’est supprimée qu’après traitement des dépendances et des données qui doivent éventuellement être conservées pour une obligation légale."}</p>
        </div>
        {openAccountRequest ? (
          <div className="data-rights-request-state">
            <b>{requestLabel(openAccountRequest, en)}</b>
            <small>
              {en ? "Received on" : "Reçue le"} {new Intl.DateTimeFormat(en ? "en-GB" : "fr-FR", { dateStyle: "long" }).format(new Date(openAccountRequest.requestedAt))}
            </small>
          </div>
        ) : (
          <div className="data-rights-account-confirm">
            <label>
              <span>{en ? "Type your email address to confirm" : "Recopiez votre adresse e-mail pour confirmer"}</span>
              <input
                type="email"
                value={accountConfirmation}
                onChange={(event) => setAccountConfirmation(event.target.value)}
                placeholder={email || (en ? "you@example.com" : "vous@exemple.fr")}
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
                ? (en ? "Saving…" : "Enregistrement…")
                : (en ? "Request account deletion" : "Demander la suppression du compte")}
            </button>
          </div>
        )}
      </section>

      <section className="plans-note data-rights-note">
        {en ? (
          <><b>What this page does not do:</b> a failed payment, expired card or non-renewal never automatically deletes your data. Billing suspension and erasure requests remain separate mechanisms.</>
        ) : (
          <><b>Ce que cette page ne fait pas :</b> un impayé, une carte expirée ou un non-renouvellement n’efface jamais automatiquement vos données. Les règles de suspension de facturation et les demandes d’effacement restent deux mécanismes séparés.</>
        )}
      </section>

      <section className="plans-note data-rights-note">
        {en ? (
          <><b>Limited legal retention:</b> deleting an account removes data needed to operate the Builder, but some accounting records may need to be retained separately when required by law. In France, invoices and supporting accounting documents are retained for 10 years from the end of the financial year. This exception does not allow website content or media to be retained.</>
        ) : (
          <><b>Conservation légale limitée :</b> une suppression de compte efface les données nécessaires au fonctionnement du Builder, mais certaines pièces comptables peuvent devoir être conservées séparément lorsqu’une obligation légale l’impose. En France, les factures et autres pièces justificatives comptables sont conservées 10 ans à compter de la clôture de l’exercice. Cette exception ne permet pas de conserver le contenu du site ou ses médias.</>
        )}
      </section>
    </AccountShell>
  );
}
