import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000/api';

/**
 * 获取3D地球点云数据
 * @param {number} marsYear - 火星年 (MY)
 * @param {number} solarLongitude - 季节 (Ls: 0-360)
 */
export const fetchMapData = async (marsYear = 27, solarLongitude = 10) => {
    const response = await axios.get(`${API_BASE_URL}/map/demo`, {
        params: { my: marsYear, ls: solarLongitude }
    });
    return response.data;
};

/**
 * 获取季节热力图数据
 * @param {number} marsYear - 火星年 (MY)
 */
export const fetchSeasonalChart = async (marsYear = 27) => {
    const response = await axios.get(`${API_BASE_URL}/chart/seasonal`, {
        params: { my: marsYear }
    });
    return response.data;
};

/**
 * 获取纬度带折线图数据
 * @param {number} marsYear - 火星年 (MY)
 */
export const fetchSeasonalBands = async (marsYear = 27) => {
    const response = await axios.get(`${API_BASE_URL}/chart/seasonal-bands`, {
        params: { my: marsYear }
    });
    return response.data;
};
