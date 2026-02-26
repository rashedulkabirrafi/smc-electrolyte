from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_incidents_pagination_returns_total_and_page_size() -> None:
    first = client.get("/api/v1/incidents?page=1&page_size=7")
    assert first.status_code == 200
    payload = first.json()
    assert payload["page"] == 1
    assert payload["page_size"] == 7
    assert payload["total"] >= len(payload["items"])
    assert len(payload["items"]) <= 7

    second = client.get("/api/v1/incidents?page=2&page_size=7")
    assert second.status_code == 200
    payload2 = second.json()
    assert payload2["total"] == payload["total"]



def test_incidents_date_filter_works() -> None:
    response = client.get("/api/v1/incidents?start_date=2020-01-01&end_date=2020-12-31&page_size=100")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] > 0

    for item in payload["items"]:
        date_value = item["date_occurred"] or item["date_published"]
        assert date_value is not None
        assert "2020-01-01" <= date_value <= "2020-12-31"



def test_incidents_export_returns_csv_headers() -> None:
    response = client.get("/api/v1/incidents/export?district=Dhaka&type=all")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=\"incidents_export.csv\"" in response.headers.get(
        "content-disposition", ""
    )

    lines = response.text.splitlines()
    assert len(lines) >= 1
    assert (
        lines[0]
        == "id,date_occurred,date_published,district,upazila,deaths,injured,source_name,source_url,headline,lat,lon"
    )
