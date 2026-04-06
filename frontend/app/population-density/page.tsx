import dynamic from "next/dynamic";

const PopulationDensityClient = dynamic(() => import("./PopulationDensityClient"), {
  ssr: false,
  loading: () => <div className="page-shell"><div className="skeleton" style={{ height: "38rem" }} /></div>,
});

export default function PopulationDensityPage() {
  return <PopulationDensityClient />;
}

