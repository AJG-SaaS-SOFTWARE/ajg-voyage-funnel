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
      sites: {
        Row: {
          about_text: string
          design_assets: Json
          booking_label: string
          booking_url: string
          brand_name: string
          compliance_profile: string
          created_at: string
          enabled_languages: string[]
          facebook_url: string
          first_name: string
          hero_subtitle: string
          hero_title: string
          id: string
          instagram_url: string
          last_name: string
          owner_id: string
          primary_language: string
          profile_image_url: string
          published_at: string | null
          show_travel_journals: boolean
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          about_text?: string
          design_assets?: Json
          booking_label?: string
          booking_url?: string
          brand_name: string
          compliance_profile?: string
          created_at?: string
          enabled_languages?: string[]
          facebook_url?: string
          first_name: string
          hero_subtitle?: string
          hero_title: string
          id?: string
          instagram_url?: string
          last_name: string
          owner_id: string
          primary_language?: string
          profile_image_url?: string
          published_at?: string | null
          show_travel_journals?: boolean
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          about_text?: string
          design_assets?: Json
          booking_label?: string
          booking_url?: string
          brand_name?: string
          compliance_profile?: string
          created_at?: string
          enabled_languages?: string[]
          facebook_url?: string
          first_name?: string
          hero_subtitle?: string
          hero_title?: string
          id?: string
          instagram_url?: string
          last_name?: string
          owner_id?: string
          primary_language?: string
          profile_image_url?: string
          published_at?: string | null
          show_travel_journals?: boolean
          slug?: string
          status?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
