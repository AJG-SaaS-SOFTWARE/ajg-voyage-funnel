export function recoverySiteSnapshot(
  site: Record<string, unknown>,
  draft: { config: unknown; updated_at: unknown } | null
) {
  return {
    id: site.id,
    slug: site.slug,
    status: site.status,
    updatedAt: site.updated_at,
    draftConfig: draft?.config ?? null,
    draftUpdatedAt: draft?.updated_at ?? null,
    config: {
      slug: site.slug,
      firstName: site.first_name,
      lastName: site.last_name,
      brandName: site.brand_name,
      heroTitle: site.hero_title,
      heroSubtitle: site.hero_subtitle,
      heroTagline: site.hero_tagline,
      aboutText: site.about_text,
      aboutHeading: site.about_heading,
      bookingLabel: site.booking_label,
      bookingUrl: site.booking_url,
      instagramUrl: site.instagram_url,
      facebookUrl: site.facebook_url,
      profileImageUrl: site.profile_image_url,
      showTravelJournals: site.show_travel_journals,
      primaryLanguage: site.primary_language,
      enabledLanguages: site.enabled_languages,
      designAssets: site.design_assets,
      legalConfig: site.legal_config,
      complianceProfile: site.compliance_profile
    }
  };
}
