/**
 * High-level "send approval notification" helper. Picks the right template
 * based on the `kind` argument and forwards to the SendGrid wrapper.
 *
 * Server actions call this once per write. We never await a result that
 * could block the caller — email is best-effort. On failure we log to the
 * server console and the caller redirects with ?emailFailed=1 so the
 * approver knows.
 */
import { sendEmail } from './sendgrid';
import { renderTaskApproved } from './templates/taskApproved';
import { renderTaskRevoked } from './templates/taskRevoked';
import {
  renderTaskUpdatedByApprover,
  type FieldChange,
} from './templates/taskUpdatedByApprover';
import { renderTaskDeletedByApprover } from './templates/taskDeletedByApprover';

export type ApprovalEmailKind = 'approved' | 'revoked' | 'updated' | 'deleted';

export type SendApprovalEmailResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendApprovalEmail(args: {
  kind: ApprovalEmailKind;
  to: string | null;
  taskTitle: string;
  taskLegacyId: number | null;
  approverName: string;
  assigneeFirstName?: string;
  changes?: Record<string, FieldChange>;
}): Promise<SendApprovalEmailResult> {
  if (!args.to) {
    // Task has no assignee — nothing to notify. Treat as success so the caller
    // doesn't surface a misleading "email failed" flash.
    return { ok: true };
  }

  let payload: { subject: string; html: string; text: string };
  switch (args.kind) {
    case 'approved':
      payload = renderTaskApproved({
        taskTitle: args.taskTitle,
        taskLegacyId: args.taskLegacyId,
        approverName: args.approverName,
        assigneeFirstName: args.assigneeFirstName,
      });
      break;
    case 'revoked':
      payload = renderTaskRevoked({
        taskTitle: args.taskTitle,
        taskLegacyId: args.taskLegacyId,
        approverName: args.approverName,
        assigneeFirstName: args.assigneeFirstName,
      });
      break;
    case 'updated':
      payload = renderTaskUpdatedByApprover({
        taskTitle: args.taskTitle,
        taskLegacyId: args.taskLegacyId,
        approverName: args.approverName,
        assigneeFirstName: args.assigneeFirstName,
        changes: args.changes ?? {},
      });
      break;
    case 'deleted':
      payload = renderTaskDeletedByApprover({
        taskTitle: args.taskTitle,
        approverName: args.approverName,
        assigneeFirstName: args.assigneeFirstName,
      });
      break;
  }

  const result = await sendEmail({
    to: args.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
  if (!result.ok) {
    console.error('[email] approval notification failed:', result.error);
  }
  return result;
}
