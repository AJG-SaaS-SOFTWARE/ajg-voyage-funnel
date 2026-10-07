"use client";

export default function PublicSiteError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="not-found" role="alert">
      <p className="eyebrow">Disponibilité du site · Website availability</p>
      <h1>Site momentanément indisponible · Website temporarily unavailable</h1>
      <p>
        Un service technique ne répond pas correctement. Le site n’a pas été supprimé :
        réessayez dans quelques instants.
      </p>
      <p>
        This website is temporarily unavailable because a technical service is not responding.
        The website has not been removed. Please try again shortly.
      </p>
      <button type="button" className="button primary" onClick={() => reset()}>
        Réessayer · Try again
      </button>
    </main>
  );
}
