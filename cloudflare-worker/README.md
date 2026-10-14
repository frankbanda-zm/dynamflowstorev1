# Live Facebook follower count

This folder holds one small **Cloudflare Worker** that turns the Dynamflow
Store Facebook page into a follower number your website can display.

You only need it if you want the **live follower count** on the site. The
Facebook link itself already works without any of this.

Nothing is shown until it is set up — the website never invents a number.

---

## Why a Worker?

Facebook will not let a normal web page read a page's follower count directly.
Facebook needs a **Page access token**, and a token pasted into website
JavaScript is visible to anyone who opens "View source", which lets strangers
use your page's permissions.

The Worker keeps the token on Cloudflare's servers, asks Facebook on your
behalf, and returns only the number. Your website never sees the token.

---

## Step 1 — Get a Page access token

1. Make sure you are an **admin of the Dynamflow Store Facebook page**.
2. Open the Graph API Explorer: <https://developers.facebook.com/tools/explorer/>
3. In the top-right **Meta App** box, pick (or create) an app.
   * Creating one: *Create App → Other → Business*, it takes about a minute.
4. Press **Generate Access Token** and approve the permissions
   `pages_show_list` and `pages_read_engagement`.
4. In the **User or Page** drop-down choose **Get Page Access Token** and pick
   **Dynamflow Store**.
5. You now see a long token that starts with `EAA...`. **Copy it.**

> A token from the Explorer expires after about an hour — good enough for a
> first test. For a permanent one, see **Step 5** at the bottom.

---

## Step 2 — Create the Worker

1. Sign in at <https://dash.cloudflare.com/> (the free plan is enough).
2. Left menu → **Workers & Pages** → **Create** → **Create Worker**.
4. Give it a name, for example `dynamflow-followers`, and click **Deploy**.
5. Click **Edit code**, delete everything in the editor, paste the whole of
   `facebook-followers.js` from this folder, then **Save and deploy**.
6. Copy the Worker address shown at the top, it looks like
   `https://dynamflow-followers.YOUR-NAME.workers.dev`

---

## Step 2b — Add the two secrets

Still in the Worker's page:

1. Open **Settings → Variables and Secrets**.
2. Add a **secret** named `PAGE_ID` with your page id: `61587012572604`
3. Add a **secret** named `PAGE_TOKEN` and paste the token from Step 1.
4. *(Optional)* add a plain **variable** named `ALLOWED_ORIGIN` set to your
   website address, for example `https://www.dynamflow.com`. If you leave this
   out the Worker answers any website, which is fine while you are testing.
5. **Save and deploy** again.

---

## Step 3 — Test it

Open the Worker address in a browser. You should see something like:

```json
{"followers":152,"page":"Dynamflow Store","link":"https://www.facebook.com/...","updated":"2026-01-01T10:00:00.000Z"}
```

If you see an `"error"` message instead, the message tells you what Facebook
objected to (usually an expired token).

---

## Step 4 — Switch the count on in the website

Open **`js/dynamflow-data.js`** and put your Worker address in the
`followersEndpoint` line:

```js
followersEndpoint: "https://dynamflow-followers.YOUR-NAME.workers.dev/",
```

Save the file and refresh the website. The blue follower badge now appears next
to the Facebook button in the footer (and on the Contact and Information
pages). It refreshes itself about once a minute.

To switch the number off again, set `followersEndpoint` back to `""`.

---

## Step 5 — Make the token last longer

Tokens from the Graph API Explorer expire after one to two hours. For a number
that keeps working, create a **long-lived Page token**:

1. In the Graph API Explorer get a **User** token with `pages_show_list`,
   `pages_read_engagement` and `pages_manage_metadata`.
2. Open
   `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_LIVED_USER_TOKEN`
   (replace `APP_ID`, `APP_SECRET` and the token with your own values).
3. The `access_token` in the reply is a long-lived **user** token.
4. Call `https://graph.facebook.com/v21.0/me/accounts?access_token=LONG_LIVED_USER_TOKEN`
   and copy the `access_token` printed next to the Dynamflow Store page — that
   is a long-lived **Page** token.
5. Put that value into the `PAGE_TOKEN` secret and deploy again.

Details: <https://developers.facebook.com/docs/facebook-login/guides/access-tokens#pagetokens>
