package com.ang.Backend.domain.chat.controller;

import com.ang.Backend.common.enums.NotificationType;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.chat.dto.ChatDto;
import com.ang.Backend.domain.chat.repository.ChatMemberRepository;
import com.ang.Backend.domain.chat.repository.ChatRoomRepository;
import com.ang.Backend.domain.chat.service.ChatMessageService;
import com.ang.Backend.domain.chat.service.ChatRoomService;
import com.ang.Backend.domain.notification.service.NotificationService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
public class ChatWebSocketController {

    private final ChatMessageService chatMessageService;
    private final ChatRoomService chatRoomService;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatMemberRepository chatMemberRepository;
    private final NotificationService notificationService;

    // 메시지 발송: 클라이언트 → /app/chat.send
    @MessageMapping("/chat.send")
    public void send(ChatDto.SendMessageRequest req, Principal principal) {
        User sender = userRepository.findByEmpNo(principal.getName())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        ChatDto.MessageResponse response = chatMessageService.save(req, sender);
        messagingTemplate.convertAndSend("/topic/room." + req.getRoomId(), response);

        chatRoomRepository.findById(req.getRoomId()).ifPresent(room -> {
            // 나갔던 PRIVATE 멤버 재참여 + 방 목록에 다시 띄우기 (상대가 메시지 보내면 방 자동 재오픈)
            for (User u : chatRoomService.rejoinLeftMembersOnMessage(room, sender)) {
                java.util.List<ChatDto.MemberInfo> members = chatMemberRepository.findByRoomAndLeftAtIsNull(room)
                        .stream().map(m -> ChatDto.MemberInfo.from(m.getUser())).toList();
                ChatDto.RoomSummary summary = ChatDto.RoomSummary.from(room, 1, members, u, null);
                messagingTemplate.convertAndSendToUser(u.getEmpNo(), "/queue/invite", summary);
            }

            String title = room.getType() == com.ang.Backend.common.enums.ChatRoomType.PRIVATE
                    ? sender.getName() + "님이 메시지를 보냈습니다."
                    : room.getName() + "에 알림이 있습니다.";
            chatMemberRepository.findByRoomAndLeftAtIsNull(room).stream()
                    .filter(m -> !m.getUser().getUserId().equals(sender.getUserId()))
                    .forEach(m -> notificationService.send(
                            m.getUser(), NotificationType.CHAT,
                            title,
                            req.getContent(),
                            req.getRoomId()
                    ));
        });
    }

    // 읽음 처리: 클라이언트 → /app/chat.read  (payload: roomId as String)
    @MessageMapping("/chat.read")
    public void read(Long roomId, Principal principal) {
        User user = userRepository.findByEmpNo(principal.getName())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        // ChatRoomService.markAsRead 와 동일 로직 — REST 엔드포인트 권장
    }
}
