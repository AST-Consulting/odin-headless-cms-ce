import { refitMedia } from "./api";
import { toast } from "sonner";

export type FeaturedImageLike = { url: string; id: string; path: string };

/**
 * Ensure a selected media matches the article's featured-image aspect ratio.
 * Calls the server-side refit endpoint, which pads non-matching images with a
 * blurred copy of themselves and returns a new media record. If the image
 * already matches the target (or the refit fails), the original is returned
 * unchanged. Shows a loading toast; safe to call on every featured-image
 * selection path (block click, SEO sidebar, dialog save, etc.).
 */
export async function refitToFeaturedAspect(
  image: FeaturedImageLike,
  articleType: string,
  propertyId?: string,
): Promise<FeaturedImageLike> {
  const targetAspect =
    articleType === "web_story" || articleType === "shorts" ? "9:16" : "16:9";
  const toastId = toast.loading("Setting featured image...");
  try {
    const refitted = await refitMedia(image.id, targetAspect, propertyId);
    if (refitted?._id && refitted._id !== image.id) {
      return { url: refitted.url, id: refitted._id, path: refitted.path };
    }
  } catch (err) {
    console.error("Refit failed, using original image:", err);
  } finally {
    toast.dismiss(toastId);
  }
  return image;
}
