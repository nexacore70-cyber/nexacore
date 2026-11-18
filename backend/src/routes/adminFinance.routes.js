import { Router } from 'express';
import { requireAdminSession } from '../middleware/admin-session.middleware.js';
import { financeOverview } from '../controllers/adminFinance.controller.js';
const router = Router();
router.use(requireAdminSession);
router.use((req,res,next)=> req.user?.role === 'ADMIN' ? next() : res.status(403).json({message:'Administrator account required.'}));
router.get('/overview', financeOverview);
export default router;
