import { Router            } from "express";
import { z                 } from "zod";
import { supabaseAdmin     } from "../../config/supabase.js";
import { authenticateAdmin } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";

const productsRouter = Router();

const slugSchema      = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase, hyphen-separated slug");
const textField       = (max: number) => z.string().trim().max(max);
const packSizesSchema = z.array(z.string().trim().min(1).max(30)).min(1).max(20).refine((values) => new Set(values).size === values.length, {message: "Pack sizes must be unique",});

const productFieldsSchema = z.object(
    {
        name                 : textField(160).min(1),
        slug                 : slugSchema,
        category             : textField(80).min(1),
        category_label       : textField(100).min(1),
        tagline              : textField(240),
        description          : textField(5000),
        spotlight_category   : textField(160),
        spotlight_description: textField(3000),
        taste                : textField(500),
        uses                 : textField(1000),
        card_image_url       : textField(2000),
        image_url            : textField(2000),
        image_folder         : textField(240),
        pack_sizes           : packSizesSchema,
        is_available         : z.boolean(),
        is_featured          : z.boolean(),
        sort_order           : z.number().int().min(0).max(100000),
        is_test_product      : z.boolean(),
    }
).strict();

const createProductSchema = productFieldsSchema
  .pick({
    name                 : true,
    slug                 : true,
    category             : true,
    category_label       : true,
    tagline              : true,
    description          : true,
    spotlight_category   : true,
    spotlight_description: true,
    taste                : true,
    uses                 : true,
    card_image_url       : true,
    image_url            : true,
    image_folder         : true,
    pack_sizes           : true,
    is_available         : true,
    is_featured          : true,
    sort_order           : true,
    is_test_product      : true,
  })
  .partial({
    tagline              : true,
    description          : true,
    spotlight_category   : true,
    spotlight_description: true,
    taste                : true,
    uses                 : true,
    card_image_url       : true,
    image_url            : true,
    image_folder         : true,
    pack_sizes           : true,
    is_available         : true,
    is_featured          : true,
    sort_order           : true,
    is_test_product      : true,
  });

const updateProductSchema = productFieldsSchema.partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  { message: "Provide at least one product field to update" },
);

const publicationSchema = z.object({
  is_published: z.boolean(),
}).strict();

const uuidSchema = z.string().uuid();

function parseBooleanQuery(value: unknown): boolean | undefined | null {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseIntegerQuery(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number | null {
  if (value === undefined) return fallback;
  const parsed = z.coerce.number().int().min(minimum).max(maximum).safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function writeProductAudit(
  actorUserId: string,
  action: string,
  productId: string,
  details: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabaseAdmin.from("admin_audit_logs").insert({
    actor_user_id: actorUserId,
    action,
    target_type: "product",
    target_id: productId,
    details,
  });

  if (error) {
    // Do not turn a successful product change into a failed response solely
    // because audit logging failed. Keep this visible in server logs.
    console.error("Product audit log insert failed:", error.message);
  }
}

// GET /api/v1/products — includes drafts for authorized product managers.
productsRouter.get(
  "/",
  authenticateAdmin,
  requirePermission("can_manage_products"),
  async (req, res) => {
    const limit = parseIntegerQuery(req.query.limit, 20, 1, 100);
    const offset = parseIntegerQuery(req.query.offset, 0, 0, 1_000_000);
    const isPublished = parseBooleanQuery(req.query.is_published);
    const isAvailable = parseBooleanQuery(req.query.is_available);
    const isTestProduct = parseBooleanQuery(req.query.is_test_product);

    if (
      limit === null ||
      offset === null ||
      isPublished === null ||
      isAvailable === null ||
      isTestProduct === null
    ) {
      res.status(400).json({ error: "Invalid pagination or filter parameters" });
      return;
    }

    const category = typeof req.query.category === "string"
      ? req.query.category.trim()
      : undefined;
    const search = typeof req.query.search === "string"
      ? req.query.search.trim()
      : undefined;

    if ((category?.length ?? 0) > 80 || (search?.length ?? 0) > 120) {
      res.status(400).json({ error: "Category or search filter is too long" });
      return;
    }

    try {
      let query = supabaseAdmin
        .from("products")
        .select("*", { count: "exact" });

      if (category) query = query.eq("category", category);
      if (isPublished !== undefined) query = query.eq("is_published", isPublished);
      if (isAvailable !== undefined) query = query.eq("is_available", isAvailable);
      if (isTestProduct !== undefined) query = query.eq("is_test_product", isTestProduct);
      if (search) {
        const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
        query = query.ilike("name", `%${escapedSearch}%`);
      }

      const { data, error, count } = await query
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error("Product list lookup failed:", error.message);
        res.status(500).json({ error: "Unable to list products" });
        return;
      }

      res.status(200).json({
        products: data ?? [],
        pagination: {
          limit,
          offset,
          total: count ?? 0,
          has_more: (count ?? 0) > offset + (data?.length ?? 0),
        },
      });
    } catch (error) {
      console.error("Product list request failed:", error);
      res.status(500).json({ error: "Unable to list products" });
    }
  },
);

// GET /api/v1/products/:id
productsRouter.get(
  "/:id",
  authenticateAdmin,
  requirePermission("can_manage_products"),
  async (req, res) => {
    const id = uuidSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }

    try {
      const { data, error } = await supabaseAdmin
        .from("products")
        .select("*")
        .eq("id", id.data)
        .maybeSingle();

      if (error) {
        console.error("Product lookup failed:", error.message);
        res.status(500).json({ error: "Unable to retrieve product" });
        return;
      }

      if (!data) {
        res.status(404).json({ error: "Product not found" });
        return;
      }

      res.status(200).json({ product: data });
    } catch (error) {
      console.error("Product lookup request failed:", error);
      res.status(500).json({ error: "Unable to retrieve product" });
    }
  },
);

// POST /api/v1/products — new products always start as drafts.
productsRouter.post(
  "/",
  authenticateAdmin,
  requirePermission("can_manage_products"),
  async (req, res) => {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid product details",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const payload = {
      name: parsed.data.name,
      slug: parsed.data.slug,
      category: parsed.data.category,
      category_label: parsed.data.category_label,
      tagline: parsed.data.tagline ?? "",
      description: parsed.data.description ?? "",
      spotlight_category: parsed.data.spotlight_category ?? "",
      spotlight_description: parsed.data.spotlight_description ?? "",
      taste: parsed.data.taste ?? "",
      uses: parsed.data.uses ?? "",
      card_image_url: parsed.data.card_image_url ?? "",
      image_url: parsed.data.image_url ?? "",
      image_folder: parsed.data.image_folder ?? parsed.data.slug,
      pack_sizes: parsed.data.pack_sizes ?? ["50 g", "100 g", "250 g", "500 g"],
      is_available: parsed.data.is_available ?? true,
      is_published: false,
      is_featured: parsed.data.is_featured ?? false,
      sort_order: parsed.data.sort_order ?? 100,
      is_test_product: parsed.data.is_test_product ?? false,
    };

    try {
      const { data, error } = await supabaseAdmin
        .from("products")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        console.error("Product create failed:", error.message);
        if (error.code === "23505") {
          res.status(409).json({ error: "A product with this slug already exists" });
          return;
        }
        if (error.code === "23514") {
          res.status(400).json({ error: "Product details failed a database constraint" });
          return;
        }
        res.status(500).json({ error: "Unable to create product" });
        return;
      }

      await writeProductAudit(req.admin!.userId, "product.created", data.id, {
        name: data.name,
        slug: data.slug,
      });

      res.status(201).json({ product: data });
    } catch (error) {
      console.error("Product create request failed:", error);
      res.status(500).json({ error: "Unable to create product" });
    }
  },
);

