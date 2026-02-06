import { createServerClient } from "@supabase/ssr";
import type { APIContext } from "astro";

const supabaseUrl = import.meta.env.SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.SUPABASE_ANON_KEY as string;

export function getSupabaseServerClient(context: APIContext) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return context.cookies.get(name)?.value;
      },
      set(name, value, options) {
        context.cookies.set(name, value, options);
      },
      remove(name, options) {
        context.cookies.delete(name, options);
      },
    },
  });
}
