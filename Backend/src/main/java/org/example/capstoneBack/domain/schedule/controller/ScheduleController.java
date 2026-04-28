package org.example.capstoneBack.domain.schedule.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.response.ApiResponse;
import org.example.capstoneBack.domain.schedule.dto.ScheduleCreateRequest;
import org.example.capstoneBack.domain.schedule.dto.ScheduleDto;
import org.example.capstoneBack.domain.schedule.service.ScheduleService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    /** Calender-01: 개인 캘린더 조회 */
    @GetMapping("/personal")
    public ResponseEntity<ApiResponse<List<ScheduleDto>>> getPersonalSchedules(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(ApiResponse.ok(
                scheduleService.getPersonalSchedules(userDetails.getUsername())));
    }

    /** Calender-02: 부서 공유 캘린더 조회 */
    @GetMapping("/shared")
    public ResponseEntity<ApiResponse<List<ScheduleDto>>> getSharedSchedules(
            @RequestParam Long scopeId) {
        return ResponseEntity.ok(ApiResponse.ok(scheduleService.getSharedSchedules(scopeId)));
    }

    /** 기간 필터 조회 (개인) */
    @GetMapping("/personal/range")
    public ResponseEntity<ApiResponse<List<ScheduleDto>>> getPersonalByRange(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return ResponseEntity.ok(ApiResponse.ok(
                scheduleService.getPersonalSchedulesByRange(userDetails.getUsername(), start, end)));
    }

    /** 기간 필터 조회 (공유) */
    @GetMapping("/shared/range")
    public ResponseEntity<ApiResponse<List<ScheduleDto>>> getSharedByRange(
            @RequestParam Long scopeId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return ResponseEntity.ok(ApiResponse.ok(
                scheduleService.getSharedSchedulesByRange(scopeId, start, end)));
    }

    /** Calender-01-2 / 02-2: 일정 등록 */
    @PostMapping
    public ResponseEntity<ApiResponse<ScheduleDto>> createSchedule(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody ScheduleCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok(scheduleService.createSchedule(userDetails.getUsername(), request)));
    }

    /** Calender-01-3 / 02-3: 일정 수정 */
    @PatchMapping("/{scheduleId}")
    public ResponseEntity<ApiResponse<ScheduleDto>> updateSchedule(
            @PathVariable Long scheduleId,
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return ResponseEntity.ok(ApiResponse.ok(
                scheduleService.updateSchedule(scheduleId, userDetails.getUsername(), title, start, end)));
    }

    /** Calender-01-4 / 02-4: 일정 삭제 */
    @DeleteMapping("/{scheduleId}")
    public ResponseEntity<ApiResponse<Void>> deleteSchedule(
            @PathVariable Long scheduleId,
            @AuthenticationPrincipal UserDetails userDetails) {
        scheduleService.deleteSchedule(scheduleId, userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.ok("일정이 삭제되었습니다."));
    }
}
