/**
 * High-level "task done" helper — fans out one email per approver/admin
 * recipient when a task's status is changed to "Done".
 *
 * Mirrors sendApprovalRequestEmail.ts: each recipient is mailed individually
 * (no BCC) so the To: header is informative and the greeting is personalised.
 *
 * Returns aggregate counts so the calling server action can decide whether
 * to surface an amber "email notification failed" suffix on the redirect.
 */
import { sendEmail } from './sendgrid';
import { renderTaskDone } from './templates/taskDone';

export type TaskDoneRecipient = {
  email: string;
  /** Full name as stored on user_profile — used to derive the greeting. */
  fullName: string | null;
};

export type SendTaskDoneEmailResult = {
  attempted: number;
  okCount: number;
  failCount: number;
  /** True if at least one delivery attempt failed. */
  anyFailed: boolean;
};

function firstNameOf(fullName: string | null): string | undefined {
  if (!fullName) return undefined;
  const trimmed = fullName.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
}

export async function sendTaskDoneEmail(args: {
  recipients: TaskDoneRecipient[];
  taskTitle: string;
  taskLegacyId: number | null;
  completedByName: string;
}): Promise<SendTaskDoneEmailResult> {
  let okCount = 0;
  let failCount = 0;

  for (const r of args.recipients) {
    const payload = renderTaskDone({
      taskTitle: args.taskTitle,
      taskLegacyId: args.taskLegacyId,
      approverFirstName: firstNameOf(r.fullName),
      completedByName: args.completedByName,
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
        `[email] task-done notification failed for ${r.email}:`,
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
