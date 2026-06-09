package com.ang.Backend.domain.aiassistant.dto;

import com.ang.Backend.domain.aiassistant.entity.ScheduledAction;
import com.ang.Backend.domain.aiassistant.entity.ScheduledActionChannel;
import com.ang.Backend.domain.aiassistant.entity.ScheduledActionStatus;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

public class AiAssistantDto {

    @Getter
    @Setter
    @NoArgsConstructor
    public static class PromptRequest {
        private String prompt;
        private boolean confirm;
    }

    @Getter
    @Builder
    public static class ScheduleResponse {
        private Long id;
        private ScheduledActionChannel channel;
        private ScheduledActionStatus status;
        private LocalDateTime scheduledAt;
        private Long chatRoomId;
        private String title;
        private String message;
        private List<String> recipientEmpNos;
        private List<String> recipientNames;
        private List<Long> fileIds;
        private List<String> missingFields;
        private String preview;
        private String errorMessage;

        public static ScheduleResponse from(ScheduledAction action, List<String> empNos, List<String> names, List<Long> fileIds) {
            return ScheduleResponse.builder()
                    .id(action.getId())
                    .channel(action.getChannel())
                    .status(action.getStatus())
                    .scheduledAt(action.getScheduledAt())
                    .chatRoomId(action.getChatRoomId())
                    .title(action.getTitle())
                    .message(action.getMessage())
                    .recipientEmpNos(empNos)
                    .recipientNames(names)
                    .fileIds(fileIds)
                    .missingFields(List.of())
                    .preview(buildPreview(action.getChannel(), names, action.getScheduledAt(), action.getTitle(), action.getMessage()))
                    .errorMessage(action.getErrorMessage())
                    .build();
        }

        public static String buildPreview(ScheduledActionChannel channel, List<String> names, LocalDateTime scheduledAt, String title, String message) {
            String target = names == null || names.isEmpty() ? "대상 미지정" : String.join(", ", names);
            String kind = channel == ScheduledActionChannel.MAIL ? "메일" : "채팅";
            String subject = title == null || title.isBlank() ? "" : " [" + title + "]";
            return scheduledAt + "에 " + target + "에게 " + kind + subject + " 예약: " + message;
        }
    }
}
