package com.ang.Backend.domain.schedule.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum ScheduleType {
    PERSONAL("개인"),
    DEPARTMENT("부서");

    private final String description;
}
