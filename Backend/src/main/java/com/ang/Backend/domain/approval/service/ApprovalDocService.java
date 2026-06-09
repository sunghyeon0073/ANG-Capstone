package com.ang.Backend.domain.approval.service;

import com.ang.Backend.common.enums.ApprovalLineStatus;
import com.ang.Backend.common.enums.ApprovalLineType;
import com.ang.Backend.common.enums.ApprovalStatus;
import com.ang.Backend.common.enums.NotificationType;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.common.response.PageResult;
import com.ang.Backend.domain.approval.dto.ApprovalActionDto;
import com.ang.Backend.domain.approval.dto.ApprovalDocDto;
import com.ang.Backend.domain.approval.dto.ApprovalLineDto;
import com.ang.Backend.domain.approval.entity.ApprovalDoc;
import com.ang.Backend.domain.approval.entity.ApprovalLine;
import com.ang.Backend.domain.approval.entity.ApprovalTemplate;
import com.ang.Backend.domain.approval.event.ApprovalCompletedEvent;
import com.ang.Backend.domain.approval.repository.ApprovalDocRepository;
import com.ang.Backend.domain.approval.repository.ApprovalLineRepository;
import com.ang.Backend.domain.approval.repository.ApprovalTemplateRepository;
import com.ang.Backend.domain.notification.service.NotificationService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ApprovalDocService {

    private final ApprovalDocRepository docRepository;
    private final ApprovalLineRepository lineRepository;
    private final ApprovalTemplateRepository templateRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    private final ApplicationEventPublisher eventPublisher;
    private final S3Client s3Client;

    @Value("${spring.cloud.aws.s3.bucket}")
    private String bucket;

    @Value("${spring.cloud.aws.region.static}")
    private String region;

    @Transactional
    public ApprovalDocDto.Response create(ApprovalDocDto.CreateRequest req, User drafter) {
        ApprovalTemplate template = null;
        if (req.getTemplateId() != null) {
            template = templateRepository.findById(req.getTemplateId())
                    .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_TEMPLATE_NOT_FOUND));
        }

        ApprovalStatus initStatus = req.isSubmitNow() ? ApprovalStatus.IN_PROGRESS : ApprovalStatus.DRAFT;

        ApprovalDoc doc = ApprovalDoc.builder()
                .template(template)
                .drafter(drafter)
                .title(req.getTitle())
                .formData(req.getFormData())
                .attachmentUrl(req.getAttachmentUrl())
                .status(initStatus)
                .securityLevel(req.getSecurityLevel() != null ? req.getSecurityLevel() : "일반문서")
                .retentionPeriod(req.getRetentionPeriod() != null ? req.getRetentionPeriod() : "영구")
                .build();
        docRepository.save(doc);

        if (req.getApprovalLines() != null && !req.getApprovalLines().isEmpty()) {
            buildApprovalLines(doc, req.getApprovalLines(), req.isSubmitNow());
        }

        return ApprovalDocDto.Response.from(doc);
    }

    public ApprovalDocDto.Response getDoc(Long docId, User user) {
        ApprovalDoc doc = findDocAndCheckAccess(docId, user);
        return ApprovalDocDto.Response.from(doc);
    }

    @Transactional
    public ApprovalDocDto.Response update(Long docId, ApprovalDocDto.UpdateRequest req, User user) {
        ApprovalDoc doc = docRepository.findById(docId)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_DOC_NOT_FOUND));
        if (!doc.getDrafter().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        if (doc.getStatus() != ApprovalStatus.DRAFT) {
            throw new CustomException(ErrorCode.APPROVAL_NOT_MODIFIABLE);
        }

        doc.setTitle(req.getTitle());
        doc.setFormData(req.getFormData());
        if (req.getAttachmentUrl() != null) doc.setAttachmentUrl(req.getAttachmentUrl());
        if (req.getSecurityLevel() != null) doc.setSecurityLevel(req.getSecurityLevel());
        if (req.getRetentionPeriod() != null) doc.setRetentionPeriod(req.getRetentionPeriod());

        if (req.getApprovalLines() != null) {
            doc.getApprovalLines().clear();
            buildApprovalLines(doc, req.getApprovalLines(), req.isSubmitNow());
        }

        if (req.isSubmitNow()) {
            doc.setStatus(ApprovalStatus.IN_PROGRESS);
        }

        return ApprovalDocDto.Response.from(doc);
    }

    @Transactional
    public void cancel(Long docId, User user) {
        ApprovalDoc doc = docRepository.findById(docId)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_DOC_NOT_FOUND));
        if (!doc.getDrafter().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        if (doc.getStatus() != ApprovalStatus.DRAFT && doc.getStatus() != ApprovalStatus.IN_PROGRESS) {
            throw new CustomException(ErrorCode.APPROVAL_NOT_CANCELLABLE);
        }
        // 승인 또는 대결 진행 중이면 회수 불가
        if (doc.getStatus() == ApprovalStatus.IN_PROGRESS) {
            boolean hasProgress = doc.getApprovalLines().stream()
                    .anyMatch(al -> al.getStatus() == ApprovalLineStatus.APPROVED
                               || al.getStatus() == ApprovalLineStatus.DELEGATED);
            if (hasProgress) {
                throw new CustomException(ErrorCode.APPROVAL_NOT_CANCELLABLE);
            }
        }
        doc.setStatus(ApprovalStatus.CANCELLED);
    }

    // ─── 결재 액션 ────────────────────────────────────────────────────────────

    @Transactional
    public void approve(Long docId, ApprovalActionDto.ApproveRequest req, User requester) {
        ApprovalDoc doc = docRepository.findById(docId)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_DOC_NOT_FOUND));

        ApprovalLine currentLine = lineRepository
                .findActiveLineByDocAndUser(docId, requester.getUserId(), ApprovalLineStatus.ACTIVE)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_NOT_YOUR_TURN));

        // 서명 스냅샷 + 승인 처리
        currentLine.setStatus(ApprovalLineStatus.APPROVED);
        currentLine.setComment(req.getComment());
        currentLine.setSignatureSnapshot(requester.getSignatureImageUrl());
        currentLine.setProcessedAt(LocalDateTime.now());

        // 다음 WAITING 결재선 활성화
        List<ApprovalLine> nextWaiting = lineRepository.findNextWaitingLines(
                doc, ApprovalLineStatus.WAITING, List.of(ApprovalLineType.APPROVAL, ApprovalLineType.AGREEMENT));
        if (!nextWaiting.isEmpty()) {
            ApprovalLine nextLine = nextWaiting.get(0);
            nextLine.setStatus(ApprovalLineStatus.ACTIVE);
            // 다음 결재자 알림
            User nextApprover = nextLine.getApprover();
            notificationService.send(nextApprover, NotificationType.APPROVAL,
                    "결재 요청", "[" + doc.getTitle() + "] 결재가 요청되었습니다.", doc.getId());
        } else {
            // 마지막 결재자 승인 → 최종 완료
            doc.setStatus(ApprovalStatus.APPROVED);
            doc.setCompletedAt(LocalDateTime.now());
            // AFTER_COMMIT 이벤트 발행 → ApprovalPdfService 비동기 실행
            eventPublisher.publishEvent(new ApprovalCompletedEvent(docId));
        }

        // 기안자 진행 상황 알림
        notificationService.send(doc.getDrafter(), NotificationType.APPROVAL,
                "결재 진행", "[" + doc.getTitle() + "] " + requester.getName() + "님이 승인하였습니다.", doc.getId());
    }

    @Transactional
    public void reject(Long docId, ApprovalActionDto.RejectRequest req, User requester) {
        ApprovalDoc doc = docRepository.findById(docId)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_DOC_NOT_FOUND));

        ApprovalLine currentLine = lineRepository
                .findActiveLineByDocAndUser(docId, requester.getUserId(), ApprovalLineStatus.ACTIVE)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_NOT_YOUR_TURN));

        currentLine.setStatus(ApprovalLineStatus.REJECTED);
        currentLine.setComment(req.getReason());
        currentLine.setProcessedAt(LocalDateTime.now());

        doc.setStatus(ApprovalStatus.REJECTED);

        // 기안자에게 반려 알림
        notificationService.send(doc.getDrafter(), NotificationType.APPROVAL,
                "결재 반려",
                "[" + doc.getTitle() + "] " + requester.getName() + "님이 반려하였습니다. 사유: " + req.getReason(),
                doc.getId());
    }

    @Transactional
    public void delegate(Long docId, ApprovalActionDto.DelegateRequest req, User requester) {
        ApprovalDoc doc = docRepository.findById(docId)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_DOC_NOT_FOUND));

        ApprovalLine currentLine = lineRepository
                .findActiveLineByDocAndUser(docId, requester.getUserId(), ApprovalLineStatus.ACTIVE)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_NOT_YOUR_TURN));

        User delegatee = userRepository.findById(req.getDelegateeId())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        // 기존 라인 DELEGATED 처리
        currentLine.setStatus(ApprovalLineStatus.DELEGATED);
        currentLine.setDelegatee(delegatee);
        currentLine.setComment(req.getComment());
        currentLine.setProcessedAt(LocalDateTime.now());

        // 대결자용 새 라인 삽입 (같은 lineOrder)
        ApprovalLine delegateLine = ApprovalLine.builder()
                .doc(doc)
                .approver(delegatee)
                .lineOrder(currentLine.getLineOrder())
                .lineType(currentLine.getLineType())
                .status(ApprovalLineStatus.ACTIVE)
                .build();
        lineRepository.save(delegateLine);

        // 대결자 알림
        notificationService.send(delegatee, NotificationType.APPROVAL,
                "대결 요청",
                "[" + doc.getTitle() + "] " + requester.getName() + "님이 대결을 요청하였습니다.",
                doc.getId());
    }

    // ─── 통합 검색 ────────────────────────────────────────────────────────────

    public PageResult<ApprovalDocDto.BoxResponse> search(User user, String keyword, ApprovalStatus status, int page, int size) {
        return PageResult.of(
                docRepository.search(user.getUserId(), keyword, status,
                        PageRequest.of(page, size, Sort.by("createdAt").descending()))
                        .map(ApprovalDocDto.BoxResponse::from)
        );
    }

    // PDF URL 반환 (최종 승인 완료 문서만)
    public String getPdfUrl(Long docId, User user) {
        ApprovalDoc doc = findDocAndCheckAccess(docId, user);
        if (doc.getFinalPdfUrl() == null) {
            throw new CustomException(ErrorCode.FILE_NOT_FOUND);
        }
        return doc.getFinalPdfUrl();
    }

    // ─── 내부 헬퍼 ────────────────────────────────────────────────────────────

    private void buildApprovalLines(ApprovalDoc doc, List<ApprovalLineDto.Request> lineRequests, boolean submitNow) {
        boolean firstActivatable = submitNow;
        boolean firstSet = false;

        List<ApprovalLineDto.Request> sorted = lineRequests.stream()
                .sorted((a, b) -> Integer.compare(a.getLineOrder(), b.getLineOrder()))
                .collect(Collectors.toList());

        for (ApprovalLineDto.Request lineReq : sorted) {
            User approver = userRepository.findById(lineReq.getApproverId())
                    .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

            boolean isActionable = lineReq.getLineType() == ApprovalLineType.APPROVAL
                    || lineReq.getLineType() == ApprovalLineType.AGREEMENT;

            ApprovalLineStatus initStatus;
            if (isActionable && firstActivatable && !firstSet) {
                initStatus = ApprovalLineStatus.ACTIVE;
                firstSet = true;
            } else {
                initStatus = ApprovalLineStatus.WAITING;
            }

            ApprovalLine line = ApprovalLine.builder()
                    .doc(doc)
                    .approver(approver)
                    .lineOrder(lineReq.getLineOrder())
                    .lineType(lineReq.getLineType())
                    .status(initStatus)
                    .build();
            doc.getApprovalLines().add(line);
        }

        // 1순위 결재자에게 알림
        if (submitNow) {
            doc.getApprovalLines().stream()
                    .filter(al -> al.getStatus() == ApprovalLineStatus.ACTIVE)
                    .findFirst()
                    .ifPresent(al -> notificationService.send(al.getApprover(), NotificationType.APPROVAL,
                            "결재 요청", "[" + doc.getTitle() + "] 결재가 요청되었습니다.", doc.getId()));
        }
    }

    @Transactional
    public String uploadAttachment(Long docId, MultipartFile file, User user) {
        ApprovalDoc doc = docRepository.findById(docId)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_DOC_NOT_FOUND));
        if (!doc.getDrafter().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        if (doc.getStatus() != ApprovalStatus.DRAFT) {
            throw new CustomException(ErrorCode.APPROVAL_NOT_MODIFIABLE);
        }

        String originalFilename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "attachment";
        String ext = originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : "";
        String key = "e-approval/attachments/" + docId + "/" + java.util.UUID.randomUUID() + ext;

        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucket)
                            .key(key)
                            .contentType(file.getContentType() != null ? file.getContentType() : "application/octet-stream")
                            .build(),
                    RequestBody.fromBytes(file.getBytes())
            );
        } catch (IOException e) {
            throw new CustomException(ErrorCode.FILE_UPLOAD_FAILED);
        }

        String url = "https://" + bucket + ".s3." + region + ".amazonaws.com/" + key;
        doc.setAttachmentUrl(url);
        return url;
    }

    public ApprovalDoc findDocAndCheckAccess(Long docId, User user) {
        ApprovalDoc doc = docRepository.findById(docId)
                .orElseThrow(() -> new CustomException(ErrorCode.APPROVAL_DOC_NOT_FOUND));

        boolean isDrafter = doc.getDrafter().getUserId().equals(user.getUserId());
        boolean isParticipant = doc.getApprovalLines().stream()
                .anyMatch(al -> al.getApprover().getUserId().equals(user.getUserId()) ||
                               (al.getDelegatee() != null && al.getDelegatee().getUserId().equals(user.getUserId())));

        if (!isDrafter && !isParticipant) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        return doc;
    }
}
