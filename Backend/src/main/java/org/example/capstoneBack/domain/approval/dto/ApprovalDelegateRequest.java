package org.example.capstoneBack.domain.approval.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
public class ApprovalDelegateRequest {

    @NotNull(message = "대리인 ID를 입력하세요.")
    private Long surrogateId;

    @NotNull(message = "시작일을 입력하세요.")
    private LocalDateTime startDate;

    @NotNull(message = "종료일을 입력하세요.")
    private LocalDateTime endDate;
}
