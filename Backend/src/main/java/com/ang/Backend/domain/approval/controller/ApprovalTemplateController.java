package com.ang.Backend.domain.approval.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.approval.dto.ApprovalTemplateDto;
import com.ang.Backend.domain.approval.service.ApprovalTemplateService;
import com.ang.Backend.domain.role.entity.UserRole;
import com.ang.Backend.domain.role.repository.UserRoleRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class ApprovalTemplateController {

    private final ApprovalTemplateService templateService;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;

    @GetMapping("/approvals/templates")
    public ApiResponse<List<ApprovalTemplateDto.Response>> getTemplates(
            @RequestParam(required = false) String category) {
        return ApiResponse.ok(templateService.getTemplates(category));
    }

    @GetMapping("/approvals/templates/{id}")
    public ApiResponse<ApprovalTemplateDto.Response> getTemplate(@PathVariable Long id) {
        return ApiResponse.ok(templateService.getTemplate(id));
    }

    @PostMapping("/admin/approvals/templates")
    public ApiResponse<ApprovalTemplateDto.Response> createTemplate(
            @RequestBody ApprovalTemplateDto.CreateRequest req,
            @AuthenticationPrincipal UserDetails userDetails) {
        if (userDetails == null) throw new CustomException(ErrorCode.UNAUTHORIZED);
        User admin = userRepository.findByEmpNo(userDetails.getUsername())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        // 관리자 권한 검증 (roleLevel >= 50)
        List<UserRole> roles = userRoleRepository.findByUserOrderByRoleLevelDesc(admin);
        int roleLevel = roles.isEmpty() ? 0 : roles.get(0).getRole().getRoleLevel();
        if (roleLevel < 50) {
            throw new CustomException(ErrorCode.PERMISSION_DENIED);
        }

        return ApiResponse.ok(templateService.createTemplate(req, admin));
    }
}
