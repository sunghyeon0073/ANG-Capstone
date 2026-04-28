package org.example.capstoneBack.domain.menu.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "menus")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class Menu {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "menu_id")
    private Long menuId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Menu parent;

    @OneToMany(mappedBy = "parent", fetch = FetchType.LAZY)
    @Builder.Default
    private List<Menu> children = new ArrayList<>();

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "url", length = 255)
    private String url;

    @Column(name = "required_permission", length = 100)
    private String requiredPermission;

    @Column(name = "sort_order")
    @Builder.Default
    private int sortOrder = 0;

    public void update(String name, String url, String requiredPermission, int sortOrder) {
        this.name = name;
        this.url = url;
        this.requiredPermission = requiredPermission;
        this.sortOrder = sortOrder;
    }
}
