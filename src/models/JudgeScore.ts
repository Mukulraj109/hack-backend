import mongoose, { Document, Schema, Model } from 'mongoose';
import { mongooseToJsonTransform } from '../utils/mongooseToJson.js';
import { HACKATHON_COLLECTIONS } from './collections.js';

export interface IJudgeScore extends Document {
  _id: mongoose.Types.ObjectId;
  submission: mongoose.Types.ObjectId;
  judge: mongoose.Types.ObjectId;
  innovationScore: number;
  executionScore: number;
  technicalScore: number;
  uxScore: number;
  totalScore: number;
  feedback?: string;
  createdAt: Date;
}

const judgeScoreSchema = new Schema<IJudgeScore>(
  {
    submission: {
      type: Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
      index: true,
    },
    judge: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    innovationScore: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
    },
    executionScore: {
      type: Number,
      required: true,
      min: 1,
      max: 50,
    },
    technicalScore: {
      type: Number,
      required: true,
      min: 1,
      max: 25,
    },
    uxScore: {
      type: Number,
      required: true,
      min: 1,
      max: 25,
    },
    totalScore: {
      type: Number,
    },
    feedback: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: HACKATHON_COLLECTIONS.judgeScores,
  }
);

judgeScoreSchema.index({ submission: 1, judge: 1 }, { unique: true });

judgeScoreSchema.pre('save', function (next) {
  this.totalScore =
    this.innovationScore + this.executionScore + this.technicalScore + this.uxScore;
  next();
});

judgeScoreSchema.set('toJSON', {
  transform: mongooseToJsonTransform,
});

export const JudgeScore: Model<IJudgeScore> = mongoose.model<IJudgeScore>('JudgeScore', judgeScoreSchema);
