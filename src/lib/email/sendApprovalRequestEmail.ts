/**
 * High-level "request approval" helper — fans out one email per approver
 * recipient. Parallel to sendApprovalEmail.ts, but distinct because the
 * recipient model is one-to-many (approvers + admins), not one-to-one
 * (assignee).
 *
 * Each recipient is mailed individually (no BCC) for symmetry with the
 * existing approval-flow emails — easier to debug, keeps the To: header
 * informative, mirrors `sendApprovalEmail.ts`.
 *
 * Returns aggregate counts so the calling server action can decide whether
 * to surface the amber "email notification failed" suffix on the redirect.
 */
import { sendEmail } from './sendgrid';
import { renderTaskApprovalRequested } from './templates/taskApprovalRequested';

export type ApprovalRequestRecipient = {
  email: string;
  /** Full name as stored on user_profile. Used to derive the greeting. */
  fullName: string | null;
};

export type SendApprovalRequestEmailResult = {
  attempted: number;
  okCount: number;
  failCount: number;
  /** True if at least one delivery attempt failed. Mirrors the `?emailFailed=1`
   *  contract from sendApprovalEmail callers. */
  anyFailed: boolean;
};

function firstNameOf(fullName: string | null): string | undefined {
  if (!fullName) return undefined;
  const trimmed = fullName.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
}

export async function sendApprovalRequestEmail(args: {
  recipients: ApprovalRequestRecipient[];
  taskTitle: string;
  taskLegacyId: number | null;
  requesterName: string;
  assigneeFullName: string | null;
  assigneeEmail: string | null;
  /** Pre-formatted USD string, e.g. "$1,250.00". */
  plannedBudget: string;
}): Promise<SendApprovalRequestEmailResult> {
  let okCount = 0;
  let failCount = 0;

  for (const r of args.recipients) {
    const payload = renderTaskApprovalRequested({
      taskTitle: args.taskTitle,
      taskLegacyId: args.taskLegacyId,
      requesterName: args.requesterName,
      approverFirstName: firstNameOf(r.fullName),
      assigneeFullName: args.assigneeFullName,
      assigneeEmail: args.assigneeEmail,
      plannedBudget: args.plannedBudget,
    });

    const result = await sendEmail({
      to: r.email,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    if (result.ok) {
      okCount += 1;
    } else {
      failCount += 1;
      console.error(
        `[email] approval-request notification failed for ${r.email}:`,
        result.error
      );
    }
  }

  return {
    attempted: args.recipients.length,
    okCount,
    failCount,
    anyFailed: failCount > 0,
  };
}
