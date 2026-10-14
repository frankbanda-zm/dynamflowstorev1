# How to edit the Dynamflow Store website

Almost everything you will ever want to change lives in **one file**:

```
js/dynamflow-data.js
```

Open it in any text editor (Notepad, Notepad++, VS Code…), change the lines
you care about, **save**, and refresh the website. Nothing else needs to be
touched.

If you make a mistake, the website simply ignores the product with the mistake
— it will not go blank. Undo your last change and save again.

**The two lines you will use most:**

* `price: 250` — the price. Write `null` to show "Price on request".
* `img:` + `images: [...]` — the product's photos, up to 5 in total.

---

## 1. Change a product photo (up to 5 photos per product)

Every product can show **5 photos**: one main photo plus four gallery photos.

1. Put your photos in the folder **`img/products/`**.
   * Use short names with **no spaces**, for example `smart-watch.jpg`,
     `smart-watch-2.jpg`, `smart-watch-3.jpg`
   * `.jpg`, `.png` and `.webp` all work
   * A square photo (or 4:3) at about **600 × 600 px or bigger** looks best
2. Find your product in `js/dynamflow-data.js`:

```js
    {
        id: "p9",
        name: "Smart Watch",
        category: "Watches",
        price: null,

        img: "img/products/smart-watch.jpg",          <-- PHOTO 1 (shown on every card)
        images: [                                     <-- PHOTOS 2, 3, 4 and 5
            "img/products/smart-watch-2.jpg",
            "img/products/smart-watch-3.jpg",
            "img/products/smart-watch-4.jpg",
            "img/products/smart-watch-5.jpg"
        ],
```

3. Save and refresh. The main photo is used on the product cards; all of the
   photos appear in the picture gallery on the product page.

**To use only one photo**, leave the list empty:

```js
        images: [],
```

**The easy way:** each product already names the files it expects, so if you
simply save your photos with those exact names in `img/products/` you do not
have to edit any code at all. Product `p9`, for example, looks for
`img/products/smart-watch.jpg` first.

Until a photo file exists, that picture shows a tidy grey **"Photo coming
soon"** panel instead of a broken image. That panel is also a to-do list:
every card showing it still needs its photo.

> A product can never show more than 5 photos. Extra entries in the list are
> ignored.

---

## 2. Change a product description

Find the product and edit the text inside the quotes on the `description:` line:

```js
        description: "Comfortable over-ear headphones with cushioned ear cups. " +
            "Suitable for music, studying and long calls. Contact us for the current price."
```

Keep the quotes and the little `" +` at the end of each line. The description
appears on the product page and is included in the website search.

---

## 3. Put in a price

The price lives on the `price:` line of the product. Type the number only —
no "K", no spaces, and a full stop for ngwee. You always type the **Kwacha**
price; the shop works out the US-Dollar figure for you:

```js
        price: 250,          // the shop shows  K250.00
        price: 250.50,       // the shop shows  K250.50
        price: null,         // the shop shows  "Price on request"
```

You can also show a crossed-out older price. This crossed-out price shows **on
the home page** (it is the "was / now" style shoppers expect there); other
pages show just the current price:

```js
        price: 250.00,
        oldPrice: 300.00,        // home page shows a crossed-out K300.00 next to K250.00
        oldPrice: null,          // no crossed-out price (the usual choice)
```

Only enter a price — including an `oldPrice` — that you are really selling at.
An "old price" is a real earlier price for that item, not a made-up one.

Only enter a price you are really selling at. While a product shows "Price on
request" the shopper is invited to call or WhatsApp you for the current price.
The price you type appears on the product cards, the product page, in search
results, in the cart and at checkout — all from this one line.

### Kwacha and US Dollars — a click to change

Prices always start in **Kwacha**. Shoppers can click the currency picker in the
header (the little **K ZMW** control) and choose **US Dollar** to see every
price — product cards, the product page, the cart, the checkout and the header
total — in dollars. On phones the same control is the round **K** button in the
mobile header: tap it to flip between Kwacha and Dollars. The choice is
remembered on the shopper's own device.

You only ever type the **Kwacha** figure; the dollar amount is worked out from a
live exchange rate that the shop fetches from a free public service
(`open.er-api.com`) and remembers for an hour, so it follows the rate on its own.

