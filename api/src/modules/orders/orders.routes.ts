import { Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../../config/supabase.js";
import { authenticateAdmin } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";

const ordersRouter = Router();
const uuidSchema = z.string().uuid();

function parseInteger(value: unknown, fallback: number, min: number, max: number): number | null {
    if (value === undefined) return fallback;
    const parsed = z.coerce.number().int().min(min).max(max).safeParse(value);
    return parsed.success ? parsed.data : null;
}

function queryString(value: unknown): string | undefined {
    return typeof value === "string" ? value.trim() : undefined;
}

function isValidDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

// GET /api/v1/orders
ordersRouter.get(
    "/",
    authenticateAdmin,
    requirePermission("can_manage_orders"),
    async (req, res) => {
        const limit = parseInteger(req.query.limit, 20, 1, 100);
        const offset = parseInteger(req.query.offset, 0, 0, 1_000_000);

        if (limit === null || offset === null) {
            res.status(400).json({ error: "Invalid pagination parameters" });
            return;
        }

        const search = queryString(req.query.search) ?? "";
        const status = queryString(req.query.status);
        const source = queryString(req.query.source);
        const fulfilmentType = queryString(req.query.fulfilment_type);
        const fromDate = queryString(req.query.from_date);
        const toDate = queryString(req.query.to_date);

        if (search.length > 120) {
            res.status(400).json({ error: "Search text is too long" });
            return;
        }

        if (status && (status.length > 40 || !/^[a-z_]+$/.test(status))) {
            res.status(400).json({ error: "Invalid status filter" });
            return;
        }

        if (source && !["whatsapp", "phone", "instagram"].includes(source.toLowerCase())) {
            res.status(400).json({ error: "source must be whatsapp, phone or instagram" });
            return;
        }

        if (fulfilmentType && !["delivery", "pickup"].includes(fulfilmentType.toLowerCase())) {
            res.status(400).json({ error: "fulfilment_type must be delivery or pickup" });
            return;
        }

        if ((fromDate && !isValidDate(fromDate)) || (toDate && !isValidDate(toDate))) {
            res.status(400).json({ error: "Dates must use YYYY-MM-DD format" });
            return;
        }

        if (fromDate && toDate && fromDate > toDate) {
            res.status(400).json({ error: "from_date cannot be later than to_date" });
            return;
        }

        try {
            let query = supabaseAdmin
                .from("marut_orders")
                .select(
                    `id, order_number, customer_id, source, fulfilment_type, status,
           delivery_address_snapshot, delivery_fee, subtotal, discount_amount,
           total_amount, currency, customer_notes, internal_notes,
           cancellation_reason, created_by, updated_by, confirmed_at,
           completed_at, cancelled_at, created_at, updated_at,
           marut_customers!inner(id, full_name, phone, email)`,
                    { count: "exact" },
                );

            if (status) query = query.eq("status", status);
            if (source) query = query.eq("source", source.toLowerCase());
            if (fulfilmentType) query = query.eq("fulfilment_type", fulfilmentType.toLowerCase());
            if (fromDate) query = query.gte("created_at", `${fromDate}T00:00:00.000Z`);
            if (toDate) {
                const endExclusive = new Date(`${toDate}T00:00:00.000Z`);
                endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
                query = query.lt("created_at", endExclusive.toISOString());
            }

            if (search) {
                const escaped = search.replace(/[\\%_,().]/g, "\\$&");
                const { data: matchingCustomers, error: customerSearchError } = await supabaseAdmin
                    .from("marut_customers")
                    .select("id")
                    .or(`full_name.ilike.%${escaped}%,phone.ilike.%${escaped}%`)
                    .limit(500);

                if (customerSearchError) throw customerSearchError;

                const matchingCustomerIds = (matchingCustomers ?? []).map((customer) => customer.id);
                const asNumber = /^\d+$/.test(search) ? Number(search) : null;
                const conditions: string[] = [];

                if (asNumber !== null && Number.isSafeInteger(asNumber)) {
                    conditions.push(`order_number.eq.${asNumber}`);
                }
                if (matchingCustomerIds.length) {
                    conditions.push(`customer_id.in.(${matchingCustomerIds.join(",")})`);
                }

                if (!conditions.length) {
                    res.status(200).json({ orders: [], pagination: { limit, offset, total: 0 } });
                    return;
                }
                query = query.or(conditions.join(","));
            }

            const { data, error, count } = await query
                .order("created_at", { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;

            res.status(200).json({
                orders: data ?? [],
                pagination: { limit, offset, total: count ?? 0 },
            });
        } catch (error) {
            console.error("Orders list failed:", error);
            res.status(500).json({ error: "Unable to retrieve orders" });
        }
    },
);

// GET /api/v1/orders/:id
ordersRouter.get(
    "/:id",
    authenticateAdmin,
    requirePermission("can_manage_orders"),
    async (req, res) => {
        const parsedId = uuidSchema.safeParse(req.params.id);
        if (!parsedId.success) {
            res.status(400).json({ error: "Invalid order ID" });
            return;
        }

        try {
            const { data: order, error: orderError } = await supabaseAdmin
                .from("marut_orders")
                .select(`
          *,
          marut_customers(id, full_name, phone, email, customer_type),
          marut_customer_addresses(id, label, recipient_name, phone, address_line1,
            address_line2, area, city, state, postal_code, delivery_instructions)
        `)
                .eq("id", parsedId.data)
                .maybeSingle();

            if (orderError) throw orderError;
            if (!order) {
                res.status(404).json({ error: "Order not found" });
                return;
            }

            const [itemsResult, historyResult] = await Promise.all([
                supabaseAdmin
                    .from("marut_order_items")
                    .select("id, order_id, product_id, product_variant_id, product_name_snapshot, pack_size_snapshot, sku_snapshot, quantity, unit_price, line_total, created_at")
                    .eq("order_id", parsedId.data)
                    .order("created_at", { ascending: true }),
                supabaseAdmin
                    .from("marut_order_status_history")
                    .select("id, order_id, old_status, new_status, note, changed_by, created_at")
                    .eq("order_id", parsedId.data)
                    .order("created_at", { ascending: true }),
            ]);

            if (itemsResult.error) throw itemsResult.error;
            if (historyResult.error) throw historyResult.error;

            // Payment information is only returned to admins with payment permission.
            let payments: unknown[] | undefined;
            if (req.admin?.role === "owner" || req.admin?.permissions.can_manage_payments) {
                const { data, error } = await supabaseAdmin
                    .from("marut_payment_transactions")
                    .select("id, order_id, transaction_type, method, amount, status, reference, notes, recorded_by, created_at")
                    .eq("order_id", parsedId.data)
                    .order("created_at", { ascending: true });
                if (error) throw error;
                payments = data ?? [];
            }

            res.status(200).json({
                order,
                items: itemsResult.data ?? [],
                status_history: historyResult.data ?? [],
                ...(payments === undefined ? {} : { payments }),
            });
        } catch (error) {
            console.error("Order detail failed:", error);
            res.status(500).json({ error: "Unable to retrieve order details" });
        }
    },
);

export default ordersRouter;
