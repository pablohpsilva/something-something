/**
 * Central constants for data-testid attributes
 * Following kebab-case convention
 */

// Navigation
export const NAV_TESTIDS = {
  LINK_RULES: "nav-link-rules",
  LINK_SUBMIT: "nav-link-submit",
  LINK_LEADERBOARDS: "nav-link-leaderboards",
  LINK_AUTHORS: "nav-link-authors",
  LINK_NOTIFICATIONS: "nav-link-notifications",
  LINK_CLAIMS: "nav-link-claims",
} as const;

// Authentication
export const AUTH_TESTIDS = {
  SIGN_IN_BUTTON: "auth-sign-in-button",
  USER_MENU_BUTTON: "auth-user-menu-button",
  SIGN_OUT_BUTTON: "auth-sign-out-button",
} as const;

// Search
export const SEARCH_TESTIDS = {
  GLOBAL_INPUT: "global-search-input",
  GLOBAL_SUBMIT: "global-search-submit",
  GLOBAL_CLEAR: "global-search-clear",
} as const;

// Rules
export const RULE_TESTIDS = {
  CARD: "rule-card",
  COPY_BUTTON: "rule-copy-button",
  SAVE_BUTTON: "rule-save-button",
  FORK_BUTTON: "rule-fork-button",
  WATCH_BUTTON: "rule-watch-button",
  VOTE_UP: "vote-up",
  VOTE_DOWN: "vote-down",
  VOTE_SCORE: "vote-score",
  SHARE_BUTTON: "rule-share-button",
} as const;

// Metrics
export const METRICS_TESTIDS = {
  VIEWS: "metrics-views",
  COPIES: "metrics-copies",
  SAVES: "metrics-saves",
  FORKS: "metrics-forks",
  VOTES: "metrics-votes",
  SCORE: "metrics-score",
} as const;

// Comments
export const COMMENT_TESTIDS = {
  FORM: "comment-form",
  SUBMIT: "comment-submit",
  ITEM: "comment-item",
  REPLY_BUTTON: "comment-reply-button",
  EDIT_BUTTON: "comment-edit-button",
  DELETE_BUTTON: "comment-delete-button",
} as const;

// Authors
export const AUTHOR_TESTIDS = {
  CARD: "author-card",
  FOLLOW_BUTTON: "follow-button",
  DONATE_BUTTON: "donate-button",
  PROFILE_LINK: "author-profile-link",
} as const;

// Filters
export const FILTER_TESTIDS = {
  SEARCH_INPUT: "rules-filter-search-input",
  TAG: "rules-filter-tag",
  MODEL: "rules-filter-model",
  STATUS: "rules-filter-status",
  SORT_SELECT: "rules-sort-select",
  CLEAR_FILTERS: "rules-clear-filters",
} as const;

// Lists
export const LIST_TESTIDS = {
  LOAD_MORE: "rules-load-more",
  EMPTY_STATE: "rules-empty-state",
  LOADING_SKELETON: "rules-loading-skeleton",
} as const;

// Forms
export const FORM_TESTIDS = {
  SUBMIT_RULE: "submit-rule-form",
  IMPORT_URL: "import-url-form",
  TITLE_INPUT: "form-title-input",
  SUMMARY_INPUT: "form-summary-input",
  BODY_INPUT: "form-body-input",
  TAGS_INPUT: "form-tags-input",
  SUBMIT_BUTTON: "form-submit-button",
  CANCEL_BUTTON: "form-cancel-button",
} as const;

// Notifications
export const NOTIFICATION_TESTIDS = {
  BELL: "notifications-bell",
  BADGE: "notifications-badge",
  ITEM: "notification-item",
  MARK_READ: "notification-mark-read",
  MARK_ALL_READ: "notification-mark-all-read",
} as const;

// Leaderboards
export const LEADERBOARD_TESTIDS = {
  TABLE: "leaderboard-table",
  TAB_DAILY: "leaderboard-tab-daily",
  TAB_WEEKLY: "leaderboard-tab-weekly",
  TAB_MONTHLY: "leaderboard-tab-monthly",
  TAB_ALL: "leaderboard-tab-all",
  SCOPE_GLOBAL: "leaderboard-scope-global",
  SCOPE_TAG: "leaderboard-scope-tag",
  SCOPE_MODEL: "leaderboard-scope-model",
} as const;

// Versions
export const VERSION_TESTIDS = {
  LIST: "version-list",
  ITEM: "version-item",
  DIFF: "version-diff",
  CREATE_BUTTON: "version-create-button",
  FORK_BUTTON: "version-fork-button",
} as const;

// Claims
export const CLAIM_TESTIDS = {
  FORM: "claim-form",
  SUBMIT_BUTTON: "claim-submit-button",
  EVIDENCE_INPUT: "claim-evidence-input",
  LIST: "claim-list",
  ITEM: "claim-item",
} as const;

// Theme
export const THEME_TESTIDS = {
  TOGGLE: "theme-toggle",
  LIGHT: "theme-light",
  DARK: "theme-dark",
  SYSTEM: "theme-system",
} as const;

// Notifications
export const NOTIFICATIONS_TESTIDS = {
  BELL: "notifications-bell",
  LIST: "notifications-list",
  ITEM: "notification-item",
  MARK_READ: "notification-mark-read",
  MARK_ALL: "notification-mark-all",
  LOAD_MORE: "notifications-load-more",
  DELETE: "notification-delete",
} as const;

export const SEARCH_TESTIDS = {
  INPUT: "global-search-input",
  SUBMIT: "global-search-submit",
  CLEAR: "global-search-clear",
  SUGGEST_ITEM: "global-search-suggest-item",
  RECENT_ITEM: "global-search-recent-item",
  QUERY_ITEM: "global-search-query-item",
  RESULTS: "rules-search-results",
  RESULT_ITEM: "rules-result-item",
  EMPTY_STATE: "rules-empty-state",
  FILTER_TAG: "rules-filter-tag",
  FILTER_MODEL: "rules-filter-model",
  FILTER_STATUS: "rules-filter-status",
  FILTER_CONTENT_TYPE: "rules-filter-content-type",
} as const;
