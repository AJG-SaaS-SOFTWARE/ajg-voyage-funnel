"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../../lib/supabase-browser";
import { isCurrentUserAdmin } from "../../../lib/admin";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [message, setMessage] = useState("");
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    void supabase.auth.getSession().then(async ({ data }) => {
      setHasSession(Boolean(data.session));
      if (!data.session) return;
      const admin = await isCurrentUserAdmin().catch(() => false);
      if (admin) router.replace("/admin");
    });
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase n’est pas configuré dans cet environnement.");
      return;
    }

    setState("sending");

    // A different user may already be connected on this browser.
    // Sign out before requesting the admin magic link so the next session is unambiguous.
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setState("idle");
      setMessage("Impossible de changer de compte pour le moment. Réessayez.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin + "/admin",
        shouldCreateUser: false
      }
    });

    if (error) {
      setState("idle");
      setMessage(
        "Le lien administrateur n’a pas pu être envoyé. Utilisez l’adresse du compte auquel le rôle administrateur a été attribué."
      );
      return;
    }

    setHasSession(false);
    setState("sent");
  };

  return (
    <main className="auth-page premium-auth-page">
      <section className="auth-visual" aria-label="ELTARA Administration">
        <div className="auth-visual-overlay" />
        <div className="auth-brand-row">
          <Link href="/" className="auth-brand">ELTARA</Link>
        </div>
        <div className="auth-visual-copy">
          <p className="eyebrow">Back-office sécurisé</p>
          <h1>Accédez à l’administration depuis n’importe quel poste</h1>
          <p>
            Le rôle administrateur est associé à votre compte AJG dans Supabase, pas à cet ordinateur.
            Utilisez simplement la même adresse administrateur pour recevoir un nouveau lien sécurisé.
          </p>
        </div>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-card premium-auth-card">
          <div className="auth-card-heading">
            <p className="eyebrow">Administration</p>
            <h2>Connexion administrateur</h2>
            <p>
              Saisissez l’adresse du compte administrateur. Aucun mot de passe n’est nécessaire.
            </p>
          </div>

          {!isSupabaseConfigured() ? (
            <div className="helper-card premium-helper-card">
              <b>Configuration indisponible</b>
              <p>Supabase n’est pas configuré dans cet environnement.</p>
            </div>
          ) : null}

          {hasSession ? (
            <div className="helper-card premium-helper-card">
              <b>Un autre compte est actuellement connecté</b>
              <p>
                L’envoi du lien ci-dessous déconnectera cette session avant d’ouvrir la session administrateur.
              </p>
            </div>
          ) : null}

          {state === "sent" ? (
            <div className="success-card premium-success-card" role="status">
              <div>
                <b>Vérifiez votre boîte mail</b>
                <p>
                  Le lien sécurisé a été envoyé à {email}. Il ouvrira directement le back-office.
                </p>
              </div>
            </div>
          ) : (
            <form className="premium-auth-form" onSubmit={submit}>
              <label className="field premium-field">
                <span>Adresse e-mail administrateur</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@exemple.fr"
                />
              </label>
              {message ? <p className="form-error" role="alert">{message}</p> : null}
              <button
                className="button primary auth-submit premium-button"
                disabled={state === "sending" || !email.trim()}
              >
                {state === "sending" ? "Envoi…" : "Recevoir mon lien administrateur"}
                {state !== "sending" ? <span aria-hidden="true">→</span> : null}
              </button>
            </form>
          )}

          <div className="auth-card-footer">
            <Link className="text-link" href="/admin">← Retour au back-office</Link>
            <span>Rôle vérifié côté serveur</span>
          </div>
        </div>
      </section>
    </main>
  );
}
