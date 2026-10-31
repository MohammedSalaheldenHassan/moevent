import { Router, type IRouter } from "express";
import healthRouter from "./health";
import staffRouter from "./staff";
import cleanupRouter from "./cleanup";
import authRouter from "./auth";
import issueTicketRouter from "./issueTicket";
import orgRouter from "./org";

const router: IRouter = Router();

router.use(healthRouter);
router.use(staffRouter);
router.use(cleanupRouter);
router.use(authRouter);
router.use(issueTicketRouter);
router.use(orgRouter);

export default router;
