import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel/serverless";
import Icons from "unplugin-icons/vite";

export default defineConfig({
  output: "server",
  adapter: vercel(),
  vite: {
    plugins: [
      Icons({
        compiler: "astro"
      })
    ]
  }
});
