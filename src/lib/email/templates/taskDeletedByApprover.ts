/**
 * Email template — an approver deleted the task. No deep link (the row is gone).
 */
import { escapeHtml, htmlShell } from './shared';

export function renderTaskDeletedByApprover(args: {
  taskTitle: string;
  approverName: string;
  assigneeFirstName?: string;
}): { subject: string; html: string; text: string } {
  const subject = `🗑 Your task "${args.taskTitle}" was removed by ${args.approverName}`;
  const greeting = args.assigneeFirstName ? `Hi ${args.assigneeFirstName},` : 'Hello,';

  const text = [
    `${greeting}`,
    ``,
    `${args.approverName} has deleted the task "${args.taskTitle}".`,
    `It no longer appears in OUC Tasks. If you have questions, please reach out to the approver directly.`,
    ``,
    `— OUC Tasks`,
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 12px;">
      <strong>${escapeHtml(args.approverName)}</strong> has deleted the task
      <strong>"${escapeHtml(args.taskTitle)}"</strong>.
    </p>
    <p style="margin:0 0 12px;">
      It no longer appears in OUC Tasks. If you have questions, please reach out
      to the approver directly.
    </p>
    <p style="margin:0;color:#6B7480;">— OUC Tasks</p>
  `;

  return { subject, html: htmlShell({ title: subject, bodyHtml }), text };
}
