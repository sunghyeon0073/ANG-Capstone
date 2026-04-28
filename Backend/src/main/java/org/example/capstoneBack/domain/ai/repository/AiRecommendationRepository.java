package org.example.capstoneBack.domain.ai.repository;

import org.example.capstoneBack.common.enums.InsightType;
import org.example.capstoneBack.domain.ai.entity.AiRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiRecommendationRepository extends JpaRepository<AiRecommendation, Long> {

    List<AiRecommendation> findByUserUserId(Long userId);

    List<AiRecommendation> findByUserUserIdAndInsightType(Long userId, InsightType insightType);

    List<AiRecommendation> findByUserUserIdAndIsAppliedFalse(Long userId);
}
