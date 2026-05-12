package com.ang.Backend.domain.role.entity;

import com.ang.Backend.domain.role.entity.id.RolePermissionId;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "role_permissions")
@IdClass(RolePermissionId.class)
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
public class RolePermission {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "role_id")
    private Role role;

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "permission_id")
    private Permission permission;
}
