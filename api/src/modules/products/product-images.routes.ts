import { Router }     from "express";
import multer         from "multer";
import { randomUUID } from "node:crypto";
import { z }          from "zod";

import { supabaseAdmin     } from "../../config/supabase.js";
import { authenticateAdmin } from "../../middleware/authenticate.js";
import { requirePermission } from "../../middleware/requirePermission.js";

const productImagesRouter = Router();

const uuidSchema = z.string().uuid();

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
  if (error) console.error("Product image audit log insert failed:", error.message);
}

const IMAGE_BUCKET = "product-images";
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES_PER_UPLOAD = 10;
const allowedImageTypes: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: MAX_IMAGES_PER_UPLOAD,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageTypes[file.mimetype]) {
      callback(new Error("Only AVIF, GIF, JPEG, PNG, and WebP images are allowed"));
      return;
    }
    callback(null, true);
  },
});

const imageFallbackSchema = z.object({
  image_name: z.string().trim().min(1).max(255),
  target: z.enum(["card", "primary", "both"]).default("both"),
}).strict();

const imageNameSchema = z.string().min(1).max(255).regex(
  /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/,
  "Invalid image name",
);

function isSupportedImageName(name: string): boolean {
  return /\.(avif|gif|jpe?g|png|webp)$/i.test(name);
}

function getProductImageUrl(imageFolder: string, imageName: string): string {
  const { data } = supabaseAdmin.storage
    .from(IMAGE_BUCKET)
    .getPublicUrl(`${imageFolder}/${imageName}`);
  return data.publicUrl;
}

async function getProductForImages(productId: string) {
  return supabaseAdmin
    .from("products")
    .select("id, name, slug, image_folder, card_image_url, image_url")
    .eq("id", productId)
    .maybeSingle();
}

function imageUrlReferences(url: string | null, imageFolder: string, imageName: string): boolean {
  if (!url) return false;
  const expectedUrl = getProductImageUrl(imageFolder, imageName);
  return url === expectedUrl || url.endsWith(`/${imageFolder}/${imageName}`);
}

// GET /api/v1/products/:id/images — list images in the product's existing folder.
productImagesRouter.get(
  "/:id/images",
  authenticateAdmin,
  requirePermission("can_manage_products"),
  async (req, res) => {
    const id = uuidSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }

    try {
      const { data: product, error: productError } = await getProductForImages(id.data);
      if (productError) {
        console.error("Product image lookup failed:", productError.message);
        res.status(500).json({ error: "Unable to retrieve product images" });
        return;
      }
      if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
      }
      if (!product.image_folder) {
        res.status(200).json({ product_id: product.id, image_folder: "", images: [] });
        return;
      }

      const { data, error } = await supabaseAdmin.storage
        .from(IMAGE_BUCKET)
        .list(product.image_folder, {
          limit: 100,
          sortBy: { column: "name", order: "asc" },
        });

      if (error) {
        console.error("Product image list failed:", error.message);
        res.status(500).json({ error: "Unable to list product images" });
        return;
      }

      const images = (data ?? [])
        .filter((file) => file.name && isSupportedImageName(file.name))
        .map((file) => ({
          name: file.name,
          path: `${product.image_folder}/${file.name}`,
          url: getProductImageUrl(product.image_folder, file.name),
          is_card_fallback: imageUrlReferences(product.card_image_url, product.image_folder, file.name),
          is_primary_fallback: imageUrlReferences(product.image_url, product.image_folder, file.name),
          size: file.metadata?.size ?? null,
          content_type: file.metadata?.mimetype ?? null,
          updated_at: file.updated_at ?? null,
        }));

      res.status(200).json({
        product_id: product.id,
        image_folder: product.image_folder,
        images,
      });
    } catch (error) {
      console.error("Product image list request failed:", error);
      res.status(500).json({ error: "Unable to list product images" });
    }
  },
);

