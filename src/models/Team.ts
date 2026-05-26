import mongoose, { Document, Schema, Model } from 'mongoose';
import { mongooseToJsonTransform } from '../utils/mongooseToJson.js';
import { HACKATHON_COLLECTIONS } from './collections.js';

export type HackathonTrack = 'ai-career-agent' | 'recruiter-bridge' | 'open-build';

export interface ITeam extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  inviteCode: string;
  track?: HackathonTrack;
  leader: mongoose.Types.ObjectId;
  members: mongoose.Types.ObjectId[];
  submissions: mongoose.Types.ObjectId[];
  isFinalist: boolean;
  isWinner: boolean;
  totalPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

const teamSchema = new Schema<ITeam>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    track: {
      type: String,
      enum: ['ai-career-agent', 'recruiter-bridge', 'open-build'],
      required: false,
    },
    leader: {
      type: Schema.Types.ObjectId,
      ref: 'HackathonUser',
      required: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'HackathonUser',
      },
    ],
    submissions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Submission',
      },
    ],
    isFinalist: {
      type: Boolean,
      default: false,
    },
    isWinner: {
      type: Boolean,
      default: false,
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: HACKATHON_COLLECTIONS.teams,
  }
);

teamSchema.set('toJSON', {
  transform: mongooseToJsonTransform,
});

export const Team: Model<ITeam> = mongoose.model<ITeam>('Team', teamSchema);
