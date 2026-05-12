package com.ang.Backend.domain.ai.dto;

import com.ang.Backend.common.enums.InsightType;
import com.ang.Backend.domain.ai.entity.AiRecommendation;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AiRecommendationDto {

    private Long recommendationId;
    private InsightType insightType;
    private String aiContent;
    private boolean isApplied;
    private LocalDateTime createdAt;

    public static AiRecommendationDto from(AiRecommendation entity) {
        return AiRecommendationDto.builder()
                .recommendationId(entity.getRecommendationId())
                .insightType(entity.getInsightType())
                .aiContent(entity.getAiContent())
                .isApplied(entity.isApplied())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
