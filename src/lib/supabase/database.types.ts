export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          business_name: string;
          logo_url: string | null;
          address_line: string;
          city: string;
          state: string;
          country: string;
          postal_code: string;
          email: string;
          phone: string;
          website: string;
          tax_number: string;
          registration_number: string;
          invoice_sequence: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          company: string;
          email: string;
          phone: string;
          address_line: string;
          city: string;
          state: string;
          country: string;
          postal_code: string;
          tax_id: string;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["customers"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["customers"]["Row"]>;
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          invoice_number: string;
          customer_id: string | null;
          invoice_date: string;
          due_date: string;
          currency: string;
          status: string;
          subtotal: number;
          discount: number;
          tax: number;
          shipping: number;
          other_charges: number;
          total: number;
          template: string;
          invoice_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["invoices"]["Row"]> & {
          user_id: string;
          invoice_number: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_items: {
        Row: {
          id: string;
          invoice_id: string;
          description: string;
          quantity: number;
          rate: number;
          tax_rate: number;
          discount: number;
          amount: number;
        };
        Insert: Partial<Database["public"]["Tables"]["invoice_items"]["Row"]> & { invoice_id: string };
        Update: Partial<Database["public"]["Tables"]["invoice_items"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_pdf_exports: {
        Row: {
          id: string;
          invoice_id: string;
          user_id: string;
          storage_path: string;
          share_token: string;
          created_at: string;
          expires_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["invoice_pdf_exports"]["Row"]> & {
          invoice_id: string;
          user_id: string;
          storage_path: string;
          expires_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoice_pdf_exports"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "invoice_pdf_exports_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_payment_proofs: {
        Row: {
          id: string;
          invoice_id: string;
          storage_path: string | null;
          method: string;
          note: string;
          submitted_at: string;
          recorded_by: string;
          ai_status: string;
          ai_notes: string;
          ai_checked_at: string | null;
          owner_status: string;
          owner_reviewed_at: string | null;
          high_priority: boolean;
          amount: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["invoice_payment_proofs"]["Row"]> & {
          invoice_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoice_payment_proofs"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "invoice_payment_proofs_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      next_invoice_number: {
        Args: { p_user_id: string };
        Returns: string;
      };
      cleanup_expired_pdf_exports: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      get_pdf_export_by_token: {
        Args: { p_token: string };
        Returns: {
          storage_path: string;
          invoice_number: string;
          business_name: string | null;
          invoice_id: string;
          invoice_status: string;
        }[];
      };
      submit_payment_proof: {
        Args: {
          p_invoice_id: string;
          p_storage_path: string;
          p_method: string;
          p_note?: string;
          p_partial?: boolean;
          p_amount?: number | null;
        };
        Returns: string;
      };
      get_public_invoice_summary: {
        Args: { p_invoice_id: string };
        Returns: {
          invoice_number: string;
          business_name: string | null;
          customer_name: string | null;
          status: string;
          total: number;
          currency: string;
          due_date: string;
          show_payment_info: boolean;
          payment_instructions: string | null;
          payment_info: Record<string, unknown> | null;
          paid_amount: number;
        }[];
      };
    };
  };
}
