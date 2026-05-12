package com.ang.Backend.domain.schedule.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class ScheduleCreateRequest {

    @NotBlank(message = "일정 제목을 입력해주세요.")
    private String title;

    @NotNull(message = "시작 시간을 입력해주세요.")
    private LocalDateTime startTime;

    @NotNull(message = "종료 시간을 입력해주세요.")
    private LocalDateTime endTime;

    private Integer scopeId;
}
