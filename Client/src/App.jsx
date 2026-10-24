import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "http://localhost:5000/api";

const emptyTask = () => ({
  title: "",
  subject: "",
  description: "",
  dueDate: "",
  priority: "Medium",
  status: "Pending",
});

function readSavedUser() {
  try {
    return JSON.parse(localStorage.getItem("studysyncUser")) || null;
  } catch {
    return null;
  }
}

function formatDate(date) {
  if (!date) return "No date";
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(task) {
  if (task.status === "Completed") return false;

  const due = new Date(task.dueDate);
  const today = new Date();

  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return due < today;
}

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("studysyncToken") || ""
  );
  const [user, setUser] = useState(readSavedUser);

  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [savingTask, setSavingTask] = useState(false);

  const request = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      return data;
    },
    [token]
  );

  const loadTasks = useCallback(async () => {
    if (!token) return;

    setLoading(true);

    try {
      const data = await request("/tasks");
      setTasks(data);
    } catch (error) {
      setMessage(error.message);

      if (
        error.message.toLowerCase().includes("session") ||
        error.message.toLowerCase().includes("authentication")
      ) {
        logout();
      }
    } finally {
      setLoading(false);
    }
  }, [token, request]);

  useEffect(() => {
    if (token) loadTasks();
  }, [token, loadTasks]);

  async function handleAuth(event) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const endpoint =
        authMode === "login" ? "/auth/login" : "/auth/register";

      const data = await request(endpoint, {
        method: "POST",
        body: JSON.stringify(authForm),
      });

      localStorage.setItem("studysyncToken", data.token);
      localStorage.setItem("studysyncUser", JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);
      setAuthForm({ name: "", email: "", password: "" });
      setMessage("");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("studysyncToken");
    localStorage.removeItem("studysyncUser");

    setToken("");
    setUser(null);
    setTasks([]);
    setMessage("");
    setShowForm(false);
  }

  function openCreateForm() {
    setEditingId(null);
    setTaskForm(emptyTask());
    setShowForm(true);
    setMessage("");
  }

  function openEditForm(task) {
    setEditingId(task._id);
    setTaskForm({
      title: task.title,
      subject: task.subject,
      description: task.description || "",
      dueDate: String(task.dueDate).slice(0, 10),
      priority: task.priority,
      status: task.status,
    });
    setShowForm(true);
    setMessage("");
  }

  async function handleTaskSubmit(event) {
    event.preventDefault();
    setSavingTask(true);
    setMessage("");

    try {
      const editing = Boolean(editingId);

      await request(
        editing ? `/tasks/${editingId}` : "/tasks",
        {
          method: editing ? "PUT" : "POST",
          body: JSON.stringify(taskForm),
        }
      );

      setShowForm(false);
      setEditingId(null);
      setTaskForm(emptyTask());
      setMessage(editing ? "Task updated successfully." : "Task added successfully.");

      await loadTasks();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSavingTask(false);
    }
  }

  async function toggleTask(task) {
    const nextStatus =
      task.status === "Completed" ? "Pending" : "Completed";

    try {
      await request(`/tasks/${task._id}`, {
        method: "PUT",
        body: JSON.stringify({ status: nextStatus }),
      });

      setMessage(
        nextStatus === "Completed"
          ? "Great work! Task completed."
          : "Task moved back to pending."
      );

      await loadTasks();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;

    try {
      await request(`/tasks/${task._id}`, {
        method: "DELETE",
      });

      setMessage("Task deleted successfully.");
      await loadTasks();
    } catch (error) {
      setMessage(error.message);
    }
  }

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(
      (task) => task.status === "Completed"
    ).length;
    const pending = tasks.filter(
      (task) => task.status === "Pending"
    ).length;
    const overdue = tasks.filter(isOverdue).length;

    return {
      total,
      completed,
      pending,
      overdue,
      progress: total ? Math.round((completed / total) * 100) : 0,
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !query ||
        [task.title, task.subject, task.description]
          .some((value) => value?.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "All" || task.status === statusFilter;

      const matchesPriority =
        priorityFilter === "All" || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  if (!token) {
    return (
      <main className="auth-page">
        <div className="auth-decoration decoration-one" />
        <div className="auth-decoration decoration-two" />

        <section className="auth-panel">
          <a className="brand auth-brand" href="#home">
            <span className="brand-mark">S</span>
            <span>Study<span className="brand-accent">Sync</span></span>
          </a>

          <div className="auth-intro">
            <span className="eyebrow">YOUR PERSONAL STUDY SPACE</span>
            <h1>Make every study session count.</h1>
            <p>
              Organize your assignments, stay ahead of deadlines,
              and make steady progress toward your goals.
            </p>
          </div>

          <div className="auth-benefits">
            <div><span>✓</span> Keep all your assignments organized</div>
            <div><span>✓</span> Track deadlines and priorities</div>
            <div><span>✓</span> See your progress at a glance</div>
          </div>

          <p className="auth-footer">
            Small steps today. Big achievements tomorrow.
          </p>
        </section>

        <section className="auth-form-side">
          <div className="auth-card">
            <div className="auth-tabs">
              <button
                className={authMode === "login" ? "active" : ""}
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                }}
              >
                Sign in
              </button>
              <button
                className={authMode === "register" ? "active" : ""}
                onClick={() => {
                  setAuthMode("register");
                  setAuthError("");
                }}
              >
                Create account
              </button>
            </div>

            <h2>
              {authMode === "login" ? "Welcome back!" : "Join StudySync"}
            </h2>
            <p className="muted">
              {authMode === "login"
                ? "Enter your details to continue learning."
                : "Create your account and get organized."}
            </p>

            <form onSubmit={handleAuth} className="form-stack">
              {authMode === "register" && (
                <label>
                  Full name
                  <input
                    type="text"
                    placeholder="Your name"
                    value={authForm.name}
                    onChange={(event) =>
                      setAuthForm({ ...authForm, name: event.target.value })
                    }
                    required
                    autoComplete="name"
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={authForm.email}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, email: event.target.value })
                  }
                  required
                  autoComplete="email"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  placeholder="At least 8 characters"
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm({ ...authForm, password: event.target.value })
                  }
                  required
                  minLength={authMode === "register" ? 8 : undefined}
                  autoComplete={
                    authMode === "login" ? "current-password" : "new-password"
                  }
                />
              </label>

              {authError && <p className="error-message">{authError}</p>}

              <button className="primary-button auth-submit" disabled={authLoading}>
                {authLoading
                  ? "Please wait..."
                  : authMode === "login"
                  ? "Sign in to StudySync →"
                  : "Create my account →"}
              </button>
            </form>

            <p className="auth-switch">
              {authMode === "login"
                ? "New to StudySync?"
                : "Already have an account?"}{" "}
              <button
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  setAuthError("");
                }}
              >
                {authMode === "login" ? "Sign up" : "Sign in"}
              </button>
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand sidebar-brand" href="#dashboard">
          <span className="brand-mark">S</span>
          <span>Study<span className="brand-accent">Sync</span></span>
        </a>

        <span className="sidebar-caption">WORKSPACE</span>
        <a className="nav-link nav-active" href="#dashboard">
          <span>▦</span> Dashboard
        </a>
        <button className="nav-link" onClick={() => {
          setStatusFilter("All");
          setPriorityFilter("All");
          setSearch("");
        }}>
          <span>☷</span> All assignments
        </button>
        <button className="nav-link" onClick={() => setStatusFilter("Pending")}>
          <span>◷</span> Pending tasks
        </button>
        <button className="nav-link" onClick={() => setStatusFilter("Completed")}>
          <span>✓</span> Completed
        </button>

        <div className="sidebar-bottom">
          <div className="tip-card">
            <span className="tip-icon">✦</span>
            <strong>Stay consistent!</strong>
            <p>A little progress every day adds up to big results.</p>
          </div>
          <div className="profile-row">
            <div className="avatar">
              {(user?.name || user?.email || "S").charAt(0).toUpperCase()}
            </div>
            <div className="profile-details">
              <strong>{user?.name || "Student"}</strong>
              <span>{user?.email}</span>
            </div>
            <button className="logout-button" onClick={logout} title="Sign out">
              ↪
            </button>
          </div>
        </div>
      </aside>

      <section className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="topbar-date">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <h1>Good to see you, {user?.name?.split(" ")[0] || "Student"}! <span>✦</span></h1>
            <p className="muted">Here's what's happening with your studies today.</p>
          </div>
          <button className="primary-button add-button" onClick={openCreateForm}>
            <span>＋</span> Add assignment
          </button>
        </header>

        {message && (
          <div className="notice" role="status">
            <span>{message}</span>
            <button onClick={() => setMessage("")} aria-label="Dismiss message">×</button>
          </div>
        )}

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-top"><span className="stat-icon purple">▦</span><span className="stat-label">ALL TASKS</span></div>
            <strong>{stats.total}</strong>
            <p>Assignments in your workspace</p>
          </article>
          <article className="stat-card">
            <div className="stat-top"><span className="stat-icon orange">◷</span><span className="stat-label">PENDING</span></div>
            <strong>{stats.pending}</strong>
            <p>Tasks waiting to be done</p>
          </article>
          <article className="stat-card">
            <div className="stat-top"><span className="stat-icon green">✓</span><span className="stat-label">COMPLETED</span></div>
            <strong>{stats.completed}</strong>
            <p>Tasks you've finished</p>
          </article>
          <article className="stat-card">
            <div className="stat-top"><span className="stat-icon red">!</span><span className="stat-label">OVERDUE</span></div>
            <strong>{stats.overdue}</strong>
            <p>Tasks past their deadlines</p>
          </article>
        </section>

        <section className="progress-panel">
          <div className="progress-copy">
            <div>
              <span className="eyebrow">YOUR MOMENTUM</span>
              <h2>You're making progress.</h2>
              <p>Every assignment you finish is a step forward.</p>
            </div>
            <strong>{stats.progress}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${stats.progress}%` }} />
          </div>
          <div className="progress-footer">
            <span>{stats.completed} of {stats.total} tasks completed</span>
            <span>Keep it up ✦</span>
          </div>
        </section>

        <section className="tasks-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">STAY ON TRACK</span>
              <h2>Your assignments</h2>
            </div>
            <span className="task-count">{filteredTasks.length} tasks</span>
          </div>

          <div className="task-filters">
            <div className="search-box">
              <span>⌕</span>
              <input
                type="search"
                placeholder="Search assignments or subjects..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In progress</option>
              <option value="Completed">Completed</option>
            </select>
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="All">All priorities</option>
              <option value="High">High priority</option>
              <option value="Medium">Medium priority</option>
              <option value="Low">Low priority</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">
              <div className="empty-icon">◌</div>
              <h3>Loading your assignments...</h3>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✎</div>
              <h3>{tasks.length ? "No matching assignments" : "Your study space is ready!"}</h3>
              <p>
                {tasks.length
                  ? "Try changing your search or filters."
                  : "Add your first assignment and start organizing your goals."}
              </p>
              {!tasks.length && (
                <button className="primary-button" onClick={openCreateForm}>
                  ＋ Add your first assignment
                </button>
              )}
            </div>
          ) : (
            <div className="task-list">
              {filteredTasks.map((task) => (
                <article className={`task-card ${task.status === "Completed" ? "task-done" : ""}`} key={task._id}>
                  <button
                    className={`task-check ${task.status === "Completed" ? "checked" : ""}`}
                    title={task.status === "Completed" ? "Mark as pending" : "Mark as completed"}
                    onClick={() => toggleTask(task)}
                  >
                    {task.status === "Completed" ? "✓" : ""}
                  </button>

                  <div className="task-details">
                    <h3>{task.title}</h3>
                    <p>{task.subject}{task.description ? ` · ${task.description}` : ""}</p>
                    <div className="task-meta">
                      <span>▦ {formatDate(task.dueDate)}</span>
                      {isOverdue(task) && <span className="overdue-label">Overdue</span>}
                      <span className={`priority priority-${task.priority.toLowerCase()}`}>
                        {task.priority} priority
                      </span>
                      <span className={`status status-${task.status.toLowerCase().replace(" ", "-")}`}>
                        {task.status}
                      </span>
                    </div>
                  </div>

                  <div className="task-actions">
                    <button onClick={() => openEditForm(task)} title="Edit task">✎</button>
                    <button onClick={() => deleteTask(task)} title="Delete task">⌫</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="page-footer">
          Made for your next big achievement <span>✦</span>
        </footer>
      </section>

      {showForm && (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowForm(false);
        }}>
          <section className="task-modal">
            <div className="modal-header">
              <div>
                <span className="eyebrow">{editingId ? "REFINE YOUR PLAN" : "PLAN YOUR PROGRESS"}</span>
                <h2>{editingId ? "Edit assignment" : "Add an assignment"}</h2>
              </div>
              <button className="modal-close" onClick={() => setShowForm(false)} aria-label="Close">×</button>
            </div>

            <form className="form-stack" onSubmit={handleTaskSubmit}>
              <label>
                Assignment title
                <input
                  value={taskForm.title}
                  onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
                  placeholder="e.g. Complete DAA worksheet"
                  maxLength={120}
                  required
                />
              </label>

              <label>
                Subject
                <input
                  value={taskForm.subject}
                  onChange={(event) => setTaskForm({ ...taskForm, subject: event.target.value })}
                  placeholder="e.g. Design and Analysis of Algorithms"
                  maxLength={100}
                  required
                />
              </label>

              <label>
                Description <span className="optional">(optional)</span>
                <textarea
                  value={taskForm.description}
                  onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })}
                  placeholder="Add a few details..."
                  rows={3}
                />
              </label>

              <div className="form-row">
                <label>
                  Due date
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })}
                    required
                  />
                </label>

                <label>
                  Priority
                  <select
                    value={taskForm.priority}
                    onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>
              </div>

              <label>
                Status
                <select
                  value={taskForm.status}
                  onChange={(event) => setTaskForm({ ...taskForm, status: event.target.value })}
                >
                  <option>Pending</option>
                  <option>In Progress</option>
                  <option>Completed</option>
                </select>
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button className="primary-button" disabled={savingTask}>
                  {savingTask ? "Saving..." : editingId ? "Save changes" : "Create assignment"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;