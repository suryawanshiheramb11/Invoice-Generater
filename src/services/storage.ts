import { createClient } from "@/lib/supabase/client";
import { ServiceError } from "@/services/invoices";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
// SVG is deliberately absent: the logos bucket is public, so an uploaded .svg would be
// served as active content straight from the Supabase origin (SVG can carry <script>).
// Logos only ever render through <img>, where scripts don't run, so nothing needs it.
// The bucket's own allowed_mime_types enforces the same list server-side (migration 0011).
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
// Filenames come from the user's disk; the extension ends up inside a storage path, so
// keep it to something that can't introduce a path separator or traversal.
const SAFE_EXTENSION = /^[A-Za-z0-9]{1,10}$/;

/**
 * Uploads a business logo to Supabase Storage (bucket: "logos") under the
 * authenticated user's own folder, and returns its public URL.
 * Never touches the local filesystem — works identically in production.
 */
export async function uploadLogo(file: File): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ServiceError("Logo must be a PNG, JPEG, or WebP image.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new ServiceError("Logo must be smaller than 2MB.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ServiceError("You must be signed in to upload a logo.");

  const rawExtension = file.name.split(".").pop() ?? "";
  const extension = SAFE_EXTENSION.test(rawExtension) ? rawExtension : "png";
  const path = `${user.id}/logo-${Date.now()}.${extension}`;

  // upsert is intentionally omitted: the path is already unique (Date.now()-based),
  // so there's never a real conflict to resolve, and Supabase Storage's upsert=true
  // path fails its own RLS insert check even for brand-new, non-conflicting objects.
  const { error } = await supabase.storage.from("logos").upload(path, file, {
    contentType: file.type,
  });
  if (error) throw new ServiceError(error.message);

  const { data } = supabase.storage.from("logos").getPublicUrl(path);
  return data.publicUrl;
}
