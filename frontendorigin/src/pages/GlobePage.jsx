import React from 'react';
import Mars3DViewer from '../components/Mars3DViewer';

const GlobePage = () => {
    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <Mars3DViewer />
        </div>
    );
};

export default GlobePage;