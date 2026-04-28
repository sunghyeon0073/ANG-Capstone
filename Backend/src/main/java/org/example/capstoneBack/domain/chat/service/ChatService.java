package org.example.capstoneBack.domain.chat.service;

import lombok.RequiredArgsConstructor;
import org.example.capstoneBack.common.enums.RoomType;
import org.example.capstoneBack.common.exception.CustomException;
import org.example.capstoneBack.common.exception.ErrorCode;
import org.example.capstoneBack.domain.chat.dto.ChatMessageDto;
import org.example.capstoneBack.domain.chat.dto.ChatRoomCreateRequest;
import org.example.capstoneBack.domain.chat.entity.ChatMember;
import org.example.capstoneBack.domain.chat.entity.ChatMessage;
import org.example.capstoneBack.domain.chat.entity.ChatRoom;
import org.example.capstoneBack.domain.chat.repository.*;
import org.example.capstoneBack.domain.notification.entity.Notification;
import org.example.capstoneBack.domain.notification.repository.NotificationRepository;
import org.example.capstoneBack.domain.user.entity.User;
import org.example.capstoneBack.domain.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMemberRepository chatMemberRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;

    @Transactional(readOnly = true)
    public List<ChatRoom> getMyChatRooms(String empNo) {
        User user = findUserByEmpNo(empNo);
        return chatRoomRepository.findByMemberUserId(user.getUserId());
    }

    @Transactional
    public ChatRoom createChatRoom(String empNo, ChatRoomCreateRequest request) {
        User creator = findUserByEmpNo(empNo);

        if (request.getRoomType() == RoomType.PRIVATE && request.getMemberIds().size() != 1) {
            throw new CustomException(ErrorCode.INVALID_INPUT, "1:1 채팅은 상대방 1명만 선택해야 합니다.");
        }

        ChatRoom room = ChatRoom.builder()
                .roomType(request.getRoomType())
                .roomName(request.getRoomName())
                .build();
        chatRoomRepository.save(room);

        // 방장 추가
        chatMemberRepository.save(ChatMember.builder().chatRoom(room).user(creator).build());

        // 초대된 멤버 추가
        for (Long memberId : request.getMemberIds()) {
            User member = findUserById(memberId);
            if (!member.getUserId().equals(creator.getUserId())) {
                chatMemberRepository.save(ChatMember.builder().chatRoom(room).user(member).build());
            }
        }
        return room;
    }

    @Transactional
    public ChatMessageDto sendMessage(Long roomId, String empNo, String content) {
        User sender = findUserByEmpNo(empNo);
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new CustomException(ErrorCode.CHAT_ROOM_NOT_FOUND));

        if (!chatMemberRepository.existsByChatRoomRoomIdAndUserUserId(roomId, sender.getUserId())) {
            throw new CustomException(ErrorCode.NOT_CHAT_MEMBER);
        }

        ChatMessage message = ChatMessage.builder()
                .chatRoom(room).sender(sender).content(content).build();
        chatMessageRepository.save(message);

        // 다른 멤버들에게 알림
        chatMemberRepository.findByChatRoomRoomId(roomId).stream()
                .filter(m -> !m.getUser().getUserId().equals(sender.getUserId()))
                .forEach(m -> notificationRepository.save(Notification.builder()
                        .user(m.getUser()).notifType("CHAT")
                        .message(sender.getName() + ": " + truncate(content, 50))
                        .targetUrl("/chat/" + roomId).build()));

        return ChatMessageDto.from(message);
    }

    @Transactional(readOnly = true)
    public Page<ChatMessageDto> getMessages(Long roomId, String empNo, Pageable pageable) {
        User user = findUserByEmpNo(empNo);
        if (!chatMemberRepository.existsByChatRoomRoomIdAndUserUserId(roomId, user.getUserId())) {
            throw new CustomException(ErrorCode.NOT_CHAT_MEMBER);
        }
        return chatMessageRepository.findByChatRoomRoomIdOrderByCreatedAtDesc(roomId, pageable)
                .map(ChatMessageDto::from);
    }

    private String truncate(String text, int max) {
        return text.length() > max ? text.substring(0, max) + "..." : text;
    }

    private User findUserByEmpNo(String empNo) {
        return userRepository.findByEmpNo(empNo)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private User findUserById(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }
}
