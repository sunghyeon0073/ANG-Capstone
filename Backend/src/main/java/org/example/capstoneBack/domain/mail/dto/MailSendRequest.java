package org.example.capstoneBack.domain.mail.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
public class MailSendRequest {

    @NotNull(message = "수신자를 선택하세요.")
    private List<Long> receiverIds;

    private List<Long> ccIds;
    private List<Long> bccIds;

    @NotBlank(message = "제목을 입력하세요.")
    private String title;

    @NotBlank(message = "내용을 입력하세요.")
    private String content;
}
