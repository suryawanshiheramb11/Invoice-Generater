import { createClient } from "@/lib/supabase/client";
import { ServiceError } from "@/services/invoices";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

/**
 * Uploads a business logo to Supabase Storage (bucket: "logos") under the
 * authenticated user's own folder, and returns its public URL.
 * Never touches the local filesystem — works identically in production.
 */
export async function uploadLogo(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ServiceError("Logo must be a PNG, JPEG, WebP, or SVG image.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new ServiceError("Logo must be smaller than 2MB.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ServiceError("You must be signed in to upload a logo.");

  const extension = file.name.split(".").pop() || "png";
  const path = `${user.id}/logo-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from("logos").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw new ServiceError(error.message);

  const { data } = supabase.storage.from("logos").getPublicUrl(path);
  return data.publicUrl;
}
