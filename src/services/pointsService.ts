import {
  TaskProgress,
  HackathonUser,
  Referral,
  JudgeScore,
  Submission,
  Team,
} from '../models/index.js';
import { HACKATHON_COLLECTIONS } from '../models/collections.js';
import mongoose from 'mongoose';

export async function calculateUserPoints(userId: string): Promise<number> {
  const taskProgressPipeline = [
    { $match: { user: new mongoose.Types.ObjectId(userId), status: 'verified' } },
    {
      $lookup: {
        from: HACKATHON_COLLECTIONS.tasks,
        localField: 'task',
        foreignField: '_id',
        as: 'taskData',
      },
    },
    { $unwind: '$taskData' },
    { $group: { _id: null, total: { $sum: '$taskData.points' } } },
  ];

  const taskResult = await TaskProgress.aggregate(taskProgressPipeline);
  const taskPoints = taskResult.length > 0 ? taskResult[0].total : 0;

  const referralPoints =
    (await Referral.countDocuments({
      referrer: userId,
      pointsAwarded: true,
    })) * 15;

  const user = await HackathonUser.findById(userId);
  let judgePoints = 0;

  if (user) {
    const team = await Team.findOne({ members: userId });
    if (team) {
      const submissions = await Submission.find({
        team: team._id,
        status: 'judged',
      });

      if (submissions.length > 0) {
        const judgeResult = await JudgeScore.aggregate([
          { $match: { submission: { $in: submissions.map((s) => s._id) } } },
          { $group: { _id: null, total: { $sum: '$totalScore' } } },
        ]);
        judgePoints = judgeResult.length > 0 ? judgeResult[0].total : 0;
      }
    } else {
      const soloSubmissions = await Submission.find({
        submittedBy: userId,
        status: 'judged',
        $or: [{ team: null }, { team: { $exists: false } }],
      });

      if (soloSubmissions.length > 0) {
        const judgeResult = await JudgeScore.aggregate([
          { $match: { submission: { $in: soloSubmissions.map((s) => s._id) } } },
          { $group: { _id: null, total: { $sum: '$totalScore' } } },
        ]);
        judgePoints = judgeResult.length > 0 ? judgeResult[0].total : 0;
      }
    }
  }

  return taskPoints + referralPoints + judgePoints;
}

export async function calculateTeamPoints(teamId: string): Promise<number> {
  const team = await Team.findById(teamId);
  if (!team) return 0;

  let totalPoints = 0;

  for (const memberId of team.members) {
    const memberPoints = await calculateUserPoints(memberId.toString());
    totalPoints += memberPoints;
  }

  const submissions = await Submission.find({
    team: teamId,
    status: 'judged',
  });

  if (submissions.length > 0) {
    const judgeResult = await JudgeScore.aggregate([
      { $match: { submission: { $in: submissions.map((s) => s._id) } } },
      { $group: { _id: null, total: { $sum: '$totalScore' } } },
    ]);

    if (judgeResult.length > 0) {
      totalPoints += judgeResult[0].total;
    }
  }

  await Team.findByIdAndUpdate(teamId, { totalPoints });

  return totalPoints;
}

export async function awardReferralPoints(referrerId: string): Promise<void> {
  const referral = await Referral.findOne({
    referrer: referrerId,
    status: 'registered',
    pointsAwarded: false,
  });

  if (!referral) return;

  referral.pointsAwarded = true;
  await referral.save();

  const userPoints = await calculateUserPoints(referrerId);
  await HackathonUser.findByIdAndUpdate(referrerId, { totalPoints: userPoints });
}
