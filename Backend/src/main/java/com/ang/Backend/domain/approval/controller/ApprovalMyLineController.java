package com.ang.Backend.domain.approval.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.approval.dto.ApprovalMyLineDto;
import com.ang.Backend.domain.approval.service.ApprovalMyLineService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/approvals/my-lines")
@RequiredArgsConstructor
public class ApprovalMyLineController {

    private final ApprovalMyLineService myLineService;
    private final UserRepository userRepository;

    @GetMapping
    public ApiResponse<List<ApprovalMyLineDto.Response>> getMyLines(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(myLineService.getMyLines(user));
    }

    @PostMapping
    public ApiResponse<ApprovalMyLineDto.Response> create(
            @RequestBody ApprovalMyLineDto.Request req,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        return ApiResponse.ok(myLineService.create(req, user));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = getUser(userDetails);
        myLineService.delete(id, user);
        return ApiResponse.ok("즐겨찾기 결재선이 삭제되었습니다.");
    }

    private User getUser(UserDetails userDetails) {
        if (userDetails == null) throw new CustomException(ErrorCode.UNAUTHORIZED);
        return userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
