"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { authApi, AuthUser, getStoredAccessToken, storeAccessToken } from "@/lib/api/auth";
import { companiesApi } from "@/lib/api/companies";
import { departmentsApi, Department } from "@/lib/api/departments";
import { employeesApi, Employee } from "@/lib/api/employees";
import { normalizeCountryInput } from "@/lib/country";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type SortBy = "lastName" | "firstName" | "email" | "jobTitle";

function EmployeesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyIdParam = searchParams.get("companyId")?.trim() || "";
  const [user, setUser] = useState<AuthUser | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [scopedCompanyId, setScopedCompanyId] = useState<string | null>(null);
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
  const [createLogin, setCreateLogin] = useState(true);
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

  const isSuperAdminView = user?.role === "SUPER_ADMIN";
  const listCompanyId =
    isSuperAdminView || scopedCompanyId
      ? (scopedCompanyId ?? undefined)
      : undefined;

  async function loadEmployees(
    token: string,
    companyId: string | undefined,
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
        companyId,
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

  async function loadDepartments(token: string, companyId: string | undefined) {
    setDepartments(await departmentsApi.list(companyId, token));
  }

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    void (async () => {
      setLoading(true);
      try {
        const me = await authApi.me(token);
        setUser(me);
        if (me.role === "EMPLOYEE") {
          router.replace("/profile");
          return;
        }
        if (me.role === "SUPER_ADMIN") {
          if (!companyIdParam) {
            router.replace("/companies");
            return;
          }
          const company = await companiesApi.getById(companyIdParam, token);
          setCompanyName(company.name);
          setScopedCompanyId(company.id);
          await loadDepartments(token, company.id);
          await loadEmployees(token, company.id, {
            page: 1,
            search: "",
            departmentId: "",
          });
          return;
        }
        if (!me.companyId) {
          router.replace("/company");
          return;
        }
        setCompanyName(null);
        setScopedCompanyId(me.companyId);
        await loadDepartments(token, undefined);
        await loadEmployees(token, undefined, {
          page: 1,
          search: "",
          departmentId: "",
        });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          setError(err.message);
          router.replace("/companies");
          return;
        }
        storeAccessToken(null);
        setError(err instanceof ApiError ? err.message : "Unable to load employees");
        router.replace("/login");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, companyIdParam]);

  async function onFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredAccessToken();
    if (!token) return;
    setError(null);
    try {
      await loadEmployees(token, listCompanyId, {
        page: 1,
        search,
        departmentId,
        sortBy,
        sortOrder,
      });
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
      let nationalityCode: string | undefined;
      try {
        nationalityCode = normalizeCountryInput(nationality) || undefined;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid nationality");
        return;
      }
      const created = await employeesApi.create(
        {
          email,
          firstName,
          lastName,
          jobTitle: jobTitle || undefined,
          phone: phone || undefined,
          departmentId: createDeptId || undefined,
          nationality: nationalityCode,
          preferredAirport: preferredAirport || undefined,
          createLogin,
          companyId: isSuperAdminView ? scopedCompanyId ?? undefined : undefined,
        },
        token,
      );
      setMessage(
        created.temporaryPassword
          ? `employee account created. one-time password is in your notifications (and below): ${created.temporaryPassword}`
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
      await loadEmployees(token, listCompanyId, { page: 1 });
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
        {
          name: deptName,
          code: deptCode || undefined,
          companyId: isSuperAdminView ? scopedCompanyId ?? undefined : undefined,
        },
        token,
      );
      setDeptName("");
      setDeptCode("");
      setMessage("department created.");
      await loadDepartments(token, listCompanyId);
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
      await loadDepartments(token, listCompanyId);
      setMessage("department removed.");
      await loadEmployees(token, listCompanyId);
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
      await loadEmployees(token, listCompanyId);
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
      await loadEmployees(token, listCompanyId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Status update failed");
    }
  }

  async function onDeleteEmployee(employee: Employee) {
    const token = getStoredAccessToken();
    if (!token) return;
    const confirmed = window.confirm(
      `Remove ${employee.firstName} ${employee.lastName} (${employee.email})? Their login will be disabled and they will leave the roster.`,
    );
    if (!confirmed) return;
    setError(null);
    setMessage(null);
    try {
      await employeesApi.remove(employee.id, token);
      setMessage(`${employee.email} removed.`);
      if (editId === employee.id) setEditId(null);
      await loadEmployees(token, listCompanyId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    }
  }

  async function goToPage(next: number) {
    const token = getStoredAccessToken();
    if (!token) return;
    try {
      await loadEmployees(token, listCompanyId, { page: next });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Pagination failed");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <p className="text-ss-muted lowercase">loading employees...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
      <AppHeader user={user} />

      <section className="mt-12 rounded-3xl border border-white/15 bg-ss-surface p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-medium text-ss-text lowercase">employees</h1>
            <p className="mt-2 text-sm text-ss-muted lowercase">
              {companyName
                ? `roster for ${companyName}`
                : "roster with search, department filter, sort, and pagination. deactivate keeps trip history."}
            </p>
          </div>
          {isSuperAdminView ? (
            <Link
              href="/companies"
              className="text-sm text-ss-accent lowercase hover:underline"
            >
              back to companies
            </Link>
          ) : null}
        </div>

        <form className="mt-8 grid gap-3 md:grid-cols-4" onSubmit={onFilter}>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search name, email, title"
            className="h-11 rounded-xl border-white/20 bg-ss-surface-strong text-ss-text md:col-span-2"
          />
          <Select
            value={departmentId}
            onValueChange={setDepartmentId}
            aria-label="department filter"
            options={[
              { value: "", label: "all departments" },
              ...departments.map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
          <div className="flex gap-2">
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortBy)}
              aria-label="sort by"
              className="flex-1"
              options={[
                { value: "lastName", label: "last name" },
                { value: "firstName", label: "first name" },
                { value: "email", label: "email" },
                { value: "jobTitle", label: "job title" },
              ]}
            />
            <Select
              value={sortOrder}
              onValueChange={(v) => setSortOrder(v as "asc" | "desc")}
              aria-label="sort order"
              className="w-24"
              options={[
                { value: "asc", label: "asc" },
                { value: "desc", label: "desc" },
              ]}
            />
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
                      <button
                        type="button"
                        onClick={() => void onDeleteEmployee(employee)}
                        className="text-red-300 underline hover:text-red-200"
                      >
                        delete
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
              <Select
                value={editDeptId}
                onValueChange={setEditDeptId}
                aria-label="edit department"
                options={[
                  { value: "", label: "unassigned" },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
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
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="Georgia"
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
              <Select
                value={createDeptId}
                onValueChange={setCreateDeptId}
                aria-label="department"
                options={[
                  { value: "", label: "unassigned" },
                  ...departments.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-ss-muted lowercase">
              <input
                type="checkbox"
                checked={createLogin}
                onChange={(e) => setCreateLogin(e.target.checked)}
              />
              create login with one-time temporary password (employee must change it on first login)
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

export default function EmployeesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center px-6">
          <p className="text-ss-muted lowercase">loading employees...</p>
        </main>
      }
    >
      <EmployeesPageContent />
    </Suspense>
  );
}
