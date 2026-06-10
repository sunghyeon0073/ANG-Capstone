package com.ang.Backend.domain.approval.repository;

import com.ang.Backend.domain.approval.entity.UserSignature;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserSignatureRepository extends JpaRepository<UserSignature, Long> {
    List<UserSignature> findByUserOrderByCreatedAtDesc(User user);
    Optional<UserSignature> findByIdAndUser(Long id, User user);
    void deleteByIdAndUser(Long id, User user);
}
