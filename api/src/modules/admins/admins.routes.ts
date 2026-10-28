import { Router            } from "express";
import { z                 } from "zod";
import { env               } from "../../config/env.js"
import { authenticateAdmin } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { supabaseAdmin     } from "../../config/supabase.js";

const adminsRouter = Router();

const inviteSchema = z.object(
    {
        can_manage_feedback      : z.boolean().optional().default(false),
        can_manage_products      : z.boolean().optional().default(false),
        can_manage_users         : z.boolean().optional().default(false),
        can_manage_product_prices: z.boolean().optional().default(false),
        can_manage_orders        : z.boolean().optional().default(false),
        can_manage_customers     : z.boolean().optional().default(false),
        can_manage_payments      : z.boolean().optional().default(false),
        can_manage_refunds       : z.boolean().optional().default(false),
        can_manage_delivery_zones: z.boolean().optional().default(false),
        can_view_reports         : z.boolean().optional().default(false),
        email                    : z.string().trim().email().max(254)
    }
).strict()

const permissionsSchema = z.object({
  can_manage_users         : z.boolean(),
  can_manage_products      : z.boolean(),
  can_manage_product_prices: z.boolean(),
  can_manage_feedback      : z.boolean(),
  can_manage_orders        : z.boolean(),
  can_manage_customers     : z.boolean(),
  can_manage_payments      : z.boolean(),
  can_manage_refunds       : z.boolean(),
  can_manage_delivery_zones: z.boolean(),
  can_view_reports         : z.boolean(),

}).strict();

const uuidSchema = z.string().uuid();

