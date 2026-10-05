"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LanguageSwitch } from "../../components/LanguageSwitch";
import { EltaraBrand } from "../../components/EltaraBrand";
import { useProductLocale } from "../../lib/product-i18n";
import { signOut } from "../../lib/supabase-site-repository";

export default function BetaAccessPage() {
  const router = useRouter();
  const { tr } = useProductLocale();

  const changeAccount = async () => {
    await signOut().catch(() => undefined);
    router.replace("/login");
  };

  return (
    <main className="auth-page">
      <section className="auth-card beta-access-card">
        <div className="builder-language-row">
          <EltaraBrand compact context="Beta" />
          <LanguageSwitch compact />
        </div>
        <h1>{tr("Accès bêta sur invitation", "Invitation-only beta access")}</h1>
        <p>
          {tr(
            "Ce compte existe, mais il ne dispose pas actuellement d’un accès Beta Tester actif. Aucun site ni aucune donnée du compte n’est supprimé.",
            "This account exists, but it does not currently have active Beta Tester access. No website or account data is deleted."
          )}
        </p>
        <div className="helper-card">
          <b>{tr("Vous avez reçu une invitation ?", "Were you invited?")}</b>
          <p>
            {tr(
              "Reconnectez-vous avec exactement l’adresse email utilisée pour l’invitation. Si l’accès a expiré, l’administrateur peut le renouveler sans recréer votre compte.",
              "Sign in with the exact email address used for the invitation. If access expired, the administrator can renew it without recreating your account."
            )}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="button primary" onClick={() => void changeAccount()}>
            {tr("Changer de compte", "Use another account")}
          </button>
          <Link className="button secondary" href="/">
            {tr("Retour à l’accueil", "Back to home")}
          </Link>
        </div>
      </section>
    </main>
  );
}
