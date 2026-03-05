"""
AresVision 后端配置常量
"""

import os
from pathlib import Path

# ─── 路径 ───
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
OPENMARS_DIR = DATA_DIR / "openmars"
MCD_DIR = DATA_DIR / "mcd"
MODEL_DIR = BASE_DIR / "models" / "predrnnv2"

# ─── 网格 ───
SUPPORTED_MARS_YEARS = [27, 28]
DEFAULT_MARS_YEAR = 27
N_LAT = 36
N_LON = 72

# ─── MCD 变量 ───
MCD_VARIABLES = [
    "U_Wind", "V_Wind", "Pressure",
    "Temperature", "Dust_Optical_Depth", "Solar_Flux_DN",
]

VARIABLE_NAMES_CN = {
    "o3col": "臭氧柱浓度", "U_Wind": "纬向风", "V_Wind": "经向风",
    "Pressure": "气压", "Temperature": "温度",
    "Dust_Optical_Depth": "沙尘光学厚度", "Solar_Flux_DN": "太阳下行辐射通量",
}

# ─── 模型 ───
MODEL_CONFIG = {
    "total_channels": 7,
    "img_height": N_LAT,
    "img_width": N_LON,
    "input_window": 3,
    "pred_horizon": 3,
    "num_hidden": [64, 64, 64, 64],
    "filter_size": 5,
    "stride": 1,
    "patch_size": 1,
    "layer_norm": True,
}

# ─── 缓存 ───
CACHE_MAX_SIZE = 128
CACHE_TTL = 3600

# ─── 降采样 ───
MAX_LS_POINTS = 500  # 热力图/折线图 Ls 维度最大点数

# ─── 纬度带 ───
LATITUDE_BANDS = [
    {"name": "Polar North (60N-90N)", "lat_min": 60, "lat_max": 90},
    {"name": "Mid-Lat North (30N-60N)", "lat_min": 30, "lat_max": 60},
    {"name": "Equatorial (30S-30N)", "lat_min": -30, "lat_max": 30},
    {"name": "Mid-Lat South (30S-60S)", "lat_min": -60, "lat_max": -30},
    {"name": "Polar South (60S-90S)", "lat_min": -90, "lat_max": -60},
]

# ─── API ───
API_PREFIX = "/api"

# ─── AI（Phase 3） ───
AI_API_URL = os.getenv("AI_API_URL", "https://api.openai.com/v1/chat/completions")
AI_MODEL_NAME = os.getenv("AI_MODEL_NAME", "gpt-4o-mini")
AI_API_KEY = os.getenv("AI_API_KEY", "")
