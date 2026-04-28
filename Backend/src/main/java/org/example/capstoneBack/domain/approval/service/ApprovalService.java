package org.example.capstoneBack.domain.approval.service;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.enums.ApprovalLineStatus;
import org.example.capstoneBack.common.enums.ApprovalStatus;
import org.example.capstoneBack.common.exception.CustomException;
import org.example.capstoneBack.common.exception.ErrorCode;
import org.example.capstoneBack.domain.approval.dto.*;
import org.example.capstoneBack.domain.approval.entity.Approval;
import org.example.capstoneBack.domain.approval.entity.ApprovalDelegate;
import org.example.capstoneBack.domain.approval.entity.ApprovalLine;
import org.example.capstoneBack.domain.approval.repository.*;
import org.example.capstoneBack.domain.notification.entity.Notification;
import org.example.capstoneBack.domain.notification.repository.NotificationRepository;
import org.example.capstoneBack.domain.scope.entity.Scope;
import org.example.capstoneBack.domain.scope.repository.ScopeRepository;
import org.example.capstoneBack.domain.user.entity.User;
import org.example.capstoneBack.domain.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ApprovalService {

    private final ApprovalRepository approvalRepository;
    private final ApprovalLineRepository approvalLineRepository;
    private final ApprovalDelegateRepository approvalDelegateRepository;
    private final UserRepository userRepository;
    private final ScopeRepository scopeRepository;
    private final NotificationRepository notificationRepository;

    @Transactional
    public ApprovalDto createApproval(String empNo, ApprovalCreateRequest request) {
        User requester = findUserByEmpNo(empNo);
        Scope scope = findScopeById(request.getScopeId());

        Approval approval = Approval.builder()
                .requester(requester)
                .scope(scope)
                .title(request.getTitle())
                .content(request.getContent())
                .status(ApprovalStatus.PENDING)
                .build();
        approvalRepository.save(approval);

        List<User> approvers = userRepository.findAllById(request.getApproverIds());
        if (approvers.size() != request.getApproverIds().size()) {
            throw new CustomException(ErrorCode.USER_NOT_FOUND);
        }
        Map<Long, User> approverMap = approvers.stream()
                .collect(Collectors.toMap(User::getUserId, u -> u));

        List<ApprovalLine> lines = new ArrayList<>();
        for (int i = 0; i < request.getApproverIds().size(); i++) {
            lines.add(ApprovalLine.builder()
                    .approval(approval)
                    .approver(approverMap.get(request.getApproverIds().get(i)))
                    .stepOrder(i + 1)
                    .build());
        }
        approvalLineRepository.saveAll(lines);

        // 첫 번째 결재자에게 알림
        if (!request.getApproverIds().isEmpty()) {
            User firstApprover = approverMap.get(request.getApproverIds().get(0));
            notificationRepository.save(Notification.builder()
                    .user(firstApprover).notifType("APPROVAL")
                    .message("[결재 요청] " + approval.getTitle())
                    .targetUrl("/approvals/" + approval.getApprovalId())
                    .build());
        }

        return ApprovalDto.from(approval);
    }

    @Transactional(readOnly = true)
    public ApprovalDto getApproval(Long approvalId) {
        return ApprovalDto.from(findById(approvalId));
    }

    @Transactional(readOnly = true)
    public List<ApprovalDto> getMyApprovals(String empNo) {
        User user = findUserByEmpNo(empNo);
        return approvalRepository.findByRequesterUserId(user.getUserId())
                .stream().map(ApprovalDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<ApprovalDto> getPendingForApprover(String empNo) {
        User user = findUserByEmpNo(empNo);
        return approvalLineRepository.findByApproverUserIdAndStatus(user.getUserId(), ApprovalLineStatus.PENDING)
                .stream()
                .map(line -> ApprovalDto.from(line.getApproval()))
                .distinct()
                .toList();
    }

    @Transactional
    public void processApproval(Long approvalId, String empNo, boolean isApprove,
                                 ApprovalProcessRequest request) {
        User actor = findUserByEmpNo(empNo);
        Approval approval = findById(approvalId);

        if (approval.getStatus() == ApprovalStatus.APPROVED
                || approval.getStatus() == ApprovalStatus.REJECTED) {
            throw new CustomException(ErrorCode.APPROVAL_ALREADY_PROCESSED);
        }

        ApprovalLine pendingLine = approvalLineRepository.findFirstPendingLine(approvalId)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_NOT_FOUND));

        // 대리 결재 여부 확인
        boolean isDelegated = false;
        User approver = pendingLine.getApprover();
        if (!approver.getUserId().equals(actor.getUserId())) {
            ApprovalDelegate delegate = approvalDelegateRepository
                    .findActiveDelegate(approver.getUserId(), LocalDateTime.now())
                    .orElseThrow(() -> new CustomException(ErrorCode.PERMISSION_DENIED));
            if (!delegate.getSurrogate().getUserId().equals(actor.getUserId())) {
                throw new CustomException(ErrorCode.PERMISSION_DENIED);
            }
            isDelegated = true;
        }

        if (isApprove) {
            pendingLine.approve(actor, request.getComment(), isDelegated);
        } else {
            pendingLine.reject(actor, request.getComment(), isDelegated);
        }

        // 전체 결재 상태 업데이트
        updateApprovalStatus(approval, isApprove);

        // 요청자에게 알림
        String msg = isApprove
                ? "[결재 승인] " + approval.getTitle() + (isDelegated ? " (대리 결재)" : "")
                : "[결재 반려] " + approval.getTitle();
        notificationRepository.save(Notification.builder()
                .user(approval.getRequester()).notifType("APPROVAL")
                .message(msg).targetUrl("/approvals/" + approvalId).build());

        // 대리 결재 시 원 결재자에게도 알림
        if (isDelegated) {
            notificationRepository.save(Notification.builder()
                    .user(approver).notifType("APPROVAL")
                    .message("[대리 결재 처리됨] " + approval.getTitle())
                    .targetUrl("/approvals/" + approvalId).build());
        }
    }

    private void updateApprovalStatus(Approval approval, boolean isApprove) {
        if (!isApprove) {
            approval.updateStatus(ApprovalStatus.REJECTED);
            return;
        }
        boolean allApproved = approval.getApprovalLines().stream()
                .allMatch(l -> l.getStatus() == ApprovalLineStatus.APPROVED);
        if (allApproved) {
            approval.updateStatus(ApprovalStatus.APPROVED);
        } else {
            approval.updateStatus(ApprovalStatus.IN_PROGRESS);
        }
    }

    @Transactional
    public void createDelegate(String empNo, ApprovalDelegateRequest request) {
        User delegator = findUserByEmpNo(empNo);
        User surrogate = findUserById(request.getSurrogateId());

        ApprovalDelegate delegate = ApprovalDelegate.builder()
                .delegator(delegator)
                .surrogate(surrogate)
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .build();
        approvalDelegateRepository.save(delegate);
    }

    @Transactional
    public void revokeDelegate(Long delegateId, String empNo) {
        User user = findUserByEmpNo(empNo);
        ApprovalDelegate delegate = approvalDelegateRepository.findById(delegateId)
                .orElseThrow(() -> new CustomException(ErrorCode.DELEGATE_NOT_FOUND));
        if (!delegate.getDelegator().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.PERMISSION_DENIED);
        }
        delegate.deactivate();
    }

    private Approval findById(Long id) {
        return approvalRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_NOT_FOUND));
    }

    private User findUserByEmpNo(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private User findUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private Scope findScopeById(Long id) {
        return scopeRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.SCOPE_NOT_FOUND));
    }
}
