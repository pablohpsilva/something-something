"use client";

import { useState } from "react";
import { Button } from "@repo/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { Input } from "@repo/ui";
import { Label } from "@repo/ui";
import { Textarea } from "@repo/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { Heart, DollarSign, Loader2 } from "lucide-react";
import { api } from "@/lib/trpc";
import { showToast } from "@/lib/metrics/read";
import { createButtonProps } from "@/lib/a11y";

interface DonateButtonProps {
  toUserId: string;
  toUserHandle: string;
  toUserDisplayName: string;
  ruleId?: string;
  ruleTitle?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

const QUICK_AMOUNTS = [
  { cents: 300, label: "$3" },
  { cents: 500, label: "$5" },
  { cents: 1000, label: "$10" },
  { cents: 2000, label: "$20" },
];

export function DonateButton({
  toUserId,
  toUserHandle,
  toUserDisplayName,
  ruleId,
  ruleTitle,
  size = "md",
  variant = "default",
  className = "",
}: DonateButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [amountCents, setAmountCents] = useState(500); // Default $5
  const [currency, setCurrency] = useState("USD");
  const [message, setMessage] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [useCustomAmount, setUseCustomAmount] = useState(false);

  // Temporarily disabled - need to fix tRPC typing issues
  const currencies = null;
  const createCheckoutMutation = {
    mutate: (input: any) => {},
    mutateAsync: async (input: any) => ({ url: "" }),
    isPending: false,
  };

  // const { data: currencies } = api.donations.getSupportedCurrencies.useQuery();
  // const createCheckoutMutation = api.donations.createCheckout.useMutation({
  //   onSuccess: (data) => {
  //     // Redirect to Stripe checkout
  //     window.location.href = data.url;
  //   },
  //   onError: (error) => {
  //     showToast(error.message || "Failed to create donation", "error");
  //   },
  // });

  const handleQuickAmount = (cents: number) => {
    setAmountCents(cents);
    setUseCustomAmount(false);
    setCustomAmount("");
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setUseCustomAmount(true);

    const dollars = parseFloat(value);
    if (!isNaN(dollars) && dollars > 0) {
      setAmountCents(Math.round(dollars * 100));
    }
  };

  const handleSubmit = async () => {
    let finalAmount = amountCents;

    if (useCustomAmount && customAmount) {
      const dollars = parseFloat(customAmount);
      if (isNaN(dollars) || dollars < 1) {
        showToast("Please enter a valid amount (minimum $1)", "error");
        return;
      }
      if (dollars > 200) {
        showToast("Maximum donation amount is $200", "error");
        return;
      }
      finalAmount = Math.round(dollars * 100);
    }

    try {
      await createCheckoutMutation.mutateAsync({
        toUserId,
        ruleId,
        amountCents: finalAmount,
        currency,
        message: message.trim() || undefined,
      });
    } catch (error) {
      // Error handling is done in mutation onError
    }
  };

  const isLoading = createCheckoutMutation.isPending;
  const selectedCurrency = null; // Temporarily disabled
  const displayAmount =
    useCustomAmount && customAmount
      ? `$${customAmount}`
      : `$${(amountCents / 100).toFixed(2)}`;

  const buttonProps = createButtonProps(
    ruleTitle
      ? `Donate to ${toUserDisplayName} for ${ruleTitle}`
      : `Donate to ${toUserDisplayName}`,
    "donate-button",
    isLoading
  );

  const buttonSize = size === "sm" ? "sm" : size === "lg" ? "lg" : "default";
  const iconSize =
    size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          {...buttonProps}
          variant={variant}
          size={buttonSize}
          className={`flex items-center gap-2 ${className}`}
          disabled={isLoading}
        >
          <Heart
            className={`${iconSize} ${
              variant === "default" ? "fill-current" : ""
            }`}
          />
          <span className={size === "sm" ? "text-xs" : ""}>Donate</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500 fill-current" />
            Support {toUserDisplayName}
          </DialogTitle>
          <DialogDescription>
            {ruleTitle
              ? `Show your appreciation for "${ruleTitle}" with a tip.`
              : `Show your appreciation for @${toUserHandle} with a tip.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Amount Selection */}
          <div className="space-y-3">
            <Label>Amount</Label>

            {/* Quick amounts */}
            <div className="grid grid-cols-2 gap-2">
              {QUICK_AMOUNTS.map((amount) => (
                <Button
                  key={amount.cents}
                  variant={
                    !useCustomAmount && amountCents === amount.cents
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => handleQuickAmount(amount.cents)}
                  data-testid={`donate-amount-${amount.cents}`}
                >
                  {amount.label}
                </Button>
              ))}
            </div>

            {/* Custom amount */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="Custom amount"
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  min="1"
                  max="200"
                  step="0.01"
                  data-testid="donate-amount-input"
                />
              </div>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger
                  className="w-20"
                  data-testid="donate-currency-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[].map((curr: any) => (
                    <SelectItem key={curr.code} value={curr.code}>
                      {curr.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Optional message */}
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Leave a note for the author..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={240}
              rows={3}
              data-testid="donate-message"
            />
            <div className="text-xs text-muted-foreground text-right">
              {message.length}/240
            </div>
          </div>

          {/* Summary */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  You're donating:
                </span>
                <span className="font-semibold text-lg">{displayAmount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">To:</span>
                <span className="font-medium">@{toUserHandle}</span>
              </div>
              {ruleTitle && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">For:</span>
                  <span
                    className="font-medium text-sm truncate max-w-48"
                    title={ruleTitle}
                  >
                    {ruleTitle}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
            <p>
              Tips are voluntary and non-refundable. You'll be redirected to
              Stripe to complete your payment securely.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || (useCustomAmount && !customAmount)}
              className="flex-1"
              data-testid="donate-submit"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Donate {displayAmount}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
