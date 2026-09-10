package com.example.employee_crud.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.employee_crud.entity.Employee;
import com.example.employee_crud.service.EmployeeService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/employees")
@Validated
public class EmployeeController {

private final EmployeeService employeeService;

public EmployeeController(EmployeeService employeeService) {
    this.employeeService = employeeService;
}

// GET all employees
@GetMapping
public ResponseEntity<List<Employee>> getAllEmployees() {
    return ResponseEntity.ok(employeeService.getAllEmployees());
}

// GET employee by ID
@GetMapping("/{id}")
public ResponseEntity<Employee> getEmployeeById(@PathVariable Long id) {

    return employeeService.getEmployeeById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
}

// CREATE employee
@PostMapping
public ResponseEntity<Employee> createEmployee(
        @Valid @RequestBody Employee employee) {

    Employee createdEmployee = employeeService.createEmployee(employee);

    return ResponseEntity.ok(createdEmployee);
}

// UPDATE employee
@PutMapping("/{id}")
public ResponseEntity<Employee> updateEmployee(
        @PathVariable Long id,
        @Valid @RequestBody Employee employee) {

    return employeeService.updateEmployee(id, employee)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
}

// DELETE employee
@DeleteMapping("/{id}")
public ResponseEntity<Void> deleteEmployee(@PathVariable Long id) {

    if (employeeService.deleteEmployee(id)) {
        return ResponseEntity.noContent().build();
    }

    return ResponseEntity.notFound().build();
}
}