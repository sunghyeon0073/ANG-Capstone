package com.ang.Backend.domain.chat.repository;

import com.ang.Backend.domain.chat.entity.ChatMessage;
import com.ang.Backend.domain.chat.entity.ChatRoom;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    // 채팅방 메시지 내역 (최신순)
    Page<ChatMessage> findByRoomOrderBySentAtDesc(ChatRoom room, Pageable pageable);

    // 채팅방 전체 메시지 삭제
    void deleteByRoom(ChatRoom room);

    // 안읽음 메시지 수 (SYSTEM 제외, 내가 보낸 것 제외)
    @Query("""
        SELECT COUNT(m) FROM ChatMessage m
        WHERE m.room = :room
        AND m.messageType != 'SYSTEM'
        AND (m.sender IS NULL OR m.sender.userId != :userId)
        AND (:lastReadAt IS NULL OR m.sentAt > :lastReadAt)
    """)
    long countUnread(@Param("room") ChatRoom room,
                     @Param("userId") Integer userId,
                     @Param("lastReadAt") LocalDateTime lastReadAt);
}
