/**
 * Accessibility utilities and helpers
 */

/**
 * Generate accessible label for screen readers
 */
export function generateAriaLabel(
  action: string,
  target: string,
  context?: string
): string {
  const parts = [action, target];
  if (context) parts.push(context);
  return parts.join(" ");
}

/**
 * Create accessible button props for actions
 */
export function createButtonProps(
  label: string,
  testId: string,
  disabled = false
) {
  return {
    "aria-label": label,
    "data-testid": testId,
    disabled,
    "aria-disabled": disabled,
  };
}

/**
 * Create accessible link props
 */
export function createLinkProps(label: string, testId: string, href: string) {
  return {
    "aria-label": label,
    "data-testid": testId,
    href,
  };
}

/**
 * Create accessible form field props
 */
export function createFieldProps(
  id: string,
  label: string,
  testId: string,
  required = false,
  error?: string
) {
  return {
    id,
    "aria-label": label,
    "data-testid": testId,
    required,
    "aria-required": required,
    "aria-invalid": !!error,
    "aria-describedby": error ? `${id}-error` : undefined,
  };
}

/**
 * Create accessible list props
 */
export function createListProps(label: string, testId: string) {
  return {
    role: "list",
    "aria-label": label,
    "data-testid": testId,
  };
}

/**
 * Create accessible list item props
 */
export function createListItemProps(testId: string, index?: number) {
  return {
    role: "listitem",
    "data-testid": testId,
    "aria-posinset": index !== undefined ? index + 1 : undefined,
  };
}

/**
 * Create accessible tab props
 */
export function createTabProps(
  id: string,
  label: string,
  testId: string,
  selected = false,
  controls?: string
) {
  return {
    id,
    role: "tab",
    "aria-label": label,
    "data-testid": testId,
    "aria-selected": selected,
    "aria-controls": controls,
    tabIndex: selected ? 0 : -1,
  };
}

/**
 * Create accessible tab panel props
 */
export function createTabPanelProps(
  id: string,
  label: string,
  testId: string,
  labelledBy?: string
) {
  return {
    id,
    role: "tabpanel",
    "aria-label": label,
    "data-testid": testId,
    "aria-labelledby": labelledBy,
    tabIndex: 0,
  };
}

/**
 * Create accessible dialog props
 */
export function createDialogProps(
  id: string,
  title: string,
  testId: string,
  describedBy?: string
) {
  return {
    id,
    role: "dialog",
    "aria-modal": true,
    "aria-labelledby": `${id}-title`,
    "aria-describedby": describedBy,
    "data-testid": testId,
  };
}

/**
 * Create accessible status/live region props
 */
export function createStatusProps(
  message: string,
  testId: string,
  polite = true
) {
  return {
    role: "status",
    "aria-live": polite ? "polite" : "assertive",
    "aria-atomic": true,
    "data-testid": testId,
    children: message,
  };
}

/**
 * Create accessible metric props
 */
export function createMetricProps(
  label: string,
  value: string | number,
  testId: string
) {
  return {
    "aria-label": `${label}: ${value}`,
    "data-testid": testId,
    title: `${label}: ${value}`,
  };
}

/**
 * Create accessible vote button props
 */
export function createVoteProps(
  type: "up" | "down",
  testId: string,
  active = false,
  count?: number
) {
  const action = active ? "Remove" : "Add";
  const direction = type === "up" ? "upvote" : "downvote";
  const countText = count !== undefined ? ` (${count})` : "";

  return {
    "aria-label": `${action} ${direction}${countText}`,
    "data-testid": testId,
    "aria-pressed": active,
  };
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(
  message: string,
  priority: "polite" | "assertive" = "polite"
) {
  const announcement = document.createElement("div");
  announcement.setAttribute("aria-live", priority);
  announcement.setAttribute("aria-atomic", "true");
  announcement.className = "sr-only";
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
}

/**
 * Focus management utilities
 */
export const focus = {
  /**
   * Focus element by selector
   */
  element(selector: string) {
    const element = document.querySelector(selector) as HTMLElement;
    element?.focus();
  },

  /**
   * Focus first focusable element in container
   */
  firstIn(container: HTMLElement) {
    const focusable = container.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement;
    focusable?.focus();
  },

  /**
   * Trap focus within container
   */
  trap(container: HTMLElement) {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener("keydown", handleTabKey);
    firstElement?.focus();

    return () => container.removeEventListener("keydown", handleTabKey);
  },
};

/**
 * Create props for vote buttons with accessibility
 * @param voteType Type of vote (up/down)
 * @param testId Test ID for the button
 * @param isActive Whether the vote is currently active
 * @param count Vote count for this type
 * @returns Button props with accessibility attributes
 */
export function createVoteButtonProps(
  voteType: "up" | "down",
  testId: string,
  isActive: boolean,
  count: number
): {
  "data-testid": string;
  "aria-label": string;
  "aria-pressed": boolean;
} {
  const action = isActive ? "Remove" : "Add";
  const voteLabel = voteType === "up" ? "upvote" : "downvote";
  const countLabel = count > 0 ? ` (${count} ${voteType}votes)` : "";

  return {
    "data-testid": testId,
    "aria-label": `${action} ${voteLabel}${countLabel}`,
    "aria-pressed": isActive,
  };
}
