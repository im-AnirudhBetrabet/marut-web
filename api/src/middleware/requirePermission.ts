
import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedAdmin } from "./authenticate.js";

export type AdminPermission = keyof AuthenticatedAdmin["permissions"];

export function requirePermission(permission: AdminPermission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const admin = req.admin;

    if (!admin) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (admin.role === "owner") {
      next();
      return;
    }

    if (!admin.permissions[permission]) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }

    next();
  };
}
