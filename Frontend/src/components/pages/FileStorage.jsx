import React, { useState } from 'react';

export default function FileStorage({ currentSubPage = 'file-home' }) {
  const [files, setFiles] = useState([]);

  const getPageTitle = () => {
    switch (currentSubPage) {
      case 'file-home':
        return '홈';
      case 'file-my':
        return '내 파일';
      case 'file-shared':
        return '공유파일';
      case 'file-template':
        return '빈 양식';
      case 'file-important':
        return '중요 문서함';
      case 'file-trash':
        return '휴지통';
      default:
        return '파일함';
    }
  };

  return (
    <div className="file-page">
      <div className="file-header">
        <h1>{getPageTitle()}</h1>
      </div>

      <div className="file-container">
        {files.length > 0 ? (
          <div className="file-list">
            {files.map(file => (
              <div key={file.id} className="file-item">
                <div className="file-icon">📄</div>
                <div className="file-name">{file.name}</div>
                <div className="file-date">{file.date}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="file-empty">
            파일이 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
