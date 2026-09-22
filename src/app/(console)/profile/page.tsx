"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell";
import { ErrorState } from "@/components/page-states";
import { RoleBadge } from "@/components/status-badges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Profile } from "@/lib/types";

function ProfileForm({ profile, onSaved }: { profile: Profile; onSaved: () => void }) {
  const { refresh } = useAuth();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (!name.trim()) {
      setError("Name cannot be empty.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.updateProfile({ name: name.trim(), email: email.trim() });
      toast.success("Profile updated.");
      onSaved();
      // Keep the header/menu in sync with the new name and email.
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update your profile.");
    } finally {
      setSaving(false);
    }
  }

  const dirty = name !== profile.name || email !== profile.email;

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your email is your sign-in identity and must be unique across the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Organization</p>
              <p className="text-sm font-medium">{profile.organization_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Role</p>
              <RoleBadge role={profile.role} />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardContent>
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}

export default function ProfilePage() {
  const profile = useApi(() => api.getProfile(), []);
  const data = profile.data;

  if (profile.loading && !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState message={profile.error ?? "Profile unavailable."} onRetry={profile.refresh} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Profile"
        description="Your own account details. Roles and permissions are managed by your administrator."
      />
      <ProfileForm profile={data} onSaved={profile.refresh} />
    </div>
  );
}
