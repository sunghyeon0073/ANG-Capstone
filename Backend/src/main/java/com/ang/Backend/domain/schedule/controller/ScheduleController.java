package com.ang.Backend.domain.schedule.controller;

import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.schedule.dto.ScheduleCreateRequest;
import com.ang.Backend.domain.schedule.dto.ScheduleDto;
import com.ang.Backend.domain.schedule.service.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<ScheduleDto>>> getMySchedules(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                scheduleService.getMySchedules(userDetails.getUsername())));
    }

    @GetMapping("/personal")
    public ResponseEntity<ApiResponse<List<ScheduleDto>>> getPersonalSchedules(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                scheduleService.getPersonalSchedules(userDetails.getUsername())));
    }

    @GetMapping("/shared")
    public ResponseEntity<ApiResponse<List<ScheduleDto>>> getSharedSchedules(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                scheduleService.getSharedSchedules(userDetails.getUsername())));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ScheduleDto>> createSchedule(
            @Valid @RequestBody ScheduleCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        ScheduleDto created = scheduleService.createSchedule(userDetails.getUsername(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("일정이 생성되었습니다.", created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ScheduleDto>> updateSchedule(
            @PathVariable Integer id,
            @Valid @RequestBody ScheduleCreateRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        ScheduleDto updated = scheduleService.updateSchedule(userDetails.getUsername(), id, request);
        return ResponseEntity.ok(ApiResponse.ok("일정이 수정되었습니다.", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteSchedule(
            @PathVariable Integer id,
            @AuthenticationPrincipal UserDetails userDetails) {
        scheduleService.deleteSchedule(userDetails.getUsername(), id);
        return ResponseEntity.ok(ApiResponse.ok("일정이 삭제되었습니다."));
    }
}
