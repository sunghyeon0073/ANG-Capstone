import React, { useState } from 'react'
import { FiCheck, FiFileText, FiUploadCloud } from 'react-icons/fi'
import { parseTemplate } from '../../api/documentApi'
import { downloadFile } from '../../api/fileApi'
import FileStorage from '../pages/FileStorage'

export default function DraftStudioConfig({
  aiLoading,
  handleAiGenerate,
  attachedDocs,
  clearAttachedDocs,
  toggleAttachedDoc,
  onOpenReferenceModal
}) {
  const [formData, setFormData] = useState({});
  const [dynamicFields, setDynamicFields] = useState([]);
  const [selectedTemplateFile, setSelectedTemplateFile] = useState(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const [showMemoModal, setShowMemoModal] = useState(false);
  const [memoText, setMemoText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const handleTemplateSelect = async (doc) => {
    try {
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', { detail: { message: '양식을 불러오고 분석 중입니다...' } }));
      const res = await downloadFile(doc.docId || doc.fileId);
      const blob = new Blob([res.data]);
      
      const parsed = await parseTemplate(blob);
      const fields = parsed.fields || [];
      
      setDynamicFields(fields);
      setSelectedTemplateFile(blob);
      setSelectedTemplateName(doc.title);
      setFormData({});
      setShowTemplatePicker(false);
      
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', { detail: { message: '양식의 빈칸을 모두 찾아냈어요!' } }));
    } catch (err) {
      console.error(err);
      alert('양식을 불러오는데 실패했습니다.');
    }
  };

  const handleFieldChange = (fieldId, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleExtractForm = async () => {
    if (!memoText.trim()) return;
    if (dynamicFields.length === 0) return alert('먼저 양식을 불러와주세요.');
    
    try {
      setIsExtracting(true);
      window.dispatchEvent(new CustomEvent('ang:mascot-alert', { detail: { message: '메모를 읽고 양식에 맞게 폼을 채우고 있어요...' } }));
      
      const response = await fetch('/ai-api/extract-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memo: memoText,
          fields: dynamicFields.map(f => ({ id: f.id, label: f.label }))
        })
      });

      if (!response.ok) throw new Error('AI 분석 실패');
      
      const result = await response.json();
      if (result.data) {
        setFormData(prev => ({ ...prev, ...result.data }));
        setShowMemoModal(false);
        setMemoText('');
        window.dispatchEvent(new CustomEvent('ang:mascot-alert', { detail: { message: '입력 폼을 모두 채웠어요! 확인해 보세요.' } }));
      }
    } catch (err) {
      alert('AI 추출 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsExtracting(false);
    }
  };

  const onSubmit = () => {
    if (!selectedTemplateFile) return;
    handleAiGenerate('template', {
      templateFile: selectedTemplateFile,
      formData: JSON.stringify(formData),
      title: formData[dynamicFields[0]?.id] || `${selectedTemplateName.replace('.docx', '')} 작성본`,
      attachedDocIds: attachedDocs?.map(d => d.docId) || []
    });
  };

  const isFormValid = dynamicFields.some(f => formData[f.id] && formData[f.id].trim().length > 0);

  return (
    <div className="draft-studio-config" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderRight: '1px solid #eef1f4' }}>
      <div className="config-header" style={{ padding: '20px', borderBottom: '1px solid #eef1f4', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', margin: '0 0 4px' }}>템플릿 자동 작성기</h2>
          <p style={{ margin: '0', fontSize: '13px', color: '#64748b' }}>파일함에서 양식을 선택하고 내용을 채워보세요.</p>
        </div>
        <button 
          type="button" 
          onClick={() => setShowTemplatePicker(true)}
          style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
          onMouseOver={e => e.target.style.background = '#e2e8f0'}
          onMouseOut={e => e.target.style.background = '#f1f5f9'}
        >
          <FiUploadCloud /> 양식 불러오기
        </button>
      </div>

      <div className="config-body" style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Template Selection Info */}
        <section className="config-section">
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '10px' }}>
            선택된 양식
          </label>
          <div style={{ display: 'flex', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            {selectedTemplateFile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: '500' }}>
                <FiFileText color="#3b82f6" size={18} />
                {selectedTemplateName}
              </div>
            ) : (
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>상단의 '양식 불러오기' 버튼을 눌러 .docx 파일을 선택하세요.</span>
            )}
          </div>
        </section>

        {/* Dynamic Form Section */}
        {selectedTemplateFile && (
          <section className="config-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                입력 항목
              </label>
              <button 
                type="button" 
                onClick={() => setShowMemoModal(true)}
                style={{ background: 'var(--color-primary-soft)', border: '1px solid var(--color-primary)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                ✨ 메모장에서 가져오기
              </button>
            </div>
            
            {dynamicFields.length === 0 && (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>양식에서 빈칸({`{{}}`})을 찾지 못했습니다.</p>
            )}

            {dynamicFields.map(field => (
              <div key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>{field.label}</label>
                <textarea
                  value={formData[field.id] || ''}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  placeholder={`${field.label} 내용을 입력하세요`}
                  disabled={aiLoading}
                  style={{ minHeight: '80px', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', resize: 'vertical', fontSize: '14px', lineHeight: '1.5', color: '#334155', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>
            ))}
          </section>
        )}

      </div>

      <div className="config-footer" style={{ padding: '20px', borderTop: '1px solid #eef1f4', background: '#f8fafc' }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={aiLoading || !selectedTemplateFile}
          style={{ width: '100%', padding: '14px', background: aiLoading || !selectedTemplateFile ? '#cbd5e1' : 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: aiLoading || !selectedTemplateFile ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
        >
          {aiLoading ? 'AI 생성 중...' : '문서 생성'}
        </button>
      </div>

      {/* Memo Modal */}
      {showMemoModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '600px', maxWidth: '90vw', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ margin: '0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>✨ 메모장에서 가져오기 (AI 자동 채우기)</h3>
              <button onClick={() => setShowMemoModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', color: '#94a3b8', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '24px', flex: 1 }}>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#64748b' }}>회의 중 작성한 메모나 대화 내용 등 텍스트를 자유롭게 붙여넣으세요. 입력 항목을 인식하여 폼에 맞게 자동으로 채워줍니다.</p>
              <textarea
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                placeholder={`여기에 텍스트를 붙여넣으세요... \n예: \n${dynamicFields[0]?.label}: 2026-06-25`}
                style={{ width: '100%', height: '200px', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', resize: 'none', outline: 'none' }}
              />
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowMemoModal(false)} style={{ padding: '10px 16px', border: '1px solid #cbd5e1', background: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', color: '#475569' }}>취소</button>
              <button 
                onClick={handleExtractForm} 
                disabled={isExtracting || !memoText.trim()}
                style={{ padding: '10px 20px', border: 'none', background: 'var(--color-primary)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isExtracting ? '분석 중...' : '✨ 자동 채우기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Picker Modal */}
      {showTemplatePicker && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease' }}>
          <div className="modal-content" style={{ background: '#fff', borderRadius: '16px', width: '90vw', maxWidth: '1400px', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div className="modal-header" style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>파일함에서 양식 문서 선택</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>빈칸( {'{{}}'} )이 포함된 워드(.docx) 문서를 선택해 주세요.</p>
              </div>
              <button onClick={() => setShowTemplatePicker(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8', padding: '4px', lineHeight: '1' }}>&times;</button>
            </div>
            
            <div className="modal-body" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <FileStorage 
                isPickerMode={true} 
                allowedExtensions={['.docx']} // Only allow .docx
                attachedDocs={[]} 
                toggleAttachedDoc={handleTemplateSelect} 
              />
            </div>
            
            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowTemplatePicker(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: '600', cursor: 'pointer' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
