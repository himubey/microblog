import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const postId = String(form.get("post_id") || "").trim();
  const quoteText = String(form.get("quote_text") || "").trim();

  if (!postId) {
    return context.redirect("/home?error=missing_post");
  }
  if (!quoteText) {
    return context.redirect(context.request.headers.get("referer") || "/home");
  }

  const supabase = getSupabaseServerClient(context);
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return context.redirect("/login");

  await supabase.from("reposts").upsert({
    post_id: postId,
    user_id: user.id,
    type: "quote",
    quote_text: quoteText,
  });

  return context.redirect(context.request.headers.get("referer") || "/home");
};
