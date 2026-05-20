/**
 * Shared template helpers — tiny utilities reused across approval emails.
 */

/** Resolve the app base URL for deep links. Falls back to localhost in dev. */
export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

/** Cheap HTML escape — strings are already trusted (task titles, names) but
 *  this guards against accidental tag injection from typo'd titles. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Wrap a body string in a minimal HTML doc with OUC brand styling. */
export function htmlShell(args: { title: string; bodyHtml: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(args.title)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1F2830;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;border:1px solid #E2E5E9;overflow:hidden;">
        <tr><td style="background:#333F48;color:#ffffff;padding:14px 20px;font-size:13px;font-weight:600;letter-spacing:1px;">
          OUC TASKS
        </td></tr>
        <tr><td style="padding:20px;font-size:14px;line-height:1.55;">
          ${args.bodyHtml}
        </td></tr>
        <tr><td style="padding:14px 20px;background:#F4F6F8;color:#6B7480;font-size:11.5px;border-top:1px solid #E2E5E9;">
          tasks.oucsda.org · automated notification
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Deep link to a task by legacy id. Returns `null` if legacy id is missing. */
export function taskUrl(legacyId: number | null): string | null {
  if (legacyId == null) return null;
  return `${appUrl()}/tasks/${legacyId}`;
}
