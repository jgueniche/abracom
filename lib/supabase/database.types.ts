export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      absences: {
        Row: {
          created_at: string
          declared_by: string | null
          ends_on: string
          id: string
          justification_path: string | null
          kind: Database["public"]["Enums"]["absence_kind"]
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          starts_on: string
          status: Database["public"]["Enums"]["absence_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          declared_by?: string | null
          ends_on: string
          id?: string
          justification_path?: string | null
          kind?: Database["public"]["Enums"]["absence_kind"]
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          starts_on: string
          status?: Database["public"]["Enums"]["absence_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          declared_by?: string | null
          ends_on?: string
          id?: string
          justification_path?: string | null
          kind?: Database["public"]["Enums"]["absence_kind"]
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          starts_on?: string
          status?: Database["public"]["Enums"]["absence_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_declared_by_profile_fkey"
            columns: ["declared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_attachments: {
        Row: {
          announcement_id: string
          created_at: string
          filename: string
          id: string
          mime: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          filename: string
          id?: string
          mime: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          filename?: string
          id?: string
          mime?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_attachments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          acked_at: string | null
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          acked_at?: string | null
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          acked_at?: string | null
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: Database["public"]["Enums"]["audience_kind"]
          author_id: string | null
          body_md: string
          body_md_en: string | null
          created_at: string
          deleted_at: string | null
          expires_at: string | null
          id: string
          locale: string
          pinned: boolean
          published_at: string | null
          requires_ack: boolean
          school_id: string
          search: unknown
          target_ids: string[]
          template: string | null
          title: string
          title_en: string | null
          updated_at: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["audience_kind"]
          author_id?: string | null
          body_md?: string
          body_md_en?: string | null
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          locale?: string
          pinned?: boolean
          published_at?: string | null
          requires_ack?: boolean
          school_id: string
          search?: never
          target_ids?: string[]
          template?: string | null
          title: string
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["audience_kind"]
          author_id?: string | null
          body_md?: string
          body_md_en?: string | null
          created_at?: string
          deleted_at?: string | null
          expires_at?: string | null
          id?: string
          locale?: string
          pinned?: boolean
          published_at?: string | null
          requires_ack?: boolean
          school_id?: string
          search?: never
          target_ids?: string[]
          template?: string | null
          title?: string
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_slots: {
        Row: {
          booked_at: string | null
          booked_by: string | null
          class_id: string
          created_at: string
          ends_at: string
          id: string
          location: string | null
          school_id: string
          starts_at: string
          student_id: string | null
          teacher_id: string
        }
        Insert: {
          booked_at?: string | null
          booked_by?: string | null
          class_id: string
          created_at?: string
          ends_at: string
          id?: string
          location?: string | null
          school_id: string
          starts_at: string
          student_id?: string | null
          teacher_id: string
        }
        Update: {
          booked_at?: string | null
          booked_by?: string | null
          class_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          location?: string | null
          school_id?: string
          starts_at?: string
          student_id?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_slots_booked_by_profile_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slots_teacher_profile_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_periods: {
        Row: {
          ends_on: string
          id: string
          label: string
          school_id: string
          school_year_id: string
          sort_order: number
          starts_on: string
        }
        Insert: {
          ends_on: string
          id?: string
          label: string
          school_id: string
          school_year_id: string
          sort_order?: number
          starts_on: string
        }
        Update: {
          ends_on?: string
          id?: string
          label?: string
          school_id?: string
          school_year_id?: string
          sort_order?: number
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_periods_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          class_id: string
          comment: string | null
          created_at: string
          id: string
          level: Database["public"]["Enums"]["assessment_level"] | null
          period_id: string
          published_at: string | null
          school_id: string
          score: number | null
          score_scale: string | null
          skill_id: string
          student_id: string
          teacher_id: string | null
          updated_at: string
          visible_to_parents: boolean
        }
        Insert: {
          class_id: string
          comment?: string | null
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["assessment_level"] | null
          period_id: string
          published_at?: string | null
          school_id: string
          score?: number | null
          score_scale?: string | null
          skill_id: string
          student_id: string
          teacher_id?: string | null
          updated_at?: string
          visible_to_parents?: boolean
        }
        Update: {
          class_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["assessment_level"] | null
          period_id?: string
          published_at?: string | null
          school_id?: string
          score?: number | null
          score_scale?: string | null
          skill_id?: string
          student_id?: string
          teacher_id?: string | null
          updated_at?: string
          visible_to_parents?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "assessment_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skill_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_teacher_profile_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json | null
          entity: string
          entity_id: string | null
          id: number
          ip: unknown
          school_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity: string
          entity_id?: string | null
          id?: never
          ip?: unknown
          school_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string
          entity_id?: string | null
          id?: never
          ip?: unknown
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_profile_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_post_media: {
        Row: {
          blurhash: string | null
          caption: string | null
          consent_checked: boolean
          created_at: string
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          post_id: string
          sort_order: number
          storage_path: string
          tagged_student_ids: string[]
          width: number | null
        }
        Insert: {
          blurhash?: string | null
          caption?: string | null
          consent_checked?: boolean
          created_at?: string
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          post_id: string
          sort_order?: number
          storage_path: string
          tagged_student_ids?: string[]
          width?: number | null
        }
        Update: {
          blurhash?: string | null
          caption?: string | null
          consent_checked?: boolean
          created_at?: string
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          post_id?: string
          sort_order?: number
          storage_path?: string
          tagged_student_ids?: string[]
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "class_post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "class_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      class_posts: {
        Row: {
          author_id: string | null
          body_md: string
          class_id: string
          created_at: string
          deleted_at: string | null
          due_on: string | null
          id: string
          published_at: string | null
          school_id: string
          search: unknown
          subject: string | null
          title: string
          type: Database["public"]["Enums"]["class_post_type"]
          updated_at: string
          visibility: Database["public"]["Enums"]["post_visibility"]
        }
        Insert: {
          author_id?: string | null
          body_md?: string
          class_id: string
          created_at?: string
          deleted_at?: string | null
          due_on?: string | null
          id?: string
          published_at?: string | null
          school_id: string
          search?: never
          subject?: string | null
          title: string
          type?: Database["public"]["Enums"]["class_post_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Update: {
          author_id?: string | null
          body_md?: string
          class_id?: string
          created_at?: string
          deleted_at?: string | null
          due_on?: string | null
          id?: string
          published_at?: string | null
          school_id?: string
          search?: never
          subject?: string | null
          title?: string
          type?: Database["public"]["Enums"]["class_post_type"]
          updated_at?: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "class_posts_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_posts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_posts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_teachers: {
        Row: {
          class_id: string
          created_at: string
          role: Database["public"]["Enums"]["class_teacher_role"]
          subject: string | null
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          role?: Database["public"]["Enums"]["class_teacher_role"]
          subject?: string | null
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["class_teacher_role"]
          subject?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_teachers_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          archived: boolean
          capacity: number | null
          created_at: string
          id: string
          level_id: string
          name: string
          room: string | null
          school_id: string
          school_year_id: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          capacity?: number | null
          created_at?: string
          id?: string
          level_id: string
          name: string
          room?: string | null
          school_id: string
          school_year_id: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          capacity?: number | null
          created_at?: string
          id?: string
          level_id?: string
          name?: string
          room?: string | null
          school_id?: string
          school_year_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_id: string | null
          body: string
          category: Database["public"]["Enums"]["community_category"]
          created_at: string
          deleted_at: string | null
          expires_at: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          school_id: string
          search: unknown
          status: Database["public"]["Enums"]["community_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string
          category?: Database["public"]["Enums"]["community_category"]
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          school_id: string
          search?: never
          status?: Database["public"]["Enums"]["community_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          category?: Database["public"]["Enums"]["community_category"]
          created_at?: string
          deleted_at?: string | null
          expires_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          school_id?: string
          search?: never
          status?: Database["public"]["Enums"]["community_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      directory_optins: {
        Row: {
          address: string | null
          created_at: string
          school_id: string
          show_address: boolean
          show_children_names: boolean
          show_email: boolean
          show_phone: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          school_id: string
          show_address?: boolean
          show_children_names?: boolean
          show_email?: boolean
          show_phone?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          school_id?: string
          show_address?: boolean
          show_children_names?: boolean
          show_email?: boolean
          show_phone?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "directory_optins_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "directory_optins_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          id: string
          name: string
          school_id: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          school_id: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          school_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          document_id: string
          document_version: number
          id: string
          ip: unknown
          signed_at: string
          student_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          document_id: string
          document_version?: number
          id?: string
          ip?: unknown
          signed_at?: string
          student_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          document_id?: string
          document_version?: number
          id?: string
          ip?: unknown
          signed_at?: string
          student_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_signatures_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          audience: Database["public"]["Enums"]["audience_kind"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description_md: string | null
          folder_id: string | null
          id: string
          mime: string
          published_at: string | null
          requires_signature: boolean
          school_id: string
          signature_per_student: boolean
          size_bytes: number | null
          storage_path: string
          target_ids: string[]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          audience?: Database["public"]["Enums"]["audience_kind"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description_md?: string | null
          folder_id?: string | null
          id?: string
          mime?: string
          published_at?: string | null
          requires_signature?: boolean
          school_id: string
          signature_per_student?: boolean
          size_bytes?: number | null
          storage_path: string
          target_ids?: string[]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          audience?: Database["public"]["Enums"]["audience_kind"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description_md?: string | null
          folder_id?: string | null
          id?: string
          mime?: string
          published_at?: string | null
          requires_signature?: boolean
          school_id?: string
          signature_per_student?: boolean
          size_bytes?: number | null
          storage_path?: string
          target_ids?: string[]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          joined_on: string
          left_on: string | null
          school_year_id: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          joined_on?: string
          left_on?: string | null
          school_year_id: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          joined_on?: string
          left_on?: string | null
          school_year_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_school_year_id_fkey"
            columns: ["school_year_id"]
            isOneToOne: false
            referencedRelation: "school_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          guests_count: number
          note: string | null
          status: Database["public"]["Enums"]["rsvp_status"]
          student_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          guests_count?: number
          note?: string | null
          status: Database["public"]["Enums"]["rsvp_status"]
          student_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          guests_count?: number
          note?: string | null
          status?: Database["public"]["Enums"]["rsvp_status"]
          student_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_slot_signups: {
        Row: {
          created_at: string
          note: string | null
          slot_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          note?: string | null
          slot_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          note?: string | null
          slot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_slot_signups_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "event_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_slot_signups_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_slots: {
        Row: {
          event_id: string
          id: string
          label: string
          needed: number
          sort_order: number
        }
        Insert: {
          event_id: string
          id?: string
          label: string
          needed?: number
          sort_order?: number
        }
        Update: {
          event_id?: string
          id?: string
          label?: string
          needed?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          capacity: number | null
          cost_note: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description_md: string
          ends_at: string | null
          id: string
          kind: Database["public"]["Enums"]["event_kind"]
          location: string | null
          requires_rsvp: boolean
          rsvp_deadline: string | null
          school_id: string
          scope: Database["public"]["Enums"]["event_scope"]
          starts_at: string
          target_ids: string[]
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          capacity?: number | null
          cost_note?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description_md?: string
          ends_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["event_kind"]
          location?: string | null
          requires_rsvp?: boolean
          rsvp_deadline?: string | null
          school_id: string
          scope?: Database["public"]["Enums"]["event_scope"]
          starts_at: string
          target_ids?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          capacity?: number | null
          cost_note?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description_md?: string
          ends_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["event_kind"]
          location?: string | null
          requires_rsvp?: boolean
          rsvp_deadline?: string | null
          school_id?: string
          scope?: Database["public"]["Enums"]["event_scope"]
          starts_at?: string
          target_ids?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_profile_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "families_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      form_responses: {
        Row: {
          answers: NonNullable<Json>
          form_id: string
          id: string
          student_id: string | null
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: NonNullable<Json>
          form_id: string
          id?: string
          student_id?: string | null
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: NonNullable<Json>
          form_id?: string
          id?: string
          student_id?: string | null
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_responses_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          audience: Database["public"]["Enums"]["audience_kind"]
          closes_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description_md: string | null
          id: string
          opens_at: string | null
          per_student: boolean
          schema: NonNullable<Json>
          school_id: string
          target_ids: string[]
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Database["public"]["Enums"]["audience_kind"]
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description_md?: string | null
          id?: string
          opens_at?: string | null
          per_student?: boolean
          schema?: NonNullable<Json>
          school_id: string
          target_ids?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Database["public"]["Enums"]["audience_kind"]
          closes_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description_md?: string | null
          id?: string
          opens_at?: string | null
          per_student?: boolean
          schema?: NonNullable<Json>
          school_id?: string
          target_ids?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_completions: {
        Row: {
          done_at: string
          marked_by_user_id: string | null
          post_id: string
          student_id: string
        }
        Insert: {
          done_at?: string
          marked_by_user_id?: string | null
          post_id: string
          student_id: string
        }
        Update: {
          done_at?: string
          marked_by_user_id?: string | null
          post_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_completions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "class_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_completions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_completions_user_profile_fkey"
            columns: ["marked_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      individual_note_reads: {
        Row: {
          note_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          note_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          note_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "individual_note_reads_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "individual_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      individual_notes: {
        Row: {
          author_id: string | null
          body_md: string
          created_at: string
          deleted_at: string | null
          id: string
          kind: Database["public"]["Enums"]["note_kind"]
          school_id: string
          student_id: string
          updated_at: string
          visibility: Database["public"]["Enums"]["post_visibility"]
        }
        Insert: {
          author_id?: string | null
          body_md: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["note_kind"]
          school_id: string
          student_id: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Update: {
          author_id?: string | null
          body_md?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["note_kind"]
          school_id?: string
          student_id?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "individual_notes_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "individual_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          ip: unknown
          legal_document_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          ip?: unknown
          legal_document_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          ip?: unknown
          legal_document_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_acceptances_legal_document_id_fkey"
            columns: ["legal_document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_acceptances_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          body_md: string
          id: string
          kind: string
          locale: string
          published_at: string
          school_id: string | null
          version: string
        }
        Insert: {
          body_md: string
          id?: string
          kind: string
          locale?: string
          published_at?: string
          school_id?: string | null
          version: string
        }
        Update: {
          body_md?: string
          id?: string
          kind?: string
          locale?: string
          published_at?: string
          school_id?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          code: Database["public"]["Enums"]["level_code"]
          id: string
          label_en: string
          label_fr: string
          school_id: string
          sort_order: number
        }
        Insert: {
          code: Database["public"]["Enums"]["level_code"]
          id?: string
          label_en: string
          label_fr: string
          school_id: string
          sort_order: number
        }
        Update: {
          code?: Database["public"]["Enums"]["level_code"]
          id?: string
          label_en?: string
          label_fr?: string
          school_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "levels_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          role: Database["public"]["Enums"]["membership_role"]
          school_id: string
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          role: Database["public"]["Enums"]["membership_role"]
          school_id: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["membership_role"]
          school_id?: string
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: NonNullable<Json>
          author_id: string | null
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          moderated_by: string | null
          moderation_reason: string | null
          reply_to: string | null
          search: unknown
          thread_id: string
        }
        Insert: {
          attachments?: NonNullable<Json>
          author_id?: string | null
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          moderated_by?: string | null
          moderation_reason?: string | null
          reply_to?: string | null
          search?: never
          thread_id: string
        }
        Update: {
          attachments?: NonNullable<Json>
          author_id?: string | null
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          moderated_by?: string | null
          moderation_reason?: string | null
          reply_to?: string | null
          search?: never
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_profile_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          digest: boolean
          email: boolean
          kind: string
          push: boolean
          quiet_hours: NonNullable<Json>
          shabbat_mode: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          digest?: boolean
          email?: boolean
          kind: string
          push?: boolean
          quiet_hours?: NonNullable<Json>
          shabbat_mode?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          digest?: boolean
          email?: boolean
          kind?: string
          push?: boolean
          quiet_hours?: NonNullable<Json>
          shabbat_mode?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          id: string
          kind: string
          payload: NonNullable<Json>
          read_at: string | null
          scheduled_for: string
          school_id: string | null
          sent_at: string | null
          user_id: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          kind: string
          payload?: NonNullable<Json>
          read_at?: string | null
          scheduled_for?: string
          school_id?: string | null
          sent_at?: string | null
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          id?: string
          kind?: string
          payload?: NonNullable<Json>
          read_at?: string | null
          scheduled_for?: string
          school_id?: string | null
          sent_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          first_name: string
          id: string
          last_name: string
          last_seen_at: string | null
          locale: string
          phone: string | null
          show_hebrew_date: boolean
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          first_name?: string
          id: string
          last_name?: string
          last_seen_at?: string | null
          locale?: string
          phone?: string | null
          show_hebrew_date?: boolean
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          last_seen_at?: string | null
          locale?: string
          phone?: string | null
          show_hebrew_date?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: NonNullable<Json>
          last_used_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys: NonNullable<Json>
          last_used_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: NonNullable<Json>
          last_used_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          message_id: string
          reason: string
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          reason: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          reason?: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_profile_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_years: {
        Row: {
          created_at: string
          ends_on: string
          id: string
          is_current: boolean
          label: string
          school_id: string
          starts_on: string
        }
        Insert: {
          created_at?: string
          ends_on: string
          id?: string
          is_current?: boolean
          label: string
          school_id: string
          starts_on: string
        }
        Update: {
          created_at?: string
          ends_on?: string
          id?: string
          is_current?: boolean
          label?: string
          school_id?: string
          starts_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_years_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          latitude: number | null
          locale_default: string
          longitude: number | null
          modules: NonNullable<Json>
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          locale_default?: string
          longitude?: number | null
          modules?: NonNullable<Json>
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          locale_default?: string
          longitude?: number | null
          modules?: NonNullable<Json>
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      skill_catalog: {
        Row: {
          code: string
          domain: string
          id: string
          label_en: string
          label_fr: string
          level_id: string
          school_id: string
          sort_order: number
        }
        Insert: {
          code: string
          domain: string
          id?: string
          label_en: string
          label_fr: string
          level_id: string
          school_id: string
          sort_order?: number
        }
        Update: {
          code?: string
          domain?: string
          id?: string
          label_en?: string
          label_fr?: string
          level_id?: string
          school_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_catalog_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_catalog_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          access_blocked: boolean
          access_blocked_reason: string | null
          can_message: boolean
          can_view_grades: boolean
          created_at: string
          is_primary: boolean
          receives_notifications: boolean
          relation: Database["public"]["Enums"]["guardian_relation"]
          student_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_blocked?: boolean
          access_blocked_reason?: string | null
          can_message?: boolean
          can_view_grades?: boolean
          created_at?: string
          is_primary?: boolean
          receives_notifications?: boolean
          relation?: Database["public"]["Enums"]["guardian_relation"]
          student_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_blocked?: boolean
          access_blocked_reason?: string | null
          can_message?: boolean
          can_view_grades?: boolean
          created_at?: string
          is_primary?: boolean
          receives_notifications?: boolean
          relation?: Database["public"]["Enums"]["guardian_relation"]
          student_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_private_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_private_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          allergies_note: string | null
          birth_date: string | null
          created_at: string
          deleted_at: string | null
          family_id: string | null
          first_name: string
          id: string
          image_rights_signed_at: string | null
          last_name: string
          photo_path: string | null
          school_id: string
          status: Database["public"]["Enums"]["student_status"]
          updated_at: string
        }
        Insert: {
          allergies_note?: string | null
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          family_id?: string | null
          first_name: string
          id?: string
          image_rights_signed_at?: string | null
          last_name: string
          photo_path?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
        }
        Update: {
          allergies_note?: string | null
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          family_id?: string | null
          first_name?: string
          id?: string
          image_rights_signed_at?: string | null
          last_name?: string
          photo_path?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["student_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_members: {
        Row: {
          joined_at: string
          last_read_at: string | null
          muted: boolean
          role: Database["public"]["Enums"]["thread_member_role"]
          thread_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          role?: Database["public"]["Enums"]["thread_member_role"]
          thread_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          last_read_at?: string | null
          muted?: boolean
          role?: Database["public"]["Enums"]["thread_member_role"]
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_members_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_members_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          allow_replies: boolean
          archived: boolean
          class_id: string | null
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          kind: Database["public"]["Enums"]["thread_kind"]
          last_message_at: string | null
          locked: boolean
          school_id: string
          settings: NonNullable<Json>
          title: string | null
          updated_at: string
        }
        Insert: {
          allow_replies?: boolean
          archived?: boolean
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["thread_kind"]
          last_message_at?: string | null
          locked?: boolean
          school_id: string
          settings?: NonNullable<Json>
          title?: string | null
          updated_at?: string
        }
        Update: {
          allow_replies?: boolean
          archived?: boolean
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["thread_kind"]
          last_message_at?: string | null
          locked?: boolean
          school_id?: string
          settings?: NonNullable<Json>
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_created_by_profile_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_my_memberships: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      can_access_class: {
        Args: { class_: string; uid?: string }
        Returns: boolean
      }
      can_access_student: {
        Args: { student: string; uid?: string }
        Returns: boolean
      }
      can_view_profile: {
        Args: { target: string; uid?: string }
        Returns: boolean
      }
      can_view_student_grades: {
        Args: { student: string; uid?: string }
        Returns: boolean
      }
      can_write_in_school: {
        Args: { school: string; uid?: string }
        Returns: boolean
      }
      class_school_id: { Args: { class_: string }; Returns: string }
      find_user_id_by_email: { Args: { email: string }; Returns: string }
      guardian_class_ids: { Args: { uid?: string }; Returns: string[] }
      guardian_student_ids: { Args: { uid?: string }; Returns: string[] }
      has_school_role: {
        Args: {
          roles: Database["public"]["Enums"]["membership_role"][]
          school: string
          uid?: string
        }
        Returns: boolean
      }
      is_class_teacher: {
        Args: { class_: string; uid?: string }
        Returns: boolean
      }
      is_school_admin: {
        Args: { school: string; uid?: string }
        Returns: boolean
      }
      is_school_member: {
        Args: { school: string; uid?: string }
        Returns: boolean
      }
      is_school_staff: {
        Args: { school: string; uid?: string }
        Returns: boolean
      }
      is_super_admin: { Args: { uid?: string }; Returns: boolean }
      is_thread_member: {
        Args: { thread: string; uid?: string }
        Returns: boolean
      }
      is_thread_moderator: {
        Args: { thread: string; uid?: string }
        Returns: boolean
      }
      matches_audience: {
        Args: {
          audience: Database["public"]["Enums"]["audience_kind"]
          school: string
          targets: string[]
          uid?: string
        }
        Returns: boolean
      }
      set_current_school_year: { Args: { year_id: string }; Returns: undefined }
      student_school_id: { Args: { student: string }; Returns: string }
      teacher_class_ids: { Args: { uid?: string }; Returns: string[] }
      teaches_student: {
        Args: { student: string; uid?: string }
        Returns: boolean
      }
      try_uuid: { Args: { value: string }; Returns: string }
      user_school_ids: { Args: { uid?: string }; Returns: string[] }
    }
    Enums: {
      absence_kind: "absence" | "late"
      absence_status: "declared" | "justified" | "unjustified"
      assessment_level: "not_yet" | "in_progress" | "acquired" | "mastered"
      audience_kind: "school" | "level" | "class" | "custom"
      class_post_type: "homework" | "journal" | "info" | "reminder"
      class_teacher_role: "main" | "assistant" | "specialist"
      community_category:
        | "carpool"
        | "childcare"
        | "lost_found"
        | "marketplace"
        | "recommendation"
        | "other"
      community_status: "pending" | "published" | "archived" | "rejected"
      event_kind:
        | "celebration"
        | "outing"
        | "meeting"
        | "volunteer"
        | "holiday"
        | "other"
      event_scope: "school" | "level" | "class"
      guardian_relation: "mother" | "father" | "guardian" | "other"
      level_code:
        | "TPS"
        | "PS"
        | "MS"
        | "GS"
        | "CP"
        | "CE1"
        | "CE2"
        | "CM1"
        | "CM2"
      media_kind: "image" | "video" | "pdf"
      membership_role:
        | "super_admin"
        | "school_admin"
        | "staff"
        | "teacher"
        | "parent"
        | "guardian"
      membership_status: "active" | "invited" | "suspended"
      note_kind: "praise" | "concern" | "info"
      notification_channel: "push" | "email" | "inapp"
      post_visibility: "parents" | "staff"
      report_status: "open" | "resolved"
      rsvp_status: "yes" | "no" | "maybe"
      student_status: "active" | "left" | "archived"
      thread_kind: "dm" | "class_group" | "class_official" | "event" | "custom"
      thread_member_role: "member" | "moderator"
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
    Enums: {
      absence_kind: ["absence", "late"],
      absence_status: ["declared", "justified", "unjustified"],
      assessment_level: ["not_yet", "in_progress", "acquired", "mastered"],
      audience_kind: ["school", "level", "class", "custom"],
      class_post_type: ["homework", "journal", "info", "reminder"],
      class_teacher_role: ["main", "assistant", "specialist"],
      community_category: [
        "carpool",
        "childcare",
        "lost_found",
        "marketplace",
        "recommendation",
        "other",
      ],
      community_status: ["pending", "published", "archived", "rejected"],
      event_kind: [
        "celebration",
        "outing",
        "meeting",
        "volunteer",
        "holiday",
        "other",
      ],
      event_scope: ["school", "level", "class"],
      guardian_relation: ["mother", "father", "guardian", "other"],
      level_code: ["TPS", "PS", "MS", "GS", "CP", "CE1", "CE2", "CM1", "CM2"],
      media_kind: ["image", "video", "pdf"],
      membership_role: [
        "super_admin",
        "school_admin",
        "staff",
        "teacher",
        "parent",
        "guardian",
      ],
      membership_status: ["active", "invited", "suspended"],
      note_kind: ["praise", "concern", "info"],
      notification_channel: ["push", "email", "inapp"],
      post_visibility: ["parents", "staff"],
      report_status: ["open", "resolved"],
      rsvp_status: ["yes", "no", "maybe"],
      student_status: ["active", "left", "archived"],
      thread_kind: ["dm", "class_group", "class_official", "event", "custom"],
      thread_member_role: ["member", "moderator"],
    },
  },
} as const

