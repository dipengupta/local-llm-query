export async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const fallbackText = text && !text.trim().startsWith("<") ? text.trim() : "";
    const message = data.detail || fallbackText || `Request failed (${response.status}).`;
    const error = new Error(message);
    error.data = data;
    error.status = response.status;
    throw error;
  }

  return data;
}
