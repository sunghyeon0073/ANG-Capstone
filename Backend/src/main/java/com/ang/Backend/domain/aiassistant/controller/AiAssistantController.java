package com.ang.Backend.domain.aiassistant.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.aiassistant.dto.AiAssistantDto;
import com.ang.Backend.domain.aiassistant.service.AiScheduledActionService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/ai-assistant")
@RequiredArgsConstructor
public class AiAssistantController {

    private final AiScheduledActionService aiScheduledActionService;
    private final UserRepository userRepository;

    @PostMapping("/schedule")
    public ResponseEntity<ApiResponse<AiAssistantDto.ScheduleResponse>> parseOrSchedule(
            @Valid @RequestBody AiAssistantDto.PromptRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = resolveUser(userDetails);
        AiAssistantDto.ScheduleResponse response = aiScheduledActionService.parseOrSchedule(request.getPrompt(), request.isConfirm(), user);
        String message = request.isConfirm() ? "예약이 등록되었습니다." : "예약 내용을 확인했습니다.";
        return ResponseEntity.ok(ApiResponse.ok(message, response));
    }

    @GetMapping("/schedules")
    public ResponseEntity<ApiResponse<List<AiAssistantDto.ScheduleResponse>>> getMySchedules(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        return ResponseEntity.ok(ApiResponse.ok(aiScheduledActionService.getMySchedules(resolveUser(userDetails))));
    }

    @PostMapping("/schedules/{id}/cancel")
    public ResponseEntity<ApiResponse<Void>> cancel(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        aiScheduledActionService.cancel(id, resolveUser(userDetails));
        return ResponseEntity.ok(ApiResponse.ok("예약이 취소되었습니다."));
    }

    private User resolveUser(UserDetails userDetails) {
        if (userDetails == null) throw new CustomException(ErrorCode.UNAUTHORIZED);
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
