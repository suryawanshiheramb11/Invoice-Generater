"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import type { BusinessInfo } from "@/types/invoice";
import { getBusinessProfile, saveBusinessProfile } from "@/services/profile";
import { emptyAddress } from "@/lib/defaults";
import { BusinessSection } from "@/components/invoice/BusinessSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { friendlyErrorMessage } from "@/lib/errors";

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
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted">This information is saved to your account and pre-fills new invoices.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Business</CardTitle>
        </CardHeader>
        <CardContent>
          <BusinessSection business={business} onChange={(patch) => setBusiness({ ...business, ...patch })} />
          <div className="mt-5 flex justify-end border-t border-border pt-4">
            <Button onClick={handleSave} loading={saving}>
              <Save className="h-3.5 w-3.5" /> Save Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted">
            Signed in as <strong className="text-foreground">{user.email}</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
