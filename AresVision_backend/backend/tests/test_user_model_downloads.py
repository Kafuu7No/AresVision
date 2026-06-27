import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from routers import user_models  # noqa: E402


def test_uploaded_model_download_assets_are_declared_and_exist():
    assets = user_models.get_uploaded_model_download_assets()

    assert set(assets) == {"guide", "template"}
    assert assets["guide"]["download_name"] == "aresvision_uploaded_model_guide.md"
    assert assets["template"]["download_name"] == "aresvision_uploaded_model_template.py"

    for asset in assets.values():
        path = asset["path"]
        assert path.is_file()
        assert path.stat().st_size > 0


def test_uploaded_model_download_asset_rejects_unknown_kind():
    try:
        user_models.get_uploaded_model_download_asset("missing")
    except user_models.HTTPException as exc:
        assert exc.status_code == 404
        assert exc.detail == "Uploaded model download asset not found"
    else:
        raise AssertionError("Expected HTTPException")


if __name__ == "__main__":
    test_uploaded_model_download_assets_are_declared_and_exist()
    test_uploaded_model_download_asset_rejects_unknown_kind()
    print("user model download tests passed")
