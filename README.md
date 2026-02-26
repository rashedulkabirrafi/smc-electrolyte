# Bangladesh Heatwave / Heatstroke Monitor

Simple and stable 2-page website built with Next.js 14 (App Router + TypeScript).

## Pages
1. Home (`/`): interactive Bangladesh district map (GADM Level 2)
2. Incidents (`/incidents`): filterable/sortable heatstroke incident table from CSV

## Run
```bash
cd frontend
npm install
bash ../scripts/fetch_gadm_districts.sh
npm run dev
```

## Data Files
- District boundaries: `frontend/public/data/bd_districts.geojson`
- Incidents CSV: `frontend/public/data/heatstroke_incidents.csv`

## Data Sources
- GADM download page: https://gadm.org/download_country.html
- GADM direct file used: https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_BGD_2.json.zip

District boundaries from GADM (Global Administrative Areas). License: free for non-commercial use; for commercial use obtain license from gadm.org.
