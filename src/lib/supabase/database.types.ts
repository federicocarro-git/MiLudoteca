export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
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
      catalogo_usuario: {
        Row: {
          actualizado_en: string;
          agregado_en: string;
          juego_id: string;
          notas: string | null;
          puntuacion: number | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          actualizado_en?: string;
          agregado_en?: string;
          juego_id: string;
          notas?: string | null;
          puntuacion?: number | null;
          user_id?: string;
        };
        Update: {
          actualizado_en?: string;
          agregado_en?: string;
          juego_id?: string;
          notas?: string | null;
          puntuacion?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalogo_usuario_juego_id_fkey";
            columns: ["juego_id"];
            isOneToOne: false;
            referencedRelation: "juegos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalogo_usuario_juego_id_fkey";
            columns: ["juego_id"];
            isOneToOne: false;
            referencedRelation: "mi_catalogo";
            referencedColumns: ["id"];
          },
        ];
      };
      juegos: {
        Row: {
          actualizado_en: string;
          anio: number | null;
          bgg_id: number | null;
          bgg_sincronizado_en: string | null;
          complejidad: number | null;
          creado_en: string;
          creado_por: string | null;
          descripcion: string | null;
          duracion_min: number | null;
          id: string;
          imagen_url: string | null;
          jugadores_max: number | null;
          jugadores_min: number | null;
          nombre: string;
          origen: string;
          tipos: string[];
        };
        ComputedFields: never;
        Insert: {
          actualizado_en?: string;
          anio?: number | null;
          bgg_id?: number | null;
          bgg_sincronizado_en?: string | null;
          complejidad?: number | null;
          creado_en?: string;
          creado_por?: string | null;
          descripcion?: string | null;
          duracion_min?: number | null;
          id?: string;
          imagen_url?: string | null;
          jugadores_max?: number | null;
          jugadores_min?: number | null;
          nombre: string;
          origen: string;
          tipos?: string[];
        };
        Update: {
          actualizado_en?: string;
          anio?: number | null;
          bgg_id?: number | null;
          bgg_sincronizado_en?: string | null;
          complejidad?: number | null;
          creado_en?: string;
          creado_por?: string | null;
          descripcion?: string | null;
          duracion_min?: number | null;
          id?: string;
          imagen_url?: string | null;
          jugadores_max?: number | null;
          jugadores_min?: number | null;
          nombre?: string;
          origen?: string;
          tipos?: string[];
        };
        Relationships: [];
      };
      resumenes: {
        Row: {
          actualizado_en: string;
          autor_id: string;
          como_se_juega: string;
          creado_en: string;
          hoja_de_turno: string;
          id: string;
          juego_id: string;
        };
        ComputedFields: never;
        Insert: {
          actualizado_en?: string;
          autor_id?: string;
          como_se_juega?: string;
          creado_en?: string;
          hoja_de_turno?: string;
          id?: string;
          juego_id: string;
        };
        Update: {
          actualizado_en?: string;
          autor_id?: string;
          como_se_juega?: string;
          creado_en?: string;
          hoja_de_turno?: string;
          id?: string;
          juego_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resumenes_juego_id_fkey";
            columns: ["juego_id"];
            isOneToOne: false;
            referencedRelation: "juegos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resumenes_juego_id_fkey";
            columns: ["juego_id"];
            isOneToOne: false;
            referencedRelation: "mi_catalogo";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      mi_catalogo: {
        Row: {
          agregado_en: string | null;
          anio: number | null;
          bgg_id: number | null;
          complejidad: number | null;
          duracion_min: number | null;
          id: string | null;
          imagen_url: string | null;
          jugadores_max: number | null;
          jugadores_min: number | null;
          nombre: string | null;
          notas: string | null;
          origen: string | null;
          puntuacion: number | null;
          tipos: string[] | null;
        };
        ComputedFields: never;
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
