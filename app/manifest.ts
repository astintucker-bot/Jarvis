import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "J.A.R.V.I.S. AI Command Center", short_name: "JARVIS", description: "Voice AI assistant and application builder", start_url: "/", display: "standalone", background_color: "#03070c", theme_color: "#071a2b" };
}
