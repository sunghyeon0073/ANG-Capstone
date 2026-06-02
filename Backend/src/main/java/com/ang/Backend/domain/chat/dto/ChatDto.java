package com.ang.Backend.domain.chat.dto;

import com.ang.Backend.domain.chat.entity.ChatMessage;
import com.ang.Backend.domain.chat.entity.ChatRoom;
import com.ang.Backend.domain.user.entity.User;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

public class ChatDto {

    @Data
    public static class CreatePrivateRoomRequest {
        private String recipientEmpNo;
    }

    @Data
    public static class CreateGroupRoomRequest {
        private String name;
        private List<String> memberEmpNos;
    }

    @Data
    public static class InviteRequest {
        private List<String> empNos;
        private String name;  // PRIVATE→GROUP 전환 시 그룹명 (없으면 멤버 이름 자동 조합)
    }

    @Data
    public static class UpdateRoomNameRequest {
        private String name;  // null 또는 빈 문자열이면 기본 이름으로 초기화
    }

    @Data
    public static class SendMessageRequest {
        private Long roomId;
        private String content;
        private String fileUrl;
        private String fileName;
    }

    @Data
    @Builder
    public static class RoomSummary {
        private Long roomId;
        private String type;
        private String name;
        private String lastMessageContent;
        private LocalDateTime lastMessageAt;
        private String lastMessageSender;
        private long unreadCount;
        private List<MemberInfo> members;

        public static RoomSummary from(ChatRoom room, long unreadCount,
                                       List<MemberInfo> members, User me, String customName) {
            String displayName;
            if (customName != null && !customName.isBlank()) {
                displayName = customName;
            } else if (room.getType().name().equals("PRIVATE")) {
                displayName = members.stream()
                        .filter(m -> !m.getEmpNo().equals(me.getEmpNo()))
                        .map(MemberInfo::getName)
                        .findFirst()
                        .orElse(room.getName());
            } else {
                displayName = room.getName();
            }
            return RoomSummary.builder()
                    .roomId(room.getId())
                    .type(room.getType().name())
                    .name(displayName)
                    .lastMessageContent(room.getLastMessageContent())
                    .lastMessageAt(room.getLastMessageAt())
                    .lastMessageSender(room.getLastMessageSender())
                    .unreadCount(unreadCount)
                    .members(members)
                    .build();
        }
    }

    @Data
    @Builder
    public static class MessageResponse {
        private Long messageId;
        private Integer senderId;
        private String senderName;
        private String senderEmpNo;
        private String content;
        private String messageType;
        private String fileUrl;
        private String fileName;
        private LocalDateTime sentAt;

        public static MessageResponse from(ChatMessage msg) {
            return MessageResponse.builder()
                    .messageId(msg.getId())
                    .senderId(msg.getSender() != null ? msg.getSender().getUserId() : null)
                    .senderName(msg.getSender() != null ? msg.getSender().getName() : "시스템")
                    .senderEmpNo(msg.getSender() != null ? msg.getSender().getEmpNo() : null)
                    .content(msg.getContent())
                    .messageType(msg.getMessageType().name())
                    .fileUrl(msg.getFileUrl())
                    .fileName(msg.getFileName())
                    .sentAt(msg.getSentAt())
                    .build();
        }
    }

    @Data
    @Builder
    public static class MemberInfo {
        private Integer userId;
        private String name;
        private String empNo;
        private String profileImageUrl;

        public static MemberInfo from(User user) {
            return MemberInfo.builder()
                    .userId(user.getUserId())
                    .name(user.getName())
                    .empNo(user.getEmpNo())
                    .profileImageUrl(user.getProfileImageUrl())
                    .build();
        }
    }

    @Data
    @Builder
    public static class FileUploadResponse {
        private String fileUrl;
        private String fileName;
    }
}
