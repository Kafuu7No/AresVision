import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

// 引入页面级组件
import Mars3DViewer from './components/Mars3DViewer';
import ControlPanel from './components/ControlPanel';
import SeasonalChart from './components/SeasonalChart';
import SeasonalLineChart from './components/SeasonalLineChart';
import TimelinePlayer from './components/TimelinePlayer';

// 引入全局状态管理
import { DataProvider } from './contexts/DataContext';

function App() {
  return (
    <DataProvider>
      <Box sx={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', bgcolor: 'background.default' }}>

        {/* 底层：3D 地球全屏展示 */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          <Mars3DViewer />
        </Box>

        {/* 顶层 UI：极简科技感标题 */}
        <Box sx={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, pointerEvents: 'none' }}>
          <Typography variant="h4" sx={{
            fontWeight: 800,
            color: 'white',
            textShadow: '0 0 15px rgba(0, 240, 255, 0.9)',
            letterSpacing: 4,
            fontFamily: 'sans-serif'
          }}>
            MARS ORACLE DASHBOARD
          </Typography>
        </Box>

        {/* 左侧控制区 */}
        <Box sx={{ position: 'absolute', top: 100, left: 20, width: 340, zIndex: 10 }}>
          <ControlPanel />
        </Box>

        {/* 右侧分析看板区 */}
        <Box sx={{
          position: 'absolute', top: 100, right: 20, width: 480, bottom: 80, zIndex: 10,
          display: 'flex', flexDirection: 'column', gap: 3,
          overflowY: 'auto', '&::-webkit-scrollbar': { width: 0 }
        }}>
          {/* 这里我们暂时使用 CSS scale 来处理老图表的尺寸，下个任务我们去重构图表组件本身 */}
          <Paper elevation={8} sx={{ p: 2, backdropFilter: 'blur(12px)', bgcolor: 'background.paper', borderRadius: 3, border: '1px solid rgba(0,240,255,0.2)' }}>
            <Typography variant="h6" sx={{ color: 'primary.main', mb: 1, fontWeight: 'bold' }}>☄️ 季节热力分布 (Ls-Lat)</Typography>
            <Box sx={{ transform: 'scale(0.55)', transformOrigin: 'top left', width: '181%', height: 260 }}>
              <SeasonalChart />
            </Box>
          </Paper>

          <Paper elevation={8} sx={{ p: 2, backdropFilter: 'blur(12px)', bgcolor: 'background.paper', borderRadius: 3, border: '1px solid rgba(229,89,52,0.2)' }}>
            <Typography variant="h6" sx={{ color: 'secondary.main', mb: 1, fontWeight: 'bold' }}>📊 纬度带演化趋势</Typography>
            <Box sx={{ transform: 'scale(0.55)', transformOrigin: 'top left', width: '181%', height: 260 }}>
              <SeasonalLineChart />
            </Box>
          </Paper>
        </Box>

        {/* 底部时间轴留位 (TimelinePlayer) */}

      </Box>
    </DataProvider>
  );
}

export default App;
