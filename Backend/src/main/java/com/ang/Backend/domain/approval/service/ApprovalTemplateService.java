package com.ang.Backend.domain.approval.service;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.approval.dto.ApprovalTemplateDto;
import com.ang.Backend.domain.approval.entity.ApprovalTemplate;
import com.ang.Backend.domain.approval.repository.ApprovalTemplateRepository;
import com.ang.Backend.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ApprovalTemplateService {

    private final ApprovalTemplateRepository templateRepository;

    public List<ApprovalTemplateDto.Response> getTemplates(String category) {
        List<ApprovalTemplate> templates = (category != null && !category.isBlank())
                ? templateRepository.findByCategoryAndIsActiveTrueOrderByCreatedAtDesc(category)
                : templateRepository.findByIsActiveTrueOrderByCreatedAtDesc();
        return templates.stream().map(ApprovalTemplateDto.Response::from).collect(Collectors.toList());
    }

    public ApprovalTemplateDto.Response getTemplate(Long id) {
        ApprovalTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_TEMPLATE_NOT_FOUND));
        return ApprovalTemplateDto.Response.from(template);
    }

    @Transactional
    public ApprovalTemplateDto.Response createTemplate(ApprovalTemplateDto.CreateRequest req, User admin) {
        ApprovalTemplate template = ApprovalTemplate.builder()
                .title(req.getTitle())
                .category(req.getCategory())
                .formSchema(req.getFormSchema())
                .createdBy(admin)
                .build();
        return ApprovalTemplateDto.Response.from(templateRepository.save(template));
    }

    @Transactional
    public ApprovalTemplateDto.Response updateTemplate(Long id, ApprovalTemplateDto.UpdateRequest req) {
        ApprovalTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_TEMPLATE_NOT_FOUND));
        if (req.getTitle()      != null) template.setTitle(req.getTitle());
        if (req.getCategory()   != null) template.setCategory(req.getCategory());
        if (req.getFormSchema() != null) template.setFormSchema(req.getFormSchema());
        return ApprovalTemplateDto.Response.from(template);
    }

    @Transactional
    public void deactivateTemplate(Long id) {
        ApprovalTemplate template = templateRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_TEMPLATE_NOT_FOUND));
        template.setIsActive(false);
    }
}
