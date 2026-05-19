package com.ang.Backend.domain.mail.service;

import com.ang.Backend.common.enums.MailStatus;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.mail.dto.MailDto;
import com.ang.Backend.domain.mail.entity.Mail;
import com.ang.Backend.domain.mail.entity.MailRecipient;
import com.ang.Backend.domain.mail.repository.MailRecipientRepository;
import com.ang.Backend.domain.mail.repository.MailRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MailService {

    private final MailRepository mailRepository;
    private final MailRecipientRepository mailRecipientRepository;
    private final UserRepository userRepository;

    // 메일 발송: Mail(SENT) + MailRecipient N개 생성
    @Transactional
    public Long send(MailDto.SendRequest req, User sender) {
        Mail mail = Mail.builder()
                .sender(sender)
                .title(req.getTitle())
                .body(req.getBody())
                .status(MailStatus.SENT)
                .sentAt(LocalDateTime.now())
                .build();
        mailRepository.save(mail);

        saveRecipients(mail, req.getRecipientEmpNos());
        log.info("Mail sent by {} to {} recipients", sender.getEmpNo(), req.getRecipientEmpNos().size());
        return mail.getMailId();
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
    public List<MailDto.MailSummary> getInbox(User user) {
        return mailRecipientRepository.findByRecipientAndDeletedAtIsNull(user)
                .stream()
                .map(MailDto.MailSummary::fromRecipient)
                .toList();
    }

    // 발신함 목록 (SENT + CANCELLED, 발신자 삭제 안 된 것)
    public List<MailDto.MailSummary> getSent(User user) {
        return mailRepository.findBySenderAndSenderDeletedAtIsNullAndStatusIn(
                        user, List.of(MailStatus.SENT, MailStatus.CANCELLED))
                .stream()
                .map(MailDto.MailSummary::fromMail)
                .toList();
    }

    // 임시저장 목록
    public List<MailDto.MailSummary> getDrafts(User user) {
        return mailRepository.findBySenderAndStatus(user, MailStatus.DRAFT)
                .stream()
                .map(MailDto.MailSummary::fromMail)
                .toList();
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

        // 수신자라면 읽음 처리
        if (isRecipient) {
            recipients.stream()
                    .filter(r -> r.getRecipient().getUserId().equals(user.getUserId()))
                    .findFirst()
                    .ifPresent(MailRecipient::markAsRead);
        }

        return MailDto.MailDetail.fromMail(mail, recipients);
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
