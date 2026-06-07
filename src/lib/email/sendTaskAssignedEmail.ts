/**
 * High-level assignment notification helpers.
 *
 * sendTaskAssignedEmail — fires when a new task is created with an assignee.
 * sendTaskUpdatedEmail  — fires when an existing task is saved and the editor
 *                         chooses "Yes" in the send-notification dialog.
 *
 * Both are best-effort: the DB write has already committed before these are
 * called. They are invoked fire-and-forget (.catch()) by the server action so
 * a delivery failure never blocks the user's redirect.
 */
import { sendEmail } from './sendgrid';
import { renderTaskAssigned } from './templates/taskAssigned';
import { renderTaskUpdated } from './templates/taskUpdated';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function firstNameOf(fullName: string | null | undefined): string | undefined {
  if (!fullName) return undefined;
  const trimmed = fullName.trim();
  if (!trimmed) return undefined;
  return trimmed.split(/\s+/)[0];
}

export type AssigneeNotifyArgs = {
  assigneeEmail: string;
  assigneeName: string | null;
  taskTitle: string;
  taskLegacyId: number | null;
  dueDate?: string | null;
  priority?: number | null;
};

export type AssigneeNotifyResult =
  | { ok: true }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// New task assigned
// ---------------------------------------------------------------------------

/**
 * Send a "you've been assigned a task" notification to a single assignee.
 * Called by createTask after a successful insert.
 */
export async function sendTaskAssignedEmail(
  args: AssigneeNotifyArgs
): Promise<AssigneeNotifyResult> {
  const payload = renderTaskAssigned({
    taskTitle: args.taskTitle,
    taskLegacyId: args.taskLegacyId,
    assigneeFirstName: firstNameOf(args.assigneeName),
    dueDate: args.dueDate,
    priority: args.priority,
  });

  const result = await sendEmail({
    to: args.assigneeEmail,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  if (!result.ok) {
    console.error(
      `[email] task-assigned notification failed for ${args.assigneeEmail}:`,
      result.error
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Task updated — assignee notification
// ---------------------------------------------------------------------------

/**
 * Send a "task assigned to you has been updated" notification to the assignee.
 * Called by updateTask when the editor selects "Yes" in the notify dialog.
 */
export async function sendTaskUpdatedEmail(
  args: AssigneeNotifyArgs & { updatedByName?: string | null }
): Promise<AssigneeNotifyResult> {
  const payload = renderTaskUpdated({
    taskTitle: args.taskTitle,
    taskLegacyId: args.taskLegacyId,
    assigneeFirstName: firstNameOf(args.assigneeName),
    dueDate: args.dueDate,
    priority: args.priority,
    updatedByName: args.updatedByName,
  });

  const result = await sendEmail({
    to: args.assigneeEmail,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });

  if (!result.ok) {
    console.error(
      `[email] task-updated notification failed for ${args.assigneeEmail}:`,
      result.error
    );
  }

  return result;
}
