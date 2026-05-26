import 'dotenv/config';
import { connectDatabase } from './config/database.js';
import { User } from './models/User.js';
import { Task } from './models/Task.js';
import { HackathonConfig } from './models/HackathonConfig.js';
import { Announcement } from './models/Announcement.js';
import bcrypt from 'bcryptjs';

const DEFAULT_TASKS = [
  {
    title: 'Share proof of buzz',
    description: 'Post on LinkedIn or Instagram with the hashtag we emailed you. Upload a screenshot for verification.',
    points: 50,
    taskType: 'social',
    actionLabel: 'SUBMIT PROOF',
    icon: 'share',
    accentClass: 'blue',
    sortOrder: 1,
  },
  {
    title: 'Invite a builder',
    description: 'Grow the cohort — share your invite link. Points apply when they register with your URL.',
    points: 15,
    taskType: 'referral',
    actionLabel: 'COPY LINK',
    icon: 'user-plus',
    accentClass: 'orange',
    sortOrder: 2,
  },
  {
    title: 'Checkpoint: working repo',
    description: 'Link a public or invited repo so reviewers can see momentum before the final upload.',
    points: 10,
    taskType: 'checkpoint',
    actionLabel: 'ADD LINK',
    icon: 'code',
    accentClass: 'blue',
    sortOrder: 3,
  },
  {
    title: 'Judge score',
    description: 'Up to 150 pts from finals demos — rubric matches what recruiters see.',
    points: 150,
    taskType: 'judging',
    icon: 'trophy',
    accentClass: 'blue',
    sortOrder: 4,
  },
  {
    title: 'Bonus participation',
    description: 'Newsletter, sponsor tasks, or surprise challenges — we will drop these in #announcements.',
    points: 20,
    taskType: 'bonus',
    actionLabel: 'VIEW TASKS',
    icon: 'gift',
    accentClass: 'orange',
    sortOrder: 5,
  },
];

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

    const taskCount = await Task.countDocuments();
    if (taskCount === 0) {
      await Task.insertMany(DEFAULT_TASKS);
      console.log(`✅ Created ${DEFAULT_TASKS.length} default tasks`);
    } else {
      console.log('ℹ️ Tasks already exist');
    }

    const configExists = await HackathonConfig.findOne({ isActive: true });
    if (!configExists) {
      await HackathonConfig.create({
        name: 'FirstStepHack 2026',
        startDate: new Date('2026-06-10T20:00:00-04:00'),
        endDate: new Date('2026-06-14T00:00:00-04:00'),
        sprintHours: 100,
        maxPoints: 250,
        maxJudgePoints: 150,
        maxSprintPoints: 100,
        bonusPoints: 20,
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
