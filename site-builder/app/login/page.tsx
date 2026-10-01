"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase-browser";
import { useProductLocale } from "../../lib/product-i18n";
import { LanguageSwitch } from "../../components/LanguageSwitch";
import { getPrivateBetaAccess } from "../../lib/private-beta-access";

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

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return;
      const access = await getPrivateBetaAccess().catch(() => null);
      router.replace(access?.allowed ? "/builder" : "/beta-access");
    });
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError(tr("Supabase n’est pas encore configuré dans cet environnement.", "Supabase is not configured in this environment yet."));
      return;
    }

    setState("sending");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + `/builder?lang=${locale}`,
        shouldCreateUser: false
      }
    });

    if (authError) {
      setState("idle");
      setError(
        tr(
          "La bêta privée est accessible sur invitation. Vérifiez que vous utilisez exactement l’adresse invitée.",
          "The private beta is invitation-only. Make sure you are using the exact email address that was invited."
        )
      );
      return;
    }
    setState("sent");
  };

  return (
    <main className="auth-page premium-auth-page">
      <section className="auth-visual" aria-label="AJG Site Builder">
        <div className="auth-visual-overlay" />
        <div className="auth-brand-row"><Link href="/" className="auth-brand">AJG Site Builder</Link><LanguageSwitch compact /></div>
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
                <p>{tr("Le lien de connexion vient d’être envoyé à", "A sign-in link has been sent to")} {email}.</p>
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
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={locale === "en" ? "you@example.com" : "vous@exemple.fr"}
                  />
                </div>
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <button className="button primary auth-submit premium-button" disabled={state === "sending"}>
                {state === "sending" ? tr("Envoi…", "Sending…") : tr("Recevoir mon lien de connexion", "Send me a sign-in link")}
                {state !== "sending" ? <span aria-hidden="true">→</span> : null}
              </button>
            </form>
          )}

          <div className="auth-card-footer">
            <Link className="text-link" href="/">← {tr("Retour à l’accueil", "Back to home")}</Link>
            <span>{tr("Lien sécurisé · accès personnel", "Secure link · personal access")}</span>
          </div>
        </div>
      </section>
    </main>
  );
}
