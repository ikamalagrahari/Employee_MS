package com.example.employee_crud.repository;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.example.employee_crud.entity.Employee;
import com.example.employee_crud.entity.EmployeeStatus;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    Optional<Employee> findByEmail(String email);

    boolean existsByEmail(String email);

    Page<Employee> findByNameContainingIgnoreCaseOrEmailContainingIgnoreCaseOrDepartmentContainingIgnoreCase(
            String name,
            String email,
            String department,
            Pageable pageable
    );

    Page<Employee> findByDepartmentIgnoreCase(
            String department,
            Pageable pageable
    );

    Page<Employee> findByStatus(
            EmployeeStatus status,
            Pageable pageable
    );

    long countByStatus(EmployeeStatus status);
}
