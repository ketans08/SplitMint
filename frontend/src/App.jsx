import { useEffect, useMemo, useState } from "react";
import "./styles/app.css";
import {
  authApi,
  groupApi,
  participantApi,
  expenseApi,
  inviteApi,
} from "./api.js";

const emptyExpense = {
  description: "",
  category: "uncategorized",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  payerId: "",
  splitMode: "equal",
  splits: {},
};

const categoryOptions = [
  "uncategorized",
  "food",
  "transport",
  "lodging",
  "groceries",
  "entertainment",
  "gifts",
  "utilities",
];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteLinks, setInviteLinks] = useState([]);
  const [toasts, setToasts] = useState([]);

  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupData, setGroupData] = useState(null);
  const [groupError, setGroupError] = useState("");

  const [filters, setFilters] = useState({
    q: "",
    participantId: "",
    start: "",
    end: "",
    min: "",
    max: "",
  });
  const [expenses, setExpenses] = useState([]);

  const [newGroupName, setNewGroupName] = useState("");
  const [newParticipant, setNewParticipant] = useState({
    name: "",
    email: "",
    color: "",
  });
  const [expenseForm, setExpenseForm] = useState(emptyExpense);
  const [editingExpense, setEditingExpense] = useState(null);

  const resetExpenseForm = () =>
    setExpenseForm({
      ...emptyExpense,
      date: new Date().toISOString().slice(0, 10),
    });

  const refreshGroup = async (id = selectedGroupId) => {
    if (!id) return;
    const data = await groupApi.get(id);
    setGroupData(data);
    setExpenses(data.expenses || []);
    if (data.group?.participants?.length) {
      setExpenseForm((prev) => ({
        ...prev,
        payerId: data.group.participants[0]._id,
      }));
    }
  };

  const clearInviteFromUrl = () => {
    setInviteToken("");
    window.history.replaceState({}, "", window.location.pathname);
  };

  const showToast = (msg, type = "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const closeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("invite");
    if (token) setInviteToken(token);
  }, []);

  useEffect(() => {
    if (!token) return;
    groupApi
      .list()
      .then((data) => {
        const sorted = data.groups.sort((a, b) => {
          if (a._id === "all") return -1;
          if (b._id === "all") return 1;
          return 0;
        });
        setGroups(sorted);
        if (sorted.length && !selectedGroupId)
          setSelectedGroupId(sorted[0]._id);
      })
      .catch(() => setGroups([]));
  }, [token]);

  useEffect(() => {
    if (!selectedGroupId) return;
    refreshGroup(selectedGroupId).catch((err) => setGroupError(err.message));
  }, [selectedGroupId]);

  useEffect(() => {
    if (!token || !inviteToken) return;
    inviteApi
      .accept({ token: inviteToken })
      .then(() => {
        setInviteStatus("Invite accepted. You now have access to the group.");
        clearInviteFromUrl();
        groupApi.list().then((data) => setGroups(data.groups));
      })
      .catch((err) => {
        setInviteStatus(err.message || "Invite could not be accepted");
        clearInviteFromUrl();
      });
  }, [token, inviteToken]);

  const participants = groupData?.group?.participants || [];
  const settlements = groupData?.summary?.settlements || [];
  const balances = groupData?.summary?.balances || [];
  const isVirtualGroup = groupData?.group?.isVirtual === true;

  const totalSpent = groupData?.summary?.totalSpent || 0;
  const owedByUser = useMemo(() => {
    const you = balances.find((b) => b.participant.userId === user?.id);
    if (!you) return 0;
    return you.net < 0 ? Math.abs(you.net) : 0;
  }, [balances, user]);

  const owedToUser = useMemo(() => {
    const you = balances.find((b) => b.participant.userId === user?.id);
    if (!you) return 0;
    return you.net > 0 ? you.net : 0;
  }, [balances, user]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      const data =
        authMode === "login"
          ? await authApi.login(payload)
          : await authApi.register(payload);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      setGroupData(null);
      setSelectedGroupId("");
      const list = await groupApi.list();
      setGroups(list.groups);
      if (list.groups.length) setSelectedGroupId(list.groups[0]._id);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
    setGroups([]);
    setGroupData(null);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const data = await groupApi.create({ name: newGroupName.trim() });
      setGroups((prev) => [data.group, ...prev]);
      setSelectedGroupId(data.group._id);
      setNewGroupName("");
      showToast("Group created", "success");
    } catch (err) {
      showToast(err.message || "Could not create group", "error");
    }
  };

  const handleGroupRename = async () => {
    const name = window.prompt("New group name?", groupData?.group?.name || "");
    if (!name) return;
    try {
      const data = await groupApi.update(groupData.group._id, { name });
      setGroups((prev) =>
        prev.map((g) => (g._id === data.group._id ? data.group : g)),
      );
      await refreshGroup(groupData.group._id);
      showToast("Group renamed", "success");
    } catch (err) {
      showToast(err.message || "Could not rename group", "error");
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm("Delete this group and all data?")) return;
    try {
      await groupApi.remove(groupData.group._id);
      const remaining = groups.filter((g) => g._id !== groupData.group._id);
      setGroups(remaining);
      setGroupData(null);
      setSelectedGroupId(remaining[0]?._id || "");
      showToast("Group deleted", "success");
    } catch (err) {
      showToast(err.message || "Could not delete group", "error");
    }
  };

  const handleAddParticipant = async () => {
    if (!newParticipant.name.trim() || !newParticipant.email.trim()) return;
    try {
      const email = newParticipant.email.trim().toLowerCase();
      const data = await participantApi.create({
        groupId: groupData.group._id,
        name: newParticipant.name.trim(),
        email,
        color: newParticipant.color || "#4b5563",
      });
      await refreshGroup(groupData.group._id);
      setNewParticipant({ name: "", email: "", color: "" });
      showToast("Participant added", "success");
      if (data.inviteToken) {
        const link = `${window.location.origin}/?invite=${data.inviteToken}`;
        setInviteLinks((prev) => [{ email, link }, ...prev]);
        if (navigator?.clipboard?.writeText) {
          navigator.clipboard.writeText(link);
        }
      }
    } catch (err) {
      showToast(err.message || "Could not add participant", "error");
    }
  };

  const handleEditParticipant = async (participant) => {
    const name = window.prompt("Participant name", participant.name);
    if (!name) return;
    try {
      await participantApi.update(participant._id, { name });
      await refreshGroup(groupData.group._id);
      showToast("Participant updated", "success");
    } catch (err) {
      showToast(err.message || "Could not update participant", "error");
    }
  };

  const handleRemoveParticipant = async (participant) => {
    if (!window.confirm("Remove participant and related expenses?")) return;
    try {
      await participantApi.remove(participant._id);
      await refreshGroup(groupData.group._id);
      showToast("Participant removed", "success");
    } catch (err) {
      showToast(err.message || "Could not remove participant", "error");
    }
  };

  const buildSplitsPayload = (form) => {
    if (form.splitMode === "equal") return undefined;
    return participants.map((p) => ({
      participantId: p._id,
      value: Number(form.splits[p._id] || 0),
    }));
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        groupId: groupData.group._id,
        description: expenseForm.description,
        category: expenseForm.category,
        amount: Number(expenseForm.amount),
        date: expenseForm.date,
        payerId: expenseForm.payerId,
        splitMode: expenseForm.splitMode,
        splits: buildSplitsPayload(expenseForm),
      };
      await expenseApi.create(payload);
      await refreshGroup(groupData.group._id);
      resetExpenseForm();
      showToast("Expense added", "success");
    } catch (err) {
      showToast(err.message || "Could not add expense", "error");
    }
  };

  const handleUpdateExpense = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        description: expenseForm.description,
        category: expenseForm.category,
        amount: Number(expenseForm.amount),
        date: expenseForm.date,
        payerId: expenseForm.payerId,
        splitMode: expenseForm.splitMode,
        splits: buildSplitsPayload(expenseForm),
      };
      await expenseApi.update(editingExpense._id, payload);
      await refreshGroup(groupData.group._id);
      setEditingExpense(null);
      resetExpenseForm();
      showToast("Expense updated", "success");
    } catch (err) {
      showToast(err.message || "Could not update expense", "error");
    }
  };

  const handleEditExpense = (expense) => {
    const splits = {};
    expense.splits.forEach((s) => {
      splits[s.participant._id] =
        expense.splitMode === "percentage"
          ? ((s.amount / expense.amount) * 100).toFixed(2)
          : s.amount;
    });
    setExpenseForm({
      description: expense.description,
      category: expense.category || "uncategorized",
      amount: expense.amount,
      date: new Date(expense.date).toISOString().slice(0, 10),
      payerId: expense.payer._id,
      splitMode: expense.splitMode,
      splits,
    });
    setEditingExpense(expense);
  };

  const handleDeleteExpense = async (expense) => {
    if (!window.confirm("Delete this expense?")) return;
    try {
      await expenseApi.remove(expense._id);
      await refreshGroup(groupData.group._id);
      showToast("Expense deleted", "success");
    } catch (err) {
      showToast(err.message || "Could not delete expense", "error");
    }
  };

  const applyFilters = async () => {
    try {
      const data = await expenseApi.list({
        groupId: groupData.group._id,
        ...filters,
      });
      setExpenses(data.expenses);
      await refreshGroup(groupData.group._id);
    } catch (err) {
      showToast(err.message || "Could not apply filters", "error");
    }
  };

  if (!token) {
    return (
      <div className="app">
        <header>
          <div className="header-inner">
            <div></div>
            <div className="brand">SplitMint � Your Gateway to Karbon</div>
            <div className="header-actions"></div>
          </div>
        </header>
        <div className="auth-center">
          <div className="card" style={{ maxWidth: 420, width: "100%" }}>
            <div className="section-title">
              {authMode === "login" ? "Login" : "Register"}
            </div>
            {inviteToken && (
              <div
                className="notice"
                style={{
                  background: "rgba(34, 197, 94, 0.2)",
                  color: "#bbf7d0",
                }}
              >
                You were invited to join a group. Register or log in with this
                email to accept the invite.
              </div>
            )}
            <form className="stack" onSubmit={handleAuth}>
              <input name="email" type="email" placeholder="Email" required />
              <input
                name="password"
                type="password"
                placeholder="Password"
                required
              />
              {authMode === "register" && (
                <input name="name" placeholder="Name" />
              )}
              {authError && <div className="notice">{authError}</div>}
              <button type="submit">Continue</button>
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setAuthMode(authMode === "login" ? "register" : "login")
                }
              >
                Switch to {authMode === "login" ? "Register" : "Login"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <span>{t.msg}</span>
            <button className="toast-close" onClick={() => closeToast(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
      <header>
        <div className="header-inner">
          <div></div>
          <div className="brand">SplitMint � Your Gateway to Karbon</div>
          <div className="header-actions">
            <span className="muted">{user?.email}</span>
            <button className="ghost" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>
      <div className="container">
        <div className="stack">
          <div className="card">
            <div className="section-title">Groups</div>
            <div className="stack">
              <div className="list">
                {groups.map((g) => (
                  <button
                    key={g._id}
                    className={
                      selectedGroupId === g._id ? "secondary" : "ghost"
                    }
                    onClick={() => setSelectedGroupId(g._id)}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
              <div className="form-row">
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="New group"
                />
                <button onClick={handleCreateGroup}>Create</button>
              </div>
            </div>
          </div>
          {inviteStatus && (
            <div className="card">
              <div
                className="notice"
                style={{
                  background: "rgba(34, 197, 94, 0.2)",
                  color: "#bbf7d0",
                }}
              >
                {inviteStatus}
              </div>
            </div>
          )}
          {inviteLinks.length > 0 && (
            <div className="card">
              <div className="section-title">Invite links</div>
              <div className="stack">
                {inviteLinks.map((item, idx) => (
                  <div className="list-item" key={`${item.email}-${idx}`}>
                    <div>
                      <strong>{item.email}</strong>
                      <div
                        className="muted invite-link"
                        style={{ fontSize: 12 }}
                      >
                        {item.link}
                      </div>
                    </div>
                    <button
                      className="ghost"
                      onClick={() =>
                        navigator?.clipboard?.writeText &&
                        navigator.clipboard.writeText(item.link)
                      }
                    >
                      Copy
                    </button>
                  </div>
                ))}
                <div className="muted">
                  Share each link with its email owner. Links are email-bound.
                </div>
              </div>
            </div>
          )}
          {groupData && !isVirtualGroup && (
            <div className="card">
              <div className="section-title">Participants</div>
              <div className="list">
                {participants.map((p) => (
                  <div className="list-item" key={p._id}>
                    <div>
                      <div className="name-row">
                        <span
                          className="name-dot"
                          style={{ background: p.color || "#4b5563" }}
                        ></span>
                        <strong>{p.name}</strong>
                      </div>
                      {p.userId && (
                        <span className="badge" style={{ marginLeft: 18 }}>
                          Linked
                        </span>
                      )}
                      {!p.userId && (
                        <span className="badge" style={{ marginLeft: 18 }}>
                          Invite pending
                        </span>
                      )}
                      <div className="muted" style={{ fontSize: 12 }}>
                        {p.email}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="ghost"
                        onClick={() => handleEditParticipant(p)}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost"
                        onClick={() => handleRemoveParticipant(p)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="form-row" style={{ marginTop: 12 }}>
                <input
                  value={newParticipant.name}
                  onChange={(e) =>
                    setNewParticipant({
                      ...newParticipant,
                      name: e.target.value,
                    })
                  }
                  placeholder="Participant name"
                />
                <input
                  value={newParticipant.email}
                  onChange={(e) =>
                    setNewParticipant({
                      ...newParticipant,
                      email: e.target.value,
                    })
                  }
                  placeholder="Email"
                />
              </div>
              <div className="form-row" style={{ marginTop: 8 }}>
                <input
                  value={newParticipant.color}
                  onChange={(e) =>
                    setNewParticipant({
                      ...newParticipant,
                      color: e.target.value,
                    })
                  }
                  placeholder="Color hex"
                />
                <button onClick={handleAddParticipant}>Send invite</button>
              </div>
            </div>
          )}
        </div>
        <div className="stack">
          {groupData && (
            <div className="card">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div className="section-title">Group Dashboard</div>
                  <h2 style={{ margin: 0 }}>{groupData.group.name}</h2>
                </div>
                {!isVirtualGroup && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="ghost" onClick={handleGroupRename}>
                      Rename
                    </button>
                    <button className="ghost" onClick={handleDeleteGroup}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
              <div className="grid-3" style={{ marginTop: 16 }}>
                <div className="summary-card">
                  <h3>Total spent</h3>
                  <p>{formatCurrency(totalSpent)}</p>
                </div>
                <div className="summary-card">
                  <h3>Owed by you</h3>
                  <p>{formatCurrency(owedByUser)}</p>
                </div>
                <div className="summary-card">
                  <h3>Owed to you</h3>
                  <p>{formatCurrency(owedToUser)}</p>
                </div>
              </div>
            </div>
          )}

          {groupData && !isVirtualGroup && (
            <div className="card">
              <div className="section-title">Add Expense</div>
              <form
                className="stack"
                onSubmit={
                  editingExpense ? handleUpdateExpense : handleSubmitExpense
                }
              >
                <div className="form-row">
                  <input
                    value={expenseForm.description}
                    onChange={(e) =>
                      setExpenseForm({
                        ...expenseForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Description"
                    required
                  />
                  <select
                    value={expenseForm.category}
                    onChange={(e) =>
                      setExpenseForm({
                        ...expenseForm,
                        category: e.target.value,
                      })
                    }
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <input
                    type="number"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, amount: e.target.value })
                    }
                    placeholder="Amount"
                    required
                  />
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) =>
                      setExpenseForm({ ...expenseForm, date: e.target.value })
                    }
                  />
                </div>
                <div className="form-row">
                  <select
                    value={expenseForm.payerId}
                    onChange={(e) =>
                      setExpenseForm({
                        ...expenseForm,
                        payerId: e.target.value,
                      })
                    }
                  >
                    {participants.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={expenseForm.splitMode}
                    onChange={(e) =>
                      setExpenseForm({
                        ...expenseForm,
                        splitMode: e.target.value,
                      })
                    }
                  >
                    <option value="equal">Split equally</option>
                    <option value="custom">Custom amounts</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </div>
                {expenseForm.splitMode !== "equal" && (
                  <div className="stack">
                    {participants.map((p) => (
                      <div className="form-row" key={p._id}>
                        <input value={p.name} disabled />
                        <input
                          type="number"
                          step="0.01"
                          value={expenseForm.splits[p._id] || ""}
                          onChange={(e) =>
                            setExpenseForm({
                              ...expenseForm,
                              splits: {
                                ...expenseForm.splits,
                                [p._id]: e.target.value,
                              },
                            })
                          }
                          placeholder={
                            expenseForm.splitMode === "percentage" ? "%" : "?"
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit">
                    {editingExpense ? "Update expense" : "Add expense"}
                  </button>
                  {editingExpense && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setEditingExpense(null);
                        resetExpenseForm();
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {groupData && (
            <div className="card">
              <div className="section-title">Color Ledger</div>
              <div className="stack">
                {expenses.map((e) => (
                  <div className="ledger-item" key={`ledger-${e._id}`}>
                    <div>
                      <div className="muted">
                        {new Date(e.date).toLocaleDateString()}
                      </div>
                      <strong>{e.description}</strong>
                      <div className="muted">
                        {e.category || "uncategorized"}
                      </div>
                    </div>
                    <div>
                      <div className="tag">
                        <span
                          className="dot"
                          style={{ background: e.payer?.color || "#111827" }}
                        ></span>
                        {e.payer?.name || ""} paid
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          marginTop: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        {e.splits.map((s) => (
                          <span className="tag" key={s.participant._id}>
                            <span
                              className="dot"
                              style={{
                                background: s.participant?.color || "#4b5563",
                              }}
                            ></span>
                            {s.participant?.name} {formatCurrency(s.amount)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="badge">{formatCurrency(e.amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {groupData && !isVirtualGroup && (
            <div className="card">
              <div className="section-title">Search & Filters</div>
              <div className="stack">
                <input
                  value={filters.q}
                  onChange={(e) =>
                    setFilters({ ...filters, q: e.target.value })
                  }
                  placeholder="Search expenses"
                />
                <select
                  value={filters.participantId}
                  onChange={(e) =>
                    setFilters({ ...filters, participantId: e.target.value })
                  }
                >
                  <option value="">All participants</option>
                  {participants.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="form-row">
                  <input
                    type="date"
                    value={filters.start}
                    onChange={(e) =>
                      setFilters({ ...filters, start: e.target.value })
                    }
                  />
                  <input
                    type="date"
                    value={filters.end}
                    onChange={(e) =>
                      setFilters({ ...filters, end: e.target.value })
                    }
                  />
                </div>
                <div className="form-row">
                  <input
                    type="number"
                    step="0.01"
                    value={filters.min}
                    onChange={(e) =>
                      setFilters({ ...filters, min: e.target.value })
                    }
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={filters.max}
                    onChange={(e) =>
                      setFilters({ ...filters, max: e.target.value })
                    }
                    placeholder="Max"
                  />
                </div>
                <button onClick={applyFilters}>Apply filters</button>
              </div>
            </div>
          )}

          {groupData && (
            <div className="card">
              <div className="section-title">Balances & Settlements</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Participant</th>
                    <th>Net balance</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.participant._id}>
                      <td>{b.participant.name}</td>
                      <td style={{ color: b.net >= 0 ? "#22c55e" : "#f87171" }}>
                        {formatCurrency(b.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="section-title" style={{ marginTop: 16 }}>
                Settlement Suggestions
              </div>
              <div className="list">
                {settlements.length === 0 && (
                  <div className="muted">All settled.</div>
                )}
                {settlements.map((s, idx) => (
                  <div className="list-item" key={idx}>
                    <span>
                      {s.from.name} pays {s.to.name}
                    </span>
                    <span className="badge">{formatCurrency(s.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {groupData && isVirtualGroup && (
            <div className="card">
              <div className="section-title">Transactions Paid by You</div>
              <div className="list">
                {expenses.filter((e) => e.payer?.userId === user?.id).length ===
                  0 && (
                  <div className="muted">No transactions paid by you.</div>
                )}
                {expenses
                  .filter((e) => e.payer?.userId === user?.id)
                  .map((e) => (
                    <div className="list-item" key={e._id}>
                      <div>
                        <strong>{e.description}</strong>
                        <div className="muted">
                          {new Date(e.date).toLocaleDateString()} ·{" "}
                          {e.category || "uncategorized"}
                        </div>
                      </div>
                      <span className="badge">{formatCurrency(e.amount)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {groupData && !isVirtualGroup && (
            <div className="card">
              <div className="section-title">Transaction History</div>
              {groupError && <div className="notice">{groupError}</div>}
              <div className="list">
                {expenses.map((e) => (
                  <div className="list-item" key={e._id}>
                    <div>
                      <strong>{e.description}</strong>
                      <div className="muted">
                        {new Date(e.date).toLocaleDateString()} �{" "}
                        {e.category || "uncategorized"} � Paid by{" "}
                        {e.payer?.name || ""}
                      </div>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span className="badge">{formatCurrency(e.amount)}</span>
                      <button
                        className="ghost"
                        onClick={() => handleEditExpense(e)}
                      >
                        Edit
                      </button>
                      <button
                        className="ghost"
                        onClick={() => handleDeleteExpense(e)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
