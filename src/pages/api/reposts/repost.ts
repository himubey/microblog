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

  const { data: existing } = await supabase
    .from("reposts")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("reposts").delete().eq("post_id", postId).eq("user_id", user.id);
  } else {
    await supabase.from("reposts").insert({ post_id: postId, user_id: user.id, type: "repost" });
  }

  return context.redirect(context.request.headers.get("referer") || "/home");
};
