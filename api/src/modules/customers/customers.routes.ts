
import { Router            } from "express";
import { z                 } from "zod";
import { supabaseAdmin     } from "../../config/supabase.js";
import { authenticateAdmin } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";

const customersRouter = Router();

const uuidSchema = z.string().uuid();

const customerFieldsSchema = z.object(
    {
        full_name    : z.string().trim().min(1).max(200),
        phone        : z.string().trim().min(7).max(25),
        email        : z.union(
            [
                z.string().trim().email().max(254),
                z.literal(""),
            ]
        ).optional().transform((value) => value || null),
        notes        : z.string().trim().max(5000).nullable().optional(),
        customer_type: z.enum(["individual", "restaurant"]),
    }
).strict();

const createCustomerSchema = customerFieldsSchema;
const updateCustomerSchema = customerFieldsSchema.partial().strict().refine((value) => Object.keys(value).length > 0, { message: "Provide at least one field to update",});
const addressFieldsSchema  = z.object({
  label                : z.string().trim().max(80).nullable().optional(),
  recipient_name       : z.string().trim().min(1).max(200),
  phone                : z.string().trim().min(7).max(25),
  address_line1        : z.string().trim().min(1).max(300),
  address_line2        : z.string().trim().max(300).nullable().optional(),
  area                 : z.string().trim().min(1).max(150),
  city                 : z.string().trim().min(1).max(150).default("Bengaluru"),
  state                : z.string().trim().min(1).max(150).default("Karnataka"),
  postal_code          : z.string().trim().min(4).max(12),
  delivery_instructions: z.string().trim().max(2000).nullable().optional(),
  is_default           : z.boolean().optional().default(false),
}).strict();

const updateAddressSchema = addressFieldsSchema.partial().strict().refine((value) => Object.keys(value).length > 0, {message: "Provide at least one address field to update"});

function parseInteger(value: unknown, fallback: number, min: number, max: number): number | null {
  if (value === undefined) return fallback;
  const result = z.coerce.number().int().min(min).max(max).safeParse(value);
  return result.success ? result.data : null;
}

