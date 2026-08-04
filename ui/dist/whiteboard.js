function ae(e, t) {
  if (e.match(/^[a-z]+:\/\//i))
    return e;
  if (e.match(/^\/\//))
    return window.location.protocol + e;
  if (e.match(/^[a-z]+:/i))
    return e;
  const r = document.implementation.createHTMLDocument(), n = r.createElement("base"), o = r.createElement("a");
  return r.head.appendChild(n), r.body.appendChild(o), t && (n.href = t), o.href = e, o.href;
}
const oe = /* @__PURE__ */ (() => {
  let e = 0;
  const t = () => (
    // eslint-disable-next-line no-bitwise
    `0000${(Math.random() * 36 ** 4 << 0).toString(36)}`.slice(-4)
  );
  return () => (e += 1, `u${t()}${e}`);
})();
function b(e) {
  const t = [];
  for (let r = 0, n = e.length; r < n; r++)
    t.push(e[r]);
  return t;
}
let S = null;
function z(e = {}) {
  return S || (e.includeStyleProperties ? (S = e.includeStyleProperties, S) : (S = b(window.getComputedStyle(document.documentElement)), S));
}
function R(e, t) {
  const n = (e.ownerDocument.defaultView || window).getComputedStyle(e).getPropertyValue(t);
  return n ? parseFloat(n.replace("px", "")) : 0;
}
function ie(e) {
  const t = R(e, "border-left-width"), r = R(e, "border-right-width");
  return e.clientWidth + t + r;
}
function se(e) {
  const t = R(e, "border-top-width"), r = R(e, "border-bottom-width");
  return e.clientHeight + t + r;
}
function N(e, t = {}) {
  const r = t.width || ie(e), n = t.height || se(e);
  return { width: r, height: n };
}
function ce() {
  let e, t;
  try {
    t = process;
  } catch {
  }
  const r = t && t.env ? t.env.devicePixelRatio : null;
  return r && (e = parseInt(r, 10), Number.isNaN(e) && (e = 1)), e || window.devicePixelRatio || 1;
}
const h = 16384;
function le(e) {
  (e.width > h || e.height > h) && (e.width > h && e.height > h ? e.width > e.height ? (e.height *= h / e.width, e.width = h) : (e.width *= h / e.height, e.height = h) : e.width > h ? (e.height *= h / e.width, e.width = h) : (e.width *= h / e.height, e.height = h));
}
function k(e) {
  return new Promise((t, r) => {
    const n = new Image();
    n.onload = () => {
      n.decode().then(() => {
        requestAnimationFrame(() => t(n));
      });
    }, n.onerror = r, n.crossOrigin = "anonymous", n.decoding = "async", n.src = e;
  });
}
async function ue(e) {
  return Promise.resolve().then(() => new XMLSerializer().serializeToString(e)).then(encodeURIComponent).then((t) => `data:image/svg+xml;charset=utf-8,${t}`);
}
async function fe(e, t, r) {
  const n = "http://www.w3.org/2000/svg", o = document.createElementNS(n, "svg"), a = document.createElementNS(n, "foreignObject");
  return o.setAttribute("width", `${t}`), o.setAttribute("height", `${r}`), o.setAttribute("viewBox", `0 0 ${t} ${r}`), a.setAttribute("width", "100%"), a.setAttribute("height", "100%"), a.setAttribute("x", "0"), a.setAttribute("y", "0"), a.setAttribute("externalResourcesRequired", "true"), o.appendChild(a), a.appendChild(e), ue(o);
}
const f = (e, t) => {
  if (e instanceof t)
    return !0;
  const r = Object.getPrototypeOf(e);
  return r === null ? !1 : r.constructor.name === t.name || f(r, t);
};
function he(e) {
  const t = e.getPropertyValue("content");
  return `${e.cssText} content: '${t.replace(/'|"/g, "")}';`;
}
function de(e, t) {
  return z(t).map((r) => {
    const n = e.getPropertyValue(r), o = e.getPropertyPriority(r);
    return `${r}: ${n}${o ? " !important" : ""};`;
  }).join(" ");
}
function me(e, t, r, n) {
  const o = `.${e}:${t}`, a = r.cssText ? he(r) : de(r, n);
  return document.createTextNode(`${o}{${a}}`);
}
function V(e, t, r, n) {
  const o = window.getComputedStyle(e, r), a = o.getPropertyValue("content");
  if (a === "" || a === "none")
    return;
  const i = oe();
  try {
    t.className = `${t.className} ${i}`;
  } catch {
    return;
  }
  const s = document.createElement("style");
  s.appendChild(me(i, r, o, n)), t.appendChild(s);
}
function ge(e, t, r) {
  V(e, t, ":before", r), V(e, t, ":after", r);
}
const _ = "application/font-woff", M = "image/jpeg", pe = {
  woff: _,
  woff2: _,
  ttf: "application/font-truetype",
  eot: "application/vnd.ms-fontobject",
  png: "image/png",
  jpg: M,
  jpeg: M,
  gif: "image/gif",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  webp: "image/webp"
};
function we(e) {
  const t = /\.([^./]*?)$/g.exec(e);
  return t ? t[1] : "";
}
function F(e) {
  const t = we(e).toLowerCase();
  return pe[t] || "";
}
function ye(e) {
  return e.split(/,/)[1];
}
function L(e) {
  return e.search(/^(data:)/) !== -1;
}
function be(e, t) {
  return `data:${t};base64,${e}`;
}
async function X(e, t, r) {
  const n = await fetch(e, t);
  if (n.status === 404)
    throw new Error(`Resource "${n.url}" not found`);
  const o = await n.blob();
  return new Promise((a, i) => {
    const s = new FileReader();
    s.onerror = i, s.onloadend = () => {
      try {
        a(r({ res: n, result: s.result }));
      } catch (c) {
        i(c);
      }
    }, s.readAsDataURL(o);
  });
}
const I = {};
function xe(e, t, r) {
  let n = e.replace(/\?.*/, "");
  return r && (n = e), /ttf|otf|eot|woff2?/i.test(n) && (n = n.replace(/.*\//, "")), t ? `[${t}]${n}` : n;
}
async function W(e, t, r) {
  const n = xe(e, t, r.includeQueryParams);
  if (I[n] != null)
    return I[n];
  r.cacheBust && (e += (/\?/.test(e) ? "&" : "?") + (/* @__PURE__ */ new Date()).getTime());
  let o;
  try {
    const a = await X(e, r.fetchRequestInit, ({ res: i, result: s }) => (t || (t = i.headers.get("Content-Type") || ""), ye(s)));
    o = be(a, t);
  } catch (a) {
    o = r.imagePlaceholder || "";
    let i = `Failed to fetch resource: ${e}`;
    a && (i = typeof a == "string" ? a : a.message), i && console.warn(i);
  }
  return I[n] = o, o;
}
async function Se(e) {
  const t = e.toDataURL();
  return t === "data:," ? e.cloneNode(!1) : k(t);
}
async function ve(e, t) {
  if (e.currentSrc) {
    const a = document.createElement("canvas"), i = a.getContext("2d");
    a.width = e.clientWidth, a.height = e.clientHeight, i == null || i.drawImage(e, 0, 0, a.width, a.height);
    const s = a.toDataURL();
    return k(s);
  }
  const r = e.poster, n = F(r), o = await W(r, n, t);
  return k(o);
}
async function Ee(e, t) {
  var r;
  try {
    if (!((r = e == null ? void 0 : e.contentDocument) === null || r === void 0) && r.body)
      return await P(e.contentDocument.body, t, !0);
  } catch {
  }
  return e.cloneNode(!1);
}
async function Ce(e, t) {
  return f(e, HTMLCanvasElement) ? Se(e) : f(e, HTMLVideoElement) ? ve(e, t) : f(e, HTMLIFrameElement) ? Ee(e, t) : e.cloneNode(J(e));
}
const Re = (e) => e.tagName != null && e.tagName.toUpperCase() === "SLOT", J = (e) => e.tagName != null && e.tagName.toUpperCase() === "SVG";
async function ke(e, t, r) {
  var n, o;
  if (J(t))
    return t;
  let a = [];
  return Re(e) && e.assignedNodes ? a = b(e.assignedNodes()) : f(e, HTMLIFrameElement) && (!((n = e.contentDocument) === null || n === void 0) && n.body) ? a = b(e.contentDocument.body.childNodes) : a = b(((o = e.shadowRoot) !== null && o !== void 0 ? o : e).childNodes), a.length === 0 || f(e, HTMLVideoElement) || await a.reduce((i, s) => i.then(() => P(s, r)).then((c) => {
    c && t.appendChild(c);
  }), Promise.resolve()), t;
}
function Pe(e, t, r) {
  const n = t.style;
  if (!n)
    return;
  const o = window.getComputedStyle(e);
  o.cssText ? (n.cssText = o.cssText, n.transformOrigin = o.transformOrigin) : z(r).forEach((a) => {
    let i = o.getPropertyValue(a);
    a === "font-size" && i.endsWith("px") && (i = `${Math.floor(parseFloat(i.substring(0, i.length - 2))) - 0.1}px`), f(e, HTMLIFrameElement) && a === "display" && i === "inline" && (i = "block"), a === "d" && t.getAttribute("d") && (i = `path(${t.getAttribute("d")})`), n.setProperty(a, i, o.getPropertyPriority(a));
  });
}
function Te(e, t) {
  f(e, HTMLTextAreaElement) && (t.innerHTML = e.value), f(e, HTMLInputElement) && t.setAttribute("value", e.value);
}
function $e(e, t) {
  if (f(e, HTMLSelectElement)) {
    const r = t, n = Array.from(r.children).find((o) => e.value === o.getAttribute("value"));
    n && n.setAttribute("selected", "");
  }
}
function Ie(e, t, r) {
  return f(t, Element) && (Pe(e, t, r), ge(e, t, r), Te(e, t), $e(e, t)), t;
}
async function Le(e, t) {
  const r = e.querySelectorAll ? e.querySelectorAll("use") : [];
  if (r.length === 0)
    return e;
  const n = {};
  for (let a = 0; a < r.length; a++) {
    const s = r[a].getAttribute("xlink:href");
    if (s) {
      const c = e.querySelector(s), l = document.querySelector(s);
      !c && l && !n[s] && (n[s] = await P(l, t, !0));
    }
  }
  const o = Object.values(n);
  if (o.length) {
    const a = "http://www.w3.org/1999/xhtml", i = document.createElementNS(a, "svg");
    i.setAttribute("xmlns", a), i.style.position = "absolute", i.style.width = "0", i.style.height = "0", i.style.overflow = "hidden", i.style.display = "none";
    const s = document.createElementNS(a, "defs");
    i.appendChild(s);
    for (let c = 0; c < o.length; c++)
      s.appendChild(o[c]);
    e.appendChild(i);
  }
  return e;
}
async function P(e, t, r) {
  return !r && t.filter && !t.filter(e) ? null : Promise.resolve(e).then((n) => Ce(n, t)).then((n) => ke(e, n, t)).then((n) => Ie(e, n, t)).then((n) => Le(n, t));
}
const K = /url\((['"]?)([^'"]+?)\1\)/g, Fe = /url\([^)]+\)\s*format\((["']?)([^"']+)\1\)/g, We = /src:\s*(?:url\([^)]+\)\s*format\([^)]+\)[,;]\s*)+/g;
function Ae(e) {
  const t = e.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1");
  return new RegExp(`(url\\(['"]?)(${t})(['"]?\\))`, "g");
}
function Ue(e) {
  const t = [];
  return e.replace(K, (r, n, o) => (t.push(o), r)), t.filter((r) => !L(r));
}
async function Oe(e, t, r, n, o) {
  try {
    const a = r ? ae(t, r) : t, i = F(t);
    let s;
    return o || (s = await W(a, i, n)), e.replace(Ae(t), `$1${s}$3`);
  } catch {
  }
  return e;
}
function De(e, { preferredFontFormat: t }) {
  return t ? e.replace(We, (r) => {
    for (; ; ) {
      const [n, , o] = Fe.exec(r) || [];
      if (!o)
        return "";
      if (o === t)
        return `src: ${n};`;
    }
  }) : e;
}
function Q(e) {
  return e.search(K) !== -1;
}
async function Y(e, t, r) {
  if (!Q(e))
    return e;
  const n = De(e, r);
  return Ue(n).reduce((a, i) => a.then((s) => Oe(s, i, t, r)), Promise.resolve(n));
}
async function v(e, t, r) {
  var n;
  const o = (n = t.style) === null || n === void 0 ? void 0 : n.getPropertyValue(e);
  if (o) {
    const a = await Y(o, null, r);
    return t.style.setProperty(e, a, t.style.getPropertyPriority(e)), !0;
  }
  return !1;
}
async function He(e, t) {
  await v("background", e, t) || await v("background-image", e, t), await v("mask", e, t) || await v("-webkit-mask", e, t) || await v("mask-image", e, t) || await v("-webkit-mask-image", e, t);
}
async function Ve(e, t) {
  const r = f(e, HTMLImageElement);
  if (!(r && !L(e.src)) && !(f(e, SVGImageElement) && !L(e.href.baseVal)))
    return;
  const n = r ? e.src : e.href.baseVal, o = await W(n, F(n), t);
  await new Promise((a, i) => {
    e.onload = a, e.onerror = t.onImageErrorHandler ? (...c) => {
      try {
        a(t.onImageErrorHandler(...c));
      } catch (l) {
        i(l);
      }
    } : i;
    const s = e;
    s.decode && (s.decode = a), s.loading === "lazy" && (s.loading = "eager"), r ? (e.srcset = "", e.src = o) : e.href.baseVal = o;
  });
}
async function _e(e, t) {
  const n = b(e.childNodes).map((o) => Z(o, t));
  await Promise.all(n).then(() => e);
}
async function Z(e, t) {
  f(e, Element) && (await He(e, t), await Ve(e, t), await _e(e, t));
}
function Me(e, t) {
  const { style: r } = e;
  t.backgroundColor && (r.backgroundColor = t.backgroundColor), t.width && (r.width = `${t.width}px`), t.height && (r.height = `${t.height}px`);
  const n = t.style;
  return n != null && Object.keys(n).forEach((o) => {
    r[o] = n[o];
  }), e;
}
const B = {};
async function j(e) {
  let t = B[e];
  if (t != null)
    return t;
  const n = await (await fetch(e)).text();
  return t = { url: e, cssText: n }, B[e] = t, t;
}
async function q(e, t) {
  let r = e.cssText;
  const n = /url\(["']?([^"')]+)["']?\)/g, a = (r.match(/url\([^)]+\)/g) || []).map(async (i) => {
    let s = i.replace(n, "$1");
    return s.startsWith("https://") || (s = new URL(s, e.url).href), X(s, t.fetchRequestInit, ({ result: c }) => (r = r.replace(i, `url(${c})`), [i, c]));
  });
  return Promise.all(a).then(() => r);
}
function G(e) {
  if (e == null)
    return [];
  const t = [], r = /(\/\*[\s\S]*?\*\/)/gi;
  let n = e.replace(r, "");
  const o = new RegExp("((@.*?keyframes [\\s\\S]*?){([\\s\\S]*?}\\s*?)})", "gi");
  for (; ; ) {
    const c = o.exec(n);
    if (c === null)
      break;
    t.push(c[0]);
  }
  n = n.replace(o, "");
  const a = /@import[\s\S]*?url\([^)]*\)[\s\S]*?;/gi, i = "((\\s*?(?:\\/\\*[\\s\\S]*?\\*\\/)?\\s*?@media[\\s\\S]*?){([\\s\\S]*?)}\\s*?})|(([\\s\\S]*?){([\\s\\S]*?)})", s = new RegExp(i, "gi");
  for (; ; ) {
    let c = a.exec(n);
    if (c === null) {
      if (c = s.exec(n), c === null)
        break;
      a.lastIndex = s.lastIndex;
    } else
      s.lastIndex = a.lastIndex;
    t.push(c[0]);
  }
  return t;
}
async function Be(e, t) {
  const r = [], n = [];
  return e.forEach((o) => {
    if ("cssRules" in o)
      try {
        b(o.cssRules || []).forEach((a, i) => {
          if (a.type === CSSRule.IMPORT_RULE) {
            let s = i + 1;
            const c = a.href, l = j(c).then((u) => q(u, t)).then((u) => G(u).forEach((m) => {
              try {
                o.insertRule(m, m.startsWith("@import") ? s += 1 : o.cssRules.length);
              } catch (w) {
                console.error("Error inserting rule from remote css", {
                  rule: m,
                  error: w
                });
              }
            })).catch((u) => {
              console.error("Error loading remote css", u.toString());
            });
            n.push(l);
          }
        });
      } catch (a) {
        const i = e.find((s) => s.href == null) || document.styleSheets[0];
        o.href != null && n.push(j(o.href).then((s) => q(s, t)).then((s) => G(s).forEach((c) => {
          i.insertRule(c, i.cssRules.length);
        })).catch((s) => {
          console.error("Error loading remote stylesheet", s);
        })), console.error("Error inlining remote css file", a);
      }
  }), Promise.all(n).then(() => (e.forEach((o) => {
    if ("cssRules" in o)
      try {
        b(o.cssRules || []).forEach((a) => {
          r.push(a);
        });
      } catch (a) {
        console.error(`Error while reading CSS rules from ${o.href}`, a);
      }
  }), r));
}
function je(e) {
  return e.filter((t) => t.type === CSSRule.FONT_FACE_RULE).filter((t) => Q(t.style.getPropertyValue("src")));
}
async function qe(e, t) {
  if (e.ownerDocument == null)
    throw new Error("Provided element is not within a Document");
  const r = b(e.ownerDocument.styleSheets), n = await Be(r, t);
  return je(n);
}
function ee(e) {
  return e.trim().replace(/["']/g, "");
}
function Ge(e) {
  const t = /* @__PURE__ */ new Set();
  function r(n) {
    (n.style.fontFamily || getComputedStyle(n).fontFamily).split(",").forEach((a) => {
      t.add(ee(a));
    }), Array.from(n.children).forEach((a) => {
      a instanceof HTMLElement && r(a);
    });
  }
  return r(e), t;
}
async function ze(e, t) {
  const r = await qe(e, t), n = Ge(e);
  return (await Promise.all(r.filter((a) => n.has(ee(a.style.fontFamily))).map((a) => {
    const i = a.parentStyleSheet ? a.parentStyleSheet.href : null;
    return Y(a.cssText, i, t);
  }))).join(`
`);
}
async function Ne(e, t) {
  const r = t.fontEmbedCSS != null ? t.fontEmbedCSS : t.skipFonts ? null : await ze(e, t);
  if (r) {
    const n = document.createElement("style"), o = document.createTextNode(r);
    n.appendChild(o), e.firstChild ? e.insertBefore(n, e.firstChild) : e.appendChild(n);
  }
}
async function Xe(e, t = {}) {
  const { width: r, height: n } = N(e, t), o = await P(e, t, !0);
  return await Ne(o, t), await Z(o, t), Me(o, t), await fe(o, r, n);
}
async function Je(e, t = {}) {
  const { width: r, height: n } = N(e, t), o = await Xe(e, t), a = await k(o), i = document.createElement("canvas"), s = i.getContext("2d"), c = t.pixelRatio || ce(), l = t.canvasWidth || r, u = t.canvasHeight || n;
  return i.width = l * c, i.height = u * c, t.skipAutoScale || le(i), i.style.width = `${l}`, i.style.height = `${u}`, t.backgroundColor && (s.fillStyle = t.backgroundColor, s.fillRect(0, 0, i.width, i.height)), s.drawImage(a, 0, 0, i.width, i.height), i;
}
async function Ke(e, t = {}) {
  return (await Je(e, t)).toDataURL();
}
function Qe(e) {
  const { useState: t, useRef: r, useCallback: n, useEffect: o } = e.React;
  function a() {
    return /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ e.h("rect", { x: "3", y: "3", width: "18", height: "14", rx: "2" }), /* @__PURE__ */ e.h("path", { d: "M8 21h8M12 17v4" }));
  }
  function i() {
    return o(() => {
      let c, l, u = !1;
      const m = () => {
        var x;
        return (x = window.__awOpenAppWindow) == null ? void 0 : x.call(window, "whiteboard.main");
      }, w = () => {
        try {
          c = new WebSocket(e.app.wsUrl("/ws")), c.onmessage = (x) => {
            try {
              const E = JSON.parse(x.data);
              E.type === "whiteboard_update" && E.action === "set" && m();
            } catch {
            }
          }, c.onclose = () => {
            u || (l = setTimeout(w, 5e3));
          }, c.onerror = () => {
            try {
              c.close();
            } catch {
            }
          };
        } catch {
          u || (l = setTimeout(w, 5e3));
        }
      };
      return w(), () => {
        if (u = !0, clearTimeout(l), c) {
          c.onclose = null;
          try {
            c.close();
          } catch {
          }
        }
      };
    }, []), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: () => {
          var c;
          return (c = window.__awOpenAppWindow) == null ? void 0 : c.call(window, "whiteboard.main");
        },
        className: "w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] cursor-pointer text-left"
      },
      /* @__PURE__ */ e.h(a, null),
      /* @__PURE__ */ e.h("span", { className: "text-[13px] text-[var(--color-text-primary)]" }, "Whiteboard")
    );
  }
  function s({ windowKey: c, onMaximize: l, isMaximized: u }) {
    const m = "main", w = e.app.apiUrl(`/view/${encodeURIComponent(m)}`), x = r(null), [E, A] = t(!1), [te, U] = t(!1), [C, O] = t(""), [D, g] = t(null), H = n(async (y) => {
      A(!0), g(null);
      try {
        const p = y && C.trim() ? { presentation_id: C.trim() } : {}, d = await (await e.sdk.api.fetch(
          e.app.apiUrl(`/boards/${encodeURIComponent(m)}/save_presentation`),
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }
        )).json();
        d.success ? (g(`✓ ${d.action} "${d.presentation_id}"`), U(!1), O("")) : g(`⚠ ${d.detail || d.error || "save failed"}`);
      } catch (p) {
        g(`⚠ ${p.message}`);
      } finally {
        A(!1), setTimeout(() => g(null), 4e3);
      }
    }, [C]), re = n(async () => {
      const y = x.current;
      if (y)
        try {
          const p = y.contentDocument, T = p == null ? void 0 : p.getElementById("frame"), d = T && T.contentDocument || p;
          if (!d || !d.body) {
            g("⚠ nada para exportar"), setTimeout(() => g(null), 3e3);
            return;
          }
          const ne = await Ke(d.documentElement, {
            backgroundColor: "#ffffff",
            pixelRatio: 2,
            width: d.documentElement.scrollWidth,
            height: d.documentElement.scrollHeight
          }), $ = document.createElement("a");
          $.download = `whiteboard-${m}.png`, $.href = ne, $.click();
        } catch (p) {
          console.error("Whiteboard export failed:", p), g("⚠ export falhou"), setTimeout(() => g(null), 4e3);
        }
    }, []);
    return /* @__PURE__ */ e.h("div", { className: "flex flex-col bg-[var(--color-bg-secondary)] h-full" }, /* @__PURE__ */ e.h("div", { className: "flex items-center justify-end gap-1 px-2 py-1.5 border-b border-[var(--color-border)] shrink-0" }, D && /* @__PURE__ */ e.h("span", { className: "text-[10px] text-[var(--color-text-muted)] truncate mr-auto pl-1" }, D), /* @__PURE__ */ e.h("div", { className: "relative" }, /* @__PURE__ */ e.h(
      "button",
      {
        onClick: () => {
          U((y) => !y), g(null);
        },
        className: "p-1.5 rounded hover:bg-white/10 transition-colors",
        title: "Save whiteboard to a presentation"
      },
      /* @__PURE__ */ e.h("svg", { className: "w-4 h-4 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" }), /* @__PURE__ */ e.h("polyline", { points: "17 21 17 13 7 13 7 21" }), /* @__PURE__ */ e.h("polyline", { points: "7 3 7 8 15 8" }))
    ), te && /* @__PURE__ */ e.h(
      "div",
      {
        className: "absolute right-0 top-full mt-2 z-50 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl p-3",
        style: { minWidth: 240 }
      },
      /* @__PURE__ */ e.h("div", { className: "text-[11px] font-medium text-[var(--color-text-primary)] mb-2" }, "Save to presentation"),
      /* @__PURE__ */ e.h(
        "button",
        {
          onClick: () => H(!1),
          disabled: E,
          className: "w-full text-left text-[11px] px-3 py-1.5 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors mb-2 disabled:opacity-50"
        },
        "Save back to linked presentation"
      ),
      /* @__PURE__ */ e.h("div", { className: "text-[10px] text-[var(--color-text-muted)] mb-1" }, "Or save as a new/other presentation:"),
      /* @__PURE__ */ e.h("div", { className: "flex items-center gap-1.5" }, /* @__PURE__ */ e.h(
        "input",
        {
          value: C,
          onChange: (y) => O(y.target.value),
          placeholder: "presentation-id",
          className: "flex-1 text-[11px] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded px-2 py-1 text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
        }
      ), /* @__PURE__ */ e.h(
        "button",
        {
          onClick: () => H(!0),
          disabled: E || !C.trim(),
          className: "shrink-0 text-[11px] px-2 py-1 rounded bg-[var(--color-accent)]/20 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/30 transition-colors disabled:opacity-40"
        },
        "Save as"
      ))
    )), /* @__PURE__ */ e.h("button", { onClick: re, className: "p-1.5 rounded hover:bg-white/10 transition-colors cursor-pointer", title: "Export as PNG" }, /* @__PURE__ */ e.h("svg", { className: "w-4 h-4 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" }), /* @__PURE__ */ e.h("polyline", { points: "7 10 12 15 17 10" }), /* @__PURE__ */ e.h("line", { x1: "12", y1: "15", x2: "12", y2: "3" }))), /* @__PURE__ */ e.h(
      "button",
      {
        onClick: () => window.open(w, `whiteboard-${m}`, "popup=1,width=1100,height=760"),
        className: "p-1.5 rounded hover:bg-white/10 transition-colors",
        title: "Pop out to new window"
      },
      /* @__PURE__ */ e.h("svg", { className: "w-4 h-4 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("path", { d: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" }), /* @__PURE__ */ e.h("polyline", { points: "15 3 21 3 21 9" }), /* @__PURE__ */ e.h("line", { x1: "10", y1: "14", x2: "21", y2: "3" }))
    ), /* @__PURE__ */ e.h("button", { onClick: () => l == null ? void 0 : l(c), className: "p-1.5 rounded hover:bg-white/10 transition-colors", title: u ? "Restore" : "Maximize" }, /* @__PURE__ */ e.h("svg", { className: "w-4 h-4 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2" }, /* @__PURE__ */ e.h("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" })))), /* @__PURE__ */ e.h("div", { className: "flex-1 relative bg-[var(--color-bg-primary)]" }, /* @__PURE__ */ e.h("iframe", { ref: x, src: w, className: "absolute inset-0 w-full h-full border-0", title: "Whiteboard" })));
  }
  e.registerSlot("core.nav.workspace", i), e.registerWindow("whiteboard.main", s);
}
export {
  Qe as default,
  Qe as register
};
