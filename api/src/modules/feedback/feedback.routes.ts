
import { Router, type Request } from "express";
import { z } from "zod";

import { supabaseAdmin } from "../../config/supabase.js";
import { authenticateAdmin } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";

const router = Router();

const STATUSES = ["new", "contacted", "converted", "closed"] as const;
const ACTIVITY_TYPES = ["internal_note", "contact_attempt"] as const;

type AdminRequest = Request & {
    admin?: {
        user_id: string;
        role?: string;
        permissions?: Record<string, boolean>;
    };
};

function adminId(req: Request): string | undefined {
  return req.admin?.userId;
}

function isUuid(value: string) {
    return z.string().uuid().safeParse(value).success;
}

function parseError(error: unknown) {
    return error instanceof Error ? error.message : "Unexpected error";
}

function respondError(res: any, error: unknown) {
    console.error("Feedback API error:", error);
    return res.status(500).json({ error: "Feedback operation failed" });
}

// All endpoints in this router require an authenticated admin
// with the feedback-management permission.
router.use(authenticateAdmin, requirePermission("can_manage_feedback"));

// GET /api/v1/feedback
// Supports ?page=1&limit=20&search=cafe&status=new
// and ?assigned=unassigned, ?assigned=me, or ?assigned=<admin UUID>
router.get("/", async (req, res) => {
    try {
        const page     = Math.max(1, Number(req.query.page) || 1);
        const limit    = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
        const search   = String(req.query.search ?? "").trim();
        const status   = String(req.query.status ?? "");
        const assigned = String(req.query.assigned ?? "");

        if (status && !STATUSES.includes(status as (typeof STATUSES)[number])) {
            return res.status(400).json({ error: "Invalid status" });
        }

        if (
            assigned &&
            !["unassigned", "me"].includes(assigned) &&
            !isUuid(assigned)
        ) {
            return res.status(400).json({ error: "Invalid assignment filter" });
        }

        let query = supabaseAdmin.from("customer_feedback").select("*", { count: "exact" }).order("created_at", { ascending: false });

        if (status) query = query.eq("status", status);

        if (assigned === "unassigned") {
            query = query.is("assigned_to", null);
        } else if (assigned === "me") {
            const id = adminId(req);
            if (!id) return res.status(401).json({ error: "Admin identity missing" });
            query = query.eq("assigned_to", id);
        } else if (assigned) {
            query = query.eq("assigned_to", assigned);
        }

        if (search) {
            // Escape PostgREST filter syntax characters.
            const safeSearch = search.replace(/[,%()_*\\]/g, "");
            if (safeSearch) {
                query = query.or(
                    `cafe_name.ilike.%${safeSearch}%,contact_name.ilike.%${safeSearch}%,whatsapp_number.ilike.%${safeSearch}%`
                );
            }
        }

        const from = (page - 1) * limit;
        const { data, error, count } = await query.range(from, from + limit - 1);

        if (error) return respondError(res, error);

        return res.json({
            data: data ?? [],
            pagination: {
                page,
                limit,
                total: count ?? 0,
                totalPages: Math.ceil((count ?? 0) / limit),
            },
        });
    } catch (error) {
        return respondError(res, error);
    }
});
/**
 * GET /api/v1/feedback/my/count
 *
 * Returns the exact number of feedback records assigned to the
 * authenticated admin, including a breakdown by current status.
 */
router.get("/my/count", async (req, res) => {
  try {
    // Uses the identity established by authenticateAdmin.
    // Never trust an admin ID supplied by the client.
    const currentAdminId = req.admin?.userId;

    if (!currentAdminId) {
      return res.status(401).json({
        error: "Admin identity missing",
      });
    }

    const statuses = [
      "new",
      "contacted",
      "converted",
      "closed",
    ] as const;

    // Ask PostgreSQL for exact counts without retrieving feedback rows.
    const [totalResult, ...statusResults] = await Promise.all([
      supabaseAdmin
        .from("customer_feedback")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", currentAdminId),

      ...statuses.map((status) =>
        supabaseAdmin
          .from("customer_feedback")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", currentAdminId)
          .eq("status", status)
      ),
    ]);

    if (totalResult.error) {
      return respondError(res, totalResult.error);
    }

    const failedStatusQuery = statusResults.find(
      (result) => result.error
    );

    if (failedStatusQuery?.error) {
      return respondError(res, failedStatusQuery.error);
    }

    const byStatus = {
      new: statusResults[0].count ?? 0,
      contacted: statusResults[1].count ?? 0,
      converted: statusResults[2].count ?? 0,
      closed: statusResults[3].count ?? 0,
    };

    return res.json({
      data: {
        assigned_to_me: totalResult.count ?? 0,
        by_status: byStatus,
      },
    });
  } catch (error) {
    return respondError(res, error);
  }
});

