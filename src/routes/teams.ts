import { Router } from 'express';
import * as teamController from '../controllers/teamController.js';
import { validate } from '../middleware/validate.js';
import { optionalAuth } from '../middleware/auth.js';
import {
  validateAuth0Token,
  loadHackathonUser,
  requireActiveAccount,
} from '../middleware/hackathonAuth.js';

const router = Router();

const hackerAuth = [validateAuth0Token, loadHackathonUser] as const;
const hackerWrite = [...hackerAuth, requireActiveAccount] as const;

router.get('/', optionalAuth, teamController.getAllTeams);
router.get('/my', ...hackerAuth, teamController.getUserTeam);
router.get('/invite/:inviteCode', teamController.getTeamByInviteCode);
router.get('/:id', teamController.getTeam);
router.get('/:id/members', teamController.getTeamMembers);

router.post('/', ...hackerWrite, validate(teamController.createTeamSchema), teamController.createTeam);
router.post('/join', ...hackerWrite, validate(teamController.joinTeamSchema), teamController.joinTeam);

router.put(
  '/:id',
  ...hackerWrite,
  validate(teamController.updateTeamSchema),
  teamController.updateTeam
);

router.delete('/:teamId/members/:userId', ...hackerWrite, teamController.removeMember);
router.delete('/:teamId/leave', ...hackerWrite, teamController.leaveTeam);

export default router;
