/**
 * Email template — task was approved. Approval is permission to begin work;
 * status was NOT changed by the approval action itself.
 */
import { escapeHtml, htmlShell, taskUrl } from './shared';

export function renderTaskApproved(args: {
  taskTitle: string;
  taskLegacyId: number | null;
  approverName: string;
  assigneeFirstName?: string;
}): { subject: string; html: string; text: string } {
  const subject = `✅ Your task "${args.taskTitle}" was approved — you may begin work`;
  const link = taskUrl(args.taskLegacyId);
  const greeting = args.assigneeFirstName ? `Hi ${args.assigneeFirstName},` : 'Hello,';

  const text = [
    `${greeting}`,
    ``,
    `${args.approverName} has approved the task "${args.taskTitle}".`,
    `You may now begin work on it. The task's status has not been changed automatically — update it yourself as work progresses.`,
    ``,
    link ? `View the task: ${link}` : `Open OUC Tasks to see the details.`,
    ``,
    `— OUC Tasks`,
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 12px;">
      <strong>${escapeHtml(args.approverName)}</strong> has approved the task
      <strong>"${escapeHtml(args.taskTitle)}"</strong>.
    </p>
    <p style="margin:0 0 12px;">
      You may now begin work on it. The task's status has not been changed
      automatically — please update it yourself as work progresses.
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
