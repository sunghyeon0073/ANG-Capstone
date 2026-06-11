package com.ang.Backend.domain.board.repository;

import com.ang.Backend.domain.board.entity.BoardAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BoardAttachmentRepository extends JpaRepository<BoardAttachment, Long> {
}