// POST /api/v1/products/:id/images — upload into the product's existing image_folder.
productImagesRouter.post(
  "/:id/images",
  authenticateAdmin,
  requirePermission("can_manage_products"),
  (req, res, next) => {
    imageUpload.array("images", MAX_IMAGES_PER_UPLOAD)(req, res, (error: unknown) => {
      if (error) {
        const message = error instanceof Error ? error.message : "Invalid image upload";
        const status = message.toLowerCase().includes("file too large") ? 413 : 400;
        res.status(status).json({ error: message });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    const id = uuidSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }

    const files = (req.files ?? []) as Express.Multer.File[];
    if (files.length === 0) {
      res.status(400).json({ error: 'Attach at least one file using the "images" field' });
      return;
    }

    try {
      const { data: product, error: productError } = await getProductForImages(id.data);
      if (productError) {
        console.error("Product image upload lookup failed:", productError.message);
        res.status(500).json({ error: "Unable to upload product images" });
        return;
      }
      if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
      }

      // image_folder defaults to the product slug. Existing folders are preserved.
      const imageFolder = product.image_folder || product.slug;
      if (!/^[a-zA-Z0-9_-]+$/.test(imageFolder)) {
        res.status(400).json({ error: "Product image folder has an unsupported name" });
        return;
      }

      const uploadedPaths: string[] = [];
      const uploadedImages: Array<{ name: string; path: string; url: string }> = [];

      for (const file of files) {
        const extension = allowedImageTypes[file.mimetype];
        if (!extension) {
          res.status(400).json({ error: `Unsupported image type for ${file.originalname}` });
          return;
        }

        const imageName = `${Date.now()}-${randomUUID()}.${extension}`;
        const path = `${imageFolder}/${imageName}`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from(IMAGE_BUCKET)
          .upload(path, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          // Best-effort cleanup keeps a failed multi-file upload from leaving orphan files.
          if (uploadedPaths.length) {
            const { error: cleanupError } = await supabaseAdmin.storage
              .from(IMAGE_BUCKET)
              .remove(uploadedPaths);
            if (cleanupError) console.error("Product image upload cleanup failed:", cleanupError.message);
          }
          console.error("Product image upload failed:", uploadError.message);
          res.status(500).json({ error: "Unable to upload all product images" });
          return;
        }

        uploadedPaths.push(path);
        uploadedImages.push({
          name: imageName,
          path,
          url: getProductImageUrl(imageFolder, imageName),
        });
      }

      // Only populate fallback fields when currently empty; preserve intentional choices.
      const fallbackUpdate: Record<string, string> = {};
      if (!product.image_folder) fallbackUpdate.image_folder = imageFolder;
      if (!product.card_image_url) fallbackUpdate.card_image_url = uploadedImages[0].url;
      if (!product.image_url) fallbackUpdate.image_url = uploadedImages[0].url;

      if (Object.keys(fallbackUpdate).length) {
        const { error: updateError } = await supabaseAdmin
          .from("products")
          .update(fallbackUpdate)
          .eq("id", product.id);

        if (updateError) {
          const { error: cleanupError } = await supabaseAdmin.storage
            .from(IMAGE_BUCKET)
            .remove(uploadedPaths);
          if (cleanupError) console.error("Product image rollback failed:", cleanupError.message);
          console.error("Product fallback image update failed:", updateError.message);
          res.status(500).json({ error: "Images uploaded but fallback references could not be saved" });
          return;
        }
      }

      await writeProductAudit(req.admin!.userId, "product.images_uploaded", product.id, {
        count: uploadedImages.length,
        image_names: uploadedImages.map((image) => image.name),
      });

      res.status(201).json({
        product_id: product.id,
        image_folder: imageFolder,
        images: uploadedImages,
        fallbacks_updated: Object.keys(fallbackUpdate),
      });
    } catch (error) {
      console.error("Product image upload request failed:", error);
      res.status(500).json({ error: "Unable to upload product images" });
    }
  },
);

// PATCH /api/v1/products/:id/images/fallback — explicitly select fallback image(s).
productImagesRouter.patch(
  "/:id/images/fallback",
  authenticateAdmin,
  requirePermission("can_manage_products"),
  async (req, res) => {
    const id = uuidSchema.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }
    const parsed = imageFallbackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid image fallback selection",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    if (!imageNameSchema.safeParse(parsed.data.image_name).success || !isSupportedImageName(parsed.data.image_name)) {
      res.status(400).json({ error: "Invalid image name" });
      return;
    }

    try {
      const { data: product, error: productError } = await getProductForImages(id.data);
      if (productError) {
        console.error("Product fallback lookup failed:", productError.message);
        res.status(500).json({ error: "Unable to update image fallback" });
        return;
      }
      if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
      }

      const imageFolder = product.image_folder || product.slug;
      if (!/^[a-zA-Z0-9_-]+$/.test(imageFolder)) {
        res.status(400).json({ error: "Product image folder has an unsupported name" });
        return;
      }

      const { data: imageList, error: listError } = await supabaseAdmin.storage
        .from(IMAGE_BUCKET)
        .list(imageFolder, { limit: 100 });
      if (listError) {
        console.error("Product fallback image verification failed:", listError.message);
        res.status(500).json({ error: "Unable to verify selected image" });
        return;
      }
      if (!(imageList ?? []).some((file) => file.name === parsed.data.image_name && isSupportedImageName(file.name))) {
        res.status(404).json({ error: "Image not found in this product's folder" });
        return;
      }

      const imageUrl = getProductImageUrl(imageFolder, parsed.data.image_name);
      const updates: Record<string, string> = {};
      if (parsed.data.target === "card" || parsed.data.target === "both") updates.card_image_url = imageUrl;
      if (parsed.data.target === "primary" || parsed.data.target === "both") updates.image_url = imageUrl;

      const { data, error } = await supabaseAdmin
        .from("products")
        .update(updates)
        .eq("id", product.id)
        .select("id, card_image_url, image_url")
        .single();

      if (error) {
        console.error("Product fallback update failed:", error.message);
        res.status(500).json({ error: "Unable to update image fallback" });
        return;
      }

      await writeProductAudit(req.admin!.userId, "product.image_fallback_changed", product.id, {
        image_name: parsed.data.image_name,
        target: parsed.data.target,
      });

      res.status(200).json({ product: data });
    } catch (error) {
      console.error("Product fallback update request failed:", error);
      res.status(500).json({ error: "Unable to update image fallback" });
    }
  },
);

