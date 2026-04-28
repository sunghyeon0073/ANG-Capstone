package org.example.capstoneBack.domain.chat.repository;

import org.example.capstoneBack.domain.chat.entity.ChatMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChatMemberRepository extends JpaRepository<ChatMember, ChatMember.ChatMemberId> {

    List<ChatMember> findByChatRoomRoomId(Long roomId);

    boolean existsByChatRoomRoomIdAndUserUserId(Long roomId, Long userId);
}