// list admins
adminsRouter.get(
  "/",
  authenticateAdmin,
  requirePermission("can_manage_users"),
  async (_req, res) => {
    const { data: admins, error } = await supabaseAdmin
      .from("admin_users")
      .select(`
        user_id,
        role,
        is_active,
        created_by,
        created_at,
        updated_at,
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
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({
        error: "Failed to retrieve admins",
      });
    }

    if (!admins?.length) {
      return res.json({ admins: [] });
    }

    // Fetch Auth users server-side.
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (authError) {
      console.error("Failed to retrieve admin emails:", authError);

      return res.status(500).json({
        error: "Failed to retrieve admin user details",
      });
    }

    const emailByUserId = new Map(
      authData.users.map((user) => [
        user.id,
        user.email ?? null,
      ]),
    );

    const adminsWithEmails = admins.map((admin) => ({
      ...admin,
      email: emailByUserId.get(admin.user_id) ?? null,
    }));

    return res.json({
      admins: adminsWithEmails,
    });
  },
);  

// invite admin
adminsRouter.post(
    "/invitations",
    authenticateAdmin,
    requirePermission("can_manage_users"),
    async (req, res) => {
        const parsed = inviteSchema.safeParse(req.body);

        if (!parsed.success){
            res.status(400).json({
                error: "Invalid invitation details",
                details: parsed.error.flatten().fieldErrors,
            });
            return;
        }

        const authorization = req.headers.authorization;

        // Forward the authenticated inviter's token to the Edge function.
        if (!authorization?.startsWith("Bearer ")){
            res.status(401).json({
                error: "Authentication required."
            });
            return;
        }

        try{
            const response = await fetch(
                `${env.supabaseUrl}/functions/v1/admin-invite-user`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type" : "application/json",
                        "Authorization": authorization,
                        "apikey"       : env.supabaseAnonKey,
                    },
                    body: JSON.stringify({
                        email                    : parsed.data.email,
                        can_manage_users         : parsed.data.can_manage_users,
                        can_manage_products      : parsed.data.can_manage_products,
                        can_manage_feedback      : parsed.data.can_manage_feedback,
                        can_manage_product_prices: parsed.data.can_manage_product_prices,
                        can_manage_orders        : parsed.data.can_manage_orders,
                        can_manage_customers     : parsed.data.can_manage_customers,
                        can_manage_payments      : parsed.data.can_manage_payments,
                        can_manage_refunds       : parsed.data.can_manage_refunds,
                        can_manage_delivery_zones: parsed.data.can_manage_delivery_zones,
                        can_view_reports         : parsed.data.can_view_reports,
                    }),
                    signal: AbortSignal.timeout(30_000),
                }
            );

            const result: unknown = await response.json().catch(() => null);

            res.status(response.status).json(
                result && typeof result == "object" ?
                result : {
                    error: "Unexpected invitation service response"
                },
            );
        }catch(error) {
            console.error("Admin invitation service request failed:", error);

            res.status(502).json({
                error:
                "Could not confirm the invitation service response. Check the invitation request before retrying.",
            });
        }
    },
);


// modify admin permissions
adminsRouter.patch(
  "/:userId/permissions",
  authenticateAdmin,
  requirePermission("can_manage_users"),
  async (req, res) => {
    if (req.admin!.role !== "owner") {
      res.status(403).json({
        error: "Only the owner can change existing admin permissions",
      });
      return;
    }

    const userId = uuidSchema.safeParse(req.params.userId);
    if (!userId.success) {
      res.status(400).json({ error: "Invalid admin user ID" });
      return;
    }

    const parsed = permissionsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "All ten permission flags must be provided as booleans",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const { error } = await supabaseAdmin.rpc(
        "update_marut_staff_permissions",
        {
          p_actor_user_id            : req.admin!.userId,
          p_target_user_id           : userId.data,
          p_can_manage_users         : parsed.data.can_manage_users,
          p_can_manage_products      : parsed.data.can_manage_products,
          p_can_manage_product_prices: parsed.data.can_manage_product_prices,
          p_can_manage_feedback      : parsed.data.can_manage_feedback,
          p_can_manage_orders        : parsed.data.can_manage_orders,
          p_can_manage_customers     : parsed.data.can_manage_customers,
          p_can_manage_payments      : parsed.data.can_manage_payments,
          p_can_manage_refunds       : parsed.data.can_manage_refunds,
          p_can_manage_delivery_zones: parsed.data.can_manage_delivery_zones,
          p_can_view_reports         : parsed.data.can_view_reports,
        },
      );

      if (error) {
        console.error("Admin permission update failed:", error.message);

        if (error.code === "42501") {
          res.status(403).json({ error: "Permission update not authorized" });
          return;
        }

        if (error.code === "P0002" || error.code === "22023") {
          res.status(404).json({ error: "Staff admin not found or not eligible" });
          return;
        }

        res.status(500).json({ error: "Unable to update admin permissions" });
        return;
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Admin permission update request failed:", error);
      res.status(500).json({ error: "Unable to update admin permissions" });
    }
  },
);

// remove admin
adminsRouter.patch(
  "/:userId/deactivate",
  authenticateAdmin,
  requirePermission("can_manage_users"),
  async (req, res) => {
    const userId = uuidSchema.safeParse(req.params.userId);
    if (!userId.success) {
      res.status(400).json({ error: "Invalid admin user ID" });
      return;
    }

    if (userId.data === req.admin!.userId) {
      res.status(403).json({ error: "You cannot deactivate your own account" });
      return;
    }

    try {
      const { error } = await supabaseAdmin.rpc("deactivate_marut_staff", {
        p_actor_user_id: req.admin!.userId,
        p_target_user_id: userId.data,
      });

      if (error) {
        console.error("Staff deactivation failed:", error.message);

        if (error.code === "42501") {
          res.status(403).json({ error: "Staff deactivation not authorized" });
          return;
        }

        if (error.code === "22023" || error.code === "P0002") {
          res.status(409).json({
            error: "Staff account is already inactive or not eligible for deactivation",
          });
          return;
        }

        res.status(500).json({ error: "Unable to deactivate staff account" });
        return;
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Staff deactivation request failed:", error);
      res.status(500).json({ error: "Unable to deactivate staff account" });
    }
  },
);


export default adminsRouter
