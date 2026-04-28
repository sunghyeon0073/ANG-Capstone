package org.example.capstoneBack.domain.menu.repository;

import org.example.capstoneBack.domain.menu.entity.Menu;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MenuRepository extends JpaRepository<Menu, Long> {

    List<Menu> findByParentIsNullOrderBySortOrder();

    List<Menu> findByParentMenuIdOrderBySortOrder(Long parentId);
}
