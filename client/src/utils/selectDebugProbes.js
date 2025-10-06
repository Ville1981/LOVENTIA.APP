// PATH: client/src/utils/selectDebugProbes.js

// --- REPLACE START (generic probes for all <select> fields on Discover) ---
/**
 * Generic debugging probes for native <select> elements.
 * Purpose: Diagnose unexpected auto-close caused by re-render, unmount,
 *          focus loss (global click handlers), or prop flapping (disabled/key).
 *
 * How to use (example):
 *   import { useSelectProbes } from "@/utils/selectDebugProbes";
 *   ...
 *   const genderProbe = useSelectProbes("GenderSelect");
 *   <select name="gender" {...genderProbe}>...</select>
 *
 * What you’ll see in console:
 *   [mount] GenderSelect
 *   [render] GenderSelect #2
 *   [focus] GenderSelect {name: 'gender', ...}
 *   [open? ] GenderSelect (approx via keydown/mousedown)
 *   [blur ] GenderSelect {...}
 *   [unmount] GenderSelect
 *
 * If you observe:
 *   - [unmount] right after [open?] → component is remounting (key/disabled or parent state).
 *   - A burst of [render] while menu is open → options/props identity changes; memoize inputs.
 *   - [blur ] immediately followed by document-level click → outside click handler closes.
 */

import * as React from "react";

function nowTs() {
  if (typeof performance !== "undefined" && performance.now) return performance.now();
  return Date.now();
}

export function useRenderProbe(name) {
  const countRef = React.useRef(0);
  React.useEffect(() => {
    countRef.current += 1;
    console.log(`[render] ${name} #${countRef.current}`);
  });
  React.useEffect(() => {
    console.log(`[mount] ${name}`);
    return () => console.log(`[unmount] ${name}`);
  }, [name]);
}

/**
 * useSelectProbes
 * Returns focus/blur and “open approximation” handlers for a <select>.
 * Spread the returned props into your <select>.
 */
export function useSelectProbes(name) {
  const openRef = React.useRef(false);
  const lastFocusTs = React.useRef(0);
  const lastOpenTs = React.useRef(0);

  const onFocus = React.useCallback((e) => {
    lastFocusTs.current = nowTs();
    console.log(`[focus] ${name}`, {
      name: e?.target?.name,
      value: e?.target?.value,
      active: typeof document !== "undefined" ? document.activeElement?.name : undefined,
    });
  }, [name]);

  const onKeyDown = React.useCallback((e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      openRef.current = true;
      lastOpenTs.current = nowTs();
      console.log(`[open? ] ${name} (keydown)`, { key: e.key });
    }
  }, [name]);

  const onMouseDown = React.useCallback(() => {
    openRef.current = true;
    lastOpenTs.current = nowTs();
    console.log(`[open? ] ${name} (mousedown)`);
  }, [name]);

  const onBlur = React.useCallback((e) => {
    const t = nowTs();
    const dtFromFocus = (t - lastFocusTs.current).toFixed(1);
    const dtFromOpen = (t - lastOpenTs.current).toFixed(1);
    console.log(`[blur ] ${name}`, {
      name: e?.target?.name,
      value: e?.target?.value,
      active: typeof document !== "undefined" ? document.activeElement?.name : undefined,
      msSinceFocus: dtFromFocus,
      msSinceOpenApprox: dtFromOpen,
      openApprox: openRef.current,
    });
    openRef.current = false;
  }, [name]);

  // Detect document-level clicks that might close the select
  React.useEffect(() => {
    let timerId;
    function onDocPointer(e) {
      clearTimeout(timerId);
      timerId = setTimeout(() => {
        const path = e?.composedPath ? e.composedPath() : [];
        const nodeName = path && path[0] && path[0].nodeName;
        console.log(`[doc  ] click after blur? ${name}`, { nodeName });
      }, 0);
    }
    if (typeof document !== "undefined") {
      document.addEventListener("mousedown", onDocPointer, true);
      document.addEventListener("touchstart", onDocPointer, true);
      return () => {
        clearTimeout(timerId);
        document.removeEventListener("mousedown", onDocPointer, true);
        document.removeEventListener("touchstart", onDocPointer, true);
      };
    }
  }, [name]);

  return { onFocus, onBlur, onKeyDown, onMouseDown };
}

/**
 * StickyDisabled
 * Make a boolean “sticky once true”.
 */
export function useStickyTrue(flag) {
  const [sticky, setSticky] = React.useState(!!flag);
  React.useEffect(() => {
    if (flag && !sticky) setSticky(true);
  }, [flag, sticky]);
  return sticky;
}

/**
 * Memo helpers
 */
export function useStableOptions(options) {
  const ref = React.useRef([]);
  const key = JSON.stringify(options ?? []);
  return React.useMemo(() => {
    if (JSON.stringify(ref.current) !== key) {
      ref.current = Array.isArray(options) ? options.slice() : [];
    }
    return ref.current;
  }, [key, options]);
}

export function useStableCallback(fn) {
  const ref = React.useRef(fn);
  React.useEffect(() => { ref.current = fn; }, [fn]);
  return React.useCallback((...args) => ref.current?.(...args), []);
}
// --- REPLACE END ---

