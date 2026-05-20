package com.ang.Backend.domain.chat.controller;

import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.chat.dto.ChatDto;
import com.ang.Backend.domain.chat.service.ChatMessageService;
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
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // 메시지 발송: 클라이언트 → /app/chat.send
    @MessageMapping("/chat.send")
    public void send(ChatDto.SendMessageRequest req, Principal principal) {
        User sender = userRepository.findByEmpNo(principal.getName())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        ChatDto.MessageResponse response = chatMessageService.save(req, sender);
        messagingTemplate.convertAndSend("/topic/room." + req.getRoomId(), response);
    }

    // 읽음 처리: 클라이언트 → /app/chat.read  (payload: roomId as String)
    @MessageMapping("/chat.read")
    public void read(Long roomId, Principal principal) {
        User user = userRepository.findByEmpNo(principal.getName())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        // ChatRoomService.markAsRead 와 동일 로직 — REST 엔드포인트 권장
    }
}
