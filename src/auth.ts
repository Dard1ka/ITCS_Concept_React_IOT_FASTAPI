export interface User {
  nik: string;
  name: string;
  email: string;
  password: string;
}

export function getUsers(): User[] {
  const data = localStorage.getItem("users");
  return data ? JSON.parse(data) : [];
}

export function addUser(user: User) {
  const users = getUsers();

  users.push(user);
  localStorage.setItem("users", JSON.stringify(users));
}

export function login(nik: string, password: string): boolean {
  const users = getUsers();
  const found = users.find((u) => u.nik === nik && u.password === password);

  if (!found) return false;

  localStorage.setItem("loggedIn", "true");
  localStorage.setItem("currentUser", JSON.stringify(found));

  return true;
}

export function getCurrentUser(): User | null {
  const data = localStorage.getItem("currentUser");
  return data ? JSON.parse(data) : null;
}

export function logout() {
  localStorage.removeItem("loggedIn");
  localStorage.removeItem("currentUser");
}
