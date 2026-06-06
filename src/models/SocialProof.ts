import mongoose, { Document, Schema, Model } from 'mongoose';
import { mongooseToJsonTransform } from '../utils/mongooseToJson.js';
import { HACKATHON_COLLECTIONS } from './collections.js';

export type SocialPlatform = 'instagram' | 'linkedin';
export type SocialProofSource = 'zoho' | 'app';

export interface ISocialProof extends Document {
  _id: mongoose.Types.ObjectId;
  team: mongoose.Types.ObjectId;
  submittedBy: mongoose.Types.ObjectId;
  platform: SocialPlatform;
  postUrl: string;
  screenshotUrl?: string;
  templateId?: string;
  hashtag?: string;
  status: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  pointsEarned: number;
  zohoSubmissionId?: string;
  source?: SocialProofSource;
  createdAt: Date;
  updatedAt: Date;
}

const socialProofSchema = new Schema<ISocialProof>(
  {
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'HackathonUser',
      required: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ['instagram', 'linkedin'],
    },
    postUrl: {
      type: String,
      required: true,
    },
    screenshotUrl: {
      type: String,
      trim: true,
    },
    templateId: {
      type: String,
      trim: true,
    },
    hashtag: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'HackathonUser',
    },
    pointsEarned: {
      type: Number,
      default: 25,
    },
    zohoSubmissionId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    source: {
      type: String,
      enum: ['zoho', 'app'],
      default: 'zoho',
    },
  },
  {
    timestamps: true,
    collection: HACKATHON_COLLECTIONS.socialProofs,
  }
);

socialProofSchema.index({ team: 1, platform: 1 }, { unique: true });

socialProofSchema.set('toJSON', {
  transform: mongooseToJsonTransform,
});

export const SocialProof: Model<ISocialProof> = mongoose.model<ISocialProof>(
  'SocialProof',
  socialProofSchema
);
