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

  const { data: postRow } = await supabase
    .from("posts")
    .select("author_id")
    .eq("id", postId)
    .maybeSingle();

  const { data: author } = postRow?.author_id
    ? await supabase
        .from("profiles")
        .select("username")
        .eq("id", postRow.author_id)
        .maybeSingle()
    : { data: null };

  const username = author?.username || user?.email?.split("@")[0] || "user";
  return context.redirect(`/${username}/post/${postId}`);
};
