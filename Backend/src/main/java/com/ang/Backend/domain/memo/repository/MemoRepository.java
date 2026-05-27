package com.ang.Backend.domain.memo.repository;

import com.ang.Backend.domain.memo.entity.Memo;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MemoRepository extends JpaRepository<Memo, Long> {
    List<Memo> findByUserOrderByUpdatedAtDesc(User user);
}
