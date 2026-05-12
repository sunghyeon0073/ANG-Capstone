package com.ang.Backend.domain.schedule.dto;

import com.ang.Backend.domain.schedule.entity.Schedule;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ScheduleDto {

    private Integer scheduleId;
    private String title;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer scopeId;
    private String scopeName;
    private boolean isPersonal;
    private LocalDateTime createdAt;

    public static ScheduleDto from(Schedule schedule) {
        boolean isPersonal = schedule.getScope() == null;
        return ScheduleDto.builder()
                .scheduleId(schedule.getScheduleId())
                .title(schedule.getTitle())
                .startTime(schedule.getStartTime())
                .endTime(schedule.getEndTime())
                .scopeId(isPersonal ? null : schedule.getScope().getScopeId())
                .scopeName(isPersonal ? null : schedule.getScope().getName())
                .isPersonal(isPersonal)
                .createdAt(schedule.getCreatedAt())
                .build();
    }
}