async function writeCustomerAudit(actorUserId: string, action: string, targetId: string, details: Record<string, unknown> = {}): Promise<void> {
  const { error } = await supabaseAdmin.from("admin_audit_logs").insert({
    actor_user_id: actorUserId,
    action,
    target_type  : "customer",
    target_id    : targetId,
    details,
  });

  if (error) {
    console.error("Customer audit log insert failed:", error.message);
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function normalizeEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

async function findDuplicateContact(phone: string, email: string | null | undefined, excludeId?: string): Promise<{ phoneMatch: boolean; emailMatch: boolean } | null> {
  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);

  let phoneQuery = supabaseAdmin.from("marut_customers").select("id").eq("phone_normalized", normalizedPhone);

  if (excludeId) phoneQuery = phoneQuery.neq("id", excludeId);

  const { data: phoneMatches, error: phoneError } = await phoneQuery.limit(1);

  if (phoneError) throw phoneError;

  let emailMatch = false;

  if (normalizedEmail) {
    let emailQuery = supabaseAdmin.from("marut_customers").select("id").eq("email_normalized", normalizedEmail);
    if (excludeId) emailQuery = emailQuery.neq("id", excludeId);

    const { data, error } = await emailQuery.limit(1);

    if (error) throw error;
    emailMatch = Boolean(data?.length);
  }

  return {
    phoneMatch: Boolean(phoneMatches?.length),
    emailMatch,
  };
}

function duplicateResponse(matches: { phoneMatch: boolean; emailMatch: boolean }) {
  const fields: string[] = [];

  if (matches.phoneMatch) fields.push("phone");
  if (matches.emailMatch) fields.push("email");

  return {
    error: "A customer with matching contact details already exists",
    duplicate_fields: fields,
  };
}

// GET /api/v1/customers
customersRouter.get(
  "/",
  authenticateAdmin,
  requirePermission("can_manage_customers"),
  async (req, res) => {
    const limit = parseInteger(req.query.limit, 20, 1, 100);
    const offset = parseInteger(req.query.offset, 0, 0, 1_000_000);

    if (limit === null || offset === null) {
      res.status(400).json({ error: "Invalid pagination parameters" });
      return;
    }

    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const type =
      typeof req.query.customer_type === "string"
        ? req.query.customer_type
        : undefined;

    const includeArchived = req.query.include_archived === "true";

    if (search.length > 120) {
      res.status(400).json({ error: "Search text is too long" });
      return;
    }

    if (
      type !== undefined &&
      type !== "individual" &&
      type !== "restaurant"
    ) {
      res.status(400).json({ error: "Invalid customer type" });
      return;
    }

    try {
      let query = supabaseAdmin
        .from("marut_customers")
        .select("*", { count: "exact" });

      if (!includeArchived) query = query.eq("is_active", true);
      if (type) query = query.eq("customer_type", type);

      if (search) {
        const escaped = search.replace(/[\\%_]/g, "\\$&");
        query = query.or(
          `full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%,email.ilike.%${escaped}%`,
        );
      }

      const { data, error, count } = await query
        .order("full_name", { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      res.status(200).json({
        customers: data ?? [],
        pagination: {
          limit,
          offset,
          total: count ?? 0,
        },
      });
    } catch (error) {
      console.error("Customer list failed:", error);
      res.status(500).json({ error: "Unable to list customers" });
    }
  },
);

// POST /api/v1/customers
customersRouter.post(
  "/",
  authenticateAdmin,
  requirePermission("can_manage_customers"),
  async (req, res) => {
    const parsed = createCustomerSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid customer details",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const matches = await findDuplicateContact(
        parsed.data.phone,
        parsed.data.email,
      );

      if (matches && (matches.phoneMatch || matches.emailMatch)) {
        res.status(409).json(duplicateResponse(matches));
        return;
      }

      const { data, error } = await supabaseAdmin
        .from("marut_customers")
        .insert({
          ...parsed.data,
          email: normalizeEmail(parsed.data.email),
        })
        .select("*")
        .single();

      if (error) {
        if (error.code === "23505") {
          res.status(409).json({
            error: "A customer with matching contact details already exists",
          });
          return;
        }
        throw error;
      }

      await writeCustomerAudit(req.admin!.userId, "customer.created", data.id, {
        customer_type: data.customer_type,
      });

      res.status(201).json({ customer: data });
    } catch (error) {
      console.error("Customer create failed:", error);
      res.status(500).json({ error: "Unable to create customer" });
    }
  },
);

// GET /api/v1/customers/:id
customersRouter.get(
  "/:id",
  authenticateAdmin,
  requirePermission("can_manage_customers"),
  async (req, res) => {
    const parsedId = uuidSchema.safeParse(req.params.id);

    if (!parsedId.success) {
      res.status(400).json({ error: "Invalid customer ID" });
      return;
    }

    try {
      const { data: customer, error: customerError } = await supabaseAdmin
        .from("marut_customers")
        .select("*")
        .eq("id", parsedId.data)
        .maybeSingle();

      if (customerError) throw customerError;

      if (!customer) {
        res.status(404).json({ error: "Customer not found" });
        return;
      }

      const [
        { data: addresses, error: addressError },
        { data: orders, error: orderError },
      ] = await Promise.all([
        supabaseAdmin
          .from("marut_customer_addresses")
          .select("*")
          .eq("customer_id", parsedId.data)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("marut_orders")
          .select(`
            id,
            order_number,
            source,
            fulfilment_type,
            status,
            subtotal,
            discount_amount,
            delivery_fee,
            total_amount,
            currency,
            created_at,
            completed_at
          `)
          .eq("customer_id", parsedId.data)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (addressError) throw addressError;
      if (orderError) throw orderError;

      const allOrders = orders ?? [];
      const completedOrders = allOrders.filter(
        (order) => order.status === "completed",
      );

      res.status(200).json({
        customer,
        addresses: addresses ?? [],
        orders: allOrders,
        summary: {
          orders_returned: allOrders.length,
          completed_orders_returned: completedOrders.length,
          completed_order_value: completedOrders.reduce(
            (sum, order) => sum + Number(order.total_amount || 0),
            0,
          ),
          note:
            "Order summaries cover the 100 most recent orders. Payment balances are not calculated by this endpoint yet.",
        },
      });
    } catch (error) {
      console.error("Customer detail failed:", error);
      res.status(500).json({ error: "Unable to retrieve customer details" });
    }
  },
);

// PATCH /api/v1/customers/:id
customersRouter.patch(
  "/:id",
  authenticateAdmin,
  requirePermission("can_manage_customers"),
  async (req, res) => {
    const parsedId = uuidSchema.safeParse(req.params.id);
    const parsed = updateCustomerSchema.safeParse(req.body);

    if (!parsedId.success) {
      res.status(400).json({ error: "Invalid customer ID" });
      return;
    }

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid customer update",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("marut_customers")
        .select("id")
        .eq("id", parsedId.data)
        .maybeSingle();

      if (existingError) throw existingError;

      if (!existing) {
        res.status(404).json({ error: "Customer not found" });
        return;
      }

      if (parsed.data.phone || parsed.data.email !== undefined) {
        const { data: current, error: currentError } = await supabaseAdmin
          .from("marut_customers")
          .select("phone,email")
          .eq("id", parsedId.data)
          .single();

        if (currentError) throw currentError;

        const matches = await findDuplicateContact(
          parsed.data.phone ?? current.phone,
          parsed.data.email !== undefined
            ? parsed.data.email
            : current.email,
          parsedId.data,
        );

        if (matches && (matches.phoneMatch || matches.emailMatch)) {
          res.status(409).json(duplicateResponse(matches));
          return;
        }
      }

      const payload = {
        ...parsed.data,
        ...(parsed.data.email !== undefined
          ? { email: normalizeEmail(parsed.data.email) }
          : {}),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabaseAdmin
        .from("marut_customers")
        .update(payload)
        .eq("id", parsedId.data)
        .select("*")
        .single();

      if (error) {
        if (error.code === "23505") {
          res.status(409).json({
            error: "A customer with matching contact details already exists",
          });
          return;
        }
        throw error;
      }

      await writeCustomerAudit(
        req.admin!.userId,
        "customer.updated",
        data.id,
        { changed_fields: Object.keys(parsed.data) },
      );

      res.status(200).json({ customer: data });
    } catch (error) {
      console.error("Customer update failed:", error);
      res.status(500).json({ error: "Unable to update customer" });
    }
  },
);

// Archive or restore a customer without deleting order history.
for (const [path, isActive, action] of [
  ["archive", false, "customer.archived"],
  ["restore", true, "customer.restored"],
] as const) {
  customersRouter.patch(
    `/:id/${path}`,
    authenticateAdmin,
    requirePermission("can_manage_customers"),
    async (req, res) => {
      const parsedId = uuidSchema.safeParse(req.params.id);

      if (!parsedId.success) {
        res.status(400).json({ error: "Invalid customer ID" });
        return;
      }

      try {
        const { data, error } = await supabaseAdmin
          .from("marut_customers")
          .update({
            is_active: isActive,
            updated_at: new Date().toISOString(),
          })
          .eq("id", parsedId.data)
          .select("*")
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          res.status(404).json({ error: "Customer not found" });
          return;
        }

        await writeCustomerAudit(req.admin!.userId, action, data.id);

        res.status(200).json({ customer: data });
      } catch (error) {
        console.error(`Customer ${path} failed:`, error);
        res.status(500).json({ error: `Unable to ${path} customer` });
      }
    },
  );
}

// POST /api/v1/customers/:id/addresses
customersRouter.post(
  "/:id/addresses",
  authenticateAdmin,
  requirePermission("can_manage_customers"),
  async (req, res) => {
    const parsedId = uuidSchema.safeParse(req.params.id);
    const parsed = addressFieldsSchema.safeParse(req.body);

    if (!parsedId.success) {
      res.status(400).json({ error: "Invalid customer ID" });
      return;
    }

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid address",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const { data: customer, error: customerError } = await supabaseAdmin
        .from("marut_customers")
        .select("id,is_active")
        .eq("id", parsedId.data)
        .maybeSingle();

      if (customerError) throw customerError;

      if (!customer) {
        res.status(404).json({ error: "Customer not found" });
        return;
      }

      if (!customer.is_active) {
        res.status(409).json({ error: "Restore the customer before adding addresses" });
        return;
      }

      // If this is the first address, it must become the default.
      const { count, error: countError } = await supabaseAdmin
        .from("marut_customer_addresses")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", parsedId.data);

      if (countError) throw countError;

      const makeDefault = parsed.data.is_default || (count ?? 0) === 0;

      if (makeDefault) {
        const { error: clearError } = await supabaseAdmin
          .from("marut_customer_addresses")
          .update({ is_default: false })
          .eq("customer_id", parsedId.data)
          .eq("is_default", true);

        if (clearError) throw clearError;
      }

      const { data, error } = await supabaseAdmin
        .from("marut_customer_addresses")
        .insert({
          ...parsed.data,
          customer_id: parsedId.data,
          is_default: makeDefault,
        })
        .select("*")
        .single();

      if (error) throw error;

      await writeCustomerAudit(
        req.admin!.userId,
        "customer.address_created",
        parsedId.data,
        { address_id: data.id },
      );

      res.status(201).json({ address: data });
    } catch (error) {
      console.error("Customer address create failed:", error);
      res.status(500).json({ error: "Unable to add customer address" });
    }
  },
);

// PATCH /api/v1/customers/:id/addresses/:addressId
customersRouter.patch(
  "/:id/addresses/:addressId",
  authenticateAdmin,
  requirePermission("can_manage_customers"),
  async (req, res) => {
    const customerId = uuidSchema.safeParse(req.params.id);
    const addressId = uuidSchema.safeParse(req.params.addressId);
    const parsed = updateAddressSchema.safeParse(req.body);

    if (!customerId.success || !addressId.success) {
      res.status(400).json({ error: "Invalid customer or address ID" });
      return;
    }

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid address update",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from("marut_customer_addresses")
        .select("id,customer_id")
        .eq("id", addressId.data)
        .eq("customer_id", customerId.data)
        .maybeSingle();

      if (existingError) throw existingError;

      if (!existing) {
        res.status(404).json({ error: "Address not found for this customer" });
        return;
      }

      if (parsed.data.is_default === true) {
        const { error: clearError } = await supabaseAdmin
          .from("marut_customer_addresses")
          .update({ is_default: false })
          .eq("customer_id", customerId.data)
          .eq("is_default", true);

        if (clearError) throw clearError;
      }

      const { data, error } = await supabaseAdmin
        .from("marut_customer_addresses")
        .update({
          ...parsed.data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", addressId.data)
        .eq("customer_id", customerId.data)
        .select("*")
        .single();

      if (error) throw error;

      await writeCustomerAudit(
        req.admin!.userId,
        "customer.address_updated",
        customerId.data,
        { address_id: data.id, changed_fields: Object.keys(parsed.data) },
      );

      res.status(200).json({ address: data });
    } catch (error) {
      console.error("Customer address update failed:", error);
      res.status(500).json({ error: "Unable to update customer address" });
    }
  },
);

// DELETE /api/v1/customers/:id/addresses/:addressId
customersRouter.delete(
  "/:id/addresses/:addressId",
  authenticateAdmin,
  requirePermission("can_manage_customers"),
  async (req, res) => {
    const customerId = uuidSchema.safeParse(req.params.id);
    const addressId = uuidSchema.safeParse(req.params.addressId);

    if (!customerId.success || !addressId.success) {
      res.status(400).json({ error: "Invalid customer or address ID" });
      return;
    }

    try {
      const { data: address, error: addressError } = await supabaseAdmin
        .from("marut_customer_addresses")
        .select("id,is_default")
        .eq("id", addressId.data)
        .eq("customer_id", customerId.data)
        .maybeSingle();

      if (addressError) throw addressError;

      if (!address) {
        res.status(404).json({ error: "Address not found for this customer" });
        return;
      }

      const { data: linkedOrders, error: orderError } = await supabaseAdmin
        .from("marut_orders")
        .select("id")
        .eq("delivery_address_id", addressId.data)
        .limit(1);

      if (orderError) throw orderError;

      if (linkedOrders?.length) {
        res.status(409).json({
          error: "This address is linked to order history and cannot be deleted",
        });
        return;
      }

      const { error } = await supabaseAdmin
        .from("marut_customer_addresses")
        .delete()
        .eq("id", addressId.data)
        .eq("customer_id", customerId.data);

      if (error) throw error;

      await writeCustomerAudit(
        req.admin!.userId,
        "customer.address_deleted",
        customerId.data,
        { address_id: addressId.data },
      );

      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Customer address delete failed:", error);
      res.status(500).json({ error: "Unable to delete customer address" });
    }
  },
);

export default customersRouter;
