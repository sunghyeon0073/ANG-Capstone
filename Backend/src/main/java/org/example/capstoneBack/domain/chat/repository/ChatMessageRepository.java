package org.example.capstoneBack.domain.chat.repository;

import org.example.capstoneBack.domain.chat.entity.ChatMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    Page<ChatMessage> findByChatRoomRoomIdOrderByCreatedAtDesc(Long roomId, Pageable pageable);
}
