import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FiX, FiFolder, FiUsers, FiStar, FiFileText, FiSearch } from 'react-icons/fi';
import { FaFileAlt, FaFilePdf, FaFileWord, FaFileExcel, FaFileImage, FaFileCsv, FaFilePowerpoint } from 'react-icons/fa';
import { getMyFiles, getDepartmentFiles, getFavoriteFiles, downloadFile } from '../../api/fileApi';
import { getApprovalTemplates } from '../../api/approvalApi';
import { formatFileSize } from '../../utils/fileUtils';
import { formatDate } from '../../utils/dateUtils';
import { showAlert } from '../../utils/alertUtils';

const getFileIcon = (title) => {
  const ext = (title || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return <FaFilePdf style={{ color: '#e74c3c' }} />;
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext)) return <FaFileImage style={{ color: '#2ecc71' }} />;
  if (['xlsx', 'xls'].includes(ext)) return <FaFileExcel style={{ color: '#27ae60' }} />;
  if (ext === 'csv') return <FaFileCsv style={{ color: '#27ae60' }} />;
  if (['doc', 'docx'].includes(ext)) return <FaFileWord style={{ color: '#2980b9' }} />;
  if (['ppt', 'pptx'].includes(ext)) return <FaFilePowerpoint style={{ color: '#e67e22' }} />;
  return <FaFileAlt style={{ color: '#95a5a6' }} />;
};

const TABS = [
  { id: 'my',        label: '내 파일',     icon: <FiFolder /> },
  { id: 'shared',    label: '공유 문서함',  icon: <FiUsers /> },
  { id: 'important', label: '중요 문서',    icon: <FiStar /> },
  { id: 'template',  label: '빈 양식',      icon: <FiFileText /> },
];

function PickerContent({ onClose, onFilePicked, multiple }) {
  const [tab, setTab] = useState('my');
  const [downloading, setDownloading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['file-storage-picker', tab],
    queryFn: async () => {
      if (tab === 'my') {
        const res = await getMyFiles({ page: 0, size: 100 });
        return res.data?.data?.content ?? [];
      }
      if (tab === 'shared') {
        const res = await getDepartmentFiles({ page: 0, size: 100 });
        return res.data?.data?.content ?? [];
      }
      if (tab === 'important') {
        const res = await getFavoriteFiles({ page: 0, size: 100, sort: 'createdAt,desc' });
        return res.data?.data?.content ?? [];
      }
      if (tab === 'template') {
        const res = await getApprovalTemplates();
        const templates = res.data?.data || [];
        return templates.map(t => ({
          docId: `temp-${t.id}`,
          title: t.title,
          fileSize: 0,
          createdAt: t.createdAt,
          scopeName: t.category || '양식',
          isTemplate: true,
        }));
      }
      return [];
    },
  });

  const filtered = files.filter(f =>
    !search || (f.title || f.originalFileName || '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (fileId, isTemplate) => {
    if (isTemplate) return; // 빈 양식은 첨부 불가
    if (!multiple) {
      setSelectedIds([fileId]);
    } else {
      setSelectedIds(prev =>
        prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
      );
    }
  };

  const handleTabChange = (newTab) => {
    setTab(newTab);
    setSelectedIds([]);
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0) return;
    setDownloading(true);
    try {
      const pickedFiles = await Promise.all(
        selectedIds.map(async (fileId) => {
          const info = files.find(f => (f.fileId ?? f.docId) === fileId);
          const res = await downloadFile(fileId);
          const blob = new Blob([res.data]);
          const filename = info?.originalFileName || info?.title || `file_${fileId}`;
          return new File([blob], filename, { type: blob.type || 'application/octet-stream' });
        })
      );
      onFilePicked(multiple ? pickedFiles : pickedFiles[0]);
      onClose();
    } catch {
      showAlert('파일을 불러오는 데 실패했습니다.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="modal-content"
      onClick={e => e.stopPropagation()}
      style={{
        width: 680, maxWidth: '95vw', height: 520,
        display: 'flex', flexDirection: 'column',
        padding: 0, borderRadius: 10, overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #eee' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>파일함에서 선택</h3>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#666', lineHeight: 1 }}>
          <FiX />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #eee', padding: '0 8px', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button
            type="button"
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            style={{
              padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
              borderBottom: tab === t.id ? '2px solid #1a73e8' : '2px solid transparent',
              color: tab === t.id ? '#1a73e8' : '#666',
              fontWeight: tab === t.id ? 600 : 400,
              display: 'flex', alignItems: 'center', gap: 5,
              whiteSpace: 'nowrap',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8f9fa', borderRadius: 6, padding: '6px 12px' }}>
          <FiSearch style={{ color: '#aaa', flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="파일 이름으로 검색..."
            style={{ border: 'none', background: 'none', outline: 'none', fontSize: 13, width: '100%' }}
          />
        </div>
      </div>

      {/* File List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {tab === 'template' && (
          <div style={{ padding: '8px 20px 0', fontSize: 12, color: '#f59e0b', background: '#fffbeb', borderBottom: '1px solid #fef3c7' }}>
            빈 양식은 결재 문서 양식으로 파일 첨부가 불가능합니다.
          </div>
        )}
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: '#888' }}>
            불러오는 중...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, color: '#aaa', gap: 8 }}>
            <FiFolder size={32} />
            <span>{search ? '검색 결과가 없습니다.' : '파일이 없습니다.'}</span>
          </div>
        ) : (
          filtered.map(f => {
            const id = f.fileId ?? f.docId;
            const isTemplate = !!f.isTemplate;
            const isSelected = selectedIds.includes(id);
            return (
              <div
                key={id}
                onClick={() => toggleSelect(id, isTemplate)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px',
                  cursor: isTemplate ? 'not-allowed' : 'pointer',
                  background: isSelected ? '#e8f0fe' : 'transparent',
                  borderLeft: isSelected ? '3px solid #1a73e8' : '3px solid transparent',
                  opacity: isTemplate ? 0.5 : 1,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>{getFileIcon(f.title)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.title || f.originalFileName}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {isTemplate
                      ? `${f.scopeName || '양식'} · 첨부 불가`
                      : `${formatFileSize(f.fileSize)} · ${formatDate(f.createdAt || f.uploadedAt)}`
                    }
                  </div>
                </div>
                {isSelected && <span style={{ color: '#1a73e8', fontWeight: 700 }}>✓</span>}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#666' }}>
          {selectedIds.length > 0 ? `${selectedIds.length}개 선택됨` : '파일을 선택하세요'}
        </span>
        <div>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={downloading}>취소</button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm} disabled={selectedIds.length === 0 || downloading}>
            {downloading ? '불러오는 중...' : '선택'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FileStoragePickerModal({ isOpen, onClose, onFilePicked, multiple = false }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <PickerContent onClose={onClose} onFilePicked={onFilePicked} multiple={multiple} />
    </div>
  );
}
