
import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../../config/supabase.js";

const authRouter = Router();

const emailSchema = z.object({
  email: z.string().trim().email().max(254),
});

authRouter.post("/check-email", async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: "Enter a valid email address" });
    return;
  }

  const email = parsed.data.email.toLowerCase();

  try {
    // Find an active admin record for this email.
    // Auth user listing is deliberately not exposed to the frontend.
    const { data: admins, error } = await supabaseAdmin
      .from("admin_users")
      .select("user_id")
      .eq("is_active", true);

    if (error) {
      console.error("Admin authorization lookup failed:", error.message);
      res.status(500).json({ error: "Unable to verify access right now" });
      return;
    }

    // Find the matching Auth user server-side.
    let authorized = false;
    let page = 1;
    const perPage = 1000;

    while (!authorized) {
      const { data, error: usersError } =
        await supabaseAdmin.auth.admin.listUsers({ page, perPage });

      if (usersError) {
        console.error("Auth user lookup failed:", usersError.message);
        res.status(500).json({ error: "Unable to verify access right now" });
        return;
      }

      const matchedUser = data.users.find(
        (user) => user.email?.toLowerCase() === email,
      );

      if (matchedUser) {
        authorized = admins.some(
          (admin) => admin.user_id === matchedUser.id,
        );
        break;
      }

      if (data.users.length < perPage) {
        break;
      }

      page += 1;
    }

    // Use the same response for authorized and unauthorized emails.
    if (!authorized) {
      res.status(403).json({
        authorized: false,
        error: "This account is not authorized to access MARUT Admin",
      });
      return;
    }

    res.status(200).json({ authorized: true });
  } catch (error) {
    console.error("Email authorization failed:", error);
    res.status(500).json({ error: "Unable to verify access right now" });
  }
});

export default authRouter;
