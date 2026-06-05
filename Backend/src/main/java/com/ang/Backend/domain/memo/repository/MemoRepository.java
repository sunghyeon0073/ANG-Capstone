package com.ang.Backend.domain.memo.repository;

import com.ang.Backend.domain.memo.entity.Memo;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemoRepository extends JpaRepository<Memo, Long> {
    List<Memo> findByUserOrderByUpdatedAtDesc(User user);

    @org.springframework.data.jpa.repository.Query("SELECT m FROM Memo m WHERE m.user = :user AND (m.title LIKE %:keyword% OR m.content LIKE %:keyword%) ORDER BY m.updatedAt DESC")
    List<Memo> findByUserAndKeyword(@org.springframework.data.repository.query.Param("user") User user, @org.springframework.data.repository.query.Param("keyword") String keyword);
}
