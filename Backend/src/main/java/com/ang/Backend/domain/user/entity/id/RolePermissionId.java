package com.ang.Backend.domain.user.entity.id;

import java.io.Serializable;
import java.util.Objects;

public class RolePermissionId implements Serializable {
    private Integer role;
    private Integer permission;

    public RolePermissionId() {}
    public RolePermissionId(Integer role, Integer permission) {
        this.role = role;
        this.permission = permission;
    }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof RolePermissionId that)) return false;
        return Objects.equals(role, that.role) && Objects.equals(permission, that.permission);
    }
    @Override public int hashCode() { return Objects.hash(role, permission); }
}