Two things worth knowing:

* **No internet, no guess.** If the rate cannot be fetched, the US-Dollar option
  stays switched off and the shop simply shows Kwacha. It never shows an
  invented dollar figure.
* **The settings live in `js/dynamflow-data.js`**, near the top under
  `currency`. Leave them alone unless you want to change how it works:

```js
        currency: "K",                 // the main currency symbol
        secondaryCurrency: "$",        // the second currency symbol
        selectedCurrency: "ZMW",       // what the shopper is viewing (they change it)
        exchangeRateUrl: "https://open.er-api.com/v6/latest/ZMW",
        exchangeRateRefreshMinutes: 60 // how long a fetched rate is reused
```

---

## 3c. Coupons (private — you decide who gets them)

The shop can take a percentage off the basket for a coupon code. The coupon is
**private**: it is never shown or advertised anywhere on the website. Shoppers
only get it if you give it to them. There is a plain "Coupon code" box on the
Cart page where someone you have given the code to can type it in — the discount
is then shown on the cart and again at checkout.

The codes live in `js/dynamflow-data.js`, near the top. To change the name or the
percentage, edit this one line:

```js
        coupons: { "DYNAM26": 0.10 },   // "NAME": fraction off  (0.10 = 10% off)
```

* **Change the name:** rename `"DYNAM26"` to anything you like, e.g. `"FRANK10"`.
* **Change the percentage:** change `0.10` — use `0.15` for 15% off, `0.20` for
  20% off, `0.05` for 5% off, and so on.
* **More than one code:** add it inside the braces, separated by a comma:

```js
        coupons: { "DYNAM26": 0.10, "FRIENDS15": 0.15 },
```

Give the exact code you set here to the people you choose. Leave the list empty
(`coupons: {}`) to switch coupons off completely.

---

## 3d. Customer reviews (real ones only, shown without pictures)

Reviews appear on the product page, under the **Reviews** tab. They are shown
**without any pictures** — just the name, the stars, the date and the words.

A shopper sends a review through the "Leave a Reply" form on the product page;
it arrives in your email. When you are happy to publish it, add it yourself in
the `REVIEWS` list in `js/dynamflow-data.js` (just under the product list):

```js
    var REVIEWS = [
        {
            product: "p7",                 // the product id the review is for
            name: "Chanda M.",             // the reviewer's name
            rating: 5,                     // 1 to 5 stars
            date: "2026-02-14",            // the date you received it
            text: "Works great, fast delivery."
        }
    ];
```

Only the reviews you type here are shown. The list is empty to begin with — the
product page then reads "No reviews yet". **Never write or invent a review
yourself**; publish only what a real customer actually sent you.

---

## 3b. Mark something out of stock (optional)

Leave the `stock:` line alone — or set it to `null` — and the product stays
visible and searchable, showing "Available - contact us to confirm".

Only set `stock: 0` when something is genuinely finished: it then shows
"Out of stock" and is hidden from the live search results.

```js
        stock: null,     // "Available - contact us to confirm"  (the usual choice)
        stock: 3,        // "3 items in stock"
        stock: 0,        // "Out of stock" and hidden from search
```

---

## 4. Add a new product

Copy a whole block, paste it just above the closing `];` of the list, and edit
the values. The `id` must be **unique**:

```js
    {
        id: "p50",
        name: "Wireless Charging Pad",
        category: "Power & Charging",
        price: 180,                                   // <- the price
        img: "img/products/wireless-charging-pad.jpg", // photo 1
        images: [                                      /* photos 2 to 5 */
            "img/products/wireless-charging-pad-2.jpg"
        ],
        tags: ["new"],
        description: "Drop your phone on the pad to charge. Ask us about colours and delivery."
    },
```

Then save. The product immediately appears on the **Shop** page, in the search
box, and in any row whose tag you listed.

Fields you can leave out: `price`, `oldPrice`, `badge`, `img`, `images`,
`colors`, `stock`, `tags`, `description`. Only `id`, `name` and `category` are
essential.

---

## 5. Remove a product

Delete its whole `{ ... },` block and save. Nothing else references it.

---

## 6. The tag rows (New Arrivals, Featured, Top Selling, Bestseller)

