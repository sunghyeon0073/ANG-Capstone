import React, { useEffect, useRef, useState } from 'react';
import init, { HwpDocument } from '@rhwp/core';
import { FiZoomIn, FiZoomOut, FiMaximize } from 'react-icons/fi';

export default function HwpViewer({ previewUrl, fileData }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pages, setPages] = useState([]);
  const [scale, setScale] = useState(1.0);

  useEffect(() => {
    let isMounted = true;

    const loadAndRender = async () => {
      try {
        setLoading(true);
        setError(null);
        setPages([]);

        // 1. Text measurement polyfill required by rhwp layout engine
        if (!globalThis.measureTextWidth) {
          globalThis.measureTextWidth = (font, text) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.font = font;
              return ctx.measureText(text).width;
            }
            return 0;
          };
        }

        // 2. Init WASM module from public folder
        await init({ module_or_path: '/rhwp_bg.wasm' });

        // 3. Fetch file data if previewUrl is provided
        let arrayBuffer;
        if (fileData) {
            arrayBuffer = fileData;
        } else if (previewUrl) {
            const response = await fetch(previewUrl);
            if (!response.ok) throw new Error('Failed to fetch HWP file.');
            arrayBuffer = await response.arrayBuffer();
        } else {
            throw new Error('No file data provided.');
        }

        // 4. Load Document
        const uint8Array = new Uint8Array(arrayBuffer);
        const doc = new HwpDocument(uint8Array);
        
        // 5. Render Pages
        const renderedPages = [];
        let pageIdx = 0;
        
        while (pageIdx < 100) {
            try {
                const svgString = doc.renderPageSvg(pageIdx);
                if (!svgString) break;
                renderedPages.push(svgString);
                pageIdx++;
            } catch (err) {
                break;
            }
        }
        
        if (isMounted) {
            setPages(renderedPages);
        }

      } catch (err) {
        console.error('HWP Rendering Error:', err);
        if (isMounted) {
            setError('HWP 문서를 렌더링하는데 실패했습니다.');
        }
      } finally {
        if (isMounted) {
            setLoading(false);
        }
      }
    };

    loadAndRender();

    return () => {
      isMounted = false;
    };
  }, [previewUrl, fileData]);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2.0));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setScale(1.0);

  if (loading) {
    return (
      <div className="hwp-viewer-loading" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
        HWP 문서를 불러오는 중입니다...
      </div>
    );
  }

  if (error) {
    return (
      <div className="hwp-viewer-error" style={{ padding: '20px', textAlign: 'center', color: '#ff4d4f' }}>
        {error}
      </div>
    );
  }

  if (pages.length === 0) {
     return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          문서 내용이 비어있거나 렌더링할 수 없습니다.
        </div>
      );
  }

  return (
    <div className="hwp-viewer-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      <div className="hwp-toolbar" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        gap: '10px', 
        padding: '8px', 
        backgroundColor: '#f8f9fa', 
        borderBottom: '1px solid #dee2e6',
        zIndex: 10
      }}>
        <button className="hwp-toolbar-btn" onClick={handleZoomOut} title="축소" style={btnStyle}>
          <FiZoomOut />
        </button>
        <span style={{ fontSize: '12px', minWidth: '40px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
        <button className="hwp-toolbar-btn" onClick={handleZoomIn} title="확대" style={btnStyle}>
          <FiZoomIn />
        </button>
        <button className="hwp-toolbar-btn" onClick={handleResetZoom} title="100%" style={btnStyle}>
          <FiMaximize />
        </button>
      </div>
      <div 
          className="hwp-viewer-container" 
          ref={containerRef}
          style={{
              flex: 1,
              width: '100%',
              overflowY: 'auto',
              backgroundColor: '#e9ecef',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '20px'
          }}
      >
        <div className="hwp-zoom-layer" style={{ 
          transform: `scale(${scale})`, 
          transformOrigin: 'top center',
          transition: 'transform 0.2s ease-out'
        }}>
          {pages.map((svgContent, index) => (
            <div 
                key={index} 
                className="hwp-page-container"
                style={{
                    backgroundColor: 'white',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    width: 'fit-content',
                    marginBottom: '20px'
                }}
                dangerouslySetInnerHTML={{ __html: svgContent }} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  padding: '0',
  border: '1px solid #ced4da',
  borderRadius: '4px',
  backgroundColor: 'white',
  cursor: 'pointer',
  fontSize: '16px',
  color: '#495057',
  transition: 'all 0.2s'
};
