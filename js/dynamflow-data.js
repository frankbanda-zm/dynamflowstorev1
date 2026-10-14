/* =========================================================================
 * DYNAMFLOW STORE - THE ONE FILE YOU EDIT
 * -------------------------------------------------------------------------
 * Everything a shop owner normally changes lives in this file:
 *
 *   1. STORE DETAILS  - name, phone, WhatsApp, website, Web3Forms key,
 *                       delivery options and the Facebook page.
 *   2. YOUR PRODUCTS  - the product list: name, PRICE, PHOTOS (up to 5),
 *                       description and the rows it appears in.
 *
 * Every page of the website (home, shop, bestseller, product page, cart,
 * checkout, wishlist and the live search box) reads from this file, so a
 * change made here shows up everywhere automatically.
 *
 * =========================================================================
 * EACH PRODUCT IS ONE BLOCK - HERE IS EVERY LINE EXPLAINED
 * =========================================================================
 *
 *     {
 *         id: "p9",                         <- unique code, do not repeat it
 *         name: "Smart Watch",              <- what shoppers see and search
 *         category: "Watches",              <- groups it on the shop page
 *
 *         price: null,                      <- THE PRICE. See note A below.
 *
 *         oldPrice: null,                   <- crossed-out older price, or null
 *         badge: "New",                     <- "New", "Sale" or ""
 *
 *         img: "img/products/smart-watch.jpg",          <- PHOTO 1 (the main
 *                                                          photo on every card)
 *         images: [                                     <- PHOTOS 2 to 5
 *             "img/products/smart-watch-2.jpg",
 *             "img/products/smart-watch-3.jpg"
 *         ],
 *
 *         colors: [],                       <- e.g. ["Black", "White"], or []
 *         stock: null,                      <- a number, or null
 *         tags: ["new", "featured"],        <- which rows it appears in
 *         description: "Text shoppers read on the product page."
 *     },
 *
 * -------------------------------------------------------------------------
 * NOTE A - WHERE TO PUT THE PRICE
 * -------------------------------------------------------------------------
 *   price: 250        -> the whole site shows  K250.00
 *   price: 250.50     -> the whole site shows  K250.50
 *   price: null       -> the whole site shows  "Price on request"
 *
 *   Type the number only. No "K" and no spaces. Use a full stop for ngwee.
 *   Only enter a price you are really selling at - the site never guesses.
 *
 * -------------------------------------------------------------------------
 * NOTE B - HOW TO ADD UP TO 5 PHOTOS TO A PRODUCT
 * -------------------------------------------------------------------------
 *   1. Put your photos in the folder  img/products/ .
 *      Use short lower-case names with no spaces, e.g.  smart-watch-2.jpg
 *      (.jpg, .png and .webp all work; about 600 x 600 px or bigger)
 *
 *   2. The FIRST photo is the "img:" line. It is the one shown on the cards.
 *
 *   3. Photos 2, 3, 4 and 5 go on the "images:" lines, each inside quotes and
 *      separated by a comma. They appear in the picture gallery on the
 *      product page. Leave the list empty like this if there is only one:
 *
 *          images: [],
 *
 *   A product may not have more than 5 photos in total (1 + 4 extras).
 *
 *   Until a photo file exists, that picture shows a tidy grey "Photo coming
 *   soon" panel, so the shop never shows a broken image.
 *
 * ========================================================================= */

