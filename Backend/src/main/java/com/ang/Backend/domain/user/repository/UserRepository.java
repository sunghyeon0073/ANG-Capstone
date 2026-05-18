package com.ang.Backend.domain.user.repository;

import com.ang.Backend.common.enums.UserStatus;
import com.ang.Backend.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Integer> {
    Optional<User> findByEmpNo(String empNo);
    boolean existsByEmpNo(String empNo);
    boolean existsByEmail(String email);
    List<User> findByStatus(UserStatus status);

    // 이름 또는 사번에 키워드가 포함된 ACTIVE 사용자 검색
    @Query("SELECT u FROM User u WHERE (u.name LIKE %:keyword% OR u.empNo LIKE %:keyword%) AND u.status = :status")
    List<User> searchByKeyword(@Param("keyword") String keyword, @Param("status") UserStatus status);
}
