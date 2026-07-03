"""Apply remaining bug fixes to App.jsx."""
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "src" / "App.jsx"
text = APP.read_text(encoding="utf-8")

# 1. notify + Toast error styling
text = text.replace(
    """  const notify = (message) => {
    setToast({ id: Date.now(), message });
  };""",
    """  const notify = (message, type = 'info') => {
    setToast({ id: Date.now(), message, type });
  };""",
)

text = text.replace(
    """function Toast({ toast }) {
  if (!toast) {
    return null;
  }

  return (
    <div
      key={toast.id}
      className="fixed bottom-5 left-4 right-4 z-80 rounded-[12px] border border-[#dce7f5] bg-white px-4 py-3 text-center text-[13px] font-extrabold text-[#223768] shadow-[0_16px_34px_rgba(21,43,83,0.16)] sm:left-auto sm:right-5 sm:max-w-[360px] sm:text-left"
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}""",
    """function Toast({ toast }) {
  if (!toast) {
    return null;
  }

  const isError = toast.type === 'error';

  return (
    <div
      key={toast.id}
      className={cx(
        'fixed bottom-5 left-4 right-4 z-80 rounded-[12px] border px-4 py-3 text-center text-[13px] font-extrabold shadow-[0_16px_34px_rgba(21,43,83,0.16)] sm:left-auto sm:right-5 sm:max-w-[360px] sm:text-left',
        isError
          ? 'border-[#fecaca] bg-[#fff1f1] text-[#b91c1c]'
          : 'border-[#dce7f5] bg-white text-[#223768]',
      )}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
}""",
)

# 2. Helper functions before SettingsUsersPage
HELPERS = '''
function mapApiUserToSettingsRow(apiUser) {
  const name = apiUser.name || 'Unnamed User';
  const initials = name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'NU';
  return {
    id: apiUser.id,
    name,
    email: apiUser.email,
    phone: apiUser.mobile || '—',
    role: apiUser.role_name || 'Unassigned',
    branch: apiUser.branch_name || 'Unassigned',
    status: apiUser.is_active ? 'Active' : 'Inactive',
    lastLogin: '—',
    joinedOn: apiUser.created_at ? new Date(apiUser.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    assignee: { name, initials, tone: 'emerald' },
    roleId: apiUser.role,
    branchId: apiUser.branch,
  };
}

function mapActivityLogFromApi(log) {
  const userName = log.user_name || 'System';
  const initials = userName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'SY';
  return {
    id: log.id,
    time: log.created_at ? new Date(log.created_at).toLocaleString('en-IN') : '—',
    user: {
      name: userName,
      assignee: { name: userName, initials, tone: 'emerald' },
    },
    action: log.action,
    module: log.module,
    description: log.description || '',
    ip: log.ip_address || '—',
    status: log.status || 'Success',
  };
}

function mapApiRoleToSettingsRow(apiRole) {
  return {
    id: apiRole.id,
    name: apiRole.name,
    type: apiRole.role_type === 'system' ? 'System Role' : 'Custom Role',
    users: apiRole.user_count ?? 0,
    status: apiRole.is_active ? 'Active' : 'Inactive',
    tone: apiRole.is_active ? 'green' : 'amber',
  };
}

function mapApiPermissionsToSettingsRows(apiPermissions) {
  const permLabels = {
    can_view: 'View',
    can_add: 'Add',
    can_edit: 'Edit',
    can_delete: 'Delete',
    can_export: 'Export',
  };
  return apiPermissions.map((row) => ({
    module: row.module,
    description: `${row.module} module access`,
    permissions: Object.fromEntries(
      Object.entries(permLabels).map(([apiKey, uiKey]) => [uiKey, Boolean(row[apiKey])]),
    ),
  }));
}

function useSettingsMasters(masterType, onNotify) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    settingsApi.masters.list({ master_type: masterType })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setRows(list);
      })
      .catch(() => onNotify?.('Could not load master records.', 'error'))
      .finally(() => setLoading(false));
  }, [masterType]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, loading, setRows };
}

'''

marker = "function SettingsUsersPage({ activeSection = 'Settings Users', onOpenSection, onNotify }) {"
if "function mapApiUserToSettingsRow" not in text:
    text = text.replace(marker, HELPERS + marker)

# 3. SettingsUsersPage - wire to API
OLD_USERS_START = """function SettingsUsersPage({ activeSection = 'Settings Users', onOpenSection, onNotify }) {
  const [users, setUsers] = useState(settingsUsersSeed);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('All Roles');
  const [status, setStatus] = useState('All Status');
  const [branch, setBranch] = useState('All Branches');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [addUserOpen, setAddUserOpen] = useState(false);"""

NEW_USERS_START = """function SettingsUsersPage({ activeSection = 'Settings Users', onOpenSection, onNotify }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('All Roles');
  const [status, setStatus] = useState('All Status');
  const [branch, setBranch] = useState('All Branches');
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [addUserOpen, setAddUserOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    userApi.list()
      .then((data) => {
        const list = data?.results ?? data ?? [];
        setUsers(list.map(mapApiUserToSettingsRow));
      })
      .catch((error) => onNotify?.(error.message || 'Failed to load users', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps"""

if OLD_USERS_START in text:
    text = text.replace(OLD_USERS_START, NEW_USERS_START)

