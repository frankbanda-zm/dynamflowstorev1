/* =========================================================================
 * Dynamflow Store - storefront behaviour
 * -------------------------------------------------------------------------
 *  - product cards link to their own product page and can be added to the cart
 *  - the product page renders the selected product, its options and the
 *    "Order Now" form
 *  - the cart, the checkout and the contact page all submit through Web3Forms
 * ========================================================================= */
(function (window, document) {
    "use strict";

    var D = window.DynamflowData;
    if (!D) { return; }
    var SITE = D.SITE;

    /* ---------------------------------------------------------------------
     * Small helpers
     * ------------------------------------------------------------------- */
    function qs(selector, context) { return (context || document).querySelector(selector); }
    function qsa(selector, context) {
        return Array.prototype.slice.call((context || document).querySelectorAll(selector));
    }
    function setText(el, text) { if (el) { el.textContent = text; } }
    function esc(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    function money(amount) {
        var value = Number(amount || 0);
        if (isNaN(value)) { value = 0; }
        /* One formatter for the whole shop: it writes the amount in whichever
         * currency the shopper has picked (Kwacha, or US Dollars from the live
         * rate). See js/dynamflow-data.js. */
        if (D.money) { return D.money(value); }
        var parts = Math.abs(value).toFixed(2).split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return (value < 0 ? "-" : "") + SITE.currency + parts.join(".");
    }

/* Price text for a product. Products without a confirmed price show
     * "Price on request" instead of a made-up figure. */
    function priceLabel(value) {
        return (D.priceLabel ? D.priceLabel(value) : money(value));
    }

/* A tidy, branded panel used whenever a product photo has not been added
     * to img/products/ yet, so a card never shows a broken image. */
    function photoPlaceholder(label) {
        var text = esc(label || "Photo coming soon");
        var svg =
            '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">' +
            '<rect width="600" height="600" fill="#fafafa"/>' +
            '<rect x="1" y="1" width="598" height="598" fill="none" stroke="#ececec" stroke-width="2"/>' +
            '<g fill="none" stroke="#d3d3d3" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="203" y="186" width="194" height="150" rx="18"/>' +
            '<circle cx="253" cy="232" r="15"/>' +
            '<path d="M213 322l58-58 58 58"/>' +
            '<path d="M298 262l86 60"/>' +
            '</g>' +
            '<text x="300" y="392" text-anchor="middle" font-family="system-ui,Arial,sans-serif" ' +
            'font-size="26" fill="#9a9a9a">Photo coming soon</text>' +
            '<text x="300" y="432" text-anchor="middle" font-family="system-ui,Arial,sans-serif" ' +
            'font-size="20" fill="#c0c0c0">' + text + '</text>' +
            '</svg>';
        return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }

/* Point an <img> at the catalogue photo, falling back to the placeholder
     * above when the file is not there yet. */
    function applyProductImage(img, product) {
        if (!img || !product) { return; }
        var alt = product.name + (product.model ? " " + product.model : "");
        img.setAttribute("alt", alt);
        img.onerror = function () {
            img.onerror = null;
            img.src = photoPlaceholder(product.name);
        };
        img.src = product.img ? product.img : photoPlaceholder(product.name);
    }
    function queryParam(name) {
        var match = new RegExp("[?&]" + name + "=([^&#]*)").exec(window.location.search);
        return match ? decodeURIComponent(match[1].replace(/\+/g, " ")) : "";
    }
    function closest(el, selector) {
        while (el && el.nodeType === 1) {
            if (el.matches ? el.matches(selector) : false) { return el; }
            el = el.parentNode;
        }
        return null;
    }
    /* Re-initialise an Owl Carousel after its slides have been replaced. Keeps the
     * template's carousel behaviour (autoplay, dots, nav) intact. */
    function reinitOwl(element) {
        var $ = window.jQuery;
        if (!$ || !$.fn || !$.fn.owlCarousel) { return; }
        try {
            $(element).trigger("destroy.owl.carousel");
            $(element).owlCarousel({
                autoplay: true,
                smartSpeed: 1500,
                dots: true,
                dotsData: true,
                loop: true,
                items: 1,
                nav: true,
                navText: [
                    '<i class="bi bi-arrow-left"></i>',
                    '<i class="bi bi-arrow-right"></i>'
                ]
            });
        } catch (e) { /* carousel is optional */ }
    }
    /* ---------------------------------------------------------------------
     * Popups + inline feedback
     * Every success / error / warning message is shown as a centered overlay
     * dialog: dimmed backdrop, rounded card, icon, title, message and an OK
     * button. It dismisses itself (progress bar), or on OK, Escape, or a
     * click on the dimmed background.
     * ------------------------------------------------------------------- */
    var popupLayer = null;
    var popupTimer = null;
    var popupHideTimer = null;

    var POPUP_DURATION = { success: 4200, error: 6500, warning: 6500, info: 4600 };
    var POPUP_KINDS = {
        success: { title: "Success", icon: "fa-check" },
        error: { title: "Please check", icon: "fa-times" },
        warning: { title: "Please check", icon: "fa-exclamation" },
        info: { title: "Notice", icon: "fa-info" }
    };

    function popupLayerEl() {
        if (popupLayer && popupLayer.parentNode) { return popupLayer; }
        popupLayer = document.getElementById("dynamflow-toasts");
        if (!popupLayer) {
            popupLayer = document.createElement("div");
            popupLayer.id = "dynamflow-toasts";
            document.body.appendChild(popupLayer);
        }
        return popupLayer;
    }
    function popupClearTimer() {
        if (popupTimer) { window.clearTimeout(popupTimer); popupTimer = null; }
        if (popupHideTimer) { window.clearTimeout(popupHideTimer); popupHideTimer = null; }
    }
    function hidePopup() {
        var layer = popupLayerEl();
        popupClearTimer();
        if (!layer.classList.contains("is-open")) { return; }
        layer.classList.remove("is-open");
        layer.classList.add("is-hiding");
        popupHideTimer = window.setTimeout(function () {
            popupHideTimer = null;
            /* a newer popup may have opened in the meantime: leave it alone */
            if (layer.classList.contains("is-open")) { return; }
            layer.classList.remove("is-hiding");
            layer.innerHTML = "";
        }, 260);
    }
    function toast(message, type) {
        var kind = Object.prototype.hasOwnProperty.call(POPUP_KINDS, type) ? type : "info";
        var look = POPUP_KINDS[kind];
        var duration = POPUP_DURATION[kind] || 4200;
        var layer = popupLayerEl();

        popupClearTimer();
        layer.classList.remove("is-hiding");
        layer.innerHTML =
            '<div class="dynamflow-popup-backdrop" data-popup-close></div>' +
            '<div class="dynamflow-popup is-' + kind + '" role="alertdialog" aria-modal="true">' +
            '<span class="dynamflow-popup-progress" style="animation-duration:' + duration + 'ms"></span>' +
            '<span class="dynamflow-popup-icon"><i class="fa ' + look.icon + '" aria-hidden="true"></i></span>' +
            '<h4 class="dynamflow-popup-title">' + esc(look.title) + "</h4>" +
            '<p class="dynamflow-popup-message">' + esc(message) + "</p>" +
            '<button type="button" class="btn btn-primary dynamflow-popup-ok" data-popup-close>OK</button>' +
            "</div>";
        layer.classList.add("is-open");

        layer.onclick = function (event) {
            var hit = event.target && event.target.closest ? event.target.closest("[data-popup-close]") : null;
            if (hit) { hidePopup(); }
        };

        var ok = qs(".dynamflow-popup-ok", layer);
        if (ok && ok.focus) { ok.focus(); }
        popupTimer = window.setTimeout(hidePopup, duration);
    }
    function initPopup() {
        document.addEventListener("keydown", function (event) {
            if (event.key !== "Escape" && event.keyCode !== 27) { return; }
            var viewer = document.getElementById("dynamflow-viewer");
            if (viewer && viewer.classList.contains("is-open")) { return; }
            var layer = document.getElementById("dynamflow-toasts");
            if (layer && layer.classList.contains("is-open")) {
                hidePopup();
                if (event.preventDefault) { event.preventDefault(); }
            }
        });
    }
    /* ---------------------------------------------------------------------
     * Product page, mobile: photo and ordering first, browsing blocks last
     * ------------------------------------------------------------------- */
    function initProductLayout() {
        var sidebar = qs("[data-single-sidebar]");
        var main = qs("[data-single-main]");
        if (!sidebar || !main) { return; }
        var row = sidebar.parentNode;
        var details = qs("[data-single-details]", main);
        var colors = qs("[data-single-colors]", sidebar);
        var colorsAnchor = colors ? colors.nextElementSibling : null;
        var holder = null;
        var holderRow = null;
        var applied = null;

        function mobile() { return window.innerWidth < 992; }
        function place() {
            var want = mobile();
            if (want === applied) { return; }
            applied = want;

            if (want) {
                /* the colour choice belongs with the product itself, so it stays
                 * next to the quantity / add to cart controls */
                if (colors && details) {
                    details.insertBefore(colors, qs(".quantity", details) || null);
                }
                /* search, categories, featured products, banner and tags move
                 * below the photo, the description, the order form and the
                 * related products */
                if (!holder) {
                    holder = document.createElement("div");
                    holder.className = "container dynamflow-single-browse";
                    holderRow = document.createElement("div");
                    holderRow.className = "row g-4";
                    holder.appendChild(holderRow);
                }
                holderRow.appendChild(sidebar);
                var anchor = qs(".related-product") || document.getElementById("order-section");
                if (anchor && anchor.parentNode) {
                    anchor.parentNode.insertBefore(holder, anchor.nextSibling);
                } else {
                    document.body.appendChild(holder);
                }
            } else {
                row.insertBefore(sidebar, row.firstChild);
                if (colors && colorsAnchor && colorsAnchor.parentNode === sidebar) {
                    sidebar.insertBefore(colors, colorsAnchor);
                }
                if (holder && holder.parentNode) { holder.parentNode.removeChild(holder); }
            }
        }
        place();
        window.addEventListener("resize", place);
    }
    /* ---------------------------------------------------------------------
     * Product photo viewer: pinch / wheel / buttons to zoom in and out, drag
     * to move around, and a download button for the photo on screen
     * ------------------------------------------------------------------- */
    var PHOTO_MIN = 1;
    var PHOTO_MAX = 6;
    var PHOTO_STEP = 1.6;
    var photo = {
        el: null, img: null, stage: null, level: null, zoomIn: null, zoomOut: null,
        scale: 1, x: 0, y: 0, origin: { x: 0, y: 0 },
        gesture: null, moved: false, tapAt: 0, trigger: null
    };

    function photoFileName(src, label) {
        var base = String(src || "photo").split("/").pop().split("?")[0];
        var ext = (base.match(/\.[a-z0-9]+$/i) || [""])[0];
        var slug = String(label || base)
            .replace(/\.[a-z0-9]+$/i, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 48);
        return (slug || "dynamflow-photo") + (ext || ".jpg");
    }
    function photoCenter() {
        var rect = photo.img.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    function photoApply() {
        var img = photo.img;
        if (!img) { return; }
        var maxX = Math.max(0, (img.offsetWidth * photo.scale - window.innerWidth) / 2);
        var maxY = Math.max(0, (img.offsetHeight * photo.scale - window.innerHeight) / 2);
        if (photo.x > maxX) { photo.x = maxX; }
        if (photo.x < -maxX) { photo.x = -maxX; }
        if (photo.y > maxY) { photo.y = maxY; }
        if (photo.y < -maxY) { photo.y = -maxY; }
        img.style.transform = "translate3d(" + photo.x + "px," + photo.y + "px,0) scale(" + photo.scale + ")";
        setText(photo.level, Math.round(photo.scale * 100) + "%");
        if (photo.zoomIn) { photo.zoomIn.disabled = photo.scale >= PHOTO_MAX - 0.001; }
        if (photo.zoomOut) { photo.zoomOut.disabled = photo.scale <= PHOTO_MIN + 0.001; }
    }
    function photoReset() {
        if (!photo.img) { return; }
        photo.scale = PHOTO_MIN;
        photo.x = 0;
        photo.y = 0;
        photo.gesture = null;
        photo.moved = false;
        photo.img.style.transform = "none";
        photo.origin = photoCenter();
        photoApply();
    }
    /* zoom about a point (client coordinates) so the photo stays under the finger */
    function photoZoom(factor, originX, originY) {
        if (!photo.img) { return; }
        var from = photo.scale;
        var to = Math.min(PHOTO_MAX, Math.max(PHOTO_MIN, from * factor));
        if (Math.abs(to - from) < 0.001) { return; }
        if (originX != null && originY != null) {
            var k = (from - to) / from;
            photo.x += k * (originX - photo.origin.x - photo.x);
            photo.y += k * (originY - photo.origin.y - photo.y);
        }
        photo.scale = to;
        if (to <= PHOTO_MIN + 0.001) { photo.x = 0; photo.y = 0; }
        photoApply();
    }
    function photoBeginGesture(list) {
        if (!photo.img || !list.length) { return; }
        var two = list.length > 1;
        photo.gesture = {
            mid: two ? { x: (list[0].x + list[1].x) / 2, y: (list[0].y + list[1].y) / 2 }
                : { x: list[0].x, y: list[0].y },
            dist: two ? Math.sqrt(Math.pow(list[0].x - list[1].x, 2) + Math.pow(list[0].y - list[1].y, 2)) : 0,
            scale: photo.scale,
            x: photo.x,
            y: photo.y
        };
        photo.moved = false;
    }
    function photoDrag(list) {
        var gesture = photo.gesture;
        if (!gesture || !photo.img || !list.length) { return; }
        var two = list.length > 1;
        var mid = two ? { x: (list[0].x + list[1].x) / 2, y: (list[0].y + list[1].y) / 2 }
            : { x: list[0].x, y: list[0].y };
        var scale = gesture.scale;

        if (gesture.dist && two) {
            var dist = Math.sqrt(Math.pow(list[0].x - list[1].x, 2) + Math.pow(list[0].y - list[1].y, 2));
            if (dist > 4) {
                scale = Math.min(PHOTO_MAX, Math.max(PHOTO_MIN, gesture.scale * (dist / gesture.dist)));
            }
        }
        if (Math.abs(mid.x - gesture.mid.x) > 6 || Math.abs(mid.y - gesture.mid.y) > 6 || scale !== gesture.scale) {
            photo.moved = true;
        }
        /* keep the photo point that was under the gesture midpoint under it */
        var px = (gesture.mid.x - photo.origin.x - gesture.x) / gesture.scale;
        var py = (gesture.mid.y - photo.origin.y - gesture.y) / gesture.scale;
        photo.scale = scale;
        photo.x = mid.x - photo.origin.x - scale * px;
        photo.y = mid.y - photo.origin.y - scale * py;
        if (scale <= PHOTO_MIN + 0.001 && !two) { photo.x = 0; photo.y = 0; }
        photoApply();
        if (photo.moved && scale > PHOTO_MIN && photo.stage) { photo.stage.classList.add("is-dragging"); }
    }
    function photoGalleryAutoplay(play) {
        var $ = window.jQuery;
        if (!$ || !$.fn || !$.fn.owlCarousel) { return; }
        try {
            $(".single-carousel").trigger(play ? "play.owl.autoplay" : "stop.owl.autoplay");
        } catch (error) { /* the carousel is optional */ }
    }
    function photoViewer() {
        if (photo.el) { return photo.el; }
        var el = document.createElement("div");
        el.id = "dynamflow-viewer";
        el.className = "dynamflow-viewer";
        el.setAttribute("role", "dialog");
        el.setAttribute("aria-modal", "true");
        el.setAttribute("aria-label", "Product photo");
        el.innerHTML =
            '<div class="dynamflow-viewer-backdrop"></div>' +
            '<div class="dynamflow-viewer-bar">' +
            '<a class="dynamflow-viewer-btn" data-photo-download download' +
            ' aria-label="Download this photo" title="Download this photo">' +
            '<i class="fa fa-download" aria-hidden="true"></i></a>' +
            '<button type="button" class="dynamflow-viewer-btn" data-photo-out' +
            ' aria-label="Zoom out" title="Zoom out"><i class="fa fa-search-minus" aria-hidden="true"></i></button>' +
            '<span class="dynamflow-viewer-level" data-photo-level>100%</span>' +
            '<button type="button" class="dynamflow-viewer-btn" data-photo-in' +
            ' aria-label="Zoom in" title="Zoom in"><i class="fa fa-search-plus" aria-hidden="true"></i></button>' +
            '<button type="button" class="dynamflow-viewer-btn" data-photo-reset' +
            ' aria-label="Fit to screen" title="Fit to screen"><i class="fa fa-expand" aria-hidden="true"></i></button>' +
            '<button type="button" class="dynamflow-viewer-btn is-close" data-photo-close' +
            ' aria-label="Close the photo viewer" title="Close"><i class="fa fa-times" aria-hidden="true"></i></button>' +
            "</div>" +
            '<div class="dynamflow-viewer-stage" data-photo-stage>' +
            '<img class="dynamflow-viewer-img" data-photo-img alt="">' +
            "</div>" +
            '<p class="dynamflow-viewer-hint">Pinch or double tap to zoom &middot; drag to move the photo</p>';
        document.body.appendChild(el);

        photo.el = el;
        photo.img = qs("[data-photo-img]", el);
        photo.stage = qs("[data-photo-stage]", el);
        photo.level = qs("[data-photo-level]", el);
        photo.zoomIn = qs("[data-photo-in]", el);
        photo.zoomOut = qs("[data-photo-out]", el);

        el.addEventListener("click", function (event) {
            var target = event.target;
            var moved = photo.moved;
            photo.moved = false;
            if (closest(target, "[data-photo-close]")) { closePhoto(); return; }
            if (closest(target, "[data-photo-in]")) { photoZoom(PHOTO_STEP); return; }
            if (closest(target, "[data-photo-out]")) { photoZoom(1 / PHOTO_STEP); return; }
            if (closest(target, "[data-photo-reset]")) { photoReset(); return; }
            if (closest(target, "[data-photo-download]")) { return; }
            if (target === photo.stage && !moved) { closePhoto(); }
        });

        /* touch: one finger pans, two fingers pinch */
        photo.stage.addEventListener("touchstart", function (event) {
            var list = [];
            for (var i = 0; i < event.touches.length; i++) {
                list.push({ x: event.touches[i].clientX, y: event.touches[i].clientY });
            }
            if (!list.length) { return; }
            photoBeginGesture(list);
            if (list.length === 1) {
                var now = Date.now();
                if (now - photo.tapAt < 320) {
                    photoZoom(photo.scale > 1.4 ? PHOTO_MIN / photo.scale : 2.4 / photo.scale, list[0].x, list[0].y);
                    photo.tapAt = 0;
                } else {
                    photo.tapAt = now;
                }
            } else {
                photo.tapAt = 0;
            }
        }, { passive: true });

        photo.stage.addEventListener("touchmove", function (event) {
            var list = [];
            for (var i = 0; i < event.touches.length; i++) {
                list.push({ x: event.touches[i].clientX, y: event.touches[i].clientY });
            }
            if (event.cancelable && event.preventDefault) { event.preventDefault(); }
            photoDrag(list);
        }, { passive: false });

        photo.stage.addEventListener("touchend", function (event) {
            var list = [];
            for (var i = 0; i < event.touches.length; i++) {
                list.push({ x: event.touches[i].clientX, y: event.touches[i].clientY });
            }
            if (list.length) { photoBeginGesture(list); } else { photo.gesture = null; }
        });

        /* mouse: drag to pan, wheel to zoom, double click to toggle */
        var dragging = false;
        photo.stage.addEventListener("mousedown", function (event) {
            if (event.button !== 0) { return; }
            dragging = true;
            photoBeginGesture([{ x: event.clientX, y: event.clientY }]);
            if (event.preventDefault) { event.preventDefault(); }
        });
        document.addEventListener("mousemove", function (event) {
            if (!dragging) { return; }
            photoDrag([{ x: event.clientX, y: event.clientY }]);
        });
        document.addEventListener("mouseup", function () {
            if (!dragging) { return; }
            dragging = false;
            photo.gesture = null;
            if (photo.stage) { photo.stage.classList.remove("is-dragging"); }
        });

        /* the whole overlay swallows the wheel so the page behind cannot scroll */
        el.addEventListener("wheel", function (event) {
            if (event.preventDefault) { event.preventDefault(); }
            photoZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12, event.clientX, event.clientY);
        }, { passive: false });

        photo.stage.addEventListener("dblclick", function (event) {
            if (event.preventDefault) { event.preventDefault(); }
            photoZoom(photo.scale > 1.4 ? PHOTO_MIN / photo.scale : 2.4 / photo.scale, event.clientX, event.clientY);
        });

        document.addEventListener("keydown", function (event) {
            if (!el.classList.contains("is-open")) { return; }
            var key = event.key;
            if (key === "Escape" || event.keyCode === 27) { closePhoto(); }
            else if (key === "+" || key === "=") { photoZoom(PHOTO_STEP); }
            else if (key === "-" || key === "_") { photoZoom(1 / PHOTO_STEP); }
            else if (key === "0") { photoReset(); }
            else { return; }
            if (event.preventDefault) { event.preventDefault(); }
        });

        window.addEventListener("resize", function () {
            if (el.classList.contains("is-open") && photo.img && photo.img.naturalWidth) {
                photo.origin = photoCenter();
                photoApply();
            }
        });

        return el;
    }
    function openPhoto(source) {
        if (!source) { return; }
        var src = source.getAttribute("src");
        if (!src) { return; }
        var el = photoViewer();
        var alt = source.getAttribute("alt") || "";

        photo.trigger = source;
        photo.gesture = null;
        photo.moved = false;
        photo.tapAt = 0;
        photo.scale = PHOTO_MIN;
        photo.x = 0;
        photo.y = 0;
        photo.img.setAttribute("alt", alt);
        photo.img.style.transform = "none";

        var download = qs("[data-photo-download]", el);
        if (download) {
            download.setAttribute("href", src);
            download.setAttribute("download", photoFileName(src, alt));
        }
        photo.img.onload = function () {
            photo.img.onload = null;
            if (el.classList.contains("is-open")) {
                photo.origin = photoCenter();
                photoApply();
            }
        };

        /* show the viewer first: a hidden element cannot be measured */
        el.classList.add("is-open");
        photo.img.src = src;
        photo.origin = photoCenter();
        photoApply();

        var closeButton = qs(".is-close", el);
        if (closeButton && closeButton.focus) { closeButton.focus(); }
        photoGalleryAutoplay(false);
    }
    function closePhoto() {
        if (!photo.el || !photo.el.classList.contains("is-open")) { return; }
        photo.el.classList.remove("is-open");
        photo.gesture = null;
        photo.moved = false;
        if (photo.stage) { photo.stage.classList.remove("is-dragging"); }
        if (photo.img) { photo.img.removeAttribute("src"); }
        photoGalleryAutoplay(true);
        var trigger = photo.trigger;
        if (trigger && trigger.focus) { trigger.focus(); }
    }
    function initPhotoViewer() {
        var gallery = qs(".single-carousel");
        if (!gallery) { return; }
        var start = null;
        function remember(event) {
            var point = event.touches && event.touches.length ? event.touches[0] : event;
            if (point && point.clientX != null) { start = { x: point.clientX, y: point.clientY }; }
        }
        gallery.addEventListener("mousedown", remember, true);
        gallery.addEventListener("touchstart", remember, { capture: true, passive: true });

        gallery.addEventListener("click", function (event) {
            var target = event.target;
            if (!target) { return; }
            /* the download link handles itself */
            if (closest(target, "[data-single-download]")) { return; }
            var item = closest(target, ".single-item");
            if (!item) { return; }
            if (!closest(target, "[data-single-zoom]") && !closest(target, ".single-inner img")) { return; }
            /* ignore the click that ends a swipe */
            var moved = start && (Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10);
            start = null;
            if (moved) { return; }
            if (event.preventDefault) { event.preventDefault(); }
            openPhoto(qs("img", item));
        });
    }
    function feedback(form, type, message) {
        var box = qs("[data-form-feedback]", form) || qs(".dynamflow-feedback", form);
        if (!box) {
            toast(message, type);
            return;
        }
        box.classList.remove("alert-success", "alert-danger", "alert");
        box.classList.add("dynamflow-feedback", "is-visible", "alert", "mt-3", "mb-0",
            type === "success" ? "alert-success" : "alert-danger");
        box.textContent = message;
    }
    function hideFeedback(form) {
        var box = qs("[data-form-feedback]", form) || qs(".dynamflow-feedback", form);
        if (!box) { return; }
        box.classList.remove("is-visible", "alert", "alert-success", "alert-danger");
        box.textContent = "";
    }
    function setLoading(button, loading, originalHtml) {
        if (!button) { return; }
        if (loading) {
            button.setAttribute("data-original-html", button.innerHTML);
            button.className += " is-loading";
            button.setAttribute("disabled", "disabled");
            button.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>' +
                (button.getAttribute("data-loading-text") || "Please wait...");
        } else {
            button.className = button.className.replace(/\s*is-loading/, "");
            button.removeAttribute("disabled");
            button.innerHTML = originalHtml || button.getAttribute("data-original-html") || button.innerHTML;
        }
    }
    /* ---------------------------------------------------------------------
     * Web3Forms
     * ------------------------------------------------------------------- */
    function postToWeb3Forms(payload) {
        return fetch(SITE.web3FormsEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(payload)
        }).then(function (response) {
            return response.text().then(function (text) {
                var data;
                try { data = JSON.parse(text); } catch (e) { data = {}; }
                if (!response.ok || data.success !== true) {
                    throw new Error(
                        data.message ||
                        "We could not send your request right now (error " + response.status +
                        "). Please try again, or call / WhatsApp us on " + SITE.phone + "."
                    );
                }
                return data;
            });
        }, function () {
            /* the request never reached the server (offline, blocked, timeout) */
            throw new Error(
                "We could not reach the order service. Please check your internet connection and " +
                "try again, or call / WhatsApp us on " + SITE.phone + "."
            );
        });
    }
    /* Attach a Web3Forms submit handler to a form.
     *  build()      -> object of fields to send
     *  onSuccess()  -> optional extra work after a confirmed success
     */
    function attachWeb3Forms(form, options) {
        if (!form) { return; }
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            event.stopPropagation();

            if (form.getAttribute("data-submitting") === "1") { return; }
            if (typeof form.checkValidity === "function" && !form.checkValidity()) {
                form.className += form.className.indexOf("was-validated") === -1 ? " was-validated" : "";
                var firstInvalid = qs(":invalid", form);
                if (firstInvalid && firstInvalid.focus) { firstInvalid.focus(); }
                feedback(form, "error", "Please complete the highlighted fields before submitting.");
                toast("Please complete the highlighted fields before submitting.", "error");
                return;
            }
            var button = qs('[type="submit"]', form);
            var original = button ? button.innerHTML : "";
            var payload = options.build();

            /* reserved Web3Forms fields */
            payload.access_key = SITE.web3FormsKey;
            payload.botcheck = "";
            if (!payload.from_name) { payload.from_name = "Dynamflow Store Website"; }
            form.setAttribute("data-submitting", "1");
            hideFeedback(form);
            setLoading(button, true);

            postToWeb3Forms(payload).then(function () {
                if (typeof options.onSuccess === "function") { options.onSuccess(); }
                feedback(form, "success", options.successMessage);
                toast(options.successMessage, "success");
                form.reset();
                form.className = form.className.replace(/\s*was-validated/, "");
            }, function (error) {
                feedback(form, "error", error.message);
                toast(error.message, "error");
            }).then(function () {
                form.removeAttribute("data-submitting");
                setLoading(button, false, original);
                if (typeof options.onFinally === "function") { options.onFinally(); }
            });
        });
    }
    /* ---------------------------------------------------------------------
     * Shopping cart (persisted in localStorage)
     * ------------------------------------------------------------------- */
    var Cart = {
        read: function () {
            try {
                var raw = window.localStorage.getItem(SITE.cartKey);
                var data = raw ? JSON.parse(raw) : [];
                return Object.prototype.toString.call(data) === "[object Array]" ? data : [];
            } catch (e) { return []; }
        },
        write: function (lines) {
            try { window.localStorage.setItem(SITE.cartKey, JSON.stringify(lines)); } catch (e) { /* ignore */ }
            Cart.sync();
        },
        add: function (product, quantity, color, model) {
            var qty = Math.max(1, parseInt(quantity, 10) || 1);
            var lines = Cart.read();
            var key = product.id + "|" + (color || "") + "|" + (model || "");
            var found = null;
            for (var i = 0; i < lines.length; i++) {
                if (lines[i].key === key) { found = lines[i]; break; }
            }
            if (found) {
                found.qty += qty;
            } else {
                lines.push({ key: key, id: product.id, qty: qty, color: color || "", model: model || "" });
            }
            Cart.write(lines);
            return qty;
        },
        setQty: function (key, qty) {
            var lines = Cart.read();
            var value = parseInt(qty, 10);
            if (isNaN(value) || value < 1) { value = 1; }
            lines.forEach(function (line) { if (line.key === key) { line.qty = value; } });
            Cart.write(lines);
        },
        remove: function (key) {
            Cart.write(Cart.read().filter(function (line) { return line.key !== key; }));
        },
        clear: function () { Cart.write([]); },
        detailed: function () {
            return Cart.read().map(function (line) {
                var product = D.findProduct(line.id);
                if (!product) { return null; }
                var priced = D.hasPrice(product);
                return {
                    key: line.key,
                    product: product,
                    qty: line.qty,
                    color: line.color,
                    model: line.model || product.model,
                    priceOnRequest: !priced,
                    total: priced ? Number(product.price) * line.qty : 0
                };
            }).filter(function (line) { return !!line; });
        },
        count: function () {
            return Cart.read().reduce(function (sum, line) { return sum + (parseInt(line.qty, 10) || 0); }, 0);
        },
        subtotal: function () {
            return Cart.detailed().reduce(function (sum, line) { return sum + line.total; }, 0);
        },
        sync: function () {
            var text = money(Cart.subtotal());
            qsa("[data-header-cart-total]").forEach(function (el) { el.textContent = text; });
            syncMobileNav();
            updateProfileCartCount();
            renderNotifications();
            renderNotificationsPage();
            if (typeof window.dynamflowRenderCart === "function") { window.dynamflowRenderCart(); }
            if (typeof window.dynamflowRenderCheckout === "function") { window.dynamflowRenderCheckout(); }
        }
    };

    /* ---------------------------------------------------------------------
     * Discount coupons
     * ---------------------------------------------------------------------
     * The codes the shop accepts live in SITE.coupons (js/dynamflow-data.js).
     * The one the shopper typed is remembered in their own browser. A coupon
     * only ever takes a percentage off the subtotal.
     * ------------------------------------------------------------------- */
    var Coupon = {
        read: function () {
            var storage = safeStorage();
            if (!storage) { return ""; }
            try { return String(storage.getItem(SITE.couponKey) || "").toUpperCase(); }
            catch (e) { return ""; }
        },
        write: function (code) {
            var storage = safeStorage();
            if (!storage) { return; }
            try {
                if (code) { storage.setItem(SITE.couponKey, code); }
                else { storage.removeItem(SITE.couponKey); }
            } catch (e) { /* private browsing */ }
        },
        rate: function () {
            var codes = SITE.coupons || {};
            var code = Coupon.read();
            return (code && codes[code]) ? Number(codes[code]) : 0;
        },
        code: function () {
            return Coupon.rate() > 0 ? Coupon.read() : "";
        },
        /* The money taken off a subtotal by the saved coupon. */
        discount: function (subtotal) {
            if (!Cart.detailed().length) { return 0; }
            var rate = Coupon.rate();
            return rate > 0 ? Number(subtotal) * rate : 0;
        },
        percent: function () {
            return Math.round(Coupon.rate() * 100);
        },
        /* Try to accept a code. Returns the accepted code, or null. */
        apply: function (code) {
            var wanted = String(code || "").trim().toUpperCase();
            var codes = SITE.coupons || {};
            if (wanted && codes[wanted]) { Coupon.write(wanted); return wanted; }
            return null;
        },
        clear: function () { Coupon.write(""); }
    };

    /* True when the basket holds a product whose price still has to be
     * confirmed by the shop. Used so a total never hides that fact. */
    function cartPriceOnRequest() {
        return Cart.detailed().some(function (line) { return line.priceOnRequest; });
    }
    /* "K265.00", or "K265.00 + price on request" when some lines have no
     * published price yet. */
    function totalLabel(amount) {
        var text = money(amount);
        return cartPriceOnRequest() ? text + " + price on request" : text;
    }
    /* The total shown for one basket line. */
    function lineLabel(line) {
        return line.priceOnRequest ? "Price on request" : money(line.total);
    }
    /* Show or hide a "Discount (CODE)  -K25.00" row. */
    function paintDiscountRow(rowSelector, codeSelector, amountSelector, discount) {
        var row = qs(rowSelector);
        if (!row) { return; }
        if (discount > 0) {
            row.style.display = "";
            setText(qs(codeSelector), Coupon.code());
            setText(qs(amountSelector), "-" + money(discount));
        } else {
            row.style.display = "none";
        }
    }
    /* ---------------------------------------------------------------------
     * Wishlist (saved in the shopper's own browser - nothing is uploaded)
     * ---------------------------------------------------------------------
     * The heart icons on the product cards and the wishlist panel on the
     * My Account page both work from this list.
     * ------------------------------------------------------------------- */
    var Wishlist = {
        read: function () {
            try {
                var raw = window.localStorage.getItem(SITE.wishlistKey);
                var data = raw ? JSON.parse(raw) : [];
                return Object.prototype.toString.call(data) === "[object Array]" ? data : [];
            } catch (e) { return []; }
        },
        write: function (ids) {
            try { window.localStorage.setItem(SITE.wishlistKey, JSON.stringify(ids)); }
            catch (e) { /* storage unavailable - keep going */ }
            Wishlist.sync();
        },
        has: function (id) { return !!id && Wishlist.read().indexOf(id) !== -1; },
        toggle: function (id) {
            if (!id) { return false; }
            var ids = Wishlist.read();
            var at = ids.indexOf(id);
            if (at === -1) { ids.push(id); } else { ids.splice(at, 1); }
            Wishlist.write(ids);
            return at === -1;
        },
        remove: function (id) {
            Wishlist.write(Wishlist.read().filter(function (line) { return line !== id; }));
        },
        detailed: function () {
            return Wishlist.read().map(function (id) { return D.findProduct(id); })
                .filter(function (product) { return !!product; });
        },
        count: function () { return Wishlist.read().length; },
        sync: function () {
            var ids = Wishlist.read();

            qsa("[data-header-wishlist-total]").forEach(function (el) {
                el.textContent = String(ids.length);
            });

            qsa("[data-wishlist-toggle]").forEach(function (el) {
                var id = el.getAttribute("data-wishlist-toggle");
                var saved = !!id && ids.indexOf(id) !== -1;
                el.classList.toggle("is-wishlisted", saved);
                el.setAttribute("aria-pressed", saved ? "true" : "false");
                var icon = qs("i", el);
                if (icon) { icon.classList.toggle("text-secondary", saved); }
            });

            renderWishlist();
        }
    };

    /* The saved items on the My Account page */
    function renderWishlist() {
        var wrap = qs("[data-wishlist-list]");
        if (!wrap) { return; }
        var items = Wishlist.detailed();
        var empty = qs("[data-wishlist-empty]");
        var count = qs("[data-wishlist-total]");

        if (count) { count.textContent = String(items.length); }
        if (empty) { empty.style.display = items.length ? "none" : ""; }
        if (!items.length) { wrap.innerHTML = ""; return; }
        wrap.innerHTML = items.map(function (product) {
            var url = "single.html?id=" + encodeURIComponent(product.id);
            return '<div class="featured-product-item">' +
                '<div class="rounded me-4" style="width: 100px; height: 100px;">' +
                '<a href="' + url + '"><img src="' + esc(product.img) + '" class="img-fluid rounded" alt="' +
                esc(product.name) + '"></a></div>' +
                '<div>' +
                '<h6 class="mb-2"><a href="' + url + '" class="text-dark">' + esc(product.name) +
                (product.model ? " " + esc(product.model) : "") + '</a></h6>' +
                '<div class="d-flex mb-2"><h5 class="fw-bold me-2">' + esc(priceLabel(product.price)) + '</h5></div>' +
                '<div class="d-flex">' +
                '<a href="cart.html" class="btn btn-primary btn-sm rounded-pill py-1 px-3 me-2" data-wishlist-add="' +
                encodeURIComponent(product.id) + '"><i class="fas fa-shopping-cart me-1"></i> Add To Cart</a>' +
                '<button type="button" class="btn btn-secondary btn-sm rounded-pill py-1 px-3" data-wishlist-remove="' +
                encodeURIComponent(product.id) + '">Remove</button>' +
                '</div></div></div>';
        }).join("");
    }
    function initWishlist() {
        Wishlist.sync();

        document.addEventListener("click", function (event) {
            var add = closest(event.target, "[data-wishlist-add]");
            if (add) {
                event.preventDefault();
                var product = D.findProduct(add.getAttribute("data-wishlist-add"));
                if (product) {
                    Cart.add(product, 1, (product.colors || [])[0], product.model);
                    toast(product.name + (product.model ? " " + product.model : "") +
                        " added to your cart.", "success");
                }
                return;
            }
            var remove = closest(event.target, "[data-wishlist-remove]");
            if (remove) {
                event.preventDefault();
                Wishlist.remove(remove.getAttribute("data-wishlist-remove"));
                toast("Removed from your wishlist.", "info");
                return;
            }
            var toggle = closest(event.target, "[data-wishlist-toggle]");
            if (!toggle) { return; }
            event.preventDefault();
            var id = toggle.getAttribute("data-wishlist-toggle");
            if (!id) { return; }
            var saved = Wishlist.toggle(id);
            toast(saved ? "Saved to your wishlist." : "Removed from your wishlist.",
                saved ? "success" : "info");
        });
    }
    /* ---------------------------------------------------------------------
     * Order history (kept on the customer's own device)
     * ---------------------------------------------------------------------
     * Every order the customer sends from this browser is remembered here,
     * so the My Account page can show it back to them later. The list lives
     * in their own browser only - it is never uploaded anywhere.
     * ------------------------------------------------------------------- */
    var Orders = {
        read: function () {
            try {
                var raw = window.localStorage.getItem(SITE.ordersKey);
                var data = raw ? JSON.parse(raw) : [];
                return Object.prototype.toString.call(data) === "[object Array]" ? data : [];
            } catch (e) { return []; }
        },
        write: function (list) {
            try { window.localStorage.setItem(SITE.ordersKey, JSON.stringify(list)); }
            catch (e) { /* storage unavailable */ }
        },
        add: function (order) {
            var list = Orders.read();
            list.unshift(order);
            if (list.length > 50) { list = list.slice(0, 50); }
            Orders.write(list);
        },
        clear: function () { Orders.write([]); }
    };
    /* A short, friendly reference such as DYN-260414-4821. */
    function orderReference(now) {
        function pad(n) { return (n < 10 ? "0" : "") + n; }
        var d = now || new Date();
        var stamp = String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate());
        return "DYN-" + stamp + "-" + Math.floor(1000 + Math.random() * 9000);
    }
    /* Stamp a freshly-sent order with its reference, date and status, then
     * keep it in the customer's own order history. */
    function saveOrder(record) {
        var now = new Date();
        record.id = orderReference(now);
        record.date = now.toISOString();
        record.status = "Sent";
        Orders.add(record);
        renderOrderHistory();
        return record;
    }
    function orderDateLabel(date) {
        var when = Date.parse(date);
        if (isNaN(when)) { return String(date || ""); }
        try {
            return new Date(when).toLocaleString(undefined, {
                year: "numeric", month: "long", day: "numeric",
                hour: "2-digit", minute: "2-digit"
            });
        } catch (e) { return String(date || ""); }
    }
    /* Show the saved orders on the My Account page. Prices are re-formatted
     * here so the list follows the currency the customer has picked. */
    function renderOrderHistory() {
        var wrap = qs("[data-orders-list]");
        if (!wrap) { return; }
        var list = Orders.read();
        var empty = qs("[data-orders-empty]");
        var count = qs("[data-orders-total]");
        var clear = qs("[data-orders-clear]");
        if (count) { count.textContent = String(list.length); }
        if (clear) { clear.classList.toggle("d-none", list.length === 0); }
        if (empty) { empty.style.display = list.length ? "none" : ""; }
        if (!list.length) { wrap.innerHTML = ""; return; }
        wrap.innerHTML = list.map(function (order) {
            var suffix = order.price_on_request ? " + price on request" : "";
            var items = (order.items || []).map(function (item) {
                var missing = item.price === null || item.price === undefined;
                var unit = missing ? "Price on request" : money(Number(item.price));
                return '<div class="d-flex justify-content-between border-bottom py-2">' +
                    "<span>" + esc(item.name) +
                    (item.options && item.options !== "-" ?
                        '<br><small class="text-muted">' + esc(item.options) + "</small>" : "") +
                    "</span>" +
                    '<span class="text-nowrap ms-3">x' + esc(item.quantity) + " &middot; " + unit + "</span></div>";
            }).join("");
            var totals = '<div class="d-flex justify-content-between pt-3">' +
                '<span class="text-muted">Subtotal</span><span>' + money(Number(order.subtotal) || 0) + suffix + "</span></div>";
            if (Number(order.discount) > 0) {
                totals += '<div class="d-flex justify-content-between">' +
                    '<span class="text-muted">Coupon ' + esc(order.coupon || "") +
                    " (" + esc(order.coupon_percent || 0) + "% off)</span><span>-" +
                    money(Number(order.discount)) + "</span></div>";
            }
            totals += '<div class="d-flex justify-content-between"><span class="text-muted">Delivery</span><span>' +
                esc(order.shipping_label || "To be arranged") +
                (Number(order.shipping_cost) > 0 ? " (" + money(Number(order.shipping_cost)) + ")" : "") +
                "</span></div>";
            totals += '<div class="d-flex justify-content-between fw-bold"><span>Order total</span><span>' +
                money(Number(order.total) || 0) + suffix + "</span></div>";
            return '<div class="rounded border p-3 p-md-4 mb-3 dynamflow-order">' +
                '<div class="d-flex flex-wrap justify-content-between align-items-center mb-2">' +
                '<span class="fw-bold text-primary">Order ' + esc(order.id) + "</span>" +
                '<span class="badge bg-success">' + esc(order.status || "Sent") + "</span></div>" +
                '<p class="text-muted small mb-3">' + esc(orderDateLabel(order.date)) + " &middot; " +
                esc(order.type || "Order") + "</p>" + items + totals + "</div>";
        }).join("");
    }
    function initOrderHistory() {
        renderOrderHistory();
        var clear = qs("[data-orders-clear]");
        if (clear) {
            clear.addEventListener("click", function () {
                if (!window.confirm("Clear your order history on this device? This cannot be undone.")) { return; }
                Orders.clear();
                renderOrderHistory();
                toast("Order history cleared.", "info");
            });
        }
    }
    /* ---------------------------------------------------------------------
     * Saved customer profile (My Account page, persisted in localStorage)
     * ---------------------------------------------------------------------
     * The details are only kept on the customer's own device so they can be
     * used to fill in the cart, checkout and order forms more quickly. No
     * password is stored and nothing is sent anywhere until a form is sent.
     * ------------------------------------------------------------------- */
    var PROFILE_KEY = "dynamflow_profile_v1";

    var Profile = {
        read: function () {
            try {
                var raw = window.localStorage.getItem(PROFILE_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (e) { return null; }
        },
        write: function (data) {
            try { window.localStorage.setItem(PROFILE_KEY, JSON.stringify(data)); return true; }
            catch (e) { return false; }
        },
        clear: function () {
            try { window.localStorage.removeItem(PROFILE_KEY); } catch (e) { /* ignore */ }
        },
        name: function () {
            var profile = Profile.read();
            return profile && profile.full_name ? profile.full_name : "";
        },
        firstLast: function () {
            var name = Profile.name().replace(/\s+/g, " ").trim();
            if (!name) { return { first: "", last: "" }; }
            var at = name.indexOf(" ");
            if (at === -1) { return { first: name, last: "" }; }
            return { first: name.slice(0, at), last: name.slice(at + 1) };
        }
    };

    function profileInitials(name) {
        var parts = String(name || "").trim().split(/\s+/).filter(function (p) { return !!p; });
        if (!parts.length) { return "D"; }
        if (parts.length === 1) { return parts[0].charAt(0).toUpperCase(); }
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    function updateProfileCartCount() {
        var count = Cart.count();
        qsa("[data-profile-cart-count]").forEach(function (el) { el.textContent = String(count); });
    }
    function renderProfile() {
        var profile = Profile.read() || {};
        var address = [profile.address, profile.city, profile.country]
            .filter(function (v) { return !!v; }).join(", ");

        setText(qs("[data-profile-avatar]"), profileInitials(profile.full_name));
        setText(qs("[data-profile-display-name]"), profile.full_name || "Guest User");
        setText(qs("[data-profile-display-email]"), profile.email || "Add your email to speed up checkout");
        setText(qs("[data-profile-display-phone]"), profile.phone || "Not saved yet");
        setText(qs("[data-profile-display-whatsapp]"), profile.whatsapp || profile.phone || "Not saved yet");
        setText(qs("[data-profile-display-address]"), address || "No delivery address saved");
        updateProfileCartCount();
    }
    function initProfilePage() {
        var form = document.getElementById("profile-form");
        if (!form && !qs("[data-profile-display-name]")) { return; }
        renderProfile();
        if (!form) { return; }
        var fields = [
            ["#profile-name", "full_name"],
            ["#profile-email", "email"],
            ["#profile-phone", "phone"],
            ["#profile-whatsapp", "whatsapp"],
            ["#profile-address", "address"],
            ["#profile-city", "city"],
            ["#profile-country", "country"]
        ];
        var saved = Profile.read() || {};
        fields.forEach(function (field) {
            var input = qs(field[0], form);
            if (input) { input.value = saved[field[1]] || ""; }
        });

        form.addEventListener("submit", function (event) {
            event.preventDefault();

            var fullName = valueOf("#profile-name", form);
            var email = valueOf("#profile-email", form);
            var phone = valueOf("#profile-phone", form);

            if (!fullName || !email || !phone) {
                feedback(form, "error", "Please enter your name, email address and phone number.");
                return;
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                feedback(form, "error", "Please enter a valid email address.");
                return;
            }
            var data = {
                full_name: fullName,
                email: email,
                phone: phone,
                whatsapp: valueOf("#profile-whatsapp", form),
                address: valueOf("#profile-address", form),
                city: valueOf("#profile-city", form),
                country: valueOf("#profile-country", form)
            };

            if (!Profile.write(data)) {
                feedback(form, "error", "We could not save your details on this device. Please try again.");
                return;
            }
            renderProfile();

            /* Send the account details to the store so the owner can see who
             * has set up an account and reach them. */
            var button = qs('[type="submit"]', form);
            var original = button ? button.innerHTML : "";
            setLoading(button, true);
            hideFeedback(form);
            postToWeb3Forms({
                access_key: SITE.web3FormsKey,
                botcheck: "",
                subject: "New customer account - Dynamflow Store",
                from_name: "Dynamflow Store Website",
                submission_type: "Customer Account",
                replyto: email,
                full_name: fullName,
                email: email,
                phone: phone,
                whatsapp: data.whatsapp,
                address: data.address,
                city: data.city,
                country: data.country
            }).then(function () {
                feedback(form, "success", "Your details are saved on this device and have been sent to Dynamflow Store.");
                toast("Your account details have been sent to Dynamflow Store.", "success");
            }, function () {
                feedback(form, "error", "Your details are saved on this device, but we could not send them to Dynamflow Store just now. Please try again, or call / WhatsApp us on " + SITE.phone + ".");
                toast("Details saved on this device.", "info");
            }).then(function () {
                setLoading(button, false, original);
            });
        });

        var clearButton = qs("[data-profile-clear]");
        if (clearButton) {
            clearButton.addEventListener("click", function () {
                Profile.clear();
                form.reset();
                hideFeedback(form);
                renderProfile();
                toast("Saved details cleared.", "");
            });
        }
    }
    function prefillCheckout(form) {
        var profile = Profile.read();
        if (!profile) { return; }
        var name = Profile.firstLast();

        function fill(selector, value) {
            var input = qs(selector, form);
            if (input && !input.value && value) { input.value = value; }
        }
        fill("#checkout-first-name", name.first);
        fill("#checkout-last-name", name.last);
        fill("#checkout-email", profile.email);
        fill("#checkout-phone", profile.phone);
        fill("#checkout-whatsapp", profile.whatsapp || profile.phone);
        fill("#checkout-address", profile.address);
        fill("#checkout-city", profile.city);
        fill("#checkout-country", profile.country);
    }
    /* ---------------------------------------------------------------------
     * Product cards on the home / shop / bestseller pages
     * ------------------------------------------------------------------- */
    function wireProductCard(card) {
        if (card.getAttribute("data-wired") === "1") { return; }
        var img = qs("img", card);
        var product = productForCard(card);
        if (!product) { return; }
        card.setAttribute("data-wired", "1");
        card.setAttribute("data-product-id", product.id);

        var url = "single.html?id=" + encodeURIComponent(product.id);

        /* keep the visible details in sync with the catalogue */
        var title = qs("a.h4", card);
        if (title) {
            title.innerHTML = esc(product.name) + (product.model ? " <br> " + esc(product.model) : "");
        }
        var category = qsa("a.d-block", card).filter(function (a) {
            return !a.classList.contains("h4") && !qs("i", a);
        })[0];
        if (category) { category.textContent = product.category; }
        var price = qs("span.text-primary", card);
        if (price) { price.textContent = priceLabel(product.price); }
        /* photo + "New"/"Sale" badge come straight from the catalogue */
        applyProductImage(img, product);

        var badge = qs(".product-new, .product-sale", card);
        if (badge) {
            if (product.badge) {
                badge.textContent = product.badge;
                badge.style.display = "";
            } else {
                badge.style.display = "none";
            }
        }
        var oldPrice = qs("del", card);
        if (oldPrice) {
            if (product.oldPrice && D.hasPrice(product) &&
                Number(product.oldPrice) > Number(product.price)) {
                oldPrice.textContent = money(product.oldPrice);
                oldPrice.style.display = "";
            } else {
                oldPrice.style.display = "none";
            }
        }
        var detailsUrlTargets = qsa(
            ".product-details a, .related-details a, .products-mini-icon a, a.h4, a.d-block",
            card
        );
        detailsUrlTargets.forEach(function (a) {
            if (/add to cart/i.test(a.textContent || "")) { return; }
            if (a.hasAttribute("data-wishlist-toggle")) { return; }
            a.setAttribute("href", url);
        });

        if (img) {
            img.addEventListener("click", function () { window.location.href = url; });
        }
        qsa("a", card).forEach(function (a) {
            if (!/add to cart/i.test(a.textContent || "")) { return; }
            a.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                var qty = Cart.add(product, 1, (product.colors || [])[0], product.model);
                toast(product.name + (product.model ? " " + product.model : "") +
                    " (x" + qty + ") added to your cart.", "success");
            });
        });

        card.style.cursor = "pointer";
        card.addEventListener("click", function (event) {
            if (closest(event.target, "a, button, select, input, label")) { return; }
            window.location.href = url;
        });
    }
    function initProductCards() {
        qsa(".product-item, .related-item, .products-mini-item").forEach(wireProductCard);
    }
    /* ---------------------------------------------------------------------
     * Product page (single.html)
     * ------------------------------------------------------------------- */
    function initProductPage() {
        var orderForm = document.getElementById("order-form");
        var gallery = qs(".single-carousel");
        var hasProductUi = qs("[data-product-name]") || gallery || orderForm;
        if (!hasProductUi) { return; }
        var product = D.findProduct(queryParam("id")) || D.findProduct("p4") || D.PRODUCTS[0];
        if (!product) { return; }
        var fullName = product.name + (product.model ? " " + product.model : "");

        /* header / breadcrumb */
        setText(qs("[data-product-breadcrumb]"), fullName);
        if (document.title.indexOf("Dynamflow Store") !== -1) {
            document.title = fullName + " | " + SITE.name;
        }
        /* product details */
        setText(qs("[data-product-name]"), fullName);
        setText(qs("[data-product-category]"), product.category);
        var priceEl = qs("[data-product-price]");
        if (priceEl) {
            if (D.hasPrice(product)) { priceEl.setAttribute("data-price-zmw", String(product.price)); }
            setText(priceEl, priceLabel(product.price));
        }
        setText(qs("[data-product-sku]"), product.sku);
        setText(qs("[data-product-stock]"),
            (product.stock === null || product.stock === undefined)
                ? "Available - contact us to confirm"
                : (Number(product.stock) === 0 ? "Out of stock" : product.stock + " items in stock"));
        qsa("[data-product-description]").forEach(function (el) { setText(el, product.description); });

        var oldPriceEl = qs("[data-product-old-price]");
        if (oldPriceEl) {
            if (product.oldPrice && product.price !== null &&
                    Number(product.oldPrice) > Number(product.price)) {
                oldPriceEl.textContent = money(product.oldPrice);
                oldPriceEl.style.display = "";
            } else {
                oldPriceEl.style.display = "none";
            }
        }
        /* gallery - the product's own photos (up to 5, photo 1 first) */
        if (gallery) {
            var images = D.photos ? D.photos(product)
                : [product.img].concat(product.images || []);
            if (!images.length) { images = [photoPlaceholder(product.name)]; }
            gallery.innerHTML = images.map(function (src, i) {
                var alt = fullName;
                var label = alt + (images.length > 1 ? " photo " + (i + 1) : "");
                var fallback = photoPlaceholder(product.name);
                return '<div class="single-item" data-dot="<img class=\'img-fluid\' src=\'' + src + '\' alt=\'\'>">' +
                    '<div class="single-inner bg-light rounded">' +
                    '<img src="' + src + '" class="img-fluid rounded" alt="' + esc(alt) + '"' +
                    ' onerror="this.onerror=null;this.src=\'' + fallback + '\';">' +
                    '<div class="dynamflow-gallery-actions">' +
                    '<button type="button" class="dynamflow-gallery-btn" data-single-zoom' +
                    ' aria-label="Zoom in on this photo" title="Zoom in on this photo">' +
                    '<i class="fa fa-search-plus" aria-hidden="true"></i></button>' +
                    '<a class="dynamflow-gallery-btn" data-single-download href="' + src + '"' +
                    ' download="' + esc(photoFileName(src, label)) + '"' +
                    ' aria-label="Download this photo" title="Download this photo">' +
                    '<i class="fa fa-download" aria-hidden="true"></i></a>' +
                    "</div>" +
                    "</div></div>";
            }).join("");
            reinitOwl(gallery);
        }
        /* colour options - either a <select data-product-color> or a radio group */
        var colorSelect = qs("[data-product-color]");
        var colorGroup = qs("[data-product-color-group]");
        var colors = (product.colors || []).slice();
        if (!colors.length) { colors = ["Default"]; }
        if (colorSelect) {
            colorSelect.innerHTML = colors.map(function (color) {
                return '<option value="' + esc(color) + '">' + esc(color) + "</option>";
            }).join("");
        }
        if (colorGroup) {
            colorGroup.innerHTML = colors.map(function (color, i) {
                var id = "product-color-" + (i + 1);
                return '<div class="additional-product-item">' +
                    '<input type="radio" class="me-2" id="' + id + '" name="product-color" value="' + esc(color) + '"' +
                    (i === 0 ? " checked" : "") + ">" +
                    '<label for="' + id + '" class="text-dark"> ' + esc(color) + "</label>" +
                    "</div>";
            }).join("");
        }
        var modelSelect = qs("[data-product-model]");
        if (modelSelect) {
            var modelLabel = product.model || "Standard";
            modelSelect.innerHTML = '<option value="' + esc(modelLabel) + '">' + esc(modelLabel) + "</option>";
        }
        var qtyInput = qs("[data-product-qty]");

        function selectedColor() {
            if (colorSelect) { return colorSelect.value; }
            if (colorGroup) {
                var checked = qs("input[name='product-color']:checked", colorGroup);
                return checked ? checked.value : (colors[0] || "");
            }
            return "";
        }
        function selectedModel() { return modelSelect ? modelSelect.value : product.model; }
        function selectedQty() {
            var qty = qtyInput ? parseInt(qtyInput.value, 10) : 1;
            if (isNaN(qty) || qty < 1) { qty = 1; }
            return qty;
        }
        function syncSummary() {
            var qty = selectedQty();
            var color = selectedColor();
            var model = selectedModel();
            var label = product.name + " " + model + (color && color !== "Default" ? " (" + color + ")" : "");
            var unit = priceLabel(product.price);
            var lineTotal = D.hasPrice(product) ? money(Number(product.price) * qty) : "Price on request";

            setText(qs("[data-order-summary-product]"), label);
            setText(qs("[data-order-summary-price]"), unit);
            setText(qs("[data-order-summary-qty]"), qty);
            setText(qs("[data-order-summary-total]"), lineTotal);

            var hidden = {
                "[data-order-product-name]": product.name + " " + model,
                "[data-order-unit-price]": unit,
                "[data-order-total]": lineTotal
            };
            Object.keys(hidden).forEach(function (selector) {
                var field = qs(selector, orderForm);
                if (field) { field.value = hidden[selector]; }
            });

            var wa = qs("[data-order-whatsapp]");
            if (wa) {
                wa.setAttribute("href", SITE.whatsappUrl + "?text=" + encodeURIComponent(
                    "Hello " + SITE.name + ", I would like to order:\n" +
                    label + "\nQuantity: " + qty + "\nPrice: " + lineTotal +
                    "\n\nPlease confirm availability and delivery."
                ));
            }
            return { qty: qty, color: color, model: model, label: label };
        }
        function addToCart() {
            var selection = syncSummary();
            var qty = Cart.add(product, selection.qty, selection.color, selection.model);
            toast(product.name + " " + selection.model + " (x" + qty + ") added to your cart.", "success");
        }
        qsa("[data-add-to-cart]").forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.preventDefault();
                addToCart();
            });
        });

        qsa("[data-order-now]").forEach(function (button) {
            button.addEventListener("click", function (event) {
                event.preventDefault();
                syncSummary();
                var section = document.getElementById("order-section");
                if (section && section.scrollIntoView) {
                    section.scrollIntoView({ behavior: "smooth", block: "start" });
                }
                var nameField = qs("#order-name");
                if (nameField) {
                    window.setTimeout(function () { nameField.focus(); }, 600);
                }
            });
        });

        [colorSelect, colorGroup, modelSelect, qtyInput].forEach(function (field) {
            if (!field) { return; }
            field.addEventListener("change", syncSummary);
        });
        if (qtyInput) {
            qtyInput.addEventListener("input", function () {
                var qty = parseInt(qtyInput.value, 10);
                if (!isNaN(qty) && qty < 1) { qtyInput.value = "1"; }
                syncSummary();
            });
            /* the template's +/- buttons live in the same quantity group - keep
             * the order summary in step with them */
            var qtyGroup = closest(qtyInput, ".quantity");
            if (qtyGroup) {
                qsa("button", qtyGroup).forEach(function (button) {
                    button.addEventListener("click", function () {
                        window.setTimeout(syncSummary, 0);
                    });
                });
            }
        }
        syncSummary();

        /* Order form -> Web3Forms */
        var pendingOrder = null;
        attachWeb3Forms(orderForm, {
            build: function () {
                var selection = syncSummary();
                /* remember the order for the customer's own order history */
                var priced = D.hasPrice(product);
                pendingOrder = {
                    type: "Order Request",
                    name: valueOf("#order-name", orderForm),
                    email: valueOf("#order-email", orderForm),
                    phone: valueOf("#order-phone", orderForm),
                    items: [{
                        name: product.name + (selection.model ? " " + selection.model : ""),
                        options: [selection.color, selection.model].filter(function (v) { return v && v !== "Default"; }).join(" / ") || "-",
                        quantity: selection.qty,
                        price: priced ? Number(product.price) : null
                    }],
                    subtotal: priced ? Number(product.price) * selection.qty : 0,
                    discount: 0,
                    coupon: "",
                    coupon_percent: 0,
                    shipping_label: "To be arranged with the store",
                    shipping_cost: 0,
                    total: priced ? Number(product.price) * selection.qty : 0,
                    price_on_request: !priced
                };
                return {
                    subject: "New Order Request - Dynamflow Store",
                    from_name: "Dynamflow Store Website",
                    submission_type: "Order",
                    name: valueOf("#order-name", orderForm),
                    email: valueOf("#order-email", orderForm),
                    phone: valueOf("#order-phone", orderForm),
                    whatsapp: valueOf("#order-whatsapp", orderForm),
                    product_name: product.name + " " + selection.model,
                    product_model: selection.model,
                    product_color: selection.color,
                    quantity: selection.qty,
                    unit_price: priceLabel(product.price),
                    order_total: money(product.price * selection.qty),
                    delivery_preference: valueOf("#order-delivery", orderForm),
                    delivery_address: valueOf("#order-address", orderForm),
                    additional_instructions: valueOf("#order-notes", orderForm),
                    replyto: valueOf("#order-email", orderForm)
                };
            },
            successMessage: "Thank you! Your order request for " + product.name + " has been sent. " +
                "Dynamflow Store will contact you to confirm your order. " +
                "This is an order request - not a confirmed sale and no payment has been taken.",
            onSuccess: function () {
                if (pendingOrder) { saveOrder(pendingOrder); pendingOrder = null; }
            }
        });

        /* product review form (\"Leave a Reply\" in the reviews tab) */
        var reviewForm = document.getElementById("review-form");
        if (reviewForm) {
            initReviewStars();
            attachWeb3Forms(reviewForm, {
                build: function () {
                    return {
                        subject: "New product review - " + product.name,
                        product_id: product.id,
                        product_name: product.name + (product.model ? " " + product.model : ""),
                        name: valueOf("#review-name", reviewForm),
                        email: valueOf("#review-email", reviewForm),
                        rating: valueOf("#review-rating", reviewForm),
                        message: valueOf("#review-message", reviewForm),
                        replyto: valueOf("#review-email", reviewForm)
                    };
                },
                successMessage: "Thank you! Your review has been sent to Dynamflow Store. " +
                    "It will be published once our team has checked it."
            });
        }

        /* Show the real reviews already recorded in js/dynamflow-data.js. */
        renderReviews(product);
    }
    /* A row of five stars, "filled" up to the given rating. */
    function starsMarkup(rating) {
        var value = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
        var out = '<div class="d-flex mb-3">';
        for (var i = 1; i <= 5; i++) {
            out += '<i class="fa fa-star' + (i <= value ? " text-secondary" : "") + '"></i>';
        }
        return out + "</div>";
    }
    function reviewDateLabel(date) {
        if (!date) { return ""; }
        var when = Date.parse(date);
        if (isNaN(when)) { return String(date); }
        try { return new Date(when).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); }
        catch (e) { return String(date); }
    }
    /* Customer reviews for the product, taken from js/dynamflow-data.js. No
     * pictures are shown - just the name, stars, date and the words. */
    function renderReviews(product) {
        var box = qs("[data-reviews]");
        if (!box || !product) { return; }
        var list = D.reviewsFor ? D.reviewsFor(product.id) : [];
        var summary = D.productRating ? D.productRating(product.id) : null;
        if (!list.length) {
            box.innerHTML = '<p class="text-muted mb-0">No reviews yet. Be the first to ' +
                "review this product using the form below.</p>";
            return;
        }
        var head = "";
        if (summary) {
            head = '<div class="d-flex align-items-center flex-wrap mb-4">' +
                '<div class="me-3">' + starsMarkup(summary.average) + "</div>" +
                '<span class="text-muted">' + summary.average.toFixed(1) + " out of 5 - " +
                summary.count + (summary.count === 1 ? " review" : " reviews") + "</span></div>";
        }
        var body = list.map(function (review) {
            return '<div class="mb-4 dynamflow-review">' +
                '<div class="d-flex justify-content-between align-items-center flex-wrap">' +
                '<h5 class="mb-0">' + esc(review.name || "Dynamflow customer") + "</h5>" +
                starsMarkup(review.rating) + "</div>" +
                (review.date ? '<p class="mb-2" style="font-size: 14px;">' +
                    esc(reviewDateLabel(review.date)) + "</p>" : "") +
                '<p class="text-dark mb-0">' + esc(review.text || "") + "</p></div>";
        }).join("");
        box.innerHTML = head + body;
    }
    /* Make the star row on the review form pick a rating. The stars keep the
     * look they already had in the template - only the colour of the filled
     * stars changes when one is chosen. */
    function initReviewStars() {
        var row = document.getElementById("review-rating-stars");
        if (!row) { return; }
        var input = document.getElementById("review-rating");
        var stars = qsa("[data-rating]", row);

        function paint(value) {
            stars.forEach(function (star) {
                var at = Number(star.getAttribute("data-rating"));
                var on = at <= value;
                star.classList.toggle("text-muted", !on);
                star.classList.toggle("text-secondary", on);
                star.setAttribute("aria-checked", on && at === value ? "true" : "false");
            });
        }
        function choose(value) {
            row.setAttribute("data-rating-value", String(value));
            if (input) { input.value = String(value); }
            paint(value);
        }
        stars.forEach(function (star) {
            var value = Number(star.getAttribute("data-rating"));
            star.style.cursor = "pointer";
            star.addEventListener("click", function () { choose(value); });
            star.addEventListener("keydown", function (event) {
                if (event.key === "Enter" || event.key === " " || event.keyCode === 13 || event.keyCode === 32) {
                    event.preventDefault();
                    choose(value);
                }
            });
        });

        /* keep the stars as the template drew them until a rating is picked */
        if (row.getAttribute("data-rating-value")) { paint(Number(row.getAttribute("data-rating-value"))); }
    }
    function valueOf(selector, form) {
        var field = qs(selector, form);
        return field ? String(field.value || "").trim() : "";
    }
    /* ---------------------------------------------------------------------
     * Cart page
     * ------------------------------------------------------------------- */
    window.dynamflowRenderCart = function () {
        var body = qs("[data-cart-body]");
        if (!body) { return; }
        var lines = Cart.detailed();
        var empty = qs("[data-cart-empty]");
        var tableWrap = qs("[data-cart-table]");

        if (!lines.length) {
            body.innerHTML = "";
            if (tableWrap) { tableWrap.style.display = "none"; }
            if (empty) { empty.style.display = ""; }
            setText(qs("[data-cart-subtotal]"), money(0));
            setText(qs("[data-cart-grand-total]"), money(0));
            paintDiscountRow("[data-cart-discount-row]", "[data-cart-discount-code]", "[data-cart-discount]", 0);
            var checkoutButton = qs("[data-proceed-checkout]");
            if (checkoutButton) { checkoutButton.className += " disabled"; checkoutButton.setAttribute("aria-disabled", "true"); }
            return;
        }
        if (tableWrap) { tableWrap.style.display = ""; }
        if (empty) { empty.style.display = "none"; }
        body.innerHTML = lines.map(function (line) {
            var options = [line.model, line.color].filter(function (v) { return !!v; }).join(" / ");
            return '<tr data-cart-row="' + esc(line.key) + '">' +
                '<th scope="row"><p class="mb-0 py-4">' + esc(line.product.name) + "</p></th>" +
                '<td><p class="mb-0 py-4">' + esc(options) + "</p></td>" +
                '<td><p class="mb-0 py-4">' + priceLabel(line.product.price) + "</p></td>" +
                '<td><div class="input-group quantity py-4" style="width: 100px;">' +
                '<div class="input-group-btn"><button class="btn btn-sm btn-minus rounded-circle bg-light border" type="button" data-cart-minus><i class="fa fa-minus"></i></button></div>' +
                '<input type="text" class="form-control form-control-sm text-center border-0" value="' + line.qty + '" data-cart-qty>' +
                '<div class="input-group-btn"><button class="btn btn-sm btn-plus rounded-circle bg-light border" type="button" data-cart-plus><i class="fa fa-plus"></i></button></div>' +
                "</div></td>" +
                '<td><p class="mb-0 py-4">' + lineLabel(line) + "</p></td>" +
                '<td class="py-4"><button class="btn btn-md rounded-circle bg-light border" type="button" data-cart-remove><i class="fa fa-times text-danger"></i></button></td>' +
                "</tr>";
        }).join("");

        var subtotal = Cart.subtotal();
        var shipping = Number(qs("[data-cart-shipping-value]") ? qs("[data-cart-shipping-value]").getAttribute("data-cart-shipping-value") : 0) || 0;
        if (!shipping) { shipping = 0; }
        var discount = Coupon.discount(subtotal);
        setText(qs("[data-cart-subtotal]"), totalLabel(subtotal));
        setText(qs("[data-cart-shipping]"), shipping > 0 ? money(shipping) : "Free");
        paintDiscountRow("[data-cart-discount-row]", "[data-cart-discount-code]", "[data-cart-discount]", discount);
        setText(qs("[data-cart-grand-total]"), totalLabel(subtotal - discount + shipping));
        var removeCoupon = qs("[data-coupon-remove]");
        if (removeCoupon) { removeCoupon.classList.toggle("d-none", Coupon.rate() <= 0); }

        var checkoutButton2 = qs("[data-proceed-checkout]");
        if (checkoutButton2) {
            checkoutButton2.className = checkoutButton2.className.replace(/\s*disabled/, "");
            checkoutButton2.removeAttribute("aria-disabled");
        }
        qsa("[data-cart-row]", body).forEach(function (row) {
            var key = row.getAttribute("data-cart-row");
            var qtyField = qs("[data-cart-qty]", row);
            qsa("[data-cart-minus]", row).forEach(function (button) {
                button.addEventListener("click", function () {
                    Cart.setQty(key, (parseInt(qtyField.value, 10) || 1) - 1);
                });
            });
            qsa("[data-cart-plus]", row).forEach(function (button) {
                button.addEventListener("click", function () {
                    Cart.setQty(key, (parseInt(qtyField.value, 10) || 1) + 1);
                });
            });
            if (qtyField) {
                qtyField.addEventListener("change", function () { Cart.setQty(key, qtyField.value); });
            }
            qsa("[data-cart-remove]", row).forEach(function (button) {
                button.addEventListener("click", function () {
                    Cart.remove(key);
                    toast("Item removed from your cart.", "success");
                });
            });
        });
    };

    /* ---------------------------------------------------------------------
     * Checkout page
     * ------------------------------------------------------------------- */
    /* Remove only the item rows generated below, leaving the static subtotal,
     * delivery (shipping options) and total rows from the markup in place. */
    function clearCheckoutItemRows(body) {
        qsa("[data-checkout-row]", body).forEach(function (row) {
            if (row.parentNode) { row.parentNode.removeChild(row); }
        });
    }
    window.dynamflowRenderCheckout = function () {
        var body = qs("[data-checkout-body]");
        if (!body) { return; }
        var lines = Cart.detailed();
        var empty = qs("[data-checkout-empty]");
        var tableWrap = qs("[data-checkout-table]");

        clearCheckoutItemRows(body);

        if (!lines.length) {
            if (tableWrap) { tableWrap.style.display = "none"; }
            if (empty) { empty.style.display = ""; }
            setText(qs("[data-checkout-subtotal]"), money(0));
            setText(qs("[data-checkout-total]"), money(0));
            paintDiscountRow("[data-checkout-discount-row]", "[data-checkout-discount-code]", "[data-checkout-discount]", 0);
            return;
        }
        if (tableWrap) { tableWrap.style.display = ""; }
        if (empty) { empty.style.display = "none"; }
        var rowsHtml = lines.map(function (line) {
            var options = [line.model, line.color].filter(function (v) { return !!v; }).join(" / ");
            return '<tr class="text-center" data-checkout-row="' + esc(line.key) + '">' +
                '<th scope="row" class="text-start py-4">' + esc(line.product.name) +
                (line.color && line.color !== "Default" ? '<br><small class="text-muted">' + esc(line.color) + "</small>" : "") +
                "</th>" +
                '<td class="py-4">' + esc(options) + "</td>" +
                '<td class="py-4">' + priceLabel(line.product.price) + "</td>" +
                '<td class="py-4">' + line.qty + "</td>" +
                '<td class="py-4">' + lineLabel(line) + "</td>" +
                "</tr>";
        }).join("");

        if (rowsHtml) { body.insertAdjacentHTML("afterbegin", rowsHtml); }
        var subtotal = Cart.subtotal();
        setText(qs("[data-checkout-subtotal]"), totalLabel(subtotal));
        updateCheckoutTotals();
    };

    function selectedShipping() {
        var checked = qs('input[name="shipping_method"]:checked');
        var key = checked ? checked.value : "free";
        return SITE.shipping[key] || SITE.shipping.free;
    }
    function updateCheckoutTotals() {
        var subtotal = Cart.subtotal();
        var shipping = Cart.detailed().length ? selectedShipping().cost : 0;
        var discount = Coupon.discount(subtotal);
        setText(qs("[data-checkout-shipping-label]"), selectedShipping().label + (shipping > 0 ? " (" + money(shipping) + ")" : " (Free)"));
        paintDiscountRow("[data-checkout-discount-row]", "[data-checkout-discount-code]", "[data-checkout-discount]", discount);
        setText(qs("[data-checkout-total]"), totalLabel(subtotal - discount + shipping));

        var summaryField = qs("[data-checkout-summary]");
        if (summaryField) { summaryField.value = buildOrderSummaryText(); }
        return subtotal - discount + shipping;
    }
    function buildOrderSummaryText() {
        var lines = Cart.detailed();
        if (!lines.length) { return "No items in the cart."; }
        var text = lines.map(function (line, index) {
            return (index + 1) + ". " + line.product.name + " " + line.model +
                (line.color && line.color !== "Default" ? " (" + line.color + ")" : "") +
                " x" + line.qty + " @ " + priceLabel(line.product.price) + " = " + lineLabel(line);
        }).join("\n");
        var shipping = selectedShipping();
        var discount = Coupon.discount(Cart.subtotal());
        var total = Cart.subtotal() - discount + shipping.cost;
        text += "\n\nSubtotal: " + totalLabel(Cart.subtotal());
        if (discount > 0) {
            text += "\nCoupon " + Coupon.code() + " (" + Coupon.percent() + "% off): -" + money(discount);
        }
        text += "\nDelivery: " + shipping.label + " (" + money(shipping.cost) + ")" +
            "\nOrder total: " + totalLabel(total);
        return text;
    }
    function initCheckoutPage() {
        var form = document.getElementById("checkout-form");
        if (!form) { return; }
        var pendingOrder = null;
        qsa('input[name="shipping_method"]').forEach(function (input) {
            input.addEventListener("change", updateCheckoutTotals);
        });
        prefillCheckout(form);
        window.dynamflowRenderCheckout();

        attachWeb3Forms(form, {
            build: function () {
                var lines = Cart.detailed();
                var shipping = selectedShipping();
                var subtotal = Cart.subtotal();
                var discount = Coupon.discount(subtotal);
                var total = subtotal - discount + shipping.cost;
                var email = valueOf("#checkout-email", form);
                var fullName = valueOf("#checkout-first-name", form) + " " + valueOf("#checkout-last-name", form);

                var items = lines.map(function (line, index) {
                    return {
                        position: index + 1,
                        product: line.product.name + " " + line.model,
                        options: [line.color, line.model].filter(function (v) { return v && v !== "Default"; }).join(" / ") || "-",
                        quantity: line.qty,
                        unit_price: priceLabel(line.product.price),
                        line_total: lineLabel(line)
                    };
                });

                var payload = {
                    subject: "New Checkout Order - Dynamflow Store",
                    from_name: "Dynamflow Store Website",
                    submission_type: "Checkout",
                    replyto: email,
                    full_name: fullName,
                    email: email,
                    phone: valueOf("#checkout-phone", form),
                    whatsapp: valueOf("#checkout-whatsapp", form),
                    company: valueOf("#checkout-company", form),
                    delivery_address: [valueOf("#checkout-address", form), valueOf("#checkout-city", form),
                        valueOf("#checkout-country", form), valueOf("#checkout-postcode", form)]
                        .filter(function (v) { return !!v; }).join(", "),
                    delivery_preference: valueOf("#checkout-delivery-preference", form),
                    shipping_method: shipping.label,
                    payment_preference: (qs('input[name="payment_preference"]:checked') || {}).value || "Not specified",
                    additional_notes: valueOf("#checkout-notes", form),
                    order_items: buildOrderSummaryText(),
                    order_subtotal: totalLabel(subtotal),
                    coupon_code: Coupon.code() || "-",
                    order_discount: discount > 0 ? "-" + money(discount) : money(0),
                    order_delivery: money(shipping.cost),
                    order_total: totalLabel(total)
                };

                /* one line per item so the store owner can read the order at a glance */
                items.forEach(function (item) {
                    payload["item_" + item.position] = item.product + " | options: " + item.options +
                        " | qty: " + item.quantity + " | unit: " + item.unit_price + " | line total: " + item.line_total;
                });

                var summaryField = qs("[data-checkout-summary]", form);
                if (summaryField) { summaryField.value = buildOrderSummaryText(); }

                /* keep the order so it can be saved to the customer's own
                 * order history once the send is confirmed */
                pendingOrder = {
                    type: "Checkout",
                    name: fullName,
                    email: email,
                    phone: valueOf("#checkout-phone", form),
                    items: lines.map(function (line) {
                        return {
                            name: line.product.name + (line.model ? " " + line.model : ""),
                            options: [line.color, line.model].filter(function (v) { return v && v !== "Default"; }).join(" / ") || "-",
                            quantity: line.qty,
                            price: line.priceOnRequest ? null : Number(line.product.price)
                        };
                    }),
                    subtotal: subtotal,
                    discount: discount,
                    coupon: Coupon.code(),
                    coupon_percent: Coupon.percent(),
                    shipping_label: shipping.label,
                    shipping_cost: shipping.cost,
                    total: total,
                    price_on_request: cartPriceOnRequest()
                };
                return payload;
            },
            successMessage: "Thank you! Your order has been sent to Dynamflow Store. " +
                "We will contact you to confirm your order and delivery. " +
                "No payment has been taken on this website.",
            onSuccess: function () {
                var summary = buildOrderSummaryText();
                var confirmation = qs("[data-checkout-confirmation]");
                if (confirmation) {
                    var box = qs("[data-checkout-confirmation-summary]", confirmation);
                    if (box) { box.textContent = summary; }
                    confirmation.style.display = "";
                    if (confirmation.scrollIntoView) { confirmation.scrollIntoView({ behavior: "smooth", block: "start" }); }
                }
                if (pendingOrder) { saveOrder(pendingOrder); pendingOrder = null; }
                Cart.clear();
                setText(qs("[data-checkout-subtotal]"), money(0));
                setText(qs("[data-checkout-total]"), money(0));
                var body = qs("[data-checkout-body]");
                if (body) { clearCheckoutItemRows(body); }
                var tableWrap = qs("[data-checkout-table]");
                if (tableWrap) { tableWrap.style.display = "none"; }
            }
        });
    }
    /* ---------------------------------------------------------------------
     * Contact page
     * ------------------------------------------------------------------- */
    function initContactPage() {
        var form = document.getElementById("contact-form");
        if (!form) { return; }
        attachWeb3Forms(form, {
            build: function () {
                var email = valueOf("#contact-email", form);
                return {
                    subject: "New Contact Message - Dynamflow Store",
                    from_name: "Dynamflow Store Website",
                    submission_type: "Contact Message",
                    replyto: email,
                    name: valueOf("#contact-name", form),
                    email: email,
                    phone: valueOf("#contact-phone", form),
                    subject_line: valueOf("#contact-subject", form),
                    message: valueOf("#contact-message", form)
                };
            },
            successMessage: "Thank you for contacting Dynamflow Store. Your message has been sent - we will get back to you shortly."
        });
    }
    /* ---------------------------------------------------------------------
     * Footer newsletter
     * ------------------------------------------------------------------- */
    function initNewsletter() {
        var wrap = qs(".footer .position-relative");
        if (!wrap) { return; }
        var input = qs("input", wrap);
        var button = qs("button", wrap);
        if (!input || !button) { return; }
        function subscribe() {
            var email = String(input.value || "").trim();
            if (!email || email.indexOf("@") === -1) {
                toast("Please enter a valid email address to subscribe.", "error");
                input.focus();
                return;
            }
            var original = button.innerHTML;
            setLoading(button, true);
            postToWeb3Forms({
                access_key: SITE.web3FormsKey,
                subject: "New Newsletter Subscription - Dynamflow Store",
                from_name: "Dynamflow Store Website",
                submission_type: "Newsletter",
                email: email,
                replyto: email,
                botcheck: ""
            }).then(function () {
                toast("Thank you for subscribing to Dynamflow Store updates.", "success");
                input.value = "";
            }, function (error) {
                toast(error.message, "error");
            }).then(function () { setLoading(button, false, original); });
        }
        button.addEventListener("click", function (event) { event.preventDefault(); subscribe(); });
        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter") { event.preventDefault(); subscribe(); }
        });
    }
    /* ---------------------------------------------------------------------
     * Cart page extras (coupon + checkout button)
     * ------------------------------------------------------------------- */
    function initCartPage() {
        var coupon = qs("[data-coupon-form]");
        if (coupon) {
            var couponInput = qs("input", coupon);
            var couponButton = qs("[data-coupon-apply]", coupon) || qs("button", coupon);
            var removeButton = qs("[data-coupon-remove]", coupon);
            if (couponInput) {
                couponInput.value = Coupon.code();
                couponInput.addEventListener("keydown", function (event) {
                    if (event.key === "Enter") { event.preventDefault(); applyCoupon(); }
                });
            }
            function applyCoupon() {
                var typed = couponInput ? String(couponInput.value || "").trim() : "";
                if (!typed) {
                    toast("Please type a coupon code, or shop on without one.");
                    return;
                }
                if (Coupon.apply(typed)) {
                    toast("Coupon " + Coupon.code() + " applied: " + Coupon.percent() + "% off.", "success");
                } else {
                    toast("That coupon code was not recognised.", "error");
                }
                window.dynamflowRenderCart();
            }
            if (couponButton) {
                couponButton.addEventListener("click", function (event) {
                    event.preventDefault();
                    applyCoupon();
                });
            }
            if (removeButton) {
                removeButton.addEventListener("click", function (event) {
                    event.preventDefault();
                    Coupon.clear();
                    if (couponInput) { couponInput.value = ""; }
                    toast("Coupon removed.");
                    window.dynamflowRenderCart();
                });
            }
        }
        var proceed = qs("[data-proceed-checkout]");
        if (proceed) {
            proceed.addEventListener("click", function (event) {
                event.preventDefault();
                if (!Cart.detailed().length) {
                    toast("Your cart is empty. Add a product before checking out.", "error");
                    return;
                }
                window.location.href = "cheackout.html";
            });
        }
    }
    /* ---------------------------------------------------------------------
     * Mobile bottom navigation (active tab highlight + cart badge)
     * ------------------------------------------------------------------- */
    function initMobileNav() {
        var page = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
        if (page === "single.html") { page = "shop.html"; }
        if (page === "cheackout.html") { page = "cart.html"; }
        qsa(".dynamflow-mobile-nav-item").forEach(function (link) {
            var href = (link.getAttribute("href") || "").split("?")[0].toLowerCase();
            if (href === page) { link.classList.add("active"); }
        });
    }
    function syncMobileNav() {
        var count = Cart.count();
        qsa("[data-mobile-cart-count]").forEach(function (el) {
            el.textContent = String(count);
            if (count > 0) { el.classList.remove("d-none"); }
            else { el.classList.add("d-none"); }
        });
    }
    /* ---------------------------------------------------------------------
     * Mobile header notifications (bell icon)
     * ---------------------------------------------------------------------
     * A small list of store updates: a welcome note, the current cart state,
     * the delivery options and a way to reach support. The badge shows how
     * many have not been opened yet; opening the panel marks them as read
     * (kept on this device only).
     * ------------------------------------------------------------------- */
    var NOTIFY_READ_KEY = "dynamflow_notify_read_v1";

    function notifyReadIds() {
        try {
            var raw = window.localStorage.getItem(NOTIFY_READ_KEY);
            var ids = raw ? JSON.parse(raw) : [];
            return Object.prototype.toString.call(ids) === "[object Array]" ? ids : [];
        } catch (e) { return []; }
    }
    function notifyMarkRead(ids) {
        var all = notifyReadIds();
        ids.forEach(function (id) {
            if (all.indexOf(id) === -1) { all.push(id); }
        });
        if (all.length > 60) { all = all.slice(all.length - 60); }
        try { window.localStorage.setItem(NOTIFY_READ_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    }
    function notifications() {
        var count = Cart.count();
        return [
            {
                id: "welcome",
                icon: "fa-star",
                title: "Welcome to " + D.SITE.name,
                text: "Thanks for shopping with us. Browse the latest gadgets and accessories.",
                href: "shop.html",
                linkText: "Browse the shop"
            },
            {
                id: "cart-" + count,
                icon: "fa-shopping-cart",
                title: count ? "Your cart is waiting" : "Your cart is empty",
                text: count
                    ? "You have " + count + " item(s) in your cart. Finish your order whenever you are ready."
                    : "Add something you love and check out when you are ready.",
                href: "cart.html",
                linkText: "View cart"
            },
            {
                id: "delivery",
                icon: "fa-truck",
                title: "Delivery & collection",
                text: "Choose free shipping, a flat delivery rate or local pickup at checkout.",
                href: "cheackout.html",
                linkText: "Go to checkout"
            },
            {
                id: "account",
                icon: "fa-user",
                title: "Checkout faster",
                text: "Save your contact and delivery details once and reuse them on every order.",
                href: "profile.html",
                linkText: "Set up my details"
            },
            {
                id: "help",
                icon: "fa-headset",
                title: "Need a hand?",
                text: "Call " + D.SITE.phone + " or message us on WhatsApp " + D.SITE.whatsapp + ".",
                href: D.SITE.whatsappUrl,
                linkText: "Chat on WhatsApp",
                external: true
            }
        ];
    }
    function renderNotifications() {
        var items = notifications();
        var read = notifyReadIds();
        var badge = qs("[data-notify-count]");

        var unread = items.filter(function (item) { return read.indexOf(item.id) === -1; }).length;
        if (badge) {
            badge.textContent = String(unread);
            if (unread > 0) { badge.classList.remove("d-none"); }
            else { badge.classList.add("d-none"); }
        }
        var host = qs("[data-notify-list]");
        if (!host) { return; }
        host.innerHTML = items.map(function (item) {
            var isUnread = read.indexOf(item.id) === -1;
            var external = item.external ? ' target="_blank" rel="noopener"' : "";
            return '<a class="dynamflow-notify-item' + (isUnread ? " is-unread" : "") + '" href="' +
                item.href + '"' + external + '>' +
                '<span class="dynamflow-notify-item-icon"><i class="fa ' + item.icon + '" aria-hidden="true"></i></span>' +
                '<span class="dynamflow-notify-item-body">' +
                '<strong>' + item.title + '</strong>' +
                '<span>' + item.text + '</span>' +
                '<em>' + item.linkText + ' <i class="fa fa-angle-right" aria-hidden="true"></i></em>' +
                '</span></a>';
        }).join("");
    }
    function initNotifications() {
        var button = qs("[data-notify-toggle]");
        if (!button) { return; }
        var wrapper = button.parentNode;
        while (wrapper && !wrapper.classList.contains("dynamflow-mobile-notify")) {
            wrapper = wrapper.parentNode;
        }
        if (!wrapper) { return; }
        var panel = document.createElement("div");
        panel.className = "dynamflow-notify-panel";
        panel.id = "dynamflow-notify-panel";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", "Notifications");
        panel.innerHTML =
            '<div class="dynamflow-notify-head">' +
            '<span>Notifications</span>' +
            '<span class="dynamflow-notify-head-actions">' +
            '<a class="dynamflow-notify-view-all" href="notifications.html">View all <i class="fa fa-angle-right" aria-hidden="true"></i></a>' +
            '<button type="button" class="dynamflow-notify-close" data-notify-close aria-label="Close notifications">' +
            '<i class="fa fa-times" aria-hidden="true"></i></button>' +
            '</span>' +
            '</div>' +
            '<div class="dynamflow-notify-list" data-notify-list></div>';
        wrapper.appendChild(panel);

        function close() {
            panel.classList.remove("is-open");
            button.setAttribute("aria-expanded", "false");
        }
        function open() {
            renderNotifications();
            panel.classList.add("is-open");
            button.setAttribute("aria-expanded", "true");
            notifyMarkRead(notifications().map(function (item) { return item.id; }));
            renderNotifications();
        }
        button.addEventListener("click", function (event) {
            event.preventDefault();
            if (panel.classList.contains("is-open")) { close(); } else { open(); }
        });

        var closeButton = qs("[data-notify-close]", panel);
        if (closeButton) { closeButton.addEventListener("click", close); }
        panel.addEventListener("click", function (event) {
            if (event.target && event.target.closest && event.target.closest("a")) { close(); }
        });

        document.addEventListener("click", function (event) {
            if (!panel.classList.contains("is-open")) { return; }
            if (!wrapper.contains(event.target)) { close(); }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") { close(); }
        });

        renderNotifications();
    }
    /* ---------------------------------------------------------------------
     * Notifications page (full list of the same updates)
     * ------------------------------------------------------------------- */
    function renderNotificationsPage() {
        var host = qs("[data-notifications-list]");
        if (!host) { return; }
        var items = notifications();
        var read = notifyReadIds();
        var unread = items.filter(function (item) { return read.indexOf(item.id) === -1; });

        host.innerHTML = items.map(function (item) {
            var isUnread = read.indexOf(item.id) === -1;
            var external = item.external ? ' target="_blank" rel="noopener"' : "";
            return '<div class="dynamflow-notify-card' + (isUnread ? " is-unread" : "") + '">' +
                '<div class="rounded-circle bg-secondary d-flex align-items-center justify-content-center flex-shrink-0"' +
                ' style="width: 60px; height: 60px;"><i class="fa ' + item.icon + ' fa-2x text-primary"></i></div>' +
                '<div class="dynamflow-notify-card-body">' +
                '<div class="d-flex flex-wrap align-items-center gap-2 mb-1">' +
                '<h5 class="mb-0">' + item.title + '</h5>' +
                (isUnread ? '<span class="dynamflow-notify-new">New</span>' : "") +
                '</div>' +
                '<p class="mb-2">' + item.text + '</p>' +
                '<a class="text-primary fw-semibold" href="' + item.href + '"' + external +
                ' data-notify-id="' + item.id + '">' + item.linkText +
                ' <i class="fa fa-angle-right ms-1" aria-hidden="true"></i></a>' +
                '</div></div>';
        }).join("");

        setText(qs("[data-notifications-unread]"), String(unread.length));

        var markAll = qs("[data-notifications-mark-all]");
        if (markAll) {
            if (unread.length > 0) { markAll.classList.remove("d-none"); }
            else { markAll.classList.add("d-none"); }
        }
    }
    function initNotificationsPage() {
        var host = qs("[data-notifications-list]");
        if (!host) { return; }
        host.addEventListener("click", function (event) {
            var link = event.target && event.target.closest ? event.target.closest("[data-notify-id]") : null;
            if (!link) { return; }
            notifyMarkRead([link.getAttribute("data-notify-id")]);
            renderNotifications();
            renderNotificationsPage();
        });

        var markAll = qs("[data-notifications-mark-all]");
        if (markAll) {
            markAll.addEventListener("click", function () {
                notifyMarkRead(notifications().map(function (item) { return item.id; }));
                renderNotifications();
                renderNotificationsPage();
                toast("All notifications marked as read.", "success");
            });
        }
        renderNotificationsPage();
    }
    /* ---------------------------------------------------------------------
     * Product search (mobile header, desktop header and shop keyword box)
     * ------------------------------------------------------------------- */
    function currentPageName() {
        return (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    }
    /* Active shop filters - set by the keyword box, the category / colour
     * links, the sidebar controls and the ?q= ?cat= ?color= query string. */
    var shopFilters = { q: "", cat: "", color: "", maxPrice: 0, sort: "default" };

    /* Work out which catalogue product a card belongs to. The generated cards
     * carry data-product-id; the template's own cards are recognised by the
     * link to the product page, the wishlist heart, or the photo. */
    function productForCard(card) {
        if (!card) { return null; }
        var id = card.getAttribute("data-product-id");
        if (id && typeof D.findProduct === "function") {
            var byId = D.findProduct(id);
            if (byId) { return byId; }
        }
        var link = qs('a[href*="single.html"]', card);
        if (link) {
            var match = /[?&]id=([^&#]+)/.exec(link.getAttribute("href") || "");
            if (match) {
                var byLink = D.findProduct(decodeURIComponent(match[1]));
                if (byLink) { return byLink; }
            }
        }
        var heart = card.getAttribute("data-wishlist-toggle");
        if (heart && typeof D.findProduct === "function") {
            var byHeart = D.findProduct(heart);
            if (byHeart) { return byHeart; }
        }
        var img = qs("img", card);
        return (img && typeof D.findProductByImage === "function")
            ? D.findProductByImage(img.getAttribute("src")) : null;
    }
    /* The template groups some categories together ("SmartPhone & Smart TV"),
     * so a filter matches when either name contains the other. */
    function categoryMatches(productCategory, requested) {
        var a = String(productCategory || "").trim().toLowerCase();
        var b = String(requested || "").trim().toLowerCase();
        if (!a || !b) { return false; }
        if (a === b) { return true; }
        return (" " + b + " ").indexOf(a) !== -1 || (" " + a + " ").indexOf(b) !== -1;
    }
    function cardMatchesFilters(card) {
        var product = productForCard(card);
        var q = String(shopFilters.q || "").trim().toLowerCase();
        var cat = String(shopFilters.cat || "").trim().toLowerCase();
        var color = String(shopFilters.color || "").trim().toLowerCase();

        if (q) {
            var haystack = product
                ? [product.name, product.model, product.category, product.sku, product.description]
                    .join(" ").toLowerCase()
                : (card.textContent || "").toLowerCase();
            if (haystack.indexOf(q) === -1) { return false; }
        }
        if (cat) {
            if (!product || !categoryMatches(product.category, cat)) { return false; }
        }
        if (color) {
            if (!product) { return false; }
            var colours = (product.colors || []).map(function (name) { return String(name).toLowerCase(); });
            if (colours.indexOf(color) === -1) { return false; }
        }
        if (shopFilters.maxPrice) {
            if (!product || Number(product.price) > shopFilters.maxPrice) { return false; }
        }
        return true;
    }
    function describeShopFilters(shown, total) {
        var parts = [];
        if (shopFilters.q) { parts.push("matching \u201c" + shopFilters.q + "\u201d"); }
        if (shopFilters.cat) { parts.push("in " + shopFilters.cat); }
        if (shopFilters.color) { parts.push("in " + shopFilters.color); }
        if (shopFilters.maxPrice) { parts.push("under " + money(shopFilters.maxPrice)); }
        var label = parts.join(" ");
        if (shown) { return shown + " of " + total + " products " + label; }
        return "No products " + label + " yet. Browse all products from the Shop menu.";
    }
    function applyShopFilters() {
        var total = 0;
        var shown = 0;
        var seen = {};
        var filtered = !!(shopFilters.q || shopFilters.cat || shopFilters.color || shopFilters.maxPrice);

        ["#tab-5", "#tab-6"].forEach(function (scopeSelector) {
            var scope = qs(scopeSelector);
            if (!scope) { return; }
            qsa(".product-item, .products-mini-item", scope).forEach(function (card) {
                /* The grid and the list show the same products, so count each
                 * product once by its catalogue id. */
                var product = productForCard(card);
                var key = product ? product.id : null;
                if (key === null || !seen[key]) { total++; if (key !== null) { seen[key] = true; } }
                var match = cardMatchesFilters(card);
                var column = closest(card, '[class*="col-"]') || card;
                column.style.display = match ? "" : "none";
                if (match && (key === null || !seen["\u0000" + key])) {
                    if (key !== null) { seen["\u0000" + key] = true; }
                    shown++;
                }
            });
        });

        sortShopGrid();

        if (!total) { return; }
        qsa('input[placeholder="keywords"], input[placeholder="Search Looking For?"]').forEach(function (input) {
            input.value = shopFilters.q || "";
        });

        var summary = describeShopFilters(shown, total);
        var note = qs("[data-search-results]");
        if (note) {
            note.textContent = filtered
                ? summary
                : (note.getAttribute("data-search-default") || "All Products");
            note.style.display = "";
            return;
        }
        if (filtered) { toast(summary, shown ? "success" : "error"); }
    }
    /* Re-order the product columns on the shop page for the Sort By control.
     * The original order is remembered the first time so "Default Sorting"
     * can put everything back exactly as the template drew it. */
    function sortShopGrid() {
        var mode = shopFilters.sort || "default";
        ["#tab-5", "#tab-6"].forEach(function (scopeSelector) {
            var scope = qs(scopeSelector);
            if (!scope) { return; }
            var row = qs(".row.product", scope) || scope;
            var columns = Array.prototype.slice.call(row.children).filter(function (child) {
                return child.querySelector ? !!qs(".product-item, .products-mini-item", child) : false;
            });
            if (columns.length < 2) { return; }
            if (!row.getAttribute("data-default-order")) {
                columns.forEach(function (column, index) { column.setAttribute("data-order", String(index)); });
                row.setAttribute("data-default-order", "1");
            }
            columns.sort(function (a, b) {
                if (mode === "default") {
                    return Number(a.getAttribute("data-order")) - Number(b.getAttribute("data-order"));
                }
                var productA = productForCard(qs(".product-item, .products-mini-item", a));
                var productB = productForCard(qs(".product-item, .products-mini-item", b));
                var priceA = productA ? Number(productA.price) : 0;
                var priceB = productB ? Number(productB.price) : 0;
                return mode === "price-desc" ? priceB - priceA : priceA - priceB;
            });
            columns.forEach(function (column) { row.appendChild(column); });
        });
    }
    /* The shop page's sidebar controls: the Sort By select, the price range and
     * the category radios under "Additional Products". */
    function initShopControls() {
        if (!document.getElementById("tab-5")) { return; }
        var sortSelect = document.getElementById("electronics");
        if (sortSelect) {
            var wanted = [
                { value: "default", label: "Default Sorting" },
                { value: "price-asc", label: "Price: Low to High" },
                { value: "price-desc", label: "Price: High to Low" }
            ];
            var options = sortSelect.querySelectorAll("option");
            wanted.forEach(function (option, index) {
                var node = options[index];
                if (node) {
                    node.value = option.value;
                    node.textContent = option.label;
                } else {
                    node = document.createElement("option");
                    node.value = option.value;
                    node.textContent = option.label;
                    sortSelect.appendChild(node);
                }
            });
            for (var i = wanted.length; i < options.length; i++) {
                options[i].parentNode.removeChild(options[i]);
            }
            sortSelect.addEventListener("change", function () {
                shopFilters.sort = sortSelect.value || "default";
                applyShopFilters();
            });
        }
        var range = document.getElementById("rangeInput");
        if (range) {
            var ceiling = 0;
            (D.PRODUCTS || []).forEach(function (product) {
                ceiling = Math.max(ceiling, Number(product.price) || 0);
            });
            ceiling = Math.ceil(ceiling);
            if (ceiling > 0) {
                range.min = "0";
                range.max = String(ceiling);
                range.value = String(ceiling);
                var amount = document.getElementById("amount");
                if (amount) { amount.value = String(ceiling); }
            }
            range.addEventListener("input", function () {
                var value = Number(range.value);
                shopFilters.maxPrice = ceiling > 0 && value >= ceiling ? 0 : value;
                applyShopFilters();
            });
        }
        qsa('input[type="radio"][name="Categories-1"]').forEach(function (radio) {
            radio.addEventListener("change", function () {
                var label = radio.id ? qs('label[for="' + radio.id + '"]') : null;
                shopFilters.cat = label ? String(label.textContent || "").trim() : "";
                applyShopFilters();
            });
        });
    }
    function applyShopSearch(term) {
        shopFilters.q = String(term || "").trim();
        applyShopFilters();
    }
    /* Live "available products" results under the header search boxes:
     * as soon as the shopper types, matching in-stock products appear right
     * there under the field, linking straight to the product page. */
    function searchCatalogue(term) {
        var needle = String(term || "").trim().toLowerCase();
        if (!needle) { return []; }
        var words = needle.split(/\s+/).filter(Boolean);

        var matches = (D.PRODUCTS || []).filter(function (product) {
            /* "stock: null" means "ask us" - only an explicit 0 hides a product. */
            if (product.stock !== null && product.stock !== undefined &&
                product.stock !== "" && Number(product.stock) === 0) { return false; }
            var haystack = [product.name, product.model, product.category, product.sku, product.id]
                .join(" ").toLowerCase();
            return words.every(function (word) { return haystack.indexOf(word) !== -1; });
        });

        var leading = [], rest = [];
        matches.forEach(function (product) {
            if (String(product.name || "").toLowerCase().indexOf(needle) === 0) { leading.push(product); }
            else { rest.push(product); }
        });
        return leading.concat(rest);
    }
    function renderLiveSearch(input, panel) {
        var term = String(input.value || "").trim();
        if (!term) {
            panel.classList.remove("is-open");
            panel.innerHTML = "";
            return;
        }
        var matches = searchCatalogue(term);
        var html;

        if (!matches.length) {
            html = '<div class="dynamflow-search-empty">No available products match \u201c' + esc(term) +
                '\u201d. Try a different word or browse the <a href="shop.html">shop</a>.</div>';
        } else {
            html = '<div class="dynamflow-search-panel-head"><span>Available products</span><span>' +
                matches.length + " match" + (matches.length === 1 ? "" : "es") + "</span></div>";

            matches.slice(0, 6).forEach(function (product) {
                html += '<a class="dynamflow-search-item" href="single.html?id=' + esc(product.id) + '">' +
                    '<span class="dynamflow-search-thumb"><img src="' + esc(product.img) + '" alt="' +
                    esc(product.name) + '" loading="lazy"></span>' +
                    '<span class="dynamflow-search-info"><span class="dynamflow-search-name">' +
                    esc(product.name) + "</span>" +
                    '<span class="dynamflow-search-meta">' +
                    esc((product.model ? product.model + " \u00b7 " : "") + (product.category || "")) +
                    "</span></span>" +
                    '<span class="dynamflow-search-price">' + esc(priceLabel(product.price)) + "</span></a>";
            });

            html += '<a class="dynamflow-search-all" href="shop.html?q=' + encodeURIComponent(term) +
                '">See all results for \u201c' + esc(term) + '\u201d</a>';
        }
        panel.innerHTML = html;
        panel.classList.add("is-open");
    }
    function initLiveSearch() {
        var inputs = qsa('[data-search-input], input[placeholder="Search Looking For?"]');
        if (!inputs.length) { return; }
        inputs.forEach(function (input) {
            var anchor = input.parentNode;
            if (!anchor || qs(".dynamflow-search-panel", anchor)) { return; }
            if (getComputedStyle(anchor).position === "static") { anchor.style.position = "relative"; }
            var panel = document.createElement("div");
            panel.className = "dynamflow-search-panel";
            panel.setAttribute("role", "listbox");
            panel.setAttribute("aria-label", "Available products");
            anchor.appendChild(panel);

            input.setAttribute("autocomplete", "off");

            input.addEventListener("input", function () { renderLiveSearch(input, panel); });
            input.addEventListener("focus", function () {
                if (input.value.trim()) { renderLiveSearch(input, panel); }
            });
            input.addEventListener("keydown", function (event) {
                if (event.key === "Escape" || event.keyCode === 27) {
                    panel.classList.remove("is-open");
                    return;
                }
                if (event.key === "Enter" || event.keyCode === 13) {
                    panel.classList.remove("is-open");
                }
            });

            var form = closest(input, "form");
            if (form && form.getAttribute("data-live-search-bound") !== "1") {
                form.setAttribute("data-live-search-bound", "1");
                form.addEventListener("submit", function () {
                    qsa(".dynamflow-search-panel", form).forEach(function (item) {
                        item.classList.remove("is-open");
                    });
                });
            }
            /* Let a result link take the click without the input blurring first. */
            panel.addEventListener("mousedown", function (event) { event.preventDefault(); });

            document.addEventListener("click", function (event) {
                if (event.target === input || panel.contains(event.target)) { return; }
                panel.classList.remove("is-open");
            });
        });
    }
    function runSearch(term) {
        var clean = String(term || "").trim();
        if (!clean) {
            toast("Please type what you are looking for.", "");
            return;
        }
        if (currentPageName() === "shop.html") {
            applyShopSearch(clean);
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, "", "shop.html?q=" + encodeURIComponent(clean));
            }
            var results = qs("[data-search-results]");
            if (results && results.scrollIntoView) {
                results.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        } else {
            window.location.href = "shop.html?q=" + encodeURIComponent(clean);
        }
    }
    function initSearch() {
        /* mobile header search forms */
        qsa("[data-search-form]").forEach(function (form) {
            form.addEventListener("submit", function (event) {
                event.preventDefault();
                var input = qs("[data-search-input]", form);
                runSearch(input ? input.value : "");
            });
        });

        /* desktop header search box (input + button, not wrapped in a form) */
        qsa('input[placeholder="Search Looking For?"]').forEach(function (input) {
            if (closest(input, "[data-search-form]")) { return; }
            input.addEventListener("keydown", function (event) {
                if (event.key === "Enter" || event.keyCode === 13) {
                    event.preventDefault();
                    runSearch(input.value);
                }
            });
            var button = qs("button", input.parentNode);
            if (button) {
                button.addEventListener("click", function (event) {
                    event.preventDefault();
                    runSearch(input.value);
                });
            }
        });

        /* keyword box: live-filters the shop grid, and sends the search to the
         * shop page when the box lives on any other page (e.g. the product page) */
        var onShop = currentPageName() === "shop.html";
        qsa('input[placeholder="keywords"]').forEach(function (input) {
            input.addEventListener("keydown", function (event) {
                if (event.key !== "Enter" && event.keyCode !== 13) { return; }
                event.preventDefault();
                runSearch(input.value);
            });
            if (onShop) {
                input.addEventListener("input", function () { applyShopSearch(input.value); });
            }
            var group = closest(input, ".input-group");
            var icon = qs("#search-icon-1", group) || qs(".input-group-text", group);
            if (icon) {
                icon.style.cursor = "pointer";
                icon.addEventListener("click", function () { runSearch(input.value); });
            }
        });

        /* ?q= ?cat= ?color= arriving from another page drive the shop grid */
        if (onShop) {
            shopFilters.cat = queryParam("cat");
            shopFilters.color = queryParam("color");
            shopFilters.q = queryParam("q");
            if (shopFilters.cat || shopFilters.color || shopFilters.q) { applyShopFilters(); }
        } else {
            var q = queryParam("q");
            if (q) { qsa("[data-search-input]").forEach(function (input) { input.value = q; }); }
        }
    }
    /* The "All Category" selector in the desktop header search bar sends the
     * shopper to the matching shop filter. */
    function initHeaderCategory() {
        qsa("select.form-select").forEach(function (select) {
            if (closest(select, "[data-search-form]")) { return; }
            if (!qs('option[value="All Category"]', select)) { return; }
            select.addEventListener("change", function () {
                var value = String(select.value || "").trim();
                if (!value || value === "All Category") {
                    window.location.href = "shop.html";
                } else {
                    window.location.href = "shop.html?cat=" + encodeURIComponent(value);
                }
            });
        });
    }
    /* ---------------------------------------------------------------------
     * Product rows built from the catalogue
     * ---------------------------------------------------------------------
     * The shop, home and bestseller pages build their product rows from the
     * catalogue in js/dynamflow-data.js. Adding a product there - or changing
     * a photo, a name, a price or a description - is all that is needed; the
     * HTML does not have to be touched.
     * ------------------------------------------------------------------- */

    /* How many products each row shows (0 = show every product). */
    var CATALOGUE_LIMITS = {
        homeTab: 0,      /* "All Products" tab on the home / bestseller page */
        tagTab: 8,       /* New Arrivals / Featured / Top Selling tabs */
        bestseller: 6,   /* the "Bestseller Products" row */
        shopGrid: 0,     /* the main grid on the shop page */
        shopList: 0      /* the list view on the shop page */
    };

    /* Which row on which page is filled from which tag. */
    var CATALOGUE_ROWS = [
        { selector: "#tab-1 > .row", tag: "all", style: "grid", limit: "homeTab" },
        { selector: "#tab-2 > .row", tag: "new", style: "grid", limit: "tagTab" },
        { selector: "#tab-3 > .row", tag: "featured", style: "grid", limit: "tagTab" },
        { selector: "#tab-4 > .row", tag: "top", style: "grid", limit: "tagTab" },
        { selector: "#tab-5 > .row", tag: "all", style: "grid", limit: "shopGrid" },
        { selector: "#tab-6 > .row", tag: "all", style: "list", limit: "shopList" },
        { selector: '[data-catalogue-row="bestseller"]', tag: "bestseller", style: "list", limit: "bestseller" }
    ];

    function productPageUrl(product) {
        return "single.html?id=" + encodeURIComponent(product.id);
    }
    /* <del>K280.00</del> <span>K250.00</span> - on the home page a product that
     * has an old price shows it crossed out next to the new price. Everywhere
     * else only the current price is shown. */
    function priceMarkup(product, showOld) {
        var out = "";
        var has = D.hasPrice(product);
        if (showOld && has && product.oldPrice !== null && product.oldPrice !== undefined &&
            product.oldPrice !== "" && Number(product.oldPrice) > Number(product.price)) {
            out += '<del class="me-2 fs-5" data-old-price-zmw="' + esc(String(product.oldPrice)) + '">' +
                esc(money(product.oldPrice)) + "</del>";
        }
        if (has) {
            out += '<span class="text-primary fs-5" data-price-zmw="' + esc(String(product.price)) + '">' +
                esc(priceLabel(product.price)) + "</span>";
        } else {
            out += '<span class="text-primary fs-5">Price on request</span>';
        }
        return out;
    }
    function heartMarkup(product) {
        return '<a href="profile.html#wishlist"' +
            ' class="text-primary d-flex align-items-center justify-content-center me-0"' +
            ' data-wishlist-toggle="' + esc(product.id) + '"><span class="rounded-circle btn-sm-square border">' +
            '<i class="fas fa-heart"></i></span></a>';
    }
    /* A product card in the template's grid style. */
    function catalogueGridCard(product, colClass, delay, showOld) {
        var url = productPageUrl(product);
        return '<div class="' + colClass + '">' +
            '<div class="product-item rounded wow fadeInUp" data-wow-delay="' + delay + '">' +
            '<div class="product-item-inner border rounded">' +
            '<div class="product-item-inner-item">' +
            '<img src="' + esc(product.img) + '" class="img-fluid w-100 rounded-top"' +
            ' alt="' + esc(product.name) + '">' +
            (product.badge ? '<div class="' + (product.badge === "Sale" ? "product-sale" : "product-new") + '">' +
                esc(product.badge) + "</div>" : "") +
            '<div class="product-details"><a href="' + url + '"><i class="fa fa-eye fa-1x"></i></a></div>' +
            "</div>" +
            '<div class="text-center rounded-bottom p-4">' +
            '<a href="' + url + '" class="d-block mb-2">' + esc(product.category) + "</a>" +
            '<a href="' + url + '" class="d-block h4">' + esc(product.name) + "</a>" +
            priceMarkup(product, showOld) +
            "</div>" +
            "</div>" +
            '<div class="product-item-add border border-top-0 rounded-bottom  text-center p-4 pt-0">' +
            '<a href="cart.html" class="btn btn-primary border-secondary rounded-pill py-2 px-4 mb-4">' +
            '<i class="fas fa-shopping-cart me-2"></i> Add To Cart</a>' +
            '<div class="d-flex justify-content-between align-items-center">' +
            '<div class="d-flex">' +
            '<i class="fas fa-star text-primary"></i><i class="fas fa-star text-primary"></i>' +
            '<i class="fas fa-star text-primary"></i><i class="fas fa-star text-primary"></i>' +
            '<i class="fas fa-star"></i>' +
            "</div>" +
            '<div class="d-flex">' + heartMarkup(product) + "</div>" +
            "</div>" +
            "</div>" +
            "</div></div>";
    }
    /* A product card in the template's horizontal list style. */
    function catalogueListCard(product, colClass, delay, showOld) {
        var url = productPageUrl(product);
        return '<div class="' + colClass + ' wow fadeInUp" data-wow-delay="' + delay + '">' +
            '<div class="products-mini-item border">' +
            '<div class="row g-0">' +
            '<div class="col-5">' +
            '<div class="products-mini-img border-end h-100">' +
            '<img src="' + esc(product.img) + '" class="img-fluid w-100 h-100"' +
            ' alt="' + esc(product.name) + '">' +
            '<div class="products-mini-icon rounded-circle bg-primary">' +
            '<a href="' + url + '"><i class="fa fa-eye fa-1x text-white"></i></a>' +
            "</div>" +
            "</div>" +
            "</div>" +
            '<div class="col-7">' +
            '<div class="products-mini-content p-3">' +
            '<a href="' + url + '" class="d-block mb-2">' + esc(product.category) + "</a>" +
            '<a href="' + url + '" class="d-block h4">' + esc(product.name) + "</a>" +
            priceMarkup(product, showOld) +
            "</div>" +
            "</div>" +
            "</div>" +
            '<div class="products-mini-add border p-3">' +
            '<a href="cart.html" class="btn btn-primary border-secondary rounded-pill py-2 px-4">' +
            '<i class="fas fa-shopping-cart me-2"></i> Add To Cart</a>' +
            '<div class="d-flex">' + heartMarkup(product) + "</div>" +
            "</div>" +
            "</div></div>";
    }
    function renderCatalogueRows() {
        CATALOGUE_ROWS.forEach(function (spec) {
            var row = qs(spec.selector);
            if (!row) { return; }
            var products = D.productsFor ? D.productsFor(spec.tag) : [];
            var limit = CATALOGUE_LIMITS[spec.limit] || 0;
            if (limit > 0 && products.length > limit) { products = products.slice(0, limit); }
            if (!products.length) { return; }
            /* Reuse the column width the template already uses in this row. */
            var first = row.children.length ? row.children[0] : null;
            var colClass = first ? String(first.className || "") : "";
            colClass = colClass.replace(/\bwow\b/g, "").replace(/\bfade[A-Za-z]+\b/g, "")
                .replace(/\s+/g, " ").trim();
            if (!colClass) {
                colClass = spec.style === "list"
                    ? "col-md-6 col-lg-6 col-xl-4" : "col-md-6 col-lg-4 col-xl-3";
            }
            var delays = ["0.1s", "0.3s", "0.5s", "0.7s"];
            /* The crossed-out old price is a home-page treat only. */
            var showOld = currentPageName() === "index.html";
            row.innerHTML = products.map(function (product, i) {
                var delay = delays[i % delays.length];
                return spec.style === "list"
                    ? catalogueListCard(product, colClass, delay, showOld)
                    : catalogueGridCard(product, colClass, delay, showOld);
            }).join("");
            row.setAttribute("data-catalogue-built", "1");
        });

        /* Let the template's fade-in effect cover the new cards as well. */
        if (typeof window.WOW === "function") {
            try { new window.WOW().init(); } catch (e) { /* animation is optional */ }
        }
    }
    /* ---------------------------------------------------------------------
     * Sharing - send a product or the shop to Facebook, WhatsApp, X,
     * Telegram, e-mail, or copy the link
     * ---------------------------------------------------------------------
     * Every share control in the page markup is a button carrying
     * data-share="facebook" | "whatsapp" | "twitter" | "telegram" |
     * "linkedin" | "email" | "copy" | "native". The real address is worked
     * out here, so a button always shares the page the shopper is on. A
     * "native" button uses the phone's own share sheet and hides itself on
     * browsers that have none.
     * ------------------------------------------------------------------- */

    /* The published address of the site: the one configured in SITE, or the
     * folder the browser is currently reading from. */
    function siteBase() {
        var configured = String(SITE.url || "").replace(/\/+$/, "");
        if (/^https?:\/\//i.test(configured)) { return configured; }
        if (!window.location.origin) { return ""; }
        return window.location.origin +
            window.location.pathname.replace(/[^/]*$/, "").replace(/\/+$/, "");
    }
    function absoluteUrl(path) {
        if (!path) { return ""; }
        if (/^(https?:|data:)/i.test(path)) { return path; }
        return siteBase() + "/" + String(path).replace(/^\.?\//, "");
    }
    /* The product being viewed, or null on every other page. */
    function currentProduct() {
        if (typeof currentPageName === "function" && currentPageName() !== "single.html") {
            return null;
        }
        if (!qs("[data-product-name]") && !qs(".single-carousel")) { return null; }
        return (typeof D.findProduct === "function") ? D.findProduct(queryParam("id")) : null;
    }
    function fullProductName(product) {
        return product ? product.name + (product.model ? " " + product.model : "") : SITE.name;
    }
    /* The link handed out: a product page keeps its ?id= part, and every other
     * page uses its plain address so filters and cache-busters are left out. */
    function shareUrl() {
        var product = currentProduct();
        if (product) {
            return siteBase() + "/single.html?id=" + encodeURIComponent(product.id);
        }
        var page = (typeof currentPageName === "function") ? currentPageName() : "";
        if (page === "" || page === "index.html") { return siteBase() + "/"; }
        if (/^[a-z0-9._-]+\.html$/i.test(page)) { return siteBase() + "/" + page; }
        return window.location.href.split("#")[0];
    }
    function shareMessage() {
        var product = currentProduct();
        if (product) {
            return fullProductName(product) + " - " + priceLabel(product.price) + " at " +
                SITE.name + ". Call or WhatsApp " + SITE.whatsapp + ".";
        }
        return SITE.name + " - " + (SITE.tagline || "") + ". Electronics, gadgets and " +
            "accessories. Call or WhatsApp " + SITE.whatsapp + ".";
    }
    function shareHrefs(title, message, url) {
        var u = encodeURIComponent(url);
        var t = encodeURIComponent(title);
        var both = encodeURIComponent(message + "\n" + url);
        return {
            facebook: "https://www.facebook.com/sharer/sharer.php?u=" + u,
            whatsapp: "https://wa.me/?text=" + both,
            twitter: "https://twitter.com/intent/tweet?url=" + u + "&text=" + t,
            telegram: "https://t.me/share/url?url=" + u + "&text=" + t,
            linkedin: "https://www.linkedin.com/sharing/share-offsite/?url=" + u,
            email: "mailto:?subject=" + t + "&body=" + both
        };
    }
    /* Copy text to the clipboard, with a fallback for older browsers. */
    function copyToClipboard(text) {
        if (window.navigator.clipboard && window.navigator.clipboard.writeText) {
            try { return window.navigator.clipboard.writeText(text); } catch (e) { /* try the fallback below */ }
        }
        return new Promise(function (resolve, reject) {
            try {
                var box = document.createElement("textarea");
                box.value = text;
                box.setAttribute("readonly", "");
                box.style.position = "fixed";
                box.style.top = "-1000px";
                document.body.appendChild(box);
                box.select();
                var ok = document.execCommand("copy");
                document.body.removeChild(box);
                if (ok) { resolve(); } else { reject(new Error("copy failed")); }
            } catch (e) { reject(e); }
        });
    }
    function initShare() {
        var buttons = qsa("[data-share]");
        if (!buttons.length) { return; }
        var product = currentProduct();
        var title = fullProductName(product) +
            (product ? " | " + SITE.name : " | " + (SITE.tagline || ""));
        var message = shareMessage();
        var links = shareHrefs(title, shareMessage(), shareUrl());

        buttons.forEach(function (button) {
            var kind = String(button.getAttribute("data-share") || "").toLowerCase();

            if (kind === "copy") {
                button.addEventListener("click", function (event) {
                    event.preventDefault();
                    copyToClipboard(shareUrl()).then(function () {
                        toast("Link copied. Paste it into any chat or post to share.", "success");
                    }, function () {
                        toast("Your browser would not let the page copy the link. " +
                            "You can still copy it from the address bar.", "warning");
                    });
                });
                return;
            }
            if (kind === "native") {
                if (!window.navigator.share) {
                    button.hidden = true;
                    return;
                }
                button.hidden = false;
                button.addEventListener("click", function (event) {
                    event.preventDefault();
                    window.navigator.share({ title: title, text: shareMessage(), url: shareUrl() })
                        .catch(function () { /* the shopper closed the share sheet */ });
                });
                return;
            }
            var href = shareHrefs(title, shareMessage(), shareUrl())[kind];
            if (!href) { return; }
            if (button.tagName === "A") {
                button.setAttribute("href", href);
                button.setAttribute("target", "_blank");
                button.setAttribute("rel", "noopener noreferrer");
                return;
            }
            button.addEventListener("click", function (event) {
                event.preventDefault();
                window.open(href, "_blank", "noopener");
            });
        });
    }
    /* ---------------------------------------------------------------------
     * Search engines - canonical link, link previews (Open Graph / Twitter)
     * and structured data
     * ---------------------------------------------------------------------
     * The <head> of every page already carries the shop's own tags. This adds
     * the product's own title, description, picture and structured data when a
     * product page is open, so Google and the share buttons see the right
     * product. Nothing is ever invented: a product with no confirmed price
     * simply has no price in its structured data.
     * ------------------------------------------------------------------- */
    function upsertMeta(attribute, key, content) {
        if (!content) { return; }
        var el = qs("meta[" + attribute + '="' + key + '"]');
        if (!el) {
            el = document.createElement("meta");
            el.setAttribute(attribute, key);
            document.head.appendChild(el);
        }
        el.setAttribute("content", content);
    }
    function upsertLink(rel, href) {
        if (!href) { return; }
        var el = qs('link[rel="' + rel + '"]');
        if (!el) {
            el = document.createElement("link");
            el.setAttribute("rel", rel);
            document.head.appendChild(el);
        }
        el.setAttribute("href", href);
    }
    function jsonLdScript(id, data) {
        var el = document.getElementById(id);
        if (!el) {
            el = document.createElement("script");
            el.type = "application/ld+json";
            el.id = id;
            document.head.appendChild(el);
        }
        el.textContent = JSON.stringify(data);
    }
    function shorten(text, limit) {
        var clean = String(text || "").replace(/\s+/g, " ").trim();
        if (clean.length <= limit) { return clean; }
        return clean.slice(0, limit - 1).replace(/[\s,;.]+[^\s]*$/, "") + "\u2026";
    }
    /* Use the product's own photo in link previews only when the file is
     * really there - otherwise the shop's share picture, so a preview never
     * shows a broken image. The check reads the picture from wherever the shop
     * is being served, and the address written into the tags is the published
     * one. */
    function shareImageFor(product, callback) {
        var fallback = absoluteUrl(SITE.shareImage || "img/dynamflow-logo.png");
        if (!product || !product.img) { callback(fallback); return; }
        var published = absoluteUrl(product.img);
        var probe = new window.Image();
        probe.onload = function () { callback(published); };
        probe.onerror = function () { callback(fallback); };
        probe.src = product.img;
    }
    function initSeo() {
        var product = currentProduct();
        var url = shareUrl();
        var shopName = SITE.name;
        var logo = absoluteUrl(SITE.shareImage || "img/dynamflow-logo.png");
        var author = SITE.author || {};

        upsertLink("canonical", url);
        upsertMeta("property", "og:url", url);
        upsertMeta("property", "og:site_name", shopName);
        upsertMeta("property", "og:image", logo);
        upsertMeta("name", "author", author.name || "");
        upsertMeta("property", "article:author", author.name || "");

        if (!product) {
            var shopText = shorten(SITE.description, 155);
            upsertMeta("name", "description", shopText);
            upsertMeta("property", "og:description", shopText);
            upsertMeta("name", "twitter:description", shopText);
            return;
        }
        var name = fullProductName(product);
        var description = shorten(product.description + " " + priceLabel(product.price) +
            " at " + shopName + ". Order on WhatsApp " + SITE.whatsapp + ".", 155);
        var fullTitle = name + " | " + shopName;
        var inStock = !(product.stock !== null && product.stock !== undefined &&
            product.stock !== "" && Number(product.stock) === 0);

        upsertMeta("name", "description", description);
        upsertMeta("property", "og:type", "product");
        upsertMeta("property", "og:title", fullTitle);
        upsertMeta("property", "og:description", description);
        upsertMeta("property", "og:image:alt", name);
        upsertMeta("name", "twitter:title", fullTitle);
        upsertMeta("name", "twitter:description", description);

        shareImageFor(product, function (image) {
            upsertMeta("property", "og:image", image);
            upsertMeta("name", "twitter:image", image);
            upsertMeta("name", "twitter:image:alt", name);
        });

        var productSchema = {
            "@context": "https://schema.org",
            "@type": "Product",
            name: name,
            description: product.description,
            sku: product.sku,
            category: product.category,
            url: url,
            brand: { "@type": "Brand", name: shopName }
        };
        if (product.img) { productSchema.image = [absoluteUrl(product.img)]; }
        /* A price is only published when the shop really has one. */
        if (D.hasPrice && D.hasPrice(product)) {
            productSchema.offers = {
                "@type": "Offer",
                url: url,
                price: Number(product.price).toFixed(2),
                priceCurrency: SITE.currencyCode || "ZMW",
                availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                seller: { "@type": "Organization", name: shopName, url: siteBase() }
            };
        }
        jsonLdScript("dynamflow-product-schema", productSchema);

        jsonLdScript("dynamflow-breadcrumb-schema", {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: siteBase() + "/index.html" },
                { "@type": "ListItem", position: 2, name: "Shop", item: siteBase() + "/shop.html" },
                { "@type": "ListItem", position: 3, name: name, item: url }
            ]
        });
    }

    /* ---------------------------------------------------------------------
     * Currency (Kwacha / US Dollars)
     * ---------------------------------------------------------------------
     * Prices are typed in once, in Kwacha, in js/dynamflow-data.js. The little
     * currency picker flips every price on the page to US Dollars and back.
     * The dollar figure comes from a live exchange rate, fetched from a free
     * public service and kept in the browser for an hour. If the rate cannot
     * be fetched the picker stays on Kwacha - the shop never invents a number.
     * ------------------------------------------------------------------- */
    var CURRENCY_KEY = "dynamflow_currency";

    function safeStorage() {
        try { return window.localStorage; } catch (e) { return null; }
    }

    /* Put the shopper's currency on every price on the page. */
    function updatePrices() {
        qsa("[data-price-zmw]").forEach(function (el) {
            var raw = el.getAttribute("data-price-zmw");
            if (raw === null || raw === "" || isNaN(Number(raw))) { return; }
            el.textContent = priceLabel(Number(raw));
        });
        qsa("[data-product-price]").forEach(function (big) {
            var bigRaw = big.getAttribute("data-price-zmw");
            if (bigRaw !== null && bigRaw !== "" && !isNaN(Number(bigRaw))) {
                big.textContent = priceLabel(Number(bigRaw));
            }
        });
        qsa("[data-old-price-zmw]").forEach(function (old) {
            var raw = old.getAttribute("data-old-price-zmw");
            if (raw !== null && raw !== "" && !isNaN(Number(raw))) {
                old.textContent = money(Number(raw));
            }
        });
        updateCurrencyLabels();
        /* The header cart total, cart page and checkout all use the same
         * formatter, so redraw them with the new currency. */
        var headerTotal = money(Cart.subtotal());
        qsa("[data-header-cart-total]").forEach(function (el) { el.textContent = headerTotal; });
        if (typeof window.dynamflowRenderCart === "function") { window.dynamflowRenderCart(); }
        if (typeof window.dynamflowRenderCheckout === "function") { window.dynamflowRenderCheckout(); }
        renderOrderHistory();
    }

    /* Show the active currency on every picker in the page. */
    function updateCurrencyLabels() {
        var code = D.getCurrency ? D.getCurrency() : SITE.currencyCode;
        var symbol = D.currencySymbol ? D.currencySymbol() : SITE.currency;
        qsa("[data-currency-current]").forEach(function (el) {
            setText(el, symbol + " " + code);
        });
        qsa("[data-currency-current-short]").forEach(function (el) {
            setText(el, symbol);
        });
        qsa("[data-currency-option]").forEach(function (el) {
            var isActive = String(el.getAttribute("data-currency-option")).toUpperCase() === code;
            el.classList.toggle("active", isActive);
        });
        var usdReady = !!(D.hasExchangeRate && D.hasExchangeRate());
        qsa("[data-currency-option]").forEach(function (el) {
            if (String(el.getAttribute("data-currency-option")).toUpperCase() === SITE.secondaryCurrencyCode) {
                el.classList.toggle("disabled", !usdReady);
                el.setAttribute("aria-disabled", usdReady ? "false" : "true");
            }
        });
    }

    /* Remember and apply the shopper's chosen currency. */
    function chooseCurrency(code, notify) {
        var applied = D.setCurrency ? D.setCurrency(code) : SITE.currencyCode;
        var storage = safeStorage();
        if (storage) {
            try { storage.setItem(CURRENCY_KEY, applied); } catch (e) { /* private browsing */ }
        }
        updatePrices();
        if (notify) {
            if (applied === SITE.secondaryCurrencyCode) {
                toast("Showing prices in US Dollars.", "success");
            } else if (String(code).toUpperCase() === SITE.secondaryCurrencyCode) {
                toast("The exchange rate is not available yet, so prices stay in Kwacha.");
            } else {
                toast("Showing prices in Kwacha.", "success");
            }
        }
        return applied;
    }

    function initCurrencySwitch() {
        var storage = safeStorage();
        var saved = null;
        if (storage) { try { saved = storage.getItem(CURRENCY_KEY); } catch (e) { saved = null; } }
        D.setCurrency(saved || SITE.currencyCode);
        updatePrices();

        qsa("[data-currency-option]").forEach(function (el) {
            el.addEventListener("click", function (event) {
                event.preventDefault();
                chooseCurrency(el.getAttribute("data-currency-option"), true);
            });
        });
        /* The compact two-way toggle in the mobile header. */
        qsa("[data-currency-toggle]").forEach(function (el) {
            el.addEventListener("click", function (event) {
                event.preventDefault();
                var code = (D.getCurrency ? D.getCurrency() : SITE.currencyCode);
                chooseCurrency(code === SITE.secondaryCurrencyCode ? SITE.currencyCode : SITE.secondaryCurrencyCode, true);
            });
        });
    }

    function fetchExchangeRate() {
        var storage = safeStorage();
        var cacheKey = "dynamflow_usd_rate";
        var now = Date.now();
        var maxAge = (Number(SITE.exchangeRateRefreshMinutes) || 60) * 60 * 1000;

        if (storage) {
            try {
                var cached = JSON.parse(storage.getItem(cacheKey) || "null");
                if (cached && Number(cached.rate) > 0) {
                    SITE.exchangeRate = Number(cached.rate);
                    SITE.exchangeRateLastFetched = Number(cached.at) || 0;
                }
            } catch (e) { /* a damaged cache entry is simply ignored */ }
        }
        updatePrices();

        if (SITE.exchangeRate && (now - (SITE.exchangeRateLastFetched || 0) < maxAge)) {
            return;
        }
        var url = SITE.exchangeRateUrl;
        if (!url) { return; }

        fetch(url, { cache: "no-store" })
            .then(function (response) { return response.json(); })
            .then(function (data) {
                var rates = (data && data.rates) || {};
                var rate = Number(rates[SITE.secondaryCurrencyCode] || rates.USD);
                if (!(rate > 0)) { return; }
                SITE.exchangeRate = rate;
                SITE.exchangeRateLastFetched = Date.now();
                if (storage) {
                    try {
                        storage.setItem(cacheKey,
                            JSON.stringify({ rate: rate, at: SITE.exchangeRateLastFetched }));
                    } catch (e) { /* private browsing */ }
                }
                /* If the shopper had already picked US Dollars, apply it now
                 * that a rate exists (at boot the rate may not have been known
                 * yet, so the shop would have stayed on Kwacha). */
                if (storage) {
                    try {
                        if (String(storage.getItem(CURRENCY_KEY) || "").toUpperCase() === SITE.secondaryCurrencyCode) {
                            D.setCurrency(SITE.secondaryCurrencyCode);
                        }
                    } catch (e) { /* ignore */ }
                }
                updatePrices();
            })
            .catch(function () { /* keep the Kwacha prices */ });
    }

    /* ---------------------------------------------------------------------
     * Social media links + live Facebook follower count
     * ---------------------------------------------------------------------
     * The link is always shown. The follower number only appears when a
     * follower endpoint is configured in SITE.social.facebook inside
     * js/dynamflow-data.js (see cloudflare-worker/README.md) - the site never
     * shows an invented figure.
     * ------------------------------------------------------------------- */
    function initSocial() {
        var facebook = (SITE.social || {}).facebook;
        if (!facebook) { return; }

        qsa("[data-social-facebook]").forEach(function (link) {
            if (facebook.url) { link.setAttribute("href", facebook.url); }
            link.setAttribute("target", "_blank");
            link.setAttribute("rel", "noopener");
        });

        var endpoint = String(facebook.followersEndpoint || "").trim();
        var wraps = qsa("[data-social-followers-wrap]");
        var counts = qsa("[data-social-followers]");
        if (!endpoint || !counts.length) { return; }

        function paint(value) {
            var number = Number(value);
            if (!isFinite(number) || number <= 0) { return; }
            var text = number.toLocaleString("en-US");
            counts.forEach(function (el) { setText(el, text); });
            wraps.forEach(function (el) { el.hidden = false; el.removeAttribute("hidden"); });
        }

        function refresh() {
            fetch(endpoint, { cache: "no-store" })
                .then(function (response) { return response.json(); })
                .then(function (data) {
                    if (data && !data.error) { paint(data.followers); }
                })
                .catch(function () { /* the number simply stays hidden */ });
        }

        refresh();
        var seconds = Number(facebook.refreshSeconds);
        if (seconds > 0) { window.setInterval(refresh, seconds * 1000); }
    }

    /* ---------------------------------------------------------------------
     * Cookie / storage consent bar
     * ---------------------------------------------------------------------
     * The site stores the shopper's cart, wishlist, saved details, chosen
     * currency and order history in their own browser. This bar asks them to
     * accept that once; the choice is remembered on their device.
     * ------------------------------------------------------------------- */
    function initCookieConsent() {
        var storage = safeStorage();
        try {
            if (storage && storage.getItem(SITE.cookieKey) === "accepted") { return; }
        } catch (e) { return; }

        var banner = document.createElement("div");
        banner.className = "dynamflow-cookie";
        banner.setAttribute("role", "dialog");
        banner.setAttribute("aria-label", "Cookies and local storage");
        banner.innerHTML =
            '<p class="dynamflow-cookie__text">We use cookies and your browser\u2019s storage so your cart, ' +
            "wishlist, saved details and order history keep working on this device. By tapping Accept you " +
            'agree to this. <a href="info.html#privacy">Learn more</a>.</p>' +
            '<button type="button" class="btn btn-primary rounded-pill px-4 dynamflow-cookie__accept">Accept</button>';
        document.body.appendChild(banner);
        window.setTimeout(function () { banner.classList.add("is-visible"); }, 0);

        qs(".dynamflow-cookie__accept", banner).addEventListener("click", function () {
            try { if (storage) { storage.setItem(SITE.cookieKey, "accepted"); } } catch (e) { /* ignore */ }
            banner.classList.remove("is-visible");
            window.setTimeout(function () {
                if (banner.parentNode) { banner.parentNode.removeChild(banner); }
            }, 300);
        });
    }

    /* ---------------------------------------------------------------------
     * Start everything, once the page is ready
     * ------------------------------------------------------------------- */
    function boot() {
        initPopup();
        initMobileNav();
        initHeaderCategory();
        initSearch();
        initLiveSearch();
        renderCatalogueRows();
        initProductCards();
        initPhotoViewer();
        initProductLayout();
        initProductPage();
        initReviewStars();
        initShopControls();
        initSeo();
        initShare();
        initCartPage();
        initWishlist();
        Cart.sync();
        initCheckoutPage();
        initContactPage();
        initNewsletter();
        initNotifications();
        initNotificationsPage();
        initProfilePage();
        initOrderHistory();
        initSocial();
        initCurrencySwitch();
        initCookieConsent();
        fetchExchangeRate();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", boot);
    } else {
        boot();
    }
})(window, document);