// PATCH /api/v1/products/:id — publication is changed through its own route.
productsRouter.patch(
  "/:id",
  authenticateAdmin,
  requirePermission("can_manage_products"),
  async (req, res) => {
    const id = uuidSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }

    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid product update",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      if (parsed.data.is_test_product === true) {
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("products")
          .select("is_published")
          .eq("id", id.data)
          .maybeSingle();

        if (existingError) {
          console.error("Product pre-update lookup failed:", existingError.message);
          res.status(500).json({ error: "Unable to update product" });
          return;
        }

        if (!existing) {
          res.status(404).json({ error: "Product not found" });
          return;
        }

        if (existing.is_published) {
          res.status(409).json({
            error: "Unpublish the product before marking it as a test product",
          });
          return;
        }
      }

      const { data, error } = await supabaseAdmin
        .from("products")
        .update(parsed.data)
        .eq("id", id.data)
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Product update failed:", error.message);
        if (error.code === "23505") {
          res.status(409).json({ error: "A product with this slug already exists" });
          return;
        }
        if (error.code === "23514") {
          res.status(400).json({ error: "Product details failed a database constraint" });
          return;
        }
        res.status(500).json({ error: "Unable to update product" });
        return;
      }

      if (!data) {
        res.status(404).json({ error: "Product not found" });
        return;
      }

      await writeProductAudit(req.admin!.userId, "product.updated", data.id, {
        changed_fields: Object.keys(parsed.data),
      });

      res.status(200).json({ product: data });
    } catch (error) {
      console.error("Product update request failed:", error);
      res.status(500).json({ error: "Unable to update product" });
    }
  },
);

// PATCH /api/v1/products/:id/publication
productsRouter.patch(
  "/:id/publication",
  authenticateAdmin,
  requirePermission("can_manage_products"),
  async (req, res) => {
    const id = uuidSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }

    const parsed = publicationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "is_published must be a boolean",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    try {
      if (parsed.data.is_published) {
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("products")
          .select("is_test_product")
          .eq("id", id.data)
          .maybeSingle();

        if (existingError) {
          console.error("Product publication pre-check failed:", existingError.message);
          res.status(500).json({ error: "Unable to update product publication" });
          return;
        }

        if (!existing) {
          res.status(404).json({ error: "Product not found" });
          return;
        }

        if (existing.is_test_product) {
          res.status(409).json({
            error: "Test products cannot be published. Remove the test flag first.",
          });
          return;
        }
      }

      const { data, error } = await supabaseAdmin
        .from("products")
        .update({ is_published: parsed.data.is_published })
        .eq("id", id.data)
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Product publication update failed:", error.message);
        res.status(500).json({ error: "Unable to update product publication" });
        return;
      }

      if (!data) {
        res.status(404).json({ error: "Product not found" });
        return;
      }

      await writeProductAudit(req.admin!.userId, "product.publication_changed", data.id, {
        is_published: data.is_published,
      });

      res.status(200).json({ product: data });
    } catch (error) {
      console.error("Product publication request failed:", error);
      res.status(500).json({ error: "Unable to update product publication" });
    }
  },
);

export default productsRouter;
