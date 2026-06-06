import 'dotenv/config';
import { connectDatabase } from './config/database.js';
import { User } from './models/User.js';
import { HackathonConfig } from './models/HackathonConfig.js';
import { Announcement } from './models/Announcement.js';
import bcrypt from 'bcryptjs';

const DEFAULT_ANNOUNCEMENTS = [
  {
    title: 'Submission deadline',
    detail: 'Final ZIP or repo link locks when the sprint timer hits zero. Late drops need organizer approval.',
    icon: 'timer',
  },
];

async function seed() {
  try {
    await connectDatabase();
    console.log('🌱 Starting seed...');

    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
      await User.create({
        email: 'admin@firststephack.com',
        passwordHash: hashedPassword,
        name: 'Admin User',
        role: 'admin',
        referralCode: 'ADMIN001',
      });
      console.log('✅ Admin user created (admin@firststephack.com / admin123)');
    } else {
      console.log('ℹ️ Admin user already exists');
    }

    const configExists = await HackathonConfig.findOne({ isActive: true });
    if (!configExists) {
      await HackathonConfig.create({
        name: 'FirstStepHack 2026',
        startDate: new Date('2026-07-08T20:00:00-04:00'),
        endDate: new Date('2026-07-13T00:00:00-04:00'),
        sprintHours: 100,
        maxPoints: 250,
        maxJudgePoints: 175,
        maxSprintPoints: 75,
        bonusPoints: 20,
        socialHashtag: '#ShipIn100Hrs',
        isActive: true,
      });
      console.log('✅ Hackathon config created');
    } else {
      console.log('ℹ️ Hackathon config already exists');
    }

    const announcementCount = await Announcement.countDocuments();
    if (announcementCount === 0) {
      await Announcement.insertMany(DEFAULT_ANNOUNCEMENTS);
      console.log(`✅ Created ${DEFAULT_ANNOUNCEMENTS.length} default announcements`);
    } else {
      console.log('ℹ️ Announcements already exist');
    }

    console.log('🎉 Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
