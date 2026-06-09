package com.ang.Backend.domain.chat.repository;

import com.ang.Backend.domain.chat.entity.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

    // 두 사용자 간 이미 존재하는 1:1 채팅방 조회 (participant_key 유니크 제약으로 단건 보장)
    Optional<ChatRoom> findByParticipantKey(String participantKey);
}
