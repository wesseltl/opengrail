import handler from "vinext/server/fetch-handler";
import type { SelfHostedEnv } from "../selfhost/env";
import { runWithHumanAuthContext } from "../lib/human-auth-context";
import { runWithConnectorBinding } from "../lib/connector-context";
import {
  parseSelfHostedAuthConfig,
  handleSelfHostedAuth,
  createSelfHostedCurrentUser,
} from "../lib/selfhost-auth";

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function unavailable(): Response {
  return Response.json({ error: "Sign-in is unavailable." }, { status: 503, headers: privateHeaders });
}

function configuredOrigin(value: string): string {
  const origin = new URL(value);
  if (origin.protocol !== "https:" || origin.origin !== value || origin.username || origin.password) {
    throw new Error("Invalid standalone origin.");
  }
  return origin.origin;
}

function stripCallerIdentity(request: Request): Request {
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) {
    if (name.startsWith("oai-authenticated-user-")) headers.delete(name);
  }
  return new Request(request, { headers });
}

/** Separate target. A browser cannot select the Sites dispatcher adapter. */
export default {
  async fetch(request: Request, env: SelfHostedEnv, ctx: ExecutionContext): Promise<Response> {
    let origin: string;
    try { origin = configuredOrigin(env.OPENGRAIL_EXTERNAL_ORIGIN); }
    catch { return unavailable(); }
    const url = new URL(request.url);
    // The configured HTTPS origin controls callback, cookies and human writes.
    // Host/Origin/forwarding metadata never selects another authentication mode.
    if (url.origin !== origin) {
      return Response.json({ error: "Invalid application origin." }, { status: 403, headers: privateHeaders });
    }
    const cleanRequest = stripCallerIdentity(request);
    let config: ReturnType<typeof parseSelfHostedAuthConfig>;
    try {
      config = parseSelfHostedAuthConfig({
        origin,
        metadataJson: env.OPENGRAIL_OIDC_METADATA,
        clientId: env.OPENGRAIL_OIDC_CLIENT_ID,
        clientSecret: env.OPENGRAIL_OIDC_CLIENT_SECRET,
        sessionEpoch: env.OPENGRAIL_AUTH_EPOCH,
      });
      if (!env.AUTH_DB) throw new Error("Missing standalone authentication storage.");
    } catch {
      if (url.pathname.startsWith("/auth/") ||
          ["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"].includes(url.pathname)) {
        return unavailable();
      }
      // Browsing can remain anonymous while the operator finishes configuration.
      // Missing configuration cannot recover an identity from a cookie or header.
      try {
        return await runWithHumanAuthContext({kind: "SELF_HOSTED", currentUser: async () => null},
          () => runWithConnectorBinding(undefined, () => handler.fetch(cleanRequest, env, ctx)));
      } catch { return unavailable(); }
    }
    try {
      const authResponse = await handleSelfHostedAuth(cleanRequest, config, env.AUTH_DB);
      if (authResponse) return authResponse;
      const currentUser = createSelfHostedCurrentUser(cleanRequest, config, env.AUTH_DB);
      return await runWithHumanAuthContext({kind: "SELF_HOSTED", currentUser},
        () => runWithConnectorBinding(undefined, () => handler.fetch(cleanRequest, env, ctx)));
    } catch {
      // Never log authorization codes, cookies, provider bodies or personal claims.
      console.error(JSON.stringify({ event: "selfhost_authentication_unavailable" }));
      return unavailable();
    }
  },
} satisfies ExportedHandler<SelfHostedEnv>;
