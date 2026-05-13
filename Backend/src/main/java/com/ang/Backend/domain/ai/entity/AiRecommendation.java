package com.ang.Backend.domain.ai.entity;

import com.ang.Backend.common.enums.InsightType;
import com.ang.Backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ai_recommendations")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class AiRecommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "recommendation_id")
    private Long recommendationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(name = "insight_type", nullable = false)
    private InsightType insightType;

    @Column(name = "ai_content", nullable = false, columnDefinition = "TEXT")
    private String aiContent;

    @Column(name = "is_applied")
    @Builder.Default
    private boolean isApplied = false;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();


    public void apply() {
        this.isApplied = true;
    }
}