OLD_SAVE_USER = """  const saveUser = (payload) => {
    if (editingUser) {
      setUsers((current) => current.map((item) => (item.id === payload.id ? payload : item)));
      setEditingUser(null);
      onNotify(`${payload.name} updated`);
      return;
    }

    setUsers((current) => [payload, ...current]);
    setAddUserOpen(false);
    onNotify(`${payload.name} added`);
  };

  const toggleUserStatus = (user) => {
    const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, status: nextStatus } : item)));
    onNotify(`${user.name} marked ${nextStatus}`);
  };"""

NEW_SAVE_USER = """  const saveUser = (payload) => {
    if (editingUser) {
      userApi.update(payload.id, {
        name: payload.name,
        email: payload.email,
        mobile: payload.phone,
        is_active: payload.status === 'Active',
      }).then((updated) => {
        const mapped = mapApiUserToSettingsRow(updated);
        setUsers((current) => current.map((item) => (item.id === mapped.id ? mapped : item)));
        setEditingUser(null);
        onNotify(`${mapped.name} updated`);
      }).catch((error) => onNotify(error.message || 'Failed to update user', 'error'));
      return;
    }

    userApi.create({
      name: payload.name,
      email: payload.email,
      mobile: payload.phone,
      password: 'ChangeMe123',
    }).then((created) => {
      const mapped = mapApiUserToSettingsRow(created);
      setUsers((current) => [mapped, ...current]);
      setAddUserOpen(false);
      onNotify(`${mapped.name} added`);
    }).catch((error) => onNotify(error.message || 'Failed to add user', 'error'));
  };

  const toggleUserStatus = (user) => {
    userApi.toggleActive(user.id).then((updated) => {
      const mapped = mapApiUserToSettingsRow(updated);
      setUsers((current) => current.map((item) => (item.id === mapped.id ? mapped : item)));
      onNotify(`${mapped.name} marked ${mapped.status}`);
    }).catch((error) => onNotify(error.message || 'Failed to update status', 'error'));
  };"""

if OLD_SAVE_USER in text:
    text = text.replace(OLD_SAVE_USER, NEW_SAVE_USER)

# Add loading state to table section
text = text.replace(
    """      <section className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
        <div className="space-y-3 lg:hidden">
          {filteredUsers.map((user, index) => (
            <article key={user.id} className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-extrabold text-[#8a98af]">#{index + 1}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <AssigneeCell assignee={user.assignee} />
                    {user.isYou ? <SettingsTokenBadge label="You" tone="green" /> : null}
                  </div>
                </div>
                <SettingsResultBadge status={user.status} />
              </div>""",
    """      <section className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
        {loading ? <p className="px-3 py-8 text-center text-[13px] font-bold text-[#53647f]">Loading users...</p> : null}
        <div className="space-y-3 lg:hidden">
          {!loading ? filteredUsers.map((user, index) => (
            <article key={user.id} className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[12px] font-extrabold text-[#8a98af]">#{index + 1}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <AssigneeCell assignee={user.assignee} />
                    {user.isYou ? <SettingsTokenBadge label="You" tone="green" /> : null}
                  </div>
                </div>
                <SettingsResultBadge status={user.status} />
              </div>""",
    1,
)

text = text.replace(
    """          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
          <table className="crm-table min-w-[1300px] w-full">
            <thead>
              <tr>{['#', 'User Name', 'Email', 'Phone Number', 'Role', 'Branch / Location', 'Status', 'Last Login', 'Actions'].map((header) => <th key={header}>{header}</th>)}</tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <tr key={user.id}>""",
    """          )) : null}
        </div>

        <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
          <table className="crm-table min-w-[1300px] w-full">
            <thead>
              <tr>{['#', 'User Name', 'Email', 'Phone Number', 'Role', 'Branch / Location', 'Status', 'Last Login', 'Actions'].map((header) => <th key={header}>{header}</th>)}</tr>
            </thead>
            <tbody>
              {!loading ? filteredUsers.map((user, index) => (
                <tr key={user.id}>""",
    1,
)

text = text.replace(
    """              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 px-3 py-5 text-[13px] font-bold text-[#53647f] sm:flex-row sm:items-center sm:justify-between">
          <p>Showing 1 to {filteredUsers.length} of {users.length} entries</p>
          <div className="flex flex-wrap items-center gap-2">
            <PaginationButton onClick={() => onNotify('Previous users page selected')}><ChevronLeft className="size-4" /></PaginationButton>
            <PaginationButton active onClick={() => onNotify('Users page 1 selected')}>1</PaginationButton>
            <PaginationButton onClick={() => onNotify('Users page 2 selected')}>2</PaginationButton>
            <PaginationButton onClick={() => onNotify('Users page 3 selected')}>3</PaginationButton>
            <span className="px-2 text-[#53647f]">...</span>
            <PaginationButton onClick={() => onNotify('Users page 6 selected')}>6</PaginationButton>
            <PaginationButton onClick={() => onNotify('Next users page selected')}><ChevronRight className="size-4" /></PaginationButton>
          </div>
        </div>
      </section>

      <DashboardFooter />

      {selectedUser ? <SettingsUserProfileModal user={selectedUser}""",
    """              )) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 px-3 py-5 text-[13px] font-bold text-[#53647f] sm:flex-row sm:items-center sm:justify-between">
          <p>Showing 1 to {filteredUsers.length} of {users.length} entries</p>
        </div>
      </section>

      <DashboardFooter />

      {selectedUser ? <SettingsUserProfileModal user={selectedUser}""",
    1,
)

