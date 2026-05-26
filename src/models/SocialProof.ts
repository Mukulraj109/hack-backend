import mongoose, { Document, Schema, Model } from 'mongoose';
import { mongooseToJsonTransform } from '../utils/mongooseToJson.js';
import { HACKATHON_COLLECTIONS } from './collections.js';

export interface ISocialProof extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  platform: 'instagram' | 'linkedin' | 'twitter';
  postUrl: string;
  screenshotUrl?: string;
  hashtag?: string;
  status: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  pointsEarned: number;
  createdAt: Date;
}

const socialProofSchema = new Schema<ISocialProof>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'HackathonUser',
      required: true,
      index: true,
    },
    platform: {
      type: String,
      required: true,
      enum: ['instagram', 'linkedin', 'twitter'],
    },
    postUrl: {
      type: String,
      required: true,
    },
    screenshotUrl: {
      type: String,
    },
    hashtag: {
      type: String,
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
      ref: 'User',
    },
    pointsEarned: {
      type: Number,
      default: 50,
    },
  },
  {
    timestamps: true,
    collection: HACKATHON_COLLECTIONS.socialProofs,
  }
);

socialProofSchema.set('toJSON', {
  transform: mongooseToJsonTransform,
});

export const SocialProof: Model<ISocialProof> = mongoose.model<ISocialProof>(
  'SocialProof',
  socialProofSchema
);
