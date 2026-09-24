"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase-browser";

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
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/builder");
    });
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas encore configuré dans cet environnement.");
      return;
    }

    setState("sending");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + "/builder"
      }
    });

    if (authError) {
      setState("idle");
      setError(authError.message);
      return;
    }
    setState("sent");
  };

  return (
    <main className="auth-page premium-auth-page">
      <section className="auth-visual" aria-label="AJG Site Builder">
        <div className="auth-visual-overlay" />
        <Link href="/" className="auth-brand">AJG Site Builder</Link>
        <div className="auth-visual-copy">
          <p className="eyebrow">Création guidée · publication simplifiée</p>
          <h1>Créez votre présence en ligne sans partir de zéro</h1>
          <p>
            Votre identité, votre histoire, vos rendez-vous et vos voyages réunis dans un site
            cohérent, maintenable et prêt à évoluer.
          </p>
          <div className="auth-benefits">
            <span><ShieldIcon /> Conformité centralisée</span>
            <span><MailIcon /> Connexion sans mot de passe</span>
          </div>
        </div>
        <span className="auth-orbit" aria-hidden="true" />
        <span className="auth-star" aria-hidden="true">✦</span>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-card premium-auth-card">
          <div className="auth-card-heading">
            <p className="eyebrow">Espace membre</p>
            <h2>Connexion</h2>
            <p>Recevez un lien sécurisé par email. Aucun mot de passe à retenir.</p>
          </div>

          {!isSupabaseConfigured() ? (
            <div className="helper-card premium-helper-card">
              <b>Mode prototype local</b>
              <p>Les variables Supabase ne sont pas encore renseignées dans cet environnement.</p>
            </div>
          ) : null}

          {state === "sent" ? (
            <div className="success-card premium-success-card">
              <span className="success-icon"><MailIcon /></span>
              <div>
                <b>Vérifiez votre boîte mail</b>
                <p>Le lien de connexion vient d&apos;être envoyé à {email}.</p>
              </div>
            </div>
          ) : (
            <form className="premium-auth-form" onSubmit={submit}>
              <label className="field premium-field">
                <span>Adresse email</span>
                <div className="input-with-icon">
                  <MailIcon />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.fr"
                  />
                </div>
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <button className="button primary auth-submit premium-button" disabled={state === "sending"}>
                {state === "sending" ? "Envoi…" : "Recevoir mon lien de connexion"}
                {state !== "sending" ? <span aria-hidden="true">→</span> : null}
              </button>
            </form>
          )}

          <div className="auth-card-footer">
            <Link className="text-link" href="/">← Retour à l&apos;accueil</Link>
            <span>Lien sécurisé · accès personnel</span>
          </div>
        </div>
      </section>
    </main>
  );
}
