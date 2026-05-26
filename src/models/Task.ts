import mongoose, { Document, Schema, Model } from 'mongoose';
import { mongooseToJsonTransform } from '../utils/mongooseToJson.js';
import { HACKATHON_COLLECTIONS } from './collections.js';

export interface ITask extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  description: string;
  points: number;
  taskType: 'social' | 'referral' | 'checkpoint' | 'judging' | 'bonus';
  actionLabel?: string;
  icon: string;
  accentClass: 'blue' | 'orange';
  sortOrder: number;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
}

const taskSchema = new Schema<ITask>({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  points: {
    type: Number,
    required: true,
  },
  taskType: {
    type: String,
    required: true,
    enum: ['social', 'referral', 'checkpoint', 'judging', 'bonus'],
  },
  actionLabel: {
    type: String,
  },
  icon: {
    type: String,
    required: true,
  },
  accentClass: {
    type: String,
    enum: ['blue', 'orange'],
    default: 'blue',
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
}, { collection: HACKATHON_COLLECTIONS.tasks });

taskSchema.set('toJSON', {
  transform: mongooseToJsonTransform,
});

export const Task: Model<ITask> = mongoose.model<ITask>('Task', taskSchema);
