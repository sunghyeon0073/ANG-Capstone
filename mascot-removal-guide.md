# Floating Mascot Removal Guide

This file documents everything added for the floating AI mascot feature so it can be removed later in one pass.

## Files Added

Delete these files/directories if the mascot feature is removed:

```txt
Frontend/src/components/FloatingMascot.jsx
Frontend/public/assets/mascot/mascot-idle.png
assets/mascot-candidate/
```

`assets/mascot-candidate/` is only the downloaded source/candidate asset folder. It is not needed at runtime.

## Existing Files Modified

### `Frontend/src/components/Dashboard.jsx`

Remove this import:

```jsx
import FloatingMascot from './FloatingMascot'
```

Remove this JSX line near the bottom of the dashboard render:

```jsx
<FloatingMascot mode={currentPage === 'document-AI' ? 'ai' : 'default'} />
```

### `Frontend/src/components/pages/DocumentWriter.jsx`

Remove the three `window.dispatchEvent(new CustomEvent('ang:mascot-alert', ...))` blocks.

They are located in `handleAiGenerate`:

```jsx
window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
  detail: { message: '문서 읽는 중... 잠시만 기다려주세요.' }
}))
```

```jsx
window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
  detail: { message: 'AI 문서 초안이 완성됐어요.' }
}))
```

```jsx
window.dispatchEvent(new CustomEvent('ang:mascot-alert', {
  detail: { message: 'AI 문서 생성에 실패했어요. 연결 상태를 확인해주세요.' }
}))
```

### `Frontend/src/index.css`

Remove the whole CSS section:

```css
/* ============================================================================
   FLOATING AI MASCOT
   ============================================================================ */
```

Delete everything from that header through the end of its mobile media query:

```css
@media (max-width: 640px) {
  .floating-mascot {
    right: 14px;
    bottom: 14px;
  }

  .floating-mascot-character {
    width: 76px;
    height: 94px;
  }
}
```

## Quick Verification After Removal

Run:

```bash
cd Frontend
npm run build
```

Expected result:

```txt
No import error for FloatingMascot
No missing mascot image reference
Dashboard still renders normally
AI document generation still works without mascot reactions
```