The four tabs on the home page and the rows near the bottom are filled
automatically from the `tags:` line of each product. A product may have several
tags:

| Tag            | Where it appears                                     |
| -------------- | ---------------------------------------------------- |
| *(none)*       | Shop page + search only                              |
| `"new"`        | **New Arrivals** tab                                 |
| `"featured"`   | **Featured** tab                                     |
| `"top"`        | **Top Selling** tab                                  |
| `"bestseller"` | The **Bestseller Products** row at the bottom         |

```js
        tags: ["new", "featured"],
```

The **All Products** tab and the shop page always show every product, so you
never have to tag anything for a product to be visible.

---

## 7. Change a category

Categories are just the `category:` text — type whatever you like
(`"Audio"`, `"Watches"`, `"Power & Charging"`, …). They also feed the shop
page's category menu and the search filters.

---

## 8. Store details (phone, WhatsApp, website)

At the top of `js/dynamflow-data.js`, in the `SITE` block:

```js
        phone: "0979848479",
        phoneIntl: "+260979848479",
        whatsapp: "0766628715",
        whatsappIntl: "260766628715",
```

Change these and every phone link, WhatsApp link and footer detail across the
whole site updates.

---

## 9. Facebook

The page link is already in place:

```js
        social: {
            facebook: {
                url: "https://web.facebook.com/profile.php?id=61587012572604",
                followersEndpoint: "",
                refreshSeconds: 60
            }
        }
```

* **The link** works everywhere already (footer, Contact page, Information
  page).
* **A live follower count** needs the small helper in the
  `cloudflare-worker/` folder — see `cloudflare-worker/README.md`. Until you
  set `followersEndpoint`, the page shows the Facebook button with no number.
  It will never show a made-up figure.

---

## 9b. Sharing a product, and sharing the shop

**Nothing to switch on.** Every product page already carries a row of share
buttons under the price, and the footer of every page carries a "Share this
shop" row:

* Facebook, WhatsApp, X (Twitter), Telegram and LinkedIn
* E-mail
* **Copy link** — copies the address to the clipboard so it can be pasted into
  any chat
* A share button that uses the phone's own share sheet (phones only)

The product buttons always share *that product's* address, so whoever opens the
link lands on the right product page.

---

## 9c. What Google and Facebook see (SEO)

This is all set up already. Each page has its own title, summary, canonical
address, link-preview picture and structured data, and the shop pages are
listed in `sitemap.xml` for search engines.

If the website ever moves to a new address, change **one line** near the top of
`js/dynamflow-data.js` and everything below follows (canonical links, link
previews, the sitemap, the share buttons):

```js
        url: "https://www.dynamflow.com",
        shareImage: "img/dynamflow-logo.png",
        description: "Dynamflow Store - shop electronics, gadgets and ...",
        author: {
            name: "Frank Banda",
            url: "https://www.dynamflow.com",
            phoneIntl: "+260979848479",
            whatsappUrl: "https://wa.me/260766628715"
        },
```

* `url` — the public address of the shop.
* `shareImage` — the picture shown when a page is shared. A square picture, or
  1200 x 630 px, works best.
* `description` — the grey summary under the shop's name in Google results.
  Keep it under about 155 characters.
* `author` — the page author reported to search engines. This is already set to
  **Frank Banda**; change the name here if the site changes hands.

**After adding or removing products**, refresh the sitemap so search engines
pick up the change:

```
node tools/build-sitemap.js
```

Then upload the new `sitemap.xml` with the rest of the site.

**A note on link previews:** Google reads the page after it runs the little bit
of script that fills in a product's title, summary and photo, so products look
complete in search results. Facebook and WhatsApp do *not* run that script, so a
shared product link shows the shop's name, the shop's picture and the shop's
summary — the link itself still opens the correct product.

---

## 10. Where the forms go

All forms (order request, checkout, contact, newsletter, product enquiry) are
sent to **Web3Forms** using the key on the `web3FormsKey` line of the `SITE`
block. Every submission arrives in the e-mail inbox that key is registered to.
If you ever change that e-mail address, create a new key at
<https://web3forms.com> and paste it there.

---

## 11. What is *not* in this file

Layout, colours and the template design live in `css/style.css` and the
`lib/` folder. You should not need to change them to keep the shop up to date.
