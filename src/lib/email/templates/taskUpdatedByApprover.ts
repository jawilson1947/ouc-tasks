/**
 * Email template — an approver edited the task. Includes a bulleted diff of
 * the fields that actually changed.
 */
import { escapeHtml, htmlShell, taskUrl } from './shared';

export type FieldChange = { from: unknown; to: unknown };

function formatValue(v: unknown): string {
  if (v == null || v === '') return '—';
  return String(v);
}

export function renderTaskUpdatedByApprover(args: {
  taskTitle: string;
  taskLegacyId: number | null;
  approverName: string;
  changes: Record<string, FieldChange>;
  assigneeFirstName?: string;
}): { subject: string; html: string; text: string } {
  const subject = `📝 Your task "${args.taskTitle}" was updated by ${args.approverName}`;
  const link = taskUrl(args.taskLegacyId);
  const greeting = args.assigneeFirstName ? `Hi ${args.assigneeFirstName},` : 'Hello,';
  const entries = Object.entries(args.changes);

  const textLines = [
    `${greeting}`,
    ``,
    `${args.approverName} updated the task "${args.taskTitle}".`,
    ``,
    entries.length === 0 ? 'No field-level changes recorded.' : 'Changes:',
    ...entries.map(
      ([field, { from, to }]) => `  • ${field}: ${formatValue(from)} → ${formatValue(to)}`
    ),
    ``,
    link ? `View the task: ${link}` : `Open OUC Tasks to see the details.`,
    ``,
    `— OUC Tasks`,
  ];

  const bodyHtml = `
    <p style="margin:0 0 12px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 12px;">
      <strong>${escapeHtml(args.approverName)}</strong> updated the task
      <strong>"${escapeHtml(args.taskTitle)}"</strong>.
    </p>
    ${
      entries.length === 0
        ? `<p style="margin:0 0 12px;color:#6B7480;">No field-level changes recorded.</p>`
        : `
      <p style="margin:0 0 6px;font-weight:600;">Changes</p>
      <ul style="margin:0 0 12px 18px;padding:0;">
        ${entries
          .map(
            ([field, { from, to }]) => `
          <li style="margin:0 0 4px;">
            <code style="background:#F4F6F8;padding:1px 4px;border-radius:3px;font-size:12.5px;">${escapeHtml(field)}</code>:
            <span style="color:#6B7480;text-decoration:line-through;">${escapeHtml(formatValue(from))}</span>
            →
            <span style="font-weight:600;">${escapeHtml(formatValue(to))}</span>
          </li>`
          )
          .join('')}
      </ul>`
    }
    ${
      link
        ? `<p style="margin:18px 0;"><a href="${link}" style="display:inline-block;background:#333F48;color:#ffffff;text-decoration:none;padding:9px 16px;border-radius:6px;font-weight:600;">Open task</a></p>`
        : ''
    }
    <p style="margin:0;color:#6B7480;">— OUC Tasks</p>
  `;

  return { subject, html: htmlShell({ title: subject, bodyHtml }), text: textLines.join('\n') };
}
