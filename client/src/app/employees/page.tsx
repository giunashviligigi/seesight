"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { departmentsApi, Department } from "@/lib/api/departments";
import { employeesApi, Employee } from "@/lib/api/employees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SortBy = "lastName" | "firstName" | "email" | "jobTitle";

export default function EmployeesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("lastName");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [createDeptId, setCreateDeptId] = useState("");
  const [createLogin, setCreateLogin] = useState(false);
  const [nationality, setNationality] = useState("");
  const [preferredAirport, setPreferredAirport] = useState("");

  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editDeptId, setEditDeptId] = useState("");

  async function loadEmployees(
    token: string,
    opts: {
      page?: number;
      search?: string;
      departmentId?: string;
      sortBy?: SortBy;
      sortOrder?: "asc" | "desc";
    } = {},
  ) {
    const result = await employeesApi.list(
      {
        page: opts.page ?? page,
        pageSize,
        search: (opts.search ?? search) || undefined,
        departmentId: (opts.departmentId ?? departmentId) || undefined,
        sortBy: opts.sortBy ?? sortBy,
        sortOrder: opts.sortOrder ?? sortOrder,
      },
      token,
    );
    setItems(result.items);
    setTotal(result.total);
    setPage(result.page);
  }

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    void (async () => {
      try {
        const me = await authApi.me(token);
        if (me.role === "EMPLOYEE") {
          router.replace("/profile");
          return;
        }
        if (me.role === "SUPER_ADMIN") {
          router.replace("/companies");
          return;
        }
        if (!me.companyId) {
          router.replace("/company");
          return;
        }
        const depts = await departmentsApi.list(undefined, token);
        setDepartments(depts);
        await loadEmployees(token, { page: 1, search: "", departmentId: "" });
      } catch (err) {
        storeAccessToken(null);
        setError(err instanceof ApiError ? err.message : "Unable to load employees");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
    // Initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredAccessToken();
    if (!token) return;
    setError(null);
    try {
      await loadEmployees(token, { page: 1, search, departmentId, sortBy, sortOrder });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Filter failed");
    }
  }

  async function onCreateEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredAccessToken();
    if (!token) return;
    setError(null);
    setMessage(null);
    try {
      const created = await employeesApi.create(
        {
          email,
          firstName,
          lastName,
          jobTitle: jobTitle || undefined,
          phone: phone || undefined,
          departmentId: createDeptId || undefined,
          nationality: nationality || undefined,
          preferredAirport: preferredAirport || undefined,
          createLogin,
        },
        token,
      );
      setMessage(
        created.temporaryPassword
          ? `employee created. temporary password: ${created.temporaryPassword}`
          : "employee created (roster only — no login).",
      );
      setEmail("");
      setFirstName("");
      setLastName("");
      setJobTitle("");
      setPhone("");
      setCreateDeptId("");
      setNationality("");
      setPreferredAirport("");
      setCreateLogin(false);
      await loadEmployees(token, { page: 1 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Create failed");
    }
  }

  async function onCreateDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredAccessToken();
    if (!token) return;
    setError(null);
    setMessage(null);
    try {
      await departmentsApi.create(
        { name: deptName, code: deptCode || undefined },
        token,
      );
      setDeptName("");
      setDeptCode("");
      setMessage("department created.");
      setDepartments(await departmentsApi.list(undefined, token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Department create failed");
    }
  }

  async function onDeleteDepartment(id: string) {
    const token = getStoredAccessToken();
    if (!token) return;
    setError(null);
    setMessage(null);
    try {
      await departmentsApi.remove(id, token);
      setDepartments(await departmentsApi.list(undefined, token));
      setMessage("department removed.");
      await loadEmployees(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Department delete failed");
    }
  }

  function startEdit(employee: Employee) {
    setEditId(employee.id);
    setEditFirstName(employee.firstName);
    setEditLastName(employee.lastName);
    setEditJobTitle(employee.jobTitle ?? "");
    setEditPhone(employee.phone ?? "");
    setEditDeptId(employee.departmentId ?? "");
  }

  async function onSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredAccessToken();
    if (!token || !editId) return;
    setError(null);
    setMessage(null);
    try {
      await employeesApi.update(
        editId,
        {
          firstName: editFirstName,
          lastName: editLastName,
          jobTitle: editJobTitle || null,
          phone: editPhone || null,
          departmentId: editDeptId || null,
        },
        token,
      );
      setEditId(null);
      setMessage("employee updated.");
      await loadEmployees(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Update failed");
    }
  }

  async function toggleStatus(employee: Employee) {
    const token = getStoredAccessToken();
    if (!token) return;
    setError(null);
    setMessage(null);
    try {
      if (employee.status === "ACTIVE") {
        await employeesApi.deactivate(employee.id, token);
        setMessage(`${employee.email} deactivated (login blocked if linked).`);
      } else {
        await employeesApi.activate(employee.id, token);
        setMessage(`${employee.email} activated.`);
      }
      await loadEmployees(token);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed");
    }
  }

  async function goToPage(next: number) {
    const token = getStoredAccessToken();
    if (!token) return;
    try {
      await loadEmployees(token, { page: next });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Pagination failed");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading employees...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm font-semibold tracking-[0.35em] text-ss-text uppercase">
          Seesight
        </Link>
        <div className="flex gap-3">
          <Link href="/company" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            company
          </Link>
          <Link href="/account" className="text-sm text-ss-muted lowercase hover:text-ss-text">
            account
          </Link>
        </div>
      </header>

      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <h1 className="text-3xl font-medium text-ss-text lowercase">employees</h1>
        <p className="mt-2 text-sm text-ss-muted lowercase">
          roster with search, department filter, sort, and pagination. deactivate keeps trip history.
        </p>

        <form className="mt-8 grid gap-3 md:grid-cols-4" onSubmit={onFilter}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search name, email, title"
            className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text md:col-span-2"
          />
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="h-11 rounded-xl border border-white/20 bg-ss-surface-strong px-3 text-ss-text lowercase"
          >
            <option value="">all departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="h-11 flex-1 rounded-xl border border-white/20 bg-ss-surface-strong px-3 text-ss-text lowercase"
            >
              <option value="lastName">last name</option>
              <option value="firstName">first name</option>
              <option value="email">email</option>
              <option value="jobTitle">job title</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              className="h-11 w-24 rounded-xl border border-white/20 bg-ss-surface-strong px-3 text-ss-text lowercase"
            >
              <option value="asc">asc</option>
              <option value="desc">desc</option>
            </select>
          </div>
          <Button
            type="submit"
            className="h-11 rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover md:col-span-4 md:w-fit"
          >
            apply filters
          </Button>
        </form>

        {error ? (
          <p className="mt-4 text-sm text-red-300 lowercase" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 text-sm text-ss-text lowercase" role="status">
            {message}
          </p>
        ) : null}

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm lowercase">
            <thead className="text-ss-muted">
              <tr>
                <th className="pb-3 font-normal">name</th>
                <th className="pb-3 font-normal">email</th>
                <th className="pb-3 font-normal">department</th>
                <th className="pb-3 font-normal">title</th>
                <th className="pb-3 font-normal">status</th>
                <th className="pb-3 font-normal">actions</th>
              </tr>
            </thead>
            <tbody className="text-ss-text">
              {items.map((employee) => (
                <tr key={employee.id} className="border-t border-white/10">
                  <td className="py-3">
                    {employee.firstName} {employee.lastName}
                  </td>
                  <td className="py-3">{employee.email}</td>
                  <td className="py-3">{employee.departmentName ?? "—"}</td>
                  <td className="py-3">{employee.jobTitle ?? "—"}</td>
                  <td className="py-3">{employee.status.toLowerCase()}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(employee)}
                        className="text-ss-muted underline hover:text-ss-text"
                      >
                        edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleStatus(employee)}
                        className="text-ss-muted underline hover:text-ss-text"
                      >
                        {employee.status === "ACTIVE" ? "deactivate" : "activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-ss-muted lowercase">
          <p>
            {total} employees · page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={page <= 1}
              onClick={() => void goToPage(page - 1)}
              className="h-9 rounded-full border border-white/20 bg-transparent px-4 text-ss-text lowercase disabled:opacity-40"
            >
              prev
            </Button>
            <Button
              type="button"
              disabled={page >= totalPages}
              onClick={() => void goToPage(page + 1)}
              className="h-9 rounded-full border border-white/20 bg-transparent px-4 text-ss-text lowercase disabled:opacity-40"
            >
              next
            </Button>
          </div>
        </div>
      </section>

      {editId ? (
        <section className="mt-8 rounded-3xl border border-white/15 bg-ss-surface p-8">
          <h2 className="text-xl font-medium text-ss-text lowercase">edit employee</h2>
          <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={onSaveEdit}>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">first name</Label>
              <Input
                required
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">last name</Label>
              <Input
                required
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">job title</Label>
              <Input
                value={editJobTitle}
                onChange={(e) => setEditJobTitle(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">phone</Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label className="lowercase text-ss-muted">department</Label>
              <select
                value={editDeptId}
                onChange={(e) => setEditDeptId(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/20 bg-ss-surface-strong px-3 text-ss-text lowercase"
              >
                <option value="">unassigned</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 sm:col-span-2">
              <Button
                type="submit"
                className="h-11 rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover"
              >
                save
              </Button>
              <Button
                type="button"
                onClick={() => setEditId(null)}
                className="h-11 rounded-full border border-white/20 bg-transparent px-6 text-ss-text lowercase"
              >
                cancel
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/15 bg-ss-surface p-8">
          <h2 className="text-xl font-medium text-ss-text lowercase">add employee</h2>
          <form className="mt-6 space-y-4" onSubmit={onCreateEmployee}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="lowercase text-ss-muted">first name</Label>
                <Input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
                />
              </div>
              <div className="space-y-2">
                <Label className="lowercase text-ss-muted">last name</Label>
                <Input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">email</Label>
              <Input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="lowercase text-ss-muted">job title</Label>
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
                />
              </div>
              <div className="space-y-2">
                <Label className="lowercase text-ss-muted">phone</Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="lowercase text-ss-muted">nationality</Label>
                <Input
                  maxLength={2}
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="GE"
                  className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
                />
              </div>
              <div className="space-y-2">
                <Label className="lowercase text-ss-muted">preferred airport</Label>
                <Input
                  maxLength={8}
                  value={preferredAirport}
                  onChange={(e) => setPreferredAirport(e.target.value)}
                  placeholder="TBS"
                  className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">department</Label>
              <select
                value={createDeptId}
                onChange={(e) => setCreateDeptId(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/20 bg-ss-surface-strong px-3 text-ss-text lowercase"
              >
                <option value="">unassigned</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-ss-muted lowercase">
              <input
                type="checkbox"
                checked={createLogin}
                onChange={(e) => setCreateLogin(e.target.checked)}
              />
              create login with temporary password
            </label>
            <Button
              type="submit"
              className="h-11 rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover"
            >
              create employee
            </Button>
          </form>
        </div>

        <div className="rounded-3xl border border-white/15 bg-ss-surface p-8">
          <h2 className="text-xl font-medium text-ss-text lowercase">departments</h2>
          <ul className="mt-6 space-y-2 text-sm lowercase text-ss-text">
            {departments.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between border-b border-white/10 py-2"
              >
                <span>
                  {d.name}
                  {d.code ? ` (${d.code})` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => void onDeleteDepartment(d.id)}
                  className="text-ss-muted underline hover:text-ss-text"
                >
                  remove
                </button>
              </li>
            ))}
          </ul>
          <form className="mt-6 space-y-4" onSubmit={onCreateDepartment}>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">name</Label>
              <Input
                required
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <div className="space-y-2">
              <Label className="lowercase text-ss-muted">code</Label>
              <Input
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text"
              />
            </div>
            <Button
              type="submit"
              className="h-11 rounded-full bg-ss-accent px-6 text-white lowercase hover:bg-ss-accent-hover"
            >
              add department
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
