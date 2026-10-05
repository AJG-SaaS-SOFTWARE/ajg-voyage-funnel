export function appBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_BUILDER_URL;

  if (explicit?.trim()) {
    return explicit.trim().replace(/\/$/, "");
  }

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (productionHost?.trim()) {
    return `https://${productionHost.trim().replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  return "https://eltara.ajgsolutionsgroup.com";
}
