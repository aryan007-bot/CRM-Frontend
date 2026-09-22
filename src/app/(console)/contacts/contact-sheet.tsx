"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, ShieldX } from "lucide-react";
import { ContactStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatCurrency, formatRelative } from "@/lib/format";
import type { Contact, ContactStatus } from "@/lib/types";

const STATUSES: { value: ContactStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "promised_to_pay", label: "Promised to pay" },
  { value: "payment_arranged", label: "Payment arranged" },
  { value: "callback", label: "Callback" },
  { value: "disputed", label: "Disputed" },
  { value: "do_not_call", label: "Do not call" },
  { value: "closed", label: "Closed" },
];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export function ContactSheet({
  contactId,
  open,
  onOpenChange,
  onSaved,
}: {
  contactId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ContactStatus>("new");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !contactId) return;
    let cancelled = false;
    void (async () => {
      try {
        const c = await api.getContact(contactId);
        if (cancelled) return;
        setContact(c);
        setNotes(c.notes);
        setStatus(c.status);
      } catch {
        if (!cancelled) setContact(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, contactId]);

  async function handleSave() {
    if (!contact) return;
    setSaving(true);
    try {
      await api.updateContact(contact.id, { notes, status });
      toast.success("Contact updated.");
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Could not save the contact.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {!contact ? (
          <div className="space-y-3 p-6">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                {contact.firstName} {contact.lastName}
                <ContactStatusBadge status={contact.status} />
              </SheetTitle>
              <SheetDescription className="font-mono text-xs">
                {contact.accountRef}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 pb-8">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Phone" value={contact.phone} />
                <Field label="Email" value={contact.email} />
                <Field label="Balance due" value={formatCurrency(contact.balanceDue)} />
                <Field label="Debt age" value={`${contact.debtAgeDays} days`} />
                <Field label="Timezone" value={contact.timezone} />
                <Field
                  label="Last contacted"
                  value={formatRelative(contact.lastContactedAt)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {contact.tcpaConsent ? (
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-transparent bg-emerald-600/15 text-emerald-700 dark:text-emerald-400"
                  >
                    <ShieldCheck className="size-3" /> TCPA consent
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-transparent bg-red-600/15 text-red-700 dark:text-red-400"
                  >
                    <ShieldX className="size-3" /> No TCPA consent
                  </Badge>
                )}
                {contact.fdcpaEligible ? (
                  <Badge
                    variant="outline"
                    className="border-transparent bg-secondary text-secondary-foreground"
                  >
                    FDCPA eligible
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-transparent bg-secondary text-muted-foreground"
                  >
                    FDCPA exempt
                  </Badge>
                )}
              </div>

              <Separator />

              <div className="space-y-1.5">
                <Label htmlFor="contact-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as ContactStatus)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-notes">Agent notes</Label>
                <Textarea
                  id="contact-notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything the next agent should know…"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
