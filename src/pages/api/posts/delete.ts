import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const postId = String(form.get("post_id") || "").trim();

  if (!postId) {
    return context.redirect("/home?error=missing_post");
  }

  const supabase = getSupabaseServerClient(context);
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return context.redirect("/login");

  const { data: postRow } = await supabase
    .from("posts")
    .select("id, author_id")
    .eq("id", postId)
    .single();

  if (!postRow || postRow.author_id !== user.id) {
    return context.redirect("/home?error=forbidden");
  }

  const unpin = await supabase
    .from("profiles")
    .update({ pinned_post_id: null })
    .eq("id", user.id)
    .eq("pinned_post_id", postId);
  if (unpin.error?.message?.includes("pinned_post_id")) {
    // Pinning not enabled in DB; ignore.
  }
  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) {
    const msg = encodeURIComponent(error.message || "Failed to delete post.");
    return context.redirect(`/home?error=${msg}`);
  }

  return context.redirect(context.request.headers.get("referer") || "/home");
};
