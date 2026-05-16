package com.ang.Backend.domain.user.entity;

import com.ang.Backend.domain.user.entity.id.UserTagId;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "user_tags")
@IdClass(UserTagId.class)
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserTag {

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Id
    @Column(name = "tag_name", length = 50)
    private String tagName;
}
