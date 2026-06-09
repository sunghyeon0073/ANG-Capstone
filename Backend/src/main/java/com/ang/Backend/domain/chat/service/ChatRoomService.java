package com.ang.Backend.domain.chat.service;

import com.ang.Backend.common.enums.ChatMessageType;
import com.ang.Backend.common.enums.ChatRoomType;
import com.ang.Backend.common.enums.NotificationType;
import com.ang.Backend.common.exception.CustomException;
import com.ang.Backend.common.exception.ErrorCode;
import com.ang.Backend.domain.chat.dto.ChatDto;
import com.ang.Backend.domain.chat.entity.ChatMember;
import com.ang.Backend.domain.chat.entity.ChatMessage;
import com.ang.Backend.domain.chat.entity.ChatRoom;
import com.ang.Backend.domain.chat.repository.ChatMemberRepository;
import com.ang.Backend.domain.chat.repository.ChatMessageRepository;
import com.ang.Backend.domain.chat.repository.ChatRoomRepository;
import com.ang.Backend.domain.notification.service.NotificationService;
import com.ang.Backend.domain.user.entity.User;
import com.ang.Backend.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChatRoomService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMemberRepository chatMemberRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final NotificationService notificationService;

    // REQUIRES_NEW 호출용 self 프록시 (동시 생성 레이스 시 외부 트랜잭션 오염 방지)
    @Autowired @Lazy
    private ChatRoomService self;

    // 1:1 채팅방 생성 (이미 있으면 기존 방 반환)
    @Transactional
    public Long createPrivateRoom(User me, ChatDto.CreatePrivateRoomRequest req) {
        User recipient = userRepository.findByEmpNo(req.getRecipientEmpNo())
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
        if (me.getUserId().equals(recipient.getUserId())) {
            throw new CustomException(ErrorCode.INVALID_INPUT);
        }

        String key = privateKey(me, recipient);

        return chatRoomRepository.findByParticipantKey(key)
                .map(room -> {
                    rejoinIfLeft(room, me);
                    rejoinIfLeft(room, recipient);
                    return room.getId();
                })
                .orElseGet(() -> {
                    try {
                        return self.persistPrivateRoom(me, recipient, key);
                    } catch (DataIntegrityViolationException e) {
                        // 동시 요청 레이스: 다른 트랜잭션이 먼저 방을 생성/커밋함 → 기존 방 재사용
                        ChatRoom room = chatRoomRepository.findByParticipantKey(key)
                                .orElseThrow(() -> e);
                        rejoinIfLeft(room, me);
                        rejoinIfLeft(room, recipient);
                        return room.getId();
                    }
                });
    }

    // 새 1:1 방을 별도 트랜잭션으로 생성 후 즉시 flush하여 유니크 위반을 이 경계에서 발생시킴
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Long persistPrivateRoom(User me, User recipient, String key) {
        ChatRoom room = chatRoomRepository.save(ChatRoom.builder()
                .type(ChatRoomType.PRIVATE)
                .participantKey(key)
                .build());
        addMember(room, me);
        addMember(room, recipient);
        chatRoomRepository.flush();
        return room.getId();
    }

    // PRIVATE 방 멤버 조합 키: '<minUserId>:<maxUserId>'
    private String privateKey(User a, User b) {
        int x = a.getUserId(), y = b.getUserId();
        return Math.min(x, y) + ":" + Math.max(x, y);
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
                    return ChatDto.RoomSummary.from(room, unread, members, user, cm.getCustomName());
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

        boolean wasPrivate = room.getType() == ChatRoomType.PRIVATE;
        if (wasPrivate) {
            room.setType(ChatRoomType.GROUP);
            // GROUP 전환 시 PRIVATE 조합 키 해제 (stale 유니크 키 제거 + 원래 두 사람의 새 1:1 방 생성 허용)
            room.setParticipantKey(null);
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
            ChatDto.RoomSummary summary = ChatDto.RoomSummary.from(room, 0, members, target, null);
            messagingTemplate.convertAndSendToUser(target.getEmpNo(), "/queue/invite", summary);
        }

        // PRIVATE → GROUP 전환 시 그룹명 설정 + 시스템 메시지
        if (wasPrivate) {
            if (req.getName() != null && !req.getName().isBlank()) {
                room.setName(req.getName());
            } else {
                String autoName = chatMemberRepository.findByRoomAndLeftAtIsNull(room)
                        .stream()
                        .map(m -> m.getUser().getName())
                        .collect(Collectors.joining(", "));
                room.setName(autoName);
            }
            ChatMessage sysMsg = chatMessageRepository.save(ChatMessage.builder()
                    .room(room)
                    .content(inviter.getName() + "님이 그룹 채팅방으로 전환했습니다.")
                    .messageType(ChatMessageType.SYSTEM)
                    .sentAt(LocalDateTime.now())
                    .build());
            messagingTemplate.convertAndSend("/topic/room." + roomId,
                    ChatDto.MessageResponse.from(sysMsg));
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

        // 모든 멤버가 나갔으면 방·메시지·멤버 하드 삭제
        boolean allLeft = chatMemberRepository.findByRoomAndLeftAtIsNull(room).isEmpty();
        if (allLeft) {
            chatMessageRepository.deleteByRoom(room);
            chatMemberRepository.deleteAll(chatMemberRepository.findByRoom(room));
            chatRoomRepository.delete(room);
        }
    }

    // 읽음 처리
    @Transactional
    public void markAsRead(Long roomId, User user) {
        ChatRoom room = findRoom(roomId);
        ChatMember member = chatMemberRepository.findByRoomAndUser(room, user)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_CHAT_MEMBER));
        member.setLastReadAt(LocalDateTime.now());
        notificationService.deleteByTarget(user, roomId, NotificationType.CHAT);
    }

    // PRIVATE 방에서 나갔던 멤버(발신자 제외)를 재참여시키고, 재참여된 User 목록 반환.
    // GROUP 방은 나가면 영구 퇴장이므로 대상 아님 → 빈 리스트.
    @Transactional
    public List<User> rejoinLeftMembersOnMessage(ChatRoom room, User sender) {
        if (room.getType() != ChatRoomType.PRIVATE) return List.of();
        List<User> rejoined = new ArrayList<>();
        for (ChatMember m : chatMemberRepository.findByRoom(room)) {
            if (m.getLeftAt() != null && !m.getUser().getUserId().equals(sender.getUserId())) {
                m.setLeftAt(null);
                m.setJoinedAt(LocalDateTime.now());
                rejoined.add(m.getUser());
            }
        }
        return rejoined;
    }

    private void rejoinIfLeft(ChatRoom room, User user) {
        chatMemberRepository.findByRoomAndUser(room, user).ifPresent(member -> {
            if (member.getLeftAt() != null) {
                member.setLeftAt(null);
                member.setJoinedAt(LocalDateTime.now());
            }
        });
    }

    private void addMember(ChatRoom room, User user) {
        chatMemberRepository.save(ChatMember.builder()
                .room(room)
                .user(user)
                .joinedAt(LocalDateTime.now())
                .build());
    }

    // 채팅방 이름 개인 설정 (본인에게만 적용)
    @Transactional
    public void updateMyRoomName(Long roomId, User user, String name) {
        ChatRoom room = findRoom(roomId);
        ChatMember member = chatMemberRepository.findByRoomAndUser(room, user)
                .filter(m -> m.getLeftAt() == null)
                .orElseThrow(() -> new CustomException(ErrorCode.NOT_CHAT_MEMBER));
        member.setCustomName((name != null && !name.isBlank()) ? name : null);
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
