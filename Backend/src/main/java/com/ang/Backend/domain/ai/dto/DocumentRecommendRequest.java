package com.ang.Backend.domain.ai.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;

@Getter
public class DocumentRecommendRequest {

    @NotBlank(message = "키워드를 입력해주세요.")
    private String keyword;
}
