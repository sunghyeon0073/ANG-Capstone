package com.ang.Backend.domain.user.entity.id;

import java.io.Serializable;
import java.util.Objects;

public class UserTagId implements Serializable {
    private Integer user;
    private String tagName;

    public UserTagId() {}
    public UserTagId(Integer user, String tagName) {
        this.user = user;
        this.tagName = tagName;
    }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof UserTagId that)) return false;
        return Objects.equals(user, that.user) && Objects.equals(tagName, that.tagName);
    }
    @Override public int hashCode() { return Objects.hash(user, tagName); }
}
