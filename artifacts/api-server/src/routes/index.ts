import { Router, type IRouter } from "express";
import healthRouter from "./health";
import staffRouter from "./staff";
import cleanupRouter from "./cleanup";
import authRouter from "./auth";
import issueTicketRouter from "./issueTicket";
import orgRouter from "./org";
import publicStatsRouter from "./publicStats";
import sendTicketsRouter from "./sendTickets";
import publicBookingsRouter from "./publicBookings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(staffRouter);
router.use(cleanupRouter);
router.use(authRouter);
router.use(issueTicketRouter);
router.use(orgRouter);
router.use(publicStatsRouter);
router.use(sendTicketsRouter);
router.use(publicBookingsRouter);

export default router;
