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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_generation_logs: {
        Row: {
          created_at: string
          feedback: string | null
          generated_content: Json
          id: string
          latency_ms: number | null
          prompt_context: string | null
          specialist_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          generated_content?: Json
          id?: string
          latency_ms?: number | null
          prompt_context?: string | null
          specialist_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          generated_content?: Json
          id?: string
          latency_ms?: number | null
          prompt_context?: string | null
          specialist_id?: string
          student_id?: string
        }
        Relationships: []
      }
      ai_knowledge_base: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json | null
          specialist_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          specialist_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          specialist_id?: string
        }
        Relationships: []
      }
      anamnese: {
        Row: {
          agua_diaria: string | null
          condicoes_saude: string | null
          created_at: string
          dados_extras: Json | null
          dieta_atual: string | null
          disponibilidade_treino: string | null
          equipamentos: string | null
          experiencia_treino: string | null
          frequencia_treino: string | null
          id: string
          lesoes: string | null
          local_treino: string | null
          medicamentos: string | null
          motivacao: string | null
          nivel_estresse: string | null
          objetivo: string | null
          ocupacao: string | null
          restricoes_alimentares: string | null
          reviewed: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          sono_horas: string | null
          suplementos: string | null
          user_id: string
        }
        Insert: {
          agua_diaria?: string | null
          condicoes_saude?: string | null
          created_at?: string
          dados_extras?: Json | null
          dieta_atual?: string | null
          disponibilidade_treino?: string | null
          equipamentos?: string | null
          experiencia_treino?: string | null
          frequencia_treino?: string | null
          id?: string
          lesoes?: string | null
          local_treino?: string | null
          medicamentos?: string | null
          motivacao?: string | null
          nivel_estresse?: string | null
          objetivo?: string | null
          ocupacao?: string | null
          restricoes_alimentares?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          sono_horas?: string | null
          suplementos?: string | null
          user_id: string
        }
        Update: {
          agua_diaria?: string | null
          condicoes_saude?: string | null
          created_at?: string
          dados_extras?: Json | null
          dieta_atual?: string | null
          disponibilidade_treino?: string | null
          equipamentos?: string | null
          experiencia_treino?: string | null
          frequencia_treino?: string | null
          id?: string
          lesoes?: string | null
          local_treino?: string | null
          medicamentos?: string | null
          motivacao?: string | null
          nivel_estresse?: string | null
          objetivo?: string | null
          ocupacao?: string | null
          restricoes_alimentares?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          sono_horas?: string | null
          suplementos?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string | null
          key: string
          value: string
        }
        Insert: {
          created_at?: string | null
          key: string
          value: string
        }
        Update: {
          created_at?: string | null
          key?: string
          value?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          reply_to: string | null
          sender_id: string
          type: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          reply_to?: string | null
          sender_id: string
          type?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          reply_to?: string | null
          sender_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          title: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          type?: string
        }
        Relationships: []
      }
      daily_habits: {
        Row: {
          completed_meals: string[]
          created_at: string
          date: string
          id: string
          updated_at: string
          user_id: string
          water_liters: number
        }
        Insert: {
          completed_meals?: string[]
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          user_id: string
          water_liters?: number
        }
        Update: {
          completed_meals?: string[]
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          user_id?: string
          water_liters?: number
        }
        Relationships: []
      }
      diet_plan_versions: {
        Row: {
          goal: string
          goal_description: string | null
          id: string
          meals: Json
          plan_id: string
          saved_at: string
          specialist_id: string | null
          title: string
          valid_until: string | null
          version_number: number
        }
        Insert: {
          goal?: string
          goal_description?: string | null
          id?: string
          meals?: Json
          plan_id: string
          saved_at?: string
          specialist_id?: string | null
          title: string
          valid_until?: string | null
          version_number?: number
        }
        Update: {
          goal?: string
          goal_description?: string | null
          id?: string
          meals?: Json
          plan_id?: string
          saved_at?: string
          specialist_id?: string | null
          title?: string
          valid_until?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "diet_plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "diet_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_plans: {
        Row: {
          active: boolean
          created_at: string
          goal: string
          goal_description: string | null
          id: string
          meals: Json
          specialist_id: string | null
          title: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          goal?: string
          goal_description?: string | null
          id?: string
          meals?: Json
          specialist_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          goal?: string
          goal_description?: string | null
          id?: string
          meals?: Json
          specialist_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      diet_templates: {
        Row: {
          created_at: string
          description: string | null
          goal: string
          id: string
          meals: Json
          name: string
          specialist_id: string | null
          total_calories: number
          total_carbs: number
          total_fat: number
          total_protein: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          goal?: string
          id?: string
          meals?: Json
          name: string
          specialist_id?: string | null
          total_calories?: number
          total_carbs?: number
          total_fat?: number
          total_protein?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          goal?: string
          id?: string
          meals?: Json
          name?: string
          specialist_id?: string | null
          total_calories?: number
          total_carbs?: number
          total_fat?: number
          total_protein?: number
          updated_at?: string
        }
        Relationships: []
      }
      exercise_library: {
        Row: {
          category: string | null
          created_at: string
          default_reps: string
          default_sets: number
          equipment: string | null
          external_id: string | null
          gif_url: string | null
          id: string
          instructions: string | null
          level: string | null
          movement_pattern: string | null
          muscle_group: string
          name: string
          secondary_muscles: string | null
          video_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_reps?: string
          default_sets?: number
          equipment?: string | null
          external_id?: string | null
          gif_url?: string | null
          id?: string
          instructions?: string | null
          level?: string | null
          movement_pattern?: string | null
          muscle_group: string
          name: string
          secondary_muscles?: string | null
          video_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          default_reps?: string
          default_sets?: number
          equipment?: string | null
          external_id?: string | null
          gif_url?: string | null
          id?: string
          instructions?: string | null
          level?: string | null
          movement_pattern?: string | null
          muscle_group?: string
          name?: string
          secondary_muscles?: string | null
          video_id?: string | null
        }
        Relationships: []
      }
      flame_status: {
        Row: {
          last_approved_date: string | null
          state: string
          streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          last_approved_date?: string | null
          state?: string
          streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          last_approved_date?: string | null
          state?: string
          streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      food_database: {
        Row: {
          calories: number
          carbs: number
          category: string
          created_at: string
          created_by: string | null
          fat: number
          fiber: number | null
          fonte: string | null
          id: string
          name: string
          original_name: string | null
          portion: string
          portion_amount: number | null
          portion_grams: number | null
          portion_unit: string | null
          protein: number
          updated_at: string
        }
        Insert: {
          calories?: number
          carbs?: number
          category?: string
          created_at?: string
          created_by?: string | null
          fat?: number
          fiber?: number | null
          fonte?: string | null
          id?: string
          name: string
          original_name?: string | null
          portion?: string
          portion_amount?: number | null
          portion_grams?: number | null
          portion_unit?: string | null
          protein?: number
          updated_at?: string
        }
        Update: {
          calories?: number
          carbs?: number
          category?: string
          created_at?: string
          created_by?: string | null
          fat?: number
          fiber?: number | null
          fonte?: string | null
          id?: string
          name?: string
          original_name?: string | null
          portion?: string
          portion_amount?: number | null
          portion_grams?: number | null
          portion_unit?: string | null
          protein?: number
          updated_at?: string
        }
        Relationships: []
      }
      food_favorites: {
        Row: {
          created_at: string
          food_id: string
          id: string
          specialist_id: string
        }
        Insert: {
          created_at?: string
          food_id: string
          id?: string
          specialist_id: string
        }
        Update: {
          created_at?: string
          food_id?: string
          id?: string
          specialist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_favorites_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food_database"
            referencedColumns: ["id"]
          },
        ]
      }
      food_measures: {
        Row: {
          created_at: string
          description: string
          food_id: string
          gram_equivalent: number
          id: string
        }
        Insert: {
          created_at?: string
          description: string
          food_id: string
          gram_equivalent: number
          id?: string
        }
        Update: {
          created_at?: string
          description?: string
          food_id?: string
          gram_equivalent?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_measures_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "food_database"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          key: string
          response: Json | null
        }
        Insert: {
          created_at?: string
          key: string
          response?: Json | null
        }
        Update: {
          created_at?: string
          key?: string
          response?: Json | null
        }
        Relationships: []
      }
      invites: {
        Row: {
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string
          email_opened_at: string | null
          expires_at: string | null
          id: string
          invoice_url: string | null
          name: string | null
          payment_link_clicked_at: string | null
          payment_status: string | null
          plan_value: number | null
          product_id: string | null
          status: string
          subscription_plan_id: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          email_opened_at?: string | null
          expires_at?: string | null
          id?: string
          invoice_url?: string | null
          name?: string | null
          payment_link_clicked_at?: string | null
          payment_status?: string | null
          plan_value?: number | null
          product_id?: string | null
          status?: string
          subscription_plan_id?: string | null
          token?: string
          used_at?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          email_opened_at?: string | null
          expires_at?: string | null
          id?: string
          invoice_url?: string | null
          name?: string | null
          payment_link_clicked_at?: string | null
          payment_status?: string | null
          plan_value?: number | null
          product_id?: string | null
          status?: string
          subscription_plan_id?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_spend: {
        Row: {
          amount: number
          channel: string
          created_at: string
          id: string
          month: string
        }
        Insert: {
          amount?: number
          channel?: string
          created_at?: string
          id?: string
          month: string
        }
        Update: {
          amount?: number
          channel?: string
          created_at?: string
          id?: string
          month?: string
        }
        Relationships: []
      }
      message_reads: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_goals: {
        Row: {
          goal_value: number
          id: string
          metric_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          goal_value?: number
          id?: string
          metric_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          goal_value?: number
          id?: string
          metric_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      monthly_assessments: {
        Row: {
          adesao_cardios: number | null
          adesao_dieta: string | null
          adesao_treinos: number | null
          alimentos_proibidos: string | null
          alongamentos_corretos: boolean | null
          altura: string | null
          autoriza_publicacao: boolean | null
          competicao_fisiculturismo: string | null
          created_at: string
          dias_disponiveis: string[] | null
          foto_costas: string | null
          foto_frente: string | null
          foto_lado_direito: string | null
          foto_lado_esquerdo: string | null
          foto_perfil_lado: string | null
          frequencia_compromisso: string | null
          horario_treino: string | null
          horario_treino_outro: string | null
          id: string
          maquinas_indisponiveis: string[] | null
          modalidade: string | null
          motivo_adesao_cardios: string | null
          motivo_adesao_treinos: string | null
          motivo_nao_dieta: string | null
          nivel_fadiga: number | null
          notas_progressao: string | null
          objetivo_atual: string | null
          peso: string | null
          prioridades_fisicas: string | null
          progresso_abdomen: string | null
          progresso_antebraco: string | null
          progresso_biceps: boolean | null
          progresso_costas: boolean | null
          progresso_deltoide: boolean | null
          progresso_gluteos: boolean | null
          progresso_panturrilha: boolean | null
          progresso_peitoral: boolean | null
          progresso_posteriores: boolean | null
          progresso_quadriceps: boolean | null
          progresso_triceps: boolean | null
          refeicoes_horarios: string | null
          restricao_alimentar: string | null
          sugestao_dieta: string | null
          sugestao_melhoria: string | null
          tempo_disponivel: string | null
          user_id: string
        }
        Insert: {
          adesao_cardios?: number | null
          adesao_dieta?: string | null
          adesao_treinos?: number | null
          alimentos_proibidos?: string | null
          alongamentos_corretos?: boolean | null
          altura?: string | null
          autoriza_publicacao?: boolean | null
          competicao_fisiculturismo?: string | null
          created_at?: string
          dias_disponiveis?: string[] | null
          foto_costas?: string | null
          foto_frente?: string | null
          foto_lado_direito?: string | null
          foto_lado_esquerdo?: string | null
          foto_perfil_lado?: string | null
          frequencia_compromisso?: string | null
          horario_treino?: string | null
          horario_treino_outro?: string | null
          id?: string
          maquinas_indisponiveis?: string[] | null
          modalidade?: string | null
          motivo_adesao_cardios?: string | null
          motivo_adesao_treinos?: string | null
          motivo_nao_dieta?: string | null
          nivel_fadiga?: number | null
          notas_progressao?: string | null
          objetivo_atual?: string | null
          peso?: string | null
          prioridades_fisicas?: string | null
          progresso_abdomen?: string | null
          progresso_antebraco?: string | null
          progresso_biceps?: boolean | null
          progresso_costas?: boolean | null
          progresso_deltoide?: boolean | null
          progresso_gluteos?: boolean | null
          progresso_panturrilha?: boolean | null
          progresso_peitoral?: boolean | null
          progresso_posteriores?: boolean | null
          progresso_quadriceps?: boolean | null
          progresso_triceps?: boolean | null
          refeicoes_horarios?: string | null
          restricao_alimentar?: string | null
          sugestao_dieta?: string | null
          sugestao_melhoria?: string | null
          tempo_disponivel?: string | null
          user_id: string
        }
        Update: {
          adesao_cardios?: number | null
          adesao_dieta?: string | null
          adesao_treinos?: number | null
          alimentos_proibidos?: string | null
          alongamentos_corretos?: boolean | null
          altura?: string | null
          autoriza_publicacao?: boolean | null
          competicao_fisiculturismo?: string | null
          created_at?: string
          dias_disponiveis?: string[] | null
          foto_costas?: string | null
          foto_frente?: string | null
          foto_lado_direito?: string | null
          foto_lado_esquerdo?: string | null
          foto_perfil_lado?: string | null
          frequencia_compromisso?: string | null
          horario_treino?: string | null
          horario_treino_outro?: string | null
          id?: string
          maquinas_indisponiveis?: string[] | null
          modalidade?: string | null
          motivo_adesao_cardios?: string | null
          motivo_adesao_treinos?: string | null
          motivo_nao_dieta?: string | null
          nivel_fadiga?: number | null
          notas_progressao?: string | null
          objetivo_atual?: string | null
          peso?: string | null
          prioridades_fisicas?: string | null
          progresso_abdomen?: string | null
          progresso_antebraco?: string | null
          progresso_biceps?: boolean | null
          progresso_costas?: boolean | null
          progresso_deltoide?: boolean | null
          progresso_gluteos?: boolean | null
          progresso_panturrilha?: boolean | null
          progresso_peitoral?: boolean | null
          progresso_posteriores?: boolean | null
          progresso_quadriceps?: boolean | null
          progresso_triceps?: boolean | null
          refeicoes_horarios?: string | null
          restricao_alimentar?: string | null
          sugestao_dieta?: string | null
          sugestao_melhoria?: string | null
          tempo_disponivel?: string | null
          user_id?: string
        }
        Relationships: []
      }
      monthly_metric_goals: {
        Row: {
          goal_value: number
          id: string
          metric_key: string
          month: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          goal_value?: number
          id?: string
          metric_key: string
          month: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          goal_value?: number
          id?: string
          metric_key?: string
          month?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          altura: string | null
          avatar_url: string | null
          bairro: string | null
          body_fat: number | null
          cep: string | null
          cidade_estado: string | null
          como_chegou: string | null
          cpf: string | null
          created_at: string
          email: string | null
          faixa_etaria: string | null
          fatores_escolha: string | null
          id: string
          indicacao: string | null
          indicacao_nome: string | null
          indicacao_telefone: string | null
          logradouro: string | null
          meta_peso: string | null
          nascimento: string | null
          nome: string | null
          notification_preview: string
          onboarded: boolean
          peso: string | null
          sexo: string | null
          status: string
          telefone: string | null
          tempo_acompanha: string | null
        }
        Insert: {
          altura?: string | null
          avatar_url?: string | null
          bairro?: string | null
          body_fat?: number | null
          cep?: string | null
          cidade_estado?: string | null
          como_chegou?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          faixa_etaria?: string | null
          fatores_escolha?: string | null
          id: string
          indicacao?: string | null
          indicacao_nome?: string | null
          indicacao_telefone?: string | null
          logradouro?: string | null
          meta_peso?: string | null
          nascimento?: string | null
          nome?: string | null
          notification_preview?: string
          onboarded?: boolean
          peso?: string | null
          sexo?: string | null
          status?: string
          telefone?: string | null
          tempo_acompanha?: string | null
        }
        Update: {
          altura?: string | null
          avatar_url?: string | null
          bairro?: string | null
          body_fat?: number | null
          cep?: string | null
          cidade_estado?: string | null
          como_chegou?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          faixa_etaria?: string | null
          fatores_escolha?: string | null
          id?: string
          indicacao?: string | null
          indicacao_nome?: string | null
          indicacao_telefone?: string | null
          logradouro?: string | null
          meta_peso?: string | null
          nascimento?: string | null
          nome?: string | null
          notification_preview?: string
          onboarded?: boolean
          peso?: string | null
          sexo?: string | null
          status?: string
          telefone?: string | null
          tempo_acompanha?: string | null
        }
        Relationships: []
      }
      psych_checkins: {
        Row: {
          created_at: string
          id: string
          mood: number
          notes: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          stress: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood?: number
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          stress?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: number
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          stress?: number
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      specialist_ai_preferences: {
        Row: {
          created_at: string
          example_plans: Json | null
          exercise_preferences: string | null
          id: string
          knowledge_base_pdf_path: string | null
          notes: string | null
          periodization_style: string | null
          preferred_methods: string | null
          specialist_id: string
          system_prompt: string | null
          training_philosophy: string | null
          updated_at: string
          volume_preferences: string | null
        }
        Insert: {
          created_at?: string
          example_plans?: Json | null
          exercise_preferences?: string | null
          id?: string
          knowledge_base_pdf_path?: string | null
          notes?: string | null
          periodization_style?: string | null
          preferred_methods?: string | null
          specialist_id: string
          system_prompt?: string | null
          training_philosophy?: string | null
          updated_at?: string
          volume_preferences?: string | null
        }
        Update: {
          created_at?: string
          example_plans?: Json | null
          exercise_preferences?: string | null
          id?: string
          knowledge_base_pdf_path?: string | null
          notes?: string | null
          periodization_style?: string | null
          preferred_methods?: string | null
          specialist_id?: string
          system_prompt?: string | null
          training_philosophy?: string | null
          updated_at?: string
          volume_preferences?: string | null
        }
        Relationships: []
      }
      student_specialists: {
        Row: {
          created_at: string
          id: string
          specialist_id: string
          specialty: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          specialist_id: string
          specialty: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          specialist_id?: string
          specialty?: string
          student_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          active: boolean
          billing_type: string
          created_at: string
          description: string | null
          duration_months: number
          id: string
          max_installments: number
          name: string
          payment_method: string
          price: number
          specialist_limitation: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_type?: string
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          max_installments?: number
          name: string
          payment_method?: string
          price?: number
          specialist_limitation?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_type?: string
          created_at?: string
          description?: string | null
          duration_months?: number
          id?: string
          max_installments?: number
          name?: string
          payment_method?: string
          price?: number
          specialist_limitation?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_reason: string | null
          canceled_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          plan_price: number
          started_at: string
          status: string
          subscription_plan_id: string | null
          user_id: string
        }
        Insert: {
          cancel_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_price?: number
          started_at?: string
          status?: string
          subscription_plan_id?: string | null
          user_id: string
        }
        Update: {
          cancel_reason?: string | null
          canceled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_price?: number
          started_at?: string
          status?: string
          subscription_plan_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plan_versions: {
        Row: {
          avaliacao_postural: string | null
          groups: Json
          id: string
          objetivo_mesociclo: string | null
          plan_id: string
          pontos_melhoria: string | null
          saved_at: string
          specialist_id: string | null
          title: string
          total_sessions: number
          valid_until: string | null
          version_number: number
        }
        Insert: {
          avaliacao_postural?: string | null
          groups?: Json
          id?: string
          objetivo_mesociclo?: string | null
          plan_id: string
          pontos_melhoria?: string | null
          saved_at?: string
          specialist_id?: string | null
          title: string
          total_sessions?: number
          valid_until?: string | null
          version_number?: number
        }
        Update: {
          avaliacao_postural?: string | null
          groups?: Json
          id?: string
          objetivo_mesociclo?: string | null
          plan_id?: string
          pontos_melhoria?: string | null
          saved_at?: string
          specialist_id?: string | null
          title?: string
          total_sessions?: number
          valid_until?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "training_plan_versions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plans: {
        Row: {
          active: boolean
          avaliacao_postural: string | null
          created_at: string
          groups: Json
          id: string
          objetivo_mesociclo: string | null
          pontos_melhoria: string | null
          specialist_id: string | null
          title: string
          total_sessions: number
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          active?: boolean
          avaliacao_postural?: string | null
          created_at?: string
          groups?: Json
          id?: string
          objetivo_mesociclo?: string | null
          pontos_melhoria?: string | null
          specialist_id?: string | null
          title?: string
          total_sessions?: number
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          active?: boolean
          avaliacao_postural?: string | null
          created_at?: string
          groups?: Json
          id?: string
          objetivo_mesociclo?: string | null
          pontos_melhoria?: string | null
          specialist_id?: string | null
          title?: string
          total_sessions?: number
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      training_templates: {
        Row: {
          created_at: string
          description: string | null
          groups: Json
          id: string
          name: string
          specialist_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          groups?: Json
          id?: string
          name: string
          specialist_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          groups?: Json
          id?: string
          name?: string
          specialist_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      volume_limits: {
        Row: {
          id: string
          max_sets: number
          min_sets: number
          muscle_group: string
          specialist_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          max_sets?: number
          min_sets?: number
          muscle_group: string
          specialist_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          max_sets?: number
          min_sets?: number
          muscle_group?: string
          specialist_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          comment: string | null
          created_at: string
          duration_seconds: number | null
          effort_rating: number | null
          exercises: Json | null
          finished_at: string | null
          group_name: string | null
          id: string
          plan_id: string | null
          started_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          duration_seconds?: number | null
          effort_rating?: number | null
          exercises?: Json | null
          finished_at?: string | null
          group_name?: string | null
          id?: string
          plan_id?: string | null
          started_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          duration_seconds?: number | null
          effort_rating?: number | null
          exercises?: Json | null
          finished_at?: string | null
          group_name?: string | null
          id?: string
          plan_id?: string | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_last_messages: {
        Args: { conv_ids: string[] }
        Returns: {
          content: string
          conversation_id: string
          created_at: string
          sender_id: string
          type: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      match_documents: {
        Args: {
          filter_specialist_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      search_foods_unaccent: {
        Args: { max_results?: number; search_term: string }
        Returns: {
          calories: number
          carbs: number
          category: string
          created_at: string
          created_by: string | null
          fat: number
          fiber: number | null
          fonte: string | null
          id: string
          name: string
          original_name: string | null
          portion: string
          portion_amount: number | null
          portion_grams: number | null
          portion_unit: string | null
          protein: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "food_database"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "especialista"
        | "user"
        | "closer"
        | "cs"
        | "nutricionista"
        | "personal"
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
        "admin",
        "especialista",
        "user",
        "closer",
        "cs",
        "nutricionista",
        "personal",
      ],
    },
  },
} as const
