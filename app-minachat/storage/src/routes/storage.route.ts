import { Router } from 'express';
import { getItems, setItems } from '../controllers/storage.controller.js';

const router = Router();

router.get('/getItems', getItems); // TODO: add JOI middleware
router.post('/setItems', setItems); // TODO: add JOI middleware

export default router;
