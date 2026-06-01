package com.ang.Backend.domain.mail.service;

import com.ang.Backend.common.enums.MailStatus;
import com.ang.Backend.common.enums.NotificationType;
import com.ang.Backend.common.enums.OwnerType;
import com.ang.Backend.common.response.PageResult;
import com.ang.Backend.domain.file.dto.FileDto;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.file.entity.FileItem;
import com.ang.Backend.domain.file.repository.FileItemRepository;
import com.ang.Backend.domain.file.service.S3FileService;
import com.ang.Backend.domain.mail.dto.MailDto;
import com.ang.Backend.domain.mail.entity.Mail;
import com.ang.Backend.domain.mail.entity.MailAttachment;
import com.ang.Backend.domain.mail.entity.MailRecipient;
import com.ang.Backend.domain.mail.repository.MailAttachmentRepository;
import com.ang.Backend.domain.mail.repository.MailRecipientRepository;
import com.ang.Backend.domain.mail.repository.MailRepository;
import com.ang.Backend.domain.notification.service.NotificationService;
import com.ang.Backend.domain.scope.repository.UserMembershipRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MailService {

    private final MailRepository mailRepository;
    private final MailRecipientRepository mailRecipientRepository;
    private final MailAttachmentRepository mailAttachmentRepository;
    private final UserRepository userRepository;
    private final S3FileService s3FileService;
    private final FileItemRepository fileItemRepository;
    private final UserMembershipRepository userMembershipRepository;
    private final NotificationService notificationService;

    // 메일 발송: Mail(SENT) + MailRecipient N개 생성 (새 파일 업로드 + 기존 uploads/ 파일 첨부 지원)
    @Transactional
    public Long send(MailDto.SendRequest req, User sender, List<MultipartFile> files) {
        List<Long> fileIds = req.getFileIds() != null ? req.getFileIds() : List.of();
        boolean hasAttachments = !files.isEmpty() || !fileIds.isEmpty();

        Mail mail = Mail.builder()
                .sender(sender)
                .title(req.getTitle())
                .body(req.getBody())
                .status(MailStatus.SENT)
                .sentAt(LocalDateTime.now())
                .build();
        mailRepository.save(mail);

        List<String> uploadedKeys = new ArrayList<>();
        try {
            if (hasAttachments) {
                // 새 파일 업로드
                for (MultipartFile file : files) {
                    String fileUrl = s3FileService.upload(file, "mail/" + mail.getMailId());
                    uploadedKeys.add(fileUrl);
                    mailAttachmentRepository.save(MailAttachment.builder()
                            .mail(mail)
                            .fileUrl(fileUrl)
                            .fileName(file.getOriginalFilename())
                            .build());
                }
                // 기존 uploads/ 파일 참조
                if (!fileIds.isEmpty()) {
                    Set<Integer> userScopeIds = userMembershipRepository.findByUser(sender)
                            .stream()
                            .map(m -> m.getScope().getScopeId())
                            .collect(Collectors.toSet());
                    for (Long fileId : fileIds) {
                        FileItem item = fileItemRepository.findById(fileId)
                                .orElseThrow(() -> new CustomException(ErrorCode.FILE_NOT_FOUND));
                        if (item.getOwnerType() == OwnerType.USER) {
                            if (item.getUploader() == null || !item.getUploader().getUserId().equals(sender.getUserId())) {
                                throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
                            }
                        } else if (item.getOwnerType() == OwnerType.SCOPE) {
                            if (!userScopeIds.contains(item.getOwnerId())) {
                                throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
                            }
                        }
                        mailAttachmentRepository.save(MailAttachment.builder()
                                .mail(mail)
                                .fileUrl(item.getFilePath())
                                .fileName(item.getOriginalFileName())
                                .build());
                    }
                }
            }

            saveRecipients(mail, req.getRecipientEmpNos());
            req.getRecipientEmpNos().forEach(empNo ->
                    userRepository.findByEmpNo(empNo).ifPresent(recipient ->
                            notificationService.send(recipient, NotificationType.MAIL,
                                    sender.getName() + "님이 메일을 발신했습니다.", mail.getTitle(), mail.getMailId())
                    )
            );
            log.info("Mail sent by {} to {} recipients", sender.getEmpNo(), req.getRecipientEmpNos().size());
            return mail.getMailId();
        } catch (Exception e) {
            uploadedKeys.forEach(key -> {
                try { s3FileService.delete(key); } catch (Exception ignored) {}
            });
            throw e;
        }
    }

    // 임시저장: status=DRAFT, sentAt=null
    @Transactional
    public Long saveDraft(MailDto.DraftRequest req, User sender) {
        Mail mail = Mail.builder()
                .sender(sender)
                .title(req.getTitle() != null ? req.getTitle() : "")
                .body(req.getBody())
                .status(MailStatus.DRAFT)
                .build();
        mailRepository.save(mail);

        if (req.getRecipientEmpNos() != null && !req.getRecipientEmpNos().isEmpty()) {
            saveRecipients(mail, req.getRecipientEmpNos());
        }
        return mail.getMailId();
    }

    // 수신함 목록 (삭제되지 않은 것)
    public PageResult<MailDto.MailSummary> getInbox(User user, int page, int size) {
        return PageResult.of(
                mailRecipientRepository.findByRecipientAndDeletedAtIsNull(
                                user, PageRequest.of(page, size, Sort.by("mail.sentAt").descending()))
                        .map(MailDto.MailSummary::fromRecipient)
        );
    }

    // 발신함 목록 (SENT + CANCELLED, 발신자 삭제 안 된 것)
    public PageResult<MailDto.MailSummary> getSent(User user, int page, int size) {
        return PageResult.of(
                mailRepository.findBySenderAndSenderDeletedAtIsNullAndStatusIn(
                                user, List.of(MailStatus.SENT, MailStatus.CANCELLED),
                                PageRequest.of(page, size, Sort.by("sentAt").descending()))
                        .map(MailDto.MailSummary::fromMail)
        );
    }

    // 임시저장 목록
    public PageResult<MailDto.MailSummary> getDrafts(User user, int page, int size) {
        return PageResult.of(
                mailRepository.findBySenderAndStatus(
                                user, MailStatus.DRAFT,
                                PageRequest.of(page, size, Sort.by("createdAt").descending()))
                        .map(MailDto.MailSummary::fromMail)
        );
    }

    // 메일 상세 조회 + 수신자이면 읽음 처리
    @Transactional
    public MailDto.MailDetail getDetail(Long mailId, User user) {
        Mail mail = findMailById(mailId);
        List<MailRecipient> recipients = mailRecipientRepository.findByMail(mail);

        // 발신자 또는 수신자인지 접근 권한 확인
        boolean isSender = mail.getSender().getUserId().equals(user.getUserId());
        boolean isRecipient = recipients.stream()
                .anyMatch(r -> r.getRecipient().getUserId().equals(user.getUserId()));

        if (!isSender && !isRecipient) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }

        // 수신자라면 읽음 처리 + 알림 삭제
        if (isRecipient) {
            recipients.stream()
                    .filter(r -> r.getRecipient().getUserId().equals(user.getUserId()))
                    .findFirst()
                    .ifPresent(MailRecipient::markAsRead);
            notificationService.deleteByTarget(user, mailId, NotificationType.MAIL);
        }

        List<MailAttachment> attachments = mailAttachmentRepository.findByMail(mail);
        return MailDto.MailDetail.fromMail(mail, recipients, attachments);
    }

    // 수신함에서 삭제 (수신자 소프트 삭제)
    @Transactional
    public void deleteFromInbox(Long mailId, User user) {
        Mail mail = findMailById(mailId);
        MailRecipient mr = mailRecipientRepository.findByMailAndRecipient(mail, user)
                .orElseThrow(() -> new CustomException(ErrorCode.MAIL_ACCESS_DENIED));
        mr.setDeletedAt(LocalDateTime.now());
    }

    // 발신함에서 삭제 (발신자 소프트 삭제)
    @Transactional
    public void deleteFromSent(Long mailId, User user) {
        Mail mail = findMailById(mailId);
        if (!mail.getSender().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }
        mail.setSenderDeletedAt(LocalDateTime.now());
    }

    // 발송 취소: 아무도 읽지 않은 경우에만 가능
    @Transactional
    public void cancel(Long mailId, User user) {
        Mail mail = findMailById(mailId);

        if (!mail.getSender().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }
        if (mail.getStatus() != MailStatus.SENT) {
            throw new CustomException(ErrorCode.MAIL_CANCEL_DENIED);
        }
        // 한 명이라도 읽었으면 취소 불가
        if (mailRecipientRepository.existsByMailAndReadAtIsNotNull(mail)) {
            throw new CustomException(ErrorCode.MAIL_CANCEL_DENIED);
        }

        mail.setStatus(MailStatus.CANCELLED);
        mail.setCancelledAt(LocalDateTime.now());
        log.info("Mail {} cancelled by sender {}", mailId, user.getEmpNo());
    }

    // 수신 확인 목록 (발신자 전용)
    public List<MailDto.ReadStatusItem> getReadStatus(Long mailId, User user) {
        Mail mail = findMailById(mailId);
        if (!mail.getSender().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }
        return mailRecipientRepository.findByMail(mail)
                .stream()
                .map(MailDto.ReadStatusItem::from)
                .toList();
    }

    // 수신 즐겨찾기 토글
    @Transactional
    public boolean toggleInboxFavorite(Long mailId, User user) {
        Mail mail = findMailById(mailId);
        MailRecipient mr = mailRecipientRepository.findByMailAndRecipient(mail, user)
                .orElseThrow(() -> new CustomException(ErrorCode.MAIL_ACCESS_DENIED));
        mr.setFavorite(!mr.isFavorite());
        return mr.isFavorite();
    }

    // 발신 즐겨찾기 토글
    @Transactional
    public boolean toggleSentFavorite(Long mailId, User user) {
        Mail mail = findMailById(mailId);
        if (!mail.getSender().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }
        mail.setSenderFavorite(!mail.isSenderFavorite());
        return mail.isSenderFavorite();
    }

    // 즐겨찾기 통합 목록 (수신 즐겨찾기 + 발신 즐겨찾기 - in-memory 페이징)
    public PageResult<MailDto.MailSummary> getFavorites(User user, int page, int size) {
        List<MailDto.MailSummary> all = Stream.concat(
                mailRecipientRepository.findByRecipientAndIsFavoriteTrueAndDeletedAtIsNull(user)
                        .stream().map(MailDto.MailSummary::fromRecipient),
                mailRepository.findBySenderAndIsSenderFavoriteTrueAndSenderDeletedAtIsNull(user)
                        .stream().map(MailDto.MailSummary::fromMail)
        ).sorted(Comparator.comparing(MailDto.MailSummary::getSentAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        int total = all.size();
        int from = page * size;
        int to = Math.min(from + size, total);
        List<MailDto.MailSummary> content = from >= total ? List.of() : all.subList(from, to);
        int totalPages = total == 0 ? 1 : (int) Math.ceil((double) total / size);

        return PageResult.<MailDto.MailSummary>builder()
                .content(content)
                .page(page)
                .size(size)
                .totalElements(total)
                .totalPages(totalPages)
                .hasNext(to < total)
                .build();
    }

    // 수신 휴지통 목록
    public PageResult<MailDto.MailSummary> getInboxTrash(User user, int page, int size) {
        return PageResult.of(
                mailRecipientRepository.findByRecipientAndDeletedAtIsNotNull(
                                user, PageRequest.of(page, size, Sort.by("mail.sentAt").descending()))
                        .map(MailDto.MailSummary::fromRecipient)
        );
    }

    // 발신 휴지통 목록
    public PageResult<MailDto.MailSummary> getSentTrash(User user, int page, int size) {
        return PageResult.of(
                mailRepository.findBySenderAndSenderDeletedAtIsNotNullAndStatusIn(
                                user, List.of(MailStatus.SENT, MailStatus.CANCELLED),
                                PageRequest.of(page, size, Sort.by("sentAt").descending()))
                        .map(MailDto.MailSummary::fromMail)
        );
    }

    // 수신 휴지통에서 복원
    @Transactional
    public void restoreFromInboxTrash(Long mailId, User user) {
        Mail mail = findMailById(mailId);
        MailRecipient mr = mailRecipientRepository.findByMailAndRecipient(mail, user)
                .orElseThrow(() -> new CustomException(ErrorCode.MAIL_ACCESS_DENIED));
        mr.setDeletedAt(null);
    }


    // 발신 휴지통에서 복원
    @Transactional
    public void restoreFromSentTrash(Long mailId, User user) {
        Mail mail = findMailById(mailId);
        if (!mail.getSender().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }
        mail.setSenderDeletedAt(null);
    }

    // 수신 휴지통 완전 삭제 (MailRecipient 물리 삭제)
    @Transactional
    public void permanentDeleteFromInboxTrash(Long mailId, User user) {
        Mail mail = findMailById(mailId);
        MailRecipient mr = mailRecipientRepository.findByMailAndRecipient(mail, user)
                .orElseThrow(() -> new CustomException(ErrorCode.MAIL_ACCESS_DENIED));
        if (mr.getDeletedAt() == null) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }
        mailRecipientRepository.delete(mr);
        log.info("Mail {} permanently deleted from inbox trash by user {}", mailId, user.getEmpNo());
    }

    // 발신 휴지통 완전 삭제 (Mail + MailRecipient + S3 파일 모두 물리 삭제)
    @Transactional
    public void permanentDeleteFromSentTrash(Long mailId, User user) {
        Mail mail = findMailById(mailId);
        if (!mail.getSender().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }
        if (mail.getSenderDeletedAt() == null) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }
        List<MailAttachment> attachments = mailAttachmentRepository.findByMail(mail);
        for (MailAttachment att : attachments) {
            s3FileService.delete(att.getFileUrl());
        }
        mailAttachmentRepository.deleteAll(attachments);
        mailRecipientRepository.deleteAll(mailRecipientRepository.findByMail(mail));
        mailRepository.delete(mail);
        log.info("Mail {} permanently deleted from sent trash by sender {}", mailId, user.getEmpNo());
    }

    // 임시저장 삭제 (작성자 본인만, DB에서 완전 삭제)
    @Transactional
    public void deleteDraft(Long mailId, User user) {
        Mail mail = findMailById(mailId);
        if (!mail.getSender().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }
        if (mail.getStatus() != MailStatus.DRAFT) {
            throw new CustomException(ErrorCode.MAIL_CANCEL_DENIED);
        }
        List<MailAttachment> attachments = mailAttachmentRepository.findByMail(mail);
        for (MailAttachment att : attachments) {
            s3FileService.delete(att.getFileUrl());
        }
        mailAttachmentRepository.deleteAll(attachments);
        mailRecipientRepository.deleteAll(mailRecipientRepository.findByMail(mail));
        mailRepository.delete(mail);


    }

    // 파일 다운로드
    @Transactional(readOnly = true)
    public MailDto.FileDownloadData downloadFile(Long attachmentId, User user) {
        MailAttachment attachment = mailAttachmentRepository.findById(attachmentId)
                .orElseThrow(() -> new CustomException(ErrorCode.MAIL_NOT_FOUND));
        Mail mail = attachment.getMail();

        boolean isSender = mail.getSender().getUserId().equals(user.getUserId());
        boolean isRecipient = mailRecipientRepository.findByMail(mail).stream()
                .anyMatch(r -> r.getRecipient().getUserId().equals(user.getUserId()));

        if (!isSender && !isRecipient) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }

        byte[] bytes = s3FileService.download(attachment.getFileUrl());
        return new MailDto.FileDownloadData(attachment.getFileName(), bytes);
    }

    // 파일 업로드 (S3 저장 후 MailAttachment 생성)
    @Transactional
    public MailDto.FileUploadResponse uploadFile(Long mailId, MultipartFile file, User user) {
        Mail mail = findMailById(mailId);
        if (!mail.getSender().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }
        if (mail.getStatus() != MailStatus.DRAFT) {
            throw new CustomException(ErrorCode.MAIL_NOT_DRAFT);
        }
        String fileUrl = s3FileService.upload(file, "mail/" + mailId);
        MailAttachment attachment = mailAttachmentRepository.save(MailAttachment.builder()
                .mail(mail)
                .fileUrl(fileUrl)
                .fileName(file.getOriginalFilename())
                .build());
        return MailDto.FileUploadResponse.from(attachment);
    }

    // 임시저장 수정
    @Transactional
    public Long updateDraft(Long mailId, MailDto.UpdateDraftRequest req, User user) {
        Mail mail = findMailById(mailId);
        if (!mail.getSender().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }
        if (mail.getStatus() != MailStatus.DRAFT) {
            throw new CustomException(ErrorCode.MAIL_NOT_DRAFT);
        }
        mail.setTitle(req.getTitle() != null ? req.getTitle() : "");
        mail.setBody(req.getBody());

        mailRecipientRepository.deleteAll(mailRecipientRepository.findByMail(mail));
        if (req.getRecipientEmpNos() != null && !req.getRecipientEmpNos().isEmpty()) {
            saveRecipients(mail, req.getRecipientEmpNos());
        }
        return mail.getMailId();
    }

    // 임시저장에서 발송
    @Transactional
    public Long sendDraft(Long mailId, User user) {
        Mail mail = findMailById(mailId);
        if (!mail.getSender().getUserId().equals(user.getUserId())) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }
        if (mail.getStatus() != MailStatus.DRAFT) {
            throw new CustomException(ErrorCode.MAIL_NOT_DRAFT);
        }
        List<MailRecipient> recipients = mailRecipientRepository.findByMail(mail);
        if (recipients.isEmpty()) {
            throw new CustomException(ErrorCode.MAIL_NO_RECIPIENT);
        }
        mail.setStatus(MailStatus.SENT);
        mail.setSentAt(LocalDateTime.now());
        recipients.forEach(mr ->
                notificationService.send(mr.getRecipient(), NotificationType.MAIL,
                        mail.getSender().getName() + "님이 메일을 발신했습니다.", mail.getTitle(), mail.getMailId())
        );
        return mail.getMailId();
    }

    // 답장
    @Transactional
    public Long reply(Long mailId, MailDto.ReplyRequest req, User user) {
        Mail original = findMailById(mailId);
        List<MailRecipient> recipients = mailRecipientRepository.findByMail(original);

        boolean isRecipient = recipients.stream()
                .anyMatch(r -> r.getRecipient().getUserId().equals(user.getUserId()));
        if (!isRecipient) {
            throw new CustomException(ErrorCode.MAIL_ACCESS_DENIED);
        }

        String replyTitle = original.getTitle().startsWith("Re: ")
                ? original.getTitle()
                : "Re: " + original.getTitle();

        Mail reply = Mail.builder()
                .sender(user)
                .title(replyTitle)
                .body(req.getBody())
                .status(MailStatus.SENT)
                .sentAt(LocalDateTime.now())
                .build();
        mailRepository.save(reply);
        saveRecipients(reply, List.of(original.getSender().getEmpNo()));
        return reply.getMailId();
    }

    // 메일 작성 시 첨부 가능한 파일 목록 (본인 파일 + 소속 scope 공유 파일)
    public List<FileDto> getAttachableFiles(User user) {
        List<FileItem> myFiles = fileItemRepository
                .findByOwnerTypeAndOwnerIdAndDeletedAtIsNull(OwnerType.USER, user.getUserId());

        List<Integer> scopeIds = userMembershipRepository.findByUser(user)
                .stream()
                .map(m -> m.getScope().getScopeId())
                .toList();

        List<FileItem> scopeFiles = scopeIds.isEmpty() ? List.of()
                : fileItemRepository.findByOwnerTypeAndOwnerIdInAndDeletedAtIsNull(OwnerType.SCOPE, scopeIds);

        return Stream.concat(myFiles.stream(), scopeFiles.stream())
                .map(FileDto::from)
                .toList();
    }

    // 수신자 저장 공통 로직
    private void saveRecipients(Mail mail, List<String> empNos) {
        for (String empNo : empNos) {
            User recipient = userRepository.findByEmpNo(empNo)
                    .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
            mailRecipientRepository.save(MailRecipient.builder()
                    .mail(mail)
                    .recipient(recipient)
                    .build());
        }
    }

    private Mail findMailById(Long mailId) {
        return mailRepository.findById(mailId)
                .orElseThrow(() -> new CustomException(ErrorCode.MAIL_NOT_FOUND));
    }
}

