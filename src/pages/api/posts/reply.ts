import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const content = String(form.get("content") || "").trim();
  const postId = String(form.get("post_id") || "").trim();

  if (!postId) {
    return context.redirect("/home?error=missing_post");
  }
  if (!content) {
    return context.redirect(`/post/${postId}?error=empty`);
  }
  if (content.length > 140) {
    return context.redirect(`/post/${postId}?error=toolong`);
  }

  const supabase = getSupabaseServerClient(context);
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return context.redirect("/login");

  const { error } = await supabase.from("posts").insert({
    author_id: user.id,
    content,
    reply_to_id: postId,
  });

  if (error) {
    const msg = encodeURIComponent(error.message || "Failed to reply.");
    return context.redirect(`/post/${postId}?error=${msg}`);
  }

  return context.redirect(`/post/${postId}`);
};
