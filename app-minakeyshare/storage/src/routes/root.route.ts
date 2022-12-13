import { Request, Response, Router } from 'express';
import { getPublicKey } from '../controllers/root.controller.js';
import { respond } from '../utilities/respond.js';
import storage from './storage.route.js';

const router = Router();

// root routes
router.get('/', (_: Request, response: Response) => {
  respond.success(response, 'PONG', {});
});
router.get('/getPublicKey', getPublicKey);

// grouped routes
router.use('/storage/', storage);

export default router;
