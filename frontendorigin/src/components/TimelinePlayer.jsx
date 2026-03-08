import React, { useState, useEffect } from 'react';
import { Box, Slider, IconButton, Typography, Paper } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import { useDataContext } from '../contexts/DataContext';

const TimelinePlayer = () => {
    const { solarLongitude, setSolarLongitude } = useDataContext();
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        let interval;
        if (isPlaying) {
            interval = setInterval(() => {
                setSolarLongitude((prev) => {
                    if (prev >= 360) return 0;
                    return prev + 5; // 每次播放跨越5度
                });
            }, 500); // 每0.5s走一帧，让后端有时间处理
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isPlaying, setSolarLongitude]);

    const getSeasonName = (ls) => {
        if (ls >= 0 && ls < 90) return '春季 (Spring)';
        if (ls >= 90 && ls < 180) return '夏季 (Summer)';
        if (ls >= 180 && ls < 270) return '秋季 (Fall)';
        return '冬季 (Winter)';
    };

    return (
        <Box sx={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', width: '70%', zIndex: 20 }}>
            <Paper elevation={8} sx={{
                display: 'flex', alignItems: 'center', p: 1.5, px: 3, gap: 3,
                bgcolor: 'rgba(10, 11, 16, 0.8)', backdropFilter: 'blur(10px)',
                borderTop: '2px solid rgba(0, 240, 255, 0.4)', borderRadius: 4
            }}>
                <IconButton onClick={() => setIsPlaying(!isPlaying)} sx={{ color: 'primary.main', border: '1px solid rgba(0,240,255,0.5)' }}>
                    {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                </IconButton>

                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>0° (春分)</Typography>
                        <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 'bold', textShadow: '0 0 5px rgba(0,240,255,0.5)' }}>
                            Ls: {solarLongitude}° - {getSeasonName(solarLongitude)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>360°</Typography>
                    </Box>
                    <Slider
                        value={solarLongitude}
                        onChange={(e, val) => {
                            setIsPlaying(false); // 手动拖动时停止播放
                            setSolarLongitude(val);
                        }}
                        step={1}
                        min={0}
                        max={360}
                        sx={{
                            color: 'primary.main',
                            padding: '13px 0',
                            '& .MuiSlider-thumb': {
                                width: 20, height: 20,
                                boxShadow: '0 0 10px rgba(0, 240, 255, 0.8)',
                                '&:hover, &.Mui-focusVisible': {
                                    boxShadow: '0 0 15px rgba(0, 240, 255, 1)',
                                }
                            },
                            '& .MuiSlider-rail': { opacity: 0.4, bgcolor: '#555' }
                        }}
                    />
                </Box>
            </Paper>
        </Box>
    );
};

export default TimelinePlayer;
