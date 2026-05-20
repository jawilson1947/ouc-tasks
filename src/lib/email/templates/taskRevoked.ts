/**
 * Email template — approval was revoked. Only possible when status is still
 * 'not_started', so the message tells the assignee NOT to begin work.
 */
import { escapeHtml, htmlShell, taskUrl } from './shared';

export function renderTaskRevoked(args: {
  taskTitle: string;
  taskLegacyId: number | null;
  approverName: string;
  assigneeFirstName?: string;
}): { subject: string; html: string; text: string } {
  const subject = `⏸️ Approval revoked for "${args.taskTitle}" — please do not begin work`;
  const link = taskUrl(args.taskLegacyId);
  const greeting = args.assigneeFirstName ? `Hi ${args.assigneeFirstName},` : 'Hello,';

  const text = [
    `${greeting}`,
    ``,
    `${args.approverName} has revoked approval for the task "${args.taskTitle}".`,
    `Please do not begin work on this task until it is re-approved.`,
    ``,
    link ? `View the task: ${link}` : `Open OUC Tasks to see the details.`,
    ``,
    `— OUC Tasks`,
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 12px;">
      <strong>${escapeHtml(args.approverName)}</strong> has revoked approval for the task
      <strong>"${escapeHtml(args.taskTitle)}"</strong>.
    </p>
    <p style="margin:0 0 12px;">
      Please do not begin work on this task until it is re-approved.
    </p>
    ${
      link
        ? `<p style="margin:18px 0;"><a href="${link}" style="display:inline-block;background:#333F48;color:#ffffff;text-decoration:none;padding:9px 16px;border-radius:6px;font-weight:600;">Open task</a></p>`
        : ''
    }
    <p style="margin:0;color:#6B7480;">— OUC Tasks</p>
  `;

  return { subject, html: htmlShell({ title: subject, bodyHtml }), text };
}
