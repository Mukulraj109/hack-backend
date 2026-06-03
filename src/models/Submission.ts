import mongoose, { Document, Schema, Model } from 'mongoose';
import { mongooseToJsonTransform } from '../utils/mongooseToJson.js';
import { HACKATHON_COLLECTIONS } from './collections.js';

export interface ISubmission extends Document {
  _id: mongoose.Types.ObjectId;
  team?: mongoose.Types.ObjectId;
  submittedBy: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  repoUrl?: string;
  demoUrl?: string;
  deckUrl?: string;
  technicalRoadblock?: string;
  sponsorApis?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  supplementaryZipConfirmed?: boolean;
  status: 'draft' | 'submitted' | 'under_review' | 'judged';
  track: string;
  submittedAt?: Date;
  judgePoints?: number;
  judgeFeedback?: string;
  judgedBy?: mongoose.Types.ObjectId;
  judgedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const submissionSchema = new Schema<ISubmission>(
  {
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      index: true,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'HackathonUser',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    repoUrl: {
      type: String,
    },
    demoUrl: {
      type: String,
    },
    deckUrl: {
      type: String,
    },
    technicalRoadblock: {
      type: String,
    },
    sponsorApis: {
      type: String,
    },
    fileUrl: {
      type: String,
    },
    fileName: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    supplementaryZipConfirmed: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'judged'],
      default: 'draft',
    },
    track: {
      type: String,
      required: true,
    },
    submittedAt: {
      type: Date,
    },
    judgePoints: {
      type: Number,
      min: 0,
      max: 175,
    },
    judgeFeedback: {
      type: String,
      trim: true,
    },
    judgedBy: {
      type: Schema.Types.ObjectId,
      ref: 'HackathonUser',
    },
    judgedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: HACKATHON_COLLECTIONS.submissions,
  }
);

submissionSchema.index({ team: 1 }, { unique: true, sparse: true });

submissionSchema.set('toJSON', {
  transform: mongooseToJsonTransform,
});

export const Submission: Model<ISubmission> = mongoose.model<ISubmission>('Submission', submissionSchema);
