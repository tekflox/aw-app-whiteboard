function se(e, t) {
  if (e.match(/^[a-z]+:\/\//i))
    return e;
  if (e.match(/^\/\//))
    return window.location.protocol + e;
  if (e.match(/^[a-z]+:/i))
    return e;
  const r = document.implementation.createHTMLDocument(), n = r.createElement("base"), a = r.createElement("a");
  return r.head.appendChild(n), r.body.appendChild(a), t && (n.href = t), a.href = e, a.href;
}
const le = /* @__PURE__ */ (() => {
  let e = 0;
  const t = () => (
    // eslint-disable-next-line no-bitwise
    `0000${(Math.random() * 36 ** 4 << 0).toString(36)}`.slice(-4)
  );
  return () => (e += 1, `u${t()}${e}`);
})();
function v(e) {
  const t = [];
  for (let r = 0, n = e.length; r < n; r++)
    t.push(e[r]);
  return t;
}
let P = null;
function K(e = {}) {
  return P || (e.includeStyleProperties ? (P = e.includeStyleProperties, P) : (P = v(window.getComputedStyle(document.documentElement)), P));
}
function I(e, t) {
  const n = (e.ownerDocument.defaultView || window).getComputedStyle(e).getPropertyValue(t);
  return n ? parseFloat(n.replace("px", "")) : 0;
}
function ue(e) {
  const t = I(e, "border-left-width"), r = I(e, "border-right-width");
  return e.clientWidth + t + r;
}
function fe(e) {
  const t = I(e, "border-top-width"), r = I(e, "border-bottom-width");
  return e.clientHeight + t + r;
}
function Y(e, t = {}) {
  const r = t.width || ue(e), n = t.height || fe(e);
  return { width: r, height: n };
}
function de() {
  let e, t;
  try {
    t = process;
  } catch {
  }
  const r = t && t.env ? t.env.devicePixelRatio : null;
  return r && (e = parseInt(r, 10), Number.isNaN(e) && (e = 1)), e || window.devicePixelRatio || 1;
}
const h = 16384;
function he(e) {
  (e.width > h || e.height > h) && (e.width > h && e.height > h ? e.width > e.height ? (e.height *= h / e.width, e.width = h) : (e.width *= h / e.height, e.height = h) : e.width > h ? (e.height *= h / e.width, e.width = h) : (e.width *= h / e.height, e.height = h));
}
function F(e) {
  return new Promise((t, r) => {
    const n = new Image();
    n.onload = () => {
      n.decode().then(() => {
        requestAnimationFrame(() => t(n));
      });
    }, n.onerror = r, n.crossOrigin = "anonymous", n.decoding = "async", n.src = e;
  });
}
async function me(e) {
  return Promise.resolve().then(() => new XMLSerializer().serializeToString(e)).then(encodeURIComponent).then((t) => `data:image/svg+xml;charset=utf-8,${t}`);
}
async function ge(e, t, r) {
  const n = "http://www.w3.org/2000/svg", a = document.createElementNS(n, "svg"), o = document.createElementNS(n, "foreignObject");
  return a.setAttribute("width", `${t}`), a.setAttribute("height", `${r}`), a.setAttribute("viewBox", `0 0 ${t} ${r}`), o.setAttribute("width", "100%"), o.setAttribute("height", "100%"), o.setAttribute("x", "0"), o.setAttribute("y", "0"), o.setAttribute("externalResourcesRequired", "true"), a.appendChild(o), o.appendChild(e), me(a);
}
const d = (e, t) => {
  if (e instanceof t)
    return !0;
  const r = Object.getPrototypeOf(e);
  return r === null ? !1 : r.constructor.name === t.name || d(r, t);
};
function pe(e) {
  const t = e.getPropertyValue("content");
  return `${e.cssText} content: '${t.replace(/'|"/g, "")}';`;
}
function we(e, t) {
  return K(t).map((r) => {
    const n = e.getPropertyValue(r), a = e.getPropertyPriority(r);
    return `${r}: ${n}${a ? " !important" : ""};`;
  }).join(" ");
}
function ye(e, t, r, n) {
  const a = `.${e}:${t}`, o = r.cssText ? pe(r) : we(r, n);
  return document.createTextNode(`${a}{${o}}`);
}
function j(e, t, r, n) {
  const a = window.getComputedStyle(e, r), o = a.getPropertyValue("content");
  if (o === "" || o === "none")
    return;
  const i = le();
  try {
    t.className = `${t.className} ${i}`;
  } catch {
    return;
  }
  const c = document.createElement("style");
  c.appendChild(ye(i, r, a, n)), t.appendChild(c);
}
function be(e, t, r) {
  j(e, t, ":before", r), j(e, t, ":after", r);
}
const z = "application/font-woff", q = "image/jpeg", xe = {
  woff: z,
  woff2: z,
  ttf: "application/font-truetype",
  eot: "application/vnd.ms-fontobject",
  png: "image/png",
  jpg: q,
  jpeg: q,
  gif: "image/gif",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  webp: "image/webp"
};
function ve(e) {
  const t = /\.([^./]*?)$/g.exec(e);
  return t ? t[1] : "";
}
function M(e) {
  const t = ve(e).toLowerCase();
  return xe[t] || "";
}
function Se(e) {
  return e.split(/,/)[1];
}
function O(e) {
  return e.search(/^(data:)/) !== -1;
}
function Ee(e, t) {
  return `data:${t};base64,${e}`;
}
async function Z(e, t, r) {
  const n = await fetch(e, t);
  if (n.status === 404)
    throw new Error(`Resource "${n.url}" not found`);
  const a = await n.blob();
  return new Promise((o, i) => {
    const c = new FileReader();
    c.onerror = i, c.onloadend = () => {
      try {
        o(r({ res: n, result: c.result }));
      } catch (s) {
        i(s);
      }
    }, c.readAsDataURL(a);
  });
}
const D = {};
function Ce(e, t, r) {
  let n = e.replace(/\?.*/, "");
  return r && (n = e), /ttf|otf|eot|woff2?/i.test(n) && (n = n.replace(/.*\//, "")), t ? `[${t}]${n}` : n;
}
async function H(e, t, r) {
  const n = Ce(e, t, r.includeQueryParams);
  if (D[n] != null)
    return D[n];
  r.cacheBust && (e += (/\?/.test(e) ? "&" : "?") + (/* @__PURE__ */ new Date()).getTime());
  let a;
  try {
    const o = await Z(e, r.fetchRequestInit, ({ res: i, result: c }) => (t || (t = i.headers.get("Content-Type") || ""), Se(c)));
    a = Ee(o, t);
  } catch (o) {
    a = r.imagePlaceholder || "";
    let i = `Failed to fetch resource: ${e}`;
    o && (i = typeof o == "string" ? o : o.message), i && console.warn(i);
  }
  return D[n] = a, a;
}
async function Re(e) {
  const t = e.toDataURL();
  return t === "data:," ? e.cloneNode(!1) : F(t);
}
async function ke(e, t) {
  if (e.currentSrc) {
    const o = document.createElement("canvas"), i = o.getContext("2d");
    o.width = e.clientWidth, o.height = e.clientHeight, i == null || i.drawImage(e, 0, 0, o.width, o.height);
    const c = o.toDataURL();
    return F(c);
  }
  const r = e.poster, n = M(r), a = await H(r, n, t);
  return F(a);
}
async function Pe(e, t) {
  var r;
  try {
    if (!((r = e == null ? void 0 : e.contentDocument) === null || r === void 0) && r.body)
      return await W(e.contentDocument.body, t, !0);
  } catch {
  }
  return e.cloneNode(!1);
}
async function Te(e, t) {
  return d(e, HTMLCanvasElement) ? Re(e) : d(e, HTMLVideoElement) ? ke(e, t) : d(e, HTMLIFrameElement) ? Pe(e, t) : e.cloneNode(N(e));
}
const $e = (e) => e.tagName != null && e.tagName.toUpperCase() === "SLOT", N = (e) => e.tagName != null && e.tagName.toUpperCase() === "SVG";
async function Le(e, t, r) {
  var n, a;
  if (N(t))
    return t;
  let o = [];
  return $e(e) && e.assignedNodes ? o = v(e.assignedNodes()) : d(e, HTMLIFrameElement) && (!((n = e.contentDocument) === null || n === void 0) && n.body) ? o = v(e.contentDocument.body.childNodes) : o = v(((a = e.shadowRoot) !== null && a !== void 0 ? a : e).childNodes), o.length === 0 || d(e, HTMLVideoElement) || await o.reduce((i, c) => i.then(() => W(c, r)).then((s) => {
    s && t.appendChild(s);
  }), Promise.resolve()), t;
}
function Ie(e, t, r) {
  const n = t.style;
  if (!n)
    return;
  const a = window.getComputedStyle(e);
  a.cssText ? (n.cssText = a.cssText, n.transformOrigin = a.transformOrigin) : K(r).forEach((o) => {
    let i = a.getPropertyValue(o);
    o === "font-size" && i.endsWith("px") && (i = `${Math.floor(parseFloat(i.substring(0, i.length - 2))) - 0.1}px`), d(e, HTMLIFrameElement) && o === "display" && i === "inline" && (i = "block"), o === "d" && t.getAttribute("d") && (i = `path(${t.getAttribute("d")})`), n.setProperty(o, i, a.getPropertyPriority(o));
  });
}
function Fe(e, t) {
  d(e, HTMLTextAreaElement) && (t.innerHTML = e.value), d(e, HTMLInputElement) && t.setAttribute("value", e.value);
}
function We(e, t) {
  if (d(e, HTMLSelectElement)) {
    const r = t, n = Array.from(r.children).find((a) => e.value === a.getAttribute("value"));
    n && n.setAttribute("selected", "");
  }
}
function Ae(e, t, r) {
  return d(t, Element) && (Ie(e, t, r), be(e, t, r), Fe(e, t), We(e, t)), t;
}
async function Ue(e, t) {
  const r = e.querySelectorAll ? e.querySelectorAll("use") : [];
  if (r.length === 0)
    return e;
  const n = {};
  for (let o = 0; o < r.length; o++) {
    const c = r[o].getAttribute("xlink:href");
    if (c) {
      const s = e.querySelector(c), g = document.querySelector(c);
      !s && g && !n[c] && (n[c] = await W(g, t, !0));
    }
  }
  const a = Object.values(n);
  if (a.length) {
    const o = "http://www.w3.org/1999/xhtml", i = document.createElementNS(o, "svg");
    i.setAttribute("xmlns", o), i.style.position = "absolute", i.style.width = "0", i.style.height = "0", i.style.overflow = "hidden", i.style.display = "none";
    const c = document.createElementNS(o, "defs");
    i.appendChild(c);
    for (let s = 0; s < a.length; s++)
      c.appendChild(a[s]);
    e.appendChild(i);
  }
  return e;
}
async function W(e, t, r) {
  return !r && t.filter && !t.filter(e) ? null : Promise.resolve(e).then((n) => Te(n, t)).then((n) => Le(e, n, t)).then((n) => Ae(e, n, t)).then((n) => Ue(n, t));
}
const ee = /url\((['"]?)([^'"]+?)\1\)/g, De = /url\([^)]+\)\s*format\((["']?)([^"']+)\1\)/g, Oe = /src:\s*(?:url\([^)]+\)\s*format\([^)]+\)[,;]\s*)+/g;
function Me(e) {
  const t = e.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1");
  return new RegExp(`(url\\(['"]?)(${t})(['"]?\\))`, "g");
}
function He(e) {
  const t = [];
  return e.replace(ee, (r, n, a) => (t.push(a), r)), t.filter((r) => !O(r));
}
async function Ve(e, t, r, n, a) {
  try {
    const o = r ? se(t, r) : t, i = M(t);
    let c;
    return a || (c = await H(o, i, n)), e.replace(Me(t), `$1${c}$3`);
  } catch {
  }
  return e;
}
function _e(e, { preferredFontFormat: t }) {
  return t ? e.replace(Oe, (r) => {
    for (; ; ) {
      const [n, , a] = De.exec(r) || [];
      if (!a)
        return "";
      if (a === t)
        return `src: ${n};`;
    }
  }) : e;
}
function te(e) {
  return e.search(ee) !== -1;
}
async function re(e, t, r) {
  if (!te(e))
    return e;
  const n = _e(e, r);
  return He(n).reduce((o, i) => o.then((c) => Ve(c, i, t, r)), Promise.resolve(n));
}
async function T(e, t, r) {
  var n;
  const a = (n = t.style) === null || n === void 0 ? void 0 : n.getPropertyValue(e);
  if (a) {
    const o = await re(a, null, r);
    return t.style.setProperty(e, o, t.style.getPropertyPriority(e)), !0;
  }
  return !1;
}
async function Be(e, t) {
  await T("background", e, t) || await T("background-image", e, t), await T("mask", e, t) || await T("-webkit-mask", e, t) || await T("mask-image", e, t) || await T("-webkit-mask-image", e, t);
}
async function je(e, t) {
  const r = d(e, HTMLImageElement);
  if (!(r && !O(e.src)) && !(d(e, SVGImageElement) && !O(e.href.baseVal)))
    return;
  const n = r ? e.src : e.href.baseVal, a = await H(n, M(n), t);
  await new Promise((o, i) => {
    e.onload = o, e.onerror = t.onImageErrorHandler ? (...s) => {
      try {
        o(t.onImageErrorHandler(...s));
      } catch (g) {
        i(g);
      }
    } : i;
    const c = e;
    c.decode && (c.decode = o), c.loading === "lazy" && (c.loading = "eager"), r ? (e.srcset = "", e.src = a) : e.href.baseVal = a;
  });
}
async function ze(e, t) {
  const n = v(e.childNodes).map((a) => ne(a, t));
  await Promise.all(n).then(() => e);
}
async function ne(e, t) {
  d(e, Element) && (await Be(e, t), await je(e, t), await ze(e, t));
}
function qe(e, t) {
  const { style: r } = e;
  t.backgroundColor && (r.backgroundColor = t.backgroundColor), t.width && (r.width = `${t.width}px`), t.height && (r.height = `${t.height}px`);
  const n = t.style;
  return n != null && Object.keys(n).forEach((a) => {
    r[a] = n[a];
  }), e;
}
const G = {};
async function X(e) {
  let t = G[e];
  if (t != null)
    return t;
  const n = await (await fetch(e)).text();
  return t = { url: e, cssText: n }, G[e] = t, t;
}
async function J(e, t) {
  let r = e.cssText;
  const n = /url\(["']?([^"')]+)["']?\)/g, o = (r.match(/url\([^)]+\)/g) || []).map(async (i) => {
    let c = i.replace(n, "$1");
    return c.startsWith("https://") || (c = new URL(c, e.url).href), Z(c, t.fetchRequestInit, ({ result: s }) => (r = r.replace(i, `url(${s})`), [i, s]));
  });
  return Promise.all(o).then(() => r);
}
function Q(e) {
  if (e == null)
    return [];
  const t = [], r = /(\/\*[\s\S]*?\*\/)/gi;
  let n = e.replace(r, "");
  const a = new RegExp("((@.*?keyframes [\\s\\S]*?){([\\s\\S]*?}\\s*?)})", "gi");
  for (; ; ) {
    const s = a.exec(n);
    if (s === null)
      break;
    t.push(s[0]);
  }
  n = n.replace(a, "");
  const o = /@import[\s\S]*?url\([^)]*\)[\s\S]*?;/gi, i = "((\\s*?(?:\\/\\*[\\s\\S]*?\\*\\/)?\\s*?@media[\\s\\S]*?){([\\s\\S]*?)}\\s*?})|(([\\s\\S]*?){([\\s\\S]*?)})", c = new RegExp(i, "gi");
  for (; ; ) {
    let s = o.exec(n);
    if (s === null) {
      if (s = c.exec(n), s === null)
        break;
      o.lastIndex = c.lastIndex;
    } else
      c.lastIndex = o.lastIndex;
    t.push(s[0]);
  }
  return t;
}
async function Ge(e, t) {
  const r = [], n = [];
  return e.forEach((a) => {
    if ("cssRules" in a)
      try {
        v(a.cssRules || []).forEach((o, i) => {
          if (o.type === CSSRule.IMPORT_RULE) {
            let c = i + 1;
            const s = o.href, g = X(s).then((p) => J(p, t)).then((p) => Q(p).forEach((l) => {
              try {
                a.insertRule(l, l.startsWith("@import") ? c += 1 : a.cssRules.length);
              } catch (w) {
                console.error("Error inserting rule from remote css", {
                  rule: l,
                  error: w
                });
              }
            })).catch((p) => {
              console.error("Error loading remote css", p.toString());
            });
            n.push(g);
          }
        });
      } catch (o) {
        const i = e.find((c) => c.href == null) || document.styleSheets[0];
        a.href != null && n.push(X(a.href).then((c) => J(c, t)).then((c) => Q(c).forEach((s) => {
          i.insertRule(s, i.cssRules.length);
        })).catch((c) => {
          console.error("Error loading remote stylesheet", c);
        })), console.error("Error inlining remote css file", o);
      }
  }), Promise.all(n).then(() => (e.forEach((a) => {
    if ("cssRules" in a)
      try {
        v(a.cssRules || []).forEach((o) => {
          r.push(o);
        });
      } catch (o) {
        console.error(`Error while reading CSS rules from ${a.href}`, o);
      }
  }), r));
}
function Xe(e) {
  return e.filter((t) => t.type === CSSRule.FONT_FACE_RULE).filter((t) => te(t.style.getPropertyValue("src")));
}
async function Je(e, t) {
  if (e.ownerDocument == null)
    throw new Error("Provided element is not within a Document");
  const r = v(e.ownerDocument.styleSheets), n = await Ge(r, t);
  return Xe(n);
}
function oe(e) {
  return e.trim().replace(/["']/g, "");
}
function Qe(e) {
  const t = /* @__PURE__ */ new Set();
  function r(n) {
    (n.style.fontFamily || getComputedStyle(n).fontFamily).split(",").forEach((o) => {
      t.add(oe(o));
    }), Array.from(n.children).forEach((o) => {
      o instanceof HTMLElement && r(o);
    });
  }
  return r(e), t;
}
async function Ke(e, t) {
  const r = await Je(e, t), n = Qe(e);
  return (await Promise.all(r.filter((o) => n.has(oe(o.style.fontFamily))).map((o) => {
    const i = o.parentStyleSheet ? o.parentStyleSheet.href : null;
    return re(o.cssText, i, t);
  }))).join(`
`);
}
async function Ye(e, t) {
  const r = t.fontEmbedCSS != null ? t.fontEmbedCSS : t.skipFonts ? null : await Ke(e, t);
  if (r) {
    const n = document.createElement("style"), a = document.createTextNode(r);
    n.appendChild(a), e.firstChild ? e.insertBefore(n, e.firstChild) : e.appendChild(n);
  }
}
async function Ze(e, t = {}) {
  const { width: r, height: n } = Y(e, t), a = await W(e, t, !0);
  return await Ye(a, t), await ne(a, t), qe(a, t), await ge(a, r, n);
}
async function Ne(e, t = {}) {
  const { width: r, height: n } = Y(e, t), a = await Ze(e, t), o = await F(a), i = document.createElement("canvas"), c = i.getContext("2d"), s = t.pixelRatio || de(), g = t.canvasWidth || r, p = t.canvasHeight || n;
  return i.width = g * s, i.height = p * s, t.skipAutoScale || he(i), i.style.width = `${g}`, i.style.height = `${p}`, t.backgroundColor && (c.fillStyle = t.backgroundColor, c.fillRect(0, 0, i.width, i.height)), c.drawImage(o, 0, 0, i.width, i.height), i;
}
async function et(e, t = {}) {
  return (await Ne(e, t)).toDataURL();
}
function tt(e) {
  var p;
  const { useState: t, useRef: r, useCallback: n, useEffect: a } = e.React;
  function o() {
    return /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ e.h("rect", { x: "3", y: "3", width: "18", height: "14", rx: "2" }), /* @__PURE__ */ e.h("path", { d: "M8 21h8M12 17v4" }));
  }
  function i() {
    return a(() => {
      let l, w, S = !1;
      const E = () => {
        var x;
        return (x = window.__awOpenAppWindow) == null ? void 0 : x.call(window, "whiteboard.main");
      }, R = () => {
        try {
          l = new WebSocket(e.app.wsUrl("/ws")), l.onmessage = (x) => {
            try {
              const C = JSON.parse(x.data);
              C.type === "whiteboard_update" && C.action === "set" && E();
            } catch {
            }
          }, l.onclose = () => {
            S || (w = setTimeout(R, 5e3));
          }, l.onerror = () => {
            try {
              l.close();
            } catch {
            }
          };
        } catch {
          S || (w = setTimeout(R, 5e3));
        }
      };
      return R(), () => {
        if (S = !0, clearTimeout(w), l) {
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
      /* @__PURE__ */ e.h(o, null),
      /* @__PURE__ */ e.h("span", { className: "text-[13px] text-[var(--color-text-primary)]" }, "Whiteboard")
    );
  }
  const c = /* @__PURE__ */ new Map();
  function s({ windowKey: l }) {
    const w = "main", S = e.app.absoluteApiUrl(`/view/${encodeURIComponent(w)}`), [E, R] = t(!1), [x, C] = t(!1), [$, V] = t(""), [_, m] = t(null), A = r(null), [U, ae] = t(null), ie = n(() => {
      m(null), C((y) => {
        var b;
        if (y) return !1;
        const u = (b = A.current) == null ? void 0 : b.getBoundingClientRect();
        return u && ae({ top: u.bottom + 6, right: window.innerWidth - u.right }), !0;
      });
    }, []);
    a(() => {
      if (!x) return;
      const y = (b) => {
        var f, L, k;
        (f = A.current) != null && f.contains(b.target) || (k = (L = b.target).closest) != null && k.call(L, "[data-wb-save-popover]") || C(!1);
      }, u = (b) => {
        b.key === "Escape" && C(!1);
      };
      return document.addEventListener("mousedown", y), document.addEventListener("keydown", u), () => {
        document.removeEventListener("mousedown", y), document.removeEventListener("keydown", u);
      };
    }, [x]);
    const B = n(async (y) => {
      R(!0), m(null);
      try {
        const u = y && $.trim() ? { presentation_id: $.trim() } : {}, f = await (await e.sdk.api.fetch(
          e.app.apiUrl(`/boards/${encodeURIComponent(w)}/save_presentation`),
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(u) }
        )).json();
        f.success ? (m(`✓ ${f.action} "${f.presentation_id}"`), C(!1), V("")) : m(`⚠ ${f.detail || f.error || "save failed"}`);
      } catch (u) {
        m(`⚠ ${u.message}`);
      } finally {
        R(!1), setTimeout(() => m(null), 4e3);
      }
    }, [$]), ce = n(async () => {
      const y = c.get(l);
      if (!y) {
        m("⚠ nada para exportar"), setTimeout(() => m(null), 3e3);
        return;
      }
      try {
        const u = y.contentDocument, b = u == null ? void 0 : u.getElementById("frame"), f = b && b.contentDocument || u;
        if (!f || !f.body) {
          m("⚠ nada para exportar"), setTimeout(() => m(null), 3e3);
          return;
        }
        const L = await et(f.documentElement, {
          backgroundColor: "#ffffff",
          pixelRatio: 2,
          width: f.documentElement.scrollWidth,
          height: f.documentElement.scrollHeight
        }), k = document.createElement("a");
        k.download = `whiteboard-${w}.png`, k.href = L, k.click();
      } catch (u) {
        console.error("Whiteboard export failed:", u), m("⚠ export falhou"), setTimeout(() => m(null), 4e3);
      }
    }, [l]);
    return /* @__PURE__ */ e.h(e.React.Fragment, null, _ && /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)] truncate max-w-[160px] mr-1" }, _), /* @__PURE__ */ e.h(
      "button",
      {
        ref: A,
        onClick: ie,
        className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)]",
        title: "Save whiteboard to a presentation"
      },
      /* @__PURE__ */ e.h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" }), /* @__PURE__ */ e.h("polyline", { points: "17 21 17 13 7 13 7 21" }), /* @__PURE__ */ e.h("polyline", { points: "7 3 7 8 15 8" }))
    ), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: ce,
        className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)]",
        title: "Export as PNG"
      },
      /* @__PURE__ */ e.h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" }), /* @__PURE__ */ e.h("polyline", { points: "7 10 12 15 17 10" }), /* @__PURE__ */ e.h("line", { x1: "12", y1: "15", x2: "12", y2: "3" }))
    ), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: () => window.open(S, `whiteboard-${w}`, "popup=1,width=1100,height=760"),
        className: "p-1 rounded hover:bg-white/10 text-[var(--color-text-muted)]",
        title: "Pop out to new window"
      },
      /* @__PURE__ */ e.h("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" }), /* @__PURE__ */ e.h("polyline", { points: "15 3 21 3 21 9" }), /* @__PURE__ */ e.h("line", { x1: "10", y1: "14", x2: "21", y2: "3" }))
    ), x && U && e.ReactDOM.createPortal(
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
            onChange: (y) => V(y.target.value),
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
  function g({ windowKey: l }) {
    const S = e.app.absoluteApiUrl(`/view/${encodeURIComponent("main")}`), E = r(null);
    return a(() => (c.set(l, E.current), () => c.delete(l)), [l]), /* @__PURE__ */ e.h("div", { className: "flex flex-col bg-[var(--color-bg-secondary)] h-full" }, /* @__PURE__ */ e.h("div", { className: "flex-1 relative bg-[var(--color-bg-primary)]" }, /* @__PURE__ */ e.h("iframe", { ref: E, src: S, className: "absolute inset-0 w-full h-full border-0", title: "Whiteboard" })));
  }
  e.registerSlot("core.nav.workspace", i), e.registerWindow("whiteboard.main", g), (p = e.registerWindowActions) == null || p.call(e, "whiteboard.main", s);
}
export {
  tt as default,
  tt as register
};
