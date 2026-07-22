"use client";

import { useEffect } from "react";

/**
 * Liga o movimento no scroll: observa todos os elementos com class="reveal"
 * e adiciona ".in" quando entram na viewport (uma vez). Respeita
 * prefers-reduced-motion via CSS (globals.css). Renderiza nada — é só o
 * observer. Montar uma vez por página (Landing e Planos).
 */
export function ScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return null;
}
