import { Router, type IRouter } from "express";
import healthRouter from "./health";
import staffRouter from "./staff";
import cleanupRouter from "./cleanup";
import authRouter from "./auth";
import issueTicketRouter from "./issueTicket";
import superAdminRouter from "./superAdmin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(staffRouter);
router.use(cleanupRouter);
router.use(authRouter);
router.use(issueTicketRouter);
router.use(superAdminRouter);

export default router;
