import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { guestTokenMiddleware } from "./middlewares/guestToken";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// One proxy hop (Replit) in front; makes req.ip the client address for rate limits.
app.set("trust proxy", 1);
// Clerk's frontend API proxy streams raw bytes, so it goes before the body parsers.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
// Larger limit so a base64-encoded PDF CV (max 5 MB) fits in the scan request.
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true }));

// Must run before Clerk (see the middleware for why).
app.use(guestTokenMiddleware);
// Resolve the publishable key from the incoming host so the same server can
// serve several Clerk custom domains; falls back to CLERK_PUBLISHABLE_KEY.
if (process.env.CLERK_SECRET_KEY) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
}

app.use("/api", router);

export default app;
