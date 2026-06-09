package com.ang.Backend.domain.aiassistant.service;

import com.ang.Backend.common.enums.ChatRoomType;
import com.ang.Backend.common.enums.NotificationType;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.aiassistant.dto.AiAssistantDto;
import com.ang.Backend.domain.aiassistant.entity.ScheduledAction;
import com.ang.Backend.domain.aiassistant.entity.ScheduledActionChannel;
import com.ang.Backend.domain.aiassistant.entity.ScheduledActionStatus;
import com.ang.Backend.domain.aiassistant.repository.ScheduledActionRepository;
import com.ang.Backend.domain.chat.dto.ChatDto;
import com.ang.Backend.domain.chat.entity.ChatRoom;
import com.ang.Backend.domain.chat.repository.ChatMemberRepository;
import com.ang.Backend.domain.chat.repository.ChatRoomRepository;
import com.ang.Backend.domain.chat.service.ChatMessageService;
import com.ang.Backend.domain.chat.service.ChatRoomService;
import com.ang.Backend.domain.mail.dto.MailDto;
import com.ang.Backend.domain.mail.service.MailService;
import com.ang.Backend.domain.notification.service.NotificationService;
import com.ang.Backend.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AiScheduledActionService {

    private final AiPromptScheduleParser parser;
    private final ScheduledActionRepository scheduledActionRepository;
    private final MailService mailService;
    private final ChatRoomService chatRoomService;
    private final ChatMessageService chatMessageService;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatMemberRepository chatMemberRepository;
    private final NotificationService notificationService;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional
    public AiAssistantDto.ScheduleResponse parseOrSchedule(String prompt, boolean confirm, User requester) {
        AiPromptScheduleParser.ParsedSchedule parsed = parser.parse(prompt, requester);
        ScheduledAction action = parsed.getAction();

        if (!parsed.getMissingFields().isEmpty()) {
            if (confirm) {
                throw new CustomException(ErrorCode.INVALID_INPUT, "예약에 필요한 정보가 부족합니다: " + String.join(", ", parsed.getMissingFields()));
            }
            return AiAssistantDto.ScheduleResponse.builder()
                    .channel(action.getChannel())
                    .status(ScheduledActionStatus.PENDING)
                    .scheduledAt(action.getScheduledAt())
                    .chatRoomId(action.getChatRoomId())
                    .title(action.getTitle())
                    .message(action.getMessage())
                    .recipientEmpNos(parsed.getRecipientEmpNos())
                    .recipientNames(parsed.getRecipientNames())
                    .fileIds(parsed.getFileIds())
                    .missingFields(parsed.getMissingFields())
                    .preview(AiAssistantDto.ScheduleResponse.buildPreview(action.getChannel(), parsed.getRecipientNames(), action.getScheduledAt(), action.getTitle(), action.getMessage()))
                    .build();
        }

        if (!confirm) {
            return AiAssistantDto.ScheduleResponse.builder()
                    .channel(action.getChannel())
                    .status(ScheduledActionStatus.PENDING)
                    .scheduledAt(action.getScheduledAt())
                    .chatRoomId(action.getChatRoomId())
                    .title(action.getTitle())
                    .message(action.getMessage())
                    .recipientEmpNos(parsed.getRecipientEmpNos())
                    .recipientNames(parsed.getRecipientNames())
                    .fileIds(parsed.getFileIds())
                    .missingFields(List.of())
                    .preview(AiAssistantDto.ScheduleResponse.buildPreview(action.getChannel(), parsed.getRecipientNames(), action.getScheduledAt(), action.getTitle(), action.getMessage()))
                    .build();
        }

        ScheduledAction saved = scheduledActionRepository.save(action);
        return AiAssistantDto.ScheduleResponse.from(saved, parsed.getRecipientEmpNos(), parsed.getRecipientNames(), parsed.getFileIds());
    }

    public List<AiAssistantDto.ScheduleResponse> getMySchedules(User requester) {
        return scheduledActionRepository.findByRequesterOrderByScheduledAtDesc(requester).stream()
                .map(action -> AiAssistantDto.ScheduleResponse.from(
                        action,
                        splitStrings(action.getRecipientEmpNos()),
                        splitStrings(action.getRecipientNames()),
                        splitLongs(action.getFileIds())
                ))
                .toList();
    }

    @Transactional
    public void cancel(Long id, User requester) {
        ScheduledAction action = scheduledActionRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_FOUND, "예약을 찾을 수 없습니다."));
        if (!action.getRequester().getUserId().equals(requester.getUserId())) {
            throw new CustomException(ErrorCode.FORBIDDEN);
        }
        if (action.getStatus() != ScheduledActionStatus.PENDING && action.getStatus() != ScheduledActionStatus.PROCESSING) {
            throw new CustomException(ErrorCode.INVALID_INPUT, "대기 중이거나 처리 중인 예약만 취소할 수 있습니다.");
        }
        action.cancel();
    }

    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void dispatchDueActions() {
        int claimed = scheduledActionRepository.claimDueActions(LocalDateTime.now());
        if (claimed == 0) return;

        List<ScheduledAction> dueActions = scheduledActionRepository
                .findTop50ByStatusOrderByScheduledAtAsc(ScheduledActionStatus.PROCESSING);

        for (ScheduledAction action : dueActions) {
            try {
                Long targetId = action.getChannel() == ScheduledActionChannel.MAIL
                        ? sendMail(action)
                        : sendChat(action);
                action.markSent(targetId);
            } catch (Exception e) {
                log.warn("Scheduled action dispatch failed: id={}, channel={}, error={}", action.getId(), action.getChannel(), e.toString());
                action.markFailed(e.toString());
            }
        }
    }

    private Long sendMail(ScheduledAction action) {
        MailDto.SendRequest request = new MailDto.SendRequest(
                action.getTitle(),
                action.getMessage(),
                splitStrings(action.getRecipientEmpNos()),
                splitLongs(action.getFileIds())
        );
        return mailService.send(request, action.getRequester(), Collections.emptyList());
    }

    private Long sendChat(ScheduledAction action) {
        Long roomId = resolveChatRoomId(action);
        ChatDto.SendMessageRequest request = new ChatDto.SendMessageRequest();
        request.setRoomId(roomId);
        request.setContent(action.getMessage());

        ChatDto.MessageResponse response = chatMessageService.save(request, action.getRequester());
        messagingTemplate.convertAndSend("/topic/room." + roomId, response);

        chatRoomRepository.findById(roomId).ifPresent(room -> sendChatNotifications(room, action.getRequester(), response));
        return response.getMessageId();
    }

    private Long resolveChatRoomId(ScheduledAction action) {
        if (action.getChatRoomId() != null) return action.getChatRoomId();

        List<String> recipients = splitStrings(action.getRecipientEmpNos());
        if (recipients.isEmpty()) {
            throw new CustomException(ErrorCode.INVALID_INPUT, "채팅 수신자 또는 채팅방이 필요합니다.");
        }
        if (recipients.size() == 1) {
            ChatDto.CreatePrivateRoomRequest request = new ChatDto.CreatePrivateRoomRequest();
            request.setRecipientEmpNo(recipients.get(0));
            return chatRoomService.createPrivateRoom(action.getRequester(), request);
        }

        ChatDto.CreateGroupRoomRequest request = new ChatDto.CreateGroupRoomRequest();
        String roomName = (action.getTitle() != null && !action.getTitle().isBlank())
                ? action.getTitle()
                : splitStrings(action.getRecipientNames()).stream().limit(3).reduce((a, b) -> a + ", " + b).orElse("예약 채팅");
        request.setName(roomName);
        request.setMemberEmpNos(recipients);
        return chatRoomService.createGroupRoom(action.getRequester(), request);
    }

    private void sendChatNotifications(ChatRoom room, User sender, ChatDto.MessageResponse response) {
        String title = room.getType() == ChatRoomType.PRIVATE
                ? sender.getName() + "님이 메시지를 보냈습니다."
                : room.getName() + "에 알림이 있습니다.";
        chatMemberRepository.findByRoomAndLeftAtIsNull(room).stream()
                .filter(member -> !member.getUser().getUserId().equals(sender.getUserId()))
                .forEach(member -> notificationService.send(
                        member.getUser(),
                        NotificationType.CHAT,
                        title,
                        response.getContent(),
                        room.getId()
                ));
    }

    private List<String> splitStrings(String value) {
        if (value == null || value.isBlank()) return List.of();
        List<String> results = new ArrayList<>();
        for (String item : value.split(",")) {
            String trimmed = item.trim();
            if (!trimmed.isBlank()) results.add(trimmed);
        }
        return results;
    }

    private List<Long> splitLongs(String value) {
        if (value == null || value.isBlank()) return List.of();
        List<Long> results = new ArrayList<>();
        for (String item : value.split(",")) {
            String trimmed = item.trim();
            if (trimmed.isBlank()) continue;
            try {
                results.add(Long.parseLong(trimmed));
            } catch (NumberFormatException e) {
                log.warn("splitLongs: skipping invalid value '{}'", trimmed);
            }
        }
        return results;
    }
}
