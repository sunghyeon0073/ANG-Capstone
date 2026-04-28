package org.example.capstoneBack.domain.ai.service;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.enums.InsightType;
import org.example.capstoneBack.common.exception.CustomException;
import org.example.capstoneBack.common.exception.ErrorCode;
import org.example.capstoneBack.domain.ai.dto.AiRecommendationDto;
import org.example.capstoneBack.domain.ai.entity.AiRecommendation;
import org.example.capstoneBack.domain.ai.repository.AiRecommendationRepository;
import org.example.capstoneBack.domain.user.entity.User;
import org.example.capstoneBack.domain.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AiService {

    private final AiRecommendationRepository aiRecommendationRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<AiRecommendationDto> getMyRecommendations(String empNo) {
        User user = findUserByEmpNo(empNo);
        return aiRecommendationRepository.findByUserUserIdAndIsAppliedFalse(user.getUserId())
                .stream().map(AiRecommendationDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<AiRecommendationDto> getRecommendationsByType(String empNo, InsightType type) {
        User user = findUserByEmpNo(empNo);
        return aiRecommendationRepository.findByUserUserIdAndInsightType(user.getUserId(), type)
                .stream().map(AiRecommendationDto::from).toList();
    }

    @Transactional
    public AiRecommendationDto saveRecommendation(String empNo, InsightType type, String aiContent) {
        User user = findUserByEmpNo(empNo);
        AiRecommendation recommendation = AiRecommendation.builder()
                .user(user)
                .insightType(type)
                .aiContent(aiContent)
                .build();
        return AiRecommendationDto.from(aiRecommendationRepository.save(recommendation));
    }

    @Transactional
    public void applyRecommendation(Long recommendationId, String empNo) {
        User user = findUserByEmpNo(empNo);
        AiRecommendation rec = aiRecommendationRepository.findById(recommendationId)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND));
        if (!rec.getUser().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.PERMISSION_DENIED);
        }
        rec.apply();
    }

    private User findUserByEmpNo(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
