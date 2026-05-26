import mongoose, { Document, Schema, Model } from 'mongoose';
import { mongooseToJsonTransform } from '../utils/mongooseToJson.js';
import { HACKATHON_COLLECTIONS } from './collections.js';

export interface IHackathonConfig extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  startDate: Date;
  endDate: Date;
  sprintHours: number;
  maxPoints: number;
  maxJudgePoints: number;
  maxSprintPoints: number;
  bonusPoints: number;
  isActive: boolean;
  createdAt: Date;
}

const hackathonConfigSchema = new Schema<IHackathonConfig>(
  {
    name: {
      type: String,
      default: 'FirstStepHack 2026',
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    sprintHours: {
      type: Number,
      default: 100,
    },
    maxPoints: {
      type: Number,
      default: 250,
    },
    maxJudgePoints: {
      type: Number,
      default: 150,
    },
    maxSprintPoints: {
      type: Number,
      default: 100,
    },
    bonusPoints: {
      type: Number,
      default: 20,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: HACKATHON_COLLECTIONS.config,
  }
);

hackathonConfigSchema.set('toJSON', {
  transform: mongooseToJsonTransform,
});

export const HackathonConfig: Model<IHackathonConfig> = mongoose.model<IHackathonConfig>(
  'HackathonConfig',
  hackathonConfigSchema
);
