import mongoose, { Document, Schema, Model } from 'mongoose';
import { HACKATHON_COLLECTIONS } from './collections.js';
import { mongooseToJsonTransform } from '../utils/mongooseToJson.js';

export type AccountStatus = 'pending' | 'active' | 'rejected' | 'suspended';

export type HiringStatus = 'actively_looking' | 'open_to_offers' | 'not_looking';

export type AvailabilityTimeline = 'immediate' | 'one_to_three_months' | 'three_plus_months';

export interface IHackathonUser extends Document {
  _id: mongoose.Types.ObjectId;
  auth0UserId?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  state?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  universityName?: string;
  graduationMonthYear?: string;
  currentCompanyName?: string;
  eligibility: {
    usGraduateWindow?: boolean;
    usWorkAuthorization?: boolean;
    usImmigrationStatus?: boolean;
    age18Plus?: boolean;
  };
  agreements: {
    hackathonRules?: boolean;
    recruiterSharing?: boolean;
    ownWorkDuringWindow?: boolean;
    confirmationYes?: boolean;
    termsAccepted?: boolean;
    signatureConfirmed?: boolean;
  };
  accountStatus: AccountStatus;
  activatedAt?: Date;
  zohoSubmissionId?: string;
  registrationCompletedAt?: Date;
  headshotUrl?: string;
  headshotUpdatedAt?: Date;
  resumeUrl?: string;
  resumeFileName?: string;
  resumeUpdatedAt?: Date;
  hiringStatus?: HiringStatus;
  availabilityTimeline?: AvailabilityTimeline;
  team?: mongoose.Types.ObjectId;
  referralCode: string;
  totalPoints: number;
  manualPointsBonus: number;
  isAdmin?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const hackathonUserSchema = new Schema<IHackathonUser>(
  {
    auth0UserId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    phone: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    linkedinUrl: { type: String, trim: true },
    githubUrl: { type: String, trim: true },
    universityName: { type: String, trim: true },
    graduationMonthYear: { type: String, trim: true },
    currentCompanyName: { type: String, trim: true },
    eligibility: {
      usGraduateWindow: { type: Boolean, default: false },
      usWorkAuthorization: { type: Boolean, default: false },
      usImmigrationStatus: { type: Boolean, default: false },
      age18Plus: { type: Boolean, default: false },
    },
    agreements: {
      hackathonRules: { type: Boolean, default: false },
      recruiterSharing: { type: Boolean, default: false },
      ownWorkDuringWindow: { type: Boolean, default: false },
      confirmationYes: { type: Boolean, default: false },
      termsAccepted: { type: Boolean, default: false },
      signatureConfirmed: { type: Boolean, default: false },
    },
    accountStatus: {
      type: String,
      enum: ['pending', 'active', 'rejected', 'suspended'],
      default: 'pending',
    },
    activatedAt: { type: Date },
    zohoSubmissionId: { type: String, index: true },
    registrationCompletedAt: { type: Date },
    headshotUrl: { type: String, trim: true },
    headshotUpdatedAt: { type: Date },
    resumeUrl: { type: String, trim: true },
    resumeFileName: { type: String, trim: true },
    resumeUpdatedAt: { type: Date },
    hiringStatus: {
      type: String,
      enum: ['actively_looking', 'open_to_offers', 'not_looking'],
    },
    availabilityTimeline: {
      type: String,
      enum: ['immediate', 'one_to_three_months', 'three_plus_months'],
    },
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    referralCode: {
      type: String,
      unique: true,
      index: true,
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    manualPointsBonus: {
      type: Number,
      default: 0,
      min: 0,
    },
    isAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true, collection: HACKATHON_COLLECTIONS.users }
);

hackathonUserSchema.set('toJSON', {
  transform: mongooseToJsonTransform,
});

export const HackathonUser: Model<IHackathonUser> = mongoose.model<IHackathonUser>(
  'HackathonUser',
  hackathonUserSchema
);
