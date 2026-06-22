import { useRef, useState } from 'react';
import { FiMonitor, FiFolder, FiX } from 'react-icons/fi';
import FileStoragePickerModal from './FileStoragePickerModal';

export default function FileSourceModal({
  isOpen,
  onClose,
  onFilesSelected,
  multiple = false,
  accept,
}) {
  const fileInputRef = useRef(null);
  const [showPicker, setShowPicker] = useState(false);

  const handleComputerChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesSelected(files);
      onClose();
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStoragePicked = (result) => {
    const files = Array.isArray(result) ? result : [result];
    onFilesSelected(files);
    onClose();
  };

  if (!isOpen) return null;

  if (showPicker) {
    return (
      <FileStoragePickerModal
        isOpen={true}
        onClose={() => { setShowPicker(false); onClose(); }}
        onFilePicked={handleStoragePicked}
        multiple={multiple}
      />
    );
  }

  const cardBase = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '28px 16px',
    border: '2px dashed #dee2e6',
    borderRadius: 8,
    cursor: 'pointer',
    background: 'transparent',
    transition: 'border-color 0.15s, background 0.15s',
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ width: 400, padding: 0, borderRadius: 10, overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #eee' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>파일 선택</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#666', lineHeight: 1 }}>
            <FiX />
          </button>
        </div>

        <div style={{ padding: '24px 20px', display: 'flex', gap: 12 }}>
          {/* 내 컴퓨터 */}
          <label
            style={cardBase}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#1a73e8'; e.currentTarget.style.background = '#f0f4ff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#dee2e6'; e.currentTarget.style.background = 'transparent'; }}
          >
            <FiMonitor size={32} style={{ color: '#1a73e8' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>내 컴퓨터</span>
            <span style={{ fontSize: 12, color: '#888', textAlign: 'center', lineHeight: 1.5 }}>
              컴퓨터에서<br />파일 선택
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple={multiple}
              accept={accept}
              style={{ display: 'none' }}
              onChange={handleComputerChange}
            />
          </label>

          {/* 파일함 */}
          <button
            type="button"
            style={cardBase}
            onClick={() => setShowPicker(true)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#1a73e8'; e.currentTarget.style.background = '#f0f4ff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#dee2e6'; e.currentTarget.style.background = 'transparent'; }}
          >
            <FiFolder size={32} style={{ color: '#1a73e8' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>파일함</span>
            <span style={{ fontSize: 12, color: '#888', textAlign: 'center', lineHeight: 1.5 }}>
              파일함에서<br />파일 선택
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
