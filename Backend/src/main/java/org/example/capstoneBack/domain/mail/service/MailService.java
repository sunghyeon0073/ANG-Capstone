package org.example.capstoneBack.domain.mail.service;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.exception.CustomException;
import org.example.capstoneBack.common.exception.ErrorCode;
import org.example.capstoneBack.domain.mail.dto.MailDto;
import org.example.capstoneBack.domain.mail.dto.MailSendRequest;
import org.example.capstoneBack.domain.mail.entity.Mail;
import org.example.capstoneBack.domain.mail.entity.MailReceiver;
import org.example.capstoneBack.domain.mail.repository.MailReceiverRepository;
import org.example.capstoneBack.domain.mail.repository.MailRepository;
import org.example.capstoneBack.domain.notification.entity.Notification;
import org.example.capstoneBack.domain.notification.repository.NotificationRepository;
import org.example.capstoneBack.domain.user.entity.User;
import org.example.capstoneBack.domain.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class MailService {

    private final MailRepository mailRepository;
    private final MailReceiverRepository mailReceiverRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;

    @Transactional
    public MailDto sendMail(String empNo, MailSendRequest request) {
        User sender = findUserByEmpNo(empNo);
        Mail mail = Mail.builder()
                .sender(sender)
                .title(request.getTitle())
                .content(request.getContent())
                .build();
        mailRepository.save(mail);

        List<MailReceiver> receivers = new ArrayList<>();

        addReceivers(mail, request.getReceiverIds(), "TO", receivers);
        if (request.getCcIds() != null) {
            addReceivers(mail, request.getCcIds(), "CC", receivers);
        }
        if (request.getBccIds() != null) {
            addReceivers(mail, request.getBccIds(), "BCC", receivers);
        }
        mailReceiverRepository.saveAll(receivers);

        // 수신자 알림
        receivers.stream()
                .filter(r -> "TO".equals(r.getReceiveType()) || "CC".equals(r.getReceiveType()))
                .forEach(r -> notificationRepository.save(Notification.builder()
                        .user(r.getReceiver()).notifType("MAIL")
                        .message("[메일] " + sender.getName() + " - " + mail.getTitle())
                        .targetUrl("/mail/" + mail.getMailId()).build()));

        return MailDto.from(mail);
    }

    @Transactional(readOnly = true)
    public List<MailDto> getInbox(String empNo) {
        User user = findUserByEmpNo(empNo);
        return mailReceiverRepository.findByReceiverUserIdAndIsDeletedFalse(user.getUserId())
                .stream()
                .map(mr -> {
                    MailDto dto = MailDto.from(mr.getMail());
                    return MailDto.builder()
                            .mailId(dto.getMailId())
                            .senderId(dto.getSenderId())
                            .senderName(dto.getSenderName())
                            .title(dto.getTitle())
                            .content(dto.getContent())
                            .createdAt(dto.getCreatedAt())
                            .isRead(mr.isRead())
                            .build();
                }).toList();
    }

    @Transactional(readOnly = true)
    public List<MailDto> getSentMails(String empNo) {
        User user = findUserByEmpNo(empNo);
        return mailRepository.findBySenderUserId(user.getUserId())
                .stream().map(MailDto::from).toList();
    }

    @Transactional
    public void readMail(Long mailId, String empNo) {
        User user = findUserByEmpNo(empNo);
        MailReceiver mr = mailReceiverRepository
                .findByMailMailIdAndReceiverUserId(mailId, user.getUserId())
                .orElseThrow(() -> new CustomException(ErrorCode.MAIL_NOT_FOUND));
        mr.markAsRead();
    }

    @Transactional
    public void deleteMail(Long mailId, String empNo) {
        User user = findUserByEmpNo(empNo);
        MailReceiver mr = mailReceiverRepository
                .findByMailMailIdAndReceiverUserId(mailId, user.getUserId())
                .orElseThrow(() -> new CustomException(ErrorCode.MAIL_NOT_FOUND));
        mr.delete();
    }

    private void addReceivers(Mail mail, List<Long> ids, String type, List<MailReceiver> list) {
        for (Long id : ids) {
            User receiver = userRepository.findById(id)
                    .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
            list.add(MailReceiver.builder()
                    .mail(mail).receiver(receiver).receiveType(type).build());
        }
    }

    private User findUserByEmpNo(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
