import C from '../../../constants/colors';

export default function CorrelationMatrix() {
  const variables = ['O₃', 'Temp', 'Press', 'Dust', 'H₂O', 'Wind'];
  const matrixSize = 300;
  const cellSize = matrixSize / variables.length;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: matrixSize, height: matrixSize }}>
        <svg width={matrixSize} height={matrixSize} style={{ overflow: 'visible' }}>
          {variables.map((rowVar, i) =>
            variables.map((colVar, j) => {
              const correlation = i === j ? 1 : (Math.random() * 2 - 1);
              const intensity = Math.abs(correlation);
              const color = correlation > 0 ?
                `rgba(199,91,57,${intensity})` :
                `rgba(74,158,255,${intensity})`;

              return (
                <g key={`${i}-${j}`}>
                  <rect
                    x={j * cellSize}
                    y={i * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill={color}
                    stroke={C.border}
                    strokeWidth="1"
                  />
                  <text
                    x={j * cellSize + cellSize / 2}
                    y={i * cellSize + cellSize / 2 + 4}
                    textAnchor="middle"
                    style={{ fill: '#e8edf3' }}
                    fontSize="11"
                    fontFamily="'Exo 2', sans-serif"
                  >
                    {correlation.toFixed(2)}
                  </text>
                </g>
              );
            })
          )}

          {/* 变量标签 */}
          {variables.map((variable, i) => (
            <g key={`label-${i}`}>
              <text
                x={i * cellSize + cellSize / 2}
                y={matrixSize + 24}
                textAnchor="middle"
                style={{ fill: '#e8edf3' }}
                fontSize="12"
                fontFamily="'Orbitron', sans-serif"
                fontWeight="bold"
              >
                {variable}
              </text>
              <text
                x={-12}
                y={i * cellSize + cellSize / 2 + 4}
                textAnchor="end"
                style={{ fill: '#e8edf3' }}
                fontSize="12"
                fontFamily="'Orbitron', sans-serif"
                fontWeight="bold"
              >
                {variable}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
