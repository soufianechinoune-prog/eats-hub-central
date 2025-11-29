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
      chains: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      customer_reviews: {
        Row: {
          created_at: string
          customer_comment: string | null
          delivery_rating: number | null
          food_rating: number | null
          id: string
          order_id: string | null
          overall_rating: number | null
          restaurant_id: string
          review_date: string | null
          uber_order_id: string | null
        }
        Insert: {
          created_at?: string
          customer_comment?: string | null
          delivery_rating?: number | null
          food_rating?: number | null
          id?: string
          order_id?: string | null
          overall_rating?: number | null
          restaurant_id: string
          review_date?: string | null
          uber_order_id?: string | null
        }
        Update: {
          created_at?: string
          customer_comment?: string | null
          delivery_rating?: number | null
          food_rating?: number | null
          id?: string
          order_id?: string | null
          overall_rating?: number | null
          restaurant_id?: string
          review_date?: string | null
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
      menu_item_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          item_id: string
          item_title: string
          rating: number
          restaurant_id: string
          review_date: string | null
          thumb_down: number | null
          thumb_up: number | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          item_id: string
          item_title: string
          rating: number
          restaurant_id: string
          review_date?: string | null
          thumb_down?: number | null
          thumb_up?: number | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          item_id?: string
          item_title?: string
          rating?: number
          restaurant_id?: string
          review_date?: string | null
          thumb_down?: number | null
          thumb_up?: number | null
        }
        Relationships: []
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
          error_adjustments: number
          id: string
          marketing_fee: number
          month: number
          net_payout: number
          notes: string | null
          offers_cost: number
          other_fees: number
          restaurant_id: string
          uber_fee: number
          updated_at: string
          year: number
        }
        Insert: {
          ads_cost?: number
          created_at?: string
          error_adjustments?: number
          id?: string
          marketing_fee?: number
          month: number
          net_payout?: number
          notes?: string | null
          offers_cost?: number
          other_fees?: number
          restaurant_id: string
          uber_fee?: number
          updated_at?: string
          year: number
        }
        Update: {
          ads_cost?: number
          created_at?: string
          error_adjustments?: number
          id?: string
          marketing_fee?: number
          month?: number
          net_payout?: number
          notes?: string | null
          offers_cost?: number
          other_fees?: number
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
      monthly_revenue: {
        Row: {
          average_basket: number | null
          created_at: string
          id: string
          month: number
          order_count: number
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
          item_title: string | null
          order_id: string | null
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
          item_title?: string | null
          order_id?: string | null
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
          item_title?: string | null
          order_id?: string | null
          restaurant_id?: string
          uber_order_id?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          item_id: string
          item_title: string
          modifiers: Json | null
          order_id: string
          quantity: number
          tax_amount: number | null
          tax_rate: number | null
          total_price: number
          unit_price: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          item_id: string
          item_title: string
          modifiers?: Json | null
          order_id: string
          quantity: number
          tax_amount?: number | null
          tax_rate?: number | null
          total_price: number
          unit_price: number
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          item_id?: string
          item_title?: string
          modifiers?: Json | null
          order_id?: string
          quantity?: number
          tax_amount?: number | null
          tax_rate?: number | null
          total_price?: number
          unit_price?: number
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
          created_at: string
          currency: string | null
          delivery_fee: number | null
          gross_amount: number | null
          id: string
          net_amount: number | null
          order_datetime: string | null
          payment_method: string | null
          promotion_discount: number | null
          promotion_id: string | null
          raw_payload: Json | null
          restaurant_id: string
          service_fee: number | null
          status: string | null
          tax_amount: number | null
          tip_amount: number | null
          uber_order_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          delivery_fee?: number | null
          gross_amount?: number | null
          id?: string
          net_amount?: number | null
          order_datetime?: string | null
          payment_method?: string | null
          promotion_discount?: number | null
          promotion_id?: string | null
          raw_payload?: Json | null
          restaurant_id: string
          service_fee?: number | null
          status?: string | null
          tax_amount?: number | null
          tip_amount?: number | null
          uber_order_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          delivery_fee?: number | null
          gross_amount?: number | null
          id?: string
          net_amount?: number | null
          order_datetime?: string | null
          payment_method?: string | null
          promotion_discount?: number | null
          promotion_id?: string | null
          raw_payload?: Json | null
          restaurant_id?: string
          service_fee?: number | null
          status?: string | null
          tax_amount?: number | null
          tip_amount?: number | null
          uber_order_id?: string
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
      restaurants: {
        Row: {
          account_manager_email: string | null
          account_manager_name: string | null
          account_manager_phone: string | null
          account_manager_title: string | null
          address: string | null
          chain_id: string
          city: string | null
          created_at: string
          id: string
          is_active: boolean | null
          manager_first_name: string | null
          manager_last_name: string | null
          manager_whatsapp: string | null
          name: string
          phone: string | null
          restaurant_email: string | null
          restaurant_phone: string | null
          siren: string | null
          tablet_email: string | null
          tablet_password: string | null
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
          created_at?: string
          id?: string
          is_active?: boolean | null
          manager_first_name?: string | null
          manager_last_name?: string | null
          manager_whatsapp?: string | null
          name: string
          phone?: string | null
          restaurant_email?: string | null
          restaurant_phone?: string | null
          siren?: string | null
          tablet_email?: string | null
          tablet_password?: string | null
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
          created_at?: string
          id?: string
          is_active?: boolean | null
          manager_first_name?: string | null
          manager_last_name?: string | null
          manager_whatsapp?: string | null
          name?: string
          phone?: string | null
          restaurant_email?: string | null
          restaurant_phone?: string | null
          siren?: string | null
          tablet_email?: string | null
          tablet_password?: string | null
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
