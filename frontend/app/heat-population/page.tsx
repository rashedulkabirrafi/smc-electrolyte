import dynamic from "next/dynamic";

const HeatPopulationClient = dynamic(() => import("./HeatPopulationClient"), {
  ssr: false,
  loading: () => <div className="page-shell"><div className="skeleton" style={{ height: "38rem" }} /></div>,
});

export default function HeatPopulationPage() {
  return <HeatPopulationClient />;
}

