import mongoose, { Document, Schema, Model } from 'mongoose';
import { mongooseToJsonTransform } from '../utils/mongooseToJson.js';
import { HACKATHON_COLLECTIONS } from './collections.js';

export interface IAnnouncement extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  detail: string;
  icon: 'timer' | 'calendar';
  isActive: boolean;
  publishedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: {
      type: String,
      required: true,
    },
    detail: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      enum: ['timer', 'calendar'],
      default: 'timer',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    collection: HACKATHON_COLLECTIONS.announcements,
  }
);

announcementSchema.set('toJSON', {
  transform: mongooseToJsonTransform,
});

export const Announcement: Model<IAnnouncement> = mongoose.model<IAnnouncement>(
  'Announcement',
  announcementSchema
);
