import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './index.css'
import App from './App.jsx'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0A0B10', // 深空黑底色
      paper: 'rgba(20, 20, 30, 0.7)', // 毛玻璃背景底色
    },
    primary: {
      main: '#00F0FF', // 全息蓝
    },
    secondary: {
      main: '#E55934', // 火星橙
    }
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
