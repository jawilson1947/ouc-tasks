/**
 * Email template — a task's status has been changed to "Done".
 *
 * Recipient: every active admin and approver (fan-out via sendTaskDoneEmail.ts).
 * Rendered once per recipient so the greeting uses each person's first name.
 *
 * The CTA links to the task detail page (not /approvals) — there is nothing
 * to approve at this point; the email is purely informational.
 */
import { escapeHtml, htmlShell, taskUrl } from './shared';

export function renderTaskDone(args: {
  taskTitle: string;
  taskLegacyId: number | null;
  /** First name of the approver receiving this email — used in the greeting. */
  approverFirstName?: string;
  /** Full name of the user who changed the status to Done. */
  completedByName: string;
}): { subject: string; html: string; text: string } {
  const idTag = args.taskLegacyId != null ? ` (#${args.taskLegacyId})` : '';
  const subject = `Task completed: "${args.taskTitle}"${idTag}`;
  const link = taskUrl(args.taskLegacyId);
  const greeting = args.approverFirstName ? `Hi ${args.approverFirstName},` : 'Hello,';
  const idForBody = args.taskLegacyId != null ? `#${args.taskLegacyId} — ` : '';

  const text = [
    `${greeting}`,
    ``,
    `${args.completedByName} has marked the following task as Done:`,
    ``,
    `${idForBody}${args.taskTitle}`,
    ``,
    link ? `View task: ${link}` : `Open OUC Tasks to view the task.`,
    ``,
    `— OUC Tasks`,
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 12px;">
      <strong>${escapeHtml(args.completedByName)}</strong> has marked the following task as <strong>Done</strong>:
    </p>
    <p style="margin:0 0 12px;font-size:15px;">
      ${args.taskLegacyId != null ? `<span style="color:#6B7480;">#${args.taskLegacyId} — </span>` : ''}<strong>${escapeHtml(args.taskTitle)}</strong>
    </p>
    ${
      link
        ? `<p style="margin:18px 0;"><a href="${link}" style="display:inline-block;background:#333F48;color:#ffffff;text-decoration:none;padding:9px 16px;border-radius:6px;font-weight:600;">View task</a></p>`
        : ''
    }
    <p style="margin:0;color:#6B7480;">— OUC Tasks</p>
  `;

  return { subject, html: htmlShell({ title: subject, bodyHtml }), text };
}
