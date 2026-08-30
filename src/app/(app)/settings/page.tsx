"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import type { BusinessInfo } from "@/types/invoice";
import { getBusinessProfile, saveBusinessProfile } from "@/services/profile";
import { emptyAddress } from "@/lib/defaults";
import { BusinessSection } from "@/components/invoice/BusinessSection";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { friendlyErrorMessage } from "@/lib/errors";
import { avatarColor, initialsOf } from "@/lib/avatar";

const EMPTY_BUSINESS: BusinessInfo = {
  name: "",
  logoUrl: null,
  address: emptyAddress(),
  email: "",
  phone: "",
  website: "",
  taxNumber: "",
  registrationNumber: "",
};

export default function SettingsPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { show } = useToast();
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace("/login?redirect=/settings");
      return;
    }
    getBusinessProfile()
      .then((profile) => setBusiness(profile ?? EMPTY_BUSINESS))
      .catch(() => setBusiness(EMPTY_BUSINESS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading]);

  async function handleSave() {
    if (!business) return;
    setSaving(true);
    try {
      await saveBusinessProfile(business);
      show("Business profile saved.", "success");
    } catch (err) {
      show(friendlyErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  if (userLoading || !user || !business) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8 lg:px-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Settings</h1>
      <p className="mt-1.5 text-sm text-muted">This information is saved to your account and pre-fills new invoices.</p>

      <Card className="mt-7 p-5">
        <div className="flex items-center gap-3.5">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-display text-base font-bold text-white"
            style={{ background: avatarColor(user.email ?? "?") }}
          >
            {initialsOf((user.email ?? "?").split("@")[0])}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-foreground">{business.name || "Your account"}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
          </div>
        </div>
      </Card>

      <p className="mb-2 mt-7 text-xs font-bold uppercase tracking-wide text-muted-soft">Business</p>
      <Card>
        <CardContent className="p-6">
          <BusinessSection business={business} onChange={(patch) => setBusiness({ ...business, ...patch })} />
          <div className="mt-5 flex justify-end border-t border-border pt-4">
            <Button onClick={handleSave} loading={saving}>
              <Save className="h-4 w-4" /> Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
