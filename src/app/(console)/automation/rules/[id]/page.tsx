"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ErrorState, PageSkeleton } from "@/components/page-states";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api";
import { RuleForm } from "../rule-form";

export default function AutomationRuleDetailPage() {
  const params = useParams<{ id: string }>();
  const ruleId = params?.id;

  const rule = useApi(ruleId ? () => api.getAutomationRule(ruleId) : null, [ruleId]);

  if (rule.loading && !rule.data) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageSkeleton />
      </div>
    );
  }

  if (!rule.data) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState message={rule.error ?? "Rule not found."} onRetry={rule.refresh} />
        <div className="mt-4 text-center">
          <Button variant="outline" asChild>
            <Link href="/automation/rules">Back to rules</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`Edit · ${rule.data.name}`}
        description="Changes apply to future executions only; already-scheduled actions are unaffected."
        actions={
          <Button variant="outline" asChild>
            <Link href="/automation/rules">
              <ArrowLeft className="size-4" />
              Back to rules
            </Link>
          </Button>
        }
      />
      <RuleForm rule={rule.data} />
    </div>
  );
}
