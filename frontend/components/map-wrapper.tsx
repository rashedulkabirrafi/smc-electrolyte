"use client";

import dynamic from "next/dynamic";

// Leaflet requires browser APIs (window/document). Disable SSR to avoid
// "window is not defined" during Next.js server-side rendering.
const BoundaryMap = dynamic(() => import("./boundary-map"), { ssr: false });

export default BoundaryMap;
