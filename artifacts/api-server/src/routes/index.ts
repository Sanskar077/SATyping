import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import institutesRouter from "./institutes";
import passagesRouter from "./passages";
import typingRouter from "./typing";
import testsRouter from "./tests";
import resultsRouter from "./results";
import certificatesRouter from "./certificates";
import subscriptionsRouter from "./subscriptions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(institutesRouter);
router.use(passagesRouter);
router.use(typingRouter);
router.use(testsRouter);
router.use(resultsRouter);
router.use(certificatesRouter);
router.use(subscriptionsRouter);

export default router;
