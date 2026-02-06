import type { APIRoute } from "astro";
import { getSupabaseServerClient } from "../../../lib/supabase/server";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const content = String(form.get("content") || "").trim();

  if (!content) {
    return context.redirect("/home?error=empty");
  }
  if (content.length > 140) {
    return context.redirect("/home?error=toolong");
  }

  const supabase = getSupabaseServerClient(context);
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return context.redirect("/login");
  }

  const { error } = await supabase.from("posts").insert({
    author_id: user.id,
    content,
  });

  if (error) {
    const msg = encodeURIComponent(error.message || "Failed to create post.");
    return context.redirect(`/home?error=${msg}`);
  }

  return context.redirect("/home");
};