# 4. SettingsRolesPermissionsPage
OLD_ROLES_START = """function SettingsRolesPermissionsPage({ activeSection = 'Settings Roles & Permissions', onOpenSection, onNotify }) {
  const [roles, setRoles] = useState(settingsRolesSeed);
  const [selectedRoleName, setSelectedRoleName] = useState('Manager');
  const [activeTab, setActiveTab] = useState('Permissions');
  const [query, setQuery] = useState('');
  const [permissionRows, setPermissionRows] = useState(() => createSettingsRolePermissions('Manager'));
  const [addRoleOpen, setAddRoleOpen] = useState(false);

  const filteredRoles = roles.filter((role) => role.name.toLowerCase().includes(query.toLowerCase()));
  const selectedRole = roles.find((role) => role.name === selectedRoleName) ?? roles[0];
  const selectedRoleUsers = settingsUsersSeed.filter((user) => user.role === selectedRole.name);

  const switchRole = (roleName) => {
    setSelectedRoleName(roleName);
    setPermissionRows(createSettingsRolePermissions(roleName));
    onNotify(`${roleName} role selected`);
  };"""

NEW_ROLES_START = """function SettingsRolesPermissionsPage({ activeSection = 'Settings Roles & Permissions', onOpenSection, onNotify }) {
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRoleName, setSelectedRoleName] = useState('');
  const [activeTab, setActiveTab] = useState('Permissions');
  const [query, setQuery] = useState('');
  const [permissionRows, setPermissionRows] = useState([]);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([roleApi.list(), userApi.list()])
      .then(([rolesRes, usersRes]) => {
        const roleList = (Array.isArray(rolesRes) ? rolesRes : (rolesRes?.results ?? [])).map(mapApiRoleToSettingsRow);
        const userList = (Array.isArray(usersRes) ? usersRes : (usersRes?.results ?? [])).map(mapApiUserToSettingsRow);
        setRoles(roleList);
        setUsers(userList);
        if (roleList.length) {
          setSelectedRoleName(roleList[0].name);
          roleApi.getPermissions(roleList[0].id)
            .then((perms) => setPermissionRows(mapApiPermissionsToSettingsRows(perms)))
            .catch(() => setPermissionRows(createSettingsRolePermissions(roleList[0].name)));
        }
      })
      .catch((error) => onNotify?.(error.message || 'Failed to load roles', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRoles = roles.filter((role) => role.name.toLowerCase().includes(query.toLowerCase()));
  const selectedRole = roles.find((role) => role.name === selectedRoleName) ?? roles[0];
  const selectedRoleUsers = selectedRole ? users.filter((user) => user.role === selectedRole.name) : [];

  const switchRole = (roleName) => {
    const role = roles.find((item) => item.name === roleName);
    setSelectedRoleName(roleName);
    if (role?.id) {
      roleApi.getPermissions(role.id)
        .then((perms) => setPermissionRows(mapApiPermissionsToSettingsRows(perms)))
        .catch(() => setPermissionRows(createSettingsRolePermissions(roleName)));
    } else {
      setPermissionRows(createSettingsRolePermissions(roleName));
    }
    onNotify(`${roleName} role selected`);
  };"""

if OLD_ROLES_START in text:
    text = text.replace(OLD_ROLES_START, NEW_ROLES_START)

# 5. SettingsUserActivityLogPage - full replacement
OLD_ACTIVITY = """function SettingsUserActivityLogPage({ activeSection = 'Settings User Activity Log', onOpenSection, onNotify }) {
  const [query, setQuery] = useState('');
  const [user, setUser] = useState('All Users');
  const [action, setAction] = useState('All Actions');
  const [moduleName, setModuleName] = useState('All Modules');
  const [status, setStatus] = useState('All Status');
  const [dateFrom, setDateFrom] = useState('2024-04-01');
  const [dateTo, setDateTo] = useState('2025-03-31');

  const filteredLogs = settingsActivitySeed.filter((log) => {
    const queryMatch = [log.user.name, log.action, log.module, log.ip, log.description].some((value) => value.toLowerCase().includes(query.toLowerCase()));
    const userMatch = user === 'All Users' || log.user.name === user;
    const actionMatch = action === 'All Actions' || log.action === action;
    const moduleMatch = moduleName === 'All Modules' || log.module === moduleName;
    const statusMatch = status === 'All Status' || log.status === status;
    return queryMatch && userMatch && actionMatch && moduleMatch && statusMatch;
  });"""

