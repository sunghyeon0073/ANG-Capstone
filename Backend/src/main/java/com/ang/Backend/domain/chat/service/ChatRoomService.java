package com.ang.Backend.domain.chat.service;

import com.ang.Backend.common.enums.ChatMessageType;
import com.ang.Backend.common.enums.ChatRoomType;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.chat.dto.ChatDto;
import com.ang.Backend.domain.chat.entity.ChatMember;
import com.ang.Backend.domain.chat.entity.ChatMessage;
import com.ang.Backend.domain.chat.entity.ChatRoom;
import com.ang.Backend.domain.chat.repository.ChatMemberRepository;
import com.ang.Backend.domain.chat.repository.ChatMessageRepository;
import com.ang.Backend.domain.chat.repository.ChatRoomRepository;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatRoomService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMemberRepository chatMemberRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    // 1:1 채팅방 생성 (이미 있으면 기존 방 반환)
    @Transactional
    public Long createPrivateRoom(User me, ChatDto.CreatePrivateRoomRequest req) {
        User recipient = userRepository.findByEmpNo(req.getRecipientEmpNo())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        return chatRoomRepository.findExistingPrivateRoom(me, recipient)
                .map(existingRoom -> {
                    // 나간 상태라면 재활성화
                    reactivateIfLeft(existingRoom, me);
                    reactivateIfLeft(existingRoom, recipient);
                    return existingRoom.getId();
                })
                .orElseGet(() -> {
                    ChatRoom room = chatRoomRepository.save(ChatRoom.builder()
                            .type(ChatRoomType.PRIVATE)
                            .build());
                    addMember(room, me);
                    addMember(room, recipient);
                    return room.getId();
                });
    }

    // 그룹 채팅방 생성
    @Transactional
    public Long createGroupRoom(User me, ChatDto.CreateGroupRoomRequest req) {
        ChatRoom room = chatRoomRepository.save(ChatRoom.builder()
                .type(ChatRoomType.GROUP)
                .name(req.getName())
                .build());
        addMember(room, me);
        for (String empNo : req.getMemberEmpNos()) {
            User member = userRepository.findByEmpNo(empNo)
                    .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
            addMember(room, member);
        }
        return room.getId();
    }

    // 내 채팅방 목록 (최근 메시지 + 안읽음 수)
    public List<ChatDto.RoomSummary> getMyRooms(User user) {
        return chatMemberRepository.findByUserAndLeftAtIsNull(user).stream()
                .map(cm -> {
                    ChatRoom room = cm.getRoom();
                    long unread = chatMessageRepository.countUnread(room, user.getUserId(), cm.getLastReadAt());
                    List<ChatDto.MemberInfo> members = chatMemberRepository.findByRoomAndLeftAtIsNull(room)
                            .stream().map(m -> ChatDto.MemberInfo.from(m.getUser())).toList();
                    return ChatDto.RoomSummary.from(room, unread, members, user);
                })
                .toList();
    }

    // 멤버 목록
    public List<ChatDto.MemberInfo> getMembers(Long roomId, User user) {
        ChatRoom room = findRoom(roomId);
        validateMember(room, user);
        return chatMemberRepository.findByRoomAndLeftAtIsNull(room)
                .stream().map(m -> ChatDto.MemberInfo.from(m.getUser())).toList();
    }

    // 초대 (그룹방만)
    @Transactional
    public void invite(Long roomId, User inviter, ChatDto.InviteRequest req) {
        ChatRoom room = findRoom(roomId);
        validateMember(room, inviter);
        if (room.getType() == ChatRoomType.PRIVATE) {
            throw new CustomException(ErrorCode.CHAT_PRIVATE_INVITE_DENIED);
        }
        for (String empNo : req.getEmpNos()) {
            User target = userRepository.findByEmpNo(empNo)
                    .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
            chatMemberRepository.findByRoomAndUser(room, target).ifPresentOrElse(
                    existing -> {
                        if (existing.getLeftAt() != null) {
                            existing.setLeftAt(null);
                            existing.setJoinedAt(LocalDateTime.now());
                        } else {
                            throw new CustomException(ErrorCode.CHAT_ALREADY_MEMBER);
                        }
                    },
                    () -> addMember(room, target)
            );
            // 초대된 사람에게 실시간 알림
            List<ChatDto.MemberInfo> members = chatMemberRepository.findByRoomAndLeftAtIsNull(room)
                    .stream().map(m -> ChatDto.MemberInfo.from(m.getUser())).toList();
            ChatDto.RoomSummary summary = ChatDto.RoomSummary.from(room, 0, members, target);
            messagingTemplate.convertAndSendToUser(target.getEmpNo(), "/queue/invite", summary);
        }
    }

    // 채팅방 나가기
    @Transactional
    public void leave(Long roomId, User user) {
        ChatRoom room = findRoom(roomId);
        ChatMember member = chatMemberRepository.findByRoomAndUser(room, user)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_CHAT_MEMBER));
        if (member.getLeftAt() != null) {
            throw new CustomException(ErrorCode.NOT_CHAT_MEMBER);
        }
        member.setLeftAt(LocalDateTime.now());

        if (room.getType() == ChatRoomType.GROUP) {
            ChatMessage systemMsg = chatMessageRepository.save(ChatMessage.builder()
                    .room(room)
                    .content(user.getName() + "님이 나갔습니다.")
                    .messageType(ChatMessageType.SYSTEM)
                    .sentAt(LocalDateTime.now())
                    .build());
            messagingTemplate.convertAndSend(
                    "/topic/room." + roomId,
                    ChatDto.MessageResponse.from(systemMsg)
            );
        }
    }

    // 읽음 처리
    @Transactional
    public void markAsRead(Long roomId, User user) {
        ChatRoom room = findRoom(roomId);
        ChatMember member = chatMemberRepository.findByRoomAndUser(room, user)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_CHAT_MEMBER));
        member.setLastReadAt(LocalDateTime.now());
    }

    private void addMember(ChatRoom room, User user) {
        chatMemberRepository.save(ChatMember.builder()
                .room(room)
                .user(user)
                .joinedAt(LocalDateTime.now())
                .build());
    }

    private void reactivateIfLeft(ChatRoom room, User user) {
        chatMemberRepository.findByRoomAndUser(room, user).ifPresent(m -> {
            if (m.getLeftAt() != null) {
                m.setLeftAt(null);
                m.setJoinedAt(LocalDateTime.now());
            }
        });
    }

    ChatRoom findRoom(Long roomId) {
        return chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new CustomException(ErrorCode.CHAT_ROOM_NOT_FOUND));
    }

    void validateMember(ChatRoom room, User user) {
        ChatMember member = chatMemberRepository.findByRoomAndUser(room, user)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_CHAT_MEMBER));
        if (member.getLeftAt() != null) {
            throw new CustomException(ErrorCode.NOT_CHAT_MEMBER);
        }
    }
}
