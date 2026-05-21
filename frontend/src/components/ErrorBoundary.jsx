import React from 'react';

/**
 * ErrorBoundary - 一个通用的错误拦截组件，用于捕获 React 渲染过程中的崩溃并显示友好 UI。
 * 防止白屏/黑屏问题扩散到整个应用。
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 你也可以将错误日志上报给服务器
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // 你可以自定义降级后的 UI
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d0d1e',
          color: '#fff',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          padding: 20
        }}>
          <div style={{ fontSize: 'calc(64px * var(--font-scale, 1))', marginBottom: 20 }}>🛸</div>
          <h2 style={{ fontSize: 'calc(24px * var(--font-scale, 1))', fontWeight: 700, marginBottom: 10 }}>渲染异常 (Render Error)</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 400, lineHeight: 1.6, marginBottom: 30 }}>
            看起来火星通信出现了一些干扰。组件在渲染时发生了错误，请尝试刷新页面。
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: '#4a9eff',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 'calc(14px * var(--font-scale, 1))',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre style={{
              marginTop: 40,
              padding: 20,
              background: 'rgba(255,0,0,0.1)',
              borderRadius: 8,
              fontSize: 'calc(12px * var(--font-scale, 1))',
              color: '#ff6b6b',
              textAlign: 'left',
              maxWidth: '90vw',
              overflowX: 'auto'
            }}>
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
