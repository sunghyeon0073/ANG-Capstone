package org.example.capstoneBack.domain.chat.repository;

import org.example.capstoneBack.domain.chat.entity.ChatRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

    @Query("SELECT cr FROM ChatRoom cr JOIN cr.members m WHERE m.user.userId = :userId")
    List<ChatRoom> findByMemberUserId(@Param("userId") Long userId);
}
