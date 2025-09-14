"use client";

import { useState } from "react";
import { api } from "@/lib/trpc";
import { Button } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui";
import { Textarea } from "@/components/ui";
import { Label } from "@/components/ui";
import { toast } from "sonner";
import { FileText, AlertCircle } from "lucide-react";

interface ClaimAuthorshipDialogProps {
  ruleId: string;
  ruleTitle: string;
  currentAuthor: {
    displayName: string;
    handle: string;
  };
  trigger?: React.ReactNode;
}

export function ClaimAuthorshipDialog({
  ruleId,
  ruleTitle,
  currentAuthor,
  trigger,
}: ClaimAuthorshipDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [evidence, setEvidence] = useState("");

  const submitClaimMutation = api.claims.submit.useMutation({
    onSuccess: () => {
      toast.success(
        "Claim submitted successfully. It will be reviewed by our team."
      );
      setIsOpen(false);
      setEvidence("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = async () => {
    if (!evidence.trim()) {
      toast.error("Please provide evidence for your claim");
      return;
    }

    await submitClaimMutation.mutateAsync({
      ruleId,
      evidence: evidence.trim(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FileText className="mr-2 h-4 w-4" />
            Claim Authorship
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Claim Authorship</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">About Author Claims</p>
                <p>
                  If you believe you are the original author of this content,
                  you can submit a claim. Our team will review your evidence and
                  make a determination.
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-600">Rule</Label>
            <p className="text-lg font-medium">{ruleTitle}</p>
            <p className="text-sm text-gray-600">
              Currently attributed to: {currentAuthor.displayName} (@
              {currentAuthor.handle})
            </p>
          </div>

          <div>
            <Label htmlFor="evidence">Evidence of Authorship *</Label>
            <Textarea
              id="evidence"
              placeholder="Please provide evidence that you are the original author of this content. This could include:
              
• Links to your original publication (blog, GitHub, etc.)
• Screenshots of your work
• Timestamps showing when you created this content
• Any other relevant proof of authorship

Be as detailed as possible to help our review team."
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              className="mt-1 min-h-[200px]"
            />
            <p className="mt-1 text-xs text-gray-500">
              {evidence.length}/2000 characters
            </p>
          </div>

          <div className="rounded-lg bg-yellow-50 p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Important Notes</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>False claims may result in account restrictions</li>
                  <li>
                    Claims are reviewed manually and may take several days
                  </li>
                  <li>You will be notified of the decision via email</li>
                  <li>
                    Approved claims will transfer authorship of the rule to you
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleSubmit}
              disabled={submitClaimMutation.isPending || !evidence.trim()}
            >
              {submitClaimMutation.isPending ? "Submitting..." : "Submit Claim"}
            </Button>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
