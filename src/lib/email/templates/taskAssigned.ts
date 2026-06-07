/**
 * Email template — a task has been assigned to a user (new task creation).
 *
 * Recipient: the user selected in the Assignee field at task creation time.
 * Rendered once (single recipient), so the greeting uses the assignee's first name.
 *
 * The CTA links to the task detail page so the assignee can view full context.
 */
import { escapeHtml, htmlShell, taskUrl } from './shared';

export function renderTaskAssigned(args: {
  taskTitle: string;
  taskLegacyId: number | null;
  /** First name of the assignee — used in the greeting. */
  assigneeFirstName?: string;
  /** Optional due date string (ISO or pre-formatted). Shown in the body when present. */
  dueDate?: string | null;
  /** Priority 1–5 — shown as "P{n}" in the body when present. */
  priority?: number | null;
}): { subject: string; html: string; text: string } {
  const idTag = args.taskLegacyId != null ? ` (#${args.taskLegacyId})` : '';
  const subject = `You've been assigned a task: "${args.taskTitle}"${idTag}`;
  const link = taskUrl(args.taskLegacyId);
  const greeting = args.assigneeFirstName ? `Hi ${args.assigneeFirstName},` : 'Hello,';
  const idForBody = args.taskLegacyId != null ? `#${args.taskLegacyId} — ` : '';
  const dueLine = args.dueDate ? `\nDue: ${args.dueDate}` : '';
  const priorityLine = args.priority != null ? `\nPriority: P${args.priority}` : '';

  const text = [
    `${greeting}`,
    ``,
    `You have been assigned the following task in OUC Tasks:`,
    ``,
    `${idForBody}${args.taskTitle}${priorityLine}${dueLine}`,
    ``,
    link ? `View task: ${link}` : `Open OUC Tasks to view the task.`,
    ``,
    `— OUC Tasks`,
  ].join('\n');

  const metaLines: string[] = [];
  if (args.priority != null) {
    metaLines.push(
      `<span style="display:inline-block;margin-right:12px;"><strong>Priority:</strong> P${args.priority}</span>`
    );
  }
  if (args.dueDate) {
    metaLines.push(
      `<span style="display:inline-block;"><strong>Due:</strong> ${escapeHtml(args.dueDate)}</span>`
    );
  }
  const metaHtml = metaLines.length
    ? `<p style="margin:0 0 12px;font-size:13px;color:#5C6773;">${metaLines.join('')}</p>`
    : '';

  const bodyHtml = `
    <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 12px;">
      You have been assigned the following task in <strong>OUC Tasks</strong>:
    </p>
    <p style="margin:0 0 8px;font-size:15px;">
      ${args.taskLegacyId != null ? `<span style="color:#6B7480;">#${args.taskLegacyId} — </span>` : ''}<strong>${escapeHtml(args.taskTitle)}</strong>
    </p>
    ${metaHtml}
    ${
      link
        ? `<p style="margin:18px 0;"><a href="${link}" style="display:inline-block;background:#333F48;color:#ffffff;text-decoration:none;padding:9px 16px;border-radius:6px;font-weight:600;">View task</a></p>`
        : ''
    }
    <p style="margin:0;color:#6B7480;">— OUC Tasks</p>
  `;

  return { subject, html: htmlShell({ title: subject, bodyHtml }), text };
}