NEW_ACTIVITY = """function SettingsUserActivityLogPage({ activeSection = 'Settings User Activity Log', onOpenSection, onNotify }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [user, setUser] = useState('All Users');
  const [action, setAction] = useState('All Actions');
  const [moduleName, setModuleName] = useState('All Modules');
  const [status, setStatus] = useState('All Status');
  const [dateFrom, setDateFrom] = useState('2024-04-01');
  const [dateTo, setDateTo] = useState('2025-03-31');

  useEffect(() => {
    setLoading(true);
    settingsApi.activityLogs.list()
      .then((res) => {
        const list = Array.isArray(res) ? res : (res?.results ?? []);
        setLogs(list.map(mapActivityLogFromApi));
      })
      .catch(() => onNotify?.('Could not load activity logs.', 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredLogs = logs.filter((log) => {
    const queryMatch = [log.user.name, log.action, log.module, log.ip, log.description].some((value) => String(value).toLowerCase().includes(query.toLowerCase()));
    const userMatch = user === 'All Users' || log.user.name === user;
    const actionMatch = action === 'All Actions' || log.action === action;
    const moduleMatch = moduleName === 'All Modules' || log.module === moduleName;
    const statusMatch = status === 'All Status' || log.status === status;
    return queryMatch && userMatch && actionMatch && moduleMatch && statusMatch;
  });

  const uniqueUsers = [...new Set(logs.map((log) => log.user.name))];
  const uniqueActions = [...new Set(logs.map((log) => log.action))];
  const uniqueModules = [...new Set(logs.map((log) => log.module))];
  const todayLabel = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const todayCount = logs.filter((log) => log.time.startsWith(todayLabel.split(',')[0]) || log.time.includes(todayLabel)).length;
  const securityCount = logs.filter((log) => ['Authentication', 'Settings', 'User Management'].includes(log.module)).length;
  const failedCount = logs.filter((log) => log.status === 'Failed').length;"""

if OLD_ACTIVITY in text:
    text = text.replace(OLD_ACTIVITY, NEW_ACTIVITY)

text = text.replace(
    """        <SettingsMetricCard title="Total Activities" value="2,458" subtitle="All Time" icon={ActivityIcon} tone="green" />
        <SettingsMetricCard title="Today's Activities" value="156" subtitle="20 May 2024" icon={CalendarDays} tone="blue" />
        <SettingsMetricCard title="Active Users Today" value="28" subtitle="20 May 2024" icon={Users} tone="amber" />
        <SettingsMetricCard title="Security Events" value="12" subtitle="Last 7 Days" icon={ShieldCheck} tone="purple" />
        <SettingsMetricCard title="Failed Login Attempts" value="18" subtitle="Last 7 Days" icon={ClipboardPlus} tone="cyan" />""",
    """        <SettingsMetricCard title="Total Activities" value={String(logs.length)} subtitle="All Time" icon={ActivityIcon} tone="green" />
        <SettingsMetricCard title="Today's Activities" value={String(todayCount)} subtitle={todayLabel} icon={CalendarDays} tone="blue" />
        <SettingsMetricCard title="Filtered Results" value={String(filteredLogs.length)} subtitle="Current view" icon={Users} tone="amber" />
        <SettingsMetricCard title="Security Events" value={String(securityCount)} subtitle="Auth & access" icon={ShieldCheck} tone="purple" />
        <SettingsMetricCard title="Failed Attempts" value={String(failedCount)} subtitle="All time" icon={ClipboardPlus} tone="cyan" />""",
)

text = text.replace(
    """          <ReportSelect label="User" value={user} onChange={setUser} options={['All Users', ...new Set(settingsActivitySeed.map((log) => log.user.name))]} hideLabel />
          <ReportSelect label="Action" value={action} onChange={setAction} options={['All Actions', ...new Set(settingsActivitySeed.map((log) => log.action))]} hideLabel />
          <ReportSelect label="Module" value={moduleName} onChange={setModuleName} options={['All Modules', ...new Set(settingsActivitySeed.map((log) => log.module))]} hideLabel />""",
    """          <ReportSelect label="User" value={user} onChange={setUser} options={['All Users', ...uniqueUsers]} hideLabel />
          <ReportSelect label="Action" value={action} onChange={setAction} options={['All Actions', ...uniqueActions]} hideLabel />
          <ReportSelect label="Module" value={moduleName} onChange={setModuleName} options={['All Modules', ...uniqueModules]} hideLabel />""",
)

