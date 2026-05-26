import { Router } from 'express';
import * as announcementController from '../controllers/announcementController.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', announcementController.getAnnouncements);

router.post('/', authenticate, requireAdmin, validate(announcementController.createAnnouncementSchema), announcementController.createAnnouncement);

router.put('/:id', authenticate, requireAdmin, announcementController.updateAnnouncement);
router.delete('/:id', authenticate, requireAdmin, announcementController.deleteAnnouncement);

export default router;
