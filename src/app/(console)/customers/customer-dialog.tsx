"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import type { Customer, CustomerPhoneInput } from "@/lib/types";

interface PhoneDraft {
  phone: string;
  phone_type: string;
  is_primary: boolean;
}

const EMPTY_PHONE: PhoneDraft = { phone: "", phone_type: "mobile", is_primary: false };

function initialPhones(customer: Customer | null): PhoneDraft[] {
  if (!customer || customer.phones.length === 0) {
    return [{ ...EMPTY_PHONE, is_primary: true }];
  }
  return customer.phones.map((phone) => ({
    phone: phone.phone,
    phone_type: phone.phone_type,
    is_primary: phone.is_primary,
  }));
}

/**
 * Mounted only while the dialog is open, so state initialised from `customer`
 * is fresh on every open — no reset effect required.
 */
function CustomerForm({
  customer,
  onOpenChange,
  onSaved,
}: {
  customer: Customer | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(customer);
  const [name, setName] = useState(customer?.name ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [status, setStatus] = useState(customer?.status ?? "active");
  const [phones, setPhones] = useState<PhoneDraft[]>(() => initialPhones(customer));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePhone(index: number, patch: Partial<PhoneDraft>) {
    setPhones((current) =>
      current.map((phone, i) => (i === index ? { ...phone, ...patch } : phone)),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (!name.trim()) {
      setError("Customer name is required.");
      return;
    }

    const cleanedPhones: CustomerPhoneInput[] = phones
      .map((phone) => ({
        phone: phone.phone.trim(),
        phone_type: phone.phone_type,
        is_primary: phone.is_primary,
      }))
      .filter((phone) => phone.phone.length > 0);

    setSaving(true);
    setError(null);

    try {
      if (customer) {
        // The update endpoint does not manage phone numbers.
        await api.updateCustomer(customer.id, {
          name: name.trim(),
          email: email.trim() ? email.trim() : null,
          status,
        });
        toast.success("Customer updated.");
      } else {
        await api.createCustomer({
          name: name.trim(),
          email: email.trim() ? email.trim() : null,
          status,
          phones: cleanedPhones.length ? cleanedPhones : undefined,
        });
        toast.success("Customer created.");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4" id="customer-form">
        <div className="space-y-1.5">
          <Label htmlFor="customer-name">Name</Label>
          <Input
            id="customer-name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Rajesh Sharma"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="customer-email">Email</Label>
          <Input
            id="customer-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="rajesh@example.com"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="customer-status">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="customer-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Phone numbers</Label>
            {!isEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPhones((current) => [...current, { ...EMPTY_PHONE }])}
              >
                <Plus className="size-3.5" />
                Add phone
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            {phones.map((phone, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={phone.phone}
                  onChange={(event) => updatePhone(index, { phone: event.target.value })}
                  placeholder="98765 43210"
                  disabled={isEdit}
                  aria-label={`Phone number ${index + 1}`}
                />
                <Select
                  value={phone.phone_type}
                  onValueChange={(value) => updatePhone(index, { phone_type: value })}
                  disabled={isEdit}
                >
                  <SelectTrigger className="w-28" aria-label={`Phone type ${index + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mobile">Mobile</SelectItem>
                    <SelectItem value="home">Home</SelectItem>
                    <SelectItem value="work">Work</SelectItem>
                  </SelectContent>
                </Select>
                {!isEdit && phones.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove phone ${index + 1}`}
                    onClick={() => setPhones((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </form>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" form="customer-form" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : null}
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create customer"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CustomerDialog({
  open,
  onOpenChange,
  customer = null,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set the dialog edits this customer; otherwise it creates one. */
  customer?: Customer | null;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>
            {customer
              ? "Phone numbers are managed through imports and are shown read-only here."
              : "Phone numbers are normalized to Indian E.164 format on the server."}
          </DialogDescription>
        </DialogHeader>
        <CustomerForm
          customer={customer}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}
