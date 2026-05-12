package com.ang.Backend.domain.ai.controller;

import com.ang.Backend.common.enums.InsightType;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.ai.dto.AiRecommendationDto;
import com.ang.Backend.domain.ai.dto.DocumentDraftRequest;
import com.ang.Backend.domain.ai.dto.DocumentRecommendRequest;
import com.ang.Backend.domain.ai.service.AiService;
import com.ang.Backend.domain.schedule.service.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;
    private final ScheduleService scheduleService;
    private final UserRepository userRepository;

    // ── 추천 조회 ──────────────────────────────────────────────────────────

    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<List<AiRecommendationDto>>> getMyRecommendations(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                aiService.getMyRecommendations(userDetails.getUsername())));
    }

    @GetMapping("/recommendations/{type}")
    public ResponseEntity<ApiResponse<List<AiRecommendationDto>>> getByType(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable InsightType type) {
        return ResponseEntity.ok(ApiResponse.ok(
                aiService.getRecommendationsByType(userDetails.getUsername(), type)));
    }

    @PostMapping("/recommendations/{recommendationId}/apply")
    public ResponseEntity<ApiResponse<Void>> applyRecommendation(
            @PathVariable Long recommendationId,
            @AuthenticationPrincipal UserDetails userDetails) {
        aiService.applyRecommendation(recommendationId, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("AI 추천이 적용되었습니다."));
    }

    // ── AI 문서 추천 (AI-01-1) ────────────────────────────────────────────

    @PostMapping("/documents/recommend")
    public ResponseEntity<ApiResponse<AiRecommendationDto>> recommendDocumentType(
            @Valid @RequestBody DocumentRecommendRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        AiRecommendationDto result = aiService.recommendDocumentType(
                userDetails.getUsername(), request.getKeyword());
        return ResponseEntity.ok(ApiResponse.ok("문서 양식 추천이 완료되었습니다.", result));
    }

    // ── AI 초안 생성 (AI-01-2) ────────────────────────────────────────────

    @PostMapping("/documents/draft")
    public ResponseEntity<ApiResponse<Map<String, String>>> generateDraft(
            @Valid @RequestBody DocumentDraftRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        String draft = aiService.generateDraft(request.getTemplateType(), request.getDetails());
        return ResponseEntity.ok(ApiResponse.ok("초안 생성이 완료되었습니다.",
                Map.of("draftContent", draft)));
    }

    // ── OCR 텍스트 추출 (AI-01-5) ─────────────────────────────────────────

    @PostMapping("/ocr")
    public ResponseEntity<ApiResponse<Map<String, String>>> extractText(
            @RequestParam("image") MultipartFile image,
            @AuthenticationPrincipal UserDetails userDetails) {
        String extractedText = aiService.extractTextFromImage(image.getOriginalFilename());
        return ResponseEntity.ok(ApiResponse.ok("텍스트 추출이 완료되었습니다.",
                Map.of("extractedText", extractedText)));
    }

    // ── AI 일정 추천 (AI-02-1) ───────────────────────────────────────────

    @PostMapping("/schedules/recommend")
    public ResponseEntity<ApiResponse<AiRecommendationDto>> recommendSchedule(
            @AuthenticationPrincipal UserDetails userDetails) {
        String empNo = userDetails.getUsername();
        User user = userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new com.ang.Backend.common.exception.CustomException(
                        com.ang.Backend.common.exception.ErrorCode.USER_NOT_FOUND));
        String schedulesSummary = scheduleService.getRecentSchedules(user).stream()
                .map(s -> s.getTitle() + " (" + s.getStartTime() + ")")
                .collect(java.util.stream.Collectors.joining("\n"));
        if (schedulesSummary.isBlank()) schedulesSummary = "최근 일정 없음";
        AiRecommendationDto result = aiService.recommendSchedule(empNo, schedulesSummary);
        return ResponseEntity.ok(ApiResponse.ok("일정 추천이 완료되었습니다.", result));
    }
}
