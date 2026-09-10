import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:8080/employees";

const EMPTY_FORM = {
  name: "",
  email: "",
  department: "",
  salary: "",
};

const PAGE_SIZES = [6, 12, 24, 48];

const ACCENTS = ["indigo", "violet", "teal", "rose"];

const DEPARTMENT_HINTS = [
  "Engineering",
  "Design",
  "Product",
  "Operations",
  "Finance",
  "Human Resources",
  "Sales",
  "Marketing",
  "Support",
];

/* ------------------------------------------------------------------ */
/* Utilities                                                          */
/* ------------------------------------------------------------------ */

const store = {
  get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage errors
    }
  },
};

const inr = (value) =>
  "₹" +
  Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

const inrCompact = (value) => {
  const n = Number(value || 0);

  if (n >= 1e7) {
    return `₹${(n / 1e7).toFixed(2)} Cr`;
  }

  if (n >= 1e5) {
    return `₹${(n / 1e5).toFixed(2)} L`;
  }

  return inr(n);
};

const initialsOf = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";

const hueOf = (input = "") => {
  let hash = 0;

  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) % 360;
  }

  return hash;
};

/* ------------------------------------------------------------------ */
/* Frontend validation                                                */
/* ------------------------------------------------------------------ */

function validateForm(form) {
  const errors = {};

  const name = form.name.trim();
  const email = form.email.trim();
  const department = form.department.trim();

  if (!name) {
    errors.name = "Name is required.";
  } else if (name.length < 2) {
    errors.name = "Use at least 2 characters.";
  }

  if (!email) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!department) {
    errors.department = "Department is required.";
  }

  const salary = Number(form.salary);

  if (form.salary === "") {
    errors.salary = "Salary is required.";
  } else if (Number.isNaN(salary) || salary < 0) {
    errors.salary = "Salary cannot be negative.";
  }

  return errors;
}

/* ------------------------------------------------------------------ */
/* Debounce                                                           */
/* ------------------------------------------------------------------ */

function useDebounced(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/* ------------------------------------------------------------------ */
/* Presentational Components                                          */
/* ------------------------------------------------------------------ */

function Avatar({ name, size = "md" }) {
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ "--hue": hueOf(name) }}
    >
      {initialsOf(name)}
    </span>
  );
}

function SkeletonRows({ rows = 5 }) {
  return (
    <div className="skeleton-stack">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <span className="shimmer skeleton-circle" />
          <span className="shimmer skeleton-line w-40" />
          <span className="shimmer skeleton-line w-20" />
          <span className="shimmer skeleton-line w-16" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, message, action }) {
  return (
    <div className="empty-state">
      <svg viewBox="0 0 64 64" className="empty-art" aria-hidden="true">
        <rect x="8" y="14" width="48" height="38" rx="6" />
        <path d="M8 26h48" />
        <circle cx="24" cy="38" r="5" />
        <path d="M36 34h12M36 42h8" />
      </svg>

      <h3>{title}</h3>
      <p>{message}</p>

      {action}
    </div>
  );
}

