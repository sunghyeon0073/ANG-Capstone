package com.ang.Backend.domain.approval.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.ApiResponse;
import com.ang.Backend.domain.approval.dto.ApprovalTemplateDto;
import com.ang.Backend.domain.approval.service.ApprovalTemplateService;
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
        User admin = userRepository.findByEmpNo(userDetails.getUsername()).orElseThrow();
        return ApiResponse.ok(templateService.createTemplate(req, admin));
    }
}
