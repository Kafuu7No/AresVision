import React from 'react';
import { Paper, Typography, Box, FormControl, InputLabel, Select, MenuItem, Divider } from '@mui/material';
import { useDataContext } from '../contexts/DataContext';

const ControlPanel = () => {
    const { marsYear, setMarsYear, solarLongitude } = useDataContext();
    const availableYears = [27, 28];

    const getSeasonName = (ls) => {
        if (ls >= 0 && ls < 90) return 'Northern Spring';
        if (ls >= 90 && ls < 180) return 'Northern Summer';
        if (ls >= 180 && ls < 270) return 'Northern Fall';
        return 'Northern Winter';
    };

    return (
        <Paper elevation={8} sx={{
            p: 3,
            backdropFilter: 'blur(12px)',
            bgcolor: 'background.paper',
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.1)'
        }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold', letterSpacing: 1 }}>
                    🚀 核心控制台
                </Typography>
            </Box>

            <Divider sx={{ mb: 3, borderColor: 'rgba(255,255,255,0.1)' }} />

            <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel id="my-select-label" sx={{ color: 'primary.main' }}>火星年 (Martian Year)</InputLabel>
                <Select
                    labelId="my-select-label"
                    value={marsYear}
                    label="火星年 (Martian Year)"
                    onChange={(e) => setMarsYear(Number(e.target.value))}
                    sx={{
                        color: 'white',
                        '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(0, 240, 255, 0.3)' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' }
                    }}
                >
                    {availableYears.map(year => (
                        <MenuItem key={year} value={year}>MY {year}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.3)', borderLeft: '4px solid #E55934' }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>当前气象状态</Typography>
                <Typography variant="body1" sx={{ color: '#E55934', fontWeight: 'bold' }}>
                    Ls = {solarLongitude}°
                </Typography>
                <Typography variant="body2" sx={{ color: 'white', mt: 0.5 }}>
                    {getSeasonName(solarLongitude)}
                </Typography>
            </Box>

            <Box sx={{ mt: 3, p: 2, borderRadius: 2, bgcolor: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.2)' }}>
                <Typography variant="caption" sx={{ color: 'primary.main', display: 'block', mb: 1, fontWeight: 'bold' }}>
                    🤖 Oracle AI 洞察
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                    预测模型已就绪。观测点云数据表明，当前季节极地与中纬度区域臭氧产生明显交换活动...
                </Typography>
            </Box>

        </Paper>
    );
};

export default ControlPanel;
