import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { RuleForm } from "../rule-form";

export default function NewAutomationRulePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="New follow-up rule"
        description="Compose WHEN → IF → THEN. The backend evaluates rules as events arrive."
        actions={
          <Button variant="outline" asChild>
            <Link href="/automation/rules">
              <ArrowLeft className="size-4" />
              Back to rules
            </Link>
          </Button>
        }
      />
      <RuleForm />
    </div>
  );
}
