"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase-browser";
import { useProductLocale } from "../../lib/product-i18n";
import { LanguageSwitch } from "../../components/LanguageSwitch";
import { EltaraBrand } from "../../components/EltaraBrand";
import { getPrivateBetaAccess } from "../../lib/private-beta-access";

const CLIENT_AUTH_TIMEOUT_MS = 15_000;

async function withClientAuthDeadline<T>(work: Promise<T>): Promise<T> {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timeout = window.setTimeout(
          () => reject(new Error("client_auth_timeout")),
          CLIENT_AUTH_TIMEOUT_MS
        );
      })
    ]);
  } finally {
    if (timeout !== undefined) window.clearTimeout(timeout);
  }
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6.5h16v11H4z" />
      <path d="m5 7.5 7 5 7-5" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 19 6v5c0 4.5-2.7 7.8-7 10-4.3-2.2-7-5.5-7-10V6l7-3Z" />
      <path d="m9.4 12 1.8 1.8 3.5-3.8" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { locale, tr } = useProductLocale();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const sending = useRef(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;

    void withClientAuthDeadline(supabase.auth.getSession())
      .then(async ({ data }) => {
        if (!active || !data.session) return;
        const access = await withClientAuthDeadline(getPrivateBetaAccess()).catch(() => null);
        if (active && access) router.replace(access.allowed ? "/builder" : "/beta-access");
      })
      .catch(() => {
        // Session inspection is advisory. A stalled read must not block manual login.
      });

    return () => {
      active = false;
    };
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending.current || state === "sent") return;
    setError("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError(tr("Supabase n’est pas encore configuré dans cet environnement.", "Supabase is not configured in this environment yet."));
      return;
    }

    sending.current = true;
    setState("sending");
    const requestedEmail = email.trim();
    try {
      const { error: authError } = await withClientAuthDeadline(supabase.auth.signInWithOtp({
        email: requestedEmail,
        options: {
          emailRedirectTo: window.location.origin + `/builder?lang=${locale}`,
          shouldCreateUser: false
        }
      }));

      if (authError) {
        setState("idle");
        setError(tr(
          "La demande de connexion n’a pas abouti. Vérifiez votre boîte mail, votre connexion et l’adresse invitée avant de réessayer.",
          "The sign-in request did not complete. Check your inbox, connection and invited email address before trying again."
        ));
        return;
      }
      setSubmittedEmail(requestedEmail);
      setState("sent");
    } catch {
      // An interrupted response cannot establish whether the email was sent.
      // Never retry automatically or expose raw provider details.
      setState("idle");
      setError(tr(
        "L’envoi n’a pas pu être confirmé. Vérifiez votre boîte mail et les indésirables avant de réessayer.",
        "We could not confirm that the link was sent. Check your inbox and spam folder before trying again."
      ));
    } finally {
      sending.current = false;
    }
  };

  return (
    <main className="auth-page premium-auth-page">
      <section className="auth-visual" aria-label="ELTARA">
        <div className="auth-visual-overlay" />
        <div className="auth-brand-row"><Link href="/" className="auth-brand"><EltaraBrand compact /></Link><LanguageSwitch compact /></div>
        <div className="auth-visual-copy">
          <p className="eyebrow">{tr("Création guidée · publication simplifiée", "Guided creation · simplified publishing")}</p>
          <h1>{tr("Créez votre présence en ligne sans partir de zéro", "Build your online presence without starting from scratch")}</h1>
          <p>{tr(
            "Votre identité, votre histoire et vos rendez-vous réunis dans un site cohérent, maintenable et prêt à évoluer.",
            "Bring your identity, story and bookings together in a coherent, maintainable website built to evolve."
          )}</p>
          <div className="auth-benefits">
            <span><ShieldIcon /> {tr("Conformité centralisée", "Centralized compliance")}</span>
            <span><MailIcon /> {tr("Connexion sans mot de passe", "Passwordless sign-in")}</span>
          </div>
        </div>
        <span className="auth-orbit" aria-hidden="true" />
        <span className="auth-star" aria-hidden="true">✦</span>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-card premium-auth-card">
          <div className="auth-card-heading">
            <p className="eyebrow">{tr("Bêta privée · sur invitation", "Private beta · invitation only")}</p>
            <h2>{tr("Connexion", "Sign in")}</h2>
            <p>{tr("Utilisez l’adresse email invitée pour recevoir votre lien sécurisé. Aucun mot de passe à retenir.", "Use the invited email address to receive your secure sign-in link. No password to remember.")}</p>
          </div>

          {!isSupabaseConfigured() ? (
            <div className="helper-card premium-helper-card">
              <b>{tr("Mode prototype local", "Local prototype mode")}</b>
              <p>{tr("Les variables Supabase ne sont pas encore renseignées dans cet environnement.", "Supabase variables are not configured in this environment yet.")}</p>
            </div>
          ) : null}

          {state === "sent" ? (
            <div className="success-card premium-success-card">
              <span className="success-icon"><MailIcon /></span>
              <div>
                <b>{tr("Vérifiez votre boîte mail", "Check your inbox")}</b>
                <p>{tr("Si cette adresse est autorisée, vous recevrez un lien de connexion à", "If this address is authorized, you will receive a sign-in link at")} {submittedEmail}. {tr("Pensez à vérifier les indésirables.", "Please also check your spam folder.")}</p>
              </div>
            </div>
          ) : (
            <form className="premium-auth-form" onSubmit={submit}>
              <label className="field premium-field">
                <span>{tr("Adresse email", "Email address")}</span>
                <div className="input-with-icon">
                  <MailIcon />
                  <input
                    type="email"
                    autoComplete="email"
                    disabled={state === "sending"}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={locale === "en" ? "you@example.com" : "vous@exemple.fr"}
                  />
                </div>
              </label>
              {error ? <p className="form-error" role="alert">{error}</p> : null}
              <button className="button primary auth-submit premium-button" disabled={state === "sending"}>
                {state === "sending" ? tr("Envoi…", "Sending…") : tr("Recevoir mon lien de connexion", "Send me a sign-in link")}
                {state !== "sending" ? <span aria-hidden="true">→</span> : null}
              </button>
            </form>
          )}

          <div className="auth-card-footer">
            <Link className="text-link" href="/">← {tr("Retour à l’accueil", "Back to home")}</Link>
            <Link className="text-link" href="/admin/login">{tr("Accès administrateur", "Administrator access")} →</Link>
            <span>{tr("Lien sécurisé · accès personnel", "Secure link · personal access")}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
