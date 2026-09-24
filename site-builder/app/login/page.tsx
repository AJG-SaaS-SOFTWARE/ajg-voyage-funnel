"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../../lib/supabase-browser";

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
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">AJG Site Builder</p>
        <h1>Connexion</h1>
        <p>Recevez un lien sécurisé par email. Aucun mot de passe à retenir.</p>

        {!isSupabaseConfigured() ? (
          <div className="helper-card">
            <b>Mode prototype local</b>
            <p>Les variables Supabase ne sont pas encore renseignées dans cet environnement.</p>
          </div>
        ) : null}

        {state === "sent" ? (
          <div className="success-card">
            <b>Vérifiez votre boîte mail.</b>
            <p>Le lien de connexion vient d'être envoyé à {email}.</p>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="field">
              <span>Email</span>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.fr" />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="button primary auth-submit" disabled={state === "sending"}>
              {state === "sending" ? "Envoi…" : "Recevoir mon lien de connexion"}
            </button>
          </form>
        )}

        <Link className="text-link" href="/">← Retour</Link>
      </section>
    </main>
  );
}
