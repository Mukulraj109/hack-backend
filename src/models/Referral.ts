import mongoose, { Document, Schema, Model } from 'mongoose';
import { mongooseToJsonTransform } from '../utils/mongooseToJson.js';
import { HACKATHON_COLLECTIONS } from './collections.js';

export interface IReferral extends Document {
  _id: mongoose.Types.ObjectId;
  referrer: mongoose.Types.ObjectId;
  referee?: mongoose.Types.ObjectId;
  refereeEmail?: string;
  referralCode: string;
  status: 'pending' | 'registered' | 'verified';
  registeredAt?: Date;
  pointsAwarded: boolean;
  createdAt: Date;
}

const referralSchema = new Schema<IReferral>(
  {
    referrer: {
      type: Schema.Types.ObjectId,
      ref: 'HackathonUser',
      required: true,
      index: true,
    },
    referee: {
      type: Schema.Types.ObjectId,
      ref: 'HackathonUser',
    },
    refereeEmail: {
      type: String,
    },
    referralCode: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'registered', 'verified'],
      default: 'pending',
    },
    registeredAt: {
      type: Date,
    },
    pointsAwarded: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: HACKATHON_COLLECTIONS.referrals,
  }
);

referralSchema.index({ referrer: 1, referee: 1 });

referralSchema.set('toJSON', {
  transform: mongooseToJsonTransform,
});

export const Referral: Model<IReferral> = mongoose.model<IReferral>('Referral', referralSchema);
