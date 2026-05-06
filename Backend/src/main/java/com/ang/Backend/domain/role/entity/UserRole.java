package com.ang.Backend.domain.role.entity;

import com.ang.Backend.domain.role.entity.id.UserRoleId;
import com.ang.Backend.domain.scope.entity.Scope;
import com.ang.Backend.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

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
    private Scope scope;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id")
    private Role role;
}
