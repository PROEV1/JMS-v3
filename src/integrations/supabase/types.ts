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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      calendar_items: {
        Row: {
          all_day: boolean
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          engineer_id: string | null
          id: string
          item_type: string
          start_date: string
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          engineer_id?: string | null
          id?: string
          item_type: string
          start_date: string
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          engineer_id?: string | null
          id?: string
          item_type?: string
          start_date?: string
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_items_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      charger_change_log: {
        Row: {
          changed_at: string
          created_at: string
          created_by: string | null
          engineer_id: string
          id: string
          new_charger_id: string | null
          new_serial_number: string
          order_id: string
          original_charger_id: string | null
          original_serial_number: string | null
          reason_category: string
          reason_description: string | null
        }
        Insert: {
          changed_at?: string
          created_at?: string
          created_by?: string | null
          engineer_id: string
          id?: string
          new_charger_id?: string | null
          new_serial_number: string
          order_id: string
          original_charger_id?: string | null
          original_serial_number?: string | null
          reason_category: string
          reason_description?: string | null
        }
        Update: {
          changed_at?: string
          created_at?: string
          created_by?: string | null
          engineer_id?: string
          id?: string
          new_charger_id?: string | null
          new_serial_number?: string
          order_id?: string
          original_charger_id?: string | null
          original_serial_number?: string | null
          reason_category?: string
          reason_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charger_change_log_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charger_change_log_new_charger_id_fkey"
            columns: ["new_charger_id"]
            isOneToOne: false
            referencedRelation: "charger_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charger_change_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charger_change_log_original_charger_id_fkey"
            columns: ["original_charger_id"]
            isOneToOne: false
            referencedRelation: "charger_inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      charger_dispatches: {
        Row: {
          charger_item_id: string
          created_at: string
          delivered_at: string | null
          dispatched_at: string | null
          dispatched_by: string | null
          id: string
          notes: string | null
          order_id: string
          serial_number: string | null
          status: string
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          charger_item_id: string
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          dispatched_by?: string | null
          id?: string
          notes?: string | null
          order_id: string
          serial_number?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          charger_item_id?: string
          created_at?: string
          delivered_at?: string | null
          dispatched_at?: string | null
          dispatched_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          serial_number?: string | null
          status?: string
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charger_dispatches_charger_item_id_fkey"
            columns: ["charger_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charger_dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      charger_inventory: {
        Row: {
          assigned_order_id: string | null
          charger_item_id: string
          created_at: string
          engineer_id: string | null
          id: string
          location_id: string | null
          notes: string | null
          serial_number: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_order_id?: string | null
          charger_item_id: string
          created_at?: string
          engineer_id?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          serial_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_order_id?: string | null
          charger_item_id?: string
          created_at?: string
          engineer_id?: string | null
          id?: string
          location_id?: string | null
          notes?: string | null
          serial_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charger_inventory_assigned_order_id_fkey"
            columns: ["assigned_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charger_inventory_charger_item_id_fkey"
            columns: ["charger_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charger_inventory_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charger_inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_blocked_dates: {
        Row: {
          blocked_date: string
          client_id: string
          created_at: string | null
          id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          client_id: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          client_id?: string
          created_at?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_blocked_dates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_survey_media: {
        Row: {
          field_key: string | null
          file_name: string | null
          file_size: number | null
          file_url: string
          id: string
          is_main: boolean
          media_type: Database["public"]["Enums"]["survey_media_type"]
          order_id: string
          position: number
          storage_bucket: string | null
          storage_path: string | null
          survey_id: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          field_key?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          is_main?: boolean
          media_type: Database["public"]["Enums"]["survey_media_type"]
          order_id: string
          position?: number
          storage_bucket?: string | null
          storage_path?: string | null
          survey_id: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          field_key?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          is_main?: boolean
          media_type?: Database["public"]["Enums"]["survey_media_type"]
          order_id?: string
          position?: number
          storage_bucket?: string | null
          storage_path?: string | null
          survey_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_survey_media_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_survey_media_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "client_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      client_surveys: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          form_version_id: string | null
          id: string
          order_id: string
          partner_id: string | null
          responses: Json
          resubmitted_at: string | null
          review_notes: string | null
          reviewed_at: string | null
          rework_reason: string | null
          status: Database["public"]["Enums"]["survey_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          form_version_id?: string | null
          id?: string
          order_id: string
          partner_id?: string | null
          responses?: Json
          resubmitted_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          rework_reason?: string | null
          status?: Database["public"]["Enums"]["survey_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          form_version_id?: string | null
          id?: string
          order_id?: string
          partner_id?: string | null
          responses?: Json
          resubmitted_at?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          rework_reason?: string | null
          status?: Database["public"]["Enums"]["survey_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_surveys_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_surveys_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "survey_form_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_surveys_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_surveys_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          email: string
          email_normalized: string | null
          full_name: string
          id: string
          is_partner_client: boolean | null
          partner_id: string | null
          phone: string | null
          postcode: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          email: string
          email_normalized?: string | null
          full_name: string
          id?: string
          is_partner_client?: boolean | null
          partner_id?: string | null
          phone?: string | null
          postcode?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string
          email_normalized?: string | null
          full_name?: string
          id?: string
          is_partner_client?: boolean | null
          partner_id?: string | null
          phone?: string | null
          postcode?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_audit_archive: {
        Row: {
          archived_at: string
          checklist_items: Json | null
          created_at: string
          engineer_id: string | null
          engineer_notes: string | null
          engineer_signature_data: string | null
          engineer_signed_off_at: string | null
          engineer_status: string | null
          id: string
          order_id: string
          reset_by: string | null
          reset_reason: string
          scheduled_date_after: string | null
          scheduled_date_before: string | null
          uploads_snapshot: Json | null
        }
        Insert: {
          archived_at?: string
          checklist_items?: Json | null
          created_at?: string
          engineer_id?: string | null
          engineer_notes?: string | null
          engineer_signature_data?: string | null
          engineer_signed_off_at?: string | null
          engineer_status?: string | null
          id?: string
          order_id: string
          reset_by?: string | null
          reset_reason: string
          scheduled_date_after?: string | null
          scheduled_date_before?: string | null
          uploads_snapshot?: Json | null
        }
        Update: {
          archived_at?: string
          checklist_items?: Json | null
          created_at?: string
          engineer_id?: string | null
          engineer_notes?: string | null
          engineer_signature_data?: string | null
          engineer_signed_off_at?: string | null
          engineer_status?: string | null
          id?: string
          order_id?: string
          reset_by?: string | null
          reset_reason?: string
          scheduled_date_after?: string | null
          scheduled_date_before?: string | null
          uploads_snapshot?: Json | null
        }
        Relationships: []
      }
      engineer_availability: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          engineer_id: string
          id: string
          is_available: boolean | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          engineer_id: string
          id?: string
          is_available?: boolean | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          engineer_id?: string
          id?: string
          is_available?: boolean | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engineer_availability_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_capacity_audit: {
        Row: {
          changed_by: string | null
          changes: Json
          created_at: string
          engineer_id: string
          id: string
        }
        Insert: {
          changed_by?: string | null
          changes: Json
          created_at?: string
          engineer_id: string
          id?: string
        }
        Update: {
          changed_by?: string | null
          changes?: Json
          created_at?: string
          engineer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineer_capacity_audit_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_materials_used: {
        Row: {
          charger_inventory_id: string | null
          created_at: string
          engineer_id: string
          id: string
          item_id: string | null
          item_name: string
          location_id: string | null
          notes: string | null
          order_id: string
          quantity: number
          serial_number: string | null
          updated_at: string
          used_at: string
        }
        Insert: {
          charger_inventory_id?: string | null
          created_at?: string
          engineer_id: string
          id?: string
          item_id?: string | null
          item_name: string
          location_id?: string | null
          notes?: string | null
          order_id: string
          quantity?: number
          serial_number?: string | null
          updated_at?: string
          used_at?: string
        }
        Update: {
          charger_inventory_id?: string | null
          created_at?: string
          engineer_id?: string
          id?: string
          item_id?: string | null
          item_name?: string
          location_id?: string | null
          notes?: string | null
          order_id?: string
          quantity?: number
          serial_number?: string | null
          updated_at?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineer_materials_used_charger_inventory_id_fkey"
            columns: ["charger_inventory_id"]
            isOneToOne: false
            referencedRelation: "charger_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_materials_used_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_materials_used_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_materials_used_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_materials_used_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_service_areas: {
        Row: {
          created_at: string
          engineer_id: string
          id: string
          max_travel_minutes: number | null
          postcode_area: string
          unbounded: boolean
        }
        Insert: {
          created_at?: string
          engineer_id: string
          id?: string
          max_travel_minutes?: number | null
          postcode_area: string
          unbounded?: boolean
        }
        Update: {
          created_at?: string
          engineer_id?: string
          id?: string
          max_travel_minutes?: number | null
          postcode_area?: string
          unbounded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "engineer_service_areas_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_time_off: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          end_date: string
          engineer_id: string
          id: string
          notes: string | null
          reason: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date: string
          engineer_id: string
          id?: string
          notes?: string | null
          reason: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date?: string
          engineer_id?: string
          id?: string
          notes?: string | null
          reason?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineer_time_off_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "engineer_time_off_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_uploads: {
        Row: {
          description: string | null
          engineer_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          order_id: string
          storage_bucket: string | null
          storage_path: string | null
          upload_type: string
          uploaded_at: string
        }
        Insert: {
          description?: string | null
          engineer_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          order_id: string
          storage_bucket?: string | null
          storage_path?: string | null
          upload_type: string
          uploaded_at?: string
        }
        Update: {
          description?: string | null
          engineer_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          order_id?: string
          storage_bucket?: string | null
          storage_path?: string | null
          upload_type?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineer_uploads_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engineer_uploads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      engineers: {
        Row: {
          availability: boolean | null
          created_at: string
          email: string
          id: string
          ignore_working_hours: boolean
          is_active: boolean | null
          is_subcontractor: boolean
          max_installs_per_day: number
          name: string
          region: string | null
          starting_postcode: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          availability?: boolean | null
          created_at?: string
          email: string
          id?: string
          ignore_working_hours?: boolean
          is_active?: boolean | null
          is_subcontractor?: boolean
          max_installs_per_day?: number
          name: string
          region?: string | null
          starting_postcode?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          availability?: boolean | null
          created_at?: string
          email?: string
          id?: string
          ignore_working_hours?: boolean
          is_active?: boolean | null
          is_subcontractor?: boolean
          max_installs_per_day?: number
          name?: string
          region?: string | null
          starting_postcode?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      files: {
        Row: {
          client_id: string
          created_at: string
          document_type: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          project_id: string | null
          quote_id: string | null
          storage_bucket: string | null
          storage_path: string | null
          upload_type: string
          uploaded_by: string
        }
        Insert: {
          client_id: string
          created_at?: string
          document_type?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          project_id?: string | null
          quote_id?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          upload_type: string
          uploaded_by: string
        }
        Update: {
          client_id?: string
          created_at?: string
          document_type?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          project_id?: string | null
          quote_id?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          upload_type?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      geocode_cache: {
        Row: {
          cached_at: string
          created_at: string
          expires_at: string
          hit_count: number
          id: string
          last_accessed: string
          latitude: number
          longitude: number
          postcode: string
          updated_at: string
        }
        Insert: {
          cached_at?: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          last_accessed?: string
          latitude: number
          longitude: number
          postcode: string
          updated_at?: string
        }
        Update: {
          cached_at?: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          id?: string
          last_accessed?: string
          latitude?: number
          longitude?: number
          postcode?: string
          updated_at?: string
        }
        Relationships: []
      }
      installers: {
        Row: {
          availability: boolean | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          availability?: boolean | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          availability?: boolean | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          created_at: string
          default_cost: number
          description: string | null
          id: string
          is_active: boolean
          is_charger: boolean
          is_serialized: boolean
          max_level: number
          min_level: number
          name: string
          reorder_point: number
          sku: string
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_cost?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_charger?: boolean
          is_serialized?: boolean
          max_level?: number
          min_level?: number
          name: string
          reorder_point?: number
          sku: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_cost?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_charger?: boolean
          is_serialized?: boolean
          max_level?: number
          min_level?: number
          name?: string
          reorder_point?: number
          sku?: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_inventory_items_supplier"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          address: string | null
          code: string | null
          created_at: string
          engineer_id: string | null
          id: string
          is_active: boolean
          name: string
          type: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code?: string | null
          created_at?: string
          engineer_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string | null
          created_at?: string
          engineer_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_locations_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_suppliers: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_txn_audit: {
        Row: {
          action: Database["public"]["Enums"]["txn_audit_action"]
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          performed_at: string | null
          performed_by: string | null
          reason: string | null
          txn_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["txn_audit_action"]
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string | null
          performed_by?: string | null
          reason?: string | null
          txn_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["txn_audit_action"]
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string | null
          performed_by?: string | null
          reason?: string | null
          txn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_txn_audit_txn_id_fkey"
            columns: ["txn_id"]
            isOneToOne: false
            referencedRelation: "inventory_txns"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_txns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          direction: string
          id: string
          item_id: string
          location_id: string
          notes: string | null
          qty: number
          reference: string | null
          rejection_reason: string | null
          status: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          item_id: string
          location_id: string
          notes?: string | null
          qty: number
          reference?: string | null
          rejection_reason?: string | null
          status?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          item_id?: string
          location_id?: string
          notes?: string | null
          qty?: number
          reference?: string | null
          rejection_reason?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_txns_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_txns_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_offers: {
        Row: {
          accepted_at: string | null
          client_token: string
          created_at: string
          created_by: string | null
          delivery_channel: string
          delivery_details: Json | null
          engineer_id: string
          expired_at: string | null
          expires_at: string
          id: string
          offered_date: string
          order_id: string
          rejected_at: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["offer_status"]
          time_window: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          client_token: string
          created_at?: string
          created_by?: string | null
          delivery_channel?: string
          delivery_details?: Json | null
          engineer_id: string
          expired_at?: string | null
          expires_at: string
          id?: string
          offered_date: string
          order_id: string
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          time_window?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          client_token?: string
          created_at?: string
          created_by?: string | null
          delivery_channel?: string
          delivery_details?: Json | null
          engineer_id?: string
          expired_at?: string | null
          expires_at?: string
          id?: string
          offered_date?: string
          order_id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          time_window?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_job_offers_engineer_id"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_job_offers_order_id"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_offers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_history: {
        Row: {
          client_id: string
          converted_at: string
          id: string
          lead_created_at: string
          lead_email: string
          lead_name: string
          lead_notes: string | null
          lead_phone: string | null
          original_lead_id: string
          product_name: string | null
          product_price: number | null
          source: string | null
          status: string | null
          width_cm: number | null
        }
        Insert: {
          client_id: string
          converted_at?: string
          id?: string
          lead_created_at: string
          lead_email: string
          lead_name: string
          lead_notes?: string | null
          lead_phone?: string | null
          original_lead_id: string
          product_name?: string | null
          product_price?: number | null
          source?: string | null
          status?: string | null
          width_cm?: number | null
        }
        Update: {
          client_id?: string
          converted_at?: string
          id?: string
          lead_created_at?: string
          lead_email?: string
          lead_name?: string
          lead_notes?: string | null
          lead_phone?: string | null
          original_lead_id?: string
          product_name?: string | null
          product_price?: number | null
          source?: string | null
          status?: string | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_status_overrides: {
        Row: {
          created_at: string
          created_by: string
          id: string
          lead_id: string
          notes: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          lead_id: string
          notes?: string | null
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          lead_id?: string
          notes?: string | null
          status?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          accessories_data: Json | null
          address: string | null
          client_id: string | null
          configuration: Json | null
          created_at: string
          created_by: string | null
          email: string
          finish: string | null
          id: string
          luxe_upgrade: boolean | null
          message: string | null
          name: string
          notes: string | null
          phone: string | null
          product_details: string | null
          product_name: string | null
          product_price: number | null
          quote_id: string | null
          quote_number: string | null
          source: string | null
          status: string
          total_cost: number | null
          total_price: number | null
          updated_at: string
          width_cm: number | null
        }
        Insert: {
          accessories_data?: Json | null
          address?: string | null
          client_id?: string | null
          configuration?: Json | null
          created_at?: string
          created_by?: string | null
          email: string
          finish?: string | null
          id?: string
          luxe_upgrade?: boolean | null
          message?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          product_details?: string | null
          product_name?: string | null
          product_price?: number | null
          quote_id?: string | null
          quote_number?: string | null
          source?: string | null
          status?: string
          total_cost?: number | null
          total_price?: number | null
          updated_at?: string
          width_cm?: number | null
        }
        Update: {
          accessories_data?: Json | null
          address?: string | null
          client_id?: string | null
          configuration?: Json | null
          created_at?: string
          created_by?: string | null
          email?: string
          finish?: string | null
          id?: string
          luxe_upgrade?: boolean | null
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          product_details?: string | null
          product_name?: string | null
          product_price?: number | null
          quote_id?: string | null
          quote_number?: string | null
          source?: string | null
          status?: string
          total_cost?: number | null
          total_price?: number | null
          updated_at?: string
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      mapbox_usage_tracking: {
        Row: {
          api_type: string
          call_count: number
          created_at: string
          function_name: string
          id: string
          metadata: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          api_type: string
          call_count?: number
          created_at?: string
          function_name: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          api_type?: string
          call_count?: number
          created_at?: string
          function_name?: string
          id?: string
          metadata?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          client_id: string | null
          content: string
          created_at: string
          id: string
          is_read: boolean | null
          project_id: string | null
          quote_id: string | null
          sender_id: string | null
          sender_role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["message_status"] | null
        }
        Insert: {
          client_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          project_id?: string | null
          quote_id?: string | null
          sender_id?: string | null
          sender_role: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["message_status"] | null
        }
        Update: {
          client_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          project_id?: string | null
          quote_id?: string | null
          sender_id?: string | null
          sender_role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["message_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          confirmation_immediate: boolean | null
          created_at: string | null
          email_enabled: boolean | null
          id: string
          phone_number: string | null
          reminder_48h: boolean | null
          sms_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          confirmation_immediate?: boolean | null
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          phone_number?: string | null
          reminder_48h?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          confirmation_immediate?: boolean | null
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          phone_number?: string | null
          reminder_48h?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_activity: {
        Row: {
          activity_type: string
          created_at: string
          created_by: string | null
          description: string
          details: Json | null
          id: string
          order_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          created_by?: string | null
          description: string
          details?: Json | null
          id?: string
          order_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          created_by?: string | null
          description?: string
          details?: Json | null
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_activity_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_completion_checklist: {
        Row: {
          completed_at: string | null
          created_at: string
          engineer_id: string | null
          id: string
          is_completed: boolean
          item_description: string | null
          item_id: string
          item_label: string
          order_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          engineer_id?: string | null
          id?: string
          is_completed?: boolean
          item_description?: string | null
          item_id: string
          item_label: string
          order_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          engineer_id?: string | null
          id?: string
          is_completed?: boolean
          item_description?: string | null
          item_id?: string
          item_label?: string
          order_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note_content: string
          order_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note_content: string
          order_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note_content?: string
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          paid_at: string | null
          payment_method: string | null
          payment_type: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id: string
          paid_at?: string | null
          payment_method?: string | null
          payment_type: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_type?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_quote_snapshots: {
        Row: {
          created_at: string | null
          created_by: string | null
          html_content: string | null
          id: string
          order_id: string
          pdf_url: string | null
          quote_data: Json
          quote_id: string
          revision_reason: string | null
          snapshot_type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          html_content?: string | null
          id?: string
          order_id: string
          pdf_url?: string | null
          quote_data: Json
          quote_id: string
          revision_reason?: string | null
          snapshot_type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          html_content?: string | null
          id?: string
          order_id?: string
          pdf_url?: string | null
          quote_data?: Json
          quote_id?: string
          revision_reason?: string | null
          snapshot_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_quote_snapshots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_quote_snapshots_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_qa_notes: string | null
          agreement_document_url: string | null
          agreement_signed_at: string | null
          amount_paid: number
          charger_model_id: string | null
          client_id: string | null
          created_at: string
          deposit_amount: number
          engineer_id: string | null
          engineer_notes: string | null
          engineer_signature_data: string | null
          engineer_signed_off_at: string | null
          estimated_duration_hours: number | null
          expected_duration_days: number | null
          external_confirmation_source: string | null
          groundworks_required: boolean | null
          id: string
          installation_date: string | null
          installation_notes: string | null
          internal_install_notes: string | null
          is_partner_job: boolean | null
          job_address: string | null
          job_type: Database["public"]["Enums"]["order_job_type"]
          manual_status_notes: string | null
          manual_status_override: boolean | null
          multiple_engineers_required: boolean | null
          order_number: string
          part_details: string | null
          part_required: boolean | null
          partner_confirmed_at: string | null
          partner_confirmed_externally: boolean | null
          partner_external_id: string | null
          partner_external_url: string | null
          partner_id: string | null
          partner_metadata: Json
          partner_status: string | null
          partner_status_raw: string | null
          parts_delivered: boolean | null
          parts_ordered: boolean | null
          postcode: string | null
          quote_id: string | null
          quote_type: string | null
          scheduled_install_date: string | null
          scheduling_conflicts: Json | null
          scheduling_suppressed: boolean
          scheduling_suppressed_reason: string | null
          specific_engineer_id: string | null
          specific_engineer_required: boolean | null
          status: string
          status_enhanced:
            | Database["public"]["Enums"]["order_status_enhanced"]
            | null
          sub_partner: string | null
          survey_required: boolean
          survey_token: string | null
          survey_token_expires_at: string | null
          time_window: string | null
          total_amount: number | null
          travel_time_minutes: number | null
          updated_at: string
        }
        Insert: {
          admin_qa_notes?: string | null
          agreement_document_url?: string | null
          agreement_signed_at?: string | null
          amount_paid?: number
          charger_model_id?: string | null
          client_id?: string | null
          created_at?: string
          deposit_amount?: number
          engineer_id?: string | null
          engineer_notes?: string | null
          engineer_signature_data?: string | null
          engineer_signed_off_at?: string | null
          estimated_duration_hours?: number | null
          expected_duration_days?: number | null
          external_confirmation_source?: string | null
          groundworks_required?: boolean | null
          id?: string
          installation_date?: string | null
          installation_notes?: string | null
          internal_install_notes?: string | null
          is_partner_job?: boolean | null
          job_address?: string | null
          job_type?: Database["public"]["Enums"]["order_job_type"]
          manual_status_notes?: string | null
          manual_status_override?: boolean | null
          multiple_engineers_required?: boolean | null
          order_number: string
          part_details?: string | null
          part_required?: boolean | null
          partner_confirmed_at?: string | null
          partner_confirmed_externally?: boolean | null
          partner_external_id?: string | null
          partner_external_url?: string | null
          partner_id?: string | null
          partner_metadata?: Json
          partner_status?: string | null
          partner_status_raw?: string | null
          parts_delivered?: boolean | null
          parts_ordered?: boolean | null
          postcode?: string | null
          quote_id?: string | null
          quote_type?: string | null
          scheduled_install_date?: string | null
          scheduling_conflicts?: Json | null
          scheduling_suppressed?: boolean
          scheduling_suppressed_reason?: string | null
          specific_engineer_id?: string | null
          specific_engineer_required?: boolean | null
          status?: string
          status_enhanced?:
            | Database["public"]["Enums"]["order_status_enhanced"]
            | null
          sub_partner?: string | null
          survey_required?: boolean
          survey_token?: string | null
          survey_token_expires_at?: string | null
          time_window?: string | null
          total_amount?: number | null
          travel_time_minutes?: number | null
          updated_at?: string
        }
        Update: {
          admin_qa_notes?: string | null
          agreement_document_url?: string | null
          agreement_signed_at?: string | null
          amount_paid?: number
          charger_model_id?: string | null
          client_id?: string | null
          created_at?: string
          deposit_amount?: number
          engineer_id?: string | null
          engineer_notes?: string | null
          engineer_signature_data?: string | null
          engineer_signed_off_at?: string | null
          estimated_duration_hours?: number | null
          expected_duration_days?: number | null
          external_confirmation_source?: string | null
          groundworks_required?: boolean | null
          id?: string
          installation_date?: string | null
          installation_notes?: string | null
          internal_install_notes?: string | null
          is_partner_job?: boolean | null
          job_address?: string | null
          job_type?: Database["public"]["Enums"]["order_job_type"]
          manual_status_notes?: string | null
          manual_status_override?: boolean | null
          multiple_engineers_required?: boolean | null
          order_number?: string
          part_details?: string | null
          part_required?: boolean | null
          partner_confirmed_at?: string | null
          partner_confirmed_externally?: boolean | null
          partner_external_id?: string | null
          partner_external_url?: string | null
          partner_id?: string | null
          partner_metadata?: Json
          partner_status?: string | null
          partner_status_raw?: string | null
          parts_delivered?: boolean | null
          parts_ordered?: boolean | null
          postcode?: string | null
          quote_id?: string | null
          quote_type?: string | null
          scheduled_install_date?: string | null
          scheduling_conflicts?: Json | null
          scheduling_suppressed?: boolean
          scheduling_suppressed_reason?: string | null
          specific_engineer_id?: string | null
          specific_engineer_required?: boolean | null
          status?: string
          status_enhanced?:
            | Database["public"]["Enums"]["order_status_enhanced"]
            | null
          sub_partner?: string | null
          survey_required?: boolean
          survey_token?: string | null
          survey_token_expires_at?: string | null
          time_window?: string | null
          total_amount?: number | null
          travel_time_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_charger_model_id_fkey"
            columns: ["charger_model_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_specific_engineer_id_fkey"
            columns: ["specific_engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_calendar_blocks: {
        Row: {
          block_status: Database["public"]["Enums"]["partner_calendar_status"]
          blocked_date: string
          created_at: string
          engineer_id: string
          id: string
          notes: string | null
          order_id: string | null
          partner_id: string
          partner_job_id: string | null
          time_slot: string | null
          updated_at: string
        }
        Insert: {
          block_status?: Database["public"]["Enums"]["partner_calendar_status"]
          blocked_date: string
          created_at?: string
          engineer_id: string
          id?: string
          notes?: string | null
          order_id?: string | null
          partner_id: string
          partner_job_id?: string | null
          time_slot?: string | null
          updated_at?: string
        }
        Update: {
          block_status?: Database["public"]["Enums"]["partner_calendar_status"]
          blocked_date?: string
          created_at?: string
          engineer_id?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          partner_id?: string
          partner_job_id?: string | null
          time_slot?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_calendar_blocks_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_calendar_blocks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_calendar_blocks_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_engineer_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          engineer_id: string
          id: string
          is_active: boolean
          partner_engineer_name: string
          partner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          engineer_id: string
          id?: string
          is_active?: boolean
          partner_engineer_name: string
          partner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          engineer_id?: string
          id?: string
          is_active?: boolean
          partner_engineer_name?: string
          partner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_engineer_mappings_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_engineer_mappings_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_import_logs: {
        Row: {
          created_at: string
          created_by: string | null
          dry_run: boolean
          errors: Json
          id: string
          inserted_count: number
          partner_id: string
          profile_id: string | null
          run_id: string | null
          skipped_count: number
          skipped_details: Json | null
          total_rows: number
          updated_count: number
          warnings: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dry_run?: boolean
          errors?: Json
          id?: string
          inserted_count?: number
          partner_id: string
          profile_id?: string | null
          run_id?: string | null
          skipped_count?: number
          skipped_details?: Json | null
          total_rows?: number
          updated_count?: number
          warnings?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dry_run?: boolean
          errors?: Json
          id?: string
          inserted_count?: number
          partner_id?: string
          profile_id?: string | null
          run_id?: string | null
          skipped_count?: number
          skipped_details?: Json | null
          total_rows?: number
          updated_count?: number
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "partner_import_logs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_import_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "partner_import_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_import_profiles: {
        Row: {
          column_mappings: Json
          created_at: string
          created_by: string | null
          engineer_mapping_rules: Json
          gsheet_id: string | null
          gsheet_sheet_name: string | null
          id: string
          is_active: boolean
          job_duration_defaults: Json
          name: string
          partner_id: string
          source_type: string
          status_actions: Json
          status_mappings: Json
          status_override_rules: Json
          updated_at: string
        }
        Insert: {
          column_mappings?: Json
          created_at?: string
          created_by?: string | null
          engineer_mapping_rules?: Json
          gsheet_id?: string | null
          gsheet_sheet_name?: string | null
          id?: string
          is_active?: boolean
          job_duration_defaults?: Json
          name: string
          partner_id: string
          source_type: string
          status_actions?: Json
          status_mappings?: Json
          status_override_rules?: Json
          updated_at?: string
        }
        Update: {
          column_mappings?: Json
          created_at?: string
          created_by?: string | null
          engineer_mapping_rules?: Json
          gsheet_id?: string | null
          gsheet_sheet_name?: string | null
          id?: string
          is_active?: boolean
          job_duration_defaults?: Json
          name?: string
          partner_id?: string
          source_type?: string
          status_actions?: Json
          status_mappings?: Json
          status_override_rules?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_import_profiles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_job_uploads: {
        Row: {
          created_at: string | null
          error_details: Json | null
          failed_rows: number | null
          file_name: string
          file_url: string | null
          id: string
          partner_id: string
          processed_at: string | null
          processed_rows: number | null
          status: string
          total_rows: number | null
          upload_type: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          error_details?: Json | null
          failed_rows?: number | null
          file_name: string
          file_url?: string | null
          id?: string
          partner_id: string
          processed_at?: string | null
          processed_rows?: number | null
          status?: string
          total_rows?: number | null
          upload_type: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          error_details?: Json | null
          failed_rows?: number | null
          file_name?: string
          file_url?: string | null
          id?: string
          partner_id?: string
          processed_at?: string | null
          processed_rows?: number | null
          status?: string
          total_rows?: number | null
          upload_type?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_job_uploads_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_quote_overrides: {
        Row: {
          cleared_at: string | null
          created_at: string
          created_by: string
          id: string
          notes: string | null
          order_id: string
          override_type: Database["public"]["Enums"]["partner_quote_override_type"]
        }
        Insert: {
          cleared_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          order_id: string
          override_type: Database["public"]["Enums"]["partner_quote_override_type"]
        }
        Update: {
          cleared_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          notes?: string | null
          order_id?: string
          override_type?: Database["public"]["Enums"]["partner_quote_override_type"]
        }
        Relationships: [
          {
            foreignKeyName: "partner_quote_overrides_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_quote_settings: {
        Row: {
          auto_hide_days: number
          created_at: string
          enabled: boolean
          id: string
          notifications: Json
          partner_id: string
          require_file: boolean
          sla_hours: number
          updated_at: string
        }
        Insert: {
          auto_hide_days?: number
          created_at?: string
          enabled?: boolean
          id?: string
          notifications?: Json
          partner_id: string
          require_file?: boolean
          sla_hours?: number
          updated_at?: string
        }
        Update: {
          auto_hide_days?: number
          created_at?: string
          enabled?: boolean
          id?: string
          notifications?: Json
          partner_id?: string
          require_file?: boolean
          sla_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_quote_settings_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_quotes: {
        Row: {
          amount: number
          created_at: string
          currency: string
          decision_at: string | null
          decision_notes: string | null
          file_url: string | null
          id: string
          notes: string | null
          order_id: string
          partner_id: string
          status: Database["public"]["Enums"]["partner_quote_status"]
          storage_bucket: string | null
          storage_path: string | null
          submitted_at: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          decision_at?: string | null
          decision_notes?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          order_id: string
          partner_id: string
          status?: Database["public"]["Enums"]["partner_quote_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          decision_at?: string | null
          decision_notes?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          partner_id?: string
          status?: Database["public"]["Enums"]["partner_quote_status"]
          storage_bucket?: string | null
          storage_path?: string | null
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_quotes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean | null
          partner_id: string
          permissions: Json | null
          role: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          partner_id: string
          permissions?: Json | null
          role: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          partner_id?: string
          permissions?: Json | null
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_users_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          base_url: string | null
          brand_colors: Json | null
          client_agreement_required: boolean
          client_payment_required: boolean
          client_survey_required: boolean | null
          created_at: string
          id: string
          is_active: boolean
          logo_storage_bucket: string | null
          logo_storage_path: string | null
          logo_url: string | null
          name: string
          parent_partner_id: string | null
          partner_type: string
          portal_subdomain: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          brand_colors?: Json | null
          client_agreement_required?: boolean
          client_payment_required?: boolean
          client_survey_required?: boolean | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_storage_bucket?: string | null
          logo_storage_path?: string | null
          logo_url?: string | null
          name: string
          parent_partner_id?: string | null
          partner_type?: string
          portal_subdomain?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          brand_colors?: Json | null
          client_agreement_required?: boolean
          client_payment_required?: boolean
          client_survey_required?: boolean | null
          created_at?: string
          id?: string
          is_active?: boolean
          logo_storage_bucket?: string | null
          logo_storage_path?: string | null
          logo_url?: string | null
          name?: string
          parent_partner_id?: string | null
          partner_type?: string
          portal_subdomain?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_parent_partner_id_fkey"
            columns: ["parent_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          id: string
          payment_type: string
          quote_id: string | null
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          id?: string
          payment_type: string
          quote_id?: string | null
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          payment_type?: string
          quote_id?: string | null
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_compatibility: {
        Row: {
          accessory_product_id: string
          compatibility_type: string
          core_product_id: string
          created_at: string
          id: string
          notes: string | null
        }
        Insert: {
          accessory_product_id: string
          compatibility_type: string
          core_product_id: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Update: {
          accessory_product_id?: string
          compatibility_type?: string
          core_product_id?: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_compatibility_accessory_product_id_fkey"
            columns: ["accessory_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibility_core_product_id_fkey"
            columns: ["core_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibility_product1_id_fkey"
            columns: ["core_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_compatibility_product2_id_fkey"
            columns: ["accessory_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_configurations: {
        Row: {
          configuration_type: string
          created_at: string
          id: string
          is_default: boolean | null
          option_name: string
          option_value: string
          price_modifier: number | null
          product_id: string
        }
        Insert: {
          configuration_type: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          option_name: string
          option_value: string
          price_modifier?: number | null
          product_id: string
        }
        Update: {
          configuration_type?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          option_name?: string
          option_value?: string
          price_modifier?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_configurations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          image_name: string
          image_url: string
          is_primary: boolean | null
          product_id: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_name: string
          image_url: string
          is_primary?: boolean | null
          product_id: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          image_name?: string
          image_url?: string
          is_primary?: boolean | null
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          specifications: Json | null
          updated_at: string
        }
        Insert: {
          base_price?: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          specifications?: Json | null
          updated_at?: string
        }
        Update: {
          base_price?: number
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          specifications?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          invite_token: string | null
          invited_at: string | null
          last_login: string | null
          region: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          invite_token?: string | null
          invited_at?: string | null
          last_login?: string | null
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invite_token?: string | null
          invited_at?: string | null
          last_login?: string | null
          region?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          client_id: string
          created_at: string
          id: string
          installer_id: string | null
          notes: string | null
          project_name: string
          quote_id: string | null
          scheduled_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          installer_id?: string | null
          notes?: string | null
          project_name: string
          quote_id?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          installer_id?: string | null
          notes?: string | null
          project_name?: string
          quote_id?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_installer_id_fkey"
            columns: ["installer_id"]
            isOneToOne: false
            referencedRelation: "installers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_name: string | null
          line_total: number | null
          purchase_order_id: string
          quantity: number
          received_quantity: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_name?: string | null
          line_total?: number | null
          purchase_order_id: string
          quantity: number
          received_quantity?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_name?: string | null
          line_total?: number | null
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          actual_delivery_date: string | null
          amended_at: string | null
          amended_by: string | null
          created_at: string
          created_by: string | null
          engineer_id: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          status: Database["public"]["Enums"]["purchase_order_status"]
          stock_request_id: string | null
          supplier_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          amended_at?: string | null
          amended_by?: string | null
          created_at?: string
          created_by?: string | null
          engineer_id?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          stock_request_id?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          amended_at?: string | null
          amended_by?: string | null
          created_at?: string
          created_by?: string | null
          engineer_id?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          status?: Database["public"]["Enums"]["purchase_order_status"]
          stock_request_id?: string | null
          supplier_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchase_orders_engineer"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "purchase_orders_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_stock_request_id_fkey"
            columns: ["stock_request_id"]
            isOneToOne: false
            referencedRelation: "stock_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipts: {
        Row: {
          created_at: string
          id: string
          location_id: string
          notes: string | null
          po_line_id: string
          purchase_order_id: string
          quantity_received: number
          received_by: string | null
          received_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          notes?: string | null
          po_line_id: string
          purchase_order_id: string
          quantity_received: number
          received_by?: string | null
          received_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          notes?: string | null
          po_line_id?: string
          purchase_order_id?: string
          quantity_received?: number
          received_by?: string | null
          received_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      quote_items: {
        Row: {
          configuration: Json | null
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          quote_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          configuration?: Json | null
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          quote_id: string
          total_price?: number
          unit_price?: number
        }
        Update: {
          configuration?: Json | null
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          quote_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          charger_model_id: string | null
          client_id: string
          created_at: string
          expected_duration_days: number | null
          expires_at: string | null
          extras_cost: number
          groundworks_required: boolean | null
          id: string
          includes_installation: boolean | null
          install_cost: number
          is_shareable: boolean | null
          materials_cost: number
          multiple_engineers_required: boolean | null
          notes: string | null
          order_id: string | null
          part_details: string | null
          part_required: boolean | null
          partner_id: string | null
          product_details: string
          quote_number: string
          quote_template: string | null
          quote_type: string | null
          share_token: string | null
          special_instructions: string | null
          specific_engineer_id: string | null
          specific_engineer_required: boolean | null
          status: string
          total_cost: number
          updated_at: string
          warranty_period: string | null
        }
        Insert: {
          accepted_at?: string | null
          charger_model_id?: string | null
          client_id: string
          created_at?: string
          expected_duration_days?: number | null
          expires_at?: string | null
          extras_cost?: number
          groundworks_required?: boolean | null
          id?: string
          includes_installation?: boolean | null
          install_cost?: number
          is_shareable?: boolean | null
          materials_cost?: number
          multiple_engineers_required?: boolean | null
          notes?: string | null
          order_id?: string | null
          part_details?: string | null
          part_required?: boolean | null
          partner_id?: string | null
          product_details: string
          quote_number: string
          quote_template?: string | null
          quote_type?: string | null
          share_token?: string | null
          special_instructions?: string | null
          specific_engineer_id?: string | null
          specific_engineer_required?: boolean | null
          status?: string
          total_cost?: number
          updated_at?: string
          warranty_period?: string | null
        }
        Update: {
          accepted_at?: string | null
          charger_model_id?: string | null
          client_id?: string
          created_at?: string
          expected_duration_days?: number | null
          expires_at?: string | null
          extras_cost?: number
          groundworks_required?: boolean | null
          id?: string
          includes_installation?: boolean | null
          install_cost?: number
          is_shareable?: boolean | null
          materials_cost?: number
          multiple_engineers_required?: boolean | null
          notes?: string | null
          order_id?: string | null
          part_details?: string | null
          part_required?: boolean | null
          partner_id?: string | null
          product_details?: string
          quote_number?: string
          quote_template?: string | null
          quote_type?: string | null
          share_token?: string | null
          special_instructions?: string | null
          specific_engineer_id?: string | null
          specific_engineer_required?: boolean | null
          status?: string
          total_cost?: number
          updated_at?: string
          warranty_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_charger_model_id_fkey"
            columns: ["charger_model_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_specific_engineer_id_fkey"
            columns: ["specific_engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      returns_rma_lines: {
        Row: {
          condition_notes: string | null
          created_at: string
          id: string
          item_id: string
          quantity: number
          rma_id: string
          serial_numbers: string[] | null
        }
        Insert: {
          condition_notes?: string | null
          created_at?: string
          id?: string
          item_id: string
          quantity: number
          rma_id: string
          serial_numbers?: string[] | null
        }
        Update: {
          condition_notes?: string | null
          created_at?: string
          id?: string
          item_id?: string
          quantity?: number
          rma_id?: string
          serial_numbers?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "returns_rma_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_rma_lines_rma_id_fkey"
            columns: ["rma_id"]
            isOneToOne: false
            referencedRelation: "returns_rmas"
            referencedColumns: ["id"]
          },
        ]
      }
      returns_rmas: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          item_id: string
          notes: string | null
          replacement_expected_date: string | null
          replacement_received_date: string | null
          replacement_serial_number: string | null
          return_date: string | null
          return_reason: string
          rma_number: string
          serial_number: string | null
          status: Database["public"]["Enums"]["return_rma_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          replacement_expected_date?: string | null
          replacement_received_date?: string | null
          replacement_serial_number?: string | null
          return_date?: string | null
          return_reason: string
          rma_number: string
          serial_number?: string | null
          status?: Database["public"]["Enums"]["return_rma_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          replacement_expected_date?: string | null
          replacement_received_date?: string | null
          replacement_serial_number?: string | null
          return_date?: string | null
          return_reason?: string
          rma_number?: string
          serial_number?: string | null
          status?: Database["public"]["Enums"]["return_rma_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "returns_rmas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "returns_rmas_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_rmas_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "inventory_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_request_audit: {
        Row: {
          action: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          performed_at: string | null
          performed_by: string | null
          reason: string | null
          request_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string | null
          performed_by?: string | null
          reason?: string | null
          request_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string | null
          performed_by?: string | null
          reason?: string | null
          request_id?: string | null
        }
        Relationships: []
      }
      stock_request_lines: {
        Row: {
          created_at: string
          id: string
          item_id: string
          notes: string | null
          qty: number
          request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          qty: number
          request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          qty?: number
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_request_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_request_lines_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "stock_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_request_lines_audit: {
        Row: {
          action: string
          created_at: string | null
          id: string
          line_id: string | null
          new_data: Json | null
          old_data: Json | null
          performed_at: string | null
          performed_by: string | null
          request_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          line_id?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string | null
          performed_by?: string | null
          request_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          line_id?: string | null
          new_data?: Json | null
          old_data?: Json | null
          performed_at?: string | null
          performed_by?: string | null
          request_id?: string | null
        }
        Relationships: []
      }
      stock_requests: {
        Row: {
          created_at: string
          destination_location_id: string
          engineer_id: string
          id: string
          idempotency_key: string | null
          needed_by: string | null
          notes: string | null
          order_id: string | null
          photo_url: string | null
          priority: string
          purchase_order_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_location_id: string
          engineer_id: string
          id?: string
          idempotency_key?: string | null
          needed_by?: string | null
          notes?: string | null
          order_id?: string | null
          photo_url?: string | null
          priority?: string
          purchase_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_location_id?: string
          engineer_id?: string
          id?: string
          idempotency_key?: string | null
          needed_by?: string | null
          notes?: string | null
          order_id?: string | null
          photo_url?: string | null
          priority?: string
          purchase_order_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_requests_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      survey_form_mappings: {
        Row: {
          context_type: string
          form_version_id: string
          id: string
          is_active: boolean
          mapped_at: string
          mapped_by: string | null
        }
        Insert: {
          context_type: string
          form_version_id: string
          id?: string
          is_active?: boolean
          mapped_at?: string
          mapped_by?: string | null
        }
        Update: {
          context_type?: string
          form_version_id?: string
          id?: string
          is_active?: boolean
          mapped_at?: string
          mapped_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_form_mappings_form_version_id_fkey"
            columns: ["form_version_id"]
            isOneToOne: false
            referencedRelation: "survey_form_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_form_versions: {
        Row: {
          created_at: string
          form_id: string
          id: string
          published_at: string | null
          published_by: string | null
          schema: Json
          status: string
          updated_at: string
          version_number: number
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          schema?: Json
          status?: string
          updated_at?: string
          version_number: number
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          published_at?: string | null
          published_by?: string | null
          schema?: Json
          status?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "survey_form_versions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "survey_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_forms: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_audit_log: {
        Row: {
          action_type: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by: string
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_access: boolean | null
          created_at: string | null
          id: string
          permission_key: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          can_access?: boolean | null
          created_at?: string | null
          id?: string
          permission_key: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          can_access?: boolean | null
          created_at?: string | null
          id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
    }
    Views: {
      partner_quotes_latest: {
        Row: {
          amount: number | null
          created_at: string | null
          currency: string | null
          decision_at: string | null
          decision_notes: string | null
          file_url: string | null
          id: string | null
          notes: string | null
          order_id: string | null
          partner_id: string | null
          status: Database["public"]["Enums"]["partner_quote_status"] | null
          storage_bucket: string | null
          storage_path: string | null
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_quotes_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_job_offer_transaction: {
        Args: {
          p_engineer_id: string
          p_offer_id: string
          p_order_id: string
          p_response_time: string
          p_time_window: string
        }
        Returns: undefined
      }
      admin_delete_order: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      admin_set_order_status: {
        Args: {
          p_order_id: string
          p_reason: string
          p_status: Database["public"]["Enums"]["order_status_enhanced"]
        }
        Returns: boolean
      }
      approve_inventory_transaction: {
        Args: { p_action: string; p_reason?: string; p_txn_id: string }
        Returns: boolean
      }
      archive_engineer_work: {
        Args: {
          p_order_id: string
          p_reset_by?: string
          p_reset_reason: string
          p_scheduled_date_after?: string
        }
        Returns: string
      }
      calculate_order_status: {
        Args:
          | { order_row: Database["public"]["Tables"]["orders"]["Row"] }
          | {
              p_agreement_signed_at: string
              p_amount_paid: number
              p_engineer_signed_off: boolean
              p_has_active_offers?: boolean
              p_last_offer_expires_at?: string
              p_last_offer_status?: string
              p_quote_status: string
              p_scheduled_install_date: string
              p_total_amount: number
            }
        Returns: Database["public"]["Enums"]["order_status_enhanced"]
      }
      calculate_order_status_final: {
        Args: { order_row: Database["public"]["Tables"]["orders"]["Row"] }
        Returns: Database["public"]["Enums"]["order_status_enhanced"]
      }
      calculate_order_status_with_offers: {
        Args: { order_row: Database["public"]["Tables"]["orders"]["Row"] }
        Returns: Database["public"]["Enums"]["order_status_enhanced"]
      }
      calculate_po_totals: {
        Args: { p_po_id: string }
        Returns: undefined
      }
      can_access_partner_data: {
        Args: { target_partner_id: string; user_uuid: string }
        Returns: boolean
      }
      cleanup_expired_geocodes: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_orphaned_partner_clients: {
        Args: { p_partner_id?: string }
        Returns: number
      }
      create_stock_adjustment_for_po_amendment: {
        Args: {
          p_item_id: string
          p_location_id: string
          p_po_id: string
          p_quantity_change: number
          p_reference?: string
        }
        Returns: string
      }
      delete_partner_data_safe: {
        Args: { p_import_run_id?: string; p_partner_id: string }
        Returns: Json
      }
      detect_scheduling_conflicts: {
        Args: { p_order_id: string }
        Returns: Json
      }
      generate_client_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_survey_token: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_active_survey_form: {
        Args: { p_context_type: string }
        Returns: {
          form_id: string
          form_name: string
          schema: Json
          version_id: string
          version_number: number
        }[]
      }
      get_clients_with_last_message: {
        Args: Record<PropertyKey, never>
        Returns: {
          email: string
          full_name: string
          id: string
          last_message: string
          last_message_at: string
          unread_count: number
          user_id: string
        }[]
      }
      get_date_offered_orders: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          client_address: string
          client_email: string
          client_full_name: string
          client_id: string
          client_phone: string
          client_postcode: string
          created_at: string
          engineer_id: string
          engineer_name: string
          estimated_duration_hours: number
          id: string
          job_type: string
          offer_engineer_id: string
          offer_expires_at: string
          offer_id: string
          offer_offered_date: string
          offer_time_window: string
          order_number: string
          partner_name: string
          scheduled_install_date: string
          status_enhanced: Database["public"]["Enums"]["order_status_enhanced"]
        }[]
      }
      get_engineer_daily_time_with_holds: {
        Args: { p_date: string; p_engineer_id: string }
        Returns: number
      }
      get_engineer_daily_workload: {
        Args: { p_date: string; p_engineer_id: string }
        Returns: number
      }
      get_engineer_daily_workload_with_holds: {
        Args: { p_date: string; p_engineer_id: string }
        Returns: number
      }
      get_engineer_id_for_user: {
        Args: { user_uuid: string }
        Returns: string
      }
      get_engineer_soft_holds: {
        Args: { p_date: string; p_engineer_id: string }
        Returns: number
      }
      get_engineer_van_location: {
        Args: { p_engineer_id: string }
        Returns: string
      }
      get_geocode_from_cache: {
        Args: { p_postcode: string }
        Returns: {
          latitude: number
          longitude: number
        }[]
      }
      get_item_location_balances: {
        Args: Record<PropertyKey, never> | { location_uuid?: string }
        Returns: {
          item_id: string
          location_id: string
          on_hand: number
        }[]
      }
      get_partner_user_partner_id: {
        Args: { user_uuid: string }
        Returns: string
      }
      get_partner_user_role: {
        Args: { user_uuid: string }
        Returns: string
      }
      get_schedule_status_counts_v2: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_admin: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
      is_current_user_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_manager: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
      log_mapbox_usage: {
        Args: {
          p_api_type: string
          p_call_count?: number
          p_function_name: string
          p_metadata?: Json
          p_session_id?: string
        }
        Returns: undefined
      }
      log_order_activity: {
        Args: {
          p_activity_type: string
          p_created_by?: string
          p_description: string
          p_details?: Json
          p_order_id: string
        }
        Returns: string
      }
      log_partner_import: {
        Args:
          | {
              p_dry_run: boolean
              p_errors?: Json
              p_inserted_count: number
              p_partner_id: string
              p_profile_id: string
              p_run_id: string
              p_skipped_count: number
              p_skipped_details?: Json
              p_total_rows: number
              p_updated_count: number
              p_warnings?: Json
            }
          | {
              p_dry_run: boolean
              p_errors?: Json
              p_inserted_count: number
              p_partner_id: string
              p_profile_id: string
              p_run_id: string
              p_skipped_count: number
              p_total_rows: number
              p_updated_count: number
              p_warnings?: Json
            }
        Returns: string
      }
      log_user_action: {
        Args: {
          p_action_type: string
          p_details?: Json
          p_performed_by?: string
          p_target_user_id: string
        }
        Returns: string
      }
      mark_client_messages_read: {
        Args: { p_client_id: string }
        Returns: boolean
      }
      record_material_usage: {
        Args: {
          p_deduct_stock?: boolean
          p_engineer_id: string
          p_item_id: string
          p_item_name: string
          p_location_id?: string
          p_notes?: string
          p_order_id: string
          p_quantity: number
          p_serial_number?: string
        }
        Returns: string
      }
      revoke_material_usage: {
        Args: { p_restore_stock?: boolean; p_usage_id: string }
        Returns: boolean
      }
      search_orders_for_charger_assignment: {
        Args: { search_postcode: string }
        Returns: {
          client_data: Json
          client_id: string
          engineer_id: string
          id: string
          order_number: string
          scheduled_install_date: string
          status_enhanced: Database["public"]["Enums"]["order_status_enhanced"]
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      store_geocode_in_cache: {
        Args: { p_latitude: number; p_longitude: number; p_postcode: string }
        Returns: undefined
      }
      test_partner_import_connectivity: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      upsert_client_for_partner: {
        Args: {
          p_address: string
          p_email: string
          p_full_name: string
          p_partner_id: string
          p_phone: string
          p_postcode: string
        }
        Returns: string
      }
      upsert_clients_for_partner_bulk: {
        Args: { p_clients: Json; p_partner_id: string }
        Returns: {
          client_id: string
          email: string
        }[]
      }
      upsert_orders_for_partner_bulk: {
        Args: { p_orders: Json; p_partner_id: string }
        Returns: {
          order_id: string
          partner_external_id: string
          was_insert: boolean
        }[]
      }
      user_can_view_client: {
        Args: { client_uuid: string }
        Returns: boolean
      }
      user_can_view_order: {
        Args: { order_uuid: string; user_uuid?: string }
        Returns: boolean
      }
      user_can_view_quote: {
        Args: { quote_uuid: string; user_uuid?: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { permission_key: string; user_id: string }
        Returns: boolean
      }
      user_has_role: {
        Args: { role_name: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      user_is_engineer_for_order: {
        Args: { order_uuid: string; user_uuid: string }
        Returns: boolean
      }
      user_owns_client: {
        Args: { client_uuid: string; user_uuid?: string }
        Returns: boolean
      }
    }
    Enums: {
      message_status: "sending" | "sent" | "delivered" | "failed"
      offer_status: "pending" | "accepted" | "rejected" | "expired"
      order_job_type: "installation" | "assessment" | "service_call"
      order_status: "active" | "paused" | "cancelled" | "completed"
      order_status_enhanced:
        | "quote_accepted"
        | "awaiting_payment"
        | "payment_received"
        | "awaiting_agreement"
        | "agreement_signed"
        | "awaiting_install_booking"
        | "scheduled"
        | "in_progress"
        | "install_completed_pending_qa"
        | "completed"
        | "revisit_required"
        | "cancelled"
        | "needs_scheduling"
        | "date_offered"
        | "date_accepted"
        | "date_rejected"
        | "offer_expired"
        | "on_hold_parts_docs"
        | "awaiting_final_payment"
        | "awaiting_survey_submission"
        | "awaiting_survey_review"
        | "survey_approved"
        | "survey_rework_requested"
        | "awaiting_parts_order"
        | "awaiting_manual_scheduling"
      partner_calendar_status:
        | "available"
        | "soft_hold"
        | "confirmed"
        | "blocked"
      partner_quote_override_type:
        | "quoted_pending_approval"
        | "standard_quote_marked"
      partner_quote_status:
        | "submitted"
        | "approved"
        | "rejected"
        | "rework"
        | "withdrawn"
      purchase_order_status:
        | "draft"
        | "pending"
        | "approved"
        | "received"
        | "cancelled"
      return_rma_status:
        | "pending_return"
        | "in_transit"
        | "received_by_supplier"
        | "replacement_sent"
        | "replacement_received"
        | "closed"
        | "cancelled"
      survey_media_type: "image" | "video"
      survey_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "rework_requested"
        | "resubmitted"
        | "approved"
      txn_audit_action:
        | "created"
        | "approved"
        | "rejected"
        | "modified"
        | "deleted"
        | "related_request_deleted"
      user_role:
        | "admin"
        | "client"
        | "engineer"
        | "manager"
        | "standard_office_user"
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
      message_status: ["sending", "sent", "delivered", "failed"],
      offer_status: ["pending", "accepted", "rejected", "expired"],
      order_job_type: ["installation", "assessment", "service_call"],
      order_status: ["active", "paused", "cancelled", "completed"],
      order_status_enhanced: [
        "quote_accepted",
        "awaiting_payment",
        "payment_received",
        "awaiting_agreement",
        "agreement_signed",
        "awaiting_install_booking",
        "scheduled",
        "in_progress",
        "install_completed_pending_qa",
        "completed",
        "revisit_required",
        "cancelled",
        "needs_scheduling",
        "date_offered",
        "date_accepted",
        "date_rejected",
        "offer_expired",
        "on_hold_parts_docs",
        "awaiting_final_payment",
        "awaiting_survey_submission",
        "awaiting_survey_review",
        "survey_approved",
        "survey_rework_requested",
        "awaiting_parts_order",
        "awaiting_manual_scheduling",
      ],
      partner_calendar_status: [
        "available",
        "soft_hold",
        "confirmed",
        "blocked",
      ],
      partner_quote_override_type: [
        "quoted_pending_approval",
        "standard_quote_marked",
      ],
      partner_quote_status: [
        "submitted",
        "approved",
        "rejected",
        "rework",
        "withdrawn",
      ],
      purchase_order_status: [
        "draft",
        "pending",
        "approved",
        "received",
        "cancelled",
      ],
      return_rma_status: [
        "pending_return",
        "in_transit",
        "received_by_supplier",
        "replacement_sent",
        "replacement_received",
        "closed",
        "cancelled",
      ],
      survey_media_type: ["image", "video"],
      survey_status: [
        "draft",
        "submitted",
        "under_review",
        "rework_requested",
        "resubmitted",
        "approved",
      ],
      txn_audit_action: [
        "created",
        "approved",
        "rejected",
        "modified",
        "deleted",
        "related_request_deleted",
      ],
      user_role: [
        "admin",
        "client",
        "engineer",
        "manager",
        "standard_office_user",
      ],
    },
  },
} as const
