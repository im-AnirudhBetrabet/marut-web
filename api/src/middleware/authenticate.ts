
import type { Request, Response, NextFunction } from "express";
import { supabaseAuth, supabaseAdmin } from "../config/supabase.js";

export interface AuthenticatedAdmin {
  userId     : string;
  email      : string | undefined;
  role       : "owner" | "staff";
  permissions: {
    can_manage_users         : boolean;
    can_manage_products      : boolean;
    can_manage_product_prices: boolean;
    can_manage_feedback      : boolean;
    can_manage_orders        : boolean;
    can_manage_customers     : boolean;
    can_manage_payments      : boolean;
    can_manage_refunds       : boolean;
    can_manage_delivery_zones: boolean;
    can_view_reports         : boolean;
  };
}

declare global {
  namespace Express {
    interface Request {
      admin?: AuthenticatedAdmin;
    }
  }
}

export async function authenticateAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }

    // Validate the JWT with Supabase Auth.
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      res.status(401).json({ error: "Invalid or expired access token" });
      return;
    }

    // Fetch the authoritative role and permissions from the database.
    const { data: admin, error: adminError } = await supabaseAdmin
      .from("admin_users")
      .select(`
        user_id,
        role,
        is_active,
        can_manage_users,
        can_manage_products,
        can_manage_product_prices,
        can_manage_feedback,
        can_manage_orders,
        can_manage_customers,
        can_manage_payments,
        can_manage_refunds,
        can_manage_delivery_zones,
        can_view_reports
      `)
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error("Admin lookup failed:", adminError.message);
      res.status(500).json({ error: "Unable to verify admin access" });
      return;
    }

    if (!admin || !admin.is_active) {
      res.status(403).json({ error: "Active admin access required" });
      return;
    }

    if (admin.role !== "owner" && admin.role !== "staff") {
      res.status(403).json({ error: "Invalid admin role" });
      return;
    }

    req.admin = {
      userId: user.id,
      email: user.email,
      role: admin.role,
      permissions: {
        can_manage_users         : admin.can_manage_users,
        can_manage_products      : admin.can_manage_products,
        can_manage_product_prices: admin.can_manage_product_prices,
        can_manage_feedback      : admin.can_manage_feedback,
        can_manage_orders        : admin.can_manage_orders,
        can_manage_customers     : admin.can_manage_customers,
        can_manage_payments      : admin.can_manage_payments,
        can_manage_refunds       : admin.can_manage_refunds,
        can_manage_delivery_zones: admin.can_manage_delivery_zones,
        can_view_reports         : admin.can_view_reports,
      },
    };

    next();
  } catch (error) {
    console.error("Authentication middleware failed:", error);
    res.status(500).json({ error: "Authentication check failed" });
  }
}
