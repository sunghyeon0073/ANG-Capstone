package org.example.capstoneBack.domain.ai.controller;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.enums.InsightType;
import org.example.capstoneBack.common.response.ApiResponse;
import org.example.capstoneBack.domain.ai.dto.AiRecommendationDto;
import org.example.capstoneBack.domain.ai.service.AiService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiService aiService;

    /** AI-01/02: 내 AI 추천 목록 (미적용) */
    @GetMapping("/recommendations")
    public ResponseEntity<ApiResponse<List<AiRecommendationDto>>> getMyRecommendations(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                aiService.getMyRecommendations(userDetails.getUsername())));
    }

    /** 유형별 추천 조회 (TASK_RECOMMEND, SCHEDULE_RECOMMEND, TASK_ANALYSIS) */
    @GetMapping("/recommendations/{type}")
    public ResponseEntity<ApiResponse<List<AiRecommendationDto>>> getByType(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable InsightType type) {
        return ResponseEntity.ok(ApiResponse.ok(
                aiService.getRecommendationsByType(userDetails.getUsername(), type)));
    }

    /** AI 추천 적용 (사용자 수락) */
    @PostMapping("/recommendations/{recommendationId}/apply")
    public ResponseEntity<ApiResponse<Void>> applyRecommendation(
            @PathVariable Long recommendationId,
            @AuthenticationPrincipal UserDetails userDetails) {
        aiService.applyRecommendation(recommendationId, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("AI 추천이 적용되었습니다."));
    }
}
