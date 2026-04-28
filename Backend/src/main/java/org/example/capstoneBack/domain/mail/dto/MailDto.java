package org.example.capstoneBack.domain.mail.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import org.example.capstoneBack.domain.mail.entity.Mail;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class MailDto {

    private Long mailId;
    private Long senderId;
    private String senderName;
    private String title;
    private String content;
    private LocalDateTime createdAt;
    private boolean isRead;

    public static MailDto from(Mail mail) {
        return MailDto.builder()
                .mailId(mail.getMailId())
                .senderId(mail.getSender().getUserId())
                .senderName(mail.getSender().getName())
                .title(mail.getTitle())
                .content(mail.getContent())
                .createdAt(mail.getCreatedAt())
                .build();
    }
}
