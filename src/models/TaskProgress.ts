import mongoose, { Document, Schema, Model } from 'mongoose';
import { mongooseToJsonTransform } from '../utils/mongooseToJson.js';
import { HACKATHON_COLLECTIONS } from './collections.js';

export interface ITaskProgress extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  task: mongoose.Types.ObjectId;
  status: 'pending' | 'submitted' | 'verified' | 'rejected';
  proofUrl?: string;
  platform?: string;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const taskProgressSchema = new Schema<ITaskProgress>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'HackathonUser',
      required: true,
      index: true,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'submitted', 'verified', 'rejected'],
      default: 'pending',
    },
    proofUrl: {
      type: String,
    },
    platform: {
      type: String,
      enum: ['instagram', 'linkedin', 'twitter'],
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: HACKATHON_COLLECTIONS.taskProgress,
  }
);

taskProgressSchema.index({ user: 1, task: 1 }, { unique: true });

taskProgressSchema.set('toJSON', {
  transform: mongooseToJsonTransform,
});

export const TaskProgress: Model<ITaskProgress> = mongoose.model<ITaskProgress>(
  'TaskProgress',
  taskProgressSchema
);
