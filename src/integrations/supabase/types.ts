export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      agreement_coverage: {
        Row: {
          agreement_id: string;
          clinic_id: string;
          coverage_fixed_cents: number | null;
          coverage_pct: number | null;
          created_at: string;
          id: string;
          procedure_id: string;
          updated_at: string;
        };
        Insert: {
          agreement_id: string;
          clinic_id: string;
          coverage_fixed_cents?: number | null;
          coverage_pct?: number | null;
          created_at?: string;
          id?: string;
          procedure_id: string;
          updated_at?: string;
        };
        Update: {
          agreement_id?: string;
          clinic_id?: string;
          coverage_fixed_cents?: number | null;
          coverage_pct?: number | null;
          created_at?: string;
          id?: string;
          procedure_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agreement_coverage_agreement_id_fkey";
            columns: ["agreement_id"];
            isOneToOne: false;
            referencedRelation: "agreements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agreement_coverage_procedure_id_fkey";
            columns: ["procedure_id"];
            isOneToOne: false;
            referencedRelation: "procedures";
            referencedColumns: ["id"];
          },
        ];
      };
      agreements: {
        Row: {
          clinic_id: string;
          contact_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          created_at: string;
          created_by: string;
          id: string;
          is_active: boolean;
          kind: string | null;
          name: string;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          clinic_id: string;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          is_active?: boolean;
          kind?: string | null;
          name: string;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          clinic_id?: string;
          contact_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          is_active?: boolean;
          kind?: string | null;
          name?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agreements_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      appointment_requests: {
        Row: {
          clinic_id: string;
          clinic_notes: string | null;
          created_at: string;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          patient_id: string;
          preferred_date: string;
          priority: string;
          reason: string;
          scheduled_appointment_id: string | null;
          source: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          clinic_id: string;
          clinic_notes?: string | null;
          created_at?: string;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          patient_id: string;
          preferred_date: string;
          priority?: string;
          reason: string;
          scheduled_appointment_id?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          clinic_id?: string;
          clinic_notes?: string | null;
          created_at?: string;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          patient_id?: string;
          preferred_date?: string;
          priority?: string;
          reason?: string;
          scheduled_appointment_id?: string | null;
          source?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointment_requests_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_requests_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointment_requests_scheduled_appointment_id_fkey";
            columns: ["scheduled_appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      appointments: {
        Row: {
          branch_id: string;
          clinic_id: string;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          created_by: string;
          ends_at: string;
          id: string;
          is_priority: boolean;
          notes: string | null;
          operatory_id: string | null;
          patient_id: string;
          procedure_id: string | null;
          professional_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          treatment_label: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          branch_id: string;
          clinic_id: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string;
          ends_at: string;
          id?: string;
          is_priority?: boolean;
          notes?: string | null;
          operatory_id?: string | null;
          patient_id: string;
          procedure_id?: string | null;
          professional_id: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          treatment_label?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          branch_id?: string;
          clinic_id?: string;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string;
          ends_at?: string;
          id?: string;
          is_priority?: boolean;
          notes?: string | null;
          operatory_id?: string | null;
          patient_id?: string;
          procedure_id?: string | null;
          professional_id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          treatment_label?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_operatory_id_fkey";
            columns: ["operatory_id"];
            isOneToOne: false;
            referencedRelation: "operatories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_procedure_id_fkey";
            columns: ["procedure_id"];
            isOneToOne: false;
            referencedRelation: "procedures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_professional_id_fkey";
            columns: ["professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
        ];
      };
      branches: {
        Row: {
          address: string | null;
          city: string | null;
          clinic_id: string;
          closes_at: string;
          created_at: string;
          email: string | null;
          google_review_url: string | null;
          id: string;
          is_active: boolean;
          name: string;
          opens_at: string;
          phone: string | null;
          timezone: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          city?: string | null;
          clinic_id: string;
          closes_at?: string;
          created_at?: string;
          email?: string | null;
          google_review_url?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          opens_at?: string;
          phone?: string | null;
          timezone?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          city?: string | null;
          clinic_id?: string;
          closes_at?: string;
          created_at?: string;
          email?: string | null;
          google_review_url?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          opens_at?: string;
          phone?: string | null;
          timezone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "branches_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      clinic_counters: {
        Row: {
          clinic_id: string;
          kind: string;
          next_value: number;
          updated_at: string;
          year: number;
        };
        Insert: {
          clinic_id: string;
          kind: string;
          next_value?: number;
          updated_at?: string;
          year: number;
        };
        Update: {
          clinic_id?: string;
          kind?: string;
          next_value?: number;
          updated_at?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "clinic_counters_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      clinic_members: {
        Row: {
          clinic_id: string;
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          clinic_id: string;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          clinic_id?: string;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clinic_members_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      clinical_note_audit: {
        Row: {
          action: string;
          actor_id: string;
          clinic_id: string;
          created_at: string;
          detail: string | null;
          id: string;
          note_id: string | null;
          patient_ref: string;
        };
        Insert: {
          action: string;
          actor_id?: string;
          clinic_id: string;
          created_at?: string;
          detail?: string | null;
          id?: string;
          note_id?: string | null;
          patient_ref: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          clinic_id?: string;
          created_at?: string;
          detail?: string | null;
          id?: string;
          note_id?: string | null;
          patient_ref?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clinical_note_audit_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinical_note_audit_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "clinical_notes";
            referencedColumns: ["id"];
          },
        ];
      };
      clinical_note_entities: {
        Row: {
          ai_generated: boolean;
          clinic_id: string;
          code: string | null;
          confidence: number | null;
          confirmed: boolean;
          confirmed_by: string | null;
          created_at: string;
          created_by: string | null;
          dosage: string | null;
          id: string;
          kind: Database["public"]["Enums"]["clinical_entity_kind"];
          note_id: string;
          notes: string | null;
          patient_ref: string;
          quantity: number | null;
          severity: string | null;
          status: string | null;
          term: string;
          tooth: string | null;
          updated_at: string;
        };
        Insert: {
          ai_generated?: boolean;
          clinic_id: string;
          code?: string | null;
          confidence?: number | null;
          confirmed?: boolean;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          dosage?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["clinical_entity_kind"];
          note_id: string;
          notes?: string | null;
          patient_ref: string;
          quantity?: number | null;
          severity?: string | null;
          status?: string | null;
          term: string;
          tooth?: string | null;
          updated_at?: string;
        };
        Update: {
          ai_generated?: boolean;
          clinic_id?: string;
          code?: string | null;
          confidence?: number | null;
          confirmed?: boolean;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          dosage?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["clinical_entity_kind"];
          note_id?: string;
          notes?: string | null;
          patient_ref?: string;
          quantity?: number | null;
          severity?: string | null;
          status?: string | null;
          term?: string;
          tooth?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clinical_note_entities_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinical_note_entities_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "clinical_notes";
            referencedColumns: ["id"];
          },
        ];
      };
      clinical_note_reviews: {
        Row: {
          action: string;
          actor_id: string;
          clinic_id: string;
          comment: string | null;
          created_at: string;
          id: string;
          note_id: string;
          note_version: number | null;
          patient_ref: string;
          reviewer_id: string | null;
        };
        Insert: {
          action: string;
          actor_id: string;
          clinic_id: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          note_id: string;
          note_version?: number | null;
          patient_ref: string;
          reviewer_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string;
          clinic_id?: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          note_id?: string;
          note_version?: number | null;
          patient_ref?: string;
          reviewer_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clinical_note_reviews_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinical_note_reviews_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "clinical_notes";
            referencedColumns: ["id"];
          },
        ];
      };
      clinical_note_versions: {
        Row: {
          ai_action: string | null;
          ai_assisted: boolean;
          author_id: string;
          clinic_id: string;
          content: string;
          created_at: string;
          id: string;
          note_id: string;
          summary: string | null;
          title: string;
          version: number;
        };
        Insert: {
          ai_action?: string | null;
          ai_assisted?: boolean;
          author_id?: string;
          clinic_id: string;
          content: string;
          created_at?: string;
          id?: string;
          note_id: string;
          summary?: string | null;
          title: string;
          version: number;
        };
        Update: {
          ai_action?: string | null;
          ai_assisted?: boolean;
          author_id?: string;
          clinic_id?: string;
          content?: string;
          created_at?: string;
          id?: string;
          note_id?: string;
          summary?: string | null;
          title?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "clinical_note_versions_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "clinical_note_versions_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "clinical_notes";
            referencedColumns: ["id"];
          },
        ];
      };
      clinical_notes: {
        Row: {
          clinic_id: string;
          content: string;
          created_at: string;
          created_by: string;
          id: string;
          patient_name: string | null;
          patient_ref: string;
          review_requested_at: string | null;
          review_requested_by: string | null;
          review_status: string;
          reviewed_at: string | null;
          reviewer_id: string | null;
          status: string;
          summary: string | null;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          clinic_id: string;
          content?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          patient_name?: string | null;
          patient_ref: string;
          review_requested_at?: string | null;
          review_requested_by?: string | null;
          review_status?: string;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: string;
          summary?: string | null;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          clinic_id?: string;
          content?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          patient_name?: string | null;
          patient_ref?: string;
          review_requested_at?: string | null;
          review_requested_by?: string | null;
          review_status?: string;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: string;
          summary?: string | null;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "clinical_notes_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      clinics: {
        Row: {
          country: string;
          created_at: string;
          created_by: string;
          currency: string;
          id: string;
          is_demo: boolean;
          legal_name: string | null;
          logo_url: string | null;
          name: string;
          onboarding_completed: boolean;
          tax_id: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          country?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          id?: string;
          is_demo?: boolean;
          legal_name?: string | null;
          logo_url?: string | null;
          name: string;
          onboarding_completed?: boolean;
          tax_id?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          country?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          id?: string;
          is_demo?: boolean;
          legal_name?: string | null;
          logo_url?: string | null;
          name?: string;
          onboarding_completed?: boolean;
          tax_id?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      commission_rules: {
        Row: {
          clinic_id: string;
          fixed_cents: number;
          kind: string;
          percent_bps: number;
          professional_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          clinic_id: string;
          fixed_cents?: number;
          kind: string;
          percent_bps?: number;
          professional_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          clinic_id?: string;
          fixed_cents?: number;
          kind?: string;
          percent_bps?: number;
          professional_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "commission_rules_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_rules_professional_id_fkey";
            columns: ["professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_settlements: {
        Row: {
          clinic_id: string;
          closed_at: string;
          closed_by: string;
          commission_cents: number;
          id: string;
          paid_at: string | null;
          paid_by: string | null;
          period_from: string;
          period_to: string;
          procedure_count: number;
          production_cents: number;
          professional_id: string;
          rule_fixed_cents: number;
          rule_kind: string;
          rule_percent_bps: number;
        };
        Insert: {
          clinic_id: string;
          closed_at?: string;
          closed_by: string;
          commission_cents: number;
          id?: string;
          paid_at?: string | null;
          paid_by?: string | null;
          period_from: string;
          period_to: string;
          procedure_count: number;
          production_cents: number;
          professional_id: string;
          rule_fixed_cents?: number;
          rule_kind: string;
          rule_percent_bps?: number;
        };
        Update: {
          clinic_id?: string;
          closed_at?: string;
          closed_by?: string;
          commission_cents?: number;
          id?: string;
          paid_at?: string | null;
          paid_by?: string | null;
          period_from?: string;
          period_to?: string;
          procedure_count?: number;
          production_cents?: number;
          professional_id?: string;
          rule_fixed_cents?: number;
          rule_kind?: string;
          rule_percent_bps?: number;
        };
        Relationships: [
          {
            foreignKeyName: "commission_settlements_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_settlements_professional_id_fkey";
            columns: ["professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
        ];
      };
      consent_templates: {
        Row: {
          active: boolean;
          body: string;
          clinic_id: string;
          created_at: string;
          created_by: string;
          id: string;
          title: string;
        };
        Insert: {
          active?: boolean;
          body: string;
          clinic_id: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          title: string;
        };
        Update: {
          active?: boolean;
          body?: string;
          clinic_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "consent_templates_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      email_sandbox_config: {
        Row: {
          allowlist: string[];
          clinic_id: string;
          min_entregas_produccion: number;
          mode: string;
          prefix_subject: boolean;
          redirect_enabled: boolean;
          redirect_to: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          allowlist?: string[];
          clinic_id: string;
          min_entregas_produccion?: number;
          mode?: string;
          prefix_subject?: boolean;
          redirect_enabled?: boolean;
          redirect_to?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          allowlist?: string[];
          clinic_id?: string;
          min_entregas_produccion?: number;
          mode?: string;
          prefix_subject?: boolean;
          redirect_enabled?: boolean;
          redirect_to?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_sandbox_config_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: true;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount_cents: number;
          branch_id: string | null;
          category: string;
          clinic_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          description: string;
          id: string;
          incurred_on: string;
          method_name_snapshot: string | null;
          notes: string | null;
          payment_method_id: string | null;
          supplier: string | null;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          branch_id?: string | null;
          category: string;
          clinic_id: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          description: string;
          id?: string;
          incurred_on: string;
          method_name_snapshot?: string | null;
          notes?: string | null;
          payment_method_id?: string | null;
          supplier?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          branch_id?: string | null;
          category?: string;
          clinic_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          description?: string;
          id?: string;
          incurred_on?: string;
          method_name_snapshot?: string | null;
          notes?: string | null;
          payment_method_id?: string | null;
          supplier?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_payment_method_id_fkey";
            columns: ["payment_method_id"];
            isOneToOne: false;
            referencedRelation: "payment_methods";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          branch_id: string | null;
          clinic_id: string;
          cost_cents: number | null;
          created_at: string;
          created_by: string;
          current_stock: number;
          id: string;
          is_active: boolean;
          min_stock: number | null;
          name: string;
          notes: string | null;
          unit: string;
        };
        Insert: {
          branch_id?: string | null;
          clinic_id: string;
          cost_cents?: number | null;
          created_at?: string;
          created_by?: string;
          current_stock?: number;
          id?: string;
          is_active?: boolean;
          min_stock?: number | null;
          name: string;
          notes?: string | null;
          unit: string;
        };
        Update: {
          branch_id?: string | null;
          clinic_id?: string;
          cost_cents?: number | null;
          created_at?: string;
          created_by?: string;
          current_stock?: number;
          id?: string;
          is_active?: boolean;
          min_stock?: number | null;
          name?: string;
          notes?: string | null;
          unit?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_items_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_items_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movements: {
        Row: {
          clinic_id: string;
          expiration_date: string | null;
          id: string;
          item_id: string;
          kind: Database["public"]["Enums"]["inventory_movement_kind"];
          lot_number: string | null;
          quantity: number;
          reason: string | null;
          recorded_at: string;
          recorded_by: string;
        };
        Insert: {
          clinic_id: string;
          expiration_date?: string | null;
          id?: string;
          item_id: string;
          kind: Database["public"]["Enums"]["inventory_movement_kind"];
          lot_number?: string | null;
          quantity: number;
          reason?: string | null;
          recorded_at?: string;
          recorded_by?: string;
        };
        Update: {
          clinic_id?: string;
          expiration_date?: string | null;
          id?: string;
          item_id?: string;
          kind?: Database["public"]["Enums"]["inventory_movement_kind"];
          lot_number?: string | null;
          quantity?: number;
          reason?: string | null;
          recorded_at?: string;
          recorded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movements_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
        ];
      };
      message_templates: {
        Row: {
          body: string;
          channel: Database["public"]["Enums"]["message_channel"];
          clinic_id: string;
          created_at: string;
          created_by: string;
          id: string;
          is_active: boolean;
          kind: Database["public"]["Enums"]["message_template_kind"];
          meta_category: string;
          meta_language: string;
          meta_status: string;
          meta_template_name: string | null;
          name: string;
          subject: string | null;
          updated_at: string;
        };
        Insert: {
          body: string;
          channel?: Database["public"]["Enums"]["message_channel"];
          clinic_id: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["message_template_kind"];
          meta_category?: string;
          meta_language?: string;
          meta_status?: string;
          meta_template_name?: string | null;
          name: string;
          subject?: string | null;
          updated_at?: string;
        };
        Update: {
          body?: string;
          channel?: Database["public"]["Enums"]["message_channel"];
          clinic_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["message_template_kind"];
          meta_category?: string;
          meta_language?: string;
          meta_status?: string;
          meta_template_name?: string | null;
          name?: string;
          subject?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_templates_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          appointment_id: string | null;
          body: string;
          channel: Database["public"]["Enums"]["message_channel"];
          clinic_id: string;
          created_at: string;
          delivered_at: string | null;
          direction: Database["public"]["Enums"]["message_direction"];
          error: string | null;
          external_id: string | null;
          id: string;
          patient_id: string;
          quote_id: string | null;
          read_at: string | null;
          recipient: string;
          sent_at: string | null;
          sent_by: string | null;
          status: Database["public"]["Enums"]["message_status"];
          template_id: string | null;
          template_kind: Database["public"]["Enums"]["message_template_kind"] | null;
        };
        Insert: {
          appointment_id?: string | null;
          body: string;
          channel?: Database["public"]["Enums"]["message_channel"];
          clinic_id: string;
          created_at?: string;
          delivered_at?: string | null;
          direction?: Database["public"]["Enums"]["message_direction"];
          error?: string | null;
          external_id?: string | null;
          id?: string;
          patient_id: string;
          quote_id?: string | null;
          read_at?: string | null;
          recipient: string;
          sent_at?: string | null;
          sent_by?: string | null;
          status?: Database["public"]["Enums"]["message_status"];
          template_id?: string | null;
          template_kind?: Database["public"]["Enums"]["message_template_kind"] | null;
        };
        Update: {
          appointment_id?: string | null;
          body?: string;
          channel?: Database["public"]["Enums"]["message_channel"];
          clinic_id?: string;
          created_at?: string;
          delivered_at?: string | null;
          direction?: Database["public"]["Enums"]["message_direction"];
          error?: string | null;
          external_id?: string | null;
          id?: string;
          patient_id?: string;
          quote_id?: string | null;
          read_at?: string | null;
          recipient?: string;
          sent_at?: string | null;
          sent_by?: string | null;
          status?: Database["public"]["Enums"]["message_status"];
          template_id?: string | null;
          template_kind?: Database["public"]["Enums"]["message_template_kind"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_appointment_id_fkey";
            columns: ["appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "message_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          created_at: string;
          email_enabled: boolean;
          email_note_reverted: boolean;
          email_review_approved: boolean;
          email_review_cancelled: boolean;
          email_review_changes_requested: boolean;
          email_review_comment: boolean;
          email_review_requested: boolean;
          inapp_enabled: boolean;
          unsubscribed_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email_enabled?: boolean;
          email_note_reverted?: boolean;
          email_review_approved?: boolean;
          email_review_cancelled?: boolean;
          email_review_changes_requested?: boolean;
          email_review_comment?: boolean;
          email_review_requested?: boolean;
          inapp_enabled?: boolean;
          unsubscribed_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email_enabled?: boolean;
          email_note_reverted?: boolean;
          email_review_approved?: boolean;
          email_review_cancelled?: boolean;
          email_review_changes_requested?: boolean;
          email_review_comment?: boolean;
          email_review_requested?: boolean;
          inapp_enabled?: boolean;
          unsubscribed_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          body: string | null;
          clinic_id: string;
          created_at: string;
          id: string;
          kind: string;
          link: string | null;
          note_id: string | null;
          patient_ref: string | null;
          read_at: string | null;
          recipient_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          actor_id?: string | null;
          body?: string | null;
          clinic_id: string;
          created_at?: string;
          id?: string;
          kind: string;
          link?: string | null;
          note_id?: string | null;
          patient_ref?: string | null;
          read_at?: string | null;
          recipient_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          actor_id?: string | null;
          body?: string | null;
          clinic_id?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          link?: string | null;
          note_id?: string | null;
          patient_ref?: string | null;
          read_at?: string | null;
          recipient_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_note_id_fkey";
            columns: ["note_id"];
            isOneToOne: false;
            referencedRelation: "clinical_notes";
            referencedColumns: ["id"];
          },
        ];
      };
      odontogram_marks: {
        Row: {
          clinic_id: string;
          condition: Database["public"]["Enums"]["tooth_condition"];
          id: string;
          material: string | null;
          notes: string | null;
          patient_id: string;
          recorded_at: string;
          recorded_by: string;
          superseded_at: string | null;
          superseded_by: string | null;
          surface: Database["public"]["Enums"]["tooth_surface"];
          tooth_number: number;
        };
        Insert: {
          clinic_id: string;
          condition: Database["public"]["Enums"]["tooth_condition"];
          id?: string;
          material?: string | null;
          notes?: string | null;
          patient_id: string;
          recorded_at?: string;
          recorded_by?: string;
          superseded_at?: string | null;
          superseded_by?: string | null;
          surface: Database["public"]["Enums"]["tooth_surface"];
          tooth_number: number;
        };
        Update: {
          clinic_id?: string;
          condition?: Database["public"]["Enums"]["tooth_condition"];
          id?: string;
          material?: string | null;
          notes?: string | null;
          patient_id?: string;
          recorded_at?: string;
          recorded_by?: string;
          superseded_at?: string | null;
          superseded_by?: string | null;
          surface?: Database["public"]["Enums"]["tooth_surface"];
          tooth_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "odontogram_marks_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "odontogram_marks_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "odontogram_marks_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "odontogram_marks";
            referencedColumns: ["id"];
          },
        ];
      };
      operatories: {
        Row: {
          branch_id: string;
          clinic_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
        };
        Insert: {
          branch_id: string;
          clinic_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
        };
        Update: {
          branch_id?: string;
          clinic_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operatories_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operatories_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_consents: {
        Row: {
          body_snapshot: string;
          clinic_id: string;
          id: string;
          patient_id: string;
          recorded_by: string;
          revoked_at: string | null;
          revoked_by: string | null;
          signature_storage_path: string;
          signed_at: string;
          signed_by_name: string;
          template_id: string | null;
          title_snapshot: string;
        };
        Insert: {
          body_snapshot: string;
          clinic_id: string;
          id?: string;
          patient_id: string;
          recorded_by?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          signature_storage_path: string;
          signed_at?: string;
          signed_by_name: string;
          template_id?: string | null;
          title_snapshot: string;
        };
        Update: {
          body_snapshot?: string;
          clinic_id?: string;
          id?: string;
          patient_id?: string;
          recorded_by?: string;
          revoked_at?: string | null;
          revoked_by?: string | null;
          signature_storage_path?: string;
          signed_at?: string;
          signed_by_name?: string;
          template_id?: string | null;
          title_snapshot?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patient_consents_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_consents_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_consents_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "consent_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_documents: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          clinic_id: string;
          created_at: string;
          filename: string;
          id: string;
          kind: Database["public"]["Enums"]["patient_document_kind"];
          mime_type: string;
          notes: string | null;
          patient_id: string;
          size_bytes: number;
          storage_path: string;
          uploaded_by: string;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          clinic_id: string;
          created_at?: string;
          filename: string;
          id?: string;
          kind?: Database["public"]["Enums"]["patient_document_kind"];
          mime_type: string;
          notes?: string | null;
          patient_id: string;
          size_bytes: number;
          storage_path: string;
          uploaded_by?: string;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          clinic_id?: string;
          created_at?: string;
          filename?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["patient_document_kind"];
          mime_type?: string;
          notes?: string | null;
          patient_id?: string;
          size_bytes?: number;
          storage_path?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patient_documents_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_documents_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_medical_history: {
        Row: {
          allergies: string[];
          chronic_medications: string[];
          clinic_id: string;
          conditions: string[];
          id: string;
          notes: string | null;
          patient_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          allergies?: string[];
          chronic_medications?: string[];
          clinic_id: string;
          conditions?: string[];
          id?: string;
          notes?: string | null;
          patient_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          allergies?: string[];
          chronic_medications?: string[];
          clinic_id?: string;
          conditions?: string[];
          id?: string;
          notes?: string | null;
          patient_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "patient_medical_history_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_medical_history_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: true;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_medical_history_audit: {
        Row: {
          allergies: string[];
          change_kind: string;
          changed_by: string | null;
          chronic_medications: string[];
          clinic_id: string;
          conditions: string[];
          id: string;
          notes: string | null;
          patient_id: string;
          recorded_at: string;
        };
        Insert: {
          allergies: string[];
          change_kind: string;
          changed_by?: string | null;
          chronic_medications: string[];
          clinic_id: string;
          conditions: string[];
          id?: string;
          notes?: string | null;
          patient_id: string;
          recorded_at?: string;
        };
        Update: {
          allergies?: string[];
          change_kind?: string;
          changed_by?: string | null;
          chronic_medications?: string[];
          clinic_id?: string;
          conditions?: string[];
          id?: string;
          notes?: string | null;
          patient_id?: string;
          recorded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patient_medical_history_audit_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_medical_history_audit_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      patients: {
        Row: {
          ai_summary: string | null;
          ai_summary_updated_at: string | null;
          avatar_url: string | null;
          balance_cents: number | null;
          birth_date: string | null;
          branch_id: string | null;
          agreement_id: string | null;
          agreement_member_id: string | null;
          clinic_id: string;
          created_at: string;
          created_by: string;
          document_id: string | null;
          document_id_enc: string | null;
          document_id_hash: string | null;
          email: string | null;
          full_name: string;
          id: string;
          no_show_risk: number | null;
          phone: string | null;
          phone_valid: boolean | null;
          portal_revoked_at: string | null;
          primary_professional_id: string | null;
          referral_code: string | null;
          status: Database["public"]["Enums"]["patient_status"];
          tags: string[];
          updated_at: string;
          updated_by: string | null;
          wa_opt_in: boolean;
          wa_opt_in_at: string | null;
          wa_opt_out_at: string | null;
        };
        Insert: {
          ai_summary?: string | null;
          ai_summary_updated_at?: string | null;
          avatar_url?: string | null;
          balance_cents?: number | null;
          birth_date?: string | null;
          branch_id?: string | null;
          agreement_id?: string | null;
          agreement_member_id?: string | null;
          clinic_id: string;
          created_at?: string;
          created_by?: string;
          document_id?: string | null;
          document_id_enc?: string | null;
          document_id_hash?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          no_show_risk?: number | null;
          phone?: string | null;
          phone_valid?: boolean | null;
          portal_revoked_at?: string | null;
          primary_professional_id?: string | null;
          referral_code?: string | null;
          status?: Database["public"]["Enums"]["patient_status"];
          tags?: string[];
          updated_at?: string;
          updated_by?: string | null;
          wa_opt_in?: boolean;
          wa_opt_in_at?: string | null;
          wa_opt_out_at?: string | null;
        };
        Update: {
          ai_summary?: string | null;
          ai_summary_updated_at?: string | null;
          avatar_url?: string | null;
          balance_cents?: number | null;
          birth_date?: string | null;
          branch_id?: string | null;
          agreement_id?: string | null;
          agreement_member_id?: string | null;
          clinic_id?: string;
          created_at?: string;
          created_by?: string;
          document_id?: string | null;
          document_id_enc?: string | null;
          document_id_hash?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          no_show_risk?: number | null;
          phone?: string | null;
          phone_valid?: boolean | null;
          portal_revoked_at?: string | null;
          primary_professional_id?: string | null;
          referral_code?: string | null;
          status?: Database["public"]["Enums"]["patient_status"];
          tags?: string[];
          updated_at?: string;
          updated_by?: string | null;
          wa_opt_in?: boolean;
          wa_opt_in_at?: string | null;
          wa_opt_out_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "patients_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patients_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patients_primary_professional_id_fkey";
            columns: ["primary_professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_methods: {
        Row: {
          allows_refund: boolean;
          clinic_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          legacy_key: Database["public"]["Enums"]["payment_method"] | null;
          name: string;
          position: number;
          retention_pct: number;
          updated_at: string;
        };
        Insert: {
          allows_refund?: boolean;
          clinic_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          legacy_key?: Database["public"]["Enums"]["payment_method"] | null;
          name: string;
          position?: number;
          retention_pct?: number;
          updated_at?: string;
        };
        Update: {
          allows_refund?: boolean;
          clinic_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          legacy_key?: Database["public"]["Enums"]["payment_method"] | null;
          name?: string;
          position?: number;
          retention_pct?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_methods_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_cents: number;
          clinic_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          id: string;
          method: Database["public"]["Enums"]["payment_method"];
          method_name_snapshot: string | null;
          net_cents: number | null;
          notes: string | null;
          payment_method_id: string | null;
          paid_at: string;
          patient_id: string;
          reference: string | null;
          treatment_item_id: string | null;
          treatment_plan_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          clinic_id: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          method_name_snapshot?: string | null;
          net_cents?: number | null;
          notes?: string | null;
          payment_method_id?: string | null;
          paid_at?: string;
          patient_id: string;
          reference?: string | null;
          treatment_item_id?: string | null;
          treatment_plan_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          clinic_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          method_name_snapshot?: string | null;
          net_cents?: number | null;
          notes?: string | null;
          payment_method_id?: string | null;
          paid_at?: string;
          patient_id?: string;
          reference?: string | null;
          treatment_item_id?: string | null;
          treatment_plan_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_treatment_item_id_fkey";
            columns: ["treatment_item_id"];
            isOneToOne: false;
            referencedRelation: "treatment_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_treatment_plan_id_fkey";
            columns: ["treatment_plan_id"];
            isOneToOne: false;
            referencedRelation: "treatment_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      periodontal_charts: {
        Row: {
          clinic_id: string;
          id: string;
          notes: string | null;
          patient_id: string;
          recorded_at: string;
          recorded_by: string;
        };
        Insert: {
          clinic_id: string;
          id?: string;
          notes?: string | null;
          patient_id: string;
          recorded_at?: string;
          recorded_by?: string;
        };
        Update: {
          clinic_id?: string;
          id?: string;
          notes?: string | null;
          patient_id?: string;
          recorded_at?: string;
          recorded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "periodontal_charts_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "periodontal_charts_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      periodontal_measurements: {
        Row: {
          bleeding: boolean | null;
          chart_id: string;
          clinic_id: string;
          created_at: string;
          furcation: number | null;
          id: string;
          mobility: number | null;
          pocket_depth_mm: number | null;
          point: Database["public"]["Enums"]["periodontal_point"];
          recession_mm: number | null;
          tooth_number: number;
        };
        Insert: {
          bleeding?: boolean | null;
          chart_id: string;
          clinic_id: string;
          created_at?: string;
          furcation?: number | null;
          id?: string;
          mobility?: number | null;
          pocket_depth_mm?: number | null;
          point: Database["public"]["Enums"]["periodontal_point"];
          recession_mm?: number | null;
          tooth_number: number;
        };
        Update: {
          bleeding?: boolean | null;
          chart_id?: string;
          clinic_id?: string;
          created_at?: string;
          furcation?: number | null;
          id?: string;
          mobility?: number | null;
          pocket_depth_mm?: number | null;
          point?: Database["public"]["Enums"]["periodontal_point"];
          recession_mm?: number | null;
          tooth_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "periodontal_measurements_chart_id_fkey";
            columns: ["chart_id"];
            isOneToOne: false;
            referencedRelation: "periodontal_charts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "periodontal_measurements_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      portal_access_log: {
        Row: {
          clinic_id: string;
          created_at: string;
          event: string;
          id: string;
          ip_hint: string | null;
          patient_id: string;
          user_agent: string | null;
        };
        Insert: {
          clinic_id: string;
          created_at?: string;
          event: string;
          id?: string;
          ip_hint?: string | null;
          patient_id: string;
          user_agent?: string | null;
        };
        Update: {
          clinic_id?: string;
          created_at?: string;
          event?: string;
          id?: string;
          ip_hint?: string | null;
          patient_id?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "portal_access_log_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "portal_access_log_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      procedures: {
        Row: {
          category: string | null;
          clinic_id: string;
          code: string | null;
          created_at: string;
          created_by: string;
          currency: string;
          default_price_cents: number;
          duration_min: number | null;
          allows_discount: boolean;
          id: string;
          is_active: boolean;
          lab_cost_cents: number | null;
          name: string;
          position: number;
          reference_price_cents: number | null;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          clinic_id: string;
          code?: string | null;
          created_at?: string;
          created_by?: string;
          currency?: string;
          default_price_cents?: number;
          duration_min?: number | null;
          allows_discount?: boolean;
          id?: string;
          is_active?: boolean;
          lab_cost_cents?: number | null;
          name: string;
          position?: number;
          reference_price_cents?: number | null;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          clinic_id?: string;
          code?: string | null;
          created_at?: string;
          created_by?: string;
          currency?: string;
          default_price_cents?: number;
          duration_min?: number | null;
          allows_discount?: boolean;
          id?: string;
          is_active?: boolean;
          lab_cost_cents?: number | null;
          name?: string;
          position?: number;
          reference_price_cents?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "procedures_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      professional_schedules: {
        Row: {
          clinic_id: string;
          created_at: string;
          day_of_week: number;
          end_time: string;
          id: string;
          professional_id: string;
          start_time: string;
        };
        Insert: {
          clinic_id: string;
          created_at?: string;
          day_of_week: number;
          end_time: string;
          id?: string;
          professional_id: string;
          start_time: string;
        };
        Update: {
          clinic_id?: string;
          created_at?: string;
          day_of_week?: number;
          end_time?: string;
          id?: string;
          professional_id?: string;
          start_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professional_schedules_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professional_schedules_professional_id_fkey";
            columns: ["professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
        ];
      };
      professionals: {
        Row: {
          branch_id: string | null;
          clinic_id: string;
          color: string;
          created_at: string;
          default_operatory_id: string | null;
          email: string | null;
          full_name: string;
          id: string;
          is_active: boolean;
          license_number: string | null;
          phone: string | null;
          specialty_id: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          clinic_id: string;
          color?: string;
          created_at?: string;
          default_operatory_id?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          is_active?: boolean;
          license_number?: string | null;
          phone?: string | null;
          specialty_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          clinic_id?: string;
          color?: string;
          created_at?: string;
          default_operatory_id?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          license_number?: string | null;
          phone?: string | null;
          specialty_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "professionals_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professionals_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professionals_default_operatory_id_fkey";
            columns: ["default_operatory_id"];
            isOneToOne: false;
            referencedRelation: "operatories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professionals_specialty_id_fkey";
            columns: ["specialty_id"];
            isOneToOne: false;
            referencedRelation: "specialties";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      quote_items: {
        Row: {
          clinic_id: string;
          created_at: string;
          discount_cents: number;
          coverage_cents: number | null;
          discount_pct: number | null;
          patient_cents: number | null;
          id: string;
          name_snapshot: string;
          notes: string | null;
          phase_label: string | null;
          phase_position: number;
          position: number;
          procedure_id: string | null;
          quantity: number;
          quote_id: string;
          surface: Database["public"]["Enums"]["tooth_surface"] | null;
          tooth_number: number | null;
          total_cents: number;
          unit_price_cents: number;
        };
        Insert: {
          clinic_id: string;
          created_at?: string;
          discount_cents?: number;
          coverage_cents?: number | null;
          discount_pct?: number | null;
          patient_cents?: number | null;
          id?: string;
          name_snapshot: string;
          notes?: string | null;
          phase_label?: string | null;
          phase_position?: number;
          position?: number;
          procedure_id?: string | null;
          quantity?: number;
          quote_id: string;
          surface?: Database["public"]["Enums"]["tooth_surface"] | null;
          tooth_number?: number | null;
          total_cents: number;
          unit_price_cents: number;
        };
        Update: {
          clinic_id?: string;
          created_at?: string;
          discount_cents?: number;
          coverage_cents?: number | null;
          discount_pct?: number | null;
          patient_cents?: number | null;
          id?: string;
          name_snapshot?: string;
          notes?: string | null;
          phase_label?: string | null;
          phase_position?: number;
          position?: number;
          procedure_id?: string | null;
          quantity?: number;
          quote_id?: string;
          surface?: Database["public"]["Enums"]["tooth_surface"] | null;
          tooth_number?: number | null;
          total_cents?: number;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "quote_items_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_items_procedure_id_fkey";
            columns: ["procedure_id"];
            isOneToOne: false;
            referencedRelation: "procedures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          accepted_at: string | null;
          accepted_by_name: string | null;
          accepted_ip: unknown;
          accepted_signature_path: string | null;
          accepted_user_agent: string | null;
          clinic_id: string;
          created_at: string;
          created_by: string;
          agreement_id: string | null;
          agreement_name_snapshot: string | null;
          commercial_discount_pct: number | null;
          coverage_total_cents: number | null;
          currency: string;
          discount_cents: number;
          id: string;
          notes: string | null;
          number: string;
          patient_id: string;
          rejected_at: string | null;
          sent_at: string | null;
          status: Database["public"]["Enums"]["quote_status"];
          subtotal_cents: number;
          total_cents: number;
          updated_at: string;
          valid_until: string | null;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by_name?: string | null;
          accepted_ip?: unknown;
          accepted_signature_path?: string | null;
          accepted_user_agent?: string | null;
          clinic_id: string;
          created_at?: string;
          created_by?: string;
          agreement_id?: string | null;
          agreement_name_snapshot?: string | null;
          commercial_discount_pct?: number | null;
          coverage_total_cents?: number | null;
          currency?: string;
          discount_cents?: number;
          id?: string;
          notes?: string | null;
          number: string;
          patient_id: string;
          rejected_at?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["quote_status"];
          subtotal_cents?: number;
          total_cents?: number;
          updated_at?: string;
          valid_until?: string | null;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by_name?: string | null;
          accepted_ip?: unknown;
          accepted_signature_path?: string | null;
          accepted_user_agent?: string | null;
          clinic_id?: string;
          created_at?: string;
          created_by?: string;
          agreement_id?: string | null;
          agreement_name_snapshot?: string | null;
          commercial_discount_pct?: number | null;
          coverage_total_cents?: number | null;
          currency?: string;
          discount_cents?: number;
          id?: string;
          notes?: string | null;
          number?: string;
          patient_id?: string;
          rejected_at?: string | null;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["quote_status"];
          subtotal_cents?: number;
          total_cents?: number;
          updated_at?: string;
          valid_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      specialties: {
        Row: {
          clinic_id: string;
          color: string;
          created_at: string;
          default_duration_min: number;
          id: string;
          is_active: boolean;
          name: string;
        };
        Insert: {
          clinic_id: string;
          color?: string;
          created_at?: string;
          default_duration_min?: number;
          id?: string;
          is_active?: boolean;
          name: string;
        };
        Update: {
          clinic_id?: string;
          color?: string;
          created_at?: string;
          default_duration_min?: number;
          id?: string;
          is_active?: boolean;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "specialties_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          clinic_id: string | null;
          id: string;
          raw: Json | null;
          received_at: string;
          type: string;
        };
        Insert: {
          clinic_id?: string | null;
          id: string;
          raw?: Json | null;
          received_at?: string;
          type: string;
        };
        Update: {
          clinic_id?: string | null;
          id?: string;
          raw?: Json | null;
          received_at?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_events_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          clinic_id: string;
          created_at: string;
          current_period_end: string | null;
          status: string;
          stripe_customer_id: string | null;
          stripe_price_id: string | null;
          stripe_subscription_id: string | null;
          trial_end: string | null;
          updated_at: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          clinic_id: string;
          created_at?: string;
          current_period_end?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_end?: string | null;
          updated_at?: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          clinic_id?: string;
          created_at?: string;
          current_period_end?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_end?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: true;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      treatment_items: {
        Row: {
          clinic_id: string;
          completed_at: string | null;
          completed_by: string | null;
          coverage_cents: number | null;
          created_at: string;
          id: string;
          name_snapshot: string;
          notes: string | null;
          patient_cents: number | null;
          phase_label: string | null;
          phase_position: number;
          plan_id: string;
          position: number;
          price_cents: number;
          procedure_id: string | null;
          professional_id: string | null;
          quote_item_id: string | null;
          scheduled_appointment_id: string | null;
          status: Database["public"]["Enums"]["treatment_item_status"];
          surface: Database["public"]["Enums"]["tooth_surface"] | null;
          tooth_number: number | null;
          updated_at: string;
        };
        Insert: {
          clinic_id: string;
          completed_at?: string | null;
          completed_by?: string | null;
          coverage_cents?: number | null;
          created_at?: string;
          id?: string;
          name_snapshot: string;
          notes?: string | null;
          patient_cents?: number | null;
          phase_label?: string | null;
          phase_position?: number;
          plan_id: string;
          position?: number;
          price_cents: number;
          procedure_id?: string | null;
          professional_id?: string | null;
          quote_item_id?: string | null;
          scheduled_appointment_id?: string | null;
          status?: Database["public"]["Enums"]["treatment_item_status"];
          surface?: Database["public"]["Enums"]["tooth_surface"] | null;
          tooth_number?: number | null;
          updated_at?: string;
        };
        Update: {
          clinic_id?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          coverage_cents?: number | null;
          created_at?: string;
          id?: string;
          name_snapshot?: string;
          notes?: string | null;
          patient_cents?: number | null;
          phase_label?: string | null;
          phase_position?: number;
          plan_id?: string;
          position?: number;
          price_cents?: number;
          procedure_id?: string | null;
          professional_id?: string | null;
          quote_item_id?: string | null;
          scheduled_appointment_id?: string | null;
          status?: Database["public"]["Enums"]["treatment_item_status"];
          surface?: Database["public"]["Enums"]["tooth_surface"] | null;
          tooth_number?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "treatment_items_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "treatment_items_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "treatment_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "treatment_items_procedure_id_fkey";
            columns: ["procedure_id"];
            isOneToOne: false;
            referencedRelation: "procedures";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "treatment_items_professional_id_fkey";
            columns: ["professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "treatment_items_quote_item_id_fkey";
            columns: ["quote_item_id"];
            isOneToOne: false;
            referencedRelation: "quote_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "treatment_items_scheduled_appointment_id_fkey";
            columns: ["scheduled_appointment_id"];
            isOneToOne: false;
            referencedRelation: "appointments";
            referencedColumns: ["id"];
          },
        ];
      };
      treatment_plans: {
        Row: {
          clinic_id: string;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          currency: string;
          id: string;
          name: string;
          notes: string | null;
          patient_id: string;
          quote_id: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["treatment_plan_status"];
          total_cents: number;
          updated_at: string;
        };
        Insert: {
          clinic_id: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          currency?: string;
          id?: string;
          name: string;
          notes?: string | null;
          patient_id: string;
          quote_id?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["treatment_plan_status"];
          total_cents?: number;
          updated_at?: string;
        };
        Update: {
          clinic_id?: string;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          currency?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          patient_id?: string;
          quote_id?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["treatment_plan_status"];
          total_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "treatment_plans_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "treatment_plans_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "treatment_plans_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      waitlist_entries: {
        Row: {
          branch_id: string | null;
          clinic_id: string;
          created_at: string;
          created_by: string;
          full_name: string;
          id: string;
          patient_id: string | null;
          reason: string | null;
          status: string;
          updated_at: string;
          wait_since: string;
        };
        Insert: {
          branch_id?: string | null;
          clinic_id: string;
          created_at?: string;
          created_by?: string;
          full_name: string;
          id?: string;
          patient_id?: string | null;
          reason?: string | null;
          status?: string;
          updated_at?: string;
          wait_since?: string;
        };
        Update: {
          branch_id?: string | null;
          clinic_id?: string;
          created_at?: string;
          created_by?: string;
          full_name?: string;
          id?: string;
          patient_id?: string | null;
          reason?: string | null;
          status?: string;
          updated_at?: string;
          wait_since?: string;
        };
        Relationships: [
          {
            foreignKeyName: "waitlist_entries_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_entries_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "waitlist_entries_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_accounts: {
        Row: {
          clinic_id: string;
          connected_at: string;
          connected_by: string;
          display_phone: string | null;
          id: string;
          phone_number_id: string;
          quality_rating: string | null;
          status: string;
          updated_at: string;
          waba_id: string;
        };
        Insert: {
          clinic_id: string;
          connected_at?: string;
          connected_by?: string;
          display_phone?: string | null;
          id?: string;
          phone_number_id: string;
          quality_rating?: string | null;
          status?: string;
          updated_at?: string;
          waba_id: string;
        };
        Update: {
          clinic_id?: string;
          connected_at?: string;
          connected_by?: string;
          display_phone?: string | null;
          id?: string;
          phone_number_id?: string;
          quality_rating?: string | null;
          status?: string;
          updated_at?: string;
          waba_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_accounts_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: true;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
        ];
      };
      whatsapp_leads: {
        Row: {
          auto_replied_at: string | null;
          clinic_id: string;
          created_at: string;
          first_message: string;
          id: string;
          name: string | null;
          phone: string;
          referred_by_patient_id: string | null;
          status: Database["public"]["Enums"]["whatsapp_lead_status"];
          updated_at: string;
        };
        Insert: {
          auto_replied_at?: string | null;
          clinic_id: string;
          created_at?: string;
          first_message: string;
          id?: string;
          name?: string | null;
          phone: string;
          referred_by_patient_id?: string | null;
          status?: Database["public"]["Enums"]["whatsapp_lead_status"];
          updated_at?: string;
        };
        Update: {
          auto_replied_at?: string | null;
          clinic_id?: string;
          created_at?: string;
          first_message?: string;
          id?: string;
          name?: string | null;
          phone?: string;
          referred_by_patient_id?: string | null;
          status?: Database["public"]["Enums"]["whatsapp_lead_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_leads_clinic_id_fkey";
            columns: ["clinic_id"];
            isOneToOne: false;
            referencedRelation: "clinics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_leads_referred_by_patient_id_fkey";
            columns: ["referred_by_patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      can_manage_clinic: { Args: { _clinic_id: string }; Returns: boolean };
      clinic_role_of: {
        Args: { _clinic_id: string; _user_id: string };
        Returns: Database["public"]["Enums"]["app_role"];
      };
      get_patient_document_id: {
        Args: { p_patient_id: string };
        Returns: string;
      };
      has_active_subscription: {
        Args: { p_clinic_id: string };
        Returns: boolean;
      };
      has_clinic_role: {
        Args: {
          _clinic_id: string;
          _roles: Database["public"]["Enums"]["app_role"][];
        };
        Returns: boolean;
      };
      is_clinic_member: { Args: { _clinic_id: string }; Returns: boolean };
      is_clinic_member_of: {
        Args: { _clinic_id: string; _user_id: string };
        Returns: boolean;
      };
      list_patients_with_last_and_next_appointment: {
        Args: { p_clinic_id: string };
        Returns: {
          last_appointment_at: string;
          last_appointment_status: Database["public"]["Enums"]["appointment_status"];
          next_appointment_at: string;
          next_appointment_status: Database["public"]["Enums"]["appointment_status"];
          patient_id: string;
        }[];
      };
      next_clinic_counter: {
        Args: { p_clinic_id: string; p_kind: string; p_year: number };
        Returns: number;
      };
      reset_demo_clinic: { Args: never; Returns: undefined };
      set_patient_document_id: {
        Args: { p_document_id: string; p_patient_id: string };
        Returns: undefined;
      };
      shares_clinic_with: { Args: { _user_id: string }; Returns: boolean };
      storage_clinic_id_of: { Args: { _name: string }; Returns: string };
    };
    Enums: {
      app_role: "owner" | "admin" | "dentist" | "assistant" | "reception" | "accounting";
      appointment_status:
        "tentativa" | "confirmada" | "en-sala" | "ausente" | "finalizada" | "cancelada";
      clinical_entity_kind: "diagnosis" | "treatment" | "medication" | "allergy";
      inventory_movement_kind: "entrada" | "salida" | "ajuste";
      message_channel: "whatsapp" | "sms" | "email";
      message_direction: "outbound" | "inbound";
      message_status: "draft" | "queued" | "sent" | "delivered" | "read" | "failed";
      message_template_kind:
        | "appointment_reminder"
        | "appointment_confirmation"
        | "quote_sent"
        | "payment_receipt"
        | "nps_survey"
        | "custom"
        | "appointment_checkin"
        | "hygiene_recall"
        | "review_request"
        | "payment_due"
        | "waitlist_opening"
        | "quote_follow_up"
        | "portal_invite"
        | "birthday_greeting"
        | "treatment_followup"
        | "referral_invite"
        | "commission_settled";
      patient_document_kind: "image" | "radiograph" | "other";
      patient_status: "active" | "new" | "inactive";
      payment_method: "cash" | "debit_card" | "credit_card" | "transfer" | "other";
      periodontal_point: "mv" | "v" | "dv" | "ml" | "l" | "dl" | "whole";
      quote_status: "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";
      tooth_condition:
        | "sano"
        | "caries"
        | "obturacion"
        | "endodoncia"
        | "corona"
        | "implante"
        | "ausente"
        | "sellante"
        | "fractura"
        | "protesis";
      tooth_surface: "mesial" | "distal" | "oclusal" | "vestibular" | "lingual" | "whole";
      treatment_item_status: "pending" | "in_progress" | "completed" | "skipped";
      treatment_plan_status: "active" | "on_hold" | "completed" | "cancelled";
      whatsapp_lead_status: "new" | "contacted" | "converted" | "discarded";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["owner", "admin", "dentist", "assistant", "reception", "accounting"],
      appointment_status: [
        "tentativa",
        "confirmada",
        "en-sala",
        "ausente",
        "finalizada",
        "cancelada",
      ],
      clinical_entity_kind: ["diagnosis", "treatment", "medication", "allergy"],
      inventory_movement_kind: ["entrada", "salida", "ajuste"],
      message_channel: ["whatsapp", "sms", "email"],
      message_direction: ["outbound", "inbound"],
      message_status: ["draft", "queued", "sent", "delivered", "read", "failed"],
      message_template_kind: [
        "appointment_reminder",
        "appointment_confirmation",
        "quote_sent",
        "payment_receipt",
        "nps_survey",
        "custom",
        "appointment_checkin",
        "hygiene_recall",
        "review_request",
        "payment_due",
        "waitlist_opening",
        "quote_follow_up",
        "portal_invite",
        "birthday_greeting",
        "treatment_followup",
        "referral_invite",
        "commission_settled",
      ],
      patient_document_kind: ["image", "radiograph", "other"],
      patient_status: ["active", "new", "inactive"],
      payment_method: ["cash", "debit_card", "credit_card", "transfer", "other"],
      periodontal_point: ["mv", "v", "dv", "ml", "l", "dl", "whole"],
      quote_status: ["draft", "sent", "accepted", "rejected", "expired", "converted"],
      tooth_condition: [
        "sano",
        "caries",
        "obturacion",
        "endodoncia",
        "corona",
        "implante",
        "ausente",
        "sellante",
        "fractura",
        "protesis",
      ],
      tooth_surface: ["mesial", "distal", "oclusal", "vestibular", "lingual", "whole"],
      treatment_item_status: ["pending", "in_progress", "completed", "skipped"],
      treatment_plan_status: ["active", "on_hold", "completed", "cancelled"],
      whatsapp_lead_status: ["new", "contacted", "converted", "discarded"],
    },
  },
} as const;
