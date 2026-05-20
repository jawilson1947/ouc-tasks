/**
 * ApprovalBadge — visual indicator of a task's approval state.
 *
 *   ✅  approved (approved_at is not null)
 *   ⏳  awaiting approval (approved_at is null)
 *
 * Emoji icons match the style of the sidebar nav entries
 * (see src/components/Sidebar.tsx). If the design team later prefers
 * inline SVGs (Heroicons), swap the emoji for the SVG without changing
 * the call-site API.
 *
 * Pure server-safe — no client hooks.
 */
export function ApprovalBadge({
  approved,
  size = 'sm',
  showLabel = false,
}: {
  approved: boolean;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}) {
  const dim = size === 'md' ? 'text-[15px]' : 'text-[13px]';
  if (approved) {
    return (
      <span
        title="Approved — work may begin"
        className={`inline-flex items-center gap-1 ${dim} text-green-600`}
      >
        <span aria-hidden>✅</span>
        {showLabel && <span className="text-[11.5px] font-semibold">Approved</span>}
        <span className="sr-only">Approved</span>
      </span>
    );
  }
  return (
    <span
      title="Awaiting approval"
      className={`inline-flex items-center gap-1 ${dim} text-amber-600`}
    >
      <span aria-hidden>⏳</span>
      {showLabel && <span className="text-[11.5px] font-semibold">Unapproved</span>}
      <span className="sr-only">Awaiting approval</span>
    </span>
  );
}
