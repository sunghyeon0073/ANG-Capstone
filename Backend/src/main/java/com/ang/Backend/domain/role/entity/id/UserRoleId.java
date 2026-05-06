package com.ang.Backend.domain.role.entity.id;

import java.io.Serializable;
import java.util.Objects;

public class UserRoleId implements Serializable {
    private Integer user;
    private Integer scope;
    private Integer role;

    public UserRoleId() {}
    public UserRoleId(Integer user, Integer scope, Integer role) {
        this.user = user;
        this.scope = scope;
        this.role = role;
    }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof UserRoleId that)) return false;
        return Objects.equals(user, that.user) && Objects.equals(scope, that.scope) && Objects.equals(role, that.role);
    }
    @Override public int hashCode() { return Objects.hash(user, scope, role); }
}
