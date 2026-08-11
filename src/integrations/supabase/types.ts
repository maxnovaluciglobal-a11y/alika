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
      branches: {
        Row: {
          address: string | null
          city: string | null
          clinic_id: string
          closes_at: string
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          opens_at: string
          phone: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          clinic_id: string
          closes_at?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          opens_at?: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          clinic_id?: string
          closes_at?: string
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          opens_at?: string
          phone?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_members: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_members_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_note_audit: {
        Row: {
          action: string
          actor_id: string
          clinic_id: string
          created_at: string
          detail: string | null
          id: string
          note_id: string | null
          patient_ref: string
        }
        Insert: {
          action: string
          actor_id?: string
          clinic_id: string
          created_at?: string
          detail?: string | null
          id?: string
          note_id?: string | null
          patient_ref: string
        }
        Update: {
          action?: string
          actor_id?: string
          clinic_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          note_id?: string | null
          patient_ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_note_audit_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_note_audit_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_note_entities: {
        Row: {
          ai_generated: boolean
          clinic_id: string
          code: string | null
          confidence: number | null
          confirmed: boolean
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          dosage: string | null
          id: string
          kind: Database["public"]["Enums"]["clinical_entity_kind"]
          note_id: string
          notes: string | null
          patient_ref: string
          quantity: number | null
          severity: string | null
          status: string | null
          term: string
          tooth: string | null
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          clinic_id: string
          code?: string | null
          confidence?: number | null
          confirmed?: boolean
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          dosage?: string | null
          id?: string
          kind: Database["public"]["Enums"]["clinical_entity_kind"]
          note_id: string
          notes?: string | null
          patient_ref: string
          quantity?: number | null
          severity?: string | null
          status?: string | null
          term: string
          tooth?: string | null
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          clinic_id?: string
          code?: string | null
          confidence?: number | null
          confirmed?: boolean
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          dosage?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["clinical_entity_kind"]
          note_id?: string
          notes?: string | null
          patient_ref?: string
          quantity?: number | null
          severity?: string | null
          status?: string | null
          term?: string
          tooth?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_note_entities_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_note_entities_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_note_reviews: {
        Row: {
          action: string
          actor_id: string
          clinic_id: string
          comment: string | null
          created_at: string
          id: string
          note_id: string
          note_version: number | null
          patient_ref: string
          reviewer_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          clinic_id: string
          comment?: string | null
          created_at?: string
          id?: string
          note_id: string
          note_version?: number | null
          patient_ref: string
          reviewer_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          clinic_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          note_id?: string
          note_version?: number | null
          patient_ref?: string
          reviewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_note_reviews_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_note_reviews_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_note_versions: {
        Row: {
          ai_action: string | null
          ai_assisted: boolean
          author_id: string
          clinic_id: string
          content: string
          created_at: string
          id: string
          note_id: string
          summary: string | null
          title: string
          version: number
        }
        Insert: {
          ai_action?: string | null
          ai_assisted?: boolean
          author_id?: string
          clinic_id: string
          content: string
          created_at?: string
          id?: string
          note_id: string
          summary?: string | null
          title: string
          version: number
        }
        Update: {
          ai_action?: string | null
          ai_assisted?: boolean
          author_id?: string
          clinic_id?: string
          content?: string
          created_at?: string
          id?: string
          note_id?: string
          summary?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinical_note_versions_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_note_versions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_notes: {
        Row: {
          clinic_id: string
          content: string
          created_at: string
          created_by: string
          id: string
          patient_name: string | null
          patient_ref: string
          review_requested_at: string | null
          review_requested_by: string | null
          review_status: string
          reviewed_at: string | null
          reviewer_id: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          clinic_id: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          patient_name?: string | null
          patient_ref: string
          review_requested_at?: string | null
          review_requested_by?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          clinic_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          patient_name?: string | null
          patient_ref?: string
          review_requested_at?: string | null
          review_requested_by?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          country: string
          created_at: string
          created_by: string
          currency: string
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          onboarding_completed: boolean
          tax_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          country?: string
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          country?: string
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          email_note_reverted: boolean
          email_review_approved: boolean
          email_review_cancelled: boolean
          email_review_changes_requested: boolean
          email_review_comment: boolean
          email_review_requested: boolean
          inapp_enabled: boolean
          unsubscribed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          email_note_reverted?: boolean
          email_review_approved?: boolean
          email_review_cancelled?: boolean
          email_review_changes_requested?: boolean
          email_review_comment?: boolean
          email_review_requested?: boolean
          inapp_enabled?: boolean
          unsubscribed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          email_note_reverted?: boolean
          email_review_approved?: boolean
          email_review_cancelled?: boolean
          email_review_changes_requested?: boolean
          email_review_comment?: boolean
          email_review_requested?: boolean
          inapp_enabled?: boolean
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          clinic_id: string
          created_at: string
          id: string
          kind: string
          link: string | null
          note_id: string | null
          patient_ref: string | null
          read_at: string | null
          recipient_id: string
          title: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          clinic_id: string
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          note_id?: string | null
          patient_ref?: string | null
          read_at?: string | null
          recipient_id: string
          title: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          clinic_id?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          note_id?: string | null
          patient_ref?: string | null
          read_at?: string | null
          recipient_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      operatories: {
        Row: {
          branch_id: string
          clinic_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          branch_id: string
          clinic_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          branch_id?: string
          clinic_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "operatories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operatories_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          branch_id: string | null
          clinic_id: string
          color: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          license_number: string | null
          phone: string | null
          specialty_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          branch_id?: string | null
          clinic_id: string
          color?: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          license_number?: string | null
          phone?: string | null
          specialty_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          branch_id?: string | null
          clinic_id?: string
          color?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          license_number?: string | null
          phone?: string | null
          specialty_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professionals_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      specialties: {
        Row: {
          clinic_id: string
          color: string
          created_at: string
          default_duration_min: number
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          clinic_id: string
          color?: string
          created_at?: string
          default_duration_min?: number
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          clinic_id?: string
          color?: string
          created_at?: string
          default_duration_min?: number
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialties_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_manage_clinic: { Args: { _clinic_id: string }; Returns: boolean }
      clinic_role_of: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_clinic_role: {
        Args: {
          _clinic_id: string
          _roles: Database["public"]["Enums"]["app_role"][]
        }
        Returns: boolean
      }
      is_clinic_member: { Args: { _clinic_id: string }; Returns: boolean }
      is_clinic_member_of: {
        Args: { _clinic_id: string; _user_id: string }
        Returns: boolean
      }
      shares_clinic_with: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "dentist"
        | "assistant"
        | "reception"
        | "accounting"
      clinical_entity_kind: "diagnosis" | "treatment" | "medication" | "allergy"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "owner",
        "admin",
        "dentist",
        "assistant",
        "reception",
        "accounting",
      ],
      clinical_entity_kind: ["diagnosis", "treatment", "medication", "allergy"],
    },
  },
} as const
