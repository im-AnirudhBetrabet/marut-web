
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { authenticateAdmin } from "./middleware/authenticate.js";
import { requirePermission } from "./middleware/requirePermission.js";
import authRouter            from "./modules/auth/auth.routes.js";
import adminsRouter          from "./modules/admins/admins.routes.js";
import productsRouter        from "./modules/products/products.routes.js";
import productImagesRouter   from "./modules/products/product-images.routes.js";
const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin        : process.env.ADMIN_APP_ORIGIN,
    methods       : ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
  }),
);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status : "ok",
    service: "marut-api",
  });
});

app.use("/api/v1/auth"    , authRouter  );
app.use("/api/v1/admins"  , adminsRouter);
app.use("/api/v1/products", productsRouter);
app.use("/api/v1/products", productImagesRouter);
app.get(
  "/api/v1/auth/me",
  authenticateAdmin,
  (req, res) => {
    res.json({
      userId     : req.admin!.userId,
      email      : req.admin!.email,
      role       : req.admin!.role,
      permissions: req.admin!.permissions,
    });
  },
);

app.get(
  "/api/v1/auth/check-orders",
  authenticateAdmin,
  requirePermission("can_manage_orders"),
  (_req, res) => {
    res.json({ allowed: true });
  },
);

export default app;
