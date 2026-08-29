import { createClient } from "@/lib/supabase/client";
import type { CustomerInfo, CustomerRecord } from "@/types/invoice";
import { ServiceError } from "@/services/invoices";

function rowToCustomer(row: {
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
}): CustomerRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    address: {
      addressLine: row.address_line,
      city: row.city,
      state: row.state,
      country: row.country,
      postalCode: row.postal_code,
    },
    taxId: row.tax_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function customerToInfo(customer: CustomerRecord): CustomerInfo {
  return {
    id: customer.id,
    name: customer.name,
    company: customer.company,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    taxId: customer.taxId,
  };
}

export async function listCustomers(): Promise<CustomerRecord[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("customers").select("*").order("name");
  if (error) throw new ServiceError(error.message);
  return (data ?? []).map(rowToCustomer);
}

export async function saveCustomer(
  customer: Partial<CustomerRecord> & { name: string }
): Promise<CustomerRecord> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ServiceError("You must be signed in to save customers.");

  const row = {
    ...(customer.id ? { id: customer.id } : {}),
    user_id: user.id,
    name: customer.name,
    company: customer.company ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    address_line: customer.address?.addressLine ?? "",
    city: customer.address?.city ?? "",
    state: customer.address?.state ?? "",
    country: customer.address?.country ?? "",
    postal_code: customer.address?.postalCode ?? "",
    tax_id: customer.taxId ?? "",
    notes: customer.notes ?? "",
  };

  const { data, error } = await supabase.from("customers").upsert(row).select().single();
  if (error) throw new ServiceError(error.message);
  return rowToCustomer(data);
}

export async function deleteCustomer(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw new ServiceError(error.message);
}