text = text.replace(
    """      <section className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
        <div className="space-y-3 lg:hidden">
          {filteredLogs.map((log, index) => (
            <article key={log.id} className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[12px] font-extrabold text-[#8a98af]">#{index + 1}</p><p className="mt-1 text-[14px] font-extrabold text-[#1e3261]">{log.time}</p></div>
                <SettingsResultBadge status={log.status} />
              </div>
              <div className="mt-4 grid gap-3 text-[12px]">
                <InfoCell label="User" valueNode={<AssigneeCell assignee={log.user.assignee} compact />} />
                <InfoCell label="Action" valueNode={<SettingsActionBadge action={log.action} />} />
                <InfoCell label="Module" value={log.module} />
                <InfoCell label="Description" value={log.description} />
                <InfoCell label="IP Address" value={log.ip} />
              </div>
              <button type="button" onClick={() => onNotify(`Activity log ${log.id} opened`)} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5]"><Eye className="size-4" />View Details</button>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
          <table className="crm-table min-w-[1380px] w-full">
            <thead><tr>{['#', 'Date & Time', 'User', 'Action', 'Module', 'Description', 'IP Address', 'Status', 'Details'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
            <tbody>
              {filteredLogs.map((log, index) => (
                <tr key={log.id}>
                  <td>{index + 1}</td>
                  <td className="font-extrabold text-[#1e3261]">{log.time}</td>
                  <td><AssigneeCell assignee={log.user.assignee} compact /></td>
                  <td><SettingsActionBadge action={log.action} /></td>
                  <td>{log.module}</td>
                  <td className="max-w-[320px] whitespace-normal leading-5">{log.description}</td>
                  <td>{log.ip}</td>
                  <td><SettingsResultBadge status={log.status} /></td>
                  <td><UserActionButton label={`Open log ${log.id}`} icon={Eye} tone="blue" onClick={() => onNotify(`Activity log ${log.id} opened`)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 px-3 py-5 text-[13px] font-bold text-[#53647f] sm:flex-row sm:items-center sm:justify-between">
          <p>Showing 1 to {filteredLogs.length} of 2,458 entries</p>
          <div className="flex flex-wrap items-center gap-2">
            <PaginationButton onClick={() => onNotify('Previous activity page selected')}><ChevronLeft className="size-4" /></PaginationButton>
            <PaginationButton active onClick={() => onNotify('Activity page 1 selected')}>1</PaginationButton>
            <PaginationButton onClick={() => onNotify('Activity page 2 selected')}>2</PaginationButton>
            <PaginationButton onClick={() => onNotify('Activity page 3 selected')}>3</PaginationButton>
            <span className="px-2 text-[#53647f]">...</span>
            <PaginationButton onClick={() => onNotify('Activity page 246 selected')}>246</PaginationButton>
            <PaginationButton onClick={() => onNotify('Next activity page selected')}><ChevronRight className="size-4" /></PaginationButton>
          </div>
        </div>
      </section>""",
    """      <section className={`${panelClass} overflow-hidden p-3 sm:p-4`}>
        {loading ? <p className="px-3 py-8 text-center text-[13px] font-bold text-[#53647f]">Loading activity logs...</p> : null}
        {!loading && filteredLogs.length === 0 ? <p className="px-3 py-8 text-center text-[13px] font-bold text-[#53647f]">No activity logs found.</p> : null}
        <div className="space-y-3 lg:hidden">
          {!loading ? filteredLogs.map((log, index) => (
            <article key={log.id} className="rounded-[14px] border border-[#e7eef7] bg-white p-4 shadow-[0_10px_22px_rgba(17,39,84,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[12px] font-extrabold text-[#8a98af]">#{index + 1}</p><p className="mt-1 text-[14px] font-extrabold text-[#1e3261]">{log.time}</p></div>
                <SettingsResultBadge status={log.status} />
              </div>
              <div className="mt-4 grid gap-3 text-[12px]">
                <InfoCell label="User" valueNode={<AssigneeCell assignee={log.user.assignee} compact />} />
                <InfoCell label="Action" valueNode={<SettingsActionBadge action={log.action} />} />
                <InfoCell label="Module" value={log.module} />
                <InfoCell label="Description" value={log.description} />
                <InfoCell label="IP Address" value={log.ip} />
              </div>
              <button type="button" onClick={() => onNotify(`Activity log ${log.id} opened`)} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[#d9e4f2] bg-white text-[12px] font-extrabold text-[#0b65e5]"><Eye className="size-4" />View Details</button>
            </article>
          )) : null}
        </div>

        <div className="hidden overflow-x-auto rounded-[12px] border border-[#e7eef7] bg-white lg:block">
          <table className="crm-table min-w-[1380px] w-full">
            <thead><tr>{['#', 'Date & Time', 'User', 'Action', 'Module', 'Description', 'IP Address', 'Status', 'Details'].map((header) => <th key={header}>{header}</th>)}</tr></thead>
            <tbody>
              {!loading ? filteredLogs.map((log, index) => (
                <tr key={log.id}>
                  <td>{index + 1}</td>
                  <td className="font-extrabold text-[#1e3261]">{log.time}</td>
                  <td><AssigneeCell assignee={log.user.assignee} compact /></td>
                  <td><SettingsActionBadge action={log.action} /></td>
                  <td>{log.module}</td>
                  <td className="max-w-[320px] whitespace-normal leading-5">{log.description}</td>
                  <td>{log.ip}</td>
                  <td><SettingsResultBadge status={log.status} /></td>
                  <td><UserActionButton label={`Open log ${log.id}`} icon={Eye} tone="blue" onClick={() => onNotify(`Activity log ${log.id} opened`)} /></td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 px-3 py-5 text-[13px] font-bold text-[#53647f] sm:flex-row sm:items-center sm:justify-between">
          <p>Showing {filteredLogs.length} of {logs.length} entries</p>
        </div>
      </section>""",
)

