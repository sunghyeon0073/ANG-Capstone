package com.ang.Backend.domain.approval.service;

import com.ang.Backend.common.enums.ApprovalLineStatus;
import com.ang.Backend.common.enums.ApprovalLineType;
import com.ang.Backend.common.enums.ApprovalStatus;
import com.ang.Backend.common.response.PageResult;
import com.ang.Backend.domain.approval.dto.ApprovalDocDto;
import com.ang.Backend.domain.approval.repository.ApprovalDocRepository;
import com.ang.Backend.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ApprovalBoxService {

    private final ApprovalDocRepository docRepository;

    public PageResult<ApprovalDocDto.BoxResponse> getPendingInbox(User user, String keyword, int page, int size) {
        return PageResult.of(
                docRepository.findPendingInbox(user.getUserId(), ApprovalLineStatus.ACTIVE, keyword,
                        PageRequest.of(page, size, Sort.by("createdAt").descending()))
                        .map(ApprovalDocDto.BoxResponse::from)
        );
    }


    public PageResult<ApprovalDocDto.BoxResponse> getCompletedInbox(User user, int page, int size) {
        return PageResult.of(
                docRepository.findCompletedInbox(user.getUserId(),
                        List.of(ApprovalLineStatus.APPROVED, ApprovalLineStatus.REJECTED),
                        PageRequest.of(page, size, Sort.by("createdAt").descending()))
                        .map(ApprovalDocDto.BoxResponse::from)
        );
    }

    public PageResult<ApprovalDocDto.BoxResponse> getOutboxProgress(User user, int page, int size) {
        return PageResult.of(
                docRepository.findByDrafterAndStatusOrderByCreatedAtDesc(
                        user, ApprovalStatus.IN_PROGRESS,
                        PageRequest.of(page, size))
                        .map(ApprovalDocDto.BoxResponse::from)
        );
    }

    public PageResult<ApprovalDocDto.BoxResponse> getOutboxCompleted(User user, int page, int size) {
        return PageResult.of(
                docRepository.findByDrafterAndStatusOrderByCreatedAtDesc(
                        user, ApprovalStatus.APPROVED,
                        PageRequest.of(page, size))
                        .map(ApprovalDocDto.BoxResponse::from)
        );
    }

    public PageResult<ApprovalDocDto.BoxResponse> getOutboxRejected(User user, int page, int size) {
        return PageResult.of(
                docRepository.findByDrafterAndStatusOrderByCreatedAtDesc(
                        user, ApprovalStatus.REJECTED,
                        PageRequest.of(page, size))
                        .map(ApprovalDocDto.BoxResponse::from)
        );
    }

    public PageResult<ApprovalDocDto.BoxResponse> getOutboxDraft(User user, int page, int size) {
        return PageResult.of(
                docRepository.findByDrafterAndStatusOrderByCreatedAtDesc(
                        user, ApprovalStatus.DRAFT,
                        PageRequest.of(page, size))
                        .map(ApprovalDocDto.BoxResponse::from)
        );
    }

    public PageResult<ApprovalDocDto.BoxResponse> getReceivedInbox(User user, int page, int size) {
        return PageResult.of(
                docRepository.findReceivedInbox(user.getUserId(),
                        ApprovalLineType.RECEIVER, ApprovalStatus.APPROVED,
                        PageRequest.of(page, size, Sort.by("createdAt").descending()))
                        .map(ApprovalDocDto.BoxResponse::from)
        );
    }
}
