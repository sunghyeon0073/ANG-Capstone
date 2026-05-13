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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AiService {

    private final AiRecommendationRepository aiRecommendationRepository;
    private final UserRepository userRepository;
    private final RestClient ollamaRestClient;

    @Value("${ollama.model}")
    private String ollamaModel;

    // ── Ollama 요청/응답 구조 ─────────────────────────────────────────────

    record OllamaRequest(String model, List<Message> messages, boolean stream, boolean think) {
        record Message(String role, String content) {}
    }

    record OllamaResponse(Message message) {
        record Message(String content) {}
    }

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
    // llava 모델 설치 후 실제 vision 호출로 교체 가능

    public String extractTextFromImage(String originalFilename) {
        return "[OCR] '" + originalFilename + "' 파일 분석 중...\n"
                + "(vision 모델 설치 후 실제 텍스트 추출이 활성화됩니다)";
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

    // ── Ollama 호출 ───────────────────────────────────────────────────────

    private String callOllama(String prompt) {
        try {
            OllamaRequest request = new OllamaRequest(
                    ollamaModel,
                    List.of(new OllamaRequest.Message("user", prompt)),
                    false,
                    false   // Qwen3 thinking 모드 비활성화 (빠른 응답)
            );

            OllamaResponse response = ollamaRestClient
                    .post()
                    .uri("/api/chat")
                    .body(request)
                    .retrieve()
                    .body(OllamaResponse.class);

            if (response == null || response.message() == null) {
                throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
            }
            return response.message().content();

        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("Ollama 호출 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    // ── 공통 ──────────────────────────────────────────────────────────────

    private User findUser(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