# 6. SettingsIpRestrictionsPage - fix hooks order and API wiring
OLD_IP_START = """function SettingsIpRestrictionsPage({ activeSection = 'Settings IP Restrictions', onOpenSection, onNotify }) {
  const [rules, setRules] = useState([]);
  const [blockedAttempts, setBlockedAttempts] = useState([]);

  useEffect(() => {
    Promise.all([settingsApi.ipRules.list(), settingsApi.ipBlockedAttempts.list(), settingsApi.category('ip_security').get()])
      .then(([rulesRes, blockedRes, securityRes]) => {
        const ruleList = Array.isArray(rulesRes) ? rulesRes : (rulesRes?.results ?? []);
        setRules(ruleList.map((rule) => ({
          id: rule.id,
          name: rule.name,
          ipRange: rule.ip_range,
          type: rule.rule_type,
          description: rule.description,
          status: rule.is_active ? 'Active' : 'Inactive',
        })));
        const blockedList = Array.isArray(blockedRes) ? blockedRes : (blockedRes?.results ?? []);
        setBlockedAttempts(blockedList.map((item) => ({
          ip: item.ip_address,
          username: item.username,
          reason: item.reason,
          attemptedAt: item.attempted_at ? new Date(item.attempted_at).toLocaleString('en-IN') : '—',
        })));
        if (securityRes) setSecurityConfig((c) => ({ ...c, ...securityRes }));
      })
      .catch(() => onNotify('Could not load IP settings.', 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [activeTab, setActiveTab] = useState('IP Access Rules');
  const [ruleFilter, setRuleFilter] = useState('All Rules');
  const [query, setQuery] = useState('');
  const [editingRule, setEditingRule] = useState(null);
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [securityConfig, setSecurityConfig] = useState({
    strictMode: true,
    whitelistOnly: false,
    loginAlert: true,
    syncDelay: true,
  });

  const filteredRules = rules.filter((rule) => {
    const queryMatch = [rule.name, rule.ipRange, rule.description].some((value) => value.toLowerCase().includes(query.toLowerCase()));
    const filterMatch = ruleFilter === 'All Rules' || rule.type === ruleFilter.replace(' Rules', '');
    return queryMatch && filterMatch;
  });

  const allowCount = rules.filter((rule) => rule.type === 'Allow').length;
  const blockCount = rules.filter((rule) => rule.type === 'Block').length;
  const lastBlocked = settingsBlockedAttemptsSeed[0];

  const saveRule = (payload) => {
    if (editingRule) {
      setRules((current) => current.map((item) => (item.id === payload.id ? payload : item)));
      setEditingRule(null);
      onNotify(`${payload.name} updated`);
      return;
    }

    setRules((current) => [payload, ...current]);
    setAddRuleOpen(false);
    onNotify(`${payload.name} added`);
  };"""

NEW_IP_START = """function SettingsIpRestrictionsPage({ activeSection = 'Settings IP Restrictions', onOpenSection, onNotify }) {
  const [rules, setRules] = useState([]);
  const [blockedAttempts, setBlockedAttempts] = useState([]);
  const [activeTab, setActiveTab] = useState('IP Access Rules');
  const [ruleFilter, setRuleFilter] = useState('All Rules');
  const [query, setQuery] = useState('');
  const [editingRule, setEditingRule] = useState(null);
  const [addRuleOpen, setAddRuleOpen] = useState(false);
  const [securityConfig, setSecurityConfig] = useState({
    strictMode: true,
    whitelistOnly: false,
    loginAlert: true,
    syncDelay: true,
  });

  const mapRuleFromApi = (rule) => ({
    id: rule.id,
    name: rule.name,
    ipRange: rule.ip_range,
    type: rule.rule_type,
    description: rule.description,
    status: rule.is_active ? 'Active' : 'Inactive',
    createdOn: rule.created_at ? new Date(rule.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
    priority: '1',
  });

  useEffect(() => {
    Promise.all([settingsApi.ipRules.list(), settingsApi.ipBlockedAttempts.list(), settingsApi.category('ip_security').get()])
      .then(([rulesRes, blockedRes, securityRes]) => {
        const ruleList = Array.isArray(rulesRes) ? rulesRes : (rulesRes?.results ?? []);
        setRules(ruleList.map(mapRuleFromApi));
        const blockedList = Array.isArray(blockedRes) ? blockedRes : (blockedRes?.results ?? []);
        setBlockedAttempts(blockedList.map((item) => ({
          id: item.id,
          ip: item.ip_address,
          username: item.username,
          reason: item.reason,
          attemptedAt: item.attempted_at ? new Date(item.attempted_at).toLocaleString('en-IN') : '—',
          source: item.username || 'Unknown',
          action: 'Blocked',
        })));
        if (securityRes) setSecurityConfig((current) => ({ ...current, ...securityRes }));
      })
      .catch(() => onNotify('Could not load IP settings.', 'error'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredRules = rules.filter((rule) => {
    const queryMatch = [rule.name, rule.ipRange, rule.description].some((value) => String(value).toLowerCase().includes(query.toLowerCase()));
    const filterMatch = ruleFilter === 'All Rules' || rule.type === ruleFilter.replace(' Rules', '');
    return queryMatch && filterMatch;
  });

  const allowCount = rules.filter((rule) => rule.type === 'Allow').length;
  const blockCount = rules.filter((rule) => rule.type === 'Block').length;
  const lastBlocked = blockedAttempts[0] ?? { attemptedAt: '—', ip: '—' };

  const saveRule = async (payload) => {
    const body = {
      name: payload.name,
      ip_range: payload.ipRange,
      rule_type: payload.type,
      description: payload.description,
      is_active: payload.status !== 'Inactive',
    };
    try {
      if (editingRule && Number.isFinite(payload.id)) {
        const updated = await settingsApi.ipRules.update(payload.id, body);
        const mapped = mapRuleFromApi(updated);
        setRules((current) => current.map((item) => (item.id === mapped.id ? mapped : item)));
        setEditingRule(null);
        onNotify(`${mapped.name} updated`);
        return;
      }
      const created = await settingsApi.ipRules.create(body);
      const mapped = mapRuleFromApi(created);
      setRules((current) => [mapped, ...current]);
      setAddRuleOpen(false);
      onNotify(`${mapped.name} added`);
    } catch {
      onNotify('Could not save IP rule.', 'error');
    }
  };

  const saveSecuritySettings = async () => {
    try {
      await settingsApi.category('ip_security').update(securityConfig);
      onNotify('Security settings saved');
    } catch {
      onNotify('Could not save security settings.', 'error');
    }
  };"""

