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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      action_categories: {
        Row: {
          icon: string
          id: string
          label: string
        }
        Insert: {
          icon: string
          id: string
          label: string
        }
        Update: {
          icon?: string
          id?: string
          label?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      bodacc_dismissed_alerts: {
        Row: {
          annonce_key: string
          dismissed_at: string
          dismissed_by: string | null
          id: string
          restaurant_id: string
          siren: string
        }
        Insert: {
          annonce_key: string
          dismissed_at?: string
          dismissed_by?: string | null
          id?: string
          restaurant_id: string
          siren: string
        }
        Update: {
          annonce_key?: string
          dismissed_at?: string
          dismissed_by?: string | null
          id?: string
          restaurant_id?: string
          siren?: string
        }
        Relationships: [
          {
            foreignKeyName: "bodacc_dismissed_alerts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      chains: {
        Row: {
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      chatbot_interactions: {
        Row: {
          ai_model: string | null
          created_at: string | null
          detected_entities: Json | null
          error_message: string | null
          id: string
          intent: string | null
          manager_name: string | null
          manager_phone: string
          query: string
          response: string | null
          response_time_ms: number | null
          restaurant_id: string | null
          satisfaction_rating: number | null
          tokens_used: number | null
          was_successful: boolean | null
        }
        Insert: {
          ai_model?: string | null
          created_at?: string | null
          detected_entities?: Json | null
          error_message?: string | null
          id?: string
          intent?: string | null
          manager_name?: string | null
          manager_phone: string
          query: string
          response?: string | null
          response_time_ms?: number | null
          restaurant_id?: string | null
          satisfaction_rating?: number | null
          tokens_used?: number | null
          was_successful?: boolean | null
        }
        Update: {
          ai_model?: string | null
          created_at?: string | null
          detected_entities?: Json | null
          error_message?: string | null
          id?: string
          intent?: string | null
          manager_name?: string | null
          manager_phone?: string
          query?: string
          response?: string | null
          response_time_ms?: number | null
          restaurant_id?: string | null
          satisfaction_rating?: number | null
          tokens_used?: number | null
          was_successful?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_interactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_imports: {
        Row: {
          bulk_import_id: string | null
          date_range_end: string | null
          date_range_start: string | null
          error_count: number | null
          file_name: string
          file_size: number | null
          file_url: string | null
          id: string
          imported_at: string | null
          inserted_count: number | null
          label: string | null
          report_type: string
          restaurant_ids: string[] | null
          restaurants_count: number | null
          skipped_count: number | null
          status: string | null
          total_rows: number | null
          updated_count: number | null
        }
        Insert: {
          bulk_import_id?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          error_count?: number | null
          file_name: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          imported_at?: string | null
          inserted_count?: number | null
          label?: string | null
          report_type: string
          restaurant_ids?: string[] | null
          restaurants_count?: number | null
          skipped_count?: number | null
          status?: string | null
          total_rows?: number | null
          updated_count?: number | null
        }
        Update: {
          bulk_import_id?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          error_count?: number | null
          file_name?: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          imported_at?: string | null
          inserted_count?: number | null
          label?: string | null
          report_type?: string
          restaurant_ids?: string[] | null
          restaurants_count?: number | null
          skipped_count?: number | null
          status?: string | null
          total_rows?: number | null
          updated_count?: number | null
        }
        Relationships: []
      }
      customer_reviews: {
        Row: {
          created_at: string
          customer_comment: string | null
          customer_name: string | null
          customer_type: string | null
          delivery_rating: number | null
          food_rating: number | null
          id: string
          order_date: string | null
          order_id: string | null
          order_total: number | null
          overall_rating: number | null
          platform: string | null
          response_status: string | null
          response_text: string | null
          restaurant_id: string
          review_date: string | null
          tags: string[] | null
          uber_order_id: string | null
        }
        Insert: {
          created_at?: string
          customer_comment?: string | null
          customer_name?: string | null
          customer_type?: string | null
          delivery_rating?: number | null
          food_rating?: number | null
          id?: string
          order_date?: string | null
          order_id?: string | null
          order_total?: number | null
          overall_rating?: number | null
          platform?: string | null
          response_status?: string | null
          response_text?: string | null
          restaurant_id: string
          review_date?: string | null
          tags?: string[] | null
          uber_order_id?: string | null
        }
        Update: {
          created_at?: string
          customer_comment?: string | null
          customer_name?: string | null
          customer_type?: string | null
          delivery_rating?: number | null
          food_rating?: number | null
          id?: string
          order_date?: string | null
          order_id?: string | null
          order_total?: number | null
          overall_rating?: number | null
          platform?: string | null
          response_status?: string | null
          response_text?: string | null
          restaurant_id?: string
          review_date?: string | null
          tags?: string[] | null
          uber_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_conversion: {
        Row: {
          add_to_cart: number
          cart_rate: number | null
          conversion_rate: number | null
          created_at: string
          date: string
          id: string
          is_averaged: boolean | null
          menu_views: number
          orders: number
          overall_rate: number | null
          platform: string
          restaurant_id: string
          updated_at: string
          view_rate: number | null
          visits: number
        }
        Insert: {
          add_to_cart?: number
          cart_rate?: number | null
          conversion_rate?: number | null
          created_at?: string
          date: string
          id?: string
          is_averaged?: boolean | null
          menu_views?: number
          orders?: number
          overall_rate?: number | null
          platform?: string
          restaurant_id: string
          updated_at?: string
          view_rate?: number | null
          visits?: number
        }
        Update: {
          add_to_cart?: number
          cart_rate?: number | null
          conversion_rate?: number | null
          created_at?: string
          date?: string
          id?: string
          is_averaged?: boolean | null
          menu_views?: number
          orders?: number
          overall_rate?: number | null
          platform?: string
          restaurant_id?: string
          updated_at?: string
          view_rate?: number | null
          visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_conversion_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_order_accuracy: {
        Row: {
          created_at: string
          date: string
          id: string
          imported_at: string | null
          incorrect_item_count: number
          incorrect_item_refund: number
          incorrect_orders_count: number
          missing_customization_count: number
          missing_customization_refund: number
          missing_items_count: number
          missing_items_refund: number
          period_type: string
          restaurant_id: string
          total_refund: number
          wrong_order_count: number
          wrong_order_refund: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          imported_at?: string | null
          incorrect_item_count?: number
          incorrect_item_refund?: number
          incorrect_orders_count?: number
          missing_customization_count?: number
          missing_customization_refund?: number
          missing_items_count?: number
          missing_items_refund?: number
          period_type?: string
          restaurant_id: string
          total_refund?: number
          wrong_order_count?: number
          wrong_order_refund?: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          imported_at?: string | null
          incorrect_item_count?: number
          incorrect_item_refund?: number
          incorrect_orders_count?: number
          missing_customization_count?: number
          missing_customization_refund?: number
          missing_items_count?: number
          missing_items_refund?: number
          period_type?: string
          restaurant_id?: string
          total_refund?: number
          wrong_order_count?: number
          wrong_order_refund?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_order_accuracy_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_revenue: {
        Row: {
          average_basket: number | null
          created_at: string
          date: string
          id: string
          order_count: number
          platform: string
          restaurant_id: string
          revenue_ttc: number
          updated_at: string
        }
        Insert: {
          average_basket?: number | null
          created_at?: string
          date: string
          id?: string
          order_count?: number
          platform?: string
          restaurant_id: string
          revenue_ttc?: number
          updated_at?: string
        }
        Update: {
          average_basket?: number | null
          created_at?: string
          date?: string
          id?: string
          order_count?: number
          platform?: string
          restaurant_id?: string
          revenue_ttc?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_revenue_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_uber: {
        Row: {
          average_basket: number
          created_at: string | null
          currency: string | null
          date: string
          id: string
          order_count: number
          period_type: string
          platform: string
          restaurant_id: string
          revenue_ttc: number
        }
        Insert: {
          average_basket?: number
          created_at?: string | null
          currency?: string | null
          date: string
          id?: string
          order_count?: number
          period_type?: string
          platform?: string
          restaurant_id: string
          revenue_ttc?: number
        }
        Update: {
          average_basket?: number
          created_at?: string | null
          currency?: string | null
          date?: string
          id?: string
          order_count?: number
          period_type?: string
          platform?: string
          restaurant_id?: string
          revenue_ttc?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_uber_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveroo_orders: {
        Row: {
          adjustment_amount: number | null
          commission_amount: number | null
          commission_rate: string | null
          created_at: string
          deliveroo_order_id: string | null
          deliveroo_uuid: string | null
          delivery_datetime: string | null
          history_type: string
          id: string
          note: string | null
          order_amount: number | null
          restaurant_id: string | null
          restaurant_name: string
          section: string | null
          statement_file: string | null
          total_payable: number | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          adjustment_amount?: number | null
          commission_amount?: number | null
          commission_rate?: string | null
          created_at?: string
          deliveroo_order_id?: string | null
          deliveroo_uuid?: string | null
          delivery_datetime?: string | null
          history_type: string
          id?: string
          note?: string | null
          order_amount?: number | null
          restaurant_id?: string | null
          restaurant_name: string
          section?: string | null
          statement_file?: string | null
          total_payable?: number | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          adjustment_amount?: number | null
          commission_amount?: number | null
          commission_rate?: string | null
          created_at?: string
          deliveroo_order_id?: string | null
          deliveroo_uuid?: string | null
          delivery_datetime?: string | null
          history_type?: string
          id?: string
          note?: string | null
          order_amount?: number | null
          restaurant_id?: string | null
          restaurant_name?: string
          section?: string | null
          statement_file?: string | null
          total_payable?: number | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveroo_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_stats: {
        Row: {
          courier_id: string | null
          courier_name: string | null
          created_at: string
          delay_minutes: number | null
          delivery_date: string | null
          delivery_status: string | null
          delivery_time_minutes: number | null
          estimated_time_minutes: number | null
          id: string
          order_id: string | null
          preparation_time_minutes: number | null
          restaurant_id: string
          total_time_minutes: number | null
          uber_order_id: string | null
        }
        Insert: {
          courier_id?: string | null
          courier_name?: string | null
          created_at?: string
          delay_minutes?: number | null
          delivery_date?: string | null
          delivery_status?: string | null
          delivery_time_minutes?: number | null
          estimated_time_minutes?: number | null
          id?: string
          order_id?: string | null
          preparation_time_minutes?: number | null
          restaurant_id: string
          total_time_minutes?: number | null
          uber_order_id?: string | null
        }
        Update: {
          courier_id?: string | null
          courier_name?: string | null
          created_at?: string
          delay_minutes?: number | null
          delivery_date?: string | null
          delivery_status?: string | null
          delivery_time_minutes?: number | null
          estimated_time_minutes?: number | null
          id?: string
          order_id?: string | null
          preparation_time_minutes?: number | null
          restaurant_id?: string
          total_time_minutes?: number | null
          uber_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_stats_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      downtime_logs: {
        Row: {
          created_at: string
          downtime_end: string | null
          downtime_start: string
          downtime_type: string | null
          duration_minutes: number | null
          id: string
          reason: string | null
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          downtime_end?: string | null
          downtime_start: string
          downtime_type?: string | null
          duration_minutes?: number | null
          id?: string
          reason?: string | null
          restaurant_id: string
        }
        Update: {
          created_at?: string
          downtime_end?: string | null
          downtime_start?: string
          downtime_type?: string | null
          duration_minutes?: number | null
          id?: string
          reason?: string | null
          restaurant_id?: string
        }
        Relationships: []
      }
      eco_line_snapshots: {
        Row: {
          chain_id: string | null
          checked_at: string
          created_at: string
          id: string
          line_counts: Json
          total_lines: number
        }
        Insert: {
          chain_id?: string | null
          checked_at?: string
          created_at?: string
          id?: string
          line_counts?: Json
          total_lines?: number
        }
        Update: {
          chain_id?: string | null
          checked_at?: string
          created_at?: string
          id?: string
          line_counts?: Json
          total_lines?: number
        }
        Relationships: [
          {
            foreignKeyName: "eco_line_snapshots_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
        ]
      }
      hourly_availability: {
        Row: {
          created_at: string | null
          hour_start: string
          id: string
          menu_availability_minutes: number
          offline_minutes: number
          online_minutes: number
          platform: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string | null
          hour_start: string
          id?: string
          menu_availability_minutes?: number
          offline_minutes?: number
          online_minutes?: number
          platform?: string
          restaurant_id: string
        }
        Update: {
          created_at?: string | null
          hour_start?: string
          id?: string
          menu_availability_minutes?: number
          offline_minutes?: number
          online_minutes?: number
          platform?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hourly_availability_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_guide_screenshots: {
        Row: {
          guide_section_id: string
          id: string
          notes: string | null
          screenshot_url: string
          uploaded_at: string | null
        }
        Insert: {
          guide_section_id: string
          id?: string
          notes?: string | null
          screenshot_url: string
          uploaded_at?: string | null
        }
        Update: {
          guide_section_id?: string
          id?: string
          notes?: string | null
          screenshot_url?: string
          uploaded_at?: string | null
        }
        Relationships: []
      }
      manager_restaurants: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          manager_id: string
          restaurant_id: string
          role: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          manager_id: string
          restaurant_id: string
          role?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          manager_id?: string
          restaurant_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manager_restaurants_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "managers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      managers: {
        Row: {
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_item_changes: {
        Row: {
          change_type: string
          changed_at: string
          field_changes: Json | null
          id: string
          item_name: string
          menu_item_id: string | null
          notes: string | null
          restaurant_action_id: string | null
        }
        Insert: {
          change_type: string
          changed_at?: string
          field_changes?: Json | null
          id?: string
          item_name: string
          menu_item_id?: string | null
          notes?: string | null
          restaurant_action_id?: string | null
        }
        Update: {
          change_type?: string
          changed_at?: string
          field_changes?: Json | null
          id?: string
          item_name?: string
          menu_item_id?: string | null
          notes?: string | null
          restaurant_action_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_changes_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_changes_restaurant_action_id_fkey"
            columns: ["restaurant_action_id"]
            isOneToOne: false
            referencedRelation: "restaurant_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          item_id: string
          item_title: string
          platform: string | null
          rating: number
          restaurant_id: string
          review_date: string | null
          tags: string[] | null
          thumb_down: number | null
          thumb_up: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          item_id: string
          item_title: string
          platform?: string | null
          rating: number
          restaurant_id: string
          review_date?: string | null
          tags?: string[] | null
          thumb_down?: number | null
          thumb_up?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          item_id?: string
          item_title?: string
          platform?: string | null
          rating?: number
          restaurant_id?: string
          review_date?: string | null
          tags?: string[] | null
          thumb_down?: number | null
          thumb_up?: number | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          description_deliveroo: string | null
          description_uber: string | null
          food_cost: number | null
          food_cost_combo: number | null
          id: string
          is_active: boolean | null
          name: string
          name_deliveroo: string | null
          name_uber: string | null
          price_deliveroo: number | null
          price_uber: number | null
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          description_deliveroo?: string | null
          description_uber?: string | null
          food_cost?: number | null
          food_cost_combo?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          name_deliveroo?: string | null
          name_uber?: string | null
          price_deliveroo?: number | null
          price_uber?: number | null
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          description_deliveroo?: string | null
          description_uber?: string | null
          food_cost?: number | null
          food_cost_combo?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          name_deliveroo?: string | null
          name_uber?: string | null
          price_deliveroo?: number | null
          price_uber?: number | null
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: []
      }
      message_campaigns: {
        Row: {
          created_at: string
          delivered_count: number
          failed_count: number
          id: string
          media_type: string | null
          media_url: string | null
          message_template: string
          read_count: number
          recipient_count: number
          sent_at: string
          sent_count: number
          status: string
        }
        Insert: {
          created_at?: string
          delivered_count?: number
          failed_count?: number
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_template: string
          read_count?: number
          recipient_count?: number
          sent_at?: string
          sent_count?: number
          status?: string
        }
        Update: {
          created_at?: string
          delivered_count?: number
          failed_count?: number
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_template?: string
          read_count?: number
          recipient_count?: number
          sent_at?: string
          sent_count?: number
          status?: string
        }
        Relationships: []
      }
      message_history: {
        Row: {
          batch_id: string | null
          campaign_id: string | null
          channel: string | null
          created_at: string
          delivered_at: string | null
          direction: string
          duration: number | null
          error_message: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message_content: string
          message_type: string | null
          read_at: string | null
          recipient_name: string | null
          recipient_phone: string
          report_end_date: string | null
          report_start_date: string | null
          restaurant_id: string | null
          restaurant_name: string | null
          scheduled_message_id: string | null
          sender_phone: string | null
          sent_at: string | null
          status: string
          ultramsg_message_id: string | null
        }
        Insert: {
          batch_id?: string | null
          campaign_id?: string | null
          channel?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          duration?: number | null
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_content: string
          message_type?: string | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone: string
          report_end_date?: string | null
          report_start_date?: string | null
          restaurant_id?: string | null
          restaurant_name?: string | null
          scheduled_message_id?: string | null
          sender_phone?: string | null
          sent_at?: string | null
          status?: string
          ultramsg_message_id?: string | null
        }
        Update: {
          batch_id?: string | null
          campaign_id?: string | null
          channel?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          duration?: number | null
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_content?: string
          message_type?: string | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          report_end_date?: string | null
          report_start_date?: string | null
          restaurant_id?: string | null
          restaurant_name?: string | null
          scheduled_message_id?: string | null
          sender_phone?: string | null
          sent_at?: string | null
          status?: string
          ultramsg_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_history_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "message_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_history_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_history_scheduled_message_id_fkey"
            columns: ["scheduled_message_id"]
            isOneToOne: false
            referencedRelation: "scheduled_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_conversion: {
        Row: {
          add_to_cart: number
          cart_rate: number | null
          conversion_rate: number | null
          created_at: string
          id: string
          menu_views: number
          month: number
          orders: number
          overall_rate: number | null
          platform: string
          restaurant_id: string
          updated_at: string
          view_rate: number | null
          visits: number
          year: number
        }
        Insert: {
          add_to_cart?: number
          cart_rate?: number | null
          conversion_rate?: number | null
          created_at?: string
          id?: string
          menu_views?: number
          month: number
          orders?: number
          overall_rate?: number | null
          platform?: string
          restaurant_id: string
          updated_at?: string
          view_rate?: number | null
          visits?: number
          year: number
        }
        Update: {
          add_to_cart?: number
          cart_rate?: number | null
          conversion_rate?: number | null
          created_at?: string
          id?: string
          menu_views?: number
          month?: number
          orders?: number
          overall_rate?: number | null
          platform?: string
          restaurant_id?: string
          updated_at?: string
          view_rate?: number | null
          visits?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_conversion_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_fees: {
        Row: {
          ads_cost: number
          created_at: string
          eco_contribution: number
          error_adjustments: number
          id: string
          marketing_fee: number
          month: number
          net_payout: number
          notes: string | null
          offer_usage_fee: number | null
          offers_cost: number
          order_error: number | null
          platform: string
          restaurant_id: string
          uber_fee: number
          updated_at: string
          year: number
        }
        Insert: {
          ads_cost?: number
          created_at?: string
          eco_contribution?: number
          error_adjustments?: number
          id?: string
          marketing_fee?: number
          month: number
          net_payout?: number
          notes?: string | null
          offer_usage_fee?: number | null
          offers_cost?: number
          order_error?: number | null
          platform?: string
          restaurant_id: string
          uber_fee?: number
          updated_at?: string
          year: number
        }
        Update: {
          ads_cost?: number
          created_at?: string
          eco_contribution?: number
          error_adjustments?: number
          id?: string
          marketing_fee?: number
          month?: number
          net_payout?: number
          notes?: string | null
          offer_usage_fee?: number | null
          offers_cost?: number
          order_error?: number | null
          platform?: string
          restaurant_id?: string
          uber_fee?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_fees_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_order_accuracy: {
        Row: {
          created_at: string
          id: string
          imported_at: string | null
          incorrect_item_count: number
          incorrect_item_refund: number
          incorrect_orders_count: number
          missing_customization_count: number
          missing_customization_refund: number
          missing_items_count: number
          missing_items_refund: number
          month: number
          period_type: string
          restaurant_id: string
          total_refund: number
          wrong_order_count: number
          wrong_order_refund: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          imported_at?: string | null
          incorrect_item_count?: number
          incorrect_item_refund?: number
          incorrect_orders_count?: number
          missing_customization_count?: number
          missing_customization_refund?: number
          missing_items_count?: number
          missing_items_refund?: number
          month: number
          period_type?: string
          restaurant_id: string
          total_refund?: number
          wrong_order_count?: number
          wrong_order_refund?: number
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          imported_at?: string | null
          incorrect_item_count?: number
          incorrect_item_refund?: number
          incorrect_orders_count?: number
          missing_customization_count?: number
          missing_customization_refund?: number
          missing_items_count?: number
          missing_items_refund?: number
          month?: number
          period_type?: string
          restaurant_id?: string
          total_refund?: number
          wrong_order_count?: number
          wrong_order_refund?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_order_accuracy_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_revenue: {
        Row: {
          average_basket: number | null
          created_at: string
          id: string
          month: number
          order_count: number
          platform: string
          restaurant_id: string
          revenue_per_day: number | null
          revenue_ttc: number
          updated_at: string
          working_days: number | null
          year: number
        }
        Insert: {
          average_basket?: number | null
          created_at?: string
          id?: string
          month: number
          order_count?: number
          platform?: string
          restaurant_id: string
          revenue_per_day?: number | null
          revenue_ttc?: number
          updated_at?: string
          working_days?: number | null
          year: number
        }
        Update: {
          average_basket?: number | null
          created_at?: string
          id?: string
          month?: number
          order_count?: number
          platform?: string
          restaurant_id?: string
          revenue_per_day?: number | null
          revenue_ttc?: number
          updated_at?: string
          working_days?: number | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_revenue_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_errors: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          error_category: string | null
          error_date: string | null
          error_description: string | null
          error_type: string
          financial_impact: number | null
          id: string
          item_id: string | null
          item_title: string
          order_amount: number | null
          order_channel: string | null
          order_id: string | null
          refund_datetime: string | null
          restaurant_id: string
          uber_order_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          error_category?: string | null
          error_date?: string | null
          error_description?: string | null
          error_type: string
          financial_impact?: number | null
          id?: string
          item_id?: string | null
          item_title?: string
          order_amount?: number | null
          order_channel?: string | null
          order_id?: string | null
          refund_datetime?: string | null
          restaurant_id: string
          uber_order_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          error_category?: string | null
          error_date?: string | null
          error_description?: string | null
          error_type?: string
          financial_impact?: number | null
          id?: string
          item_id?: string | null
          item_title?: string
          order_amount?: number | null
          order_channel?: string | null
          order_id?: string | null
          refund_datetime?: string | null
          restaurant_id?: string
          uber_order_id?: string | null
        }
        Relationships: []
      }
      order_history: {
        Row: {
          accept_delay_minutes: number | null
          avoidable_wait_time_minutes: number | null
          brand: string | null
          cancelled_by: string | null
          courier_arrival_time: string | null
          courier_departure_time: string | null
          courier_wait_time_minutes: number | null
          created_at: string | null
          customer_wait_time_minutes: number | null
          delivery_status: string | null
          delivery_time: string | null
          extended_prep: boolean | null
          extended_prep_time_minutes: number | null
          fulfillment_type: string | null
          id: string
          initial_prep_time_minutes: number | null
          item_count: number | null
          merchant_accept_time: string | null
          multi_order_type: string | null
          order_amount: number | null
          order_channel: string | null
          order_datetime: string | null
          order_status: string | null
          platform: string | null
          restaurant_id: string
          total_delivery_time_minutes: number | null
          total_order_duration_minutes: number | null
          total_prep_delivery_time_minutes: number | null
          uber_flow_id: string | null
          uber_one: boolean | null
          uber_order_id: string
        }
        Insert: {
          accept_delay_minutes?: number | null
          avoidable_wait_time_minutes?: number | null
          brand?: string | null
          cancelled_by?: string | null
          courier_arrival_time?: string | null
          courier_departure_time?: string | null
          courier_wait_time_minutes?: number | null
          created_at?: string | null
          customer_wait_time_minutes?: number | null
          delivery_status?: string | null
          delivery_time?: string | null
          extended_prep?: boolean | null
          extended_prep_time_minutes?: number | null
          fulfillment_type?: string | null
          id?: string
          initial_prep_time_minutes?: number | null
          item_count?: number | null
          merchant_accept_time?: string | null
          multi_order_type?: string | null
          order_amount?: number | null
          order_channel?: string | null
          order_datetime?: string | null
          order_status?: string | null
          platform?: string | null
          restaurant_id: string
          total_delivery_time_minutes?: number | null
          total_order_duration_minutes?: number | null
          total_prep_delivery_time_minutes?: number | null
          uber_flow_id?: string | null
          uber_one?: boolean | null
          uber_order_id: string
        }
        Update: {
          accept_delay_minutes?: number | null
          avoidable_wait_time_minutes?: number | null
          brand?: string | null
          cancelled_by?: string | null
          courier_arrival_time?: string | null
          courier_departure_time?: string | null
          courier_wait_time_minutes?: number | null
          created_at?: string | null
          customer_wait_time_minutes?: number | null
          delivery_status?: string | null
          delivery_time?: string | null
          extended_prep?: boolean | null
          extended_prep_time_minutes?: number | null
          fulfillment_type?: string | null
          id?: string
          initial_prep_time_minutes?: number | null
          item_count?: number | null
          merchant_accept_time?: string | null
          multi_order_type?: string | null
          order_amount?: number | null
          order_channel?: string | null
          order_datetime?: string | null
          order_status?: string | null
          platform?: string | null
          restaurant_id?: string
          total_delivery_time_minutes?: number | null
          total_order_duration_minutes?: number | null
          total_prep_delivery_time_minutes?: number | null
          uber_flow_id?: string | null
          uber_one?: boolean | null
          uber_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_history_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          category: string | null
          created_at: string
          estimated_weight: number | null
          external_data: string | null
          final_count: number | null
          final_quantity: number | null
          final_weight: number | null
          id: string
          imported_from_report: boolean | null
          item_id: string
          item_promo_excl_vat: number | null
          item_promo_incl_vat: number | null
          item_title: string
          modifiers: Json | null
          order_id: string
          quantity: number
          refund_excl_vat: number | null
          refund_incl_vat: number | null
          report_import_date: string | null
          requested_count: number | null
          requested_quantity: number | null
          requested_weight: number | null
          restaurant_id: string | null
          sales_excl_vat: number | null
          sales_incl_vat: number | null
          sold_by_unit: string | null
          tax_amount: number | null
          tax_rate: number | null
          total_price: number
          uber_flow_id: string | null
          uber_order_id: string | null
          unit_price: number
          vat_1_item_promo: number | null
          vat_1_refund: number | null
          vat_1_sales: number | null
          vat_2_item_promo: number | null
          vat_2_refund: number | null
          vat_2_sales: number | null
          vat_3_item_promo: number | null
          vat_3_refund: number | null
          vat_3_sales: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          estimated_weight?: number | null
          external_data?: string | null
          final_count?: number | null
          final_quantity?: number | null
          final_weight?: number | null
          id?: string
          imported_from_report?: boolean | null
          item_id: string
          item_promo_excl_vat?: number | null
          item_promo_incl_vat?: number | null
          item_title: string
          modifiers?: Json | null
          order_id: string
          quantity: number
          refund_excl_vat?: number | null
          refund_incl_vat?: number | null
          report_import_date?: string | null
          requested_count?: number | null
          requested_quantity?: number | null
          requested_weight?: number | null
          restaurant_id?: string | null
          sales_excl_vat?: number | null
          sales_incl_vat?: number | null
          sold_by_unit?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_price: number
          uber_flow_id?: string | null
          uber_order_id?: string | null
          unit_price: number
          vat_1_item_promo?: number | null
          vat_1_refund?: number | null
          vat_1_sales?: number | null
          vat_2_item_promo?: number | null
          vat_2_refund?: number | null
          vat_2_sales?: number | null
          vat_3_item_promo?: number | null
          vat_3_refund?: number | null
          vat_3_sales?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          estimated_weight?: number | null
          external_data?: string | null
          final_count?: number | null
          final_quantity?: number | null
          final_weight?: number | null
          id?: string
          imported_from_report?: boolean | null
          item_id?: string
          item_promo_excl_vat?: number | null
          item_promo_incl_vat?: number | null
          item_title?: string
          modifiers?: Json | null
          order_id?: string
          quantity?: number
          refund_excl_vat?: number | null
          refund_incl_vat?: number | null
          report_import_date?: string | null
          requested_count?: number | null
          requested_quantity?: number | null
          requested_weight?: number | null
          restaurant_id?: string | null
          sales_excl_vat?: number | null
          sales_incl_vat?: number | null
          sold_by_unit?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          total_price?: number
          uber_flow_id?: string | null
          uber_order_id?: string | null
          unit_price?: number
          vat_1_item_promo?: number | null
          vat_1_refund?: number | null
          vat_1_sales?: number | null
          vat_2_item_promo?: number | null
          vat_2_refund?: number | null
          vat_2_sales?: number | null
          vat_3_item_promo?: number | null
          vat_3_refund?: number | null
          vat_3_sales?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          bag_fee: number | null
          courier_invoice_url: string | null
          created_at: string
          currency: string | null
          customer_invoice_url: string | null
          delivery_cost_excl_vat: number | null
          delivery_cost_incl_vat: number | null
          delivery_fee: number | null
          delivery_fee_gain: number | null
          delivery_promo_excl_vat: number | null
          delivery_promo_incl_vat: number | null
          eco_contribution_refund: number | null
          extra_columns: Json | null
          fulfillment_type: string | null
          gross_amount: number | null
          id: string
          imported_from_report: boolean | null
          item_promo_excl_vat: number | null
          item_promo_incl_vat: number | null
          loyalty_id: string | null
          marketing_fee_adjustment: number | null
          meal_voucher_amount: number | null
          meal_voucher_provider: string | null
          merchant_delivery_fee_excl_vat: number | null
          merchant_delivery_fee_incl_vat: number | null
          net_amount: number | null
          net_payout: number | null
          offer_usage_fee: number | null
          order_channel: string | null
          order_datetime: string | null
          order_total_incl_vat: number | null
          other_payments_description: string | null
          other_payments_incl_vat: number | null
          packaging_fee: number | null
          payment_method: string | null
          payout_date: string | null
          payout_reference_id: string | null
          price_adjustment_excl_vat: number | null
          price_adjustment_incl_vat: number | null
          promotion_discount: number | null
          promotion_id: string | null
          raw_payload: Json | null
          refund_excl_vat: number | null
          refund_incl_vat: number | null
          report_import_date: string | null
          restaurant_id: string
          sales_excl_vat: number | null
          sales_incl_vat: number | null
          service_fee: number | null
          status: string | null
          tax_amount: number | null
          tip_amount: number | null
          uber_fee_after_promo_excl_vat: number | null
          uber_fee_after_promo_incl_vat: number | null
          uber_fee_before_promo_excl_vat: number | null
          uber_fee_promo_excl_vat: number | null
          uber_flow_id: string
          uber_invoice_url: string | null
          uber_one_status: string | null
          uber_order_id: string
          vat_1_item_promo: number | null
          vat_1_merchant_delivery: number | null
          vat_1_refund: number | null
          vat_1_sales: number | null
          vat_2_item_promo: number | null
          vat_2_merchant_delivery: number | null
          vat_2_refund: number | null
          vat_2_sales: number | null
          vat_3_item_promo: number | null
          vat_3_merchant_delivery: number | null
          vat_3_refund: number | null
          vat_3_sales: number | null
          vat_adjustment: number | null
          vat_delivery_cost: number | null
          vat_delivery_promo: number | null
          vat_offer_usage_fee: number | null
          vat_packaging_fee: number | null
          vat_price_adjustment: number | null
          vat_uber_fee: number | null
        }
        Insert: {
          bag_fee?: number | null
          courier_invoice_url?: string | null
          created_at?: string
          currency?: string | null
          customer_invoice_url?: string | null
          delivery_cost_excl_vat?: number | null
          delivery_cost_incl_vat?: number | null
          delivery_fee?: number | null
          delivery_fee_gain?: number | null
          delivery_promo_excl_vat?: number | null
          delivery_promo_incl_vat?: number | null
          eco_contribution_refund?: number | null
          extra_columns?: Json | null
          fulfillment_type?: string | null
          gross_amount?: number | null
          id?: string
          imported_from_report?: boolean | null
          item_promo_excl_vat?: number | null
          item_promo_incl_vat?: number | null
          loyalty_id?: string | null
          marketing_fee_adjustment?: number | null
          meal_voucher_amount?: number | null
          meal_voucher_provider?: string | null
          merchant_delivery_fee_excl_vat?: number | null
          merchant_delivery_fee_incl_vat?: number | null
          net_amount?: number | null
          net_payout?: number | null
          offer_usage_fee?: number | null
          order_channel?: string | null
          order_datetime?: string | null
          order_total_incl_vat?: number | null
          other_payments_description?: string | null
          other_payments_incl_vat?: number | null
          packaging_fee?: number | null
          payment_method?: string | null
          payout_date?: string | null
          payout_reference_id?: string | null
          price_adjustment_excl_vat?: number | null
          price_adjustment_incl_vat?: number | null
          promotion_discount?: number | null
          promotion_id?: string | null
          raw_payload?: Json | null
          refund_excl_vat?: number | null
          refund_incl_vat?: number | null
          report_import_date?: string | null
          restaurant_id: string
          sales_excl_vat?: number | null
          sales_incl_vat?: number | null
          service_fee?: number | null
          status?: string | null
          tax_amount?: number | null
          tip_amount?: number | null
          uber_fee_after_promo_excl_vat?: number | null
          uber_fee_after_promo_incl_vat?: number | null
          uber_fee_before_promo_excl_vat?: number | null
          uber_fee_promo_excl_vat?: number | null
          uber_flow_id?: string
          uber_invoice_url?: string | null
          uber_one_status?: string | null
          uber_order_id: string
          vat_1_item_promo?: number | null
          vat_1_merchant_delivery?: number | null
          vat_1_refund?: number | null
          vat_1_sales?: number | null
          vat_2_item_promo?: number | null
          vat_2_merchant_delivery?: number | null
          vat_2_refund?: number | null
          vat_2_sales?: number | null
          vat_3_item_promo?: number | null
          vat_3_merchant_delivery?: number | null
          vat_3_refund?: number | null
          vat_3_sales?: number | null
          vat_adjustment?: number | null
          vat_delivery_cost?: number | null
          vat_delivery_promo?: number | null
          vat_offer_usage_fee?: number | null
          vat_packaging_fee?: number | null
          vat_price_adjustment?: number | null
          vat_uber_fee?: number | null
        }
        Update: {
          bag_fee?: number | null
          courier_invoice_url?: string | null
          created_at?: string
          currency?: string | null
          customer_invoice_url?: string | null
          delivery_cost_excl_vat?: number | null
          delivery_cost_incl_vat?: number | null
          delivery_fee?: number | null
          delivery_fee_gain?: number | null
          delivery_promo_excl_vat?: number | null
          delivery_promo_incl_vat?: number | null
          eco_contribution_refund?: number | null
          extra_columns?: Json | null
          fulfillment_type?: string | null
          gross_amount?: number | null
          id?: string
          imported_from_report?: boolean | null
          item_promo_excl_vat?: number | null
          item_promo_incl_vat?: number | null
          loyalty_id?: string | null
          marketing_fee_adjustment?: number | null
          meal_voucher_amount?: number | null
          meal_voucher_provider?: string | null
          merchant_delivery_fee_excl_vat?: number | null
          merchant_delivery_fee_incl_vat?: number | null
          net_amount?: number | null
          net_payout?: number | null
          offer_usage_fee?: number | null
          order_channel?: string | null
          order_datetime?: string | null
          order_total_incl_vat?: number | null
          other_payments_description?: string | null
          other_payments_incl_vat?: number | null
          packaging_fee?: number | null
          payment_method?: string | null
          payout_date?: string | null
          payout_reference_id?: string | null
          price_adjustment_excl_vat?: number | null
          price_adjustment_incl_vat?: number | null
          promotion_discount?: number | null
          promotion_id?: string | null
          raw_payload?: Json | null
          refund_excl_vat?: number | null
          refund_incl_vat?: number | null
          report_import_date?: string | null
          restaurant_id?: string
          sales_excl_vat?: number | null
          sales_incl_vat?: number | null
          service_fee?: number | null
          status?: string | null
          tax_amount?: number | null
          tip_amount?: number | null
          uber_fee_after_promo_excl_vat?: number | null
          uber_fee_after_promo_incl_vat?: number | null
          uber_fee_before_promo_excl_vat?: number | null
          uber_fee_promo_excl_vat?: number | null
          uber_flow_id?: string
          uber_invoice_url?: string | null
          uber_one_status?: string | null
          uber_order_id?: string
          vat_1_item_promo?: number | null
          vat_1_merchant_delivery?: number | null
          vat_1_refund?: number | null
          vat_1_sales?: number | null
          vat_2_item_promo?: number | null
          vat_2_merchant_delivery?: number | null
          vat_2_refund?: number | null
          vat_2_sales?: number | null
          vat_3_item_promo?: number | null
          vat_3_merchant_delivery?: number | null
          vat_3_refund?: number | null
          vat_3_sales?: number | null
          vat_adjustment?: number | null
          vat_delivery_cost?: number | null
          vat_delivery_promo?: number | null
          vat_offer_usage_fee?: number | null
          vat_packaging_fee?: number | null
          vat_price_adjustment?: number | null
          vat_uber_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_adjustments: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          payout_date: string | null
          payout_reference_id: string
          raw_columns: Json | null
          restaurant_id: string | null
          restaurant_name: string | null
          uber_store_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          payout_date?: string | null
          payout_reference_id: string
          raw_columns?: Json | null
          restaurant_id?: string | null
          restaurant_name?: string | null
          uber_store_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          payout_date?: string | null
          payout_reference_id?: string
          raw_columns?: Json | null
          restaurant_id?: string | null
          restaurant_name?: string | null
          uber_store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_adjustments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          bag_fee: number | null
          created_at: string
          currency: string | null
          delivery_cost_excl_vat: number | null
          delivery_cost_incl_vat: number | null
          delivery_fee_gain: number | null
          delivery_promo_excl_vat: number | null
          delivery_promo_incl_vat: number | null
          eco_contribution_charge: number | null
          eco_contribution_refund: number | null
          id: string
          item_promo_excl_vat: number | null
          item_promo_incl_vat: number | null
          marketing_fee_adjustment: number | null
          meal_voucher_amount: number | null
          merchant_delivery_fee_excl_vat: number | null
          merchant_delivery_fee_incl_vat: number | null
          net_payout: number | null
          offer_usage_fee: number | null
          order_count: number | null
          order_total_incl_vat: number | null
          other_payments_count: number | null
          other_payments_incl_vat: number | null
          packaging_fee: number | null
          payout_date: string
          payout_reference_id: string
          price_adjustment_excl_vat: number | null
          price_adjustment_incl_vat: number | null
          refund_excl_vat: number | null
          refund_incl_vat: number | null
          restaurant_id: string
          sales_excl_vat: number | null
          sales_incl_vat: number | null
          tips: number | null
          uber_fee_after_promo_excl_vat: number | null
          uber_fee_after_promo_incl_vat: number | null
          uber_fee_before_promo_excl_vat: number | null
          uber_fee_promo_excl_vat: number | null
          uber_store_id: string | null
          vat_1_item_promo: number | null
          vat_1_merchant_delivery: number | null
          vat_1_sales: number | null
          vat_2_item_promo: number | null
          vat_2_merchant_delivery: number | null
          vat_2_sales: number | null
          vat_3_item_promo: number | null
          vat_3_merchant_delivery: number | null
          vat_3_sales: number | null
          vat_adjustment: number | null
          vat_delivery_cost: number | null
          vat_delivery_promo: number | null
          vat_offer_usage_fee: number | null
          vat_packaging_fee: number | null
          vat_price_adjustment: number | null
          vat_refund: number | null
          vat_uber_fee: number | null
        }
        Insert: {
          bag_fee?: number | null
          created_at?: string
          currency?: string | null
          delivery_cost_excl_vat?: number | null
          delivery_cost_incl_vat?: number | null
          delivery_fee_gain?: number | null
          delivery_promo_excl_vat?: number | null
          delivery_promo_incl_vat?: number | null
          eco_contribution_charge?: number | null
          eco_contribution_refund?: number | null
          id?: string
          item_promo_excl_vat?: number | null
          item_promo_incl_vat?: number | null
          marketing_fee_adjustment?: number | null
          meal_voucher_amount?: number | null
          merchant_delivery_fee_excl_vat?: number | null
          merchant_delivery_fee_incl_vat?: number | null
          net_payout?: number | null
          offer_usage_fee?: number | null
          order_count?: number | null
          order_total_incl_vat?: number | null
          other_payments_count?: number | null
          other_payments_incl_vat?: number | null
          packaging_fee?: number | null
          payout_date: string
          payout_reference_id: string
          price_adjustment_excl_vat?: number | null
          price_adjustment_incl_vat?: number | null
          refund_excl_vat?: number | null
          refund_incl_vat?: number | null
          restaurant_id: string
          sales_excl_vat?: number | null
          sales_incl_vat?: number | null
          tips?: number | null
          uber_fee_after_promo_excl_vat?: number | null
          uber_fee_after_promo_incl_vat?: number | null
          uber_fee_before_promo_excl_vat?: number | null
          uber_fee_promo_excl_vat?: number | null
          uber_store_id?: string | null
          vat_1_item_promo?: number | null
          vat_1_merchant_delivery?: number | null
          vat_1_sales?: number | null
          vat_2_item_promo?: number | null
          vat_2_merchant_delivery?: number | null
          vat_2_sales?: number | null
          vat_3_item_promo?: number | null
          vat_3_merchant_delivery?: number | null
          vat_3_sales?: number | null
          vat_adjustment?: number | null
          vat_delivery_cost?: number | null
          vat_delivery_promo?: number | null
          vat_offer_usage_fee?: number | null
          vat_packaging_fee?: number | null
          vat_price_adjustment?: number | null
          vat_refund?: number | null
          vat_uber_fee?: number | null
        }
        Update: {
          bag_fee?: number | null
          created_at?: string
          currency?: string | null
          delivery_cost_excl_vat?: number | null
          delivery_cost_incl_vat?: number | null
          delivery_fee_gain?: number | null
          delivery_promo_excl_vat?: number | null
          delivery_promo_incl_vat?: number | null
          eco_contribution_charge?: number | null
          eco_contribution_refund?: number | null
          id?: string
          item_promo_excl_vat?: number | null
          item_promo_incl_vat?: number | null
          marketing_fee_adjustment?: number | null
          meal_voucher_amount?: number | null
          merchant_delivery_fee_excl_vat?: number | null
          merchant_delivery_fee_incl_vat?: number | null
          net_payout?: number | null
          offer_usage_fee?: number | null
          order_count?: number | null
          order_total_incl_vat?: number | null
          other_payments_count?: number | null
          other_payments_incl_vat?: number | null
          packaging_fee?: number | null
          payout_date?: string
          payout_reference_id?: string
          price_adjustment_excl_vat?: number | null
          price_adjustment_incl_vat?: number | null
          refund_excl_vat?: number | null
          refund_incl_vat?: number | null
          restaurant_id?: string
          sales_excl_vat?: number | null
          sales_incl_vat?: number | null
          tips?: number | null
          uber_fee_after_promo_excl_vat?: number | null
          uber_fee_after_promo_incl_vat?: number | null
          uber_fee_before_promo_excl_vat?: number | null
          uber_fee_promo_excl_vat?: number | null
          uber_store_id?: string | null
          vat_1_item_promo?: number | null
          vat_1_merchant_delivery?: number | null
          vat_1_sales?: number | null
          vat_2_item_promo?: number | null
          vat_2_merchant_delivery?: number | null
          vat_2_sales?: number | null
          vat_3_item_promo?: number | null
          vat_3_merchant_delivery?: number | null
          vat_3_sales?: number | null
          vat_adjustment?: number | null
          vat_delivery_cost?: number | null
          vat_delivery_promo?: number | null
          vat_offer_usage_fee?: number | null
          vat_packaging_fee?: number | null
          vat_price_adjustment?: number | null
          vat_refund?: number | null
          vat_uber_fee?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          changed_at: string
          field_name: string
          id: string
          menu_item_id: string
          new_value: number | null
          notes: string | null
          old_value: number | null
          restaurant_action_id: string | null
        }
        Insert: {
          changed_at?: string
          field_name: string
          id?: string
          menu_item_id: string
          new_value?: number | null
          notes?: string | null
          old_value?: number | null
          restaurant_action_id?: string | null
        }
        Update: {
          changed_at?: string
          field_name?: string
          id?: string
          menu_item_id?: string
          new_value?: number | null
          notes?: string | null
          old_value?: number | null
          restaurant_action_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_restaurant_action_id_fkey"
            columns: ["restaurant_action_id"]
            isOneToOne: false
            referencedRelation: "restaurant_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_issues_ranking: {
        Row: {
          created_at: string
          date_range_end: string | null
          date_range_start: string | null
          has_missing_customization: boolean | null
          id: string
          issues_delta_percent: number | null
          item_title: string
          major_issue_type: string | null
          restaurant_id: string
          score: number
          volume: number
          year: number
        }
        Insert: {
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          has_missing_customization?: boolean | null
          id?: string
          issues_delta_percent?: number | null
          item_title: string
          major_issue_type?: string | null
          restaurant_id: string
          score?: number
          volume?: number
          year: number
        }
        Update: {
          created_at?: string
          date_range_end?: string | null
          date_range_start?: string | null
          has_missing_customization?: boolean | null
          id?: string
          issues_delta_percent?: number | null
          item_title?: string
          major_issue_type?: string | null
          restaurant_id?: string
          score?: number
          volume?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_issues_ranking_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          created_at: string
          end_at: string | null
          id: string
          raw_payload: Json | null
          restaurant_id: string
          start_at: string | null
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string
          end_at?: string | null
          id?: string
          raw_payload?: Json | null
          restaurant_id: string
          start_at?: string | null
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string
          end_at?: string | null
          id?: string
          raw_payload?: Json | null
          restaurant_id?: string
          start_at?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_check_snapshots: {
        Row: {
          chain_id: string | null
          checked_at: string
          created_at: string
          id: string
          inscrit_count: number
          non_trouve_count: number
          restaurant_count: number
          results: Json
          sans_siret_count: number
        }
        Insert: {
          chain_id?: string | null
          checked_at?: string
          created_at?: string
          id?: string
          inscrit_count?: number
          non_trouve_count?: number
          restaurant_count?: number
          results?: Json
          sans_siret_count?: number
        }
        Update: {
          chain_id?: string | null
          checked_at?: string
          created_at?: string
          id?: string
          inscrit_count?: number
          non_trouve_count?: number
          restaurant_count?: number
          results?: Json
          sans_siret_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "rep_check_snapshots_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          created_at: string
          data_blocks: Json
          description: string | null
          icon: string | null
          id: string
          intro_template: string | null
          is_default: boolean | null
          is_scheduled: boolean | null
          last_sent_at: string | null
          name: string
          objectives: Json | null
          outro_template: string | null
          requires_validation: boolean | null
          schedule_day: number | null
          schedule_day_of_month: number | null
          schedule_frequency: string | null
          schedule_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_blocks?: Json
          description?: string | null
          icon?: string | null
          id?: string
          intro_template?: string | null
          is_default?: boolean | null
          is_scheduled?: boolean | null
          last_sent_at?: string | null
          name: string
          objectives?: Json | null
          outro_template?: string | null
          requires_validation?: boolean | null
          schedule_day?: number | null
          schedule_day_of_month?: number | null
          schedule_frequency?: string | null
          schedule_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_blocks?: Json
          description?: string | null
          icon?: string | null
          id?: string
          intro_template?: string | null
          is_default?: boolean | null
          is_scheduled?: boolean | null
          last_sent_at?: string | null
          name?: string
          objectives?: Json | null
          outro_template?: string | null
          requires_validation?: boolean | null
          schedule_day?: number | null
          schedule_day_of_month?: number | null
          schedule_frequency?: string | null
          schedule_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          completed_at: string | null
          created_at: string
          end_date: string
          end_time_ms: number | null
          error_message: string | null
          id: string
          job_id: string | null
          report_type: string
          restaurant_id: string
          sections: Json | null
          start_date: string
          start_time_ms: number | null
          status: string
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          end_date: string
          end_time_ms?: number | null
          error_message?: string | null
          id?: string
          job_id?: string | null
          report_type: string
          restaurant_id: string
          sections?: Json | null
          start_date: string
          start_time_ms?: number | null
          status?: string
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          end_date?: string
          end_time_ms?: number | null
          error_message?: string | null
          id?: string
          job_id?: string | null
          report_type?: string
          restaurant_id?: string
          sections?: Json | null
          start_date?: string
          start_time_ms?: number | null
          status?: string
          workflow_id?: string | null
        }
        Relationships: []
      }
      restaurant_actions: {
        Row: {
          action_type: string
          category: string
          change_context: Json | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          impact_unit: string | null
          impact_value: number | null
          platform: string | null
          restaurant_id: string | null
          restaurant_ids: string[] | null
          start_date: string
          target_item_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          action_type: string
          category: string
          change_context?: Json | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          impact_unit?: string | null
          impact_value?: number | null
          platform?: string | null
          restaurant_id?: string | null
          restaurant_ids?: string[] | null
          start_date: string
          target_item_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          category?: string
          change_context?: Json | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          impact_unit?: string | null
          impact_value?: number | null
          platform?: string | null
          restaurant_id?: string | null
          restaurant_ids?: string[] | null
          start_date?: string
          target_item_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_actions_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "action_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_actions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_deliveroo_ids: {
        Row: {
          created_at: string
          deliveroo_store_name: string
          id: string
          is_primary: boolean | null
          label: string | null
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          deliveroo_store_name: string
          id?: string
          is_primary?: boolean | null
          label?: string | null
          restaurant_id: string
        }
        Update: {
          created_at?: string
          deliveroo_store_name?: string
          id?: string
          is_primary?: boolean | null
          label?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_deliveroo_ids_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          notes: string | null
          restaurant_id: string
          uploaded_at: string
        }
        Insert: {
          created_at?: string
          document_type?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          notes?: string | null
          restaurant_id: string
          uploaded_at?: string
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          notes?: string | null
          restaurant_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_documents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_menu_prices: {
        Row: {
          created_at: string
          description_override: string | null
          id: string
          is_available: boolean
          menu_item_id: string
          price_deliveroo: number | null
          price_uber: number | null
          restaurant_id: string
          tva_deliveroo: number | null
          tva_uber: number | null
          updated_at: string
          validated: boolean | null
          validated_at: string | null
        }
        Insert: {
          created_at?: string
          description_override?: string | null
          id?: string
          is_available?: boolean
          menu_item_id: string
          price_deliveroo?: number | null
          price_uber?: number | null
          restaurant_id: string
          tva_deliveroo?: number | null
          tva_uber?: number | null
          updated_at?: string
          validated?: boolean | null
          validated_at?: string | null
        }
        Update: {
          created_at?: string
          description_override?: string | null
          id?: string
          is_available?: boolean
          menu_item_id?: string
          price_deliveroo?: number | null
          price_uber?: number | null
          restaurant_id?: string
          tva_deliveroo?: number | null
          tva_uber?: number | null
          updated_at?: string
          validated?: boolean | null
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_menu_prices_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_menu_prices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_name_aliases: {
        Row: {
          alias_name: string
          created_at: string
          id: string
          normalized_name: string
          restaurant_id: string
          source: string | null
        }
        Insert: {
          alias_name: string
          created_at?: string
          id?: string
          normalized_name: string
          restaurant_id: string
          source?: string | null
        }
        Update: {
          alias_name?: string
          created_at?: string
          id?: string
          normalized_name?: string
          restaurant_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_name_aliases_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_opening_hours: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_overnight: boolean | null
          platform: string
          restaurant_id: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_overnight?: boolean | null
          platform?: string
          restaurant_id: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_overnight?: boolean | null
          platform?: string
          restaurant_id?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_opening_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_uber_ids: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          label: string | null
          restaurant_id: string
          uber_store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          label?: string | null
          restaurant_id: string
          uber_store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          label?: string | null
          restaurant_id?: string
          uber_store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_uber_ids_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_visibility_grants: {
        Row: {
          created_at: string | null
          granted_by_user_id: string
          granted_to_user_id: string
          id: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string | null
          granted_by_user_id: string
          granted_to_user_id: string
          id?: string
          restaurant_id: string
        }
        Update: {
          created_at?: string | null
          granted_by_user_id?: string
          granted_to_user_id?: string
          id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_visibility_grants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          account_manager_email: string | null
          account_manager_name: string | null
          account_manager_phone: string | null
          account_manager_title: string | null
          address: string | null
          chain_id: string
          city: string | null
          coverage_radius_km: number | null
          created_at: string
          csv_verified: boolean | null
          deliveroo_account_manager_email: string | null
          deliveroo_account_manager_name: string | null
          deliveroo_account_manager_phone: string | null
          deliveroo_account_manager_title: string | null
          deliveroo_closing_date: string | null
          deliveroo_opening_date: string | null
          deliveroo_store_id: string | null
          denomination_sociale: string | null
          dirigeant_legal: string | null
          id: string
          is_active: boolean | null
          is_pinned: boolean | null
          is_succursale: boolean | null
          latitude: number | null
          longitude: number | null
          manager_first_name: string | null
          manager_last_name: string | null
          manager_telegram: string | null
          manager_whatsapp: string | null
          name: string
          phone: string | null
          postal_code: string | null
          restaurant_email: string | null
          restaurant_phone: string | null
          siren: string | null
          siret: string | null
          street: string | null
          tablet_email: string | null
          tablet_password: string | null
          uber_closing_date: string | null
          uber_commission_rate: number | null
          uber_opening_date: string | null
          uber_store_id: string | null
        }
        Insert: {
          account_manager_email?: string | null
          account_manager_name?: string | null
          account_manager_phone?: string | null
          account_manager_title?: string | null
          address?: string | null
          chain_id: string
          city?: string | null
          coverage_radius_km?: number | null
          created_at?: string
          csv_verified?: boolean | null
          deliveroo_account_manager_email?: string | null
          deliveroo_account_manager_name?: string | null
          deliveroo_account_manager_phone?: string | null
          deliveroo_account_manager_title?: string | null
          deliveroo_closing_date?: string | null
          deliveroo_opening_date?: string | null
          deliveroo_store_id?: string | null
          denomination_sociale?: string | null
          dirigeant_legal?: string | null
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean | null
          is_succursale?: boolean | null
          latitude?: number | null
          longitude?: number | null
          manager_first_name?: string | null
          manager_last_name?: string | null
          manager_telegram?: string | null
          manager_whatsapp?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          restaurant_email?: string | null
          restaurant_phone?: string | null
          siren?: string | null
          siret?: string | null
          street?: string | null
          tablet_email?: string | null
          tablet_password?: string | null
          uber_closing_date?: string | null
          uber_commission_rate?: number | null
          uber_opening_date?: string | null
          uber_store_id?: string | null
        }
        Update: {
          account_manager_email?: string | null
          account_manager_name?: string | null
          account_manager_phone?: string | null
          account_manager_title?: string | null
          address?: string | null
          chain_id?: string
          city?: string | null
          coverage_radius_km?: number | null
          created_at?: string
          csv_verified?: boolean | null
          deliveroo_account_manager_email?: string | null
          deliveroo_account_manager_name?: string | null
          deliveroo_account_manager_phone?: string | null
          deliveroo_account_manager_title?: string | null
          deliveroo_closing_date?: string | null
          deliveroo_opening_date?: string | null
          deliveroo_store_id?: string | null
          denomination_sociale?: string | null
          dirigeant_legal?: string | null
          id?: string
          is_active?: boolean | null
          is_pinned?: boolean | null
          is_succursale?: boolean | null
          latitude?: number | null
          longitude?: number | null
          manager_first_name?: string | null
          manager_last_name?: string | null
          manager_telegram?: string | null
          manager_whatsapp?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          restaurant_email?: string | null
          restaurant_phone?: string | null
          siren?: string | null
          siret?: string | null
          street?: string | null
          tablet_email?: string | null
          tablet_password?: string | null
          uber_closing_date?: string | null
          uber_commission_rate?: number | null
          uber_opening_date?: string | null
          uber_store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_messages: {
        Row: {
          channel: string | null
          created_at: string
          error_message: string | null
          failed_count: number | null
          id: string
          media_type: string | null
          media_url: string | null
          message: string
          recipients: Json
          results: Json | null
          scheduled_at: string
          sent_at: string | null
          sent_count: number | null
          status: string
          subject: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          error_message?: string | null
          failed_count?: number | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message: string
          recipients: Json
          results?: Json | null
          scheduled_at: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          error_message?: string | null
          failed_count?: number | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message?: string
          recipients?: Json
          results?: Json | null
          scheduled_at?: string
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          activated_at: string | null
          created_at: string | null
          deactivated_at: string | null
          id: string
          monthly_price: number
          notes: string | null
          payer_user_id: string
          restaurant_id: string
          status: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          id?: string
          monthly_price?: number
          notes?: string | null
          payer_user_id: string
          restaurant_id: string
          status?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          id?: string
          monthly_price?: number
          notes?: string | null
          payer_user_id?: string
          restaurant_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      success_scores: {
        Row: {
          avoidable_courier_wait: number | null
          created_at: string
          currency_code: string | null
          food_quality: number | null
          id: string
          incorrect_orders: number | null
          menu_details: number | null
          operational_excellence: number | null
          ratings: number | null
          restaurant_id: string
          sales_amount: number | null
          score_month: string
          score_tier: string
          sustainable_packaging: number | null
          unfulfilled_orders: number | null
          updated_at: string
        }
        Insert: {
          avoidable_courier_wait?: number | null
          created_at?: string
          currency_code?: string | null
          food_quality?: number | null
          id?: string
          incorrect_orders?: number | null
          menu_details?: number | null
          operational_excellence?: number | null
          ratings?: number | null
          restaurant_id: string
          sales_amount?: number | null
          score_month: string
          score_tier: string
          sustainable_packaging?: number | null
          unfulfilled_orders?: number | null
          updated_at?: string
        }
        Update: {
          avoidable_courier_wait?: number | null
          created_at?: string
          currency_code?: string | null
          food_quality?: number | null
          id?: string
          incorrect_orders?: number | null
          menu_details?: number | null
          operational_excellence?: number | null
          ratings?: number | null
          restaurant_id?: string
          sales_amount?: number | null
          score_month?: string
          score_tier?: string
          sustainable_packaging?: number | null
          unfulfilled_orders?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "success_scores_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      uber_connections: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          id: string
          raw_payload: Json | null
          refresh_token: string | null
          restaurant_id: string | null
          scopes: string | null
          token_type: string | null
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          raw_payload?: Json | null
          refresh_token?: string | null
          restaurant_id?: string | null
          scopes?: string | null
          token_type?: string | null
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          raw_payload?: Json | null
          refresh_token?: string | null
          restaurant_id?: string | null
          scopes?: string | null
          token_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uber_connections_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_chain_access: {
        Row: {
          chain_id: string | null
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          chain_id?: string | null
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          chain_id?: string | null
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_chain_access_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "chains"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_data: {
        Row: {
          created_at: string
          date: string
          id: string
          precipitation_mm: number | null
          restaurant_id: string
          temperature_avg: number | null
          temperature_max: number | null
          temperature_min: number | null
          weather_code: number | null
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          precipitation_mm?: number | null
          restaurant_id: string
          temperature_avg?: number | null
          temperature_max?: number | null
          temperature_min?: number | null
          weather_code?: number | null
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          precipitation_mm?: number | null
          restaurant_id?: string
          temperature_avg?: number | null
          temperature_max?: number | null
          temperature_min?: number | null
          weather_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_data_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          event_type: string
          id: string
          payload: Json | null
          processed_at: string
          store_id: string | null
          webhook_uuid: string | null
        }
        Insert: {
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string
          store_id?: string | null
          webhook_uuid?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string
          store_id?: string | null
          webhook_uuid?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      daily_sales_uber_deduped: {
        Row: {
          average_basket: number | null
          created_at: string | null
          currency: string | null
          date: string | null
          id: string | null
          order_count: number | null
          period_type: string | null
          platform: string | null
          restaurant_id: string | null
          revenue_ttc: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_uber_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_active_hours_summary:
        | {
            Args: {
              p_end_date: string
              p_restaurant_ids: string[]
              p_start_date: string
            }
            Returns: {
              active_weeks: number
              avg_hours_per_week: number
              distinct_active_hours: number
              has_deliveroo: boolean
              has_uber: boolean
              restaurant_id: string
              total_orders: number
              total_revenue: number
            }[]
          }
        | {
            Args: {
              p_end_date: string
              p_platform?: string
              p_restaurant_ids: string[]
              p_start_date: string
            }
            Returns: {
              active_weeks: number
              avg_hours_per_week: number
              distinct_active_hours: number
              has_deliveroo: boolean
              has_uber: boolean
              restaurant_id: string
              total_orders: number
              total_revenue: number
            }[]
          }
      get_availability_by_restaurant: {
        Args: {
          p_end_date: string
          p_platform?: string
          p_restaurant_ids?: string[]
          p_start_date: string
        }
        Returns: {
          restaurant_id: string
          total_offline_minutes: number
          total_online_minutes: number
        }[]
      }
      get_availability_daily: {
        Args: {
          p_end_date: string
          p_platform?: string
          p_restaurant_ids?: string[]
          p_start_date: string
        }
        Returns: {
          day: string
          total_offline_minutes: number
          total_online_minutes: number
        }[]
      }
      get_availability_heatmap: {
        Args: {
          p_end_date: string
          p_platform?: string
          p_restaurant_ids?: string[]
          p_start_date: string
        }
        Returns: {
          avg_offline_minutes: number
          day_of_week: number
          hour: number
          record_count: number
        }[]
      }
      get_availability_monthly: {
        Args: {
          p_platform?: string
          p_restaurant_ids?: string[]
          p_year: number
        }
        Returns: {
          month: number
          total_offline_minutes: number
          total_online_minutes: number
        }[]
      }
      get_bogo_historical_sales: {
        Args: {
          p_item_names: string[]
          p_period_days: number
          p_restaurant_ids: string[]
          p_start_date: string
        }
        Returns: {
          avg_per_day: number
          avg_sales_per_day: number
          matched_items_count: number
          period_days: number
          total_quantity: number
          total_sales: number
        }[]
      }
      get_daily_revenue_from_orders: {
        Args: {
          p_end_date: string
          p_restaurant_ids?: string[]
          p_start_date: string
        }
        Returns: {
          average_basket: number
          date: string
          order_count: number
          platform: string
          restaurant_id: string
          revenue_ttc: number
        }[]
      }
      get_daily_sales_uber: {
        Args: {
          p_end_date: string
          p_period_type?: string
          p_restaurant_ids?: string[]
          p_start_date: string
        }
        Returns: {
          average_basket: number
          date: string
          order_count: number
          platform: string
          restaurant_id: string
          revenue_ttc: number
        }[]
      }
      get_deliveroo_payouts_detail: {
        Args: {
          p_end_date: string
          p_restaurant_ids?: string[]
          p_start_date: string
        }
        Returns: {
          item_promo_incl_vat: number
          marketing_fee_adjustment: number
          meal_voucher_amount: number
          net_payout: number
          order_count: number
          other_payments_incl_vat: number
          payout_date: string
          refund_incl_vat: number
          restaurant_id: string
          sales_incl_vat: number
          uber_fee_after_promo_excl_vat: number
          uber_fee_after_promo_incl_vat: number
        }[]
      }
      get_hourly_order_performance:
        | {
            Args: {
              p_end_date: string
              p_restaurant_ids: string[]
              p_start_date: string
            }
            Returns: {
              hour: number
              order_count: number
              restaurant_id: string
              revenue: number
            }[]
          }
        | {
            Args: {
              p_end_date: string
              p_platform?: string
              p_restaurant_ids: string[]
              p_start_date: string
            }
            Returns: {
              hour: number
              order_count: number
              restaurant_id: string
              revenue: number
            }[]
          }
      get_monthly_payouts_detail: {
        Args: { p_month: number; p_restaurant_ids?: string[]; p_year: number }
        Returns: {
          delivery_promo_excl_vat: number
          delivery_promo_incl_vat: number
          eco_contribution_charge: number
          eco_contribution_refund: number
          item_promo_excl_vat: number
          item_promo_incl_vat: number
          marketing_fee_adjustment: number
          meal_voucher_amount: number
          net_payout: number
          order_count: number
          other_payments_incl_vat: number
          payout_date: string
          price_adjustment_excl_vat: number
          price_adjustment_incl_vat: number
          refund_excl_vat: number
          refund_incl_vat: number
          restaurant_id: string
          sales_excl_vat: number
          sales_incl_vat: number
          tips: number
          uber_fee_after_promo_excl_vat: number
          uber_fee_after_promo_incl_vat: number
          uber_fee_before_promo_excl_vat: number
          uber_fee_promo_excl_vat: number
          vat_refund: number
          vat_uber_fee: number
        }[]
      }
      get_monthly_payouts_summary: {
        Args: { p_restaurant_ids?: string[]; p_year: number }
        Returns: {
          delivery_promo_incl_vat: number
          item_promo_incl_vat: number
          marketing_fee_adjustment: number
          month: number
          net_payout: number
          order_count: number
          other_payments_incl_vat: number
          refund_incl_vat: number
          restaurant_id: string
          sales_incl_vat: number
          tips: number
          uber_fee_incl_vat: number
          year: number
        }[]
      }
      get_monthly_revenue_from_orders: {
        Args: { p_restaurant_ids?: string[]; p_year: number }
        Returns: {
          average_basket: number
          month: number
          order_count: number
          platform: string
          restaurant_id: string
          revenue_ttc: number
          year: number
        }[]
      }
      get_monthly_sales_from_daily: {
        Args: {
          p_period_type?: string
          p_restaurant_ids?: string[]
          p_year: number
        }
        Returns: {
          average_basket: number
          month: number
          order_count: number
          platform: string
          restaurant_id: string
          revenue_ttc: number
          year: number
        }[]
      }
      get_network_deliveroo_summary: {
        Args: {
          p_end_date: string
          p_restaurant_ids: string[]
          p_start_date: string
        }
        Returns: {
          order_count: number
          restaurant_id: string
          total_payable: number
          total_revenue: number
        }[]
      }
      get_network_orders_summary: {
        Args: {
          p_end_date: string
          p_restaurant_ids: string[]
          p_start_date: string
        }
        Returns: {
          order_count: number
          restaurant_id: string
          total_item_promo_incl_vat: number
          total_meal_voucher: number
          total_net_payout: number
          total_sales_incl_vat: number
        }[]
      }
      get_network_prep_time_summary: {
        Args: {
          p_end_date: string
          p_restaurant_ids: string[]
          p_start_date: string
        }
        Returns: {
          avg_avoidable_wait_time: number
          avg_prep_time: number
          avg_total_delivery_time: number
          avoidable_wait_count: number
          delivery_count: number
          prep_count: number
          restaurant_id: string
        }[]
      }
      get_offers_analytics: {
        Args: {
          p_end_date?: string
          p_restaurant_ids?: string[]
          p_start_date?: string
        }
        Returns: {
          month_key: string
          promo_orders: number
          restaurant_id: string
          taxed_orders: number
          total_offer_fees: number
          total_orders: number
          total_promo_amount: number
        }[]
      }
      get_order_counts_for_accuracy: {
        Args: {
          p_end_date: string
          p_restaurant_ids: string[]
          p_start_date: string
        }
        Returns: {
          hour: number
          hourly_orders: number
          restaurant_id: string
          total_orders: number
          weekday: number
          weekday_orders: number
        }[]
      }
      get_product_sales_for_period:
        | {
            Args: {
              p_end_date?: string
              p_restaurant_ids?: string[]
              p_start_date?: string
            }
            Returns: {
              item_title: string
              total_quantity: number
            }[]
          }
        | {
            Args: { p_restaurant_ids?: string[]; p_start_date?: string }
            Returns: {
              item_title: string
              total_quantity: number
            }[]
          }
      get_products_by_time_slot: {
        Args: {
          p_end_date: string
          p_restaurant_ids: string[]
          p_start_date: string
          p_top_n?: number
        }
        Returns: {
          percent_of_slot: number
          product_title: string
          quantity: number
          rank: number
          revenue: number
          slot_label: string
          slot_range: string
          slot_total_orders: number
          slot_total_revenue: number
        }[]
      }
      get_profitability_daily: {
        Args: {
          p_end_date: string
          p_restaurant_ids: string[]
          p_start_date: string
        }
        Returns: {
          day: string
          item_promo_incl_vat: number
          meal_voucher: number
          net_payout: number
          orders_count: number
          payout: number
          restaurant_id: string
          sales: number
        }[]
      }
      get_uber_one_stats: {
        Args: {
          p_end_date: string
          p_granularity?: string
          p_platform?: string
          p_restaurant_ids: string[]
          p_start_date: string
        }
        Returns: {
          non_uber_one_count: number
          non_uber_one_prep_count: number
          non_uber_one_prep_sum: number
          non_uber_one_revenue: number
          period_key: string
          restaurant_id: string
          uber_one_count: number
          uber_one_prep_count: number
          uber_one_prep_sum: number
          uber_one_revenue: number
        }[]
      }
      get_user_role: { Args: never; Returns: string }
      get_yearly_payouts_detail: {
        Args: { p_restaurant_ids?: string[]; p_year: number }
        Returns: {
          delivery_promo_excl_vat: number
          delivery_promo_incl_vat: number
          eco_contribution_charge: number
          eco_contribution_refund: number
          item_promo_excl_vat: number
          item_promo_incl_vat: number
          marketing_fee_adjustment: number
          meal_voucher_amount: number
          net_payout: number
          order_count: number
          other_payments_incl_vat: number
          payout_date: string
          price_adjustment_excl_vat: number
          price_adjustment_incl_vat: number
          refund_excl_vat: number
          refund_incl_vat: number
          restaurant_id: string
          sales_excl_vat: number
          sales_incl_vat: number
          tips: number
          uber_fee_after_promo_excl_vat: number
          uber_fee_after_promo_incl_vat: number
          uber_fee_before_promo_excl_vat: number
          uber_fee_promo_excl_vat: number
          vat_refund: number
          vat_uber_fee: number
        }[]
      }
      is_super_admin: { Args: never; Returns: boolean }
      update_uber_commission_rates: {
        Args: never
        Returns: {
          new_rate: number
          old_rate: number
          payout_count: number
          restaurant_id: string
          restaurant_name: string
        }[]
      }
      user_has_chain_access: { Args: { p_chain_id: string }; Returns: boolean }
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
    Enums: {},
  },
} as const
