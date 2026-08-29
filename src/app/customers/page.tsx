"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useUser } from "@/hooks/useUser";
import type { CustomerRecord } from "@/types/invoice";
import { deleteCustomer, listCustomers, saveCustomer } from "@/services/customers";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { emptyAddress } from "@/lib/defaults";

const EMPTY_FORM = {
  id: undefined as string | undefined,
  name: "",
  company: "",
  email: "",
  phone: "",
  address: emptyAddress(),
  taxId: "",
  notes: "",
};

export default function CustomersPage() {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const { show } = useToast();
  const [customers, setCustomers] = useState<CustomerRecord[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CustomerRecord | null>(null);

  function load() {
    listCustomers()
      .then(setCustomers)
      .catch((err) => show(err instanceof Error ? err.message : "Failed to load customers.", "error"));
  }

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace("/login?redirect=/customers");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userLoading]);

  function openNew() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(customer: CustomerRecord) {
    setForm({
      id: customer.id,
      name: customer.name,
      company: customer.company,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      taxId: customer.taxId,
      notes: customer.notes,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      show("Customer name is required.", "error");
      return;
    }
    setSaving(true);
    try {
      await saveCustomer(form);
      setModalOpen(false);
      show("Customer saved.", "success");
      load();
    } catch (err) {
      show(err instanceof Error ? err.message : "Failed to save customer.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteCustomer(confirmDelete.id);
      show("Customer deleted.", "success");
      setConfirmDelete(null);
      load();
    } catch (err) {
      show(err instanceof Error ? err.message : "Failed to delete customer.", "error");
    }
  }

  if (userLoading || !user || customers === null) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Customers</h1>
          <p className="text-sm text-muted">Save customers once, reuse them on every invoice.</p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Add Customer
        </Button>
      </div>

      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface px-6 py-20 text-center">
          <Users className="h-10 w-10 text-muted" />
          <h2 className="mt-4 text-base font-semibold">No customers yet</h2>
          <p className="mt-1 text-sm text-muted">Add a customer to reuse their details on future invoices.</p>
          <Button className="mt-5" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Add Customer
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{c.name}</p>
                  {c.company && <p className="text-xs text-muted">{c.company}</p>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} aria-label="Edit customer" className="rounded-md p-1.5 text-muted hover:bg-black/[0.05] hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(c)}
                    aria-label="Delete customer"
                    className="rounded-md p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 space-y-0.5 text-xs text-muted">
                {c.email && <p>{c.email}</p>}
                {c.phone && <p>{c.phone}</p>}
                {c.address.city && <p>{[c.address.city, c.address.country].filter(Boolean).join(", ")}</p>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Edit Customer" : "Add Customer"}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Name" required>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Company">
            <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Address">
            <Input
              value={form.address.addressLine}
              onChange={(e) => setForm({ ...form, address: { ...form.address, addressLine: e.target.value } })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="City" value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} />
            <Input placeholder="State" value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value } })} />
            <Input
              placeholder="Country"
              value={form.address.country}
              onChange={(e) => setForm({ ...form, address: { ...form.address, country: e.target.value } })}
            />
            <Input
              placeholder="ZIP / PIN Code"
              value={form.address.postalCode}
              onChange={(e) => setForm({ ...form, address: { ...form.address, postalCode: e.target.value } })}
            />
          </div>
          <Field label="Tax ID">
            <Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
          </Field>
          <Field label="Notes">
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save Customer
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete customer?">
        <p className="text-sm text-muted">
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong>?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
