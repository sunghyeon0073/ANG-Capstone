package com.ang.Backend.domain.chat.repository;

import com.ang.Backend.domain.chat.entity.ChatMember;
import com.ang.Backend.domain.chat.entity.ChatRoom;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChatMemberRepository extends JpaRepository<ChatMember, Long> {

    // 현재 활성 멤버 목록
    List<ChatMember> findByRoomAndLeftAtIsNull(ChatRoom room);

    // 특정 멤버 조회 (탈퇴 여부 무관)
    Optional<ChatMember> findByRoomAndUser(ChatRoom room, User user);

    // 채팅방 전체 멤버 조회 (퇴장 포함)
    List<ChatMember> findByRoom(ChatRoom room);

    // 내가 속한 활성 채팅방 멤버 목록
    List<ChatMember> findByUserAndLeftAtIsNull(User user);
}
