import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  // 여기에 서버 설정을 추가합니다
  server: {
    port: 5500,        // 포트 번호를 5500으로 고정
    strictPort: true,  // 5500 포트가 이미 사용 중이면 다른 포트로 넘기지 않고 에러 발생
    open: true         // 서버 실행 시 브라우저를 자동으로 띄울지 여부 (선택사항)
  }
})