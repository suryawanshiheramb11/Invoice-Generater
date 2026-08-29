"use client";

import { useEffect, useState } from "react";
import type { CustomerInfo, CustomerRecord, ShippingInfo } from "@/types/invoice";
import { Field, Input, Select, Checkbox, Label } from "@/components/ui/Field";
import { listCustomers, customerToInfo } from "@/services/customers";
import { useUser } from "@/hooks/useUser";

interface Props {
  customer: CustomerInfo;
  shipping: ShippingInfo;
  onCustomerChange: (patch: Partial<CustomerInfo>) => void;
  onShippingChange: (patch: Partial<ShippingInfo>) => void;
}

export function CustomerSection({ customer, shipping, onCustomerChange, onShippingChange }: Props) {
  const { user } = useUser();
  const [saved, setSaved] = useState<CustomerRecord[]>([]);

  useEffect(() => {
    if (!user) return;
    listCustomers().then(setSaved).catch(() => {});
  }, [user]);

  function selectExisting(id: string) {
    const found = saved.find((c) => c.id === id);
    if (found) onCustomerChange(customerToInfo(found));
  }

  return (
    <div className="space-y-4">
      {user && saved.length > 0 && (
        <Field label="Select existing customer">
          <Select defaultValue="" onChange={(e) => e.target.value && selectExisting(e.target.value)}>
            <option value="">— New customer —</option>
            {saved.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.company ? `(${c.company})` : ""}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Customer Name" required>
        <Input value={customer.name} onChange={(e) => onCustomerChange({ name: e.target.value })} placeholder="John Smith" />
      </Field>
      <Field label="Company Name">
        <Input value={customer.company} onChange={(e) => onCustomerChange({ company: e.target.value })} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <Input type="email" value={customer.email} onChange={(e) => onCustomerChange({ email: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input type="tel" value={customer.phone} onChange={(e) => onCustomerChange({ phone: e.target.value })} />
        </Field>
      </div>

      <Field label="Address">
        <Input
          value={customer.address.addressLine}
          onChange={(e) => onCustomerChange({ address: { ...customer.address, addressLine: e.target.value } })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <Input value={customer.address.city} onChange={(e) => onCustomerChange({ address: { ...customer.address, city: e.target.value } })} />
        </Field>
        <Field label="State">
          <Input value={customer.address.state} onChange={(e) => onCustomerChange({ address: { ...customer.address, state: e.target.value } })} />
        </Field>
        <Field label="Country">
          <Input value={customer.address.country} onChange={(e) => onCustomerChange({ address: { ...customer.address, country: e.target.value } })} />
        </Field>
        <Field label="ZIP / PIN Code">
          <Input
            value={customer.address.postalCode}
            onChange={(e) => onCustomerChange({ address: { ...customer.address, postalCode: e.target.value } })}
          />
        </Field>
      </div>

      <Field label="Tax ID / GSTIN / VAT Number">
        <Input value={customer.taxId} onChange={(e) => onCustomerChange({ taxId: e.target.value })} />
      </Field>

      <div className="border-t border-border pt-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={shipping.sameAsBilling} onChange={(e) => onShippingChange({ sameAsBilling: e.target.checked })} />
          Shipping address is same as billing address
        </label>

        {!shipping.sameAsBilling && (
          <div className="mt-4 space-y-3">
            <Label>Shipping Address</Label>
            <Input
              placeholder="Street address"
              value={shipping.address.addressLine}
              onChange={(e) => onShippingChange({ address: { ...shipping.address, addressLine: e.target.value } })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="City"
                value={shipping.address.city}
                onChange={(e) => onShippingChange({ address: { ...shipping.address, city: e.target.value } })}
              />
              <Input
                placeholder="State"
                value={shipping.address.state}
                onChange={(e) => onShippingChange({ address: { ...shipping.address, state: e.target.value } })}
              />
              <Input
                placeholder="Country"
                value={shipping.address.country}
                onChange={(e) => onShippingChange({ address: { ...shipping.address, country: e.target.value } })}
              />
              <Input
                placeholder="ZIP / PIN Code"
                value={shipping.address.postalCode}
                onChange={(e) => onShippingChange({ address: { ...shipping.address, postalCode: e.target.value } })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