if OLD_IP_START in text:
    text = text.replace(OLD_IP_START, NEW_IP_START)

text = text.replace(
    """              <div className="md:col-span-2"><button type="button" onClick={() => onNotify('Security settings saved')} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:bg-[#067832]">Save Security Settings</button></div>""",
    """              <div className="md:col-span-2"><button type="button" onClick={saveSecuritySettings} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:bg-[#067832]">Save Security Settings</button></div>""",
)

text = text.replace(
    """          ) : activeTab === 'Blocked Attempts' ? (
            <div className="mt-5 grid gap-3">
              {settingsBlockedAttemptsSeed.map((attempt) => (
                <article key={attempt.id} className="rounded-[12px] border border-[#e7eef7] bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="text-[14px] font-extrabold text-[#1e3261]">{attempt.ip}</p><p className="mt-1 text-[12px] font-bold text-[#53647f]">{attempt.attemptedAt} • {attempt.source}</p></div>
                    <SettingsResultBadge status={attempt.action} />
                  </div>
                  <p className="mt-3 text-[13px] font-semibold text-[#314a79]">{attempt.reason}</p>
                </article>
              ))}
            </div>
          ) : (""",
    """          ) : activeTab === 'Blocked Attempts' ? (
            <div className="mt-5 grid gap-3">
              {blockedAttempts.length === 0 ? <p className="text-[13px] font-bold text-[#53647f]">No blocked attempts recorded.</p> : null}
              {blockedAttempts.map((attempt) => (
                <article key={attempt.id ?? attempt.ip} className="rounded-[12px] border border-[#e7eef7] bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="text-[14px] font-extrabold text-[#1e3261]">{attempt.ip}</p><p className="mt-1 text-[12px] font-bold text-[#53647f]">{attempt.attemptedAt} • {attempt.source}</p></div>
                    <SettingsResultBadge status={attempt.action} />
                  </div>
                  <p className="mt-3 text-[13px] font-semibold text-[#314a79]">{attempt.reason}</p>
                </article>
              ))}
            </div>
          ) : (""",
)

text = text.replace(
    """            <p>Showing 1 to {activeTab === 'IP Access Rules' ? filteredRules.length : activeTab === 'Blocked Attempts' ? settingsBlockedAttemptsSeed.length : settingsIpAuditSeed.length} of {activeTab === 'IP Access Rules' ? rules.length : activeTab === 'Blocked Attempts' ? settingsBlockedAttemptsSeed.length : settingsIpAuditSeed.length} entries</p>""",
    """            <p>Showing {activeTab === 'IP Access Rules' ? filteredRules.length : activeTab === 'Blocked Attempts' ? blockedAttempts.length : settingsIpAuditSeed.length} entries</p>""",
)

# 7. DateTimeFormatSettingsPage - wire save/load
OLD_DATETIME = """function DateTimeFormatSettingsPage({ onOpenSection, onNotify }) {
  const [form, setForm] = useState({
    dateFormat: 'DD-MM-YYYY',
    timeFormat: '12 Hours (AM/PM)',
    dateSeparator: '- (Hyphen)',
    timeSeparator: ': (Colon)',
    firstDay: 'Monday',
  });

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));"""

NEW_DATETIME = """function DateTimeFormatSettingsPage({ onOpenSection, onNotify }) {
  const [form, setForm] = useState({
    dateFormat: 'DD-MM-YYYY',
    timeFormat: '12 Hours (AM/PM)',
    dateSeparator: '- (Hyphen)',
    timeSeparator: ': (Colon)',
    firstDay: 'Monday',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.category('datetime').get()
      .then((res) => {
        if (res && typeof res === 'object') {
          setForm((current) => ({
            ...current,
            dateFormat: res.dateFormat || current.dateFormat,
            timeFormat: res.timeFormat || current.timeFormat,
            firstDay: res.weekStart || current.firstDay,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const saveDateTimeSettings = async () => {
    setSaving(true);
    try {
      await settingsApi.category('datetime').update({
        dateFormat: form.dateFormat,
        timeFormat: form.timeFormat,
        weekStart: form.firstDay,
      });
      onNotify('Date & time settings saved');
    } catch {
      onNotify('Could not save date & time settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));"""

if OLD_DATETIME in text:
    text = text.replace(OLD_DATETIME, NEW_DATETIME)