(function (window) {
    "use strict";

    /* ---------------------------------------------------------------------
     * 1. STORE DETAILS
     * ------------------------------------------------------------------- */
    var SITE = {
        name: "Dynamflow Store",
        tagline: "Electronics, Gadgets & Accessories",

        /* Store contact details */
        phone: "0979848479",
        phoneIntl: "+260979848479",
        whatsapp: "0766628715",
        whatsappIntl: "260766628715",
        whatsappUrl: "https://wa.me/260766628715",
        email: "info.dynamflowflow@gmail.com",
        website: "dynamflowstore.com",
        websiteUrl: "https://dynamflowstore.com",
        slogan: "Help You Stand Out & Stay Connected",

        /* Currency symbol used across the store (Zambian Kwacha) */
        currency: "K",
        currencyCode: "ZMW",

        /* The shop prices everything in Kwacha. Shoppers can flip the display
         * to US Dollars with the currency picker; the dollar figure comes from
         * a live exchange rate and is never guessed - if the rate cannot be
         * fetched, the picker stays on Kwacha. */
        secondaryCurrency: "$",
        secondaryCurrencyCode: "USD",
        selectedCurrency: "ZMW",
        exchangeRate: null,
        exchangeRateLastFetched: 0,
        exchangeRateUrl: "https://open.er-api.com/v6/latest/ZMW",
        exchangeRateRefreshMinutes: 60,

        /* Private discount coupons: "NAME": fraction off the subtotal. These
         * are never shown on the website - give the code only to the people
         * you choose. Change the name and the percentage on this one line.
         * 0.10 = 10% off. Use {} to switch coupons off. */
        coupons: { "DYNAM26": 0.10 },
        couponKey: "dynamflow_coupon_v1",

        /* -----------------------------------------------------------------
         * SEARCH ENGINES AND SHARING
         * -----------------------------------------------------------------
         * url      - the public address where this website is published.
         *            Search engines use it for the "canonical" link and the
         *            sitemap, and the share buttons use it to build their
         *            links. Change it here in one place if the site ever
         *            moves to another address.
         *
         * shareImage - the picture shown when a page is shared on Facebook
         *            or WhatsApp, or when a product has no photo of its own.
         *            A square or 1200 x 630 px picture works best.
         *
         * description - the short summary search engines show under the
         *            shop's name. Keep it under about 155 characters.
         *
         * author   - who designed and built this website. Reported to
         *            search engines as the page author.
         */
        url: "https://dynamflowstore.com",
        shareImage: "img/dynamflow-logo.png",
        description: "Dynamflow Store - shop electronics, gadgets and accessories in Zambia, " +
            "or order quickly on WhatsApp. Earbuds, headphones, smart watches, power banks, " +
            "laptops and phone accessories. Call 0979848479.",
        author: {
            name: "Frank Banda",
            url: "https://dynamflowstore.com",
            phoneIntl: "+260979848479",
            whatsappUrl: "https://wa.me/260766628715"
        },

        /* Web3Forms - the same key is used by the order, checkout and contact forms */
        web3FormsEndpoint: "https://api.web3forms.com/submit",
        web3FormsKey: "ef544f94-cf17-4b2f-80a5-e4d206e60ab0",

        /* Browser-storage keys (device only - nothing is uploaded) */
        cartKey: "dynamflow_cart_v1",
        wishlistKey: "dynamflow_wishlist_v1",
        profileKey: "dynamflow_profile_v1",

        /* Delivery options offered at checkout */
        shipping: {
            free: { label: "Free Shipping", cost: 0 },
            flat: { label: "Flat rate", cost: 15 },
            pickup: { label: "Local Pickup", cost: 8 }
        },

        /* -----------------------------------------------------------------
         * SOCIAL MEDIA
         * -----------------------------------------------------------------
         * facebook.url  - your Facebook page. Shown in the footer of every
         *                 page and on the contact + info pages.
         *
         * followersEndpoint - paste the address of your own small Cloudflare
         *                 Worker here (see cloudflare-worker/README.md) to
         *                 switch on the live follower count, for example:
         *                 "https://dynamflow-followers.you.workers.dev/"
         *                 Leave it as "" and the page simply shows the
         *                 Facebook button with no number - it never shows a
         *                 made-up figure.
         */
        social: {
            facebook: {
                label: "Facebook",
                url: "https://web.facebook.com/profile.php?id=61587012572604",
                pageId: "61587012572604",
                followersEndpoint: "",
                refreshSeconds: 60
            }
        }
    };

    /* ---------------------------------------------------------------------
     * 2. YOUR PRODUCTS
     * ---------------------------------------------------------------------
     * Each block below is one product. See the notes at the top of this file
     * for what every line means. The most important two are:
     *
     *      price: 250      <- change the price here
     *      images: [ ... ]  <- add photos 2 to 5 here
     *
     * "tags" decides which rows a product appears in:
     *      "new"         -> New Arrivals tab
     *      "featured"    -> Featured tab
     *      "top"         -> Top Selling tab
     *      "bestseller"  -> the Bestseller Products row
     * Every product always appears on the shop page and in search.
     * ------------------------------------------------------------------- */
    var PRODUCTS = [

        /* ---------------------------- AUDIO ---------------------------- */
        {
            id: "airpodspro1",
            name: "Airpods Pro",
            category: "Audio",
            price: 200 ,
            img: "img/products/airpods pro 2.jpg",
            images: [
                "img/products/airpods pro 3.jpg",
                "img/products/airpods pro.jpg"
            ],
            tags: ["featured", "top"],
            
            description: "AirPods Pro-style wireless Bluetooth earbuds with a " +
                            "charging case, designed for music, calls and everyday use. " +
                            "Contact Dynamflow Store to confirm the price, available " +
                            "colours and delivery options."

        },
        {
            id: "airpodspro2gen",
            name: "Airpods Pro 2nd Gen",
            category: "Audio",
            price: 250,
            img: "img/products/airpods pro 2gen.jpg",
            images: [
                    // "img/profuct/airpods pro2gen2.jpg",
                    // "img/profuct/airpods pro2gen3.jpg"
            ],
            tags: ["featured", "bestseller"],  
            description: "AirPods Pro 2nd Generation wireless earbuds designed " +
                        "for an immersive listening experience, clear calls and " +
                        "everyday convenience. Supplied with a charging case. " +
                        "Contact Dynamflow Store to confirm the price, " +
                        "availability, colours and delivery options."

        },
        {
            id: "p3",
            name: "Bluetooth Speaker",
            category: "Audio",
            price: null,
            img: "img/products/bluetooth-speaker.png",
            images: [],
            tags: ["top", "bestseller"],
            description: "Portable Bluetooth speaker for music at home, outdoors or at a gathering. " +
                "Ask us for the current price, available sizes and colours."
        },
        {
            id: "p4",
            name: "Wireless Microphone",
            category: "Audio",
            price: 250,
            img: "img/products/wireless-microphone.png",
            images: [],
            tags: ["new"]
        },
        {
            id: "p5",
            name: "Wired Earphones",
            category: "Audio",
            price: null,
            img: "img/products/wired-earphones.png",
            images: []
        },
        {
            id: "p6",
            name: "Portable Mini Speaker",
            category: "Audio",
            price: null,
            img: "img/products/portable-mini-speaker.png",
            images: [],
            tags: ["new"]
        },
        {
            id: "p7",
            name: "JBL Tune 510BT",
            category: "Audio",
            price: 250.00,
            img: "img/products/jbl-tune-510bt.jpg",
            images: [
                "img/products/jbl-tune-510bt-white.jpg",
                "img/products/jbl-tune-510bt-colours.jpg"
            ],
            colors: ["Black", "White", "Blue"],
            tags: ["top", "bestseller"],
            description: "JBL Tune 510BT wireless on-ear headphones. Available now at " +
                "Dynamflow Store for K250.00. Call or WhatsApp us to confirm stock, colours " +
                "and delivery before you order."
        },
        {
            id: "p8",
            name: "AirPods Pro",
            category: "Audio",
            price: 250.00,
            img: "img/products/airpods-pro.png",
            images: [],
            colors: ["Black"],
            tags: ["featured", "bestseller"],
            description: "AirPods Pro wireless earbuds. Available now at Dynamflow Store for " +
                "K250.00. Call or WhatsApp us to confirm stock, colours and delivery before " +
                "you order."
        },

        /* --------------------------- WATCHES --------------------------- */
        {
            id: "p9",
            name: "Smart Watch",
            category: "Watches",
            price: null,
            img: "img/products/smart-watch.png",
            images: [],
            tags: ["featured", "top", "bestseller"]
        },
        {
            id: "p10",
            name: "Fitness Tracking Watch",
            category: "Watches",
            price: null,
            img: "img/products/fitness-watch.png",
            images: [],
            tags: ["new"]
        },
        {
            id: "p11",
            name: "Smartwatch Straps & Accessories",
            category: "Watches",
            price: null,
            img: "img/products/watch-straps.png",
            images: []
        },

        /* ---------------------- POWER & CHARGING ---------------------- */
        {
            id: "p12",
            name: "Power Bank",
            category: "Power & Charging",
            price: null,
            img: "img/products/power-bank.png",
            images: [],
            tags: ["top", "bestseller"]
        },
        {
            id: "p13",
            name: "Fast-Charging Adapter",
            category: "Power & Charging",
            price: null,
            img: "img/products/fast-charger.png",
            images: [],
            tags: ["new"]
        },
        {
            id: "p14",
            name: "USB-C Charging Cable",
            category: "Power & Charging",
            price: 80,
            img: "img/products/usb-c-cable.png",
            images: []
        },
        {
            id: "p15",
            name: "iPhone-Compatible Charging Cable",
            category: "Power & Charging",
            price: null,
            img: "img/products/iphone-cable.png",
            images: []
        },
        {
            id: "p16",
            name: "Multi-Port USB Charger",
            category: "Power & Charging",
            price: null,
            img: "img/products/multi-port-charger.png",
            images: [],
            tags: ["featured"]
        },
        {
            id: "p17",
            name: "Rechargeable Emergency Light",
            category: "Power & Charging",
            price: null,
            img: "img/products/emergency-light.png",
            images: [],
            tags: ["new"]
        },

        /* ---------------------- TECH ACCESSORIES ---------------------- */
        {
            id: "p18",
            name: "Computer Mouse",
            category: "Tech Accessories",
            price: null,
            img: "img/products/computer-mouse.png",
            images: []
        },
        {
            id: "p19",
            name: "Mechanical Keyboard",
            category: "Tech Accessories",
            price: null,
            img: "img/products/mechanical-keyboard.jpg",
            images: [],
            tags: ["top"]
        },
        {
            id: "p20",
            name: "USB Flash Drive",
            category: "Tech Accessories",
            price: null,
            img: "img/products/usb-flash-drive.jpg",
            images: []
        },
        {
            id: "p21",
            name: "External SSD",
            category: "Tech Accessories",
            price: null,
            img: "img/products/external-ssd.jpg",
            images: [],
            tags: ["featured", "new"]
        },
        {
            id: "p22",
            name: "DDR4 RAM Module",
            category: "Tech Accessories",
            price: null,
            img: "img/products/ddr4-ram.jpg",
            images: []
        },
        {
            id: "p23",
            name: "Laptop Stand",
            category: "Tech Accessories",
            price: null,
            img: "img/products/laptop-stand.jpg",
            images: []
        },
        {
            id: "p24",
            name: "USB Hub",
            category: "Tech Accessories",
            price: null,
            img: "img/products/usb-hub.jpg",
            images: []
        },
        {
            id: "p25",
            name: "Laptop Cooling Pad",
            category: "Tech Accessories",
            price: null,
            img: "img/products/cooling-pad.jpg",
            images: []
        },
        {
            id: "p26",
            name: "Webcam",
            category: "Tech Accessories",
            price: null,
            img: "img/products/webcam.jpg",
            images: [],
            tags: ["new"]
        },
        {
            id: "p27",
            name: "Wireless Keyboard & Mouse Combo",
            category: "Tech Accessories",
            price: null,
            img: "img/products/keyboard-mouse-combo.jpg",
            images: [],
            tags: ["bestseller"]
        },

        /* ---------------------------- LAPTOPS ---------------------------- */
        {
            id: "p28",
            name: "Business Laptop",
            category: "Laptops",
            price: null,
            img: "img/products/business-laptop.jpg",
            images: [],
            tags: ["featured"]
        },
        {
            id: "p29",
            name: "Student Laptop",
            category: "Laptops",
            price: null,
            img: "img/products/student-laptop.jpg",
            images: [],
            tags: ["new"]
        },
        {
            id: "p30",
            name: "Gaming Laptop",
            category: "Laptops",
            price: null,
            img: "img/products/gaming-laptop.jpg",
            images: [],
            tags: ["top", "featured"]
        },
        {
            id: "p31",
            name: "Refurbished Laptop",
            category: "Laptops",
            price: null,
            img: "img/products/refurbished-laptop.jpg",
            images: [],
            tags: ["bestseller"]
        },
        {
            id: "p32",
            name: "Laptop Charger",
            category: "Laptops",
            price: null,
            img: "img/products/laptop-charger.jpg",
            images: []
        },
        {
            id: "p33",
            name: "Laptop Battery",
            category: "Laptops",
            price: null,
            img: "img/products/laptop-battery.jpg",
            images: []
        },

        /* ---------------------------- PHONES ---------------------------- */
        {
            id: "p34",
            name: "Android Smartphone",
            category: "Phones",
            price: null,
            img: "img/products/android-smartphone.jpg",
            images: [],
            tags: ["top", "bestseller"]
        },
        {
            id: "p35",
            name: "iPhone",
            category: "Phones",
            price: null,
            img: "img/products/iphone.jpg",
            images: [],
            tags: ["featured"]
        },
        {
            id: "p36",
            name: "Budget Smartphone",
            category: "Phones",
            price: null,
            img: "img/products/budget-smartphone.jpg",
            images: [],
            tags: ["new"]
        },
        {
            id: "p37",
            name: "Premium Smartphone",
            category: "Phones",
            price: null,
            img: "img/products/premium-smartphone.jpg",
            images: [],
            tags: ["top"]
        },
        {
            id: "p38",
            name: "Protective Phone Case",
            category: "Phones",
            price: null,
            img: "img/products/phone-case.jpg",
            images: []
        },
        {
            id: "p39",
            name: "Screen Protector",
            category: "Phones",
            price: null,
            img: "img/products/screen-protector.jpg",
            images: []
        }
    ];

    /* ---------------------------------------------------------------------
     * 2b. CUSTOMER REVIEWS (real reviews only - shown without pictures)
     * ---------------------------------------------------------------------
     * Reviews you have really received. Copy the block below for each one and
     * fill it in. Only "product" and "text" are required:
     *
     *     {
     *         product: "p7",                 <- the product id the review is for
     *         name: "Chanda M.",             <- the reviewer's name
     *         rating: 5,                     <- 1 to 5 stars
     *         date: "2026-02-14",            <- the date you received it
     *         text: "Works great, fast delivery."
     *     },
     *
     * Leave the list empty (just [ ]) until you have a real review to add.
     * The product page shows them newest first, with no pictures at all.
     * Never write a review yourself or invent one.
     * ------------------------------------------------------------------- */
    var REVIEWS = [
    ];

    /* ---------------------------------------------------------------------
     * 3. NOTHING BELOW HERE NEEDS EDITING
     * ------------------------------------------------------------------- */

    /* A product may show at most 5 photos: the main "img" plus 4 in "images". */
    var MAX_PHOTOS = 5;

    /* Fill in anything a product block leaves out. */
    function normalise(product, index) {
        return {
            id: String(product.id),
            name: product.name || "Product",
            model: product.model || "",
            category: product.category || "General",
            price: (product.price === undefined ? null : product.price),
            oldPrice: (product.oldPrice === undefined ? null : product.oldPrice),
            badge: product.badge || "",
            img: product.img || "",
            images: product.images || [],
            colors: product.colors || [],
            stock: (product.stock === undefined ? null : product.stock),
            sku: product.sku || ("DF-" + (101 + index)),
            description: product.description ||
                ("Genuine product available now at Dynamflow Store. " +
                 "Ask us for the current price, available colours and stock."),
            tags: product.tags || []
        };
    }

    var CATALOGUE = PRODUCTS.map(normalise);

    /* Every photo for a product, in order, with no repeats and never more
     * than five: the main photo first, then the extra gallery photos. */
    function photos(product) {
        var list = [product.img].concat(product.images || []);
        var out = [];
        list.forEach(function (src) {
            if (src && out.indexOf(src) === -1 && out.length < MAX_PHOTOS) { out.push(src); }
        });
        return out;
    }

    /* 1,250.50 - grouped thousands, always two decimals. */
    function formatNumber(value) {
        var number = Number(value);
        if (isNaN(number)) { number = 0; }
        var parts = Math.abs(number).toFixed(2).split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return (number < 0 ? "-" : "") + parts.join(".");
    }

    /* True when a real US-Dollar rate has been fetched. */
    function hasExchangeRate() {
        return Number(SITE.exchangeRate) > 0;
    }

    /* The symbol for the currency the shopper is viewing. */
    function currencySymbol() {
        return (SITE.selectedCurrency === SITE.secondaryCurrencyCode && hasExchangeRate())
            ? SITE.secondaryCurrency : SITE.currency;
    }

    /* An amount entered in Kwacha, written in the chosen currency. The dollar
     * figure is only produced from a live rate - never guessed. */
    function money(amount) {
        var value = Number(amount);
        if (isNaN(value)) { value = 0; }
        if (SITE.selectedCurrency === SITE.secondaryCurrencyCode && hasExchangeRate()) {
            return SITE.secondaryCurrency + formatNumber(value * Number(SITE.exchangeRate));
        }
        return SITE.currency + formatNumber(value);
    }

    /* Flip the shop between Kwacha and US Dollars. US Dollars only take effect
     * once a live rate is known; otherwise the shop stays on Kwacha. */
    function setCurrency(code) {
        var wanted = String(code || "").toUpperCase();
        SITE.selectedCurrency = (wanted === SITE.secondaryCurrencyCode && hasExchangeRate())
            ? SITE.secondaryCurrencyCode : SITE.currencyCode;
        return SITE.selectedCurrency;
    }
    function getCurrency() { return SITE.selectedCurrency; }

    /* Price text used everywhere: "K250.00", "$12.55", or "Price on request"
     * when no price has been entered for the product. */
    function priceLabel(value) {
        if (value === null || value === undefined || value === "") { return "Price on request"; }
        var number = Number(value);
        if (isNaN(number)) { return "Price on request"; }
        return money(number);
    }

    function hasPrice(product) {
        return !!product && product.price !== null && product.price !== undefined &&
            product.price !== "" && !isNaN(Number(product.price));
    }

    function findProduct(id) {
        if (id === null || id === undefined || id === "") { return null; }
        var wanted = String(id).toLowerCase();
        for (var i = 0; i < CATALOGUE.length; i++) {
            if (CATALOGUE[i].id.toLowerCase() === wanted) { return CATALOGUE[i]; }
            if (String(i + 1) === wanted) { return CATALOGUE[i]; }
        }
        return null;
    }

    /* Resolve a product from an image path. Handles the friendly names
     * (img/products/smart-watch.png) and the template photos
     * (img/product-3.png) the promotional carousels still use. */
    function findProductByImage(src) {
        if (!src) { return null; }
        var file = String(src).split("?")[0].split("/").pop();
        if (!file) { return null; }
        for (var i = 0; i < CATALOGUE.length; i++) {
            var all = photos(CATALOGUE[i]);
            for (var j = 0; j < all.length; j++) {
                if (all[j].split("/").pop() === file) { return CATALOGUE[i]; }
            }
        }
        var match = /product-(\d+)\./.exec(src);
        return match ? findProduct("p" + match[1]) : null;
    }

    /* Products carrying a tag ("new", "featured", "top", "bestseller"). */
    function productsFor(tag) {
        var wanted = String(tag || "").toLowerCase();
        if (!wanted || wanted === "all") { return CATALOGUE.slice(); }
        return CATALOGUE.filter(function (product) {
            return (product.tags || []).indexOf(wanted) !== -1;
        });
    }

    /* Every review for one product, newest first. */
    function reviewsFor(productId) {
        var id = String(productId);
        return REVIEWS.filter(function (review) {
            return String(review.product) === id;
        }).sort(function (a, b) {
            return String(b.date || "").localeCompare(String(a.date || ""));
        });
    }
    /* The average star rating for a product, or null when it has no reviews. */
    function productRating(productId) {
        var list = reviewsFor(productId);
        if (!list.length) { return null; }
        var sum = 0;
        list.forEach(function (review) { sum += (Number(review.rating) || 0); });
        return { count: list.length, average: sum / list.length };
    }

    window.DynamflowData = {
        SITE: SITE,
        PRODUCTS: CATALOGUE,
        MAX_PHOTOS: MAX_PHOTOS,
        photos: photos,
        priceLabel: priceLabel,
        money: money,
        formatNumber: formatNumber,
        currencySymbol: currencySymbol,
        hasExchangeRate: hasExchangeRate,
        setCurrency: setCurrency,
        getCurrency: getCurrency,
        hasPrice: hasPrice,
        findProduct: findProduct,
        findProductByImage: findProductByImage,
        productsFor: productsFor,
        reviewsFor: reviewsFor,
        productRating: productRating
    };

})(window);
