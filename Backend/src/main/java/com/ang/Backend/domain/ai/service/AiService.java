package com.ang.Backend.domain.ai.service;

import com.ang.Backend.common.enums.InsightType;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.ai.dto.AiRecommendationDto;
import com.ang.Backend.domain.ai.entity.AiRecommendation;
import com.ang.Backend.domain.ai.repository.AiRecommendationRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AiService {

    private final AiRecommendationRepository aiRecommendationRepository;
    private final UserRepository userRepository;

    // ── 추천 조회 ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AiRecommendationDto> getMyRecommendations(String empNo) {
        User user = findUser(empNo);
        return aiRecommendationRepository.findByUserAndIsAppliedFalse(user)
                .stream().map(AiRecommendationDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<AiRecommendationDto> getRecommendationsByType(String empNo, InsightType type) {
        User user = findUser(empNo);
        return aiRecommendationRepository.findByUserAndInsightType(user, type)
                .stream().map(AiRecommendationDto::from).toList();
    }

    @Transactional
    public void applyRecommendation(Long recommendationId, String empNo) {
        User user = findUser(empNo);
        AiRecommendation rec = aiRecommendationRepository.findById(recommendationId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND));
        if (!rec.getUser().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.PERMISSION_DENIED);
        }
        rec.apply();
    }

    // ── AI 문서 추천 (AI-01-1) ────────────────────────────────────────────

    @Transactional
    public AiRecommendationDto recommendDocumentType(String empNo, String keyword) {
        User user = findUser(empNo);
        String prompt = "다음 업무 키워드에 적합한 문서 양식 3가지를 추천해줘: " + keyword;
        String aiContent = callOllama(prompt);
        return AiRecommendationDto.from(aiRecommendationRepository.save(
                AiRecommendation.builder()
                        .user(user)
                        .insightType(InsightType.TASK_RECOMMEND)
                        .aiContent(aiContent)
                        .build()));
    }

    // ── AI 초안 생성 (AI-01-2, AI-01-3) ─────────────────────────────────

    public String generateDraft(String templateType, String details) {
        String prompt = "'" + templateType + "' 양식의 문서 초안을 작성해줘. 내용: " + details;
        return callOllama(prompt);
    }

    // ── OCR 텍스트 추출 (AI-01-5) ─────────────────────────────────────────

    public String extractTextFromImage(String originalFilename) {
        // TODO: Ollama 설치 후 vision 모델(llava)로 교체
        return "[OCR Mock] '" + originalFilename + "' 파일에서 추출된 텍스트입니다.\n"
                + "예시) 출장신청서\n신청인: 홍길동\n출장지: 부산\n기간: 2025-06-01 ~ 2025-06-03";
    }

    // ── AI 일정 추천 (AI-02-1) ───────────────────────────────────────────

    @Transactional
    public AiRecommendationDto recommendSchedule(String empNo, String recentSchedulesSummary) {
        User user = findUser(empNo);
        String prompt = "다음은 사용자의 최근 일정 목록이다:\n" + recentSchedulesSummary
                + "\n이를 바탕으로 다음 주 업무 일정을 3가지 추천해줘.";
        String aiContent = callOllama(prompt);
        return AiRecommendationDto.from(aiRecommendationRepository.save(
                AiRecommendation.builder()
                        .user(user)
                        .insightType(InsightType.SCHEDULE_RECOMMEND)
                        .aiContent(aiContent)
                        .build()));
    }

    // ── Mock AI 호출 ──────────────────────────────────────────────────────
    // TODO: Ollama 설치 후 아래 메서드 내부를 RestClient 호출로 교체
    // RestClient 빈은 OllamaConfig.ollamaRestClient() 사용
    // POST /api/chat { "model": "llama3.2", "messages": [...], "stream": false }

    private String callOllama(String prompt) {
        String preview = prompt.length() > 30 ? prompt.substring(0, 30) + "..." : prompt;
        return "[AI Mock 응답] 요청: \"" + preview + "\"\n"
                + "1. 출장신청서\n2. 업무보고서\n3. 회의록\n"
                + "(실제 AI 응답은 Ollama 설치 후 활성화됩니다)";
    }

    // ── 공통 ──────────────────────────────────────────────────────────────

    private User findUser(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
