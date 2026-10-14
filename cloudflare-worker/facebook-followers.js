/**
 * Dynamflow Store - Facebook follower counter
 * ===========================================
 *
 * This tiny Cloudflare Worker asks Facebook for the follower count of the
 * Dynamflow Store page and hands the answer back to the website as JSON.
 *
 * It exists so the Page access token never has to appear in the website
 * files: the token lives only here, as an encrypted Worker secret.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT RETURNS
 * ---------------------------------------------------------------------------
 *   { "followers": 1234, "page": "Dynamflow Store", "link": "https://...", "updated": "..." }
 *
 * If Facebook cannot be reached, or the token is wrong, it returns
 *   { "error": "..." }
 * with a non-200 status. The website then simply keeps the number hidden -
 * it will never show an invented figure.
 *
 * ---------------------------------------------------------------------------
 * SETUP (about five minutes - full steps in README.md next to this file)
 * ---------------------------------------------------------------------------
 *   1. Get a Page access token from the Facebook Graph API Explorer.
 *   2. Create the Worker and paste this file in.
 *   3. Add two encrypted secrets:  PAGE_ID  and  PAGE_TOKEN
 *   4. (Optional) add a plain variable ALLOWED_ORIGIN with your website address.
 *   5. Copy the Worker URL into js/dynamflow-data.js:
 *          followersEndpoint: "https://your-worker.workers.dev/"
 */

const GRAPH_VERSION = "v21.0";

/* How long the count is cached at Cloudflare's edge, in seconds. Keeps the
 * site quick and stays well inside Facebook's rate limits. */
const CACHE_SECONDS = 300;

function corsHeaders(env) {
  const allowed = (env && env.ALLOWED_ORIGIN) ? env.ALLOWED_ORIGIN : "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(body, status, env, extra) {
  const headers = Object.assign(
    {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=" + CACHE_SECONDS
    },
    corsHeaders(env),
    extra || {}
  );
  return new Response(JSON.stringify(body), { status: status, headers: headers });
}

export default {
  async fetch(request, env, ctx) {
    /* CORS pre-flight - browsers ask this before the real call. */
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    if (request.method !== "GET") {
      return json({ error: "Use GET." }, 405, env);
    }

    const pageId = env.PAGE_ID;
    const token = env.PAGE_TOKEN;

    if (!pageId || !token) {
      return json(
        { error: "PAGE_ID and PAGE_TOKEN are not both set on this Worker." },
        500,
        env
      );
    }

    /* Serve from the edge cache when we can. */
    const cache = caches.default;
    const cacheKey = new Request(
      new URL(request.url).origin + "/__followers/" + pageId,
      { method: "GET" }
    );

    const hit = await cache.match(cacheKey);
    if (hit) {
      const body = await hit.text();
      return new Response(body, {
        status: 200,
        headers: Object.assign(
          { "Content-Type": "application/json; charset=utf-8", "X-Cache": "HIT" },
          corsHeaders(env)
        )
      });
    }

    const graphUrl =
      "https://graph.facebook.com/" + GRAPH_VERSION + "/" +
      encodeURIComponent(pageId) +
      "?fields=" + encodeURIComponent("followers_count,fan_count,name,link") +
      "&access_token=" + encodeURIComponent(token);

    let payload;
    try {
      const upstream = await fetch(graphUrl, { headers: { Accept: "application/json" } });
      payload = await upstream.json();

      if (!upstream.ok || payload.error) {
        const message = (payload && payload.error && payload.error.message) ||
          ("Facebook returned status " + upstream.status);
        return json({ error: message }, 502, env, { "Cache-Control": "no-store" });
      }
    } catch (err) {
      return json(
        { error: "Could not reach Facebook: " + String(err && err.message ? err.message : err) },
        502,
        env,
        { "Cache-Control": "no-store" }
      );
    }

    /* followers_count is what a modern Page reports; fan_count is the older
     * field Facebook still returns. Use whichever is present. */
    const followers =
      typeof payload.followers_count === "number" ? payload.followers_count :
      typeof payload.fan_count === "number" ? payload.fan_count : null;

    if (followers === null) {
      return json(
        { error: "Facebook did not return a follower count for this page." },
        502,
        env,
        { "Cache-Control": "no-store" }
      );
    }

    const body = {
      followers: followers,
      page: payload.name || null,
      link: payload.link || null,
      updated: new Date().toISOString()
    };

    const response = json(body, 200, env, { "X-Cache": "MISS" });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  }
};
