package com.example.employee_crud.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.example.employee_crud.entity.Employee;
import com.example.employee_crud.exception.DuplicateEmailException;
import com.example.employee_crud.repository.EmployeeRepository;

@Service
public class EmployeeService {

    private final EmployeeRepository employeeRepository;

    public EmployeeService(EmployeeRepository employeeRepository) {
        this.employeeRepository = employeeRepository;
    }

    public List<Employee> getAllEmployees() {
        return employeeRepository.findAll();
    }

    public Optional<Employee> getEmployeeById(Long id) {
        return employeeRepository.findById(id);
    }

    public Employee createEmployee(Employee employee) {
        if (employeeRepository.existsByEmail(employee.getEmail())) {
            throw new DuplicateEmailException("Email already exists");
        }

        return employeeRepository.save(employee);
    }

    public Optional<Employee> updateEmployee(Long id, Employee employeeDetails) {
        return employeeRepository.findById(id).map(employee -> {

            if (!employee.getEmail().equals(employeeDetails.getEmail())
                    && employeeRepository.existsByEmail(employeeDetails.getEmail())) {
                throw new DuplicateEmailException("Email already exists");
            }

            employee.setName(employeeDetails.getName());
            employee.setEmail(employeeDetails.getEmail());
            employee.setDepartment(employeeDetails.getDepartment());
            employee.setSalary(employeeDetails.getSalary());

            return employeeRepository.save(employee);
        });
    }

    public boolean deleteEmployee(Long id) {
        if (!employeeRepository.existsById(id)) {
            return false;
        }

        employeeRepository.deleteById(id);
        return true;
    }
}
