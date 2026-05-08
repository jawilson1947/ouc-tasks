/**
 * Visual style helpers for task-related rendering — kept in one place
 * so badge colors, priority backgrounds, and status pills stay consistent
 * across dashboard, tasks list, task detail, board, and reports.
 */

export const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked:     'Blocked',
  done:        'Done',
};

export const STATUS_ORDER = ['not_started', 'in_progress', 'blocked', 'done'] as const;

export const STATUS_COLOR: Record<string, string> = {
  not_started: 'text-status-not',
  in_progress: 'text-status-prog',
  blocked:     'text-status-blocked',
  done:        'text-status-done',
};

export const STATUS_DOT: Record<string, string> = {
  not_started: 'bg-status-not',
  in_progress: 'bg-status-prog',
  blocked:     'bg-status-blocked',
  done:        'bg-status-done',
};

export const STATUS_PILL: Record<string, string> = {
  not_started: 'bg-status-not/12 text-status-not',
  in_progress: 'bg-status-prog/12 text-status-prog',
  blocked:     'bg-status-blocked/12 text-status-blocked',
  done:        'bg-status-done/12 text-status-done',
};

export const PRIORITY_BG: Record<number, string> = {
  5: 'bg-[#1F2830] text-white',
  4: 'bg-[#424E58] text-white',
  3: 'bg-[#6B7480] text-white',
  2: 'bg-[#9BA1A8] text-white',
  1: 'bg-[#C5C9CE] text-ouc-text',
};

export const PRIORITY_DESC: Record<number, string> = {
  5: 'P5 — Highest',
  4: 'P4 — High',
  3: 'P3 — Medium',
  2: 'P2 — Low',
  1: 'P1 — Lowest',
};

export function categoryBadgeClass(name: string | null | undefined): string {
  if (!name) return 'bg-ouc-surface-alt text-ouc-text-muted';
  if (name.startsWith('Surveillance'))     return 'bg-cat-surveillance/12 text-cat-surveillance';
  if (name.startsWith('Access'))           return 'bg-cat-access/12 text-cat-access';
  if (name.startsWith('AV'))               return 'bg-cat-av/12 text-cat-av';
  if (name.startsWith('Cabling'))          return 'bg-cat-cabling/15 text-amber-700';
  if (name.startsWith('Maintenance'))      return 'bg-cat-maintenance/12 text-cat-maintenance';
  return 'bg-ouc-surface-alt text-ouc-text-muted';
}
