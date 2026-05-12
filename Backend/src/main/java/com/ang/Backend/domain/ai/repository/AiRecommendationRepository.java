package com.ang.Backend.domain.ai.repository;

import com.ang.Backend.common.enums.InsightType;
import com.ang.Backend.domain.ai.entity.AiRecommendation;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiRecommendationRepository extends JpaRepository<AiRecommendation, Long> {

    List<AiRecommendation> findByUser(User user);

    List<AiRecommendation> findByUserAndInsightType(User user, InsightType insightType);

    List<AiRecommendation> findByUserAndIsAppliedFalse(User user);
}
