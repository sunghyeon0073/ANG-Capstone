package com.ang.Backend.domain.role.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "roles")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Role {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "role_id")
    private Integer roleId;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Column(name = "role_level", nullable = false)
    @Builder.Default
    private int roleLevel = 0;

    @Column(name = "description", length = 255)
    private String description;
}
