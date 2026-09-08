import type { MetadataRoute } from "next";

/** Private school platform: never indexed by search engines. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
