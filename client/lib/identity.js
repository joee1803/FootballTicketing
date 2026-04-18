function slugPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function randomSuffix() {
  return Math.floor(100 + Math.random() * 900).toString();
}

export function buildAssignedSupporterEmail(firstName, lastName) {
  const first = slugPart(firstName);
  const last = slugPart(lastName);
  const joined = `${first}${last}` || "supporter";
  return `${joined}${randomSuffix()}@matchdayfan.local`;
}

export function buildAssignedAdminEmail(name) {
  const joined = slugPart(name) || "admin";
  return `${joined}${randomSuffix()}@matchdayadmin.local`;
}