// DELETE /api/v1/products/:id/images/:imageName — refuse deletion while referenced as fallback.
productImagesRouter.delete(
  "/:id/images/:imageName",
  authenticateAdmin,
  requirePermission("can_manage_products"),
  async (req, res) => {
    const id = uuidSchema.safeParse(req.params.id);
    const imageName = imageNameSchema.safeParse(req.params.imageName);
    if (!id.success) {
      res.status(400).json({ error: "Invalid product ID" });
      return;
    }
    if (!imageName.success || !isSupportedImageName(imageName.data)) {
      res.status(400).json({ error: "Invalid image name" });
      return;
    }

    try {
      const { data: product, error: productError } = await getProductForImages(id.data);
      if (productError) {
        console.error("Product image delete lookup failed:", productError.message);
        res.status(500).json({ error: "Unable to delete product image" });
        return;
      }
      if (!product) {
        res.status(404).json({ error: "Product not found" });
        return;
      }

      const imageFolder = product.image_folder || product.slug;
      if (!/^[a-zA-Z0-9_-]+$/.test(imageFolder)) {
        res.status(400).json({ error: "Product image folder has an unsupported name" });
        return;
      }

      const { data: imageList, error: listError } = await supabaseAdmin.storage
        .from(IMAGE_BUCKET)
        .list(imageFolder, { limit: 100 });
      if (listError) {
        console.error("Product image delete verification failed:", listError.message);
        res.status(500).json({ error: "Unable to verify product image" });
        return;
      }
      if (!(imageList ?? []).some((file) => file.name === imageName.data && isSupportedImageName(file.name))) {
        res.status(404).json({ error: "Image not found in this product's folder" });
        return;
      }

      if (
        imageUrlReferences(product.card_image_url, imageFolder, imageName.data) ||
        imageUrlReferences(product.image_url, imageFolder, imageName.data)
      ) {
        res.status(409).json({
          error: "This image is currently a fallback. Select a different fallback image before deleting it.",
        });
        return;
      }

      const path = `${imageFolder}/${imageName.data}`;
      const { error: removeError } = await supabaseAdmin.storage
        .from(IMAGE_BUCKET)
        .remove([path]);
      if (removeError) {
        console.error("Product image delete failed:", removeError.message);
        res.status(500).json({ error: "Unable to delete product image" });
        return;
      }

      await writeProductAudit(req.admin!.userId, "product.image_deleted", product.id, {
        image_name: imageName.data,
        path,
      });

      res.status(200).json({ deleted: true, image_name: imageName.data });
    } catch (error) {
      console.error("Product image delete request failed:", error);
      res.status(500).json({ error: "Unable to delete product image" });
    }
  },
);


export default productImagesRouter;
