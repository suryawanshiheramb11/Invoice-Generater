"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Loader2, Upload, X } from "lucide-react";
import type { BusinessInfo } from "@/types/invoice";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { uploadLogo } from "@/services/storage";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/hooks/useUser";

interface Props {
  business: BusinessInfo;
  onChange: (patch: Partial<BusinessInfo>) => void;
}

export function BusinessSection({ business, onChange }: Props) {
  const { user } = useUser();
  const { show } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogoSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!user) {
      show("Sign in to upload a logo to cloud storage.", "info");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadLogo(file);
      onChange({ logoUrl: url });
      show("Logo uploaded.", "success");
    } catch (err) {
      show(err instanceof Error ? err.message : "Logo upload failed.", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {business.logoUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={business.logoUrl} alt="Business logo" className="h-16 w-16 rounded-lg border border-border object-contain" />
            <button
              type="button"
              onClick={() => onChange({ logoUrl: null })}
              aria-label="Remove logo"
              className="absolute -right-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border-strong text-muted">
            <Upload className="h-5 w-5" />
          </div>
        )}
        <div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoSelect} />
          <Button type="button" variant="outline" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Upload logo
          </Button>
          <p className="mt-1 text-xs text-muted">PNG, JPEG, WebP, or SVG. Max 2MB.</p>
        </div>
      </div>

      <Field label="Business / Company Name" required>
        <Input value={business.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Acme Digital Solutions" />
      </Field>

      <Field label="Address">
        <Input
          value={business.address.addressLine}
          onChange={(e) => onChange({ address: { ...business.address, addressLine: e.target.value } })}
          placeholder="Street address"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <Input value={business.address.city} onChange={(e) => onChange({ address: { ...business.address, city: e.target.value } })} />
        </Field>
        <Field label="State">
          <Input value={business.address.state} onChange={(e) => onChange({ address: { ...business.address, state: e.target.value } })} />
        </Field>
        <Field label="Country">
          <Input value={business.address.country} onChange={(e) => onChange({ address: { ...business.address, country: e.target.value } })} />
        </Field>
        <Field label="ZIP / PIN Code">
          <Input value={business.address.postalCode} onChange={(e) => onChange({ address: { ...business.address, postalCode: e.target.value } })} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <Input type="email" value={business.email} onChange={(e) => onChange({ email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input type="tel" value={business.phone} onChange={(e) => onChange({ phone: e.target.value })} />
        </Field>
      </div>

      <Field label="Website">
        <Input value={business.website} onChange={(e) => onChange({ website: e.target.value })} placeholder="www.example.com" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tax / GST / VAT Number">
          <Input value={business.taxNumber} onChange={(e) => onChange({ taxNumber: e.target.value })} />
        </Field>
        <Field label="Registration Number">
          <Input value={business.registrationNumber} onChange={(e) => onChange({ registrationNumber: e.target.value })} />
        </Field>
      </div>

      {uploading && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Loader2 className="h-3 w-3 animate-spin" /> Uploading logo…
        </p>
      )}
    </div>
  );
}
