/**
 * Email template — an editor (or admin/approver) has clicked the
 * "Request Approval" button on a task's edit page, asking the approver pool
 * to review and approve the task so work may begin.
 *
 * Recipient: one approver (or admin) at a time — sendApprovalRequestEmail.ts
 * loops over the recipient list and renders this template once per send so
 * the greeting reflects each individual approver's first name.
 *
 * The body intentionally restates that approving permits work to begin and
 * does NOT change the task's status — mirrors the language in taskApproved.ts.
 */
import { approvalUrl, escapeHtml, htmlShell } from './shared';

export function renderTaskApprovalRequested(args: {
  taskTitle: string;
  taskLegacyId: number | null;
  requesterName: string;
  approverFirstName?: string;
  assigneeFullName: string | null;
  assigneeEmail: string | null;
  /** Pre-formatted USD string, e.g. "$1,250.00". */
  plannedBudget: string;
}): { subject: string; html: string; text: string } {
  const idTag = args.taskLegacyId != null ? ` (#${args.taskLegacyId})` : '';
  const subject = `Approval requested: "${args.taskTitle}"${idTag}`;
  const link = approvalUrl(args.taskLegacyId);
  const greeting = args.approverFirstName ? `Hi ${args.approverFirstName},` : 'Hello,';

  const assigneeLabel = args.assigneeFullName
    ? args.assigneeEmail
      ? `${args.assigneeFullName} (${args.assigneeEmail})`
      : args.assigneeFullName
    : 'Unassigned';

  const idForBody = args.taskLegacyId != null ? `#${args.taskLegacyId} — ` : '';

  const text = [
    `${greeting}`,
    ``,
    `${args.requesterName} has requested your approval for the following task:`,
    ``,
    `${idForBody}${args.taskTitle}`,
    ``,
    `  • Assignee: ${assigneeLabel}`,
    `  • Planned budget: ${args.plannedBudget}`,
    ``,
    link ? `Review this task: ${link}` : `Open OUC Tasks to review the task.`,
    ``,
    `The task's status has not changed; approval is permission to begin work.`,
    ``,
    `— OUC Tasks`,
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 12px;">
      <strong>${escapeHtml(args.requesterName)}</strong> has requested your approval for the following task:
    </p>
    <p style="margin:0 0 12px;font-size:15px;">
      ${args.taskLegacyId != null ? `<span style="color:#6B7480;">#${args.taskLegacyId} — </span>` : ''}<strong>${escapeHtml(args.taskTitle)}</strong>
    </p>
    <ul style="margin:0 0 12px 18px;padding:0;">
      <li style="margin:0 0 4px;"><strong>Assignee:</strong> ${escapeHtml(assigneeLabel)}</li>
      <li style="margin:0 0 4px;"><strong>Planned budget:</strong> ${escapeHtml(args.plannedBudget)}</li>
    </ul>
    ${
      link
        ? `<p style="margin:18px 0;"><a href="${link}" style="display:inline-block;background:#333F48;color:#ffffff;text-decoration:none;padding:9px 16px;border-radius:6px;font-weight:600;">Review this task</a></p>`
        : ''
    }
    <p style="margin:0 0 12px;color:#6B7480;">
      The task's status has not changed; approval is permission to begin work.
    </p>
    <p style="margin:0;color:#6B7480;">— OUC Tasks</p>
  `;

  return { subject, html: htmlShell({ title: subject, bodyHtml }), text };
}
