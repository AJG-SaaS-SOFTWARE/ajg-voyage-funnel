export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_provider_usage: {
        Row: {
          cached_input_tokens: number
          created_at: string
          duration_ms: number
          id: number
          input_tokens: number
          model: string
          operation: string
          output_tokens: number
          reasoning_tokens: number
          site_id: string | null
          total_tokens: number
          user_id: string
        }
        Insert: {
          cached_input_tokens?: number
          created_at?: string
          duration_ms?: number
          id?: never
          input_tokens?: number
          model: string
          operation: string
          output_tokens?: number
          reasoning_tokens?: number
          site_id?: string | null
          total_tokens?: number
          user_id: string
        }
        Update: {
          cached_input_tokens?: number
          created_at?: string
          duration_ms?: number
          id?: never
          input_tokens?: number
          model?: string
          operation?: string
          output_tokens?: number
          reasoning_tokens?: number
          site_id?: string | null
          total_tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_provider_usage_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          created_at: string
          id: number
          request_id: string | null
          site_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          request_id?: string | null
          site_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          request_id?: string | null
          site_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ajg_voyage_leads: {
        Row: {
          activity_goal: string
          contact_request: boolean
          created_at: string
          email: string
          first_name: string
          id: string
          landing_url: string | null
          language: string
          lead_score: number
          main_interest: string
          marketing_consent: boolean
          phone: string | null
          referrer_url: string | null
          status: string
          travel_frequency: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          activity_goal: string
          contact_request?: boolean
          created_at?: string
          email: string
          first_name: string
          id?: string
          landing_url?: string | null
          language?: string
          lead_score?: number
          main_interest: string
          marketing_consent?: boolean
          phone?: string | null
          referrer_url?: string | null
          status?: string
          travel_frequency: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          activity_goal?: string
          contact_request?: boolean
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          landing_url?: string | null
          language?: string
          lead_score?: number
          main_interest?: string
          marketing_consent?: boolean
          phone?: string | null
          referrer_url?: string | null
          status?: string
          travel_frequency?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      architect_quality_feedback: {
        Row: {
          attempt_kind: string
          audit_score: number
          created_at: string
          id: number
          proposal_key: string
          reason: string | null
          refinement_applied: boolean
          site_id: string
          user_id: string
          verdict: string
        }
        Insert: {
          attempt_kind: string
          audit_score?: number
          created_at?: string
          id?: never
          proposal_key: string
          reason?: string | null
          refinement_applied?: boolean
          site_id: string
          user_id: string
          verdict: string
        }
        Update: {
          attempt_kind?: string
          audit_score?: number
          created_at?: string
          id?: never
          proposal_key?: string
          reason?: string | null
          refinement_applied?: boolean
          site_id?: string
          user_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "architect_quality_feedback_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_notifications: {
        Row: {
          attempts: number
          created_at: string
          due_at: string
          id: number
          last_error: string | null
          notification_key: string
          owner_id: string
          sent_at: string | null
          site_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          due_at: string
          id?: number
          last_error?: string | null
          notification_key: string
          owner_id: string
          sent_at?: string | null
          site_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          due_at?: string
          id?: number
          last_error?: string | null
          notification_key?: string
          owner_id?: string
          sent_at?: string | null
          site_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_notifications_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_provider_events: {
        Row: {
          event_id: string
          event_type: string
          last_error: string | null
          processed_at: string | null
          processing_status: string
          provider: string
          received_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          last_error?: string | null
          processed_at?: string | null
          processing_status?: string
          provider: string
          received_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          last_error?: string | null
          processed_at?: string | null
          processing_status?: string
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
      billing_state_events: {
        Row: {
          created_at: string
          from_state: string | null
          id: number
          owner_id: string
          provider_event_id: string | null
          reason: string
          site_id: string
          to_state: string
        }
        Insert: {
          created_at?: string
          from_state?: string | null
          id?: number
          owner_id: string
          provider_event_id?: string | null
          reason: string
          site_id: string
          to_state: string
        }
        Update: {
          created_at?: string
          from_state?: string | null
          id?: number
          owner_id?: string
          provider_event_id?: string | null
          reason?: string
          site_id?: string
          to_state?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_state_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          abuse_fingerprint: string
          consent_at: string
          created_at: string
          id: string
          message: string
          owner_id: string
          sender_email: string
          sender_name: string
          site_id: string
          subject: string
        }
        Insert: {
          abuse_fingerprint: string
          consent_at: string
          created_at?: string
          id?: string
          message: string
          owner_id: string
          sender_email: string
          sender_name: string
          site_id: string
          subject?: string
        }
        Update: {
          abuse_fingerprint?: string
          consent_at?: string
          created_at?: string
          id?: string
          message?: string
          owner_id?: string
          sender_email?: string
          sender_name?: string
          site_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          created_at: string
          hostname: string
          id: string
          is_primary: boolean
          kind: string
          site_id: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          hostname: string
          id?: string
          is_primary?: boolean
          kind: string
          site_id: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          hostname?: string
          id?: string
          is_primary?: boolean
          kind?: string
          site_id?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "domains_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          alt_text: string
          created_at: string
          id: string
          media_type: string
          site_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          alt_text?: string
          created_at?: string
          id?: string
          media_type: string
          site_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          alt_text?: string
          created_at?: string
          id?: string
          media_type?: string
          site_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          created_at: string
          event_name: string
          id: number
          site_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: never
          site_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: never
          site_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      runtime_error_events: {
        Row: {
          created_at: string
          error_code: string
          id: number
          route_path: string
          route_type: string
          site_id: string | null
        }
        Insert: {
          created_at?: string
          error_code: string
          id?: never
          route_path: string
          route_type: string
          site_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string
          id?: never
          route_path?: string
          route_type?: string
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "runtime_error_events_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_billing_states: {
        Row: {
          cancel_at_period_end: boolean
          delete_after: string | null
          export_until: string | null
          grace_started_at: string | null
          grace_until: string | null
          manual_hold_reason: string | null
          owner_id: string
          paid_through: string | null
          provider_status: string | null
          public_suspend_at: string | null
          restricted_at: string | null
          site_id: string
          state: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          delete_after?: string | null
          export_until?: string | null
          grace_started_at?: string | null
          grace_until?: string | null
          manual_hold_reason?: string | null
          owner_id: string
          paid_through?: string | null
          provider_status?: string | null
          public_suspend_at?: string | null
          restricted_at?: string | null
          site_id: string
          state?: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          delete_after?: string | null
          export_until?: string | null
          grace_started_at?: string | null
          grace_until?: string | null
          manual_hold_reason?: string | null
          owner_id?: string
          paid_through?: string | null
          provider_status?: string | null
          public_suspend_at?: string | null
          restricted_at?: string | null
          site_id?: string
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_billing_states_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_drafts: {
        Row: {
          config: Json
          owner_id: string
          site_id: string
          updated_at: string
        }
        Insert: {
          config: Json
          owner_id: string
          site_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          owner_id?: string
          site_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_drafts_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_ai_heavy_usage: {
        Row: {
          created_at: string
          operation: string
          owner_id: string
          request_id: string
          site_id: string
        }
        Insert: {
          created_at?: string
          operation: string
          owner_id: string
          request_id: string
          site_id: string
        }
        Update: {
          created_at?: string
          operation?: string
          owner_id?: string
          request_id?: string
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_ai_heavy_usage_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_ai_launch_entitlements: {
        Row: {
          expires_at: string | null
          external_reference: string | null
          granted_at: string
          id: string
          operations_total: number
          operations_used: number
          owner_id: string
          site_id: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          expires_at?: string | null
          external_reference?: string | null
          granted_at?: string
          id?: string
          operations_total?: number
          operations_used?: number
          owner_id: string
          site_id: string
          source: string
          status?: string
          updated_at?: string
        }
        Update: {
          expires_at?: string | null
          external_reference?: string | null
          granted_at?: string
          id?: string
          operations_total?: number
          operations_used?: number
          owner_id?: string
          site_id?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_ai_launch_entitlements_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_ai_launch_operations: {
        Row: {
          created_at: string
          entitlement_id: string
          operation: string
          owner_id: string
          request_id: string
          site_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entitlement_id: string
          operation: string
          owner_id: string
          request_id: string
          site_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entitlement_id?: string
          operation?: string
          owner_id?: string
          request_id?: string
          site_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_ai_launch_operations_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "site_ai_launch_entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_ai_launch_operations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_subscriptions: {
        Row: {
          current_period_end: string | null
          owner_id: string
          plan_key: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          site_id: string
          status: string
          updated_at: string
        }
        Insert: {
          current_period_end?: string | null
          owner_id: string
          plan_key: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          site_id: string
          status: string
          updated_at?: string
        }
        Update: {
          current_period_end?: string | null
          owner_id?: string
          plan_key?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          site_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_subscriptions_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "site_subscriptions_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      data_erasure_requests: {
        Row: {
          canceled_at: string | null
          completed_at: string | null
          id: string
          last_error: string | null
          processing_started_at: string | null
          requested_at: string
          scope: string
          site_id: string | null
          status: string
          systems_processed: Json
          user_id: string | null
        }
        Insert: {
          canceled_at?: string | null
          completed_at?: string | null
          id?: string
          last_error: string | null
          processing_started_at?: string | null
          requested_at?: string
          scope: string
          site_id?: string | null
          status?: string
          systems_processed?: Json
          user_id?: string | null
        }
        Update: {
          canceled_at?: string | null
          completed_at?: string | null
          id?: string
          last_error: string | null
          processing_started_at?: string | null
          requested_at?: string
          scope?: string
          site_id?: string | null
          status?: string
          systems_processed?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_erasure_requests_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          about_heading: string
          about_text: string
          booking_label: string
          booking_url: string
          brand_name: string
          compliance_profile: string
          created_at: string
          design_assets: Json
          enabled_languages: string[]
          facebook_url: string
          first_name: string
          hero_subtitle: string
          hero_tagline: string
          hero_title: string
          id: string
          instagram_url: string
          last_name: string
          legal_config: Json
          owner_id: string
          primary_language: string
          profile_image_url: string
          public_access_state: string
          privacy_state: string
          erasure_requested_at: string | null
          published_at: string | null
          show_travel_journals: boolean
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          about_heading?: string
          about_text?: string
          booking_label?: string
          booking_url?: string
          brand_name: string
          compliance_profile?: string
          created_at?: string
          design_assets?: Json
          enabled_languages?: string[]
          facebook_url?: string
          first_name: string
          hero_subtitle?: string
          hero_tagline?: string
          hero_title: string
          id?: string
          instagram_url?: string
          last_name: string
          legal_config?: Json
          owner_id: string
          primary_language?: string
          profile_image_url?: string
          public_access_state?: string
          privacy_state?: string
          erasure_requested_at?: string | null
          published_at?: string | null
          show_travel_journals?: boolean
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          about_heading?: string
          about_text?: string
          booking_label?: string
          booking_url?: string
          brand_name?: string
          compliance_profile?: string
          created_at?: string
          design_assets?: Json
          enabled_languages?: string[]
          facebook_url?: string
          first_name?: string
          hero_subtitle?: string
          hero_tagline?: string
          hero_title?: string
          id?: string
          instagram_url?: string
          last_name?: string
          legal_config?: Json
          owner_id?: string
          primary_language?: string
          profile_image_url?: string
          public_access_state?: string
          privacy_state?: string
          erasure_requested_at?: string | null
          published_at?: string | null
          show_travel_journals?: boolean
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      beta_access_grants: {
        Row: {
          active: boolean
          expires_at: string
          granted_at: string
          granted_by: string | null
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          expires_at: string
          granted_at?: string
          granted_by?: string | null
          starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          expires_at?: string
          granted_at?: string
          granted_by?: string | null
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          ai_daily_limit: number
          ai_minute_limit: number
          ai_monthly_limit: number
          created_at: string
          custom_domain: boolean
          key: string
          name: string
          premium_architect: boolean
          heavy_ai_monthly_limit: number
          storage_mb: number
        }
        Insert: {
          active?: boolean
          ai_daily_limit: number
          ai_minute_limit: number
          ai_monthly_limit: number
          created_at?: string
          custom_domain?: boolean
          key: string
          name: string
          premium_architect?: boolean
          storage_mb: number
        }
        Update: {
          active?: boolean
          ai_daily_limit?: number
          ai_minute_limit?: number
          ai_monthly_limit?: number
          created_at?: string
          custom_domain?: boolean
          key?: string
          name?: string
          premium_architect?: boolean
          heavy_ai_monthly_limit?: number
          storage_mb?: number
        }
        Relationships: []
      }
      travel_journals: {
        Row: {
          body: Json
          cover_media_id: string | null
          created_at: string
          excerpt: string
          id: string
          published_at: string | null
          site_id: string
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: Json
          cover_media_id?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published_at?: string | null
          site_id: string
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: Json
          cover_media_id?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          published_at?: string | null
          site_id?: string
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_journals_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_journals_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          rating: number | null
          site_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          message: string
          rating?: number | null
          site_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          rating?: number | null
          site_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          current_period_end: string | null
          plan_key: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          plan_key?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          plan_key?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["key"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_builder_billing_provider_event: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_failed_at?: string
          p_owner_id: string
          p_paid_through?: string
          p_provider: string
          p_provider_status: string
        }
        Returns: string
      }
      apply_builder_site_billing_provider_event: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_failed_at?: string
          p_owner_id: string
          p_paid_through?: string
          p_provider: string
          p_provider_status: string
          p_provider_subscription_id?: string
          p_site_id: string
        }
        Returns: string
      }
      can_modify_site_media: { Args: { p_site_id: string }; Returns: boolean }
      can_upload_site_media:
        | { Args: { p_bytes: number }; Returns: boolean }
        | { Args: { p_bytes: number; p_site_id: string }; Returns: boolean }
      claim_due_billing_notifications: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          due_at: string
          id: number
          notification_key: string
          owner_id: string
          site_id: string
        }[]
      }
      consume_ai_generation: {
        Args: {
          p_daily_limit?: number
          p_minute_limit?: number
          p_monthly_limit?: number
          p_user_id: string
        }
        Returns: string
      }
      consume_my_ai_generation: { Args: never; Returns: string }
      consume_my_site_ai_generation: {
        Args: { p_site_id: string }
        Returns: string
      }
      finish_billing_notification: {
        Args: { p_error?: string; p_id: number; p_success: boolean }
        Returns: undefined
      }
      get_my_ai_usage: {
        Args: never
        Returns: {
          month: number
          today: number
        }[]
      }
      get_my_beta_access: {
        Args: never
        Returns: {
          active: boolean
          expires_at: string
          starts_at: string
        }[]
      }
      get_my_entitlements: {
        Args: never
        Returns: {
          ai_daily_limit: number
          ai_minute_limit: number
          ai_monthly_limit: number
          custom_domain: boolean
          plan_key: string
          plan_name: string
          premium_architect: boolean
          storage_mb: number
          subscription_status: string
        }[]
      }
      get_my_site_capabilities: {
        Args: { p_site_id: string }
        Returns: {
          billing_state: string
          can_collect_leads: boolean
          can_edit: boolean
          can_export: boolean
          can_generate_ai: boolean
          can_import: boolean
          can_publish: boolean
          can_read: boolean
          can_view_billing: boolean
          public_site_available: boolean
        }[]
      }
      commit_my_site_launch_operation: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      get_my_site_ai_access: {
        Args: { p_site_id: string }
        Returns: {
          access_source: string
          can_create_site: boolean
          can_revise_site: boolean
          launch_operations_remaining: number
        }[]
      }
      release_my_site_launch_operation: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      release_my_site_heavy_ai: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      reserve_my_site_heavy_ai: {
        Args: {
          p_operation: string
          p_request_id: string
          p_site_id: string
        }
        Returns: string
      }
      reserve_my_site_launch_operation: {
        Args: {
          p_operation: string
          p_request_id: string
          p_site_id: string
        }
        Returns: string
      }
      get_my_site_entitlements: {
        Args: { p_site_id: string }
        Returns: {
          ai_daily_limit: number
          ai_minute_limit: number
          ai_monthly_limit: number
          custom_domain: boolean
          plan_key: string
          plan_name: string
          premium_architect: boolean
          storage_mb: number
          subscription_status: string
        }[]
      }
      get_my_site_storage_usage: {
        Args: { p_site_id: string }
        Returns: {
          storage_limit_mb: number
          used_bytes: number
        }[]
      }
      get_my_storage_usage: {
        Args: never
        Returns: {
          storage_limit_mb: number
          used_bytes: number
        }[]
      }
      release_my_site_ai_generation: {
        Args: { p_request_id: string }
        Returns: boolean
      }
      request_my_custom_domain: {
        Args: { p_hostname: string; p_site_id: string }
        Returns: {
          created_at: string
          hostname: string
          id: string
          is_primary: boolean
          kind: string
          site_id: string
          verification_status: string
        }
        SetofOptions: {
          from: "*"
          to: "domains"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_my_site_ai_generation: {
        Args: { p_request_id: string; p_site_id: string }
        Returns: string
      }
      request_builder_account_erasure: {
        Args: { p_owner_id: string }
        Returns: string
      }
      request_builder_site_erasure: {
        Args: { p_owner_id: string; p_site_id: string }
        Returns: string
      }
      submit_contact_message: {
        Args: {
          p_abuse_fingerprint: string
          p_consent: boolean
          p_message: string
          p_sender_email: string
          p_sender_name: string
          p_site_id: string
          p_subject: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
