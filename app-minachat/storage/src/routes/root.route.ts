import { Request, Response, Router } from 'express';
import { getPublicKey } from '../controllers/root.controller';
import { respond } from '../utilities/respond';

const router = Router();

router.get('/', (_: Request, response: Response) => {
  respond.success(response, 'PONG', {});
});
router.get('/getPublicKey', getPublicKey);

export default router;