// Analytics date helpers. All calendar-day boundaries use Asia/Kolkata (UTC+05:30).
const REPORTING_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30";
const DAY_MS = 24 * 60 * 60 * 1000;
const ANALYTICS_PAGE_SIZE = 1000;

function istDateString(date: Date): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: REPORTING_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}

function addCalendarDays(dateString: string, days: number): string {
    const date = new Date(`${dateString}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function isValidDateString(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function istMidnightIso(dateString: string): string {
    // India has no daylight-saving transition; explicit offset avoids server-local timezone dependence.
    return new Date(`${dateString}T00:00:00.000${IST_OFFSET}`).toISOString();
}

type FeedbackAnalyticsRow = {
    created_at: string;
    status: string;
    variety_ratings: unknown;
    quality_ratings: unknown;
};

async function fetchFeedbackCohort(fromIso: string, toExclusiveIso: string): Promise<FeedbackAnalyticsRow[]> {
    const { count: expectedCount, error: countError } = await supabaseAdmin
        .from("customer_feedback")
        .select("id", { count: "exact", head: true })
        .gte("created_at", fromIso)
        .lt("created_at", toExclusiveIso);
    if (countError) throw countError;

    const rows: FeedbackAnalyticsRow[] = [];
    let offset = 0;
    const expected = expectedCount ?? 0;

    while (offset < expected) {
        const { data, error } = await supabaseAdmin
            .from("customer_feedback")
            .select("created_at,status,variety_ratings,quality_ratings")
            .gte("created_at", fromIso)
            .lt("created_at", toExclusiveIso)
            .order("created_at", { ascending: true })
            .range(offset, offset + ANALYTICS_PAGE_SIZE - 1);

        if (error) throw error;
        const batch = data ?? [];
        if (batch.length === 0) {
            throw new Error("Feedback analytics pagination ended before all counted rows were retrieved");
        }
        rows.push(...batch);
        offset += batch.length;
    }

    if (rows.length !== expected) {
        throw new Error("Feedback analytics row count did not match the exact database count");
    }
    return rows;
}

type RatingStats = {
    key: string;
    name: string;
    rating_count: number;
    average_rating: number;
    distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
    _sum: number;
};

const RATING_KEYS = ["1", "2", "3", "4", "5"] as const;

function parseRatingObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    if (typeof value === "string") {
        try {
            const parsed: unknown = JSON.parse(value);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return parsed as Record<string, unknown>;
            }
        } catch {
            // Ignore malformed legacy JSON values; a bad rating should not break analytics.
        }
    }
    return {};
}

function parseValidRating(value: unknown): number | null {
    if (typeof value !== "string" && typeof value !== "number") return null;
    if (typeof value === "string" && value.trim() === "") return null;
    const rating = Number(value);
    return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

function displayRatingName(key: string): string {
    const knownNames: Record<string, string> = {
        "pak-choi": "Pak Choi",
        "pea-shoots": "Pea Shoots",
        "red-radish": "Red Radish",
        "pink-radish": "Pink Radish",
        "white-radish": "White Radish",
        "purple-radish": "Purple Radish",
        "fenugreek-methi": "Fenugreek (Methi)",
        "look-on-the-plate": "Look on the Plate",
        "texture-and-crunch": "Texture and Crunch",
    };
    return knownNames[key] ?? key.split(/[-_]/g).map((part) =>
        part ? part[0].toUpperCase() + part.slice(1) : part,
    ).join(" ");
}

function buildRatingStats(rows: FeedbackAnalyticsRow[], field: "variety_ratings" | "quality_ratings") {
    const stats = new Map<string, RatingStats>();
    for (const row of rows) {
        const ratings = parseRatingObject(row[field]);
        for (const [rawKey, rawValue] of Object.entries(ratings)) {
            const key = rawKey.trim().toLowerCase();
            if (!key) continue;
            const rating = parseValidRating(rawValue);
            if (rating === null) continue;

            let item = stats.get(key);
            if (!item) {
                item = {
                    key,
                    name: displayRatingName(key),
                    rating_count: 0,
                    average_rating: 0,
                    distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
                    _sum: 0,
                };
                stats.set(key, item);
            }
            item.rating_count += 1;
            item._sum += rating;
            item.distribution[String(rating) as (typeof RATING_KEYS)[number]] += 1;
        }
    }

    return [...stats.values()].map(({ _sum, ...item }) => ({
        ...item,
        average_rating: Math.round((_sum / item.rating_count) * 100) / 100,
    }));
}

function buildRatingTrends(
    rows: FeedbackAnalyticsRow[],
    fromDate: string,
    toDate: string,
    field: "variety_ratings" | "quality_ratings",
) {
    const byDate = new Map<string, Map<string, { sum: number; count: number }>>();
    for (let date = fromDate; date <= toDate; date = addCalendarDays(date, 1)) {
        byDate.set(date, new Map());
    }

    for (const row of rows) {
        const date = istDateString(new Date(row.created_at));
        const dateBucket = byDate.get(date);
        if (!dateBucket) continue;
        for (const [rawKey, rawValue] of Object.entries(parseRatingObject(row[field]))) {
            const key = rawKey.trim().toLowerCase();
            const rating = parseValidRating(rawValue);
            if (!key || rating === null) continue;
            const item = dateBucket.get(key) ?? { sum: 0, count: 0 };
            item.sum += rating;
            item.count += 1;
            dateBucket.set(key, item);
        }
    }

    return [...byDate.entries()].map(([date, values]) => ({
        date,
        ratings: [...values.entries()].map(([key, value]) => ({
            key,
            name: displayRatingName(key),
            rating_count: value.count,
            average_rating: Math.round((value.sum / value.count) * 100) / 100,
        })).sort((a, b) => a.key.localeCompare(b.key)),
    }));
}

async function countEnquiries(fromIso: string, toExclusiveIso: string): Promise<number> {
    const { count, error } = await supabaseAdmin
        .from("customer_feedback")
        .select("id", { count: "exact", head: true })
        .gte("created_at", fromIso)
        .lt("created_at", toExclusiveIso);

    if (error) throw error;
    return count ?? 0;
}

async function countActivityType(
    activityType: "contact_attempt" | "internal_note",
    fromIso: string,
    toExclusiveIso: string,
): Promise<number> {
    const { count, error } = await supabaseAdmin
        .from("customer_feedback_activities")
        .select("id", { count: "exact", head: true })
        .eq("activity_type", activityType)
        .gte("created_at", fromIso)
        .lt("created_at", toExclusiveIso);

    if (error) throw error;
    return count ?? 0;
}

// GET /api/v1/feedback/analytics
// Window semantics: selected dates are inclusive calendar dates in Asia/Kolkata.
// Database bounds are [start-of-from, start-of-day-after-to), both converted to UTC.
// For 7/30/90, the window includes today and the preceding N-1 calendar days.
// For all, trend starts on the earliest enquiry's IST calendar date and ends today.
// An empty all-time dataset reports today as both displayed dates and an empty trend bucket.
// all-time comparison has no finite equal-duration baseline: previous_period_total=0 (not applicable), change_percent=null.
router.get("/analytics", async (req, res) => {
    try {
        const allowedPeriods = ["7", "30", "90", "all"] as const;
        const rawPeriod = req.query.period === undefined ? "30" : String(req.query.period);
        const fromParam = req.query.from === undefined ? undefined : String(req.query.from);
        const toParam = req.query.to === undefined ? undefined : String(req.query.to);

        const hasCustomDates = fromParam !== undefined || toParam !== undefined;
        if (!hasCustomDates && !allowedPeriods.includes(rawPeriod as (typeof allowedPeriods)[number])) {
            return res.status(400).json({ error: "period must be one of 7, 30, 90, or all" });
        }
        if ((fromParam === undefined) !== (toParam === undefined)) {
            return res.status(400).json({ error: "Both from and to are required for a custom date range" });
        }
        if (fromParam !== undefined && toParam !== undefined) {
            if (!isValidDateString(fromParam) || !isValidDateString(toParam)) {
                return res.status(400).json({ error: "from and to must be valid dates in YYYY-MM-DD format" });
            }
            if (fromParam > toParam) {
                return res.status(400).json({ error: "from must be on or before to" });
            }
        }

        const today = istDateString(new Date());
        let fromDate: string;
        let toDate: string;
        let label: string;
        let allTime = false;

        if (fromParam !== undefined && toParam !== undefined) {
            fromDate = fromParam;
            toDate = toParam;
            label = "Custom range";
        } else if (rawPeriod === "all") {
            allTime = true;
            const { data: earliest, error: earliestError } = await supabaseAdmin
                .from("customer_feedback")
                .select("created_at")
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle();
            if (earliestError) throw earliestError;
            fromDate = earliest?.created_at ? istDateString(new Date(earliest.created_at)) : today;
            toDate = today;
            label = "All time";
        } else {
            const days = Number(rawPeriod);
            fromDate = addCalendarDays(today, -(days - 1));
            toDate = today;
            label = `Last ${days} days`;
        }

        const fromIso = istMidnightIso(fromDate);
        const toExclusiveDate = addCalendarDays(toDate, 1);
        const toExclusiveIso = istMidnightIso(toExclusiveDate);

        const cohort = await fetchFeedbackCohort(fromIso, toExclusiveIso);
        const summary = { total: cohort.length, new: 0, contacted: 0, converted: 0, closed: 0, conversion_rate: 0 };
        const productRankings = buildRatingStats(cohort, "variety_ratings")
            .sort((a, b) => b.average_rating - a.average_rating || b.rating_count - a.rating_count || a.key.localeCompare(b.key));
        const impressionAttributes = buildRatingStats(cohort, "quality_ratings")
            .sort((a, b) => b.average_rating - a.average_rating || b.rating_count - a.rating_count || a.key.localeCompare(b.key));
        const productRatingTrend = buildRatingTrends(cohort, fromDate, toDate, "variety_ratings");
        const impressionRatingTrend = buildRatingTrends(cohort, fromDate, toDate, "quality_ratings");
        const byDate = new Map<string, { enquiries: number; converted: number }>();

        for (let cursor = fromDate; cursor <= toDate; cursor = addCalendarDays(cursor, 1)) {
            byDate.set(cursor, { enquiries: 0, converted: 0 });
        }

        for (const row of cohort) {
            const status = row.status as keyof typeof summary;
            if (status === "new" || status === "contacted" || status === "converted" || status === "closed") {
                summary[status] += 1;
            }
            const date = istDateString(new Date(row.created_at));
            const bucket = byDate.get(date);
            if (bucket) {
                bucket.enquiries += 1;
                if (row.status === "converted") bucket.converted += 1;
            }
        }

        summary.conversion_rate = summary.total === 0
            ? 0
            : Math.round((summary.converted / summary.total) * 10000) / 100;

        const [contactAttempts, internalNotes] = await Promise.all([
            countActivityType("contact_attempt", fromIso, toExclusiveIso),
            countActivityType("internal_note", fromIso, toExclusiveIso),
        ]);

        let previousPeriodTotal = 0;
        let changePercent: number | null = null;
        if (!allTime) {
            const durationDays = Math.round(
                (new Date(`${toExclusiveDate}T00:00:00.000Z`).getTime() -
                    new Date(`${fromDate}T00:00:00.000Z`).getTime()) / DAY_MS,
            );
            const previousFromDate = addCalendarDays(fromDate, -durationDays);
            const previousFromIso = istMidnightIso(previousFromDate);
            previousPeriodTotal = await countEnquiries(previousFromIso, fromIso);
            changePercent = previousPeriodTotal === 0
                ? null
                : Math.round(((summary.total - previousPeriodTotal) / previousPeriodTotal) * 10000) / 100;
        }

        return res.json({
            data: {
                period: { from: fromDate, to: toDate, timezone: REPORTING_TIME_ZONE, label },
                summary,
                trend: Array.from(byDate, ([date, values]) => ({ date, ...values })),
                status_breakdown: [
                    { status: "new", count: summary.new },
                    { status: "contacted", count: summary.contacted },
                    { status: "converted", count: summary.converted },
                    { status: "closed", count: summary.closed },
                ],
                activity: { contact_attempts: contactAttempts, internal_notes: internalNotes },
                comparison: { previous_period_total: previousPeriodTotal, change_percent: changePercent },
                products: {
                    rankings: productRankings,
                    trend: productRatingTrend,
                },
                impressions: {
                    attributes: impressionAttributes,
                    trend: impressionRatingTrend,
                },
            },
        });
    } catch (error) {
        // Avoid logging query values or customer records. Keep only non-PII diagnostic metadata.
        const dbError = error as { code?: string; message?: string };
        console.error("Feedback analytics failed", { code: dbError?.code ?? "unknown" });
        return res.status(500).json({ error: "Unable to retrieve feedback analytics" });
    }
});

// GET /api/v1/feedback/:id
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!isUuid(id)) return res.status(400).json({ error: "Invalid feedback ID" });

        const [{ data: feedback, error }, { data: activities, error: activityError }] =
            await Promise.all([
                supabaseAdmin
                    .from("customer_feedback")
                    .select("*")
                    .eq("id", id)
                    .maybeSingle(),
                supabaseAdmin
                    .from("customer_feedback_activities")
                    .select("*")
                    .eq("feedback_id", id)
                    .order("created_at", { ascending: false }),
            ]);

        if (error) return respondError(res, error);
        if (activityError) return respondError(res, activityError);
        if (!feedback) return res.status(404).json({ error: "Feedback not found" });

        return res.json({ data: { ...feedback, activities: activities ?? [] } });
    } catch (error) {
        return respondError(res, error);
    }
});

// PATCH /api/v1/feedback/:id/status
router.patch("/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const parsed = z.object({
            status: z.enum(STATUSES),
        }).safeParse(req.body);

        if (!isUuid(id)) return res.status(400).json({ error: "Invalid feedback ID" });
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid status", details: parsed.error.flatten() });
        }

        const actorId = adminId(req);
        if (!actorId) return res.status(401).json({ error: "Admin identity missing" });

        const { data: current, error: readError } = await supabaseAdmin
            .from("customer_feedback")
            .select("id,status")
            .eq("id", id)
            .maybeSingle();

        if (readError) return respondError(res, readError);
        if (!current) return res.status(404).json({ error: "Feedback not found" });

        if (current.status === parsed.data.status) {
            return res.json({ data: current, message: "Status unchanged" });
        }

        const { data: updated, error: updateError } = await supabaseAdmin
            .from("customer_feedback")
            .update({ status: parsed.data.status, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select("*")
            .single();

        if (updateError) return respondError(res, updateError);

        const { error: activityError } = await supabaseAdmin
            .from("customer_feedback_activities")
            .insert({
                feedback_id: id,
                activity_type: "status_changed",
                actor_user_id: actorId,
                previous_status: current.status,
                new_status: parsed.data.status,
            });

        if (activityError) {
            console.error("Status activity logging failed:", activityError);
            return res.status(500).json({
                error: "Status changed, but activity logging failed. Check the record before retrying.",
            });
        }

        return res.json({ data: updated });
    } catch (error) {
        return respondError(res, error);
    }
});

// PATCH /api/v1/feedback/:id/assignment
// Send { "assigned_to": "<admin UUID>" } or { "assigned_to": null }
router.patch("/:id/assignment", async (req, res) => {
    try {
        const { id } = req.params;
        const parsed = z.object({
            assigned_to: z.string().uuid().nullable(),
        }).safeParse(req.body);

        if (!isUuid(id)) return res.status(400).json({ error: "Invalid feedback ID" });
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid assignment", details: parsed.error.flatten() });
        }

        const actorId = adminId(req);
        if (!actorId) return res.status(401).json({ error: "Admin identity missing" });

        const { data: current, error: readError } = await supabaseAdmin
            .from("customer_feedback")
            .select("id,assigned_to")
            .eq("id", id)
            .maybeSingle();

        if (readError) return respondError(res, readError);
        if (!current) return res.status(404).json({ error: "Feedback not found" });

        const nextAssignee = parsed.data.assigned_to;

        if (nextAssignee === current.assigned_to) {
            return res.json({ data: current, message: "Assignment unchanged" });
        }

        // Only active admins may be assigned feedback.
        if (nextAssignee !== null) {
            const { data: targetAdmin, error: adminError } = await supabaseAdmin
                .from("admin_users")
                .select("user_id,is_active")
                .eq("user_id", nextAssignee)
                .maybeSingle();

            if (adminError) return respondError(res, adminError);
            if (!targetAdmin || !targetAdmin.is_active) {
                return res.status(400).json({ error: "Assignee is not an active admin" });
            }
        }

        const { data: updated, error: updateError } = await supabaseAdmin
            .from("customer_feedback")
            .update({ assigned_to: nextAssignee, updated_at: new Date().toISOString() })
            .eq("id", id)
            .select("*")
            .single();

        if (updateError) return respondError(res, updateError);

        const { error: activityError } = await supabaseAdmin
            .from("customer_feedback_activities")
            .insert({
                feedback_id: id,
                activity_type: "assignment_changed",
                actor_user_id: actorId,
                previous_assigned_to: current.assigned_to,
                new_assigned_to: nextAssignee,
            });

        if (activityError) {
            console.error("Assignment activity logging failed:", activityError);
            return res.status(500).json({
                error: "Assignment changed, but activity logging failed. Check the record before retrying.",
            });
        }

        return res.json({ data: updated });
    } catch (error) {
        return respondError(res, error);
    }
});

// GET /api/v1/feedback/:id/activities
router.get("/:id/activities", async (req, res) => {
    try {
        const { id } = req.params;
        if (!isUuid(id)) return res.status(400).json({ error: "Invalid feedback ID" });

        const { data, error } = await supabaseAdmin
            .from("customer_feedback_activities")
            .select("*")
            .eq("feedback_id", id)
            .order("created_at", { ascending: false });

        if (error) return respondError(res, error);

        return res.json({ data: data ?? [] });
    } catch (error) {
        return respondError(res, error);
    }
});

// POST /api/v1/feedback/:id/activities
// Add an internal note or log a contact attempt.
router.post("/:id/activities", async (req, res) => {
    try {
        const { id } = req.params;
        const parsed = z.object({
            activity_type: z.enum(ACTIVITY_TYPES),
            note: z.string().trim().min(1).max(5000),
        }).safeParse(req.body);

        if (!isUuid(id)) return res.status(400).json({ error: "Invalid feedback ID" });
        if (!parsed.success) {
            return res.status(400).json({ error: "Invalid activity", details: parsed.error.flatten() });
        }

        const actorId = adminId(req);
        if (!actorId) return res.status(401).json({ error: "Admin identity missing" });

        const { data: feedback, error: feedbackError } = await supabaseAdmin
            .from("customer_feedback")
            .select("id")
            .eq("id", id)
            .maybeSingle();

        if (feedbackError) return respondError(res, feedbackError);
        if (!feedback) return res.status(404).json({ error: "Feedback not found" });

        const { data, error } = await supabaseAdmin
            .from("customer_feedback_activities")
            .insert({
                feedback_id: id,
                activity_type: parsed.data.activity_type,
                note: parsed.data.note,
                actor_user_id: actorId,
            })
            .select("*")
            .single();

        if (error) return respondError(res, error);

        return res.status(201).json({ data });
    } catch (error) {
        return respondError(res, error);
    }
});

export default router;
