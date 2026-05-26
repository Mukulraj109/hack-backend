import { Team } from '../models/index.js';
import { ISubmission } from '../models/Submission.js';
import { ApiError } from './ApiError.js';

export async function assertSubmissionAccess(
  userId: string,
  submission: ISubmission
): Promise<void> {
  if (submission.submittedBy?.toString() === userId) {
    return;
  }

  if (submission.team) {
    const team = await Team.findOne({ _id: submission.team, members: userId });
    if (team) {
      return;
    }
  }

  throw ApiError.forbidden('You can only access your own submission');
}

export function submissionStorageKey(submission: ISubmission): string {
  return (submission.team ?? submission.submittedBy).toString();
}
