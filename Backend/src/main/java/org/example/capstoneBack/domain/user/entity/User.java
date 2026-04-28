package org.example.capstoneBack.domain.user.entity;

import jakarta.persistence.*;
import lombok.*;
import org.example.capstoneBack.common.enums.UserStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "emp_no", unique = true, nullable = false, length = 50)
    private String empNo;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Column(name = "email", length = 100)
    private String email;

    @Column(name = "phone", length = 20)
    private String phone;

    @Column(name = "birthdate")
    private LocalDate birthdate;

    @Column(name = "profile_image_url", length = 255)
    private String profileImageUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20)
    @Builder.Default
    private UserStatus status = UserStatus.PENDING;

    @Column(name = "created_at")
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    @Builder.Default
    private List<UserRole> userRoles = new ArrayList<>();

    @OneToMany(mappedBy = "user", fetch = FetchType.LAZY)
    @Builder.Default
    private List<UserMembership> memberships = new ArrayList<>();

    // 회원 정보 수정 (사진, 이메일, 연락처, 생년월일, 이름)
    public void updateProfile(String name, String email, String phone,
                               LocalDate birthdate, String profileImageUrl) {
        if (name != null) this.name = name;
        if (email != null) this.email = email;
        if (phone != null) this.phone = phone;
        if (birthdate != null) this.birthdate = birthdate;
        if (profileImageUrl != null) this.profileImageUrl = profileImageUrl;
    }

    public void updatePassword(String newPasswordHash) {
        this.passwordHash = newPasswordHash;
    }

    public void updateEmpNo(String empNo) {
        this.empNo = empNo;
    }

    public void approve() {
        this.status = UserStatus.ACTIVE;
    }

    // 탈퇴 시 개인정보 익명화 처리
    public void anonymize() {
        // 이름: 성(姓)만 남기고 나머지 '@'로 대체 (예: 김철수 → 김@@, 박민 → 박@)
        if (this.name != null && this.name.length() > 1) {
            String firstChar = this.name.substring(0, 1);
            String masked = "@".repeat(this.name.length() - 1);
            this.name = firstChar + masked;
        }
        this.email = null;
        this.phone = null;
        this.birthdate = null;
        this.profileImageUrl = null;
        this.status = UserStatus.ANONYMIZED;
        this.deletedAt = LocalDateTime.now();
    }
}
