import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page/API in J.A.R.V.I.S. is dynamic and private, so no incremental
// cache (R2/KV) is needed.
export default defineCloudflareConfig({});
