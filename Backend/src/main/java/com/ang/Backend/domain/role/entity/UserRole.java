package com.ang.Backend.domain.role.entity;

import com.ang.Backend.domain.role.entity.id.UserRoleId;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

// 복합키 PK = (user_id, scope_id, role_id)
// 같은 사람이 부서A에서는 level=50, 부서B에서는 level=0 등 부서별 독립 권한 보유 가능
@Entity
@Table(name = "user_roles")
@IdClass(UserRoleId.class)
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserRole {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scope_id")
    private Scope scope;    // 이 역할이 적용되는 부서

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id")
    private Role role;      // roleLevel: 0=사원, 50=팀장, 100=최고관리자
}
