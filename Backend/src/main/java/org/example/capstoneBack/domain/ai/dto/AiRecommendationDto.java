package org.example.capstoneBack.domain.ai.dto;

import lombok.Builder;
import lombok.Getter;
import org.example.capstoneBack.common.enums.InsightType;
import org.example.capstoneBack.domain.ai.entity.AiRecommendation;

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
