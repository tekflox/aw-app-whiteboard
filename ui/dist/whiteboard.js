function o(e) {
  function t() {
    return /* @__PURE__ */ e.h(
      "button",
      {
        onClick: () => {
          var r;
          return (r = window.__awOpenWhiteboardPanel) == null ? void 0 : r.call(window);
        },
        className: "w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] cursor-pointer text-left"
      },
      /* @__PURE__ */ e.h("svg", { className: "w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)]", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ e.h("rect", { x: "3", y: "3", width: "18", height: "14", rx: "2" }), /* @__PURE__ */ e.h("path", { d: "M8 21h8M12 17v4" })),
      /* @__PURE__ */ e.h("span", { className: "text-[13px] text-[var(--color-text-primary)]" }, "Whiteboard")
    );
  }
  e.registerSlot("core.nav.workspace", t);
}
export {
  o as default,
  o as register
};
