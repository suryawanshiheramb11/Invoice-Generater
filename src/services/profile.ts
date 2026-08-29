import { createClient } from "@/lib/supabase/client";
import type { BusinessInfo } from "@/types/invoice";
import { ServiceError } from "@/services/invoices";

export async function getBusinessProfile(): Promise<BusinessInfo | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new ServiceError(error.message);
  if (!data) return null;

  return {
    name: data.business_name,
    logoUrl: data.logo_url,
    address: {
      addressLine: data.address_line,
      city: data.city,
      state: data.state,
      country: data.country,
      postalCode: data.postal_code,
    },
    email: data.email,
    phone: data.phone,
    website: data.website,
    taxNumber: data.tax_number,
    registrationNumber: data.registration_number,
  };
}

export async function saveBusinessProfile(business: BusinessInfo): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ServiceError("You must be signed in to save your business profile.");

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      business_name: business.name,
      logo_url: business.logoUrl,
      address_line: business.address.addressLine,
      city: business.address.city,
      state: business.address.state,
      country: business.address.country,
      postal_code: business.address.postalCode,
      email: business.email,
      phone: business.phone,
      website: business.website,
      tax_number: business.taxNumber,
      registration_number: business.registrationNumber,
    },
    { onConflict: "user_id" }
  );
  if (error) throw new ServiceError(error.message);
}
