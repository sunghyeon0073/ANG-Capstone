package com.ang.Backend.domain.schedule.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.schedule.dto.ScheduleDto;
import com.ang.Backend.domain.schedule.service.ScheduleService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/schedules")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;
    private final UserRepository userRepository;

    @GetMapping
    public ApiResponse<List<ScheduleDto.Response>> getSchedules(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = resolveUser(userDetails);
        return ApiResponse.ok(scheduleService.getSchedules(user, startDate, endDate));
    }

    @GetMapping("/ai-recommendations")
    public ApiResponse<List<ScheduleDto.AiRecommendationResponse>> getAiRecommendations(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = resolveUser(userDetails);
        return ApiResponse.ok(scheduleService.getAiRecommendations(user, startDate, endDate));
    }

    @PostMapping
    public ApiResponse<ScheduleDto.Response> create(
            @Valid @RequestBody ScheduleDto.SaveRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = resolveUser(userDetails);
        return ApiResponse.ok(scheduleService.create(request, user));
    }

    @PutMapping("/{scheduleId}")
    public ApiResponse<ScheduleDto.Response> update(
            @PathVariable Long scheduleId,
            @Valid @RequestBody ScheduleDto.SaveRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = resolveUser(userDetails);
        return ApiResponse.ok(scheduleService.update(scheduleId, request, user));
    }

    @DeleteMapping("/{scheduleId}")
    public ApiResponse<Void> delete(
            @PathVariable Long scheduleId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = resolveUser(userDetails);
        scheduleService.delete(scheduleId, user);
        return ApiResponse.ok(null);
    }

    private User resolveUser(UserDetails userDetails) {
        if (userDetails == null || userDetails.getUsername() == null) {
            throw new CustomException(ErrorCode.UNAUTHORIZED);
        }

        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
