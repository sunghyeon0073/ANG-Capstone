package com.ang.Backend.domain.chat.repository;

import com.ang.Backend.domain.chat.entity.ChatRoom;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

    // 두 사용자 간 이미 존재하는 1:1 채팅방 조회
    @Query("""
        SELECT r FROM ChatRoom r
        WHERE r.type = 'PRIVATE'
        AND EXISTS (SELECT m FROM ChatMember m WHERE m.room = r AND m.user = :user1)
        AND EXISTS (SELECT m FROM ChatMember m WHERE m.room = r AND m.user = :user2)
    """)
    Optional<ChatRoom> findExistingPrivateRoom(@Param("user1") User user1, @Param("user2") User user2);
}
