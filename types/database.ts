/**
 * Types générés depuis le schéma Supabase (projet de production) le 24/10/2026.
 * NE PAS MODIFIER À LA MAIN. Régénérer après chaque migration :
 *   npx supabase gen types typescript --project-id azodrrhkjmfmpitptecl > types/database.ts
 * (ou demander à Claude : outil Supabase `generate_typescript_types`).
 */
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
      activity_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: number
          occurred_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: number
          occurred_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: number
          occurred_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string | null
          permissions: Json | null
          role: string
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          permissions?: Json | null
          role?: string
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          permissions?: Json | null
          role?: string
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string | null
          device_type: string | null
          event_type: string
          id: number
          metadata: Json | null
          page_path: string | null
          referrer: string | null
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_type?: string | null
          event_type: string
          id?: number
          metadata?: Json | null
          page_path?: string | null
          referrer?: string | null
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_type?: string | null
          event_type?: string
          id?: number
          metadata?: Json | null
          page_path?: string | null
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_sessions: {
        Row: {
          created_at: string | null
          device_type: string | null
          duration_seconds: number | null
          ended_at: string | null
          entry_page: string | null
          exit_page: string | null
          is_bounce: boolean | null
          page_views: number | null
          session_id: string
          started_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          entry_page?: string | null
          exit_page?: string | null
          is_bounce?: boolean | null
          page_views?: number | null
          session_id: string
          started_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_type?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          entry_page?: string | null
          exit_page?: string | null
          is_bounce?: boolean | null
          page_views?: number | null
          session_id?: string
          started_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          bucket: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          bucket?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      billing_customers: {
        Row: {
          created_at: string
          current_period_end: string | null
          metadata: Json | null
          plan: string
          stripe_customer_id: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          metadata?: Json | null
          plan?: string
          stripe_customer_id: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          metadata?: Json | null
          plan?: string
          stripe_customer_id?: string
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          level: string | null
          name: string
          owner_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          level?: string | null
          name: string
          owner_id?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          level?: string | null
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      daily_stats: {
        Row: {
          active_users: number | null
          app_visitors: number | null
          avg_session_duration_seconds: number | null
          bounce_rate: number | null
          date: string
          desktop_users: number | null
          documents_uploaded: number | null
          mobile_users: number | null
          new_users: number | null
          quizzes_generated: number | null
          tablet_users: number | null
          total_page_views: number | null
          total_sessions: number | null
          total_users: number | null
          updated_at: string | null
          vitrine_visitors: number | null
        }
        Insert: {
          active_users?: number | null
          app_visitors?: number | null
          avg_session_duration_seconds?: number | null
          bounce_rate?: number | null
          date: string
          desktop_users?: number | null
          documents_uploaded?: number | null
          mobile_users?: number | null
          new_users?: number | null
          quizzes_generated?: number | null
          tablet_users?: number | null
          total_page_views?: number | null
          total_sessions?: number | null
          total_users?: number | null
          updated_at?: string | null
          vitrine_visitors?: number | null
        }
        Update: {
          active_users?: number | null
          app_visitors?: number | null
          avg_session_duration_seconds?: number | null
          bounce_rate?: number | null
          date?: string
          desktop_users?: number | null
          documents_uploaded?: number | null
          mobile_users?: number | null
          new_users?: number | null
          quizzes_generated?: number | null
          tablet_users?: number | null
          total_page_views?: number | null
          total_sessions?: number | null
          total_users?: number | null
          updated_at?: string | null
          vitrine_visitors?: number | null
        }
        Relationships: []
      }
      document_sections: {
        Row: {
          content: string | null
          document_path: string | null
          embedding: string | null
          fts: unknown
          id: number
          page_end: number | null
          page_start: number | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          document_path?: string | null
          embedding?: string | null
          fts?: unknown
          id?: number
          page_end?: number | null
          page_start?: number | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          document_path?: string | null
          embedding?: string | null
          fts?: unknown
          id?: number
          page_end?: number | null
          page_start?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          id: number
          status: string | null
          status_message: string | null
          status_updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          id?: number
          status?: string | null
          status_message?: string | null
          status_updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          id?: number
          status?: string | null
          status_message?: string | null
          status_updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      embedding_rate_limits: {
        Row: {
          next_available_at: string
          slot_key: string
        }
        Insert: {
          next_available_at?: string
          slot_key: string
        }
        Update: {
          next_available_at?: string
          slot_key?: string
        }
        Relationships: []
      }
      export_events: {
        Row: {
          context: string | null
          created_at: string
          document_path: string | null
          id: number
          kind: string
          user_id: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          document_path?: string | null
          id?: number
          kind: string
          user_id?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          document_path?: string | null
          id?: number
          kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
      flashcard_reviews: {
        Row: {
          due_at: string
          ease: number
          flashcard_id: string
          grade: number
          id: string
          interval_days: number
          repetitions: number
          reviewed_at: string
          user_id: string
        }
        Insert: {
          due_at?: string
          ease?: number
          flashcard_id: string
          grade: number
          id?: string
          interval_days?: number
          repetitions?: number
          reviewed_at?: string
          user_id: string
        }
        Update: {
          due_at?: string
          ease?: number
          flashcard_id?: string
          grade?: number
          id?: string
          interval_days?: number
          repetitions?: number
          reviewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          answer: string
          created_at: string
          document_path: string | null
          id: string
          question: string
          question_key: string | null
          source: string
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          document_path?: string | null
          id?: string
          question: string
          question_key?: string | null
          source?: string
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          document_path?: string | null
          id?: string
          question?: string
          question_key?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      live_answers: {
        Row: {
          answer: string
          answer_text: string | null
          answered_at: string
          id: string
          is_correct: boolean
          participant_id: string
          question_index: number
          session_id: string
        }
        Insert: {
          answer: string
          answer_text?: string | null
          answered_at?: string
          id?: string
          is_correct: boolean
          participant_id: string
          question_index: number
          session_id: string
        }
        Update: {
          answer?: string
          answer_text?: string | null
          answered_at?: string
          id?: string
          is_correct?: boolean
          participant_id?: string
          question_index?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_answers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "session_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_ai_usage_events: {
        Row: {
          completion_tokens: number | null
          cost: number | null
          created_at: string
          id: number
          latency_ms: number | null
          metadata: Json | null
          model: string
          occurred_at: string
          prompt_tokens: number | null
          provider: string
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number | null
          cost?: number | null
          created_at?: string
          id?: number
          latency_ms?: number | null
          metadata?: Json | null
          model: string
          occurred_at?: string
          prompt_tokens?: number | null
          provider: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number | null
          cost?: number | null
          created_at?: string
          id?: number
          latency_ms?: number | null
          metadata?: Json | null
          model?: string
          occurred_at?: string
          prompt_tokens?: number | null
          provider?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      metrics_daily_documents: {
        Row: {
          created_at: string
          documents_imported: number
          documents_processed: number
          sections_created: number
          unique_uploaders: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          created_at?: string
          documents_imported?: number
          documents_processed?: number
          sections_created?: number
          unique_uploaders?: number
          updated_at?: string
          usage_date: string
        }
        Update: {
          created_at?: string
          documents_imported?: number
          documents_processed?: number
          sections_created?: number
          unique_uploaders?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      metrics_daily_usage: {
        Row: {
          average_latency_ms: number | null
          completion_tokens: number
          created_at: string
          estimated_cost: number
          metadata: Json | null
          model: string
          prompt_tokens: number
          provider: string
          total_requests: number
          total_tokens: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          average_latency_ms?: number | null
          completion_tokens?: number
          created_at?: string
          estimated_cost?: number
          metadata?: Json | null
          model?: string
          prompt_tokens?: number
          provider: string
          total_requests?: number
          total_tokens?: number
          updated_at?: string
          usage_date: string
        }
        Update: {
          average_latency_ms?: number | null
          completion_tokens?: number
          created_at?: string
          estimated_cost?: number
          metadata?: Json | null
          model?: string
          prompt_tokens?: number
          provider?: string
          total_requests?: number
          total_tokens?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      metrics_daily_users: {
        Row: {
          active_users: number
          active_users_30d: number
          active_users_7d: number
          churned_users: number
          created_at: string
          new_users: number
          updated_at: string
          usage_date: string
        }
        Insert: {
          active_users?: number
          active_users_30d?: number
          active_users_7d?: number
          churned_users?: number
          created_at?: string
          new_users?: number
          updated_at?: string
          usage_date: string
        }
        Update: {
          active_users?: number
          active_users_30d?: number
          active_users_7d?: number
          churned_users?: number
          created_at?: string
          new_users?: number
          updated_at?: string
          usage_date?: string
        }
        Relationships: []
      }
      ocr_chunks: {
        Row: {
          confidence: number | null
          content: string
          created_at: string | null
          document_id: string
          id: string
          lang: string | null
          page: number | null
        }
        Insert: {
          confidence?: number | null
          content: string
          created_at?: string | null
          document_id: string
          id?: string
          lang?: string | null
          page?: number | null
        }
        Update: {
          confidence?: number | null
          content?: string
          created_at?: string | null
          document_id?: string
          id?: string
          lang?: string | null
          page?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "ocr_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_documents: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          source_url: string | null
          status: string | null
          theme_id: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          source_url?: string | null
          status?: string | null
          theme_id?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          source_url?: string | null
          status?: string | null
          theme_id?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ocr_embeddings: {
        Row: {
          chunk_id: string
          embedding: string | null
        }
        Insert: {
          chunk_id: string
          embedding?: string | null
        }
        Update: {
          chunk_id?: string
          embedding?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ocr_embeddings_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: true
            referencedRelation: "ocr_chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_alerts: {
        Row: {
          created_at: string
          details: Json | null
          id: number
          kind: string
          message: string
          notified_at: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: never
          kind: string
          message: string
          notified_at?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: never
          kind?: string
          message?: string
          notified_at?: string | null
        }
        Relationships: []
      }
      page_views: {
        Row: {
          country: string | null
          created_at: string
          id: number
          ip_hash: string | null
          referrer: string | null
          route: string
          session_id: string | null
          user_agent: string | null
          user_id: string | null
          visited_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          referrer?: string | null
          route: string
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          visited_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: number
          ip_hash?: string | null
          referrer?: string | null
          route?: string
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
          visited_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string | null
          id: string
          keys: Json | null
          raw: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint?: string | null
          id?: string
          keys?: Json | null
          raw?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string | null
          id?: string
          keys?: Json | null
          raw?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quiz_answers: {
        Row: {
          answer: string | null
          attempt_id: number
          correct_answer: string | null
          created_at: string
          is_correct: boolean
          justification: string | null
          question: string | null
          question_index: number
        }
        Insert: {
          answer?: string | null
          attempt_id: number
          correct_answer?: string | null
          created_at?: string
          is_correct: boolean
          justification?: string | null
          question?: string | null
          question_index: number
        }
        Update: {
          answer?: string | null
          attempt_id?: number
          correct_answer?: string | null
          created_at?: string
          is_correct?: boolean
          justification?: string | null
          question?: string | null
          question_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          completed_at: string | null
          context: Json | null
          created_at: string | null
          id: number
          score: number
          started_at: string | null
          total_questions: number
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          context?: Json | null
          created_at?: string | null
          id?: number
          score: number
          started_at?: string | null
          total_questions: number
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          context?: Json | null
          created_at?: string | null
          id?: number
          score?: number
          started_at?: string | null
          total_questions?: number
          user_id?: string | null
        }
        Relationships: []
      }
      quiz_challenges: {
        Row: {
          author_name: string | null
          created_at: string
          id: string
          quiz: Json
          score: number
          share_code: string
          total: number
        }
        Insert: {
          author_name?: string | null
          created_at?: string
          id?: string
          quiz: Json
          score: number
          share_code: string
          total: number
        }
        Update: {
          author_name?: string | null
          created_at?: string
          id?: string
          quiz?: Json
          score?: number
          share_code?: string
          total?: number
        }
        Relationships: []
      }
      quiz_sessions: {
        Row: {
          class_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          shared_quiz_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          class_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          shared_quiz_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          class_id?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          shared_quiz_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_sessions_shared_quiz_id_fkey"
            columns: ["shared_quiz_id"]
            isOneToOne: false
            referencedRelation: "shared_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          id: string
          joined_at: string
          last_activity_at: string
          nickname: string
          session_id: string
          token_hash: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          joined_at?: string
          last_activity_at?: string
          nickname: string
          session_id: string
          token_hash?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          joined_at?: string
          last_activity_at?: string
          nickname?: string
          session_id?: string
          token_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_quizzes: {
        Row: {
          created_at: string
          creator_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_participants: number | null
          qr_code_url: string | null
          questions: Json
          share_code: string
          title: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_participants?: number | null
          qr_code_url?: string | null
          questions: Json
          share_code: string
          title: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_participants?: number | null
          qr_code_url?: string | null
          questions?: Json
          share_code?: string
          title?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          processed_at: string
          received_at: string
        }
        Insert: {
          event_id: string
          processed_at?: string
          received_at?: string
        }
        Update: {
          event_id?: string
          processed_at?: string
          received_at?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          metadata: Json | null
          plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          metadata?: Json | null
          plan: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          metadata?: Json | null
          plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          ip_address: string | null
          token: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          ip_address?: string | null
          token: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          ip_address?: string | null
          token?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          daily_goal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          daily_goal?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          daily_goal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          last_active_date: string | null
          last_activity_at: string | null
          last_reminder_day: string | null
          last_reminder_sent_at: string | null
          last_reminder_window: string | null
          longest_streak: number
          reminders_sent_today: number
          should_notify: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          last_active_date?: string | null
          last_activity_at?: string | null
          last_reminder_day?: string | null
          last_reminder_sent_at?: string | null
          last_reminder_window?: string | null
          longest_streak?: number
          reminders_sent_today?: number
          should_notify?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          last_active_date?: string | null
          last_activity_at?: string | null
          last_reminder_day?: string | null
          last_reminder_sent_at?: string | null
          last_reminder_window?: string | null
          longest_streak?: number
          reminders_sent_today?: number
          should_notify?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          email_verified: boolean | null
          id: string
          last_login_at: string | null
          name: string | null
          password_hash: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          email_verified?: boolean | null
          id?: string
          last_login_at?: string | null
          name?: string | null
          password_hash: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          email_verified?: boolean | null
          id?: string
          last_login_at?: string | null
          name?: string | null
          password_hash?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      metrics_homepage_views: {
        Row: {
          usage_date: string | null
          view_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      acquire_embedding_slot: {
        Args: { p_min_interval_ms: number; p_slot_key: string }
        Returns: number
      }
      admin_list_user_activity: {
        Args: never
        Returns: {
          challenges_shared: number
          created_at: string
          current_streak: number
          display_name: string
          documents_count: number
          email: string
          excel_exports: number
          last_active_date: string
          live_recap_exports: number
          longest_streak: number
          quiz_exports: number
          quizzes_generated: number
          revisions_generated: number
          summary_exports: number
          user_id: string
        }[]
      }
      check_ops_health: { Args: never; Returns: number }
      class_question_stats: {
        Args: { p_class_id: string; p_session_id: string }
        Returns: {
          answers: number
          correct: number
          question: string
          question_index: number
          success_pct: number
        }[]
      }
      class_sessions_summary: {
        Args: { p_class_id: string }
        Returns: {
          answers: number
          avg_score_pct: number
          completed_at: string
          completion_pct: number
          created_at: string
          participants: number
          question_count: number
          quiz_title: string
          session_id: string
          shared_quiz_id: string
          started_at: string
          status: string
        }[]
      }
      class_students_progress: {
        Args: { p_class_id: string }
        Returns: {
          avg_score_pct: number
          last_session_at: string
          nickname: string
          scores: Json
          sessions_count: number
        }[]
      }
      cleanup_expired_sessions: { Args: never; Returns: number }
      consume_rate_limit: {
        Args: {
          p_bucket: string
          p_limit: number
          p_user_id: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          retry_after_seconds: number
        }[]
      }
      count_active_users_today: { Args: never; Returns: number }
      count_connected_users: { Args: never; Returns: number }
      create_quiz_session: {
        Args: { p_class_id?: string; p_shared_quiz_id: string }
        Returns: {
          class_id: string | null
          completed_at: string | null
          created_at: string
          id: string
          shared_quiz_id: string
          started_at: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "quiz_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_share_code: { Args: never; Returns: string }
      get_activity_stats: {
        Args: { p_since?: string }
        Returns: {
          event_count: number
          event_type: string
          unique_users: number
        }[]
      }
      get_or_create_stripe_customer: {
        Args: { p_email: string; p_user_id: string }
        Returns: {
          created_at: string
          current_period_end: string | null
          metadata: Json | null
          plan: string
          stripe_customer_id: string
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "billing_customers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_public_quiz: { Args: { p_share_code: string }; Returns: Json }
      get_realtime_stats: { Args: never; Returns: Json }
      get_recent_activities: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          event_data: Json
          event_type: string
          id: number
          occurred_at: string
          user_email: string
          user_id: string
        }[]
      }
      get_user_activity: {
        Args: { p_user_id: string }
        Returns: {
          documents_uploaded: number
          last_activity: string
          quizzes_generated: number
          total_page_views: number
          total_sessions: number
        }[]
      }
      hybrid_search_document_sections: {
        Args: {
          match_count?: number
          p_document_path?: string
          p_page_end?: number
          p_page_start?: number
          p_user_id?: string
          query_embedding: string
          query_text: string
          vector_threshold?: number
        }
        Returns: {
          content: string
          document_path: string
          id: number
          page_end: number
          page_start: number
          rrf_score: number
          similarity: number
          text_rank: number
        }[]
      }
      is_admin: { Args: { p_user_id?: string }; Returns: boolean }
      is_quiz_creator: {
        Args: { p_shared_quiz_id: string; p_user_id: string }
        Returns: boolean
      }
      is_session_creator: { Args: { p_session_id: string }; Returns: boolean }
      is_shared_quiz_active: {
        Args: { p_shared_quiz_id: string }
        Returns: boolean
      }
      join_session: {
        Args: { p_nickname: string; p_session_id: string }
        Returns: Json
      }
      list_active_session: {
        Args: { p_share_code: string }
        Returns: {
          expires_at: string
          questions_count: number
          session_id: string
          share_code: string
          started_at: string
          status: string
          title: string
        }[]
      }
      list_due_flashcards: {
        Args: { p_document_path?: string; p_limit?: number }
        Returns: {
          answer: string
          created_at: string
          document_path: string
          due_at: string
          id: string
          question: string
          source: string
        }[]
      }
      live_quiz_option_letter: {
        Args: { p_options: Json; p_value: string }
        Returns: string
      }
      mark_streak_reminder_sent: {
        Args: {
          p_day: string
          p_sent_at?: string
          p_user_id: string
          p_window: string
        }
        Returns: {
          created_at: string
          current_streak: number
          last_active_date: string | null
          last_activity_at: string | null
          last_reminder_day: string | null
          last_reminder_sent_at: string | null
          last_reminder_window: string | null
          longest_streak: number
          reminders_sent_today: number
          should_notify: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_streaks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      match_document_sections:
        | {
            Args: {
              match_count?: number
              match_threshold?: number
              p_document_path?: string
              p_page_end?: number
              p_page_start?: number
              p_user_id?: string
              query_embedding: string
            }
            Returns: {
              content: string
              document_path: string
              id: number
              page_end: number
              page_start: number
              similarity: number
            }[]
          }
        | {
            Args: {
              match_count: number
              match_threshold: number
              p_document_path?: string
              p_user_id: string
              query_embedding: string
            }
            Returns: {
              content: string
              id: number
              similarity: number
            }[]
          }
      notify_ops_alerts: { Args: never; Returns: number }
      recover_stuck_documents: { Args: { p_max_age?: string }; Returns: number }
      review_summary: {
        Args: { p_timezone?: string }
        Returns: {
          daily_goal: number
          due_count: number
          new_count: number
          quiz_error_due: number
          reviewed_today: number
        }[]
      }
      run_daily_metrics_aggregation: {
        Args: { p_target_date?: string }
        Returns: undefined
      }
      search_ocr_chunks:
        | {
            Args: { query_vec: string; theme?: string; top_k?: number }
            Returns: {
              chunk_id: string
              content: string
              distance: number
              document_id: string
            }[]
          }
        | {
            Args: {
              from_date?: string
              query_vec: string
              source?: string
              theme?: string
              to_date?: string
              top_k?: number
            }
            Returns: {
              chunk_confidence: number
              chunk_id: string
              chunk_lang: string
              content: string
              distance: number
              doc_created_at: string
              doc_source_url: string
              doc_theme_id: string
              doc_title: string
              document_id: string
            }[]
          }
      set_user_plan: {
        Args: { p_assigned_by?: string; p_plan: string; p_user_id: string }
        Returns: {
          assigned_at: string
          assigned_by: string | null
          metadata: Json | null
          plan: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      submit_live_answer: {
        Args: {
          p_answer: string
          p_participant_id: string
          p_question_index: number
          p_token: string
        }
        Returns: Json
      }
      update_user_streak: {
        Args: { p_activity_at?: string; p_user_id: string }
        Returns: {
          created_at: string
          current_streak: number
          last_active_date: string | null
          last_activity_at: string | null
          last_reminder_day: string | null
          last_reminder_sent_at: string | null
          last_reminder_window: string | null
          longest_streak: number
          reminders_sent_today: number
          should_notify: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_streaks"
          isOneToOne: true
          isSetofReturn: false
        }
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
