import mongoose, { Document, Schema, Model } from 'mongoose';
import { HACKATHON_COLLECTIONS } from './collections.js';
import { mongooseToJsonTransform } from '../utils/mongooseToJson.js';

export type AccountStatus = 'pending' | 'active' | 'rejected' | 'suspended';

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
  team?: mongoose.Types.ObjectId;
  referralCode: string;
  totalPoints: number;
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
