(function (global) {
  "use strict";
  const sessions = new Map();
  async function session(base, consent) {
    const permitted = consent.storage === "granted",
      key = "forus-ads-session:" + base;
    if (!permitted) {
      sessions.delete(base + ":permitted");
      try {
        localStorage.removeItem(key);
      } catch {}
    }
    if (permitted)
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        if (saved?.expires > Date.now()) return saved.token;
      } catch {}
    const cacheKey = base + ":" + (permitted ? "permitted" : "page");
    if (sessions.get(cacheKey)?.expires <= Date.now())
      sessions.delete(cacheKey);
    if (!sessions.has(cacheKey)) {
      const entry = { expires: Date.now() + 86400000, promise: null };
      entry.promise = (async () => {
        const r = await fetch(base + "/v1/sessions/anonymous", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consent }),
          credentials: "omit",
          signal: AbortSignal.timeout(1000),
        });
        if (!r.ok) throw Error("Session unavailable");
        const value = await r.json();
        entry.expires = Date.now() + value.expires_in * 1000;
        if (permitted && sessions.get(cacheKey) === entry)
          try {
            localStorage.setItem(
              key,
              JSON.stringify({
                token: value.token,
                expires: entry.expires,
              }),
            );
          } catch {}
        return value.token;
      })().catch((e) => {
        if (sessions.get(cacheKey) === entry) sessions.delete(cacheKey);
        throw e;
      });
      sessions.set(cacheKey, entry);
    }
    return sessions.get(cacheKey).promise;
  }
  function mount(container, options) {
    if (!container || !options?.placementId)
      throw new Error("A container and placement ID are required");
    let destroyed = false,
      loaded = false,
      ratio = 0,
      impression = false,
      viewable = false,
      visibleSince = 0,
      decision = null,
      observer,
      timer,
      expiryTimer;
    const abort = new AbortController(),
      requestId = crypto.randomUUID(),
      base = new URL(options.baseUrl || location.origin).origin;
    const emit = (type, extra = {}) => {
      if (!destroyed) options.onEvent?.({ type, ...extra });
    };
    const hostVisible = () => {
      try { return !options.isVisible || options.isVisible() === true; }
      catch { return false; }
    };
    container.replaceChildren();
    const frame = document.createElement("div");
    frame.style.cssText = "width:100%;position:relative;";
    container.append(frame);
    const message = (text) => {
      if (options.emptyBehavior === "collapse") {
        frame.replaceChildren();
        frame.style.padding = "0";
        return;
      }
      frame.textContent = text;
      frame.style.padding = "25px";
    };
    async function postEvent(type, evidence) {
      const event = {
        event_id: crypto.randomUUID(),
        decision_token: decision.event_token,
        type,
        occurred_at: new Date().toISOString(),
        adapter_version: "web-0.1",
        evidence,
      };
      const payload = JSON.stringify({ events: [event] });
      for (let attempt = 0; attempt < 2 && !destroyed; attempt++) {
        try {
          const r = await fetch(base + decision.event_endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            signal: AbortSignal.any([abort.signal, AbortSignal.timeout(2000)]),
            credentials: "omit",
          });
          if (!r.ok) throw Error("Event rejected");
          const body = await r.json(),
            status = body.results[0].status;
          emit(type, {
            status,
            message:
              status === "accepted"
                ? "Durably accepted for test accounting"
                : status,
          });
          return;
        } catch (e) {
          if (attempt === 1 && !destroyed)
            emit("error", {
              message:
                "Measurement could not be accepted; no success was assumed.",
            });
          else
            await new Promise((r) => setTimeout(r, 150 + Math.random() * 200));
        }
      }
    }
    function measure() {
      if (destroyed || !decision || !loaded) return;
      const foreground = document.visibilityState === "visible" && hostVisible(),
        now = Date.now();
      if (now >= Date.parse(decision.render_before)) {
        destroyVisual();
        return;
      }
      if (!foreground || ratio < 0.5) visibleSince = 0;
      else if (!visibleSince) visibleSince = now;
      if (foreground && ratio > 0 && !impression) {
        impression = true;
        postEvent("impression", {
          loaded: true,
          foreground: true,
          visible_ratio: ratio,
          visible_ms: 0,
        });
      }
      if (visibleSince && now - visibleSince >= 1000 && !viewable) {
        viewable = true;
        postEvent("viewable", {
          loaded: true,
          foreground: true,
          visible_ratio: ratio,
          visible_ms: now - visibleSince,
        });
      }
    }
    function destroyVisual() {
      clearInterval(timer);
      clearTimeout(expiryTimer);
      observer?.disconnect();
      frame.replaceChildren();
      if (!destroyed)
        message("Test advert expired. Publisher content continues.");
    }
    async function load() {
      emit("request", {
        message: "Requesting one contextual display decision.",
      });
      const token = await session(base, options.consent);
      if (destroyed) return;
      const body = JSON.stringify({
        request_id: requestId,
        placement_id: options.placementId,
        format: options.format || "display",
        session_token: token,
        context: options.context,
        consent: options.consent,
      });
      let response;
      for (let attempt = 0; attempt < 2; attempt++) {
        const timeout = new AbortController();
        const t = setTimeout(() => timeout.abort(), 1000);
        const signal = AbortSignal.any([abort.signal, timeout.signal]);
        try {
          response = await fetch(base + "/v1/ad-decisions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal,
            credentials: "omit",
          });
          clearTimeout(t);
          if (response.status >= 500) throw Error("Decision unavailable");
          break;
        } catch (e) {
          clearTimeout(t);
          if (destroyed) return;
          if (attempt === 1) {
            message("No advert available. Publisher content continues.");
            emit("error", {
              message: "Decision timed out or failed. No impression recorded.",
            });
            return;
          }
          await new Promise((r) => setTimeout(r, 100 + Math.random() * 150));
        }
      }
      if (destroyed) return;
      if (response.status === 204) {
        message(
          "No eligible advert. Approve content, grant inventory and activate a campaign.",
        );
        emit("no_fill", {
          message: "The placement has no eligible funded campaign.",
        });
        return;
      }
      if (!response.ok) {
        message("No advert available.");
        emit("error", { message: "Invalid delivery request." });
        return;
      }
      decision = await response.json();
      if (!Number.isFinite(Date.parse(decision.render_before)) || Date.now() >= Date.parse(decision.render_before)) {
        emit("error", { message: "Decision already expired." });
        return;
      }
      if (new URL(decision.media_url, base).origin !== base ||
          new URL(decision.click_url, base).origin !== base ||
          decision.event_endpoint !== "/v1/events") throw Error("Untrusted delivery endpoint");
      emit("decision", {
        decision_id: decision.decision_id,
        message: "Signed decision received; test budget reserved.",
      });
      const disclosure = document.createElement("div");
      disclosure.textContent = decision.disclosure;
      disclosure.style.cssText =
        "font:10px Arial,sans-serif;color:#52695b;padding:5px 0;";
      const link = document.createElement("a");
      link.href = new URL(decision.click_url, base).href;
      link.target = "_blank";
      link.rel = "noopener noreferrer sponsored";
      const img = document.createElement("img");
      img.alt = decision.alt;
      img.style.cssText = "display:block;width:100%;height:auto;";
      img.onload = () => {
        loaded = true;
        emit("rendered", {
          message: "Image loaded. Waiting for foreground visibility.",
        });
        measure();
      };
      img.onerror = () => {
        loaded = false;
        message("Advert image unavailable.");
        emit("error", { message: "Image failed. No impression recorded." });
      };
      link.addEventListener("click", (event) => {
        if (destroyed || !loaded || !hostVisible() || document.visibilityState !== "visible" ||
            ratio <= 0 || Date.now() >= Date.parse(decision.render_before)) {
          event.preventDefault();
          return;
        }
        postEvent("click");
      });
      link.append(img);
      if (decision.format === "native") {
        const title = document.createElement("h3"),
          body = document.createElement("p"),
          cta = document.createElement("span");
        title.textContent = decision.native.headline;
        body.textContent = decision.native.body;
        cta.textContent = decision.native.cta;
        cta.style.cssText =
          "display:inline-block;padding:10px 16px;background:#ef702a;color:#172522;border-radius:8px";
        link.append(title, body, cta);
        link.style.cssText =
          "display:block;text-decoration:none;color:inherit;padding:12px;border:1px solid #dbe2dd;border-radius:12px";
      }
      frame.replaceChildren(disclosure, link);
      observer = new IntersectionObserver(
        (entries) => {
          ratio = entries[0].intersectionRatio;
          measure();
        },
        { threshold: [0, 0.01, 0.5, 1] },
      );
      observer.observe(img);
      document.addEventListener("visibilitychange", measure);
      timer = setInterval(measure, 200);
      expiryTimer = setTimeout(
        destroyVisual,
        Math.max(1, Date.parse(decision.render_before) - Date.now()),
      );
      img.src = new URL(decision.media_url, base).href;
    }
    const lazy = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          lazy.disconnect();
          load().catch(() => {
            message("Advert unavailable.");
            emit("error", { message: "Delivery failed safely." });
          });
        }
      },
      { rootMargin: "200px" },
    );
    lazy.observe(container);
    return {
      updateConsent(consent) {
        this.destroy();
        sessions.delete(base + ":permitted");
        try {
          localStorage.removeItem("forus-ads-session:" + base);
        } catch {}
        return mount(container, { ...options, consent });
      },
      destroy() {
        destroyed = true;
        abort.abort();
        lazy.disconnect();
        destroyVisual();
        document.removeEventListener("visibilitychange", measure);
        container.replaceChildren();
      },
    };
  }
  global.ForusAds = { mount, version: "web-0.1" };
})(window);