function BarList({ items, formatter }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className="bar-list">
      {items.map((item) => (
        <li
          key={item.label}
          style={{ "--hue": hueOf(item.label) }}
        >
          <div className="bar-meta">
            <span className="bar-label">{item.label}</span>
            <span className="bar-value">{formatter(item)}</span>
          </div>

          <div className="bar-track">
            <span
              className="bar-fill"
              style={{
                width: `${Math.max(
                  (item.value / max) * 100,
                  4
                )}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SortHeader({ label, sortKey, sort, onSort, align }) {
  const active = sort.key === sortKey;

  return (
    <th className={align === "right" ? "align-right" : undefined}>
      <button
        type="button"
        className={`sort-btn ${active ? "active" : ""}`}
        onClick={() => onSort(sortKey)}
      >
        {label}

        <span
          className={`sort-caret ${active ? sort.dir : ""}`}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                */
/* ------------------------------------------------------------------ */

function App() {
  /* ---------------- data ---------------- */

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);

  /* ---------------- form ---------------- */

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState({});
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* ---------------- table ---------------- */

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search, 180);

  const [deptFilter, setDeptFilter] = useState("ALL");

  const [sort, setSort] = useState({
    key: "name",
    dir: "asc",
  });

  const [page, setPage] = useState(1);

  const [pageSize, setPageSize] = useState(() =>
    store.get("wos.pageSize", 6)
  );

  const [selected, setSelected] = useState(() => new Set());

  /* ---------------- preferences ---------------- */

  const [theme, setTheme] = useState(() =>
    store.get("wos.theme", "dark")
  );

  const [accent, setAccent] = useState(() =>
    store.get("wos.accent", "indigo")
  );

  const [density, setDensity] = useState(() =>
    store.get("wos.density", "comfortable")
  );

  const [activeNav, setActiveNav] = useState("employees");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ---------------- feedback ---------------- */

  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const searchRef = useRef(null);
  const firstFieldRef = useRef(null);
  const confirmRef = useRef(null);

  /* ---------------------------------------------------------------- */
  /* Toasts                                                           */
  /* ---------------------------------------------------------------- */

  const pushToast = useCallback((message, type = "success") => {
    const id = `${Date.now()}-${Math.random()}`;

    setToasts((current) => [
      ...current,
      {
        id,
        message,
        type,
      },
    ]);

    setTimeout(() => {
      setToasts((current) =>
        current.filter((toast) => toast.id !== id)
      );
    }, 4200);
  }, []);

  const dismissToast = (id) => {
    setToasts((current) =>
      current.filter((toast) => toast.id !== id)
    );
  };

  /* ---------------------------------------------------------------- */
  /* API - GET                                                        */
  /* ---------------------------------------------------------------- */

  const fetchEmployees = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error("Failed to fetch employees");
        }

        const data = await response.json();

        setEmployees(Array.isArray(data) ? data : []);
        setOffline(false);
      } catch (error) {
        console.error("GET /employees failed:", error);

        setOffline(true);

        pushToast(
          "Unable to reach the Spring Boot backend.",
          "error"
        );
      } finally {
        setLoading(false);
      }
    },
    [pushToast]
  );

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function loadEmployees() {
      try {
        setLoading(true);

        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error("Failed to fetch employees");
        }

        const data = await response.json();

        if (cancelled) return;

        setEmployees(Array.isArray(data) ? data : []);
        setOffline(false);
      } catch (error) {
        if (cancelled) return;

        console.error("GET /employees failed:", error);

        setOffline(true);

        pushToast(
          "Unable to reach the Spring Boot backend.",
          "error"
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadEmployees();

    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  /* ---------------------------------------------------------------- */
  /* Preferences                                                     */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    store.set("wos.theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    store.set("wos.accent", accent);
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    store.set("wos.density", density);
  }, [density]);

  useEffect(() => {
    store.set("wos.pageSize", pageSize);
  }, [pageSize]);

  /* ---------------------------------------------------------------- */
  /* Keyboard shortcuts                                               */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    function onKeyDown(event) {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(
        event.target.tagName
      );

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "k"
      ) {
        event.preventDefault();

        setActiveNav("employees");

        requestAnimationFrame(() => {
          searchRef.current?.focus();
        });

        return;
      }

      if (event.key === "Escape") {
        if (confirmState) {
          setConfirmState(null);
        } else if (drawerOpen) {
          closeDrawer();
        } else if (sidebarOpen) {
          setSidebarOpen(false);
        }

        return;
      }

      if (typing) return;

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        openCreate();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [confirmState, drawerOpen, sidebarOpen]);

  /* ---------------------------------------------------------------- */
  /* Focus management                                                 */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!drawerOpen) return;

    const timer = setTimeout(() => {
      firstFieldRef.current?.focus();
    }, 220);

    return () => clearTimeout(timer);
  }, [drawerOpen]);

  useEffect(() => {
    if (!confirmState) return;

    const timer = setTimeout(() => {
      confirmRef.current?.focus();
    }, 60);

    return () => clearTimeout(timer);
  }, [confirmState]);

  /* ---------------------------------------------------------------- */
  /* Derived data                                                     */
  /* ---------------------------------------------------------------- */

  const departments = useMemo(
    () =>
      [
        ...new Set(
          employees
            .map((item) => item.department)
            .filter(Boolean)
        ),
      ].sort(),
    [employees]
  );

  const totalPayroll = useMemo(
    () =>
      employees.reduce(
        (sum, item) => sum + Number(item.salary || 0),
        0
      ),
    [employees]
  );

  const avgSalary = employees.length
    ? Math.round(totalPayroll / employees.length)
    : 0;

  const medianSalary = useMemo(() => {
    if (!employees.length) return 0;

    const values = employees
      .map((item) => Number(item.salary || 0))
      .sort((a, b) => a - b);

    const middle = Math.floor(values.length / 2);

    if (values.length % 2) {
      return values[middle];
    }

    return Math.round(
      (values[middle - 1] + values[middle]) / 2
    );
  }, [employees]);

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    return employees.filter((employee) => {
      const haystack =
        `${employee.name} ${employee.email} ${employee.department}`.toLowerCase();

      const matchesQuery =
        !query || haystack.includes(query);

      const matchesDept =
        deptFilter === "ALL" ||
        employee.department === deptFilter;

      return matchesQuery && matchesDept;
    });
  }, [employees, debouncedSearch, deptFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];

    const { key, dir } = sort;

    list.sort((a, b) => {
      if (key === "salary" || key === "id") {
        const av = Number(a[key]) || 0;
        const bv = Number(b[key]) || 0;

        return dir === "asc"
          ? av - bv
          : bv - av;
      }

      const av = String(a[key] ?? "").toLowerCase();
      const bv = String(b[key] ?? "").toLowerCase();

      return dir === "asc"
        ? av.localeCompare(bv)
        : bv.localeCompare(av);
    });

    return list;
  }, [filtered, sort]);

  const pageCount = Math.max(
    1,
    Math.ceil(sorted.length / pageSize)
  );

  const currentPage = Math.min(page, pageCount);

  const paginated = useMemo(
    () =>
      sorted.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
      ),
    [sorted, currentPage, pageSize]
  );

  const deptBreakdown = useMemo(() => {
    const map = new Map();

    employees.forEach((employee) => {
      const key = employee.department || "Unassigned";

      const entry =
        map.get(key) || {
          label: key,
          value: 0,
          payroll: 0,
        };

      entry.value += 1;
      entry.payroll += Number(employee.salary || 0);

      map.set(key, entry);
    });

    return [...map.values()].sort(
      (a, b) => b.value - a.value
    );
  }, [employees]);

  const salaryBands = useMemo(() => {
    const bands = [
      {
        label: "Under ₹3 L",
        min: 0,
        max: 300000,
      },
      {
        label: "₹3 L – ₹6 L",
        min: 300000,
        max: 600000,
      },
      {
        label: "₹6 L – ₹10 L",
        min: 600000,
        max: 1000000,
      },
      {
        label: "₹10 L – ₹20 L",
        min: 1000000,
        max: 2000000,
      },
      {
        label: "₹20 L and above",
        min: 2000000,
        max: Infinity,
      },
    ];

    return bands.map((band) => ({
      label: band.label,

      value: employees.filter((employee) => {
        const salary = Number(employee.salary || 0);

        return (
          salary >= band.min &&
          salary < band.max
        );
      }).length,
    }));
  }, [employees]);

  const topEarners = useMemo(
    () =>
      [...employees]
        .sort(
          (a, b) =>
            Number(b.salary || 0) -
            Number(a.salary || 0)
        )
        .slice(0, 5),
    [employees]
  );

  const allOnPageSelected =
    paginated.length > 0 &&
    paginated.every((employee) =>
      selected.has(employee.id)
    );

  /* ---------------------------------------------------------------- */
  /* Form                                                             */
  /* ---------------------------------------------------------------- */

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setErrors({});
    setDrawerOpen(true);
  }

  function openEdit(employee) {
    setEditingId(employee.id);

    setForm({
      name: employee.name ?? "",
      email: employee.email ?? "",
      department: employee.department ?? "",
      salary: employee.salary ?? "",
    });

    setErrors({});
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);

    setTimeout(() => {
      setForm(EMPTY_FORM);
      setEditingId(null);
      setErrors({});
    }, 220);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
    }));
  }

  /* ---------------------------------------------------------------- */
  /* Backend validation error parser                                  */
  /* ---------------------------------------------------------------- */

  function handleServerErrors(data) {
    if (data?.errors) {
      setErrors(data.errors);
      return;
    }

    if (data?.message) {
      pushToast(data.message, "error");
      return;
    }

    pushToast(
      "The server rejected this request.",
      "error"
    );
  }

  /* ---------------------------------------------------------------- */
  /* CREATE / UPDATE                                                  */
  /* ---------------------------------------------------------------- */

  async function handleSubmit(event) {
    event.preventDefault();

    const clientErrors = validateForm(form);

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      department: form.department.trim(),
      salary: Number(form.salary),
      status: "ACTIVE",
    };


    try {
      setSaving(true);

      const isEditing = editingId !== null;

      const response = await fetch(
        isEditing
          ? `${API_URL}/${editingId}`
          : API_URL,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        handleServerErrors(data);
        return;
      }

      if (isEditing) {
        setEmployees((previous) =>
          previous.map((item) =>
            item.id === editingId ? data : item
          )
        );

        pushToast(
          `${data.name} updated successfully.`
        );
      } else {
        setEmployees((previous) => [
          ...previous,
          data,
        ]);

        pushToast(
          `${data.name} added to the directory.`
        );
      }

      closeDrawer();
    } catch (error) {
      console.error("Save employee failed:", error);

      pushToast(
        "Server error while saving the record.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Delete                                                           */
  /* ---------------------------------------------------------------- */

  function requestDelete(ids) {
    const list = Array.isArray(ids)
      ? ids
      : [ids];

    if (!list.length) return;

    setConfirmState({
      ids: list,

      title:
        list.length > 1
          ? `Delete ${list.length} records?`
          : "Delete this record?",

      message:
        list.length > 1
          ? "These employee records will be permanently removed from the backend. This cannot be undone."
          : "This employee record will be permanently removed from the backend. This cannot be undone.",
    });
  }

  async function runDelete() {
    if (!confirmState) return;

    const ids = confirmState.ids;

    setConfirmState(null);
    setSaving(true);

    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`${API_URL}/${id}`, {
            method: "DELETE",
          })
        )
      );

      const removed = ids.filter(
        (_, index) =>
          results[index].status === "fulfilled" &&
          results[index].value.ok
      );

      const failedCount =
        ids.length - removed.length;

      if (removed.length) {
        setEmployees((previous) =>
          previous.filter(
            (item) => !removed.includes(item.id)
          )
        );

        setSelected((previous) => {
          const next = new Set(previous);

          removed.forEach((id) =>
            next.delete(id)
          );

          return next;
        });

        if (
          editingId &&
          removed.includes(editingId)
        ) {
          closeDrawer();
        }

        pushToast(
          removed.length > 1
            ? `${removed.length} records deleted.`
            : "Record deleted."
        );
      }

      if (failedCount) {
        pushToast(
          `${failedCount} deletion(s) failed.`,
          "error"
        );
      }
    } catch (error) {
      console.error("Delete failed:", error);

      pushToast(
        "Unable to delete the selected record(s).",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Selection                                                        */
  /* ---------------------------------------------------------------- */

  function toggleRow(id) {
    setSelected((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function togglePageSelection() {
    setSelected((previous) => {
      const next = new Set(previous);

      if (allOnPageSelected) {
        paginated.forEach((employee) =>
          next.delete(employee.id)
        );
      } else {
        paginated.forEach((employee) =>
          next.add(employee.id)
        );
      }

      return next;
    });
  }

  /* ---------------------------------------------------------------- */
  /* CSV export                                                       */
  /* ---------------------------------------------------------------- */

  function exportCsv() {
    if (!sorted.length) {
      pushToast(
        "Nothing to export with the current filters.",
        "error"
      );

      return;
    }

    const header = [
      "ID",
      "Name",
      "Email",
      "Department",
      "Salary",
    ];

    const rows = sorted.map((employee) => [
      employee.id,
      employee.name,
      employee.email,
      employee.department,
      employee.salary,
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map(
            (cell) =>
              `"${String(cell ?? "").replace(
                /"/g,
                '""'
              )}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = `workforce-export-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    pushToast(
      `Exported ${sorted.length} records to CSV.`
    );
  }

  /* ---------------------------------------------------------------- */
  /* Sorting                                                          */
  /* ---------------------------------------------------------------- */

  function applySort(key) {
    setSort((previous) =>
      previous.key === key
        ? {
          key,
          dir:
            previous.dir === "asc"
              ? "desc"
              : "asc",
        }
        : {
          key,
          dir: "asc",
        }
    );
  }

  const navItems = [
    {
      id: "employees",
      label: "Directory",
      icon: "▤",
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: "◲",
    },
    {
      id: "settings",
      label: "Configuration",
      icon: "◇",
    },
  ];

  const pageWindow = useMemo(() => {
    const span = 5;

    let start = Math.max(
      1,
      currentPage - Math.floor(span / 2)
    );

    const end = Math.min(
      pageCount,
      start + span - 1
    );

    start = Math.max(
      1,
      end - span + 1
    );

    return Array.from(
      {
        length: end - start + 1,
      },
      (_, index) => start + index
    );
  }, [currentPage, pageCount]);

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="app-shell">

      {/* Toasts */}
      <div
        className="toast-stack"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast ${toast.type}`}
          >
            <span className="toast-icon">
              {toast.type === "success"
                ? "✓"
                : "!"}
            </span>

            <span className="toast-message">
              {toast.message}
            </span>

            {/* FIXED: removed accidental "10" */}
            <button
              type="button"
              className="toast-close"
              onClick={() =>
                dismissToast(toast.id)
              }
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <div
          className="overlay"
          onClick={() =>
            setConfirmState(null)
          }
        >
          <div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-icon">
              ⚠
            </div>

            <h3>{confirmState.title}</h3>

            <p>{confirmState.message}</p>

            <div className="modal-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  setConfirmState(null)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn danger"
                ref={confirmRef}
                onClick={runDelete}
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form drawer */}
      <div
        className={`drawer-layer ${drawerOpen ? "open" : ""
          }`}
      >
        <div
          className="overlay plain"
          onClick={closeDrawer}
        />

        <aside
          className="drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Employee form"
        >
          <header className="drawer-head">
            <div>
              <h2>
                {editingId
                  ? "Edit employee"
                  : "New employee"}
              </h2>

              <p>
                {editingId
                  ? `Updating record #${editingId}`
                  : "Add a team member to the directory"}
              </p>
            </div>

            <button
              type="button"
              className="icon-btn"
              onClick={closeDrawer}
              aria-label="Close panel"
            >
              ×
            </button>
          </header>

          <form
            className="drawer-body"
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="field">
              <label htmlFor="name">
                Full name
              </label>

              <input
                id="name"
                ref={firstFieldRef}
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="Sarah Jenkins"
                className={
                  errors.name
                    ? "invalid"
                    : ""
                }
              />

              {errors.name && (
                <span className="field-error">
                  {errors.name}
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor="email">
                Work email
              </label>

              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="sarah.jenkins@company.com"
                className={
                  errors.email
                    ? "invalid"
                    : ""
                }
              />

              {errors.email && (
                <span className="field-error">
                  {errors.email}
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor="department">
                Department
              </label>

              <input
                id="department"
                name="department"
                type="text"
                list="department-hints"
                value={form.department}
                onChange={handleChange}
                placeholder="Engineering"
                className={
                  errors.department
                    ? "invalid"
                    : ""
                }
              />

              <datalist id="department-hints">
                {[
                  ...new Set([
                    ...departments,
                    ...DEPARTMENT_HINTS,
                  ]),
                ].map((dept) => (
                  <option
                    key={dept}
                    value={dept}
                  />
                ))}
              </datalist>

              {errors.department && (
                <span className="field-error">
                  {errors.department}
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor="salary">
                Annual salary (INR)
              </label>

              <input
                id="salary"
                name="salary"
                type="number"
                min="0"
                step="1000"
                value={form.salary}
                onChange={handleChange}
                placeholder="950000"
                className={
                  errors.salary
                    ? "invalid"
                    : ""
                }
              />

              {errors.salary ? (
                <span className="field-error">
                  {errors.salary}
                </span>
              ) : (
                form.salary && (
                  <span className="field-hint">
                    {inrCompact(form.salary)}{" "}
                    per year
                  </span>
                )
              )}
            </div>

            <div className="drawer-preview">
              <Avatar
                name={
                  form.name || "New Member"
                }
                size="lg"
              />

              <div>
                <strong>
                  {form.name ||
                    "New team member"}
                </strong>

                <span>
                  {form.department ||
                    "Department pending"}
                </span>
              </div>
            </div>

            <footer className="drawer-foot">
              <button
                type="button"
                className="btn ghost"
                onClick={closeDrawer}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn primary"
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Create record"}
              </button>
            </footer>
          </form>
        </aside>
      </div>

      {/* Sidebar */}
      <div
        className={`sidebar-scrim ${sidebarOpen ? "show" : ""
          }`}
        onClick={() =>
          setSidebarOpen(false)
        }
      />

      <aside
        className={`sidebar ${sidebarOpen ? "open" : ""
          }`}
      >
        <div className="brand">
          <span className="brand-mark">
            W
          </span>

          <span className="brand-text">
            Workforce<em>OS</em>
          </span>
        </div>

        <nav className="side-nav">
          <span className="nav-caption">
            Workspace
          </span>

          {navItems.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`nav-link ${activeNav === item.id
                ? "active"
                : ""
                }`}
              onClick={() => {
                setActiveNav(item.id);
                setSidebarOpen(false);
              }}
            >
              <span className="nav-icon">
                {item.icon}
              </span>

              {item.label}
            </button>
          ))}
        </nav>

        <div className="side-card">
          <span className="side-card-label">
            Headcount
          </span>

          <strong>
            {employees.length}
          </strong>

          <span className="side-card-sub">
            {departments.length} active
            departments
          </span>
        </div>

        <div
          className={`status-pill ${offline ? "down" : "up"
            }`}
        >
          <span className="status-dot" />

          {offline
            ? "Backend unreachable"
            : "System operational"}
        </div>
      </aside>

      {/* Main */}
      <div className="main">

        {/* Topbar */}
        <header className="topbar">
          <button
            type="button"
            className="icon-btn menu-btn"
            onClick={() =>
              setSidebarOpen(true)
            }
            aria-label="Open navigation"
          >
            ☰
          </button>

          <div className="topbar-title">
            <h1>
              {activeNav === "employees"
                ? "Employee directory"
                : activeNav === "analytics"
                  ? "Payroll analytics"
                  : "Configuration"}
            </h1>

            <p>
              {activeNav === "employees"
                ? "Create, review and maintain your workforce records."
                : activeNav === "analytics"
                  ? "Distribution insights computed across live backend data."
                  : "Interface preferences and connection details."}
            </p>
          </div>

          <div className="topbar-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={() =>
                fetchEmployees({
                  silent: true,
                })
              }
              title="Refresh data"
              aria-label="Refresh data"
            >
              ⟳
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={() =>
                setTheme(
                  theme === "dark"
                    ? "light"
                    : "dark"
                )
              }
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === "dark"
                ? "☀"
                : "☾"}
            </button>

            <button
              type="button"
              className="btn primary compact"
              onClick={openCreate}
            >
              + Add employee
            </button>

            <div className="account-chip">
              <Avatar
                name="Admin User"
                size="sm"
              />

              <div className="account-meta">
                <strong>Admin</strong>
                <span>Owner</span>
              </div>
            </div>
          </div>
        </header>

        <main className="content">

          {/* Backend connection error */}
          {offline && (
            <div className="alert">
              <strong>
                Connection lost.
              </strong>{" "}
              The API at{" "}
              <code>{API_URL}</code>{" "}
              did not respond. Start the
              Spring Boot service, then
              refresh.

              <button
                type="button"
                className="btn ghost tiny"
                onClick={() =>
                  fetchEmployees()
                }
              >
                Retry
              </button>
            </div>
          )}

          {/* ====================================================== */}
          {/* DIRECTORY                                               */}
          {/* ====================================================== */}

          {activeNav === "employees" && (
            <>
              <section className="stat-grid">
                <article className="stat-card">
                  <span className="stat-label">
                    Total headcount
                  </span>

                  <span className="stat-value">
                    {employees.length}
                  </span>

                  <span className="stat-sub">
                    {filtered.length} matching
                    current filters
                  </span>
                </article>

                <article className="stat-card">
                  <span className="stat-label">
                    Annual payroll
                  </span>

                  <span className="stat-value">
                    {inrCompact(
                      totalPayroll
                    )}
                  </span>

                  <span className="stat-sub">
                    {inr(totalPayroll)}
                  </span>
                </article>

                <article className="stat-card">
                  <span className="stat-label">
                    Average compensation
                  </span>

                  <span className="stat-value">
                    {inrCompact(avgSalary)}
                  </span>

                  <span className="stat-sub">
                    Median{" "}
                    {inrCompact(
                      medianSalary
                    )}
                  </span>
                </article>

                <article className="stat-card">
                  <span className="stat-label">
                    Departments
                  </span>

                  <span className="stat-value">
                    {departments.length}
                  </span>

                  <span className="stat-sub">
                    Largest:{" "}
                    {deptBreakdown[0]
                      ?.label ?? "—"}
                  </span>
                </article>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>
                      Directory index
                    </h2>

                    <p>
                      {sorted.length} record
                      {sorted.length === 1
                        ? ""
                        : "s"}{" "}
                      · page{" "}
                      {currentPage} of{" "}
                      {pageCount}
                    </p>
                  </div>

                  <div className="toolbar">
                    <div className="search-wrap">
                      <span className="search-icon">
                        ⌕
                      </span>

                      <input
                        ref={searchRef}
                        className="search-input"
                        type="search"
                        placeholder="Search name, email or department"
                        value={search}
                        onChange={(event) =>
                          setSearch(
                            event.target.value
                          )
                        }
                      />

                      <kbd className="search-kbd">
                        /
                      </kbd>
                    </div>

                    <select
                      className="select"
                      value={deptFilter}
                      onChange={(event) =>
                        setDeptFilter(
                          event.target.value
                        )
                      }
                      aria-label="Filter by department"
                    >
                      <option value="ALL">
                        All departments
                      </option>

                      {departments.map(
                        (dept) => (
                          <option
                            key={dept}
                            value={dept}
                          >
                            {dept}
                          </option>
                        )
                      )}
                    </select>

                    <button
                      type="button"
                      className="btn ghost"
                      onClick={exportCsv}
                    >
                      ↓ Export CSV
                    </button>
                  </div>
                </div>

                {selected.size > 0 && (
                  <div className="bulk-bar">
                    <span>
                      <strong>
                        {selected.size}
                      </strong>{" "}
                      selected
                    </span>

                    <div className="bulk-actions">
                      <button
                        type="button"
                        className="btn ghost tiny"
                        onClick={() =>
                          setSelected(
                            new Set()
                          )
                        }
                      >
                        Clear
                      </button>

                      <button
                        type="button"
                        className="btn danger tiny"
                        onClick={() =>
                          requestDelete([
                            ...selected,
                          ])
                        }
                      >
                        Delete selected
                      </button>
                    </div>
                  </div>
                )}

                {loading ? (
                  <SkeletonRows rows={5} />
                ) : sorted.length === 0 ? (
                  <EmptyState
                    title={
                      employees.length
                        ? "No matching records"
                        : "Directory is empty"
                    }
                    message={
                      employees.length
                        ? "Try a different search term or clear the department filter."
                        : "Add your first employee to start building the directory."
                    }
                    action={
                      employees.length ? (
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() => {
                            setSearch("");
                            setDeptFilter(
                              "ALL"
                            );
                          }}
                        >
                          Clear filters
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn primary"
                          onClick={
                            openCreate
                          }
                        >
                          + Add employee
                        </button>
                      )
                    }
                  />
                ) : (
                  <>
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th className="checkbox-col">
                              <input
                                type="checkbox"
                                className="checkbox"
                                checked={
                                  allOnPageSelected
                                }
                                onChange={
                                  togglePageSelection
                                }
                                aria-label="Select all rows on this page"
                              />
                            </th>

                            <SortHeader
                              label="Employee"
                              sortKey="name"
                              sort={sort}
                              onSort={
                                applySort
                              }
                            />

                            <SortHeader
                              label="Department"
                              sortKey="department"
                              sort={sort}
                              onSort={
                                applySort
                              }
                            />

                            <SortHeader
                              label="Compensation"
                              sortKey="salary"
                              sort={sort}
                              onSort={
                                applySort
                              }
                            />

                            <th className="align-right">
                              Actions
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {paginated.map(
                            (
                              employee,
                              index
                            ) => (
                              <tr
                                key={
                                  employee.id
                                }
                                className={
                                  selected.has(
                                    employee.id
                                  )
                                    ? "selected"
                                    : ""
                                }
                                style={{
                                  animationDelay: `${index *
                                    28
                                    }ms`,
                                }}
                              >
                                <td className="checkbox-col">
                                  <input
                                    type="checkbox"
                                    className="checkbox"
                                    checked={selected.has(
                                      employee.id
                                    )}
                                    onChange={() =>
                                      toggleRow(
                                        employee.id
                                      )
                                    }
                                    aria-label={`Select ${employee.name}`}
                                  />
                                </td>

                                <td>
                                  <div className="identity">
                                    <Avatar
                                      name={
                                        employee.name
                                      }
                                    />

                                    <div className="identity-text">
                                      <span className="identity-name">
                                        {
                                          employee.name
                                        }
                                      </span>

                                      <span className="identity-mail">
                                        {
                                          employee.email
                                        }
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                <td>
                                  <span
                                    className="badge"
                                    style={{
                                      "--hue":
                                        hueOf(
                                          employee.department
                                        ),
                                    }}
                                  >
                                    {
                                      employee.department
                                    }
                                  </span>
                                </td>

                                <td>
                                  <span className="salary">
                                    {inr(
                                      employee.salary
                                    )}
                                  </span>

                                  <span className="salary-sub">
                                    {inrCompact(
                                      employee.salary
                                    )}
                                  </span>
                                </td>

                                <td>
                                  <div className="row-actions">
                                    <button
                                      type="button"
                                      className="btn ghost tiny"
                                      onClick={() =>
                                        openEdit(
                                          employee
                                        )
                                      }
                                    >
                                      Edit
                                    </button>

                                    <button
                                      type="button"
                                      className="btn danger tiny"
                                      onClick={() =>
                                        requestDelete(
                                          employee.id
                                        )
                                      }
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="pagination">
                      <div className="page-size">
                        <label htmlFor="page-size">
                          Rows
                        </label>

                        <select
                          id="page-size"
                          className="select tiny"
                          value={pageSize}
                          onChange={(event) =>
                            setPageSize(
                              Number(
                                event.target
                                  .value
                              )
                            )
                          }
                        >
                          {PAGE_SIZES.map(
                            (size) => (
                              <option
                                key={size}
                                value={size}
                              >
                                {size}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div className="page-controls">
                        <button
                          type="button"
                          className="page-btn"
                          disabled={
                            currentPage ===
                            1
                          }
                          onClick={() =>
                            setPage(
                              currentPage - 1
                            )
                          }
                        >
                          ‹
                        </button>

                        {pageWindow.map(
                          (number) => (
                            <button
                              type="button"
                              key={number}
                              className={`page-btn ${number ===
                                currentPage
                                ? "active"
                                : ""
                                }`}
                              onClick={() =>
                                setPage(number)
                              }
                            >
                              {number}
                            </button>
                          )
                        )}

                        <button
                          type="button"
                          className="page-btn"
                          disabled={
                            currentPage ===
                            pageCount
                          }
                          onClick={() =>
                            setPage(
                              currentPage + 1
                            )
                          }
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </>
          )}

          {/* ====================================================== */}
          {/* ANALYTICS                                               */}
          {/* ====================================================== */}

          {activeNav === "analytics" && (
            <div className="analytics-grid">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>
                      Headcount by department
                    </h2>

                    <p>
                      Distribution of active
                      records
                    </p>
                  </div>
                </div>

                {deptBreakdown.length ? (
                  <BarList
                    items={
                      deptBreakdown
                    }
                    formatter={(item) =>
                      `${item.value} · ${inrCompact(
                        item.payroll
                      )}`
                    }
                  />
                ) : (
                  <EmptyState
                    title="No data yet"
                    message="Department analytics appear once records exist."
                  />
                )}
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>
                      Salary bands
                    </h2>

                    <p>
                      Employees grouped by
                      annual compensation
                    </p>
                  </div>
                </div>

                <BarList
                  items={salaryBands}
                  formatter={(item) =>
                    `${item.value}`
                  }
                />
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>
                      Top earners
                    </h2>

                    <p>
                      Highest annual
                      compensation
                    </p>
                  </div>
                </div>

                {topEarners.length ? (
                  <ul className="rank-list">
                    {topEarners.map(
                      (
                        employee,
                        index
                      ) => (
                        <li
                          key={
                            employee.id
                          }
                        >
                          <span className="rank-index">
                            {index + 1}
                          </span>

                          <Avatar
                            name={
                              employee.name
                            }
                          />

                          <div className="rank-text">
                            <strong>
                              {
                                employee.name
                              }
                            </strong>

                            <span>
                              {
                                employee.department
                              }
                            </span>
                          </div>

                          <span className="rank-value">
                            {inrCompact(
                              employee.salary
                            )}
                          </span>
                        </li>
                      )
                    )}
                  </ul>
                ) : (
                  <EmptyState
                    title="No records"
                    message="Add employees to see rankings."
                  />
                )}
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>
                      Payroll summary
                    </h2>

                    <p>
                      Aggregated across all
                      records
                    </p>
                  </div>
                </div>

                <dl className="summary-list">
                  <div>
                    <dt>
                      Cumulative annual spend
                    </dt>

                    <dd>
                      {inr(
                        totalPayroll
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Average compensation
                    </dt>

                    <dd>
                      {inr(avgSalary)}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Median compensation
                    </dt>

                    <dd>
                      {inr(
                        medianSalary
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Monthly run rate
                    </dt>

                    <dd>
                      {inrCompact(
                        Math.round(
                          totalPayroll /
                          12
                        )
                      )}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          )}

          {/* ====================================================== */}
          {/* SETTINGS                                                */}
          {/* ====================================================== */}

          {activeNav === "settings" && (
            <div className="analytics-grid">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>
                      Appearance
                    </h2>

                    <p>
                      Preferences persist in
                      this browser
                    </p>
                  </div>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>
                      Theme
                    </strong>

                    <span>
                      Switch between dark and
                      light surfaces
                    </span>
                  </div>

                  <div className="segmented">
                    {[
                      "dark",
                      "light",
                    ].map((option) => (
                      <button
                        type="button"
                        key={option}
                        className={
                          theme === option
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setTheme(
                            option
                          )
                        }
                      >
                        {option ===
                          "dark"
                          ? "Dark"
                          : "Light"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>
                      Accent colour
                    </strong>

                    <span>
                      Applies to buttons,
                      links and highlights
                    </span>
                  </div>

                  <div className="swatches">
                    {ACCENTS.map(
                      (option) => (
                        <button
                          type="button"
                          key={option}
                          className={`swatch ${option} ${accent ===
                            option
                            ? "active"
                            : ""
                            }`}
                          onClick={() =>
                            setAccent(
                              option
                            )
                          }
                          aria-label={`Use ${option} accent`}
                        />
                      )
                    )}
                  </div>
                </div>

                <div className="setting-row">
                  <div>
                    <strong>
                      Density
                    </strong>

                    <span>
                      Row height and padding
                      across the app
                    </span>
                  </div>

                  <div className="segmented">
                    {[
                      "comfortable",
                      "compact",
                    ].map((option) => (
                      <button
                        type="button"
                        key={option}
                        className={
                          density ===
                            option
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setDensity(
                            option
                          )
                        }
                      >
                        {option ===
                          "comfortable"
                          ? "Comfortable"
                          : "Compact"}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>
                      Connection
                    </h2>

                    <p>
                      Backend service details
                    </p>
                  </div>
                </div>

                <dl className="summary-list">
                  <div>
                    <dt>
                      Endpoint
                    </dt>

                    <dd className="mono">
                      {API_URL}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Status
                    </dt>

                    <dd>
                      {offline
                        ? "Unreachable"
                        : "Connected"}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Records cached
                    </dt>

                    <dd>
                      {employees.length}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="btn ghost"
                  onClick={() =>
                    fetchEmployees()
                  }
                >
                  ⟳ Re-sync directory
                </button>
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>
                      Keyboard shortcuts
                    </h2>

                    <p>
                      Move faster without the
                      mouse
                    </p>
                  </div>
                </div>

                <ul className="shortcut-list">
                  <li>
                    <span>
                      Focus search
                    </span>

                    <span>
                      <kbd>Ctrl</kbd>+
                      <kbd>K</kbd> or{" "}
                      <kbd>/</kbd>
                    </span>
                  </li>

                  <li>
                    <span>
                      New employee
                    </span>

                    <span>
                      <kbd>N</kbd>
                    </span>
                  </li>

                  <li>
                    <span>
                      Close panel or dialog
                    </span>

                    <span>
                      <kbd>Esc</kbd>
                    </span>
                  </li>
                </ul>
              </section>
            </div>
          )}
        </main>

        <footer className="footer">
          <span>
            © {new Date().getFullYear()}{" "}
            WorkforceOS — internal HR
            platform
          </span>

          <div className="footer-links">
            <a href="#privacy">
              Privacy
            </a>

            <a href="#api">
              API docs
            </a>

            <a href="#support">
              Support
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
