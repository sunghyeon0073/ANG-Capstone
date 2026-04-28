package org.example.capstoneBack.domain.approval.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
public class ApprovalCreateRequest {

    @NotBlank(message = "제목을 입력하세요.")
    private String title;

    @NotBlank(message = "내용을 입력하세요.")
    private String content;

    @NotNull(message = "부서를 선택하세요.")
    private Long scopeId;

    // 결재 라인 (순서대로 결재자 ID 목록)
    @NotNull(message = "결재자를 지정하세요.")
    private List<Long> approverIds;
}
