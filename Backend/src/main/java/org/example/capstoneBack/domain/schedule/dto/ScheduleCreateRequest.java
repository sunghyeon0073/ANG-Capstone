package org.example.capstoneBack.domain.schedule.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
public class ScheduleCreateRequest {

    @NotBlank(message = "제목을 입력하세요.")
    private String title;

    @NotNull(message = "시작 시간을 입력하세요.")
    private LocalDateTime startTime;

    @NotNull(message = "종료 시간을 입력하세요.")
    private LocalDateTime endTime;

    // null이면 개인 캘린더, 값이 있으면 부서 공유 캘린더
    private Long scopeId;
}
