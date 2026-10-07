export type ProductPlanKey = "free" | "essential" | "growth";
export type ProductPlanLocale = "fr" | "en";

export function productPlanLabel(planKey: ProductPlanKey, locale: ProductPlanLocale) {
  if (planKey === "growth") return "Growth";
  if (planKey === "essential") return locale === "en" ? "Essential" : "Essentiel";
  return locale === "en" ? "Free" : "Gratuit";
}