text = text.replace(
    """    <GeneralSettingsDetailShell title="Date & Time Format" onOpenSection={onOpenSection} onNotify={onNotify}>""",
    """    <GeneralSettingsDetailShell title="Date & Time Format" onOpenSection={onOpenSection} onNotify={onNotify} actions={<button type="button" disabled={saving} onClick={saveDateTimeSettings} className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-[#078c3e] px-5 text-[13px] font-extrabold text-white shadow-[0_12px_22px_rgba(13,159,74,0.22)] transition hover:bg-[#067832] disabled:opacity-60"><Save className="size-4" />{saving ? 'Saving...' : 'Save Changes'}</button>}>""",
    1,
)

# 8. SettingsProductCategoriesContent - wire masters API
OLD_PRODUCT_CATS = """function SettingsProductCategoriesContent({ onOpenSection, onNotify }) {
  const rows = [
    { name: 'Solar Panels', code: 'CAT-SP', parent: 'Main Inventory', items: '48', tax: '12%', status: 'Active' },
    { name: 'Inverters', code: 'CAT-INV', parent: 'Main Inventory', items: '18', tax: '18%', status: 'Active' },
    { name: 'Mounting Structure', code: 'CAT-MS', parent: 'Installation Material', items: '32', tax: '18%', status: 'Active' },
    { name: 'DC Cables', code: 'CAT-DC', parent: 'Electrical', items: '24', tax: '18%', status: 'Active' },
    { name: 'AC Cables', code: 'CAT-AC', parent: 'Electrical', items: '20', tax: '18%', status: 'Active' },
    { name: 'Safety Items', code: 'CAT-SAFE', parent: 'Tools & Safety', items: '12', tax: '18%', status: 'Inactive' },
  ];

  return (
    <section className={`${panelClass} p-4 sm:p-5`}>
      <SettingsContentHeader title="Product Categories" note="Manage inventory product categories, parent groups and default tax rules." onCancel={() => onOpenSection('Settings')} onSave={() => onNotify('Product categories saved')} />
      <SettingsInventoryStats stats={[['Total Categories', '24', Boxes, 'green'], ['Active Categories', '21', CheckCircle2, 'blue'], ['Mapped Products', '154', Database, 'purple'], ['Inactive', '03', Minus, 'amber']]} />
      <SettingsInventoryTable
        title="Category List"
        searchPlaceholder="Search product categories..."
        addLabel="Add Category"
        onNotify={onNotify}
        columns={['Category Name', 'Code', 'Parent Category', 'Products', 'Default Tax', 'Status', 'Action']}
        rows={rows.map((row) => [
          row.name,
          row.code,
          row.parent,
          row.items,
          row.tax,
          <SettingsStatusBadge label={row.status} tone={row.status === 'Inactive' ? 'amber' : 'green'} />,
          <UserActionButton label={`Open ${row.name}`} icon={MoreVertical} tone="blue" onClick={() => onNotify(`${row.name} category opened`)} />,
        ])}
        sideTitle="Category Rules"
        sideRows={[['Default Valuation', 'FIFO'], ['Negative Stock', 'Blocked'], ['Auto SKU', 'Enabled'], ['Tax Mapping', 'Required']]}
      />
    </section>
  );
}"""

NEW_PRODUCT_CATS = """function SettingsProductCategoriesContent({ onOpenSection, onNotify }) {
  const { rows, loading } = useSettingsMasters('product_category', onNotify);
  const activeCount = rows.filter((row) => row.is_active).length;

  return (
    <section className={`${panelClass} p-4 sm:p-5`}>
      <SettingsContentHeader title="Product Categories" note="Manage inventory product categories, parent groups and default tax rules." onCancel={() => onOpenSection('Settings')} onSave={() => onNotify('Product categories saved')} />
      <SettingsInventoryStats stats={[['Total Categories', String(rows.length), Boxes, 'green'], ['Active Categories', String(activeCount), CheckCircle2, 'blue'], ['Mapped Products', '—', Database, 'purple'], ['Inactive', String(rows.length - activeCount), Minus, 'amber']]} />
      {loading ? <p className="py-8 text-center text-[13px] font-bold text-[#53647f]">Loading categories...</p> : (
      <SettingsInventoryTable
        title="Category List"
        searchPlaceholder="Search product categories..."
        addLabel="Add Category"
        onNotify={onNotify}
        columns={['Category Name', 'Code', 'Parent Category', 'Products', 'Default Tax', 'Status', 'Action']}
        rows={rows.map((row) => [
          row.name,
          row.code || '—',
          row.metadata?.parent || '—',
          row.metadata?.items ?? '—',
          row.metadata?.tax ?? '—',
          <SettingsStatusBadge label={row.is_active ? 'Active' : 'Inactive'} tone={row.is_active ? 'green' : 'amber'} />,
          <UserActionButton label={`Open ${row.name}`} icon={MoreVertical} tone="blue" onClick={() => onNotify(`${row.name} category opened`)} />,
        ])}
        sideTitle="Category Rules"
        sideRows={[['Default Valuation', 'FIFO'], ['Negative Stock', 'Blocked'], ['Auto SKU', 'Enabled'], ['Tax Mapping', 'Required']]}
      />
      )}
    </section>
  );
}"""

if OLD_PRODUCT_CATS in text:
    text = text.replace(OLD_PRODUCT_CATS, NEW_PRODUCT_CATS)

APP.write_text(text, encoding="utf-8")
print("App.jsx patched successfully.")
