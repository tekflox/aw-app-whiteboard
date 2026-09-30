function fe(e, t) {
  if (e.match(/^[a-z]+:\/\//i))
    return e;
  if (e.match(/^\/\//))
    return window.location.protocol + e;
  if (e.match(/^[a-z]+:/i))
    return e;
  const n = document.implementation.createHTMLDocument(), r = n.createElement("base"), o = n.createElement("a");
  return n.head.appendChild(r), n.body.appendChild(o), t && (r.href = t), o.href = e, o.href;
}
const de = /* @__PURE__ */ (() => {
  let e = 0;
  const t = () => (
    // eslint-disable-next-line no-bitwise
    `0000${(Math.random() * 36 ** 4 << 0).toString(36)}`.slice(-4)
  );
  return () => (e += 1, `u${t()}${e}`);
})();
function v(e) {
  const t = [];
  for (let n = 0, r = e.length; n < r; n++)
    t.push(e[n]);
  return t;
}
let T = null;
function Y(e = {}) {
  return T || (e.includeStyleProperties ? (T = e.includeStyleProperties, T) : (T = v(window.getComputedStyle(document.documentElement)), T));
}
function L(e, t) {
  const r = (e.ownerDocument.defaultView || window).getComputedStyle(e).getPropertyValue(t);
  return r ? parseFloat(r.replace("px", "")) : 0;
}
function he(e) {
  const t = L(e, "border-left-width"), n = L(e, "border-right-width");
  return e.clientWidth + t + n;
}
function me(e) {
  const t = L(e, "border-top-width"), n = L(e, "border-bottom-width");
  return e.clientHeight + t + n;
}
function Z(e, t = {}) {
  const n = t.width || he(e), r = t.height || me(e);
  return { width: n, height: r };
}
function ge() {
  let e, t;
  try {
    t = process;
  } catch {
  }
  const n = t && t.env ? t.env.devicePixelRatio : null;
  return n && (e = parseInt(n, 10), Number.isNaN(e) && (e = 1)), e || window.devicePixelRatio || 1;
}
const g = 16384;
function pe(e) {
  (e.width > g || e.height > g) && (e.width > g && e.height > g ? e.width > e.height ? (e.height *= g / e.width, e.width = g) : (e.width *= g / e.height, e.height = g) : e.width > g ? (e.height *= g / e.width, e.width = g) : (e.width *= g / e.height, e.height = g));
}
function F(e) {
  return new Promise((t, n) => {
    const r = new Image();
    r.onload = () => {
      r.decode().then(() => {
        requestAnimationFrame(() => t(r));
      });
    }, r.onerror = n, r.crossOrigin = "anonymous", r.decoding = "async", r.src = e;
  });
}
async function we(e) {
  return Promise.resolve().then(() => new XMLSerializer().serializeToString(e)).then(encodeURIComponent).then((t) => `data:image/svg+xml;charset=utf-8,${t}`);
}
async function ye(e, t, n) {
  const r = "http://www.w3.org/2000/svg", o = document.createElementNS(r, "svg"), a = document.createElementNS(r, "foreignObject");
  return o.setAttribute("width", `${t}`), o.setAttribute("height", `${n}`), o.setAttribute("viewBox", `0 0 ${t} ${n}`), a.setAttribute("width", "100%"), a.setAttribute("height", "100%"), a.setAttribute("x", "0"), a.setAttribute("y", "0"), a.setAttribute("externalResourcesRequired", "true"), o.appendChild(a), a.appendChild(e), we(o);
}
const m = (e, t) => {
  if (e instanceof t)
    return !0;
  const n = Object.getPrototypeOf(e);
  return n === null ? !1 : n.constructor.name === t.name || m(n, t);
};
function be(e) {
  const t = e.getPropertyValue("content");
  return `${e.cssText} content: '${t.replace(/'|"/g, "")}';`;
}
function xe(e, t) {
  return Y(t).map((n) => {
    const r = e.getPropertyValue(n), o = e.getPropertyPriority(n);
    return `${n}: ${r}${o ? " !important" : ""};`;
  }).join(" ");
}
function ve(e, t, n, r) {
  const o = `.${e}:${t}`, a = n.cssText ? be(n) : xe(n, r);
  return document.createTextNode(`${o}{${a}}`);
}
function z(e, t, n, r) {
  const o = window.getComputedStyle(e, n), a = o.getPropertyValue("content");
  if (a === "" || a === "none")
    return;
  const i = de();
  try {
    t.className = `${t.className} ${i}`;
  } catch {
    return;
  }
  const c = document.createElement("style");
  c.appendChild(ve(i, n, o, r)), t.appendChild(c);
}
function Se(e, t, n) {
  z(e, t, ":before", n), z(e, t, ":after", n);
}
const q = "application/font-woff", G = "image/jpeg", Ee = {
  woff: q,
  woff2: q,
  ttf: "application/font-truetype",
  eot: "application/vnd.ms-fontobject",
  png: "image/png",
  jpg: G,
  jpeg: G,
  gif: "image/gif",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  webp: "image/webp"
};
function Ce(e) {
  const t = /\.([^./]*?)$/g.exec(e);
  return t ? t[1] : "";
}
function M(e) {
  const t = Ce(e).toLowerCase();
  return Ee[t] || "";
}
function Re(e) {
  return e.split(/,/)[1];
}
function D(e) {
  return e.search(/^(data:)/) !== -1;
}
function ke(e, t) {
  return `data:${t};base64,${e}`;
}
async function N(e, t, n) {
  const r = await fetch(e, t);
  if (r.status === 404)
    throw new Error(`Resource "${r.url}" not found`);
  const o = await r.blob();
  return new Promise((a, i) => {
    const c = new FileReader();
    c.onerror = i, c.onloadend = () => {
      try {
        a(n({ res: r, result: c.result }));
      } catch (s) {
        i(s);
      }
    }, c.readAsDataURL(o);
  });
}
const O = {};
function Te(e, t, n) {
  let r = e.replace(/\?.*/, "");
  return n && (r = e), /ttf|otf|eot|woff2?/i.test(r) && (r = r.replace(/.*\//, "")), t ? `[${t}]${r}` : r;
}
async function H(e, t, n) {
  const r = Te(e, t, n.includeQueryParams);
  if (O[r] != null)
    return O[r];
  n.cacheBust && (e += (/\?/.test(e) ? "&" : "?") + (/* @__PURE__ */ new Date()).getTime());
  let o;
  try {
    const a = await N(e, n.fetchRequestInit, ({ res: i, result: c }) => (t || (t = i.headers.get("Content-Type") || ""), Re(c)));
    o = ke(a, t);
  } catch (a) {
    o = n.imagePlaceholder || "";
    let i = `Failed to fetch resource: ${e}`;
    a && (i = typeof a == "string" ? a : a.message), i && console.warn(i);
  }
  return O[r] = o, o;
}
async function Pe(e) {
  const t = e.toDataURL();
  return t === "data:," ? e.cloneNode(!1) : F(t);
}
async function $e(e, t) {
  if (e.currentSrc) {
    const a = document.createElement("canvas"), i = a.getContext("2d");
    a.width = e.clientWidth, a.height = e.clientHeight, i == null || i.drawImage(e, 0, 0, a.width, a.height);
    const c = a.toDataURL();
    return F(c);
  }
  const n = e.poster, r = M(n), o = await H(n, r, t);
  return F(o);
}
async function Ie(e, t) {
  var n;
  try {
    if (!((n = e == null ? void 0 : e.contentDocument) === null || n === void 0) && n.body)
      return await W(e.contentDocument.body, t, !0);
  } catch {
  }
  return e.cloneNode(!1);
}
async function Le(e, t) {
  return m(e, HTMLCanvasElement) ? Pe(e) : m(e, HTMLVideoElement) ? $e(e, t) : m(e, HTMLIFrameElement) ? Ie(e, t) : e.cloneNode(ee(e));
}
const Fe = (e) => e.tagName != null && e.tagName.toUpperCase() === "SLOT", ee = (e) => e.tagName != null && e.tagName.toUpperCase() === "SVG";
async function We(e, t, n) {
  var r, o;
  if (ee(t))
    return t;
  let a = [];
  return Fe(e) && e.assignedNodes ? a = v(e.assignedNodes()) : m(e, HTMLIFrameElement) && (!((r = e.contentDocument) === null || r === void 0) && r.body) ? a = v(e.contentDocument.body.childNodes) : a = v(((o = e.shadowRoot) !== null && o !== void 0 ? o : e).childNodes), a.length === 0 || m(e, HTMLVideoElement) || await a.reduce((i, c) => i.then(() => W(c, n)).then((s) => {
    s && t.appendChild(s);
  }), Promise.resolve()), t;
}
function Ae(e, t, n) {
  const r = t.style;
  if (!r)
    return;
  const o = window.getComputedStyle(e);
  o.cssText ? (r.cssText = o.cssText, r.transformOrigin = o.transformOrigin) : Y(n).forEach((a) => {
    let i = o.getPropertyValue(a);
    a === "font-size" && i.endsWith("px") && (i = `${Math.floor(parseFloat(i.substring(0, i.length - 2))) - 0.1}px`), m(e, HTMLIFrameElement) && a === "display" && i === "inline" && (i = "block"), a === "d" && t.getAttribute("d") && (i = `path(${t.getAttribute("d")})`), r.setProperty(a, i, o.getPropertyPriority(a));
  });
}
function Ue(e, t) {
  m(e, HTMLTextAreaElement) && (t.innerHTML = e.value), m(e, HTMLInputElement) && t.setAttribute("value", e.value);
}
function Oe(e, t) {
  if (m(e, HTMLSelectElement)) {
    const n = t, r = Array.from(n.children).find((o) => e.value === o.getAttribute("value"));
    r && r.setAttribute("selected", "");
  }
}
function De(e, t, n) {
  return m(t, Element) && (Ae(e, t, n), Se(e, t, n), Ue(e, t), Oe(e, t)), t;
}
async function Me(e, t) {
  const n = e.querySelectorAll ? e.querySelectorAll("use") : [];
  if (n.length === 0)
    return e;
  const r = {};
  for (let a = 0; a < n.length; a++) {
    const c = n[a].getAttribute("xlink:href");
    if (c) {
      const s = e.querySelector(c), y = document.querySelector(c);
      !s && y && !r[c] && (r[c] = await W(y, t, !0));
    }
  }
  const o = Object.values(r);
  if (o.length) {
    const a = "http://www.w3.org/1999/xhtml", i = document.createElementNS(a, "svg");
    i.setAttribute("xmlns", a), i.style.position = "absolute", i.style.width = "0", i.style.height = "0", i.style.overflow = "hidden", i.style.display = "none";
    const c = document.createElementNS(a, "defs");
    i.appendChild(c);
    for (let s = 0; s < o.length; s++)
      c.appendChild(o[s]);
    e.appendChild(i);
  }
  return e;
}
async function W(e, t, n) {
  return !n && t.filter && !t.filter(e) ? null : Promise.resolve(e).then((r) => Le(r, t)).then((r) => We(e, r, t)).then((r) => De(e, r, t)).then((r) => Me(r, t));
}
const te = /url\((['"]?)([^'"]+?)\1\)/g, He = /url\([^)]+\)\s*format\((["']?)([^"']+)\1\)/g, Ve = /src:\s*(?:url\([^)]+\)\s*format\([^)]+\)[,;]\s*)+/g;
function _e(e) {
  const t = e.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1");
  return new RegExp(`(url\\(['"]?)(${t})(['"]?\\))`, "g");
}
function Be(e) {
  const t = [];
  return e.replace(te, (n, r, o) => (t.push(o), n)), t.filter((n) => !D(n));
}
async function je(e, t, n, r, o) {
  try {
    const a = n ? fe(t, n) : t, i = M(t);
    let c;
    return o || (c = await H(a, i, r)), e.replace(_e(t), `$1${c}$3`);
  } catch {
  }
  return e;
}
function ze(e, { preferredFontFormat: t }) {
  return t ? e.replace(Ve, (n) => {
    for (; ; ) {
      const [r, , o] = He.exec(n) || [];
      if (!o)
        return "";
      if (o === t)
        return `src: ${r};`;
    }
  }) : e;
}
function re(e) {
  return e.search(te) !== -1;
}
async function ne(e, t, n) {
  if (!re(e))
    return e;
  const r = ze(e, n);
  return Be(r).reduce((a, i) => a.then((c) => je(c, i, t, n)), Promise.resolve(r));
}
async function P(e, t, n) {
  var r;
  const o = (r = t.style) === null || r === void 0 ? void 0 : r.getPropertyValue(e);
  if (o) {
    const a = await ne(o, null, n);
    return t.style.setProperty(e, a, t.style.getPropertyPriority(e)), !0;
  }
  return !1;
}
async function qe(e, t) {
  await P("background", e, t) || await P("background-image", e, t), await P("mask", e, t) || await P("-webkit-mask", e, t) || await P("mask-image", e, t) || await P("-webkit-mask-image", e, t);
}
async function Ge(e, t) {
  const n = m(e, HTMLImageElement);
  if (!(n && !D(e.src)) && !(m(e, SVGImageElement) && !D(e.href.baseVal)))
    return;
  const r = n ? e.src : e.href.baseVal, o = await H(r, M(r), t);
  await new Promise((a, i) => {
    e.onload = a, e.onerror = t.onImageErrorHandler ? (...s) => {
      try {
        a(t.onImageErrorHandler(...s));
      } catch (y) {
        i(y);
      }
    } : i;
    const c = e;
    c.decode && (c.decode = a), c.loading === "lazy" && (c.loading = "eager"), n ? (e.srcset = "", e.src = o) : e.href.baseVal = o;
  });
}
async function Je(e, t) {
  const r = v(e.childNodes).map((o) => ae(o, t));
  await Promise.all(r).then(() => e);
}
async function ae(e, t) {
  m(e, Element) && (await qe(e, t), await Ge(e, t), await Je(e, t));
}
function Xe(e, t) {
  const { style: n } = e;
  t.backgroundColor && (n.backgroundColor = t.backgroundColor), t.width && (n.width = `${t.width}px`), t.height && (n.height = `${t.height}px`);
  const r = t.style;
  return r != null && Object.keys(r).forEach((o) => {
    n[o] = r[o];
  }), e;
}
const J = {};
async function X(e) {
  let t = J[e];
  if (t != null)
    return t;
  const r = await (await fetch(e)).text();
  return t = { url: e, cssText: r }, J[e] = t, t;
}
async function Q(e, t) {
  let n = e.cssText;
  const r = /url\(["']?([^"')]+)["']?\)/g, a = (n.match(/url\([^)]+\)/g) || []).map(async (i) => {
    let c = i.replace(r, "$1");
    return c.startsWith("https://") || (c = new URL(c, e.url).href), N(c, t.fetchRequestInit, ({ result: s }) => (n = n.replace(i, `url(${s})`), [i, s]));
  });
  return Promise.all(a).then(() => n);
}
function K(e) {
  if (e == null)
    return [];
  const t = [], n = /(\/\*[\s\S]*?\*\/)/gi;
  let r = e.replace(n, "");
  const o = new RegExp("((@.*?keyframes [\\s\\S]*?){([\\s\\S]*?}\\s*?)})", "gi");
  for (; ; ) {
    const s = o.exec(r);
    if (s === null)
      break;
    t.push(s[0]);
  }
  r = r.replace(o, "");
  const a = /@import[\s\S]*?url\([^)]*\)[\s\S]*?;/gi, i = "((\\s*?(?:\\/\\*[\\s\\S]*?\\*\\/)?\\s*?@media[\\s\\S]*?){([\\s\\S]*?)}\\s*?})|(([\\s\\S]*?){([\\s\\S]*?)})", c = new RegExp(i, "gi");
  for (; ; ) {
    let s = a.exec(r);
    if (s === null) {
      if (s = c.exec(r), s === null)
        break;
      a.lastIndex = c.lastIndex;
    } else
      c.lastIndex = a.lastIndex;
    t.push(s[0]);
  }
  return t;
}
async function Qe(e, t) {
  const n = [], r = [];
  return e.forEach((o) => {
    if ("cssRules" in o)
      try {
        v(o.cssRules || []).forEach((a, i) => {
          if (a.type === CSSRule.IMPORT_RULE) {
            let c = i + 1;
            const s = a.href, y = X(s).then((b) => Q(b, t)).then((b) => K(b).forEach((l) => {
              try {
                o.insertRule(l, l.startsWith("@import") ? c += 1 : o.cssRules.length);
              } catch (p) {
                console.error("Error inserting rule from remote css", {
                  rule: l,
                  error: p
                });
              }
            })).catch((b) => {
              console.error("Error loading remote css", b.toString());
            });
            r.push(y);
          }
        });
      } catch (a) {
        const i = e.find((c) => c.href == null) || document.styleSheets[0];
        o.href != null && r.push(X(o.href).then((c) => Q(c, t)).then((c) => K(c).forEach((s) => {
          i.insertRule(s, i.cssRules.length);
        })).catch((c) => {
          console.error("Error loading remote stylesheet", c);
        })), console.error("Error inlining remote css file", a);
      }
  }), Promise.all(r).then(() => (e.forEach((o) => {
    if ("cssRules" in o)
      try {
        v(o.cssRules || []).forEach((a) => {
          n.push(a);
        });
      } catch (a) {
        console.error(`Error while reading CSS rules from ${o.href}`, a);
      }
  }), n));
}
function Ke(e) {
  return e.filter((t) => t.type === CSSRule.FONT_FACE_RULE).filter((t) => re(t.style.getPropertyValue("src")));
}
async function Ye(e, t) {
  if (e.ownerDocument == null)
    throw new Error("Provided element is not within a Document");
  const n = v(e.ownerDocument.styleSheets), r = await Qe(n, t);
  return Ke(r);
}
function oe(e) {
  return e.trim().replace(/["']/g, "");
}
function Ze(e) {
  const t = /* @__PURE__ */ new Set();
  function n(r) {
    (r.style.fontFamily || getComputedStyle(r).fontFamily).split(",").forEach((a) => {
      t.add(oe(a));
    }), Array.from(r.children).forEach((a) => {
      a instanceof HTMLElement && n(a);
    });
  }
  return n(e), t;
}
async function Ne(e, t) {
  const n = await Ye(e, t), r = Ze(e);
  return (await Promise.all(n.filter((a) => r.has(oe(a.style.fontFamily))).map((a) => {
    const i = a.parentStyleSheet ? a.parentStyleSheet.href : null;
    return ne(a.cssText, i, t);
  }))).join(`
`);
}
async function et(e, t) {
  const n = t.fontEmbedCSS != null ? t.fontEmbedCSS : t.skipFonts ? null : await Ne(e, t);
  if (n) {
    const r = document.createElement("style"), o = document.createTextNode(n);
    r.appendChild(o), e.firstChild ? e.insertBefore(r, e.firstChild) : e.appendChild(r);
  }
}
async function tt(e, t = {}) {
  const { width: n, height: r } = Z(e, t), o = await W(e, t, !0);
  return await et(o, t), await ae(o, t), Xe(o, t), await ye(o, n, r);
}
async function rt(e, t = {}) {
  const { width: n, height: r } = Z(e, t), o = await tt(e, t), a = await F(o), i = document.createElement("canvas"), c = i.getContext("2d"), s = t.pixelRatio || ge(), y = t.canvasWidth || n, b = t.canvasHeight || r;
  return i.width = y * s, i.height = b * s, t.skipAutoScale || pe(i), i.style.width = `${y}`, i.style.height = `${b}`, t.backgroundColor && (c.fillStyle = t.backgroundColor, c.fillRect(0, 0, i.width, i.height)), c.drawImage(a, 0, 0, i.width, i.height), i;
}
async function nt(e, t = {}) {
  return (await rt(e, t)).toDataURL();
}
function at(e) {
  var b;
  const { useState: t, useRef: n, useCallback: r, useEffect: o } = e.React;
  function a() {
    return /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ e.h("rect", { x: "3", y: "3", width: "18", height: "14", rx: "2" }), /* @__PURE__ */ e.h("path", { d: "M8 21h8M12 17v4" }));
  }
  function i() {
    return o(() => {
      let l, p, S = !1;
      const E = () => {
        var w;
        return (w = window.__awOpenAppWindow) == null ? void 0 : w.call(window, "whiteboard.main");
      }, R = () => {
        try {
          l = new WebSocket(e.app.wsUrl("/ws")), l.onmessage = (w) => {
            try {
              const C = JSON.parse(w.data);
              C.type === "whiteboard_update" && C.action === "set" && E();
            } catch {
            }
          }, l.onclose = (w) => {
            if (w.code === 4401 || w.code === 4403 || w.code === 4426) {
              try {
                window.dispatchEvent(new Event("aw-auth-failed"));
              } catch {
              }
              return;
            }
            S || (p = setTimeout(R, 5e3));
          }, l.onerror = () => {
            try {
              l.close();
            } catch {
            }
          };
        } catch {
          S || (p = setTimeout(R, 5e3));
        }
      };
      return R(), () => {
        if (S = !0, clearTimeout(p), l) {
          l.onclose = null;
          try {
            l.close();
          } catch {
          }
        }
      };
    }, []), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: () => {
          var l;
          return (l = window.__awOpenAppWindow) == null ? void 0 : l.call(window, "whiteboard.main");
        },
        className: "w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] cursor-pointer text-left"
      },
      /* @__PURE__ */ e.h(a, null),
      /* @__PURE__ */ e.h("span", { className: "text-[13px] text-[var(--color-text-primary)]" }, "Whiteboard")
    );
  }
  const c = /* @__PURE__ */ new Map();
  function s({ windowKey: l }) {
    const p = "main", S = e.app.absoluteApiUrl(`/view/${encodeURIComponent(p)}`), [E, R] = t(!1), [w, C] = t(!1), [$, V] = t(""), [_, f] = t(null), A = n(null), [U, ie] = t(null), ce = r(() => {
      f(null), C((d) => {
        var x;
        if (d) return !1;
        const u = (x = A.current) == null ? void 0 : x.getBoundingClientRect();
        return u && ie({ top: u.bottom + 6, right: window.innerWidth - u.right }), !0;
      });
    }, []);
    o(() => {
      if (!w) return;
      const d = (x) => {
        var h, I, k;
        (h = A.current) != null && h.contains(x.target) || (k = (I = x.target).closest) != null && k.call(I, "[data-wb-save-popover]") || C(!1);
      }, u = (x) => {
        x.key === "Escape" && C(!1);
      };
      return document.addEventListener("mousedown", d), document.addEventListener("keydown", u), () => {
        document.removeEventListener("mousedown", d), document.removeEventListener("keydown", u);
      };
    }, [w]);
    const B = r(async (d) => {
      R(!0), f(null);
      try {
        const u = d && $.trim() ? { presentation_id: $.trim() } : {}, h = await (await e.sdk.api.fetch(
          e.app.apiUrl(`/boards/${encodeURIComponent(p)}/save_presentation`),
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(u) }
        )).json();
        h.success ? (f(`✓ ${h.action} "${h.presentation_id}"`), C(!1), V("")) : f(`⚠ ${h.detail || h.error || "save failed"}`);
      } catch (u) {
        f(`⚠ ${u.message}`);
      } finally {
        R(!1), setTimeout(() => f(null), 4e3);
      }
    }, [$]), [se, j] = t(!1), le = r(async () => {
      if (window.confirm("Clear the whiteboard? This cannot be undone.")) {
        j(!0), f(null);
        try {
          const u = await (await e.sdk.api.fetch(
            e.app.apiUrl(`/boards/${encodeURIComponent(p)}`),
            { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html: "" }) }
          )).json();
          u.success ? f("✓ cleared") : f(`⚠ ${u.detail || u.error || "clear failed"}`);
        } catch (d) {
          f(`⚠ ${d.message}`);
        } finally {
          j(!1), setTimeout(() => f(null), 4e3);
        }
      }
    }, []), ue = r(async () => {
      const d = c.get(l);
      if (!d) {
        f("⚠ nada para exportar"), setTimeout(() => f(null), 3e3);
        return;
      }
      try {
        const u = d.contentDocument, x = u == null ? void 0 : u.getElementById("frame"), h = x && x.contentDocument || u;
        if (!h || !h.body) {
          f("⚠ nada para exportar"), setTimeout(() => f(null), 3e3);
          return;
        }
        const I = await nt(h.documentElement, {
          backgroundColor: "#ffffff",
          pixelRatio: 2,
          width: h.documentElement.scrollWidth,
          height: h.documentElement.scrollHeight
        }), k = document.createElement("a");
        k.download = `whiteboard-${p}.png`, k.href = I, k.click();
      } catch (u) {
        console.error("Whiteboard export failed:", u), f("⚠ export falhou"), setTimeout(() => f(null), 4e3);
      }
    }, [l]);
    return /* @__PURE__ */ e.h(e.React.Fragment, null, _ && /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)] truncate max-w-[160px] mr-1" }, _), /* @__PURE__ */ e.h(
      "button",
      {
        ref: A,
        onClick: ce,
        className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)]",
        title: "Save whiteboard to a presentation"
      },
      /* @__PURE__ */ e.h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" }), /* @__PURE__ */ e.h("polyline", { points: "17 21 17 13 7 13 7 21" }), /* @__PURE__ */ e.h("polyline", { points: "7 3 7 8 15 8" }))
    ), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: ue,
        className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)]",
        title: "Export as PNG"
      },
      /* @__PURE__ */ e.h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" }), /* @__PURE__ */ e.h("polyline", { points: "7 10 12 15 17 10" }), /* @__PURE__ */ e.h("line", { x1: "12", y1: "15", x2: "12", y2: "3" }))
    ), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: () => window.open(S, `whiteboard-${p}`, "popup=1,width=1100,height=760"),
        className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)]",
        title: "Pop out to new window"
      },
      /* @__PURE__ */ e.h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" }), /* @__PURE__ */ e.h("polyline", { points: "15 3 21 3 21 9" }), /* @__PURE__ */ e.h("line", { x1: "10", y1: "14", x2: "21", y2: "3" }))
    ), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: le,
        disabled: se,
        className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)] ml-1 disabled:opacity-50",
        title: "Clear whiteboard"
      },
      /* @__PURE__ */ e.h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("polyline", { points: "3 6 5 6 21 6" }), /* @__PURE__ */ e.h("path", { d: "M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" }), /* @__PURE__ */ e.h("line", { x1: "10", y1: "11", x2: "10", y2: "17" }), /* @__PURE__ */ e.h("line", { x1: "14", y1: "11", x2: "14", y2: "17" }))
    ), w && U && e.ReactDOM.createPortal(
      /* @__PURE__ */ e.h(
        "div",
        {
          "data-wb-save-popover": !0,
          className: "fixed z-[1000] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl p-3",
          style: { top: U.top, right: U.right, minWidth: 240 }
        },
        /* @__PURE__ */ e.h("div", { className: "text-[11px] font-medium text-[var(--color-text-primary)] mb-2" }, "Save to presentation"),
        /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => B(!1),
            disabled: E,
            className: "w-full text-left text-[11px] px-3 py-1.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors mb-2 disabled:opacity-50"
          },
          "Save back to linked presentation"
        ),
        /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mb-1" }, "Or save as a new/other presentation:"),
        /* @__PURE__ */ e.h("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ e.h(
          "input",
          {
            value: $,
            onChange: (d) => V(d.target.value),
            placeholder: "presentation-id",
            className: "flex-1 text-[11px] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
          }
        ), /* @__PURE__ */ e.h(
          "button",
          {
            onClick: () => B(!0),
            disabled: E || !$.trim(),
            className: "shrink-0 text-[11px] px-2 py-1 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30 transition-colors disabled:opacity-40"
          },
          "Save as"
        ))
      ),
      document.body
    ));
  }
  function y({ windowKey: l }) {
    const S = e.app.absoluteApiUrl(`/view/${encodeURIComponent("main")}`), E = n(null);
    return o(() => (c.set(l, E.current), () => c.delete(l)), [l]), /* @__PURE__ */ e.h("div", { className: "flex flex-col bg-[var(--color-bg-secondary)] h-full" }, /* @__PURE__ */ e.h("div", { className: "flex-1 relative bg-[var(--color-bg-primary)]" }, /* @__PURE__ */ e.h("iframe", { ref: E, src: S, className: "absolute inset-0 w-full h-full border-0", title: "Whiteboard" })));
  }
  e.registerSlot("core.nav.workspace", i), e.registerWindow("whiteboard.main", y), (b = e.registerWindowActions) == null || b.call(e, "whiteboard.main", s);
}
export {
  at as default,
  at as register
};
