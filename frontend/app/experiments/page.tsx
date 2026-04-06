import Link from "next/link";

import { FlaskIcon } from "../../components/icons";
import { Button } from "../../components/ui/Button";
import { Card, CardBody, CardHeader, CardHeaderMeta, CardTitle, CardCaption } from "../../components/ui/Card";

export default function ExperimentsPage() {
  return (
    <main className="page-shell">
      <div className="page-header">
        <div>
          <div className="page-kicker">Sandbox</div>
          <h1 className="page-title">Experiments</h1>
          <p className="page-subtitle">
            Prototype surfaces for alternate models, uplift simulations, and evaluation reports live here.
          </p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="grid-span-6">
          <Card variant="elevated">
            <CardHeader>
              <CardHeaderMeta>
                <CardTitle>Population Density</CardTitle>
                <CardCaption>Explore the new 3D district spike surface built from Bangladesh 2022 census density.</CardCaption>
              </CardHeaderMeta>
            </CardHeader>
            <CardBody>
              <Link href="/population-density">
                <Button variant="primary" type="button">Open 3D density map</Button>
              </Link>
            </CardBody>
          </Card>
        </div>
        <div className="grid-span-6">
          <Card variant="accent">
            <CardHeader>
              <CardHeaderMeta>
                <CardTitle>Heat × Population</CardTitle>
                <CardCaption>Review where district heat tiers and population density combine into higher demand pressure.</CardCaption>
              </CardHeaderMeta>
            </CardHeader>
            <CardBody>
              <Link href="/heat-population">
                <Button variant="primary" type="button">Open combined overlay</Button>
              </Link>
            </CardBody>
          </Card>
        </div>
        <div className="grid-span-12">
          <Card variant="default">
            <CardHeader>
              <CardHeaderMeta>
                <CardTitle>Sandbox</CardTitle>
                <CardCaption>Prototype surfaces for alternate models, uplift simulations, and evaluation reports live here.</CardCaption>
              </CardHeaderMeta>
            </CardHeader>
            <CardBody>
              <div className="surface-inline">
                <FlaskIcon width={16} height={16} />
                <span>New population and combined heat overlays are now available from this sandbox hub.</span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </main>
  );
}
