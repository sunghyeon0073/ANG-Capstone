import React, { useEffect, useRef, useState } from 'react';
import init, { HwpDocument } from '@rhwp/core';

export default function HwpViewer({ previewUrl, fileData }) {
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pages, setPages] = useState([]);

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
        // We don't have a direct pageCount API exposed in the simple example, 
        // but we can try to render until it fails or if the API exposes it.
        // For now, let's try to render the first few pages (up to 100 to avoid infinite loops)
        const renderedPages = [];
        let pageIdx = 0;
        
        while (pageIdx < 100) {
            try {
                const svgString = doc.renderPageSvg(pageIdx);
                if (!svgString) break; // Might return null/undefined if out of bounds
                renderedPages.push(svgString);
                pageIdx++;
            } catch (err) {
                // Out of bounds error typically thrown when page index exceeds available pages
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
    <div 
        className="hwp-viewer-container" 
        ref={containerRef}
        style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            backgroundColor: '#e9ecef',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px'
        }}
    >
      {pages.map((svgContent, index) => (
        <div 
            key={index} 
            className="hwp-page-container"
            style={{
                backgroundColor: 'white',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                width: 'fit-content'
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }} 
        />
      ))}
    </div>
  );
}
