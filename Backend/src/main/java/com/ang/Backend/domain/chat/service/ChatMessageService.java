package com.ang.Backend.domain.chat.service;

import com.ang.Backend.common.enums.ChatMessageType;
import com.ang.Backend.domain.chat.dto.ChatDto;
import com.ang.Backend.domain.chat.entity.ChatMessage;
import com.ang.Backend.domain.chat.entity.ChatRoom;
import com.ang.Backend.domain.chat.repository.ChatMessageRepository;
import com.ang.Backend.domain.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatMessageService {

    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomService chatRoomService;

    // STOMP 메시지 저장 + 채팅방 최근 메시지 업데이트
    @Transactional
    public ChatDto.MessageResponse save(ChatDto.SendMessageRequest req, User sender) {
        ChatRoom room = chatRoomService.findRoom(req.getRoomId());
        chatRoomService.validateMember(room, sender);

        ChatMessageType type = (req.getFileUrl() != null && !req.getFileUrl().isBlank())
                ? ChatMessageType.FILE : ChatMessageType.TEXT;

        ChatMessage message = chatMessageRepository.save(ChatMessage.builder()
                .room(room)
                .sender(sender)
                .content(req.getContent())
                .messageType(type)
                .fileUrl(req.getFileUrl())
                .fileName(req.getFileName())
                .sentAt(LocalDateTime.now())
                .build());

        // 채팅방 최근 메시지 업데이트
        String preview = type == ChatMessageType.FILE
                ? "[파일] " + req.getFileName()
                : (req.getContent() != null && req.getContent().length() > 50
                        ? req.getContent().substring(0, 50) + "..."
                        : req.getContent());
        room.setLastMessageContent(preview);
        room.setLastMessageAt(message.getSentAt());
        room.setLastMessageSender(sender.getName());

        return ChatDto.MessageResponse.from(message);
    }

    // 메시지 내역 조회 (페이징, 최신순)
    public List<ChatDto.MessageResponse> getMessages(Long roomId, User user, int page, int size) {
        ChatRoom room = chatRoomService.findRoom(roomId);
        chatRoomService.validateMember(room, user);
        return chatMessageRepository
                .findByRoomOrderBySentAtDesc(room, PageRequest.of(page, size))
                .map(ChatDto.MessageResponse::from)
                .toList();

    }
}
