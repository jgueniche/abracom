"use client";

import { useEffect } from "react";

/**
 * « Imprimer » from the diary opens the homework's page with `?imprimer=1`: the page prints
 * itself once its pages have loaded — a photographed page that has not arrived yet would print as
 * an empty frame — then takes the word out of the address, so that a reload does not print again.
 */
export function AutoPrint() {
  useEffect(() => {
    let cancelled = false;
    const url = new URL(window.location.href);
    url.searchParams.delete("imprimer");
    window.history.replaceState(window.history.state, "", url);

    const images = [...document.querySelectorAll<HTMLImageElement>("main img")];
    const loaded = images.map((image) =>
      image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }),
    );
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 4000));
    void Promise.race([Promise.all(loaded), timeout]).then(() => {
      if (!cancelled) window.setTimeout(() => window.print(), 150);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
